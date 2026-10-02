import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { accent, type Accent } from "../design/accents";

export interface PacingSegment {
  kind: "work" | "rest";
  seconds: number;
  /** Index of the owning exercise, for the tick marks. */
  exercise: number;
}

export interface SessionPacingProps {
  segments: PacingSegment[];
  /** Planned seconds elapsed, used to place the playhead. */
  elapsed: number;
  tone?: Accent;
  height?: number;
  className?: string;
}

/**
 * Session pacing curve.
 *
 * Plots the whole session as one continuous intensity profile: work
 * intervals ride high, rest intervals drop, and the width of each block
 * is proportional to its real duration. A playhead sweeps across it and
 * the traversed region fills in.
 *
 * The point is orientation. A countdown answers "how long until this set
 * ends" but says nothing about where you are in the session — which is
 * the question people actually ask at minute nine of a twenty-minute
 * workout. The shape of the remaining curve answers it at a glance:
 * you can see the two long work blocks still to come, and that the
 * rests get shorter toward the end.
 *
 * Built as a single smoothed path rather than a bar chart because the
 * eye reads a continuous line as a *duration* and a row of bars as a
 * set of discrete items — and a session is a duration.
 */
export function SessionPacing({
  segments,
  elapsed,
  tone = "cyan",
  height = 56,
  className = "",
}: SessionPacingProps) {
  const reduced = useReducedMotion();
  const gid = useId();
  const a = accent(tone);

  const { path, area, total, ticks } = useMemo(() => {
    const totalSeconds = segments.reduce((s, seg) => s + seg.seconds, 0) || 1;
    const W = 1000;
    const H = 100;
    const TOP = 16;
    const BOTTOM = 78;

    // Build the profile as a list of [x, y] corners, then round the
    // transitions so the curve reads as effort ramping rather than as a
    // square wave.
    const pts: { x: number; y: number }[] = [];
    let cursor = 0;
    segments.forEach((seg) => {
      const x0 = (cursor / totalSeconds) * W;
      cursor += seg.seconds;
      const x1 = (cursor / totalSeconds) * W;
      const y = seg.kind === "work" ? TOP : BOTTOM;
      pts.push({ x: x0, y });
      pts.push({ x: x1, y });
    });

    if (!pts.length) {
      return { path: "", area: "", total: totalSeconds, ticks: [] };
    }

    // Corner radius is capped by the shortest adjacent run so a 10-second
    // rest between two long blocks still renders as a visible dip instead
    // of being rounded away entirely.
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i += 2) {
      const cur = pts[i];
      const next = pts[i + 1];
      const prev = pts[i - 1];
      const runIn = Math.abs(cur.x - prev.x);
      const runOut = Math.abs(pts[Math.min(i + 2, pts.length - 1)].x - next.x);
      const r = Math.max(2, Math.min(14, runIn / 2, runOut / 2 || 14));
      d += ` L ${cur.x - r} ${cur.y}`;
      d += ` Q ${cur.x} ${cur.y} ${cur.x + Math.min(r, (next.x - cur.x) / 2 || r)} ${next.y}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x} ${last.y}`;

    const areaPath = `${d} L ${W} ${H} L 0 ${H} Z`;

    const tickList: number[] = [];
    let seen = -1;
    let acc = 0;
    segments.forEach((seg) => {
      if (seg.kind === "work" && seg.exercise !== seen) {
        seen = seg.exercise;
        tickList.push((acc / totalSeconds) * W);
      }
      acc += seg.seconds;
    });

    return { path: d, area: areaPath, total: totalSeconds, ticks: tickList };
  }, [segments]);

  if (!segments.length) return null;

  const progress = Math.max(0, Math.min(1, elapsed / total));

  return (
    <div className={`relative w-full ${className}`} style={{ height }}>
      <svg
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={a.color} stopOpacity={0.34} />
            <stop offset="100%" stopColor={a.color} stopOpacity={0} />
          </linearGradient>
          {/* The traversed region is revealed by animating this clip's
              width — one animatable attribute, rather than re-generating
              the path geometry on every tick. */}
          <clipPath id={`${gid}-clip`}>
            <motion.rect
              x="0"
              y="-20"
              height="140"
              initial={false}
              animate={{ width: progress * 1000 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
              }
            />
          </clipPath>
        </defs>

        {/* Exercise boundaries */}
        {ticks.map((x, i) => (
          <line
            key={i}
            x1={x}
            x2={x}
            y1={6}
            y2={94}
            stroke="var(--line)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Upcoming */}
        <path
          d={path}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Completed */}
        <g clipPath={`url(#${gid}-clip)`}>
          <path d={area} fill={`url(#${gid}-fill)`} />
          <path
            d={path}
            fill="none"
            stroke={a.color}
            strokeWidth={3}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>

      {/* Playhead. Positioned in CSS percentage rather than inside the
          non-uniformly scaled SVG, so it stays a true circle at every
          container width instead of stretching into an ellipse. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute top-0 h-full w-px"
        style={{ background: a.color, boxShadow: `0 0 12px ${a.color}` }}
        initial={false}
        animate={{ left: `${progress * 100}%` }}
        transition={
          reduced ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
        }
      >
        <span
          className="absolute -left-[3px] top-0 h-1.5 w-1.5 rounded-full"
          style={{ background: a.color }}
        />
      </motion.span>
    </div>
  );
}

export default SessionPacing;
