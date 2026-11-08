/** Pro subscription on the client. The server decides who is Pro; this only buys, restores and reads that answer. */
import { useEffect, useSyncExternalStore } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { callFn } from "./functions";

export const PRO_PRODUCT_ID = "apex_pro";

export interface Offer { offerToken: string; basePlanId: string; price: string; period: string }
interface BillingPlugin {
  getProducts(o: { productId: string }): Promise<{ offers: Offer[] }>;
  purchase(o: { productId: string; offerToken: string }): Promise<{ purchaseToken: string; productId: string }>;
  getPurchases(): Promise<{ purchases: { purchaseToken: string; productId: string }[] }>;
}
const Billing = registerPlugin<BillingPlugin>("ApexBilling");
export const billingAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

interface Ent { loading: boolean; enforced: boolean; pro: boolean; proUntil: number }
// Until the server answers, assume access so a slow network never flashes a lock screen.
let ent: Ent = { loading: true, enforced: false, pro: true, proUntil: 0 };
const listeners = new Set<() => void>();
const set = (n: Partial<Ent>) => { ent = { ...ent, ...n }; listeners.forEach(l => l()); };

let refreshing: Promise<void> | null = null;
/** Reads the server entitlement. On Android it first re-verifies any active Play subscription (renewals, restores). */
export function refreshEntitlement(syncWithPlay = true): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      if (syncWithPlay && billingAvailable()) {
        try {
          const { purchases } = await Billing.getPurchases();
          for (const p of purchases) await callFn("verifyPurchase", { purchaseToken: p.purchaseToken }).catch(() => {});
        } catch { /* Play not reachable: fall through to the server's last answer */ }
      }
      const r = await callFn<{ enforced: boolean; pro: boolean; proUntil: number }>("getEntitlement");
      set({ loading: false, enforced: r.enforced, pro: r.pro, proUntil: r.proUntil });
    } catch {
      set({ loading: false }); // keep the last known answer
    } finally { refreshing = null; }
  })();
  return refreshing;
}

export function clearEntitlement() { set({ loading: true, enforced: false, pro: true, proUntil: 0 }); }

export function useEntitlement(uid: string | null | undefined): Ent {
  useEffect(() => { if (uid) void refreshEntitlement(); else clearEntitlement(); }, [uid]);
  return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => ent, () => ent);
}

export async function loadOffers(): Promise<Offer[]> {
  const { offers } = await Billing.getProducts({ productId: PRO_PRODUCT_ID });
  return offers;
}

/** Opens the Play purchase sheet, then has the server verify it. Throws a readable Error on failure. */
export async function buyPro(offer: Offer): Promise<boolean> {
  try {
    const p = await Billing.purchase({ productId: PRO_PRODUCT_ID, offerToken: offer.offerToken });
    const r = await callFn<{ pro: boolean }>("verifyPurchase", { purchaseToken: p.purchaseToken });
    await refreshEntitlement(false);
    return r.pro;
  } catch (e: any) {
    if (e?.code === "CANCELED") return false;
    throw new Error(e?.message || "Purchase failed. You haven't been charged.");
  }
}

export async function restorePro(): Promise<boolean> {
  await refreshEntitlement(true);
  return ent.pro && ent.enforced;
}

export const periodLabel = (iso: string) => (iso === "P1Y" ? "year" : iso === "P1M" ? "month" : iso === "P1W" ? "week" : "period");
export const MANAGE_URL = `https://play.google.com/store/account/subscriptions?sku=${PRO_PRODUCT_ID}&package=com.homefitnesscoach.app`;
