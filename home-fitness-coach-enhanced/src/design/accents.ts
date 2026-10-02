/**
 * OBSIDIAN — accent semantics
 *
 * Five accents, each with exactly one meaning. The constraint is the
 * point: the moment a hue is used for two unrelated things, it stops
 * carrying information and becomes decoration, and the interface loses
 * the ability to say anything with colour at all.
 *
 *   emerald — success, completion, a streak that is alive
 *   cyan    — live data, telemetry, the primary interactive colour
 *   gold    — achievement, records, personal bests
 *   ember   — heat and intensity: calories, effort, load
 *   crimson — destructive actions and failure states. Nothing else.
 *
 * Colour is never the only channel. Every accented element in the app
 * also carries an icon, a label or a position, so the meaning survives
 * for a colour-blind user and in a screenshot printed in greyscale.
 */

import type { CSSProperties } from "react";

export type Accent =
  | "emerald"
  | "cyan"
  | "gold"
  | "ember"
  | "crimson"
  | "neutral";

interface AccentTokens {
  /** Solid colour — text, strokes, fills. */
  color: string;
  /** Low-alpha fill for chips and tinted wells. */
  wash: string;
  /** Value for the `--glow` custom property consumed by `.hairline-glow`
   *  and `.bloom` in styles/base.css. */
  glow: string;
}

const NEUTRAL: AccentTokens = {
  color: "var(--ink-2)",
  wash: "var(--line-faint)",
  glow: "var(--ink-3)",
};

const MAP: Record<Accent, AccentTokens> = {
  emerald: {
    color: "var(--emerald)",
    wash: "var(--emerald-wash)",
    glow: "var(--emerald)",
  },
  cyan: { color: "var(--cyan)", wash: "var(--cyan-wash)", glow: "var(--cyan)" },
  gold: { color: "var(--gold)", wash: "var(--gold-wash)", glow: "var(--gold)" },
  ember: {
    color: "var(--ember)",
    wash: "var(--ember-wash)",
    glow: "var(--ember)",
  },
  crimson: {
    color: "var(--crimson)",
    wash: "var(--crimson-wash)",
    glow: "var(--crimson)",
  },
  neutral: NEUTRAL,
};

export function accent(name: Accent = "neutral"): AccentTokens {
  return MAP[name] ?? NEUTRAL;
}

/**
 * Inline style object that publishes an accent to CSS. Components spread
 * this so their children can reference `var(--glow)` / `var(--accent)`
 * without prop-drilling the colour down the tree.
 */
export function accentVars(name: Accent = "neutral"): CSSProperties {
  const a = accent(name);
  return {
    ["--accent" as string]: a.color,
    ["--accent-wash" as string]: a.wash,
    ["--glow" as string]: a.glow,
  };
}
