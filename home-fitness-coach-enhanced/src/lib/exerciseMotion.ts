/**
 * Maps a free-text exercise name (typed by a user, or invented by the AI
 * workout generator) to one of the illustrated-figure CSS animation
 * patterns already built into index.css / HumanFigure.tsx.
 *
 * Ordered most-specific-phrase-first so e.g. "Incline Push-up" doesn't
 * get swallowed by the generic "push up" rule before it's checked.
 * Anything that matches nothing recognizable still gets a friendly
 * generic "working out" bounce (`generic`) rather than sitting still —
 * every row in an exercise list should visibly move.
 */
const RULES: Array<[RegExp, string]> = [
  [/incline.*push/i, "incline"],
  [/(diamond|pike).*push/i, "pushups"],
  [/push[- ]?up|press[- ]?up|chest press/i, "pushups"],
  [/jump.*squat|sumo.*squat|squat/i, "squats"],
  [/lunge/i, "lunges"],
  [/side plank|shoulder tap/i, "plank"],
  [/plank/i, "plank"],
  [/burpee/i, "burpees"],
  [/cobra/i, "bridges"],
  [/glute bridge|^bridge|hip bridge|superman/i, "bridges"],
  [/mountain climber|climber/i, "mountain"],
  [/jumping jack|star jump|^jack/i, "jacks"],
  [/bicycle|russian twist|spinal twist|^twist/i, "bicycle"],
  [/wall sit/i, "wall-sit"],
  [/bird dog|donkey kick/i, "bird-dog"],
  [/dead ?bug|leg raise/i, "deadbug"],
  [/step[- ]?up/i, "stepup"],
  [/calf/i, "calf"],
  [/\bdip/i, "dips"],
  [/sit[- ]?up|crunch/i, "curlcore"],
  [/bicep|curl/i, "curl"],
  [/lateral raise|side raise|arm raise|shoulder raise|\braise\b/i, "raise"],
  [/bent.?over row|\brow\b/i, "row"],
  [/single.?leg deadlift|deadlift|cat.?cow|\bhinge\b/i, "hinge"],
  [/skater/i, "skater"],
  [/greatest stretch|forward fold|child.?s pose|seated fold|\bstretch\b|\bsway\b/i, "sway"],
];

export function matchExerciseAnimation(name: string): string {
  const n = (name || "").toLowerCase();
  for (const [re, pattern] of RULES) {
    if (re.test(n)) return pattern;
  }
  return "generic";
}
