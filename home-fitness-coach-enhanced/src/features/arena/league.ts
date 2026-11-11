/** Weekly league rules shown in the app. Must match functions/src/leagueCore.ts (npm run leagues:check compares them). */
export const MOVE = 5;

export function leagueZones(size: number): { promote: number; demote: number } {
  if (size >= 15) return { promote: MOVE, demote: MOVE };
  return { promote: Math.min(MOVE, Math.max(1, Math.floor(size / 3))), demote: size >= 10 ? 3 : 0 };
}

export type LeagueStatus =
  | { zone: "promote"; lead: number }      // in the promotion places, `lead` XP ahead of the first player outside them
  | { zone: "safe"; need: number }         // `need` XP to reach the promotion places
  | { zone: "demote"; need: number }       // `need` XP to climb out of the demotion places
  | { zone: "top" };                       // top league: nowhere higher to go

/** Where a player stands and what it takes to move. `xp` is the group's weekly XP, best first. */
export function leagueStatus(xp: readonly number[], myIdx: number, tier: number, maxTier: number): LeagueStatus | null {
  if (myIdx < 0 || myIdx >= xp.length) return null;
  const size = xp.length, z = leagueZones(size), mine = xp[myIdx];
  if (tier > 0 && z.demote > 0 && myIdx >= size - z.demote) return { zone: "demote", need: Math.max(1, xp[size - z.demote - 1] - mine + 1) };
  if (tier >= maxTier) return { zone: "top" };
  if (myIdx < z.promote && mine > 0) return { zone: "promote", lead: Math.max(0, mine - (xp[z.promote] ?? 0)) };
  return { zone: "safe", need: Math.max(1, (xp[z.promote - 1] ?? 0) - mine + 1) };
}
