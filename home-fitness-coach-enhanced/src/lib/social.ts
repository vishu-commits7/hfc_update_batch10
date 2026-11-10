/**
 * Apex social backend (Firestore).
 *
 * Collections
 *   users/{uid}                       public profile: displayName, handle, nameKey, avatarUrl (small data URL), bio, public
 *   follows/{followerUid}_{followeeUid}  { followerUid, followeeUid, status: "pending" | "accepted", createdAt }
 *   chats/{uidA_uidB (sorted)}        { members:[a,b], lastMessage, lastSender, updatedAt }
 *   chats/{id}/messages/{auto}        { from, text, createdAt }
 *   reelComments/{reelId}/items/{id}  { uid, name, handle, avatarUrl, text, createdAt, likedBy[], likeCount }
 *   reelLikes/{reelId}/users/{uid}    { createdAt, uid }
 *   rooms/{CODE}                      live arena room (see ArenaRoom)
 *
 * No Firebase Storage is needed for any of this — avatars are small JPEG data
 * URLs stored on the profile document — so it works on the free Spark plan.
 */
import type { User } from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot,
  query, where, orderBy, limit as fsLimit, serverTimestamp, writeBatch, runTransaction,
  getCountFromServer, arrayUnion, arrayRemove, increment, Timestamp, limitToLast,
} from "firebase/firestore";
import { sharedQuery } from "./sharedQuery";
import { DEMO, demoSubscribeRoom } from "./demo";
import { db, auth } from "./firebase";
import { callFn } from "./functions";

export const AVATAR_KEY = "apex_user_avatar";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export function withTimeout<T>(p: Promise<T>, ms = 9000, label = "Request"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out. Check your connection.`)), ms);
    p.then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); },
    );
  });
}

export function slugHandle(name: string): string {
  return (name || "athlete").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 16) || "athlete";
}

export function friendlySocialError(err: unknown): string {
  const code = (err as { code?: string })?.code || "";
  const msg = (err as { message?: string })?.message || "";
  if (code === "permission-denied") {
    return "Cloud rules are not published yet. Publish firestore.rules in Firebase Console (see BUGFIX_NOTES.md).";
  }
  if (code === "unavailable" || /offline|network/i.test(msg)) return "You're offline. Reconnect and try again.";
  return msg || "Something went wrong. Please try again.";
}

function readLocalAvatar(): string | null {
  try { return localStorage.getItem(AVATAR_KEY); } catch { return null; }
}

/* ------------------------------------------------------------------ */
/* profiles                                                            */
/* ------------------------------------------------------------------ */

export interface SocialProfile {
  uid: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  bio: string;
  public: boolean;
  accountPublic: boolean;
  arenaWins?: number;
  arenaMatches?: number;
  totalWorkouts?: number;
  streakDays?: number;
}

function normalizeProfile(uid: string, d: Record<string, any> | undefined, fallbackName = "Athlete"): SocialProfile {
  const name = (d?.displayName as string) || fallbackName;
  return {
    uid,
    displayName: name,
    handle: (d?.handle as string) || `${slugHandle(name)}_${uid.slice(0, 4).toLowerCase()}`,
    avatarUrl: (d?.avatarUrl as string) || null,
    bio: (d?.bio as string) || "",
    public: d?.public !== false,
    accountPublic: d?.accountPublic === true,
    arenaWins: d?.arenaWins || 0,
    arenaMatches: d?.arenaMatches || 0,
    totalWorkouts: d?.totalWorkouts || 0,
    streakDays: d?.streakDays || 0,
  };
}

/** Creates the profile if missing, and back-fills handle/search keys on older accounts. */
export async function ensureProfile(user: User): Promise<SocialProfile> {
  const ref = doc(db, "users", user.uid);
  const badName = (n?: string | null) => !n || /^user[_ -]?not[_ -]?found/i.test(n.trim()) || !n.trim();
  const fallbackName = !badName(user.displayName) ? user.displayName! : (user.email?.split("@")[0] || "Athlete");
  const snap = await withTimeout(getDoc(ref), 9000, "Loading profile");
  const localAvatar = readLocalAvatar();

  if (!snap.exists()) {
    const displayName = fallbackName;
    const handle = `${slugHandle(displayName)}_${user.uid.slice(0, 4).toLowerCase()}`;
    const fresh = {
      uid: user.uid,
      displayName,
      nameKey: displayName.toLowerCase(),
      handle,
      avatarUrl: localAvatar || user.photoURL || null,
      bio: "Apex athlete. Training daily.",
      public: true,
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, fresh);
    return normalizeProfile(user.uid, fresh);
  }

  const data = snap.data() as Record<string, any>;
  const patch: Record<string, any> = {};
  if (badName(data.displayName)) {
    patch.displayName = fallbackName;
    patch.nameKey = fallbackName.toLowerCase();
    patch.handle = `${slugHandle(fallbackName)}_${user.uid.slice(0, 4).toLowerCase()}`;
  }
  if (!data.handle) patch.handle = `${slugHandle(data.displayName || fallbackName)}_${user.uid.slice(0, 4).toLowerCase()}`;
  if (!data.nameKey) patch.nameKey = String(data.displayName || fallbackName).toLowerCase();
  if (!data.avatarUrl && (localAvatar || user.photoURL)) patch.avatarUrl = localAvatar || user.photoURL;
  if (Object.keys(patch).length) {
    try { await updateDoc(ref, patch); } catch { /* non-fatal */ }
  }
  return normalizeProfile(user.uid, { ...data, ...patch }, fallbackName);
}

export async function getProfile(uid: string): Promise<SocialProfile | null> {
  const snap = await withTimeout(getDoc(doc(db, "users", uid)), 9000, "Loading profile");
  return snap.exists() ? normalizeProfile(uid, snap.data() as Record<string, any>) : null;
}

export function subscribeProfile(uid: string, cb: (p: SocialProfile | null) => void, onError?: (e: unknown) => void) {
  return onSnapshot(
    doc(db, "users", uid),
    snap => cb(snap.exists() ? normalizeProfile(uid, snap.data() as Record<string, any>) : null),
    err => onError?.(err),
  );
}

export async function updateMyProfile(
  uid: string,
  fields: Partial<Pick<SocialProfile, "displayName" | "bio" | "avatarUrl" | "public">>,
) {
  const patch: Record<string, any> = { ...fields };
  if (fields.displayName) patch.nameKey = fields.displayName.trim().toLowerCase();
  await withTimeout(setDoc(doc(db, "users", uid), patch, { merge: true }), 10000, "Saving profile");
}

export async function searchProfiles(term: string, myUid?: string | null): Promise<SocialProfile[]> {
  const t = term.trim().toLowerCase().replace(/^@/, "");
  const out = new Map<string, SocialProfile>();
  const push = (snap: Awaited<ReturnType<typeof getDocs>>) => {
    snap.docs.forEach(d => {
      if (d.id === myUid) return;
      out.set(d.id, normalizeProfile(d.id, d.data() as Record<string, any>));
    });
  };

  if (!t) {
    push(await withTimeout(getDocs(query(collection(db, "users"), fsLimit(24))), 9000, "Search"));
    return [...out.values()];
  }
  const end = t + "";
  const [byHandle, byName] = await withTimeout(
    Promise.all([
      getDocs(query(collection(db, "users"), where("handle", ">=", t), where("handle", "<=", end), orderBy("handle"), fsLimit(15))),
      getDocs(query(collection(db, "users"), where("nameKey", ">=", t), where("nameKey", "<=", end), orderBy("nameKey"), fsLimit(15))),
    ]),
    9000,
    "Search",
  );
  push(byHandle);
  push(byName);
  return [...out.values()];
}

/* ------------------------------------------------------------------ */
/* follows                                                             */
/* ------------------------------------------------------------------ */

export type FollowStatus = "none" | "pending" | "accepted";
export interface FollowEdges {
  /** people I follow / asked to follow: uid -> status */
  outgoing: Map<string, FollowStatus>;
  /** people following me / asking to follow me: uid -> status */
  incoming: Map<string, FollowStatus>;
}

/** Most follow links loaded for one account in each direction. Without a cap, an account with 20,000 followers reads 20,000 documents on every app start. */
const FOLLOW_EDGE_CAP = 1000;
const followId = (follower: string, followee: string) => `${follower}_${followee}`;

export function subscribeFollowEdges(me: string, cb: (e: FollowEdges) => void, onError?: (e: unknown) => void) {
  const edges: FollowEdges = { outgoing: new Map(), incoming: new Map() };
  const emit = () => cb({ outgoing: new Map(edges.outgoing), incoming: new Map(edges.incoming) });

  const u1 = onSnapshot(
    query(collection(db, "follows"), where("followerUid", "==", me), fsLimit(FOLLOW_EDGE_CAP)),
    snap => {
      edges.outgoing = new Map(snap.docs.map(d => [d.data().followeeUid as string, d.data().status as FollowStatus]));
      emit();
    },
    err => onError?.(err),
  );
  const u2 = onSnapshot(
    query(collection(db, "follows"), where("followeeUid", "==", me), fsLimit(FOLLOW_EDGE_CAP)),
    snap => {
      edges.incoming = new Map(snap.docs.map(d => [d.data().followerUid as string, d.data().status as FollowStatus]));
      emit();
    },
    err => onError?.(err),
  );
  return () => { u1(); u2(); };
}

export async function requestFollow(me: string, target: string) {
  if (me === target) return;
  // Always created as "pending"; the server accepts instantly if the account is public.
  await withTimeout(
    setDoc(doc(db, "follows", followId(me, target)), {
      followerUid: me,
      followeeUid: target,
      status: "pending",
      createdAt: serverTimestamp(),
    }),
    10000,
    "Follow request",
  );
}

/** Cancel my request / unfollow. */
export async function cancelFollow(me: string, target: string) {
  await withTimeout(deleteDoc(doc(db, "follows", followId(me, target))), 10000, "Unfollow");
}

export async function acceptFollow(me: string, follower: string) {
  await withTimeout(updateDoc(doc(db, "follows", followId(follower, me)), { status: "accepted" }), 10000, "Accept");
}

export async function declineFollow(me: string, follower: string) {
  await withTimeout(deleteDoc(doc(db, "follows", followId(follower, me))), 10000, "Decline");
}

export async function getFollowCounts(uid: string): Promise<{ followers: number; following: number }> {
  try {
    const snap = await withTimeout(getDoc(doc(db, "users", uid)), 9000, "Counts");
    const x = snap.data() || {};
    if (typeof x.followerCount === "number" && typeof x.followingCount === "number") {
      return { followers: x.followerCount, following: x.followingCount };
    }
    // older account: ask the server to compute the counters once
    if (auth.currentUser?.uid === uid) void callFn("recountMine").catch(() => {});
    const [a, b] = await withTimeout(
      Promise.all([
        getCountFromServer(query(collection(db, "follows"), where("followeeUid", "==", uid), where("status", "==", "accepted"))),
        getCountFromServer(query(collection(db, "follows"), where("followerUid", "==", uid), where("status", "==", "accepted"))),
      ]),
      9000,
      "Counts",
    );
    return { followers: a.data().count, following: b.data().count };
  } catch {
    return { followers: 0, following: 0 };
  }
}

/** Chat unlocks once either side has accepted a follow request. */
export function canChatWith(edges: FollowEdges, other: string): boolean {
  return edges.outgoing.get(other) === "accepted" || edges.incoming.get(other) === "accepted";
}

/* ------------------------------------------------------------------ */
/* direct messages                                                     */
/* ------------------------------------------------------------------ */

export interface ChatSummary {
  id: string;
  members: string[];
  lastMessage: string;
  lastSender: string;
  updatedAt: number;
}
export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  createdAt: number;
  /** true while the write has not reached the server (offline / sending) */
  pending: boolean;
}
export interface ChatReceipts { deliveredAt: Record<string, number>; readAt: Record<string, number> }

export function subscribeChatReceipts(chatId: string, cb: (r: ChatReceipts) => void) {
  return onSnapshot(doc(db, "chats", chatId), snap => {
    const x = (snap.data() as Record<string, any>) || {};
    const conv = (m: Record<string, any> | undefined) => {
      const out: Record<string, number> = {};
      Object.entries(m || {}).forEach(([k, v]) => { out[k] = toMs(v); });
      return out;
    };
    cb({ deliveredAt: conv(x.deliveredAt), readAt: conv(x.readAt) });
  }, () => {});
}

/** I opened the conversation: everything up to now is read (and delivered). */
export async function markChatRead(chatId: string, me: string) {
  try {
    await setDoc(doc(db, "chats", chatId), {
      readAt: { [me]: serverTimestamp() }, deliveredAt: { [me]: serverTimestamp() },
    }, { merge: true });
  } catch { /* offline: retried on next open */ }
}

export const chatIdFor = (a: string, b: string) => [a, b].sort().join("_");

const toMs = (t: unknown): number => {
  if (t && typeof (t as Timestamp).toMillis === "function") return (t as Timestamp).toMillis();
  return Date.now();
};

export function subscribeChats(me: string, cb: (c: ChatSummary[]) => void, onError?: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, "chats"), where("members", "array-contains", me)),
    snap => {
      const list = snap.docs.map(d => {
        const x = d.data() as Record<string, any>;
        return {
          id: d.id,
          members: x.members as string[],
          lastMessage: (x.lastMessage as string) || "",
          lastSender: (x.lastSender as string) || "",
          updatedAt: toMs(x.updatedAt),
        };
      });
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      cb(list);
    },
    err => onError?.(err),
  );
}

/** The newest `max` messages, oldest first. Opening a chat used to read up to 300 every time. */
export function subscribeMessages(chatId: string, cb: (m: ChatMessage[]) => void, onError?: (e: unknown) => void, max = 50) {
  return onSnapshot(
    query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), limitToLast(max)),
    { includeMetadataChanges: true },
    snap => {
      cb(
        snap.docs.map(d => {
          const x = d.data({ serverTimestamps: "estimate" }) as Record<string, any>;
          return { id: d.id, from: x.from as string, text: x.text as string, createdAt: toMs(x.createdAt), pending: d.metadata.hasPendingWrites };
        }),
      );
    },
    err => onError?.(err),
  );
}

export async function sendMessage(me: string, other: string, text: string, queueOnly = false) {
  const clean = text.trim().slice(0, 1000);
  if (!clean) return;
  const id = chatIdFor(me, other);
  const batch = writeBatch(db);
  batch.set(
    doc(db, "chats", id),
    {
      members: [me, other].sort(),
      lastMessage: clean.slice(0, 120),
      lastSender: me,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(doc(collection(db, "chats", id, "messages")), { from: me, text: clean, createdAt: serverTimestamp() });
  // queueOnly: let Firestore queue the write offline and deliver when back online.
  if (queueOnly) { void batch.commit().catch(() => {}); return; }
  await withTimeout(batch.commit(), 10000, "Sending");
}

/* ------------------------------------------------------------------ */
/* reel comments + likes                                               */
/* ------------------------------------------------------------------ */

export interface ReelCommentDoc {
  id: string;
  uid: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  text: string;
  createdAt: number;
  likedBy: string[];
  likeCount: number;
}

export function subscribeReelComments(reelId: string, cb: (c: ReelCommentDoc[]) => void, onError?: (e: unknown) => void, max = 40) {
  return onSnapshot(
    query(collection(db, "reelComments", reelId, "items"), orderBy("createdAt", "desc"), fsLimit(max)),
    { includeMetadataChanges: true },
    snap => {
      cb(
        snap.docs.map(d => {
          const x = d.data({ serverTimestamps: "estimate" }) as Record<string, any>;
          return {
            id: d.id,
            uid: x.uid,
            name: x.name || "Athlete",
            handle: x.handle || "athlete",
            avatarUrl: x.avatarUrl || null,
            text: x.text || "",
            createdAt: toMs(x.createdAt),
            likedBy: (x.likedBy as string[]) || [],
            likeCount: x.likeCount || 0,
          };
        }),
      );
    },
    err => onError?.(err),
  );
}

export async function postReelComment(
  reelId: string,
  me: { uid: string; name: string; handle: string; avatarUrl: string | null },
  text: string,
) {
  const clean = text.trim().slice(0, 500);
  if (!clean) return;
  await withTimeout(
    addDoc(collection(db, "reelComments", reelId, "items"), {
      uid: me.uid,
      name: me.name,
      handle: me.handle,
      avatarUrl: me.avatarUrl,
      text: clean,
      createdAt: serverTimestamp(),
      likedBy: [],
      likeCount: 0,
    }),
    10000,
    "Posting comment",
  );
}

export async function toggleReelCommentLike(reelId: string, commentId: string, uid: string, currentlyLiked: boolean) {
  await updateDoc(doc(db, "reelComments", reelId, "items", commentId), {
    likedBy: currentlyLiked ? arrayRemove(uid) : arrayUnion(uid),
    likeCount: increment(currentlyLiked ? -1 : 1),
  });
}

export async function deleteReelComment(reelId: string, commentId: string) {
  await deleteDoc(doc(db, "reelComments", reelId, "items", commentId));
}

/** My own like on a reel (the shared total comes from the reel doc, written by the server). */
export function subscribeMyReelLike(reelId: string, uid: string, cb: (liked: boolean) => void, onError?: (e: unknown) => void) {
  return onSnapshot(doc(db, "reelLikes", reelId, "users", uid), snap => cb(snap.exists()), err => onError?.(err));
}

export function recordReelView(reelId: string) {
  return callFn("recordReelView", { reelId });
}

export async function setReelLike(reelId: string, uid: string, liked: boolean) {
  const ref = doc(db, "reelLikes", reelId, "users", uid);
  if (liked) await setDoc(ref, { createdAt: serverTimestamp(), uid });
  else await deleteDoc(ref);
}

/* ------------------------------------------------------------------ */
/* arena rooms                                                         */
/* ------------------------------------------------------------------ */

export type RoomStatus = "waiting" | "ready" | "live" | "finished" | "cancelled";

export interface ArenaRoom {
  code: string;
  hostUid: string;
  hostName: string;
  hostAvatar: string | null;
  guestUid: string | null;
  guestName: string | null;
  guestAvatar: string | null;
  exercise: string;
  /** multi-exercise challenge: do these in order; target = sum of reps */
  plan: { id: string; name: string; reps: number }[] | null;
  mode: "time" | "reps";
  /** seconds when mode = time, reps when mode = reps */
  target: number;
  status: RoomStatus;
  visibility: "public" | "private";
  createdAt: number;
  startedAt: number | null;
  hostReps: number;
  guestReps: number;
  hostDone: boolean;
  guestDone: boolean;
  /** quick-match rooms start automatically */
  quick: boolean;
  rematchCode: string | null;
  rematchBy: string | null;
  /** Elo change after the match, per side (server-written) */
  ratingDelta: { host: number; guest: number } | null;
  ratingAfter: { host: number; guest: number } | null;
  /** ghost duel: the opponent is a recorded run (anonymous name, guestUid stays null) */
  ghost: boolean;
  ghostKind: "peer" | "self" | "pacer" | null;
  ghostTl: number[];
  /** rating moved at half weight against this ghost */
  ghostHalf: boolean;
  /** no rating change (practice pacer, your own run, or the daily ghost limit) */
  unrated: boolean;
}

export interface RoomPlayer { uid: string; name: string; avatarUrl: string | null }

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode(): string {
  let s = "";
  const bytes = new Uint8Array(6);
  (globalThis.crypto || ({ getRandomValues: (a: Uint8Array) => a.map(() => Math.floor(Math.random() * 256)) } as Crypto)).getRandomValues(bytes);
  bytes.forEach(b => { s += CODE_CHARS[b % CODE_CHARS.length]; });
  return s;
}

function roomFrom(code: string, x: Record<string, any>): ArenaRoom {
  return {
    code,
    hostUid: x.hostUid,
    hostName: x.hostName || "Athlete",
    hostAvatar: x.hostAvatar || null,
    guestUid: x.guestUid || null,
    guestName: x.guestName || null,
    guestAvatar: x.guestAvatar || null,
    exercise: x.exercise || "Push-ups",
    plan: Array.isArray(x.plan) && x.plan.length ? x.plan.map((i: any) => ({ id: String(i.id || ""), name: String(i.name || ""), reps: Number(i.reps) || 0 })) : null,
    mode: x.mode === "reps" ? "reps" : "time",
    target: x.target || 45,
    status: x.status || "waiting",
    visibility: x.visibility === "private" ? "private" : "public",
    createdAt: toMs(x.createdAt),
    startedAt: x.startedAt ? toMs(x.startedAt) : null,
    hostReps: x.hostReps || 0,
    guestReps: x.guestReps || 0,
    hostDone: !!x.hostDone,
    guestDone: !!x.guestDone,
    quick: x.quick === true,
    rematchCode: x.rematchCode || null,
    rematchBy: x.rematchBy || null,
    ratingDelta: x.ratingDelta && typeof x.ratingDelta === "object" ? { host: Number(x.ratingDelta.host || 0), guest: Number(x.ratingDelta.guest || 0) } : null,
    ratingAfter: x.ratingAfter && typeof x.ratingAfter === "object" ? { host: Number(x.ratingAfter.host || 0), guest: Number(x.ratingAfter.guest || 0) } : null,
    ghost: x.ghost === true,
    ghostKind: x.ghostKind === "peer" || x.ghostKind === "self" || x.ghostKind === "pacer" ? x.ghostKind : null,
    ghostTl: Array.isArray(x.ghostTl) ? x.ghostTl.map((n: unknown) => Number(n) || 0) : [],
    ghostHalf: x.ghostHalf === true,
    unrated: x.unrated === true,
  };
}

export async function createRoom(
  host: RoomPlayer,
  cfg: { exercise: string; plan?: { id: string; name: string; reps: number }[] | null; mode: "time" | "reps"; target: number; visibility: "public" | "private" },
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const ref = doc(db, "rooms", code);
    const exists = (await withTimeout(getDoc(ref), 9000, "Creating room")).exists();
    if (exists) continue;
    await withTimeout(
      setDoc(ref, {
        hostUid: host.uid,
        hostName: host.name,
        hostAvatar: host.avatarUrl,
        guestUid: null,
        guestName: null,
        guestAvatar: null,
        exercise: cfg.exercise,
        plan: cfg.plan && cfg.plan.length ? cfg.plan : null,
        mode: cfg.mode,
        target: cfg.target,
        status: "waiting",
        visibility: cfg.visibility,
        createdAt: serverTimestamp(),
        startedAt: null,
        hostReps: 0,
        guestReps: 0,
        hostDone: false,
        guestDone: false,
      }),
      10000,
      "Creating room",
    );
    return code;
  }
  throw new Error("Could not create a room. Try again.");
}

export async function joinRoom(codeRaw: string, me: RoomPlayer): Promise<string> {
  const code = codeRaw.trim().toUpperCase();
  if (code.length < 4) throw new Error("Enter the room code your friend shared.");
  const ref = doc(db, "rooms", code);
  await withTimeout(
    runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("Room not found. Check the code.");
      const r = roomFrom(code, snap.data() as Record<string, any>);
      if (r.status === "cancelled" || r.status === "finished") throw new Error("That match is already over.");
      if (r.hostUid === me.uid || r.guestUid === me.uid) return; // rejoin
      if (r.guestUid) throw new Error("This room is already full.");
      if (r.status !== "waiting") throw new Error("That match already started.");
      tx.update(ref, { guestUid: me.uid, guestName: me.name, guestAvatar: me.avatarUrl, status: "ready" });
    }),
    12000,
    "Joining room",
  );
  return code;
}

export async function leaveRoom(code: string, _uid?: string) {
  try { await callFn("arenaLeave", { code }); } catch { /* best effort */ }
}

export async function startRoomMatch(code: string) {
  await withTimeout(callFn("arenaStart", { code }), 15000, "Starting");
}

export async function reportReps(code: string, _role: "host" | "guest", reps: number) {
  await callFn("arenaReport", { code, reps });
}

export async function finishSide(code: string, _role: "host" | "guest", _reps?: number) {
  await callFn("arenaFinish", { code });
}

/** Opponent dropped mid-match: ask the server to close the room. */
export async function forceFinishRoom(code: string) {
  try { await callFn("arenaFinish", { code, force: true }); } catch { /* best effort */ }
}

export function subscribeRoom(code: string, cb: (r: ArenaRoom | null) => void, onError?: (e: unknown) => void) {
  if (DEMO) return demoSubscribeRoom(cb);
  return onSnapshot(
    doc(db, "rooms", code),
    snap => cb(snap.exists() ? roomFrom(code, snap.data({ serverTimestamps: "estimate" }) as Record<string, any>) : null),
    err => onError?.(err),
  );
}

export function subscribeOpenRooms(myUid: string, cb: (r: ArenaRoom[]) => void, onError?: (e: unknown) => void) {
  if (DEMO) { queueMicrotask(() => cb([])); return () => {}; }
  return onSnapshot(
    query(collection(db, "rooms"), where("status", "==", "waiting"), where("visibility", "==", "public"), fsLimit(20)),
    snap => {
      const cutoff = Date.now() - 45 * 60 * 1000;
      cb(
        snap.docs
          .map(d => roomFrom(d.id, d.data({ serverTimestamps: "estimate" }) as Record<string, any>))
          .filter(r => r.hostUid !== myUid && r.createdAt > cutoff)
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    },
    err => onError?.(err),
  );
}

/** Public matches in progress that anyone can watch (scores only). */
/**
 * Polled, not live. A live room document changes several times a second (every rep), and a listener is billed
 * one read for each change of each room, for everyone looking at the list. The list only needs "who is playing",
 * so it is fetched every 20 seconds (10 rooms at most). Opening a room to watch still shows live scores.
 */
export const LIVE_ROOMS_POLL_MS = 20_000;
export function subscribeLiveRooms(cb: (r: ArenaRoom[]) => void, onError?: (e: unknown) => void) {
  if (DEMO) { queueMicrotask(() => cb([])); return () => {}; }
  let stopped = false;
  const load = async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return; // nothing to show while the app is in the background
    try {
      const snap = await getDocs(query(collection(db, "rooms"), where("status", "==", "live"), where("visibility", "==", "public"), fsLimit(10)));
      if (stopped) return;
      const cutoff = Date.now() - 15 * 60 * 1000;
      cb(snap.docs
        .map(d => roomFrom(d.id, d.data({ serverTimestamps: "estimate" }) as Record<string, any>))
        .filter(r => (r.startedAt ?? r.createdAt) > cutoff)
        .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0)));
    } catch (e) { if (!stopped) onError?.(e); }
  };
  void load();
  const id = setInterval(() => void load(), LIVE_ROOMS_POLL_MS);
  return () => { stopped = true; clearInterval(id); };
}

/** Wins are recorded by the server referee; kept as a no-op for older call sites. */
export async function recordArenaResult(_uid: string, _won: boolean) { /* server-side */ }

export function subscribeArenaLeaderboard(cb: (p: SocialProfile[]) => void, onError?: (e: unknown) => void) {
  return sharedQuery<SocialProfile[]>("arena-wins", (emit, fail) => rawArenaLeaderboard(emit, fail), cb, onError);
}
function rawArenaLeaderboard(cb: (p: SocialProfile[]) => void, onError?: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, "users"), orderBy("arenaWins", "desc"), fsLimit(25)),
    snap => cb(snap.docs.map(d => normalizeProfile(d.id, d.data() as Record<string, any>)).filter(p => (p.arenaWins || 0) > 0)),
    err => onError?.(err),
  );
}


/** Public account: the server auto-accepts follows (and waiting requests). Private: approve each request. */
export async function setAccountPublic(uid: string, isPublic: boolean) {
  await withTimeout(setDoc(doc(db, "users", uid), { accountPublic: isPublic }, { merge: true }), 10000, "Saving privacy");
}
