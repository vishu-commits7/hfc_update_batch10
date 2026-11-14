/**
 * The reel camera: opening it, the live viewfinder, and recording.
 * Kept out of the studio screen so the screen only draws and this file only handles the camera.
 *
 * What it takes care of:
 *  - asks for the best picture the phone gives (720x1280 at 30 fps), then steps down until something opens;
 *  - if the microphone is refused, opens the camera without sound instead of failing;
 *  - attaches the stream to the viewfinder whenever either of them appears (the old code attached it before the
 *    viewfinder existed, which left a black screen);
 *  - never leaves an old stream running when a newer request overtakes it (a left-open camera blocks the next open);
 *  - releases the camera when the app goes to the background and reopens it on return;
 *  - records with the phone's hardware H.264 encoder when available, at a bitrate that looks clean and still fits
 *    a 60 second clip under the 25 MB upload limit.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const REEL_MAX_SECONDS = 60;
/** 2.5 Mbit/s video + 128 kbit/s sound: about 19.7 MB for 60 s, under the 25 MB limit. (It was 0.9 Mbit/s.) */
export const REEL_VIDEO_BPS = 2_500_000;
export const REEL_AUDIO_BPS = 128_000;

type Facing = "user" | "environment";

/** Best first. H.264 in MP4 uses the phone's hardware encoder and plays everywhere; VP8 is the light software fallback. */
const MIME_LADDER = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=h264,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm",
];
export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of MIME_LADDER) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* try the next one */ } }
  return "";
}

const VIDEO_LADDER = (facing: Facing): MediaTrackConstraints[] => [
  { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30, max: 30 } },
  { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
  { facingMode: facing },
  {},
];

/** Plain words for why the camera did not open. */
export function cameraErrorText(err: unknown): string {
  const name = (err as { name?: string })?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access is off. Allow Camera for Apex Pulse in your phone's Settings > Apps > Permissions, then tap Open camera.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError" || name === "AbortError") return "The camera is busy in another app. Close that app, then tap Open camera.";
  return "Couldn't open the camera. Tap Open camera to try again, or record with your phone's camera app.";
}

export interface ReelCamera {
  stream: MediaStream | null;
  /** give this to the viewfinder <video ref> */
  attach: (el: HTMLVideoElement | null) => void;
  opening: boolean;
  error: string | null;
  clearError: () => void;
  facing: Facing;
  flip: () => void;
  micOn: boolean;
  /** false when the phone refused the microphone: recordings will be silent */
  micAvailable: boolean;
  toggleMic: () => void;
  open: () => void;
  close: () => void;
  recording: boolean;
  seconds: number;
  startRecording: () => void;
  stopRecording: () => void;
}

export function useReelCamera(active: boolean, onRecorded: (blob: Blob) => void): ReelCamera {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<Facing>("user");
  const [micOn, setMicOn] = useState(true);
  const [micAvailable, setMicAvailable] = useState(true);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const seq = useRef(0);                       // newest open request wins; older ones stop their own stream
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const tick = useRef<number | null>(null);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;
  const micOnRef = useRef(micOn);
  micOnRef.current = micOn;

  const show = (el: HTMLVideoElement | null, s: MediaStream | null) => {
    if (!el) return;
    if (el.srcObject !== s) el.srcObject = s;
    if (s) void el.play().catch(() => { /* autoplay refused: the element still shows the first frame */ });
  };
  const attach = useCallback((el: HTMLVideoElement | null) => { videoRef.current = el; show(el, streamRef.current); }, []);

  const close = useCallback(() => {
    seq.current++;                              // cancels any open that is still in flight
    if (tick.current) { clearInterval(tick.current); tick.current = null; }
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") { rec.ondataavailable = null; rec.onstop = null; try { rec.stop(); } catch { /* already stopped */ } }
    recRef.current = null;
    setRecording(false);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    show(videoRef.current, null);
    setStream(null);
    setOpening(false);
  }, []);

  const openWith = useCallback(async (face: Facing) => {
    const mine = ++seq.current;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStream(null);
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) { setError("This device can't open the camera here. Record with your phone's camera app."); return; }
    setOpening(true);
    let got: MediaStream | null = null, lastErr: unknown = null, hasMic = true;
    const audio: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true };
    for (const withMic of [true, false]) {
      for (const video of VIDEO_LADDER(face)) {
        try { got = await navigator.mediaDevices.getUserMedia({ video, audio: withMic ? audio : false }); hasMic = withMic; break; }
        catch (e) {
          lastErr = e;
          const n = (e as { name?: string })?.name;
          if (n === "NotAllowedError" || n === "SecurityError" || n === "NotReadableError") break; // a smaller picture will not help
        }
      }
      if (got) break;
    }
    if (mine !== seq.current) { got?.getTracks().forEach(t => t.stop()); return; } // a newer request took over
    setOpening(false);
    if (!got) { setError(cameraErrorText(lastErr)); return; }
    const vt = got.getVideoTracks()[0];
    try { if (vt) (vt as MediaStreamTrack & { contentHint: string }).contentHint = "motion"; } catch { /* optional */ }
    got.getAudioTracks().forEach(t => { t.enabled = micOnRef.current; });
    setMicAvailable(hasMic && got.getAudioTracks().length > 0);
    streamRef.current = got;
    setStream(got);
    show(videoRef.current, got);
  }, []);

  const open = useCallback(() => { void openWith(facing); }, [openWith, facing]);

  // open while the camera screen is showing; release when it is not
  useEffect(() => {
    if (!active) { close(); return; }
    void openWith(facing);
    return close;
  }, [active, facing, openWith, close]);

  // the camera cannot be held in the background: release it, and reopen when the app comes back
  useEffect(() => {
    if (!active) return;
    const onVis = () => {
      if (document.hidden) { if (!recRef.current) close(); }
      else if (!streamRef.current) void openWith(facing);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [active, facing, openWith, close]);

  const flip = useCallback(() => { if (!recRef.current) setFacing(f => (f === "user" ? "environment" : "user")); }, []);
  // muting switches the sound track off; it does not restart the camera
  const toggleMic = useCallback(() => {
    setMicOn(on => { const next = !on; streamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; }); return next; });
  }, []);

  const stopRecording = useCallback(() => {
    if (tick.current) { clearInterval(tick.current); tick.current = null; }
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") { try { rec.stop(); } catch { /* already stopped */ } }
    setRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    const s = streamRef.current;
    if (!s || recRef.current) return;
    if (typeof MediaRecorder === "undefined") { setError("This device can't record here. Use your phone's camera app instead."); return; }
    const mime = pickRecorderMime();
    try {
      const rec = new MediaRecorder(s, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: REEL_VIDEO_BPS, audioBitsPerSecond: REEL_AUDIO_BPS });
      chunks.current = [];
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.current.push(e.data); };
      rec.onerror = () => { setError("Recording stopped unexpectedly. Try again."); stopRecording(); };
      rec.onstop = () => {
        recRef.current = null;
        const blob = new Blob(chunks.current, { type: (rec.mimeType || mime || "video/webm").split(";")[0] });
        chunks.current = [];
        if (Date.now() - startedAt.current < 1000 || blob.size < 10_000) { setError("That was too short. Hold on for at least a second."); return; }
        onRecordedRef.current(blob);
      };
      rec.start(1000);
      recRef.current = rec;
      startedAt.current = Date.now();
      setSeconds(0);
      setRecording(true);
      setError(null);
      tick.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - startedAt.current) / 1000); // from the clock, so a busy phone cannot stretch the limit
        setSeconds(Math.min(REEL_MAX_SECONDS, sec));
        if (sec >= REEL_MAX_SECONDS) stopRecording();
      }, 250);
    } catch (e) {
      recRef.current = null;
      setError("Couldn't start recording" + ((e as Error)?.message ? `: ${(e as Error).message}` : ". Use your phone's camera app instead."));
    }
  }, [stopRecording]);

  return { stream, attach, opening, error, clearError: () => setError(null), facing, flip, micOn, micAvailable, toggleMic, open, close, recording, seconds, startRecording, stopRecording };
}
