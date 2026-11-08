/**
 * Pro subscription (Google Play Billing). The server is the only thing that decides who is Pro:
 * the app sends a purchase token, we ask Google Play whether it is valid, and store users/{uid}.proUntil.
 * Arena and everything social stay free; only the Pro features check this.
 */
import "./init";
import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleAuth } from "google-auth-library";

const db = getFirestore();
const PACKAGE = process.env.PLAY_PACKAGE || "com.homefitnesscoach.app";
/** Until you flip BILLING_ENABLED=true in functions/.env, everyone keeps full access (safe for testing and rollout). */
export const BILLING_ENFORCED = process.env.BILLING_ENABLED === "true";
const GRACE_MS = 3 * 86_400_000;

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/androidpublisher"] });
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

export async function isPro(uid: string): Promise<boolean> {
  if (!BILLING_ENFORCED) return true;
  const u = (await db.doc(`users/${uid}`).get()).data();
  return Number(u?.proUntil || 0) + GRACE_MS > Date.now();
}

export const getEntitlement = onCall(async req => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const u = (await db.doc(`users/${req.auth.uid}`).get()).data();
  const until = Number(u?.proUntil || 0);
  return { enforced: BILLING_ENFORCED, pro: !BILLING_ENFORCED || until + GRACE_MS > Date.now(), proUntil: until };
});

/** Client sends a Play purchase token after buying or restoring. We verify with Google and extend proUntil. */
export const verifyPurchase = onCall(async req => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = req.auth.uid;
  const token = String(req.data?.purchaseToken || "");
  if (token.length < 20 || token.length > 2000) throw new HttpsError("invalid-argument", "Bad purchase token.");

  // a token belongs to one account only (stops sharing one purchase across many accounts)
  const key = createHash("sha256").update(token).digest("hex");
  const tokRef = db.doc(`playTokens/${key}`);
  const owner = (await tokRef.get()).data()?.uid as string | undefined;
  if (owner && owner !== uid) throw new HttpsError("permission-denied", "This purchase is linked to another account.");

  const client = await auth.getClient();
  let sub: any;
  try {
    const r = await client.request({ url: `${API}/${PACKAGE}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}` });
    sub = r.data;
  } catch (e: any) {
    const code = e?.response?.status;
    if (code === 400 || code === 404 || code === 410) throw new HttpsError("not-found", "Google Play doesn't recognise this purchase.");
    throw new HttpsError("unavailable", "Couldn't reach Google Play. Try again in a minute.");
  }

  const line = Array.isArray(sub?.lineItems) ? sub.lineItems[0] : null;
  const expiry = line?.expiryTime ? Date.parse(line.expiryTime) : 0;
  const state = String(sub?.subscriptionState || "");
  const live = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"].includes(state) && expiry > Date.now();

  // Play refunds unacknowledged purchases after 3 days, so acknowledge here once verified
  if (live && sub?.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING" && line?.productId) {
    try {
      await client.request({ url: `${API}/${PACKAGE}/purchases/subscriptions/${line.productId}/tokens/${encodeURIComponent(token)}:acknowledge`, method: "POST", data: {} });
    } catch { /* retried on the next verify */ }
  }

  await tokRef.set({ uid, at: Date.now(), state, expiry }, { merge: true });
  await db.doc(`users/${uid}`).set({ proUntil: live ? expiry : Math.min(expiry, Date.now()), proState: state, proProduct: line?.productId ?? null }, { merge: true });
  return { pro: live, proUntil: live ? expiry : 0, state };
});
