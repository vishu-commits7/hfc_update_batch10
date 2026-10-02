import { WorkoutLog } from "../types";

export interface WeeklyRecap {
  weekLabel: string;
  workouts: number;
  minutes: number;
  calories: number;
  prevWorkouts: number;
  prevMinutes: number;
  prevCalories: number;
}

function withinDays(dateStr: string, fromDaysAgo: number, toDaysAgo: number): boolean {
  const now = Date.now();
  const t = new Date(dateStr).getTime();
  const from = now - fromDaysAgo * 86400000;
  const to = now - toDaysAgo * 86400000;
  return t <= from && t > to;
}

/** Rolling 7-day window (not calendar Monday-Sunday) so a recap is always
 *  meaningful the moment there's at least a few days of history, rather
 *  than waiting for a fixed week boundary. */
export function computeWeeklyRecap(logs: WorkoutLog[]): WeeklyRecap {
  const thisWeek = logs.filter(l => withinDays(l.completedAt, 7, 0));
  const lastWeek = logs.filter(l => withinDays(l.completedAt, 14, 7));

  const sum = (arr: WorkoutLog[], field: "durationMinutes" | "estimatedCaloriesBurned") =>
    arr.reduce((acc, l) => acc + (l[field] || 0), 0);

  return {
    weekLabel: "Last 7 days",
    workouts: thisWeek.length,
    minutes: sum(thisWeek, "durationMinutes"),
    calories: sum(thisWeek, "estimatedCaloriesBurned"),
    prevWorkouts: lastWeek.length,
    prevMinutes: sum(lastWeek, "durationMinutes"),
    prevCalories: sum(lastWeek, "estimatedCaloriesBurned"),
  };
}

export function trendDelta(current: number, previous: number): { direction: "up" | "down" | "flat"; pct: number } {
  if (previous === 0 && current === 0) return { direction: "flat", pct: 0 };
  if (previous === 0) return { direction: "up", pct: 100 };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { direction: "up", pct };
  if (pct < 0) return { direction: "down", pct: Math.abs(pct) };
  return { direction: "flat", pct: 0 };
}
