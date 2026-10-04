import { useState, useMemo } from "react";
import {
  Activity,
  BatteryCharging,
  Flame,
  Shield,
  Droplets,
  Zap,
  ChevronRight,
  Sparkles,
  Info,
} from "lucide-react";
import { WorkoutLog, UserProfile } from "../types";
import { tapFeedback, successFeedback } from "../lib/haptics";

interface BiometricRecoveryHubProps {
  logs: WorkoutLog[];
  profile: UserProfile;
  onNavigateToWorkout?: () => void;
  onClose?: () => void;
}

export default function BiometricRecoveryHub({
  logs,
  profile,
  onNavigateToWorkout,
  onClose,
}: BiometricRecoveryHubProps) {
  const [hydrationCount, setHydrationCount] = useState<number>(() => {
    try {
      const today = new Date().toDateString();
      const saved = localStorage.getItem(`apex_hydration_${today}`);
      return saved ? parseInt(saved, 10) : 4;
    } catch {
      return 4;
    }
  });

  const [shieldActive, setShieldActive] = useState<boolean>(() => {
    return localStorage.getItem("apex_streak_shield_equipped") !== "false";
  });

  const [showTooltip, setShowTooltip] = useState(false);

  // Compute Daily Strain (0.0 to 21.0) and Recovery Score (0% to 100%)
  const { strainScore, recoveryScore, muscleStatus, advice } = useMemo(() => {
    const today = new Date().toDateString();
    const todayLogs = logs.filter((l) => new Date(l.completedAt).toDateString() === today);

    // Calculate strain based on duration, calories & heart zones
    const todayMinutes = todayLogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
    const todayCals = todayLogs.reduce((acc, l) => acc + (l.estimatedCaloriesBurned || 0), 0);

    // Whoop/Athlytic logarithmic formula: 0 to 21 max
    let strain = 0;
    if (todayMinutes > 0) {
      strain = Math.min(
        21.0,
        Math.round((Math.log10(todayMinutes * 2 + todayCals / 15 + 1) * 6.5) * 10) / 10
      );
    } else {
      strain = 2.4; // Base resting metabolic strain
    }

    // Days since last workout
    const lastLog = logs[0];
    const hoursSinceLast = lastLog
      ? (Date.now() - new Date(lastLog.completedAt).getTime()) / (1000 * 60 * 60)
      : 72;

    // Recovery score improves with rest, drops right after intense session
    let rec = 88;
    if (hoursSinceLast < 12) {
      rec = Math.max(45, Math.round(55 + (hoursSinceLast / 12) * 20));
    } else if (hoursSinceLast < 24) {
      rec = Math.round(75 + ((hoursSinceLast - 12) / 12) * 18);
    } else if (hoursSinceLast < 48) {
      rec = 94; // Peak supercompensation
    } else {
      rec = Math.max(70, Math.round(94 - ((hoursSinceLast - 48) / 24) * 5)); // gradual atrophy
    }

    // Check muscle groups targeted in past 48 hours
    const recentLogs = logs.filter(
      (l) => (Date.now() - new Date(l.completedAt).getTime()) / (1000 * 60 * 60) <= 48
    );
    const recentNames = recentLogs.map((l) => l.workoutTitle.toLowerCase()).join(" ");

    const chestRec = recentNames.includes("upper") || recentNames.includes("push") ? 58 : 96;
    const backRec = recentNames.includes("pull") || recentNames.includes("back") ? 62 : 94;
    const legsRec = recentNames.includes("lower") || recentNames.includes("leg") ? 50 : 98;
    const coreRec = recentNames.includes("core") || recentNames.includes("abs") ? 65 : 92;
    const armsRec = recentNames.includes("arm") || recentNames.includes("bicep") ? 55 : 95;

    let coachAdvice = "";
    if (rec >= 85) {
      coachAdvice = "Your nervous system & biometrics are fully primed. Maximum hypertrophy & PR intensity unlocked today!";
    } else if (rec >= 65) {
      coachAdvice = "Moderate muscular fatigue detected. Maintain controlled form with moderate volume or HIIT.";
    } else {
      coachAdvice = "Deep muscular repair active. Prioritize hydration, 8+ hours sleep and light mobility stretching.";
    }

    return {
      strainScore: strain,
      recoveryScore: rec,
      muscleStatus: [
        { name: "Legs & Quads", pct: legsRec },
        { name: "Chest & Shoulders", pct: chestRec },
        { name: "Back & Lats", pct: backRec },
        { name: "Core & Abs", pct: coreRec },
        { name: "Arms & Grip", pct: armsRec },
      ],
      advice: coachAdvice,
    };
  }, [logs]);

  const handleAddWater = () => {
    tapFeedback();
    const next = hydrationCount + 1;
    setHydrationCount(next);
    const today = new Date().toDateString();
    localStorage.setItem(`apex_hydration_${today}`, next.toString());
  };

  const handleToggleShield = () => {
    tapFeedback();
    const next = !shieldActive;
    setShieldActive(next);
    localStorage.setItem("apex_streak_shield_equipped", String(next));
    if (next) successFeedback();
  };

  const getRecoveryColor = (score: number) => {
    if (score >= 80) return "from-emerald-400 to-cyan-400 text-emerald-400";
    if (score >= 60) return "from-amber-400 to-yellow-400 text-amber-400";
    return "from-rose-500 to-orange-500 text-rose-400";
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <BatteryCharging className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight text-white">Biometric Readiness</h2>
              <span className="rounded-full bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 text-[9px] font-black uppercase text-cyan-300">
                PRO APEX
              </span>
            </div>
            <p className="text-xs text-slate-400">Whoop-Grade Strain & Supercompensation Engine</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Primary Battery & Strain Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Recovery Score Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-black/90 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-cyan-400" /> Physical Recovery
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full border border-white/10 bg-white/5 ${
                recoveryScore >= 80 ? "text-emerald-400" : recoveryScore >= 60 ? "text-amber-400" : "text-rose-400"
              }`}
            >
              {recoveryScore >= 80 ? "Peak State" : recoveryScore >= 60 ? "Steady" : "Tired"}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className={`text-5xl font-black tracking-tight bg-gradient-to-r ${getRecoveryColor(
                recoveryScore
              )} bg-clip-text text-transparent`}
            >
              {recoveryScore}%
            </span>
            <span className="text-xs font-bold text-slate-400">Readiness</span>
          </div>

          {/* Liquid Battery Bar */}
          <div className="mt-4 relative h-3.5 w-full rounded-full bg-slate-800/80 overflow-hidden border border-white/10">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${getRecoveryColor(
                recoveryScore
              )} transition-all duration-1000 shadow-[0_0_15px_rgba(6,182,212,0.5)]`}
              style={{ width: `${recoveryScore}%` }}
            />
          </div>

          <p className="mt-3 text-xs text-slate-300 font-medium leading-relaxed">
            {advice}
          </p>
        </div>

        {/* Daily Strain Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-black/90 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-400" /> Daily Strain
            </span>
            <button
              onClick={() => setShowTooltip(!showTooltip)}
              className="text-slate-400 hover:text-white"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
              {strainScore.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-slate-400">/ 21.0 Max</span>
          </div>

          {/* Strain Progress Ring / Bar */}
          <div className="mt-4 relative h-3.5 w-full rounded-full bg-slate-800/80 overflow-hidden border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 transition-all duration-1000 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
              style={{ width: `${Math.min(100, (strainScore / 21) * 100)}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Target: 14.0 - 18.0 (Optimal Overload)</span>
            <span className="font-bold text-amber-300">
              {strainScore > 14 ? "🔥 Target Reached" : "⚡ Ready to Train"}
            </span>
          </div>
        </div>
      </div>

      {/* Muscle Group Recovery Bars */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-xl">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-cyan-400" /> Muscle Group Supercompensation
        </h3>

        <div className="space-y-3">
          {muscleStatus.map((m) => (
            <div key={m.name} className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">{m.name}</span>
                <span
                  className={
                    m.pct >= 85
                      ? "text-emerald-400"
                      : m.pct >= 60
                      ? "text-amber-400"
                      : "text-rose-400"
                  }
                >
                  {m.pct}% {m.pct >= 85 ? "Recovered" : "Repairing"}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    m.pct >= 85
                      ? "bg-gradient-to-r from-emerald-500 to-cyan-400"
                      : m.pct >= 60
                      ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                      : "bg-gradient-to-r from-rose-500 to-orange-400"
                  }`}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gamified Habit Rituals: Streak Shield & Hydration Drops */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Streak Shield Protection */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-black p-5 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
              shieldActive
                ? "border-cyan-500/40 bg-cyan-950/50 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                : "border-white/10 bg-white/5 text-slate-500"
            }`}>
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Beast Streak Shield ({profile.streakDays}d Streak)</p>
              <p className="text-xs text-slate-400">
                {shieldActive ? "Active: Streak protected" : "Shield unequipped"}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleShield}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
              shieldActive
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            {shieldActive ? "Equipped" : "Equip"}
          </button>
        </div>

        {/* Daily Hydration Logger */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-black p-5 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/40 bg-blue-950/50 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              <Droplets className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black text-white">{hydrationCount * 250}ml Hydrated</p>
              <p className="text-xs text-slate-400">{hydrationCount} / 12 Glasses Target</p>
            </div>
          </div>

          <button
            onClick={handleAddWater}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-black transition hover:bg-blue-600/40 active:scale-95"
          >
            <span>+250ml</span>
          </button>
        </div>
      </div>

      {/* Fast CTA */}
      {onNavigateToWorkout && (
        <button
          onClick={onNavigateToWorkout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 py-4 font-black uppercase tracking-wider text-white shadow-xl shadow-cyan-500/20 transition hover:brightness-110 active:scale-98"
        >
          <Sparkles className="h-5 w-5" />
          <span>Launch Today's Optimized Beast Protocol</span>
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
