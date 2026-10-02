import type { Transition, Variants } from "motion/react";

/**
 * OBSIDIAN — motion language
 *
 * Every animation in the app draws from this file. The point is not
 * tidiness for its own sake: the reason most fitness apps feel cheap in
 * motion is that each screen was tuned by hand, so a card settles at one
 * rate, a sheet at another, and a tab indicator at a third. The eye reads
 * that inconsistency as sloppiness long before it can name it.
 *
 * Three principles encoded here:
 *
 *  1. SPRINGS FOR ANYTHING THE FINGER TOUCHES. A duration-based tween has
 *     a fixed runtime, so interrupting it mid-flight either snaps or
 *     restarts. Springs carry their velocity through an interruption,
 *     which is the entire reason iOS feels continuous under a fast hand.
 *
 *  2. TWEENS FOR AMBIENT MOTION. Anything that is not responding to a
 *     gesture — a screen fade, a progress fill, a number rolling up —
 *     uses expo-out, which leaves fast and settles slowly.
 *
 *  3. MASS IS THE TUNING KNOB, NOT DURATION. Heavier elements (sheets,
 *     full screens) get more mass and more damping so they feel like they
 *     have weight; small controls get less of both so they feel quick.
 */

/* ---------------------------------------------------------------------
   Springs
   ------------------------------------------------------------------ */

/** Small controls: toggles, chips, icon buttons, the nav pill. */
export const SPRING_SNAP: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 34,
  mass: 0.7,
};

/** Default for cards, list items and anything with visible surface area. */
export const SPRING_WEIGHTED: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 30,
  mass: 1,
};

/** Large travel: sheets, drawers, screen-level movement. */
export const SPRING_GLIDE: Transition = {
  type: "spring",
  stiffness: 190,
  damping: 27,
  mass: 1.15,
};

/**
 * Deliberately under-damped so it overshoots once and settles. Used only
 * where a small overshoot reads as delight rather than instability —
 * a badge landing, a completed set stamping in. Never on layout.
 */
export const SPRING_BOUNCE: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 18,
  mass: 0.8,
};

/**
 * Magnetic pointer follow. Very soft: the element should feel dragged
 * through honey toward the cursor, never snapped to it.
 */
export const SPRING_MAGNETIC: Transition = {
  type: "spring",
  stiffness: 150,
  damping: 18,
  mass: 0.6,
};

/* ---------------------------------------------------------------------
   Tweens
   ------------------------------------------------------------------ */

export const EASE_EXPO = [0.16, 1, 0.3, 1] as const;
export const EASE_QUINT = [0.22, 1, 0.36, 1] as const;
export const EASE_SMOOTH = [0.65, 0, 0.35, 1] as const;

export const TWEEN_FAST: Transition = { duration: 0.18, ease: EASE_EXPO };
export const TWEEN_BASE: Transition = { duration: 0.28, ease: EASE_EXPO };
export const TWEEN_SLOW: Transition = { duration: 0.44, ease: EASE_EXPO };

/* ---------------------------------------------------------------------
   Screen transitions
   ------------------------------------------------------------------ */

/**
 * Screens cross-dissolve with a slight depth shift rather than sliding.
 *
 * Sliding between top-level tabs implies a spatial relationship that does
 * not exist — Progress is not "to the right of" Train — and it forces the
 * outgoing screen to stay mounted and painting across its full width,
 * which is the single most common source of jank in tabbed mobile web
 * apps. Scale plus opacity composites on the GPU and costs nothing.
 *
 * The scale values are close to 1 on purpose. A screen that visibly
 * shrinks reads as a modal dismissal; 0.98 reads as depth.
 */
export const screenVariants: Variants = {
  initial: { opacity: 0, scale: 0.985, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.34, ease: EASE_EXPO },
  },
  exit: {
    opacity: 0,
    scale: 1.008,
    y: -6,
    transition: { duration: 0.18, ease: EASE_SMOOTH },
  },
};

/* ---------------------------------------------------------------------
   Staggered entrances
   ------------------------------------------------------------------ */

/**
 * Parent/child pair for lists and bento grids. `staggerChildren` is kept
 * short — anything past ~60ms per item and a twelve-item grid takes most
 * of a second to finish assembling, which stops feeling like polish and
 * starts feeling like latency.
 */
export const staggerParent: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.045, delayChildren: 0.04 },
  },
};

export const staggerChild: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.985 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING_WEIGHTED,
  },
};

/* ---------------------------------------------------------------------
   Overlays
   ------------------------------------------------------------------ */

export const scrimVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.26, ease: EASE_EXPO } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: EASE_SMOOTH } },
};

/** Right-hand slide-over (the analytics drawer on tablet/desktop). */
export const drawerVariants: Variants = {
  initial: { x: "100%" },
  animate: { x: 0, transition: SPRING_GLIDE },
  exit: { x: "100%", transition: { duration: 0.24, ease: EASE_SMOOTH } },
};

/** Bottom sheet (the same drawer on a phone, where side-in feels wrong). */
export const sheetVariants: Variants = {
  initial: { y: "100%" },
  animate: { y: 0, transition: SPRING_GLIDE },
  exit: { y: "100%", transition: { duration: 0.24, ease: EASE_SMOOTH } },
};

/** Centre-stage dialog — command palette, confirmations. */
export const dialogVariants: Variants = {
  initial: { opacity: 0, scale: 0.94, y: -12 },
  animate: { opacity: 1, scale: 1, y: 0, transition: SPRING_WEIGHTED },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -8,
    transition: { duration: 0.16, ease: EASE_SMOOTH },
  },
};

/* ---------------------------------------------------------------------
   Press physics
   ------------------------------------------------------------------ */

/**
 * Shared `whileTap` / `whileHover` values so a press feels identical
 * everywhere. Scale is tuned by element size: a 44px icon button needs a
 * deeper press than a full-width bar to register the same amount of
 * "give", because the absolute pixel movement is what the eye reads.
 */
export const press = {
  /** Full-width bars and large cards. */
  lg: { whileTap: { scale: 0.985 }, whileHover: { scale: 1.006 } },
  /** Standard buttons and tiles. */
  md: { whileTap: { scale: 0.96 }, whileHover: { scale: 1.02 } },
  /** Icon buttons and chips. */
  sm: { whileTap: { scale: 0.9 }, whileHover: { scale: 1.06 } },
} as const;
