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

  // likes this user left on reels (doc id = uid under reelLikes/{reelId}/users)
  const likeQ = db().collectionGroup("users").where("uid", "==", uid);
  for (;;) {
    const snap = await likeQ.limit(300).get();
    const likes = snap.docs.filter(d => d.ref.parent.parent?.parent.id === "reelLikes");
    if (!likes.length) break;
    await Promise.all(likes.map(d => d.ref.delete()));
    if (likes.length < snap.size) break; // only the profile doc is left in the results
  }
  // likes written before the uid field existed: look them up on the reels that still exist
  for (const col of ["publicReels", "followerReels"]) {
    let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    for (let page = 0; page < 20; page++) { // up to 6000 reels per collection
      let q = db().collection(col).orderBy("createdAt", "desc").limit(300);
      if (last) q = q.startAfter(last);
      const reels = await q.get();
      if (reels.empty) break;
      await Promise.all(reels.docs.map(d => db().doc(`reelLikes/${d.id}/users/${uid}`).delete().catch(() => {})));
      last = reels.docs[reels.docs.length - 1];
      if (reels.size < 300) break;
    }
  }

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
  // daily challenge board entries (boards are kept 14 days)
  for (let i = 0; i <= 16; i++) {
    const day = new Date(Date.now() + 5.5 * 3600_000 - i * 86_400_000).toISOString().slice(0, 10);
    await db().doc(`dailyBoard/${day}/entries/${uid}`).delete().catch(() => {});
  }
  await db().doc(`cheatFlags/${uid}`).delete().catch(() => {});
  await deleteWhere(db().collection("feedback").where("uid", "==", uid));
  { // invite code (the device record keeps only a hash and stays, so a deleted account cannot be re-invited on the same phone)
    const code = (await db().doc(`users/${uid}`).get()).data()?.inviteCode;
    if (code) await db().doc(`inviteCodes/${code}`).delete().catch(() => {});
  }
  await deleteWhere(db().collection("ghosts").where("ownerUid", "==", uid)); // recorded runs other players could race

  // inbox + profile (+ devices, backups, trophies, matches, blocks subcollections)
  await db().recursiveDelete(db().doc(`notifs/${uid}`));
  await db().recursiveDelete(db().doc(`pushState/${uid}`));
  await db().recursiveDelete(db().doc(`users/${uid}`));

  await getAuth().deleteUser(uid).catch(() => {});
  return { ok: true };
});
