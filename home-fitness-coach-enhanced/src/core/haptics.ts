/**
 * Tactile feedback.
 *
 * Rewritten to remove a hard dependency. The previous version did a
 * static `import { Haptics } from "@capacitor/haptics"`, but that package
 * is not in package.json and is not installed — so every module that
 * imported this one became unbuildable, and the only reason the app
 * still built was that all of its importers happened to be unreachable
 * from App.tsx. Making that dependency optional is what lets the new
 * interactive surfaces use haptics at all.
 *
 * Resolution strategy, in order:
 *   1. `@capacitor/haptics` if the plugin is installed — real native
 *      haptics on Android and iOS, with proper impact styles.
 *   2. `navigator.vibrate` — the web fallback. Coarser (duration only,
 *      no styles) but present on most Android browsers.
 *   3. Silence. Never throws, never warns in a loop.
 *
 * The plugin probe runs once, lazily, on the first feedback call, and is
 * cached. It is deliberately not run at module load: resolving a missing
 * module at import time is what created the original problem.
 */

type ImpactWeight = "light" | "medium" | "heavy";

interface HapticsPlugin {
  impact(options: { style: string }): Promise<void>;
  notification(options: { type: string }): Promise<void>;
}

let enabled = true;
try {
  enabled = localStorage.getItem("kinetic_haptics_enabled") !== "false";
} catch {
  /* storage unavailable — default to on */
}

/** `undefined` = not probed yet, `null` = probed and unavailable. */
let plugin: HapticsPlugin | null | undefined;
let probe: Promise<void> | null = null;

async function resolvePlugin(): Promise<void> {
  if (plugin !== undefined) return;
  if (probe) return probe;
  probe = (async () => {
    try {
      // The specifier is built at runtime so bundlers treat this as an
      // external, optional import rather than resolving it at build time
      // and failing the build when the package is absent.
      const id = "@capacitor" + "/haptics";
      const mod = (await import(/* @vite-ignore */ id)) as {
        Haptics?: HapticsPlugin;
      };
      plugin = mod?.Haptics ?? null;
    } catch {
      plugin = null;
    }
  })();
  return probe;
}

function webVibrate(pattern: number | number[]): void {
  // Chrome refuses `vibrate` until the document has been tapped, and logs
  // a console warning every time it refuses. Anything that fires on mount
  // — a milestone celebration on the dashboard, for instance — hits that
  // path on a cold start and fills the console with warnings that look
  // like bugs. Checking first is silent and costs nothing.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
    return;
  }
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported or blocked by permissions policy */
  }
}

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
  try {
    localStorage.setItem("kinetic_haptics_enabled", String(value));
  } catch {
    /* ignore */
  }
}

export function isHapticsEnabled(): boolean {
  return enabled;
}

async function impact(weight: ImpactWeight, fallbackMs: number): Promise<void> {
  if (!enabled) return;
  await resolvePlugin();
  if (plugin) {
    try {
      await plugin.impact({ style: weight.toUpperCase() });
      return;
    } catch {
      /* fall through to the web path */
    }
  }
  webVibrate(fallbackMs);
}

/** Light tap — navigation, toggles, minor presses. */
export async function tapFeedback(): Promise<void> {
  return impact("light", 8);
}

/** Medium tap — selecting something, adding or removing an item. */
export async function selectFeedback(): Promise<void> {
  return impact("medium", 14);
}

/** Positive confirmation — a set completed, a log saved, a like. */
export async function successFeedback(): Promise<void> {
  if (!enabled) return;
  await resolvePlugin();
  if (plugin) {
    try {
      await plugin.notification({ type: "SUCCESS" });
      return;
    } catch {
      /* fall through */
    }
  }
  webVibrate([12, 40, 18]);
}

/** Celebration — workout finished, badge unlocked. */
export async function celebrateFeedback(): Promise<void> {
  if (!enabled) return;
  await resolvePlugin();
  if (plugin) {
    try {
      await plugin.notification({ type: "SUCCESS" });
      setTimeout(() => {
        plugin?.impact({ style: "MEDIUM" }).catch(() => {});
      }, 150);
      return;
    } catch {
      /* fall through */
    }
  }
  webVibrate([14, 50, 14, 50, 26]);
}

/** Warning — destructive actions and errors. */
export async function warnFeedback(): Promise<void> {
  if (!enabled) return;
  await resolvePlugin();
  if (plugin) {
    try {
      await plugin.notification({ type: "WARNING" });
      return;
    } catch {
      /* fall through */
    }
  }
  webVibrate([26, 60, 26]);
}
