/**
 * Apex Pulse backend (Cloud Functions, v2).
 *
 *  - Arena referee (callables): the server starts matches, validates rep counts,
 *    decides winners and updates win stats. Clients can no longer write results.
 *  - Notifications: Firestore triggers create inbox items and send FCM push.
 *  - Follow decisions: public accounts auto-accept; switching to public accepts
 *    waiting requests.
 *  - Housekeeping: stale arena rooms are closed; deleted reels lose their media.
 */
import "./init";
import { getFirestore, FieldValue, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

const db = getFirestore();

// feature modules (each imports ./init first)
export * from "./counters";
export * from "./account";
export * from "./moderation";
export * from "./media";
export * from "./telemetry";
export * from "./leagues";
export * from "./arena2";
export * from "./challenges";
export * from "./crews";
export * from "./reels";
export * from "./plan";
export * from "./billing";
import { ensureQuests, type QuestDoc } from "./quests";
import { dayKeyIST, weekIdIST } from "./timeutil";

import { nameOf, push, notify } from "./notifyLib";
import { RANKS, levelOf, rankIdxOf, readProgress, applyProgress, dayNum } from "./progression";

/* ---- chats ---- */
export const onMessageCreated = onDocumentCreated("chats/{chatId}/messages/{mid}", async event => {
  const msg = event.data?.data();
  if (!msg) return;
  const chat = await db.doc(`chats/${event.params.chatId}`).get();
  const members: string[] = chat.data()?.members ?? [];
  const to = members.find(m => m !== msg.from);
  if (!to) return;
  await push(to, "chats", await nameOf(msg.from), String(msg.text || "New message"), { type: "chat", from: msg.from });
});

/* ---- follows ---- */
export const onFollowCreated = onDocumentCreated("follows/{id}", async event => {
  const f = event.data?.data();
  if (!f) return;
  const target = await db.doc(`users/${f.followeeUid}`).get();
  if (target.data()?.accountPublic === true && f.status === "pending") {
    await event.data!.ref.update({ status: "accepted", auto: true });
    await notify(f.followeeUid, f.followerUid, "follow", "is now following you");
  } else {
    await notify(f.followeeUid, f.followerUid, "follow_request", "Open the bell to accept or decline");
  }
});

export const onFollowUpdated = onDocumentUpdated("follows/{id}", async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.status === "pending" && after.status === "accepted" && !after.auto) {
    await notify(after.followerUid, after.followeeUid, "follow_accepted", "You can now message each other");
  }
});

export const onUserUpdated = onDocumentUpdated("users/{uid}", async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.accountPublic !== true && after.accountPublic === true) {
    const pending = await db.collection("follows").where("followeeUid", "==", event.params.uid).where("status", "==", "pending").get();
    await Promise.all(pending.docs.map(d => d.ref.update({ status: "accepted", auto: true })));
  }
});

/* ---- reels & posts ---- */
async function reelOwner(reelId: string): Promise<string | null> {
  for (const col of ["publicReels", "followerReels"]) {
    const s = await db.doc(`${col}/${reelId}`).get();
    if (s.exists) return s.data()!.ownerUid as string;
  }
  return null;
}

export const onReelLiked = onDocumentCreated("reelLikes/{reelId}/users/{uid}", async event => {
  const owner = await reelOwner(event.params.reelId);
  if (owner) await notify(owner, event.params.uid, "like", "liked your reel");
});

export const onReelCommented = onDocumentCreated("reelComments/{reelId}/items/{id}", async event => {
  const c = event.data?.data();
  const owner = await reelOwner(event.params.reelId);
  if (owner && c) await notify(owner, c.uid, "comment", String(c.text || ""));
});

export const onPostCommented = onDocumentCreated("posts/{postId}/comments/{id}", async event => {
  const c = event.data?.data();
  const post = await db.doc(`posts/${event.params.postId}`).get();
  if (post.exists && c) await notify(post.data()!.uid, c.uid, "comment", String(c.text || ""));
});

export const onPostLiked = onDocumentUpdated("posts/{postId}", async event => {
  const before: string[] = event.data?.before.data()?.likedBy ?? [];
  const after = event.data?.after.data();
  if (!after) return;
  const added = (after.likedBy as string[] | undefined ?? []).filter(u => !before.includes(u));
  await Promise.all(added.slice(0, 5).map(u => notify(after.uid, u, "like", "liked your post")));
});

async function fanOutNewReel(ownerUid: string, caption: string) {
  const followers = await db.collection("follows").where("followeeUid", "==", ownerUid).where("status", "==", "accepted").limit(200).get();
  await Promise.all(followers.docs.map(d => notify(d.data().followerUid, ownerUid, "new_reel", caption || "Watch it now")));
}
export const onPublicReelCreated = onDocumentCreated("publicReels/{id}", async e => {
  const r = e.data?.data(); if (r) await fanOutNewReel(r.ownerUid, r.caption);
});
export const onFollowerReelCreated = onDocumentCreated("followerReels/{id}", async e => {
  const r = e.data?.data(); if (r) await fanOutNewReel(r.ownerUid, r.caption);
});

async function cleanupReel(ref: DocumentReference, data: Record<string, any> | undefined) {
  await db.recursiveDelete(ref.collection("chunks")).catch(() => {});
  if (data?.mediaPath) await getStorage().bucket().file(String(data.mediaPath)).delete({ ignoreNotFound: true }).catch(() => {});
}
export const onPublicReelDeleted = onDocumentDeleted("publicReels/{id}", e => cleanupReel(e.data!.ref, e.data?.data()));
export const onFollowerReelDeleted = onDocumentDeleted("followerReels/{id}", e => cleanupReel(e.data!.ref, e.data?.data()));

/* ------------------------------------------------------------------ */
/* arena referee                                                       */
/* ------------------------------------------------------------------ */

const MAX_TAPS_PER_SEC = 5;
const GRACE_MS = 12_000;

interface Room {
  hostUid: string; guestUid: string | null; status: string; mode: "time" | "reps"; target: number;
  startedAt?: Timestamp | null; hostReps: number; guestReps: number; hostDone: boolean; guestDone: boolean;
  hostDoneAt?: number; guestDoneAt?: number; statsApplied?: boolean;
}

function needAuth(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return req.auth.uid;
}
function code(req: CallableRequest): string {
  const c = String(req.data?.code || "").trim().toUpperCase();
  if (!/^[A-Z2-9]{4,8}$/.test(c)) throw new HttpsError("invalid-argument", "Bad room code.");
  return c;
}
function roleOf(r: Room, uid: string): "host" | "guest" {
  if (r.hostUid === uid) return "host";
  if (r.guestUid === uid) return "guest";
  throw new HttpsError("permission-denied", "You are not in this room.");
}

/** Called by the app after a workout is completed. Server owns xp, level, streak and trophies. */
export const recordWorkout = onCall(async req => {
  const uid = needAuth(req);
  const workoutId = String(req.data?.workoutId || "").slice(0, 80);
  const minutes = Math.max(1, Math.min(240, Math.round(Number(req.data?.minutes) || 0)));
  const calories = Math.max(0, Math.min(3000, Math.round(Number(req.data?.calories) || 0)));
  const dayKey = String(req.data?.dayKey || "");
  if (!workoutId || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new HttpsError("invalid-argument", "Bad workout data.");
  if (Math.abs(dayNum(dayKey) - Math.floor(Date.now() / 86_400_000)) > 1) throw new HttpsError("invalid-argument", "Bad date.");

  return db.runTransaction(async tx => {
    const p = await readProgress(tx, uid);
    if (p.user.lastWorkoutId === workoutId) return { duplicate: true, xpGained: 0, levelUp: false, rankUp: false, newTrophies: [], questsCompleted: [], level: levelOf(Number(p.user.xp || 0)), xp: Number(p.user.xp || 0), rank: RANKS[rankIdxOf(Number(p.user.xp || 0))].name };
    const lastAt = Number(p.user.lastWorkoutAt || 0);
    if (Date.now() - lastAt < 60_000) throw new HttpsError("resource-exhausted", "Slow down a little.");
    const last: string | undefined = p.user.lastWorkoutDay;
    let streak = Number(p.user.streakDays || 0);
    let freezes = p.user.freezes === undefined ? 1 : Number(p.user.freezes); // everyone starts with one streak freeze
    let freezeUsed = false, freezeEarned = false;
    if (!last) streak = 1;
    else if (last === dayKey) streak = Math.max(1, streak);
    else {
      const gap = dayNum(dayKey) - dayNum(last);
      if (gap === 1) streak += 1;
      else if (gap === 2 && freezes > 0) { streak += 1; freezes -= 1; freezeUsed = true; } // one missed day is forgiven
      else if (gap > 1) streak = 1;
    }
    if (streak > Number(p.user.streakDays || 0) && streak % 7 === 0 && freezes < 2) { freezes += 1; freezeEarned = true; }
    // Challenge + crew reads must happen before any write in this transaction.
    const chSnap = await tx.get(db.collection("challenges").where("members", "array-contains", uid).where("status", "==", "active").limit(5));
    const crewId = String(p.user.crewId || "");
    const crewRef = crewId ? db.doc(`crews/${crewId}`) : null;
    const memRef = crewId ? db.doc(`crews/${crewId}/members/${uid}`) : null;
    const crewSnap = crewRef ? await tx.get(crewRef) : null;
    const memSnap = memRef ? await tx.get(memRef) : null;
    const area = String(req.data?.area || "Full Body").slice(0, 30);
    const feelingIn = String(req.data?.feeling || "Satisfied");
    const feeling = ["Energetic", "Tired", "Satisfied", "Sore", "Exhausted"].includes(feelingIn) ? feelingIn : "Satisfied";
    tx.set(db.doc(`users/${uid}/workoutLog/${workoutId.replace(/\//g, "_")}`), { at: Date.now(), dayKey, area, minutes, feeling });
    const xp = 120 + minutes * 4 + calories * 0.05 + (streak > 1 ? Math.min(streak, 14) * 5 : 0);
    const out = applyProgress(tx, uid, p, {
      xp, workouts: 1, minutes, streakDays: streak,
      extra: { lastWorkoutId: workoutId, lastWorkoutDay: dayKey, lastWorkoutAt: Date.now(), freezes },
    });
    chSnap.docs.forEach(d => {
      const end = d.data().endAt?.toMillis?.() ?? 0;
      if (Date.now() < end) tx.update(d.ref, { [`counts.${uid}`]: FieldValue.increment(1) });
    });
    if (crewRef && memRef && crewSnap?.exists && memSnap?.exists) {
      const wk = weekIdIST();
      const cw = crewSnap.data()!.weekId === wk ? Number(crewSnap.data()!.weekWorkouts || 0) : 0;
      const mw = memSnap.data()!.weekId === wk ? Number(memSnap.data()!.weekWorkouts || 0) : 0;
      tx.update(crewRef, { weekId: wk, weekWorkouts: cw + 1 });
      tx.update(memRef, { weekId: wk, weekWorkouts: mw + 1 });
    }
    return { duplicate: false, streakDays: streak, freezes, freezeUsed, freezeEarned, ...out };
  });
});

async function finalize(tx: FirebaseFirestore.Transaction, ref: DocumentReference, r: Room, extra: Record<string, unknown> = {}) {
  const winner = r.hostReps > r.guestReps ? r.hostUid : r.guestReps > r.hostReps ? r.guestUid : null;
  const apply = !r.statsApplied && !!r.guestUid;
  // all reads first
  const hostP = apply ? await readProgress(tx, r.hostUid) : null;
  const guestP = apply && r.guestUid ? await readProgress(tx, r.guestUid) : null;
  const names = apply ? await Promise.all([tx.get(db.doc(`rooms/${ref.id}`))]) : null;
  const room = names?.[0].data() ?? {};
  // Elo-style arena rating, separate from XP. Only rated when both players are present.
  const rate = (self: number, opp: number, score: number, matches: number) => {
    const k = matches < 10 ? 40 : 24; // new players move faster
    return Math.round(k * (score - 1 / (1 + 10 ** ((opp - self) / 400))));
  };
  const hRating = Number(hostP?.user.rating ?? 1000), gRating = Number(guestP?.user.rating ?? 1000);
  const hScore = winner === null ? 0.5 : winner === r.hostUid ? 1 : 0;
  const hDelta = hostP ? rate(hRating, gRating, hScore, Number(hostP.user.arenaMatches || 0)) : 0;
  const gDelta = guestP ? rate(gRating, hRating, 1 - hScore, Number(guestP.user.arenaMatches || 0)) : 0;
  tx.update(ref, {
    ...extra, status: "finished", hostDone: true, guestDone: true, winnerUid: winner, statsApplied: true,
    ...(apply ? { ratingDelta: { host: hDelta, guest: gDelta }, ratingAfter: { host: hRating + hDelta, guest: gRating + gDelta } } : {}),
  });
  if (apply && hostP && guestP && r.guestUid) {
    const sides = [
      { uid: r.hostUid, p: hostP, mine: r.hostReps, theirs: r.guestReps, oppUid: r.guestUid, oppName: room.guestName || "Athlete", delta: hDelta, rating: hRating },
      { uid: r.guestUid, p: guestP, mine: r.guestReps, theirs: r.hostReps, oppUid: r.hostUid, oppName: room.hostName || "Athlete", delta: gDelta, rating: gRating },
    ];
    for (const s of sides) {
      const won = winner === s.uid;
      const draw = winner === null;
      const xpGain = won ? 60 : draw ? 35 : 20;
      const prog = applyProgress(tx, s.uid, s.p, {
        xp: xpGain, arenaWin: won, arenaMatch: true,
        extra: { rating: s.rating + s.delta, ratingPeak: Math.max(Number(s.p.user.ratingPeak || 1000), s.rating + s.delta) },
      });
      tx.set(db.doc(`users/${s.uid}/matches/${ref.id}`), {
        code: ref.id, at: FieldValue.serverTimestamp(), exercise: room.exercise || "", mode: r.mode,
        myReps: s.mine, oppReps: s.theirs, oppUid: s.oppUid, oppName: s.oppName,
        result: won ? "win" : draw ? "draw" : "loss", xpGained: xpGain, ratingDelta: s.delta, ratingAfter: s.rating + s.delta,
        levelUp: prog.levelUp, rankUp: prog.rankUp, newTrophies: prog.newTrophies.map(t => t.id),
      });
    }
  }
}

export const arenaStart = onCall(async req => {
  const uid = needAuth(req); const c = code(req); const ref = db.doc(`rooms/${c}`);
  await db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError("not-found", "Room not found.");
    const r = s.data() as Room;
    if (r.hostUid !== uid) throw new HttpsError("permission-denied", "Only the host can start.");
    if (!r.guestUid || r.status !== "ready") throw new HttpsError("failed-precondition", "Waiting for an opponent.");
    tx.update(ref, { status: "live", startedAt: FieldValue.serverTimestamp(), hostReps: 0, guestReps: 0, hostDone: false, guestDone: false, statsApplied: false });
  });
  return { ok: true };
});

export const arenaReport = onCall(async req => {
  const uid = needAuth(req); const c = code(req); const ref = db.doc(`rooms/${c}`);
  const reps = Math.floor(Number(req.data?.reps));
  if (!Number.isFinite(reps) || reps < 0) throw new HttpsError("invalid-argument", "Bad reps.");
  return db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError("not-found", "Room not found.");
    const r = s.data() as Room;
    const role = roleOf(r, uid);
    if (r.status !== "live" || !r.startedAt) return { reps: role === "host" ? r.hostReps : r.guestReps, status: r.status };
    const elapsed = (Date.now() - r.startedAt.toMillis()) / 1000;
    const plausible = Math.floor(elapsed * MAX_TAPS_PER_SEC) + 3;
    const field = role === "host" ? "hostReps" : "guestReps";
    const doneField = role === "host" ? "hostDone" : "guestDone";
    const current = role === "host" ? r.hostReps : r.guestReps;
    if (r[doneField]) return { reps: current, status: r.status };
    let next = Math.max(current, Math.min(reps, plausible));
    if (r.mode === "reps") next = Math.min(next, r.target);
    const updated = { ...r, [field]: next } as Room;
    if (r.mode === "reps" && next >= r.target) {
      await finalize(tx, ref, updated, { [field]: next, [`${role}DoneAt`]: Date.now() });
      return { reps: next, status: "finished" };
    }
    tx.update(ref, { [field]: next });
    return { reps: next, status: r.status };
  });
});

export const arenaFinish = onCall(async req => {
  const uid = needAuth(req); const c = code(req); const ref = db.doc(`rooms/${c}`);
  const force = req.data?.force === true;
  return db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError("not-found", "Room not found.");
    const r = s.data() as Room;
    const role = roleOf(r, uid);
    if (r.status !== "live" || !r.startedAt) return { status: r.status };
    const endMs = r.startedAt.toMillis() + (r.mode === "time" ? r.target * 1000 : 0);
    if (r.mode === "time" && Date.now() < endMs - 2500) throw new HttpsError("failed-precondition", "Match is still running.");
    const mine = role === "host" ? "hostDone" : "guestDone";
    const otherDone = role === "host" ? r.guestDone : r.hostDone;
    const myAt = (role === "host" ? r.hostDoneAt : r.guestDoneAt) ?? Date.now();
    if (force) {
      if (!r[mine as "hostDone"] && !otherDone) throw new HttpsError("failed-precondition", "Finish your side first.");
      if (Date.now() - myAt < 8000 && !otherDone) throw new HttpsError("failed-precondition", "Give your opponent a moment.");
      await finalize(tx, ref, r);
      return { status: "finished" };
    }
    if (otherDone) { await finalize(tx, ref, r, { [`${role}DoneAt`]: Date.now() }); return { status: "finished" }; }
    tx.update(ref, { [mine]: true, [`${role}DoneAt`]: Date.now() });
    return { status: "live" };
  });
});

export const arenaLeave = onCall(async req => {
  const uid = needAuth(req); const c = code(req); const ref = db.doc(`rooms/${c}`);
  await db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists) return;
    const r = s.data() as Room;
    if (r.status === "finished" || r.status === "cancelled") return;
    const role = roleOf(r, uid);
    if (r.status === "live") {
      const otherDone = role === "host" ? r.guestDone : r.hostDone;
      if (otherDone) await finalize(tx, ref, r);
      else tx.update(ref, { [role === "host" ? "hostDone" : "guestDone"]: true, [`${role}DoneAt`]: Date.now() });
    } else if (role === "host") {
      tx.update(ref, { status: "cancelled" });
    } else {
      tx.update(ref, { guestUid: null, guestName: null, guestAvatar: null, status: "waiting" });
    }
  });
  return { ok: true };
});

/** Closes stuck matches and abandoned lobbies. */
export const sweepRooms = onSchedule("every 2 minutes", async () => {
  const now = Date.now();
  const staleQ = await db.collection("matchQueue").where("at", "<", Timestamp.fromMillis(now - 3 * 60_000)).limit(100).get();
  await Promise.all(staleQ.docs.map(d => d.ref.delete()));
  const live = await db.collection("rooms").where("status", "==", "live").limit(100).get();
  for (const d of live.docs) {
    const r = d.data() as Room;
    if (!r.startedAt) continue;
    const limit = r.startedAt.toMillis() + (r.mode === "time" ? r.target * 1000 : 600_000) + GRACE_MS;
    if (now > limit) await db.runTransaction(async tx => { const s = await tx.get(d.ref); if ((s.data() as Room).status === "live") await finalize(tx, d.ref, s.data() as Room); });
  }
  const stale = await db.collection("rooms").where("status", "in", ["waiting", "ready"]).limit(100).get();
  await Promise.all(stale.docs.filter(d => {
    const created = (d.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0;
    return created && now - created > 45 * 60_000;
  }).map(d => d.ref.update({ status: "cancelled" })));
});

/** Returns today's quests, creating/refreshing the quest document if it is from an earlier day or week. */
export const getQuests = onCall(async req => {
  const uid = needAuth(req);
  const ref = db.doc(`users/${uid}/quests/current`);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const existing = snap.data() as Partial<QuestDoc> | undefined;
    const next = ensureQuests(existing);
    if (!existing || existing.dayKey !== next.dayKey || existing.weekId !== next.weekId) tx.set(ref, next);
    return { dayKey: dayKeyIST() };
  });
});
