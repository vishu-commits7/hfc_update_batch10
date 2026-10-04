import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { type Accent, accent } from "../../design/accents";

export interface HeatmapDay {
  date: Date;
  count: number;
}

export interface WeeklyHeatmapProps {
  /** Array of days with workout counts. Gaps are treated as zeros. */
  days: HeatmapDay[];
  /** Number of weeks to display. */
  weeks?: number;
  tone?: Accent;
  className?: string;
  label?: string;
}

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * WeeklyHeatmap — a GitHub-style activity heatmap showing the last N weeks.
 *
 * The intensity of each cell is derived from the count: zero → track
 * colour, 1 → wash, 2+ → accent at 60%, 3+ → full accent. The four
 * steps give a clear sense of "light training week" vs "beast mode".
 *
 * Design decisions:
 *  - Cells are square, not rectangles — a square grid reads as a calendar.
 *  - Each week is a column (not a row), matching the GitHub convention
 *    that most users have already internalised.
 *  - Month labels are derived from the data, not passed as props, so
 *    the component stays stateless and predictable.
 *  - The total count and longest run are surfaced as summary stats
 *    below the grid for quick scanning.
 */
export function WeeklyHeatmap({
  days,
  weeks = 12,
  tone = "cyan",
  className = "",
  label = "Training activity over the last 12 weeks",
}: WeeklyHeatmapProps) {
  const reduced = useReducedMotion();
  const a = accent(tone);

  const { grid, monthLabels, totalSessions, longestStreak } = useMemo(() => {
    // Build a lookup from ISO date string to count
    const lookup = new Map<string, number>();
    for (const d of days) {
      const key = d.date.toDateString();
      lookup.set(key, (lookup.get(key) ?? 0) + d.count);
    }

    // Work backwards from today, building a full column-major grid
    // (each column = one week, Mon at top)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cols: { date: Date; count: number; dayOfWeek: number }[][] = [];
    let cur = new Date(today);

    // Walk back to the start of the earliest week (weeks * 7 days ago)
    const daysBack = weeks * 7 - 1;
    const start = new Date(today);
    start.setDate(today.getDate() - daysBack);
    // Round to the start of that week (Sunday)
    const startDow = start.getDay();
    start.setDate(start.getDate() - startDow);

    cur = new Date(start);
    while (cur <= today) {
      const col: { date: Date; count: number; dayOfWeek: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(cur);
        day.setDate(cur.getDate() + d);
        col.push({
          date: day,
          count: lookup.get(day.toDateString()) ?? 0,
          dayOfWeek: d,
        });
      }
      cols.push(col);
      cur.setDate(cur.getDate() + 7);
    }

    // Month labels: mark the first column of each month
    const monthLabels: { colIndex: number; label: string }[] = [];
    let lastMonth = -1;
    cols.forEach((col, ci) => {
      const month = col[0].date.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({
          colIndex: ci,
          label: col[0].date.toLocaleString("default", { month: "short" }),
        });
        lastMonth = month;
      }
    });

    // Stats
    const totalSessions = [...lookup.values()].reduce((s, v) => s + v, 0);

    // Longest streak (consecutive days with ≥1 session)
    let longest = 0;
    let current = 0;
    const dayMs = 86400000;
    const sortedDates = [...lookup.entries()]
      .filter(([, v]) => v > 0)
      .map(([k]) => new Date(k).getTime())
      .sort((a, b) => a - b);
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0 || sortedDates[i] - sortedDates[i - 1] > dayMs) {
        current = 1;
      } else {
        current++;
      }
      longest = Math.max(longest, current);
    }

    return { grid: cols, monthLabels, totalSessions, longestStreak: longest };
  }, [days, weeks]);

  const cellSize = 11;
  const gap = 2;

  function cellColor(count: number, isFuture: boolean): string {
    if (isFuture) return "transparent";
    if (count === 0) return "var(--line-faint)";
    if (count === 1) return a.wash;
    if (count === 2) return `color-mix(in srgb, ${a.color} 55%, transparent)`;
    return a.color;
  }

  function cellGlow(count: number): string | undefined {
    if (count >= 3) return `0 0 6px 0 ${a.color}`;
    if (count === 2)
      return `0 0 4px 0 color-mix(in srgb, ${a.color} 50%, transparent)`;
    return undefined;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div
      className={`relative ${className}`}
      role="img"
      aria-label={label}
    >
      {/* Month labels */}
      <div
        className="mb-1 flex"
        style={{ gap, paddingLeft: cellSize + gap + 2 }}
        aria-hidden
      >
        {grid.map((_col, ci) => {
          const ml = monthLabels.find((m) => m.colIndex === ci);
          return (
            <div
              key={ci}
              style={{ width: cellSize, flexShrink: 0 }}
              className="text-[8px] font-bold text-ink-4"
            >
              {ml ? ml.label : ""}
            </div>
          );
        })}
      </div>

      <div className="flex" style={{ gap }}>
        {/* Day-of-week labels */}
        <div
          className="flex flex-col"
          style={{ gap, width: cellSize, marginRight: 2 }}
          aria-hidden
        >
          {DAY_INITIALS.map((d, i) => (
            <div
              key={i}
              style={{ height: cellSize, fontSize: 7 }}
              className="flex items-center justify-center font-bold text-ink-4"
            >
              {i % 2 === 0 ? d : ""}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex overflow-x-auto" style={{ gap }}>
          {grid.map((col, ci) => (
            <div key={ci} className="flex flex-col" style={{ gap }}>
              {col.map((cell, di) => {
                const isFuture = cell.date > today;
                const isToday = cell.date.getTime() === today.getTime();
                const color = cellColor(cell.count, isFuture);
                const glow = cellGlow(cell.count);
                const delay = reduced ? 0 : (ci * 7 + di) * 0.004;

                return (
                  <motion.div
                    key={di}
                    title={
                      isFuture
                        ? undefined
                        : `${cell.date.toLocaleDateString("default", { month: "short", day: "numeric" })}: ${cell.count} session${cell.count !== 1 ? "s" : ""}`
                    }
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: 3,
                      background: color,
                      boxShadow: glow,
                      border: isToday
                        ? `1px solid ${a.color}`
                        : "1px solid transparent",
                      flexShrink: 0,
                    }}
                    initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: isFuture ? 0 : 1, scale: 1 }}
                    transition={{ duration: 0.3, delay }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-3 flex items-center gap-4">
        <Stat label="Total sessions" value={totalSessions} color={a.color} />
        <span className="h-3 w-px bg-[var(--line)]" />
        <Stat label="Longest streak" value={`${longestStreak}d`} color={a.color} />
        <div className="ml-auto flex items-center gap-1" aria-hidden>
          <span className="text-[9px] text-ink-4">Less</span>
          {[0, 1, 2, 3].map((level) => (
            <div
              key={level}
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background:
                  level === 0
                    ? "var(--line-faint)"
                    : level === 1
                      ? a.wash
                      : level === 2
                        ? `color-mix(in srgb, ${a.color} 55%, transparent)`
                        : a.color,
              }}
            />
          ))}
          <span className="text-[9px] text-ink-4">More</span>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-numeric text-xs font-extrabold" style={{ color }}>
        {value}
      </span>
      <span className="text-[10px] text-ink-4">{label}</span>
    </div>
  );
}

export default WeeklyHeatmap;
