import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { DemoGender, DemoTone, PhotoSet } from "../lib/exercisePhotos.generated";
import { usePingPongFrame } from "../lib/usePingPongFrame";
import { accent, type Accent } from "../design/accents";

export interface ExerciseFlipbookProps {
  set: PhotoSet;
  gender?: DemoGender;
  /** Which photographic model. */
  model?: DemoTone;
  /** Caption text — the exercise's own name. */
  label?: string;
  cue?: string;
  size?: number;
  fill?: boolean;
  bare?: boolean;
  /**
   * Show the signature frame and nothing else.
   */
  still?: boolean;
  /** Freeze on the current frame — wired to the session's pause state. */
  paused?: boolean;
  tone?: Accent;
  showCue?: boolean;
  className?: string;
}

/**
 * The photographic exercise demo: a smooth looping sequence of frames
 * from the assets folder through one rep, cross-dissolved in a loop.
 */
export default function ExerciseFlipbook({
  set,
  gender = "male",
  model = "white",
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

  const frames = pickFrames(set, gender, model);
  const frozen = paused || still || !!reduced;
  const showcase = (fill || bare || size >= 120) && !still;
  const a = accent(tone);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      rootMargin: "120px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const interval = set.isHold ? 2600 : 1000;
  const { index } = usePingPongFrame(frames.length, interval, {
    paused: frozen || !onScreen,
  });

  const idx = frozen ? Math.min(set.signature, Math.max(0, frames.length - 1)) : index;
  const frame = frames[idx] ?? frames[0];

  const stage = (
    <div className="absolute inset-0 overflow-hidden">
      {/* Matte: blurred background copy for large showcase cards */}
      {showcase && frame && (
        <img
          src={frame}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full scale-110 select-none object-cover"
          style={{ filter: "blur(14px) saturate(1.2)", opacity: 0.3 }}
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
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.img
            key={frame}
            src={frame}
            alt={label ? `${label} demonstration` : "Exercise demonstration"}
            loading="lazy"
            decoding="async"
            draggable={false}
            initial={frozen ? false : { opacity: 0.3, scale: 1.02 }}
            animate={{
              opacity: 1,
              scale: set.isHold ? [1.01, 1.04, 1.01] : 1,
            }}
            exit={{ opacity: 0.2, transition: { duration: 0.3, ease: "easeOut" } }}
            transition={{
              opacity: { duration: 0.35, ease: "easeInOut" },
              scale: { duration: set.isHold ? 2.6 : 0.8, ease: "easeInOut" },
            }}
            className={`absolute inset-0 h-full w-full select-none object-center will-change-transform ${
              showcase ? "object-contain" : "object-cover"
            }`}
          />
        </AnimatePresence>
      )}

      {/* Shallow vignette scrim */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--void) 40%, transparent) 0%, transparent 34%)",
        }}
      />

      {/* Frame pips — which step of the movement is showing */}
      {showcase && !frozen && frames.length > 1 && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 z-20">
          {frames.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 16 : 6,
                background: i === idx ? a.color : "rgba(255, 255, 255, 0.3)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (bare) {
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
          {cue && <p className="truncate text-[11px] text-ink-3">{cue}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Returns the frame images for this exercise set.
 * Supports cross-gender and cross-tone fallback so exercises with animations
 * in the assets folder always display their frames.
 */
export function pickFrames(
  set: PhotoSet,
  gender: DemoGender = "male",
  model: DemoTone = "white",
): string[] {
  if (!set || !set.frames) return [];
  const otherModel: DemoTone = model === "black" ? "white" : "black";
  const g: DemoGender = gender === "female" ? "female" : "male";

  // 1. Requested gender + model
  if (set.frames[`${g}:${model}`]?.length) {
    return set.frames[`${g}:${model}`]!;
  }
  // 2. Requested gender + other model
  if (set.frames[`${g}:${otherModel}`]?.length) {
    return set.frames[`${g}:${otherModel}`]!;
  }
  // 3. Fall back across gender (e.g. female selection when only male uploaded)
  if (set.frames[`male:${model}`]?.length) {
    return set.frames[`male:${model}`]!;
  }
  if (set.frames[`male:${otherModel}`]?.length) {
    return set.frames[`male:${otherModel}`]!;
  }
  // 4. Any available frames in the set
  for (const list of Object.values(set.frames)) {
    if (list && list.length > 0) return list;
  }
  return [];
}

/** Whether this set has any animation frames available */
export function hasPhotosFor(set: PhotoSet, _gender?: DemoGender): boolean {
  if (!set || !set.frames) return false;
  return Object.values(set.frames).some((list) => Array.isArray(list) && list.length > 0);
}
