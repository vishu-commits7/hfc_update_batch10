/**
 * Product analytics (Firebase Analytics / GA4). Safe everywhere: if analytics isn't supported in this
 * WebView, or the user is offline, calls are queued briefly and then dropped; nothing ever throws.
 * No personal data is sent: only event names and small counters.
 */
import { getAnalytics, isSupported, logEvent, setUserId, type Analytics } from "firebase/analytics";
import { firebaseApp } from "./firebase";

let analytics: Analytics | null = null;
let ready = false;
const queue: Array<[string, Record<string, string | number | boolean> | undefined]> = [];

export function initAnalytics() {
  if (ready) return;
  isSupported()
    .then(ok => { if (ok) analytics = getAnalytics(firebaseApp); })
    .catch(() => {})
    .finally(() => {
      ready = true;
      if (analytics) for (const [n, p] of queue) { try { logEvent(analytics, n, p); } catch { /* ignore */ } }
      queue.length = 0;
    });
}

export function track(name: string, params?: Record<string, string | number | boolean>) {
  try {
    if (!ready) { if (queue.length < 30) queue.push([name, params]); return; }
    if (analytics) logEvent(analytics, name, params);
  } catch { /* analytics must never break the app */ }
}

/** Fires an event only the first time ever on this device (e.g. first_workout). */
export function trackOnce(name: string, params?: Record<string, string | number | boolean>) {
  try {
    const k = `ap_once_${name}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
  } catch { /* storage blocked: fall through and just track */ }
  track(name, params);
}

export function setAnalyticsUser(uid: string | null) {
  try { if (analytics) setUserId(analytics, uid); } catch { /* ignore */ }
}

const dayNumber = (d: Date) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

/** Logs return_day_1 / return_day_7 the first time the app is opened that many calendar days after install. */
export function trackReturnDays() {
  try {
    const k = "ap_first_open";
    let first = localStorage.getItem(k);
    if (!first) { first = String(Date.now()); localStorage.setItem(k, first); trackOnce("first_open"); return; }
    const diff = dayNumber(new Date()) - dayNumber(new Date(Number(first)));
    if (diff === 1) trackOnce("return_day_1");
    else if (diff >= 7 && diff <= 8) trackOnce("return_day_7");
  } catch { /* ignore */ }
}
