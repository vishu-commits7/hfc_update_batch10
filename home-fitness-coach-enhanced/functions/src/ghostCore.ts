/**
 * Ghost duels: pure logic (no Firebase), so tools/check-ghosts.mjs can test it.
 * A "timeline" is an array of milliseconds since the match went live, one entry per rep, ascending.
 */
import { createHash } from "node:crypto";

export const MAX_TL = 400;            // longest stored timeline (reps)
export const GHOST_WEIGHT = 0.5;      // rating change against a ghost counts half
export const GHOST_DAILY_RATED = 8;   // rated ghost matches per player per day (farming guard)
export const MIN_GHOST_REPS = 5;      // shorter runs are not worth keeping

export type GhostKind = "peer" | "self" | "pacer";

/** Number of reps done by `ms` (entries <= ms). */
export function repsAt(tl: readonly number[], ms: number): number {
  let lo = 0, hi = tl.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (tl[mid] <= ms) lo = mid + 1; else hi = mid; }
  return lo;
}

/** Which matches can share ghosts: same exercise list, mode and target. */
export function ghostKey(room: { plan?: { id?: string; reps?: number }[] | null; exercise?: string; mode: string; target: number }): string {
  const items = room.plan && room.plan.length ? room.plan.map(i => `${String(i.id || "").toLowerCase()}:${Number(i.reps) || 0}`).join("+") : String(room.exercise || "").toLowerCase();
  return createHash("sha1").update(`${items}|${room.mode}|${room.target}`).digest("hex").slice(0, 16);
}

/** Only first-to-N matches with one exercise make ghosts (what quick match and ghost duels offer). */
export function isGhostable(room: { plan?: unknown[] | null; mode: string }): boolean {
  return room.mode === "reps" && (!room.plan || room.plan.length <= 1);
}

/** Adds the reps gained between two reports, spread evenly over the time between them. */
export function appendTimeline(tl: readonly number[], prevReps: number, nextReps: number, prevMs: number, nowMs: number): number[] {
  const out = tl.slice(0, MAX_TL);
  const gained = nextReps - prevReps;
  if (gained <= 0) return out;
  const from = Math.max(0, Math.min(prevMs, nowMs));
  for (let i = 1; i <= gained && out.length < MAX_TL; i++) {
    const t = Math.round(from + ((nowMs - from) * i) / gained);
    out.push(Math.max(t, out.length ? out[out.length - 1] : 0));
  }
  return out;
}

const ADJ = ["Swift", "Iron", "Calm", "Bold", "Steady", "Rapid", "Fierce", "Quiet", "Bright", "Sharp", "Lucky", "Grand"];
const ANI = ["Falcon", "Tiger", "Otter", "Wolf", "Heron", "Lynx", "Bison", "Panda", "Cobra", "Raven", "Gecko", "Moose"];
/** Anonymous display name from a seed. Never contains anything about the real player. */
export function anonName(seed: string): string {
  const h = createHash("sha1").update(seed).digest();
  return `${ADJ[h[0] % ADJ.length]} ${ANI[h[1] % ANI.length]}`;
}

/** A practice pace for when nobody has recorded a run yet: about 0.5 reps a second with some wobble. */
export function makePacer(target: number, rnd: () => number = Math.random): number[] {
  const out: number[] = [];
  let t = 2800; // starts after the countdown
  for (let i = 0; i < Math.min(target, MAX_TL); i++) { t += 1500 + Math.round(rnd() * 1000); out.push(t); }
  return out;
}

/** Higher is better. Reached the target: faster is better. Otherwise: more reps is better. */
export function runScore(reps: number, target: number, finMs: number | null): number {
  return reps >= target && finMs !== null ? 1_000_000_000 - Math.round(finMs) : reps;
}

/** Elo change with a weight (1 = a normal match). */
export function eloDelta(self: number, opp: number, score: number, matches: number, weight: number): number {
  const k = matches < 10 ? 40 : 24;
  return Math.round(weight * k * (score - 1 / (1 + 10 ** ((opp - self) / 400))));
}

export interface SettleIn {
  target: number; hostReps: number; hostTl: readonly number[]; ghostTl: readonly number[];
  elapsedMs: number;            // server time since the match went live (plus slack when the player ends it)
  hostFinMs: number | null;     // when the player reached the target, if they did
  forfeit?: boolean;            // the player left a live match
}
export interface SettleOut { hostReps: number; guestReps: number; winner: "host" | "ghost" | null; hostFinMs: number | null }

/** Final score of a first-to-N duel against a recorded timeline. The server, not the phone, decides. */
export function settleReps(i: SettleIn): SettleOut {
  const { target } = i;
  const ghostFin = i.ghostTl.length >= target ? i.ghostTl[target - 1] : Infinity;
  const myFin = i.hostFinMs !== null && i.hostReps >= target ? i.hostFinMs : Infinity;
  if (i.forfeit) { // leaving a live match is a loss, so quitting when behind (or ahead) is never a free move
    const h = Math.min(i.hostReps, target - 1);
    const g = ghostFin <= i.elapsedMs ? target : Math.min(target - 1, repsAt(i.ghostTl, i.elapsedMs));
    return { hostReps: h, guestReps: Math.min(target, Math.max(g, h + 1)), winner: "ghost", hostFinMs: null };
  }
  const gFin = myFin === Infinity && ghostFin > i.elapsedMs ? Infinity : ghostFin; // the ghost only finishes "in time" if the clock got there
  if (myFin < gFin) return { hostReps: target, guestReps: Math.min(target - 1, repsAt(i.ghostTl, myFin)), winner: "host", hostFinMs: myFin };
  if (gFin < myFin) return { hostReps: Math.min(i.hostReps, target - 1, repsAt(i.hostTl, gFin)), guestReps: target, winner: "ghost", hostFinMs: null };
  if (gFin === Infinity) { // nobody finished: compare at the clock
    const h = Math.min(i.hostReps, target - 1), g = Math.min(target - 1, repsAt(i.ghostTl, i.elapsedMs));
    return { hostReps: h, guestReps: g, winner: h > g ? "host" : g > h ? "ghost" : null, hostFinMs: null };
  }
  return { hostReps: target, guestReps: target, winner: null, hostFinMs: myFin }; // same millisecond
}
