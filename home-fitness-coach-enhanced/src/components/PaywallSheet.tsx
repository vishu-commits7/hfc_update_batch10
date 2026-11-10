import { useBackClose } from "../lib/backStack";
import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import OverlayPortal from "./ui/OverlayPortal";
import { MANAGE_URL, arrangeOffers, billingAvailable, buyPro, loadOffers, perMonth, periodLabel, restorePro, trialLabel, useEntitlement, yearlySaving, type Offer } from "../lib/billing";
import { useAuthUser } from "../lib/useAuth";
import { tapFeedback, successFeedback } from "../lib/haptics";
import { track } from "../lib/track";
import { ErrorState, EmptyAction, SkeletonRows } from "./ui/StateViews";
import { EV } from "../lib/analyticsEvents";

const PERKS = [
  "The reason behind each day's plan, plus a 3-day outlook",
  "Advanced AI workout generator",
  "Full coaching hub",
  "Arena, leagues, crews and friends stay free",
];

export default function PaywallSheet({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose);
  const { user } = useAuthUser();
  const ent = useEntitlement(user?.uid);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [offersFailed, setOffersFailed] = useState(false);
  const [offersTry, setOffersTry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const native = billingAvailable();

  useEffect(() => {
    track(EV.paywallSeen);
    if (!native) return;
    setOffers(null);
    setOffersFailed(false);
    loadOffers().then(o => { const list = arrangeOffers(o); setOffers(list); setPicked(list[0]?.offerToken ?? null); }).catch(() => setOffersFailed(true));
  }, [native, offersTry]);
  const [picked, setPicked] = useState<string | null>(null); // the yearly plan is first and selected to begin with
  const chosen = offers?.find(o => o.offerToken === picked) ?? offers?.[0] ?? null;
  const saving = offers ? yearlySaving(offers) : 0;

  // a verified, unexpired subscription counts even before billing is enforced, so a subscriber is never offered a second purchase
  const isPro = (ent.enforced && ent.pro) || ent.proUntil > Date.now();
  useEffect(() => { if (isPro) void successFeedback(); }, [isPro]);

  const buy = async (o: Offer) => {
    setBusy(true); setMsg(null);
    try {
      void tapFeedback(); track(EV.paywallBuyTap, { plan: o.basePlanId });
      if (await buyPro(o)) track(EV.subscribed, { plan: o.basePlanId });
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
          ) : offersFailed ? (
            <div className="mt-6"><ErrorState message="Couldn't load Pro plans from Google Play." onRetry={() => setOffersTry(n => n + 1)} /></div>
          ) : offers === null ? (
            <div className="mt-6"><SkeletonRows rows={2} /></div>
          ) : offers.length === 0 ? (
            <div className="mt-6 rounded-xl bg-graphite p-4 text-center text-xs text-ink-2">
              <p>Pro isn't available to buy right now.</p>
              <div className="mt-3"><EmptyAction label="Check again" onClick={() => setOffersTry(n => n + 1)} /></div>
            </div>
          ) : (
            <div className="mt-6 space-y-2" role="radiogroup" aria-label="Choose a plan">
              {offers.map(o => {
                const yearly = o.period === "P1Y", on = chosen?.offerToken === o.offerToken;
                const trial = trialLabel(o.trial), pm = perMonth(o);
                return (
                  <button key={o.offerToken} role="radio" aria-checked={on} disabled={busy} onClick={() => { void tapFeedback(); setPicked(o.offerToken); }}
                    className={`relative flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-left active:scale-[0.98] disabled:opacity-60 ${on ? "border-volt bg-volt/10" : "border-line bg-graphite"}`}>
                    {yearly && <span className="absolute -top-2.5 right-3 rounded-full bg-volt px-2 py-0.5 text-[11px] font-black text-void">{saving > 0 ? `Best value · save ${saving}%` : "Best value"}</span>}
                    <span className="min-w-0">
                      <span className="block text-sm font-black">{yearly ? "Yearly" : o.period === "P1M" ? "Monthly" : `Every ${periodLabel(o.period)}`}</span>
                      <span className="block text-[11px] text-ink-2">{trial ? `${trial} free trial, then ` : ""}{o.price} / {periodLabel(o.period)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      {pm && <span className="block text-sm font-bold">{pm} <span className="text-[11px] font-medium text-ink-3">/ month</span></span>}
                      {!pm && <span className="block text-sm font-bold">{o.price}</span>}
                    </span>
                  </button>
                );
              })}
              {chosen && (
                <>
                  <button disabled={busy} onClick={() => void buy(chosen)} className="mt-1 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-volt text-sm font-black text-void active:scale-[0.98] disabled:opacity-60">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : trialLabel(chosen.trial) ? `Start ${trialLabel(chosen.trial)} free trial` : "Continue"}
                  </button>
                  <p className="pt-1 text-center text-[11px] leading-relaxed text-ink-3">
                    {trialLabel(chosen.trial)
                      ? `Free for the trial, then ${chosen.price} every ${periodLabel(chosen.period)}. Cancel in Google Play before the trial ends and you pay nothing.`
                      : `${chosen.price} every ${periodLabel(chosen.period)}.`} Renews automatically until cancelled. Prices are in your Google Play currency.
                  </p>
                </>
              )}
            </div>
          )}
          {native && !isPro && (
            <button onClick={() => void restore()} disabled={busy} className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-line bg-graphite text-sm font-bold text-ink active:scale-[0.98] disabled:opacity-60">Restore purchases</button>
          )}
          <p className="mt-3 text-center text-[11px] text-ink-3">Arena, leagues, crews, friends and the daily challenge are free, with or without Pro.</p>
          {msg && <p className="mt-3 rounded-xl bg-graphite px-3 py-2 text-center text-xs text-ink-2">{msg}</p>}
        </div>
      </div>
    </OverlayPortal>
  );
}
