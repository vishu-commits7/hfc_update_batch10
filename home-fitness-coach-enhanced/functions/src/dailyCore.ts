/** Daily global challenge: pure rules (no Firebase) so tools/check-daily.mjs can test them. */
import { createHash } from "node:crypto";

export const DAILY_SECONDS = 60;      // everyone gets 60 seconds
export const DAILY_ATTEMPTS = 3;      // tries per day; the best one counts, XP is paid once
export const DAILY_MIN_REPS = 5;      // fewer than this does not go on the board or earn XP
export const DAILY_XP = 75;
export const SUBMIT_MIN_S = 58;       // a submission earlier than this after the start is impossible
export const SUBMIT_MAX_S = 180;      // and a start older than this has expired

/** `rate` = most reps per second a fit person can really do with this move (generous, to avoid false rejections). */
export interface DailyExercise { id: string; name: string; rate: number; tip: string }
export const POOL: readonly DailyExercise[] = [
  { id: "pushups", name: "Push-ups", rate: 1.6, tip: "Chest to a fist's height from the floor, full lockout each rep." },
  { id: "squats", name: "Bodyweight Squats", rate: 1.8, tip: "Hips below knees, stand fully tall." },
  { id: "situps", name: "Sit-ups", rate: 1.6, tip: "Shoulder blades off the floor, hands off the head." },
  { id: "jumping-jacks", name: "Jumping Jacks", rate: 2.6, tip: "Count one rep each time your hands meet overhead." },
  { id: "mountain-climbers", name: "Mountain Climbers", rate: 3.2, tip: "Count each pair of knees (left plus right = 1 rep)." },
  { id: "lunges", name: "Alternating Lunges", rate: 1.3, tip: "Count each leg. Back knee near the floor." },
  { id: "high-knees", name: "High Knees", rate: 4.0, tip: "Count each pair of knees as 1 rep. Knees above hip height." },
  { id: "burpees", name: "Burpees", rate: 0.75, tip: "Chest to floor, jump at the top." },
  { id: "crunches", name: "Crunches", rate: 2.0, tip: "Short, controlled reps. Do not pull on your neck." },
  { id: "plank-taps", name: "Plank Shoulder Taps", rate: 2.2, tip: "Count each pair of taps as 1 rep. Keep your hips still." },
];

const hashOf = (s: string) => createHash("sha1").update(`apex-daily|${s}`).digest().readUInt32BE(0);
const prevDay = (key: string) => new Date(Date.parse(`${key}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Same exercise for everyone on a given IST day; never the same two days in a row. */
export function exerciseFor(dayKey: string): DailyExercise {
  const n = POOL.length;
  const raw = (k: string) => hashOf(k) % n;
  // walk back while yesterday was also bumped, so "no repeat" holds even after a bump
  const pick = (k: string, depth: number): number => {
    const i = raw(k);
    if (depth <= 0) return i;
    return i === pick(prevDay(k), depth - 1) ? (i + 1) % n : i;
  };
  return POOL[pick(dayKey, 6)];
}

/** Highest believable count for the 60 seconds of work. */
export function maxReps(ex: DailyExercise): number { return Math.floor(ex.rate * DAILY_SECONDS) + 3; }

export type Verdict = { ok: true } | { ok: false; reason: "range" | "too-early" | "expired" | "too-fast" };
/** Checks a submission against the server's own clock and the rep-rate limit. */
export function validateSubmission(ex: DailyExercise, reps: number, elapsedMs: number): Verdict {
  if (!Number.isInteger(reps) || reps < 0 || reps > 1000) return { ok: false, reason: "range" };
  if (elapsedMs < SUBMIT_MIN_S * 1000) return { ok: false, reason: "too-early" };
  if (elapsedMs > SUBMIT_MAX_S * 1000) return { ok: false, reason: "expired" };
  if (reps > maxReps(ex)) return { ok: false, reason: "too-fast" };
  return { ok: true };
}

const IST_OFFSET_MS = 5.5 * 3600_000;
/** Board order key: more reps first, then whoever finished earlier in the IST day. Sort descending. */
export function boardScore(reps: number, atMs: number): number {
  const secOfDay = Math.floor(((atMs + IST_OFFSET_MS) % 86_400_000) / 1000);
  return reps * 100_000 + (86_399 - secOfDay);
}
