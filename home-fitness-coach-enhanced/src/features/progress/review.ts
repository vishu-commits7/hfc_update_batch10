/**
 * Rating prompt. Shown only after a win moment, never in the first 3 days, at most once per 60 days.
 * The sheet offers two equal choices: rate on Google Play, or send private feedback to the team.
 * It does not ask "do you like the app?" first: Google's in-app review rules say not to ask an opinion
 * question before the rating card, and not to steer only happy users to it.
 */
import { callFn } from "../../core/functions";
import { ApexNative, isNative } from "../../core/nativeBridge";
import { playStoreUrl } from "../../core/shareLink";
import { DEMO } from "../../core/demo";

export const MIN_DAYS_SINCE_FIRST_OPEN = 3;
export const MIN_DAYS_BETWEEN_PROMPTS = 60;
const DAY = 86_400_000;
const FIRST = "ap_first_open", LAST = "ap_review_last";

export type WinMoment = "level-up" | "program-week";
/** Which win moment (if any) this reward is. */
export function winMomentOf(r: { levelUp?: boolean; program?: { credited?: boolean; weekComplete?: boolean } | null }): WinMoment | null {
  if (r.levelUp) return "level-up";
  if (r.program?.credited && r.program.weekComplete) return "program-week";
  return null;
}

/** Pure rule, tested by tools/check-review.mjs. Times are milliseconds; 0 means "never". */
export function shouldAskReview(i: { now: number; firstOpen: number; lastPrompt: number; moment: WinMoment | null }): boolean {
  if (!i.moment || !i.firstOpen) return false;
  if (i.now - i.firstOpen < MIN_DAYS_SINCE_FIRST_OPEN * DAY) return false;
  if (i.lastPrompt && i.now - i.lastPrompt < MIN_DAYS_BETWEEN_PROMPTS * DAY) return false;
  return true;
}

const num = (k: string) => { try { return Number(localStorage.getItem(k) || 0) || 0; } catch { return 0; } };
/** Call once at app start: remembers the first day this install was opened. */
export function noteFirstOpen() { try { if (!localStorage.getItem(FIRST)) localStorage.setItem(FIRST, String(Date.now())); } catch { /* ignore */ } }
/** Should the sheet appear now? Marks the prompt as shown when it returns true. */
export function takeReviewTurn(moment: WinMoment | null): boolean {
  if (DEMO) return false;
  const ok = shouldAskReview({ now: Date.now(), firstOpen: num(FIRST), lastPrompt: num(LAST), moment });
  if (ok) { try { localStorage.setItem(LAST, String(Date.now())); } catch { /* ignore */ } }
  return ok;
}

/** Opens Google's own rating card inside the app. Play decides whether it really appears (it has its own quota). */
export async function openPlayReview(): Promise<"asked" | "store"> {
  if (isNative()) {
    try { await ApexNative.requestReview(); return "asked"; } catch { /* old build or Play unavailable: fall through to the listing */ }
  }
  try { window.open(playStoreUrl("app"), "_blank", "noopener"); } catch { /* ignore */ }
  return "store";
}

export const sendFeedback = (text: string, moment: WinMoment | null) => callFn<{ ok: boolean }>("sendFeedback", { text, moment: moment ?? "", lang: document.documentElement.lang || "en" });
