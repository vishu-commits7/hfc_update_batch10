/**
 * React hooks over lib/social.ts. Each hook shares ONE Firestore listener per
 * signed-in user (ref-counted) so many components can read "me" cheaply.
 */
import { DEMO, demoIdentity } from "../../core/demo";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuthUser } from "../../core/useAuth";
import {
  AVATAR_KEY, ensureProfile, subscribeProfile, subscribeFollowEdges, slugHandle, updateMyProfile,
  type SocialProfile, type FollowEdges,
} from "./social";
import { compressImageToDataUrl } from "../../core/imageCompress";

/* ------------------------------ avatar ------------------------------ */

export function readLocalAvatar(): string | null {
  try { return localStorage.getItem(AVATAR_KEY); } catch { return null; }
}

/** Compresses a picked photo, stores it on-device, and (if signed in) on the profile. */
export async function setMyAvatarFromFile(file: File, uid?: string | null): Promise<string> {
  const dataUrl = await compressImageToDataUrl(file, 384, 0.8);
  try {
    localStorage.setItem(AVATAR_KEY, dataUrl);
  } catch { /* storage full: still shown this session via the event below */ }
  window.dispatchEvent(new Event("apex-avatar-changed"));
  if (uid) {
    try { await updateMyProfile(uid, { avatarUrl: dataUrl }); } catch { /* local copy is kept; will sync later */ }
  }
  return dataUrl;
}

/* --------------------------- my profile store --------------------------- */

interface MineState { uid: string | null; profile: SocialProfile | null; error: string | null; ready: boolean }
let mine: MineState = { uid: null, profile: null, error: null, ready: false };
const mineListeners = new Set<() => void>();
let mineUnsub: (() => void) | null = null;

const setMine = (next: Partial<MineState>) => {
  mine = { ...mine, ...next };
  mineListeners.forEach(l => l());
};

function startMine(uid: string, ensure: () => Promise<unknown>) {
  if (mine.uid === uid && mineUnsub) return;
  mineUnsub?.();
  setMine({ uid, profile: null, error: null, ready: false });
  ensure()
    .catch(e => setMine({ error: (e as Error)?.message || "profile" }))
    .finally(() => {
      if (mine.uid !== uid) return;
      mineUnsub = subscribeProfile(
        uid,
        p => setMine({ profile: p, ready: true, error: null }),
        e => setMine({ ready: true, error: (e as Error)?.message || "profile" }),
      );
    });
}

function stopMine() {
  mineUnsub?.();
  mineUnsub = null;
  setMine({ uid: null, profile: null, error: null, ready: false });
}

export interface MyIdentity {
  uid: string | null;
  signedIn: boolean;
  name: string;
  handle: string;
  avatar: string | null;
  bio: string;
  profile: SocialProfile | null;
  ready: boolean;
}

export function useMyIdentity(): MyIdentity {
  // DEMO is fixed for the life of the page, so this branch never changes the order of hooks
  return DEMO ? demoIdentity : useRealIdentity();
}
function useRealIdentity(): MyIdentity {
  const { user, loading } = useAuthUser();
  const [, force] = useState(0);

  useEffect(() => {
    const bump = () => force(n => n + 1);
    window.addEventListener("apex-avatar-changed", bump);
    return () => window.removeEventListener("apex-avatar-changed", bump);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { stopMine(); return; }
    startMine(user.uid, () => ensureProfile(user));
  }, [user?.uid, loading]);

  const snap = useSyncExternalStore(
    cb => { mineListeners.add(cb); return () => { mineListeners.delete(cb); }; },
    () => mine,
  );

  const p = snap.uid && user && snap.uid === user.uid ? snap.profile : null;
  const name = p?.displayName || user?.displayName || user?.email?.split("@")[0] || "Athlete";
  return {
    uid: user?.uid ?? null,
    signedIn: !!user,
    name,
    handle: p?.handle || (user ? `${slugHandle(name)}_${user.uid.slice(0, 4).toLowerCase()}` : "athlete"),
    avatar: readLocalAvatar() || p?.avatarUrl || user?.photoURL || null,
    bio: p?.bio || "",
    profile: p,
    ready: snap.ready || !user,
  };
}

/* --------------------------- follow graph store --------------------------- */

const EMPTY: FollowEdges = { outgoing: new Map(), incoming: new Map() };
let edges: FollowEdges = EMPTY;
let edgesUid: string | null = null;
let edgesUnsub: (() => void) | null = null;
const edgeListeners = new Set<() => void>();

function startEdges(uid: string) {
  if (edgesUid === uid && edgesUnsub) return;
  edgesUnsub?.();
  edgesUid = uid;
  edges = EMPTY;
  edgesUnsub = subscribeFollowEdges(
    uid,
    e => { edges = e; edgeListeners.forEach(l => l()); },
    () => { /* rules not published yet: leave empty graph */ },
  );
}

export function useFollowEdges(): FollowEdges {
  const { user } = useAuthUser();
  useEffect(() => {
    if (!user) {
      edgesUnsub?.(); edgesUnsub = null; edgesUid = null; edges = EMPTY;
      edgeListeners.forEach(l => l());
      return;
    }
    startEdges(user.uid);
  }, [user?.uid]);
  return useSyncExternalStore(
    cb => { edgeListeners.add(cb); return () => { edgeListeners.delete(cb); }; },
    () => edges,
  );
}
