import React, { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { type Accent, accentVars } from "../../design/accents";
import { SPRING_WEIGHTED } from "../../design/motion";

export interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  /** Accent used for the hairline glow and any bloom inside. */
  glow?: Accent;
  /** `true` lights the hairline in the accent colour. */
  lit?: boolean;
  /**
   * Surface variant:
   *  - `default`  — gradient-faked glass (.surface)
   *  - `frosted`  — real backdrop-filter (.glass), rationed to nav/drawers
   *  - `aurora`   — diagonal colour wash from accent tokens (.aurora-card)
   *  - `prism`    — rainbow gradient border (.prism-card)
   *  - `session`  — deep session-mode surface (.session-surface)
   */
  variant?: "default" | "frosted" | "aurora" | "prism" | "session";
  /** Adds the interactive press/hover physics. */
  interactive?: boolean;
  /** Corner radius step. */
  radius?: "md" | "lg" | "xl" | "2xl" | "3xl";
  /** Adds fine grain over the fill to stop gradient banding. */
  grain?: boolean;
  /**
   * Activates the neon-border glow overlay (more intense than lit).
   * Best for hero cards and achievement moments.
   */
  neon?: boolean;
  children?: React.ReactNode;
}

const RADIUS: Record<NonNullable<GlassCardProps["radius"]>, string> = {
  md: "rounded-md2",
  lg: "rounded-lg2",
  xl: "rounded-xl2",
  "2xl": "rounded-2xl2",
  "3xl": "rounded-3xl2",
};

/**
 * The app's standard surface — now with five variants.
 *
 * `aurora` is the key addition: a subtle diagonal colour wash derived
 * from the aurora-a/b/c tokens that shifts the flat obsidian surface
 * into something that reads as internally lit without requiring a photo.
 * It is the visual upgrade most responsible for the "premium" feel on
 * first launch.
 *
 * `prism` uses the CSS gradient-border trick (background-clip: padding-box
 * + a pseudo-element) to paint a rainbow-tinted hairline — the single
 * detail that makes a card feel holographic without garish colour.
 *
 * Both carry the same interaction physics as the original GlassCard,
 * so adopting them in existing code is a one-prop change.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  function GlassCard(
    {
      glow = "neutral",
      lit = false,
      variant = "default",
      interactive = false,
      radius = "xl",
      grain = false,
      neon = false,
      className = "",
      style,
      children,
      ...rest
    },
    ref,
  ) {
    const surfaceClass: Record<NonNullable<GlassCardProps["variant"]>, string> =
      {
        default: "surface",
        frosted: "glass",
        aurora: "aurora-card",
        prism: "prism-card",
        session: "session-surface",
      };

    return (
      <motion.div
        ref={ref}
        className={[
          "relative overflow-hidden",
          surfaceClass[variant],
          lit ? "hairline-glow" : "",
          neon ? "neon-border" : "",
          grain ? "grain" : "",
          RADIUS[radius],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ ...accentVars(glow), ...style }}
        {...(interactive
          ? {
              whileHover: { y: -3, transition: SPRING_WEIGHTED },
              whileTap: { scale: 0.985, transition: SPRING_WEIGHTED },
            }
          : {})}
        {...rest}
      >
        {children}
      </motion.div>
    );
  },
);

export default GlassCard;
