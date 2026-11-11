/**
 * Remote switches. The sign-in gate can be flipped without a new app release:
 *   "login-first"        sign in before anything else (default)
 *   "after-first-workout" the first workout is free, the sign-in gate appears right after it
 *
 * To change it: in the Firebase console open Firestore > appConfig > auth (create the document if needed)
 * and set the text field `gate` to either value. Phones pick it up on their next launch (the value is
 * cached, so the screen never flips in the middle of a session). `VITE_AUTH_GATE` sets the build default.
 */
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export type AuthGate = "login-first" | "after-first-workout";

const CACHE_KEY = "ap_auth_gate";
const norm = (v: unknown): AuthGate | null => (v === "login-first" || v === "after-first-workout" ? v : null);
const BUILD_DEFAULT: AuthGate = norm((import.meta as any).env?.VITE_AUTH_GATE) ?? "login-first";

let current: AuthGate | null = null;

/** The gate mode for this session. Decided once per launch from the cache, then the build default. */
export function getAuthGate(): AuthGate {
  if (current) return current;
  let cached: AuthGate | null = null;
  try { cached = norm(localStorage.getItem(CACHE_KEY)); } catch { /* storage blocked */ }
  current = cached ?? BUILD_DEFAULT;
  // refresh the cache for the NEXT launch; failures are fine (offline, rules not deployed yet)
  void getDoc(doc(db, "appConfig", "auth"))
    .then(s => { const v = norm(s.data()?.gate); if (v) { try { localStorage.setItem(CACHE_KEY, v); } catch { /* ignore */ } } })
    .catch(() => {});
  return current;
}
