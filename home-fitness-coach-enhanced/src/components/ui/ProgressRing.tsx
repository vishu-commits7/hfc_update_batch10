import React, { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { type Accent, accent } from "../../design/accents";
import { clamp } from "../../design/format";

export interface ProgressRingProps {
  /** 0–1. Values outside are clamped rather than overflowing the arc. */
  value: number;
  size?: number;
  /** Stroke width in px. Defaults to a proportion of `size`. */
  thickness?: number;
  tone?: Accent;
  /** Leaves a gap at the bottom, arc-style, instead of a closed ring. */
  gap?: number;
  /** Adds a soft outer glow. Off by default — it is not free. */
  glow?: boolean;
  /** Animates from 0 on mount. */
  animate?: boolean;
  className?: string;
  children?: React.ReactNode;
  /** Accessible description. Without it the ring is decorative. */
  label?: string;
}

/**
 * Live progress ring.
 *
 * The arc is drawn with `stroke-dasharray` / `stroke-dashoffset` rather
 * than an SVG `<path>` recomputed per frame. That matters: a path whose
 * `d` attribute changes forces the browser to re-tessellate the geometry
 * on every frame, while a dash offset is a single animatable property the
 * compositor can interpolate. On a mid-range Android phone that is the
 * difference between a ring that holds 60fps and one that stutters
 * whenever anything else on screen moves.
 *
 * `pathLength={1}` normalises the geometry so the dash maths is in the
 * 0–1 domain and never has to know the radius — which means the same
 * component drives a 40px streak pip and a 260px session ring with no
 * per-size correction.
 */
export function ProgressRing({
  value,
  size = 120,
  thickness,
  tone = "cyan",
  gap = 0,
  glow = false,
  animate = true,
  className = "",
  children,
  label,
}: ProgressRingProps) {
  const reduced = useReducedMotion();
  const gradientId = useId();
  const v = clamp(value);
  const stroke = thickness ?? Math.max(4, Math.round(size * 0.085));
  const r = (size - stroke) / 2;
  const a = accent(tone);

  const gapFrac = clamp(gap, 0, 0.5);
  const span = 1 - gapFrac;
  const rotation = gapFrac > 0 ? 90 + gapFrac * 180 : -90;

  return (
    <div
      className={`relative inline-grid place-items-center ${className}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {glow && (
        <div
          aria-hidden
          className="bloom pointer-events-none absolute inset-0 opacity-45"
          style={{ ["--glow" as string]: a.glow }}
        />
      )}

      {/* Completion bloom — fires a slow scale-out when ring hits 100% */}
      {glow && v >= 1 && !reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle, ${a.wash} 0%, transparent 70%)` }}
          animate={{ opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        style={{ transform: `rotate(${rotation}deg)` }}
        aria-hidden
      >
        <defs>
          {/* Gradient with a richer stop range — the arc reads as having
              travelled through a light field, which a flat colour can't. */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a.color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={a.color} stopOpacity={1} />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${span} 1`}
        />

        {/* Value arc — double drop-shadow for a soft inner+outer glow */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          initial={{ strokeDashoffset: animate && !reduced ? 1 : 1 - v * span }}
          animate={{ strokeDashoffset: 1 - v * span }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 90, damping: 20, mass: 1 }
          }
          style={
            glow
              ? {
                  filter: [
                    `drop-shadow(0 0 4px ${a.color})`,
                    `drop-shadow(0 0 12px color-mix(in srgb, ${a.color} 50%, transparent))`,
                  ].join(" "),
                }
              : undefined
          }
        />
      </svg>

      {children && (
        <div className="relative z-10 grid place-items-center text-center">
          {children}
        </div>
      )}
    </div>
  );
}


export default ProgressRing;
