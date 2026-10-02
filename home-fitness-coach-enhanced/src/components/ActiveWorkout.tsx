import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Clipboard,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Share2,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import type { UserProfile, Workout, WorkoutLog } from "../types";
import { audio } from "../lib/audio";
import { estimateCaloriesBurned } from "../lib/fitness";
import {
  celebrateFeedback,
  successFeedback,
  tapFeedback,
  warnFeedback,
} from "../lib/haptics";
import ExerciseThumb from "./ExerciseThumb";
import FlexCardSheet from "./FlexCardSheet";
import { sessionCard } from "../lib/flexCard";
import type { FigureGender } from "./HumanFigure";
import { readDemoGender, readDemoModel } from "../lib/demoPrefs";
import SessionPacing, { type PacingSegment } from "./SessionPacing";
import { MagneticButton, ProgressRing } from "./ui";
import { accent } from "../design/accents";
import {
  dialogVariants,
  scrimVariants,
  SPRING_BOUNCE,
  SPRING_SNAP,
  SPRING_WEIGHTED,
  staggerChild,
  staggerParent,
} from "../design/motion";
import { clock, ratio } from "../design/format";
import { useWakeLock } from "../hooks/useWakeLock";

interface ActiveWorkoutProps {
  workout: Workout;
  onBack: () => void;
  onLogWorkout: (log: WorkoutLog) => void;
  profile?: UserProfile;
}

type WorkoutState = "ready" | "active" | "rest" | "completed";

/** Rep-based moves have no duration of their own; this is their block. */
const REP_BLOCK_SECONDS = 45;

const FEELINGS: { value: WorkoutLog["feeling"]; emoji: string }[] = [
  { value: "Energetic", emoji: "💪" },
  { value: "Satisfied", emoji: "😊" },
  { value: "Tired", emoji: "🥱" },
  { value: "Sore", emoji: "🩹" },
  { value: "Exhausted", emoji: "🥵" },
];

/**
 * Active Workout — session mode.
 *
 * The timing engine, TTS cues, audio chimes and logging behaviour are
 * carried over intact; what changed is everything around them.
 *
 * The screen is built around one rule: while a set is running, exactly
 * one thing should be readable from two metres away, and that is the
 * clock. Everything else — form guidance, the up-next strip, the pacing
 * curve — is deliberately secondary in size, weight and contrast, and
 * rest states invert the emphasis because during a rest the question
 * changes from "how long left" to "what is coming".
 *
 * Three behavioural fixes over the previous version:
 *
 *  - A WAKE LOCK holds the screen on. A timer that dims mid-plank is a
 *    functional failure, not a cosmetic one.
 *  - `window.confirm()` is gone. It froze the timer thread, could not be
 *    styled, and on Android WebView renders as a system alert that looks
 *    like a crash. Replaced with an in-app dialog.
 *  - The mid-set progress bar now reflects the true elapsed fraction of
 *    the current block, which for rep-based moves the old version
 *    computed against a duration of zero and rendered as NaN.
 */
export default function ActiveWorkout({
  workout,
  onBack,
  onLogWorkout,
  profile,
}: ActiveWorkoutProps) {
  const reduced = useReducedMotion();

  const [gameState, setGameState] = useState<WorkoutState>("ready");
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSet, setCurrentSet] = useState(1);
  const [isMuted, setIsMuted] = useState(
    () => localStorage.getItem("kinetic_sound_muted") === "true",
  );
  const [totalSecondsActive, setTotalSecondsActive] = useState(0);
  const [feeling, setFeeling] = useState<WorkoutLog["feeling"]>("Satisfied");
  const [userNotes, setUserNotes] = useState("");
  const [caption, setCaption] = useState<string | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const figureGender: FigureGender = readDemoGender(profile?.gender);
  const demoModel = readDemoModel();

  const currentExercise = workout.exercises[currentExerciseIndex];
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleTimerExpiryRef = useRef<() => void>(() => {});

  const isRunning = gameState === "active" || gameState === "rest";
  useWakeLock(isRunning && !isPaused);

  /* ---------------------------------------------------------------- */
  /*  Timing engine — preserved from the previous build                */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    audio.setMute(isMuted);
    audio.playStartChime();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      audio.stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Depends only on whether a timer *should* be running — never on
  // `timeLeft` — so one interval ticks steadily instead of being torn
  // down and rebuilt every second, which is what caused drift before.
  useEffect(() => {
    const shouldRun = isRunning && !isPaused;

    if (shouldRun && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setTotalSecondsActive((prev) => prev + 1);
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerExpiryRef.current();
            return 0;
          }
          if (prev <= 4) audio.playTick();
          return prev - 1;
        });
      }, 1000);
    } else if (!shouldRun && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, isPaused]);

  useEffect(() => {
    if (gameState === "active" && currentExercise) {
      const displayReps =
        currentExercise.reps > 0
          ? `${currentExercise.reps} reps`
          : `${currentExercise.durationSeconds} seconds`;
      audio.speak(
        `Exercise ${currentExerciseIndex + 1}: ${currentExercise.name}. Set ${currentSet} of ${currentExercise.sets}. Target: ${displayReps}. Remember to: ${currentExercise.description.substring(0, 100)}`,
        { gender: figureGender },
      );
      setCaption(
        `${currentExercise.name} — set ${currentSet} of ${currentExercise.sets}. ${displayReps}.`,
      );
    } else if (gameState === "rest" && currentExercise) {
      const nextName =
        currentSet < currentExercise.sets
          ? currentExercise.name
          : currentExerciseIndex + 1 < workout.exercises.length
            ? workout.exercises[currentExerciseIndex + 1].name
            : "Workout complete";
      audio.speak(
        `Well done. Take a rest for ${timeLeft} seconds. Next up: ${nextName}`,
        { gender: figureGender },
      );
      setCaption(`Nice work — rest up. Next: ${nextName}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, currentExerciseIndex, currentSet]);

  const blockSeconds = (index: number) => {
    const ex = workout.exercises[index];
    if (!ex) return REP_BLOCK_SECONDS;
    return ex.durationSeconds > 0 ? ex.durationSeconds : REP_BLOCK_SECONDS;
  };

  const startWorkoutSession = () => {
    if (workout.exercises.length === 0) return;
    tapFeedback();
    setGameState("active");
    setCurrentExerciseIndex(0);
    setCurrentSet(1);
    setTimeLeft(blockSeconds(0));
    setIsPaused(false);
  };

  const handleTimerExpiry = () => {
    if (gameState === "active") {
      successFeedback();
      audio.playRestStart();
      if (currentExercise.restSeconds > 0) {
        setGameState("rest");
        setTimeLeft(currentExercise.restSeconds);
      } else {
        advanceWorkoutFlow();
      }
    } else if (gameState === "rest") {
      audio.playStartChime();
      advanceWorkoutFlow();
    }
  };

  useEffect(() => {
    handleTimerExpiryRef.current = handleTimerExpiry;
  });

  const advanceWorkoutFlow = () => {
    if (currentSet < currentExercise.sets) {
      setCurrentSet((prev) => prev + 1);
      setGameState("active");
      setTimeLeft(blockSeconds(currentExerciseIndex));
    } else if (currentExerciseIndex + 1 < workout.exercises.length) {
      setCurrentExerciseIndex((prev) => prev + 1);
      setCurrentSet(1);
      setGameState("active");
      setTimeLeft(blockSeconds(currentExerciseIndex + 1));
    } else {
      completeWorkoutSession();
    }
  };

  const skipCurrentExercise = () => {
    tapFeedback();
    audio.stopSpeaking();
    if (currentExerciseIndex + 1 < workout.exercises.length) {
      setCurrentExerciseIndex((prev) => prev + 1);
      setCurrentSet(1);
      setGameState("active");
      setTimeLeft(blockSeconds(currentExerciseIndex + 1));
      audio.playStartChime();
    } else {
      completeWorkoutSession();
    }
  };

  const completeWorkoutSession = () => {
    setGameState("completed");
    celebrateFeedback();
    audio.playSuccessChime();
    audio.speak(
      "Fantastic effort! You've successfully finished your training routine. Log your workout to lock in your daily streak!",
      { gender: figureGender },
    );
  };

  const toggleMute = () => {
    tapFeedback();
    const muted = audio.toggleMute();
    setIsMuted(muted);
    localStorage.setItem("kinetic_sound_muted", String(muted));
  };

  const minutesElapsed = Math.max(1, Math.round(totalSecondsActive / 60));
  const estimatedBurn = estimateCaloriesBurned(
    minutesElapsed,
    workout.targetArea,
  );

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogWorkout({
      id: `log_${Date.now()}`,
      workoutId: workout.id,
      workoutTitle: workout.workoutTitle,
      completedAt: new Date().toISOString(),
      durationMinutes: minutesElapsed,
      exercisesCompleted: workout.exercises.length,
      feeling,
      userNotes: userNotes.trim() || undefined,
      estimatedCaloriesBurned: estimatedBurn,
    });
  };

  /* ---------------------------------------------------------------- */
  /*  Derived session geometry                                         */
  /* ---------------------------------------------------------------- */

  /** The full planned timeline, used by the pacing curve. */
  const segments = useMemo<PacingSegment[]>(() => {
    const out: PacingSegment[] = [];
    workout.exercises.forEach((ex, i) => {
      const work = ex.durationSeconds > 0 ? ex.durationSeconds : REP_BLOCK_SECONDS;
      const sets = Math.max(1, ex.sets);
      for (let s = 0; s < sets; s++) {
        out.push({ kind: "work", seconds: work, exercise: i });
        const isFinalBlock = i === workout.exercises.length - 1 && s === sets - 1;
        if (ex.restSeconds > 0 && !isFinalBlock) {
          out.push({ kind: "rest", seconds: ex.restSeconds, exercise: i });
        }
      }
    });
    return out;
  }, [workout]);

  /** Planned seconds consumed so far — where the playhead sits. */
  const plannedElapsed = useMemo(() => {
    let total = 0;
    for (let i = 0; i < currentExerciseIndex; i++) {
      const ex = workout.exercises[i];
      const sets = Math.max(1, ex.sets);
      total +=
        sets * (ex.durationSeconds > 0 ? ex.durationSeconds : REP_BLOCK_SECONDS) +
        sets * (ex.restSeconds || 0);
    }
    if (currentExercise) {
      const work = blockSeconds(currentExerciseIndex);
      total += (currentSet - 1) * (work + (currentExercise.restSeconds || 0));
      total +=
        gameState === "rest"
          ? work + Math.max(0, currentExercise.restSeconds - timeLeft)
          : Math.max(0, work - timeLeft);
    }
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExerciseIndex, currentSet, gameState, timeLeft, workout]);

  /** Fraction of the *current* block consumed. Guarded against the
   *  zero-duration case that previously produced NaN for rep moves. */
  const blockProgress = (() => {
    if (!currentExercise) return 0;
    const span =
      gameState === "rest"
        ? currentExercise.restSeconds
        : blockSeconds(currentExerciseIndex);
    return ratio(span - timeLeft, span);
  })();

  const isRest = gameState === "rest";
  const tone = isRest ? "emerald" : "cyan";
  const toneTokens = accent(tone);
  const movesLeft = workout.exercises.length - currentExerciseIndex - 1;

  /* ---------------------------------------------------------------- */

  return (
    <div
      id="active-workout-view"
      className="session-surface relative min-h-[100dvh] w-full"
      style={{ ["--glow" as string]: toneTokens.color }}
    >
      {/* Primary ambient field — large, slow colour-shifting orb.
          The whole screen feels like it breathes a different colour on
          each state change, registering peripherally before the copy does. */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[65vh]"
        animate={{
          background: `radial-gradient(ellipse 90% 70% at 50% 0%, color-mix(in srgb, ${toneTokens.color} 16%, transparent) 0%, transparent 70%)`,
        }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />

      {/* Secondary ambient orb — bottom edge, slower animation for depth */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[40vh]"
        animate={{
          background: `radial-gradient(ellipse 70% 50% at 50% 100%, color-mix(in srgb, ${toneTokens.color} 7%, transparent) 0%, transparent 70%)`,
        }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
      />

      <div className="mx-auto w-full max-w-3xl px-5 pb-8 sm:px-6">
        <AnimatePresence mode="wait">
          {/* ==================== READY ==================== */}
          {gameState === "ready" && (
            <motion.div
              key="ready"
              variants={staggerParent}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5 pb-28"
              style={{ paddingTop: "calc(var(--safe-t) + 20px)" }}
            >
              <motion.div variants={staggerChild}>
                <MagneticButton
                  size="md"
                  variant="ghost"
                  tone="neutral"
                  id="btn-cancel-ready"
                  onClick={onBack}
                  className="border border-line"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </MagneticButton>
              </motion.div>

              <motion.header variants={staggerChild} className="space-y-3">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em]"
                  style={{
                    background: "var(--cyan-wash)",
                    color: "var(--cyan)",
                  }}
                >
                  Ready to train
                </span>
                <h1 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-4xl">
                  {workout.workoutTitle}
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-ink-3">
                  {workout.workoutDescription}
                </p>
              </motion.header>

              <motion.div
                variants={staggerChild}
                className="aurora-card grain relative overflow-hidden rounded-xl2 p-5"
                style={{ ["--glow" as string]: "var(--cyan)" }}
              >
                {/* Subtle orb in corner of session shape card */}
                <div
                  aria-hidden
                  className="ambient-orb pointer-events-none"
                  style={{
                    width: 140,
                    height: 140,
                    top: -40,
                    right: -30,
                    background: "radial-gradient(circle, var(--neon-cyan-near) 0%, transparent 70%)",
                    animationDelay: "-1s",
                    animationDuration: "9s",
                  }}
                />
                <p className="eyebrow relative z-10">Session shape</p>
                <div className="relative z-10 mt-3">
                  <SessionPacing segments={segments} elapsed={0} height={52} />
                </div>
                <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
                  <Spec label="Duration" value={`${workout.totalDurationMinutes} min`} />
                  <Spec label="Focus" value={workout.targetArea} />
                  <Spec
                    label="Equipment"
                    value={workout.equipmentNeeded.join(", ") || "Bodyweight"}
                  />
                  <Spec
                    label="Movements"
                    value={`${workout.exercises.length}`}
                  />
                </div>
              </motion.div>

              <motion.section variants={staggerChild} className="space-y-2.5">
                <p className="eyebrow">
                  Sequence · {workout.exercises.length} moves
                </p>
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {workout.exercises.map((ex, i) => (
                    <li
                      key={`${ex.name}-${i}`}
                      className="surface flex items-center gap-3 rounded-lg2 p-2.5"
                    >
                      <span className="relative shrink-0">
                        <ExerciseThumb
                          name={ex.name}
                          targetMuscle={ex.targetMuscle}
                          gender={figureGender}
                          model={demoModel}
                          size={48}
                          still
                        />
                        <span
                          className="font-numeric absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-extrabold"
                          style={{
                            background: "var(--cyan)",
                            color: "var(--void)",
                            boxShadow: "0 0 0 2px var(--carbon)",
                          }}
                        >
                          {i + 1}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink">
                          {ex.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-ink-4">
                          {ex.sets} sets ·{" "}
                          {ex.durationSeconds > 0
                            ? `${ex.durationSeconds}s`
                            : `${ex.reps} reps`}
                          {ex.restSeconds > 0 ? ` · ${ex.restSeconds}s rest` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.section>

              <motion.aside
                variants={staggerChild}
                className="flex gap-3 rounded-lg2 border p-4"
                style={{
                  background: "var(--gold-wash)",
                  borderColor: "color-mix(in srgb, var(--gold) 26%, transparent)",
                }}
              >
                <AlertTriangle
                  className="h-4 w-4 shrink-0"
                  style={{ color: "var(--gold)" }}
                />
                <div className="min-w-0">
                  <p
                    className="text-[10px] font-extrabold uppercase tracking-[0.14em]"
                    style={{ color: "var(--gold)" }}
                  >
                    Coach reminders
                  </p>
                  <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-2">
                    {workout.coachingTips?.length ? (
                      workout.coachingTips.map((tip, i) => (
                        <li key={i}>· {tip}</li>
                      ))
                    ) : (
                      <>
                        <li>· Listen to your body — never push through joint pain.</li>
                        <li>· Stay hydrated and land lightly during jumps.</li>
                      </>
                    )}
                  </ul>
                </div>
              </motion.aside>

              <motion.button
                variants={staggerChild}
                type="button"
                id="btn-toggle-sound-ready"
                onClick={toggleMute}
                className="inline-flex items-center gap-2 text-[11px] font-semibold text-ink-3 transition-colors hover:text-ink"
              >
                {isMuted ? (
                  <VolumeX className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
                {isMuted
                  ? "Sound muted — chimes and voice off"
                  : "Vocal coach active — voice form guidance"}
              </motion.button>
            </motion.div>
          )}

          {/* ==================== ACTIVE / REST ==================== */}
          {isRunning && currentExercise && (
            <motion.div
              key="running"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.01 }}
              transition={SPRING_WEIGHTED}
              className="space-y-5"
              style={{ paddingTop: "calc(var(--safe-t) + 16px)" }}
            >
              <header className="flex items-center justify-between gap-3">
                <MagneticButton
                  size="sm"
                  variant="soft"
                  tone="crimson"
                  id="btn-quit-session"
                  onClick={() => {
                    warnFeedback();
                    setConfirmQuit(true);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  End
                </MagneticButton>

                <div className="font-numeric flex items-center gap-1.5 text-[11px] font-bold text-ink-3">
                  <span style={{ color: toneTokens.color }}>
                    {String(currentExerciseIndex + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ink-4">
                    / {String(workout.exercises.length).padStart(2, "0")}
                  </span>
                </div>

                <MagneticButton
                  size="sm"
                  variant="ghost"
                  tone="neutral"
                  id="btn-active-toggle-sound"
                  onClick={toggleMute}
                  className="border border-line"
                >
                  {isMuted ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  {isMuted ? "Muted" : "Voice"}
                </MagneticButton>
              </header>

              {/* ---------- THE DEMO ----------
                  Above the clock, deliberately.

                  This used to sit below the timer, the controls and the
                  pacing curve, roughly 700px down a 780px viewport — so
                  the one thing that shows you HOW to do the movement you
                  are currently doing could only be reached by scrolling
                  away from the countdown telling you how long is left.
                  Mid-set, with a phone on the floor, that demo may as well
                  not have existed. The clock lost 52px of ring to make
                  room; it is still the largest thing on the screen. */}
              <section
                className="aurora-card neon-border relative overflow-hidden rounded-xl2"
                style={{ ["--glow" as string]: toneTokens.color }}
              >
                {/* Demo card ambient orb that shifts with state */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full"
                  animate={{
                    background: `radial-gradient(circle, color-mix(in srgb, ${toneTokens.color} 18%, transparent) 0%, transparent 70%)`,
                  }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                  style={{ filter: "blur(20px)" }}
                />
                <div className="relative h-52 w-full sm:h-60">
                  <ExerciseThumb
                    name={currentExercise.name}
                    targetMuscle={currentExercise.targetMuscle}
                    gender={figureGender}
                    model={demoModel}
                    emphasized
                    intense={gameState === "active" && !isPaused}
                    // The demo freezes with the clock. A figure still
                    // repping away under a paused timer is the kind of
                    // detail that quietly tells a user the screen is
                    // decorative rather than connected to their session.
                    paused={isPaused}
                    tone={isRest ? "emerald" : "cyan"}
                    showCue
                    fill
                  />
                </div>
              </section>

              {/* ---------- THE CLOCK ---------- */}
              <section className="relative grid place-items-center py-2">
                <ProgressRing
                  value={blockProgress}
                  size={248}
                  thickness={5}
                  tone={tone}
                  gap={0.22}
                  glow
                  animate={false}
                  className="max-w-full"
                  label={`${Math.round(blockProgress * 100)}% of the current block complete`}
                >
                  <div className="flex flex-col items-center">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={isRest ? "rest" : "work"}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="text-[10px] font-extrabold uppercase tracking-[0.2em]"
                        style={{ color: toneTokens.color }}
                      >
                        {isRest ? "Recover" : `Set ${currentSet} of ${currentExercise.sets}`}
                      </motion.span>
                    </AnimatePresence>

                    {/* Tabular figures and a fixed width: the clock must
                        not shift horizontally as digits change, which is
                        the single most noticeable cheapness tell there is
                        in a workout timer. */}
                    <span
                      className="font-numeric mt-1.5 block text-[62px] font-extrabold leading-[0.9] tracking-[-0.055em] text-ink tabular-nums sm:text-[72px]"
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        textShadow: isPaused
                          ? "none"
                          : [
                              `0 0 40px color-mix(in srgb, ${toneTokens.color} 40%, transparent)`,
                              `0 0 80px color-mix(in srgb, ${toneTokens.color} 20%, transparent)`,
                              `0 2px 0 color-mix(in srgb, ${toneTokens.color} 10%, transparent)`,
                            ].join(", "),
                      }}
                      aria-live="off"
                    >
                      {clock(timeLeft)}
                    </span>

                    <motion.span
                      animate={{ opacity: isPaused ? 1 : 0.85 }}
                      className="mt-1.5 max-w-[190px] truncate text-center text-xs font-bold text-ink-2"
                    >
                      {isPaused
                        ? "Paused"
                        : isRest
                          ? currentExerciseIndex + 1 < workout.exercises.length
                            ? `Next: ${workout.exercises[currentExerciseIndex + 1].name}`
                            : "Final stretch"
                          : currentExercise.name}
                    </motion.span>

                    {!isRest && currentExercise.reps > 0 && (
                      <span
                        className="mt-2.5 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold"
                        style={{
                          background: toneTokens.wash,
                          color: toneTokens.color,
                        }}
                      >
                        {currentExercise.reps} reps
                      </span>
                    )}
                  </div>
                </ProgressRing>

                {/* Countdown pulse rings — triple ring at ≤5s for urgency.
                    Each ring uses a different delay so they stagger outward
                    rather than firing simultaneously. */}
                {!isPaused && timeLeft <= 5 && timeLeft > 0 && !reduced && (
                  <>
                    <motion.span
                      key={`pulse1-${timeLeft}`}
                      aria-hidden
                      className="pointer-events-none absolute inset-0 m-auto h-[248px] w-[248px] rounded-full"
                      style={{ border: `2px solid ${toneTokens.color}` }}
                      initial={{ opacity: 0.65, scale: 0.92 }}
                      animate={{ opacity: 0, scale: 1.2 }}
                      transition={{ duration: 1.1, ease: "easeOut" }}
                    />
                    {timeLeft <= 3 && (
                      <motion.span
                        key={`pulse2-${timeLeft}`}
                        aria-hidden
                        className="pointer-events-none absolute inset-0 m-auto h-[248px] w-[248px] rounded-full"
                        style={{ border: `1px solid ${toneTokens.color}` }}
                        initial={{ opacity: 0.4, scale: 0.98 }}
                        animate={{ opacity: 0, scale: 1.35 }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: 0.08 }}
                      />
                    )}
                  </>
                )}
              </section>

              {/* ---------- CONTROLS ---------- */}
              <section className="flex items-center justify-center gap-4">
                <TactileControl
                  label="Reset timer"
                  id="btn-timer-reset"
                  onClick={() => {
                    tapFeedback();
                    setTimeLeft(
                      isRest
                        ? currentExercise.restSeconds
                        : blockSeconds(currentExerciseIndex),
                    );
                  }}
                >
                  <RotateCcw className="h-5 w-5" />
                </TactileControl>

                <motion.button
                  type="button"
                  id="btn-timer-play-pause"
                  aria-label={isPaused ? "Resume" : "Pause"}
                  onClick={() => {
                    tapFeedback();
                    setIsPaused((p) => !p);
                  }}
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  transition={SPRING_SNAP}
                  className="grid h-[72px] w-[72px] place-items-center rounded-full"
                  style={{
                    background: isPaused ? "var(--ink)" : toneTokens.color,
                    color: "var(--void)",
                    boxShadow: `0 14px 40px -12px ${
                      isPaused ? "var(--ink-3)" : toneTokens.color
                    }`,
                  }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={isPaused ? "play" : "pause"}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={SPRING_BOUNCE}
                      className="grid place-items-center"
                    >
                      {isPaused ? (
                        <Play className="h-7 w-7 translate-x-0.5 fill-current" />
                      ) : (
                        <Pause className="h-7 w-7 fill-current" />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>

                <TactileControl
                  label="Skip to next exercise"
                  id="btn-timer-skip"
                  onClick={skipCurrentExercise}
                >
                  <SkipForward className="h-5 w-5" />
                </TactileControl>
              </section>

              {/* ---------- PACING ---------- */}
              <section className="surface rounded-xl2 px-4 py-3.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="eyebrow">Session pace</p>
                  <p className="font-numeric text-[11px] font-bold text-ink-3">
                    {movesLeft > 0 ? `${movesLeft} moves left` : "Final move"}
                  </p>
                </div>
                <SessionPacing
                  segments={segments}
                  elapsed={plannedElapsed}
                  tone={tone}
                  height={46}
                />
              </section>

              {/* ---------- FORM GUIDE ---------- */}
              <section className="grid grid-cols-[minmax(0,1fr)] gap-4">
                <div className="surface rounded-xl2 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em]"
                      style={{ color: toneTokens.color }}
                    >
                      <Clipboard className="h-3.5 w-3.5" />
                      Form guide
                    </span>
                    <MagneticButton
                      size="sm"
                      variant="ghost"
                      tone="neutral"
                      className="border border-line"
                      aria-label="Replay voice cue"
                      onClick={() =>
                        audio.speak(
                          `${currentExercise.name}. ${currentExercise.description}`,
                          { gender: figureGender },
                        )
                      }
                    >
                      <Volume2 className="h-3 w-3" />
                      Replay
                    </MagneticButton>
                  </div>

                  <h3 className="font-display mt-3 text-lg font-extrabold tracking-tight text-ink">
                    {currentExercise.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-3">
                    {currentExercise.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3.5">
                    <span className="rounded-md2 border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-2">
                      {currentExercise.targetMuscle}
                    </span>
                    {!isMuted && caption && (
                      <span
                        className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-semibold"
                        style={{ color: toneTokens.color }}
                      >
                        <VoiceBars color={toneTokens.color} />
                        <span className="truncate">{caption}</span>
                      </span>
                    )}
                  </div>
                </div>
              </section>

              {/* ---------- UP NEXT ---------- */}
              {currentExerciseIndex + 1 < workout.exercises.length && (
                <section className="rail -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
                  {workout.exercises
                    .slice(currentExerciseIndex + 1, currentExerciseIndex + 6)
                    .map((ex, i) => (
                      <span
                        key={`${ex.name}-${i}`}
                        className="surface flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3.5"
                      >
                        <span className="font-numeric grid h-6 w-6 place-items-center rounded-full bg-[var(--graphite)] text-[10px] font-extrabold text-ink-3">
                          {String(currentExerciseIndex + i + 2).padStart(2, "0")}
                        </span>
                        <span className="whitespace-nowrap text-[11px] font-bold text-ink-2">
                          {ex.name}
                        </span>
                      </span>
                    ))}
                </section>
              )}
            </motion.div>
          )}

          {/* ==================== COMPLETED ==================== */}
          {gameState === "completed" && (
            <motion.div
              key="completed"
              variants={staggerParent}
              initial="initial"
              animate="animate"
              className="mx-auto max-w-xl space-y-6 pb-10"
              style={{ paddingTop: "calc(var(--safe-t) + 32px)" }}
              id="completed-survey-view"
            >
              <motion.div variants={staggerChild} className="text-center">
                <span className="relative mx-auto block h-24 w-24">
                  {/* Two rings breaking outward from the badge. The screen
                      is the only genuine reward the app has to give, so it
                      is worth one deliberate beat of celebration before
                      the form asks for anything. */}
                  {!reduced &&
                    [0, 0.45].map((delay) => (
                      <motion.span
                        key={delay}
                        aria-hidden
                        className="absolute inset-0 rounded-full"
                        style={{ border: "2px solid var(--emerald)" }}
                        initial={{ opacity: 0.5, scale: 0.75 }}
                        animate={{ opacity: 0, scale: 1.75 }}
                        transition={{ duration: 1.5, delay: 0.25 + delay, ease: "easeOut" }}
                      />
                    ))}
                  <motion.span
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ ...SPRING_BOUNCE, delay: 0.1 }}
                    className="absolute inset-2 grid place-items-center rounded-full"
                    style={{
                      background: "var(--emerald-wash)",
                      color: "var(--emerald)",
                      boxShadow: "0 0 60px -10px var(--emerald)",
                    }}
                  >
                    <Check className="h-9 w-9" strokeWidth={3} />
                  </motion.span>
                </span>

                <p
                  className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.2em]"
                  style={{ color: "var(--emerald)" }}
                >
                  Routine finished
                </p>
                <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                  Session complete
                </h1>
                <p className="mx-auto mt-2.5 max-w-[40ch] text-sm leading-relaxed text-ink-3">
                  You finished{" "}
                  <strong className="text-ink">{workout.workoutTitle}</strong>.
                  Log it to update your streak and statistics.
                </p>
              </motion.div>

              <motion.div
                variants={staggerChild}
                className="grid grid-cols-3 gap-2.5"
              >
                <Summary label="Active" value={`${minutesElapsed}`} unit="min" />
                <Summary
                  label="Movements"
                  value={`${workout.exercises.length}`}
                  unit="done"
                  tone="gold"
                />
                <Summary
                  label="Est. burn"
                  value={`${estimatedBurn}`}
                  unit="kcal"
                  tone="ember"
                  icon={Flame}
                />
              </motion.div>

              {/* Share sits ABOVE the log form, not after it.
                  The moment somebody is proudest of a session is the
                  second it ends — not after they have filled in a mood
                  picker and a notes field. Putting it behind the form
                  costs most of the intent, and it is deliberately a ghost
                  button so it never competes with Save log, which is the
                  action that actually keeps their streak alive. */}
              <motion.div variants={staggerChild}>
                <MagneticButton
                  type="button"
                  size="lg"
                  variant="ghost"
                  tone="cyan"
                  block
                  className="border border-line"
                  onClick={() => {
                    tapFeedback();
                    setShowShare(true);
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  Share this session
                </MagneticButton>
              </motion.div>

              <motion.form
                variants={staggerChild}
                onSubmit={handleLogSubmit}
                className="space-y-6 border-t border-line pt-6"
              >
                <fieldset>
                  <legend className="eyebrow mb-3">How did that feel?</legend>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FEELINGS.map((f) => {
                      const on = feeling === f.value;
                      return (
                        <motion.button
                          key={f.value}
                          type="button"
                          whileTap={{ scale: 0.94 }}
                          transition={SPRING_SNAP}
                          onClick={() => {
                            tapFeedback();
                            setFeeling(f.value);
                          }}
                          aria-pressed={on}
                          className="rounded-md2 border px-1 py-2.5 text-center text-[10px] font-bold leading-tight transition-colors"
                          style={{
                            borderColor: on
                              ? "color-mix(in srgb, var(--emerald) 50%, transparent)"
                              : "var(--line)",
                            background: on
                              ? "var(--emerald-wash)"
                              : "var(--graphite)",
                            color: on ? "var(--emerald)" : "var(--ink-3)",
                          }}
                        >
                          <span className="block text-lg" aria-hidden>
                            {f.emoji}
                          </span>
                          {/* Wraps instead of truncating. At five across on
                              a 360px phone "Exhausted" does not fit on one
                              line, and a clipped mood label reads as a
                              rendering fault rather than a tight fit. */}
                          <span className="mt-1 block">{f.value}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </fieldset>

                <div>
                  <label
                    htmlFor="session-notes"
                    className="eyebrow mb-2 block"
                  >
                    Training notes (optional)
                  </label>
                  <textarea
                    id="session-notes"
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    rows={3}
                    placeholder="Felt strong on push-ups, squats were smooth…"
                    className="w-full resize-none rounded-lg2 border border-line bg-[var(--graphite)] p-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-[color-mix(in_srgb,var(--emerald)_48%,transparent)]"
                  />
                </div>

                <div className="flex gap-3">
                  <MagneticButton
                    type="button"
                    size="xl"
                    variant="ghost"
                    tone="neutral"
                    block
                    id="btn-discard-log"
                    onClick={onBack}
                    className="border border-line"
                  >
                    Discard
                  </MagneticButton>
                  <MagneticButton
                    type="submit"
                    size="xl"
                    tone="emerald"
                    block
                    magnet={5}
                    id="btn-save-log"
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                    Save log
                  </MagneticButton>
                </div>
              </motion.form>

              {showShare && (
                <FlexCardSheet
                  data={sessionCard({
                    title: workout.workoutTitle,
                    minutes: minutesElapsed,
                    moves: workout.exercises.length,
                    calories: estimatedBurn,
                    focus: workout.targetArea,
                  })}
                  shareText={`${minutesElapsed} min · ${workout.workoutTitle}`}
                  onClose={() => setShowShare(false)}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky start bar — always one tap away no matter how long the
          routine's sequence list is. */}
      {gameState === "ready" && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          transition={SPRING_WEIGHTED}
          className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 px-5 pt-3.5 sm:px-6"
          style={{ paddingBottom: "calc(var(--safe-b) + 14px)" }}
        >
          <div className="mx-auto max-w-3xl">
            <MagneticButton
              size="xl"
              tone="cyan"
              block
              magnet={5}
              id="btn-begin-workout"
              disabled={workout.exercises.length === 0}
              onClick={startWorkoutSession}
            >
              <Play className="h-5 w-5 fill-current" />
              {workout.exercises.length === 0
                ? "No exercises available"
                : "Start workout"}
            </MagneticButton>
          </div>
        </motion.div>
      )}

      {/* In-app quit confirmation. Replaces window.confirm(), which froze
          the timer thread and rendered as an unstyled system alert. */}
      <AnimatePresence>
        {confirmQuit && (
          <div className="fixed inset-0 z-[120] grid place-items-center px-5">
            <motion.div
              variants={scrimVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={() => setConfirmQuit(false)}
              className="absolute inset-0 backdrop-blur-[3px]"
              style={{ background: "var(--scrim)" }}
            />
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="quit-title"
              variants={dialogVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="surface relative z-10 w-full max-w-sm rounded-xl2 p-6 text-center"
              style={{ background: "var(--carbon)" }}
            >
              <span
                className="mx-auto grid h-11 w-11 place-items-center rounded-full"
                style={{
                  background: "var(--crimson-wash)",
                  color: "var(--crimson)",
                }}
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <h2
                id="quit-title"
                className="font-display mt-4 text-lg font-extrabold text-ink"
              >
                End this session?
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-ink-3">
                Progress for this session won't be saved and your streak
                won't update.
              </p>
              <div className="mt-5 flex gap-3">
                <MagneticButton
                  size="lg"
                  variant="ghost"
                  tone="neutral"
                  block
                  className="border border-line"
                  onClick={() => setConfirmQuit(false)}
                >
                  Keep going
                </MagneticButton>
                <MagneticButton
                  size="lg"
                  tone="crimson"
                  block
                  onClick={() => {
                    setConfirmQuit(false);
                    onBack();
                  }}
                >
                  End session
                </MagneticButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow truncate">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-ink">{value}</p>
    </div>
  );
}

function Summary({
  label,
  value,
  unit,
  tone = "cyan",
  icon: Icon,
}: {
  label: string;
  value: string;
  unit: string;
  tone?: "cyan" | "ember" | "gold";
  icon?: typeof Flame;
}) {
  const t = accent(tone);
  return (
    <div className="surface relative overflow-hidden rounded-lg2 px-2 py-4 text-center">
      {/* Accent bloom behind the numeral. The three tiles carry the whole
          "you just did something" moment, so each one gets its own light
          rather than being a grey box with a coloured number in it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 mx-auto h-16 w-16 rounded-full opacity-45"
        style={{ background: t.color, filter: "blur(26px)" }}
      />
      <p
        className="font-numeric relative text-[26px] font-extrabold leading-none"
        style={{ color: t.color }}
      >
        {value}
      </p>
      <p className="relative mt-1.5 text-[10px] font-bold text-ink-4">{unit}</p>
      {/* The label sits under the number, and wraps rather than truncates.
          As an `eyebrow` above it, "Movements" and "Est. burn" both
          ellipsised to "MOVEME…" and "EST. B…" at 3-up on a phone. */}
      <p className="relative mt-2 flex items-center justify-center gap-1 text-[10px] font-bold leading-tight text-ink-3">
        {Icon && <Icon className="h-3 w-3 shrink-0" style={{ color: t.color }} />}
        {label}
      </p>
    </div>
  );
}

/**
 * Secondary session control.
 *
 * 56px, well past the 44px minimum — these are pressed with sweaty hands,
 * at arm's length, mid-set. Comfort beats compactness here.
 */
function TactileControl({
  label,
  children,
  onClick,
  id,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  id?: string;
}) {
  return (
    <motion.button
      type="button"
      id={id}
      aria-label={label}
      title={label}
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.06 }}
      transition={SPRING_SNAP}
      className="surface grid h-14 w-14 place-items-center rounded-full text-ink-3 transition-colors hover:text-ink"
    >
      {children}
    </motion.button>
  );
}

function VoiceBars({ color }: { color: string }) {
  return (
    <span className="flex shrink-0 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-full"
          style={{ background: color }}
          animate={{ height: [4, 10, 5, 8, 4] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.14,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}
