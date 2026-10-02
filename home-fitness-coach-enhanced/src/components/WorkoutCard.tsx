import React, { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Dumbbell, Play, Sparkles, Timer, Trash2 } from "lucide-react";
import type { Workout } from "../types";
import { useMagnetic } from "../hooks/useMagnetic";
import ExerciseThumb from "./ExerciseThumb";
import { accent, accentVars, type Accent } from "../design/accents";
import { SPRING_SNAP, SPRING_WEIGHTED, staggerChild } from "../design/motion";

import coverMorning from "../assets/coaches/coach-smile-hip.jpg";
import coverCore from "../assets/coaches/cat-core.jpg";
import coverLower from "../assets/coaches/coach-squat.jpg";
import coverUpper from "../assets/coaches/coach-flex-towel.jpg";
import coverCardio from "../assets/coaches/cat-hiit.jpg";
import coverFlex from "../assets/coaches/cat-mobility.jpg";

interface WorkoutCardProps {
  workout: Workout;
  onSelect: (workout: Workout) => void;
  onDelete?: (id: string) => void;
  /** Compact variant for dense rails and the desktop sidebar. */
  dense?: boolean;
}

/**
 * Each curated routine is fronted by its coach's photo and name — kept as
 * the single source of truth for that pairing, since the Dashboard's
 * coach filter is derived from this map rather than from a second roster
 * that could drift out of sync with it.
 */
export const CURATED_COACH_MEDIA: Record<
  string,
  { photo: string; coach: string }
> = {
  curated_1: { photo: coverMorning, coach: "Coach Sam" },
  curated_2: { photo: coverCore, coach: "Coach Priya" },
  curated_3: { photo: coverLower, coach: "Coach Ryan" },
  curated_4: { photo: coverUpper, coach: "Coach Theo" },
  curated_5: { photo: coverCardio, coach: "Coach Devon" },
  curated_6: { photo: coverFlex, coach: "Coach Mia" },
};

/** Target area drives the accent, so the grid is colour-coded by focus. */
function toneForArea(area: string): Accent {
  const a = area.toLowerCase();
  if (a.includes("cardio")) return "ember";
  if (a.includes("core") || a.includes("abs")) return "cyan";
  if (a.includes("lower")) return "emerald";
  if (a.includes("upper")) return "gold";
  return "cyan";
}

/**
 * Workout card.
 *
 * Built as one large hit target rather than a card containing a small
 * "Start" link. The previous version put the only tap target in the
 * bottom-right corner — the hardest spot to reach one-handed and a
 * ~40×80px target inside a ~340×320px card that otherwise looks
 * pressable. Here the whole card starts the workout and delete is the
 * only secondary control, which is also why it is the only thing that
 * stops event propagation.
 *
 * The photo is over-sized and translated against the pointer, so the art
 * parallaxes inside its frame while the card tilts toward the cursor —
 * depth from two layers moving at different rates, rather than a scale
 * transform pretending to be depth.
 */
export default function WorkoutCard({
  workout,
  onSelect,
  onDelete,
  dense = false,
}: WorkoutCardProps) {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const isCurated = workout.id.startsWith("curated_");
  const media = isCurated ? CURATED_COACH_MEDIA[workout.id] : undefined;
  const tone = toneForArea(workout.targetArea);
  const t = accent(tone);

  const m = useMagnetic({ strength: 6, radius: 130, strengthY: 4 });

  return (
    <motion.article
      variants={staggerChild}
      ref={m.ref as React.Ref<HTMLElement>}
      onPointerMove={m.onPointerMove}
      onPointerLeave={() => {
        m.onPointerLeave();
        setHovered(false);
      }}
      onPointerEnter={() => setHovered(true)}
      style={{ ...accentVars(tone), x: m.x, y: m.y }}
      className="group relative"
    >
      {/* Ambient bloom behind the card. Sits outside the clipped surface
          so it can spill past the corners — the effect reads as light
          coming off the card, which it cannot do if it is clipped by it. */}
      <div
        aria-hidden
        className="bloom pointer-events-none absolute -inset-3 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-40"
      />

      <motion.button
        type="button"
        onClick={() => onSelect(workout)}
        whileTap={{ scale: 0.985 }}
        transition={SPRING_WEIGHTED}
        aria-label={`Start ${workout.workoutTitle}`}
        className="aurora-card grain block w-full overflow-hidden rounded-xl2 text-left"
        style={{
          borderColor: hovered
            ? `color-mix(in srgb, ${t.color} 42%, var(--line))`
            : undefined,
          boxShadow: hovered
            ? [
                "var(--bevel)",
                `0 0 0 1px color-mix(in srgb, ${t.color} 16%, transparent)`,
                `0 8px 32px -8px color-mix(in srgb, ${t.color} 22%, transparent)`,
                "var(--shadow-md)",
              ].join(", ")
            : undefined,
          transition:
            "border-color 320ms var(--ease-out-expo), box-shadow 320ms var(--ease-out-expo)",
        }}
      >
        {media && (
          <div
            className={`relative w-full shrink-0 overflow-hidden ${
              dense ? "h-24" : "h-36"
            }`}
          >
            <motion.img
              src={media.photo}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
              // Over-scaled at rest so the parallax translate never
              // exposes an edge.
              initial={false}
              animate={
                reduced
                  ? { scale: 1.06 }
                  : { scale: hovered ? 1.14 : 1.06, y: hovered ? -6 : 0 }
              }
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Two-stop scrim: a hard floor for the caption plus a wash of
                the card's accent, which is what ties six different stock
                photos into one visual system. */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to top, var(--carbon) 2%, color-mix(in srgb, var(--carbon) 72%, transparent) 34%, transparent 78%)`,
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0 mix-blend-color opacity-35"
              style={{ background: t.color }}
            />

            <span
              className="absolute left-3.5 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] backdrop-blur-md"
              style={{
                background: "rgb(0 0 0 / 0.35)",
                color: t.color,
                boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)",
              }}
            >
              Pro routine
            </span>

            <span className="absolute bottom-3 left-3.5 text-[11px] font-extrabold uppercase tracking-wider text-ink drop-shadow">
              {media.coach}
            </span>
          </div>
        )}

        <div className={dense ? "p-4" : "p-5"}>
          <div className="flex items-start justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={{ background: t.wash, color: t.color }}
            >
              <Timer className="h-3 w-3" strokeWidth={2.6} />
              {workout.totalDurationMinutes} min
            </span>

            <div className="flex shrink-0 items-center gap-1">
              {!media && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em]"
                  style={{
                    background: "var(--emerald-wash)",
                    color: "var(--emerald)",
                  }}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  AI
                </span>
              )}

              {onDelete && !isCurated && (
                <motion.span
                  role="button"
                  tabIndex={0}
                  aria-label={`Delete ${workout.workoutTitle}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(workout.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(workout.id);
                    }
                  }}
                  whileTap={{ scale: 0.86 }}
                  whileHover={{ scale: 1.12 }}
                  transition={SPRING_SNAP}
                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-ink-4 transition-colors hover:text-crimson-glow"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </motion.span>
              )}
            </div>
          </div>

          <h3 className="font-display mt-3 text-base font-extrabold leading-snug tracking-tight text-ink">
            {workout.workoutTitle}
          </h3>

          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-3">
            {workout.workoutDescription}
          </p>

          {/* Animated preview of the first movements in the routine. A
              still list of exercise names tells you what the session
              contains; three looping figures tell you what it will feel
              like, before committing to it. Capped at three so the strip
              stays a glance rather than a second list. */}
          {workout.exercises.length > 0 && (
            <div className="mt-4 flex gap-1.5">
              {workout.exercises.slice(0, 3).map((ex, i) => (
                <ExerciseThumb
                  key={`${ex.name}-${i}`}
                  name={ex.name}
                  targetMuscle={ex.targetMuscle}
                  tone={tone}
                  size={44}
                />
              ))}
              {workout.exercises.length > 3 && (
                <span className="font-numeric grid h-11 min-w-11 shrink-0 place-items-center rounded-md2 border border-line px-2 text-[11px] font-bold text-ink-4">
                  +{workout.exercises.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3.5">
            <div className="flex min-w-0 items-center gap-3 text-[11px] text-ink-4">
              <span className="inline-flex items-center gap-1">
                <Dumbbell className="h-3 w-3" />
                <span className="truncate">
                  {workout.equipmentNeeded.join(", ") || "Bodyweight"}
                </span>
              </span>
              <span className="shrink-0 font-semibold">
                {workout.exercises.length} moves
              </span>
            </div>

            {/* Affordance, not the target — the card itself is the button.
                It advances on hover to confirm the whole surface is live. */}
            <motion.span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
              style={{ background: t.color, color: "var(--void)" }}
              animate={{ scale: hovered ? 1.1 : 1, x: hovered ? 2 : 0 }}
              transition={SPRING_SNAP}
            >
              <Play className="h-3.5 w-3.5 translate-x-px fill-current" />
            </motion.span>
          </div>
        </div>
      </motion.button>
    </motion.article>
  );
}
