/** Crews: small groups (max 20) with a shared weekly workout goal and a group chat. */
import "./init";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { push } from "./notifyLib";

const db = getFirestore();
const MAX_MEMBERS = 20;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

function uidOf(req: { auth?: { uid: string } | undefined }) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return req.auth.uid;
}
const cleanName = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 30);

async function profileOf(uid: string) {
  const u = (await db.doc(`users/${uid}`).get()).data() ?? {};
  return { name: String(u.displayName || "Athlete"), avatar: (u.avatarUrl as string) ?? null, crewId: (u.crewId as string) || "" };
}

export const crewCreate = onCall(async req => {
  const uid = uidOf(req);
  const name = cleanName(req.data?.name);
  if (name.length < 3) throw new HttpsError("invalid-argument", "Crew name needs at least 3 characters.");
  const me = await profileOf(uid);
  if (me.crewId) throw new HttpsError("failed-precondition", "Leave your current crew first.");
  const ref = db.collection("crews").doc();
  const batch = db.batch();
  batch.set(ref, { name, ownerUid: uid, memberCount: 1, weeklyGoal: 15, weekId: "", weekWorkouts: 0, inviteCode: makeCode(), createdAt: FieldValue.serverTimestamp() });
  batch.set(ref.collection("members").doc(uid), { uid, name: me.name, avatar: me.avatar, role: "owner", joinedAt: FieldValue.serverTimestamp(), weekWorkouts: 0, weekId: "" });
  batch.set(db.doc(`users/${uid}`), { crewId: ref.id }, { merge: true });
  await batch.commit();
  return { id: ref.id };
});

export const crewJoin = onCall(async req => {
  const uid = uidOf(req);
  const code = String(req.data?.code || "").trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) throw new HttpsError("invalid-argument", "That invite code isn't valid.");
  const me = await profileOf(uid);
  if (me.crewId) throw new HttpsError("failed-precondition", "Leave your current crew first.");
  const found = await db.collection("crews").where("inviteCode", "==", code).limit(1).get();
  if (found.empty) throw new HttpsError("not-found", "No crew with that code.");
  const cref = found.docs[0].ref;
  await db.runTransaction(async tx => {
    const c = await tx.get(cref);
    if (Number(c.data()?.memberCount || 0) >= MAX_MEMBERS) throw new HttpsError("resource-exhausted", "This crew is full.");
    const blocked = await tx.get(db.doc(`users/${c.data()!.ownerUid}/blocks/${uid}`));
    if (blocked.exists) throw new HttpsError("permission-denied", "You can't join this crew.");
    tx.update(cref, { memberCount: FieldValue.increment(1) });
    tx.set(cref.collection("members").doc(uid), { uid, name: me.name, avatar: me.avatar, role: "member", joinedAt: FieldValue.serverTimestamp(), weekWorkouts: 0, weekId: "" });
    tx.set(db.doc(`users/${uid}`), { crewId: cref.id }, { merge: true });
  });
  return { id: cref.id };
});

async function removeMember(crewId: string, uid: string) {
  const cref = db.doc(`crews/${crewId}`);
  await db.runTransaction(async tx => {
    const c = await tx.get(cref);
    if (!c.exists) { tx.set(db.doc(`users/${uid}`), { crewId: FieldValue.delete() }, { merge: true }); return; }
    const members = await tx.get(cref.collection("members").orderBy("joinedAt", "asc").limit(MAX_MEMBERS));
    const rest = members.docs.filter(m => m.id !== uid);
    tx.delete(cref.collection("members").doc(uid));
    tx.set(db.doc(`users/${uid}`), { crewId: FieldValue.delete() }, { merge: true });
    if (rest.length === 0) return; // deleted after the transaction
    const update: Record<string, unknown> = { memberCount: rest.length };
    if (c.data()!.ownerUid === uid) { update.ownerUid = rest[0].id; tx.update(rest[0].ref, { role: "owner" }); }
    tx.update(cref, update);
  });
  const left = await db.collection(`crews/${crewId}/members`).limit(1).get();
  if (left.empty) await db.recursiveDelete(cref);
}

export const crewLeave = onCall(async req => {
  const uid = uidOf(req);
  const { crewId } = await profileOf(uid);
  if (!crewId) return { ok: true };
  await removeMember(crewId, uid);
  return { ok: true };
});

export const crewKick = onCall(async req => {
  const uid = uidOf(req);
  const target = String(req.data?.uid || "");
  const { crewId } = await profileOf(uid);
  const c = crewId ? (await db.doc(`crews/${crewId}`).get()).data() : null;
  if (!c || c.ownerUid !== uid) throw new HttpsError("permission-denied", "Only the crew owner can remove members.");
  if (target === uid) throw new HttpsError("invalid-argument", "Use Leave instead.");
  const t = await profileOf(target);
  if (t.crewId !== crewId) throw new HttpsError("not-found", "Not in your crew.");
  await removeMember(crewId, target);
  return { ok: true };
});

export const crewSetGoal = onCall(async req => {
  const uid = uidOf(req);
  const goal = Math.max(1, Math.min(200, Math.round(Number(req.data?.goal) || 0)));
  const { crewId } = await profileOf(uid);
  const ref = db.doc(`crews/${crewId || "none"}`);
  const c = crewId ? (await ref.get()).data() : null;
  if (!c || c.ownerUid !== uid) throw new HttpsError("permission-denied", "Only the crew owner can change the goal.");
  await ref.update({ weeklyGoal: goal });
  return { ok: true };
});

/** Push to the other members when someone posts in the crew chat (respects each member's "groups" setting). */
export const onCrewMessage = onDocumentCreated("crews/{crewId}/messages/{mid}", async e => {
  const m = e.data?.data();
  if (!m) return;
  const crew = (await db.doc(`crews/${e.params.crewId}`).get()).data();
  const members = await db.collection(`crews/${e.params.crewId}/members`).limit(MAX_MEMBERS).get();
  await Promise.all(members.docs.filter(d => d.id !== m.from).map(d =>
    push(d.id, "groups", String(crew?.name || "Crew"), `${m.name || "Someone"}: ${String(m.text || "")}`, { type: "crew", crewId: e.params.crewId }).catch(() => {}),
  ));
});
