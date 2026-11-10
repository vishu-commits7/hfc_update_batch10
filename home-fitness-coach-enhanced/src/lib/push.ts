/**
 * Push notifications (FCM) for the native app. The token is stored under
 * users/{uid}/devices/{token}; the server sends to those tokens.
 *
 * The permission is NOT asked at launch. registerPush() only registers the token when the user has
 * already allowed notifications. requestPushAfterFirstWorkout() asks once, right after a finished workout.
 */
import { Capacitor } from "@capacitor/core";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { ensureChannels } from "./notifyPrefs";

let currentToken: string | null = null;
let listening = false;
const ASKED_KEY = "ap_push_asked";

async function plugin() {
  // @ts-ignore - installed with `npm i @capacitor/push-notifications`
  const m = await import("@capacitor/push-notifications");
  return m.PushNotifications;
}

async function register(uid: string) {
  const PN = await plugin();
  await ensureChannels(); // the channels the server's pushes name must exist on the phone
  if (!listening) {
    listening = true;
    await PN.addListener("registration", (t: { value: string }) => {
      currentToken = t.value;
      void setDoc(doc(db, "users", uid, "devices", t.value), { platform: "android", updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    });
    await PN.addListener("registrationError", () => {});
  }
  await PN.register();
}

/** Registers this phone for push only if notifications are already allowed. Never shows a permission prompt. */
export async function registerPush(uid: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const PN = await plugin();
    const perm = await PN.checkPermissions();
    if (perm.receive === "granted") await register(uid);
  } catch { /* plugin missing or no Play services */ }
}

/** Asks for notification permission once, after the user finishes a workout, then registers the phone. */
export async function requestPushAfterFirstWorkout(uid: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (localStorage.getItem(ASKED_KEY)) return;
    localStorage.setItem(ASKED_KEY, "1");
  } catch { /* storage blocked: ask anyway */ }
  try {
    const PN = await plugin();
    let perm = await PN.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await PN.requestPermissions();
    if (perm.receive === "granted") await register(uid);
  } catch { /* plugin missing or no Play services */ }
}

export async function unregisterPush(uid: string) {
  if (!currentToken) return;
  try { await deleteDoc(doc(db, "users", uid, "devices", currentToken)); } catch { /* ignore */ }
  currentToken = null;
}
