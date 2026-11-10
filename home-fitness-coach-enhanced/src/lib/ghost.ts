/** Ghost duels (client side). A timeline is ms since the match went live, one entry per rep, ascending. */
import { callFn } from "./functions";

export const GHOST_FALLBACK_S = 8; // quick match brings in a ghost after this many seconds with no live opponent

export type GhostKind = "peer" | "self" | "pacer";
export type GhostAsk = "auto" | "peer" | "self";

/** Reps done by `ms`. Same maths as the server, which settles the real score. */
export function repsAt(tl: readonly number[], ms: number): number {
  let lo = 0, hi = tl.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (tl[mid] <= ms) lo = mid + 1; else hi = mid; }
  return lo;
}

export interface GhostStart { status: "matched" | "ghost"; code: string; kind?: GhostKind; name?: string }

export function startGhostMatch(exerciseId: string, name: string, reps: number, kind: GhostAsk): Promise<GhostStart> {
  return callFn<GhostStart>("arenaGhostMatch", { exerciseId, name, reps, kind });
}
