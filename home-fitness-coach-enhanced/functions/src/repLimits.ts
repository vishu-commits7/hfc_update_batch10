/**
 * Human rep-rate limits per Arena exercise (pure, no Firebase; tested by tools/check-anticheat.mjs).
 * Reps per second that a very fit person cannot beat with honest reps. Deliberately generous: an honest player
 * must never be refused. A trainer should review these numbers.
 */
export const REP_RATE: Record<string, number> = {
  pushups: 1.6, "wide-pushups": 1.5, "incline-pushups": 1.7, "decline-pushups": 1.4, diamond: 1.4,
  superman: 1.5, "reverse-snow": 1.2, "prone-y": 1.5, "good-morning": 1.5,
  pike: 1.3, "plank-tap": 2.5, "arm-circles": 3.0,
  "tri-dips": 1.6, "close-pushups": 1.5, "plank-updown": 1.2,
  situps: 1.6, crunches: 2.0, climbers: 3.5, "leg-raises": 1.2, bicycle: 2.5, russian: 3.0,
  squats: 1.8, jumpsquats: 1.5, lunges: 1.3, "split-squat": 1.3, "wall-sit-calf": 2.5, "glute-bridge": 1.8,
  burpees: 0.75, jacks: 2.6, "high-knees": 4.0, "squat-thrust": 1.0,
};
export const DEFAULT_RATE = 2.5;   // an exercise we have no number for (custom rooms)
export const HARD_CAP = 5;         // nothing counts faster than this, whatever the exercise
export const COUNTDOWN_S = 2;      // the 3-2-1 before a match: no reps can happen in it
export const STRIKE_MARGIN = 5;    // reporting this many reps above the limit is not a mistake

export function rateFor(exerciseId: string | undefined | null): number {
  return Math.min(HARD_CAP, REP_RATE[String(exerciseId || "").toLowerCase()] ?? DEFAULT_RATE);
}

/** One limit for a room: the fastest exercise in its plan (a multi-exercise match is judged by its quickest move). */
export function roomRate(room: { plan?: { id?: string }[] | null }): number {
  const ids = (room.plan ?? []).map(i => i?.id).filter(Boolean) as string[];
  return ids.length ? Math.max(...ids.map(rateFor)) : DEFAULT_RATE;
}

/** Most reps that can honestly exist `elapsedSec` after the match went live. */
export function plausibleReps(rate: number, elapsedSec: number): number {
  return Math.floor(rate * Math.max(0, elapsedSec - COUNTDOWN_S)) + 3;
}

/** Was the reported count far enough over the limit to count against the account? */
export function isStrike(reported: number, plausible: number): boolean {
  return reported > plausible + STRIKE_MARGIN;
}

export const FLAG_STRIKES = 3;                 // this many refused counts...
export const FLAG_WINDOW_MS = 7 * 86_400_000;  // ...within a week flags the account
export const FLAG_REPORTERS = 3;               // or this many different players reporting cheating

/** New state of an account's record after one more refused count. */
export function addStrike(recent: readonly number[], now: number): { recent: number[]; flagged: boolean } {
  const kept = [...recent.filter(t => now - t < FLAG_WINDOW_MS), now].slice(-20);
  return { recent: kept, flagged: kept.length >= FLAG_STRIKES };
}
