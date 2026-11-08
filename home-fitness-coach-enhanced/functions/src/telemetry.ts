/** Client error reports (a lightweight crash log you can read in the Firebase console). */
import "./init";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";

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
