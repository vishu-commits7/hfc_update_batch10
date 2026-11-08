import { useState, useEffect, useMemo, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wind,
  Droplets,
  Plus,
  Minus,
  Play,
  Pause,
  ChevronRight,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Exercise } from "../types";
import { getScientificRest, ScientificRestProfile } from "../lib/scientificRest";
import { getTodayWaterGlasses, logWaterGlass } from "../lib/wellness";
import { ProgressRing, MagneticButton } from "./ui";
import ExerciseThumb from "./ExerciseThumb";
import LofiMusicButton from "./LofiMusicButton";
import type { FigureGender } from "./HumanFigure";
import type { DemoTone } from "../lib/exercisePhotos.generated";
import { clock } from "../design/format";
import { SPRING_SNAP } from "../design/motion";

export interface RestWindowProps {
  currentExercise: Exercise;
  currentSet: number;
  totalSets: number;

  nextExercise?: Exercise;
  isNextExerciseDifferent: boolean;
  nextSetNumber: number;
  totalNextSets: number;

  timeLeft: number;
  totalRestDuration: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onAdjustTime: (deltaSeconds: number) => void;
  onSkipRest: () => void;

  exerciseIndex: number;
  totalExercises: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndSession: () => void;
  figureGender: FigureGender;
  demoModel: DemoTone;
}

function RestWindowInner({
  currentExercise,
  currentSet,
  totalSets,
  nextExercise,
  isNextExerciseDifferent,
  nextSetNumber,
  totalNextSets,
  timeLeft,
  totalRestDuration,
  isPaused,
  onTogglePause,
  onAdjustTime,
  onSkipRest,
  exerciseIndex,
  totalExercises,
  isMuted,
  onToggleMute,
  onEndSession,
  figureGender,
  demoModel,
}: RestWindowProps) {
  // Scientific rest profile
  const restProfile: ScientificRestProfile = useMemo(() => {
    return getScientificRest(
      currentExercise.name,
      currentExercise.targetMuscle,
      totalRestDuration || currentExercise.restSeconds
    );
  }, [currentExercise.name, currentExercise.targetMuscle, totalRestDuration, currentExercise.restSeconds]);

  // Hydration state
  const [waterGlasses, setWaterGlasses] = useState<number>(getTodayWaterGlasses);
  const [waterLoggedToast, setWaterLoggedToast] = useState(false);

  // Breath pacer: Inhale -> Hold -> Exhale, advancing on its own.
  // Phase is derived from a single elapsed-seconds counter instead of being
  // flipped from inside a state updater (which was unreliable and made the
  // cue appear stuck on "Inhale"). Nothing here needs a tap.
  const [breathTick, setBreathTick] = useState(0);
  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => setBreathTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  const { breathPhase, breathCountdown } = useMemo(() => {
    const g = restProfile.breathingGuide;
    const inh = Math.max(1, g.inhaleSeconds);
    const hold = Math.max(0, g.holdSeconds);
    const exh = Math.max(1, g.exhaleSeconds);
    const cycle = inh + hold + exh;
    const p = breathTick % cycle;
    if (p < inh) return { breathPhase: "inhale" as const, breathCountdown: inh - p };
    if (p < inh + hold) return { breathPhase: "hold" as const, breathCountdown: inh + hold - p };
    return { breathPhase: "exhale" as const, breathCountdown: cycle - p };
  }, [breathTick, restProfile.breathingGuide]);

  const handleLogWater = () => {
    const updated = logWaterGlass(1);
    setWaterGlasses(updated);
    setWaterLoggedToast(true);
    setTimeout(() => setWaterLoggedToast(false), 2200);
  };

  // Progress computation (clamped 0 to 1)
  const effectiveTotal = Math.max(1, totalRestDuration || restProfile.durationSeconds);
  const progressFraction = Math.max(0, Math.min(1, (effectiveTotal - timeLeft) / effectiveTotal));

  // Target exercise to preview as "Up Next"
  const previewExercise = isNextExerciseDifferent ? nextExercise : currentExercise;

  return (
    <div
      className="space-y-4 pb-12 animate-fade-in"
      style={{ paddingTop: "calc(var(--safe-t) + 12px)" }}
    >
      {/* ----------------- TOP HEADER ----------------- */}
      <header className="flex items-center justify-between gap-3">
        <MagneticButton
          size="sm"
          variant="soft"
          tone="crimson"
          id="btn-quit-session-rest"
          onClick={onEndSession}
        >
          <X className="h-3.5 w-3.5" />
          End
        </MagneticButton>

        <div className="font-numeric flex items-center gap-1.5 text-[11px] font-bold text-ink-3">
          <span className="text-emerald-400">
            {String(exerciseIndex + 1).padStart(2, "0")}
          </span>
          <span className="text-ink-4">/ {String(totalExercises).padStart(2, "0")}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <LofiMusicButton mode="soothing" />
          <MagneticButton
            size="sm"
            variant="ghost"
            tone="neutral"
            id="btn-rest-toggle-sound"
            onClick={onToggleMute}
            className="border border-line"
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            {isMuted ? "Muted" : "Voice"}
          </MagneticButton>
        </div>
      </header>



      {/* ----------------- CENTRAL RECOVERY COUNTDOWN RING ----------------- */}
      <section className="relative grid place-items-center py-1">
        <ProgressRing
          value={progressFraction}
          size={230}
          thickness={5.5}
          tone="emerald"
          gap={0.18}
          glow
          animate={false}
          className="max-w-full"
          label={`${Math.round(progressFraction * 100)}% of recovery window completed`}
        >
          <div className="flex flex-col items-center">
            <span
              className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: "var(--emerald)" }}
            >
              {isPaused ? "Paused" : "Recovery Window"}
            </span>

            {/* Large Tabular Countdown Clock */}
            <span
              className="font-numeric mt-1 block text-[58px] font-extrabold leading-[0.9] tracking-[-0.05em] text-ink tabular-nums sm:text-[68px]"
              style={{
                fontVariantNumeric: "tabular-nums",
                textShadow: isPaused
                  ? "none"
                  : "0 0 35px rgba(52, 211, 153, 0.45), 0 0 70px rgba(52, 211, 153, 0.2)",
              }}
            >
              {clock(timeLeft)}
            </span>

            <span className="mt-1 text-xs font-semibold text-white/60">
              {isPaused ? "Rest paused" : `${timeLeft}s left to recharge`}
            </span>

            <span
              className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold"
              style={{
                background: "color-mix(in srgb, var(--emerald) 18%, transparent)",
                color: "var(--emerald)",
              }}
            >
              Set {currentSet} of {totalSets} complete
            </span>
          </div>
        </ProgressRing>
      </section>

      {/* ----------------- TACTILE RECOVERY CONTROLS ----------------- */}
      {/* Primary CTA: Ready — full width, dominant emerald pill */}
      <section className="flex flex-col items-center gap-3">
        <motion.button
          type="button"
          onClick={onSkipRest}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 py-4 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/30 active:opacity-90 transition-all"
          aria-label="Skip rest and start next exercise"
        >
          <ChevronRight className="h-5 w-5" />
          <span>I'm Ready — Next Exercise</span>
        </motion.button>

        {/* Secondary row: time adjust + pause */}
        <div className="flex items-center justify-center gap-3">
          {/* -10s button */}
          <motion.button
            type="button"
            onClick={() => onAdjustTime(-10)}
            className="flex h-11 items-center gap-1 rounded-xl bg-white/8 px-4 text-xs font-extrabold text-white/70 border border-line hover:bg-white/14 hover:text-ink transition-colors"
            title="Decrease rest by 10 seconds"
          >
            <Minus className="h-3.5 w-3.5" /> 10s
          </motion.button>

          {/* Play / Pause toggle */}
          <motion.button
            type="button"
            onClick={onTogglePause}
            whileHover={{ scale: 1.05 }}
            transition={SPRING_SNAP}
            className="grid h-14 w-14 place-items-center rounded-full text-slate-950 font-black shadow-lg"
            style={{
              background: isPaused ? "#f8fafc" : "#10b981",
              boxShadow: isPaused
                ? "0 8px 24px -6px rgba(255,255,255,0.4)"
                : "0 8px 28px -4px rgba(16, 185, 129, 0.6)",
            }}
            aria-label={isPaused ? "Resume rest" : "Pause rest"}
          >
            {isPaused ? (
              <Play className="h-6 w-6 translate-x-0.5 fill-current" />
            ) : (
              <Pause className="h-6 w-6 fill-current" />
            )}
          </motion.button>

          {/* +20s button */}
          <motion.button
            type="button"
            onClick={() => onAdjustTime(20)}
            className="flex h-11 items-center gap-1 rounded-xl bg-emerald-500/12 px-4 text-xs font-extrabold text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/22 transition-colors"
            title="Add 20 seconds recovery"
          >
            <Plus className="h-3.5 w-3.5" /> 20s
          </motion.button>
        </div>
      </section>

      {/* ----------------- 2. COMPACT BREATHING CUE & QUICK WATER ----------------- */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Compact Breathing Cue */}
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-carbon p-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
            <Wind className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400">
                Breathing Cadence
              </span>
              <span className="text-[11px] font-bold text-white/40">({breathCountdown}s)</span>
            </div>
            <p className="text-xs font-bold text-ink truncate mt-0.5">
              {breathPhase === "inhale" && "Inhale deeply through nose"}
              {breathPhase === "hold" && "Hold breath & relax shoulders"}
              {breathPhase === "exhale" && "Exhale slowly through mouth"}
            </p>
          </div>
        </div>

        {/* Quick Water Button */}
        <motion.button
          type="button"
          onClick={handleLogWater}
          className="relative flex items-center gap-3 rounded-2xl border border-line bg-carbon p-3.5 text-left hover:border-cyan-500/30 transition"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
            <Droplets className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-300">
              Hydration Track
            </span>
            <p className="text-xs font-bold text-ink truncate mt-0.5">
              +1 Glass Water ({waterGlasses}/8)
            </p>
          </div>
          <AnimatePresence>
            {waterLoggedToast && (
              <motion.span
                initial={{ opacity: 0, scale: 0.5, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: -16 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute right-3 -top-2 rounded-full bg-blue-400 px-2 py-0.5 text-[11px] font-black text-slate-950 shadow"
              >
                +250ml!
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </section>

      {/* ----------------- 3. UP NEXT EXERCISE PREVIEW ----------------- */}
      {previewExercise && (
        <section className="rounded-2xl border border-line bg-carbon p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">
              Up Next
            </span>
            <span className="text-[11px] font-extrabold text-white/70">
              {isNextExerciseDifferent
                ? `Set 1 of ${previewExercise.sets || totalNextSets}`
                : `Set ${nextSetNumber} of ${totalSets}`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-void">
              <ExerciseThumb
                name={previewExercise.name}
                targetMuscle={previewExercise.targetMuscle}
                gender={figureGender}
                model={demoModel}
                size={64}
                still
              />
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-black text-ink truncate">
                {previewExercise.name}
              </h4>
              <p className="text-[11px] font-semibold text-ink-3 truncate mt-0.5">
                {previewExercise.targetMuscle} ·{" "}
                {previewExercise.durationSeconds > 0
                  ? `${previewExercise.durationSeconds}s`
                  : `${previewExercise.reps} reps`}
              </p>
              {previewExercise.description && (
                <p className="mt-1 text-[11px] font-medium text-ink-2 leading-snug">
                  Form cue: {previewExercise.description}
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

const RestWindow = memo(RestWindowInner);
export default RestWindow;
