import { useEffect, useRef, useState, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { DemoGender, DemoTone, PhotoSet } from "../lib/exercisePhotos.generated";
import { usePingPongFrame } from "../lib/usePingPongFrame";
import { accent, type Accent } from "../design/accents";
import { getExerciseVideo } from "../lib/exerciseVideos";

export interface ExerciseFlipbookProps {
  set: PhotoSet;
  gender: DemoGender;
  /** Which photographic model. Named `model`, not `tone`, because `tone`
   *  means accent colour everywhere else in this codebase. */
  model: DemoTone;
  /** Caption text — the exercise's own name. */
  label?: string;
  cue?: string;
  size?: number;
  fill?: boolean;
  bare?: boolean;
  /**
   * Show the signature frame and nothing else.
   *
   * The frame that identifies a movement is a specific one — jacks at full
   * spread with the arms overhead, the squat at its lowest — not whatever
   * frame a loop happens to be on when you scroll past. Lists and grids
   * want recognition, so they get that frame; only a demo the user has
   * actually opened runs.
   */
  still?: boolean;
  /** Freeze on the current frame — wired to the session's pause state. */
  paused?: boolean;
  tone?: Accent;
  showCue?: boolean;
  className?: string;
}

/**
 * The photographic exercise demo: a short burst of real frames through one
 * rep, cross-dissolved in a loop.
 *
 * A real photograph of a real person beats anything drawn for showing what
 * a movement looks like, which is the entire job here. `ExerciseAnimation`
 * covers everything that has no photography — 18 of the 55 movements, plus
 * every exercise name the AI generator invents.
 *
 * ── Tempo ────────────────────────────────────────────────────────────
 * Frames hold for 1.1s with a 0.85s dissolve, so one frame is always
 * fading into the next rather than cutting. Fast enough to read as motion,
 * slow enough to actually look at the form. Holds (plank, wall-sit) have
 * no rep cycle to show, so they breathe on a single frame instead of
 * pretending.
 *
 * ── Fit ──────────────────────────────────────────────────────────────
 * The photography is not one shape: a push-up is shot 3:2 landscape
 * because the body is horizontal, a jumping jack 2:3 portrait because it
 * is vertical. Cropping either to fill discards a third to two thirds of
 * the frame, and what it discards is the ends of the body — the hands, the
 * heels, the depth of the squat. So a large demo contains the whole frame
 * and fills the card with a blurred copy of itself; a small thumbnail,
 * where the job is telling one row from the next, crops.
 */
export default function ExerciseFlipbook({
  set,
  gender,
  model,
  label,
  cue,
  size = 56,
  fill = false,
  bare = false,
  still = false,
  paused = false,
  tone = "emerald",
  showCue = false,
  className = "",
}: ExerciseFlipbookProps) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);

  const videoSrc = useMemo(
    () => (!still && label ? getExerciseVideo(label) : null),
    [still, label]
  );
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const frames = pickFrames(set, gender, model);
  const frozen = paused || still || !!reduced;
  const showcase = (fill || bare || size >= 120) && !still;
  const a = accent(tone);

  useEffect(() => {
    setVideoError(false);
  }, [videoSrc]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (frozen) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [frozen]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      rootMargin: "120px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const interval = set.isHold ? 2600 : 1100;
  const { index } = usePingPongFrame(frames.length, interval, {
    paused: frozen || !onScreen,
  });

  const idx = frozen ? Math.min(set.signature, frames.length - 1) : index;
  const frame = frames[idx] ?? frames[0];
  const panRight = idx % 2 === 0;

  const stage = (
    <div className="absolute inset-0 overflow-hidden">
      {/* Matte: blurred background copy only for large active showcase cards, never for still thumbnails */}
      {showcase && (
        <img
          src={frame}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full scale-110 select-none object-cover"
          style={{ filter: "blur(12px) saturate(1.2)", opacity: 0.25 }}
        />
      )}

      {still || frozen ? (
        <img
          src={frame}
          alt={label ? `${label} demonstration` : "Exercise demonstration"}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`absolute inset-0 h-full w-full select-none object-center ${
            showcase ? "object-contain" : "object-cover"
          }`}
        />
      ) : !still && videoSrc && !videoError ? (
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          onError={() => setVideoError(true)}
          className={`absolute inset-0 h-full w-full select-none ${
            showcase ? "object-contain" : "object-cover"
          }`}
        />
      ) : (
        <AnimatePresence>
          <motion.img
            key={frame}
            src={frame}
            alt={label ? `${label} demonstration` : "Exercise demonstration"}
            loading="lazy"
            decoding="async"
            draggable={false}
            initial={frozen ? false : { opacity: 0, scale: 1.05, x: panRight ? -4 : 4 }}
            animate={
              frozen
                ? { opacity: 1, scale: 1, x: 0 }
                : {
                    opacity: 1,
                    scale: set.isHold ? [1.02, 1.06, 1.02] : [1, 1.05],
                    x: set.isHold ? 0 : panRight ? [0, 5] : [0, -5],
                  }
            }
            exit={{ opacity: 0, transition: { duration: 0.85, ease: [0.4, 0, 0.2, 1] } }}
            transition={
              frozen
                ? { duration: 0 }
                : {
                    opacity: { duration: 0.85, ease: [0.4, 0, 0.2, 1] },
                    scale: {
                      duration: set.isHold ? 2.6 : interval / 1000,
                      repeat: set.isHold ? Infinity : 0,
                      ease: "easeInOut",
                    },
                    x: {
                      duration: set.isHold ? 2.6 : interval / 1000,
                      repeat: set.isHold ? Infinity : 0,
                      ease: "easeInOut",
                    },
                  }
            }
            className={`absolute inset-0 h-full w-full select-none object-center will-change-transform ${
              showcase ? "object-contain" : "object-cover"
            }`}
          />
        </AnimatePresence>
      )}

      {/* Shallow scrim. Heavier reads fine on a 250px hero and swallows the
          legs on a 44px thumbnail, which is the part of a squat worth
          seeing. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--void) 40%, transparent) 0%, transparent 34%)",
        }}
      />

      {/* Frame pips — which step of the movement is showing. Only where
          the demo is actually running and large enough to read. */}
      {showcase && !frozen && frames.length > 1 && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {frames.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 16 : 6,
                background: i === idx ? a.color : "var(--line-strong)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (bare) {
    // Exactly one position utility. Bare callers position this themselves,
    // and emitting both `relative` and `absolute` lets stylesheet order
    // decide which wins — when `relative` won, the wrapper held nothing but
    // absolutely positioned children and collapsed to zero height.
    return (
      <div ref={rootRef} className={`overflow-hidden ${className}`}>
        {stage}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
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
            {label}
          </p>
          {cue && <p className="truncate text-[10px] text-ink-3">{cue}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * The frames for this gender and tone, or an empty list.
 *
 * Falls back across TONE but never across GENDER. Every photograph in the
 * app is currently of a male model, so a cross-gender fallback would mean
 * selecting "female" silently showed a man — which is exactly the bug that
 * made the setting meaningless in the first place. Returning nothing lets
 * the caller fall through to the drawn figure, which does honour the
 * setting.
 */
export function pickFrames(
  set: PhotoSet,
  gender: DemoGender,
  model: DemoTone,
): string[] {
  const other: DemoTone = model === "black" ? "white" : "black";
  return set.frames[`${gender}:${model}`] ?? set.frames[`${gender}:${other}`] ?? [];
}

/** Whether this set has any photography for the given gender. */
export function hasPhotosFor(set: PhotoSet, gender: DemoGender): boolean {
  return pickFrames(set, gender, "white").length > 0;
}
