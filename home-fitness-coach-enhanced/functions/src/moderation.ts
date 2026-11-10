/**
 * Block + report + moderation queue.
 *  - Blocking is a client write to users/{me}/blocks/{target}; this module removes follows both ways.
 *  - Reports go through a callable (rate-limited, de-duplicated). 3 distinct reports auto-hide a reel.
 *  - Moderators = emails listed in ADMIN_EMAILS (functions/.env, comma separated).
 */
import "./init";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { clearFlag, noteCheatReport } from "./anticheat";

const db = () => getFirestore();
const ADMINS = (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const AUTO_HIDE_AT = 3;
const TYPES = ["user", "reel", "comment", "message", "match", "post", "postComment"] as const;
const REMOVABLE = ["reel", "comment", "post", "postComment"];
const WHAT: Record<string, string> = { reel: "reel", comment: "comment", post: "post", postComment: "comment" };
const REASON_TEXT: Record<string, string> = { spam: "spam or scam", harassment: "harassment or bullying", nudity: "nudity or sexual content", violence: "violence or dangerous acts", hate: "hate speech", cheating: "cheating", other: "breaking the content policy" };

/** Tells a user, in the app, what a moderator did and why. Stays until they dismiss it. */
async function tellUser(uid: string, text: string) {
  if (!uid) return;
  await db().collection(`notifs/${uid}/items`).add({ from: "system", fromName: "Apex Pulse", type: "moderation", text: text.slice(0, 300), createdAt: FieldValue.serverTimestamp() }).catch(() => {});
}
const REASONS = ["spam", "harassment", "nudity", "violence", "hate", "cheating", "other"] as const;

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

  // a match report must come from someone who played it; the other player is read from the room, not trusted from the app
  let ownerUid = String(req.data?.ownerUid || "").slice(0, 128);
  if (type === "match") {
    const room = (await db().doc(`rooms/${targetId}`).get()).data();
    if (!room || (room.hostUid !== uid && room.guestUid !== uid)) throw new HttpsError("permission-denied", "You can only report a match you played.");
    ownerUid = String(room.hostUid === uid ? room.guestUid || "" : room.hostUid);
    if (!ownerUid) throw new HttpsError("failed-precondition", "There is no player to report in this match.");
  }
  const ref = db().doc(`reports/${id}`);
  if ((await ref.get()).exists) return { ok: true, duplicate: true };
  await ref.set({
    reporterUid: uid, type, targetId, reason,
    ownerUid,
    audience: req.data?.audience === "followers" ? "followers" : "public",
    details: String(req.data?.details || "").slice(0, 500),
    status: "open", at: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

export const onReportCreated = onDocumentCreated("reports/{id}", async e => {
  const r = e.data?.data();
  if (r && r.type === "match" && r.reason === "cheating" && r.ownerUid) await noteCheatReport(String(r.ownerUid), String(r.reporterUid));
  if (r && r.type === "post") { // 3 open reports hide a post until a moderator looks
    const n = (await db().collection("reports").where("type", "==", "post").where("targetId", "==", r.targetId).where("status", "==", "open").count().get()).data().count;
    if (n >= AUTO_HIDE_AT) await db().doc(`posts/${r.targetId}`).update({ hidden: true }).catch(() => {});
  }
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
    if (!REMOVABLE.includes(r.type)) throw new HttpsError("failed-precondition", "There is nothing to remove for this kind of report.");
    let owner = String(r.ownerUid || "");
    if (r.type === "reel") {
      const col = r.audience === "followers" ? "followerReels" : "publicReels";
      await db().recursiveDelete(db().doc(`${col}/${r.targetId}`));
    } else if (r.type === "comment") {
      const [reelId, cid] = String(r.targetId).split("/");
      if (reelId && cid) await db().doc(`reelComments/${reelId}/items/${cid}`).delete().catch(() => {});
    } else if (r.type === "post") {
      const pref = db().doc(`posts/${r.targetId}`);
      const post = (await pref.get()).data();
      if (post) {
        owner = owner || String(post.uid || "");
        if (post.storagePath) await getStorage().bucket().file(String(post.storagePath)).delete().catch(() => {});
        await db().recursiveDelete(pref);
      }
    } else if (r.type === "postComment") {
      const [postId, cid] = String(r.targetId).split("/");
      if (postId && cid) await db().doc(`posts/${postId}/comments/${cid}`).delete().catch(() => {});
    }
    await tellUser(owner, `Your ${WHAT[r.type]} was removed for ${REASON_TEXT[r.reason] ?? REASON_TEXT.other}. Repeated breaks of the content policy can get an account disabled.`);
    // other open reports about the same thing are closed with it
    const same = await db().collection("reports").where("type", "==", r.type).where("targetId", "==", r.targetId).where("status", "==", "open").limit(50).get();
    await Promise.all(same.docs.filter(d => d.id !== id).map(d => d.ref.update({ status: "actioned", action: "remove", resolvedAt: FieldValue.serverTimestamp(), resolvedBy: req.auth!.uid })));
  } else if (action === "ban") {
    const target = r.type === "user" ? r.targetId : r.ownerUid;
    if (!target) throw new HttpsError("failed-precondition", "No user to ban on this report.");
    await db().doc(`users/${target}`).set({ banned: true }, { merge: true });
    await getAuth().updateUser(target, { disabled: true }).catch(() => {});
    await tellUser(target, `Your account has been disabled for ${REASON_TEXT[r.reason] ?? REASON_TEXT.other}. If you think this is a mistake, contact support.`);
  } else if (action !== "dismiss") {
    throw new HttpsError("invalid-argument", "Unknown action.");
  }
  await ref.update({ status: action === "dismiss" ? "dismissed" : "actioned", action, resolvedAt: FieldValue.serverTimestamp(), resolvedBy: req.auth!.uid });
  return { ok: true };
});

/* ---- anti-cheat review (moderators only) ---- */
export const modListFlagged = onCall(async req => {
  needAdmin(req);
  const snap = await db().collection("cheatFlags").orderBy("lastAt", "desc").limit(100).get();
  const rows = snap.docs.map(d => d.data()).filter(x => x.flagged);
  const users = rows.length ? await db().getAll(...rows.map(x => db().doc(`users/${x.uid}`))) : [];
  return {
    accounts: rows.map((x, i) => {
      const u = users[i]?.data() ?? {};
      return {
        uid: String(x.uid), name: String(u.displayName || "Athlete"), banned: !!u.banned, rating: Number(u.rating ?? 1000),
        strikes: Number(x.strikes || 0), recentStrikes: Array.isArray(x.recent) ? x.recent.length : 0,
        reporters: Array.isArray(x.reporters) ? x.reporters.length : 0,
        reason: String(x.flagReason || ""), last: x.last ? `${x.last.kind}: ${x.last.detail}` : "", lastAt: Number(x.lastAt || 0),
      };
    }),
  };
});

export const modReviewFlag = onCall(async req => {
  needAdmin(req);
  const uid = String(req.data?.uid || "");
  const action = String(req.data?.action || "");
  if (!uid) throw new HttpsError("invalid-argument", "No account.");
  if (action === "ban") {
    await db().doc(`users/${uid}`).set({ banned: true }, { merge: true });
    await getAuth().updateUser(uid, { disabled: true }).catch(() => {});
    await db().doc(`cheatFlags/${uid}`).set({ flagged: false, reviewed: "banned", reviewedBy: req.auth!.uid, reviewedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else if (action === "clear") {
    await clearFlag(uid);
    await db().doc(`cheatFlags/${uid}`).set({ reviewed: "cleared", reviewedBy: req.auth!.uid, reviewedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else throw new HttpsError("invalid-argument", "Unknown action.");
  return { ok: true };
});
