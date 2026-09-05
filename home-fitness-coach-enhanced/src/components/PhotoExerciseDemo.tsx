import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause } from "lucide-react";
import { DemoRace, PhotoExerciseSet } from "../lib/exercisePhotos";
import type { ExerciseDemo } from "./ExerciseLibrary";
import { usePingPongFrame } from "../lib/usePingPongFrame";

/**
 * Real-photo counterpart to `MotionDemo` (the illustrated stick-figure
 * demo) — a "3D" neon-glow card that loops a real 3-frame photo burst of
 * the movement (or breathes gently on a single held frame), with a
 * Black/White model switch living right on the card.
 */
export default function PhotoExerciseDemo({
  exercise, set, race, onRaceChange,
}: { exercise: ExerciseDemo; set: PhotoExerciseSet; race: DemoRace; onRaceChange: (r: DemoRace) => void }) {
  const frames = race === "black" ? set.black : set.white;
  const [paused, setPaused] = useState(false);
  const canControl = frames.length > 1;
  // Slightly slower cadence than before, so the longer dissolve below has
  // room to fully cross-fade before the next frame starts — a true overlap
  // instead of a hard cut. The first couple of transitions play fast (a
  // quick flick through the burst), then settle into this slower loop.
  const { index: idx, jump, goTo } = usePingPongFrame(frames.length, set.isHold ? 2800 : 1150, { paused });
  const frame = frames[idx] ?? frames[0];
  // Alternates the Ken Burns pan direction per frame for gentle, deliberate
  // camera drift rather than a repeating back-and-forth tic.
  const panRight = idx % 2 === 0;

  // Touch/mouse swipe — flick left/right to manually move through the burst.
  const dragStartX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { if (canControl) dragStartX.current = e.clientX; };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!canControl || dragStartX.current == null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(dx) < 24) return;
    jump(dx < 0 ? 1 : -1);
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] p-[3px]">
      {/* Rotating neon-conic border — the "shiny glow" card frame. The
          rotating square is oversized (200%) and centered so its corners
          never sweep outside the rounded card as they spin — the wrapper's
          own overflow-hidden then clips it to the border-radius exactly. */}
      <motion.div
        className="absolute left-1/2 top-1/2 aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2"
        style={{ background: "conic-gradient(from 0deg, #d4ff00, #22d3ee, #818cf8, #f472b6, #d4ff00)" }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, ease: "linear", duration: 6 }}
      />
      <div
        className="relative h-64 overflow-hidden rounded-[25px] bg-slate-950 shadow-[0_0_32px_rgba(212,255,0,0.22)] sm:h-72"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragStartX.current = null; }}
      >
        <AnimatePresence>
          <motion.img
            key={frame}
            src={frame}
            initial={{ opacity: 0, scale: 1.08, x: panRight ? -6 : 6 }}
            animate={{
              opacity: 1,
              scale: paused ? 1.02 : (set.isHold ? [1.02, 1.07, 1.02] : [1.0, 1.06]),
              x: paused ? 0 : (set.isHold ? 0 : (panRight ? [0, 6] : [0, -6])),
            }}
            exit={{ opacity: 0, transition: { duration: 1.05, ease: [0.4, 0, 0.2, 1] } }}
            transition={{
              opacity: { duration: 1.05, ease: [0.4, 0, 0.2, 1] },
              scale: { duration: paused ? 0.4 : (set.isHold ? 3.6 : 1.15), repeat: paused ? 0 : (set.isHold ? Infinity : 0), ease: "easeInOut" },
              x: { duration: paused ? 0.4 : (set.isHold ? 3.6 : 1.15), repeat: paused ? 0 : (set.isHold ? Infinity : 0), ease: "easeInOut" },
            }}
            className="absolute inset-0 h-full w-full object-cover will-change-transform select-none"
            draggable={false}
          />
        </AnimatePresence>

        {/* Bottom-to-top scrim so the badges/text stay legible over any photo */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-slate-950/40" />

        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-lime-300 backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-lime-300" /> {set.isHold ? "Hold demo" : "Photo demo"}
        </div>

        {/* Black / White model switch — lives on the card itself */}
        <div className="absolute right-4 top-4 flex gap-1 rounded-full bg-black/40 p-1 backdrop-blur">
          {(["black", "white"] as DemoRace[]).map(r => (
            <button
              key={r}
              onClick={() => onRaceChange(r)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-all ${
                race === r ? "bg-white text-slate-950" : "text-white/60 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Slide dots — tap one to jump straight to that frame, or swipe
            the photo itself left/right. */}
        {canControl && (
          <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 gap-1.5">
            {frames.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Show frame ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"}`}
              />
            ))}
          </div>
        )}

        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">{set.isHold ? "Isometric hold" : "Demonstration"}</p>
            <p className="text-sm font-black text-white">{exercise.tempo}</p>
          </div>
          {canControl ? (
            <button
              onClick={() => setPaused(p => !p)}
              aria-label={paused ? "Play animation" : "Pause animation"}
              className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-[10px] font-bold text-white/70 backdrop-blur transition-all hover:bg-black/60 hover:text-white active:scale-95"
            >
              {paused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
              {paused ? "Paused" : "Looping motion"}
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[10px] font-bold text-white/60">
              <Play className="h-3.5 w-3.5 fill-current" /> Looping motion
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
