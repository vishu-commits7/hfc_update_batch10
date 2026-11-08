import { useBackClose } from "../lib/backStack";
import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import OverlayPortal from "./ui/OverlayPortal";
import { MANAGE_URL, billingAvailable, buyPro, loadOffers, periodLabel, restorePro, useEntitlement, type Offer } from "../lib/billing";
import { useAuthUser } from "../lib/useAuth";
import { tapFeedback, successFeedback } from "../lib/haptics";
import { track } from "../lib/track";

const PERKS = [
  "Adaptive plans that adjust to your recovery",
  "Advanced AI workout generator",
  "Full coaching hub",
  "Arena, leagues, crews and friends stay free",
];

export default function PaywallSheet({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose);
  const { user } = useAuthUser();
  const ent = useEntitlement(user?.uid);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const native = billingAvailable();

  useEffect(() => {
    track("paywall_view");
    if (!native) return;
    loadOffers().then(setOffers).catch(() => setOffers([]));
  }, [native]);

  const isPro = ent.enforced && ent.pro;
  useEffect(() => { if (isPro) void successFeedback(); }, [isPro]);

  const buy = async (o: Offer) => {
    setBusy(true); setMsg(null);
    try {
      void tapFeedback(); track("paywall_buy_tap", { plan: o.basePlanId });
      if (await buyPro(o)) track("subscribed", { plan: o.basePlanId });
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const restore = async () => {
    setBusy(true); setMsg(null);
    try { setMsg((await restorePro()) ? "Pro restored." : "No active subscription found for this Google account."); } finally { setBusy(false); }
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
        <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-carbon p-6 pb-8 text-ink sm:rounded-3xl" onClick={e => e.stopPropagation()}>
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-graphite active:scale-90"><X className="h-5 w-5" /></button>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-volt/15 text-volt"><Sparkles className="h-6 w-6" /></span>
          <h2 className="mt-3 text-2xl font-black tracking-tight">Apex Pro</h2>
          <p className="mt-1 text-sm text-ink-2">Training that adapts to you. Everything social stays free.</p>
          <ul className="mt-4 space-y-2">
            {PERKS.map(p => <li key={p} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-volt" />{p}</li>)}
          </ul>

          {isPro ? (
            <div className="mt-6 rounded-2xl bg-volt/10 p-4 text-center">
              <p className="text-sm font-bold text-volt">You're Pro</p>
              {ent.proUntil > 0 && <p className="mt-0.5 text-xs text-ink-2">Renews or ends {new Date(ent.proUntil).toLocaleDateString()}</p>}
              <a href={MANAGE_URL} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-volt underline">Manage subscription in Google Play</a>
            </div>
          ) : !native ? (
            <p className="mt-6 rounded-xl bg-graphite p-4 text-center text-xs text-ink-2">Subscriptions are bought in the Android app through Google Play.</p>
          ) : offers === null ? (
            <div className="mt-6 flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-ink-3" /></div>
          ) : offers.length === 0 ? (
            <p className="mt-6 rounded-xl bg-graphite p-4 text-center text-xs text-ink-2">Pro isn't available to buy right now. Try again later.</p>
          ) : (
            <div className="mt-6 space-y-2">
              {offers.map(o => (
                <button key={o.offerToken} disabled={busy} onClick={() => void buy(o)} className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-volt/40 bg-volt/10 px-4 text-left active:scale-[0.98] disabled:opacity-60">
                  <span className="text-sm font-black capitalize">{periodLabel(o.period) === "year" ? "Yearly" : "Monthly"}</span>
                  <span className="text-sm font-bold">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `${o.price} / ${periodLabel(o.period)}`}</span>
                </button>
              ))}
              <p className="pt-1 text-center text-[11px] text-ink-3">Renews automatically. Cancel any time in Google Play.</p>
            </div>
          )}
          {native && !isPro && <button onClick={() => void restore()} disabled={busy} className="mt-3 w-full text-center text-xs font-bold text-ink-2 underline">Restore purchase</button>}
          {msg && <p className="mt-3 rounded-xl bg-graphite px-3 py-2 text-center text-xs text-ink-2">{msg}</p>}
        </div>
      </div>
    </OverlayPortal>
  );
}
