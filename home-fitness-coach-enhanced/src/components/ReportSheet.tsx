import { useBackClose } from "../lib/backStack";
import { useState } from "react";
import { Flag, Ban, Loader2, X, Check } from "lucide-react";
import OverlayPortal from "./ui/OverlayPortal";
import { REPORT_REASONS, reportContent, blockUser, type ReportReason } from "../lib/blocks";

export interface ReportTarget {
  type: "user" | "reel" | "comment" | "message";
  targetId: string;
  ownerUid: string;
  ownerName: string;
  audience?: "public" | "followers";
}

/** Bottom sheet: report this content and/or block its author. */
export default function ReportSheet({ target, onClose, onDone }: { target: ReportTarget; onClose: () => void; onDone?: (msg: string) => void }) {
  useBackClose(true, onClose);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const what = target.type === "user" ? "account" : target.type;

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true); setErr(null);
    try {
      await reportContent({ type: target.type, targetId: target.targetId, ownerUid: target.ownerUid, audience: target.audience, reason });
      if (alsoBlock) await blockUser(target.ownerUid);
      onDone?.(alsoBlock ? `Reported and blocked ${target.ownerName}.` : "Thanks, we'll review this report.");
      onClose();
    } catch (e: any) {
      setErr(e?.message?.replace(/^.*?:\s*/, "") || "Couldn't send the report. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[450] flex items-end bg-black/60" onClick={onClose}>
        <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-line bg-carbon px-5 pb-8 pt-4 text-ink" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold"><Flag className="h-4 w-4 text-rose-400" /> Report {what}</h2>
            <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-graphite"><X className="h-4 w-4" /></button>
          </div>
          <p className="mt-1 text-xs text-ink-3">Why are you reporting this? Reports are private.</p>
          <ul className="mt-3 space-y-1.5">
            {REPORT_REASONS.map(r => (
              <li key={r.id}>
                <button onClick={() => setReason(r.id)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm font-semibold ${reason === r.id ? "border-volt bg-volt/10" : "border-line bg-graphite"}`}>
                  {r.label}{reason === r.id && <Check className="h-4 w-4 text-volt" />}
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => setAlsoBlock(b => !b)} className="mt-3 flex w-full items-center gap-3 rounded-xl border border-line bg-graphite px-3 py-3 text-left">
            <Ban className="h-4 w-4 text-ink-2" />
            <span className="min-w-0 flex-1 text-sm font-semibold">Also block {target.ownerName}<span className="block text-xs font-normal text-ink-3">You won't see their content and they can't follow or message you.</span></span>
            <span className={`flex h-5 w-5 items-center justify-center rounded border ${alsoBlock ? "border-volt bg-volt text-void" : "border-line"}`}>{alsoBlock && <Check className="h-3.5 w-3.5" />}</span>
          </button>
          {err && <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{err}</p>}
          <button onClick={submit} disabled={!reason || busy} className="mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-rose-500 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit report
          </button>
        </div>
      </div>
    </OverlayPortal>
  );
}
