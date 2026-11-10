/**
 * One Firestore listener per key, shared by every screen that asks for it, and kept alive for a short while
 * after the last screen leaves. Re-opening a tab within that time costs no reads (a fresh listener re-reads
 * every row), and the data stays live, so nothing goes stale.
 */
type Start<T> = (emit: (v: T) => void, fail: (e: unknown) => void) => () => void;
interface Entry<T> { stop: () => void; last?: { v: T }; subs: Set<{ cb: (v: T) => void; err?: (e: unknown) => void }>; timer: ReturnType<typeof setTimeout> | null }
const live = new Map<string, Entry<any>>();
export const LINGER_MS = 60_000;

export function sharedQuery<T>(key: string, start: Start<T>, cb: (v: T) => void, onError?: (e: unknown) => void, lingerMs = LINGER_MS): () => void {
  let e = live.get(key) as Entry<T> | undefined;
  if (!e) {
    const entry: Entry<T> = { stop: () => {}, subs: new Set(), timer: null };
    live.set(key, entry);
    entry.stop = start(
      v => { entry.last = { v }; entry.subs.forEach(s => s.cb(v)); },
      err => { live.delete(key); const subs = [...entry.subs]; entry.subs.clear(); try { entry.stop(); } catch { /* already closed */ } subs.forEach(s => s.err?.(err)); },
    );
    e = entry;
  }
  const entry = e;
  if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
  const sub = { cb, err: onError };
  entry.subs.add(sub);
  if (entry.last) { const { v } = entry.last; queueMicrotask(() => { if (entry.subs.has(sub)) cb(v); }); }
  return () => {
    entry.subs.delete(sub);
    if (entry.subs.size === 0 && live.get(key) === entry && !entry.timer) {
      entry.timer = setTimeout(() => { if (entry.subs.size === 0 && live.get(key) === entry) { live.delete(key); entry.stop(); } }, lingerMs);
    }
  };
}

/** Sign-out: drop everything (the next account must not see the last one's cached rows). */
export function clearSharedQueries() {
  live.forEach(e => { if (e.timer) clearTimeout(e.timer); try { e.stop(); } catch { /* ignore */ } });
  live.clear();
}
