import React from "react";
import HumanFigure, { FigureGender } from "./HumanFigure";
import { matchExerciseAnimation } from "../lib/exerciseMotion";
import { DemoRace, getPhotoSet } from "../lib/exercisePhotos";
import { PhotoExerciseThumb } from "./PhotoExerciseThumb";

/**
 * A small, always-looping exercise icon for lists (workout overview rows,
 * the "current exercise" panel during an active workout). For the small
 * subset of movements that now have real photo bursts (see
 * `exercisePhotos.ts`) this renders a looping neon photo card matched to
 * the person's chosen demo model; everything else keeps the original
 * illustrated-athlete SVG rig, so a plan list never shows a static,
 * lifeless icon either way.
 */
export default function ExerciseThumb({
  name,
  gender = "male",
  race = "white",
  size = 56,
  emphasized = false,
  intense = false,
  fill = false,
}: {
  name: string;
  gender?: FigureGender;
  race?: DemoRace;
  size?: number;
  emphasized?: boolean;
  /** Turns the neon glow up further on the (rare) exercises that have a
   *  real photo set — used for the in-workout panel while a set is live. */
  intense?: boolean;
  /** Fill the positioned parent instead of a fixed square — for a big,
   *  full-width banner treatment (e.g. the in-workout "current exercise"
   *  card) instead of a small list icon. */
  fill?: boolean;
}) {
  const photoSet = getPhotoSet(name);
  if (photoSet) {
    return <PhotoExerciseThumb set={photoSet} race={race} size={size} fill={fill} emphasized={emphasized} intense={intense} />;
  }

  const pattern = matchExerciseAnimation(name);
  return (
    <div
      className={`overflow-hidden rounded-2xl bg-gradient-to-br from-[#1c2030] to-[#0a0c14] ring-1 ring-white/10 ${fill ? "absolute inset-0" : "relative shrink-0"}`}
      style={fill ? undefined : { width: size, height: size }}
    >
      <svg
        viewBox="0 0 360 220"
        preserveAspectRatio="xMidYMid slice"
        className={`mini-motion motion-${pattern}`}
        style={{ overflow: "visible", width: "100%", height: "100%" }}
      >
        <HumanFigure gender={gender} />
      </svg>
      <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_10px_rgba(0,0,0,0.45)]" />
    </div>
  );
}
