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
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
