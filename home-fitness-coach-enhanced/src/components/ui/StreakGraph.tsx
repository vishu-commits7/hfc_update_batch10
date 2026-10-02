import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { type Accent, accent } from "../../design/accents";

export interface StreakPoint {
  /** Short axis label — "M", "18", "Sep". */
  label: string;
  /** Raw value. The scale is derived across the series. */
  value: number;
  /** Long-form label for the tooltip and the accessible table. */
  detail?: string;
  /** Marks today / the current period for emphasis. */
  current?: boolean;
}

export interface StreakGraphProps {
  data: StreakPoint[];
  tone?: Accent;
  height?: number;
  /** Bars read better for counts; the area reads better for a trend. */
  variant?: "bars" | "area";
  className?: string;
  /** Announced to screen readers before the data table. */
  caption?: string;
}

/**
 * Interactive activity graph.
 *
 * Design decisions worth naming:
 *
 *  - NO AXES, NO GRIDLINES. Seven-to-twelve values of a single series do
 *    not need a coordinate system; they need a shape. The one reference
 *    line kept is the mean, because "above or below my average" is the
 *    only comparison a user actually makes here.
 *
 *  - DIRECT LABELS OVER A LEGEND. One series, so a legend would be a
 *    key to nothing. The value appears on the bar the user is touching.
 *
 *  - EMPTY IS NOT ZERO-HEIGHT. A day with no workout still draws a faint
 *    stub. A bar of literally zero height is indistinguishable from a
 *    rendering failure, and the row of stubs is what makes a gap in the
 *    streak legible as a gap.
 *
 *  - COLOUR IS NOT THE ONLY CHANNEL. The current period is marked by a
 *    brighter fill *and* a cap dot *and* a bolder label, so it survives
 *    greyscale and colour-blindness.
 *
 * A visually-hidden `<table>` carries the same numbers for screen
 * readers — an SVG shape on its own is not data to a non-visual user.
 */
export function StreakGraph({
  data,
  tone = "emerald",
  height = 96,
  variant = "bars",
  className = "",
  caption = "Activity over the period",
}: StreakGraphProps) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const a = accent(tone);

  const { max, mean, points } = useMemo(() => {
    const values = data.map((d) => d.value);
    // A max of at least 1 keeps an all-zero series from dividing by zero
    // and from drawing every bar at full height.
    const m = Math.max(1, ...values);
    const avg = values.length
      ? values.reduce((s, v) => s + v, 0) / values.length
      : 0;
    return {
      max: m,
      mean: avg,
      points: data.map((d) => ({ ...d, pct: d.value / m })),
    };
  }, [data]);

  if (!data.length) return null;

  const meanPct = mean / max;

  return (
    <div className={`relative ${className}`}>
      <div
        className="relative flex items-end justify-between gap-1.5"
        style={{ height }}
        onPointerLeave={() => setActive(null)}
      >
        {/* Mean reference — positioned inside the plot box so its
            percentage is measured against the same height the bars are. */}
        {mean > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 z-0 border-t border-dashed"
            style={{
              borderColor: "var(--line-strong)",
              bottom: `${meanPct * 100}%`,
            }}
          />
        )}
        {points.map((p, i) => {
          const isActive = active === i;
          const emphasise = p.current || isActive;
          return (
            <button
              key={`${p.label}-${i}`}
              type="button"
              className="group relative flex h-full flex-1 cursor-default items-end justify-center"
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${p.detail ?? p.label}: ${p.value}`}
            >
              {/* Tooltip */}
              {isActive && p.value > 0 && (
                <motion.span
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.14 }}
                  className="pointer-events-none absolute inset-x-0 -top-1 z-20 mx-auto w-max rounded-md2 border border-line px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ background: "var(--graphite)", color: a.color }}
                >
                  {p.value}
                </motion.span>
              )}

              {/* The bar is capped at 10px wide and centred in its slot.
                  Letting it fill the slot turns a short bar into an
                  ellipse once `rounded-full` is applied — at seven
                  columns across a phone the week strip renders as a row
                  of circles rather than as a chart. */}
              <motion.span
                className="relative w-full max-w-[10px] origin-bottom rounded-full"
                style={{
                  background: emphasise
                    ? a.color
                    : p.value > 0
                      ? `color-mix(in srgb, ${a.color} 34%, transparent)`
                      : "var(--line)",
                  boxShadow: emphasise
                    ? `0 0 16px -2px ${a.color}`
                    : undefined,
                }}
                initial={
                  reduced
                    ? false
                    : { height: variant === "bars" ? 3 : `${p.pct * 100}%` }
                }
                animate={{
                  // The 3px floor is the "empty is not zero-height" rule.
                  height: p.value > 0 ? `${Math.max(8, p.pct * 100)}%` : 3,
                }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 200,
                        damping: 24,
                        delay: i * 0.035,
                      }
                }
              >
                {p.current && p.value > 0 && (
                  <span
                    aria-hidden
                    className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                    style={{ background: a.color }}
                  />
                )}
              </motion.span>
            </button>
          );
        })}
      </div>

      {/* Labels */}
      <div className="mt-2 flex items-center justify-between gap-1.5">
        {points.map((p, i) => (
          <span
            key={`l-${p.label}-${i}`}
            className="flex-1 text-center text-[10px] font-bold tabular-nums"
            style={{
              color: p.current || active === i ? a.color : "var(--ink-4)",
            }}
          >
            {p.label}
          </span>
        ))}
      </div>

      {/* Non-visual equivalent. */}
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={`sr-${i}`}>
              <th scope="row">{d.detail ?? d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StreakGraph;
