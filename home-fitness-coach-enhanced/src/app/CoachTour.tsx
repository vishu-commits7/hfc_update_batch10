import { useBackClose } from "../core/backStack";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Swords, Film, UserRound, ChevronRight } from "lucide-react";

const STOPS = [
  { icon: Swords, title: "Arena", line: "Challenge a friend to a live 1v1 and climb your weekly league." },
  { icon: Film, title: "Reels", line: "Watch and share short workout clips from athletes you follow." },
  { icon: UserRound, title: "Profile", line: "See your level, trophies and match history, and manage your privacy." },
] as const;

/** One-line, three-step tour shown once after setup. Never blocks the app. */
export default function CoachTour({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose);
  const [i, setI] = useState(0);
  const stop = STOPS[i];
  const Icon = stop.icon;
  const last = i === STOPS.length - 1;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[120] flex justify-center px-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          className="pointer-events-auto w-full max-w-sm rounded-2xl border border-line bg-carbon p-4 text-ink shadow-2xl"
          role="dialog" aria-label="Quick tour"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-volt/15 text-volt"><Icon className="h-5 w-5" /></span>
            <p className="min-w-0 flex-1 text-sm"><b>{stop.title}.</b> <span className="text-ink-2">{stop.line}</span></p>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="flex gap-1.5">{STOPS.map((_, n) => <span key={n} className={`h-1.5 w-5 rounded-full ${n === i ? "bg-volt" : "bg-graphite"}`} />)}</span>
            <span className="flex items-center gap-3">
              {!last && <button onClick={onClose} className="text-xs font-semibold text-ink-3">Skip</button>}
              <button onClick={() => (last ? onClose() : setI(i + 1))} className="flex items-center gap-1 rounded-full bg-volt px-4 py-2 text-xs font-bold text-void active:scale-95">
                {last ? "Got it" : "Next"} {!last && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
