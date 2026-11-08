/**
 * Shared reels backend (Firestore only, no Storage bucket needed).
 *
 *  publicReels/{id}            reel metadata from PUBLIC accounts (everyone can read)
 *  publicReels/{id}/chunks/{n} the media itself, split into ~850 KB binary chunks
 *  followerReels/{id}(+chunks) same shape, for PRIVATE accounts (accepted followers only)
 *
 * The media doc is written LAST so a half-uploaded reel never appears in feeds.
 * Limit: MAX_BYTES per reel (keep clips short).
 */
import {
  Bytes, collection, deleteDoc, doc, getDoc, getDocs, limit as fsLimit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { getProfile } from "./social";
import { callFn } from "./functions";
import { ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";

export const MAX_REEL_BYTES = 25 * 1024 * 1024;
const MAX_CHUNK_FALLBACK = 8 * 1024 * 1024;
const CHUNK = 850 * 1024;

export interface SharedReel {
  id: string;
  ownerUid: string;
  ownerName: string;
  ownerHandle: string;
  ownerAvatar: string | null;
  type: "video" | "photo";
  mime: string;
  caption: string;
  badge: string;
  musicTrack: string;
  filter: string;
  speed: number;
  chunkCount: number;
  mediaUrl?: string;
  mediaPath?: string;
  createdAt: number;
  audience: "public" | "followers";
  /** server-maintained */
  likeCount: number;
  commentCount: number;
  views: number;
  hidden: boolean;
  tags: string[];
  thumb: string;
  trendScore: number;
}

const colFor = (aud: "public" | "followers") => (aud === "public" ? "publicReels" : "followerReels");
const toMs = (v: any) => (v?.toMillis ? v.toMillis() : typeof v === "number" ? v : Date.now());

function fromDoc(id: string, x: Record<string, any>, audience: "public" | "followers"): SharedReel {
  return {
    id,
    ownerUid: x.ownerUid,
    ownerName: x.ownerName || "Athlete",
    ownerHandle: x.ownerHandle || "athlete",
    ownerAvatar: x.ownerAvatar ?? null,
    type: x.type === "photo" ? "photo" : "video",
    mime: x.mime || "video/webm",
    caption: x.caption || "",
    badge: x.badge || "",
    musicTrack: x.musicTrack || "",
    filter: x.filter || "none",
    speed: x.speed || 1,
    chunkCount: x.chunkCount || 0,
    mediaUrl: x.mediaUrl || undefined,
    mediaPath: x.mediaPath || undefined,
    createdAt: toMs(x.createdAt),
    audience,
    likeCount: Number(x.likeCount) || 0,
    commentCount: Number(x.commentCount) || 0,
    views: Number(x.views) || 0,
    hidden: x.hidden === true,
    tags: Array.isArray(x.tags) ? x.tags.map(String) : [],
    thumb: typeof x.thumb === "string" ? x.thumb : "",
    trendScore: Number(x.trendScore) || 0,
  };
}

/** #hashtags in a caption: lowercase, unique, at most 5. */
export function extractTags(caption: string): string[] {
  const out: string[] = [];
  for (const m of caption.matchAll(/#([\p{L}\p{N}_]{2,30})/gu)) {
    const t = m[1].toLowerCase();
    if (!out.includes(t)) out.push(t);
    if (out.length >= 5) break;
  }
  return out;
}

/** Small JPEG (about 160px) from the first frame, for grids. Returns "" if the browser can't decode it. */
async function makeThumb(blob: Blob, type: "video" | "photo"): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const el: HTMLImageElement | HTMLVideoElement = type === "photo" ? new Image() : document.createElement("video");
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error("thumb timeout")), 6000);
      const ok = () => { clearTimeout(t); resolve(); };
      if (el instanceof HTMLVideoElement) {
        el.muted = true; el.playsInline = true; el.preload = "auto";
        el.onloadeddata = () => { el.currentTime = Math.min(0.2, (el.duration || 1) / 2); };
        el.onseeked = ok;
      } else el.onload = ok;
      el.onerror = () => { clearTimeout(t); reject(new Error("thumb decode")); };
      el.src = url;
    });
    const w = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
    const h = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
    if (!w || !h) return "";
    const scale = 160 / Math.max(w, h);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
    c.getContext("2d")?.drawImage(el, 0, 0, c.width, c.height);
    const data = c.toDataURL("image/jpeg", 0.6);
    return data.length < 30_000 ? data : "";
  } catch { return ""; } finally { URL.revokeObjectURL(url); }
}

export async function publishReel(opts: {
  uid: string;
  blobUrl: string;
  type: "video" | "photo";
  caption: string;
  badge: string;
  musicTrack: string;
  filter: string;
  speed: number;
  onProgress?: (pct: number) => void;
}): Promise<string> {
  const blob = await (await fetch(opts.blobUrl)).blob();
  if (blob.size > MAX_REEL_BYTES) {
    throw new Error(`This ${opts.type} is ${(blob.size / 1048576).toFixed(1)} MB. Max is ${MAX_REEL_BYTES / 1048576} MB; pick a shorter clip.`);
  }
  const profile = await getProfile(opts.uid);
  const publicAcct = (profile as any)?.accountPublic === true;
  const audience: "public" | "followers" = publicAcct ? "public" : "followers";
  const col = colFor(audience);
  const id = `${opts.uid.slice(0, 6)}${Date.now().toString(36)}`;
  const mime = blob.type || (opts.type === "photo" ? "image/jpeg" : "video/webm");
  const base = {
    ownerUid: opts.uid,
    ownerName: profile?.displayName || "Athlete",
    ownerHandle: profile?.handle || "athlete",
    ownerAvatar: null,
    type: opts.type,
    mime,
    caption: opts.caption.slice(0, 300),
    badge: opts.badge,
    musicTrack: opts.musicTrack,
    filter: opts.filter,
    speed: opts.speed,
    sizeBytes: blob.size,
    tags: extractTags(opts.caption),
    thumb: await makeThumb(blob, opts.type),
  };

  // 1) Preferred: Firebase Storage (fast, cheap, streams well).
  let stored: { url: string; path: string } | null = null;
  try {
    const path = `${audience === "followers" ? "reels-private" : "reels"}/${opts.uid}/${id}`;
    const task = uploadBytesResumable(sRef(storage, path), blob, { contentType: mime });
    await new Promise<void>((resolve, reject) => {
      task.on("state_changed",
        s => opts.onProgress?.(Math.round((s.bytesTransferred / s.totalBytes) * 95)),
        reject, () => resolve());
    });
    // private files can't be read by clients; followers get a signed URL from the server
    stored = { url: audience === "followers" ? "" : await getDownloadURL(task.snapshot.ref), path };
  } catch (e) {
    // 2) Fallback if Storage isn't enabled yet: chunked Firestore storage (small files only).
    if (blob.size > MAX_CHUNK_FALLBACK) {
      throw new Error("Upload failed. Check your connection, and make sure Firebase Storage is enabled.");
    }
    console.warn("Storage upload failed, falling back to Firestore chunks", e);
  }

  if (stored) {
    await setDoc(doc(db, col, id), { ...base, chunkCount: 0, ...(stored.url ? { mediaUrl: stored.url } : {}), mediaPath: stored.path, createdAt: serverTimestamp() });
  } else {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const count = Math.max(1, Math.ceil(buf.length / CHUNK));
    const written: string[] = [];
    try {
      for (let i = 0; i < count; i++) {
        const part = buf.slice(i * CHUNK, (i + 1) * CHUNK);
        const cref = doc(db, col, id, "chunks", String(i).padStart(4, "0"));
        await setDoc(cref, { i, ownerUid: opts.uid, data: Bytes.fromUint8Array(part) });
        written.push(cref.path);
        opts.onProgress?.(Math.round(((i + 1) / count) * 95));
      }
      await setDoc(doc(db, col, id), { ...base, chunkCount: count, createdAt: serverTimestamp() });
    } catch (e) {
      await Promise.all(written.map(p => deleteDoc(doc(db, p)).catch(() => {})));
      throw e;
    }
  }
  opts.onProgress?.(100);

  return id;
}

/** Live feed: public reels + reels from private accounts I follow + my own. */
export function subscribeReelFeed(
  me: string | null,
  followeeUids: string[],
  cb: (reels: SharedReel[]) => void,
  onError?: (e: unknown) => void,
) {
  const buckets = new Map<string, SharedReel[]>();
  const emit = () => {
    const all = [...buckets.values()].flat().filter(r => !r.hidden || r.ownerUid === me);
    const seen = new Set<string>();
    const out = all.filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    out.sort((a, b) => b.createdAt - a.createdAt);
    cb(out);
  };
  const unsubs: Array<() => void> = [];
  const listen = (key: string, q: ReturnType<typeof query>, aud: "public" | "followers") => {
    unsubs.push(onSnapshot(
      q,
      snap => { buckets.set(key, snap.docs.map(d => fromDoc(d.id, d.data() as Record<string, any>, aud))); emit(); },
      err => { if ((err as any)?.code !== "permission-denied") onError?.(err); },
    ));
  };
  listen("public", query(collection(db, "publicReels"), orderBy("createdAt", "desc"), fsLimit(40)), "public");
  if (me) listen("mine", query(collection(db, "followerReels"), where("ownerUid", "==", me), fsLimit(30)), "followers");
  followeeUids.slice(0, 15).forEach(uid =>
    listen(`f:${uid}`, query(collection(db, "followerReels"), where("ownerUid", "==", uid), fsLimit(10)), "followers"));
  return () => unsubs.forEach(u => u());
}

const mediaCache = new Map<string, Promise<string>>();

/** Download all chunks and return a playable blob: URL (cached in memory). */
export function loadReelMedia(reel: SharedReel): Promise<string> {
  if (reel.mediaUrl) return Promise.resolve(reel.mediaUrl);
  const hit = mediaCache.get(reel.id);
  if (hit) return hit;
  const p = (async () => {
    if (reel.audience === "followers" && reel.mediaPath) {
      const r = await callFn<{ url: string; expiresAt: number }>("getReelUrl", { reelId: reel.id });
      // signed URLs expire; drop the cache entry shortly before that
      setTimeout(() => mediaCache.delete(reel.id), Math.max(10_000, r.expiresAt - Date.now() - 5 * 60_000));
      return r.url;
    }
    const col = colFor(reel.audience);
    const snaps = await getDocs(query(collection(db, col, reel.id, "chunks"), orderBy("i", "asc")));
    if (snaps.empty) throw new Error("Media missing");
    const parts = snaps.docs.map(d => (d.data().data as Bytes).toUint8Array());
    const blob = new Blob(parts as BlobPart[], { type: reel.mime });
    return URL.createObjectURL(blob);
  })();
  mediaCache.set(reel.id, p);
  p.catch(() => mediaCache.delete(reel.id));
  return p;
}

export async function deleteReel(reel: SharedReel) {
  const col = colFor(reel.audience);
  const chunks = await getDocs(collection(db, col, reel.id, "chunks"));
  const batch = writeBatch(db);
  chunks.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, col, reel.id));
  await batch.commit();
  if (reel.mediaPath) { try { await deleteObject(sRef(storage, reel.mediaPath)); } catch { /* server cleans up too */ } }
  mediaCache.delete(reel.id);
}

export async function reelExists(reel: SharedReel) {
  return (await getDoc(doc(db, colFor(reel.audience), reel.id))).exists();
}

/* ---------------- grid, hashtags, trending ---------------- */

/** One user's reels, newest first. followerReels only resolve if I'm an accepted follower (or the owner). */
export function subscribeUserReels(uid: string, cb: (r: SharedReel[]) => void, onError?: () => void) {
  const buckets: Record<string, SharedReel[]> = { public: [], followers: [] };
  const emit = () => cb([...buckets.public, ...buckets.followers].filter(r => !r.hidden).sort((a, b) => b.createdAt - a.createdAt));
  const un = (["public", "followers"] as const).map(aud =>
    onSnapshot(
      query(collection(db, colFor(aud)), where("ownerUid", "==", uid), orderBy("createdAt", "desc"), fsLimit(30)),
      snap => { buckets[aud] = snap.docs.map(d => fromDoc(d.id, d.data({ serverTimestamps: "estimate" }) as Record<string, any>, aud)); emit(); },
      err => { buckets[aud] = []; emit(); if (aud === "public" && (err as any)?.code !== "permission-denied") onError?.(); }, // followers-only reels are expected to be denied for non-followers
    ));
  return () => un.forEach(u => u());
}

/** Public reels with a hashtag (private-account reels are never searchable). */
export function subscribeTagReels(tag: string, cb: (r: SharedReel[]) => void, onError?: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, "publicReels"), where("tags", "array-contains", tag.toLowerCase()), orderBy("createdAt", "desc"), fsLimit(40)),
    snap => cb(snap.docs.map(d => fromDoc(d.id, d.data({ serverTimestamps: "estimate" }) as Record<string, any>, "public")).filter(r => !r.hidden)),
    err => onError?.(err),
  );
}

/** Trending: ranked by the server job (recent likes, comments, views, with age decay). */
export function subscribeTrendingReels(cb: (r: SharedReel[]) => void, onError?: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, "publicReels"), where("trendScore", ">", 0), orderBy("trendScore", "desc"), fsLimit(30)),
    snap => cb(snap.docs.map(d => fromDoc(d.id, d.data({ serverTimestamps: "estimate" }) as Record<string, any>, "public")).filter(r => !r.hidden)),
    err => onError?.(err),
  );
}
