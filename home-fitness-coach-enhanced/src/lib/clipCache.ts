import { allRemoteUrls, clipRemoteUrl, resolveClipId } from "../data/exerciseClips";

/**
 * Offline cache for exercise demo clips.
 *
 * A clip is downloaded once (they are under 1 MB), stored in the browser's
 * Cache Storage, and played from there afterwards, so a demo works on a plane.
 * Cache Storage is available in the Android WebView because the app is served
 * from https://localhost (capacitor.config.ts androidScheme).
 *
 * Fetching a clip from JavaScript needs the Storage bucket to allow CORS
 * (storage-cors.json). If it does not, downloadClip() throws, the player streams
 * the clip directly instead, and only the offline copy is missing.
 *
 * Total size is capped; the least recently used clips are dropped first.
 */

const CACHE_NAME = "apex-clips-v1";
const INDEX_KEY = "ap_clip_idx_v1";
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const MAX_ONE_BYTES = 3 * 1024 * 1024;

type Index = Record<string, { b: number; t: number }>;

function readIndex(): Index {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as Index) : {};
  } catch {
    return {};
  }
}

function writeIndex(idx: Index) {
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  } catch {
    /* storage blocked: the cache still works, it just forgets sizes */
  }
}

export const clipCacheSupported = () => typeof window !== "undefined" && "caches" in window;

export function isClipCached(url: string): boolean {
  return Boolean(readIndex()[url]);
}

async function evictIfNeeded(cache: Cache) {
  const idx = readIndex();
  let total = Object.values(idx).reduce((n, e) => n + e.b, 0);
  if (total <= MAX_TOTAL_BYTES) return;
  const oldest = Object.entries(idx).sort((a, b) => a[1].t - b[1].t);
  for (const [url, e] of oldest) {
    if (total <= MAX_TOTAL_BYTES) break;
    try {
      await cache.delete(url);
    } catch {
      /* ignore */
    }
    delete idx[url];
    total -= e.b;
  }
  writeIndex(idx);
}

const inFlight = new Map<string, Promise<Blob>>();

/** Downloads a clip and stores it. Throws when offline, blocked by CORS or not found. */
export function downloadClip(url: string): Promise<Blob> {
  const running = inFlight.get(url);
  if (running) return running;
  const p = (async () => {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`clip ${res.status}`);
    const blob = await res.blob();
    if (blob.size > MAX_ONE_BYTES) throw new Error("clip too large");
    if (clipCacheSupported()) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(url, new Response(blob, { headers: { "Content-Type": "video/mp4" } }));
        const idx = readIndex();
        idx[url] = { b: blob.size, t: Date.now() };
        writeIndex(idx);
        await evictIfNeeded(cache);
      } catch {
        /* quota or private mode: play it this once, just do not keep it */
      }
    }
    return blob;
  })().finally(() => inFlight.delete(url));
  inFlight.set(url, p);
  return p;
}

/** The stored clip as a blob, or null. Marks it as recently used. */
async function readCached(url: string): Promise<Blob | null> {
  if (!clipCacheSupported() || !isClipCached(url)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (!hit) return null;
    const idx = readIndex();
    if (idx[url]) {
      idx[url].t = Date.now();
      writeIndex(idx);
    }
    return await hit.blob();
  } catch {
    return null;
  }
}

/** Cached or freshly downloaded clip as an object URL. The caller must revoke it. */
export async function loadClip(url: string): Promise<{ objectUrl: string; fromCache: boolean }> {
  const cached = await readCached(url);
  if (cached) return { objectUrl: URL.createObjectURL(cached), fromCache: true };
  const blob = await downloadClip(url);
  return { objectUrl: URL.createObjectURL(blob), fromCache: false };
}

/** Quietly downloads clips for exercises coming up. Skips when offline or Data Saver is on. */
export async function prefetchClips(names: Array<string | null | undefined>): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.onLine) return;
  const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  for (const n of names) {
    const id = resolveClipId(n);
    const url = id ? clipRemoteUrl(id) : null;
    if (!url || isClipCached(url)) continue;
    try {
      await downloadClip(url);
    } catch {
      /* best effort */
    }
  }
}

let purged = false;
/** Drops stored clips whose file has since been replaced (their URL hash changed). */
export async function purgeStaleClips(): Promise<void> {
  if (purged || !clipCacheSupported()) return;
  purged = true;
  try {
    const valid = new Set(allRemoteUrls());
    const idx = readIndex();
    const cache = await caches.open(CACHE_NAME);
    let changed = false;
    for (const url of Object.keys(idx)) {
      if (!valid.has(url)) {
        await cache.delete(url);
        delete idx[url];
        changed = true;
      }
    }
    if (changed) writeIndex(idx);
  } catch {
    /* ignore */
  }
}
