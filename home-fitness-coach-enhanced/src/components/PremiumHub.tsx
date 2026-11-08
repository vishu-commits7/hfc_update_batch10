import React, { memo, useEffect, useMemo, useState } from "react";
import {
  Activity, CalendarDays, ChevronRight, ChevronLeft,
  Dumbbell, HeartPulse, RotateCcw,
  Sparkles, Trophy, Zap,
  Calculator, Droplets, Wind, LayoutGrid, PlusCircle, MinusCircle
} from "lucide-react";
import { UserProfile, Workout, WorkoutLog, ProgressLog, ProgramPlan } from "../types";
import { PROGRAM_PLANS, CURATED_WORKOUTS } from "../constants";
import { ACHIEVEMENTS, computeUnlockedAchievements } from "../lib/achievements";
import { AchievementBadgeIcon } from "./ui/AchievementBadgeIcon";
import { calculateBMI, bmiCategory, calculateTDEE, ACTIVITY_LABELS, todayKey } from "../lib/wellness";
import { tapFeedback } from "../lib/haptics";
import progFoundation from "../assets/coaches/coach-core-male.jpg";
import progStrength from "../assets/ui/gym-upper-body.jpg";
import progCardio from "../assets/ui/gym-hiit-beast.jpg";
import progMobility from "../assets/coaches/coach-mobility-male.jpg";
import gymPremiumBeast from "../assets/ui/gym-premium-beast.jpg";

const PROGRAM_COVER: Record<string, string> = {
  prog_foundation: progFoundation,
  prog_strength: progStrength,
  prog_cardio: progCardio,
  prog_mobility: progMobility,
};

/** Aspirational gradient fallbacks for program cards without a cover photo */
const PROGRAM_GRADIENTS: string[] = [
  "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
  "linear-gradient(135deg, #1a0533 0%, #2d1b69 50%, #11998e 100%)",
  "linear-gradient(135deg, #16213e 0%, #0f3460 50%, #533483 100%)",
  "linear-gradient(135deg, #0a0a0a 0%, #1b2838 50%, #2b5329 100%)",
  "linear-gradient(135deg, #200122 0%, #6f0000 100%)",
  "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
];

type PremiumHubProps = {
  isPremium?: boolean;
  onTogglePremium?: (value: boolean) => void;
  profile?: UserProfile;
  setProfile?: React.Dispatch<React.SetStateAction<UserProfile>>;
  logs?: WorkoutLog[];
  favorites?: string[];
  onStartWorkout?: (workout: Workout) => void;
};

const QUICK = [
  { title: "10m Reset", meta: "Mobility · Easy", icon: RotateCcw, curatedIndex: 5 },
  { title: "15m Full Body", meta: "Strength · Beginner", icon: Dumbbell, curatedIndex: 0 },
  { title: "20m Cardio", meta: "HIIT · Moderate", icon: Activity, curatedIndex: 4 },
  { title: "30m Strength", meta: "Hypertrophy · Solid", icon: Trophy, curatedIndex: 3 },
];

/* -------------------- Native Mobile Slider & Stepper -------------------- */

function MetricSliderStepper({
  label,
  value,
  min,
  max,
  unit,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  step?: number;
  onChange: (val: number) => void;
}) {
  const displayVal = value || min;

  const decrement = () => {
    tapFeedback();
    onChange(Math.max(min, displayVal - step));
  };

  const increment = () => {
    tapFeedback();
    onChange(Math.min(max, displayVal + step));
  };

  return (
    <div className="rounded-2xl border border-line bg-void/70 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wider text-ink-2">{label}</span>
        <div className="flex items-baseline gap-1">
          <span className="text-base font-numeric font-black text-ink">{displayVal}</span>
          <span className="text-[11px] font-bold text-ink-3">{unit}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={decrement}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-graphite text-ink-2 active:scale-90 transition hover:bg-graphite hover:text-ink"
          aria-label={`Decrease ${label}`}
        >
          <MinusCircle className="h-4 w-4 text-cyan-400" />
        </button>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={displayVal}
          onChange={(e) => {
            onChange(Number(e.target.value));
          }}
          className="h-2 w-full flex-1 cursor-pointer appearance-none rounded-lg bg-graphite accent-cyan-400"
        />

        <button
          type="button"
          onClick={increment}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-graphite text-ink-2 active:scale-90 transition hover:bg-graphite hover:text-ink"
          aria-label={`Increase ${label}`}
        >
          <PlusCircle className="h-4 w-4 text-cyan-400" />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- Toolkit Section ---------------------------- */

function ToolkitSection({ profile, setProfile }: { profile?: UserProfile; setProfile?: React.Dispatch<React.SetStateAction<UserProfile>> }) {
  const p = profile;
  const [heightCm, setHeightCm] = useState(p?.heightCm ?? 175);
  const [weightKg, setWeightKg] = useState(p?.weightKg ?? 70);
  const [age, setAge] = useState(p?.age ?? 25);
  const [gender, setGender] = useState<"male" | "other">((p?.gender as string) === "female" ? "other" : (p?.gender ?? "male"));
  const [activityLevel, setActivityLevel] = useState(p?.activityLevel ?? "moderate");

  const [water, setWater] = useState(0);
  const [waterGoal] = useState(8);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kinetic_water_intake");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.date === todayKey()) setWater(parsed.glasses);
        else setWater(0);
      }
    } catch {}
  }, []);

  const setWaterAndSave = (n: number) => {
    tapFeedback();
    const clamped = Math.max(0, Math.min(20, n));
    setWater(clamped);
    localStorage.setItem("kinetic_water_intake", JSON.stringify({ date: todayKey(), glasses: clamped }));
  };

  const saveMetrics = () => {
    tapFeedback();
    setProfile?.(prev => ({ ...prev, heightCm, weightKg, age, gender, activityLevel }));
  };

  const bmi = calculateBMI(heightCm, weightKg);
  const cat = bmiCategory(bmi);
  const tdee = calculateTDEE({ heightCm, weightKg, age, gender, activityLevel });

  // Breathing timer state
  const [breathPhase, setBreathPhase] = useState<"idle" | "in" | "hold1" | "out" | "hold2">("idle");
  const [breathSecondsLeft, setBreathSecondsLeft] = useState(4);
  const [breathCycles, setBreathCycles] = useState(0);

  useEffect(() => {
    if (breathPhase === "idle") return;
    const id = setInterval(() => {
      setBreathSecondsLeft(s => {
        if (s > 1) return s - 1;
        setBreathPhase(prev => {
          if (prev === "in") return "hold1";
          if (prev === "hold1") return "out";
          if (prev === "out") return "hold2";
          setBreathCycles(c => c + 1);
          return "in";
        });
        return 4;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [breathPhase]);

  const breathLabel: Record<string, string> = { idle: "Ready", in: "Inhale", hold1: "Hold", out: "Exhale", hold2: "Hold" };
  const breathScale = breathPhase === "in" ? 1.3 : breathPhase === "out" ? 0.8 : breathPhase === "hold1" ? 1.3 : breathPhase === "hold2" ? 0.8 : 1;

  return (
    <div className="space-y-4" id="hub-toolkit">
      {/* Box Breathing */}
      <div className="rounded-3xl border border-line bg-carbon/80 p-5 text-ink shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
              <Wind className="h-4 w-4"/>
            </span>
            <div>
              <h3 className="text-sm font-black text-ink">Box Breathing</h3>
              <p className="text-[11px] text-ink-2">4-4-4-4 parasympathetic nerve recovery</p>
            </div>
          </div>
          {breathCycles > 0 && <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 text-[11px] font-bold text-cyan-300">{breathCycles} cycles</span>}
        </div>

        <div className="mt-5 flex flex-col items-center justify-center gap-4 py-2">
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-cyan-400/50 bg-cyan-500/10 text-center transition-transform duration-[1000ms] ease-in-out shadow-[0_0_20px_rgba(6,182,212,0.15)]"
            style={{ transform: `scale(${breathScale})` }}
          >
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-cyan-300">{breathLabel[breathPhase]}</p>
              {breathPhase !== "idle" && <p className="text-xl font-numeric font-black text-ink">{breathSecondsLeft}s</p>}
            </div>
          </div>
          <button
            onClick={() => {
              tapFeedback();
              setBreathPhase(breathPhase === "idle" ? "in" : "idle");
              setBreathSecondsLeft(4);
            }}
            className={`rounded-full px-6 py-2.5 text-xs font-black transition-all ${
              breathPhase === "idle"
                ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
                : "bg-graphite text-white hover:bg-graphite"
            }`}
          >
            {breathPhase === "idle" ? "Start Breathing" : "Stop"}
          </button>
        </div>
      </div>

      {/* Water Tracker */}
      <div className="rounded-3xl border border-line bg-carbon/80 p-5 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
              <Droplets className="h-4 w-4"/>
            </span>
            <div>
              <h3 className="text-sm font-black text-ink">Daily Hydration</h3>
              <p className="text-[11px] text-ink-2">Target: {waterGoal} glasses (250ml each)</p>
            </div>
          </div>
          <span className="text-xs font-numeric font-black text-blue-400">{water} / {waterGoal}</span>
        </div>

        <div className="mt-4 flex items-center justify-center gap-6">
          <button onClick={() => setWaterAndSave(water - 1)} className="rounded-full bg-graphite p-2 text-ink-2 hover:text-ink transition active:scale-95">
            <MinusCircle className="h-6 w-6"/>
          </button>
          <div className="text-center">
            <p className="text-3xl font-numeric font-black text-ink">{water}<span className="text-base text-ink-3">/{waterGoal}</span></p>
            <p className="text-[11px] font-bold text-ink-2">Glasses</p>
          </div>
          <button onClick={() => setWaterAndSave(water + 1)} className="rounded-full bg-blue-500 p-2 text-white hover:bg-blue-400 transition active:scale-95 shadow-md shadow-blue-500/25">
            <PlusCircle className="h-6 w-6"/>
          </button>
        </div>

        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: waterGoal }).map((_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full transition-all ${i < water ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" : "bg-graphite"}`}/>
          ))}
        </div>
      </div>

      {/* Body & Calorie Targets Calculator (Mobile Sliders & Steppers) */}
      <div className="rounded-3xl border border-line bg-carbon/80 p-5 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <Calculator className="h-4 w-4"/>
          </span>
          <div>
            <h3 className="text-sm font-black text-ink">Body &amp; Calorie Targets</h3>
            <p className="text-[11px] text-ink-2">Native step selectors · Calculated on device</p>
          </div>
        </div>

        <div className="space-y-3">
          <MetricSliderStepper
            label="Height"
            value={heightCm}
            min={120}
            max={225}
            unit="cm"
            step={1}
            onChange={(v) => {
              setHeightCm(v);
              setProfile?.(prev => ({ ...prev, heightCm: v }));
            }}
          />

          <MetricSliderStepper
            label="Weight"
            value={weightKg}
            min={40}
            max={180}
            unit="kg"
            step={1}
            onChange={(v) => {
              setWeightKg(v);
              setProfile?.(prev => ({ ...prev, weightKg: v }));
            }}
          />

          <MetricSliderStepper
            label="Age"
            value={age}
            min={14}
            max={85}
            unit="yr"
            step={1}
            onChange={(v) => {
              setAge(v);
              setProfile?.(prev => ({ ...prev, age: v }));
            }}
          />

          {/* Gender Segmented Switcher */}
          <div className="rounded-2xl border border-line bg-void/70 p-3.5 space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-ink-2">Biological Profile</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  setGender("male");
                  setProfile?.(prev => ({ ...prev, gender: "male" }));
                }}
                className={`rounded-xl py-2 text-xs font-black transition ${
                  gender === "male"
                    ? "bg-cyan-500 text-slate-950 shadow-xs"
                    : "bg-graphite text-ink-2 hover:text-white"
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  setGender("other");
                  setProfile?.(prev => ({ ...prev, gender: "other" }));
                }}
                className={`rounded-xl py-2 text-xs font-black transition ${
                  gender === "other"
                    ? "bg-cyan-500 text-slate-950 shadow-xs"
                    : "bg-graphite text-ink-2 hover:text-white"
                }`}
              >
                Female / Other
              </button>
            </div>
          </div>

          {/* Activity Level Selector */}
          <div className="rounded-2xl border border-line bg-void/70 p-3.5 space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-ink-2">Daily Movement Level</span>
            <div className="grid grid-cols-5 gap-1">
              {ACTIVITY_LABELS.map(a => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    setActivityLevel(a.value as any);
                    setProfile?.(prev => ({ ...prev, activityLevel: a.value as any }));
                  }}
                  className={`rounded-lg py-2 text-[11px] font-black transition ${
                    activityLevel === a.value
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-graphite text-ink-2 hover:text-white"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={saveMetrics}
          className="mt-4 w-full rounded-xl bg-graphite hover:bg-graphite py-2.5 text-xs font-black text-ink transition active:scale-98"
        >
          Save &amp; Update Metrics
        </button>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/5 bg-void/70 p-3 text-center">
            <p className="text-[11px] font-black uppercase tracking-wider text-ink-3">BMI</p>
            <p className="mt-0.5 text-xl font-numeric font-black text-ink">{bmi > 0 ? bmi : "—"}</p>
            <p className={`text-[11px] font-bold ${
              cat.color === "blue" ? "text-cyan-400" :
              cat.color === "emerald" ? "text-emerald-400" :
              cat.color === "amber" ? "text-amber-400" :
              cat.color === "rose" ? "text-rose-400" : "text-ink-3"
            }`}>{cat.label}</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-void/70 p-3 text-center">
            <p className="text-[11px] font-black uppercase tracking-wider text-ink-3">Maintenance</p>
            <p className="mt-0.5 text-xl font-numeric font-black text-ink">{tdee > 0 ? tdee : "—"}</p>
            <p className="text-[11px] font-bold text-ink-3">kcal / day</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Programs Section ---------------------------- */

function ProgramsSection({ onStartWorkout }: { onStartWorkout?: (w: Workout) => void }) {
  const [openProgram, setOpenProgram] = useState<ProgramPlan | null>(null);

  return (
    <div className="space-y-4" id="hub-programs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
            <LayoutGrid className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-black text-ink uppercase tracking-wider">Training Programs</h3>
        </div>
        <span className="text-[11px] font-bold text-ink-2">{PROGRAM_PLANS.length} Plans</span>
      </div>

      {!openProgram && (
        <div className="grid gap-3 sm:grid-cols-2">
          {PROGRAM_PLANS.map(prog => (
            <button
              key={prog.id}
              onClick={() => {
                tapFeedback();
                setOpenProgram(prog);
              }}
              className="flex gap-3.5 rounded-3xl border border-line bg-carbon/80 p-4 text-left shadow-xl hover:border-cyan-500/40 transition-all backdrop-blur-xl group overflow-hidden"
            >
              {/* Always render a thumbnail: real photo or branded gradient */}
              <div
                className="h-24 w-20 shrink-0 rounded-2xl border border-line group-hover:scale-105 transition-transform overflow-hidden"
                style={{
                  background: PROGRAM_COVER[prog.id]
                    ? undefined
                    : PROGRAM_GRADIENTS[PROGRAM_PLANS.indexOf(prog) % PROGRAM_GRADIENTS.length],
                }}
              >
                {PROGRAM_COVER[prog.id] && (
                  <img
                    src={PROGRAM_COVER[prog.id]}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                )}
                {!PROGRAM_COVER[prog.id] && (
                  <div className="flex h-full w-full items-end p-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-white/70 leading-tight">
                      {prog.level}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 text-[11px] font-black text-cyan-300">{prog.level}</span>
                  <span className="text-[11px] font-bold text-ink-2">{prog.weeks.length} weeks</span>
                </div>
                <h3 className="mt-2 text-base font-black text-ink truncate">{prog.title}</h3>
                <p className="mt-0.5 text-xs text-ink-2 line-clamp-2">{prog.tagline}</p>
                <div className="mt-2.5 flex items-center gap-1 text-xs font-black text-cyan-400">
                  <span>View Plan</span>
                  <ChevronRight className="h-3.5 w-3.5"/>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {openProgram && (
        <div className="rounded-3xl border border-line bg-carbon/80 p-5 shadow-xl backdrop-blur-xl">
          <button onClick={() => { tapFeedback(); setOpenProgram(null); }} className="flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300">
            <ChevronLeft className="h-4 w-4"/> Back to All Programs
          </button>
          <h3 className="mt-2 text-xl font-black text-ink">{openProgram.title}</h3>
          <p className="mt-0.5 text-xs text-ink-2">{openProgram.tagline}</p>
          <div className="mt-4 space-y-4">
            {openProgram.weeks.map(week => (
              <div key={week.week} className="rounded-2xl border border-white/5 bg-void/60 p-3.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-cyan-400">Week {week.week} · {week.theme}</p>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {week.days.map(day => (
                    <div key={day.day} className="flex items-center justify-between rounded-xl border border-white/5 bg-graphite p-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-ink">{day.title}</p>
                        <p className="text-[11px] text-ink-2">{day.focus}</p>
                      </div>
                      {!day.isRestDay && day.curatedIndex !== undefined && (
                        <button
                          onClick={() => {
                            tapFeedback();
                            onStartWorkout?.(CURATED_WORKOUTS[day.curatedIndex!]);
                          }}
                          className="shrink-0 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-3 py-1.5 text-[11px] font-black text-slate-950 transition active:scale-95 shadow-xs"
                        >
                          Start
                        </button>
                      )}
                      {day.isRestDay && <span className="shrink-0 text-xs font-bold text-ink-2">Rest Day</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Achievements Section ---------------------------- */

function AchievementsSection({ profile, logs, favorites }: { profile?: UserProfile; logs?: WorkoutLog[]; favorites?: string[] }) {
  const progressLogs: ProgressLog[] = useMemo(() => {
    try {
      const saved = localStorage.getItem("kinetic_progress_tracker_logs");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }, [logs]);

  const unlocked = useMemo(
    () => computeUnlockedAchievements(profile ?? {
      fitnessLevel: "Beginner", goal: "General Health", preferredEquipment: [],
      streakDays: 0, totalWorkouts: 0, totalMinutes: 0, totalCaloriesBurned: 0
    }, logs ?? [], progressLogs, favorites?.length ?? 0),
    [profile, logs, progressLogs, favorites]
  );

  return (
    <div className="space-y-4" id="hub-badges">
      <div className="rounded-3xl border border-line bg-carbon/80 p-5 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-ink-2">Trophy Room</p>
            <h3 className="mt-0.5 text-xl font-numeric font-black text-ink">{unlocked.size} / {ACHIEVEMENTS.length} Badges</h3>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Trophy className="h-5 w-5"/>
          </span>
        </div>
        <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-graphite">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500" style={{ width: `${(unlocked.size / ACHIEVEMENTS.length) * 100}%` }}/>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {ACHIEVEMENTS.map(a => {
          const isUnlocked = unlocked.has(a.id);
          return (
            <div key={a.id} className={`rounded-2xl border p-3.5 text-center transition-all ${isUnlocked ? "border-amber-400/30 bg-amber-950/20 shadow-xs" : "border-white/8 bg-carbon/60 opacity-55"}`}>
              <div className="flex justify-center mb-1.5">
                <AchievementBadgeIcon name={a.icon} isUnlocked={isUnlocked} className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-ink truncate">{a.title}</p>
              <p className="mt-0.5 text-xs text-ink-3 line-clamp-2">{a.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- Calendar Section ---------------------------- */

function CalendarSection({ logs = [] }: { logs?: WorkoutLog[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = base.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const loggedDays = useMemo(() => {
    const set = new Set<number>();
    logs.forEach(log => {
      const d = new Date(log.completedAt);
      if (d.getFullYear() === year && d.getMonth() === month) set.add(d.getDate());
    });
    return set;
  }, [logs, year, month]);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDayIndex }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-3xl border border-line bg-carbon/80 p-5 shadow-xl backdrop-blur-xl" id="hub-calendar">
      <div className="flex items-center justify-between">
        <button onClick={() => { tapFeedback(); setMonthOffset(m => m - 1); }} className="rounded-full p-2 bg-graphite hover:bg-graphite text-ink">
          <ChevronLeft className="h-4 w-4"/>
        </button>
        <h3 className="text-sm font-black text-ink">{monthLabel}</h3>
        <button onClick={() => { tapFeedback(); setMonthOffset(m => m + 1); }} className="rounded-full p-2 bg-graphite hover:bg-graphite text-ink">
          <ChevronRight className="h-4 w-4"/>
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase text-ink-3">
        {["S","M","T","W","T","F","S"].map((d,i) => <div key={i}>{d}</div>)}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const isToday = isCurrentMonth && day === today.getDate();
          const hasLog = day !== null && loggedDays.has(day);
          return (
            <div key={i} className={`flex aspect-square items-center justify-center rounded-xl text-xs font-bold transition ${
              day === null ? "" : isToday ? "bg-cyan-500 text-slate-950 font-black shadow-xs" : hasLog ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-graphite text-ink-2"
            }`}>
              {day}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-center gap-4 text-[11px] font-bold text-ink-2 border-t border-white/5 pt-3">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400"/> Session Completed</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400"/> Today</span>
      </div>
    </div>
  );
}

/* ---------------------------- Main Hub Component ---------------------------- */

function PremiumHubInner({
  logs = [],
  profile,
  setProfile,
  favorites = [],
  onStartWorkout,
}: PremiumHubProps) {
  const scrollTo = (id: string) => {
    tapFeedback();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="space-y-5 animate-fade-in pb-10" id="premium-feature-hub">
      {/* Hero Banner */}
      <div className="overflow-hidden rounded-3xl text-ink shadow-2xl bg-void relative border border-line">
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={gymPremiumBeast}
            alt="Powerhouse Strength Athlete"
            className="h-full w-full object-cover object-[78%_20%] opacity-55"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
        </div>

        <div className="relative p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-cyan-300">
              <Sparkles className="h-3 w-3" /> Coach Suite
            </span>
          </div>

          <div className="mt-3 max-w-lg">
            <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">
              Coaching &amp; Performance Hub
            </h2>
            <p className="mt-1 text-xs text-ink-2 leading-relaxed">
              Unified command center: metabolic toolkit, structured programs, consistency tracking, and badges.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <div className="rounded-xl border border-line bg-carbon/60 p-2.5 text-center">
              <p className="text-sm font-numeric font-black text-cyan-400">{PROGRAM_PLANS.length}</p>
              <p className="text-[11px] font-bold uppercase text-ink-2">Plans</p>
            </div>
            <div className="rounded-xl border border-line bg-carbon/60 p-2.5 text-center">
              <p className="text-sm font-numeric font-black text-emerald-400">3</p>
              <p className="text-[11px] font-bold uppercase text-ink-2">Tools</p>
            </div>
            <div className="rounded-xl border border-line bg-carbon/60 p-2.5 text-center">
              <p className="text-sm font-numeric font-black text-amber-400">{ACHIEVEMENTS.length}</p>
              <p className="text-[11px] font-bold uppercase text-ink-2">Badges</p>
            </div>
            <div className="rounded-xl border border-line bg-carbon/60 p-2.5 text-center">
              <p className="text-sm font-numeric font-black text-ink">{logs.length}</p>
              <p className="text-[11px] font-bold uppercase text-ink-2">Logged</p>
            </div>
          </div>
        </div>
      </div>

      {/* Flattened Quick Section Anchors — single tap jump without tab swapping */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-line bg-carbon/80 p-1.5 shadow-md scrollbar-none backdrop-blur-xl sticky top-[calc(var(--safe-t)+54px)] z-20">
        <button
          onClick={() => scrollTo("hub-quick-sessions")}
          className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black text-ink-2 hover:text-ink hover:bg-graphite active:scale-95 transition"
        >
          <Zap className="h-3.5 w-3.5 text-amber-400" /> Quick Start
        </button>
        <button
          onClick={() => scrollTo("hub-toolkit")}
          className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black text-ink-2 hover:text-ink hover:bg-graphite active:scale-95 transition"
        >
          <Calculator className="h-3.5 w-3.5 text-cyan-400" /> Toolkit
        </button>
        <button
          onClick={() => scrollTo("hub-programs")}
          className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black text-ink-2 hover:text-ink hover:bg-graphite active:scale-95 transition"
        >
          <LayoutGrid className="h-3.5 w-3.5 text-emerald-400" /> Programs
        </button>
        <button
          onClick={() => scrollTo("hub-badges")}
          className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black text-ink-2 hover:text-ink hover:bg-graphite active:scale-95 transition"
        >
          <Trophy className="h-3.5 w-3.5 text-amber-400" /> Badges
        </button>
        <button
          onClick={() => scrollTo("hub-calendar")}
          className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black text-ink-2 hover:text-ink hover:bg-graphite active:scale-95 transition"
        >
          <CalendarDays className="h-3.5 w-3.5 text-blue-400" /> Calendar
        </button>
      </div>

      {/* 1. Quick Launch Sessions */}
      <div className="rounded-3xl border border-line bg-carbon/80 p-4 shadow-xl backdrop-blur-xl" id="hub-quick-sessions">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
              <Zap className="h-3.5 w-3.5"/>
            </span>
            <h3 className="text-xs font-black uppercase tracking-wider text-ink">Instant Launch Sessions</h3>
          </div>
          <span className="text-[11px] text-ink-2">No setup needed</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {QUICK.map(q => {
            const Icon = q.icon;
            return (
              <button
                key={q.title}
                onClick={() => {
                  tapFeedback();
                  if (onStartWorkout) {
                    onStartWorkout(CURATED_WORKOUTS[q.curatedIndex]);
                  }
                }}
                className="rounded-2xl border border-white/5 bg-void/60 p-3 text-left hover:border-cyan-500/40 hover:bg-void transition active:scale-98 group"
              >
                <Icon className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform"/>
                <p className="mt-2 text-xs font-black text-ink">{q.title}</p>
                <p className="mt-0.5 text-[11px] text-ink-2">{q.meta}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Today's Routine Architecture */}
      <div className="rounded-3xl border border-line bg-carbon/80 p-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <HeartPulse className="h-3.5 w-3.5"/>
          </span>
          <h3 className="text-xs font-black uppercase tracking-wider text-ink">Session Flow Architecture</h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { step: "01", name: "Readiness Check", desc: "Energy & sleep" },
            { step: "02", name: "Dynamic Warm-up", desc: "Joint mobility" },
            { step: "03", name: "Main Sets", desc: "Form & pacing" },
          ].map(x => (
            <div key={x.step} className="rounded-2xl border border-white/5 bg-void/60 p-3">
              <span className="text-[11px] font-numeric font-black text-cyan-400">{x.step}</span>
              <p className="mt-1 text-xs font-black text-ink">{x.name}</p>
              <p className="text-[11px] text-ink-2 mt-0.5">{x.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Performance & Recovery Toolkit */}
      <ToolkitSection profile={profile} setProfile={setProfile} />

      {/* 4. Structured Multi-Week Programs */}
      <ProgramsSection onStartWorkout={onStartWorkout} />

      {/* 5. Achievement Badges */}
      <AchievementsSection profile={profile} logs={logs} favorites={favorites} />

      {/* 6. Consistency Matrix Calendar */}
      <CalendarSection logs={logs} />
    </section>
  );
}

const PremiumHub = memo(PremiumHubInner);
export default PremiumHub;
