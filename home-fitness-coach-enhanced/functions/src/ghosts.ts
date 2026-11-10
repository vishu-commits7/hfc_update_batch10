/**
 * Ghost duels. A finished first-to-N match leaves each player's rep timeline in `ghosts/{uid}_{key}`
 * (server-only: no client can read or write it). Another player can then race it with an anonymous name, and
 * quick match falls back to one when nobody live turns up. Rating moves at half weight against a ghost.
 * The timeline is built by the server from the player's reports, so a phone cannot upload a made-up one.
 */
import "./init";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { applyProgress, readProgress } from "./progression";
import { dayKeyIST } from "./timeutil";
import {
  GHOST_DAILY_RATED, GHOST_WEIGHT, MIN_GHOST_REPS, anonName, eloDelta, ghostKey, isGhostable, makePacer, repsAt, runScore, settleReps,
  type GhostKind,
} from "./ghostCore";

const db = getFirestore();
const GHOST_TTL_MS = 60 * 86_400_000;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

export const ghostRef = (uid: string, keyHash: string) => db.doc(`ghosts/${uid}_${keyHash}`);

/** Keeps a player's best run for this setup. The stored rating always follows the player. */
export function saveGhost(
  tx: FirebaseFirestore.Transaction, existing: FirebaseFirestore.DocumentSnapshot | null,
  p: { uid: string; keyHash: string; exercise: string; target: number; rating: number; tl: number[]; reps: number; finMs: number | null },
) {
  if (!existing || p.tl.length < MIN_GHOST_REPS) return;
  const score = runScore(p.reps, p.target, p.finMs);
  const ref = ghostRef(p.uid, p.keyHash);
  const expireAt = Timestamp.fromMillis(Date.now() + GHOST_TTL_MS);
  if (!existing.exists || score > Number(existing.data()?.score ?? -1)) {
    tx.set(ref, { ownerUid: p.uid, key: p.keyHash, exercise: p.exercise, target: p.target, rating: p.rating, tl: p.tl.slice(0, p.reps), reps: p.reps, score, at: Date.now(), expireAt });
  } else {
    tx.set(ref, { rating: p.rating, expireAt }, { merge: true });
  }
}

/** Finishes a ghost room: the server settles the score, rates it at half weight, and keeps the player's run. */
export async function finalizeGhost(
  tx: FirebaseFirestore.Transaction, ref: FirebaseFirestore.DocumentReference, r: Record<string, any>,
  extra: Record<string, unknown> = {}, opt: { forfeit?: boolean; slackMs?: number } = {},
) {
  if (r.statsApplied) return;
  const uid = String(r.hostUid);
  const day = dayKeyIST();
  const keyHash = ghostKey({ plan: r.plan, exercise: r.exercise, mode: r.mode, target: r.target });
  const capRef = db.doc(`arenaPairs/${day}_${uid}_ghost`);
  const [hostP, capSnap, mineSnap] = await Promise.all([
    readProgress(tx, uid), tx.get(capRef), isGhostable(r as any) ? tx.get(ghostRef(uid, keyHash)) : Promise.resolve(null),
  ]);
  const startedMs = r.startedAt?.toMillis?.() ?? Date.now();
  const hostFinMs = (extra.hostDoneAt ?? r.hostDoneAt) ? Number(extra.hostDoneAt ?? r.hostDoneAt) - startedMs : null;
  const hostTl: number[] = (extra.hostTl as number[] | undefined) ?? r.hostTl ?? [];
  const out = settleReps({
    target: Number(r.target), hostReps: Number((extra.hostReps as number | undefined) ?? r.hostReps ?? 0), hostTl, ghostTl: r.ghostTl ?? [],
    elapsedMs: Date.now() - startedMs + (opt.slackMs ?? 0), hostFinMs, forfeit: opt.forfeit,
  });
  const won = out.winner === "host", draw = out.winner === null;
  const kind = (r.ghostKind || "pacer") as GhostKind;
  const rated = Number(capSnap.data()?.n || 0) < GHOST_DAILY_RATED && !r.hostStruck; // an impossible rep count makes the match unrated
  const rating = Number(hostP.user.rating ?? 1000), ghostRating = Number(r.ghostRating ?? 1000);
  const delta = rated && kind === "peer" ? eloDelta(rating, ghostRating, won ? 1 : draw ? 0.5 : 0, Number(hostP.user.arenaMatches || 0), GHOST_WEIGHT) : 0;
  const xpGain = rated ? (won ? 30 : draw ? 18 : 10) : 0; // half of a live match
  tx.update(ref, {
    ...extra, hostReps: out.hostReps, guestReps: out.guestReps, status: "finished", hostDone: true, guestDone: true,
    winnerUid: won ? uid : null, statsApplied: true, ghostHalf: kind === "peer" && rated,
    ...(rated && kind === "peer" ? { ratingDelta: { host: delta, guest: 0 }, ratingAfter: { host: rating + delta, guest: ghostRating } } : { unrated: true }),
  });
  tx.set(capRef, { n: Number(capSnap.data()?.n || 0) + 1, day, a: uid, b: "ghost" }, { merge: true });
  let prog: ReturnType<typeof applyProgress> | null = null;
  if (rated) {
    // Ghost wins stay off the wins leaderboard and the arena-win trophies (arenaWin: false); the match still counts as played.
    prog = applyProgress(tx, uid, hostP, {
      xp: xpGain, arenaWin: false, arenaMatch: true,
      extra: kind === "peer" ? { rating: rating + delta, ratingPeak: Math.max(Number(hostP.user.ratingPeak || 1000), rating + delta) } : undefined,
    });
  }
  tx.set(db.doc(`users/${uid}/matches/${ref.id}`), {
    code: ref.id, at: FieldValue.serverTimestamp(), exercise: r.exercise || "", mode: r.mode,
    myReps: out.hostReps, oppReps: out.guestReps, oppUid: null, oppName: `${r.guestName || "Ghost"} (ghost)`, ghost: true,
    result: won ? "win" : draw ? "draw" : "loss", xpGained: xpGain, ratingDelta: delta, ratingAfter: rating + delta,
    levelUp: prog?.levelUp ?? false, rankUp: prog?.rankUp ?? false, newTrophies: prog?.newTrophies.map(t => t.id) ?? [],
  });
  if (rated && !opt.forfeit && isGhostable(r as any)) {
    saveGhost(tx, mineSnap, { uid, keyHash, exercise: String(r.exercise || ""), target: Number(r.target), rating: rating + delta, tl: hostTl, reps: out.hostReps, finMs: out.hostFinMs });
  }
}

interface Pick { kind: GhostKind; name: string; tl: number[]; rating: number }

async function blockedBetween(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([db.doc(`users/${a}/blocks/${b}`).get(), db.doc(`users/${b}/blocks/${a}`).get()]);
  return x.exists || y.exists;
}

/** A recorded player near this rating, closest first, not you, not anyone you've blocked or who blocked you. */
async function pickPeer(uid: string, keyHash: string, rating: number): Promise<Pick | null> {
  for (const range of [200, 500, 5000]) {
    const snap = await db.collection("ghosts").where("key", "==", keyHash).where("rating", ">=", rating - range).where("rating", "<=", rating + range).limit(20).get();
    const now = Date.now();
    const cands = snap.docs.filter(d => {
      const x = d.data();
      return x.ownerUid !== uid && (x.expireAt?.toMillis?.() ?? 0) > now && Array.isArray(x.tl) && x.tl.length >= MIN_GHOST_REPS;
    }).sort((a, b) => Math.abs(Number(a.data().rating) - rating) - Math.abs(Number(b.data().rating) - rating));
    const ok: typeof cands = [];
    for (const d of cands) {
      if (ok.length >= 4) break;
      if (!(await blockedBetween(uid, String(d.data().ownerUid)))) ok.push(d);
    }
    if (ok.length) {
      const d = ok[Math.floor(Math.random() * ok.length)];
      const x = d.data();
      return { kind: "peer", name: anonName(d.id), tl: x.tl as number[], rating: Number(x.rating) };
    }
  }
  return null;
}

/**
 * Starts a duel against a ghost.
 *  kind "peer": a recorded player at a similar rating (error when none exists yet)
 *  kind "self": your own best run for this exercise and rep count (error when you have none)
 *  kind "auto": quick match fallback: a peer if one exists, otherwise a practice pacer (never rated)
 * If you were paired with a live opponent in the meantime, you get that room back instead.
 */
export const arenaGhostMatch = onCall(async req => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = req.auth.uid;
  const exerciseId = String(req.data?.exerciseId || "").slice(0, 40);
  const name = String(req.data?.name || "").slice(0, 60);
  const reps = Math.max(5, Math.min(100, Math.round(Number(req.data?.reps) || 20)));
  const kindIn = String(req.data?.kind || "auto");
  if (!exerciseId || !name) throw new HttpsError("invalid-argument", "Pick an exercise.");
  if (!["auto", "peer", "self"].includes(kindIn)) throw new HttpsError("invalid-argument", "Bad ghost type.");
  const plan = [{ id: exerciseId, name, reps }];
  const keyHash = ghostKey({ plan, exercise: name, mode: "reps", target: reps });
  const me = (await db.doc(`users/${uid}`).get()).data() ?? {};
  const rating = Number(me.rating ?? 1000);

  let pick: Pick | null = null;
  if (kindIn === "self") {
    const own = await ghostRef(uid, keyHash).get();
    const tl = own.data()?.tl;
    if (!own.exists || !Array.isArray(tl) || tl.length < MIN_GHOST_REPS) throw new HttpsError("failed-precondition", "You have no best run for this yet. Finish a match first.");
    pick = { kind: "self", name: "Your best run", tl, rating };
  } else {
    pick = await pickPeer(uid, keyHash, rating).catch(() => null); // e.g. the index is still building: fall back instead of failing
    if (!pick && kindIn === "peer") throw new HttpsError("not-found", "Nobody has recorded a run near your rating for this yet. Try your best run, or Quick match.");
    if (!pick) pick = { kind: "pacer", name: "Pacer", tl: makePacer(reps), rating };
  }
  const chosen = pick;

  return db.runTransaction(async tx => {
    const q = db.doc(`matchQueue/${uid}`);
    const qs = await tx.get(q);
    if (qs.exists && qs.data()?.status === "matched" && qs.data()?.code) return { status: "matched", code: String(qs.data()!.code) };
    let code = "";
    for (let i = 0; i < 8 && !code; i++) { const c = makeCode(); if (!(await tx.get(db.doc(`rooms/${c}`))).exists) code = c; }
    if (!code) throw new HttpsError("internal", "Couldn't create a room. Try again.");
    if (qs.exists) tx.delete(q);
    tx.set(db.doc(`rooms/${code}`), {
      hostUid: uid, hostName: String(me.displayName || "Athlete"), hostAvatar: (me.avatarUrl as string) ?? null,
      guestUid: null, guestName: chosen.name, guestAvatar: null,
      createdAt: FieldValue.serverTimestamp(), startedAt: null, hostReps: 0, guestReps: 0, hostDone: false, guestDone: false,
      exercise: name, plan, mode: "reps", target: reps, status: "ready", visibility: "private", quick: true,
      ghost: true, ghostKind: chosen.kind, ghostTl: chosen.tl, ghostRating: chosen.rating,
    });
    return { status: "ghost", code, kind: chosen.kind, name: chosen.name };
  });
});
