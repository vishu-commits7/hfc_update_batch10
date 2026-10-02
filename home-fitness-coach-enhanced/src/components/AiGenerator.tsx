import React, { useState } from "react";
import { UserProfile, Workout } from "../types";
import { AVAILABLE_EQUIPMENT, FITNESS_LEVELS, WORKOUT_GOALS, TARGET_AREAS } from "../constants";
import { Sparkles, ArrowLeft, Brain, ShieldAlert } from "lucide-react";
import heroOverheadPress from "../assets/ui/hero-overheadpress.jpg";

interface AiGeneratorProps {
  onBack: () => void;
  onWorkoutGenerated: (workout: Workout) => void;
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
}

export default function AiGenerator({ onBack, onWorkoutGenerated, profile, setProfile }: AiGeneratorProps) {
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
  const [healthNotes, setHealthNotes] = useState("");

  const toggleEquipment = (id: string) => {
    if (id === "bodyweight") {
      setSelectedEquipment(["bodyweight"]);
      return;
    }
    
    let updated = selectedEquipment.filter(item => item !== "bodyweight");
    if (updated.includes(id)) {
      updated = updated.filter(item => item !== id);
      if (updated.length === 0) {
        updated = ["bodyweight"];
      }
    } else {
      updated.push(id);
    }
    setSelectedEquipment(updated);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Save choices back to user profile for persistence
    setProfile(prev => ({
      ...prev,
      fitnessLevel,
      goal,
      preferredEquipment: selectedEquipment
    }));

    // Map equipment IDs to human names
    const equipmentNames = selectedEquipment.map(id => {
      const found = AVAILABLE_EQUIPMENT.find(e => e.id === id);
      return found ? found.name : id;
    });

    try {
      // Ask our own backend to talk to Gemini. The API key lives only on the
      // server (see server.ts) — it must never be embedded in client code,
      // since anything shipped to the browser bundle is publicly readable.
      const response = await fetch("/api/workouts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fitnessLevel,
          goal,
          duration,
          targetArea,
          equipment: equipmentNames,
          healthNotes: healthNotes || undefined
        })
      });

      const generatedWorkout = await response.json();

      if (!response.ok) {
        throw new Error(generatedWorkout?.message || "Failed to generate AI workout plan.");
      }

      // Inject local ID and attributes
      const finalWorkout: Workout = {
        id: `ai_${Date.now()}`,
        workoutTitle: generatedWorkout.workoutTitle || `${targetArea} Blast`,
        workoutDescription: generatedWorkout.workoutDescription || `Custom AI generated workout targeting ${targetArea}.`,
        totalDurationMinutes: generatedWorkout.totalDurationMinutes || duration,
        targetArea: generatedWorkout.targetArea || targetArea,
        equipmentNeeded: generatedWorkout.equipmentNeeded || equipmentNames,
        exercises: (generatedWorkout.exercises || []).map((ex: any) => ({
          name: ex.name || "Custom Movement",
          description: ex.description || ex.vocalGuidanceCue || "Maintain posture control.",
          durationSeconds: Number(ex.durationSeconds) || 0,
          reps: Number(ex.reps) || 10,
          sets: Number(ex.sets) || 3,
          restSeconds: Number(ex.restSeconds) || 15,
          targetMuscle: ex.targetMuscle || targetArea
        })),
        coachingTips: generatedWorkout.coachingTips || [
          "Maintain controlled breathing throughout the sets.",
          "Rest adequately between exercises to secure posture.",
          "Hydrate immediately if you experience dizziness."
        ],
        isAiGenerated: true,
        createdAt: new Date().toISOString()
      };

      onWorkoutGenerated(finalWorkout);
    } catch (err: any) {
      console.error("Error occurred during Gemini workout generation process:", err);
      setError(err.message || "An unexpected API or network error occurred. Please verify your internet connection and check system logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in text-slate-800 pb-12" id="ai-generator-view">
      {/* Top Header Navigation */}
      <div className="flex items-center gap-4 mb-5">
        <button
          onClick={onBack}
          className="group flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs"
          title="Back to Dashboard"
          id="btn-back-to-dashboard"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div>
          <span className="text-[10px] uppercase tracking-widest text-blue-600 font-extrabold">KINETIC AI ENGINE</span>
          <h1 className="font-sans text-2xl font-black tracking-tight text-slate-900 uppercase">AI Workout Generator</h1>
        </div>
      </div>

      {/* Real-photo hero banner — the AI engine gets its own photographic
          identity, same right-bleed treatment as the Dashboard's challenge
          card, tuned to this screen's blue accent instead of indigo. */}
      <div className="relative mb-6 overflow-hidden rounded-[24px] bg-slate-950">
        <div className="absolute inset-y-0 right-0 w-[38%] overflow-hidden sm:w-[42%]">
          <img src={heroOverheadPress} alt="" className="h-full w-full object-cover object-[50%_10%]" draggable={false} />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/20 to-transparent" />
        </div>
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative z-10 max-w-[62%] px-5 py-6 sm:max-w-[56%] sm:px-7 sm:py-8">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Powered by Gemini</span>
          <h2 className="mt-1 font-display text-lg font-black leading-tight tracking-tight text-white sm:text-xl">A workout built around you, in seconds.</h2>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-100 bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 h-48 w-48 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-6" id="ai-loading-state">
            <div className="relative flex items-center justify-center">
              <div className="h-16 w-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <Brain className="absolute h-6 w-6 text-blue-600 animate-pulse" />
            </div>
            
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Synthesizing Workout Plan...</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Gemini is acting as your digital personal trainer—sequencing safe exercises, writing posture forms, and planning rest breaks.
              </p>
            </div>

            {/* Simulated progression bullets */}
            <div className="text-[10px] text-blue-600 uppercase tracking-widest font-extrabold flex flex-wrap justify-center gap-3">
              <span>● Formulating Sets</span>
              <span className="opacity-40">•</span>
              <span>● Calculating Rest Intervals</span>
              <span className="opacity-40">•</span>
              <span>● Finalizing Posture Cues</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="space-y-6">
            {error && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-rose-800 flex gap-3 items-start text-sm">
                <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-rose-900">AI Generation Encountered an Error</p>
                  <p className="text-xs text-rose-700 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {/* Grid 1: Fitness Level & Workout Goal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fitness Level Selection */}
              <div className="space-y-2.5">
                <label className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block">1. Target Fitness level</label>
                <div className="grid grid-cols-1 gap-2">
                  {FITNESS_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setFitnessLevel(level.value as any)}
                      className={`flex flex-col text-left p-4 rounded-2xl border transition-all ${
                        fitnessLevel === level.value
                          ? "border-blue-600 bg-blue-50/50 text-slate-900 shadow-xs"
                          : "border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100/70"
                      }`}
                    >
                      <span className="text-sm font-bold tracking-tight text-slate-900">{level.label}</span>
                      <span className="text-[11px] text-slate-400 mt-0.5">{level.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Workout Goal Selection */}
              <div className="space-y-2.5">
                <label className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block">2. Primary Session Goal</label>
                <div className="grid grid-cols-1 gap-2">
                  {WORKOUT_GOALS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGoal(g.value as any)}
                      className={`flex items-start gap-3 text-left p-4 rounded-2xl border transition-all ${
                        goal === g.value
                          ? "border-blue-600 bg-blue-50/50 text-slate-900 shadow-xs"
                          : "border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100/70"
                      }`}
                    >
                      <span className="text-xl leading-none mt-0.5">{g.icon}</span>
                      <div>
                        <span className="text-sm font-bold tracking-tight block text-slate-900">{g.label}</span>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">{g.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid 2: Target Area & Session Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Target Body Area */}
              <div className="space-y-2.5">
                <label className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block">3. Target Muscle/Focus Area</label>
                <select
                  value={targetArea}
                  onChange={(e) => setTargetArea(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                >
                  {TARGET_AREAS.map((area) => (
                    <option key={area.value} value={area.value} className="bg-white text-slate-800">
                      {area.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Workout Duration */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block">4. Target Duration</label>
                  <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{duration} minutes</span>
                </div>
                <div className="pt-2">
                  <input
                    type="range"
                    min="5"
                    max="45"
                    step="5"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-semibold">
                    <span>5 MIN</span>
                    <span>15 MIN</span>
                    <span>30 MIN</span>
                    <span>45 MIN</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Segment 3: Equipment Available */}
            <div className="space-y-2.5 pt-2">
              <label className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block">
                5. Select Available Equipment at Home
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {AVAILABLE_EQUIPMENT.map((eq) => {
                  const isSelected = selectedEquipment.includes(eq.id);
                  return (
                    <button
                      key={eq.id}
                      type="button"
                      onClick={() => toggleEquipment(eq.id)}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border text-sm font-semibold transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/50 text-slate-900"
                          : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100/70"
                      }`}
                    >
                      <span className="text-lg">{eq.icon}</span>
                      <span className="truncate">{eq.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Segment 4: Physical notes & constraints */}
            <div className="space-y-2.5 pt-2">
              <label className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block">
                6. Safety & Physical Notes (Optional)
              </label>
              <textarea
                value={healthNotes}
                onChange={(e) => setHealthNotes(e.target.value)}
                placeholder="Examples: 'Sensitive lower back', 'Slightly sore left knee'..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
              <p className="text-[11px] text-slate-400 italic">
                Our AI coach scans your safety notes to swap risky movements with highly accessible alternatives.
              </p>
            </div>

            {/* Actions Footer */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-400 max-w-md text-center sm:text-left leading-relaxed">
                ⚡ Make sure you are in an open workspace with adequate hydration before starting.
              </span>

              <button
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 px-8 py-4 text-sm font-black shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                id="btn-generate-workout"
              >
                <Sparkles className="h-4 w-4 fill-white/10 text-white" />
                CREATE CUSTOM AI ROUTINE
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
