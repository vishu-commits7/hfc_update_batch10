import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X, ChevronRight } from "lucide-react";
import { SPRING_SNAP, SPRING_WEIGHTED } from "../../design/motion";
import { tapFeedback } from "../../lib/haptics";

const QUOTES = [
  {
    text: "The body achieves what the mind believes.",
    author: "Napolean Hill",
    tone: "cyan" as const,
  },
  {
    text: "No pain, no gain. Shut up and train.",
    author: "Martina Navratilova",
    tone: "emerald" as const,
  },
  {
    text: "Strength does not come from physical capacity. It comes from an indomitable will.",
    author: "Mahatma Gandhi",
    tone: "gold" as const,
  },
  {
    text: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
    tone: "cyan" as const,
  },
  {
    text: "Take care of your body. It's the only place you have to live.",
    author: "Jim Rohn",
    tone: "emerald" as const,
  },
  {
    text: "An hour of pain is worth a lifetime of glory.",
    author: "Vince Lombardi",
    tone: "ember" as const,
  },
  {
    text: "Push yourself because no one else is going to do it for you.",
    author: "Unknown",
    tone: "cyan" as const,
  },
  {
    text: "Your only limit is you.",
    author: "Unknown",
    tone: "gold" as const,
  },
  {
    text: "Sweat is just fat crying.",
    author: "Unknown",
    tone: "ember" as const,
  },
  {
    text: "It never gets easier, you just get stronger.",
    author: "Unknown",
    tone: "emerald" as const,
  },
];

const ACCENT_VARS: Record<string, { color: string; wash: string }> = {
  cyan: { color: "var(--cyan)", wash: "var(--cyan-wash)" },
  emerald: { color: "var(--emerald)", wash: "var(--emerald-wash)" },
  gold: { color: "var(--gold)", wash: "var(--gold-wash)" },
  ember: { color: "var(--ember)", wash: "var(--ember-wash)" },
};

const DISMISS_KEY = "kinetic_motivation_dismissed";

export interface MotivationBannerProps {
  className?: string;
}

/**
 * MotivationBanner — daily rotating inspirational quote for the Dashboard.
 *
 * Cycles through a curated list of motivational quotes, changing once
 * per day (persisted in localStorage so it stays stable across refreshes).
 * Dismisses permanently with a graceful exit animation and never resurfaces
 * for the rest of the day. Tapping the arrow cycles to the next quote.
 *
 * The quote shifts through `cyan → emerald → gold → ember` tones so
 * repeated visits feel fresh rather than identical.
 */
export function MotivationBanner({ className = "" }: MotivationBannerProps) {
  const reduced = useReducedMotion();

  const [dismissed, setDismissed] = useState(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (!stored) return false;
    // Reset if it was dismissed on a previous day
    const today = new Date().toDateString();
    try {
      const { date } = JSON.parse(stored);
      return date === today;
    } catch {
      return false;
    }
  });

  const [index, setIndex] = useState(() => {
    // Use the day-of-year to pick a stable daily quote
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        86400000,
    );
    return dayOfYear % QUOTES.length;
  });

  const [direction, setDirection] = useState(1);

  const handleDismiss = useCallback(() => {
    tapFeedback();
    const today = new Date().toDateString();
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ date: today }));
    setDismissed(true);
  }, []);

  const handleNext = useCallback(() => {
    tapFeedback();
    setDirection(1);
    setIndex((i) => (i + 1) % QUOTES.length);
  }, []);

  if (dismissed) return null;

  const quote = QUOTES[index];
  const a = ACCENT_VARS[quote.tone];

  const variants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 24 : -24,
      scale: 0.97,
    }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -24 : 24,
      scale: 0.97,
    }),
  };

  return (
    <motion.div
      layout
      initial={reduced ? false : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -6 }}
      transition={SPRING_WEIGHTED}
      className={`aurora-card grain relative overflow-hidden rounded-xl2 px-4 py-3.5 ${className}`}
      style={{ ["--glow" as string]: a.color }}
    >
      {/* Ambient orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full"
        style={{
          background: `radial-gradient(circle, ${a.wash} 0%, transparent 70%)`,
          filter: "blur(20px)",
        }}
      />

      <div className="relative z-10 flex items-start gap-3">
        {/* Quote mark */}
        <span
          aria-hidden
          className="mt-0.5 shrink-0 text-[28px] font-extrabold leading-none"
          style={{ color: a.color, opacity: 0.4, fontFamily: "serif" }}
        >
          "
        </span>

        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              variants={reduced ? {} : variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-xs font-semibold leading-relaxed text-ink">
                {quote.text}
              </p>
              <p
                className="mt-1 text-[10px] font-bold"
                style={{ color: a.color }}
              >
                — {quote.author}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1.5">
          {/* Next quote */}
          <motion.button
            type="button"
            onClick={handleNext}
            whileTap={{ scale: 0.88 }}
            transition={SPRING_SNAP}
            aria-label="Next quote"
            className="grid h-7 w-7 place-items-center rounded-full"
            style={{ background: a.wash, color: a.color }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.button>

          {/* Dismiss */}
          <motion.button
            type="button"
            onClick={handleDismiss}
            whileTap={{ scale: 0.88 }}
            transition={SPRING_SNAP}
            aria-label="Dismiss quote"
            className="grid h-6 w-6 place-items-center rounded-full border border-line text-ink-4 hover:text-ink-2"
          >
            <X className="h-3 w-3" />
          </motion.button>
        </div>
      </div>

      {/* Dot indicator */}
      <div className="relative z-10 mt-2.5 flex items-center gap-1 pl-7">
        {QUOTES.map((_, i) => (
          <motion.span
            key={i}
            className="inline-block h-1 rounded-full"
            animate={{
              width: i === index ? 12 : 4,
              background: i === index ? a.color : "var(--line-strong)",
            }}
            transition={SPRING_SNAP}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default MotivationBanner;
