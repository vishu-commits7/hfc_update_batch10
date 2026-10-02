import type { Keyframe, Motion, Pose } from "./types";

/**
 * OBSIDIAN — exercise motion library
 *
 * Every movement the app can show, as keyframed pose data.
 *
 * How to read a definition: poses are *deltas from standing*, in degrees,
 * and positive is clockwise on screen. Because the figure faces the
 * viewer, that means positive raises the left arm and lowers the right —
 * an asymmetry that is stated in every pair rather than hidden behind a
 * shared constant, since collapsing it is exactly how the previous rig
 * ended up animating jumping jacks backwards.
 *
 * `grounded: true` hands the legs to the IK solver. Author those in terms
 * of where the hips and feet go (`hipDrop`, `stance`, `liftL`) and the
 * thigh and shin angles are solved so the feet stay planted. Anything
 * authored as `legL`/`kneeL` on a grounded motion is ignored.
 *
 * Tempos are seconds per repetition at a controlled pace, taken from the
 * tempo strings already in the exercise library (a "3–1–2" squat is six
 * seconds under the bar, but the demo reads better slightly quicker, so
 * these are tuned by eye rather than transcribed).
 */

/* ------------------------------------------------------------------ */
/*  Authoring helpers                                                  */
/* ------------------------------------------------------------------ */

const STAND: Pose = {};

/**
 * A standard two-phase repetition: rest → exertion → rest.
 * `pause` holds the end range briefly, which is what stops a rep looking
 * like a pendulum and starts it looking like lifting.
 */
function rep(peak: Pose, opts: { pause?: number; start?: Pose } = {}): Keyframe[] {
  const pause = opts.pause ?? 0.1;
  const start = opts.start ?? STAND;
  return [
    { t: 0, pose: start, ease: "easeInOut" },
    { t: 0.42, pose: peak, ease: "linear" },
    { t: 0.42 + pause, pose: peak, ease: "easeInOut" },
    { t: 0.9, pose: start, ease: "linear" },
  ];
}

/**
 * An isometric hold. The figure does not rep — it breathes and trembles
 * very slightly under load. Without this, a plank renders as a frozen
 * image, which is indistinguishable from a component that failed to mount.
 */
function hold(base: Pose, tremor: Pose = {}): Keyframe[] {
  const merged: Pose = { ...base };
  for (const [k, v] of Object.entries(tremor)) {
    const key = k as keyof Pose;
    merged[key] = ((base[key] as number) ?? 0) + (v as number);
  }
  return [
    { t: 0, pose: base, ease: "easeInOut" },
    { t: 0.5, pose: merged, ease: "easeInOut" },
  ];
}

/** Alternating left/right within a single cycle — climbers, bicycles. */
function alternate(a: Pose, b: Pose, mid: Pose = STAND): Keyframe[] {
  return [
    { t: 0, pose: mid, ease: "easeInOut" },
    { t: 0.25, pose: a, ease: "easeInOut" },
    { t: 0.5, pose: mid, ease: "easeInOut" },
    { t: 0.75, pose: b, ease: "easeInOut" },
  ];
}

/** Shared prone body attitude — the stylised three-quarter floor view. */
// Residual deviation from flat, on top of the attitude the sampler
// applies for `lying: "prone"`. The legs splay slightly so a plank
// does not read as a single fused limb.
const PRONE: Pose = { legL: -9, legR: 9 };
/** Shared supine attitude, for anything performed on the back. */
const SUPINE: Pose = {};

function m(motion: Motion): Motion {
  return motion;
}

/* ------------------------------------------------------------------ */
/*  The library                                                        */
/* ------------------------------------------------------------------ */

export const MOTIONS: Motion[] = [
  /* ---------------------------- SQUAT ---------------------------- */
  m({
    id: "squat",
    label: "Bodyweight Squat",
    pattern: "squat",
    tempo: 3.2,
    grounded: true,
    cue: "Hips back, chest tall",
    aliases: ["bodyweight squat", "air squat", "warm up squat", "squats"],
    keys: rep(
      { hipDrop: 27, stance: 41, armL: 22, armR: -22, elbowL: 18, elbowR: -18, bend: 6 },
      { pause: 0.08 },
    ),
  }),
  m({
    id: "sumo-squat",
    label: "Sumo Squat",
    pattern: "squat",
    tempo: 3.4,
    grounded: true,
    cue: "Wide stance, knees out",
    aliases: ["sumo", "plie squat", "wide squat", "goblet squat"],
    keys: rep(
      { hipDrop: 26, stance: 58, armL: 30, armR: -30, elbowL: 40, elbowR: -40 },
      { start: { stance: 52 }, pause: 0.1 },
    ),
  }),
  m({
    id: "jump-squat",
    label: "Jump Squat",
    pattern: "squat",
    tempo: 2.2,
    grounded: true,
    cue: "Land soft, absorb it",
    aliases: ["jump squats", "squat jump", "explosive squat"],
    keys: [
      { t: 0, pose: {}, ease: "easeIn" },
      { t: 0.3, pose: { hipDrop: 26, stance: 40, armL: -35, armR: 35 }, ease: "anticipate" },
      { t: 0.52, pose: { hipDrop: -26, stance: 34, armL: 80, armR: -80, heel: 12 }, ease: "easeOut" },
      { t: 0.74, pose: { hipDrop: 14, stance: 40, armL: 10, armR: -10 }, ease: "easeInOut" },
    ],
  }),
  m({
    id: "wall-sit",
    label: "Wall Sit",
    pattern: "squat",
    tempo: 4.4,
    grounded: true,
    isometric: true,
    cue: "Thighs level, breathe",
    aliases: ["wall squat", "chair hold"],
    keys: hold(
      { hipDrop: 34, stance: 38, armL: -30, armR: 30 },
      { hipDrop: 1.6 },
    ),
  }),
  m({
    id: "calf-raise",
    label: "Calf Raise",
    pattern: "isolation",
    tempo: 2.2,
    grounded: true,
    cue: "Rise tall, lower slow",
    aliases: ["calf raises", "heel raise", "toe raise", "calves"],
    keys: rep({ heel: 16, armL: -28, armR: 28 }, { pause: 0.12 }),
  }),
  m({
    id: "lunge",
    label: "Reverse Lunge",
    pattern: "squat",
    tempo: 3.4,
    grounded: true,
    alternating: true,
    cue: "Step back, drop straight down",
    aliases: ["lunges", "reverse lunge", "forward lunge", "split squat", "static lunge"],
    keys: rep(
      { hipDrop: 30, stanceL: 20, stanceR: 46, liftR: 10, bend: 5, armL: 18, armR: -8 },
      { pause: 0.08 },
    ),
  }),
  m({
    id: "side-lunge",
    label: "Lateral Lunge",
    pattern: "squat",
    tempo: 3.2,
    grounded: true,
    alternating: true,
    cue: "Sit into one hip",
    aliases: ["lateral lunge", "side lunge", "cossack squat", "side squat"],
    keys: rep(
      { hipDrop: 24, stanceL: 14, stanceR: 66, x: -12, armL: 26, armR: -26 },
      { pause: 0.1 },
    ),
  }),
  m({
    id: "step-up",
    label: "Step-up",
    pattern: "squat",
    tempo: 3,
    grounded: true,
    alternating: true,
    cue: "Drive through the heel",
    aliases: ["step ups", "supported step-up", "box step", "stair step"],
    keys: rep(
      { liftL: 26, stanceL: 30, hipDrop: -8, armL: 24, armR: -24 },
      { pause: 0.1 },
    ),
  }),

  /* ---------------------------- HINGE ---------------------------- */
  m({
    id: "deadlift",
    label: "Deadlift",
    pattern: "hinge",
    tempo: 3.4,
    grounded: true,
    cue: "Hips back, spine long",
    aliases: ["romanian deadlift", "rdl", "hip hinge", "good morning"],
    keys: rep(
      { hipDrop: 12, bend: 34, lean: 8, armL: -18, armR: 18, stance: 34 },
      { pause: 0.08 },
    ),
  }),
  m({
    id: "single-leg-deadlift",
    label: "Single-Leg Deadlift",
    pattern: "hinge",
    tempo: 4,
    grounded: true,
    alternating: true,
    cue: "One line from crown to heel",
    aliases: ["single leg deadlift", "sldl", "airplane", "balance hinge"],
    keys: rep(
      { bend: 38, lean: 10, liftR: 30, stanceR: 58, armL: -24, armR: 24, hipDrop: 6 },
      { pause: 0.12 },
    ),
  }),
  m({
    id: "glute-bridge",
    lying: "supine",
    label: "Glute Bridge",
    pattern: "hinge",
    tempo: 3,
    cue: "Squeeze at the top",
    aliases: ["glute bridges", "hip bridge", "bridge", "hip thrust"],
    keys: rep(
      { ...SUPINE, rot: 2, y: -22, bend: -12, kneeL: -62, kneeR: 62, legL: 14, legR: -14 },
      { start: { ...SUPINE, kneeL: -58, kneeR: 58, legL: 12, legR: -12 }, pause: 0.16 },
    ),
  }),
  m({
    id: "donkey-kick",
    lying: "prone",
    label: "Donkey Kick",
    pattern: "hinge",
    tempo: 2.6,
    alternating: true,
    cue: "Heel to ceiling",
    aliases: ["donkey kicks", "glute kickback", "quadruped kick", "fire hydrant"],
    keys: rep(
      { ...PRONE, rot: 2, legL: 44, kneeL: -78, legR: 8 },
      { start: { ...PRONE, rot: 2, legL: 10, kneeL: -52, legR: 8 }, pause: 0.1 },
    ),
  }),
  m({
    id: "superman",
    lying: "prone",
    label: "Superman",
    pattern: "hinge",
    tempo: 3.4,
    cue: "Lift chest and thighs",
    aliases: ["superman hold", "back extension", "swimmers", "prone raise"],
    keys: rep(
      { rot: -4, bend: -20, armL: 66, armR: -66, legL: -16, legR: 16, y: -6 },
      { start: { rot: -4, armL: 52, armR: -52 }, pause: 0.16 },
    ),
  }),

  /* ----------------------------- PUSH ----------------------------- */
  m({
    id: "pushup",
    lying: "prone",
    label: "Push-up",
    pattern: "push",
    tempo: 2.8,
    cue: "One line, elbows back",
    aliases: ["push ups", "pushups", "press up", "classic push-up", "chest press", "floor press"],
    keys: rep(
      { ...PRONE, y: 15, elbowL: 46, elbowR: 38, armL: 16, armR: 8, head: 4 },
      { start: { ...PRONE, armL: 16, armR: 8 }, pause: 0.06 },
    ),
  }),
  m({
    id: "incline-pushup",
    lying: "prone",
    label: "Incline Push-up",
    pattern: "push",
    tempo: 2.8,
    cue: "Hands elevated, body straight",
    aliases: ["incline push up", "wall push up", "knee push up", "elevated push-up"],
    keys: rep(
      { rot: -6, legL: -6, legR: 6, y: 10, elbowL: 32, elbowR: -32, armL: -8, armR: 8 },
      { start: { rot: -6, legL: -6, legR: 6, armL: -8, armR: 8 }, pause: 0.06 },
    ),
  }),
  m({
    id: "diamond-pushup",
    lying: "prone",
    label: "Diamond Push-up",
    pattern: "push",
    tempo: 3,
    cue: "Hands close, elbows tight",
    aliases: ["diamond push ups", "close grip push up", "triangle push up", "tricep push up"],
    keys: rep(
      { ...PRONE, y: 14, elbowL: 58, elbowR: -58, armL: 16, armR: -16 },
      { start: { ...PRONE, armL: 16, armR: -16 }, pause: 0.06 },
    ),
  }),
  m({
    id: "pike-pushup",
    lying: "prone",
    label: "Pike Push-up",
    pattern: "push",
    tempo: 3,
    cue: "Hips high, crown to floor",
    aliases: ["pike push ups", "handstand push up", "shoulder push up", "downward dog press"],
    keys: rep(
      { rot: 14, bend: 26, y: 12, elbowL: 52, elbowR: -52, armL: 30, armR: -30 },
      { start: { rot: 14, bend: 26, armL: 30, armR: -30 }, pause: 0.06 },
    ),
  }),
  m({
    id: "dips",
    label: "Tricep Dip",
    pattern: "push",
    tempo: 2.8,
    cue: "Shoulders down, elbows back",
    aliases: ["chair tricep dips", "bench dip", "dip", "tricep dips"],
    keys: rep(
      { y: 15, armL: -30, armR: 30, elbowL: 62, elbowR: -62, bend: 6, legL: -16, legR: 16 },
      { start: { armL: -30, armR: 30, legL: -16, legR: 16 }, pause: 0.08 },
    ),
  }),
  m({
    id: "shoulder-press",
    label: "Shoulder Press",
    pattern: "push",
    tempo: 2.8,
    grounded: true,
    cue: "Press straight overhead",
    aliases: ["overhead press", "military press", "dumbbell press", "push press"],
    keys: rep(
      { armL: 92, armR: -92, elbowL: 8, elbowR: -8 },
      { start: { armL: 38, armR: -38, elbowL: 86, elbowR: -86 }, pause: 0.1 },
    ),
  }),

  /* ----------------------------- PULL ----------------------------- */
  m({
    id: "bent-row",
    label: "Bent-over Row",
    pattern: "pull",
    tempo: 2.8,
    grounded: true,
    cue: "Pull to the ribs",
    aliases: ["bent over rows", "row", "rows", "dumbbell row", "renegade row"],
    keys: rep(
      { bend: 40, lean: 6, hipDrop: 10, armL: -34, armR: 34, elbowL: 96, elbowR: -96 },
      {
        start: { bend: 40, lean: 6, hipDrop: 10, armL: -20, armR: 20, elbowL: 12, elbowR: -12 },
        pause: 0.12,
      },
    ),
  }),
  m({
    id: "reverse-fly",
    label: "Reverse Fly",
    pattern: "pull",
    tempo: 3,
    grounded: true,
    cue: "Squeeze the shoulder blades",
    aliases: ["rear delt fly", "reverse flies", "bent over fly", "band pull apart"],
    keys: rep(
      { bend: 36, hipDrop: 8, armL: 26, armR: -26, elbowL: 16, elbowR: -16 },
      { start: { bend: 36, hipDrop: 8, armL: -26, armR: 26, elbowL: 20, elbowR: -20 }, pause: 0.12 },
    ),
  }),
  m({
    id: "pullup",
    label: "Pull-up",
    pattern: "pull",
    tempo: 3.2,
    cue: "Chest to the bar",
    aliases: ["pull ups", "chin up", "chin ups", "bar hang"],
    keys: rep(
      { y: -20, armL: 86, armR: -86, elbowL: 96, elbowR: -96, legL: -12, legR: 12, kneeL: -24, kneeR: 24 },
      {
        start: { y: 8, armL: 92, armR: -92, elbowL: 4, elbowR: -4, legL: -10, legR: 10 },
        pause: 0.1,
      },
    ),
  }),

  /* --------------------------- ISOLATION --------------------------- */
  m({
    id: "bicep-curl",
    label: "Bicep Curl",
    pattern: "isolation",
    tempo: 2.4,
    grounded: true,
    cue: "Elbows pinned to your sides",
    aliases: ["curl", "curls", "dumbbell bicep curl", "hammer curl", "biceps"],
    keys: rep(
      { elbowL: 132, elbowR: -132, armL: -34, armR: 34 },
      { start: { elbowL: 6, elbowR: -6, armL: -34, armR: 34 }, pause: 0.12 },
    ),
  }),
  m({
    id: "lateral-raise",
    label: "Lateral Raise",
    pattern: "isolation",
    tempo: 2.8,
    grounded: true,
    cue: "Lead with the elbows",
    aliases: ["lateral raises", "side raise", "shoulder raise", "delt raise", "arm raise"],
    keys: rep(
      { armL: 30, armR: -30, elbowL: 12, elbowR: -12 },
      { start: { armL: -40, armR: 40, elbowL: 6, elbowR: -6 }, pause: 0.12 },
    ),
  }),
  m({
    id: "front-raise",
    label: "Front Raise",
    pattern: "isolation",
    tempo: 2.8,
    grounded: true,
    cue: "Raise to eye level",
    aliases: ["front raises", "anterior raise", "plate raise"],
    keys: rep(
      { armL: 58, armR: -58, elbowL: 6, elbowR: -6 },
      { start: { armL: -42, armR: 42 }, pause: 0.1 },
    ),
  }),
  m({
    id: "tricep-extension",
    label: "Tricep Extension",
    pattern: "isolation",
    tempo: 2.6,
    grounded: true,
    cue: "Upper arms stay still",
    aliases: ["overhead tricep", "skull crusher", "tricep kickback", "triceps"],
    keys: rep(
      { armL: 92, armR: -92, elbowL: 8, elbowR: -8 },
      { start: { armL: 92, armR: -92, elbowL: 118, elbowR: -118 }, pause: 0.1 },
    ),
  }),

  /* ----------------------------- CORE ----------------------------- */
  m({
    id: "plank",
    lying: "prone",
    label: "Forearm Plank",
    pattern: "core",
    tempo: 4,
    isometric: true,
    cue: "Hips level, brace gently",
    aliases: ["plank hold", "forearm plank", "high plank", "front plank"],
    // Upper arms tucked IN toward the ribs (positive rotates the left arm
    // clockwise, i.e. down and inward), not splayed out. The previous
    // -10/+10 pushed them away from the body, so once the figure was laid
    // prone one arm read as reaching into the air rather than propping the
    // chest up on the forearm.
    keys: hold(
      { ...PRONE, elbowL: 72, elbowR: 58, armL: 30, armR: 20 },
      { y: 1.4, rot: 0.5 },
    ),
  }),
  m({
    id: "side-plank",
    label: "Side Plank",
    pattern: "core",
    tempo: 4,
    isometric: true,
    cue: "Stack the hips",
    aliases: ["side planks", "lateral plank", "side bridge"],
    keys: hold(
      { rot: 74, armL: -62, armR: 52, elbowL: 60, legL: -4, legR: 4 },
      { y: 1.2 },
    ),
  }),
  m({
    id: "shoulder-taps",
    lying: "prone",
    label: "Shoulder Tap",
    pattern: "core",
    tempo: 2.4,
    cue: "Keep the hips still",
    aliases: ["shoulder tap", "plank shoulder taps", "plank taps"],
    keys: alternate(
      { ...PRONE, armL: 78, elbowL: 96, armR: 14 },
      { ...PRONE, armR: -78, elbowR: -96, armL: -14 },
      { ...PRONE, armL: -10, armR: 10 },
    ),
  }),
  m({
    id: "mountain-climber",
    lying: "prone",
    label: "Mountain Climber",
    pattern: "cardio",
    tempo: 0.95,
    cue: "Fast feet, quiet hips",
    aliases: ["mountain climbers", "climbers", "running plank"],
    keys: alternate(
      { ...PRONE, rot: 1, legL: -42, kneeL: -62, legR: 9 },
      { ...PRONE, rot: 1, legR: 42, kneeR: 62, legL: -9 },
      { ...PRONE, rot: 1 },
    ),
  }),
  m({
    id: "crunch",
    lying: "supine",
    label: "Crunch",
    pattern: "core",
    tempo: 2.4,
    cue: "Ribs toward hips",
    aliases: ["crunches", "standard crunches", "ab crunch", "curl up"],
    keys: rep(
      { ...SUPINE, bend: -34, head: -8, armL: 62, armR: -62, elbowL: 96, elbowR: -96, kneeL: -54, kneeR: 54, legL: 12, legR: -12 },
      {
        start: { ...SUPINE, bend: -6, armL: 58, armR: -58, elbowL: 92, elbowR: -92, kneeL: -50, kneeR: 50, legL: 12, legR: -12 },
        pause: 0.1,
      },
    ),
  }),
  m({
    id: "situp",
    lying: "supine",
    label: "Sit-up",
    pattern: "core",
    tempo: 2.8,
    cue: "Lead with the chest",
    aliases: ["sit ups", "situps", "full sit up"],
    keys: rep(
      { ...SUPINE, bend: -52, lean: -16, armL: 70, armR: -70, elbowL: 104, elbowR: -104, kneeL: -56, kneeR: 56, legL: 12, legR: -12 },
      {
        start: { ...SUPINE, armL: 58, armR: -58, elbowL: 92, elbowR: -92, kneeL: -52, kneeR: 52, legL: 12, legR: -12 },
        pause: 0.08,
      },
    ),
  }),
  m({
    id: "bicycle",
    lying: "supine",
    label: "Bicycle Crunch",
    pattern: "core",
    tempo: 2,
    cue: "Rotate from the trunk",
    aliases: ["bicycle crunches", "bicycles", "cross crunch", "elbow to knee"],
    keys: alternate(
      { ...SUPINE, bend: -26, legL: -34, kneeL: -76, legR: 20, armR: -66, elbowR: -96, head: -10 },
      { ...SUPINE, bend: -26, legR: 34, kneeR: 76, legL: -20, armL: 66, elbowL: 96, head: 10 },
      { ...SUPINE, bend: -14, armL: 60, armR: -60, elbowL: 90, elbowR: -90 },
    ),
  }),
  m({
    id: "russian-twist",
    label: "Russian Twist",
    pattern: "core",
    tempo: 1.8,
    cue: "Turn, do not just swing",
    aliases: ["russian twists", "seated twist", "oblique twist", "twist"],
    keys: alternate(
      { rot: -28, bend: -18, lean: 14, armL: 54, armR: -10, elbowL: 72, elbowR: -72, kneeL: -56, kneeR: 56, legL: 14, legR: -14 },
      { rot: -28, bend: -18, lean: -14, armR: -54, armL: 10, elbowL: 72, elbowR: -72, kneeL: -56, kneeR: 56, legL: 14, legR: -14 },
      { rot: -28, bend: -18, armL: 32, armR: -32, elbowL: 72, elbowR: -72, kneeL: -56, kneeR: 56, legL: 14, legR: -14 },
    ),
  }),
  m({
    id: "leg-raise",
    lying: "supine",
    label: "Leg Raise",
    pattern: "core",
    tempo: 3,
    cue: "Lower slowly, back flat",
    aliases: ["leg raises", "lying leg raises", "toes to sky", "reverse crunch"],
    keys: rep(
      { ...SUPINE, legL: -64, legR: 64, kneeL: -6, kneeR: 6, armL: -50, armR: 50 },
      { start: { ...SUPINE, legL: -10, legR: 10, armL: -50, armR: 50 }, pause: 0.12 },
    ),
  }),
  m({
    id: "flutter-kick",
    lying: "supine",
    label: "Flutter Kick",
    pattern: "core",
    tempo: 1.1,
    cue: "Small, quick, controlled",
    aliases: ["flutter kicks", "scissor kick", "swimmer kicks"],
    keys: alternate(
      { ...SUPINE, legL: -44, legR: 12, armL: -50, armR: 50 },
      { ...SUPINE, legR: 44, legL: -12, armL: -50, armR: 50 },
      { ...SUPINE, legL: -28, legR: 28, armL: -50, armR: 50 },
    ),
  }),
  m({
    id: "deadbug",
    lying: "supine",
    label: "Dead Bug",
    pattern: "core",
    tempo: 3.2,
    alternating: true,
    cue: "Ribs down, move slowly",
    aliases: ["dead bug", "deadbugs", "opposite limb reach"],
    keys: rep(
      { ...SUPINE, armL: 124, armR: -58, legL: -20, legR: 58, kneeL: -70, kneeR: 12 },
      {
        start: { ...SUPINE, armL: 86, armR: -86, legL: -44, legR: 44, kneeL: -70, kneeR: 70 },
        pause: 0.14,
      },
    ),
  }),
  m({
    id: "hollow-hold",
    label: "Hollow Hold",
    pattern: "core",
    tempo: 4,
    isometric: true,
    cue: "Low back glued down",
    aliases: ["hollow body", "hollow rock", "banana hold"],
    keys: hold(
      { ...SUPINE, bend: -18, armL: 118, armR: -118, legL: -24, legR: 24, y: -4 },
      { y: 1.6, bend: -1.4 },
    ),
  }),
  m({
    id: "bird-dog",
    lying: "prone",
    label: "Bird Dog",
    pattern: "core",
    tempo: 3.6,
    alternating: true,
    cue: "Hips square, move slow",
    aliases: ["birddog", "quadruped reach", "opposite arm leg"],
    keys: rep(
      { ...PRONE, rot: 1, armL: 62, elbowL: 6, legR: 46, kneeR: 8, armR: 10 },
      { start: { ...PRONE, rot: 1, armL: -8, armR: 10, legR: 9 }, pause: 0.16 },
    ),
  }),

  /* ---------------------------- CARDIO ---------------------------- */
  m({
    id: "jumping-jack",
    label: "Jumping Jack",
    pattern: "cardio",
    tempo: 1,
    grounded: true,
    cue: "Land soft through the whole foot",
    aliases: ["jumping jacks", "star jump", "star jumps", "jacks", "side straddle hop"],
    // Arms travel from hanging at the sides to overhead, and the stance
    // widens. The previous rig had both of these inverted.
    keys: [
      { t: 0, pose: { armL: -46, armR: 46, stance: 24 }, ease: "easeOut" },
      { t: 0.46, pose: { armL: 96, armR: -96, stance: 62, heel: 6, hipDrop: -4 }, ease: "easeIn" },
      { t: 0.92, pose: { armL: -46, armR: 46, stance: 24 }, ease: "easeOut" },
    ],
  }),
  m({
    id: "high-knees",
    label: "High Knees",
    pattern: "cardio",
    tempo: 0.8,
    grounded: true,
    cue: "Knees to hip height",
    aliases: ["high knee", "running in place", "knee drive", "jog in place"],
    keys: alternate(
      { liftL: 40, stanceL: 20, armR: -54, armL: -20, elbowR: -92, elbowL: 92, heel: 5 },
      { liftR: 40, stanceR: 20, armL: 54, armR: 20, elbowL: 92, elbowR: -92, heel: 5 },
      { armL: 18, armR: -18, elbowL: 84, elbowR: -84 },
    ),
  }),
  m({
    id: "butt-kick",
    label: "Butt Kick",
    pattern: "cardio",
    tempo: 0.8,
    cue: "Heels to the glutes",
    aliases: ["butt kicks", "heel flicks", "hamstring kicks"],
    keys: alternate(
      { legL: -8, kneeL: -108, armR: -44, elbowR: -84, armL: -18, elbowL: 84 },
      { legR: 8, kneeR: 108, armL: 44, elbowL: 84, armR: 18, elbowR: -84 },
      { armL: 16, armR: -16, elbowL: 78, elbowR: -78 },
    ),
  }),
  m({
    id: "skater",
    label: "Skater Hop",
    pattern: "cardio",
    tempo: 1.4,
    grounded: true,
    cue: "Bound side to side",
    aliases: ["skater hops", "speed skater", "lateral bound", "side hop"],
    keys: alternate(
      { x: -14, hipDrop: 20, stanceL: 18, stanceR: 60, liftR: 22, armL: 44, armR: 26 },
      { x: 14, hipDrop: 20, stanceR: 18, stanceL: 60, liftL: 22, armR: -44, armL: -26 },
      { hipDrop: 10, armL: 10, armR: -10 },
    ),
  }),
  m({
    id: "burpee",
    label: "Burpee",
    pattern: "cardio",
    tempo: 4.2,
    cue: "Smooth transitions beat speed",
    aliases: ["burpees", "low impact burpee", "squat thrust"],
    // A genuine multi-phase compound: stand, squat, kick to plank, press,
    // jump the feet in, then drive up with the arms overhead.
    keys: [
      { t: 0, pose: {}, ease: "easeIn" },
      { t: 0.16, pose: { y: 22, legL: -26, legR: 26, kneeL: -46, kneeR: 46, armL: 34, armR: -34, bend: 18 }, ease: "easeOut" },
      { t: 0.34, pose: { ...PRONE, y: 30, armL: -14, armR: 14 }, ease: "easeInOut" },
      { t: 0.5, pose: { ...PRONE, y: 42, elbowL: 46, elbowR: -46, armL: -14, armR: 14 }, ease: "easeInOut" },
      { t: 0.62, pose: { ...PRONE, y: 30, armL: -14, armR: 14 }, ease: "easeInOut" },
      { t: 0.76, pose: { y: 22, legL: -26, legR: 26, kneeL: -46, kneeR: 46, armL: 34, armR: -34, bend: 18 }, ease: "anticipate" },
      { t: 0.9, pose: { y: -26, armL: 98, armR: -98, legL: -6, legR: 6 }, ease: "easeIn" },
    ],
  }),
  m({
    id: "march",
    label: "Marching",
    pattern: "cardio",
    tempo: 1.6,
    grounded: true,
    cue: "Tall posture, easy pace",
    aliases: ["march in place", "marching", "step in place", "low impact cardio"],
    keys: alternate(
      { liftL: 26, stanceL: 24, armR: -34, armL: -12, elbowR: -70, elbowL: 70 },
      { liftR: 26, stanceR: 24, armL: 34, armR: 12, elbowL: 70, elbowR: -70 },
      { armL: 10, armR: -10, elbowL: 62, elbowR: -62 },
    ),
  }),

  /* --------------------------- MOBILITY --------------------------- */
  m({
    id: "cat-cow",
    label: "Cat-Cow",
    pattern: "mobility",
    tempo: 4.4,
    cue: "Move with the breath",
    aliases: ["cat cow", "cat-cow stretch", "cat camel", "spinal wave"],
    keys: [
      { t: 0, pose: { ...PRONE, rot: 13, bend: 22, head: -12 }, ease: "easeInOut" },
      { t: 0.5, pose: { ...PRONE, rot: 13, bend: -22, head: 14 }, ease: "easeInOut" },
    ],
  }),
  m({
    id: "cobra",
    lying: "prone",
    label: "Cobra Stretch",
    pattern: "mobility",
    tempo: 4.2,
    cue: "Open the chest, shoulders down",
    aliases: ["cobra", "cobra stretch", "upward dog", "sphinx", "chest opener"],
    keys: rep(
      { rot: -6, bend: -34, head: 14, armL: -34, armR: 34, elbowL: 30, elbowR: -30, legL: -10, legR: 10 },
      { start: { rot: -4, bend: -8, armL: -20, armR: 20, legL: -10, legR: 10 }, pause: 0.2 },
    ),
  }),
  m({
    id: "childs-pose",
    lying: "prone",
    label: "Child's Pose",
    pattern: "mobility",
    tempo: 5,
    isometric: true,
    cue: "Breathe into the lower back",
    aliases: ["childs pose", "child pose", "rest pose", "kneeling fold"],
    keys: hold(
      { rot: 6, bend: 34, armL: 74, armR: -74, elbowL: 6, elbowR: -6, legL: -12, legR: 12, kneeL: -92, kneeR: 92, y: 14 },
      { y: 1.8, bend: 1.2 },
    ),
  }),
  m({
    id: "seated-fold",
    label: "Seated Forward Fold",
    pattern: "mobility",
    tempo: 5,
    cue: "Hinge from the hips",
    aliases: ["seated forward fold", "forward fold", "hamstring stretch", "toe touch", "pike stretch"],
    keys: rep(
      { rot: -52, bend: 40, armL: -34, armR: 34, elbowL: 20, elbowR: -20, legL: -46, legR: 46 },
      { start: { rot: -52, bend: 12, armL: -20, armR: 20, legL: -46, legR: 46 }, pause: 0.24 },
    ),
  }),
  m({
    id: "spinal-twist",
    lying: "supine",
    label: "Supine Spinal Twist",
    pattern: "mobility",
    tempo: 5,
    alternating: true,
    cue: "Shoulders stay down",
    aliases: ["supine spinal twist", "spinal twist", "lying twist", "figure four"],
    keys: rep(
      { ...SUPINE, bend: 26, head: -14, armL: 34, armR: -80, legL: -52, kneeL: -70, legR: 10 },
      { start: { ...SUPINE, armL: 26, armR: -70, legL: -18, legR: 10 }, pause: 0.24 },
    ),
  }),
  m({
    id: "quad-stretch",
    label: "Standing Quad Stretch",
    pattern: "mobility",
    tempo: 5,
    alternating: true,
    cue: "Knees together, hips forward",
    aliases: ["quad stretch", "standing quad", "glute stretch", "standing stretch"],
    keys: rep(
      { legL: -6, kneeL: -114, armL: -18, elbowL: 92, armR: -48, stanceR: 30 },
      { start: { legL: -6, kneeL: -84, armL: -20, elbowL: 60, armR: -44 }, pause: 0.22 },
    ),
  }),
  m({
    id: "torso-twist",
    label: "Standing Torso Twist",
    pattern: "mobility",
    tempo: 3,
    grounded: true,
    cue: "Turn through the ribs, not the hips",
    aliases: ["torso twist", "standing twist", "trunk rotation", "thoracic rotation"],
    keys: alternate(
      { bend: 16, head: 10, armL: 40, armR: 4, elbowL: 84, elbowR: -84 },
      { bend: -16, head: -10, armR: -40, armL: -4, elbowL: 84, elbowR: -84 },
      { armL: 18, armR: -18, elbowL: 84, elbowR: -84 },
    ),
  }),
  m({
    id: "shoulder-roll",
    label: "Shoulder Roll",
    pattern: "mobility",
    tempo: 3.4,
    grounded: true,
    cue: "Big slow circles",
    aliases: ["shoulder rolls", "arm circles", "shoulder circles", "warm up arms"],
    keys: [
      { t: 0, pose: { armL: -44, armR: 44 }, ease: "easeInOut" },
      { t: 0.25, pose: { armL: 18, armR: -18, elbowL: 24, elbowR: -24 }, ease: "easeInOut" },
      { t: 0.5, pose: { armL: 74, armR: -74, elbowL: 10, elbowR: -10 }, ease: "easeInOut" },
      { t: 0.75, pose: { armL: 20, armR: -20, elbowL: 40, elbowR: -40 }, ease: "easeInOut" },
    ],
  }),
  m({
    id: "world-greatest-stretch",
    label: "World's Greatest Stretch",
    pattern: "mobility",
    tempo: 5.4,
    alternating: true,
    cue: "Lunge, then open through the chest",
    aliases: ["worlds greatest stretch", "greatest stretch", "lunge with rotation", "deep lunge"],
    keys: [
      { t: 0, pose: { ...PRONE, rot: 10 }, ease: "easeInOut" },
      { t: 0.3, pose: { rot: 10, legL: -44, kneeL: -76, legR: 16, bend: 16, armL: -20, armR: 20 }, ease: "easeInOut" },
      { t: 0.62, pose: { rot: 10, legL: -44, kneeL: -76, legR: 16, bend: 10, armL: 118, armR: 10, head: 14 }, ease: "easeInOut" },
      { t: 0.86, pose: { rot: 10, legL: -30, kneeL: -56, legR: 14, armL: -20, armR: 20 }, ease: "easeInOut" },
    ],
  }),

  /* ---------------------------- GENERIC ---------------------------- */
  // Reached only when the resolver cannot infer a movement family. It is a
  // readable, neutral bodyweight rep rather than the old aimless bob, so
  // an unrecognised exercise still shows something a person can follow.
  m({
    id: "generic",
    label: "Bodyweight Movement",
    pattern: "cardio",
    tempo: 2.6,
    grounded: true,
    cue: "Move smoothly and breathe",
    aliases: [],
    keys: rep(
      { hipDrop: 14, stance: 38, armL: 40, armR: -40, elbowL: 40, elbowR: -40 },
      { pause: 0.1 },
    ),
  }),
];

/** Fast lookup by id. */
export const MOTION_BY_ID: ReadonlyMap<string, Motion> = new Map(
  MOTIONS.map((mo) => [mo.id, mo]),
);

export const GENERIC_MOTION: Motion =
  MOTION_BY_ID.get("generic") ?? MOTIONS[MOTIONS.length - 1];

/**
 * The movement chosen when a name is unrecognised but its family can be
 * inferred — from the target muscle, the workout's focus area, or simply
 * the words in the name. Far better than one universal fallback: an
 * unknown "Sled Push" at least animates as a push.
 */
export const PATTERN_DEFAULTS: Record<string, string> = {
  push: "pushup",
  pull: "bent-row",
  squat: "squat",
  hinge: "deadlift",
  core: "plank",
  cardio: "march",
  isolation: "bicep-curl",
  mobility: "cat-cow",
};
