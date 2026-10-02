import { GENERIC_MOTION, MOTIONS, MOTION_BY_ID, PATTERN_DEFAULTS } from "./library";
import type { Motion, MotionMatch, MovementPattern } from "./types";

/**
 * OBSIDIAN — exercise name resolution
 *
 * Turns free text into a motion. This matters more than it sounds: the app
 * has an AI generator, so a large share of the exercise names it must
 * animate have never been seen by anyone. The previous implementation was
 * an ordered list of regexes with a single catch-all, which meant every
 * unrecognised name — "Sled Push", "Cossack Squat", "Bulgarian Split
 * Squat" — rendered the same meaningless bounce.
 *
 * Three passes, cheapest first:
 *
 *   1. EXACT   — the name, normalised, is a motion id or a declared alias.
 *   2. SCORED  — token overlap against ids, labels and aliases, weighted so
 *                a rare word like "burpee" outranks a common one like "up".
 *   3. PATTERN — no name match, so infer the movement *family* from verbs
 *                in the name and from the target muscle, then use that
 *                family's representative movement.
 *
 * Pass 3 is the important one. "Sled Push" resolves to a push, "Hip Airplane"
 * to a hinge. The figure may not be doing that exact exercise, but it is
 * doing the right kind of thing, which is worth far more than a bounce.
 */

/* ------------------------------------------------------------------ */
/*  Normalisation                                                      */
/* ------------------------------------------------------------------ */

/** Words that carry no movement information and would dilute scoring. */
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "with", "for", "your", "his",
  "her", "on", "in", "at", "by", "from", "up", "down", "left", "right",
  "side", "sides", "each", "both", "alternating", "alternate", "single",
  "double", "standing", "seated", "lying", "supine", "prone", "modified",
  "assisted", "supported", "basic", "classic", "simple", "easy", "hard",
  "advanced", "beginner", "intermediate", "low", "high", "impact", "min",
  "mins", "minute", "minutes", "sec", "secs", "second", "seconds", "rep",
  "reps", "set", "sets", "x", "warm", "warmup", "cool", "cooldown",
]);

/**
 * Spelling and phrasing variants folded to one form before tokenising, so
 * "push-ups", "pushups", "push ups" and "press-ups" all reach the same
 * token. Applied on the whole string, longest first.
 */
const SYNONYMS: [RegExp, string][] = [
  // Multi-word names that share a weak head word are folded to one token
  // BEFORE anything else. Left loose, "press" appears in both "chest
  // press" (a horizontal push) and "overhead press" (a vertical one), so
  // both motions index the same bare token with the same weight and the
  // tie resolves by array order — which is how "Arnold Press" was
  // animating as a push-up. Same for "push", leaking out of "push press".
  [/\barnold\s+press\b/g, "shoulderpress"],
  [/\b(overhead|military|shoulder|dumbbell|push|strict|z)\s+press\b/g, "shoulderpress"],
  [/\b(chest|floor|bench|incline\s+bench)\s+press\b/g, "pushup"],
  [/\b(sled|prowler)\s+(push|drag|press)\b/g, "pushup"],
  // A Jefferson curl is a segmental spinal roll-down, not an arm curl.
  // Without this the lone strong token "curl" sends it to the biceps.
  // Rewritten to a phrase the index actually carries — "forward fold" —
  // since spinal flexion is the shape it shares, not a hip hinge.
  [/\bjefferson\s+curls?\b/g, "forward fold"],
  [/\bpress[- ]?ups?\b/g, "pushup"],
  [/\bpush[- ]?ups?\b/g, "pushup"],
  [/\bpull[- ]?ups?\b/g, "pullup"],
  [/\bchin[- ]?ups?\b/g, "pullup"],
  [/\bsit[- ]?ups?\b/g, "situp"],
  [/\bstep[- ]?ups?\b/g, "stepup"],
  [/\bdead[- ]?lifts?\b/g, "deadlift"],
  [/\bdead[- ]?bugs?\b/g, "deadbug"],
  [/\bbird[- ]?dogs?\b/g, "birddog"],
  [/\bwall[- ]?sits?\b/g, "wallsit"],
  [/\bjumping[- ]jacks?\b/g, "jumpingjack"],
  [/\bstar[- ]jumps?\b/g, "jumpingjack"],
  [/\bmountain[- ]climbers?\b/g, "mountainclimber"],
  [/\bglute[- ]bridges?\b/g, "glutebridge"],
  [/\bhip[- ]thrusts?\b/g, "glutebridge"],
  [/\bcat[- ]cow\b/g, "catcow"],
  [/\bcat[- ]camel\b/g, "catcow"],
  [/\bchild'?s?[- ]pose\b/g, "childspose"],
  [/\bhigh[- ]knees?\b/g, "highknees"],
  [/\bbutt[- ]kicks?\b/g, "buttkick"],
  [/\bflutter[- ]kicks?\b/g, "flutterkick"],
  [/\bcalf[- ]raises?\b/g, "calfraise"],
  [/\blateral[- ]raises?\b/g, "lateralraise"],
  [/\bfront[- ]raises?\b/g, "frontraise"],
  [/\bbicep'?s?[- ]curls?\b/g, "bicepcurl"],
  [/\bhammer[- ]curls?\b/g, "bicepcurl"],
  [/\brussian[- ]twists?\b/g, "russiantwist"],
  [/\bleg[- ]raises?\b/g, "legraise"],
  [/\bside[- ]planks?\b/g, "sideplank"],
  [/\bshoulder[- ]taps?\b/g, "shouldertap"],
  [/\bjump[- ]squats?\b/g, "jumpsquat"],
  [/\bsumo[- ]squats?\b/g, "sumosquat"],
  [/\bgoblet[- ]squats?\b/g, "sumosquat"],
  [/\bsplit[- ]squats?\b/g, "lunge"],
  [/\bbulgarian\b/g, "lunge"],
  [/\bcossack\b/g, "sidelunge"],
  [/\bskater[- ]hops?\b/g, "skater"],
  [/\bspeed[- ]skaters?\b/g, "skater"],
  [/\bbent[- ]?over[- ]rows?\b/g, "bentrow"],
  [/\brenegade[- ]rows?\b/g, "bentrow"],
  [/\bdonkey[- ]kicks?\b/g, "donkeykick"],
  [/\bfire[- ]hydrants?\b/g, "donkeykick"],
  [/\bdiamond[- ]pushups?\b/g, "diamondpushup"],
  [/\bpike[- ]pushups?\b/g, "pikepushup"],
  [/\bincline[- ]pushups?\b/g, "inclinepushup"],
  [/\btricep'?s?\b/g, "tricep"],
  [/\bbicep'?s?\b/g, "bicep"],
  [/\bab(s|dominals?)\b/g, "core"],
  [/\bobliques?\b/g, "core"],
  [/\bglutes?\b/g, "glute"],
  [/\bquadriceps\b/g, "quad"],
  [/\bhamstrings?\b/g, "hamstring"],
];

function normalise(input: string): string {
  let s = (input || "").toLowerCase();
  // Strip parenthetical qualifiers — "Donkey Kicks (Left Side)".
  s = s.replace(/\([^)]*\)/g, " ");
  // Strip leading counts — "20 Jumping Jacks", "3x Squats".
  s = s.replace(/\b\d+\s*[x×]?\s*/g, " ");
  for (const [re, to] of SYNONYMS) s = s.replace(re, to);
  return s.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenise(input: string): string[] {
  return normalise(input)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/* ------------------------------------------------------------------ */
/*  Index                                                             */
/* ------------------------------------------------------------------ */

interface IndexEntry {
  motion: Motion;
  /** Every searchable token for this motion, deduplicated. */
  tokens: Set<string>;
  /** Normalised full strings that count as an exact hit. */
  exact: Set<string>;
}

const INDEX: IndexEntry[] = MOTIONS.map((motion) => {
  const exact = new Set<string>();
  const tokens = new Set<string>();

  const add = (text: string) => {
    const n = normalise(text);
    if (n) exact.add(n);
    for (const t of tokenise(text)) tokens.add(t);
  };

  add(motion.id);
  add(motion.label);
  for (const alias of motion.aliases ?? []) add(alias);

  return { motion, tokens, exact };
});

/**
 * Inverse document frequency per token. A token appearing in one motion is
 * decisive; one appearing in fifteen is nearly worthless. Without this,
 * "squat" in "Jump Squat" would score the same as in "Bodyweight Squat"
 * and ties would resolve by array order — which is to say, arbitrarily.
 */
const TOKEN_WEIGHT: Map<string, number> = (() => {
  const counts = new Map<string, number>();
  for (const entry of INDEX) {
    for (const t of entry.tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const weights = new Map<string, number>();
  for (const [token, count] of counts) {
    weights.set(token, Math.log(1 + INDEX.length / count));
  }
  return weights;
})();

/* ------------------------------------------------------------------ */
/*  Pattern inference                                                  */
/* ------------------------------------------------------------------ */

const PATTERN_HINTS: [RegExp, MovementPattern][] = [
  [/pushup|press|dip|tricep|chest|push|plank|handstand/, "push"],
  [/pullup|row|pull|lat|rear delt|fly|back|chin/, "pull"],
  [/squat|lunge|stepup|wallsit|quad|leg press|knee/, "squat"],
  [/deadlift|hinge|bridge|thrust|glute|hamstring|kickback|swing|goodmorning/, "hinge"],
  [/core|crunch|situp|plank|twist|legraise|deadbug|hollow|birddog|oblique/, "core"],
  [/jump|jack|run|sprint|climber|burpee|cardio|knees|skater|hop|shuffle|conditioning/, "cardio"],
  [/curl|raise|extension|shrug|bicep|delt|isolation/, "isolation"],
  [/stretch|mobility|yoga|pose|fold|rotation|opener|release|flow|breath/, "mobility"],
];

/**
 * Infers a movement family from any text available — the exercise name,
 * and the `targetMuscle` field the app already stores alongside it. The
 * muscle string is a genuinely strong signal that the old regex matcher
 * ignored entirely: "Chest, triceps, shoulders" tells you it is a push
 * even when the name is something the matcher has never seen.
 */
export function inferPattern(
  name: string,
  targetMuscle?: string,
): MovementPattern | null {
  const haystack = `${normalise(name)} ${normalise(targetMuscle ?? "")}`;
  for (const [re, pattern] of PATTERN_HINTS) {
    if (re.test(haystack)) return pattern;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Resolution                                                         */
/* ------------------------------------------------------------------ */

const cache = new Map<string, MotionMatch>();

/**
 * Resolves a name (and optionally its target muscle) to a motion.
 *
 * Results are memoised. A workout list re-renders often and the token
 * scoring, while cheap, is not free; resolving the same forty names on
 * every render for no reason is exactly the kind of waste that shows up as
 * jank on a mid-range phone.
 */
export function resolveMotion(
  name: string,
  targetMuscle?: string,
): MotionMatch {
  const key = `${name}\u0000${targetMuscle ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const result = resolveUncached(name, targetMuscle);

  // Bounded so a long session with an AI generating endless names cannot
  // grow this without limit.
  if (cache.size > 500) cache.clear();
  cache.set(key, result);
  return result;
}

function resolveUncached(name: string, targetMuscle?: string): MotionMatch {
  const normalised = normalise(name);

  // --- Pass 1: exact ---
  if (normalised) {
    for (const entry of INDEX) {
      if (entry.exact.has(normalised)) {
        return { motion: entry.motion, via: "exact", score: 1 };
      }
    }
  }

  // --- Pass 2: weighted token overlap ---
  const queryTokens = tokenise(name);
  if (queryTokens.length > 0) {
    let best: IndexEntry | null = null;
    let bestScore = 0;

    for (const entry of INDEX) {
      if (entry.motion.id === "generic") continue;
      let score = 0;
      for (const token of queryTokens) {
        if (entry.tokens.has(token)) {
          score += TOKEN_WEIGHT.get(token) ?? 1;
        }
      }
      if (score === 0) continue;
      // Normalise by query length so a long name is not automatically a
      // better match than a short one purely by having more tokens.
      score /= Math.sqrt(queryTokens.length);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    // The threshold is deliberately low but non-zero: one weak shared
    // token ("hold", "raise") is not enough to claim a match, but one
    // strong one ("burpee") is.
    if (best && bestScore >= 0.85) {
      return { motion: best.motion, via: "scored", score: bestScore };
    }
  }

  // --- Pass 3: movement family ---
  const pattern = inferPattern(name, targetMuscle);
  if (pattern) {
    const fallbackId = PATTERN_DEFAULTS[pattern];
    const motion = fallbackId ? MOTION_BY_ID.get(fallbackId) : undefined;
    if (motion) return { motion, via: "pattern", score: 0.4 };
  }

  return { motion: GENERIC_MOTION, via: "pattern", score: 0 };
}

/** Direct lookup, for call sites that already know the id. */
export function motionById(id: string): Motion | undefined {
  return MOTION_BY_ID.get(id);
}

/** Test seam. */
export function __clearResolveCache(): void {
  cache.clear();
}
