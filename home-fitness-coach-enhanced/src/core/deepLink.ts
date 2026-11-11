/**
 * Opening the app from an invite link.
 *
 * A link (see joinLink in shareLink.ts) carries one thing: a crew code, a match room code or a friend's invite
 * code. Whatever opened it (Android App Link, the "Open in the app" button on the landing page, or the web app's
 * own address) ends up here as a "pending join". The Arena screens read it and pre-fill themselves.
 * It is kept for a day so it survives the sign-in screen on a fresh install.
 */
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { parseJoinLink, type JoinKind, type JoinTarget } from "./shareLink";

const KEY = "ap_pending_join";
const TTL_MS = 24 * 3600_000;
const EVENT = "apex-join";

function read(): (JoinTarget & { at: number }) | null {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || "null");
    if (x && typeof x.code === "string" && Date.now() - Number(x.at) < TTL_MS) return x;
  } catch { /* nothing stored */ }
  return null;
}

export function setPendingJoin(t: JoinTarget) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...t, at: Date.now() })); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent<JoinTarget>(EVENT, { detail: t }));
}

/** The waiting invite, if any (does not clear it). */
export function peekPendingJoin(): JoinTarget | null {
  const x = read();
  return x ? { kind: x.kind, code: x.code } : null;
}

/** Takes the waiting invite of this kind, so it is used once. */
export function takePendingJoin(kind: JoinKind): string | null {
  const x = read();
  if (!x || x.kind !== kind) return null;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return x.code;
}

/** Calls back whenever an invite link is opened while the app is running. */
export function onJoinLink(cb: (t: JoinTarget) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent<JoinTarget>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

let started = false;
/** Start listening. Safe to call more than once. */
export function initDeepLinks() {
  if (started) return;
  started = true;
  const handle = (url: string | undefined | null) => {
    if (!url) return;
    const t = parseJoinLink(url);
    if (t) setPendingJoin(t);
  };
  if (Capacitor.isNativePlatform()) {
    CapApp.addListener("appUrlOpen", e => handle(e.url)).catch(() => {});
    CapApp.getLaunchUrl().then(r => handle(r?.url)).catch(() => {}); // app was closed when the link was tapped
  } else if (typeof window !== "undefined" && /[?&](crew|room|invite)=/.test(window.location.search)) {
    handle(window.location.href);
    try { window.history.replaceState(null, "", window.location.pathname); } catch { /* ignore */ } // keep the code out of the address bar
  }
}
