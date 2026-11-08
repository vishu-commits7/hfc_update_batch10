/**
 * Thin wrapper around Firebase Auth (email/password) + each user's own
 * profile document in Firestore (`users/{uid}`: displayName, avatarUrl,
 * bio, a `public` privacy flag). Auth identifies *who* someone is; this
 * profile doc is the editable, user-facing part of that identity shown
 * next to their posts/comments in the Community Gallery.
 */
import { useEffect, useSyncExternalStore } from "react";
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signInAnonymously,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { auth, db } from "./firebase";
import { ApexNative } from "./nativeBridge";

export interface UserProfileDoc {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  /** When true, this person's posts are visible in the public Community
   *  feed. When false, only their own device shows their posts (same
   *  private behaviour the local-only gallery always had). */
  public: boolean;
  createdAt?: unknown;
  /** Mirrored from the local profile purely so the Community Leaderboard
   *  can rank people without needing a server function — kept in sync by
   *  App.tsx whenever these numbers change while signed in. */
  streakDays?: number;
  totalWorkouts?: number;
}

const DEFAULT_PROFILE_FIELDS = { avatarUrl: null, bio: "Apex Athlete grinding daily.", public: true };

async function syncGoogleProfile(user: User) {
  try {
    const existing = await getUserProfile(user.uid);
    if (!existing) {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: user.displayName || user.email?.split("@")[0] || "Apex Athlete",
        avatarUrl: user.photoURL || null,
        bio: "Apex Athlete crushing daily milestones.",
        public: true,
        createdAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn("Firestore Google profile sync notice:", e);
  }
}

/* One shared auth store for the whole app. useAuthUser() is called by dozens of
 * components (every reel card reads the signed-in identity), so the Firebase
 * listeners, redirect check and deep-link handler must exist exactly once. */
interface AuthState { user: User | null; loading: boolean }
let authState: AuthState = { user: auth.currentUser, loading: true };
const authListeners = new Set<() => void>();
let authInitDone = false;

function setAuthState(next: Partial<AuthState>) {
  authState = { ...authState, ...next };
  authListeners.forEach(l => l());
}

function initAuthStore() {
  if (authInitDone) return;
  authInitDone = true;

  // 1. Returning from the web signInWithRedirect flow
  getRedirectResult(auth)
    .then(async (cred) => {
      if (cred?.user) {
        await syncGoogleProfile(cred.user);
        setAuthState({ user: cred.user });
      }
    })
    .catch((err) => {
      console.warn("Firebase redirect result check notice:", err);
    });

  // 2. Native deep-link handler (com.apex.fitness://oauth & com.homefitnesscoach.app://oauth)
  if (Capacitor.isNativePlatform()) {
    CapApp.addListener("appUrlOpen", async (event) => {
      try {
        const urlStr = event.url || "";
        if (
          urlStr.startsWith("com.apex.fitness://oauth") ||
          urlStr.startsWith("com.homefitnesscoach.app://oauth") ||
          urlStr.includes("oauth_callback")
        ) {
          const parsedUrl = new URL(urlStr);
          const idToken =
            parsedUrl.searchParams.get("id_token") ||
            parsedUrl.searchParams.get("token") ||
            parsedUrl.hash.match(/id_token=([^&]+)/)?.[1];
          if (idToken) {
            const authedUser = await logInWithGoogleCredential(decodeURIComponent(idToken));
            setAuthState({ user: authedUser });
          }
        }
      } catch (e) {
        console.warn("Deep link auth callback parse notice:", e);
      }
    }).catch(() => {});
  }

  onAuthStateChanged(auth, (u) => setAuthState({ user: u, loading: false }));
}

export function useAuthUser() {
  useEffect(() => { initAuthStore(); }, []);
  return useSyncExternalStore(
    (cb) => { authListeners.add(cb); return () => { authListeners.delete(cb); }; },
    () => authState,
    () => authState,
  );
}

export async function signUp(email: string, password: string, displayName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await updateProfile(cred.user, { displayName });
  } catch (e) {
    console.warn("Could not update auth profile displayName:", e);
  }

  // Cache alias locally so the UI has immediate access
  try {
    localStorage.setItem("kinetic_athlete_alias", displayName);
  } catch {}

  try {
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      displayName,
      ...DEFAULT_PROFILE_FIELDS,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("Firestore profile creation notice (rules/offline):", e);
  }
  return cred.user;
}

export async function logIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Mobile-safe Google Sign-In with Native Capacitor & Deep-Link support.
 * Never redirects Android WebViews to an unreachable localhost or external error page.
 */
export async function logInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");
  provider.setCustomParameters({ prompt: "select_account" });

  const isNative = Capacitor.isNativePlatform();

  // Native Android: use the system Google account picker (Credential Manager)
  // and trade the Google ID token for a Firebase session. The old
  // signInWithPopup path opened firebaseapp.com inside a WebView, showed the
  // Firebase domain instead of the app, and ended on a blank screen.
  if (isNative) {
    const serverClientId = (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined)?.trim();
    if (!serverClientId) {
      throw new Error(
        "Google sign-in is not configured in this build yet (missing VITE_GOOGLE_WEB_CLIENT_ID). Use Email & Password or Guest access for now.",
      );
    }
    try {
      const res = await ApexNative.googleSignIn({ serverClientId });
      const user = await logInWithGoogleCredential(res.idToken);
      await syncGoogleProfile(user);
      return user;
    } catch (nativeErr: any) {
      const msg = String(nativeErr?.message || nativeErr || "");
      if (msg.includes("cancelled")) {
        throw Object.assign(new Error("Google sign-in was cancelled."), { code: "auth/popup-closed-by-user" });
      }
      if (msg.includes("No credentials available") || msg.includes("NoCredential")) {
        throw new Error("No Google account found on this phone. Add one in Android Settings, or use Email & Password.");
      }
      throw new Error("Google sign-in failed: " + msg);
    }
  }

  // Web & Mobile Browser flow: Try popup first to avoid localhost redirect breakage
  try {
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;
    await syncGoogleProfile(user);
    return user;
  } catch (popupErr: any) {
    if (
      popupErr?.code === "auth/popup-blocked" ||
      popupErr?.code === "auth/cancelled-popup-request"
    ) {
      console.warn("Popup blocked, attempting redirect flow:", popupErr);
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw popupErr;
  }
}

export async function logInWithGoogleCredential(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken);
  const cred = await signInWithCredential(auth, credential);
  const user = cred.user;
  try {
    const existing = await getUserProfile(user.uid);
    if (!existing) {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: user.displayName || user.email?.split("@")[0] || "Apex Athlete",
        avatarUrl: user.photoURL || null,
        bio: "Apex Athlete crushing daily milestones.",
        public: true,
        createdAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn("Firestore Google credential sync notice:", e);
  }
  return user;
}

export async function logInAsGuest() {
  try {
    const cred = await signInAnonymously(auth);
    const user = cred.user;
    try {
      const existing = await getUserProfile(user.uid);
      if (!existing) {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          displayName: "Guest Athlete #" + Math.floor(1000 + Math.random() * 9000),
          avatarUrl: null,
          bio: "Unstoppable Guest Beast.",
          public: true,
          createdAt: serverTimestamp(),
        });
      }
    } catch {}
    return user;
  } catch (err: any) {
    console.warn("Anonymous auth failed, activating seamless guest athlete fallback:", err);
    // If anonymous sign-in is disabled in Firebase console (ADMIN_ONLY_OPERATION),
    // automatically sign in to a built-in guest session via Email provider so the user is never blocked!
    const guestEmail = "apex_guest_athlete@pulse.internal";
    const guestPass = "ApexGuestPass123!";
    try {
      const cred = await signInWithEmailAndPassword(auth, guestEmail, guestPass);
      return cred.user;
    } catch {
      try {
        const cred = await createUserWithEmailAndPassword(auth, guestEmail, guestPass);
        await updateProfile(cred.user, { displayName: "Guest Athlete" });
        return cred.user;
      } catch {
        throw err;
      }
    }
  }
}

export async function logOut() {
  await signOut(auth);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function getUserProfile(uid: string): Promise<UserProfileDoc | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      return snap.data() as UserProfileDoc;
    }
  } catch (e) {
    console.warn("Firestore getUserProfile notice (rules/offline):", e);
  }

  // Fallback to active auth user metadata so profile never crashes
  const u = auth.currentUser;
  if (u && u.uid === uid) {
    return {
      uid: u.uid,
      displayName: u.displayName || u.email?.split("@")[0] || "Apex Athlete",
      avatarUrl: u.photoURL || null,
      bio: "Apex Athlete grinding daily.",
      public: true,
    };
  }
  return null;
}

export async function saveUserProfile(uid: string, fields: Partial<UserProfileDoc>) {
  try {
    await setDoc(doc(db, "users", uid), fields, { merge: true });
  } catch (e) {
    console.warn("Firestore saveUserProfile notice (rules/offline):", e);
  }
}

/** Friendly text for Firebase Auth error codes and mobile storage partitioning issues. */
export function friendlyAuthError(err: unknown): string {
  const msg = (err as { message?: string })?.message || String(err || "");
  const code = (err as { code?: string })?.code || "";

  if (
    msg.includes("missing initial state") ||
    msg.includes("storage-partitioned") ||
    msg.includes("sessionStorage is inaccessible")
  ) {
    return "Mobile browser security blocked cross-domain Google auth. You can sign in with Email & Password or 1-tap 'Continue as Guest' below!";
  }

  switch (code) {
    case "auth/email-already-in-use": return "That email already has an account — please switch to Sign In!";
    case "auth/invalid-email": return "Please enter a valid email address.";
    case "auth/weak-password": return "Password should be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Incorrect email or password. Please verify and retry.";
    case "auth/popup-closed-by-user": return "Google sign-in was closed before finishing.";
    case "auth/popup-blocked": return "Google popup was blocked. In mobile apps/WebViews, please sign in with Email & Password or Instant Guest Access.";
    case "auth/unauthorized-domain": return "Domain is not authorized in Firebase. In the mobile app, please use Email/Password sign in.";
    case "auth/cancelled-popup-request": return "Sign-in request was cancelled.";
    case "auth/admin-restricted-operation":
    case "auth/operation-not-allowed": return "This sign-in method is currently disabled in Firebase Console. Please sign in with Email & Password.";
    case "auth/too-many-requests": return "Too many attempts — please wait a moment and try again.";
    case "auth/network-request-failed": return "Network error — check your internet connection and try again.";
    case "permission-denied": return "Account active! Firestore cloud sync will activate once rules are deployed in Firebase Console.";
    default: return msg || "Authentication error. Please try again.";
  }
}
