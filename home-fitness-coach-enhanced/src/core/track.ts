/**
 * Product analytics (Firebase Analytics / GA4). Event names live in analyticsEvents.ts.
 * On the Android app events go through the native Firebase SDK (ApexAnalyticsPlugin.java); on the website
 * they use the web SDK. Nothing here ever throws, and no personal data is sent: only event names and
 * small counters or fixed choices.
 */
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { firebaseApp } from "./firebase";
import { EV, type EventName, type EventParams } from "./analyticsEvents";

const ApexAnalytics = registerPlugin<{ log(o: { name: string; params?: EventParams }): Promise<void> }>("ApexAnalytics");
const isAndroidApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

let analytics: Analytics | null = null;
let ready = false;
const queue: Array<[EventName, EventParams | undefined]> = [];

function send(name: EventName, params?: EventParams) {
  if (isAndroidApp()) { void ApexAnalytics.log({ name, params }).catch(() => {}); return; }
  if (analytics) logEvent(analytics, name, params);
}

export function initAnalytics() {
  if (ready) return;
  if (isAndroidApp()) { ready = true; return; }
  isSupported()
    .then(ok => { if (ok) analytics = getAnalytics(firebaseApp); })
    .catch(() => {})
    .finally(() => {
      ready = true;
      for (const [n, p] of queue) { try { send(n, p); } catch { /* ignore */ } }
      queue.length = 0;
    });
}

export function track(name: EventName, params?: EventParams) {
  try {
    if (!ready) { if (queue.length < 30) queue.push([name, params]); return; }
    send(name, params);
  } catch { /* analytics must never break the app */ }
}

/** Fires an event only the first time ever on this device (e.g. first_workout_started). */
export function trackOnce(name: EventName, params?: EventParams) {
  try {
    const k = `ap_once_${name}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
  } catch { /* storage blocked: fall through and just track */ }
  track(name, params);
}

/** Kept so existing callers compile. A user id is deliberately NOT sent to analytics. */
export function setAnalyticsUser(_uid: string | null) { /* no user id in analytics */ }

const dayNumber = (d: Date) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

/** app_open on every launch, and return_d1 / return_d7 / return_d30 once each, by calendar days since the first launch. */
export function trackReturnDays() {
  try {
    track(EV.appOpen);
    const k = "ap_first_open";
    const first = localStorage.getItem(k);
    if (!first) { localStorage.setItem(k, String(Date.now())); return; }
    const diff = dayNumber(new Date()) - dayNumber(new Date(Number(first)));
    if (diff === 1) trackOnce(EV.returnD1);
    else if (diff >= 7 && diff <= 8) trackOnce(EV.returnD7);
    else if (diff >= 30 && diff <= 32) trackOnce(EV.returnD30);
  } catch { /* ignore */ }
}
