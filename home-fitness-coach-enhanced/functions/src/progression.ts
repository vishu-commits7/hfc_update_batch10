/** Progression engine: XP, levels, ranks, trophies, quests, weekly XP. Used inside Firestore transactions. */
import "./init";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { advanceQuests, type QuestDoc } from "./quests";
import { weekIdIST } from "./timeutil";

const db = getFirestore();

/* progression: xp, levels, ranks, trophies                            */
/* ------------------------------------------------------------------ */

export const RANKS = [
  { id: "rookie", name: "Rookie", minXp: 0 },
  { id: "bronze", name: "Bronze", minXp: 400 },
  { id: "silver", name: "Silver", minXp: 1200 },
  { id: "gold", name: "Gold", minXp: 3000 },
  { id: "platinum", name: "Platinum", minXp: 6500 },
  { id: "diamond", name: "Diamond", minXp: 12000 },
  { id: "master", name: "Master", minXp: 22000 },
  { id: "legend", name: "Legend", minXp: 40000 },
];
export const levelOf = (xp: number) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 90));
export const rankIdxOf = (xp: number) => RANKS.reduce((acc, r, i) => (xp >= r.minXp ? i : acc), 0);

type Tier = "bronze" | "silver" | "gold" | "diamond";
export const TROPHIES: Record<string, { title: string; desc: string; tier: Tier; icon: string }> = {
  first_workout: { title: "First Rep", desc: "Completed your first workout", tier: "bronze", icon: "dumbbell" },
  workouts_10: { title: "Getting Serious", desc: "10 workouts completed", tier: "bronze", icon: "dumbbell" },
  workouts_50: { title: "Iron Habit", desc: "50 workouts completed", tier: "silver", icon: "dumbbell" },
  workouts_100: { title: "Centurion", desc: "100 workouts completed", tier: "gold", icon: "dumbbell" },
  streak_3: { title: "On a Roll", desc: "3-day workout streak", tier: "bronze", icon: "flame" },
  streak_7: { title: "Week Warrior", desc: "7-day workout streak", tier: "silver", icon: "flame" },
  streak_14: { title: "Unstoppable", desc: "14-day workout streak", tier: "gold", icon: "flame" },
  streak_30: { title: "Monthly Machine", desc: "30-day workout streak", tier: "diamond", icon: "flame" },
  arena_first_win: { title: "First Blood", desc: "Won your first Arena match", tier: "bronze", icon: "swords" },
  arena_wins_10: { title: "Arena Contender", desc: "10 Arena wins", tier: "silver", icon: "swords" },
  arena_wins_50: { title: "Arena Champion", desc: "50 Arena wins", tier: "gold", icon: "swords" },
  arena_played_10: { title: "Regular Rival", desc: "Played 10 Arena matches", tier: "bronze", icon: "swords" },
  rank_bronze: { title: "Bronze Rank", desc: "Reached Bronze", tier: "bronze", icon: "medal" },
  rank_silver: { title: "Silver Rank", desc: "Reached Silver", tier: "silver", icon: "medal" },
  rank_gold: { title: "Gold Rank", desc: "Reached Gold", tier: "gold", icon: "medal" },
  rank_platinum: { title: "Platinum Rank", desc: "Reached Platinum", tier: "gold", icon: "medal" },
  rank_diamond: { title: "Diamond Rank", desc: "Reached Diamond", tier: "diamond", icon: "medal" },
  rank_master: { title: "Master Rank", desc: "Reached Master", tier: "diamond", icon: "medal" },
  rank_legend: { title: "Legend", desc: "Reached Legend", tier: "diamond", icon: "medal" },
  challenge_win_1: { title: "Challenger", desc: "Won a friend challenge", tier: "bronze", icon: "swords" },
  challenge_wins_5: { title: "Rival Slayer", desc: "Won 5 friend challenges", tier: "gold", icon: "swords" },
  program_complete: { title: "Program Finisher", desc: "Finished a full training program", tier: "gold", icon: "medal" },
  quests_10: { title: "Quest Hunter", desc: "Completed 10 quests", tier: "silver", icon: "medal" },
  quests_50: { title: "Quest Master", desc: "Completed 50 quests", tier: "gold", icon: "medal" },
  league_silver: { title: "Silver League", desc: "Promoted to the Silver league", tier: "silver", icon: "medal" },
  league_gold: { title: "Gold League", desc: "Promoted to the Gold league", tier: "silver", icon: "medal" },
  league_platinum: { title: "Platinum League", desc: "Promoted to the Platinum league", tier: "diamond", icon: "medal" },
  league_diamond: { title: "Diamond League", desc: "Promoted to the Diamond league", tier: "diamond", icon: "medal" },
};

export interface Stats { xp: number; totalWorkouts: number; streakDays: number; arenaWins: number; arenaMatches: number; questsDone: number; challengeWins: number; programsDone?: number }
export function earnedIds(st: Stats): string[] {
  const ids: string[] = [];
  if (st.totalWorkouts >= 1) ids.push("first_workout");
  for (const n of [10, 50, 100]) if (st.totalWorkouts >= n) ids.push(`workouts_${n}`);
  for (const n of [3, 7, 14, 30]) if (st.streakDays >= n) ids.push(`streak_${n}`);
  if (st.arenaWins >= 1) ids.push("arena_first_win");
  for (const n of [10, 50]) if (st.arenaWins >= n) ids.push(`arena_wins_${n}`);
  if (st.arenaMatches >= 10) ids.push("arena_played_10");
  for (const n of [10, 50]) if (st.questsDone >= n) ids.push(`quests_${n}`);
  if ((st.programsDone ?? 0) >= 1) ids.push("program_complete");
  if (st.challengeWins >= 1) ids.push("challenge_win_1");
  if (st.challengeWins >= 5) ids.push("challenge_wins_5");
  const ri = rankIdxOf(st.xp);
  for (let i = 1; i <= ri; i++) ids.push(`rank_${RANKS[i].id}`);
  return ids;
}
export const ALL_TROPHY_IDS = Object.keys(TROPHIES);

export interface Progress {
  user: Record<string, any>;
  have: Set<string>;
  quests?: Partial<QuestDoc>;
}
/** Reads everything needed to progress one user. MUST be called before any write in the transaction. */
export async function readProgress(tx: FirebaseFirestore.Transaction, uid: string): Promise<Progress> {
  const user = await tx.get(db.doc(`users/${uid}`));
  const questSnap = await tx.get(db.doc(`users/${uid}/quests/current`));
  const trophySnaps = await Promise.all(ALL_TROPHY_IDS.map(id => tx.get(db.doc(`users/${uid}/trophies/${id}`))));
  const have = new Set<string>();
  trophySnaps.forEach((t, i) => { if (t.exists) have.add(ALL_TROPHY_IDS[i]); });
  return { user: (user.data() ?? {}) as Record<string, any>, have, quests: questSnap.data() as Partial<QuestDoc> | undefined };
}

/** Applies an xp / stat change, awards trophies, returns what the UI should celebrate. */
export function applyProgress(
  tx: FirebaseFirestore.Transaction, uid: string, p: Progress,
  delta: { xp: number; workouts?: number; minutes?: number; streakDays?: number; arenaWin?: boolean; arenaMatch?: boolean; challengeWin?: boolean; programDone?: boolean; extra?: Record<string, unknown> },
) {
  const before = Number(p.user.xp || 0);
  const q = advanceQuests(p.quests, {
    workouts: delta.workouts, minutes: delta.minutes,
    arenaMatches: delta.arenaMatch ? 1 : 0, arenaWins: delta.arenaWin ? 1 : 0,
  });
  const gained = Math.max(0, Math.round(delta.xp)) + q.xp;
  const after = before + gained;
  const questsDone = Number(p.user.questsDone || 0) + q.completed.length;
  const week = weekIdIST();
  const weekXp = (p.user.weekId === week ? Number(p.user.weekXp || 0) : 0) + gained;
  const stats: Stats = {
    xp: after,
    totalWorkouts: Number(p.user.totalWorkouts || 0) + (delta.workouts ?? 0),
    streakDays: delta.streakDays ?? Number(p.user.streakDays || 0),
    arenaWins: Number(p.user.arenaWins || 0) + (delta.arenaWin ? 1 : 0),
    arenaMatches: Number(p.user.arenaMatches || 0) + (delta.arenaMatch ? 1 : 0),
    questsDone,
    challengeWins: Number(p.user.challengeWins || 0) + (delta.challengeWin ? 1 : 0),
    programsDone: Number(p.user.programsDone || 0) + (delta.programDone ? 1 : 0),
  };
  const newTrophies = earnedIds(stats).filter(id => !p.have.has(id));
  newTrophies.forEach(id => {
    tx.set(db.doc(`users/${uid}/trophies/${id}`), { id, ...TROPHIES[id], at: FieldValue.serverTimestamp() });
  });
  tx.set(db.doc(`users/${uid}`), {
    xp: after,
    level: levelOf(after),
    rankId: RANKS[rankIdxOf(after)].id,
    totalWorkouts: stats.totalWorkouts,
    streakDays: stats.streakDays,
    arenaWins: stats.arenaWins,
    arenaMatches: stats.arenaMatches,
    questsDone, weekXp, weekId: week, challengeWins: stats.challengeWins, programsDone: stats.programsDone,
    ...(delta.minutes ? { totalMinutes: FieldValue.increment(delta.minutes) } : {}),
    ...(delta.extra ?? {}),
  }, { merge: true });
  tx.set(db.doc(`users/${uid}/quests/current`), q.doc);
  return {
    questsCompleted: q.completed,
    xpGained: after - before,
    xp: after,
    level: levelOf(after),
    levelUp: levelOf(after) > levelOf(before),
    rank: RANKS[rankIdxOf(after)].name,
    rankUp: rankIdxOf(after) > rankIdxOf(before),
    newTrophies: newTrophies.map(id => ({ id, ...TROPHIES[id] })),
  };
}


export const dayNum = (key: string) => Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
