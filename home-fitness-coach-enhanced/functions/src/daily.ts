/**
 * Daily global challenge. One exercise for everyone, picked by the server, 60 seconds, resets at midnight IST.
 *  dailyChallengeInfo   today's exercise + your attempts/best
 *  dailyChallengeStart  the server notes when you started (its clock is the only one that counts)
 *  dailyChallengeSubmit reps are checked against the time since start and a per-exercise rep-rate limit;
 *                       the best attempt goes on dailyBoard/{day}/entries/{uid}; XP is paid once per day
 */
import "./init";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { applyProgress, readProgress } from "./progression";
import { dayKeyIST } from "./timeutil";
import { strike } from "./anticheat";
import { DAILY_ATTEMPTS, DAILY_MIN_REPS, DAILY_SECONDS, DAILY_XP, boardScore, exerciseFor, validateSubmission } from "./dailyCore";

const db = getFirestore();
const KEEP_DAYS = 14;

function uidOf(req: { auth?: { uid: string } | undefined }) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return req.auth.uid;
}
const dailyRef = (uid: string, day: string) => db.doc(`users/${uid}/daily/${day}`);
const publicEx = (day: string) => { const e = exerciseFor(day); return { id: e.id, name: e.name, tip: e.tip }; };

export const dailyChallengeInfo = onCall(async req => {
  const uid = uidOf(req);
  const day = dayKeyIST();
  const d = (await dailyRef(uid, day).get()).data() ?? {};
  return {
    dayKey: day, seconds: DAILY_SECONDS, exercise: publicEx(day), minReps: DAILY_MIN_REPS, xp: DAILY_XP,
    me: { attempts: Number(d.attempts || 0), attemptsMax: DAILY_ATTEMPTS, best: Number(d.best || 0), xpAwarded: !!d.xpAwarded },
  };
});

export const dailyChallengeStart = onCall(async req => {
  const uid = uidOf(req);
  const day = dayKeyIST();
  const ref = dailyRef(uid, day);
  return db.runTransaction(async tx => {
    const [snap, user] = await Promise.all([tx.get(ref), tx.get(db.doc(`users/${uid}`))]);
    if (user.data()?.banned) throw new HttpsError("permission-denied", "Not available.");
    const d = snap.data() ?? {};
    const attempts = Number(d.attempts || 0);
    if (attempts >= DAILY_ATTEMPTS) throw new HttpsError("resource-exhausted", "You've used all of today's attempts. A new challenge starts at midnight IST.");
    const startedAt = Date.now();
    tx.set(ref, { day, attempts: attempts + 1, startedAt, submitted: false, expireAt: Timestamp.fromMillis(startedAt + 40 * 86_400_000) }, { merge: true });
    return { dayKey: day, startedAt, attempts: attempts + 1, attemptsMax: DAILY_ATTEMPTS, seconds: DAILY_SECONDS };
  });
});

const REJECT_MSG: Record<string, string> = {
  "too-fast": "That count isn't possible in 60 seconds, so it wasn't saved.",
  "too-early": "That was submitted too early to be a full 60 seconds.",
  expired: "That attempt took too long to submit. Try again.",
  range: "That count isn't valid.",
};

export const dailyChallengeSubmit = onCall(async req => {
  const uid = uidOf(req);
  const reps = Math.floor(Number(req.data?.reps));
  const day = dayKeyIST();
  const ex = exerciseFor(day);
  const ref = dailyRef(uid, day);
  const boardRef = db.doc(`dailyBoard/${day}/entries/${uid}`);

  const out = await db.runTransaction(async tx => {
    const [snap, boardSnap] = await Promise.all([tx.get(ref), tx.get(boardRef)]);
    const p = await readProgress(tx, uid);
    const d = snap.data() ?? {};
    if (p.user.banned) throw new HttpsError("permission-denied", "Not available.");
    // An attempt started before midnight belongs to yesterday's document, so it cannot land on today's board.
    if (!d.startedAt || d.submitted) throw new HttpsError("failed-precondition", "Start the challenge first.");
    const now = Date.now();
    const v = validateSubmission(ex, reps, now - Number(d.startedAt));
    if (!v.ok) {
      // the attempt is spent; rejects are counted for anti-cheat review. Returned (not thrown) so the write commits.
      tx.set(ref, { submitted: true, rejected: FieldValue.increment(1), lastReject: v.reason }, { merge: true });
      return { rejected: REJECT_MSG[v.reason], reason: v.reason } as const;
    }
    const best = Math.max(Number(d.best || 0), reps);
    const counts = reps >= DAILY_MIN_REPS;
    const prevReps = Number(boardSnap.data()?.reps || 0);
    const newBest = counts && reps > prevReps;
    const payXp = counts && !d.xpAwarded;
    tx.set(ref, { submitted: true, best, last: reps, ...(payXp ? { xpAwarded: true } : {}) }, { merge: true });
    const score = newBest ? boardScore(reps, now) : Number(boardSnap.data()?.score || 0);
    if (newBest) {
      tx.set(boardRef, {
        uid, name: String(p.user.displayName || "Athlete").slice(0, 40), avatar: (p.user.avatarUrl as string) ?? null,
        reps, score, at: now, level: Number(p.user.level || 1),
      });
    }
    const prog = payXp ? applyProgress(tx, uid, p, { xp: DAILY_XP }) : null;
    return {
      rejected: null, reps, best, counts, newBest, score, onBoard: newBest || boardSnap.exists,
      xpGained: prog?.xpGained ?? 0, levelUp: prog?.levelUp ?? false, rankUp: prog?.rankUp ?? false, newTrophies: prog?.newTrophies ?? [],
      attempts: Number(d.attempts || 1),
    };
  });
  if (out.rejected) {
    if (out.reason === "too-fast") await strike(uid, "daily-rate", `${ex.id}: sent ${reps} reps in 60s`);
    throw new HttpsError("failed-precondition", out.rejected);
  }
  // position on today's board (1 = top), counted after the write
  let rank: number | null = null;
  if (out.onBoard) rank = (await db.collection(`dailyBoard/${day}/entries`).where("score", ">", out.score).count().get()).data().count + 1;
  return { ...out, rank, attemptsMax: DAILY_ATTEMPTS, dayKey: day };
});

/** Drops boards older than KEEP_DAYS. */
export const dailyChallengeSweep = onSchedule({ schedule: "40 0 * * *", timeZone: "Asia/Kolkata" }, async () => {
  for (let i = KEEP_DAYS + 1; i <= KEEP_DAYS + 30; i++) {
    const day = dayKeyIST(Date.now() - i * 86_400_000);
    await db.recursiveDelete(db.doc(`dailyBoard/${day}`)).catch(() => {});
  }
});
