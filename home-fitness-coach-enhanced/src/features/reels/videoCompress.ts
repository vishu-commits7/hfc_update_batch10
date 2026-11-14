/**
 * Makes a clip small enough to upload.
 *
 * A clip from the phone's own camera app is often 100 MB or more a minute, far over the 25 MB limit, so it used to
 * be refused outright. This plays the clip once into a 720p canvas and re-records it at a bitrate that fits. It takes
 * about as long as the clip itself and keeps the first 60 seconds. If the phone cannot do it, it throws a plain
 * message and nothing is uploaded.
 */
import { REEL_AUDIO_BPS, REEL_MAX_SECONDS, REEL_VIDEO_BPS, pickRecorderMime } from "./useReelCamera";

const MAX_SIDE = 1280;

export async function shrinkVideo(src: Blob, maxBytes: number, onProgress?: (pct: number) => void): Promise<Blob> {
  const fail = (why: string) => new Error(`This clip is ${(src.size / 1048576).toFixed(0)} MB and the limit is ${Math.round(maxBytes / 1048576)} MB. ${why}`);
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) throw fail("Record it inside the app, or pick a shorter clip.");
  const url = URL.createObjectURL(src);
  const video = document.createElement("video");
  video.playsInline = true; video.preload = "auto"; video.src = url;
  let ctx: AudioContext | null = null;
  try {
    await new Promise<void>((res, rej) => { video.onloadedmetadata = () => res(); video.onerror = () => rej(fail("The phone could not read it.")); });
    const dur = Math.min(REEL_MAX_SECONDS, Number.isFinite(video.duration) && video.duration > 0 ? video.duration : REEL_MAX_SECONDS);
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth || MAX_SIDE, video.videoHeight || MAX_SIDE));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(((video.videoWidth || 720) * scale) / 2) * 2);   // encoders want even sizes
    canvas.height = Math.max(2, Math.round(((video.videoHeight || 1280) * scale) / 2) * 2);
    const g = canvas.getContext("2d");
    if (!g) throw fail("The phone could not process it.");
    const out = canvas.captureStream(30);
    // sound goes to the recorder only, not to the speaker
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) { ctx = new AC(); const dest = ctx.createMediaStreamDestination(); ctx.createMediaElementSource(video).connect(dest); dest.stream.getAudioTracks().forEach(t => out.addTrack(t)); }
    } catch { video.muted = true; /* no sound path: keep the picture */ }
    const bps = Math.max(600_000, Math.min(REEL_VIDEO_BPS, Math.floor((maxBytes * 0.88 * 8) / dur) - REEL_AUDIO_BPS));
    const mime = pickRecorderMime();
    const rec = new MediaRecorder(out, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: bps, audioBitsPerSecond: REEL_AUDIO_BPS });
    const chunks: Blob[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<Blob>((res, rej) => {
      rec.onstop = () => res(new Blob(chunks, { type: (rec.mimeType || mime || "video/webm").split(";")[0] }));
      rec.onerror = () => rej(fail("The phone could not compress it."));
    });
    let raf = 0, stopped = false;
    const stop = () => { if (stopped) return; stopped = true; cancelAnimationFrame(raf); video.pause(); if (rec.state !== "inactive") rec.stop(); };
    const draw = () => {
      if (stopped) return;
      g.drawImage(video, 0, 0, canvas.width, canvas.height);
      onProgress?.(Math.min(99, Math.round((video.currentTime / dur) * 100)));
      if (video.ended || video.currentTime >= dur) { stop(); return; }
      raf = requestAnimationFrame(draw);
    };
    video.onended = stop;
    const guard = window.setTimeout(stop, (dur * 1.6 + 15) * 1000); // a stalled player must not hang the share button
    rec.start(1000);
    await video.play();
    draw();
    const blob = await done;
    clearTimeout(guard);
    if (blob.size < 20_000) throw fail("The phone could not compress it. Record it inside the app instead.");
    if (blob.size > maxBytes) throw fail("It is still too large after compressing. Pick a shorter clip.");
    onProgress?.(100);
    return blob;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src"); video.load();
    void ctx?.close().catch(() => {});
  }
}
