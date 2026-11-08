/**
 * Lightweight crash/error reporting. Uncaught errors, unhandled promise rejections and React render
 * crashes are sent to the `logClientError` function, which stores them in the Firestore
 * `clientErrors` collection (Firebase console -> Firestore). Throttled and de-duplicated.
 */
import { Capacitor } from "@capacitor/core";
import { callFn } from "./functions";

const seen = new Set<string>();
let sent = 0;
const MAX_PER_SESSION = 8;

export function reportError(err: unknown, where = "app") {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err ?? "unknown"));
    const key = `${where}:${e.message}`.slice(0, 200);
    if (seen.has(key) || sent >= MAX_PER_SESSION) return;
    seen.add(key); sent++;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    void callFn("logClientError", {
      message: e.message,
      stack: e.stack || "",
      where,
      version: (import.meta as any).env?.VITE_APP_VERSION || "dev",
      platform: Capacitor.getPlatform(),
    }).catch(() => {});
  } catch { /* never throw from the error reporter */ }
}

export function installErrorLogging() {
  window.addEventListener("error", ev => reportError(ev.error || ev.message, "window.onerror"));
  window.addEventListener("unhandledrejection", ev => reportError(ev.reason, "unhandledrejection"));
}
