/**
 * Thin wrapper around Firebase Auth (email/password) + each user's own
 * profile document in Firestore (`users/{uid}`: displayName, avatarUrl,
 * bio, a `public` privacy flag). Auth identifies *who* someone is; this
 * profile doc is the editable, user-facing part of that identity shown
 * next to their posts/comments in the Community Gallery.
 */
import { useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

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

const DEFAULT_PROFILE_FIELDS = { avatarUrl: null, bio: "", public: true };

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, loading };
}

export async function signUp(email: string, password: string, displayName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    displayName,
    ...DEFAULT_PROFILE_FIELDS,
    createdAt: serverTimestamp(),
  });
  return cred.user;
}

export async function logIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logOut() {
  await signOut(auth);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function getUserProfile(uid: string): Promise<UserProfileDoc | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfileDoc) : null;
}

export async function saveUserProfile(uid: string, fields: Partial<UserProfileDoc>) {
  await setDoc(doc(db, "users", uid), fields, { merge: true });
}

/** Friendly text for the handful of Firebase Auth error codes a person is
 *  actually likely to hit, instead of the raw "Firebase: Error (...)" string. */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || "";
  switch (code) {
    case "auth/email-already-in-use": return "That email already has an account — try logging in instead.";
    case "auth/invalid-email": return "That doesn't look like a valid email address.";
    case "auth/weak-password": return "Password should be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Email or password is incorrect.";
    case "auth/too-many-requests": return "Too many attempts — please wait a bit and try again.";
    case "auth/network-request-failed": return "Network error — check your connection and try again.";
    default: return "Something went wrong. Please try again.";
  }
}
