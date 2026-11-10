/** Invite a friend: pure rules (no Firebase), tested by tools/check-invites.mjs. */
import { createHash } from "node:crypto";

export const MAX_FREEZES = 2;           // same cap as the streak system
export const MAX_REWARDED_INVITES = 10; // an inviter is rewarded for at most this many friends
export const REDEEM_WINDOW_DAYS = 14;   // a code can be entered in the first 14 days of an account
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function makeInviteCode(rnd: () => number = Math.random): string {
  return Array.from({ length: 7 }, () => CODE_CHARS[Math.floor(rnd() * CODE_CHARS.length)]).join("");
}
export function cleanCode(raw: unknown): string {
  const c = String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-HJ-NP-Z2-9]{7}$/.test(c) ? c : "";
}
/** Only a hash of the device id is ever stored. */
export function deviceHash(deviceId: unknown): string {
  const d = String(deviceId ?? "").trim();
  return d.length >= 8 && d.length <= 200 ? createHash("sha256").update(`apex-device|${d}`).digest("hex").slice(0, 40) : "";
}

export type RedeemNo = "bad-code" | "own-code" | "already" | "has-workout" | "too-old" | "no-device";
/** Can this account take an invite code? */
export function canRedeem(i: { code: string; inviterUid: string | null; uid: string; invitedBy?: string; totalWorkouts: number; accountAgeDays: number; device: string }): RedeemNo | null {
  if (!i.code || !i.inviterUid) return "bad-code";
  if (i.inviterUid === i.uid) return "own-code";
  if (i.invitedBy) return "already";
  if (i.totalWorkouts > 0) return "has-workout";
  if (i.accountAgeDays > REDEEM_WINDOW_DAYS) return "too-old";
  if (!i.device) return "no-device";
  return null;
}

export type RewardNo = "same-device" | "no-device" | "inviter-gone" | "inviter-banned";
/**
 * Decides the reward when an invited account finishes its first workout.
 * `deviceUids` = every account that has ever used the invited person's device.
 */
export function decideReward(i: { uid: string; inviterUid: string; deviceUids: readonly string[] | null; inviterExists: boolean; inviterBanned: boolean; inviterRewarded: number }): { ok: true; inviterPaid: boolean } | { ok: false; reason: RewardNo } {
  if (!i.deviceUids) return { ok: false, reason: "no-device" };
  if (i.deviceUids.some(u => u !== i.uid)) return { ok: false, reason: "same-device" }; // the inviter, or any other account, on this device
  if (!i.inviterExists) return { ok: false, reason: "inviter-gone" };
  if (i.inviterBanned) return { ok: false, reason: "inviter-banned" };
  return { ok: true, inviterPaid: i.inviterRewarded < MAX_REWARDED_INVITES };
}

/** A streak freeze if there is room for one, otherwise only the badge. */
export function grantFreeze(freezes: number): { freezes: number; gotFreeze: boolean } {
  return freezes < MAX_FREEZES ? { freezes: freezes + 1, gotFreeze: true } : { freezes, gotFreeze: false };
}
