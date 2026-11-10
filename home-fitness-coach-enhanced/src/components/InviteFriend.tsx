import { useEffect, useState } from "react";
import { Check, Copy, Gift, Loader2, Share2 } from "lucide-react";
import { getInviteInfo, inviteLink, inviteText, redeemInvite, type InviteInfo } from "../lib/invite";
import { shareContent } from "../lib/nativeBridge";
import { friendlySocialError } from "../lib/social";
import { tapFeedback } from "../lib/haptics";

/** Your invite code, a share button, and (for a brand-new account) a box to enter a friend's code. */
export default function InviteFriend() {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => { setFailed(false); getInviteInfo().then(setInfo).catch(() => setFailed(true)); };
  useEffect(load, []);

  const copy = async () => { if (!info) return; try { await navigator.clipboard.writeText(info.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  const share = () => { if (!info) return; void tapFeedback(); void shareContent({ title: "Apex Pulse", text: inviteText(info.code), url: inviteLink() }); };
  const redeem = async () => {
    if (busy || code.trim().length < 7) return;
    setBusy(true); setMsg(null);
    try {
      await redeemInvite(code);
      setMsg({ ok: true, text: "Code accepted. Finish your first workout and you both get the reward." });
      setInfo(i => (i ? { ...i, invitedBy: true, canEnterCode: false } : i));
    } catch (e) { setMsg({ ok: false, text: friendlySocialError(e) }); } finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-line bg-carbon p-4 text-ink">
      <h2 className="flex items-center gap-1.5 text-sm font-bold"><Gift className="h-4 w-4 text-volt" /> Invite a friend</h2>
      <p className="mt-0.5 text-xs text-ink-3">When a friend joins with your code and finishes a first workout, you both get a streak freeze (or a badge if you already hold 2 freezes).</p>
      {failed ? (
        <button onClick={load} className="mt-3 min-h-[44px] w-full rounded-xl border border-line bg-graphite text-xs font-bold">Couldn't load your code. Try again</button>
      ) : !info ? (
        <div className="flex justify-center py-5"><Loader2 className="h-5 w-5 animate-spin text-ink-3" /></div>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-graphite px-4 py-3">
            <span className="text-2xl font-bold tracking-[0.2em] tabular-nums" aria-label={`Your invite code is ${info.code.split("").join(" ")}`}>{info.code}</span>
            <button onClick={copy} aria-label="Copy code" className="flex h-11 w-11 items-center justify-center rounded-full bg-carbon active:scale-90">{copied ? <Check className="h-4 w-4 text-volt" /> : <Copy className="h-4 w-4" />}</button>
          </div>
          <button onClick={share} className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-volt text-sm font-bold text-void active:scale-[0.98]"><Share2 className="h-4 w-4" /> Share my code</button>
          <p className="mt-2 text-center text-[11px] text-ink-3">{info.joined} joined · {info.rewarded} of {info.maxRewarded} rewards earned</p>
          {info.canEnterCode && (
            <div className="mt-4 border-t border-line pt-3">
              <label htmlFor="invite-code" className="text-xs font-bold">Have a friend's code?</label>
              <div className="mt-1.5 flex gap-2">
                <input id="invite-code" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7))} placeholder="7 letters" autoCapitalize="characters" autoComplete="off"
                  className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-line bg-graphite px-3 text-sm font-bold tracking-widest text-ink outline-none focus:border-volt" />
                <button onClick={redeem} disabled={busy || code.length < 7} className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-volt px-4 text-xs font-bold text-volt disabled:opacity-40">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Use code</button>
              </div>
              <p className="mt-1 text-[11px] text-ink-3">Only before your first workout.</p>
            </div>
          )}
          {msg && <p className={`mt-2 rounded-xl px-3 py-2 text-center text-xs ${msg.ok ? "bg-volt/10 text-volt" : "bg-rose-500/10 text-rose-300"}`}>{msg.text}</p>}
        </>
      )}
    </section>
  );
}
