import type { WorkoutLog, UserProfile } from "../../types";

/**
 * Rank, level and per-discipline trophies — the progression layer on top of
 * the flat badge list. Everything is derived from logs the user has really
 * logged; nothing is pre-unlocked.
 */

export interface Rank {
  id: string;
  name: string;
  minXp: number;
  color: string;
}

export const RANKS: Rank[] = [
  { id: "rookie", name: "Rookie", minXp: 0, color: "#94a3b8" },
  { id: "bronze", name: "Bronze", minXp: 400, color: "#cd7f32" },
  { id: "silver", name: "Silver", minXp: 1200, color: "#aab4c3" },
  { id: "gold", name: "Gold", minXp: 3000, color: "#f5b301" },
  { id: "platinum", name: "Platinum", minXp: 6500, color: "#22b8cf" },
  { id: "diamond", name: "Diamond", minXp: 12000, color: "#4c8dff" },
  { id: "master", name: "Master", minXp: 22000, color: "#a855f7" },
  { id: "legend", name: "Legend", minXp: 40000, color: "#f43f5e" },
];

export interface RankState {
  xp: number;
  level: number;
  rank: Rank;
  next: Rank | null;
  /** 0..1 progress from this rank's floor to the next rank's floor. */
  progress: number;
  xpToNext: number;
}

export function computeXp(
  profile: Pick<UserProfile, "totalMinutes" | "totalCaloriesBurned" | "streakDays">,
  sessions: number,
  badgeCount: number,
): number {
  return Math.round(
    sessions * 120 +
      profile.totalMinutes * 4 +
      profile.totalCaloriesBurned * 0.05 +
      badgeCount * 60 +
      profile.streakDays * 25,
  );
}

export function computeRank(xp: number): RankState {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (xp >= r.minXp) idx = i;
  });
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  const progress = next ? (xp - rank.minXp) / (next.minXp - rank.minXp) : 1;
  return {
    xp,
    level: 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 90)),
    rank,
    next,
    progress: Math.max(0, Math.min(1, progress)),
    xpToNext: next ? Math.max(0, next.minXp - xp) : 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Discipline trophies                                                */
/* ------------------------------------------------------------------ */

export type DisciplineId = "upper" | "lower" | "core" | "cardio" | "mobility";

export interface Discipline {
  id: DisciplineId;
  label: string;
  /** Titles for the 3 tiers. */
  tiers: [string, string, string];
  match: RegExp;
}

export const TIER_TARGETS = [3, 10, 25] as const;
export const TIER_NAMES = ["Bronze", "Silver", "Gold"] as const;
export const TIER_COLORS = ["#cd7f32", "#aab4c3", "#f5b301"] as const;

export const DISCIPLINES: Discipline[] = [
  { id: "upper", label: "Upper Body", tiers: ["Upper Body Initiate", "Upper Body Specialist", "Upper Body Titan"], match: /upper|chest|arm|back|shoulder|push|tricep|bicep/i },
  { id: "lower", label: "Lower Body", tiers: ["Leg Day Regular", "Leg Day Specialist", "Leg Day Legend"], match: /lower|leg|glute|squat|quad|hamstring|calf/i },
  { id: "core", label: "Core", tiers: ["Core Starter", "Core Specialist", "Core Crusher"], match: /core|abs|\bab\b|plank|stability|midsection/i },
  { id: "cardio", label: "Cardio & HIIT", tiers: ["Cardio Starter", "Cardio Engine", "Cardio Machine"], match: /cardio|hiit|fat|burn|conditioning|interval|endurance/i },
  { id: "mobility", label: "Mobility", tiers: ["Flow Starter", "Mobility Adept", "Mobility Master"], match: /mobility|flex|stretch|recovery|yoga|warm/i },
];

export interface DisciplineProgress {
  discipline: Discipline;
  sessions: number;
  /** Index of the highest tier reached, or -1. */
  tierReached: number;
  /** Target for the next tier, or null when maxed. */
  nextTarget: number | null;
  progress: number;
}

function areaOf(log: WorkoutLog & { targetArea?: string }): string {
  return `${log.targetArea ?? ""} ${log.workoutTitle ?? ""}`;
}

export function computeDisciplines(logs: WorkoutLog[]): DisciplineProgress[] {
  return DISCIPLINES.map((d) => {
    const sessions = logs.filter((l) => d.match.test(areaOf(l))).length;
    let tierReached = -1;
    TIER_TARGETS.forEach((t, i) => {
      if (sessions >= t) tierReached = i;
    });
    const nextTarget = tierReached >= 2 ? null : TIER_TARGETS[tierReached + 1];
    const floor = tierReached >= 0 ? TIER_TARGETS[tierReached] : 0;
    const progress = nextTarget ? (sessions - floor) / (nextTarget - floor) : 1;
    return { discipline: d, sessions, tierReached, nextTarget, progress: Math.max(0, Math.min(1, progress)) };
  });
}
