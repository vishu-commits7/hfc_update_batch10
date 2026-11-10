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
