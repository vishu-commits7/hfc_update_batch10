import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Play, Pause } from "lucide-react";
import type { DemoRace, PhotoExerciseSet } from "../lib/exercisePhotos";
import { usePingPongFrame } from "../lib/usePingPongFrame";
import { accent, type Accent } from "../design/accents";

export interface PhotoExerciseThumbProps {
  set: PhotoExerciseSet;
  race: DemoRace;
  /** Caption text. The exercise's own name — NOT `set.label`. The matcher
   *  in exercisePhotos maps a family of names onto one photo set, so
   *  "Wide Push-ups" legitimately resolves to the push-up burst; captioning
   *  it "Classic Push-ups" would be a quiet lie. */
  label?: string;
  /** Form cue, resolved by the caller from the movement library. */
  cue?: string;
  /** Square size in px. Ignored when `fill` is set. */
  size?: number;
  /** Fill a positioned parent instead of a fixed square. */
  fill?: boolean;
  /** Shows the pause button and frame dots. Reserved for the in-session
   *  hero — the same controls on a 48px list row would be unusable. */
  emphasized?: boolean;
  /** Runs the burst faster, to read as "working" during a live set. */
  intense?: boolean;
  /** Freeze on the current frame — wired to the session's pause state. */
  paused?: boolean;
  tone?: Accent;
  showCue?: boolean;
  /** Drop the card chrome and render the bare photo stage. */
  bare?: boolean;
  className?: string;
}

/**
 * Real-photograph exercise demo.
 *
 * Eighteen movements in this app ship a burst of real photographs through
 * one rep. For those, this is the demo: no figure drawn from solved joint
 * angles will beat a photograph of a person for anatomical accuracy, which
 * is the entire point of an exercise demo. `ExerciseAnimation` covers
 * everything else — the other ~37 catalogue entries and every name the AI
 * generator invents — so nothing is ever left without a demo.
 *
 * The two share a container, a cue row and a framing deliberately, so a
 * workout list that mixes them does not read as two different components
 * bolted together. Only the imagery differs.
 *
 * Cost control matches the vector renderer's:
 *  · OFF-SCREEN BURSTS DO NOT TICK. An IntersectionObserver stops the
 *    timer for anything scrolled out of view — the Academy grid holds
 *    nearly forty tiles and should only pay for the visible ones.
 *  · FRAMES ARE LAZY. A tile that never scrolls into view never fetches
 *    its photograph.
 *  · Reduced motion holds a single frame mid-rep rather than cross-fading.
 */
export function PhotoExerciseThumb({
  set,
  race,
  label,
  cue,
  size = 56,
  fill = false,
  emphasized = false,
  intense = false,
  paused = false,
  tone = "emerald",
  showCue = false,
  bare = false,
  className = "",
}: PhotoExerciseThumbProps) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [selfPaused, setSelfPaused] = useState(false);

  // A set can legitimately carry frames for one model and not the other;
  // falling back keeps the tile from rendering an empty stage.
  const frames =
    (race === "black" ? set.black : set.white)?.length
      ? race === "black"
        ? set.black
        : set.white
      : set.black?.length
        ? set.black
        : set.white;

  const canControl = emphasized && frames.length > 1;
  const frozen = paused || selfPaused || !!reduced;

  /**
   * How the photograph is fitted, and why it is two rules rather than one.
   *
   * The photography is not one shape. A push-up is shot 3:2 landscape
   * because the body is horizontal; a jumping jack is shot 2:3 portrait
   * because it is vertical. `object-cover` into this app's containers
   * therefore throws away between a third and two thirds of the frame
   * depending on the movement — and what it throws away is the ends of
   * the body: the hands, the heels, the depth of the squat. For a demo
   * whose entire job is showing correct form, that is the worst possible
   * thing to crop.
   *
   *   LARGE (the in-session hero, an Academy tile): `contain`, so the
   *   whole movement is on screen, matched by a blurred copy of the same
   *   photograph behind it. The blur fills the card with the shot's own
   *   colour, so a 3:2 photo in a 2.3:1 box reads as a framed still
   *   rather than a letterboxed one. This is also what the vector
   *   renderer does — its viewBox is `meet`, never `slice` — so the two
   *   demos frame a movement identically.
   *
   *   SMALL (a 44px strip, a 48px list row): `cover`. At that size the
   *   thumbnail's job is telling one row apart from the next, not
   *   teaching form, and a contained landscape photo is a 44×29 sliver
   *   floating in empty space. Nobody checks their elbow angle at 44px.
   *
   * `bare` counts as large: its only callers are the Academy's tiles and
   * hero, which supply their own frame and never pass a `size`.
   */
  const showcase = fill || bare || size >= 120;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A hold has no rep cycle to show, so it dwells; `intense` tightens the
  // cadence for a set that is actually running.
  const interval = set.isHold ? 2600 : intense ? 820 : 1050;
  const { index, jump, goTo } = usePingPongFrame(frames.length, interval, {
    paused: frozen || !onScreen,
  });

  // Reduced motion settles on a mid-rep frame: the top of a burst is
  // usually a person standing still, which communicates nothing.
  const idx = reduced ? Math.min(frames.length - 1, 1) : index;
  const frame = frames[idx] ?? frames[0];

  // Alternates the Ken Burns pan per frame so consecutive frames never
  // drift the same way twice — deliberate camera motion, not a tic.
  const panRight = idx % 2 === 0;
  const a = accent(tone);

  /* ---------------- manual control ---------------- */

  const dragStartX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (canControl) dragStartX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!canControl || dragStartX.current == null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(dx) < 24) return;
    jump(dx < 0 ? 1 : -1);
  };

  /* ---------------- render ---------------- */

  const stage = (
    <div
      className="absolute inset-0 overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragStartX.current = null;
      }}
    >
      {/* Matte. The same frame, blurred and pushed back, so a contained
          photograph sits in its own colour instead of on a black bar.
          Deliberately outside AnimatePresence and un-animated: a hard cut
          under 20px of blur is imperceptible, and animating it would
          double the compositing work of every demo on screen. */}
      {showcase && (
        <img
          src={frame}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full scale-110 select-none object-cover"
          style={{ filter: "blur(20px) saturate(1.25)", opacity: 0.3 }}
        />
      )}

      <AnimatePresence>
        <motion.img
          key={frame}
          src={frame}
          alt={label ? `${label} demonstration` : `${set.label} demonstration`}
          loading="lazy"
          decoding="async"
          draggable={false}
          initial={
            reduced ? false : { opacity: 0, scale: 1.05, x: panRight ? -4 : 4 }
          }
          animate={
            reduced
              ? { opacity: 1, scale: 1, x: 0 }
              : {
                  opacity: 1,
                  scale: frozen ? 1.02 : set.isHold ? [1.02, 1.06, 1.02] : [1, 1.05],
                  x: frozen ? 0 : set.isHold ? 0 : panRight ? [0, 5] : [0, -5],
                }
          }
          exit={{ opacity: 0, transition: { duration: 0.9, ease: [0.4, 0, 0.2, 1] } }}
          transition={
            reduced
              ? { duration: 0 }
              : {
                  opacity: { duration: 0.9, ease: [0.4, 0, 0.2, 1] },
                  scale: {
                    duration: frozen ? 0.4 : set.isHold ? 2.6 : interval / 1000,
                    repeat: frozen ? 0 : set.isHold ? Infinity : 0,
                    ease: "easeInOut",
                  },
                  x: {
                    duration: frozen ? 0.4 : set.isHold ? 2.6 : interval / 1000,
                    repeat: frozen ? 0 : set.isHold ? Infinity : 0,
                    ease: "easeInOut",
                  },
                }
          }
          className={`absolute inset-0 h-full w-full select-none object-center will-change-transform ${
            showcase ? "object-contain" : "object-cover"
          }`}
        />
      </AnimatePresence>

      {/* Sinks the photograph's own lighting toward the app's surface so a
          bright studio shot does not punch a hole in a dark card. Kept
          shallow on purpose: a heavier scrim reads fine on a 200px hero
          and swallows the legs on a 44px list thumbnail, which is exactly
          the part of a squat worth seeing. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--void) 40%, transparent) 0%, transparent 34%)",
        }}
      />

      {canControl && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelfPaused((p) => !p);
            }}
            aria-label={selfPaused ? "Play demonstration" : "Pause demonstration"}
            className="absolute bottom-2 right-2 z-10 grid h-7 w-7 place-items-center rounded-full border border-line bg-[color-mix(in_srgb,var(--void)_62%,transparent)] text-ink backdrop-blur transition-transform active:scale-90"
          >
            {selfPaused ? (
              <Play className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Pause className="h-3.5 w-3.5 fill-current" />
            )}
          </button>

          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {frames.map((_, i) => (
              <button
                type="button"
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                aria-label={`Show frame ${i + 1} of ${frames.length}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === idx ? 16 : 6,
                  background: i === idx ? a.color : "var(--line-strong)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );

  if (bare) {
    // No `relative` here, deliberately. Bare callers position this
    // themselves — the Academy passes `absolute inset-0` — and emitting
    // both position utilities lets stylesheet order decide which wins.
    // When `relative` won, the wrapper held nothing but absolutely
    // positioned children and collapsed to zero height, so the tile
    // rendered empty.
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
        // Exactly one position utility. Emitting `relative` and `absolute`
        // together leaves stylesheet order — not class order — to decide
        // which wins, which is how a demo once sized itself by its own
        // content instead of by its parent.
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
            {label ?? set.label}
          </p>
          {cue && <p className="truncate text-[10px] text-ink-3">{cue}</p>}
        </div>
      )}
    </div>
  );
}

export default PhotoExerciseThumb;
