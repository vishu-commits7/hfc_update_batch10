import React, { useState } from "react";
import { UserProfile, Workout } from "../../types";
import {
  AVAILABLE_EQUIPMENT,
  FITNESS_LEVELS,
  WORKOUT_GOALS,
  TARGET_AREAS,
} from "../../constants";
import {
  Sparkles,
  ArrowLeft,
  Brain,
  ShieldAlert,
  Check,
  ExternalLink,
  RefreshCw,
  Shuffle,
  Play,
  Dumbbell,
  Clock3,
  CheckCircle2,
} from "lucide-react";
import gymAiGenerator from "../../assets/ui/gym-ai-generator.jpg";
import {
  registerWorkoutExercises,
  registerCustomExercise,
  findCollidingAcademyVideo,
} from "../exercises/customExercises";
import { getAiGymSignaturePhoto } from "../exercises/signaturePoseGenerator";
import { apiUrl, apiHeaders, parseJsonResponse } from "../../core/apiBase";
import { generateApexNeuralWorkout } from "./proceduralWorkout";
import { tapFeedback, celebrateFeedback } from "../../core/haptics";

interface AiGeneratorProps {
  onBack: () => void;
  onWorkoutGenerated: (workout: Workout) => void;
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
}

const DURATION_OPTIONS = [10, 15, 20, 30, 45];

const SWAP_POOLS: Record<string, Array<{ name: string; targetMuscle: string; description: string }>> = {
  "Upper Body": [
    { name: "Diamond Push-ups", targetMuscle: "Triceps & Inner Chest", description: "Focus on elbows tucked and triceps lockout at top." },
    { name: "Pike Push-ups", targetMuscle: "Shoulders & Upper Chest", description: "Hips high in inverted V, press downward towards floor." },
    { name: "Wide Grip Push-ups", targetMuscle: "Pectoralis Major", description: "Hands wider than shoulder-width, peak chest stretch." },
    { name: "Archer Push-ups", targetMuscle: "Unilateral Chest", description: "Glide across to overload one side during descent." },
    { name: "Decline Push-ups", targetMuscle: "Clavicular Pectorals", description: "Feet elevated on bench or chair for upper chest load." },
    { name: "Plank Shoulder Taps", targetMuscle: "Deltoids & Core", description: "Resist hip rotation while tapping opposite shoulder." },
  ],
  "Lower Body": [
    { name: "Bulgarian Split Squats", targetMuscle: "Quadriceps & Glutes", description: "Rear foot elevated, lower until back knee hovers above ground." },
    { name: "Jump Squats", targetMuscle: "Fast-Twitch Glutes", description: "Explosive vertical jump with soft, controlled landing." },
    { name: "Single-Leg Glute Bridges", targetMuscle: "Gluteus Maximus", description: "Drive through heel, lock out hip extension for 1 second." },
    { name: "Reverse Lunges", targetMuscle: "Hamstrings & Glutes", description: "Step backward with vertical torso, keeping front knee at 90°." },
    { name: "Calf Raises to Hold", targetMuscle: "Gastrocnemius", description: "Elevate to balls of feet, hold 2 seconds at peak contraction." },
    { name: "Sumo Squat Pulse", targetMuscle: "Adductors & Glutes", description: "Wide stance, toes flared 45°, pulse in bottom 3 inches." },
  ],
  "Core / Abs": [
    { name: "Hollow Body Rock", targetMuscle: "Transverse Abdominis", description: "Lower back pressed into floor, limbs elevated in shallow bowl." },
    { name: "Russian Twists", targetMuscle: "Internal & External Obliques", description: "Torso reclined 45°, rotate ribcage from side to side." },
    { name: "Bicycle Crunches", targetMuscle: "Rectus Abdominis & Obliques", description: "Slow 2-second rotation touching opposite elbow to knee." },
    { name: "Mountain Climbers", targetMuscle: "Core & Hip Flexors", description: "Rapid rhythmic piston knees driving towards chest in high plank." },
    { name: "Deadbugs", targetMuscle: "Deep Anti-Extension Core", description: "Opposite arm and leg lower with strict lumbar contact." },
    { name: "Side Plank Pulses", targetMuscle: "Lateral Obliques", description: "Elevated hip drops 2 inches then drives up past neutral." },
  ],
  "Full Body": [
    { name: "Burpees to Tuck Jump", targetMuscle: "Full Body & Cardiorespiratory", description: "Chest to floor, snap feet under hips, explode into tuck." },
    { name: "Bear Crawl Matrix", targetMuscle: "Quadrupedal Core & Shoulders", description: "Knees 1 inch off ground, opposite limb crawl." },
    { name: "Squat Thrust to High Knee", targetMuscle: "Full Body Dynamic", description: "Kick back to push-up, stand and drive knee high." },
    { name: "Skater Hops with Balance", targetMuscle: "Lateral Chain & Glutes", description: "Explosive lateral bound, stick the single-leg landing." },
  ],
};

export default function AiGenerator({
  onBack,
  onWorkoutGenerated,
  profile,
  setProfile,
}: AiGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states based on current profile or default
  const [fitnessLevel, setFitnessLevel] = useState(profile.fitnessLevel);
  const [goal, setGoal] = useState(profile.goal);
  const [duration, setDuration] = useState(15);
  const [targetArea, setTargetArea] = useState("Full Body");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(
    profile.preferredEquipment.length > 0 ? profile.preferredEquipment : ["bodyweight"]
  );

  // Generated Routine Preview State
  const [previewWorkout, setPreviewWorkout] = useState<Workout | null>(null);

  // Gemini AI Key & Engine settings
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return localStorage.getItem("kinetic_gemini_api_key") || "";
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyValidating, setKeyValidating] = useState(false);
  const [keyStatusMsg, setKeyStatusMsg] = useState<string | null>(null);

  const handleSaveAndTestKey = async () => {
    const trimmed = geminiApiKey.trim();
    if (!trimmed) {
      localStorage.removeItem("kinetic_gemini_api_key");
      setKeyStatusMsg("Key cleared. App will use the built-in Biomechanical Procedural Engine.");
      return;
    }
    setKeyValidating(true);
    setKeyStatusMsg(null);
    try {
      const res = await fetch(apiUrl("/api/gemini/validate"), {
        method: "POST",
        headers: apiHeaders({ "x-gemini-key": trimmed }),
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = await parseJsonResponse(res);
      if (res.ok && data.valid) {
        localStorage.setItem("kinetic_gemini_api_key", trimmed);
        setKeyStatusMsg("Gemini 2.5 Flash connected and verified!");
        setTimeout(() => setShowKeyInput(false), 1200);
      } else {
        setKeyStatusMsg(`Validation failed: ${data.message || "Invalid API key"}`);
      }
    } catch (err: any) {
      setKeyStatusMsg(`Validation error: ${err.message}`);
    } finally {
      setKeyValidating(false);
    }
  };

  const toggleEquipment = (id: string) => {
    tapFeedback();
    if (id === "bodyweight") {
      setSelectedEquipment(["bodyweight"]);
      return;
    }

    let updated = selectedEquipment.filter((item) => item !== "bodyweight");
    if (updated.includes(id)) {
      updated = updated.filter((item) => item !== id);
      if (updated.length === 0) {
        updated = ["bodyweight"];
      }
    } else {
      updated.push(id);
    }
    setSelectedEquipment(updated);
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    tapFeedback();
    setLoading(true);
    setError(null);

    // Save choices back to user profile for persistence
    setProfile((prev) => ({
      ...prev,
      fitnessLevel,
      goal,
      preferredEquipment: selectedEquipment,
    }));

    const equipmentNames = selectedEquipment.map((id) => {
      const found = AVAILABLE_EQUIPMENT.find((item) => item.id === id);
      return found ? found.name : id;
    });

    try {
      const activeKey = geminiApiKey.trim();
      let generatedWorkout: any = null;

      try {
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 3500);

        let response: Response;
        try {
          response = await fetch(apiUrl("/api/workouts/generate"), {
            method: "POST",
            headers: apiHeaders(activeKey ? { "x-gemini-key": activeKey } : {}),
            signal: timeoutController.signal,
            body: JSON.stringify({
              fitnessLevel,
              goal,
              duration,
              targetArea,
              equipment: equipmentNames,
              mode: "gemini",
            }),
          });
        } finally {
          clearTimeout(timeoutId);
        }

        generatedWorkout = await parseJsonResponse(response);

        if (!response.ok) {
          throw new Error(
            generatedWorkout?.message || generatedWorkout?.error || "Server generation failed."
          );
        }
      } catch (networkErr: any) {
        console.warn("Backend unavailable or timed out, generating via local procedural engine:", networkErr);
        // Instant on-device fallback: ensures mobile users ALWAYS get a workout routine without errors
        generatedWorkout = generateApexNeuralWorkout({
          fitnessLevel,
          goal,
          duration,
          targetArea,
          equipment: equipmentNames,
        });
      }

      const processedExercises = (generatedWorkout.exercises || []).map((ex: any) => {
        const collision = findCollidingAcademyVideo(ex.name);
        let videoUrl: string | undefined = collision.videoUrl;
        let signaturePose: string | undefined = undefined;

        if (collision.videoUrl) {
          signaturePose = getAiGymSignaturePhoto(ex.name, targetArea, ex.targetMuscle);
        } else {
          const registered = registerCustomExercise({
            name: ex.name,
            targetMuscle: ex.targetMuscle || targetArea,
            description: ex.description,
            category: targetArea,
          });
          signaturePose =
            registered?.signaturePose || getAiGymSignaturePhoto(ex.name, targetArea, ex.targetMuscle);
        }

        return {
          name: ex.name || "Custom Movement",
          description: ex.description || ex.vocalGuidanceCue || "Maintain posture control.",
          durationSeconds: Number(ex.durationSeconds) || 0,
          reps: Number(ex.reps) || 12,
          sets: Number(ex.sets) || 3,
          restSeconds: Number(ex.restSeconds) || 20,
          targetMuscle: ex.targetMuscle || targetArea,
          videoUrl,
          signaturePose,
        };
      });

      const finalWorkout: Workout = {
        id: `ai_${Date.now()}`,
        workoutTitle: generatedWorkout.workoutTitle || `${targetArea} Protocol`,
        workoutDescription:
          generatedWorkout.workoutDescription || `Custom high-performance workout targeting ${targetArea}.`,
        totalDurationMinutes: generatedWorkout.totalDurationMinutes || duration,
        targetArea: generatedWorkout.targetArea || targetArea,
        equipmentNeeded: generatedWorkout.equipmentNeeded || equipmentNames,
        exercises: processedExercises,
        coachingTips: generatedWorkout.coachingTips || [
          "Maintain controlled breathing throughout the sets.",
          "Rest adequately between exercises to secure posture.",
          "Hydrate immediately if you experience fatigue.",
        ],
        isAiGenerated: true,
        wrap: true,
        createdAt: new Date().toISOString(),
      };

      registerWorkoutExercises(finalWorkout.exercises);
      setPreviewWorkout(finalWorkout);
      celebrateFeedback();
    } catch (err: any) {
      console.error("Error occurred during workout generation process:", err);
      setError(
        err.message || "An unexpected error occurred. Please verify your connection or settings."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSwapExercise = (index: number) => {
    if (!previewWorkout) return;
    tapFeedback();

    const pool = SWAP_POOLS[targetArea] || SWAP_POOLS["Full Body"];
    const currentEx = previewWorkout.exercises[index];
    const available = pool.filter(
      (m) =>
        m.name.toLowerCase() !== currentEx.name.toLowerCase() &&
        !previewWorkout.exercises.some((e) => e.name.toLowerCase() === m.name.toLowerCase())
    );

    const replacement =
      available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : pool[Math.floor(Math.random() * pool.length)];

    const updatedExercises = [...previewWorkout.exercises];
    const registered = registerCustomExercise({
      name: replacement.name,
      targetMuscle: replacement.targetMuscle,
      description: replacement.description,
      category: targetArea,
    });

    updatedExercises[index] = {
      ...currentEx,
      name: replacement.name,
      targetMuscle: replacement.targetMuscle,
      description: replacement.description,
      signaturePose: registered?.signaturePose || getAiGymSignaturePhoto(replacement.name, targetArea, replacement.targetMuscle),
    };

    setPreviewWorkout({
      ...previewWorkout,
      exercises: updatedExercises,
    });
  };

  const handleConfirmStart = () => {
    if (!previewWorkout) return;
    tapFeedback();
    onWorkoutGenerated(previewWorkout);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in text-[#F4F4F6] pb-12" id="ai-generator-view">
      {/* Top Header Navigation */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            if (previewWorkout) {
              setPreviewWorkout(null);
            } else {
              onBack();
            }
          }}
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-line bg-carbon text-ink-2 hover:text-ink transition-colors cursor-pointer"
          title="Back"
          id="btn-back-to-dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <span className="text-[11px] uppercase tracking-wider text-volt font-bold">
            {previewWorkout ? "ROUTINE PREVIEW" : "INTELLIGENT GENERATOR"}
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink leading-none mt-0.5">
            {previewWorkout ? previewWorkout.workoutTitle : "AI Workout Protocol"}
          </h1>
        </div>
      </div>

      {/* Hero Banner — Only shown in form mode */}
      {!previewWorkout && !loading && (
        <div className="relative mb-5 overflow-hidden rounded-2xl bg-carbon border border-line">
          <div className="absolute inset-y-0 right-0 w-[45%] overflow-hidden sm:w-[50%]">
            <img
              src={gymAiGenerator}
              alt=""
              className="h-full w-full object-cover object-[60%_25%] opacity-40"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#141418] via-[#141418]/80 to-transparent" />
          </div>
          <div className="relative z-10 max-w-[62%] p-5 sm:p-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-volt">
              Custom Biomechanics
            </span>
            <h2 className="mt-1 font-display text-lg font-bold leading-tight text-ink sm:text-xl">
              Targeted Neural Programming
            </h2>
            <p className="mt-1 text-xs text-ink-3">
              Formulated for maximum hypertrophy and fatigue management.
            </p>
          </div>
        </div>
      )}

      {/* Engine Status Header */}
      {!previewWorkout && !loading && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-carbon px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#10B981]" />
            <span className="text-xs font-semibold text-ink-2">
              {geminiApiKey ? "Gemini 2.5 Flash Active" : "Apex Biomechanical Engine Active"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="text-[11px] font-bold text-ink-3 hover:text-ink transition-colors cursor-pointer"
          >
            {showKeyInput ? "Close" : geminiApiKey ? "Manage Key" : "Custom Key"}
          </button>
        </div>
      )}

      {/* Collapsible Key Configuration */}
      {showKeyInput && !previewWorkout && !loading && (
        <div className="mb-4 rounded-xl border border-line bg-carbon p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Paste Google AI Studio API Key (AIzaSy...)"
              className="flex-1 rounded-xl border border-line bg-void px-3.5 py-2 text-xs text-ink placeholder-zinc-400 focus:border-[#E1FF00] focus:outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleSaveAndTestKey}
              disabled={keyValidating}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-line bg-graphite px-4 py-2 text-xs font-bold text-ink disabled:opacity-50 transition-colors cursor-pointer"
            >
              {keyValidating ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>{keyValidating ? "Verifying..." : "Save Key"}</span>
            </button>
          </div>
          {keyStatusMsg && (
            <p className="text-xs font-medium text-ink-2">{keyStatusMsg}</p>
          )}
          <div className="flex items-center justify-between text-[11px] text-ink-3 pt-0.5">
            <span>Stored securely on device.</span>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-volt hover:underline font-medium"
            >
              Get free key <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* -------------------- LOADING STATE -------------------- */}
      {loading && (
        <div className="rounded-2xl border border-line bg-carbon p-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-graphite text-volt">
            <Brain className="h-7 w-7 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink">Synthesizing Neural Routine</h3>
            <p className="mt-1 text-xs text-ink-3">
              Balancing joint biomechanics, fatigue curves, and equipment vectors...
            </p>
          </div>
          {/* Skeleton Loaders */}
          <div className="space-y-2.5 pt-2">
            <div className="h-16 w-full rounded-xl bg-graphite/60 animate-pulse" />
            <div className="h-16 w-full rounded-xl bg-graphite/60 animate-pulse" />
            <div className="h-16 w-full rounded-xl bg-graphite/60 animate-pulse" />
          </div>
        </div>
      )}

      {/* -------------------- ROUTINE PREVIEW STAGE -------------------- */}
      {!loading && previewWorkout && (
        <div className="space-y-4">
          {/* Workout Overview Header */}
          <div className="rounded-2xl border border-line bg-carbon p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-volt bg-volt/10 px-2 py-0.5 rounded-full border border-[#E1FF00]/20">
                  {previewWorkout.targetArea}
                </span>
                <span className="text-xs text-ink-3">
                  {previewWorkout.exercises.length} Exercises
                </span>
              </div>
              <h2 className="text-lg font-bold text-ink mt-1">
                {previewWorkout.workoutTitle}
              </h2>
              <p className="text-xs text-ink-3 mt-0.5 max-w-md">
                {previewWorkout.workoutDescription}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold tabular-nums text-ink-2">
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-4 w-4 text-volt" />
                {previewWorkout.totalDurationMinutes} min
              </span>
              <span className="flex items-center gap-1.5">
                <Dumbbell className="h-4 w-4 text-volt" />
                {fitnessLevel}
              </span>
            </div>
          </div>

          {/* Clean Vertical Sequence of Exercise Cards */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] uppercase tracking-wider font-bold text-ink-3">
                Exercise Sequence ({previewWorkout.exercises.length})
              </span>
              <span className="text-[11px] text-ink-3 font-medium">
                Tap Swap to cycle alternative movement
              </span>
            </div>

            {previewWorkout.exercises.map((ex, idx) => (
              <div
                key={`${ex.name}-${idx}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-carbon p-3.5 transition-colors hover:border-line-strong"
              >
                {/* Number & Info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-graphite text-xs font-bold tabular-nums text-ink-3 border border-line">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-volt bg-volt/10 px-2 py-0.5 rounded-full border border-[#E1FF00]/20">
                        {ex.targetMuscle}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-ink mt-1 truncate">
                      {ex.name}
                    </h4>
                    <p className="text-xs text-ink-3 line-clamp-1 mt-0.5">
                      {ex.description}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs font-semibold tabular-nums text-ink-2">
                      <span className="text-ink font-bold">{ex.sets} sets</span>
                      <span>×</span>
                      <span>{ex.reps > 0 ? `${ex.reps} reps` : `${ex.durationSeconds}s`}</span>
                      <span className="text-ink-3">•</span>
                      <span className="text-ink-3">{ex.restSeconds}s rest</span>
                    </div>
                  </div>
                </div>

                {/* Swap / Replace Action Button */}
                <button
                  type="button"
                  onClick={() => handleSwapExercise(idx)}
                  className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-xl border border-line bg-graphite px-3 py-2 text-xs font-bold text-ink-2 hover:text-ink transition-colors cursor-pointer active:scale-95 shrink-0"
                  title="Swap with alternative movement"
                >
                  <Shuffle className="h-3.5 w-3.5 text-volt" />
                  <span>Swap</span>
                </button>
              </div>
            ))}
          </div>

          {/* Action Footer */}
          <div className="sticky bottom-18 z-20 flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setPreviewWorkout(null)}
              className="flex min-h-[48px] items-center justify-center rounded-xl border border-line bg-graphite px-4 text-xs font-bold text-ink-2 hover:text-ink transition-colors cursor-pointer"
            >
              Edit Options
            </button>
            <button
              type="button"
              onClick={handleConfirmStart}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-volt px-5 text-sm font-bold text-void shadow-md transition-transform active:scale-98 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Start Workout Now</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------- STRUCTURED FORM CONTROLS -------------------- */}
      {!loading && !previewWorkout && (
        <form onSubmit={handleGenerate} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-rose-300 flex gap-3 items-start text-xs">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-bold text-ink">Generation Error</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* 1. Target Focus Area — Tactile Segmented Pills */}
          <div className="rounded-2xl border border-line bg-carbon p-4 space-y-2.5">
            <label className="text-[12px] font-bold uppercase tracking-wider text-ink-3 block">
              Target Muscle Focus
            </label>
            <div className="flex flex-wrap gap-2">
              {TARGET_AREAS.map((area) => {
                const isSelected = targetArea === area.value;
                return (
                  <button
                    key={area.value}
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setTargetArea(area.value);
                    }}
                    className={`min-h-[44px] rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer select-none ${
                      isSelected
                        ? "bg-volt text-void shadow-sm"
                        : "bg-graphite text-ink-3 border border-line hover:text-white"
                    }`}
                  >
                    {area.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Workout Goal — Tactile Segmented Pills */}
          <div className="rounded-2xl border border-line bg-carbon p-4 space-y-2.5">
            <label className="text-[12px] font-bold uppercase tracking-wider text-ink-3 block">
              Primary Objective
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WORKOUT_GOALS.map((g) => {
                const isSelected = goal === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setGoal(g.value as any);
                    }}
                    className={`min-h-[48px] flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer select-none ${
                      isSelected
                        ? "bg-volt text-void shadow-sm"
                        : "bg-graphite text-ink-2 border border-line hover:text-white"
                    }`}
                  >
                    <span className="truncate">{g.label}</span>
                    {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-black" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Session Duration — Tactile Segmented Pills */}
          <div className="rounded-2xl border border-line bg-carbon p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-bold uppercase tracking-wider text-ink-3">
                Duration
              </label>
              <span className="text-xs font-bold tabular-nums text-volt">
                {duration} minutes
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {DURATION_OPTIONS.map((min) => {
                const isSelected = duration === min;
                return (
                  <button
                    key={min}
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setDuration(min);
                    }}
                    className={`min-h-[44px] flex items-center justify-center rounded-xl text-xs font-bold tabular-nums transition-all cursor-pointer select-none ${
                      isSelected
                        ? "bg-volt text-void shadow-sm"
                        : "bg-graphite text-ink-2 border border-line hover:text-white"
                    }`}
                  >
                    {min}m
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Equipment Available — Tactile Segmented Pills */}
          <div className="rounded-2xl border border-line bg-carbon p-4 space-y-2.5">
            <label className="text-[12px] font-bold uppercase tracking-wider text-ink-3 block">
              Equipment Access
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EQUIPMENT.map((eq) => {
                const isSelected = selectedEquipment.includes(eq.id);
                return (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => toggleEquipment(eq.id)}
                    className={`min-h-[44px] flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer select-none ${
                      isSelected
                        ? "bg-volt text-void shadow-sm"
                        : "bg-graphite text-ink-3 border border-line hover:text-white"
                    }`}
                  >
                    <span>{eq.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-black" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Fitness Level — Tactile Segmented Pills */}
          <div className="rounded-2xl border border-line bg-carbon p-4 space-y-2.5">
            <label className="text-[12px] font-bold uppercase tracking-wider text-ink-3 block">
              Experience Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FITNESS_LEVELS.map((lvl) => {
                const isSelected = fitnessLevel === lvl.value;
                return (
                  <button
                    key={lvl.value}
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setFitnessLevel(lvl.value as any);
                    }}
                    className={`min-h-[44px] flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                      isSelected
                        ? "bg-volt text-void shadow-sm"
                        : "bg-graphite text-ink-2 border border-line hover:text-white"
                    }`}
                  >
                    {lvl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate CTA Button */}
          <button
            type="submit"
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-volt px-5 text-sm font-bold text-void shadow-md transition-transform active:scale-98 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate Biomechanical Protocol</span>
          </button>
        </form>
      )}
    </div>
  );
}
