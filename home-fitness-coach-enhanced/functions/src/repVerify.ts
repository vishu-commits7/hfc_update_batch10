/**
 * Camera-verified reps: the server side. Pure rules (no Firebase) so tools/check-reps.mjs can test them.
 *
 * The phone runs the pose model (video never leaves the phone) and, for every rep it counted, sends a small
 * "evidence" record: when it ended, how long it took, the deepest and the straightest joint angle it saw, how
 * much of the rep had good form, and how well the body was visible. The server does not take the phone's word
 * for the count: it checks each record against the limits for that exercise and against its own clock, and
 * only reps that pass are "verified". Ratings move only on verified reps (see ratingPolicy).
 *
 * The limits here are slightly looser than the phone's (src/features/arena/repEngine.ts), so an honest rep
 * that the phone accepted is never refused for a rounding difference. tools/check-reps.mjs keeps the two in step.
 */
export type Family = "pushup" | "squat" | "lunge" | "situp" | "dip" | "jack";

/** Which exercises the camera can judge. Same rules as the app's familyFor(). null = taps only. */
export function familyFor(name: string | null | undefined): Family | null {
  const n = String(name || "").toLowerCase();
  // moves whose shape the simple joint rules cannot judge fairly
  if (/scapular|cobra|shoulder tap|plank|pike|bicycle|thrust|jump|pistol|crunch/.test(n) && !/jumping jacks?/.test(n)) return null;
  if (/push-?ups?/.test(n)) return "pushup";
  if (/dips?\b/.test(n)) return "dip";
  if (/lunge|split squat/.test(n)) return "lunge";
  if (/squat/.test(n)) return "squat";
  if (/sit-?ups?/.test(n)) return "situp";
  if (/jumping jacks?/.test(n)) return "jack";
  return null;
}

/** One exercise only: a mixed plan cannot be judged by one set of limits. */
export function roomFamily(room: { plan?: { id?: string; name?: string }[] | null; exercise?: string }): Family | null {
  const plan = room.plan && room.plan.length ? room.plan : null;
  if (plan && plan.length > 1) return null;
  return familyFor(plan ? plan[0].name || plan[0].id : room.exercise);
}

/** [down, up]: the joint measure must go at or below `down` and come back to at or above `up` (degrees). */
export const LIMITS: Record<Family, { down: number; up: number }> = {
  pushup: { down: 100, up: 150 },
  dip: { down: 100, up: 150 },
  squat: { down: 105, up: 160 },
  lunge: { down: 105, up: 150 },
  situp: { down: 85, up: 118 },
  jack: { down: 55, up: 135 },
};
export const SLACK_DEG = 8;        // rounding and smoothing differences between phone and server
export const MIN_REP_MS = 300;     // nobody completes a full rep faster
export const MAX_REP_MS = 12_000;
export const MIN_GAP_MS = 300;     // between the ends of two reps
export const MIN_FORM = 65;        // % of the rep with good form
export const MIN_VIS = 45;         // % visibility of the joints used
export const CLOCK_SLACK_MS = 4000;
export const MAX_EVIDENCE_PER_CALL = 40;
export const VERIFIED_SHARE = 0.9; // this share of a player's reps must be verified for the match to count as camera-verified

/** [endMs since the match went live, durationMs, minAngle, maxAngle, form %, visibility %] */
export type Evidence = [number, number, number, number, number, number];
export type EvStats = [number, number, number, number, number]; // n, sum(dur), sum(dur^2), sum(min), sum(min^2)

export function isEvidence(x: unknown): x is Evidence {
  return Array.isArray(x) && x.length === 6 && x.every(n => typeof n === "number" && Number.isFinite(n));
}

export type Refusal = "shape" | "order" | "clock" | "tempo" | "depth" | "lockout" | "form" | "visibility";
export function checkOne(family: Family, e: Evidence, lastEndMs: number, elapsedMs: number): Refusal | null {
  const [t, dur, min, max, form, vis] = e;
  const lim = LIMITS[family];
  if (t <= lastEndMs || t - lastEndMs < MIN_GAP_MS) return "order";
  if (t > elapsedMs + CLOCK_SLACK_MS || t - dur < -1000) return "clock";
  if (dur < MIN_REP_MS || dur > MAX_REP_MS) return "tempo";
  if (min > lim.down + SLACK_DEG) return "depth";
  if (max < lim.up - SLACK_DEG) return "lockout";
  if (form < MIN_FORM) return "form";
  if (vis < MIN_VIS) return "visibility";
  return null;
}

export interface VerifyOut { accepted: number; refused: number; lastEndMs: number; stats: EvStats; reasons: Partial<Record<Refusal, number>> }
/** Checks a batch of evidence. Records at or before `lastEndMs` were already seen (a resend) and are skipped silently. */
export function verifyBatch(family: Family, raw: unknown, lastEndMs: number, elapsedMs: number, stats: EvStats = [0, 0, 0, 0, 0]): VerifyOut {
  const out: VerifyOut = { accepted: 0, refused: 0, lastEndMs, stats: [...stats] as EvStats, reasons: {} };
  if (!Array.isArray(raw)) return out;
  const items = raw.slice(0, MAX_EVIDENCE_PER_CALL);
  for (const x of items) {
    if (!isEvidence(x)) { out.refused++; out.reasons.shape = (out.reasons.shape || 0) + 1; continue; }
    if (x[0] <= out.lastEndMs) continue; // resend of something already counted
    const why = checkOne(family, x, out.lastEndMs, elapsedMs);
    if (why) { out.refused++; out.reasons[why] = (out.reasons[why] || 0) + 1; if (why !== "order") out.lastEndMs = Math.max(out.lastEndMs, Math.min(x[0], elapsedMs + CLOCK_SLACK_MS)); continue; }
    out.accepted++; out.lastEndMs = x[0];
    out.stats[0] += 1; out.stats[1] += x[1]; out.stats[2] += x[1] * x[1]; out.stats[3] += x[2]; out.stats[4] += x[2] * x[2];
  }
  return out;
}

const sd = (n: number, sum: number, sq: number) => (n > 1 ? Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2)) : 0);
/**
 * Real reps vary: nobody repeats the same duration to the millisecond and the same depth to a fraction of a degree.
 * Eight or more accepted reps that are all but identical were generated by a script, not a body.
 */
export function looksForged(stats: EvStats): boolean {
  const [n, sDur, qDur, sMin, qMin] = stats;
  return n >= 8 && sd(n, sDur, qDur) < 20 && sd(n, sMin, qMin) < 0.6;
}

/** True when enough of this player's reps were camera-verified and the evidence does not look generated. */
export function sideVerified(reps: number, verified: number, stats: EvStats): boolean {
  return reps > 0 && verified >= Math.ceil(reps * VERIFIED_SHARE) && !looksForged(stats);
}

export type UnratedReason = "taps-only-exercise" | "nobody-verified" | "winner-not-verified" | "draw-not-verified";
/**
 * When does a match move ratings? Only when the winner's reps were camera-verified.
 *  - a verified player who loses to someone tapping loses nothing (the tapper gains nothing either);
 *  - someone tapping who loses to a verified player does lose rating: tapping is their choice;
 *  - a draw counts only if both were verified;
 *  - an exercise the camera cannot judge is a friendly match.
 * `winner` is "host", "guest" or null (draw). With requireCamera off, every match is rated as before.
 */
export function ratingPolicy(p: { requireCamera: boolean; family: Family | null; hostVerified: boolean; guestVerified: boolean; winner: "host" | "guest" | null }): { rated: boolean; reason: UnratedReason | null } {
  if (!p.requireCamera) return { rated: true, reason: null };
  if (!p.family) return { rated: false, reason: "taps-only-exercise" };
  if (!p.hostVerified && !p.guestVerified) return { rated: false, reason: "nobody-verified" };
  if (p.winner === null) return p.hostVerified && p.guestVerified ? { rated: true, reason: null } : { rated: false, reason: "draw-not-verified" };
  const winnerOk = p.winner === "host" ? p.hostVerified : p.guestVerified;
  return winnerOk ? { rated: true, reason: null } : { rated: false, reason: "winner-not-verified" };
}
