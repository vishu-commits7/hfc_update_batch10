/**
 * OBSIDIAN — rig geometry and kinematics
 *
 * The measurements below are read directly off `HumanFigure.tsx`. They are
 * not new: the artwork, the joint hierarchy and every pivot point are
 * exactly what that component already draws. What is new is that those
 * joints are now driven by solved numbers each frame instead of by
 * hand-written CSS keyframes.
 *
 * Two things the CSS rig could not do, which this file exists to fix:
 *
 *  1. SIGN CORRECTNESS. SVG `rotate()` is clockwise with y growing
 *     downward, which is easy to get backwards by hand — and the old rig
 *     did, on the whole-limb swings. Jumping jacks applied `rotate(-45deg)`
 *     to the arms, which puts the hands *below* the shoulders, and
 *     `rotate(-20deg)` to the legs, narrowing the stance from 35px to 11px.
 *     Arms down and feet together is the inverse of a jumping jack. Here
 *     every angle is expressed as a target the solver reaches, so the
 *     direction is stated once, in one place, and verified by a test.
 *
 *  2. GROUNDING. The rig is forward kinematics rooted at the hip, so
 *     lowering the body rotates the legs and drags the feet across the
 *     floor. A real squat plants the feet and drops the hips. `solveLeg`
 *     below inverts that: give it where the foot must stay and where the
 *     hip has moved to, and it returns the thigh and shin angles that keep
 *     the foot planted.
 *
 * Coordinate space is the figure's own viewBox, `0 0 360 220`, with the
 * body centred on x = 180 and the floor at y = 177.
 */

/* ------------------------------------------------------------------ */
/*  Joint positions at rest                                            */
/* ------------------------------------------------------------------ */

export interface Point {
  x: number;
  y: number;
}

export const HIP: Point = { x: 180, y: 112 };
export const SHOULDER: Point = { x: 180, y: 68 };
export const HEAD: Point = { x: 180, y: 36 };

export const KNEE_L: Point = { x: 162.5, y: 144.5 };
export const KNEE_R: Point = { x: 197.5, y: 144.5 };
export const FOOT_L: Point = { x: 145, y: 177 };
export const FOOT_R: Point = { x: 215, y: 177 };

export const ELBOW_L: Point = { x: 156, y: 81.5 };
export const ELBOW_R: Point = { x: 204, y: 81.5 };
export const HAND_L: Point = { x: 132, y: 95 };
export const HAND_R: Point = { x: 228, y: 95 };

/** Floor line. Grounded motions keep the feet on it. */
export const GROUND_Y = 177;

/* ------------------------------------------------------------------ */
/*  Segment lengths and rest angles                                    */
/* ------------------------------------------------------------------ */

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const angleOf = (from: Point, to: Point) =>
  (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

export const THIGH_LEN = dist(HIP, KNEE_L); // 36.91
export const SHIN_LEN = dist(KNEE_L, FOOT_L); // 36.91
export const UPPER_ARM_LEN = dist(SHOULDER, ELBOW_L); // 27.54
export const FOREARM_LEN = dist(ELBOW_L, HAND_L); // 27.54

/**
 * Rest angles of each segment, in screen degrees. Every rotation the
 * renderer writes is a *delta* from these, because that is what the SVG
 * groups in HumanFigure start at — so a pose of all zeros is the standing
 * figure, unchanged, pixel for pixel.
 */
export const REST = {
  thighL: angleOf(HIP, KNEE_L), // 118.30
  thighR: angleOf(HIP, KNEE_R), // 61.70
  shinL: angleOf(KNEE_L, FOOT_L), // 118.30 — colinear with the thigh
  shinR: angleOf(KNEE_R, FOOT_R), // 61.70
  upperArmL: angleOf(SHOULDER, ELBOW_L), // 150.64
  upperArmR: angleOf(SHOULDER, ELBOW_R), // 29.36
  foreArmL: angleOf(ELBOW_L, HAND_L), // 150.64
  foreArmR: angleOf(ELBOW_R, HAND_R), // 29.36
} as const;

/* ------------------------------------------------------------------ */
/*  Joint limits                                                       */
/* ------------------------------------------------------------------ */

/**
 * Anatomical stops, applied to every pose before it reaches the DOM.
 *
 * These are what stop the figure doing something a body cannot: a knee
 * that bends backwards, an elbow that hyperextends, a head that spins.
 * They are generous rather than clinical — the figure is a diagram, not a
 * cadaver — but they make bad authoring impossible rather than merely
 * unlikely, which matters because motion definitions are data and data
 * gets edited by people who are not looking at the rig.
 *
 * Knees and elbows are one-directional on purpose. A knee flexes; it does
 * not extend past straight. Clamping at 0 on that side is the single most
 * effective accuracy guard in the whole system.
 */
export const LIMITS: Record<string, [min: number, max: number]> = {
  rot: [-95, 95],
  lean: [-100, 100],
  bend: [-55, 55],
  head: [-38, 38],
  armL: [-70, 185],
  armR: [-185, 70],
  elbowL: [0, 155], // flexion only
  elbowR: [-155, 0],
  legL: [-45, 85],
  legR: [-85, 45],
  kneeL: [-150, 6], // flexion only, with a few degrees of slack
  kneeR: [-6, 150],
};

export function clampJoint(key: string, value: number): number {
  const limit = LIMITS[key];
  if (!limit) return value;
  return Math.min(limit[1], Math.max(limit[0], value));
}

/* ------------------------------------------------------------------ */
/*  Inverse kinematics                                                 */
/* ------------------------------------------------------------------ */

export interface LegSolution {
  /** Rotation to write onto `.motion-leg-*`, relative to rest. */
  leg: number;
  /** Rotation to write onto `.motion-knee-*`. Nested, so relative to the
   *  thigh rather than to the world. */
  knee: number;
}

/**
 * Two-link IK for one leg.
 *
 * Given where the hip has moved to and where the foot must stay, returns
 * the thigh and shin rotations that connect them. This is what keeps feet
 * planted through a squat instead of sliding, and it is the difference
 * between a movement that reads as a squat and one that reads as a figure
 * being scaled vertically.
 *
 * The elbow-up/elbow-down ambiguity inherent in two-link IK is resolved by
 * `side`: the knee always bulges away from the midline. On a front-facing
 * figure that is correct — knees track outward over the toes — and it is
 * also the only choice that cannot produce a backwards knee.
 */
export function solveLeg(
  hip: Point,
  foot: Point,
  side: "L" | "R",
): LegSolution {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;

  // Clamped just inside full extension. At exactly L1+L2 the interior
  // angle is 0 and acos sits on a domain edge where floating-point error
  // produces NaN — which would blank the whole figure for one frame.
  const reach = THIGH_LEN + SHIN_LEN;
  const d = Math.min(reach - 0.01, Math.max(0.01, Math.hypot(dx, dy)));

  const toFoot = (Math.atan2(dy, dx) * 180) / Math.PI;

  // Law of cosines: interior angle at the hip between the hip→foot line
  // and the thigh.
  const cosA =
    (d * d + THIGH_LEN * THIGH_LEN - SHIN_LEN * SHIN_LEN) /
    (2 * d * THIGH_LEN);
  const a = (Math.acos(Math.min(1, Math.max(-1, cosA))) * 180) / Math.PI;

  // Knee bulges outward: away from the midline on each side.
  const thigh = side === "L" ? toFoot + a : toFoot - a;

  const t = (thigh * Math.PI) / 180;
  const knee: Point = {
    x: hip.x + Math.cos(t) * THIGH_LEN,
    y: hip.y + Math.sin(t) * THIGH_LEN,
  };
  const shin =
    (Math.atan2(foot.y - knee.y, foot.x - knee.x) * 180) / Math.PI;

  const restThigh = side === "L" ? REST.thighL : REST.thighR;

  return {
    // Delta from the rest angle, because that is where the SVG group starts.
    leg: thigh - restThigh,
    // Nested inside the leg group, so its rotation is relative to the thigh.
    knee: shin - thigh,
  };
}

/**
 * Two-link IK for one arm. Same contract as `solveLeg`, used by the
 * movements where the hands are the fixed point rather than the feet —
 * push-ups, planks, dips, bird dog. In those, the hands are on the floor
 * and it is the shoulders that travel.
 */
export function solveArm(
  shoulder: Point,
  hand: Point,
  side: "L" | "R",
): { arm: number; elbow: number } {
  const dx = hand.x - shoulder.x;
  const dy = hand.y - shoulder.y;
  const reach = UPPER_ARM_LEN + FOREARM_LEN;
  const d = Math.min(reach - 0.01, Math.max(0.01, Math.hypot(dx, dy)));
  const toHand = (Math.atan2(dy, dx) * 180) / Math.PI;

  const cosA =
    (d * d + UPPER_ARM_LEN * UPPER_ARM_LEN - FOREARM_LEN * FOREARM_LEN) /
    (2 * d * UPPER_ARM_LEN);
  const a = (Math.acos(Math.min(1, Math.max(-1, cosA))) * 180) / Math.PI;

  // Elbows break outward and backwards, the opposite of the knee, which is
  // what makes a push-up read as a push-up rather than as a mantis.
  const upper = side === "L" ? toHand - a : toHand + a;

  const t = (upper * Math.PI) / 180;
  const elbowPt: Point = {
    x: shoulder.x + Math.cos(t) * UPPER_ARM_LEN,
    y: shoulder.y + Math.sin(t) * UPPER_ARM_LEN,
  };
  const fore =
    (Math.atan2(hand.y - elbowPt.y, hand.x - elbowPt.x) * 180) / Math.PI;

  const restUpper = side === "L" ? REST.upperArmL : REST.upperArmR;

  return { arm: upper - restUpper, elbow: fore - upper };
}

/**
 * Rotates a point about the hip. Used to find where a fixed contact point
 * (a planted foot, a hand on the floor) sits relative to a body that has
 * itself rotated — a plank leans the whole figure, but the hands stay
 * where they were on the ground.
 */
export function rotateAboutHip(p: Point, degrees: number): Point {
  const t = (degrees * Math.PI) / 180;
  const dx = p.x - HIP.x;
  const dy = p.y - HIP.y;
  return {
    x: HIP.x + dx * Math.cos(t) - dy * Math.sin(t),
    y: HIP.y + dx * Math.sin(t) + dy * Math.cos(t),
  };
}
