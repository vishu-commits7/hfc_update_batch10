import { useState, useMemo } from "react";
import {
  Activity,
  BatteryCharging,
  Flame,
  Shield,
  Droplets,
  Zap,
  ChevronRight,
  Info,
} from "lucide-react";
import { WorkoutLog, UserProfile } from "../types";
import { tapFeedback, successFeedback } from "../lib/haptics";

export interface BiometricsData {
  strainScore: number;
  recoveryScore: number;
  muscleStatus: Array<{ name: string; pct: number }>;
  advice: string;
}

export function computeBiometrics(logs: WorkoutLog[]): BiometricsData {
  const today = new Date().toDateString();
  const todayLogs = logs.filter((l) => new Date(l.completedAt).toDateString() === today);

  const todayMinutes = todayLogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  const todayCals = todayLogs.reduce((acc, l) => acc + (l.estimatedCaloriesBurned || 0), 0);

  let strain = 0;
  if (todayMinutes > 0) {
    strain = Math.min(
      21.0,
      Math.round((Math.log10(todayMinutes * 2 + todayCals / 15 + 1) * 6.5) * 10) / 10
    );
  } else {
    strain = 2.4;
  }

  const lastLog = logs[0];
  const hoursSinceLast = lastLog
    ? (Date.now() - new Date(lastLog.completedAt).getTime()) / (1000 * 60 * 60)
    : 72;

  let rec = 88;
  if (hoursSinceLast < 12) {
    rec = Math.max(45, Math.round(55 + (hoursSinceLast / 12) * 20));
  } else if (hoursSinceLast < 24) {
    rec = Math.round(75 + ((hoursSinceLast - 12) / 12) * 18);
  } else if (hoursSinceLast < 48) {
    rec = 94;
  } else {
    rec = Math.max(70, Math.round(94 - ((hoursSinceLast - 48) / 24) * 5));
  }

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
    coachAdvice = "Body is primed for maximum intensity today.";
  } else if (rec >= 65) {
    coachAdvice = "Moderate fatigue detected. Steady volume recommended.";
  } else {
    coachAdvice = "Recovery phase active. Focus on rest and hydration.";
  }

  return {
    strainScore: strain,
    recoveryScore: rec,
    muscleStatus: [
      { name: "Legs", pct: legsRec },
      { name: "Chest", pct: chestRec },
      { name: "Back", pct: backRec },
      { name: "Core", pct: coreRec },
      { name: "Arms", pct: armsRec },
    ],
    advice: coachAdvice,
  };
}

export function getRecoveryColor(score: number) {
  if (score >= 80) return "from-emerald-400 to-cyan-400 text-emerald-400";
  if (score >= 60) return "from-amber-400 to-yellow-400 text-amber-400";
  return "from-rose-500 to-orange-500 text-rose-400";
}

/**
 * Clean, compact glanceable card for the Dashboard.
 */
export function BiometricSummaryCard({
  logs,
  onOpenFull,
}: {
  logs: WorkoutLog[];
  onOpenFull: () => void;
}) {
  const { strainScore, recoveryScore, advice } = useMemo(() => computeBiometrics(logs), [logs]);

  return (
    <div
      onClick={() => {
        tapFeedback();
        onOpenFull();
      }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-line bg-carbon p-5 shadow-md backdrop-blur-xl transition hover:border-line cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-graphite text-cyan-400 shadow-sm">
            <BatteryCharging className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-ink">Daily Readiness</h3>
            <p className="text-[11px] text-ink-3">Training Readiness (Estimated)</p>
          </div>
        </div>

        <span
          className={`rounded-full border border-line bg-graphite px-2.5 py-0.5 text-[11px] font-bold ${
            recoveryScore >= 80 ? "text-emerald-400" : recoveryScore >= 60 ? "text-amber-400" : "text-rose-400"
          }`}
        >
          {recoveryScore >= 80 ? "Peak State" : recoveryScore >= 60 ? "Steady" : "Rest Mode"}
        </span>
      </div>

      <div className="my-3.5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-4">Readiness</p>
          <p className={`mt-0.5 text-2xl font-black bg-gradient-to-r ${getRecoveryColor(recoveryScore)} bg-clip-text text-transparent`}>
            {recoveryScore}%
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-graphite overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${getRecoveryColor(recoveryScore)}`}
              style={{ width: `${recoveryScore}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-4">Daily Strain</p>
          <p className="mt-0.5 text-2xl font-black text-amber-400">
            {strainScore.toFixed(1)} <span className="text-[11px] font-normal text-ink-4">/ 21</span>
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-graphite overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
              style={{ width: `${Math.min(100, (strainScore / 21) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-ink-3 gap-2">
        <span className="text-ink-2 font-medium leading-snug line-clamp-2">{advice}</span>
        <span className="flex items-center gap-0.5 text-cyan-400 font-bold shrink-0 group-hover:translate-x-0.5 transition-transform">
          Details <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

interface BiometricRecoveryHubProps {
  logs: WorkoutLog[];
  profile: UserProfile;
  onNavigateToWorkout?: () => void;
  onClose?: () => void;
}

export default function BiometricRecoveryHub({
  logs,
  profile: _profile,
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

  const { strainScore, recoveryScore, muscleStatus, advice } = useMemo(
    () => computeBiometrics(logs),
    [logs]
  );

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

  return (
    <div className="space-y-5 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-sm">
            <BatteryCharging className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-ink">Biometric Readiness</h2>
            <p className="text-xs text-ink-3">Daily Recovery & Strain</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-graphite border border-line text-ink-3 hover:text-ink"
          >
            ✕
          </button>
        )}
      </div>

      {/* Primary Battery & Strain Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Recovery Score Card */}
        <div className="rounded-2xl border border-line bg-carbon/90 p-4 shadow-md backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-cyan-400" /> Recovery
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full border border-line bg-graphite ${
                recoveryScore >= 80 ? "text-emerald-400" : recoveryScore >= 60 ? "text-amber-400" : "text-rose-400"
              }`}
            >
              {recoveryScore >= 80 ? "Peak State" : recoveryScore >= 60 ? "Steady" : "Tired"}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className={`text-4xl font-black tracking-tight bg-gradient-to-r ${getRecoveryColor(
                recoveryScore
              )} bg-clip-text text-transparent`}
            >
              {recoveryScore}%
            </span>
            <span className="text-xs font-semibold text-ink-3">Readiness</span>
          </div>

          <div className="mt-3 relative h-2.5 w-full rounded-full bg-graphite overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${getRecoveryColor(
                recoveryScore
              )} transition-all duration-700`}
              style={{ width: `${recoveryScore}%` }}
            />
          </div>

          <p className="mt-2.5 text-xs text-ink-2 font-medium leading-relaxed">
            {advice}
          </p>
        </div>

        {/* Daily Strain Card */}
        <div className="rounded-2xl border border-line bg-carbon/90 p-4 shadow-md backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-400" /> Daily Strain
            </span>
            <button
              onClick={() => setShowTooltip(!showTooltip)}
              className="text-ink-4 hover:text-ink"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tight text-amber-400">
              {strainScore.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-ink-3">/ 21.0 Max</span>
          </div>

          <div className="mt-3 relative h-2.5 w-full rounded-full bg-graphite overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
              style={{ width: `${Math.min(100, (strainScore / 21) * 100)}%` }}
            />
          </div>

          <p className="mt-2.5 text-xs text-ink-3 font-medium">
            {strainScore > 14 ? "Target strain achieved" : "Ready to train today"}
          </p>
        </div>
      </div>

      {/* Muscle Group Recovery Bars */}
      <div className="rounded-2xl border border-line bg-carbon/80 p-4 shadow-md backdrop-blur">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-2 mb-3 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-cyan-400" /> Muscle Group Readiness
        </h3>

        <div className="space-y-2.5">
          {muscleStatus.map((m) => (
            <div key={m.name} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-ink-2">{m.name}</span>
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
              <div className="h-1.5 w-full rounded-full bg-graphite overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
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

      {/* Habit Rituals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Streak Shield Protection */}
        <div className="rounded-2xl border border-line bg-carbon/80 p-4 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                shieldActive
                  ? "border-cyan-500/40 bg-cyan-950/40 text-cyan-400"
                  : "border-line bg-graphite text-ink-4"
              }`}
            >
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Streak Shield</p>
              <p className="text-[11px] text-ink-3">
                {shieldActive ? "Streak protected" : "Shield unequipped"}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleShield}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition active:scale-95 ${
              shieldActive
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-graphite text-white hover:bg-graphite"
            }`}
          >
            {shieldActive ? "Equipped" : "Equip"}
          </button>
        </div>

        {/* Daily Hydration Logger */}
        <div className="rounded-2xl border border-line bg-carbon/80 p-4 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-950/40 text-blue-400">
              <Droplets className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">{hydrationCount * 250}ml Hydrated</p>
              <p className="text-[11px] text-ink-3">{hydrationCount} / 12 Glasses</p>
            </div>
          </div>

          <button
            onClick={handleAddWater}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold transition hover:bg-blue-600/40 active:scale-95"
          >
            <span>+250ml</span>
          </button>
        </div>
      </div>

    </div>
  );
}
