/**
 * Firestore + Storage layer for the public Community Gallery — posts,
 * likes and comments shared across everyone using the app (as opposed to
 * the private, on-device-only Progress Gallery in ProgressTracker).
 *
 * Schema:
 *   posts/{postId}            { uid, displayName, avatarUrl, photoUrl, caption, createdAt, likeCount, likedBy: uid[] }
 *   posts/{postId}/comments/{commentId}  { uid, displayName, text, createdAt }
 */
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query,
  orderBy, limit as fsLimit, serverTimestamp, arrayUnion, arrayRemove,
  increment, getDocs, where, Timestamp, limitToLast,
} from "firebase/firestore";
import { sharedQuery } from "./sharedQuery";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase";

export interface CommunityPost {
  id: string;
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  photoUrl: string;
  caption: string;
  createdAt: Timestamp | null;
  likeCount: number;
  likedBy: string[];
}

export interface CommunityComment {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  createdAt: Timestamp | null;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  streakDays: number;
  totalWorkouts: number;
}

/** Ranks public profiles by total workouts (ties broken by streak). Reads
 *  are ordered by a single field only (no `where` combined with `orderBy`)
 *  so it never needs a manually-created Firestore composite index — the
 *  `public` filter is applied client-side after the top results come back. */
export function subscribeToLeaderboard(cb: (entries: LeaderboardEntry[]) => void, max = 50, onError?: (e: unknown) => void) {
  return sharedQuery<LeaderboardEntry[]>(`community-board:${max}`, (emit, fail) => rawLeaderboard(emit, max, fail), cb, onError);
}
function rawLeaderboard(cb: (entries: LeaderboardEntry[]) => void, max: number, onError?: (e: unknown) => void) {
  const q = query(collection(db, "users"), orderBy("totalWorkouts", "desc"), fsLimit(max));
  return onSnapshot(q, snap => {
    const entries: LeaderboardEntry[] = snap.docs
      .map(d => d.data() as any)
      .filter(u => u.public !== false && (u.totalWorkouts || 0) > 0)
      .map(u => ({
        uid: u.uid,
        displayName: u.displayName || "Anonymous",
        avatarUrl: u.avatarUrl ?? null,
        streakDays: u.streakDays || 0,
        totalWorkouts: u.totalWorkouts || 0,
      }));
    cb(entries);
  }, err => { console.warn("Leaderboard notice:", err); onError?.(err); });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

/** Stores the (already compressed) photo directly on the post document as a data URL,
 *  so posting works on the free plan with no Firebase Storage bucket or rules. */
export async function createPost(opts: {
  uid: string; displayName: string; avatarUrl: string | null; caption: string; photoBlob: Blob;
}) {
  const photoUrl = await blobToDataUrl(opts.photoBlob);
  if (photoUrl.length > 900_000) throw new Error("That photo is too large. Pick a smaller one.");
  await addDoc(collection(db, "posts"), {
    uid: opts.uid,
    displayName: opts.displayName,
    avatarUrl: opts.avatarUrl,
    photoUrl,
    caption: opts.caption,
    createdAt: serverTimestamp(),
    likeCount: 0,
    likedBy: [],
  });
}

export function subscribeToFeed(cb: (posts: CommunityPost[]) => void, max = 30, onError?: (e: unknown) => void) {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), fsLimit(max));
  return onSnapshot(
    q,
    snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<CommunityPost, "id">) })));
    },
    err => {
      console.warn("Firestore subscribeToFeed notice (rules/offline):", err);
      onError?.(err);
    }
  );
}

export async function toggleLike(postId: string, uid: string, currentlyLiked: boolean) {
  const postRef = doc(db, "posts", postId);
  await updateDoc(postRef, {
    likedBy: currentlyLiked ? arrayRemove(uid) : arrayUnion(uid),
    likeCount: increment(currentlyLiked ? -1 : 1),
  });
  if (!currentlyLiked) {
    void import("./inbox").then(m => m.notifyPostOwner(postId, { uid, name: "Someone" }, "like", "Tap to see who"));
  }
}

export function subscribeToComments(postId: string, cb: (comments: CommunityComment[]) => void, onError?: (e: unknown) => void) {
  const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"), limitToLast(100)); // newest 100
  return onSnapshot(
    q,
    snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<CommunityComment, "id">) })));
    },
    err => {
      console.warn("Firestore subscribeToComments notice (rules/offline):", err);
      onError?.(err);
    }
  );
}

export async function addComment(postId: string, uid: string, displayName: string, text: string) {
  await addDoc(collection(db, "posts", postId, "comments"), {
    uid, displayName, text, createdAt: serverTimestamp(),
  });
  void import("./inbox").then(m => m.notifyPostOwner(postId, { uid, name: displayName }, "comment", text));
}

export async function deletePost(post: CommunityPost & { storagePath?: string }) {
  await deleteDoc(doc(db, "posts", post.id));
  if (post.storagePath) {
    try { await deleteObject(ref(storage, post.storagePath)); } catch { /* already gone, ignore */ }
  }
}

export async function fetchUserPosts(uid: string): Promise<CommunityPost[]> {
  const q = query(collection(db, "posts"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<CommunityPost, "id">) }));
}

/** Compresses + uploads an avatar image, returning its public URL. */
export async function uploadAvatar(uid: string, blob: Blob): Promise<string> {
  const path = `avatars/${uid}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(storageRef);
}
