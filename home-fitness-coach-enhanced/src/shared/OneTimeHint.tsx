import { useState } from "react";
import { Lightbulb } from "lucide-react";

const key = (id: string) => `ap_hint_${id}`;
const seen = (id: string) => { try { return localStorage.getItem(key(id)) === "1"; } catch { return true; } };

/** One short line shown once for a new feature. Dismissed with one tap and never shown again. */
export default function OneTimeHint({ id, children, className = "" }: { id: string; children: string; className?: string }) {
  const [show, setShow] = useState(() => !seen(id));
  if (!show) return null;
  return (
    <div role="note" className={`flex items-center gap-2.5 rounded-xl border border-volt/30 bg-volt/10 px-3 py-2 ${className}`}>
      <Lightbulb className="h-4 w-4 shrink-0 text-volt" aria-hidden />
      <p className="min-w-0 flex-1 text-xs leading-snug text-ink">{children}</p>
      <button
        onClick={() => { try { localStorage.setItem(key(id), "1"); } catch { /* ignore */ } setShow(false); }}
        className="min-h-[44px] shrink-0 rounded-full px-3 text-xs font-bold text-volt"
      >Got it</button>
    </div>
  );
}
