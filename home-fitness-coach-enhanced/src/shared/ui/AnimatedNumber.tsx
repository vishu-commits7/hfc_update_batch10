import { useEffect, useState } from "react";
import {
  useMotionValue,
  useSpring,
  useReducedMotion,
  useMotionValueEvent,
} from "motion/react";
import { compact, grouped } from "../../design/format";

export interface AnimatedNumberProps {
  value: number;
  /** `grouped` → "1,240", `compact` → "1.2k", or supply your own. */
  format?: "grouped" | "compact" | ((n: number) => string);
  className?: string;
  /** Suffix rendered at reduced size and weight, e.g. "kcal". */
  unit?: string;
  unitClassName?: string;
}

/**
 * A number that rolls to its new value instead of snapping.
 *
 * Deliberately *not* implemented by animating React state — that would
 * re-render the component sixty times a second and, in a bento grid with
 * eight of these on screen, re-render the whole grid with it. The spring
 * runs on a motion value outside React, and only the formatted string is
 * committed to state, which changes at most once per frame and only when
 * the rendered text actually differs.
 *
 * Paired with `font-numeric` (tabular figures) at the call site so the
 * digits do not jitter horizontally as they roll — the detail that makes
 * the difference between "animated" and "broken".
 */
export function AnimatedNumber({
  value,
  format = "grouped",
  className = "",
  unit,
  unitClassName = "",
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const raw = useMotionValue(0);
  const spring = useSpring(raw, {
    stiffness: 110,
    damping: 24,
    mass: 0.9,
    restDelta: 0.5,
  });

  const fmt =
    typeof format === "function"
      ? format
      : format === "compact"
        ? compact
        : grouped;

  const [display, setDisplay] = useState(() => fmt(value));

  useEffect(() => {
    raw.set(value);
    // `fmt` is stable for a given `format` prop; `value` is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useMotionValueEvent(spring, "change", (latest) => {
    if (reduced) return;
    const next = fmt(latest);
    setDisplay((prev) => (prev === next ? prev : next));
  });

  // Reduced motion bypasses the spring entirely rather than running it
  // at zero duration — no subscription churn, no intermediate frames.
  const text = reduced ? fmt(value) : display;

  return (
    <span className={className}>
      <span>{text}</span>
      {unit && <span className={`ml-1 ${unitClassName}`}>{unit}</span>}
    </span>
  );
}

export default AnimatedNumber;
