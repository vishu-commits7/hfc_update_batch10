import {
  clampJoint,
  GROUND_Y,
  HIP,
  SHIN_LEN,
  solveLeg,
  THIGH_LEN,
  type Point,
} from "./rig";
import type { Easing, Keyframe, Motion, Pose, PoseKey } from "./types";

/**
 * OBSIDIAN — pose sampling
 *
 * Turns a motion definition plus a phase in [0, 1) into a concrete,
 * limit-checked, ground-solved pose. This runs once per figure per frame,
 * so it allocates nothing it does not have to and does no work that can be
 * hoisted out.
 */

/* ------------------------------------------------------------------ */
/*  Easing                                                             */
/* ------------------------------------------------------------------ */

const EASING: Record<Easing, (u: number) => number> = {
  linear: (u) => u,
  easeIn: (u) => u * u,
  easeOut: (u) => 1 - (1 - u) * (1 - u),
  easeInOut: (u) => (1 - Math.cos(Math.PI * u)) / 2,
  /** Steps at the end — for a movement that snaps rather than travels. */
  hold: (u) => (u >= 1 ? 1 : 0),
  /**
   * Pulls slightly backwards before moving forwards. Used on explosive
   * movements — a jump squat dips before it leaves the floor — because
   * the counter-movement is what makes force read as force.
   */
  anticipate: (u) => {
    const c = 1.7;
    return u < 0.35
      ? -c * (u / 0.35) * (1 - u / 0.35) * 0.12
      : (() => {
          const v = (u - 0.35) / 0.65;
          return 1 - Math.pow(1 - v, 3);
        })();
  },
};

/* ------------------------------------------------------------------ */
/*  Keyframe interpolation                                             */
/* ------------------------------------------------------------------ */

/** Every field a pose can carry, so interpolation never misses one. */
const POSE_KEYS: PoseKey[] = [
  "x",
  "y",
  "rot",
  "lean",
  "bend",
  "head",
  "armL",
  "armR",
  "elbowL",
  "elbowR",
  "legL",
  "legR",
  "kneeL",
  "kneeR",
  "hipDrop",
  "stance",
  "stanceL",
  "stanceR",
  "heel",
  "liftL",
  "liftR",
];

function findSpan(keys: Keyframe[], phase: number): [Keyframe, Keyframe, number] {
  const n = keys.length;
  if (n === 1) return [keys[0], keys[0], 0];

  for (let i = 0; i < n - 1; i++) {
    if (phase >= keys[i].t && phase < keys[i + 1].t) {
      const span = keys[i + 1].t - keys[i].t;
      return [keys[i], keys[i + 1], span <= 0 ? 0 : (phase - keys[i].t) / span];
    }
  }

  // Past the last key: wrap around to the first, treating it as t + 1 so a
  // cycle closes smoothly instead of snapping back on the final frame.
  const last = keys[n - 1];
  const first = keys[0];
  const span = first.t + 1 - last.t;
  return [last, first, span <= 0 ? 0 : (phase - last.t) / span];
}

/**
 * Samples the raw authored pose at a phase. Does not apply limits or
 * grounding — `samplePose` does that.
 */
export function interpolate(keys: Keyframe[], phase: number): Pose {
  const [a, b, rawU] = findSpan(keys, phase);
  const ease = EASING[a.ease ?? "easeInOut"];
  const u = ease(Math.min(1, Math.max(0, rawU)));

  const out: Pose = {};
  for (const key of POSE_KEYS) {
    const av = a.pose[key];
    const bv = b.pose[key];
    if (av === undefined && bv === undefined) continue;
    const from = av ?? 0;
    const to = bv ?? 0;
    out[key] = from + (to - from) * u;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Mirroring                                                          */
/* ------------------------------------------------------------------ */

/**
 * Flips a pose left-to-right, for movements that alternate sides across
 * reps. Rotations negate because the sign convention is handed; swapped
 * pairs also negate, which is why this cannot be a simple key swap.
 */
export function mirrorPose(p: Pose): Pose {
  return {
    ...p,
    x: p.x === undefined ? undefined : -p.x,
    rot: p.rot === undefined ? undefined : -p.rot,
    lean: p.lean === undefined ? undefined : -p.lean,
    bend: p.bend === undefined ? undefined : -p.bend,
    head: p.head === undefined ? undefined : -p.head,
    armL: p.armR === undefined ? undefined : -p.armR,
    armR: p.armL === undefined ? undefined : -p.armL,
    elbowL: p.elbowR === undefined ? undefined : -p.elbowR,
    elbowR: p.elbowL === undefined ? undefined : -p.elbowL,
    legL: p.legR === undefined ? undefined : -p.legR,
    legR: p.legL === undefined ? undefined : -p.legL,
    kneeL: p.kneeR === undefined ? undefined : -p.kneeR,
    kneeR: p.kneeL === undefined ? undefined : -p.kneeL,
  };
}

/* ------------------------------------------------------------------ */
/*  The public sampler                                                 */
/* ------------------------------------------------------------------ */

/**
 * The output of the sampler: every joint the renderer writes, fully
 * resolved.
 *
 * The grounding *inputs* — `hipDrop`, `stance`, `stanceL/R`, `heel`,
 * `liftL/R` — are deliberately absent. They describe where the body and
 * feet should be; by the time sampling is done they have been consumed by
 * the IK solver and expressed as leg and knee rotations. Keeping them out
 * of this type means the renderer cannot accidentally read an input that
 * has already been solved away.
 */
export interface SampledPose
  extends Required<
    Omit<
      Pose,
      "hipDrop" | "stance" | "stanceL" | "stanceR" | "heel" | "liftL" | "liftR"
    >
  > {
  /** Ground shadow scale, 0–1, derived from how far the figure has risen. */
  shadow: number;
  /** Lying flat, so the renderer can put the contact shadow under the
   *  body rather than under a pair of feet that are no longer beneath it. */
  lying: boolean;
}

/**
 * How far the figure is rotated and dropped when a motion is performed on
 * the floor.
 *
 * 76° rather than a full 90°: the artwork is front-facing, so a lying
 * figure reads as seen from slightly above, and the few degrees short of
 * flat are what stop it looking like the whole illustration simply fell
 * over.
 *
 * The vertical offset is small and is a *framing* value, not a drop to
 * the floor. Rotating about the hip already swings the head and feet to
 * either side of it, so the body's mass ends up centred on the hip; the
 * large drop a standing figure needs would push a lying one off the
 * bottom of the frame. The contact shadow is repositioned to match by
 * the renderer.
 */
const LYING = {
  prone: { rot: 76, y: 6 },
  supine: { rot: -76, y: 6 },
} as const;

const ZERO: SampledPose = {
  x: 0,
  y: 0,
  rot: 0,
  lean: 0,
  bend: 0,
  head: 0,
  armL: 0,
  armR: 0,
  elbowL: 0,
  elbowR: 0,
  legL: 0,
  legR: 0,
  kneeL: 0,
  kneeR: 0,
  shadow: 1,
  lying: false,
};

/**
 * Samples a motion at a phase and returns joint rotations ready to write
 * to the DOM.
 *
 * Grounded motions are where this earns its keep. Instead of taking
 * `legL`/`kneeL` literally, it places the feet on the floor at the
 * authored stance, moves the hip down by `hipDrop`, and solves the leg
 * angles between them. That is what makes a squat look like a squat rather
 * than like a figure being compressed vertically — and it is impossible to
 * express in CSS keyframes, which is why the previous rig slid the feet.
 *
 * @param cycle Which repetition this is, for alternating movements.
 */
export function samplePose(
  motion: Motion,
  phase: number,
  cycle = 0,
): SampledPose {
  let pose = interpolate(motion.keys, phase);

  if (motion.alternating && cycle % 2 === 1) {
    pose = mirrorPose(pose);
  }

  const out: SampledPose = { ...ZERO };

  // Copy through the directly-authored joints.
  out.x = pose.x ?? 0;
  out.y = pose.y ?? 0;
  out.rot = clampJoint("rot", pose.rot ?? 0);
  out.lean = clampJoint("lean", pose.lean ?? 0);
  out.bend = clampJoint("bend", pose.bend ?? 0);
  out.head = clampJoint("head", pose.head ?? 0);
  out.armL = clampJoint("armL", pose.armL ?? 0);
  out.armR = clampJoint("armR", pose.armR ?? 0);
  out.elbowL = clampJoint("elbowL", pose.elbowL ?? 0);
  out.elbowR = clampJoint("elbowR", pose.elbowR ?? 0);

  if (motion.grounded) {
    const drop = pose.hipDrop ?? 0;
    const stance = pose.stance ?? 35; // rest stance half-width
    const heel = pose.heel ?? 0;

    // The hip moves; the feet do not. Note `out.y` is *not* applied to the
    // hip here — for a grounded motion the body's vertical travel is the
    // hip drop itself, and adding both would double it.
    const hip: Point = { x: HIP.x + out.x, y: HIP.y + drop };

    // Per-foot placement. A symmetric stance covers squats; the overrides
    // are what make a lunge, a step-up and a skater hop distinct movements
    // rather than three identical hip drops.
    const footL: Point = {
      x: HIP.x - (pose.stanceL ?? stance),
      y: GROUND_Y - heel - (pose.liftL ?? 0),
    };
    const footR: Point = {
      x: HIP.x + (pose.stanceR ?? stance),
      y: GROUND_Y - heel - (pose.liftR ?? 0),
    };

    // Reach guard. At rest this figure's legs are already at full
    // extension — hip to foot is 73.8px against a 73.8px leg — so *any*
    // widening of the stance puts the foot out of reach, and the IK would
    // silently clamp, leaving the foot floating away from the floor.
    //
    // Widening your stance lowers your hips; that is simply what happens.
    // So rather than clamping, lower the hip until both feet are reachable
    // again. Authoring a wide stance therefore produces the squat that a
    // wide stance actually requires, and no definition can express
    // geometry the body could not hold.
    const maxReach = THIGH_LEN + SHIN_LEN - 0.25;
    for (const foot of [footL, footR]) {
      const dx = Math.abs(foot.x - hip.x);
      if (dx >= maxReach) continue; // beyond any hip height; IK will clamp
      const minHipY = foot.y - Math.sqrt(maxReach * maxReach - dx * dx);
      if (hip.y < minHipY) hip.y = minHipY;
    }

    const left = solveLeg(hip, footL, "L");
    const right = solveLeg(hip, footR, "R");

    // Report the hip height the solver actually settled on, not the one
    // that was requested, so the shadow and any airborne translate below
    // stay consistent with what is drawn.
    const effectiveDrop = hip.y - HIP.y;

    out.legL = clampJoint("legL", left.leg);
    out.kneeL = clampJoint("kneeL", left.knee);
    out.legR = clampJoint("legR", right.leg);
    out.kneeR = clampJoint("kneeR", right.knee);

    // The renderer translates the figure's root by (x, y). For a grounded
    // motion that translation is the hip drop itself, and it is not
    // optional: the leg groups pivot at the figure's *local* hip, so the
    // IK angles alone place the foot `drop` pixels above the floor. Only
    // moving the root back down puts it on the ground — which is also
    // what makes the torso descend, i.e. what makes a squat a squat.
    //
    // This reports the drop the solver settled on after the reach guard,
    // not the one that was requested, so the feet, the torso and the
    // shadow can never disagree about where the body actually is.
    out.y = effectiveDrop;
    // The shadow tightens as the figure leaves the floor, and only then —
    // squatting brings the body closer to the ground, not further from it.
    out.shadow = 1 - Math.min(0.55, Math.max(0, -effectiveDrop) / 40);
  } else {
    out.legL = clampJoint("legL", pose.legL ?? 0);
    out.kneeL = clampJoint("kneeL", pose.kneeL ?? 0);
    out.legR = clampJoint("legR", pose.legR ?? 0);
    out.kneeR = clampJoint("kneeR", pose.kneeR ?? 0);
    out.shadow = 1 - Math.min(0.5, Math.max(0, -out.y) / 40);
  }

  if (motion.lying) {
    const attitude = LYING[motion.lying];
    // Added after clamping on purpose. The limits exist to catch an
    // author asking for a joint the body does not have; the lying
    // attitude is not a joint, it is which way up the figure is drawn.
    out.rot += attitude.rot;
    out.y += attitude.y;
    out.lying = true;
    // A body on the floor is already at floor level, so there is no
    // height for the shadow to react to.
    out.shadow = 1;
  }

  return out;
}

/**
 * The single most representative frame of a movement — its peak
 * contraction. Used when motion is reduced: a still figure at the bottom
 * of a squat communicates the exercise, while a still figure standing
 * upright communicates nothing and looks broken.
 */
export function peakPose(motion: Motion): SampledPose {
  let best = 0;
  let bestScore = -Infinity;
  for (const k of motion.keys) {
    const p = k.pose;
    // Score by total joint excursion — the frame furthest from rest.
    const score =
      Math.abs(p.hipDrop ?? 0) * 1.4 +
      Math.abs(p.lean ?? 0) +
      Math.abs(p.bend ?? 0) +
      Math.abs(p.armL ?? 0) +
      Math.abs(p.armR ?? 0) +
      Math.abs(p.elbowL ?? 0) +
      Math.abs(p.elbowR ?? 0) +
      Math.abs(p.legL ?? 0) +
      Math.abs(p.legR ?? 0) +
      Math.abs(p.kneeL ?? 0) +
      Math.abs(p.kneeR ?? 0);
    if (score > bestScore) {
      bestScore = score;
      best = k.t;
    }
  }
  return samplePose(motion, best, 0);
}
