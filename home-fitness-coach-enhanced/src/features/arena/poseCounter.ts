/**
 * Camera rep counting (pose detection, on-device). Video never leaves the phone for this.
 * MediaPipe ships inside the app (see below) and loads the first time it's used; any load failure
 * just falls back to tap counting.
 */
import { useEffect, useRef, useState } from "react";

export type Motion = "elbow" | "knee" | "hip";

/** Which joint angle drives the rep for an exercise. null = not supported, use tapping. */
export function motionFor(name: string): Motion | null {
  if (/push-?up|dip/i.test(name) && !/scapular|cobra/i.test(name)) return "elbow";
  if (/squat|lunge/i.test(name)) return "knee";
  if (/sit-?up|crunch/i.test(name)) return "hip";
  return null;
}

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
  return { start: p.pref === "camera", blocked: null };
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

type P = { x: number; y: number; visibility?: number };
const deg = (a: P, b: P, c: P) => {
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y, m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  return m ? (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI : 180;
};

// [shoulder, elbow, wrist] / [hip, knee, ankle] / [shoulder, hip, knee] landmark indices, left then right
const JOINTS: Record<Motion, [number[], number[]]> = {
  elbow: [[11, 13, 15], [12, 14, 16]],
  knee: [[23, 25, 27], [24, 26, 28]],
  hip: [[11, 23, 25], [12, 24, 26]],
};
// angle must drop below `down`, then rise above `up`, to count one rep
const LIMITS: Record<Motion, { down: number; up: number }> = {
  elbow: { down: 95, up: 150 },
  knee: { down: 105, up: 158 },
  hip: { down: 95, up: 130 },
};

export class RepCounter {
  private smooth: number | null = null;
  private low = false;
  private last = 0;
  constructor(private motion: Motion) {}
  /** Feed one frame of landmarks. Returns "rep", "tracking" (body found) or "lost" (body not visible enough). */
  feed(lm: P[], now: number): "rep" | "tracking" | "lost" {
    const [l, r] = JOINTS[this.motion];
    const vis = (ids: number[]) => ids.reduce((s, i) => s + (lm[i]?.visibility ?? 0), 0) / ids.length;
    const ids = vis(l) >= vis(r) ? l : r;
    if (ids.some(i => !lm[i] || (lm[i].visibility ?? 0) < 0.5)) return "lost";
    const raw = deg(lm[ids[0]], lm[ids[1]], lm[ids[2]]);
    this.smooth = this.smooth === null ? raw : this.smooth * 0.5 + raw * 0.5;
    const { down, up } = LIMITS[this.motion];
    if (this.smooth < down) this.low = true;
    else if (this.low && this.smooth > up && now - this.last > 350) { this.low = false; this.last = now; return "rep"; }
    return "tracking";
  }
}

export type PoseStatus = "off" | "loading" | "tracking" | "lost" | "error" | "slow";

/** Runs pose detection on a camera stream and calls onRep for every counted rep. */
export function usePoseCounter(stream: MediaStream | null, enabled: boolean, motion: Motion | null, onRep: () => void): PoseStatus {
  const [status, setStatus] = useState<PoseStatus>("off");
  const repRef = useRef(onRep);
  repRef.current = onRep;

  useEffect(() => {
    if (!enabled || !stream || !motion) { setStatus("off"); return; }
    let alive = true;
    let raf = 0;
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.srcObject = stream;
    const counter = new RepCounter(motion);
    setStatus("loading");
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
                if (slowWins >= 2) { alive = false; markTooSlow(); setStatus("slow"); return; }
              }
            }
            const pts = res?.landmarks?.[0] as P[] | undefined;
            if (!pts) { setStatus(s => (s === "lost" ? s : "lost")); return; }
            const out = counter.feed(pts, now);
            setStatus(out === "lost" ? "lost" : "tracking");
            if (out === "rep") repRef.current();
          } catch { /* skip a bad frame */ }
        };
        raf = requestAnimationFrame(loop);
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => { alive = false; cancelAnimationFrame(raf); video.pause(); video.srcObject = null; };
  }, [stream, enabled, motion]);

  return status;
}
