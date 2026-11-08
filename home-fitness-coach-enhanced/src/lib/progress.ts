/**
 * Server-owned progression: xp, level, rank, trophies, arena match history.
 * The app only reports "I finished a workout"; the Cloud Function decides
 * the rewards, so nobody can edit their own level or trophies.
 */
import { useEffect, useState } from "react";
import { collection, doc, limit as fsLimit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { callFn } from "./functions";
import { RANKS } from "./ranks";
import type { WorkoutLog } from "../types";

export type TrophyTier = "bronze" | "silver" | "gold" | "diamond";

export interface TrophyDef { id: string; title: string; desc: string; tier: TrophyTier; icon: "dumbbell" | "flame" | "swords" | "medal" }

/** Mirror of the server catalog (used to show locked trophies). */
export const TROPHY_CATALOG: TrophyDef[] = [
  { id: "first_workout", title: "First Rep", desc: "Complete your first workout", tier: "bronze", icon: "dumbbell" },
  { id: "workouts_10", title: "Getting Serious", desc: "10 workouts completed", tier: "bronze", icon: "dumbbell" },
  { id: "workouts_50", title: "Iron Habit", desc: "50 workouts completed", tier: "silver", icon: "dumbbell" },
  { id: "workouts_100", title: "Centurion", desc: "100 workouts completed", tier: "gold", icon: "dumbbell" },
  { id: "streak_3", title: "On a Roll", desc: "3-day workout streak", tier: "bronze", icon: "flame" },
  { id: "streak_7", title: "Week Warrior", desc: "7-day workout streak", tier: "silver", icon: "flame" },
  { id: "streak_14", title: "Unstoppable", desc: "14-day workout streak", tier: "gold", icon: "flame" },
  { id: "streak_30", title: "Monthly Machine", desc: "30-day workout streak", tier: "diamond", icon: "flame" },
  { id: "arena_first_win", title: "First Blood", desc: "Win your first Arena match", tier: "bronze", icon: "swords" },
  { id: "arena_played_10", title: "Regular Rival", desc: "Play 10 Arena matches", tier: "bronze", icon: "swords" },
  { id: "arena_wins_10", title: "Arena Contender", desc: "10 Arena wins", tier: "silver", icon: "swords" },
  { id: "arena_wins_50", title: "Arena Champion", desc: "50 Arena wins", tier: "gold", icon: "swords" },
  { id: "rank_bronze", title: "Bronze Rank", desc: "Reach Bronze", tier: "bronze", icon: "medal" },
  { id: "rank_silver", title: "Silver Rank", desc: "Reach Silver", tier: "silver", icon: "medal" },
  { id: "rank_gold", title: "Gold Rank", desc: "Reach Gold", tier: "gold", icon: "medal" },
  { id: "rank_platinum", title: "Platinum Rank", desc: "Reach Platinum", tier: "gold", icon: "medal" },
  { id: "rank_diamond", title: "Diamond Rank", desc: "Reach Diamond", tier: "diamond", icon: "medal" },
  { id: "rank_master", title: "Master Rank", desc: "Reach Master", tier: "diamond", icon: "medal" },
  { id: "rank_legend", title: "Legend", desc: "Reach Legend", tier: "diamond", icon: "medal" },
  { id: "quests_10", title: "Quest Hunter", desc: "Complete 10 quests", tier: "silver", icon: "medal" },
  { id: "quests_50", title: "Quest Master", desc: "Complete 50 quests", tier: "gold", icon: "medal" },
  { id: "league_silver", title: "Silver League", desc: "Get promoted to the Silver league", tier: "silver", icon: "medal" },
  { id: "league_gold", title: "Gold League", desc: "Get promoted to the Gold league", tier: "silver", icon: "medal" },
  { id: "league_platinum", title: "Platinum League", desc: "Get promoted to the Platinum league", tier: "diamond", icon: "medal" },
  { id: "league_diamond", title: "Diamond League", desc: "Get promoted to the Diamond league", tier: "diamond", icon: "medal" },
];

export const TIER_COLOR: Record<TrophyTier, string> = {
  bronze: "#cd7f32", silver: "#b8c2d0", gold: "#f5b301", diamond: "#5ac8fa",
};

export interface RewardResult {
  duplicate?: boolean;
  xpGained: number;
  xp: number;
  level: number;
  levelUp: boolean;
  rank: string;
  rankUp: boolean;
  streakDays?: number;
  freezes?: number;
  freezeUsed?: boolean;
  freezeEarned?: boolean;
  questsCompleted?: { title: string; xp: number }[];
  newTrophies: { id: string; title: string; desc: string; tier: TrophyTier; icon: TrophyDef["icon"] }[];
}

const dayKey = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Tell the server a workout was completed; returns rewards to celebrate. */
export async function reportWorkout(log: WorkoutLog): Promise<RewardResult | null> {
  try {
    const res = await callFn<RewardResult>("recordWorkout", {
      workoutId: log.id,
      minutes: log.durationMinutes || 1,
      calories: log.estimatedCaloriesBurned || 0,
      dayKey: dayKey(),
      area: log.targetArea || "Full Body",
      feeling: log.feeling,
    });
    return res.duplicate ? null : res;
  } catch {
    return null;
  }
}

export function rankFor(xp: number) {
  let idx = 0;
  RANKS.forEach((r, i) => { if (xp >= r.minXp) idx = i; });
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  const progress = next ? (xp - rank.minXp) / (next.minXp - rank.minXp) : 1;
  return { rank, next, progress: Math.max(0, Math.min(1, progress)), xpToNext: next ? next.minXp - xp : 0, level: 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 90)) };
}

export interface MatchRecord {
  code: string;
  at: number;
  exercise: string;
  myReps: number;
  oppReps: number;
  oppUid: string;
  oppName: string;
  result: "win" | "loss" | "draw";
  xpGained: number;
  ratingDelta: number;
}

export interface ProgressData {
  xp: number;
  level: number;
  totalWorkouts: number;
  streakDays: number;
  arenaWins: number;
  arenaMatches: number;
  trophies: Map<string, number>;
  matches: MatchRecord[];
  loading: boolean;
  lastWorkoutDay: string;
  freezes: number;
  weekXp: number;
  weekId: string;
  leagueTier: number;
  leagueGroup: string;
  lastLeagueResult: LeagueResult | null;
  rating: number;
  ratingPeak: number;
  challengeWins: number;
}

export interface LeagueResult { week: string; tier: number; newTier: number; rank: number; size: number; outcome: "promoted" | "demoted" | "stayed"; xp: number }

const toMs = (v: any) => (v?.toMillis ? v.toMillis() : 0);

export function useProgress(uid: string | null | undefined): ProgressData {
  const [data, setData] = useState<ProgressData>({
    xp: 0, level: 1, totalWorkouts: 0, streakDays: 0, arenaWins: 0, arenaMatches: 0,
    trophies: new Map(), matches: [], loading: true,
    lastWorkoutDay: "", freezes: 1, weekXp: 0, weekId: "", leagueTier: 0, leagueGroup: "", lastLeagueResult: null, rating: 1000, ratingPeak: 1000, challengeWins: 0,
  });

  useEffect(() => {
    if (!uid) return;
    const unsubs: Array<() => void> = [];
    unsubs.push(onSnapshot(doc(db, "users", uid), snap => {
      const x = (snap.data() ?? {}) as Record<string, any>;
      setData(d => ({
        ...d,
        xp: Number(x.xp || 0),
        level: Number(x.level || 1),
        totalWorkouts: Number(x.totalWorkouts || 0),
        streakDays: Number(x.streakDays || 0),
        arenaWins: Number(x.arenaWins || 0),
        arenaMatches: Number(x.arenaMatches || 0),
        lastWorkoutDay: String(x.lastWorkoutDay || ""),
        freezes: x.freezes === undefined ? 1 : Number(x.freezes),
        weekXp: Number(x.weekXp || 0),
        weekId: String(x.weekId || ""),
        leagueTier: Number(x.leagueTier || 0),
        leagueGroup: String(x.leagueGroup || ""),
        lastLeagueResult: (x.lastLeagueResult as LeagueResult) ?? null,
        rating: Number(x.rating || 1000),
        ratingPeak: Number(x.ratingPeak || x.rating || 1000),
        challengeWins: Number(x.challengeWins || 0),
        loading: false,
      }));
    }, () => setData(d => ({ ...d, loading: false }))));
    unsubs.push(onSnapshot(collection(db, "users", uid, "trophies"), snap => {
      const m = new Map<string, number>();
      snap.docs.forEach(d => m.set(d.id, toMs(d.data().at)));
      setData(d => ({ ...d, trophies: m }));
    }, () => {}));
    unsubs.push(onSnapshot(query(collection(db, "users", uid, "matches"), orderBy("at", "desc"), fsLimit(20)), snap => {
      setData(d => ({
        ...d,
        matches: snap.docs.map(s => {
          const x = s.data() as Record<string, any>;
          return { code: s.id, at: toMs(x.at), exercise: x.exercise || "", myReps: x.myReps || 0, oppReps: x.oppReps || 0, oppUid: x.oppUid || "", oppName: x.oppName || "Athlete", result: x.result || "loss", xpGained: x.xpGained || 0, ratingDelta: Number(x.ratingDelta || 0) } as MatchRecord;
        }),
      }));
    }, () => {}));
    return () => unsubs.forEach(u => u());
  }, [uid]);

  return data;
}

export interface LeaderRow {
  uid: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  arenaWins: number;
  streakDays: number;
  rating: number;
}

/** Ranked by xp, highest first. Only people who have actually trained/played appear. */
export function subscribeLeaderboard(cb: (rows: LeaderRow[]) => void, onError?: (e: unknown) => void, by: "xp" | "rating" = "xp") {
  return onSnapshot(query(collection(db, "users"), orderBy(by, "desc"), fsLimit(50)), snap => {
    cb(
      snap.docs
        .map(d => ({ id: d.id, x: d.data() as Record<string, any> }))
        .filter(({ x }) => x.public !== false && (by === "rating" ? Number(x.arenaMatches || 0) > 0 : Number(x.xp || 0) > 0))
        .map(({ id, x }) => ({
          uid: id,
          name: x.displayName || "Athlete",
          handle: x.handle || "",
          avatarUrl: x.avatarUrl ?? null,
          xp: Number(x.xp || 0),
          level: Number(x.level || 1),
          arenaWins: Number(x.arenaWins || 0),
          streakDays: Number(x.streakDays || 0),
          rating: Number(x.rating || 1000),
        })),
    );
  }, err => onError?.(err));
}

/* ------------------------------------------------------------------ */
/* streak status, quests, leagues                                      */
/* ------------------------------------------------------------------ */

export const localDayKey = dayKey;
const dayNum = (key: string) => Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);

/** What the streak really is right now (the stored number only changes when a workout is logged). */
export function streakStatus(p: Pick<ProgressData, "streakDays" | "lastWorkoutDay" | "freezes">) {
  if (!p.lastWorkoutDay || !p.streakDays) return { days: 0, state: "none" as const };
  const gap = dayNum(dayKey()) - dayNum(p.lastWorkoutDay);
  if (gap <= 0) return { days: p.streakDays, state: "safe" as const };          // trained today
  if (gap === 1) return { days: p.streakDays, state: "at-risk" as const };      // train today to keep it
  if (gap === 2 && p.freezes > 0) return { days: p.streakDays, state: "frozen" as const }; // a freeze will cover one missed day
  return { days: 0, state: "lost" as const };
}

export interface Quest { id: string; title: string; metric: string; target: number; progress: number; xp: number; done: boolean }
export interface QuestDoc { dayKey: string; weekId: string; daily: Quest[]; weekly: Quest[] }

export function useQuests(uid: string | null | undefined): QuestDoc | null {
  const [q, setQ] = useState<QuestDoc | null>(null);
  useEffect(() => {
    if (!uid) { setQ(null); return; }
    let asked = false;
    return onSnapshot(doc(db, "users", uid, "quests", "current"), snap => {
      const x = snap.data() as QuestDoc | undefined;
      setQ(x ?? null);
      // missing, or from an earlier day: ask the server to roll today's quests (once per mount)
      const stale = !x || x.dayKey !== localDayKey();
      if (stale && !asked) { asked = true; void callFn("getQuests").catch(() => {}); }
    }, () => {});
  }, [uid]);
  return q;
}

export const LEAGUE_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
export const LEAGUE_COLORS = ["#cd7f32", "#b8c2d0", "#f5b301", "#7ad3c8", "#5ac8fa"];

export function joinLeague() {
  return callFn<{ group: string; tier: number }>("joinLeague");
}

export interface LeagueRow { uid: string; name: string; avatarUrl: string | null; weekXp: number; level: number }

export function subscribeLeague(group: string, cb: (rows: LeagueRow[]) => void, onError?: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, "users"), where("leagueGroup", "==", group), orderBy("weekXp", "desc"), fsLimit(30)),
    snap => cb(snap.docs.map(d => {
      const x = d.data() as Record<string, any>;
      return { uid: d.id, name: x.displayName || "Athlete", avatarUrl: x.avatarUrl ?? null, weekXp: Number(x.weekXp || 0), level: Number(x.level || 1) };
    })),
    err => onError?.(err),
  );
}

/** Milliseconds until the weekly reset (next Monday 00:00 IST). */
export function msUntilLeagueReset(now = Date.now()) {
  const IST = 5.5 * 3600_000;
  const d = new Date(now + IST);
  const dow = d.getUTCDay() || 7; // Mon=1..Sun=7
  const daysLeft = 8 - dow;
  const nextMonIst = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysLeft);
  return nextMonIst - IST - now;
}
