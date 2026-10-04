import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  HeartPulse,
  Wind,
  Droplets,
  Plus,
  Minus,
  Play,
  Pause,
  ChevronRight,
  Flame,
  Shield,
  Dumbbell,
  Activity,
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
import gymMobilityRecovery from "../assets/ui/gym-mobility-recovery.jpg";
import gymRecoveryAthlete from "../assets/ui/gym-recovery-athlete.jpg";
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

export default function RestWindow({
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

  // Perceived exertion / readiness
  const [readiness, setReadiness] = useState<"ready" | "steady" | "heavy">("ready");

  // Breath pacer state (Inhale -> Hold -> Exhale)
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [breathCountdown, setBreathCountdown] = useState(restProfile.breathingGuide.inhaleSeconds);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setBreathCountdown((prev) => {
        if (prev <= 1) {
          // Switch phase
          if (breathPhase === "inhale") {
            setBreathPhase(restProfile.breathingGuide.holdSeconds > 0 ? "hold" : "exhale");
            return restProfile.breathingGuide.holdSeconds > 0
              ? restProfile.breathingGuide.holdSeconds
              : restProfile.breathingGuide.exhaleSeconds;
          } else if (breathPhase === "hold") {
            setBreathPhase("exhale");
            return restProfile.breathingGuide.exhaleSeconds;
          } else {
            setBreathPhase("inhale");
            return restProfile.breathingGuide.inhaleSeconds;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [breathPhase, isPaused, restProfile.breathingGuide]);

  const handleLogWater = () => {
    const updated = logWaterGlass(1);
    setWaterGlasses(updated);
    setWaterLoggedToast(true);
    setTimeout(() => setWaterLoggedToast(false), 2200);
  };

  // Progress computation (clamped 0 to 1)
  const effectiveTotal = Math.max(1, totalRestDuration || restProfile.durationSeconds);
  const progressFraction = Math.max(0, Math.min(1, (effectiveTotal - timeLeft) / effectiveTotal));

  // Category Icon
  const CategoryIcon = useMemo(() => {
    switch (restProfile.category) {
      case "strength_power":
        return Flame;
      case "hypertrophy":
        return Dumbbell;
      case "core_postural":
        return Shield;
      case "metabolic_cardio":
        return HeartPulse;
      case "mobility_flexibility":
      default:
        return Activity;
    }
  }, [restProfile.category]);

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

      {/* ----------------- BIOENERGETIC & RECOVERY BANNER ----------------- */}
      <section
        className="aurora-card relative overflow-hidden rounded-2xl p-4 border"
        style={{
          borderColor: "color-mix(in srgb, var(--emerald) 25%, transparent)",
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.02) 100%)",
        }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <img
            src={gymMobilityRecovery}
            alt=""
            className="h-full w-full object-cover object-[70%_25%] opacity-45"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-transparent" />
        </div>
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
              style={{
                background: "color-mix(in srgb, var(--emerald) 18%, transparent)",
                color: "var(--emerald)",
                border: "1px solid color-mix(in srgb, var(--emerald) 35%, transparent)",
              }}
            >
              <CategoryIcon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                  {restProfile.categoryLabel}
                </span>
                <span className="h-1 w-1 rounded-full bg-emerald-400/50" />
                <span className="text-[10px] font-bold text-white/50">Scientific Rest</span>
              </div>
              <p className="mt-0.5 text-xs font-black text-white">
                {restProfile.energySystem}
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black border"
            style={{
              background: "rgba(16, 185, 129, 0.12)",
              borderColor: "rgba(16, 185, 129, 0.3)",
              color: "#34d399",
            }}
          >
            <HeartPulse className="h-3 w-3 animate-pulse text-emerald-400" />
            {restProfile.targetHeartRateZone}
          </div>
        </div>

        {/* Biological rationale snippet */}
        <p className="mt-3 text-[11px] leading-relaxed text-slate-300">
          {restProfile.scientificRationale}
        </p>
      </section>

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
              className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: "var(--emerald)" }}
            >
              {isPaused ? "Paused" : "Recovery Window"}
            </span>

            {/* Large Tabular Countdown Clock */}
            <span
              className="font-numeric mt-1 block text-[58px] font-extrabold leading-[0.9] tracking-[-0.05em] text-white tabular-nums sm:text-[68px]"
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
              className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold"
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
      <section className="flex items-center justify-center gap-3">
        {/* -10s button */}
        <motion.button
          type="button"
          onClick={() => onAdjustTime(-10)}
          whileTap={{ scale: 0.92 }}
          className="flex h-11 items-center gap-1 rounded-xl bg-white/10 px-3 text-xs font-extrabold text-white border border-white/10 hover:bg-white/15"
          title="Decrease rest by 10 seconds"
        >
          <Minus className="h-3.5 w-3.5" /> 10s
        </motion.button>

        {/* Play / Pause toggle */}
        <motion.button
          type="button"
          onClick={onTogglePause}
          whileTap={{ scale: 0.9 }}
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
          whileTap={{ scale: 0.92 }}
          className="flex h-11 items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs font-extrabold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
          title="Add 20 seconds recovery"
        >
          <Plus className="h-3.5 w-3.5" /> 20s
        </motion.button>

        {/* Skip Rest CTA */}
        <motion.button
          type="button"
          onClick={onSkipRest}
          whileTap={{ scale: 0.92 }}
          className="flex h-11 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 text-xs font-black text-slate-950 shadow-md hover:opacity-95"
        >
          <span>Ready</span>
          <ChevronRight className="h-4 w-4" />
        </motion.button>
      </section>

      {/* ----------------- ACTIVE RECOVERY ATHLETE SPOTLIGHT ----------------- */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-950 p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative h-32 w-full sm:w-44 shrink-0 overflow-hidden rounded-xl border border-emerald-500/20 shadow-md">
            <img
              src={gymRecoveryAthlete}
              alt="Athlete Rehydrating"
              className="h-full w-full object-cover object-[50%_20%]"
              draggable={false}
            />
            <span className="absolute bottom-2 left-2 rounded-full bg-slate-950/80 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-300 backdrop-blur-sm border border-emerald-500/30">
              Optimal Hydration
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                Active Recovery Spotlight
              </span>
              <span className="h-1 w-1 rounded-full bg-emerald-400/50" />
              <span className="text-[10px] font-bold text-slate-400">Cellular Re-Charge</span>
            </div>
            <h4 className="text-sm font-black text-white">Sip Water · Steady Heart Rate</h4>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {restProfile.recoveryCue}
            </p>
          </div>
        </div>
      </section>

      {/* ----------------- GUIDED RECOVERY BREATH PACER ----------------- */}
      <section className="aurora-card relative overflow-hidden rounded-2xl p-4 border border-line bg-black/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-cyan-400" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Recovery Breathwork
            </span>
          </div>
          <span className="text-[10px] font-bold text-cyan-400/90">
            {restProfile.breathingGuide.technique}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-4">
          {/* Animated pulsing breath circle */}
          <div className="relative grid h-16 w-16 shrink-0 place-items-center">
            <motion.div
              animate={{
                scale: breathPhase === "inhale" ? [1, 1.35] : breathPhase === "hold" ? 1.35 : [1.35, 1],
                opacity: breathPhase === "hold" ? 0.9 : 0.65,
              }}
              transition={{
                duration:
                  breathPhase === "inhale"
                    ? restProfile.breathingGuide.inhaleSeconds
                    : breathPhase === "hold"
                    ? restProfile.breathingGuide.holdSeconds
                    : restProfile.breathingGuide.exhaleSeconds,
                ease: "easeInOut",
              }}
              className="absolute inset-0 rounded-full bg-cyan-400/25 blur-sm"
            />
            <div className="relative grid h-12 w-12 place-items-center rounded-full border border-cyan-400/50 bg-cyan-950/70 font-black text-cyan-300 shadow-inner">
              <span className="text-sm font-numeric font-extrabold">{breathCountdown}s</span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wider text-white">
              {breathPhase === "inhale" && "Inhale deeply through nose"}
              {breathPhase === "hold" && "Hold breath and relax shoulders"}
              {breathPhase === "exhale" && "Exhale slowly through mouth"}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {restProfile.recoveryCue}
            </p>
          </div>
        </div>
      </section>

      {/* ----------------- UP NEXT MOVEMENT PREVIEW ----------------- */}
      {previewExercise && (
        <section className="aurora-card relative overflow-hidden rounded-2xl p-4 border border-line bg-slate-900/60">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
              Up Next
            </span>
            <span className="text-[11px] font-extrabold text-white/70">
              {isNextExerciseDifferent
                ? `Set 1 of ${previewExercise.sets || totalNextSets}`
                : `Set ${nextSetNumber} of ${totalSets}`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950">
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
              <h4 className="text-sm font-black text-white truncate">
                {previewExercise.name}
              </h4>
              <p className="text-[11px] font-semibold text-slate-400 truncate">
                {previewExercise.targetMuscle} ·{" "}
                {previewExercise.durationSeconds > 0
                  ? `${previewExercise.durationSeconds}s`
                  : `${previewExercise.reps} reps`}
              </p>
              {previewExercise.description && (
                <p className="mt-1 line-clamp-1 text-[10px] font-medium text-emerald-300/90 italic">
                  💡 Form: {previewExercise.description}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ----------------- PLAY STORE COMPETITIVE UTILITIES ----------------- */}
      <section className="grid grid-cols-2 gap-2.5">
        {/* Quick Hydration Logger */}
        <motion.button
          type="button"
          onClick={handleLogWater}
          whileTap={{ scale: 0.96 }}
          className="relative flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-950/30 p-3 text-left hover:bg-blue-950/50"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-500/20 text-blue-400">
            <Droplets className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300">
              Quick Sip
            </p>
            <p className="text-xs font-black text-white truncate">
              +1 Glass 💧 ({waterGlasses}/8)
            </p>
          </div>
          <AnimatePresence>
            {waterLoggedToast && (
              <motion.span
                initial={{ opacity: 0, scale: 0.5, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: -16 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute right-2 -top-2 rounded-full bg-blue-400 px-2 py-0.5 text-[9px] font-black text-slate-950 shadow"
              >
                +250ml Logged!
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Readiness Check */}
        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Current Fatigue
          </p>
          <div className="mt-1.5 flex gap-1">
            {(
              [
                { id: "ready", label: "Fresh", color: "bg-emerald-500 text-slate-950" },
                { id: "steady", label: "Good", color: "bg-amber-400 text-slate-950" },
                { id: "heavy", label: "Tired", color: "bg-rose-500 text-white" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setReadiness(item.id)}
                className={`flex-1 rounded-lg py-1 text-[10px] font-black transition-all ${
                  readiness === item.id ? item.color : "bg-white/5 text-white/50 hover:bg-white/10"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
