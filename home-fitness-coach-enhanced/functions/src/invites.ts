/**
 * Invite a friend. Everything here is server-side; the app only shows the code and sends the code a friend typed.
 *  inviteInfo     your personal code (created the first time) and how many friends joined
 *  inviteRedeem   a new account enters a friend's code (before its first workout)
 *  registerDevice notes which accounts have used this device (a hash only), for the same-device rule
 * The reward is paid inside recordWorkout (index.ts) when the invited account finishes its first workout:
 * both sides get a streak freeze if they have room for one, otherwise just the badge. One reward per invited
 * account, none when the invited person's device has ever been used by another account.
 */
import "./init";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { MAX_REWARDED_INVITES, canRedeem, cleanCode, decideReward, deviceHash, grantFreeze, makeInviteCode } from "./inviteCore";

const db = getFirestore();
function uidOf(req: { auth?: { uid: string } | undefined }) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return req.auth.uid;
}
const BADGE = {
  inviter: { id: "invite_friend", title: "Recruiter", desc: "A friend you invited finished a first workout", tier: "silver", icon: "medal" },
  invited: { id: "invited_by_friend", title: "Brought by a Friend", desc: "Joined with a friend's invite and finished a first workout", tier: "bronze", icon: "medal" },
} as const;

async function noteDevice(uid: string, raw: unknown): Promise<string> {
  const h = deviceHash(raw);
  if (h) await db.doc(`devices/${h}`).set({ uids: FieldValue.arrayUnion(uid), lastAt: Date.now() }, { merge: true });
  return h;
}

/** Called once after sign-in so the same-device rule knows about every account on this phone. */
export const registerDevice = onCall(async req => {
  const uid = uidOf(req);
  return { ok: !!(await noteDevice(uid, req.data?.deviceId)) };
});

export const inviteInfo = onCall(async req => {
  const uid = uidOf(req);
  await noteDevice(uid, req.data?.deviceId);
  const uref = db.doc(`users/${uid}`);
  const code = await db.runTransaction(async tx => {
    const u = (await tx.get(uref)).data() ?? {};
    if (u.inviteCode) return String(u.inviteCode);
    for (let i = 0; i < 8; i++) {
      const c = makeInviteCode();
      const cref = db.doc(`inviteCodes/${c}`);
      if ((await tx.get(cref)).exists) continue;
      tx.set(cref, { uid, at: Date.now() });
      tx.set(uref, { inviteCode: c }, { merge: true });
      return c;
    }
    throw new HttpsError("internal", "Couldn't make a code. Try again.");
  });
  const u = (await uref.get()).data() ?? {};
  return {
    code, joined: Number(u.inviteJoined || 0), rewarded: Number(u.inviteRewarded || 0), maxRewarded: MAX_REWARDED_INVITES,
    invitedBy: !!u.invitedBy, canEnterCode: !u.invitedBy && Number(u.totalWorkouts || 0) === 0,
  };
});

const NO: Record<string, string> = {
  "bad-code": "That code doesn't exist. Check it and try again.",
  "own-code": "That's your own code. Share it with a friend.",
  already: "You've already used an invite code.",
  "has-workout": "Invite codes are for new accounts, before the first workout.",
  "too-old": "Invite codes can only be used in an account's first 14 days.",
  "no-device": "Update the app to use an invite code.",
};

export const inviteRedeem = onCall(async req => {
  const uid = uidOf(req);
  const code = cleanCode(req.data?.code);
  const device = await noteDevice(uid, req.data?.deviceId);
  return db.runTransaction(async tx => {
    const uref = db.doc(`users/${uid}`);
    const [uSnap, cSnap] = await Promise.all([tx.get(uref), code ? tx.get(db.doc(`inviteCodes/${code}`)) : Promise.resolve(null)]);
    const u = uSnap.data() ?? {};
    const inviterUid = cSnap?.exists ? String(cSnap.data()!.uid) : null;
    const created = Number(u.createdAt?.toMillis?.() ?? u.createdAt ?? 0) || 0;
    const no = canRedeem({
      code, inviterUid, uid, invitedBy: u.invitedBy, totalWorkouts: Number(u.totalWorkouts || 0),
      accountAgeDays: created ? (Date.now() - created) / 86_400_000 : 0, device,
    });
    if (no) throw new HttpsError("failed-precondition", NO[no]);
    tx.set(uref, { invitedBy: inviterUid, invitedAt: Date.now(), inviteDevice: device }, { merge: true });
    tx.set(db.doc(`users/${inviterUid}`), { inviteJoined: FieldValue.increment(1) }, { merge: true });
    return { ok: true };
  });
});

export interface InviteCtx { inviterUid: string; inviter: FirebaseFirestore.DocumentSnapshot; deviceUids: string[] | null }

/** Reads for the invite reward. Call inside recordWorkout BEFORE any write, only for a first workout. */
export async function readInvite(tx: FirebaseFirestore.Transaction, user: Record<string, any>): Promise<InviteCtx | null> {
  if (!user.invitedBy || user.inviteDone) return null;
  const inviterUid = String(user.invitedBy);
  const [inviter, dev] = await Promise.all([
    tx.get(db.doc(`users/${inviterUid}`)),
    user.inviteDevice ? tx.get(db.doc(`devices/${user.inviteDevice}`)) : Promise.resolve(null),
  ]);
  return { inviterUid, inviter, deviceUids: dev?.exists ? ((dev.data()!.uids as string[]) ?? []) : null };
}

/**
 * Pays the reward (or records why not). Returns the invited user's new freeze count and what to tell them.
 * The caller writes `extra` onto the invited user's document in the same transaction.
 */
export function applyInvite(tx: FirebaseFirestore.Transaction, uid: string, ctx: InviteCtx, myFreezes: number) {
  const inv = ctx.inviter.data() ?? {};
  const d = decideReward({
    uid, inviterUid: ctx.inviterUid, deviceUids: ctx.deviceUids, inviterExists: ctx.inviter.exists,
    inviterBanned: !!inv.banned, inviterRewarded: Number(inv.inviteRewarded || 0),
  });
  if (!d.ok) return { freezes: myFreezes, extra: { inviteDone: d.reason }, reward: null };
  const mine = grantFreeze(myFreezes);
  tx.set(db.doc(`users/${uid}/trophies/${BADGE.invited.id}`), { ...BADGE.invited, at: FieldValue.serverTimestamp() }, { merge: true });
  if (d.inviterPaid) {
    const theirs = grantFreeze(inv.freezes === undefined ? 1 : Number(inv.freezes));
    tx.set(db.doc(`users/${ctx.inviterUid}`), { freezes: theirs.freezes, inviteRewarded: FieldValue.increment(1) }, { merge: true });
    tx.set(db.doc(`users/${ctx.inviterUid}/trophies/${BADGE.inviter.id}`), { ...BADGE.inviter, at: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(db.doc(`users/${ctx.inviterUid}/invites/${uid}`), { at: Date.now(), freeze: theirs.gotFreeze });
  }
  return { freezes: mine.freezes, extra: { inviteDone: "rewarded" }, reward: { freeze: mine.gotFreeze, badge: BADGE.invited.title } };
}
