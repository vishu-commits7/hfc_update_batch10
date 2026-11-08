/** Daily + weekly quests. Pure logic: the server calls advanceQuests inside the progress transaction. */
import { dayKeyIST, weekIdIST } from "./timeutil";

export type Metric = "workouts" | "minutes" | "arena_matches" | "arena_wins";
export interface Quest { id: string; title: string; metric: Metric; target: number; progress: number; xp: number; done: boolean }
export interface QuestDoc { dayKey: string; weekId: string; daily: Quest[]; weekly: Quest[] }
export interface QuestEvent { workouts?: number; minutes?: number; arenaMatches?: number; arenaWins?: number }

const mk = (id: string, title: string, metric: Metric, target: number, xp: number): Quest => ({ id, title, metric, target, progress: 0, xp, done: false });

const DAILY_POOL = [
  () => mk("d_minutes20", "Train for 20 minutes", "minutes", 20, 50),
  () => mk("d_arena", "Play an Arena match", "arena_matches", 1, 70),
  () => mk("d_minutes40", "Train for 40 minutes", "minutes", 40, 80),
  () => mk("d_win", "Win an Arena match", "arena_wins", 1, 90),
];
const WEEKLY_POOL = [
  () => mk("w_arena3", "Play 3 Arena matches", "arena_matches", 3, 150),
  () => mk("w_minutes120", "Train for 120 minutes", "minutes", 120, 200),
  () => mk("w_win2", "Win 2 Arena matches", "arena_wins", 2, 220),
];

const dayIndex = (key: string) => Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
const weekIndex = (key: string) => Math.floor(dayIndex(key) / 7);

export function freshDaily(dayKey: string): Quest[] {
  const i = dayIndex(dayKey);
  return [mk("d_workout", "Complete a workout", "workouts", 1, 60), DAILY_POOL[i % DAILY_POOL.length](), DAILY_POOL[(i + 2) % DAILY_POOL.length]()];
}
export function freshWeekly(dayKey: string): Quest[] {
  return [mk("w_workouts3", "Complete 3 workouts", "workouts", 3, 150), WEEKLY_POOL[weekIndex(dayKey) % WEEKLY_POOL.length]()];
}

/** Returns the stored doc, regenerating the daily / weekly halves if they are from an earlier period. */
export function ensureQuests(existing: Partial<QuestDoc> | undefined, now = Date.now()): QuestDoc {
  const dayKey = dayKeyIST(now), weekId = weekIdIST(now);
  return {
    dayKey, weekId,
    daily: existing?.dayKey === dayKey && existing.daily ? existing.daily : freshDaily(dayKey),
    weekly: existing?.weekId === weekId && existing.weekly ? existing.weekly : freshWeekly(dayKey),
  };
}

/** Applies an event, returns the new doc, XP earned from completions and the titles completed now. */
export function advanceQuests(existing: Partial<QuestDoc> | undefined, ev: QuestEvent, now = Date.now()) {
  const doc = ensureQuests(existing, now);
  const add: Record<Metric, number> = {
    workouts: ev.workouts ?? 0, minutes: ev.minutes ?? 0, arena_matches: ev.arenaMatches ?? 0, arena_wins: ev.arenaWins ?? 0,
  };
  let xp = 0; const completed: { title: string; xp: number }[] = [];
  const step = (q: Quest): Quest => {
    if (q.done || !add[q.metric]) return q;
    const progress = Math.min(q.target, q.progress + add[q.metric]);
    const done = progress >= q.target;
    if (done) { xp += q.xp; completed.push({ title: q.title, xp: q.xp }); }
    return { ...q, progress, done };
  };
  return { doc: { ...doc, daily: doc.daily.map(step), weekly: doc.weekly.map(step) } as QuestDoc, xp, completed };
}
