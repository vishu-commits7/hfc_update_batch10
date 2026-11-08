/**
 * Server-owned counters. Clients never write these numbers.
 * Every trigger RE-COUNTS (aggregation query) instead of incrementing, so the numbers self-heal
 * and can never drift, even if a trigger is retried.
 */
import "./init";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const db = () => getFirestore();

async function recountFollows(uid: string) {
  const [a, b] = await Promise.all([
    db().collection("follows").where("followeeUid", "==", uid).where("status", "==", "accepted").count().get(),
    db().collection("follows").where("followerUid", "==", uid).where("status", "==", "accepted").count().get(),
  ]);
  const ref = db().doc(`users/${uid}`);
  if ((await ref.get()).exists) await ref.update({ followerCount: a.data().count, followingCount: b.data().count });
}

export const onFollowChanged = onDocumentWritten("follows/{id}", async e => {
  const before = e.data?.before.data();
  const after = e.data?.after.data();
  const uids = new Set<string>();
  for (const f of [before, after]) if (f) { uids.add(f.followerUid); uids.add(f.followeeUid); }
  if (before?.status === after?.status && before && after) return; // nothing relevant changed
  await Promise.all([...uids].map(recountFollows));
});

/** The reel lives in publicReels or followerReels; update whichever exists. */
async function reelRef(reelId: string) {
  for (const col of ["publicReels", "followerReels"]) {
    const r = db().doc(`${col}/${reelId}`);
    if ((await r.get()).exists) return r;
  }
  return null;
}

export const onReelLikeWritten = onDocumentWritten("reelLikes/{reelId}/users/{uid}", async e => {
  const ref = await reelRef(e.params.reelId);
  if (!ref) return;
  const n = (await db().collection(`reelLikes/${e.params.reelId}/users`).count().get()).data().count;
  await ref.update({ likeCount: n });
});

export const onReelCommentWritten = onDocumentWritten("reelComments/{reelId}/items/{id}", async e => {
  const ref = await reelRef(e.params.reelId);
  if (!ref) return;
  const n = (await db().collection(`reelComments/${e.params.reelId}/items`).count().get()).data().count;
  await ref.update({ commentCount: n });
});

/** One view per user per reel. Counted by the server so it cannot be inflated by repeat calls. */
export const recordReelView = onCall(async req => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const reelId = String(req.data?.reelId || "");
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(reelId)) throw new HttpsError("invalid-argument", "Bad reel.");
  const seen = db().doc(`reelViews/${reelId}/users/${uid}`);
  const created = await db().runTransaction(async tx => {
    if ((await tx.get(seen)).exists) return false;
    tx.set(seen, { at: FieldValue.serverTimestamp() });
    return true;
  });
  if (!created) return { counted: false };
  const ref = await reelRef(reelId);
  if (ref) await ref.update({ views: FieldValue.increment(1) });
  return { counted: true };
});

/** Self-heal for old accounts created before counters existed. Recounts the caller only. */
export const recountMine = onCall(async req => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  await recountFollows(uid);
  return { ok: true };
});
