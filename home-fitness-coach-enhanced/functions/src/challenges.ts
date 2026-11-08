/** Multi-day friend challenges: most workouts before the deadline wins. */
import "./init";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { notify } from "./notifyLib";
import { readProgress, applyProgress } from "./progression";

const db = getFirestore();
const DAY = 86_400_000;
const WIN_XP = 150, LOSE_XP = 40, DRAW_XP = 75;

function uidOf(req: { auth?: { uid: string } | undefined }) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return req.auth.uid;
}

export const challengeCreate = onCall(async req => {
  const uid = uidOf(req);
  const opp = String(req.data?.opponentUid || "");
  const days = [3, 5, 7].includes(Number(req.data?.days)) ? Number(req.data.days) : 7;
  if (!opp || opp === uid) throw new HttpsError("invalid-argument", "Pick a friend.");
  const [a, b, blk1, blk2, meSnap, oppSnap] = await Promise.all([
    db.doc(`follows/${uid}_${opp}`).get(), db.doc(`follows/${opp}_${uid}`).get(),
    db.doc(`users/${uid}/blocks/${opp}`).get(), db.doc(`users/${opp}/blocks/${uid}`).get(),
    db.doc(`users/${uid}`).get(), db.doc(`users/${opp}`).get(),
  ]);
  const friends = a.data()?.status === "accepted" || b.data()?.status === "accepted";
  if (!friends) throw new HttpsError("failed-precondition", "You can challenge friends once a follow is accepted.");
  if (blk1.exists || blk2.exists) throw new HttpsError("permission-denied", "Not available.");
  const open = await db.collection("challenges").where("members", "array-contains", uid).where("status", "in", ["pending", "active"]).limit(20).get();
  if (open.docs.some(d => (d.data().members as string[]).includes(opp))) throw new HttpsError("already-exists", "You already have a challenge with this friend.");
  if (open.size >= 5) throw new HttpsError("resource-exhausted", "Finish a challenge before starting another.");
  const myName = String(meSnap.data()?.displayName || "Athlete"), oppName = String(oppSnap.data()?.displayName || "Athlete");
  const ref = await db.collection("challenges").add({
    members: [uid, opp], creatorUid: uid, opponentUid: opp, days, status: "pending",
    names: { [uid]: myName, [opp]: oppName }, counts: { [uid]: 0, [opp]: 0 },
    createdAt: FieldValue.serverTimestamp(),
  });
  await notify(opp, uid, "challenge", `Most workouts in ${days} days. Open Arena > Friends to accept.`);
  return { id: ref.id };
});

export const challengeRespond = onCall(async req => {
  const uid = uidOf(req);
  const id = String(req.data?.id || "");
  const accept = req.data?.accept === true;
  const ref = db.doc(`challenges/${id}`);
  const out = await db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError("not-found", "Challenge not found.");
    const c = s.data()!;
    if (c.status !== "pending") throw new HttpsError("failed-precondition", "Already answered.");
    if (c.opponentUid === uid) {
      if (accept) {
        const now = Date.now();
        tx.update(ref, { status: "active", startAt: Timestamp.fromMillis(now), endAt: Timestamp.fromMillis(now + c.days * DAY) });
      } else tx.update(ref, { status: "declined" });
      return { creator: c.creatorUid as string, accepted: accept, days: c.days as number };
    }
    if (c.creatorUid === uid && !accept) { tx.update(ref, { status: "cancelled" }); return null; } // creator withdraws
    throw new HttpsError("permission-denied", "Not your challenge to answer.");
  });
  if (out) await notify(out.creator, uid, "challenge", out.accepted ? `Accepted. The ${out.days}-day challenge has started!` : "Declined your challenge.");
  return { ok: true };
});

/** Hourly: finish challenges whose deadline passed, pay XP, award trophies, notify both. */
export const challengeSweep = onSchedule("every 60 minutes", async () => {
  const due = await db.collection("challenges").where("status", "==", "active").where("endAt", "<=", Timestamp.now()).limit(50).get();
  for (const d of due.docs) {
    const result = await db.runTransaction(async tx => {
      const s = await tx.get(d.ref);
      const c = s.data();
      if (!c || c.status !== "active") return null;
      const [x, y] = c.members as string[];
      const px = await readProgress(tx, x), py = await readProgress(tx, y);
      const nx = Number(c.counts?.[x] || 0), ny = Number(c.counts?.[y] || 0);
      const winner = nx > ny ? x : ny > nx ? y : null;
      applyProgress(tx, x, px, { xp: winner === x ? WIN_XP : winner === null ? DRAW_XP : LOSE_XP, challengeWin: winner === x });
      applyProgress(tx, y, py, { xp: winner === y ? WIN_XP : winner === null ? DRAW_XP : LOSE_XP, challengeWin: winner === y });
      tx.update(d.ref, { status: "finished", winnerUid: winner, finishedAt: FieldValue.serverTimestamp() });
      return { x, y, nx, ny, winner };
    }).catch(() => null);
    if (!result) continue;
    const txt = (me: string, mine: number, theirs: number, w: string | null) =>
      w === null ? `Challenge ended in a draw (${mine}-${theirs}). +${DRAW_XP} XP` : w === me ? `You won ${mine}-${theirs}! +${WIN_XP} XP` : `You lost ${mine}-${theirs}. +${LOSE_XP} XP`;
    await notify(result.x, result.y, "challenge_result", txt(result.x, result.nx, result.ny, result.winner));
    await notify(result.y, result.x, "challenge_result", txt(result.y, result.ny, result.nx, result.winner));
  }
});
