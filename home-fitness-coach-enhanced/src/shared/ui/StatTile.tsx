import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import type { Accent } from "../../design/accents";
import { staggerChild, SPRING_SNAP } from "../../design/motion";
import AnimatedNumber from "./AnimatedNumber";

export interface StatTileProps {
  label: string;
  value: number;
  unit?: string;
  icon: LucideIcon;
  tone?: Accent;
  format?: "grouped" | "compact";
  /** Optional trailing hint — "+2 this week", "best yet". */
  hint?: string;
  className?: string;
  onClick?: () => void;
  /** Shows a sparkle-style animation. For new records or achievements. */
  celebrate?: boolean;
}

/**
 * The atom of the bento grid.
 *
 * Hierarchy inside a tile is strictly three levels — icon, label, value —
 * and the value is by far the largest thing in it. Most fitness apps
 * render the label and the number at similar weights, which forces the
 * eye to read left-to-right like prose; sizing the number four times the
 * label lets a whole grid be scanned in one pass without reading a word.
 *
 * The bloom that appears on hover is now bidirectional: it starts at the
 * icon position (top-left) and sweeps into the number, which makes the
 * hover feel like it is illuminating the statistic rather than just
 * tinting the background.
 */
export function StatTile({
  label,
  value,
  unit,
  icon: Icon,
  tone: _tone = "cyan",
  format = "grouped",
  hint,
  className = "",
  onClick,
  celebrate: _celebrate = false,
}: StatTileProps) {
  const interactive = Boolean(onClick);

  return (
    <motion.div
      variants={staggerChild}
      className={[
        "relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-carbon p-4 transition-all duration-200",
        interactive ? "cursor-pointer hover:border-line-strong active:scale-[0.98]" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      transition={SPRING_SNAP}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {/* Header: icon + label. min-w-0 lets the label truncate instead of
          pushing a trailing pill out of the tile. */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-graphite text-ink-2">
          <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
        </div>
        <span className="min-w-0 truncate text-[12px] font-bold uppercase tracking-wider text-ink-3">
          {label}
        </span>
      </div>

      {/* Value row: number on the left, delta hint on the right. The hint
          used to sit in the header next to the label and got clipped
          ("+1 v…") on narrow tiles. */}
      <div className="mt-4 flex items-end justify-between gap-2">
        <span className="font-numeric text-[28px] font-bold tabular-nums text-ink leading-none">
          <AnimatedNumber
            value={value}
            format={format}
            unit={unit}
            unitClassName="ml-1 text-xs font-semibold text-ink-3 align-baseline"
          />
        </span>
        {hint && (
          <span className="mb-0.5 shrink-0 whitespace-nowrap rounded-full bg-graphite px-2 py-0.5 text-[11px] font-bold text-ink-2">
            {hint}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default StatTile;
