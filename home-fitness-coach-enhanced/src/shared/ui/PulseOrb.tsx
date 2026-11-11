import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { type Accent, accent } from "../../design/accents";

export interface PulseOrbProps {
  /**
   * The accent colour of the orb. Controls both the SVG ring and
   * the radial bloom behind it.
   */
  tone?: Accent;
  /**
   * Size of the orb in pixels (outer diameter of the SVG rings).
   * Children are centred inside.
   */
  size?: number;
  /** If true, a second ring ripples outward in a continuous loop. */
  ripple?: boolean;
  className?: string;
  children?: React.ReactNode;
  /** Accessible label — required when the orb conveys status. */
  label?: string;
}

/**
 * PulseOrb — a breathing, glowing ring used in session mode and on
 * the streak hero card.
 *
 * The orb layers three elements:
 *  1. A soft radial bloom behind it (the "ambient field").
 *  2. A large, slowly breathing SVG circle (the "rest ring").
 *  3. When `ripple` is true, a second circle that expands and fades
 *     outward — the heartbeat pulse that signals "alive".
 *
 * All three are composited on the GPU (`will-change: transform, opacity`)
 * and rendered only when the component is mounted, so there is zero cost
 * on screens where it is not used.
 */
export function PulseOrb({
  tone = "cyan",
  size = 200,
  ripple = false,
  className = "",
  children,
  label,
}: PulseOrbProps) {
  const reduced = useReducedMotion();
  const a = accent(tone);
  const r = (size - 4) / 2;
  const cx = size / 2;

  return (
    <div
      className={`relative inline-grid place-items-center ${className}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {/* Ambient bloom behind the ring — purely decorative */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, ${a.wash} 0%, transparent 65%)`,
          filter: "blur(24px)",
          transform: "scale(1.4)",
        }}
      />

      {/* SVG rings */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        aria-hidden
      >
        {/* Ripple ring — expands and fades on loop */}
        {ripple && !reduced && (
          <motion.circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={1.5}
            initial={{ scale: 0.88, opacity: 0.5 }}
            animate={{ scale: 1.52, opacity: 0 }}
            transition={{
              duration: 2.4,
              ease: "easeOut",
              repeat: Infinity,
              repeatDelay: 0.4,
            }}
            style={{ transformOrigin: `${cx}px ${cx}px` }}
          />
        )}

        {/* Primary breathing ring */}
        <motion.circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={a.color}
          strokeWidth={2}
          strokeOpacity={0.55}
          animate={
            reduced
              ? {}
              : {
                  strokeOpacity: [0.4, 0.7, 0.4],
                  r: [r * 0.96, r, r * 0.96],
                }
          }
          transition={{
            duration: 3.2,
            ease: "easeInOut",
            repeat: Infinity,
          }}
          style={{ transformOrigin: `${cx}px ${cx}px` }}
        />

        {/* Inner accent ring — static, high contrast */}
        <circle
          cx={cx}
          cy={cx}
          r={r * 0.72}
          fill="none"
          stroke={a.color}
          strokeWidth={1}
          strokeOpacity={0.25}
        />
      </svg>

      {/* Content centred in the orb */}
      {children && (
        <div className="relative z-10 grid place-items-center text-center">
          {children}
        </div>
      )}
    </div>
  );
}

export default PulseOrb;
