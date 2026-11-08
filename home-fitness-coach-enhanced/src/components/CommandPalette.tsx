import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dialogVariants, scrimVariants } from "../design/motion";
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
  const [selectedCategory, setSelectedCategory] = useState("All");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    setSelectedCategory("All");
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const results = useMemo(() => {
    let list = commands;
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = commands
        .map((c) => ({
          c,
          score: score(`${c.label} ${c.group} ${c.keywords ?? ""}`, q),
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.c);
    }

    if (selectedCategory === "All") return list;
    const cat = selectedCategory.toLowerCase();
    return list.filter((c) => {
      const g = (c.group || "").toLowerCase();
      const kw = (c.keywords || "").toLowerCase();
      const lbl = (c.label || "").toLowerCase();
      if (cat === "workouts") {
        return g.includes("workout") || g.includes("routine") || kw.includes("workout") || kw.includes("session") || lbl.includes("workout");
      }
      if (cat === "exercises") {
        return g.includes("exercise") || g.includes("academy") || kw.includes("exercise") || kw.includes("movement") || lbl.includes("exercise") || lbl.includes("library");
      }
      if (cat === "coaches") {
        return g.includes("coach") || kw.includes("coach") || lbl.includes("coach") || kw.includes("chat");
      }
      if (cat === "reels") {
        return g.includes("reel") || g.includes("story") || kw.includes("reel") || kw.includes("story") || lbl.includes("reel") || lbl.includes("story");
      }
      return true;
    });
  }, [commands, query, selectedCategory]);

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
          className="fixed inset-0 z-[110] flex items-start justify-center px-3"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 12px)" }}
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
            className="relative z-10 flex max-h-[78dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border"
            style={{
              background: "var(--carbon)",
              borderColor: "var(--line)",
              boxShadow: "var(--shadow-xl)",
              color: "var(--ink)",
            }}
          >
            {/* Search Input Bar */}
            <div
              className="flex shrink-0 items-center gap-3 border-b px-4 py-3"
              style={{ borderColor: "var(--line)" }}
            >
              <Search className="h-4 w-4 shrink-0" style={{ color: "var(--ink-3)" }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workouts, exercises, coaches…"
                aria-label="Search workouts, exercises, coaches, reels"
                enterKeyHint="search"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                style={{ color: "var(--ink)" }}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="grid h-7 w-7 place-items-center rounded-full"
                  style={{ background: "var(--graphite)", color: "var(--ink-2)" }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close search"
                className="min-h-[36px] rounded-lg px-2 text-[13px] font-semibold"
                style={{ color: "var(--ink-2)" }}
              >
                Cancel
              </button>
            </div>

            {/* Category chips */}
            <div
              className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b px-4 py-2.5"
              style={{ borderColor: "var(--line)" }}
            >
              {["All", "Workouts", "Exercises", "Coaches", "Reels"].map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className="min-h-[32px] whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition-colors"
                    style={
                      isSelected
                        ? { background: "var(--ink)", color: "var(--void)", borderColor: "var(--ink)" }
                        : { background: "transparent", color: "var(--ink-2)", borderColor: "var(--line)" }
                    }
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm" style={{ color: "var(--ink-3)" }}>
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
                        <p
                          className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.12em]"
                          style={{ color: "var(--ink-3)" }}
                        >
                          {c.group}
                        </p>
                      )}
                      <button
                        type="button"
                        data-active={isActive}
                        onClick={() => run(c)}
                        className="relative flex min-h-[56px] w-full items-center gap-3 px-3 py-2 text-left"
                      >
                        {isActive && (
                          <span
                            aria-hidden
                            className="absolute inset-x-2 inset-y-0 rounded-xl"
                            style={{ background: "var(--graphite)" }}
                          />
                        )}
                        <span
                          className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                          style={{ background: t.wash, color: t.color }}
                        >
                          <c.icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                        </span>
                        <span className="relative z-10 min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
                            {c.label}
                          </span>
                          {c.hint && (
                            <span className="block truncate text-[12px]" style={{ color: "var(--ink-3)" }}>
                              {c.hint}
                            </span>
                          )}
                        </span>
                        <ChevronRight className="relative z-10 h-4 w-4 shrink-0" style={{ color: "var(--ink-4)" }} />
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
