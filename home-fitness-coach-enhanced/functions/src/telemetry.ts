/** Client error reports (a lightweight crash log you can read in the Firebase console). */
import "./init";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const lastByKey = new Map<string, number>();

export const logClientError = onCall(async req => {
  const uid = req.auth?.uid || "anon";
  const key = `${uid}:${req.rawRequest.ip || ""}`;
  const now = Date.now();
  if (now - (lastByKey.get(key) || 0) < 3000) return { ok: false }; // 1 report / 3 s per user
  lastByKey.set(key, now);
  if (lastByKey.size > 5000) lastByKey.clear();
  const d = req.data || {};
  await getFirestore().collection("clientErrors").add({
    uid,
    message: String(d.message || "").slice(0, 500),
    stack: String(d.stack || "").slice(0, 3000),
    where: String(d.where || "").slice(0, 100),
    version: String(d.version || "").slice(0, 30),
    platform: String(d.platform || "").slice(0, 30),
    at: Timestamp.now(),
    // enable a Firestore TTL policy on clientErrors.expireAt to auto-delete after 30 days
    expireAt: Timestamp.fromMillis(now + 30 * 86400_000),
  });
  return { ok: true };
});

/** Private feedback from the rating prompt. Stored in `feedback` (server-only); 5 a day per user. */
export const sendFeedback = onCall(async req => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const text = String(req.data?.text || "").trim().slice(0, 1000);
  if (text.length < 5) throw new HttpsError("invalid-argument", "Write a little more.");
  const db = getFirestore();
  const since = Date.now() - 86_400_000;
  // if the index is still building, let the feedback through instead of failing
  const recent = await db.collection("feedback").where("uid", "==", uid).where("at", ">", since).count().get().then(s => s.data().count).catch(() => 0);
  if (recent >= 5) throw new HttpsError("resource-exhausted", "Thanks. That is enough feedback for today.");
  await db.collection("feedback").add({
    uid, text, at: Date.now(), moment: String(req.data?.moment || "").slice(0, 20), lang: String(req.data?.lang || "").slice(0, 5),
    version: String(req.data?.version || "").slice(0, 30),
  });
  return { ok: true };
});
