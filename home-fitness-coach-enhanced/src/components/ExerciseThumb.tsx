import { useMemo } from "react";
import type { FigureGender } from "./HumanFigure";
import ExerciseAnimation from "./ExerciseAnimation";
import ExerciseFlipbook, { hasPhotosFor } from "./ExerciseFlipbook";
import { photoSetForMotion, type DemoTone } from "../lib/exercisePhotos.generated";
import { resolveMotion } from "../anim/resolve";
import type { Accent } from "../design/accents";

/**
 * The exercise demo used everywhere in the app.
 *
 * PHOTOGRAPHS FIRST, DRAWN FIGURE AS THE FLOOR.
 *
 * The movement resolver does the work. `resolveMotion("Wide Push-ups")`
 * already returns the motion id `pushup`, so the photo layer just asks
 * whether `pushup` has been shot. That means there is no second name
 * table to keep in sync, and every exercise name the AI generator invents
 * gets photography for free as long as the resolver can place it.
 *
 * Three rules decide which renderer runs:
 *
 *  1. The resolver must have placed the name EXACTLY or by SCORE. A
 *     `pattern` match means it only recognised the movement *family* —
 *     "Sled Push" lands on the push family — and showing push-up
 *     photographs for that would be telling the user this is what a sled
 *     push looks like. It is not. Those get the drawn figure, labelled
 *     "closest match".
 *  2. The photography must exist FOR THAT GENDER. Every photograph in the
 *     app is currently of a male model, so female selections fall to the
 *     figure rather than silently showing a man — which is the bug that
 *     made the setting meaningless before.
 *  3. Otherwise the drawn figure, which covers any name at any gender.
 *
 * Both renderers share a container, a framing, a cue row and a `still`
 * mode, so a list that mixes them reads as one component rather than two.
 */
export default function ExerciseThumb({
  name,
  targetMuscle,
  gender = "male",
  model = "white",
  size = 56,
  emphasized = false,
  intense = false,
  fill = false,
  bare = false,
  still = false,
  tone = "emerald",
  showCue = false,
  paused = false,
}: {
  name: string;
  /** Improves resolution accuracy for unfamiliar names. */
  targetMuscle?: string;
  gender?: FigureGender;
  /** Which photographic model. Only reaches the photo renderer. */
  model?: DemoTone;
  size?: number;
  /** Brighter accent treatment — used for the in-session hero panel. */
  emphasized?: boolean;
  /** Runs the movement slightly faster during a live set. */
  intense?: boolean;
  /** Fill a positioned parent instead of a fixed square. */
  fill?: boolean;
  /** Drop the card chrome and render the bare demo. */
  bare?: boolean;
  /** Hold the movement's signature frame instead of looping it. */
  still?: boolean;
  tone?: Accent;
  showCue?: boolean;
  paused?: boolean;
}) {
  const match = useMemo(
    () => resolveMotion(name, targetMuscle),
    [name, targetMuscle],
  );

  // "neutral" has no photographic counterpart, so it uses the figure.
  const photoGender = gender === "female" ? "female" : gender === "male" ? "male" : null;

  const set = useMemo(() => {
    if (!photoGender) return null;
    if (match.via === "pattern") return null;
    const s = photoSetForMotion(match.motion.id);
    return s && hasPhotosFor(s, photoGender) ? s : null;
  }, [match, photoGender]);

  const ring = emphasized
    ? "ring-1 ring-[color-mix(in_srgb,var(--emerald)_28%,transparent)]"
    : "";
  const className = bare ? "absolute inset-0" : ring;

  if (set && photoGender) {
    return (
      <ExerciseFlipbook
        set={set}
        gender={photoGender}
        model={model}
        label={name}
        cue={match.motion.cue}
        size={size}
        fill={fill}
        bare={bare}
        still={still}
        paused={paused}
        tone={tone}
        showCue={showCue}
        className={className}
      />
    );
  }

  return (
    <ExerciseAnimation
      name={name}
      targetMuscle={targetMuscle}
      gender={gender}
      size={size}
      fill={fill}
      bare={bare}
      still={still}
      tone={tone}
      speed={intense ? 1.12 : 1}
      paused={paused}
      showCue={showCue}
      className={className}
    />
  );
}
