/**
 * Activity inbox + live notifier.
 * - Other users' actions (likes, comments, follows) are written to
 *   notifs/{targetUid}/items by the actor.
 * - While the app process is alive, startNotifier() listens for new items
 *   and new chat messages and raises a local notification (sound / silent /
 *   off per category from notifyPrefs).
 * - It also stamps incoming chats as "delivered" so the sender sees ✓✓.
 * NOTE: when the OS has fully killed the app nothing runs; true background
 * push needs FCM + a server (Cloud Functions).
 */
import {
  collection, doc, onSnapshot, query, serverTimestamp, setDoc, where, limit as fsLimit,
} from "firebase/firestore";
import { db } from "./firebase";
import { showSocialNotification, loadSocialPrefs, onSocialPrefsChange, type NotifCategory } from "./notifyPrefs";
import { registerPush, unregisterPush } from "./push";
import { getProfile } from "./social";

export type NotifType = "like" | "comment" | "follow" | "follow_request" | "follow_accepted" | "new_reel" | "group" | "challenge" | "challenge_result";

const TYPE_TO_CAT: Record<NotifType, NotifCategory> = {
  like: "likes", comment: "comments", follow: "follows", follow_request: "follows",
  follow_accepted: "follows", new_reel: "newReels", group: "groups", challenge: "follows", challenge_result: "follows",
};

/** Notifications are created by the server (Cloud Functions). Kept as no-ops for older call sites. */
export async function sendNotif(_to: string, _from: string, _fromName: string, _type: NotifType, _text: string) { /* server-side */ }
export async function notifyPostOwner(_postId: string, _me: { uid: string; name: string }, _type: "like" | "comment", _text: string) { /* server-side */ }

/* ---- active chat suppression ---- */
let activeChatId: string | null = null;
export const setActiveChat = (id: string | null) => { activeChatId = id; };

/* ---- notifier ---- */
let stop: (() => void) | null = null;
let startedFor: string | null = null;

export function startNotifier(uid: string) {
  if (startedFor === uid) return;
  stopNotifier();
  startedFor = uid;
  const syncPrefs = () => { void setDoc(doc(db, "users", uid), { notifPrefs: loadSocialPrefs() }, { merge: true }).catch(() => {}); };
  syncPrefs();
  const offPrefs = onSocialPrefsChange(syncPrefs);
  void registerPush(uid);
  // The OS shows push while the app is in the background; in-app alerts only while it is on screen.
  const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
  const bootMs = Date.now();
  const seenChat = new Map<string, number>();
  let chatsPrimed = false;
  const nameCache = new Map<string, string>();
  const nameOf = async (u: string) => {
    if (nameCache.has(u)) return nameCache.get(u)!;
    try { const p = await getProfile(u); const n = p?.displayName || "Someone"; nameCache.set(u, n); return n; } catch { return "Someone"; }
  };

  const unsubChats = onSnapshot(
    query(collection(db, "chats"), where("members", "array-contains", uid)),
    snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type === "removed") return;
        const x = ch.doc.data({ serverTimestamps: "estimate" }) as Record<string, any>;
        const updated = x.updatedAt?.toMillis ? x.updatedAt.toMillis() : 0;
        const incoming = x.lastSender && x.lastSender !== uid;
        const prev = seenChat.get(ch.doc.id) ?? 0;
        seenChat.set(ch.doc.id, updated);
        if (!incoming || updated <= prev) return;
        const deliveredMs = x.deliveredAt?.[uid]?.toMillis ? x.deliveredAt[uid].toMillis() : 0;
        if (deliveredMs < updated) {
          void setDoc(ch.doc.ref, { deliveredAt: { [uid]: serverTimestamp() } }, { merge: true }).catch(() => {});
        }
        if (!chatsPrimed || updated < bootMs - 60_000 || !visible()) return; // don't spam old messages on launch
        if (activeChatId === ch.doc.id) return;
        void nameOf(x.lastSender).then(n => showSocialNotification("chats", n, String(x.lastMessage || "New message")));
      });
      chatsPrimed = true;
    },
    () => {},
  );

  const unsubItems = onSnapshot(
    query(collection(db, "notifs", uid, "items"), where("createdAt", ">", new Date(bootMs - 5000)), fsLimit(30)),
    snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type !== "added" || ch.doc.metadata.hasPendingWrites) return;
        const x = ch.doc.data() as any;
        const type = x.type as NotifType;
        const cat = TYPE_TO_CAT[type];
        if (!cat || !visible()) return;
        const name = x.fromName || "Someone";
        const title =
          type === "like" ? `${name} liked your post` :
          type === "comment" ? `${name} commented` :
          type === "follow_request" ? `${name} wants to follow you` :
          type === "follow" ? `${name} started following you` :
          type === "follow_accepted" ? `${name} accepted your request` :
          type === "new_reel" ? `${name} posted a new reel` :
          type === "challenge" ? `${name} sent you a challenge` :
          type === "challenge_result" ? "Challenge finished" : name;
        void showSocialNotification(cat, title, x.text || "");
      });
    },
    () => {},
  );

  stop = () => { unsubChats(); unsubItems(); offPrefs(); };
}

export function stopNotifier() {
  if (startedFor) void unregisterPush(startedFor);
  stop?.(); stop = null; startedFor = null;
}
