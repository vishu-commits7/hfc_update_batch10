/**
 * OBSIDIAN — motion types
 *
 * A motion is data, not code. That is the central design decision here:
 * the old system expressed each exercise as hand-written CSS keyframes,
 * which meant a movement could not be retimed, scrubbed, inspected,
 * validated or reused. Expressed as data, the same definition drives a
 * 48px list icon and a 280px session hero, runs at whatever tempo the
 * workout timer dictates, and can be checked by a test.
 */

/**
 * A single frame of the figure. Every field is degrees of rotation except
 * `x` / `y`, which are viewBox units of translation, and every field is
 * optional — an omitted joint stays at its rest angle, so a pose only
 * states what actually moves.
 *
 * Sign convention, stated once: **positive is clockwise on screen.** For a
 * front-facing figure that means positive raises the left arm and lowers
 * the right, spreads the left leg and closes the right. The asymmetry is
 * inherent to mirrored limbs and is the exact trap the previous rig fell
 * into; it is handled here by authoring each side explicitly rather than
 * by negating a shared value.
 */
export interface Pose {
  /** Whole-figure translation. */
  x?: number;
  y?: number;
  /** Whole-figure rotation about the hip — lying, leaning, inverting. */
  rot?: number;
  /** Upper body (head + torso + both arms) about the hip. */
  lean?: number;
  /** Spine flexion — the torso alone, for crunches and cat-cow. */
  bend?: number;
  /** Head rotation about its own centre. */
  head?: number;

  armL?: number;
  armR?: number;
  elbowL?: number;
  elbowR?: number;

  legL?: number;
  legR?: number;
  kneeL?: number;
  kneeR?: number;

  /**
   * Grounded motions only. How far the hips drop from standing, in viewBox
   * units. The leg angles are then *solved* so the feet stay planted, and
   * any `legL`/`kneeL` authored alongside are ignored.
   */
  hipDrop?: number;
  /** Grounded motions only. Half the distance between the feet. */
  stance?: number;
  /** Per-foot stance override, for staggered and asymmetric stances. */
  stanceL?: number;
  stanceR?: number;
  /** Grounded motions only. Heel lift, for calf raises and toe drives. */
  heel?: number;
  /**
   * How far each foot leaves the floor. This is what separates a lunge
   * from a squat, a step-up from a calf raise, and high knees from a
   * march — all of which are otherwise the same hip movement.
   */
  liftL?: number;
  liftR?: number;
}

export type PoseKey = keyof Pose;

export type Easing =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "hold"
  | "anticipate";

export interface Keyframe {
  /** Position in the cycle, 0 to 1. */
  t: number;
  pose: Pose;
  /** Easing applied on the way *out* of this key. */
  ease?: Easing;
}

/**
 * Broad movement families. Used for two things: choosing an accent colour
 * so a list of exercises is readable at a glance, and — more importantly —
 * giving the resolver something sensible to fall back to when it meets an
 * exercise name it has never seen, which with an AI generator in the app
 * happens constantly.
 */
export type MovementPattern =
  | "push"
  | "pull"
  | "squat"
  | "hinge"
  | "core"
  | "cardio"
  | "isolation"
  | "mobility";

export interface Motion {
  id: string;
  /** Human-readable movement name, shown under the animation. */
  label: string;
  pattern: MovementPattern;
  /** Seconds for one full repetition at a natural pace. */
  tempo: number;
  keys: Keyframe[];
  /**
   * Solve leg angles from planted feet rather than taking them literally.
   * Set on anything performed standing on the floor.
   */
  grounded?: boolean;
  /**
   * A hold rather than a rep. The "cycle" becomes a slow breathing quiver
   * so the figure reads as alive under tension instead of frozen, which is
   * indistinguishable from a rendering failure.
   */
  isometric?: boolean;
  /**
   * Performed on the floor rather than standing.
   *
   * This is a rendering attitude, not a joint angle: the sampler lays the
   * whole figure down and drops it to floor level, and every `rot` the
   * motion authors is then a delta from lying rather than from standing.
   *
   * It exists because the previous CSS rig could not lay a figure down at
   * all — it suggested a plank by tilting an upright figure twelve
   * degrees, and the first version of this library inherited that fudge.
   * Twelve degrees is not a plank. Making the attitude a property means
   * every prone and supine movement is genuinely horizontal, and no
   * definition has to restate the same eighty-degree rotation.
   */
  lying?: "prone" | "supine";
  /**
   * Left and right alternate across successive reps — lunges, bird dog,
   * single-leg work. The renderer mirrors the pose on odd cycles.
   */
  alternating?: boolean;
  /** One short form cue, shown when there is room for it. */
  cue?: string;
  /** Extra search terms for the resolver, beyond the label. */
  aliases?: string[];
}

/** Shape of the resolver's answer, including how confident it is. */
export interface MotionMatch {
  motion: Motion;
  /** `exact` — matched an id or alias. `scored` — token overlap.
   *  `pattern` — fell back to the movement family. */
  via: "exact" | "scored" | "pattern";
  score: number;
}
