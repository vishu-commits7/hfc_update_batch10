import { useMemo, useState } from "react";
import { ArrowLeft, Search, Plus, Minus, Trash2, GripVertical, Save, Dumbbell, Clock3, Repeat, Sparkles } from "lucide-react";
import { Workout, Exercise } from "../types";
import { DEMO_EXERCISES, ExerciseDemo } from "./ExerciseLibrary";

/**
 * Lets a user assemble their own workout from the existing exercise
 * library instead of only relying on AI generation or curated routines.
 * Saved as a normal `Workout` object (isAiGenerated: false) so it slots
 * straight into the same "Your AI Workouts" list / WorkoutCard / Active
 * Workout flow everything else already uses — no separate storage or UI
 * path needed downstream.
 */

interface BuiltExercise {
  demoId: string;
  name: string;
  description: string;
  targetMuscle: string;
  timed: boolean;
  sets: number;
  reps: number;
  durationSeconds: number;
  restSeconds: number;
}

function demoToBuilt(demo: ExerciseDemo): BuiltExercise {
  // Cardio/Core "hold" style movements read more naturally as timed;
  // everything else defaults to reps, matching how the Academy already
  // categorizes movements.
  const timed = /plank|hold|wall-sit|bridge|superman|stretch|fold/i.test(demo.id) || demo.tempo?.toLowerCase().includes("hold");
  return {
    demoId: demo.id,
    name: demo.name,
    description: demo.description,
    targetMuscle: demo.focus,
    timed,
    sets: 3,
    reps: 12,
    durationSeconds: 30,
    restSeconds: 30,
  };
}

function estimateMinutes(exercises: BuiltExercise[]): number {
  const totalSeconds = exercises.reduce((sum, ex) => {
    const perRepSeconds = ex.timed ? ex.durationSeconds : ex.reps * 3;
    const work = ex.sets * perRepSeconds;
    const rest = Math.max(0, ex.sets - 1) * ex.restSeconds;
    return sum + work + rest;
  }, 0);
  return Math.max(1, Math.round(totalSeconds / 60));
}

export default function WorkoutBuilder({ onBack, onSave }: { onBack: () => void; onSave: (workout: Workout) => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [title, setTitle] = useState("");
  const [built, setBuilt] = useState<BuiltExercise[]>([]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    DEMO_EXERCISES.forEach(d => set.add(d.category));
    return ["All", ...Array.from(set)];
  }, []);

  const filteredLibrary = useMemo(() => {
    return DEMO_EXERCISES.filter(d => {
      const matchesCategory = category === "All" || d.category === category;
      const matchesSearch = !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()) || d.focus.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  const addExercise = (demo: ExerciseDemo) => {
    if (built.some(b => b.demoId === demo.id)) return;
    setBuilt(prev => [...prev, demoToBuilt(demo)]);
  };

  const removeExercise = (demoId: string) => {
    setBuilt(prev => prev.filter(b => b.demoId !== demoId));
  };

  const updateExercise = (demoId: string, patch: Partial<BuiltExercise>) => {
    setBuilt(prev => prev.map(b => (b.demoId === demoId ? { ...b, ...patch } : b)));
  };

  const moveExercise = (index: number, dir: -1 | 1) => {
    setBuilt(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const estimatedMinutes = estimateMinutes(built);
  const canSave = title.trim().length > 0 && built.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const exercises: Exercise[] = built.map(b => ({
      name: b.name,
      description: b.description,
      durationSeconds: b.timed ? b.durationSeconds : 0,
      reps: b.timed ? 0 : b.reps,
      sets: b.sets,
      restSeconds: b.restSeconds,
      targetMuscle: b.targetMuscle,
    }));

    // Pull the target areas actually used into the workout's summary label.
    const uniqueTargets = Array.from(new Set(built.map(b => b.targetMuscle.split(",")[0].trim())));
    const equipmentSet = new Set<string>();
    built.forEach(b => {
      const demo = DEMO_EXERCISES.find(d => d.id === b.demoId);
      equipmentSet.add(demo?.equipment || "Bodyweight");
    });

    const workout: Workout = {
      id: `custom_build_${Date.now()}`,
      workoutTitle: title.trim(),
      workoutDescription: `A custom workout you built — ${built.length} exercises across ${uniqueTargets.slice(0, 3).join(", ")}.`,
      totalDurationMinutes: estimatedMinutes,
      targetArea: (uniqueTargets[0] as string | undefined) || "Full Body",
      equipmentNeeded: Array.from(equipmentSet),
      exercises,
      coachingTips: [
        "This session was built by you — adjust sets, reps or rest anytime by creating a new version.",
        "Warm up for a couple of minutes before diving into the first exercise.",
      ],
      isAiGenerated: false,
      createdAt: new Date().toISOString(),
    };

    onSave(workout);
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in text-slate-800 pb-12">
      <div className="mb-5 flex items-center gap-4">
        <button onClick={onBack} className="group flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs transition-all hover:border-slate-300">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Build your own</p>
          <h1 className="truncate text-xl font-black tracking-tight text-slate-900">Workout Builder</h1>
        </div>
      </div>

      <div className="mb-5 rounded-[24px] border border-slate-100 bg-white p-5 shadow-xs">
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Workout name</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. My Tuesday Leg Day"
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Your built list */}
      <div className="mb-6 rounded-[24px] border border-slate-100 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Your exercises ({built.length})</h3>
          {built.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-slate-400"><Clock3 className="h-3.5 w-3.5" /> ~{estimatedMinutes} min</span>
          )}
        </div>

        {built.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 p-6 text-center">
            <Dumbbell className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-2 text-xs text-slate-400">Add exercises from the library below to start building.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {built.map((ex, idx) => (
              <div key={ex.demoId} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <div className="mt-0.5 flex flex-col text-slate-300">
                      <button type="button" onClick={() => moveExercise(idx, -1)} disabled={idx === 0} className="disabled:opacity-30"><GripVertical className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{idx + 1}. {ex.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{ex.targetMuscle}</p>
                    </div>
                  </div>
                  <button onClick={() => removeExercise(ex.demoId)} className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => updateExercise(ex.demoId, { timed: false })}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${!ex.timed ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"}`}
                  >
                    <Repeat className="mr-1 inline h-3 w-3" /> Reps
                  </button>
                  <button
                    onClick={() => updateExercise(ex.demoId, { timed: true })}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${ex.timed ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"}`}
                  >
                    <Clock3 className="mr-1 inline h-3 w-3" /> Timed
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Sets</span>
                    <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1.5 py-1">
                      <button onClick={() => updateExercise(ex.demoId, { sets: Math.max(1, ex.sets - 1) })} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                      <span className="flex-1 text-center text-xs font-black text-slate-800">{ex.sets}</span>
                      <button onClick={() => updateExercise(ex.demoId, { sets: Math.min(10, ex.sets + 1) })} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>

                  {ex.timed ? (
                    <div>
                      <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Seconds</span>
                      <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1.5 py-1">
                        <button onClick={() => updateExercise(ex.demoId, { durationSeconds: Math.max(10, ex.durationSeconds - 5) })} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                        <span className="flex-1 text-center text-xs font-black text-slate-800">{ex.durationSeconds}</span>
                        <button onClick={() => updateExercise(ex.demoId, { durationSeconds: Math.min(180, ex.durationSeconds + 5) })} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Reps</span>
                      <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1.5 py-1">
                        <button onClick={() => updateExercise(ex.demoId, { reps: Math.max(1, ex.reps - 1) })} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                        <span className="flex-1 text-center text-xs font-black text-slate-800">{ex.reps}</span>
                        <button onClick={() => updateExercise(ex.demoId, { reps: Math.min(50, ex.reps + 1) })} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Rest (s)</span>
                    <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1.5 py-1">
                      <button onClick={() => updateExercise(ex.demoId, { restSeconds: Math.max(0, ex.restSeconds - 5) })} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                      <span className="flex-1 text-center text-xs font-black text-slate-800">{ex.restSeconds}</span>
                      <button onClick={() => updateExercise(ex.demoId, { restSeconds: Math.min(120, ex.restSeconds + 5) })} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-black text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Save className="h-4 w-4" /> Save workout
        </button>
        {!canSave && <p className="mt-2 text-center text-[10px] text-slate-400">Give it a name and add at least one exercise to save.</p>}
      </div>

      {/* Exercise library picker */}
      <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-600" /><h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Add from the library</h3></div>

        <div className="relative mt-3">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition-all ${category === c ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-500 border border-slate-100"}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {filteredLibrary.map(demo => {
            const added = built.some(b => b.demoId === demo.id);
            return (
              <button
                key={demo.id}
                onClick={() => addExercise(demo)}
                disabled={added}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all ${added ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50/40"}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-slate-900">{demo.name}</p>
                  <p className="truncate text-[10px] text-slate-400">{demo.category} · {demo.focus}</p>
                </div>
                <span className={`shrink-0 rounded-full p-1.5 ${added ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {added ? "✓" : <Plus className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
          {filteredLibrary.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-400">No exercises match your search.</p>
          )}
        </div>
      </div>
    </div>
  );
}
