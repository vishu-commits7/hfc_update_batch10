import React, { useState, useEffect } from "react";
import { ProgressLog, ProgressExercise } from "../types";
import gymWorkoutVictory from "../assets/ui/gym-workout-victory.jpg";
import { 
  Plus, 
  Trash2, 
  TrendingUp, 
  BarChart2, 
  Activity, 
  PlusCircle, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Info
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";

// 10 bodyweight list from ExerciseLibrary for dropdown
const DEFAULT_DEMOS = [
  "Classic Push-ups",
  "Bodyweight Squats",
  "Forearm Plank Hold",
  "Reverse Lunges",
  "Full-Body Burpees",
  "Glute Bridges",
  "Mountain Climbers",
  "Chair Tricep Dips",
  "Jumping Jacks",
  "Bicycle Crunches"
];

export default function ProgressTracker({ preselectedExercise }: { preselectedExercise?: string }) {
  const [activeTab, setActiveTab] = useState<"log" | "analytics" | "history">("analytics");
  
  // Load persistent progress logs
  const [progLogs, setProgLogs] = useState<ProgressLog[]>(() => {
    const saved = localStorage.getItem("kinetic_progress_tracker_logs");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("kinetic_progress_tracker_logs", JSON.stringify(progLogs));
  }, [progLogs]);

  // Expand state for history list
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Form states for adding a manual log
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [logTitle, setLogTitle] = useState("");
  const [logFeeling, setLogFeeling] = useState<"Energetic" | "Satisfied" | "Sore" | "Tired" | "Exhausted">("Satisfied");
  const [logNotes, setLogNotes] = useState("");
  const [formExercises, setFormExercises] = useState<ProgressExercise[]>([
    {
      exerciseName: preselectedExercise || "Classic Push-ups",
      sets: [{ reps: 12, weight: 0 }]
    }
  ]);

  // Handle preselected exercise navigation switch from library
  useEffect(() => {
    if (preselectedExercise) {
      setFormExercises([
        {
          exerciseName: preselectedExercise,
          sets: [{ reps: 12, weight: 0 }]
        }
      ]);
      setActiveTab("log");
    }
  }, [preselectedExercise]);

  // Set default exercise name for progression charting
  const [chartExName, setChartExName] = useState(() => {
    if (preselectedExercise) return preselectedExercise;
    return "Classic Push-ups";
  });

  // Extract unique logged exercise names to populate filter dropdown
  const getLoggedExerciseNames = (): string[] => {
    const names = new Set<string>();
    progLogs.forEach(log => {
      log.exercises.forEach(ex => {
        if (ex.exerciseName) {
          names.add(ex.exerciseName);
        }
      });
    });
    // Fallback to defaults if empty
    if (names.size === 0) {
      DEFAULT_DEMOS.forEach(n => names.add(n));
    }
    return Array.from(names);
  };

  // --- HANDLERS FOR MANUALLY LOGGING EXERCISES ---

  const handleAddFormExercise = () => {
    setFormExercises(prev => [
      ...prev,
      { exerciseName: "Classic Push-ups", sets: [{ reps: 10, weight: 0 }] }
    ]);
  };

  const handleRemoveFormExercise = (idx: number) => {
    setFormExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFormExNameChange = (exIdx: number, val: string) => {
    setFormExercises(prev => {
      const copy = [...prev];
      copy[exIdx] = { ...copy[exIdx], exerciseName: val };
      return copy;
    });
  };

  const handleAddFormSet = (exIdx: number) => {
    setFormExercises(prev => {
      const copy = [...prev];
      const lastSet = copy[exIdx].sets[copy[exIdx].sets.length - 1] || { reps: 10, weight: 0 };
      copy[exIdx] = {
        ...copy[exIdx],
        sets: [...copy[exIdx].sets, { reps: lastSet.reps, weight: lastSet.weight }]
      };
      return copy;
    });
  };

  const handleRemoveFormSet = (exIdx: number, setIdx: number) => {
    setFormExercises(prev => {
      const copy = [...prev];
      copy[exIdx] = {
        ...copy[exIdx],
        sets: copy[exIdx].sets.filter((_, i) => i !== setIdx)
      };
      return copy;
    });
  };

  const handleFormSetChange = (exIdx: number, setIdx: number, field: "reps" | "weight", val: number) => {
    setFormExercises(prev => {
      const copy = [...prev];
      const setsCopy = [...copy[exIdx].sets];
      setsCopy[setIdx] = { ...setsCopy[setIdx], [field]: val };
      copy[exIdx] = { ...copy[exIdx], sets: setsCopy };
      return copy;
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newLog: ProgressLog = {
      id: `prog_log_${Date.now()}`,
      date: logDate,
      workoutTitle: logTitle.trim() || "Strength Routine",
      feeling: logFeeling,
      notes: logNotes.trim() || undefined,
      exercises: formExercises
    };

    setProgLogs(prev => [newLog, ...prev]);
    
    // Reset form & route back
    setLogTitle("");
    setLogNotes("");
    setFormExercises([{ exerciseName: "Classic Push-ups", sets: [{ reps: 12, weight: 0 }] }]);
    setActiveTab("analytics");
    
    // Auto set chart selection to the first exercise logged
    if (newLog.exercises[0]?.exerciseName) {
      setChartExName(newLog.exercises[0].exerciseName);
    }
  };

  const handleDeleteLog = (id: string) => {
    if (confirm("Are you sure you want to delete this workout entry?")) {
      setProgLogs(prev => prev.filter(log => log.id !== id));
    }
  };

  const handleClearAllProgress = () => {
    if (confirm("WARNING: This will clear your entire progressive tracking logs. Are you sure?")) {
      setProgLogs([]);
    }
  };

  // --- ANALYTICS CALCULATIONS ---
  
  // 1. Weight progression data for selected exercise
  const getWeightProgressionData = () => {
    // Filter logs that contain the selected exercise, sort them chronologically (oldest first)
    const sortedLogs = [...progLogs].sort((a, b) => a.date.localeCompare(b.date));
    
    const data: { date: string; maxWeight: number; totalVolume: number; maxReps: number }[] = [];
    
    sortedLogs.forEach(log => {
      const matchedEx = log.exercises.find(ex => ex.exerciseName.toLowerCase() === chartExName.toLowerCase());
      if (matchedEx && matchedEx.sets.length > 0) {
        let maxW = 0;
        let maxR = 0;
        let vol = 0;
        matchedEx.sets.forEach(set => {
          if (set.weight > maxW) maxW = set.weight;
          if (set.reps > maxR) maxR = set.reps;
          vol += set.reps * (set.weight || 1); // multiply reps by weight, fallback to 1 for bodyweight volume
        });
        
        data.push({
          date: new Date(log.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          maxWeight: maxW,
          totalVolume: vol,
          maxReps: maxR
        });
      }
    });
    
    return data;
  };

  // 2. Workout frequency calculation
  // Group workouts by date to show consistency
  const getFrequencyData = () => {
    // Sort logs chronologically (oldest first)
    const sortedLogs = [...progLogs].sort((a, b) => a.date.localeCompare(b.date));
    
    const frequencyMap: Record<string, number> = {};
    
    sortedLogs.forEach(log => {
      const dateKey = new Date(log.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      frequencyMap[dateKey] = (frequencyMap[dateKey] || 0) + 1;
    });

    return Object.keys(frequencyMap).map(key => ({
      date: key,
      Sessions: frequencyMap[key]
    }));
  };

  const chartData = getWeightProgressionData();
  const freqData = getFrequencyData();
  const uniqueLoggedExercises = getLoggedExerciseNames();

  return (
    <div className="max-w-6xl mx-auto animate-fade-in text-slate-800 pb-12" id="progress-tracker-view">

      {/* Real-photo hero banner — a dark, moody header to open the numbers
          with the same "this is a real person training" energy as the
          Academy, before the page turns into charts and tables. */}
      <div className="relative mb-6 overflow-hidden rounded-[24px] bg-slate-950 border border-slate-800 shadow-lg">
        <div className="absolute inset-0">
          <img src={gymWorkoutVictory} alt="Progress Athlete" className="h-full w-full object-cover object-[50%_25%] opacity-80" draggable={false} />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 0%, color-mix(in srgb, var(--carbon) 70%, transparent) 55%, transparent 100%" />
        </div>
        <div className="relative z-10 max-w-[70%] px-5 py-6 sm:max-w-[60%] sm:px-7 sm:py-8">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Your journey</span>
          <h2 className="mt-1 font-display text-xl font-black tracking-tight text-white sm:text-2xl">Progress that compounds</h2>
          <p className="mt-1.5 text-xs leading-5 text-white/60 sm:text-sm">Every logged set adds to the story. Track it here.</p>
        </div>
      </div>

      {/* Tab Selectors Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100">
        <div className="flex gap-2 bg-slate-100/80 border border-slate-200/50 p-1 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex-1 sm:flex-initial py-2.5 px-5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "analytics"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
            id="tab-btn-analytics"
          >
            <TrendingUp className="h-3.5 w-3.5 inline mr-1.5" />
            Analytics Deck
          </button>
          
          <button
            onClick={() => setActiveTab("log")}
            className={`flex-1 sm:flex-initial py-2.5 px-5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "log"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
            id="tab-btn-logger"
          >
            <Plus className="h-3.5 w-3.5 inline mr-1.5" />
            Log Workout
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 sm:flex-initial py-2.5 px-5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "history"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
            id="tab-btn-history-list"
          >
            <Activity className="h-3.5 w-3.5 inline mr-1.5" />
            Registry
          </button>
        </div>

        {activeTab === "history" && progLogs.length > 0 && (
          <button
            onClick={handleClearAllProgress}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-rose-50"
            id="btn-clear-prog-tracker"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Reset Log
          </button>
        )}
      </div>

      {/* --- Tab 1: ANALYTICS VIEW --- */}
      {activeTab === "analytics" && (
        <div className="space-y-6 animate-fade-in">
          {progLogs.length === 0 ? (
            <div className="rounded-[32px] border border-slate-100 bg-white p-12 text-center max-w-xl mx-auto shadow-xs">
              <BarChart2 className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 tracking-wide uppercase italic">No Progress Metrics Registered</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed font-sans">
                Log a workout session first using the <strong className="font-bold text-slate-700">Log Workout</strong> tab above. You'll be able to track dates, sets, reps and weights to see a full progression chart.
              </p>
              <button
                onClick={() => setActiveTab("log")}
                className="mt-6 inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white font-black px-6 py-3.5 text-xs uppercase tracking-wider hover:bg-slate-800"
              >
                Log First Session
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              
              {/* Weight Progression Chart */}
              <div className="rounded-[32px] border border-slate-100 bg-white p-5 sm:p-6 space-y-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-blue-600 font-extrabold block">Strength Over Time</span>
                    <h2 className="text-xl font-black text-slate-900 uppercase mt-0.5">Weight Progression</h2>
                  </div>

                  {/* Dropdown for unique exercises */}
                  <div className="relative">
                    <select
                      value={chartExName}
                      onChange={(e) => setChartExName(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 cursor-pointer shadow-xs"
                    >
                      {uniqueLoggedExercises.map(name => (
                        <option key={name} value={name} className="bg-white text-slate-800">
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {chartData.length < 2 ? (
                  <div className="h-72 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Sparkles className="h-8 w-8 text-blue-500/50 animate-pulse mb-2" />
                    <p className="text-xs text-slate-700 font-bold uppercase">Awaiting Progressive Entries</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                      We need at least 2 distinct date entries for <strong className="font-bold text-slate-700">{chartExName}</strong> to trace a progression line. Keep training!
                    </p>
                  </div>
                ) : (
                  <div className="h-72 w-full font-sans text-[10px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                        <XAxis dataKey="date" stroke="rgba(15,23,42,0.5)" fontStyle="bold" />
                        <YAxis stroke="rgba(15,23,42,0.5)" fontStyle="bold" label={{ value: "Load / Reps", angle: -90, position: "insideLeft", fill: "rgba(15,23,42,0.4)" }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#F1F5F9", borderRadius: "12px", color: "#0F172A", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }} 
                          itemStyle={{ color: "#2563EB" }}
                        />
                        <Legend wrapperStyle={{ color: "rgba(15,23,42,0.6)" }} />
                        <Line 
                          type="monotone" 
                          dataKey="maxWeight" 
                          name="Peak Load (lbs)" 
                          stroke="#2563EB" 
                          strokeWidth={3}
                          activeDot={{ r: 8 }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="maxReps" 
                          name="Max Reps" 
                          stroke="#06B6D4" 
                          strokeWidth={2} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                
                {/* Stats brief for selected ex */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs text-slate-500">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase text-slate-400 font-extrabold block">First Logged Load</span>
                    <span className="text-sm font-black text-slate-800 mt-1 block">
                      {chartData[0]?.maxWeight ?? 0} lbs ({chartData[0]?.maxReps ?? 0} reps)
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase text-slate-400 font-extrabold block">Personal Record (PR)</span>
                    <span className="text-sm font-black text-blue-600 mt-1 block">
                      🏆 {Math.max(...chartData.map(d => d.maxWeight), 0)} lbs
                    </span>
                  </div>
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                    <span className="text-[10px] uppercase text-blue-600 font-extrabold block">Total Rep Volume</span>
                    <span className="text-sm font-black text-slate-800 mt-1 block">
                      {chartData.reduce((acc, d) => acc + d.totalVolume, 0)} total rep-lbs
                    </span>
                  </div>
                </div>
              </div>

              {/* Training Frequency & Consistency */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Frequency chart container */}
                <div className="md:col-span-7 rounded-[32px] border border-slate-100 bg-white p-5 shadow-xs space-y-6">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-blue-600 font-extrabold block">Weekly Consistency</span>
                    <h2 className="text-lg font-black text-slate-900 uppercase mt-0.5">Workout Frequency</h2>
                  </div>

                  <div className="h-56 w-full font-sans text-[9px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={freqData} margin={{ top: 5, right: 5, left: -30, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" />
                        <XAxis dataKey="date" stroke="rgba(15,23,42,0.5)" />
                        <YAxis stroke="rgba(15,23,42,0.5)" allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#F1F5F9", borderRadius: "12px", color: "#0F172A", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }} 
                        />
                        <Bar dataKey="Sessions" name="Completed Sessions" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <p className="text-[11px] leading-relaxed text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    🎯 Training consistency generates active muscle remodeling. Keep logging your sessions to maintain a high performance frequency!
                  </p>
                </div>

                {/* Core insights metrics panel */}
                <div className="md:col-span-5 rounded-[32px] border border-slate-100 bg-white p-6 flex flex-col justify-between shadow-xs">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold block">Insights</span>
                    <h3 className="text-lg font-black text-slate-900 uppercase mt-0.5 mb-4">Consolidated Metrics</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-100">
                        <span className="text-slate-400 font-bold">Total Registered Entries</span>
                        <span className="font-extrabold text-slate-800">{progLogs.length} Sessions</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-100">
                        <span className="text-slate-400 font-bold">Unique Movements Loaded</span>
                        <span className="font-extrabold text-slate-800">{uniqueLoggedExercises.length} Movements</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold">Most Active Day</span>
                        <span className="font-extrabold text-blue-600 uppercase">Sunday</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 rounded-2xl bg-blue-50 border border-blue-100 flex gap-3 items-start">
                    <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      All your progress logs reside strictly in local client storage, completely isolated and safe on your device.
                    </p>
                  </div>
                </div>

              </div>

            </div>
          )}
        </div>
      )}

      {/* --- Tab 2: WORKOUT LOGGER FORM --- */}
      {activeTab === "log" && (
        <div className="max-w-3xl mx-auto rounded-[32px] border border-slate-100 bg-white p-6 sm:p-8 shadow-xs relative overflow-hidden animate-fade-in">
          <div className="absolute right-0 top-0 -mr-24 -mt-24 h-64 w-64 bg-blue-500/5 rounded-full blur-3xl" />
          
          <div className="mb-6">
            <span className="text-[10px] uppercase tracking-widest text-blue-600 font-extrabold">New Performance Log</span>
            <h2 className="text-xl font-black text-slate-900 uppercase mt-0.5">Manual Entry Console</h2>
            <p className="text-xs text-slate-500 mt-1">Record dates, movements, sets, and loads to lock in precise strength progress charts.</p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-6">
            
            {/* Meta Row: Date & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Workout Date</label>
                <input
                  type="date"
                  required
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Workout Name / Block</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Upper Body Power, Squat PR day..."
                  value={logTitle}
                  onChange={(e) => setLogTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Dynamic Exercise Logs stack */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Exercises & Sets performed</h3>
                <button
                  type="button"
                  onClick={handleAddFormExercise}
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-600 hover:underline"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add Exercise
                </button>
              </div>

              <div className="space-y-4">
                {formExercises.map((ex, exIdx) => (
                  <div 
                    key={exIdx}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 relative"
                  >
                    {/* Delete exercise button */}
                    {formExercises.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFormExercise(exIdx)}
                        className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                        title="Remove Exercise"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Ex Selection */}
                    <div className="w-full sm:max-w-md space-y-2">
                      <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Select Exercise</label>
                      <select
                        value={ex.exerciseName}
                        onChange={(e) => handleFormExNameChange(exIdx, e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500 shadow-xs"
                      >
                        {DEFAULT_DEMOS.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                        {/* Custom types supported */}
                        <option value="Dumbbell Bicep Curls">Dumbbell Bicep Curls</option>
                        <option value="Dumbbell Shoulder Press">Dumbbell Shoulder Press</option>
                        <option value="Bodyweight Pull-ups">Bodyweight Pull-ups</option>
                        <option value="Kettlebell Swings">Kettlebell Swings</option>
                      </select>
                    </div>

                    {/* Sets headers and rows */}
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="grid grid-cols-12 gap-3 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                        <div className="col-span-2">Set</div>
                        <div className="col-span-4">Reps Done</div>
                        <div className="col-span-4">Weight (lbs)</div>
                        <div className="col-span-2 text-center">Delete</div>
                      </div>

                      {/* Set Inputs */}
                      <div className="space-y-2">
                        {ex.sets.map((set, setIdx) => (
                          <div 
                            key={setIdx}
                            className="grid grid-cols-12 gap-3 items-center"
                          >
                            <div className="col-span-2 text-xs font-bold text-slate-700 font-mono pl-1">
                              #{setIdx + 1}
                            </div>
                            
                            <div className="col-span-4">
                              <input
                                type="number"
                                required
                                min="0"
                                value={set.reps}
                                onChange={(e) => handleFormSetChange(exIdx, setIdx, "reps", parseInt(e.target.value) || 0)}
                                className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 font-semibold focus:outline-hidden focus:border-blue-500 shadow-xs"
                              />
                            </div>

                            <div className="col-span-4">
                              <input
                                type="number"
                                required
                                min="0"
                                placeholder="0 for bodyweight"
                                value={set.weight}
                                onChange={(e) => handleFormSetChange(exIdx, setIdx, "weight", parseFloat(e.target.value) || 0)}
                                className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 font-semibold focus:outline-hidden focus:border-blue-500 shadow-xs"
                              />
                            </div>

                            <div className="col-span-2 flex justify-center">
                              <button
                                type="button"
                                disabled={ex.sets.length <= 1}
                                onClick={() => handleRemoveFormSet(exIdx, setIdx)}
                                className="p-1.5 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddFormSet(exIdx)}
                        className="text-[10px] font-extrabold text-blue-600 hover:underline flex items-center gap-1 mt-1 pl-1"
                      >
                        <Plus className="h-3 w-3" /> Add Set
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>

            {/* Feelings & Notes */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Session Feel</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(["Energetic", "Tired", "Satisfied", "Sore", "Exhausted"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setLogFeeling(opt)}
                      className={`py-2 px-1 rounded-xl border text-xs font-bold text-center transition-all ${
                        logFeeling === opt
                          ? "border-blue-600 bg-blue-50/50 text-slate-900 shadow-xs"
                          : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Training Notes (Optional)</label>
                <textarea
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="Record settings, barbell speed, recovery state, or physical performance details..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-800 transition-all text-center shadow-md"
              id="btn-log-session-submit"
            >
              COMMIT SESSION LOG TO REGISTRY
            </button>

          </form>
        </div>
      )}

      {/* --- Tab 3: SESSION HISTORY LIST --- */}
      {activeTab === "history" && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Detailed Sessions registry ({progLogs.length})</h2>
          
          {progLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white border border-slate-100 rounded-2xl shadow-xs">
              No sessions tracked yet. Create one above!
            </div>
          ) : (
            <div className="space-y-3">
              {progLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div 
                    key={log.id}
                    className={`rounded-2xl border transition-all shadow-xs bg-white ${
                      isExpanded 
                        ? "border-blue-600 ring-1 ring-blue-600/10" 
                        : "border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    
                    {/* Collapsed Header Bar */}
                    <div 
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base tracking-tight truncate max-w-xs sm:max-w-md">
                            {log.workoutTitle}
                          </h3>
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-600 uppercase">
                            {log.feeling}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2.5 text-[11px] text-slate-400 font-semibold">
                          <span>📅 {new Date(log.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
                          <span>•</span>
                          <span>🏋️ {log.exercises.length} Movements Logged</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLog(log.id);
                          }}
                          className="p-2 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all"
                          title="Delete entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        
                        <div className="text-slate-400">
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail area */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-4">
                        
                        {log.notes && (
                          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3.5 border border-slate-150 italic">
                            &ldquo;{log.notes}&rdquo;
                          </div>
                        )}

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Movement Loadouts</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {log.exercises.map((ex, exIdx) => (
                              <div key={exIdx} className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2">
                                <span className="text-xs font-extrabold text-slate-800 block pb-1 border-b border-slate-200">
                                  {ex.exerciseName}
                                </span>
                                
                                <div className="space-y-1 text-xs">
                                  {ex.sets.map((set, setIdx) => (
                                    <div key={setIdx} className="flex justify-between items-center text-slate-500 font-mono text-[11px]">
                                      <span>Set #{setIdx + 1}</span>
                                      <span className="font-bold text-slate-800">
                                        {set.reps} reps {set.weight > 0 ? `@ ${set.weight} lbs` : "• Bodyweight"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
