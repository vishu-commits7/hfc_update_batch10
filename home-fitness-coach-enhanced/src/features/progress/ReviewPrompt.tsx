import { useState } from "react";
import { Loader2, MessageSquare, Star, X } from "lucide-react";
import { openPlayReview, sendFeedback, type WinMoment } from "./review";
import { useBackClose } from "../../core/backStack";
import { friendlySocialError } from "../social/social";
import { tapFeedback } from "../../core/haptics";
import OverlayPortal from "../../shared/ui/OverlayPortal";

/** Two equal choices after a win: rate on Google Play, or tell the team privately. Closing it is always one tap. */
export default function ReviewPrompt({ moment, onClose }: { moment: WinMoment; onClose: () => void }) {
  useBackClose(true, onClose);
  const [mode, setMode] = useState<"choose" | "feedback" | "thanks">("choose");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const rate = async () => { void tapFeedback(); onClose(); await openPlayReview(); };
  const send = async () => {
    if (busy || text.trim().length < 5) return;
    setBusy(true); setErr(null);
    try { await sendFeedback(text.trim(), moment); setMode("thanks"); } catch (e) { setErr(friendlySocialError(e)); } finally { setBusy(false); }
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[430] flex items-end bg-black/60" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-label="Rate Apex Pulse" className="w-full rounded-t-3xl border-t border-line bg-carbon px-5 pb-8 pt-4 text-ink" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">{mode === "thanks" ? "Thank you" : mode === "feedback" ? "Tell the team" : moment === "level-up" ? "Nice level-up" : "Program week done"}</h2>
            <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-graphite"><X className="h-4 w-4" /></button>
          </div>
          {mode === "choose" && (
            <>
              <p className="mt-1 text-sm text-ink-2">Got a minute to help Apex Pulse? Pick whichever fits.</p>
              <button onClick={rate} className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-volt text-sm font-bold text-void active:scale-[0.98]"><Star className="h-4 w-4" /> Rate on Google Play</button>
              <button onClick={() => { void tapFeedback(); setMode("feedback"); }} className="mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-graphite text-sm font-bold text-ink active:scale-[0.98]"><MessageSquare className="h-4 w-4" /> Send private feedback</button>
              <button onClick={onClose} className="mt-2 min-h-[44px] w-full text-xs font-semibold text-ink-3">Not now</button>
            </>
          )}
          {mode === "feedback" && (
            <>
              <p className="mt-1 text-xs text-ink-3">Only the Apex Pulse team sees this. What should be better?</p>
              <textarea value={text} onChange={e => setText(e.target.value.slice(0, 1000))} rows={5} autoFocus aria-label="Your feedback"
                className="mt-3 w-full rounded-xl border border-line bg-graphite p-3 text-sm text-ink outline-none focus:border-volt" placeholder="What went wrong, or what is missing?" />
              {err && <p className="mt-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{err}</p>}
              <button onClick={send} disabled={busy || text.trim().length < 5} className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-volt text-sm font-bold text-void disabled:opacity-40">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Send</button>
              <button onClick={() => setMode("choose")} className="mt-2 min-h-[44px] w-full text-xs font-semibold text-ink-3">Back</button>
            </>
          )}
          {mode === "thanks" && (
            <>
              <p className="mt-1 text-sm text-ink-2">Your note went to the team. It is not public.</p>
              <button onClick={onClose} className="mt-4 min-h-[50px] w-full rounded-xl bg-volt text-sm font-bold text-void">Done</button>
            </>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}
