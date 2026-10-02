import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dialogVariants, scrimVariants, SPRING_SNAP } from "../design/motion";
import { accent, type Accent } from "../design/accents";

export interface Command {
  id: string;
  label: string;
  /** Secondary line — what the command does, or where it goes. */
  hint?: string;
  icon: LucideIcon;
  /** Grouping header in the list. */
  group: string;
  tone?: Accent;
  /** Extra words matched by the filter but never displayed. */
  keywords?: string;
  run: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

/**
 * Command palette (⌘K / Ctrl+K).
 *
 * Every destination and action in the app, reachable in two keystrokes
 * without touching the navigation. On a fitness app that mostly runs on
 * a phone this is a power-user affordance rather than the primary path —
 * which is exactly why it is a palette and not a redesign of the nav.
 *
 * Matching is a lightweight subsequence scorer rather than a substring
 * test, so "aiw" finds "AI Workout Generator". Exact prefix matches are
 * ranked above scattered ones so short queries behave predictably.
 *
 * Keyboard contract: ↑/↓ move, Enter runs, Escape closes, and the active
 * row is scrolled into view so arrowing past the fold never loses it.
 */
export function CommandPalette({
  open,
  onClose,
  commands,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase().trim();
    return commands
      .map((c) => ({
        c,
        score: score(`${c.label} ${c.group} ${c.keywords ?? ""}`, q),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.c);
  }, [commands, query]);

  // Clamp rather than reset: retyping should not throw the selection back
  // to the top if the current row is still in the result set.
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  const run = useCallback(
    (command?: Command) => {
      const target = command ?? results[index];
      if (!target) return;
      onClose();
      // Defer so the exit animation starts before the destination screen
      // begins mounting — otherwise a heavy screen stalls the dismissal
      // and the palette appears to hang for a frame.
      requestAnimationFrame(() => target.run());
    },
    [index, onClose, results],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      run();
    }
  };

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  // Group headers are emitted inline so the flat keyboard index and the
  // grouped visual order can never disagree.
  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[12vh]"
          onKeyDown={onKeyDown}
        >
          <motion.div
            variants={scrimVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 backdrop-blur-[3px]"
            style={{ background: "var(--scrim)" }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            variants={dialogVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="surface relative z-10 flex max-h-[62vh] w-full max-w-lg flex-col overflow-hidden rounded-xl2"
            style={{ background: "var(--carbon)" }}
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3.5">
              <Search className="h-4 w-4 shrink-0 text-ink-4" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to anything…"
                aria-label="Search commands"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-4"
              />
              <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] font-bold text-ink-4 sm:block">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs text-ink-4">
                  Nothing matches “{query}”.
                </p>
              ) : (
                results.map((c, i) => {
                  const isActive = i === index;
                  const showGroup = c.group !== lastGroup;
                  lastGroup = c.group;
                  const t = accent(c.tone ?? "cyan");

                  return (
                    <React.Fragment key={c.id}>
                      {showGroup && (
                        <p className="eyebrow px-4 pb-1.5 pt-3">{c.group}</p>
                      )}
                      <button
                        type="button"
                        data-active={isActive}
                        onPointerEnter={() => setIndex(i)}
                        onClick={() => run(c)}
                        className="relative flex w-full items-center gap-3 px-3 py-2.5 text-left"
                      >
                        {isActive && (
                          <motion.span
                            layoutId="palette-active"
                            transition={SPRING_SNAP}
                            className="absolute inset-x-2 inset-y-0 rounded-md2 bg-[var(--line-faint)]"
                          />
                        )}
                        <span
                          className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-md2"
                          style={{ background: t.wash, color: t.color }}
                        >
                          <c.icon className="h-4 w-4" strokeWidth={2.3} />
                        </span>
                        <span className="relative z-10 min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-ink">
                            {c.label}
                          </span>
                          {c.hint && (
                            <span className="block truncate text-[11px] text-ink-4">
                              {c.hint}
                            </span>
                          )}
                        </span>
                        {isActive && (
                          <CornerDownLeft className="relative z-10 h-3.5 w-3.5 shrink-0 text-ink-4" />
                        )}
                      </button>
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Subsequence scorer.
 *
 * Returns 0 when the query characters do not all appear in order.
 * Otherwise, adjacency and word-start hits are weighted so that "aiw"
 * ranks "AI Workout" above a title where those letters merely happen to
 * appear scattered.
 */
function score(haystack: string, needle: string): number {
  const h = haystack.toLowerCase();
  if (h.includes(needle)) return 1000 - h.indexOf(needle);

  let hi = 0;
  let total = 0;
  let streak = 0;
  for (const ch of needle) {
    if (ch === " ") continue;
    const found = h.indexOf(ch, hi);
    if (found === -1) return 0;
    const atWordStart = found === 0 || h[found - 1] === " ";
    streak = found === hi ? streak + 1 : 0;
    total += 1 + streak * 2 + (atWordStart ? 4 : 0);
    hi = found + 1;
  }
  return total;
}

export default CommandPalette;
