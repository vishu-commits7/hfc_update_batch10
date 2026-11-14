/**
 * The rep judge. Pure code (no camera, no React) so tools/check-reps.mjs can test it with made-up bodies.
 *
 * Input: the 33 body points the pose model finds in each camera frame. Output, per frame: whether the body is
 * in the right position, how deep the current rep is, a coaching cue, and (when a rep ends) whether it counts.
 *
 * A rep counts only if ALL of these hold:
 *   1. the body is in the right starting position for the exercise (a push-up is not counted while standing);
 *   2. the working joint bends far enough (depth) and straightens far enough (lockout);
 *   3. form held for at least 70% of the rep (for example a straight body line in a push-up);
 *   4. it took a believable time, and the joints were clearly visible.
 * A half rep is refused with the reason, so the player knows what to fix.
 *
 * Every counted rep produces an "evidence" record that the server checks again (functions/src/repVerify.ts).
 * The limits below must match that file; the check script fails if they drift apart.
 */
export type Family = "pushup" | "squat" | "lunge" | "situp" | "dip" | "jack";
export interface Pt { x: number; y: number; visibility?: number }
/** [endMs, durationMs, minAngle, maxAngle, form %, visibility %] */
export type Evidence = [number, number, number, number, number, number];

/** Which exercises the camera can judge. null = taps only. Same rules as the server's familyFor(). */
export function familyFor(name: string | null | undefined): Family | null {
  const n = String(name || "").toLowerCase();
  if (/scapular|cobra|shoulder tap|plank|pike|bicycle|thrust|jump|pistol|crunch/.test(n) && !/jumping jacks?/.test(n)) return null;
  if (/push-?ups?/.test(n)) return "pushup";
  if (/dips?\b/.test(n)) return "dip";
  if (/lunge|split squat/.test(n)) return "lunge";
  if (/squat/.test(n)) return "squat";
  if (/sit-?ups?/.test(n)) return "situp";
  if (/jumping jacks?/.test(n)) return "jack";
  return null;
}

export const LIMITS: Record<Family, { down: number; up: number }> = {
  pushup: { down: 100, up: 150 },
  dip: { down: 100, up: 150 },
  squat: { down: 105, up: 160 },
  lunge: { down: 105, up: 150 },
  situp: { down: 85, up: 118 },
  jack: { down: 55, up: 135 },
};
export const MIN_REP_MS = 350;
export const MAX_REP_MS = 11_000;
export const MIN_FORM_SHARE = 0.7;
export const MIN_VIS = 0.5;
const LOST_ABORT_MS = 700;

export type Cue =
  | "frame"        // step back: the whole body must be visible
  | "position"     // get into the starting position
  | "lower"        // go deeper
  | "lockout"      // straighten fully at the top
  | "line"         // keep the body straight / chest up
  | "ready";       // all good, go
export type Reject = "depth" | "form" | "fast" | "slow";

export interface Frame {
  tracking: boolean;
  /** 0 = top of the rep, 1 = deep enough */
  depth: number;
  cue: Cue;
  rep?: { ok: true; ev: Evidence } | { ok: false; reason: Reject };
}

/* ---- geometry ---- */
const L = { nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28 };
class Body {
  constructor(private lm: Pt[], private aspect: number) {}
  p(i: number) { const q = this.lm[i]; return q ? { x: q.x * this.aspect, y: q.y, v: q.visibility ?? 0 } : { x: 0, y: 0, v: 0 }; }
  vis(ids: number[]) { return ids.reduce((s, i) => s + this.p(i).v, 0) / ids.length; }
  /** angle at b, in degrees, between b->a and b->c */
  angle(a: number, b: number, c: number) {
    const A = this.p(a), B = this.p(b), C = this.p(c);
    const v1 = { x: A.x - B.x, y: A.y - B.y }, v2 = { x: C.x - B.x, y: C.y - B.y };
    const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    return m ? (Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / m))) * 180) / Math.PI : 180;
  }
  /** how far the line a->b is from horizontal: 0 = lying flat, 90 = upright */
  tilt(a: number, b: number) { const A = this.p(a), B = this.p(b); return (Math.atan2(Math.abs(A.y - B.y), Math.abs(A.x - B.x)) * 180) / Math.PI; }
  dist(a: number, b: number) { const A = this.p(a), B = this.p(b); return Math.hypot(A.x - B.x, A.y - B.y); }
  /** the side of the body the camera sees better */
  side() { return this.vis([L.lSh, L.lHip, L.lKn]) >= this.vis([L.rSh, L.rHip, L.rKn]) ? "l" : "r"; }
}

interface Spec {
  /** joints that must be visible; chosen for the better-seen side */
  joints: (b: Body) => number[];
  /** the measure that goes down to `down` and back up to `up` */
  metric: (b: Body) => number;
  /** null when the body is in the right position for this exercise */
  posture: (b: Body) => Cue | null;
  /** good form in this frame (only checked while a rep is in progress) */
  form: (b: Body) => boolean;
  /** extra condition at the top before the rep completes (for example standing fully tall) */
  top?: (b: Body) => boolean;
  /** must be seen at least once at the bottom (for example feet apart in a jumping jack) */
  peak?: (b: Body) => boolean;
}

const pick = (b: Body, l: number[], r: number[]) => (b.side() === "l" ? l : r);
const SPECS: Record<Family, Spec> = {
  // side view. Elbow bends; shoulders, hips and ankles stay in one line; the body is near horizontal.
  pushup: {
    joints: b => pick(b, [L.lSh, L.lEl, L.lWr, L.lHip, L.lAn], [L.rSh, L.rEl, L.rWr, L.rHip, L.rAn]),
    metric: b => { const j = pick(b, [L.lSh, L.lEl, L.lWr], [L.rSh, L.rEl, L.rWr]); return b.angle(j[0], j[1], j[2]); },
    posture: b => { const j = pick(b, [L.lSh, L.lAn, L.lWr], [L.rSh, L.rAn, L.rWr]); return b.tilt(j[0], j[1]) <= 40 && b.p(j[2]).y > b.p(j[0]).y - 0.02 ? null : "position"; },
    form: b => { const j = pick(b, [L.lSh, L.lHip, L.lAn], [L.rSh, L.rHip, L.rAn]); return b.angle(j[0], j[1], j[2]) >= 150; },
  },
  // side or three-quarter view, upright. Elbow bends behind the body.
  dip: {
    joints: b => pick(b, [L.lSh, L.lEl, L.lWr, L.lHip], [L.rSh, L.rEl, L.rWr, L.rHip]),
    metric: b => { const j = pick(b, [L.lSh, L.lEl, L.lWr], [L.rSh, L.rEl, L.rWr]); return b.angle(j[0], j[1], j[2]); },
    posture: b => { const j = pick(b, [L.lSh, L.lHip], [L.rSh, L.rHip]); return b.tilt(j[0], j[1]) >= 45 && b.p(j[0]).y < b.p(j[1]).y ? null : "position"; },
    form: () => true,
  },
  // side view, standing. Knee bends until the thigh is about level; stand fully tall to finish.
  squat: {
    joints: b => pick(b, [L.lSh, L.lHip, L.lKn, L.lAn], [L.rSh, L.rHip, L.rKn, L.rAn]),
    metric: b => { const j = pick(b, [L.lHip, L.lKn, L.lAn], [L.rHip, L.rKn, L.rAn]); return b.angle(j[0], j[1], j[2]); },
    posture: b => { const j = pick(b, [L.lSh, L.lHip, L.lAn], [L.rSh, L.rHip, L.rAn]); return b.p(j[0]).y < b.p(j[1]).y && b.p(j[1]).y < b.p(j[2]).y ? null : "position"; },
    form: b => { const j = pick(b, [L.lSh, L.lHip], [L.rSh, L.rHip]); return b.tilt(j[0], j[1]) >= 20; }, // chest not folded onto the thighs
    top: b => { const j = pick(b, [L.lSh, L.lHip, L.lKn], [L.rSh, L.rHip, L.rKn]); return b.angle(j[0], j[1], j[2]) >= 150; },
  },
  // side view. The more bent knee does the work; both legs straighten to finish; torso stays upright.
  lunge: {
    joints: () => [L.lHip, L.lKn, L.lAn, L.rHip, L.rKn, L.rAn],
    metric: b => Math.min(b.angle(L.lHip, L.lKn, L.lAn), b.angle(L.rHip, L.rKn, L.rAn)),
    posture: b => { const j = pick(b, [L.lSh, L.lHip, L.lAn], [L.rSh, L.rHip, L.rAn]); return b.p(j[0]).y < b.p(j[1]).y && b.p(j[1]).y < b.p(j[2]).y ? null : "position"; },
    form: b => { const j = pick(b, [L.lSh, L.lHip], [L.rSh, L.rHip]); return b.tilt(j[0], j[1]) >= 45; },
  },
  // side view, lying with knees bent. The hip closes as the chest comes up, and opens again on the way down.
  situp: {
    joints: b => pick(b, [L.lSh, L.lHip, L.lKn], [L.rSh, L.rHip, L.rKn]),
    metric: b => { const j = pick(b, [L.lSh, L.lHip, L.lKn], [L.rSh, L.rHip, L.rKn]); return b.angle(j[0], j[1], j[2]); },
    posture: b => { const j = pick(b, [L.lHip, L.lKn, L.lAn], [L.rHip, L.rKn, L.rAn]); return b.angle(j[0], j[1], j[2]) <= 165 ? null : "position"; }, // knees bent, not a standing toe-touch
    form: () => true,
    top: b => { const j = pick(b, [L.lSh, L.lHip], [L.rSh, L.rHip]); return b.tilt(j[0], j[1]) <= 35; }, // shoulders back down near the floor
  },
  // front view, standing. Arms go overhead while the feet jump apart, then both return.
  jack: {
    joints: () => [L.lSh, L.rSh, L.lWr, L.rWr, L.lHip, L.rHip, L.lAn, L.rAn],
    metric: b => 180 - (b.angle(L.lHip, L.lSh, L.lWr) + b.angle(L.rHip, L.rSh, L.rWr)) / 2, // small when the arms are up
    posture: b => (b.p(L.lSh).y < b.p(L.lHip).y && b.p(L.lHip).y < b.p(L.lAn).y ? null : "position"),
    form: () => true,
    peak: b => b.dist(L.lAn, L.rAn) >= 1.3 * b.dist(L.lSh, L.rSh), // feet clearly wider than the shoulders
    top: b => b.dist(L.lAn, L.rAn) <= 1.25 * b.dist(L.lSh, L.rSh), // feet back together
  },
};

export class RepEngine {
  private spec: Spec;
  private lim: { down: number; up: number };
  private smooth: number | null = null;
  private armed = false;          // has been at the top since the last rep
  private moving = false;
  private startT = 0; private min = 180;
  private frames = 0; private good = 0; private visSum = 0;
  private bottom = false; private peakSeen = false;
  private lastSeen = 0; private lastEnd = -1e9;
  counted = 0; rejected = 0;

  constructor(public family: Family) { this.spec = SPECS[family]; this.lim = LIMITS[family]; }

  private reset() { this.moving = false; this.bottom = false; this.peakSeen = false; this.frames = 0; this.good = 0; this.visSum = 0; this.min = 180; }

  /** Feed one camera frame. `t` = milliseconds since the match went live. `aspect` = video width / height. */
  feed(lm: Pt[] | undefined | null, t: number, aspect = 1): Frame {
    const { down, up } = this.lim;
    const lostFor = t - this.lastSeen;
    if (!lm || lm.length < 29) { if (this.moving && lostFor > LOST_ABORT_MS) this.reset(); return { tracking: false, depth: 0, cue: "frame" }; }
    const b = new Body(lm, aspect);
    const vis = b.vis(this.spec.joints(b));
    if (vis < MIN_VIS) { if (this.moving && lostFor > LOST_ABORT_MS) this.reset(); return { tracking: false, depth: 0, cue: "frame" }; }
    this.lastSeen = t;
    const wrong = this.spec.posture(b);
    if (wrong) { this.reset(); this.armed = false; this.smooth = null; return { tracking: true, depth: 0, cue: wrong }; }

    const raw = this.spec.metric(b);
    this.smooth = this.smooth === null ? raw : this.smooth * 0.5 + raw * 0.5;
    const m = this.smooth;
    const depth = Math.max(0, Math.min(1, (up - m) / (up - down)));
    const startBand = up - 10;

    if (!this.moving) {
      if (m >= up) this.armed = true;
      if (this.armed && m < startBand) { this.moving = true; this.startT = t; this.min = m; this.frames = 0; this.good = 0; this.visSum = 0; this.bottom = false; this.peakSeen = false; }
      return { tracking: true, depth, cue: this.armed ? "ready" : "lockout" };
    }

    // a rep is in progress
    this.frames++; this.visSum += vis;
    const formOk = this.spec.form(b);
    if (formOk) this.good++;
    if (m < this.min) this.min = m;
    if (m <= down) { this.bottom = true; if (!this.spec.peak || this.spec.peak(b)) this.peakSeen = true; }
    const dur = t - this.startT;
    if (dur > MAX_REP_MS) { this.reset(); this.armed = false; this.rejected++; return { tracking: true, depth, cue: "ready", rep: { ok: false, reason: "slow" } }; }

    if (m >= up) {
      if (this.spec.top && !this.spec.top(b)) return { tracking: true, depth, cue: "lockout" }; // not finished yet: keep waiting
      const went = up - this.min, need = up - down;
      const formShare = this.frames ? this.good / this.frames : 0;
      const visAvg = this.frames ? this.visSum / this.frames : vis;
      const min = this.min;
      const bottom = this.bottom, peakSeen = this.peakSeen;
      this.reset(); this.armed = true;
      if (!bottom) {
        if (went < need * 0.4) return { tracking: true, depth, cue: "ready" };       // a wobble, not an attempt
        this.rejected++; return { tracking: true, depth, cue: "lower", rep: { ok: false, reason: "depth" } };
      }
      if (formShare < MIN_FORM_SHARE || !peakSeen) { this.rejected++; return { tracking: true, depth, cue: "line", rep: { ok: false, reason: "form" } }; }
      if (dur < MIN_REP_MS || t - this.lastEnd < MIN_REP_MS) { this.rejected++; return { tracking: true, depth, cue: "ready", rep: { ok: false, reason: "fast" } }; }
      this.lastEnd = t; this.counted++;
      const ev: Evidence = [Math.round(t), Math.round(dur), Math.round(min * 10) / 10, Math.round(Math.max(m, up) * 10) / 10, Math.round(formShare * 100), Math.round(visAvg * 100)];
      return { tracking: true, depth, cue: "ready", rep: { ok: true, ev } };
    }
    const cue: Cue = !formOk ? "line" : this.bottom ? "lockout" : "lower";
    return { tracking: true, depth, cue };
  }
}

/** Words shown to the player for each cue, per exercise. */
export function cueText(family: Family, cue: Cue): string {
  if (cue === "frame") return family === "jack" ? "Step back. Face the camera, whole body in view." : "Step back. Turn side-on, whole body in view.";
  if (cue === "position") return ({ pushup: "Get into push-up position", dip: "Sit tall with hands on the chair edge", squat: "Stand tall, side-on to the camera", lunge: "Stand tall, side-on to the camera", situp: "Lie back with knees bent", jack: "Stand tall facing the camera" } as const)[family];
  if (cue === "lower") return ({ pushup: "Lower: chest closer to the floor", dip: "Lower: bend the elbows more", squat: "Lower: hips down to knee height", lunge: "Lower: back knee near the floor", situp: "Sit all the way up", jack: "Arms all the way overhead" } as const)[family];
  if (cue === "lockout") return ({ pushup: "Straighten your arms at the top", dip: "Straighten your arms at the top", squat: "Stand all the way up", lunge: "Stand all the way up", situp: "Shoulders back down to the floor", jack: "Arms down, feet together" } as const)[family];
  if (cue === "line") return ({ pushup: "Keep your body in one straight line", dip: "Stay upright", squat: "Chest up", lunge: "Stay upright", situp: "Control the movement", jack: "Jump your feet wider" } as const)[family];
  return "Good. Keep going.";
}
export function rejectText(family: Family, r: Reject): string {
  return r === "depth" ? `Not counted: ${cueText(family, "lower").toLowerCase()}`
    : r === "form" ? `Not counted: ${cueText(family, "line").toLowerCase()}`
    : r === "fast" ? "Not counted: too fast to be a full rep" : "Not counted: took too long";
}
/** Where to put the phone. */
export function setupText(family: Family): string {
  return family === "jack"
    ? "Prop the phone upright about 2.5 m away, facing you. Your whole body, head to feet, must be in view."
    : "Prop the phone upright about 2.5 m away, side-on to you. Your whole body, head to feet, must be in view.";
}
