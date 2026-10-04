import { useMemo, useState, useRef, useEffect, memo } from "react";
import type { FigureGender } from "./HumanFigure";
import ExerciseAnimation from "./ExerciseAnimation";
import ExerciseFlipbook, { hasPhotosFor } from "./ExerciseFlipbook";
import { photoSetForMotion, type DemoTone } from "../lib/exercisePhotos.generated";
import { resolveMotion } from "../anim/resolve";
import type { Accent } from "../design/accents";
import { accent } from "../design/accents";
import { getExerciseVideo } from "../lib/exerciseVideos";
import { getCustomAcademyExercises } from "../lib/customExercises";

/**
 * The exercise demo used everywhere in the app.
 *
 * VIDEO FIRST WHEN ACTIVE / PLAYING (!still), PHOTOGRAPHS FOR THUMBNAILS (still).
 *
 * When an exercise is playing (e.g. inside the active workout or opened in detail),
 * it swaps the photo flipbook ("ppt") with the real exercise video form demonstration.
 *
 * When `still` is true (thumbnails in library grid, workout cards, sequence lists),
 * it retains the signature still frame without playing video.
 */
function ExerciseThumbInner({
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
  isBlankPhoto: _isBlankPhoto,
  signaturePose,
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
  isBlankPhoto?: boolean;
  signaturePose?: string;
}) {
  const activeSignaturePose = useMemo(() => {
    if (signaturePose) return signaturePose;
    try {
      const customs = getCustomAcademyExercises();
      const norm = name.trim().toLowerCase();
      const found = customs.find((c) => c.name.trim().toLowerCase() === norm);
      return found?.signaturePose;
    } catch {
      return undefined;
    }
  }, [name, signaturePose]);

  if (activeSignaturePose) {
    return (
      <div className={bare ? "absolute inset-0 overflow-hidden bg-slate-950" : `relative overflow-hidden rounded-lg2`}>
        <img
          src={activeSignaturePose}
          alt={name}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const match = useMemo(
    () => resolveMotion(name, targetMuscle),
    [name, targetMuscle],
  );

  // Look up exercise video when not rendering a static thumbnail
  const videoSrc = useMemo(
    () => (!still ? getExerciseVideo(name, undefined, match.motion.id) : null),
    [still, name, match.motion.id],
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setVideoError(false);
  }, [name, videoSrc]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (paused) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [paused]);

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

  const a = accent(tone);

  // 1. Play video when active/playing (!still) and video exists
  if (!still && videoSrc && !videoError) {
    const stage = (
      <div className="absolute inset-0 overflow-hidden bg-black/40">
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          onError={() => setVideoError(true)}
          className="h-full w-full object-contain"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, color-mix(in srgb, var(--void) 40%, transparent) 0%, transparent 34%)",
          }}
        />
      </div>
    );

    if (bare) {
      return (
        <div className={`overflow-hidden ${className}`}>
          {stage}
        </div>
      );
    }

    return (
      <div
        className={[
          "flex flex-col overflow-hidden rounded-lg2",
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
        <div className="relative min-h-0 flex-1">{stage}</div>

        {showCue && (
          <div className="shrink-0 border-t border-line px-3 py-2">
            <p className="truncate text-[11px] font-bold" style={{ color: a.color }}>
              {name}
            </p>
            {match.motion.cue && <p className="truncate text-[10px] text-ink-3">{match.motion.cue}</p>}
          </div>
        )}
      </div>
    );
  }

  // 2. Photographs for thumbnails (still) or fallback
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

  // 3. Pose-based figure animation fallback
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

const ExerciseThumb = memo(ExerciseThumbInner);
export default ExerciseThumb;
