/**
 * Camera rep counting (pose detection, on-device). Video never leaves the phone for this.
 * MediaPipe is loaded from a CDN the first time it's used, so it adds nothing to the app size
 * and a load failure just falls back to tap counting.
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

const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let landmarkerP: Promise<any> | null = null;
function loadLandmarker(): Promise<any> {
  if (!landmarkerP) {
    landmarkerP = (async () => {
      const mod: any = await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`);
      const fileset = await mod.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      const make = (delegate: "GPU" | "CPU") => mod.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: "VIDEO", numPoses: 1,
        minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      try { return await make("GPU"); } catch { return await make("CPU"); }
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

export type PoseStatus = "off" | "loading" | "tracking" | "lost" | "error";

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
        const loop = () => {
          if (!alive) return;
          raf = requestAnimationFrame(loop);
          const now = performance.now();
          if (now - lastTs < 66 || video.readyState < 2 || video.currentTime === lastVideoT) return; // ~15 fps
          lastTs = now; lastVideoT = video.currentTime;
          try {
            const res = lmk.detectForVideo(video, now);
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
