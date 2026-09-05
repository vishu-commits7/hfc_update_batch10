import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause } from "lucide-react";
import { DemoRace, PhotoExerciseSet } from "../lib/exercisePhotos";
import { usePingPongFrame } from "../lib/usePingPongFrame";

interface PhotoExerciseThumbProps {
  set: PhotoExerciseSet;
  race: DemoRace;
  size?: number;
  /** Fill the positioned parent instead of using a fixed square size —
   *  for the wide Academy grid-tile banner. */
  fill?: boolean;
  /** Adds the rotating neon-conic ring used on the big demo card, scaled
   *  down — for the "current exercise" panel during an active workout. */
  emphasized?: boolean;
  /** Turns the neon ring/glow up further — the in-workout "current
   *  exercise" card while a set is actually running, so the demo feels
   *  like the centerpiece of the screen rather than a side note. */
  intense?: boolean;
  className?: string;
}

export function PhotoExerciseThumb({ set, race, size, fill = false, emphasized = false, intense = false, className = "" }: PhotoExerciseThumbProps) {
  const frames = race === "black" ? set.black : set.white;
  // Only the emphasized (in-workout "current exercise") card gets visible
  // pause/swipe controls — adding them to every small Academy grid tile
  // would clutter that view.
  const [paused, setPaused] = useState(false);
  const canControl = emphasized && frames.length > 1;
  // Slightly longer than the old cadence so the (also longer) dissolve
  // below has room to fully resolve before the next frame starts fading —
  // a true overlapping cross-dissolve instead of a hard cut. The first
  // couple of transitions play fast (a quick, attention-grabbing flick
  // through the burst), then settle into this slower steady loop.
  const { index: idx, jump, goTo } = usePingPongFrame(frames.length, set.isHold ? 2600 : 1050, { paused });
  const frame = frames[idx] ?? frames[0];
  // Alternates the Ken Burns pan direction per frame so consecutive frames
  // never drift the same way twice in a row — reads as gentle, deliberate
  // camera motion rather than a repeating tic.
  const panRight = idx % 2 === 0;

  // Touch/mouse swipe — lets a person manually flick to the next or
  // previous frame instead of only waiting for the automatic loop.
  const dragStartX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { if (canControl) dragStartX.current = e.clientX; };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!canControl || dragStartX.current == null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(dx) < 24) return;
    jump(dx < 0 ? 1 : -1);
  };

  const card = (
    <div
      className={`overflow-hidden rounded-2xl bg-slate-900 ${fill ? "absolute inset-0" : "relative shrink-0"} ${className}`}
      style={fill ? undefined : { width: size, height: size }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { dragStartX.current = null; }}
    >
      <AnimatePresence>
        <motion.img
          key={frame}
          src={frame}
          initial={{ opacity: 0, scale: 1.05, x: panRight ? -4 : 4 }}
          animate={{
            opacity: 1,
            scale: paused ? 1.02 : (set.isHold ? [1.02, 1.06, 1.02] : [1.0, 1.05]),
            x: paused ? 0 : (set.isHold ? 0 : (panRight ? [0, 5] : [0, -5])),
          }}
          exit={{ opacity: 0, transition: { duration: 0.9, ease: [0.4, 0, 0.2, 1] } }}
          transition={{
            opacity: { duration: 0.9, ease: [0.4, 0, 0.2, 1] },
            scale: { duration: paused ? 0.4 : (set.isHold ? 2.6 : 1.05), repeat: paused ? 0 : (set.isHold ? Infinity : 0), ease: "easeInOut" },
            x: { duration: paused ? 0.4 : (set.isHold ? 2.6 : 1.05), repeat: paused ? 0 : (set.isHold ? Infinity : 0), ease: "easeInOut" },
          }}
          className="absolute inset-0 h-full w-full object-cover will-change-transform select-none"
          draggable={false}
        />
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]" />
      {!emphasized && <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-lime-300/30" />}

      {canControl && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setPaused(p => !p); }}
            aria-label={paused ? "Play animation" : "Pause animation"}
            className="absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-all hover:bg-black/70 active:scale-90"
          >
            {paused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
          </button>

          {/* Slide dots — tap one to jump straight to that frame, or swipe
              the photo itself left/right. A small, literal "slide" control
              alongside the automatic loop. */}
          <div className="absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {frames.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); goTo(i); }}
                aria-label={`Show frame ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );

  if (!emphasized) return card;

  // Emphasized mode wraps the card in the same rotating neon-conic border
  // used on the big Academy demo — a scaled-down version of the "3D card,
  // shiny neon glow" treatment for the in-workout "current exercise" panel.
  // `intense` turns the glow up further for while a set is actually running.
  return (
    <div
      className={`overflow-hidden rounded-[20px] p-[2.5px] ${fill ? "absolute inset-0" : "relative shrink-0"} ${intense ? "animate-pulse-glow" : ""}`}
      style={fill ? undefined : { width: size, height: size }}
    >
      {/* Oversized + centered so the rotating square's corners never sweep
          outside the card — the wrapper's overflow-hidden then clips it
          cleanly to the rounded border. */}
      <motion.div
        className="absolute left-1/2 top-1/2 aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2"
        style={{ background: "conic-gradient(from 0deg, #d4ff00, #22d3ee, #818cf8, #d4ff00)" }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, ease: "linear", duration: intense ? 3.2 : 5 }}
      />
      <div
        className="relative h-full w-full overflow-hidden rounded-[18px] transition-shadow duration-500"
        style={{ boxShadow: intense ? "0 0 34px rgba(212,255,0,0.55), 0 0 64px rgba(34,211,238,0.25)" : "0 0 18px rgba(212,255,0,0.25)" }}
      >
        {card}
      </div>
    </div>
  );
}

export default PhotoExerciseThumb;
