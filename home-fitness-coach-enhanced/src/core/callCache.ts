/**
 * Last-known answers from the server, kept on the phone.
 *
 * A server function can take a few seconds when it has been idle ("cold start"). Screens used to show a spinner
 * for all of that time on every visit. Now a screen shows the last answer at once and swaps in the fresh one when
 * it arrives ("stale-while-revalidate"). Nothing here is trusted for rewards: the server still decides everything.
 * Keys carry the user id, so one account never sees another's data on a shared phone.
 */
const PREFIX = "ap_cc_";
const DAY = 86_400_000;

export function readCache<T>(key: string | null, maxAgeMs = 7 * DAY): T | null {
  if (!key) return null;
  try {
    const x = JSON.parse(localStorage.getItem(PREFIX + key) || "null");
    if (x && Date.now() - Number(x.at) < maxAgeMs) return x.v as T;
  } catch { /* nothing stored, or storage blocked */ }
  return null;
}

export function writeCache(key: string | null, value: unknown) {
  if (!key) return;
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, at: Date.now() })); } catch { /* storage full or blocked */ }
}

/** Drops every cached answer (sign-out). */
export function clearCallCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

/** Today's date in India (YYYY-MM-DD), the day the server uses for daily things. */
export function istDayKey(now = Date.now()): string {
  return new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
}
