/** Private reel media: files live in reels-private/ (no client read access) and are served by short-lived signed URLs. */
import "./init";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const db = () => getFirestore();
const URL_TTL_MS = 60 * 60 * 1000;

export const getReelUrl = onCall(async req => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const reelId = String(req.data?.reelId || "");
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(reelId)) throw new HttpsError("invalid-argument", "Bad reel.");

  const snap = await db().doc(`followerReels/${reelId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Reel not found.");
  const r = snap.data()!;
  if (r.hidden === true && r.ownerUid !== uid) throw new HttpsError("not-found", "Reel not available.");

  if (r.ownerUid !== uid) {
    const edge = await db().doc(`follows/${uid}_${r.ownerUid}`).get();
    if (!edge.exists || edge.data()!.status !== "accepted") throw new HttpsError("permission-denied", "Follow this account to watch.");
    const blocked = await db().doc(`users/${r.ownerUid}/blocks/${uid}`).get();
    if (blocked.exists) throw new HttpsError("permission-denied", "Not available.");
  }
  const path = String(r.mediaPath || "");
  if (!path.startsWith(`reels-private/${r.ownerUid}/`)) throw new HttpsError("failed-precondition", "No media file.");
  try {
    const [url] = await getStorage().bucket().file(path).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + URL_TTL_MS });
    return { url, expiresAt: Date.now() + URL_TTL_MS };
  } catch (e) {
    console.error("signed url failed", e);
    throw new HttpsError("internal", "Could not prepare the video. Ask the app owner to grant the Token Creator role (see BUGFIX_NOTES).");
  }
});
