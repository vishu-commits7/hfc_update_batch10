/** People I have blocked. One shared listener; hooks read from it. */
import { useSyncExternalStore } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import { callFn } from "./functions";

let blocked: ReadonlySet<string> = new Set();
let owner: string | null = null;
let unsub: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

/** Called by the notifier when the signed-in user changes. */
export function startBlocks(uid: string | null) {
  if (owner === uid) return;
  unsub?.(); unsub = null; owner = uid;
  blocked = new Set(); emit();
  if (!uid) return;
  unsub = onSnapshot(collection(db, "users", uid, "blocks"), snap => {
    blocked = new Set(snap.docs.map(d => d.id)); emit();
  }, () => {});
}

export const isBlocked = (uid: string) => blocked.has(uid);

export function useBlocked(): ReadonlySet<string> {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => blocked,
    () => blocked,
  );
}

export async function blockUser(target: string) {
  const me = auth.currentUser?.uid;
  if (!me || me === target) return;
  await setDoc(doc(db, "users", me, "blocks", target), { at: serverTimestamp() });
}
export async function unblockUser(target: string) {
  const me = auth.currentUser?.uid;
  if (me) await deleteDoc(doc(db, "users", me, "blocks", target));
}

export type ReportReason = "spam" | "harassment" | "nudity" | "violence" | "hate" | "other";
export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam or scam" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "nudity", label: "Nudity or sexual content" },
  { id: "violence", label: "Violence or dangerous acts" },
  { id: "hate", label: "Hate speech" },
  { id: "other", label: "Something else" },
];

export function reportContent(p: {
  type: "user" | "reel" | "comment" | "message";
  targetId: string;
  ownerUid?: string;
  audience?: "public" | "followers";
  reason: ReportReason;
  details?: string;
}) {
  return callFn("reportContent", p as unknown as Record<string, unknown>);
}
