import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Clock, Flame, Target, Zap } from "lucide-react";
import { SPRING_SNAP } from "../../design/motion";

export interface LiveMetricsBarProps {
  /** Total seconds elapsed since the session started. */
  elapsedSeconds: number;
  /** Estimated kcal burned so far. */
  calories: number;
  /** Number of sets fully completed. */
  setsCompleted: number;
  /** Total sets in the entire workout plan. */
  totalSets: number;
  /** Whether the timer is currently paused. */
  paused?: boolean;
}

const HRZ_LABELS = ["Warm-up", "Fat burn", "Aerobic", "Anaerobic", "Max"];
const HRZ_COLORS = [
  "var(--cyan)",
  "var(--emerald)",
  "var(--gold)",
  "var(--ember)",
  "var(--crimson)",
];

/**
 * LiveMetricsBar — a floating heads-up display strip in session mode.
 *
 * Shows four real-time values: elapsed time, calories, set progress and
 * an estimated heart-rate zone (derived purely from session intensity,
 * no wearable required — the point is the *feeling* of live telemetry).
 *
 * The bar floats at the top of the viewport on a frosted glass surface
 * so it never occludes the exercise demo or the clock. It fades to 60%
 * opacity when paused so it visually confirms the session is suspended.
 */
export function LiveMetricsBar({
  elapsedSeconds,
  calories,
  setsCompleted,
  totalSets,
  paused = false,
}: LiveMetricsBarProps) {
  const reduced = useReducedMotion();

  // Estimate HR zone from session intensity.
  // Intensity rises from zone 1 at start and plateaus around zone 3–4
  // for a typical 20–45 minute session. This is deliberately approximate
  // — the value gives the user a sense of effort, not a medical reading.
  const intensity = Math.min(1, elapsedSeconds / (20 * 60));
  const zoneIndex = Math.min(4, Math.floor(intensity * 3.5));
  const zoneLabel = HRZ_LABELS[zoneIndex];
  const zoneColor = HRZ_COLORS[zoneIndex];

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const elapsed = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const setProgress = totalSets > 0 ? setsCompleted / totalSets : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: paused ? 0.55 : 1, y: 0 }}
      transition={SPRING_SNAP}
      className="glass fixed inset-x-0 top-0 z-30 border-b-0 border-l-0 border-r-0"
      style={{ paddingTop: "calc(var(--safe-t) + 6px)", paddingBottom: "8px" }}
      aria-label="Live session metrics"
      role="status"
      aria-live="off"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 sm:px-6">
        {/* Elapsed time */}
        <Metric
          icon={<Clock className="h-3 w-3" />}
          value={elapsed}
          label="elapsed"
          color="var(--cyan)"
        />

        {/* Set progress mini-bar */}
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full max-w-[120px] items-center gap-1.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, var(--cyan-dim) 0%, var(--cyan) 100%)`,
                  boxShadow: "0 0 6px var(--cyan)",
                }}
                animate={{ width: `${setProgress * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <span className="font-numeric shrink-0 text-[10px] font-bold text-ink-3">
              {setsCompleted}/{totalSets}
            </span>
          </div>
          <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-ink-4">
            sets done
          </span>
        </div>

        {/* Calories */}
        <Metric
          icon={<Flame className="h-3 w-3" />}
          value={calories.toFixed(0)}
          label="kcal"
          color="var(--ember)"
        />

        {/* HR Zone */}
        <div className="flex flex-col items-end gap-0.5">
          <AnimatePresence mode="wait">
            <motion.div
              key={zoneLabel}
              initial={reduced ? false : { opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-1"
            >
              <Zap className="h-2.5 w-2.5" style={{ color: zoneColor }} strokeWidth={2.5} />
              <span
                className="text-[10px] font-extrabold"
                style={{ color: zoneColor }}
              >
                {zoneLabel}
              </span>
            </motion.div>
          </AnimatePresence>
          {/* Zone mini-bars */}
          <div className="flex items-end gap-0.5">
            {HRZ_COLORS.map((c, i) => (
              <motion.span
                key={i}
                className="inline-block w-1.5 rounded-sm"
                style={{
                  height: 4 + i * 2,
                  background: i <= zoneIndex ? c : "var(--line)",
                  opacity: i === zoneIndex ? 1 : i < zoneIndex ? 0.6 : 0.25,
                }}
                animate={
                  i === zoneIndex && !paused && !reduced
                    ? { opacity: [0.8, 1, 0.8] }
                    : {}
                }
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Metric({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1" style={{ color }}>
        {icon}
        <span className="font-numeric text-[13px] font-extrabold leading-none">
          {value}
        </span>
      </div>
      <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-ink-4">
        {label}
      </span>
    </div>
  );
}

export default LiveMetricsBar;
