/** Account deletion: removes everything a user owns, then the sign-in itself. */
import "./init";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const db = () => getFirestore();

async function deleteWhere(q: FirebaseFirestore.Query) {
  for (;;) {
    const snap = await q.limit(200).get();
    if (snap.empty) return;
    await Promise.all(snap.docs.map(d => db().recursiveDelete(d.ref)));
  }
}

export const deleteAccount = onCall({ timeoutSeconds: 300 }, async req => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  if (req.data?.confirm !== "DELETE") throw new HttpsError("failed-precondition", "Type DELETE to confirm.");

  // reels (docs + chunks; the delete trigger also removes the media file)
  await deleteWhere(db().collection("publicReels").where("ownerUid", "==", uid));
  await deleteWhere(db().collection("followerReels").where("ownerUid", "==", uid));
  await getStorage().bucket().deleteFiles({ prefix: `reels/${uid}/` }).catch(() => {});
  await getStorage().bucket().deleteFiles({ prefix: `reels-private/${uid}/` }).catch(() => {});

  // social graph
  await deleteWhere(db().collection("follows").where("followerUid", "==", uid));
  await deleteWhere(db().collection("follows").where("followeeUid", "==", uid));

  // chats (both sides lose the thread) and their messages
  await deleteWhere(db().collection("chats").where("members", "array-contains", uid));

  // posts, comments, rooms
  await deleteWhere(db().collection("posts").where("uid", "==", uid));
  await deleteWhere(db().collectionGroup("items").where("uid", "==", uid));      // reel comments
  await deleteWhere(db().collectionGroup("comments").where("uid", "==", uid));   // post comments
  await deleteWhere(db().collection("rooms").where("hostUid", "==", uid));
  await deleteWhere(db().collection("rooms").where("guestUid", "==", uid));

  // inbox + profile (+ devices, backups, trophies, matches, blocks subcollections)
  await db().recursiveDelete(db().doc(`notifs/${uid}`));
  await db().recursiveDelete(db().doc(`users/${uid}`));

  await getAuth().deleteUser(uid).catch(() => {});
  return { ok: true };
});
