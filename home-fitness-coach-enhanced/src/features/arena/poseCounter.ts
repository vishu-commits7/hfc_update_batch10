/**
 * Camera rep counting (pose detection, on-device). Video never leaves the phone for this.
 * This file runs the camera and the pose model; the judging of each rep is in repEngine.ts.
 * MediaPipe ships inside the app (see below) and loads the first time it's used; any load failure
 * just falls back to tap counting.
 */
import { useEffect, useRef, useState } from "react";
import { RepEngine, type Cue, type Evidence, type Family, type Pt, type Reject } from "./repEngine";

export type { Family } from "./repEngine";
export { familyFor } from "./repEngine";

/**
 * Files live inside the app (public/mediapipe, copied there by `npm run fetch:mediapipe`) so counting works
 * offline. If they are missing, the same files are loaded from a CDN as a fallback.
 */
const LOCAL = "/mediapipe";
const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const CDN_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/** True when the bundled model file really exists (a missing file can come back as the app's index.html). */
async function bundledFilesPresent(): Promise<boolean> {
  try {
    const r = await fetch(`${LOCAL}/pose_landmarker_lite.task`, { method: "HEAD" });
    return r.ok && !(r.headers.get("content-type") || "").includes("text/html");
  } catch { return false; }
}

/* ---- device check and remembered choice ---- */
const PREF_KEY = "apex_cam_count_v1";
type CamPref = { pref?: "camera" | "tap"; autoOff?: "device" | "slow" };
const readPref = (): CamPref => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") as CamPref; } catch { return {}; } };
const writePref = (p: CamPref) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* storage blocked: choice just isn't remembered */ } };

/** Low-end phone: under 3 GB RAM or fewer than 4 CPU cores (when the browser reports them). */
export function lowEndDevice(): boolean {
  const n = navigator as Navigator & { deviceMemory?: number };
  return (typeof n.deviceMemory === "number" && n.deviceMemory < 3) || (typeof n.hardwareConcurrency === "number" && n.hardwareConcurrency < 4);
}

/** What to do when a match starts: use the camera, or stay on taps (and why). */
export function cameraCountingPlan(): { start: boolean; blocked: "device" | "slow" | null } {
  const p = readPref();
  if (p.autoOff) return { start: false, blocked: p.autoOff };      // it was too slow on this phone before
  if (lowEndDevice() && p.pref !== "camera") return { start: false, blocked: "device" };
  return { start: p.pref !== "tap", blocked: null };                  // camera is the default: only camera-checked reps are rated
}
/** Remember the player's own on/off choice. */
export function rememberCamChoice(on: boolean) { writePref({ ...readPref(), pref: on ? "camera" : "tap" }); }
/** Player chose "try anyway": forget the automatic switch-off. */
export function allowCameraAnyway() { writePref({ pref: "camera" }); }
const markTooSlow = () => writePref({ ...readPref(), autoOff: "slow" });

let landmarkerP: Promise<any> | null = null;
function loadLandmarker(): Promise<any> {
  if (!landmarkerP) {
    landmarkerP = (async () => {
      const build = async (local: boolean) => {
        const base = local ? LOCAL : CDN;
        // the bundled copy is named .js (not .mjs) so every WebView serves it with a JavaScript MIME type
        const mod: any = await import(/* @vite-ignore */ `${base}/vision_bundle.${local ? "js" : "mjs"}`);
        const fileset = await mod.FilesetResolver.forVisionTasks(`${base}/wasm`);
        const modelAssetPath = local ? `${LOCAL}/pose_landmarker_lite.task` : CDN_MODEL;
        const make = (delegate: "GPU" | "CPU") => mod.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath, delegate },
          runningMode: "VIDEO", numPoses: 1,
          minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
        });
        try { return await make("GPU"); } catch { return await make("CPU"); }
      };
      if (await bundledFilesPresent()) {
        try { return await build(true); } catch (e) { console.warn("Bundled pose files failed, trying CDN", e); }
      }
      return build(false);
    })();
    landmarkerP.catch(() => { landmarkerP = null; });
  }
  return landmarkerP;
}

export type PoseStatus = "off" | "loading" | "tracking" | "lost" | "error" | "slow";

export interface PoseLive {
  status: PoseStatus;
  /** 0 = top of the rep, 1 = deep enough */
  depth: number;
  cue: Cue | null;
  /** reps refused so far, and why the last one was */
  rejected: number;
  lastReject: Reject | null;
}
const IDLE: PoseLive = { status: "off", depth: 0, cue: null, rejected: 0, lastReject: null };

/**
 * Runs pose detection on a camera stream and judges every rep with the RepEngine.
 * `clock` returns milliseconds since the match went live; `onRep` gets the evidence record for each counted rep.
 * Video frames stay on the phone: only the small evidence records are sent to the server.
 */
export function usePoseCounter(stream: MediaStream | null, enabled: boolean, family: Family | null, clock: () => number, onRep: (ev: Evidence) => void): PoseLive {
  const [live, setLive] = useState<PoseLive>(IDLE);
  const repRef = useRef(onRep);
  repRef.current = onRep;
  const clockRef = useRef(clock);
  clockRef.current = clock;

  useEffect(() => {
    if (!enabled || !stream || !family) { setLive(IDLE); return; }
    let alive = true;
    let raf = 0;
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.srcObject = stream;
    const engine = new RepEngine(family);
    let lastReject: Reject | null = null;
    let shown = "";
    const show = (status: PoseStatus, depth: number, cue: Cue | null) => {
      // redraw only when something the player can see changed (depth in 5% steps)
      const d = Math.round(depth * 20) / 20;
      const key = `${status}|${d}|${cue}|${engine.rejected}`;
      if (key === shown) return;
      shown = key;
      setLive({ status, depth: d, cue, rejected: engine.rejected, lastReject });
    };
    show("loading", 0, null);
    (async () => {
      try {
        const [lmk] = await Promise.all([loadLandmarker(), video.play()]);
        if (!alive) return;
        let lastTs = 0, lastVideoT = -1;
        // speed check: after a short warm-up, average the detection time over windows of 20 frames.
        // Two slow windows in a row (about 9 fps or worse) means this phone can't keep up, so use taps.
        let seen = 0, win = 0, winMs = 0, slowWins = 0;
        const loop = () => {
          if (!alive) return;
          raf = requestAnimationFrame(loop);
          const now = performance.now();
          if (now - lastTs < 66 || video.readyState < 2 || video.currentTime === lastVideoT) return; // ~15 fps
          lastTs = now; lastVideoT = video.currentTime;
          try {
            const t0 = performance.now();
            const res = lmk.detectForVideo(video, now);
            if (++seen > 3) {
              winMs += performance.now() - t0; win++;
              if (win >= 20) {
                slowWins = winMs / win > 110 ? slowWins + 1 : 0;
                win = 0; winMs = 0;
                if (slowWins >= 2) { alive = false; markTooSlow(); show("slow", 0, null); return; }
              }
            }
            const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 1;
            const f = engine.feed(res?.landmarks?.[0] as Pt[] | undefined, clockRef.current(), aspect);
            if (f.rep && !f.rep.ok) lastReject = f.rep.reason;
            if (f.rep?.ok) { lastReject = null; repRef.current(f.rep.ev); }
            show(f.tracking ? "tracking" : "lost", f.depth, f.cue);
          } catch { /* skip a bad frame */ }
        };
        raf = requestAnimationFrame(loop);
      } catch {
        if (alive) show("error", 0, null);
      }
    })();
    return () => { alive = false; cancelAnimationFrame(raf); video.pause(); video.srcObject = null; };
  }, [stream, enabled, family]);

  return live;
}
