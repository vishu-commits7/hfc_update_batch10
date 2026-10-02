import React from "react";
import { motion } from "motion/react";
import { useMagnetic } from "../../hooks/useMagnetic";
import { type Accent, accent, accentVars } from "../../design/accents";
import { SPRING_SNAP, SPRING_WEIGHTED } from "../../design/motion";

type Variant = "solid" | "soft" | "ghost" | "outline";
type Size = "sm" | "md" | "lg" | "xl";

export interface MagneticButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag"
  > {
  tone?: Accent;
  variant?: Variant;
  size?: Size;
  /** Renders a perfect circle — icon-only controls. */
  icon?: boolean;
  /** Stretches to the container width. */
  block?: boolean;
  /** Pull distance in px. 0 disables magnetism for this instance. */
  magnet?: number;
  children?: React.ReactNode;
}

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[11px]",
  md: "h-10 px-4 text-xs",
  lg: "h-12 px-5 text-sm",
  xl: "h-14 px-7 text-[15px]",
};

const GAPS: Record<Size, string> = {
  sm: "gap-1.5",
  md: "gap-2",
  lg: "gap-2",
  xl: "gap-2.5",
};

const ICON_SIZES: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-14 w-14",
};

const PRESS: Record<Size, number> = {
  sm: 0.9,
  md: 0.94,
  lg: 0.96,
  xl: 0.97,
};

/**
 * The app's button.
 *
 * Two behaviours it has that a plain `<button>` does not:
 *
 *  1. MAGNETISM. On a fine pointer the control drifts toward the cursor
 *     as it approaches, then springs home. It is switched off entirely on
 *     touch, where there is no approach to respond to and a moving target
 *     would hurt aim — see useMagnetic for the details.
 *
 *  2. INDEPENDENT PRESS SCALE. The press transform lives on an inner
 *     element, not on the same node as the magnetic translate. Composing
 *     both on one node makes them fight: the spring settling the pull
 *     would fight the spring driving the press, and the button jitters at
 *     the moment of the tap — exactly when it must feel solid.
 *
 * Press depth is tuned per size so the *pixel* movement stays constant.
 * A 0.96 scale on a 56px bar and on a 32px chip are not the same gesture.
 */
export function MagneticButton({
  tone = "cyan",
  variant = "solid",
  size = "md",
  icon = false,
  block = false,
  magnet = 8,
  className = "",
  style,
  children,
  disabled,
  ...rest
}: MagneticButtonProps) {
  const m = useMagnetic({ strength: magnet, radius: 70, strengthY: magnet * 0.6 });
  const a = accent(tone);

  const surface: Record<Variant, string> = {
    solid: "text-void font-bold",
    soft: "font-semibold",
    ghost: "font-semibold text-ink-2 hover:text-ink",
    outline: "font-semibold",
  };

  const surfaceStyle: Record<Variant, React.CSSProperties> = {
    solid: {
      background: a.color,
      boxShadow: [
        tone === "neutral"
          ? "none"
          : `0 8px 32px -8px color-mix(in srgb, var(--accent) 55%, transparent)`,
        tone === "neutral"
          ? "none"
          : `0 2px 8px -4px color-mix(in srgb, var(--accent) 30%, transparent)`,
      ].join(", "),
    },
    soft: { background: a.wash, color: a.color },
    ghost: { background: "transparent" },
    outline: {
      background: "transparent",
      color: a.color,
      border: "1px solid color-mix(in srgb, var(--accent) 38%, transparent)",
    },
  };

  return (
    <motion.button
      ref={m.ref as React.Ref<HTMLButtonElement>}
      onPointerMove={magnet > 0 ? m.onPointerMove : undefined}
      onPointerLeave={magnet > 0 ? m.onPointerLeave : undefined}
      style={{
        ...accentVars(tone),
        x: magnet > 0 ? m.x : 0,
        y: magnet > 0 ? m.y : 0,
        ...style,
      }}
      className={[
        "relative inline-flex select-none items-center justify-center",
        "rounded-full transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-40",
        icon ? ICON_SIZES[size] : SIZES[size],
        block ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      {...rest}
    >
      {/* Press physics live here, one level in from the magnetic
          translate, so the two springs never drive the same transform. */}
      <motion.span
        className={[
          "absolute inset-0 overflow-hidden rounded-full",
          variant === "ghost" ? "hover:bg-[var(--line-faint)]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={surfaceStyle[variant]}
        whileTap={disabled ? undefined : { scale: PRESS[size] }}
        whileHover={disabled ? undefined : { scale: 1.03 }}
        transition={SPRING_SNAP}
      >
        {/* Shimmer sweep — only on the solid variant where there's a colour
            surface to sweep across. Opacity is kept very low so it reads
            as a light glint rather than a disco flash. */}
        {variant === "solid" && !disabled && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={{ x: "-110%", opacity: 0 }}
            whileHover={{ x: "110%", opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background:
                "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)",
            }}
          />
        )}
      </motion.span>
      <span
        className={[
          "relative z-10 inline-flex items-center justify-center whitespace-nowrap",
          GAPS[size],
          surface[variant],
        ]
          .filter(Boolean)
          .join(" ")}
        style={variant === "solid" ? { color: "var(--void)" } : undefined}
      >
        {children}
      </span>
    </motion.button>
  );
}

/**
 * A control that is visually a button but semantically a link/row — used
 * where the whole card is the hit target. Same press physics, no chrome.
 */
export function PressableRow({
  className = "",
  children,
  ...rest
}: Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag"
> & { children?: React.ReactNode }) {
  return (
    <motion.button
      className={["relative block w-full text-left", className]
        .filter(Boolean)
        .join(" ")}
      whileTap={{ scale: 0.985 }}
      transition={SPRING_WEIGHTED}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export default MagneticButton;
