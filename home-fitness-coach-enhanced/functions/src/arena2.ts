/** Arena extras: rematch and quick-match queue. (Elo rating is applied in finalize in index.ts.) */
import "./init";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const db = getFirestore();
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

function auth(req: { auth?: { uid: string } | undefined }): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return req.auth.uid;
}

async function freeCode(tx: FirebaseFirestore.Transaction): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const c = makeCode();
    if (!(await tx.get(db.doc(`rooms/${c}`))).exists) return c;
  }
  throw new HttpsError("internal", "Couldn't create a room. Try again.");
}

const baseRoom = (host: { uid: string; name: string; avatar: string | null }) => ({
  hostUid: host.uid, hostName: host.name, hostAvatar: host.avatar,
  guestUid: null, guestName: null, guestAvatar: null,
  createdAt: FieldValue.serverTimestamp(), startedAt: null,
  hostReps: 0, guestReps: 0, hostDone: false, guestDone: false,
});

/**
 * Rematch. The first player to tap creates a private room with the same settings; the other player
 * gets the same code back and joins it. Returns { code, host } where host=true means you created it.
 */
export const arenaRematch = onCall(async req => {
  const uid = auth(req);
  const old = String(req.data?.code || "").toUpperCase();
  if (!/^[A-Z2-9]{4,8}$/.test(old)) throw new HttpsError("invalid-argument", "Bad room code.");
  return db.runTransaction(async tx => {
    const oref = db.doc(`rooms/${old}`);
    const s = await tx.get(oref);
    if (!s.exists) throw new HttpsError("not-found", "Match not found.");
    const r = s.data()!;
    if (r.hostUid !== uid && r.guestUid !== uid) throw new HttpsError("permission-denied", "You weren't in this match.");
    if (r.status !== "finished" || !r.guestUid) throw new HttpsError("failed-precondition", "Finish the match first.");
    if (r.rematchCode) return { code: r.rematchCode as string, host: r.rematchBy === uid };
    const me = r.hostUid === uid ? { uid, name: r.hostName, avatar: r.hostAvatar ?? null } : { uid, name: r.guestName, avatar: r.guestAvatar ?? null };
    const code = await freeCode(tx);
    tx.set(db.doc(`rooms/${code}`), {
      ...baseRoom(me), exercise: r.exercise, plan: r.plan ?? null, mode: r.mode, target: r.target,
      status: "waiting", visibility: "private", rematchOf: old,
    });
    tx.update(oref, { rematchCode: code, rematchBy: uid });
    return { code, host: true };
  });
});

/** Quick match: pairs you with the oldest waiting player who picked the same exercise and reps. */
export const arenaQuickMatch = onCall(async req => {
  const uid = auth(req);
  const exerciseId = String(req.data?.exerciseId || "").slice(0, 40);
  const name = String(req.data?.name || "").slice(0, 60);
  const reps = Math.max(5, Math.min(100, Math.round(Number(req.data?.reps) || 20)));
  if (!exerciseId || !name) throw new HttpsError("invalid-argument", "Pick an exercise.");
  const key = `${exerciseId}_${reps}`;

  return db.runTransaction(async tx => {
    const mine = db.doc(`matchQueue/${uid}`);
    const myUser = await tx.get(db.doc(`users/${uid}`));
    const mineSnap = await tx.get(mine);
    const candidates = await tx.get(db.collection("matchQueue").where("key", "==", key).where("status", "==", "waiting").orderBy("at", "asc").limit(6));
    const me = { uid, name: String(myUser.data()?.displayName || "Athlete"), avatar: (myUser.data()?.avatarUrl as string) ?? null };
    const other = candidates.docs.find(d => d.id !== uid);
    // block checks (either direction)
    let blocked = false;
    if (other) {
      const [a, b] = await Promise.all([tx.get(db.doc(`users/${uid}/blocks/${other.id}`)), tx.get(db.doc(`users/${other.id}/blocks/${uid}`))]);
      blocked = a.exists || b.exists;
    }
    if (other && !blocked) {
      const o = other.data();
      const code = await freeCode(tx);
      tx.set(db.doc(`rooms/${code}`), {
        ...baseRoom({ uid: other.id, name: o.name, avatar: o.avatar ?? null }),
        guestUid: uid, guestName: me.name, guestAvatar: me.avatar,
        exercise: name, plan: [{ id: exerciseId, name, reps }], mode: "reps", target: reps,
        status: "ready", visibility: "private", quick: true,
      });
      tx.update(other.ref, { status: "matched", code });
      if (mineSnap.exists) tx.delete(mine);
      return { status: "matched", code };
    }
    tx.set(mine, { uid, key, exerciseId, exercise: name, reps, name: me.name, avatar: me.avatar, status: "waiting", at: FieldValue.serverTimestamp() });
    return { status: "waiting" };
  });
});

export const arenaQuickCancel = onCall(async req => {
  const uid = auth(req);
  await db.doc(`matchQueue/${uid}`).delete().catch(() => {});
  return { ok: true };
});
