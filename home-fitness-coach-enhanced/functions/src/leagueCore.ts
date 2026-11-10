/** Weekly leagues: pure rules (no Firebase) so tools/check-leagues.mjs can test them. Mirrored in src/lib/league.ts. */
export const GROUP_SIZE = 30;
export const MOVE = 5; // top 5 go up, bottom 5 go down (in a full-size group)

/** Rating bands, so a group is made of players of similar Arena rating. */
export const BAND_EDGES = [900, 1100, 1300];
export function bandOf(rating: number): number {
  const r = Number.isFinite(rating) ? rating : 1000;
  return BAND_EDGES.filter(e => r >= e).length; // 0..3
}

/**
 * How many places move in a group of this size. Full groups: 5 up, 5 down.
 * Small groups (few players in a band that week) move fewer, so half the group is never promoted or demoted.
 */
export function leagueZones(size: number): { promote: number; demote: number } {
  if (size >= 15) return { promote: MOVE, demote: MOVE };
  return { promote: Math.min(MOVE, Math.max(1, Math.floor(size / 3))), demote: size >= 10 ? 3 : 0 };
}

export type Outcome = "promoted" | "demoted" | "stayed";
/** rank is 1-based. Nobody is promoted with 0 XP; the top tier cannot go up and the bottom tier cannot go down. */
export function leagueOutcome(rank: number, size: number, xp: number, tier: number, maxTier: number): Outcome {
  const z = leagueZones(size);
  if (rank <= z.promote && xp > 0) return tier < maxTier ? "promoted" : "stayed";
  if (rank > size - z.demote && tier > 0) return "demoted";
  return "stayed";
}

/** Final order: weekly XP, then user id (descending) so a tie reads the same on the server and in the app. */
export function rankMembers<T extends { id: string; xp: number }>(members: T[]): T[] {
  return [...members].sort((a, b) => b.xp - a.xp || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}
