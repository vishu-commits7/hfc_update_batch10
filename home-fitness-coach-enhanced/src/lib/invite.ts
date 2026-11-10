/** Invite a friend (client). The server owns the code, the checks and the reward. */
import { callFn } from "./functions";
import { ApexNative, isNative } from "./nativeBridge";
import { playStoreUrl } from "./shareLink";

const KEY = "ap_install_id";
let cached: string | null = null;

/**
 * An id for this phone, used only so one phone cannot invite itself. On Android it is the system's app-scoped
 * device id (same after a reinstall). In a browser or an old build it is a random id kept on the device.
 * The server stores only a hash of it.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  if (isNative()) {
    try { const r = await ApexNative.deviceId(); if (r?.id && r.id.length >= 8) return (cached = `a:${r.id}`); } catch { /* old build without the method */ }
  }
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      const b = new Uint8Array(16); crypto.getRandomValues(b);
      id = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(KEY, id);
    }
    return (cached = `w:${id}`);
  } catch { return ""; }
}

export interface InviteInfo { code: string; joined: number; rewarded: number; maxRewarded: number; invitedBy: boolean; canEnterCode: boolean }
export const getInviteInfo = async () => callFn<InviteInfo>("inviteInfo", { deviceId: await getDeviceId() });
export const redeemInvite = async (code: string) => callFn<{ ok: boolean }>("inviteRedeem", { code, deviceId: await getDeviceId() });

let registeredFor = "";
/** Tells the server this account uses this device. Once per sign-in; failures are ignored. */
export function registerDeviceOnce(uid: string) {
  if (!uid || registeredFor === uid) return;
  registeredFor = uid;
  void getDeviceId().then(id => (id ? callFn("registerDevice", { deviceId: id }) : null)).catch(() => { registeredFor = ""; });
}

export const inviteText = (code: string) => `Train with me on Apex Pulse. Install it, then enter my invite code ${code} before your first workout and we both get a streak freeze.`;
export const inviteLink = () => playStoreUrl("app");
