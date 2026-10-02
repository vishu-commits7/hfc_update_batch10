import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "motion/react";
import HumanFigure, { type FigureGender } from "./HumanFigure";
import { subscribeToClock } from "../anim/clock";
import { resolveMotion, motionById } from "../anim/resolve";
import { peakPose, samplePose, type SampledPose } from "../anim/sample";
import { GROUND_Y, HIP } from "../anim/rig";
import type { Motion } from "../anim/types";
import { accent, type Accent } from "../design/accents";

export interface ExerciseAnimationProps {
  /** Exercise name. Resolved to a motion — see anim/resolve.ts. */
  name: string;
  /** Target muscle, if known. A strong secondary signal for the resolver. */
  targetMuscle?: string;
  /** Bypass the resolver entirely with a known motion id. */
  motionId?: string;
  gender?: FigureGender;
  /** Square size in px. Ignored when `fill` is set. */
  size?: number;
  /** Fill a positioned parent instead of a fixed square. */
  fill?: boolean;
  /** Playback multiplier. 1 is the movement's natural tempo. */
  speed?: number;
  /** Freeze on the current frame — wired to the session's pause state. */
  paused?: boolean;
  /**
   * Hold the movement's signature pose and never subscribe to the clock.
   *
   * This is not `paused`. `paused` freezes wherever the loop happens to
   * be; `still` renders the one frame that identifies the movement — peak
   * contraction, the bottom of the squat, the top of the curl — which is
   * what a browsing grid needs. It also costs nothing per frame, so a
   * forty-tile Academy is static markup rather than forty subscriptions.
   */
  still?: boolean;
  tone?: Accent;
  /** Movement name and form cue beneath the figure. */
  showCue?: boolean;
  /** Drop the card chrome and render the bare figure. */
  bare?: boolean;
  className?: string;
}

/** Joint groups the renderer drives, in the order it writes them. */
const JOINTS = [
  ".motion-upper-body",
  ".motion-torso",
  ".motion-head",
  ".motion-arm-l",
  ".motion-arm-r",
  ".motion-elbow-l",
  ".motion-elbow-r",
  ".motion-leg-l",
  ".motion-leg-r",
  ".motion-knee-l",
  ".motion-knee-r",
] as const;

type JointKey = (typeof JOINTS)[number];

/** Which field of the sampled pose drives each group. */
const DRIVER: Record<JointKey, keyof SampledPose> = {
  // `lean` and `bend` are summed onto the upper body rather than driving
  // the torso separately. The artwork has no cervical joint: rotating the
  // torso polygon on its own leaves the head hanging in space where the
  // shoulders used to be, which on a crunch — the one movement that most
  // needs spine flexion — looks like the figure has come apart. Summing
  // them curls head, arms and torso together, which is what a crunch
  // actually does.
  ".motion-upper-body": "lean",
  ".motion-torso": "bend",
  ".motion-head": "head",
  ".motion-arm-l": "armL",
  ".motion-arm-r": "armR",
  ".motion-elbow-l": "elbowL",
  ".motion-elbow-r": "elbowR",
  ".motion-leg-l": "legL",
  ".motion-leg-r": "legR",
  ".motion-knee-l": "kneeL",
  ".motion-knee-r": "kneeR",
};

/**
 * Transform origins for the two groups HumanFigure does not set inline.
 * Stated here rather than relied upon from the legacy stylesheet, so this
 * renderer has no dependency on `exercise-rig.css` and the two systems
 * cannot interfere with each other.
 */
const ORIGINS: Partial<Record<JointKey, string>> = {
  ".motion-torso": `${HIP.x}px ${HIP.y}px`,
  ".motion-head": "180px 36px",
};

/**
 * Stable per-motion phase offset.
 *
 * A grid of twelve figures all hitting the bottom of their rep on the same
 * frame reads as a screensaver, not as twelve people training. Offsetting
 * each movement by a hash of its own id de-synchronises them while staying
 * deterministic — the same exercise always starts at the same point, so
 * nothing flickers between renders.
 */
function phaseOffset(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/**
 * Real-time exercise animation.
 *
 * Resolves an exercise name to a movement definition and drives the
 * illustrated figure from solved joint angles, one frame at a time.
 *
 * What makes this viable at scale — a workout list can hold a dozen of
 * these, the Academy nearly forty:
 *
 *  · ONE rAF LOOP for the whole application, not one per figure. See
 *    anim/clock.ts.
 *  · NO REACT RE-RENDERS while animating. The sampled pose is written
 *    straight to cached DOM nodes; React renders this component once and
 *    then never again until a prop changes.
 *  · OFF-SCREEN FIGURES DO NOT ANIMATE. An IntersectionObserver
 *    unsubscribes anything scrolled out of view, so the cost tracks what
 *    is actually visible rather than what is mounted.
 *  · WRITES ARE SKIPPED when a joint has not moved by a meaningful
 *    amount. Most movements hold most joints still; this avoids the
 *    style recalculation for those.
 *
 * Under `prefers-reduced-motion` the figure holds its peak contraction —
 * the bottom of the squat, the top of the curl — because a still figure
 * standing upright communicates nothing and reads as a broken image.
 */
export default function ExerciseAnimation({
  name,
  targetMuscle,
  motionId,
  gender = "male",
  size = 56,
  fill = false,
  speed = 1,
  paused = false,
  still = false,
  tone = "emerald",
  showCue = false,
  bare = false,
  className = "",
}: ExerciseAnimationProps) {
  const reduced = useReducedMotion();
  const rootRef = useRef<SVGSVGElement>(null);
  const figureRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);

  /** Cached joint nodes, resolved once per mount. */
  const nodesRef = useRef<Partial<Record<JointKey, SVGGElement>>>({});
  /** Last written value per joint, to skip no-op style writes. */
  const lastRef = useRef<Record<string, number>>({});
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  /** Clock time at the moment of pausing, so resuming does not jump. */
  const frozenRef = useRef(0);

  const motion: Motion = useMemo(() => {
    if (motionId) {
      const direct = motionById(motionId);
      if (direct) return direct;
    }
    return resolveMotion(name, targetMuscle).motion;
  }, [motionId, name, targetMuscle]);

  const match = useMemo(
    () => (motionId ? null : resolveMotion(name, targetMuscle)),
    [motionId, name, targetMuscle],
  );

  const a = accent(tone);

  /* ---------------- pose application ---------------- */

  useEffect(() => {
    const svg = rootRef.current;
    if (!svg) return;

    // Resolve the joint nodes once. querySelector per frame would be a
    // DOM traversal sixty times a second per figure.
    const nodes: Partial<Record<JointKey, SVGGElement>> = {};
    for (const key of JOINTS) {
      const el = svg.querySelector<SVGGElement>(key);
      if (!el) continue;
      nodes[key] = el;
      const origin = ORIGINS[key];
      if (origin) el.style.transformOrigin = origin;
    }
    nodesRef.current = nodes;
    lastRef.current = {};

    /**
     * Has this value moved enough to be worth a style write?
     *
     * Written as the negation of "close enough to skip" rather than as a
     * direct `>=` comparison, and that is not stylistic. On the first
     * frame `prev` is `undefined`, so the difference is `NaN` — and every
     * comparison against `NaN` is false, including `>=`. Phrased the
     * direct way, the very first write never happens and the value is
     * never recorded, so it never happens at all. Negating a `<` makes
     * `NaN` mean "changed", which is exactly right for a first frame.
     */
    const moved = (prev: number | undefined, next: number, eps: number) =>
      !(Math.abs((prev as number) - next) < eps);

    const apply = (pose: SampledPose) => {
      const last = lastRef.current;

      for (const key of JOINTS) {
        const el = nodes[key];
        if (!el) continue;
        const value =
          key === ".motion-upper-body"
            ? pose.lean + pose.bend
            : key === ".motion-torso"
              ? 0
              : (pose[DRIVER[key]] as number);
        // Sub-tenth-of-a-degree changes are invisible and still cost a
        // style recalculation, so they are not written.
        if (!moved(last[key], value, 0.08)) continue;
        last[key] = value;
        el.style.transform = `rotate(${value.toFixed(2)}deg)`;
      }

      const fig = figureRef.current;
      if (
        fig &&
        (moved(last.__x, pose.x, 0.05) ||
          moved(last.__y, pose.y, 0.05) ||
          moved(last.__rot, pose.rot, 0.08))
      ) {
        last.__x = pose.x;
        last.__y = pose.y;
        last.__rot = pose.rot;
        // The root translate carries the hip drop for grounded motions —
        // without it the legs bend but the feet hang above the floor —
        // and the rotation is what lays the figure down for prone and
        // supine movements.
        fig.style.transform =
          `translate(${pose.x.toFixed(2)}px, ${pose.y.toFixed(2)}px) rotate(${pose.rot.toFixed(2)}deg)`;
      }

      const shadow = shadowRef.current;
      const lying = pose.lying ? 1 : 0;
      if (
        shadow &&
        (moved(last.__sh, pose.shadow, 0.01) || moved(last.__ly, lying, 0.5))
      ) {
        last.__sh = pose.shadow;
        last.__ly = lying;
        // A body on the floor casts a long shadow along its own length,
        // not a small pool under a pair of feet that are no longer
        // beneath it. Widening and raising it is what stops a plank
        // looking like it is hovering above its own shadow.
        shadow.style.transform = pose.lying
          ? `translateY(-26px) scale(${(pose.shadow * 1.55).toFixed(3)}, 0.7)`
          : `scaleX(${pose.shadow.toFixed(3)})`;
        shadow.style.opacity = String(
          (pose.lying ? 0.1 : 0.12) + pose.shadow * 0.2,
        );
      }
    };

    // A single frame at peak contraction and no clock subscription —
    // either because the caller asked for the signature pose, or because
    // the user asked the whole system to stop moving. A still figure
    // standing upright communicates nothing and reads as a broken image,
    // which is why this is the peak and not the rest pose.
    if (reduced || still) {
      apply(peakPose(motion));
      return;
    }

    const periodMs = Math.max(400, motion.tempo * 1000) / Math.max(0.2, speed);
    const offset = phaseOffset(motion.id) * periodMs;

    let unsubscribe: (() => void) | null = null;

    const tick = (elapsed: number) => {
      const t = pausedRef.current ? frozenRef.current : elapsed;
      if (!pausedRef.current) frozenRef.current = elapsed;
      const total = t + offset;
      const cycle = Math.floor(total / periodMs);
      const phase = (total % periodMs) / periodMs;
      apply(samplePose(motion, phase, cycle));
    };

    // Only animate what is on screen. A workout list that has scrolled
    // past twenty cards should not be paying for twenty figures.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !unsubscribe) {
          unsubscribe = subscribeToClock(tick);
        } else if (!entry.isIntersecting && unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(svg);

    return () => {
      observer.disconnect();
      unsubscribe?.();
    };
  }, [motion, reduced, still, speed]);

  /* ---------------- render ---------------- */

  const figure = (
    <svg
      ref={rootRef}
      /* Framed with margin on every side. Content spans roughly x 118–242
         and y 10–196 at the widest pose (a jumping jack at full spread),
         so this leaves a comfortable border rather than letting a hand or
         a heel touch the card edge at the extremes of a rep. */
      viewBox="72 -8 216 220"
      preserveAspectRatio="xMidYMid meet"
      className="exercise-anim h-full w-full"
      role="img"
      aria-label={`${motion.label} demonstration`}
    >
      {/* Ground contact. Anchored to the floor line the IK solves against,
          so the figure never appears to hover. */}
      <ellipse
        ref={shadowRef}
        cx={HIP.x}
        cy={GROUND_Y + 12}
        rx={46}
        ry={7}
        fill="#000"
        opacity={0.32}
        style={{ transformOrigin: `${HIP.x}px ${GROUND_Y + 12}px` }}
      />
      <g
        ref={figureRef}
        style={{ transformOrigin: `${HIP.x}px ${HIP.y}px` }}
      >
        <HumanFigure gender={gender} />
      </g>
    </svg>
  );

  if (bare) {
    return <div className={className}>{figure}</div>;
  }

  return (
    <div
      className={[
        // Column layout rather than an absolutely-positioned caption. An
        // overlaid cue sits on top of the figure's legs at exactly the
        // moment a squat is deepest, hiding the part of the movement the
        // caption is describing. Giving the caption its own row costs a
        // little height and keeps the whole body visible through the rep.
        "flex flex-col overflow-hidden rounded-lg2",
        // `relative` and `absolute` are both position utilities in the
        // same cascade layer, so emitting both lets stylesheet order —
        // not class order — decide which wins. That is how this ended up
        // sized by its own content instead of by its parent, rendering a
        // 457px-tall figure inside a 208px panel.
        fill ? "absolute inset-0" : "relative shrink-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...(fill ? {} : { width: size, height: size }),
        background: `radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, ${a.color} 12%, var(--graphite)) 0%, var(--obsidian) 72%)`,
        boxShadow: "inset 0 0 0 1px var(--line)",
      }}
    >
      <div className="relative min-h-0 flex-1">{figure}</div>

      {showCue && (
        <div className="shrink-0 border-t border-line px-3 py-2">
          <p
            className="truncate text-[11px] font-bold"
            style={{ color: a.color }}
          >
            {motion.label}
            {match && match.via === "pattern" && (
              // Honest labelling. When the resolver could only identify
              // the movement *family*, the figure is showing the closest
              // equivalent rather than this exact exercise, and the UI
              // should not imply otherwise.
              <span className="ml-1 font-semibold text-ink-4">
                · closest match
              </span>
            )}
          </p>
          {motion.cue && (
            <p className="truncate text-[10px] text-ink-3">{motion.cue}</p>
          )}
        </div>
      )}
    </div>
  );
}
