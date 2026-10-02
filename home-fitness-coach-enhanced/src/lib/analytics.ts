import type { WorkoutLog, UserProfile } from "../types";
import { localDateKey, ratio } from "../design/format";

/**
 * Derived training analytics.
 *
 * Every number the dashboard and the analytics drawer display is computed
 * here, once, from the raw log array. Previously each screen re-derived
 * its own version of "this week" with subtly different rules — one used a
 * rolling seven days, another used the calendar week, a third counted
 * logs and a fourth counted minutes — so the same user could see three
 * different answers to the same question on three screens.
 *
 * All windows below are anchored to *local* midnight. Using
 * `toISOString()` for date keys, as the previous code did in places,
 * buckets a 9pm workout in UTC+5:30 onto the following day.
 */

export interface DayBucket {
  key: string;
  date: Date;
  /** Single-letter weekday, for the compact week strip. */
  initial: string;
  /** "Mon 15 Sep", for tooltips and screen readers. */
  long: string;
  dayOfMonth: number;
  sessions: number;
  minutes: number;
  calories: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface MuscleSplit {
  area: string;
  sessions: number;
  share: number;
}

export interface Analytics {
  /** Monday-anchored current week. */
  week: DayBucket[];
  /** Trailing 12 weeks of session counts, oldest first. */
  trend: { label: string; sessions: number; minutes: number }[];
  thisWeek: { sessions: number; minutes: number; calories: number };
  lastWeek: { sessions: number; minutes: number; calories: number };
  /** Signed percentage change in sessions vs the previous week. */
  momentum: number;
  /** Consecutive days with at least one session, counting back from today. */
  currentStreak: number;
  bestStreak: number;
  /** Mean session length across all logs, in minutes. */
  avgSessionMinutes: number;
  /** Hour of day (0–23) with the most completed sessions, or null. */
  peakHour: number | null;
  /** Distribution of sessions across target areas, largest first. */
  split: MuscleSplit[];
  /** Most frequent self-reported feeling, or null when there is no data. */
  dominantFeeling: WorkoutLog["feeling"] | null;
  /** Consistency against a 3-sessions-per-week goal, 0–1. */
  weeklyGoalProgress: number;
  totalSessions: number;
}

export const WEEKLY_GOAL = 3;

function startOfLocalDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Monday of the week containing `d`, at local midnight. */
function startOfWeek(d: Date): Date {
  const c = startOfLocalDay(d);
  const dow = c.getDay(); // 0 = Sunday
  c.setDate(c.getDate() - (dow === 0 ? 6 : dow - 1));
  return c;
}

function emptyTotals() {
  return { sessions: 0, minutes: 0, calories: 0 };
}

export function computeAnalytics(
  logs: WorkoutLog[],
  profile?: UserProfile,
): Analytics {
  const now = new Date();
  const today = startOfLocalDay(now);

  // Index every log by local date key once; everything below reads from
  // this map rather than re-scanning the array per bucket, which keeps
  // the whole computation O(n) instead of O(n × buckets).
  const byDay = new Map<string, WorkoutLog[]>();
  const hourCounts = new Array<number>(24).fill(0);
  const areaCounts = new Map<string, number>();
  const feelingCounts = new Map<string, number>();
  let totalMinutes = 0;

  for (const log of logs) {
    const d = new Date(log.completedAt);
    if (Number.isNaN(d.getTime())) continue;

    const key = localDateKey(d);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(log);
    else byDay.set(key, [log]);

    hourCounts[d.getHours()] += 1;
    totalMinutes += log.durationMinutes || 0;

    const area = (log.workoutTitle && inferArea(log)) || "Other";
    areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);

    if (log.feeling) {
      feelingCounts.set(log.feeling, (feelingCounts.get(log.feeling) ?? 0) + 1);
    }
  }

  const dayTotals = (key: string) => {
    const entries = byDay.get(key);
    if (!entries) return emptyTotals();
    return entries.reduce(
      (acc, l) => ({
        sessions: acc.sessions + 1,
        minutes: acc.minutes + (l.durationMinutes || 0),
        calories: acc.calories + (l.estimatedCaloriesBurned || 0),
      }),
      emptyTotals(),
    );
  };

  /* --- Current week ------------------------------------------------ */
  const weekStart = startOfWeek(now);
  const week: DayBucket[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const key = localDateKey(date);
    const totals = dayTotals(key);
    week.push({
      key,
      date,
      initial: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      long: date.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      dayOfMonth: date.getDate(),
      isToday: date.getTime() === today.getTime(),
      isFuture: date.getTime() > today.getTime(),
      ...totals,
    });
  }

  const thisWeek = week.reduce(
    (acc, d) => ({
      sessions: acc.sessions + d.sessions,
      minutes: acc.minutes + d.minutes,
      calories: acc.calories + d.calories,
    }),
    emptyTotals(),
  );

  /* --- Previous week ----------------------------------------------- */
  const lastWeek = emptyTotals();
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() - 7 + i);
    const t = dayTotals(localDateKey(date));
    lastWeek.sessions += t.sessions;
    lastWeek.minutes += t.minutes;
    lastWeek.calories += t.calories;
  }

  // A jump from zero is reported as +100%, not as an infinite increase —
  // "∞% up" is technically correct and completely useless to read.
  const momentum =
    lastWeek.sessions === 0
      ? thisWeek.sessions > 0
        ? 100
        : 0
      : Math.round(
          ((thisWeek.sessions - lastWeek.sessions) / lastWeek.sessions) * 100,
        );

  /* --- 12-week trend ------------------------------------------------ */
  const trend: Analytics["trend"] = [];
  for (let w = 11; w >= 0; w--) {
    const ws = new Date(weekStart);
    ws.setDate(weekStart.getDate() - w * 7);
    let sessions = 0;
    let minutes = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws);
      d.setDate(ws.getDate() + i);
      const t = dayTotals(localDateKey(d));
      sessions += t.sessions;
      minutes += t.minutes;
    }
    trend.push({
      label: w === 0 ? "Now" : `${ws.getDate()}/${ws.getMonth() + 1}`,
      sessions,
      minutes,
    });
  }

  /* --- Streaks ------------------------------------------------------
     Computed from the logs themselves rather than trusted from the
     stored profile counter, which drifts whenever a log is deleted. */
  let currentStreak = 0;
  const cursor = new Date(today);
  // A streak survives a today with no session yet — it only breaks once
  // yesterday is also empty. Otherwise every user sees their streak reset
  // to zero each morning until they train.
  if (!byDay.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (byDay.has(localDateKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sortedKeys = [...byDay.keys()].sort();
  let bestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sortedKeys) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (prev) {
      const gapDays = Math.round(
        (date.getTime() - prev.getTime()) / 86_400_000,
      );
      run = gapDays === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    bestStreak = Math.max(bestStreak, run);
    prev = date;
  }
  bestStreak = Math.max(bestStreak, currentStreak, profile?.streakDays ?? 0);

  /* --- Distributions ------------------------------------------------ */
  const peakHour =
    logs.length > 0 ? hourCounts.indexOf(Math.max(...hourCounts)) : null;

  const totalAreaSessions = [...areaCounts.values()].reduce((a, b) => a + b, 0);
  const split: MuscleSplit[] = [...areaCounts.entries()]
    .map(([area, sessions]) => ({
      area,
      sessions,
      share: ratio(sessions, totalAreaSessions),
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5);

  let dominantFeeling: WorkoutLog["feeling"] | null = null;
  let topFeelingCount = 0;
  for (const [feeling, count] of feelingCounts) {
    if (count > topFeelingCount) {
      topFeelingCount = count;
      dominantFeeling = feeling as WorkoutLog["feeling"];
    }
  }

  return {
    week,
    trend,
    thisWeek,
    lastWeek,
    momentum,
    currentStreak,
    bestStreak,
    avgSessionMinutes: logs.length
      ? Math.round(totalMinutes / logs.length)
      : 0,
    peakHour,
    split,
    dominantFeeling,
    weeklyGoalProgress: ratio(thisWeek.sessions, WEEKLY_GOAL),
    totalSessions: logs.length,
  };
}

/**
 * Best-effort target-area classification.
 *
 * `WorkoutLog` records the title but not the target area, so the area has
 * to be recovered from the title. Keyword matching is imperfect by
 * definition — hence the explicit "Other" bucket rather than silently
 * forcing every unmatched session into "Full Body" and overstating it.
 */
function inferArea(log: WorkoutLog): string {
  const t = log.workoutTitle.toLowerCase();
  if (/core|abs|plank|oblique/.test(t)) return "Core";
  if (/leg|glute|squat|lower|quad|calf/.test(t)) return "Lower Body";
  if (/arm|chest|back|push|pull|upper|shoulder/.test(t)) return "Upper Body";
  if (/cardio|hiit|burn|blitz|sweat|conditioning/.test(t)) return "Cardio";
  if (/stretch|mobility|yoga|flex|recovery|cool/.test(t)) return "Mobility";
  if (/full body|total|energizer|power/.test(t)) return "Full Body";
  return "Other";
}

/** Short, non-patronising headline for the analytics drawer. */
export function momentumHeadline(a: Analytics): string {
  if (a.totalSessions === 0) return "No sessions logged yet";
  if (a.thisWeek.sessions === 0) return "Nothing logged this week yet";
  if (a.momentum > 0) return `Up ${a.momentum}% on last week`;
  if (a.momentum < 0) return `Down ${Math.abs(a.momentum)}% on last week`;
  return "Holding steady on last week";
}

/* ------------------------------------------------------------------ */
/*  Derived profile totals — the single source of truth                */
/* ------------------------------------------------------------------ */

export interface ProfileTotals {
  totalWorkouts: number;
  totalMinutes: number;
  totalCaloriesBurned: number;
  streakDays: number;
  lastWorkoutDate?: string;
}

/**
 * Session totals computed from the logs, every time.
 *
 * These used to be counters on the profile, incremented on save and
 * decremented on delete. Counters drift: the header read
 * `profile.totalWorkouts` and showed "0 sessions logged" while the
 * dashboard, reading the logs array directly, showed an eight-day streak
 * from the same data. Worse, `computeUnlockedAchievements` reads the same
 * counter, so a restored backup or an edited log silently changed which
 * achievements a person had earned.
 *
 * Deriving costs one pass over an array that is never more than a few
 * hundred entries, and it cannot disagree with itself.
 */
export function deriveProfileTotals(logs: WorkoutLog[]): ProfileTotals {
  let totalMinutes = 0;
  let totalCaloriesBurned = 0;
  let latest: number | null = null;
  const days = new Set<string>();

  for (const log of logs) {
    const t = new Date(log.completedAt).getTime();
    // A malformed date would otherwise poison the streak and the "last
    // workout" label; skipping it loses one row instead of the screen.
    if (!Number.isFinite(t)) continue;
    totalMinutes += log.durationMinutes || 0;
    totalCaloriesBurned += log.estimatedCaloriesBurned || 0;
    if (latest === null || t > latest) latest = t;
    days.add(localDateKey(new Date(t)));
  }

  // Same rule as `computeAnalytics`: a streak survives a today with no
  // session yet and only breaks once yesterday is also empty. Otherwise
  // every user watches their streak reset to zero each morning.
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streakDays = 0;
  while (days.has(localDateKey(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    totalWorkouts: logs.length,
    totalMinutes,
    totalCaloriesBurned,
    streakDays,
    lastWorkoutDate: latest === null ? undefined : new Date(latest).toISOString(),
  };
}

/** True when at least one session was logged today. */
export function trainedToday(logs: WorkoutLog[]): boolean {
  const key = localDateKey(new Date());
  return logs.some((l) => {
    const t = new Date(l.completedAt).getTime();
    return Number.isFinite(t) && localDateKey(new Date(t)) === key;
  });
}
