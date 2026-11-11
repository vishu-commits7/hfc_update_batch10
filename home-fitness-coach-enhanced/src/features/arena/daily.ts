/** Daily global challenge (client). The server picks the exercise, times the attempt and checks the count. */
import { collection, limit as fsLimit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../core/firebase";
import { callFn } from "../../core/functions";
import { DEMO, demoDailyBoard } from "../../core/demo";

export interface DailyInfo {
  dayKey: string; seconds: number; minReps: number; xp: number;
  exercise: { id: string; name: string; tip: string };
  me: { attempts: number; attemptsMax: number; best: number; xpAwarded: boolean };
}
export interface DailyResult {
  reps: number; best: number; counts: boolean; newBest: boolean; rank: number | null;
  xpGained: number; levelUp: boolean; attempts: number; attemptsMax: number; dayKey: string;
}
export interface BoardRow { uid: string; name: string; avatar: string | null; reps: number; level: number }

export const getDailyInfo = () => callFn<DailyInfo>("dailyChallengeInfo");
export const startDaily = () => callFn<{ dayKey: string; startedAt: number; attempts: number; attemptsMax: number; seconds: number }>("dailyChallengeStart");
export const submitDaily = (reps: number) => callFn<DailyResult>("dailyChallengeSubmit", { reps });

/** Today's board, best first. `max` is 10 for the card and 100 when the player opens the full list. */
export function subscribeDailyBoard(dayKey: string, cb: (rows: BoardRow[]) => void, onError?: () => void, max = 10) {
  if (DEMO) { queueMicrotask(() => cb(demoDailyBoard(max))); return () => {}; }
  return onSnapshot(
    query(collection(db, "dailyBoard", dayKey, "entries"), orderBy("score", "desc"), fsLimit(max)),
    snap => cb(snap.docs.map(d => { const x = d.data(); return { uid: d.id, name: String(x.name || "Athlete"), avatar: (x.avatar as string) || null, reps: Number(x.reps || 0), level: Number(x.level || 1) }; })),
    () => onError?.(),
  );
}

/** Milliseconds until the next midnight in India (when the challenge changes). */
export function msToIstMidnight(now = Date.now()): number {
  const IST = 5.5 * 3600_000, DAY = 86_400_000;
  return DAY - ((now + IST) % DAY);
}
