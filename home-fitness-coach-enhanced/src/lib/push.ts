/**
 * Push notifications (FCM) for the native app. The token is stored under
 * users/{uid}/devices/{token}; the server sends to those tokens.
 * Requires: npm i @capacitor/push-notifications && npx cap sync android
 */
import { Capacitor } from "@capacitor/core";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

let currentToken: string | null = null;
let listening = false;

async function plugin() {
  // @ts-ignore - installed with `npm i @capacitor/push-notifications`
  const m = await import("@capacitor/push-notifications");
  return m.PushNotifications;
}

export async function registerPush(uid: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const PN = await plugin();
    let perm = await PN.checkPermissions();
    if (perm.receive === "prompt") perm = await PN.requestPermissions();
    if (perm.receive !== "granted") return;
    if (!listening) {
      listening = true;
      await PN.addListener("registration", (t: { value: string }) => {
        currentToken = t.value;
        void setDoc(doc(db, "users", uid, "devices", t.value), { platform: "android", updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      });
      await PN.addListener("registrationError", () => {});
    }
    await PN.register();
  } catch { /* plugin missing or no Play services */ }
}

export async function unregisterPush(uid: string) {
  if (!currentToken) return;
  try { await deleteDoc(doc(db, "users", uid, "devices", currentToken)); } catch { /* ignore */ }
  currentToken = null;
}
