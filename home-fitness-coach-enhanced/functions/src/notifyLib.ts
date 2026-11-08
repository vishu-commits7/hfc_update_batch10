/** Notification helpers shared by every module: inbox item + FCM push, respecting the user's prefs. */
import "./init";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const db = getFirestore();

/* notifications                                                       */
/* ------------------------------------------------------------------ */

export type Cat = "chats" | "groups" | "follows" | "newReels" | "likes" | "comments";
export type NType = "like" | "comment" | "follow" | "follow_request" | "follow_accepted" | "new_reel" | "challenge" | "challenge_result";
const CAT: Record<NType, Cat> = {
  like: "likes", comment: "comments", follow: "follows", follow_request: "follows",
  follow_accepted: "follows", new_reel: "newReels", challenge: "follows", challenge_result: "follows",
};
const DEFAULT_MODE: Record<Cat, string> = {
  chats: "sound", groups: "sound", follows: "sound", newReels: "silent", likes: "silent", comments: "sound",
};

export async function nameOf(uid: string): Promise<string> {
  const s = await db.doc(`users/${uid}`).get();
  return (s.data()?.displayName as string) || "Someone";
}

export async function push(uid: string, cat: Cat, title: string, body: string, data: Record<string, string> = {}) {
  const userSnap = await db.doc(`users/${uid}`).get();
  const prefs = (userSnap.data()?.notifPrefs ?? {}) as Record<string, any>;
  if (prefs.all === false) return;
  const mode: string = prefs[cat] ?? DEFAULT_MODE[cat];
  if (mode === "off") return;
  const devices = await db.collection(`users/${uid}/devices`).get();
  if (devices.empty) return;
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

