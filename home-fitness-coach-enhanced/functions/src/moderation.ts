/**
 * Block + report + moderation queue.
 *  - Blocking is a client write to users/{me}/blocks/{target}; this module removes follows both ways.
 *  - Reports go through a callable (rate-limited, de-duplicated). 3 distinct reports auto-hide a reel.
 *  - Moderators = emails listed in ADMIN_EMAILS (functions/.env, comma separated).
 */
import "./init";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

const db = () => getFirestore();
const ADMINS = (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const AUTO_HIDE_AT = 3;
const TYPES = ["user", "reel", "comment", "message"] as const;
const REASONS = ["spam", "harassment", "nudity", "violence", "hate", "other"] as const;

function needAuth(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return req.auth.uid;
}
function isAdmin(req: CallableRequest) {
  const email = String(req.auth?.token?.email || "").toLowerCase();
  return !!email && req.auth?.token?.email_verified !== false && ADMINS.includes(email);
}
function needAdmin(req: CallableRequest) {
  needAuth(req);
  if (!isAdmin(req)) throw new HttpsError("permission-denied", "Moderators only.");
}

/* ---- blocks ---- */
export const onBlockCreated = onDocumentCreated("users/{me}/blocks/{target}", async e => {
  const { me, target } = e.params;
  await Promise.all([
    db().doc(`follows/${me}_${target}`).delete().catch(() => {}),
    db().doc(`follows/${target}_${me}`).delete().catch(() => {}),
  ]);
});

/* ---- reports ---- */
export const reportContent = onCall(async req => {
  const uid = needAuth(req);
  const type = String(req.data?.type || "");
  const targetId = String(req.data?.targetId || "").slice(0, 200);
  const reason = String(req.data?.reason || "other");
  if (!(TYPES as readonly string[]).includes(type) || !targetId) throw new HttpsError("invalid-argument", "Bad report.");
  if (!(REASONS as readonly string[]).includes(reason)) throw new HttpsError("invalid-argument", "Bad reason.");
  const id = `${uid}_${type}_${targetId}`.replace(/\//g, "-").slice(0, 400);

  // 20 reports / day / user
  const since = Timestamp.fromMillis(Date.now() - 86400_000);
  const recent = await db().collection("reports").where("reporterUid", "==", uid).where("at", ">", since).count().get();
  if (recent.data().count >= 20) throw new HttpsError("resource-exhausted", "Too many reports today.");

  const ref = db().doc(`reports/${id}`);
  if ((await ref.get()).exists) return { ok: true, duplicate: true };
  await ref.set({
    reporterUid: uid, type, targetId, reason,
    ownerUid: String(req.data?.ownerUid || "").slice(0, 128),
    audience: req.data?.audience === "followers" ? "followers" : "public",
    details: String(req.data?.details || "").slice(0, 500),
    status: "open", at: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

export const onReportCreated = onDocumentCreated("reports/{id}", async e => {
  const r = e.data?.data();
  if (!r || r.type !== "reel") return;
  const n = (await db().collection("reports").where("type", "==", "reel").where("targetId", "==", r.targetId).where("status", "==", "open").count().get()).data().count;
  if (n >= AUTO_HIDE_AT) {
    const col = r.audience === "followers" ? "followerReels" : "publicReels";
    await db().doc(`${col}/${r.targetId}`).update({ hidden: true }).catch(() => {});
  }
});

/* ---- moderator tools ---- */
export const modIsAdmin = onCall(async req => ({ admin: !!req.auth && isAdmin(req) }));

export const modListReports = onCall(async req => {
  needAdmin(req);
  const snap = await db().collection("reports").where("status", "==", "open").orderBy("at", "desc").limit(50).get();
  return {
    reports: snap.docs.map(d => {
      const x = d.data();
      return {
        id: d.id, type: x.type, targetId: x.targetId, reason: x.reason, details: x.details || "",
        ownerUid: x.ownerUid || "", audience: x.audience, reporterUid: x.reporterUid,
        at: x.at?.toMillis?.() ?? 0,
      };
    }),
  };
});

export const modResolveReport = onCall(async req => {
  needAdmin(req);
  const id = String(req.data?.id || "");
  const action = String(req.data?.action || "");
  const ref = db().doc(`reports/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Report not found.");
  const r = snap.data()!;

  if (action === "remove") {
    if (r.type === "reel") {
      const col = r.audience === "followers" ? "followerReels" : "publicReels";
      await db().recursiveDelete(db().doc(`${col}/${r.targetId}`));
    } else if (r.type === "comment") {
      const [reelId, cid] = String(r.targetId).split("/");
      if (reelId && cid) await db().doc(`reelComments/${reelId}/items/${cid}`).delete().catch(() => {});
    }
  } else if (action === "ban") {
    const target = r.type === "user" ? r.targetId : r.ownerUid;
    if (!target) throw new HttpsError("failed-precondition", "No user to ban on this report.");
    await db().doc(`users/${target}`).set({ banned: true }, { merge: true });
    await getAuth().updateUser(target, { disabled: true }).catch(() => {});
  } else if (action !== "dismiss") {
    throw new HttpsError("invalid-argument", "Unknown action.");
  }
  await ref.update({ status: action === "dismiss" ? "dismissed" : "actioned", action, resolvedAt: FieldValue.serverTimestamp(), resolvedBy: req.auth!.uid });
  return { ok: true };
});
