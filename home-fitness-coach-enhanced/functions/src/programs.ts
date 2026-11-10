import "./init";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Sessions per week for every program. The server owns program progress, so it needs the shape of each
 * program. Must match src/data/programs.ts: `npm run programs:check` compares the two.
 */
export const PROGRAM_SHAPES: Record<string, number[]> = {
  "beginner-foundations": [3, 3, 3, 3],
  "fat-loss-no-equipment": [4, 4, 4, 4, 4, 4],
};

/** A session counts toward a program only if the workout lasted at least this long. */
export const PROGRAM_MIN_MINUTES = 5;

export const programTotal = (shape: number[]) => shape.reduce((a, b) => a + b, 0);

/** Which week (0-based) session number n (0-based) belongs to, and how many sessions of that week are done after it. */
export function weekProgress(shape: number[], n: number) {
  let left = n;
  for (let w = 0; w < shape.length; w++) {
    if (left < shape[w]) return { week: w, weekTotal: shape[w], weekDone: left + 1 };
    left -= shape[w];
  }
  return { week: shape.length - 1, weekTotal: shape[shape.length - 1], weekDone: shape[shape.length - 1] };
}

/** Starts a program. Starting another program replaces the current one; starting the same unfinished one changes nothing. */
export const startProgram = onCall(async req => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const programId = String(req.data?.programId || "").slice(0, 60);
  const shape = PROGRAM_SHAPES[programId];
  if (!shape) throw new HttpsError("invalid-argument", "Unknown program.");
  const ref = db.doc(`users/${req.auth.uid}/program/current`);
  const cur = await ref.get();
  const c = cur.data();
  if (c && c.programId === programId && !c.completedAt) return { programId, done: Number(c.done || 0), total: programTotal(shape), already: true };
  await ref.set({ programId, startedAt: FieldValue.serverTimestamp(), done: 0, total: programTotal(shape), completedAt: null, lastDay: "" });
  return { programId, done: 0, total: programTotal(shape), already: false };
});

/** Leaves the current program. Finished programs and trophies are kept. */
export const stopProgram = onCall(async req => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  await db.doc(`users/${req.auth.uid}/program/current`).delete();
  return { ok: true };
});
