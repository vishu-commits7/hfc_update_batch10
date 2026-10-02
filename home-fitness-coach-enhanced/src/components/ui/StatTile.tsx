import { motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { type Accent, accent, accentVars } from "../../design/accents";
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
  tone = "cyan",
  format = "grouped",
  hint,
  className = "",
  onClick,
  celebrate = false,
}: StatTileProps) {
  const a = accent(tone);
  const reduced = useReducedMotion();
  const interactive = Boolean(onClick);

  return (
    <motion.div
      variants={staggerChild}
      className={[
        "surface grain group relative overflow-hidden rounded-xl2 p-4",
        interactive ? "cursor-pointer" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={accentVars(tone)}
      onClick={onClick}
      whileHover={interactive && !reduced ? { y: -4, scale: 1.02 } : undefined}
      whileTap={interactive && !reduced ? { scale: 0.97 } : undefined}
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
      {/* Accent bloom — swept from the icon corner across the tile on hover.
          Bidirectional: positioned at origin (top-left) so hover lighting
          feels like it radiates from the icon. */}
      <div
        aria-hidden
        className="bloom pointer-events-none absolute -left-4 -top-6 h-28 w-28 opacity-0 transition-opacity duration-500 group-hover:opacity-70"
      />

      {/* Secondary bloom in the bottom-right for depth on hover */}
      <div
        aria-hidden
        className="bloom pointer-events-none absolute -bottom-4 -right-4 h-20 w-20 opacity-0 transition-opacity duration-700 group-hover:opacity-40"
      />

      {/* Celebration pulse ring — shown on achieve/record moments */}
      {celebrate && !reduced && (
        <span
          aria-hidden
          className="pulse-ring pointer-events-none absolute inset-0 rounded-xl2"
          style={{
            background: `radial-gradient(circle at center, ${a.wash}, transparent 70%)`,
          }}
        />
      )}

      <div className="relative z-10 flex items-start justify-between gap-2">
        <motion.span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md2"
          style={{ background: a.wash, color: a.color }}
          whileHover={interactive && !reduced ? { scale: 1.12, rotate: 6 } : undefined}
          transition={SPRING_SNAP}
        >
          <Icon className="h-4 w-4" strokeWidth={2.4} />
        </motion.span>
        {hint && (
          <span
            className="truncate rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{
              background: a.wash,
              color: a.color,
            }}
          >
            {hint}
          </span>
        )}
      </div>

      <p className="eyebrow relative z-10 mt-3 truncate">{label}</p>

      <p className="font-numeric relative z-10 mt-1 text-[26px] font-extrabold leading-none text-ink">
        <AnimatedNumber
          value={value}
          format={format}
          unit={unit}
          unitClassName="text-[11px] font-bold text-ink-3 align-baseline"
        />
      </p>
    </motion.div>
  );
}

export default StatTile;
