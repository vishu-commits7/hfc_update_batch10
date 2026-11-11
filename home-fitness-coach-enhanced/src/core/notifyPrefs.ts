/**
 * Per-category notification preferences for social + reminder alerts.
 * Each category is one of: "sound" (banner + sound), "silent" (shows in the
 * tray, no sound, no vibration) or "off".
 */
import { LocalNotifications } from "@capacitor/local-notifications";

export type NotifMode = "sound" | "silent" | "off";
export type NotifCategory = "chats" | "groups" | "follows" | "newReels" | "likes" | "comments" | "streak" | "challenge" | "rematch" | "crew";

export interface SocialNotifPrefs {
  all: boolean; // master switch
  chats: NotifMode;
  groups: NotifMode;
  follows: NotifMode;
  newReels: NotifMode;
  likes: NotifMode;
  comments: NotifMode;
  // game alerts (the server sends at most 1 per day, never 22:00-07:00 your time)
  streak: NotifMode;
  challenge: NotifMode;
  rematch: NotifMode;
  crew: NotifMode;
}

export const DEFAULT_SOCIAL_PREFS: SocialNotifPrefs = {
  all: true,
  chats: "sound",
  groups: "sound",
  follows: "sound",
  newReels: "silent",
  likes: "silent",
  comments: "sound",
  streak: "sound",
  challenge: "sound",
  rematch: "sound",
  crew: "sound",
};

const KEY = "apex_social_notif_prefs";
const listeners = new Set<() => void>();

export function loadSocialPrefs(): SocialNotifPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SOCIAL_PREFS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SOCIAL_PREFS };
}

export function saveSocialPrefs(p: SocialNotifPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

export function onSocialPrefsChange(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

let channelsReady = false;
export async function ensureChannels() {
  if (channelsReady) return;
  channelsReady = true;
  try {
    await LocalNotifications.createChannel({
      id: "social_sound", name: "Messages & activity (sound)", importance: 4, vibration: true, visibility: 1,
    });
    await LocalNotifications.createChannel({
      id: "social_silent", name: "Messages & activity (silent)", importance: 2, vibration: false, visibility: 1,
    });
  } catch { /* web / unsupported */ }
}

let nid = Math.floor(Date.now() % 1_000_000) + 2000;

/** Show a notification for a category, respecting the user's mode. */
export async function showSocialNotification(cat: NotifCategory, title: string, body: string) {
  const prefs = loadSocialPrefs();
  if (!prefs.all || prefs[cat] === "off") return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      const r = await LocalNotifications.requestPermissions();
      if (r.display !== "granted") return;
    }
    await ensureChannels();
    nid = (nid + 1) % 2_000_000_000;
    await LocalNotifications.schedule({
      notifications: [{
        id: nid, title, body,
        channelId: prefs[cat] === "silent" ? "social_silent" : "social_sound",
      }],
    });
  } catch { /* ignore */ }
}

export async function requestPerm(): Promise<boolean> {
  try { return (await LocalNotifications.requestPermissions()).display === "granted"; } catch { return false; }
}
