import React, { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Dumbbell, Play, Sparkles, Timer, Trash2 } from "lucide-react";
import type { Workout } from "../types";
import { useMagnetic } from "../hooks/useMagnetic";
import ExerciseThumb from "./ExerciseThumb";
import { accent, accentVars, type Accent } from "../design/accents";
import { SPRING_SNAP, SPRING_WEIGHTED, staggerChild } from "../design/motion";
import { pluralize } from "../design/format";

import coverMorning from "../assets/coaches/coach-beast-male.jpg";
import coverCore from "../assets/coaches/coach-core-male.jpg";
import coverLower from "../assets/coaches/coach-lower-male.jpg";
import coverUpper from "../assets/coaches/coach-upper-male.jpg";
import coverCardio from "../assets/coaches/coach-cardio-male.jpg";
import coverFlex from "../assets/coaches/coach-mobility-male.jpg";
import coverAiWorkout from "../assets/ui/gym-hero-dashboard.jpg";

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
  curated_2: { photo: coverCore, coach: "Coach Marcus" },
  curated_3: { photo: coverLower, coach: "Coach Ryan" },
  curated_4: { photo: coverUpper, coach: "Coach Theo" },
  curated_5: { photo: coverCardio, coach: "Coach Devon" },
  curated_6: { photo: coverFlex, coach: "Coach David" },
};

function resolveCoverPhoto(workout: Workout) {
  if (CURATED_COACH_MEDIA[workout.id]) {
    return CURATED_COACH_MEDIA[workout.id];
  }
  const area = (workout.targetArea || "").toLowerCase();
  if (area.includes("core") || area.includes("abs")) {
    return { photo: coverCore, coach: "Coach Marcus" };
  }
  if (area.includes("lower")) {
    return { photo: coverLower, coach: "Coach Ryan" };
  }
  if (area.includes("upper")) {
    return { photo: coverUpper, coach: "Coach Theo" };
  }
  if (area.includes("cardio")) {
    return { photo: coverCardio, coach: "Coach Devon" };
  }
  if (area.includes("flex")) {
    return { photo: coverFlex, coach: "Coach David" };
  }
  return { photo: coverAiWorkout, coach: "Apex Coach" };
}

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
function WorkoutCardComponent({
  workout,
  onSelect,
  onDelete,
  dense = false,
}: WorkoutCardProps) {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const isCurated = workout.id.startsWith("curated_");
  const media = resolveCoverPhoto(workout);
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
      <motion.button
        type="button"
        onClick={() => onSelect(workout)}
        transition={SPRING_WEIGHTED}
        aria-label={`Start ${workout.workoutTitle}`}
        className="block w-full overflow-hidden rounded-2xl border border-line bg-carbon text-left transition-colors hover:border-line-strong cursor-pointer"
      >
        <div
          className={`relative w-full shrink-0 overflow-hidden bg-carbon ${
            dense ? "h-28" : "aspect-video"
          }`}
        >
          <motion.img
            src={media.photo}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover object-[center_20%]"
            // Over-scaled at rest so the parallax translate never exposes an edge.
            initial={false}
            animate={
              reduced
                ? { scale: 1.06 }
                : { scale: hovered ? 1.14 : 1.06, y: hovered ? -6 : 0 }
            }
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Smooth bottom gradient scrim for text readability while leaving the gym photo crisp and clear */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top, var(--carbon) 0%, color-mix(in srgb, var(--carbon) 70%, transparent) 26%, transparent 65%)`,
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 mix-blend-color opacity-10 pointer-events-none"
            style={{ background: t.color }}
          />

          <span
            className="absolute left-3.5 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] bg-black/85"
            style={{
              color: t.color,
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.14)",
            }}
          >
            {isCurated ? "Coach Curated" : "Smart Protocol"}
          </span>

          <span className="absolute bottom-3 left-3.5 text-[11px] font-extrabold uppercase tracking-wider text-ink drop-shadow">
            {media.coach}
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: t.wash, color: t.color }}
            >
              <Timer className="h-3 w-3" strokeWidth={2.6} />
              <span className="font-numeric tabular-nums">{workout.totalDurationMinutes} min</span>
            </span>

            <div className="flex shrink-0 items-center gap-1">
              {!isCurated && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]"
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "var(--ink-2)",
                  }}
                >
                  <Sparkles className="h-2.5 w-2.5 text-cyan-400" />
                  SMART
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

          {/* Clean circular exercise thumbnails */}
          {workout.exercises.length > 0 && (
            <div className="mt-3.5 flex items-center gap-2">
              <div className="flex -space-x-2 overflow-hidden">
                {workout.exercises.slice(0, 3).map((ex, i) => (
                  <div
                    key={`${ex.name}-${i}`}
                    className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[#12141c] bg-[#1a1d28] shadow-sm"
                  >
                    <ExerciseThumb
                      name={ex.name}
                      targetMuscle={ex.targetMuscle}
                      tone={tone}
                      size={40}
                      still
                      bare
                    />
                  </div>
                ))}
              </div>
              {workout.exercises.length > 3 && (
                <span className="font-numeric text-[11px] font-semibold text-ink-3">
                  +{workout.exercises.length - 3} moves
                </span>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2.5 border-t border-line pt-3.5">
            {/* Equipment badge pills with 56px right padding so they never collide with Play button */}
            <div className="flex flex-wrap items-center gap-1.5 pr-14">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-4 mr-0.5">
                <Dumbbell className="h-3 w-3" />
              </span>
              {(workout.equipmentNeeded.length > 0 ? workout.equipmentNeeded : ["Bodyweight"]).map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-md border border-line bg-graphite px-2 py-0.5 text-[11px] font-medium text-ink-3"
                >
                  {item}
                </span>
              ))}
            </div>

            {/* Bottom row in card flow: Moves count and aligned Play action */}
            <div className="flex items-center justify-between gap-3 pt-0.5">
              <span className="font-numeric text-[11px] font-bold text-ink-4">
                {pluralize(workout.exercises.length, "move")}
              </span>

              {/* Affordance inside card flow — advances on hover */}
              <motion.span
                aria-hidden
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider shadow-sm"
                style={{ background: t.color, color: "var(--void)" }}
                animate={{ scale: hovered ? 1.05 : 1, x: hovered ? 2 : 0 }}
                transition={SPRING_SNAP}
              >
                <span>Start</span>
                <Play className="h-3 w-3 fill-current translate-x-px" />
              </motion.span>
            </div>
          </div>
        </div>
      </motion.button>
    </motion.article>
  );
}

const WorkoutCard = React.memo(WorkoutCardComponent);
export default WorkoutCard;
