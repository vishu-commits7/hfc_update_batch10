/** Pro subscription on the client. The server decides who is Pro; this only buys, restores and reads that answer. */
import { useEffect, useSyncExternalStore } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { callFn } from "./functions";

export const PRO_PRODUCT_ID = "apex_pro";

export interface Offer {
  offerToken: string; basePlanId: string;
  /** Price as Google Play formats it for this user's country and currency, e.g. "₹1,499.00". */
  price: string;
  /** ISO period of the recurring price: P1M, P1Y. */
  period: string;
  /** Recurring price in millionths of the currency unit, and its ISO currency code (missing on old builds). */
  priceMicros?: number; currency?: string;
  /** ISO period of a free trial on this offer ("P7D"), or "" / missing when there is none. */
  trial?: string;
}

export const PAYWALL_MIN_WORKOUTS = 3;
/** The paywall and Pro prompts stay hidden until the user has finished this many workouts. */
export const paywallUnlocked = (finishedWorkouts: number) => finishedWorkouts >= PAYWALL_MIN_WORKOUTS;

const months = (iso: string) => (iso === "P1Y" ? 12 : iso === "P6M" ? 6 : iso === "P3M" ? 3 : iso === "P1M" ? 1 : 0);
/** "7-day", "2-week", "1-month" from an ISO period; "" when it is not one we can word. */
export function trialLabel(iso: string | undefined): string {
  const m = /^P(\d+)([DWMY])$/.exec(iso || "");
  if (!m) return "";
  const n = Number(m[1]);
  return `${m[2] === "W" ? n * 7 : n}-${m[2] === "D" || m[2] === "W" ? "day" : m[2] === "M" ? "month" : "year"}`;
}
/**
 * One offer per billing period (Play can return several offers for a base plan: keep the one with a trial,
 * otherwise the cheapest), longest period first so the yearly plan leads.
 */
export function arrangeOffers(offers: Offer[]): Offer[] {
  const best = new Map<string, Offer>();
  for (const o of offers) {
    const cur = best.get(o.period);
    const better = !cur || (!!o.trial && !cur.trial) || (!!o.trial === !!cur.trial && (o.priceMicros ?? Infinity) < (cur.priceMicros ?? Infinity));
    if (better) best.set(o.period, o);
  }
  return [...best.values()].sort((a, b) => months(b.period) - months(a.period));
}
/** How much cheaper the yearly plan is than 12 monthly payments, as a whole percent (0 when unknown or not cheaper). */
export function yearlySaving(offers: Offer[]): number {
  const y = offers.find(o => o.period === "P1Y"), m = offers.find(o => o.period === "P1M");
  if (!y?.priceMicros || !m?.priceMicros || y.currency !== m.currency) return 0;
  const pct = Math.floor((1 - y.priceMicros / (m.priceMicros * 12)) * 100);
  return pct > 0 ? pct : 0;
}
/** The yearly price per month in the user's own currency ("₹125"), or "" when it cannot be worked out. */
export function perMonth(o: Offer): string {
  const n = months(o.period);
  if (n <= 1 || !o.priceMicros || !o.currency) return "";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: o.currency, maximumFractionDigits: 0 }).format(o.priceMicros / 1_000_000 / n); } catch { return ""; }
}
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
  // true when Google Play confirmed a live subscription for this account (also while billing is not enforced yet)
  return ent.proUntil > Date.now();
}

export const periodLabel = (iso: string) => (iso === "P1Y" ? "year" : iso === "P1M" ? "month" : iso === "P1W" ? "week" : "period");
export const MANAGE_URL = `https://play.google.com/store/account/subscriptions?sku=${PRO_PRODUCT_ID}&package=com.homefitnesscoach.app`;
