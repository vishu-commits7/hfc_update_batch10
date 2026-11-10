/**
 * Demo mode: sample data for clean store screenshots, with no account and nothing sent to the server.
 *
 * It only exists in a screenshot build (VITE_DEMO_MODE=1) or on the dev server with ?demo=1.
 * In a normal release build `DEMO` is always false, so none of this can be switched on by a user.
 * Every name and number below is made up.
 */
import type { NextPlan } from "./plan";
import type { ArenaRoom } from "./social";

function decide(): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env ?? {};
    if (env.VITE_DEMO_MODE === "1") return true;
    if (!env.DEV) return false;
    const url = new URLSearchParams(window.location.search).get("demo");
    if (url === "1") localStorage.setItem("ap_demo", "1");
    if (url === "0") localStorage.removeItem("ap_demo");
    return localStorage.getItem("ap_demo") === "1";
  } catch { return false; }
}
/** Fixed for the life of the page, so hooks can branch on it safely. */
export const DEMO = decide();
export const isDemo = () => DEMO;

export const DEMO_UID = "demo-user";
export const DEMO_NAME = "Aarav";
const DAY = 86_400_000;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const istDayKey = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/* ---------- local history, so the dashboard is not empty (only on a device with no history yet) ---------- */
export function seedDemoStorage() {
  if (!DEMO) return;
  try {
    if (localStorage.getItem("kinetic_logs") && localStorage.getItem("ap_demo_seeded")) return;
    const areas = ["Upper Body", "Lower Body", "Core / Abs", "Full Body", "Cardio Blitz"];
    const titles = ["Push Day Builder", "Leg Strength Circuit", "Core Burner", "Full Body Reset", "Cardio Blitz"];
    const logs = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.now() - (i + 1) * DAY); d.setHours(7, 30, 0, 0);
      return { id: `demo-${i}`, workoutId: `demo-w${i % 5}`, workoutTitle: titles[i % 5], completedAt: d.toISOString(), durationMinutes: 14 + (i % 4) * 4, exercisesCompleted: 6 + (i % 3), feeling: (["Energetic", "Satisfied", "Satisfied", "Tired"] as const)[i % 4], estimatedCaloriesBurned: 110 + (i % 5) * 22, targetArea: areas[i % 5] };
    });
    const set = (k: string, v: unknown) => localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    set("kinetic_fresh_build_version", "home-fitness-coach-clean-premium-v6"); // stops the first-launch clean-up wiping the sample history
    set("kinetic_logs", logs);
    set("kinetic_profile", { fitnessLevel: "Intermediate", goal: "Strength", preferredEquipment: ["none"], streakDays: 12, lastWorkoutDate: logs[0].completedAt, totalWorkouts: 47, totalMinutes: 846, totalCaloriesBurned: 6240 });
    set("kinetic_onboarding_seen", "1"); set("ap_goalsetup_status", "done"); set("kinetic_personalize_status", "done"); set("ap_tour_done", "1");
    set("ap_demo_seeded", "1");
  } catch { /* storage blocked: the dashboard just starts empty */ }
}

/* ---------- identity and progress ---------- */
export const demoIdentity = { uid: DEMO_UID, signedIn: true, name: DEMO_NAME, handle: "aarav_fit", avatar: null, bio: "Morning workouts. Push-up streak.", profile: null, ready: true };
export function demoProgress() {
  const y = new Date(Date.now() - DAY);
  return {
    xp: 3420, level: 7, totalWorkouts: 47, streakDays: 12, arenaWins: 9, arenaMatches: 14,
    trophies: new Map<string, number>([["first_workout", 1], ["workouts_10", 1], ["streak_3", 1], ["streak_7", 1], ["arena_first_win", 1], ["rank_bronze", 1], ["rank_silver", 1], ["rank_gold", 1], ["league_silver", 1]]),
    matches: [
      { code: "DEMO01", at: Date.now() - 3 * 3600_000, exercise: "Classic Push-ups", myReps: 20, oppReps: 17, oppUid: "d2", oppName: "Meera", result: "win" as const, xpGained: 60, ratingDelta: 14 },
      { code: "DEMO02", at: Date.now() - 27 * 3600_000, exercise: "Bodyweight Squats", myReps: 22, oppReps: 25, oppUid: "d3", oppName: "Kabir", result: "loss" as const, xpGained: 20, ratingDelta: -9 },
    ],
    loading: false, lastWorkoutDay: dayKey(y), freezes: 2, weeklyGoal: 4, weekDone: 3, weekDoneId: "", weekXp: 640, weekId: "",
    leagueTier: 1, leagueGroup: "demo-group", lastLeagueResult: null, rating: 1124, ratingPeak: 1140, challengeWins: 2,
  };
}
export function demoQuests() {
  return {
    dayKey: dayKey(new Date()), weekId: "",
    daily: [
      { id: "d1", title: "Finish a workout", metric: "workouts", target: 1, progress: 0, xp: 40, done: false },
      { id: "d2", title: "Train for 15 minutes", metric: "minutes", target: 15, progress: 0, xp: 30, done: false },
      { id: "d3", title: "Play an Arena match", metric: "arenaMatches", target: 1, progress: 1, xp: 30, done: true },
    ],
    weekly: [{ id: "w1", title: "Finish 4 workouts this week", metric: "workouts", target: 4, progress: 3, xp: 150, done: false }],
  };
}
export const demoPlan: NextPlan = {
  kind: "workout", area: "Upper Body", level: "Intermediate", minutes: 18, progress: true,
  reason: "Upper body is rested, so today is a push day.",
  readiness: [{ area: "Upper Body", hoursSince: 52, ready: true }, { area: "Lower Body", hoursSince: 24, ready: false }, { area: "Core / Abs", hoursSince: 76, ready: true }],
  upcoming: [{ label: "Tomorrow", kind: "workout", area: "Lower Body", minutes: 18 }, { label: "Thu", kind: "rest", area: null, minutes: 0 }, { label: "Fri", kind: "workout", area: "Core / Abs", minutes: 15 }],
};

/* ---------- boards ---------- */
const NAMES = ["Meera", "Kabir", "Ananya", "Rohan", "Ishaan", "Diya", "Vikram", "Sara", "Arjun", "Nisha", "Dev", "Tara", "Kiran", "Zoya", "Aditya", "Riya", "Neel", "Pooja", "Sameer", "Lila", "Yash", "Anika", "Manav", "Isha", "Karan", "Maya", "Rahul", "Sana", "Om"];
export function demoLeague() {
  const others = NAMES.map((n, i) => ({ uid: `d${i}`, name: n, avatarUrl: null, weekXp: Math.max(0, 980 - i * 34 - (i % 3) * 11), level: 4 + ((i * 7) % 9) }));
  const me = { uid: DEMO_UID, name: DEMO_NAME, avatarUrl: null, weekXp: 640, level: 7 };
  return [...others, me].sort((a, b) => b.weekXp - a.weekXp).slice(0, 30);
}
export function demoLadder(by: "xp" | "rating") {
  const rows = NAMES.slice(0, 24).map((n, i) => ({ uid: `d${i}`, name: n, handle: n.toLowerCase(), avatarUrl: null, xp: 9800 - i * 310, level: 11 - Math.floor(i / 3), arenaWins: 40 - i, streakDays: 30 - i, rating: 1420 - i * 14 }));
  rows.push({ uid: DEMO_UID, name: DEMO_NAME, handle: "aarav_fit", avatarUrl: null, xp: 3420, level: 7, arenaWins: 9, streakDays: 12, rating: 1124 });
  return rows.sort((a, b) => (by === "rating" ? b.rating - a.rating : b.xp - a.xp));
}
export function demoDailyBoard(max: number) {
  const rows = NAMES.map((n, i) => ({ uid: `d${i}`, name: n, avatar: null, reps: 58 - i, level: 5 + (i % 7) }));
  rows.splice(6, 0, { uid: DEMO_UID, name: DEMO_NAME, avatar: null, reps: 52, level: 7 });
  return rows.sort((a, b) => b.reps - a.reps).slice(0, max);
}

/* ---------- one scripted Arena match ---------- */
export const DEMO_ROOM = "DEMO01";
let room: ArenaRoom = freshRoom();
const roomSubs = new Set<(r: ArenaRoom | null) => void>();
let oppTimer: ReturnType<typeof setInterval> | null = null;
function freshRoom(): ArenaRoom {
  return {
    code: DEMO_ROOM, hostUid: DEMO_UID, hostName: DEMO_NAME, hostAvatar: null, guestUid: "d0", guestName: "Meera", guestAvatar: null,
    exercise: "Classic Push-ups", plan: [{ id: "pushups", name: "Classic Push-ups", reps: 20 }], mode: "reps", target: 20, status: "ready", visibility: "private",
    createdAt: Date.now(), startedAt: null, hostReps: 0, guestReps: 0, hostDone: false, guestDone: false, quick: true, rematchCode: null, rematchBy: null,
    ratingDelta: null, ratingAfter: null, ghost: false, ghostKind: null, ghostTl: [], ghostHalf: false, unrated: false,
  };
}
const pushRoom = (patch: Partial<ArenaRoom>) => { room = { ...room, ...patch }; roomSubs.forEach(cb => cb(room)); };
function finishRoom() {
  if (oppTimer) { clearInterval(oppTimer); oppTimer = null; }
  const won = room.hostReps > room.guestReps;
  pushRoom({ status: "finished", hostDone: true, guestDone: true, ratingDelta: { host: won ? 14 : -10, guest: won ? -14 : 10 }, ratingAfter: { host: 1124 + (won ? 14 : -10), guest: 1110 } });
}
export function demoSubscribeRoom(cb: (r: ArenaRoom | null) => void) {
  if (room.status === "finished") room = freshRoom(); // a new visit starts a new match
  roomSubs.add(cb); queueMicrotask(() => cb(room));
  return () => { roomSubs.delete(cb); };
}

/* ---------- server calls ---------- */
let dailyAttempts = 0, dailyBest = 0;
const HANDLERS: Record<string, (d: Record<string, unknown>) => unknown> = {
  joinLeague: () => ({ group: "demo-group", tier: 1 }),
  getQuests: () => ({ dayKey: istDayKey() }),
  setWeeklyGoal: d => ({ weeklyGoal: d.goal }),
  registerDevice: () => ({ ok: true }),
  modIsAdmin: () => ({ admin: false }),
  inviteInfo: () => ({ code: "APEX7KM", joined: 3, rewarded: 2, maxRewarded: 10, invitedBy: false, canEnterCode: false }),
  dailyChallengeInfo: () => ({ dayKey: istDayKey(), seconds: 60, minReps: 5, xp: 75, exercise: { id: "squats", name: "Bodyweight Squats", tip: "Hips below knees, stand fully tall." }, me: { attempts: dailyAttempts, attemptsMax: 3, best: dailyBest, xpAwarded: dailyBest > 0 } }),
  dailyChallengeStart: () => ({ dayKey: istDayKey(), startedAt: Date.now(), attempts: ++dailyAttempts, attemptsMax: 3, seconds: 60 }),
  dailyChallengeSubmit: d => { const reps = Number(d.reps) || 0; const first = dailyBest === 0; dailyBest = Math.max(dailyBest, reps); return { reps, best: dailyBest, counts: reps >= 5, newBest: reps >= dailyBest, rank: reps >= 5 ? Math.max(1, 59 - reps) : null, xpGained: first && reps >= 5 ? 75 : 0, levelUp: false, attempts: dailyAttempts, attemptsMax: 3, dayKey: istDayKey() }; },
  arenaQuickMatch: () => ({ status: "matched", code: DEMO_ROOM }),
  arenaGhostMatch: () => ({ status: "matched", code: DEMO_ROOM }),
  arenaQuickCancel: () => ({ ok: true }),
  arenaStart: () => {
    pushRoom({ status: "live", startedAt: Date.now(), hostReps: 0, guestReps: 0 });
    if (oppTimer) clearInterval(oppTimer);
    // the opponent keeps a steady pace and finishes on 17, so a normal tapper wins 20 to 17
    oppTimer = setInterval(() => { if (room.status !== "live") return; if (room.guestReps < 17) pushRoom({ guestReps: room.guestReps + 1 }); }, 1500);
    return { ok: true };
  },
  arenaReport: d => { if (room.status !== "live") return { reps: room.hostReps, status: room.status }; const reps = Math.min(room.target, Math.max(room.hostReps, Number(d.reps) || 0)); pushRoom({ hostReps: reps }); if (reps >= room.target) finishRoom(); return { reps, status: room.status }; },
  arenaFinish: () => { if (room.status === "live") finishRoom(); return { status: "finished" }; },
  arenaLeave: () => { if (oppTimer) { clearInterval(oppTimer); oppTimer = null; } room = freshRoom(); return { ok: true }; },
  recordWorkout: () => demoReward(),
};
/** What a finished workout shows in demo mode: a level-up with a trophy. */
export function demoReward() {
  return {
    duplicate: false, xpGained: 212, xp: 3632, level: 8, levelUp: true, rank: "Gold", rankUp: false, streakDays: 13, freezes: 2,
    weekDone: 4, weeklyGoal: 4, weekGoalHit: true, questsCompleted: [{ title: "Finish a workout", xp: 40 }],
    newTrophies: [{ id: "streak_14", title: "Unstoppable", desc: "14-day workout streak", tier: "gold", icon: "flame" }],
  };
}
/** Stands in for every Cloud Function. Anything not listed is refused, so demo mode can never change real data. */
export async function demoCall<T>(name: string, data: Record<string, unknown>): Promise<T> {
  await new Promise(r => setTimeout(r, 250)); // a short wait, like a real call
  const h = HANDLERS[name];
  if (!h) throw new Error("Not available in demo mode.");
  return h(data) as T;
}
