/** Notification helpers shared by every module: inbox item + FCM push, respecting the user's prefs. */
import "./init";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const db = getFirestore();

/* notifications                                                       */
/* ------------------------------------------------------------------ */

export type Cat = "chats" | "groups" | "follows" | "newReels" | "likes" | "comments" | "streak" | "challenge" | "rematch" | "crew";

/**
 * "Engagement" pushes (streak at risk, challenges, rematch, crew) share ONE push per user per local day and are
 * never sent during quiet hours (22:00-07:00 in the user's own time). Chats, follows, likes and so on are not capped.
 * A push that is blocked is dropped, not delayed.
 */
const ENGAGEMENT = new Set<Cat>(["streak", "challenge", "rematch", "crew"]);
const DAILY_CAP = 1;
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 7;
const DEFAULT_OFFSET_MIN = 330; // India, when the phone has not reported its timezone yet

const cleanOffset = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= -720 && n <= 840 ? Math.round(n) : DEFAULT_OFFSET_MIN; };
const localHour = (offsetMin: number, now = Date.now()) => new Date(now + offsetMin * 60_000).getUTCHours();
const localDay = (offsetMin: number, now = Date.now()) => new Date(now + offsetMin * 60_000).toISOString().slice(0, 10);
export const inQuietHours = (offsetMin: number, now = Date.now()) => { const h = localHour(offsetMin, now); return h >= QUIET_START_HOUR || h < QUIET_END_HOUR; };

/** Takes today's single engagement-push slot for this user. false = already used today. */
async function takeDailySlot(uid: string, offsetMin: number): Promise<boolean> {
  const ref = db.doc(`pushState/${uid}`);
  const day = localDay(offsetMin);
  return db.runTransaction(async tx => {
    const s = await tx.get(ref);
    const used = s.exists && s.data()!.day === day ? Number(s.data()!.n || 0) : 0;
    if (used >= DAILY_CAP) return false;
    tx.set(ref, { day, n: used + 1, at: FieldValue.serverTimestamp() });
    return true;
  });
}
export type NType = "like" | "comment" | "follow" | "follow_request" | "follow_accepted" | "new_reel" | "challenge" | "challenge_result";
const CAT: Record<NType, Cat> = {
  like: "likes", comment: "comments", follow: "follows", follow_request: "follows",
  follow_accepted: "follows", new_reel: "newReels", challenge: "challenge", challenge_result: "challenge",
};
const DEFAULT_MODE: Record<Cat, string> = {
  chats: "sound", groups: "sound", follows: "sound", newReels: "silent", likes: "silent", comments: "sound",
  streak: "sound", challenge: "sound", rematch: "sound", crew: "sound",
};

export async function nameOf(uid: string): Promise<string> {
  const s = await db.doc(`users/${uid}`).get();
  return (s.data()?.displayName as string) || "Someone";
}

export async function push(uid: string, cat: Cat, title: string, body: string, data: Record<string, string> = {}): Promise<boolean> {
  const userSnap = await db.doc(`users/${uid}`).get();
  const prefs = (userSnap.data()?.notifPrefs ?? {}) as Record<string, any>;
  if (prefs.all === false) return false;
  const mode: string = prefs[cat] ?? DEFAULT_MODE[cat];
  if (mode === "off") return false;                       // the user turned this type off
  const devices = await db.collection(`users/${uid}/devices`).get();
  if (devices.empty) return false;
  if (ENGAGEMENT.has(cat)) {
    const offset = cleanOffset(userSnap.data()?.tzOffset);
    if (inQuietHours(offset)) return false;               // quiet hours
    if (!(await takeDailySlot(uid, offset))) return false; // one engagement push per day
  }
  const tokens = devices.docs.map(d => d.id);
  const res = await getMessaging().sendEach(
    tokens.map(token => ({
      token,
      notification: { title, body: body.slice(0, 160) },
      data,
      android: {
        priority: "high" as const,
        notification: { channelId: mode === "silent" ? "social_silent" : "social_sound" },
      },
    })),
  );
  const dead: Promise<unknown>[] = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code ?? "";
    if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
      dead.push(db.doc(`users/${uid}/devices/${tokens[i]}`).delete());
    }
  });
  await Promise.all(dead);
  return true;
}

function title(type: NType, name: string) {
  switch (type) {
    case "like": return `${name} liked your post`;
    case "comment": return `${name} commented`;
    case "follow": return `${name} started following you`;
    case "follow_request": return `${name} wants to follow you`;
    case "follow_accepted": return `${name} accepted your request`;
    case "new_reel": return `${name} posted a new reel`;
    case "challenge": return `${name} challenged you`;
    case "challenge_result": return "Challenge finished";
  }
}

export async function notify(to: string, from: string, type: NType, text: string) {
  if (!to || to === from) return;
  const fromName = await nameOf(from);
  await db.collection(`notifs/${to}/items`).add({ from, fromName, type, text: text.slice(0, 140), createdAt: FieldValue.serverTimestamp() });
  await push(to, CAT[type], title(type, fromName), text, { type, from });
}

