/**
 * Firebase project wiring — Authentication (email/password), Firestore
 * (the Community Gallery's posts/comments/likes) and Storage (the actual
 * uploaded photo files).
 *
 * This config block is the public, client-side "web app" config Firebase's
 * own console hands out for exactly this purpose — it identifies *which*
 * Firebase project the app talks to, it is not a secret credential. Real
 * access control lives in the Firestore/Storage security rules configured
 * in the console, not in keeping this value hidden.
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } from "firebase/app-check";
import { Capacitor, registerPlugin } from "@capacitor/core";

// Native Android App Check (Play Integrity / debug provider) — see ApexAppCheckPlugin.java.
const ApexAppCheck = registerPlugin<{ getToken(): Promise<{ token: string; expireTimeMillis: number }> }>("ApexAppCheck");

const firebaseConfig = {
  apiKey: "AIzaSyAWzHg12CHHF7Vla4-uk1t-c4QXz8CJoXE",
  authDomain: "fitness-app-1e5f0.firebaseapp.com",
  projectId: "fitness-app-1e5f0",
  storageBucket: "fitness-app-1e5f0.firebasestorage.app",
  messagingSenderId: "672829940611",
  appId: "1:672829940611:web:24a44a9af94be594b38cb6",
  measurementId: "G-NYSSGHD0EK",
};

// getApps()/getApp() guards against "Firebase App already exists" during
// Vite's hot-reload in dev, where this module can otherwise re-run.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// App Check proves requests come from the real app (blocks scripts that abuse your backend and bill).
// Optional until configured: set VITE_APPCHECK_SITE_KEY (reCAPTCHA v3 site key) in .env, then deploy
// with ENFORCE_APPCHECK=true in functions/.env. See BUGFIX_NOTES Batch 8.
if (typeof window !== "undefined") {
  const env = (import.meta as any).env || {};
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
      // Android app: the token comes from the native Play Integrity (or debug) provider.
      initializeAppCheck(firebaseApp, {
        provider: new CustomProvider({
          getToken: async () => {
            const r = await ApexAppCheck.getToken();
            return { token: r.token, expireTimeMillis: r.expireTimeMillis };
          },
        }),
        isTokenAutoRefreshEnabled: true,
      });
    } else if (env.VITE_APPCHECK_SITE_KEY) {
      // Website: reCAPTCHA v3 (optional until a site key is set).
      if (env.VITE_APPCHECK_DEBUG) (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG === "true" ? true : env.VITE_APPCHECK_DEBUG;
      initializeAppCheck(firebaseApp, { provider: new ReCaptchaV3Provider(env.VITE_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
    }
  } catch (e) { console.warn("App Check init failed", e); }
}

export const auth = getAuth(firebaseApp);

// Configure robust persistence to prevent state loss across mobile browser tabs and reloads
if (typeof window !== "undefined") {
  setPersistence(auth, indexedDBLocalPersistence).catch(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  });
}

export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
