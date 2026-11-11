/** Where a shared card or message sends people: the app's Play Store listing. */
export const ANDROID_PACKAGE = "com.homefitnesscoach.app";

export type ShareSource = "arena" | "level" | "streak" | "session" | "milestone" | "app";

// Short codes keep the link at 84 characters, which is the most a small (37x37) QR code holds.
const CODE: Record<ShareSource, string> = { arena: "s_ar", level: "s_lv", streak: "s_st", session: "s_se", milestone: "s_mi", app: "s_ap" };

/**
 * An https Play Store link. On Android it opens the Play Store app straight on the listing; anywhere else it
 * opens the listing in the browser. `referrer` shows up in Play Console (Acquisition) so you can see which
 * kind of card brings installs: s_ar = Arena win, s_lv = level up, s_st = streak, s_se = session,
 * s_mi = milestone, s_ap = anything else.
 */
export function playStoreUrl(source: ShareSource = "app"): string {
  return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&referrer=${CODE[source]}`;
}

const NAME_PREF = "ap_share_name";
/** The user's choice to print their name on share cards. Off until they turn it on. */
export function getShowNameOnCards(): boolean {
  try { return localStorage.getItem(NAME_PREF) === "1"; } catch { return false; }
}
export function setShowNameOnCards(on: boolean) {
  try { if (on) localStorage.setItem(NAME_PREF, "1"); else localStorage.removeItem(NAME_PREF); } catch { /* private mode */ }
}

/* ------------------------------------------------------------------ */
/* Invite links                                                        */
/* ------------------------------------------------------------------ */

export type JoinKind = "crew" | "room" | "invite";

// Where invite links point. The server answers /join with a small landing page ("Open in the app" or "Get it on
// Google Play"), never the old web app. With Android App Links verified, the link opens the app directly.
// Change the address with VITE_APP_SHARE_URL (it must also be in AndroidManifest.xml, see BUGFIX_NOTES Batch 50).
let linkBase = "https://hfc-update-batch10.onrender.com";
/** Set once at start-up from the build settings (nativeBridge.ts). Kept out of this file so it stays plain, testable code. */
export function setLinkBase(url: string | undefined | null) {
  if (url && /^https:\/\//.test(url)) linkBase = url.replace(/\/+$/, "");
}

const CODE_RE = /^[A-Z0-9]{4,8}$/;

/** A link a friend can tap: opens the app on that crew, match room or invite code. No code: the plain "get the app" page. */
export function joinLink(kind?: JoinKind, code?: string): string {
  const c = String(code || "").toUpperCase();
  return kind && CODE_RE.test(c) ? `${linkBase}/join?${kind}=${c}` : `${linkBase}/join`;
}

export interface JoinTarget { kind: JoinKind; code: string }

/** Reads a join link: https://.../join?crew=ABC123, apexpulse://join?room=ABC123, or the web app opened with ?invite=ABC1234. */
export function parseJoinLink(url: string): JoinTarget | null {
  try {
    const u = new URL(url);
    const isJoin = u.protocol === "apexpulse:" ? (u.host === "join" || u.pathname.replace(/\//g, "") === "join") : true;
    if (!isJoin) return null;
    for (const kind of ["crew", "room", "invite"] as const) {
      const code = (u.searchParams.get(kind) || "").toUpperCase();
      if (CODE_RE.test(code)) return { kind, code };
    }
  } catch { /* not a URL */ }
  return null;
}
