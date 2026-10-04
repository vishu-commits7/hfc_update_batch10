import { WorkoutLog } from "../types";
import { ArrowLeft, Trash2, Calendar, Award, Flame, Smile, BarChart2 } from "lucide-react";
import gymHeroImg from "../assets/ui/gym-hero-dashboard.jpg";

interface HistoryLogsProps {
  logs: WorkoutLog[];
  onBack: () => void;
  onClearLogs: () => void;
  onDeleteLog: (id: string) => void;
}

export default function HistoryLogs({ logs, onBack, onClearLogs, onDeleteLog }: HistoryLogsProps) {
  
  // Calculate total statistics
  const totalWorkouts = logs.length;
  const totalMinutes = logs.reduce((acc, log) => acc + log.durationMinutes, 0);
  const totalCalories = logs.reduce((acc, log) => acc + log.estimatedCaloriesBurned, 0);

  // Group feelings for simple visualization
  const feelingCounts = logs.reduce((acc, log) => {
    acc[log.feeling] = (acc[log.feeling] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in text-slate-800 pb-12" id="history-logs-view">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="group flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs"
            title="Back to Dashboard"
            id="btn-history-back"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-blue-600 font-extrabold">Training Registry</span>
            <h1 className="font-sans text-2xl font-black tracking-tight text-slate-900 uppercase">Workout Log History</h1>
          </div>
        </div>

        {logs.length > 0 && (
          <button
            onClick={() => {
              if (confirm("Are you sure you want to clear your entire fitness history? This will reset your metrics.")) {
                onClearLogs();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all"
            id="btn-clear-all-history"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </button>
        )}
      </div>
 
      {/* Motivational Hero Banner */}
      <div className="relative mb-8 overflow-hidden rounded-[24px] bg-slate-950 border border-slate-800 shadow-lg">
        <div className="absolute inset-0">
          <img src={gymHeroImg} alt="Motivational Gym" className="h-full w-full object-cover object-[70%_25%] opacity-80" draggable={false} />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 0%, color-mix(in srgb, var(--carbon) 70%, transparent) 55%, transparent 100%" />
        </div>
        <div className="relative z-10 max-w-[70%] px-5 py-6 sm:max-w-[60%] sm:px-7 sm:py-7">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Consistency Ledger</span>
          <h2 className="mt-1 font-display text-xl font-black tracking-tight text-white sm:text-2xl">Every Rep Builds The Legend</h2>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            {logs.length > 0 
              ? `${logs.length} sessions logged into your athletic legacy. Keep the momentum alive.`
              : "Complete your first workout to stamp your mark on your fitness journey."}
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-[32px] border border-slate-100 bg-white p-12 text-center max-w-xl mx-auto shadow-xs">
          <Calendar className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-900 tracking-wide uppercase">No Logged Sessions Found</h3>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Every completed home workout session you save will be recorded here with active stats, physical notes, and calorie logs.
          </p>
          <button
            onClick={onBack}
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white font-bold px-6 py-3 text-sm hover:bg-slate-800 transition-all"
            id="btn-back-from-empty-history"
          >
            Back to Dashboard
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold block">Total Sessions</span>
                <span className="text-3xl font-black text-slate-900 mt-1 block">{totalWorkouts}</span>
              </div>
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                <Award className="h-6 w-6" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold block">Total Effort</span>
                <span className="text-3xl font-black text-slate-900 mt-1 block">{totalMinutes} Mins</span>
              </div>
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                <BarChart2 className="h-6 w-6" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold block">Est. Calories</span>
                <span className="text-3xl font-black text-blue-600 mt-1 block">{totalCalories} kcal</span>
              </div>
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                <Flame className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Simple feelings stats panel */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4 text-blue-600">
              <Smile className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Training Feel Distribution</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(["Energetic", "Satisfied", "Sore", "Tired", "Exhausted"] as const).map((feel) => {
                const count = feelingCounts[feel] || 0;
                const percentage = totalWorkouts > 0 ? Math.round((count / totalWorkouts) * 100) : 0;
                return (
                  <div key={feel} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <span className="text-lg block">
                      {feel === "Energetic" && "⚡"}
                      {feel === "Satisfied" && "😊"}
                      {feel === "Sore" && "🩹"}
                      {feel === "Tired" && "🥱"}
                      {feel === "Exhausted" && "🥵"}
                    </span>
                    <span className="text-xs font-bold text-slate-800 block mt-1">{feel}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{count} ({percentage}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Log List */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Saved Sessions log ({logs.length})</h2>
            
            <div className="space-y-3">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="rounded-2xl border border-slate-100 bg-white p-5 hover:border-slate-200 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  id={`history-log-item-${log.id}`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                        {log.workoutTitle}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-600 uppercase">
                        {log.feeling}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        📅 {new Date(log.completedAt).toLocaleDateString(undefined, { 
                          year: "numeric", 
                          month: "long", 
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                      <span>•</span>
                      <span>⏱️ {log.durationMinutes} mins</span>
                      <span>•</span>
                      <span>🔥 {log.estimatedCaloriesBurned} kcal burned</span>
                    </div>

                    {log.userNotes && (
                      <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5 mt-2 border border-slate-100 italic">
                        &ldquo;{log.userNotes}&rdquo;
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => onDeleteLog(log.id)}
                    className="self-end sm:self-center p-2 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all"
                    title="Delete log"
                    id={`btn-delete-log-${log.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
