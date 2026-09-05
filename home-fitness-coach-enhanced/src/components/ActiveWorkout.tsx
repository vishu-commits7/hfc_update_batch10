import React, { useState, useEffect, useRef } from "react";
import { Workout, WorkoutLog, UserProfile } from "../types";
import { audio } from "../lib/audio";
import { estimateCaloriesBurned } from "../lib/fitness";
import Dumbbell3D from "./Dumbbell3D";
import ExerciseThumb from "./ExerciseThumb";
import { FigureGender } from "./HumanFigure";
import { readSavedRace } from "../lib/exercisePhotos";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Award, 
  ChevronRight, 
  Sparkles, 
  Flame, 
  Smile, 
  Clipboard, 
  Dumbbell, 
  Clock, 
  AlertCircle,
  TrendingUp,
  X
} from "lucide-react";

interface ActiveWorkoutProps {
  workout: Workout;
  onBack: () => void;
  onLogWorkout: (log: WorkoutLog) => void;
  profile?: UserProfile;
}

type WorkoutState = "ready" | "active" | "rest" | "completed";

export default function ActiveWorkout({ workout, onBack, onLogWorkout, profile }: ActiveWorkoutProps) {
  const [gameState, setGameState] = useState<WorkoutState>("ready");
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  const figureGender: FigureGender = (() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("kinetic_demo_gender") : null;
    if (saved === "male" || saved === "female" || saved === "neutral") return saved;
    if (profile?.gender === "male" || profile?.gender === "female") return profile.gender;
    return "male";
  })();
  const figureRace = readSavedRace(profile?.race);

  // Timer states
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSet, setCurrentSet] = useState(1);
  // Remember the user's mute preference across workouts instead of always
  // defaulting back to "sound on" every single session.
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem("kinetic_sound_muted") === "true");

  // Stats
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [totalSecondsActive, setTotalSecondsActive] = useState(0);

  // Completion/Survey state
  const [feeling, setFeeling] = useState<WorkoutLog["feeling"]>("Satisfied");
  const [userNotes, setUserNotes] = useState("");

  // Live caption of whatever the Vocal Coach is currently narrating —
  // makes the on-device speech genuinely visible on screen, not just
  // audible, and gives a graceful fallback caption when a device's TTS
  // voice is unavailable or its audio is routed elsewhere.
  const [caption, setCaption] = useState<string | null>(null);

  const currentExercise = workout.exercises[currentExerciseIndex];
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // handleTimerExpiry (defined below) closes over the latest exercise/set
  // state each render. It's stashed in a ref so the interval callback below
  // can always call the freshest version without needing to tear down and
  // recreate the interval every second (which previously happened because
  // `timeLeft` was a dependency of the timer effect, causing drift-prone
  // churn and unnecessary work on every single tick).
  const handleTimerExpiryRef = useRef<() => void>(() => {});

  // Initialize sounds on start
  useEffect(() => {
    // Apply the remembered mute preference before the first chime plays
    audio.setMute(isMuted);
    audio.playStartChime();
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      audio.stopSpeaking();
    };
  }, []);

  // Set up timer for active/rest. This effect now only depends on whether a
  // timer *should* be running (gameState + isPaused) — not on timeLeft — so
  // a single interval ticks steadily instead of being torn down and rebuilt
  // every second.
  useEffect(() => {
    const shouldRun = (gameState === "active" || gameState === "rest") && !isPaused;

    if (shouldRun && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setTotalSecondsActive(prev => prev + 1);
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimerExpiryRef.current();
            return 0;
          }

          // Play tick during countdown of last 3 seconds
          if (prev <= 4) {
            audio.playTick();
          }

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
  }, [gameState, isPaused]);

  // Handle TTS and announcement of exercises
  useEffect(() => {
    if (gameState === "active" && currentExercise) {
      const displayReps = currentExercise.reps > 0 ? `${currentExercise.reps} reps` : `${currentExercise.durationSeconds} seconds`;
      const cue = `Exercise ${currentExerciseIndex + 1}: ${currentExercise.name}. Set ${currentSet} of ${currentExercise.sets}. Target: ${displayReps}. Remember to: ${currentExercise.description.substring(0, 100)}`;
      audio.speak(cue, { gender: figureGender });
      setCaption(`"${currentExercise.name} — set ${currentSet} of ${currentExercise.sets}. ${displayReps}."`);
    } else if (gameState === "rest") {
      const nextName = currentSet < currentExercise.sets ? currentExercise.name :
        (currentExerciseIndex + 1 < workout.exercises.length ? workout.exercises[currentExerciseIndex + 1].name : "Workout complete");
      const restText = `Well done. Take a rest for ${timeLeft} seconds. Next up: ${nextName}`;
      audio.speak(restText, { gender: figureGender });
      setCaption(`"Nice work — rest up. Next: ${nextName}."`);
    }
  }, [gameState, currentExerciseIndex, currentSet]);

  const startWorkoutSession = () => {
    if (workout.exercises.length === 0) return;

    setStartTime(new Date());
    setGameState("active");
    setCurrentExerciseIndex(0);
    setCurrentSet(1);
    
    const firstEx = workout.exercises[0];
    setTimeLeft(firstEx.durationSeconds > 0 ? firstEx.durationSeconds : 45); // 45s default for rep based items
    setIsPaused(false);
  };

  const handleTimerExpiry = () => {
    if (gameState === "active") {
      // Completed a set!
      audio.playRestStart();
      if (currentExercise.restSeconds > 0) {
        setGameState("rest");
        setTimeLeft(currentExercise.restSeconds);
      } else {
        // No rest, immediately advance
        advanceWorkoutFlow();
      }
    } else if (gameState === "rest") {
      // Rest finished, move to next set or next exercise
      audio.playStartChime();
      advanceWorkoutFlow();
    }
  };

  useEffect(() => {
    handleTimerExpiryRef.current = handleTimerExpiry;
  });

  const advanceWorkoutFlow = () => {
    if (currentSet < currentExercise.sets) {
      // Move to next set of same exercise
      setCurrentSet(prev => prev + 1);
      setGameState("active");
      setTimeLeft(currentExercise.durationSeconds > 0 ? currentExercise.durationSeconds : 45);
    } else {
      // This exercise is complete! Move to next exercise
      if (currentExerciseIndex + 1 < workout.exercises.length) {
        setCurrentExerciseIndex(prev => prev + 1);
        setCurrentSet(1);
        setGameState("active");
        const nextEx = workout.exercises[currentExerciseIndex + 1];
        setTimeLeft(nextEx.durationSeconds > 0 ? nextEx.durationSeconds : 45);
      } else {
        // Workout fully completed!
        completeWorkoutSession();
      }
    }
  };

  const skipCurrentExercise = () => {
    audio.stopSpeaking();
    if (currentExerciseIndex + 1 < workout.exercises.length) {
      setCurrentExerciseIndex(prev => prev + 1);
      setCurrentSet(1);
      setGameState("active");
      const nextEx = workout.exercises[currentExerciseIndex + 1];
      setTimeLeft(nextEx.durationSeconds > 0 ? nextEx.durationSeconds : 45);
      audio.playStartChime();
    } else {
      completeWorkoutSession();
    }
  };

  const completeWorkoutSession = () => {
    setGameState("completed");
    audio.playSuccessChime();
    audio.speak("Fantastic effort! You've successfully finished your training routine. Log your workout to lock in your daily streak!", { gender: figureGender });
  };

  const toggleMute = () => {
    const muted = audio.toggleMute();
    setIsMuted(muted);
    localStorage.setItem("kinetic_sound_muted", String(muted));
  };

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const minutesElapsed = Math.max(1, Math.round(totalSecondsActive / 60));
    const estimatedBurn = estimateCaloriesBurned(minutesElapsed, workout.targetArea);

    const log: WorkoutLog = {
      id: `log_${Date.now()}`,
      workoutId: workout.id,
      workoutTitle: workout.workoutTitle,
      completedAt: new Date().toISOString(),
      durationMinutes: minutesElapsed,
      exercisesCompleted: workout.exercises.length,
      feeling,
      userNotes: userNotes.trim() || undefined,
      estimatedCaloriesBurned: estimatedBurn
    };

    onLogWorkout(log);
  };

  // Helper formatting for dynamic clock timer
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div 
      className="max-w-4xl mx-auto animate-fade-in w-full bg-[#090909] text-white p-5 sm:p-6" 
      id="active-workout-view"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
    >
      {/* 1. READY STATE: Briefing of routine */}
      {gameState === "ready" && (
        <div className="space-y-5 pb-24">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-bold text-white bg-white/10 hover:bg-white/20 px-4 py-2.5 rounded-full transition-all border border-white/10 shadow-md"
            id="btn-cancel-ready"
          >
            <X className="h-4 w-4 text-[#D4FF00]" /> Cancel & Exit
          </button>

          <div className="rounded-[32px] border border-white/10 bg-[#121212] p-5 sm:p-6 shadow-2xl overflow-hidden relative">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 bg-[#D4FF00]/5 rounded-full blur-2xl" />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D4FF00]/10 px-3 py-1 text-xs font-bold text-[#D4FF00]">
                  Ready for Training
                </span>
                <Dumbbell3D size={44} />
              </div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-white uppercase">
                {workout.workoutTitle}
              </h1>
              <p className="text-sm leading-relaxed text-white/60 max-w-2xl">
                {workout.workoutDescription}
              </p>
            </div>

            {/* Quick specifications panel */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/5">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] uppercase tracking-widest text-white/40 block">Total Est. Time</span>
                <span className="text-lg font-bold text-white mt-0.5 block">{workout.totalDurationMinutes} Min</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] uppercase tracking-widest text-white/40 block">Muscle Focus</span>
                <span className="text-lg font-bold text-white mt-0.5 block">{workout.targetArea}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] uppercase tracking-widest text-white/40 block">Gear Required</span>
                <span className="text-lg font-bold text-[#D4FF00] mt-0.5 block truncate">
                  {workout.equipmentNeeded.join(", ") || "Bodyweight"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] uppercase tracking-widest text-white/40 block">Routine Setup</span>
                <span className="text-lg font-bold text-white mt-0.5 block">{workout.exercises.length} Exercises</span>
              </div>
            </div>

            {/* Exercise Overview Stack — capped height with its own inner
                scroll so a long routine doesn't push the rest of the brief
                (and the Start button) far down the page. */}
            <div className="mt-5 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Exercise Sequence ({workout.exercises.length} moves)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:max-h-72 sm:overflow-y-auto sm:pr-1">
                {workout.exercises.map((ex, index) => (
                  <div key={index} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <div className="relative shrink-0">
                      <ExerciseThumb name={ex.name} gender={figureGender} race={figureRace} size={48} />
                      <div className="absolute -left-1.5 -top-1.5 w-5 h-5 rounded-full bg-[#D4FF00] flex items-center justify-center font-mono text-[10px] font-black text-black shadow ring-2 ring-[#121212]">
                        {index + 1}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{ex.name}</p>
                      <p className="text-xs text-white/40 truncate">
                        {ex.sets} sets • {ex.durationSeconds > 0 ? `${ex.durationSeconds}s` : `${ex.reps} reps`} {ex.restSeconds > 0 ? `| ${ex.restSeconds}s rest` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Safety tips brief */}
            <div className="mt-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold uppercase tracking-wider">Coach Safety Reminders</p>
                <ul className="list-disc pl-4 mt-1 space-y-1 text-amber-300/80">
                  {workout.coachingTips && workout.coachingTips.length > 0 ? (
                    workout.coachingTips.map((tip, idx) => <li key={idx}>{tip}</li>)
                  ) : (
                    <>
                      <li>Listen to your body. Do not push through physical joint pain.</li>
                      <li>Stay fully hydrated and land lightly on your feet during jumps.</li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            <button
              onClick={toggleMute}
              className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white"
              id="btn-toggle-sound-ready"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {isMuted ? "Sound is MUTED (Chimes & Voices disabled)" : "Vocal Coach is ACTIVE (Voice form guidance)"}
            </button>
          </div>
        </div>
      )}

      {/* Sticky Start bar — always one tap away, no scrolling required to
          find it regardless of how long the routine's exercise list is. */}
      {gameState === "ready" && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0c0c0c]/95 backdrop-blur-md px-5 py-3.5 sm:px-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
        >
          <div className="max-w-4xl mx-auto">
            <button
              onClick={startWorkoutSession}
              disabled={workout.exercises.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D4FF00] px-10 py-4 text-base font-black text-black shadow-xl hover:opacity-95 transform active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40"
              id="btn-begin-workout"
            >
              <Play className="h-5 w-5 fill-black" />
              {workout.exercises.length === 0 ? "NO EXERCISES AVAILABLE" : "START WORKOUT NOW"}
            </button>
          </div>
        </div>
      )}

      {/* 2. ACTIVE TIMER STATE */}
      {(gameState === "active" || gameState === "rest") && currentExercise && (
        <div className="space-y-6">
          {/* Header navigation with voice controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (confirm("Are you sure you want to stop this workout? Your progress for this session won't be saved.")) {
                  onBack();
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#FF4B4B] bg-red-500/10 hover:bg-red-500/20 px-4 py-2.5 rounded-full border border-red-500/15 transition-all shadow-md"
              id="btn-quit-session"
            >
              ← Terminate Workout
            </button>

            <button
              onClick={toggleMute}
              className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10"
              id="btn-active-toggle-sound"
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              {isMuted ? "Muted" : "Voice On"}
            </button>
          </div>

          {/* Vocal Coach live caption — makes the on-device narration
              visible as well as audible. */}
          {!isMuted && caption && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-[#D4FF00]/20 bg-[#D4FF00]/5 px-4 py-2.5 text-xs font-semibold text-[#D4FF00]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4FF00]/15">
                <span className="flex gap-[2px]">
                  <span className="h-2 w-[3px] animate-pulse rounded-full bg-[#D4FF00]" style={{ animationDelay: "0ms" }} />
                  <span className="h-3 w-[3px] animate-pulse rounded-full bg-[#D4FF00]" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-[3px] animate-pulse rounded-full bg-[#D4FF00]" style={{ animationDelay: "300ms" }} />
                </span>
              </span>
              <span className="truncate">Vocal Coach: {caption}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Primary Clock display panel */}
            <div className="lg:col-span-2 rounded-[32px] border border-white/10 bg-[#121212] p-6 shadow-2xl flex flex-col justify-between relative overflow-hidden">
              {/* Background Status Pulse */}
              <div className={`absolute top-0 right-0 -mr-24 -mt-24 h-64 w-64 rounded-full blur-3xl transition-colors duration-500 ${
                gameState === "rest" ? "bg-emerald-500/10" : "bg-[#D4FF00]/10"
              }`} />

              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold block">Current Active Block</span>
                  <span className="text-xs font-bold text-white mt-1 block">
                    Exercise {currentExerciseIndex + 1} of {workout.exercises.length}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-widest text-[#D4FF00] font-bold block">Interval Set</span>
                  <span className="text-sm font-bold text-white mt-1 block">
                    Set {currentSet} of {currentExercise.sets}
                  </span>
                </div>
              </div>

              {/* Big Stopwatch Display */}
              <div className="relative z-10 my-5 text-center flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">
                  {gameState === "rest" ? "🧘 REST / PREPARE" : `⚡ PERFORM: ${currentExercise.name.toUpperCase()}`}
                </span>

                <div className="font-sans text-8xl font-black italic tracking-tighter text-white select-none leading-none drop-shadow-sm">
                  {formatTime(timeLeft)}
                </div>

                {/* Subtext info (Reps or Duration) */}
                {gameState === "active" && (
                  <div className="mt-4">
                    {currentExercise.reps > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D4FF00]/10 px-4 py-1 text-sm font-extrabold text-[#D4FF00]">
                        🎯 Do {currentExercise.reps} Repetitions
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-4 py-1 text-xs text-white/60">
                        Timer-based execution
                      </span>
                    )}
                  </div>
                )}

                {gameState === "rest" && (
                  <div className="mt-4">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                      Up Next: {currentExerciseIndex + 1 < workout.exercises.length ? workout.exercises[currentExerciseIndex + 1].name : "Finish Block"}
                    </span>
                  </div>
                )}
              </div>

              {/* Controls bar */}
              <div className="relative z-10 flex items-center justify-center gap-4 mt-4 pt-6 border-t border-white/5">
                {/* Reset clock */}
                <button
                  onClick={() => setTimeLeft(currentExercise.durationSeconds > 0 ? currentExercise.durationSeconds : 45)}
                  className="p-3.5 rounded-xl border border-white/5 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                  title="Reset timer"
                  id="btn-timer-reset"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>

                {/* Play / Pause Toggle */}
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className={`p-5 rounded-2xl text-black shadow-lg hover:scale-105 active:scale-95 transition-all ${
                    isPaused ? "bg-white" : "bg-[#D4FF00]"
                  }`}
                  title={isPaused ? "Resume" : "Pause"}
                  id="btn-timer-play-pause"
                >
                  {isPaused ? <Play className="h-6 w-6 fill-black" /> : <Pause className="h-6 w-6 fill-black" />}
                </button>

                {/* Skip Exercise */}
                <button
                  onClick={skipCurrentExercise}
                  className="p-3.5 rounded-xl border border-white/5 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                  title="Skip forward"
                  id="btn-timer-skip"
                >
                  <SkipForward className="h-5 w-5" />
                </button>
              </div>

              {/* Progress bar at bottom of card */}
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/5">
                <div 
                  className={`h-full transition-all duration-1000 ${
                    gameState === "rest" ? "bg-emerald-500" : "bg-[#D4FF00]"
                  }`}
                  style={{ 
                    width: `${
                      gameState === "rest" 
                        ? ((currentExercise.restSeconds - timeLeft) / currentExercise.restSeconds) * 100 
                        : (((currentExercise.durationSeconds > 0 ? currentExercise.durationSeconds : 45) - timeLeft) / (currentExercise.durationSeconds > 0 ? currentExercise.durationSeconds : 45)) * 100
                    }%` 
                  }}
                />
              </div>
            </div>

            {/* Side instructions / Coaching cue panel */}
            <div className="space-y-4">
              {/* Form/Posture guidelines — the photo demo is now the big,
                  full-width centerpiece of this panel instead of a small
                  128px icon, with an extra-bright neon glow while the set
                  is actively running. */}
              <div className="rounded-[24px] border border-white/5 bg-[#121212] p-5 shadow-xl space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[#D4FF00]">
                    <Clipboard className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Proper Form Guide</span>
                  </div>
                  <button
                    onClick={() => audio.speak(`${currentExercise.name}. ${currentExercise.description}`, { gender: figureGender })}
                    aria-label="Replay voice cue"
                    className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] font-bold text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    <Volume2 className="h-3 w-3" /> Replay
                  </button>
                </div>

                <div className="relative h-56 w-full sm:h-64">
                  <ExerciseThumb name={currentExercise.name} gender={figureGender} race={figureRace} emphasized intense={gameState === "active"} fill />
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-white text-lg tracking-tight">
                    {currentExercise.name}
                  </h4>
                  <p className="text-sm text-white/60 leading-relaxed">
                    {currentExercise.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white bg-white/5 border border-white/5 px-2.5 py-1 rounded-md inline-block">
                    {currentExercise.targetMuscle}
                  </span>
                  <span className="text-[10px] text-white/40 shrink-0">
                    {workout.exercises.length - currentExerciseIndex - 1} moves left
                  </span>
                </div>
              </div>

              {/* Next Sequence — a slim horizontal strip instead of a
                  separate full-height card, so upcoming moves stay visible
                  without adding another whole screen's worth of scroll. */}
              {currentExerciseIndex + 1 < workout.exercises.length && (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                  {workout.exercises.slice(currentExerciseIndex + 1, currentExerciseIndex + 5).map((ex, idx) => (
                    <div key={idx} className="flex shrink-0 items-center gap-2 rounded-full bg-white/5 border border-white/5 pl-1 pr-3.5 py-1 opacity-60">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 font-mono text-[10px] font-bold text-[#D4FF00]">
                        {(currentExerciseIndex + idx + 2).toString().padStart(2, "0")}
                      </div>
                      <p className="whitespace-nowrap text-xs font-bold text-white">{ex.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. WORKOUT COMPLETED SURVEY/SUBMIT STATE */}
      {gameState === "completed" && (
        <div className="rounded-[32px] border border-white/10 bg-[#121212] p-8 shadow-2xl relative overflow-hidden" id="completed-survey-view">
          <div className="absolute right-0 top-0 -mr-24 -mt-24 h-64 w-64 bg-emerald-500/10 rounded-full blur-3xl" />

          <div className="max-w-xl mx-auto text-center space-y-6">
            <div className="mx-auto h-20 w-20 rounded-full bg-[#D4FF00]/10 flex items-center justify-center text-3xl animate-bounce">
              🎉
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-[#D4FF00] font-bold">Routine Finished</span>
              <h1 className="font-display text-4xl font-black tracking-tighter text-white">WORKOUT COMPLETE</h1>
              <p className="font-script text-xl text-[#D4FF00]">nicely done, champion</p>
              <p className="text-sm text-white/60">
                Outstanding job completing <strong className="text-white">{workout.workoutTitle}</strong>. Record this session below to update your statistics.
              </p>
            </div>

            {/* Quick stats brief */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-white/5 border border-white/5 text-left mt-6">
              <div>
                <span className="text-[10px] text-white/40 uppercase tracking-widest block">Active Time</span>
                <span className="text-base font-bold text-white mt-1 block">
                  {Math.max(1, Math.round(totalSecondsActive / 60))} Mins
                </span>
              </div>
              <div>
                <span className="text-[10px] text-white/40 uppercase tracking-widest block">Movements</span>
                <span className="text-base font-bold text-white mt-1 block">
                  {workout.exercises.length} completed
                </span>
              </div>
              <div>
                <span className="text-[10px] text-white/40 uppercase tracking-widest block">Est. Burn</span>
                <span className="text-base font-bold text-[#D4FF00] mt-1 block">
                  🔥 {estimateCaloriesBurned(Math.max(1, Math.round(totalSecondsActive / 60)), workout.targetArea)} kcal
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleLogSubmit} className="space-y-6 text-left pt-6 border-t border-white/5">
              {/* How do you feel */}
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-widest text-white/40 font-bold block">
                  How did you feel during this session?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(["Energetic", "Tired", "Satisfied", "Sore", "Exhausted"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFeeling(opt)}
                      className={`py-3 px-2 rounded-xl border text-xs font-bold text-center transition-all ${
                        feeling === opt
                          ? "border-[#D4FF00] bg-[#D4FF00]/10 text-white"
                          : "border-white/5 bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {opt === "Energetic" && "⚡ "}
                      {opt === "Satisfied" && "😊 "}
                      {opt === "Sore" && "🩹 "}
                      {opt === "Tired" && "🥱 "}
                      {opt === "Exhausted" && "🥵 "}
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal notes */}
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-widest text-white/40 font-bold block">
                  Add any training notes (Optional)
                </label>
                <textarea
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="Example: 'Felt very strong on push-ups, squats were smooth.'..."
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder-white/20 focus:border-[#D4FF00] focus:ring-1 focus:ring-[#D4FF00] focus:outline-hidden"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 py-4 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/5 transition-all text-center"
                  id="btn-discard-log"
                >
                  Discard Log
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-[#D4FF00] text-black font-black rounded-2xl hover:opacity-95 transform active:scale-95 transition-all text-center"
                  id="btn-save-log"
                >
                  SAVE WORKOUT LOG
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
