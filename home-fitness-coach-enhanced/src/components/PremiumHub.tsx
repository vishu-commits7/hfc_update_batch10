import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, Award, Bell, Brain, CalendarDays, Check, ChevronRight, ChevronLeft, Clock3,
  Dumbbell, HeartPulse, Lock, Moon, RotateCcw, ShieldCheck,
  Sparkles, Target, TimerReset, Trophy, Utensils, Watch, Zap, BarChart3,
  BookOpen, Download, Settings2, SlidersHorizontal, Volume2,
  Calculator, Droplets, Wind, LayoutGrid, PlusCircle, MinusCircle
} from "lucide-react";
import { UserProfile, Workout, WorkoutLog, ProgressLog, ProgramPlan } from "../types";
import { PROGRAM_PLANS, CURATED_WORKOUTS } from "../constants";
import { ACHIEVEMENTS, computeUnlockedAchievements } from "../lib/achievements";
import { calculateBMI, bmiCategory, calculateTDEE, ACTIVITY_LABELS, todayKey } from "../lib/wellness";
import { DEMO_EXERCISES } from "./ExerciseLibrary";
import progFoundation from "../assets/coaches/coach-ironcore.jpg";
import progStrength from "../assets/coaches/hero-strength.jpg";
import progCardio from "../assets/coaches/cat-cardio.jpg";
import progMobility from "../assets/coaches/cat-mobility.jpg";

const PROGRAM_COVER: Record<string, string> = {
  prog_foundation: progFoundation,
  prog_strength: progStrength,
  prog_cardio: progCardio,
  prog_mobility: progMobility,
};

type PremiumHubProps = {
  isPremium?: boolean;
  onTogglePremium?: (value: boolean) => void;
  profile?: UserProfile;
  setProfile?: React.Dispatch<React.SetStateAction<UserProfile>>;
  logs?: WorkoutLog[];
  favorites?: string[];
  onStartWorkout?: (workout: Workout) => void;
};

type HubTab = "overview" | "toolkit" | "programs" | "achievements" | "calendar";

const FEATURES = [
  ["Adaptive Plans", "Automatically scale session volume and intensity from recent performance.", Brain],
  ["Daily Readiness", "A quick energy, sleep and soreness check before you train.", HeartPulse],
  ["Smart Warm-up", "Dynamic warm-up and cool-down blocks matched to the session.", TimerReset],
  ["Form Coach", "Movement cues, setup checks and common-error reminders.", Check],
  ["Smart Rest", "Rest countdowns with an adjustable recovery target.", Clock3],
  ["PR & Milestones", "Celebrate consistency and personal bests without fake numbers.", Trophy],
  ["Weekly Insights", "Training frequency, minutes, completion rate and habit trends.", BarChart3],
  ["Habit System", "Movement, hydration, sleep and recovery habits in one place.", Zap],
  ["Reminders", "Plan your next session and keep your schedule visible.", Bell],
  ["Quick Sessions", "10, 15, 20 and 30-minute options for busy days.", Watch],
  ["Mobility Studio", "Dedicated mobility flows for warm-up, recovery and flexibility.", Activity],
  ["Nutrition Guide", "Simple balanced meal and hydration prompts around training.", Utensils],
  ["Sleep Mode", "Low-distraction evening interface with recovery-first prompts.", Moon],
  ["Safety Guardrails", "Beginner-friendly pacing and stop/scale guidance.", ShieldCheck],
  ["Coach Voice", "Optional spoken timer and exercise cues using device speech.", Volume2],
  ["Goal Roadmaps", "Strength, cardio, mobility and general-health pathways.", Target],
  ["Programs", "Multi-week progressive plans with deload and recovery days.", Dumbbell],
  ["Exercise Academy", "Animated movement demos plus key cues and mistakes.", BookOpen],
  ["Favorites & Templates", "Save go-to sessions and turn them into reusable templates.", Award],
  ["Calendar", "See planned, completed and recovery days at a glance.", CalendarDays],
  ["Recovery Timer", "Breathing and reset blocks between hard sessions.", RotateCcw],
  ["Coach Dashboard", "One-screen snapshot of your next best action.", SlidersHorizontal],
  ["Progress Notes", "Add context to sessions so trends are easier to understand.", BookOpen],
  ["Offline-first UI", "Core library and saved plans remain usable without a server.", Download],
  ["Accessibility", "Large tap targets, clear labels and reduced-motion friendly UI.", Settings2],
  ["Premium Themes", "Polished light/dark training modes and focused workout screens.", Moon],
  ["Session Ratings", "Quick post-session feedback to guide future recommendations.", Check],
  ["Plan Builder", "Combine warm-up, main work, mobility and cooldown blocks.", Target],
  ["BMI & TDEE Toolkit", "Body metrics and calorie targets calculated from your own numbers.", Calculator],
  ["Water Tracker", "A simple daily hydration counter that resets every day.", Droplets],
  ["Breathing Timer", "A guided box-breathing session for recovery and focus.", Wind],
  ["Achievement Badges", "24 badges earned purely from your real logged activity.", Trophy],
] as const;

const QUICK = [
  { title: "10 MIN RESET", meta: "Mobility • Easy", icon: RotateCcw },
  { title: "15 MIN FULL BODY", meta: "Strength • Beginner", icon: Dumbbell },
  { title: "20 MIN CARDIO", meta: "Conditioning • Moderate", icon: Activity },
  { title: "30 MIN STRENGTH", meta: "Full body • Moderate", icon: Trophy },
];

const HUB_TABS: { id: HubTab; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "toolkit", label: "Toolkit", icon: Calculator },
  { id: "programs", label: "Programs", icon: LayoutGrid },
  { id: "achievements", label: "Badges", icon: Trophy },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];

/* ---------------------------- Toolkit tab ---------------------------- */

function ToolkitTab({ profile, setProfile }: { profile?: UserProfile; setProfile?: React.Dispatch<React.SetStateAction<UserProfile>> }) {
  const p = profile;
  const [heightCm, setHeightCm] = useState(p?.heightCm ?? 0);
  const [weightKg, setWeightKg] = useState(p?.weightKg ?? 0);
  const [age, setAge] = useState(p?.age ?? 0);
  const [gender, setGender] = useState<"male" | "female" | "other">(p?.gender ?? "other");
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
    const clamped = Math.max(0, Math.min(20, n));
    setWater(clamped);
    localStorage.setItem("kinetic_water_intake", JSON.stringify({ date: todayKey(), glasses: clamped }));
  };

  const saveMetrics = () => {
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

  const breathLabel: Record<string, string> = { idle: "Ready", in: "Breathe In", hold1: "Hold", out: "Breathe Out", hold2: "Hold" };
  const breathScale = breathPhase === "in" ? 1.35 : breathPhase === "out" ? 0.75 : breathPhase === "hold1" ? 1.35 : breathPhase === "hold2" ? 0.75 : 1;

  return (
    <div className="space-y-4">
      {/* Breathing timer */}
      <div className="rounded-[26px] border border-slate-100 bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Recovery tool</p>
            <h3 className="mt-1 text-lg font-black">Box Breathing Timer</h3>
          </div>
          <Wind className="h-5 w-5 text-lime-300"/>
        </div>
        <div className="mt-6 flex flex-col items-center justify-center gap-4 py-4">
          <div
            className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-lime-300/50 bg-lime-300/10 text-center transition-transform duration-[1000ms] ease-in-out"
            style={{ transform: `scale(${breathScale})` }}
          >
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-lime-300">{breathLabel[breathPhase]}</p>
              {breathPhase !== "idle" && <p className="text-2xl font-black">{breathSecondsLeft}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setBreathPhase(breathPhase === "idle" ? "in" : "idle"); setBreathSecondsLeft(4); }}
              className="rounded-full bg-lime-300 px-5 py-2.5 text-xs font-black text-slate-950"
            >
              {breathPhase === "idle" ? "Start 4-4-4-4 breathing" : "Stop"}
            </button>
            {breathCycles > 0 && <span className="text-[11px] font-bold text-white/50">{breathCycles} cycles completed</span>}
          </div>
        </div>
      </div>

      {/* Water tracker */}
      <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Daily hydration</p>
            <h3 className="mt-1 text-lg font-black">Water Tracker</h3>
          </div>
          <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><Droplets className="h-5 w-5"/></div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-4">
          <button onClick={() => setWaterAndSave(water - 1)} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"><MinusCircle className="h-6 w-6"/></button>
          <div className="text-center">
            <p className="text-3xl font-black text-blue-600">{water}<span className="text-base text-slate-300"> / {waterGoal}</span></p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">glasses today</p>
          </div>
          <button onClick={() => setWaterAndSave(water + 1)} className="rounded-full bg-blue-600 p-2 text-white hover:bg-blue-700"><PlusCircle className="h-6 w-6"/></button>
        </div>
        <div className="mt-4 flex gap-1">
          {Array.from({ length: waterGoal }).map((_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full ${i < water ? "bg-blue-500" : "bg-slate-100"}`}/>
          ))}
        </div>
        <p className="mt-3 text-center text-[10px] text-slate-400">Resets automatically at midnight. Nothing pre-filled — today starts at 0.</p>
      </div>

      {/* BMI & TDEE calculator */}
      <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><Calculator className="h-4 w-4 text-slate-500"/><h3 className="text-lg font-black">Body & Calorie Calculator</h3></div>
        <p className="mt-1 text-xs text-slate-500">Enter your own numbers — nothing is pre-filled. Saved to your local profile only.</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Height (cm)</span>
            <input type="number" min={0} value={heightCm || ""} onChange={e => setHeightCm(parseFloat(e.target.value) || 0)} placeholder="e.g. 170" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800"/>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Weight (kg)</span>
            <input type="number" min={0} value={weightKg || ""} onChange={e => setWeightKg(parseFloat(e.target.value) || 0)} placeholder="e.g. 65" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800"/>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Age</span>
            <input type="number" min={0} value={age || ""} onChange={e => setAge(parseInt(e.target.value) || 0)} placeholder="e.g. 28" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800"/>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Gender</span>
            <select value={gender} onChange={e => setGender(e.target.value as any)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800">
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other / Prefer not to say</option>
            </select>
          </label>
        </div>

        <div className="mt-3 space-y-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Activity level</span>
          <div className="grid grid-cols-5 gap-1.5">
            {ACTIVITY_LABELS.map(a => (
              <button key={a.value} onClick={() => setActivityLevel(a.value as any)} title={a.desc} className={`rounded-lg py-2 text-[10px] font-black ${activityLevel === a.value ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-500"}`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={saveMetrics} className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-xs font-black text-white hover:bg-blue-700">Save to my profile</button>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">BMI</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{bmi > 0 ? bmi : "—"}</p>
            <p className={`mt-0.5 text-xs font-bold ${
              cat.color === "blue" ? "text-blue-600" :
              cat.color === "emerald" ? "text-emerald-600" :
              cat.color === "amber" ? "text-amber-600" :
              cat.color === "rose" ? "text-rose-600" : "text-slate-400"
            }`}>{cat.label}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Est. maintenance</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{tdee > 0 ? tdee : "—"}</p>
            <p className="mt-0.5 text-xs font-bold text-slate-500">kcal / day</p>
          </div>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-400">Estimates only (Mifflin-St Jeor equation), not medical advice. Consult a professional for personalized nutrition guidance.</p>
      </div>
    </div>
  );
}

/* ---------------------------- Programs tab ---------------------------- */

function ProgramsTab({ onStartWorkout }: { onStartWorkout?: (w: Workout) => void }) {
  const [openProgram, setOpenProgram] = useState<ProgramPlan | null>(null);

  return (
    <div className="space-y-4">
      {!openProgram && (
        <div className="grid gap-3 sm:grid-cols-2">
          {PROGRAM_PLANS.map(prog => (
            <button key={prog.id} onClick={() => setOpenProgram(prog)} className="flex gap-3.5 rounded-[24px] border border-slate-100 bg-white p-4 text-left shadow-sm hover:border-blue-200 hover:shadow-md transition-all">
              {PROGRAM_COVER[prog.id] && (
                <img
                  src={PROGRAM_COVER[prog.id]}
                  alt=""
                  className="h-24 w-20 shrink-0 rounded-2xl object-cover"
                  draggable={false}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">{prog.level}</span>
                  <span className="text-[10px] font-bold text-slate-400">{prog.weeks.length} weeks</span>
                </div>
                <h3 className="mt-3 text-lg font-black text-slate-900">{prog.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{prog.tagline}</p>
                <div className="mt-3 flex items-center gap-1 text-xs font-black text-blue-600">View plan <ChevronRight className="h-3.5 w-3.5"/></div>
              </div>
            </button>
          ))}
        </div>
      )}

      {openProgram && (
        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
          <button onClick={() => setOpenProgram(null)} className="flex items-center gap-1 text-xs font-black text-slate-500 hover:text-slate-800"><ChevronLeft className="h-3.5 w-3.5"/> All programs</button>
          <h3 className="mt-3 text-xl font-black text-slate-900">{openProgram.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{openProgram.tagline}</p>
          <div className="mt-5 space-y-4">
            {openProgram.weeks.map(week => (
              <div key={week.week}>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Week {week.week} · {week.theme}</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {week.days.map(day => (
                    <div key={day.day} className={`flex items-center justify-between rounded-xl border p-3 ${day.isRestDay ? "border-slate-100 bg-slate-50" : "border-slate-100 bg-white"}`}>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-slate-800">{day.title}</p>
                        <p className="text-[10px] text-slate-400">{day.focus}</p>
                      </div>
                      {!day.isRestDay && day.curatedIndex !== undefined && (
                        <button
                          onClick={() => onStartWorkout?.(CURATED_WORKOUTS[day.curatedIndex!])}
                          className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-black text-white"
                        >
                          Start
                        </button>
                      )}
                      {day.isRestDay && <span className="shrink-0 text-[10px] font-bold text-slate-400">😌 Rest</span>}
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

/* ---------------------------- Achievements tab ---------------------------- */

function AchievementsTab({ profile, logs, favorites }: { profile?: UserProfile; logs?: WorkoutLog[]; favorites?: string[] }) {
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
    <div className="space-y-4">
      <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Earned from real activity</p>
            <h3 className="mt-1 text-xl font-black">{unlocked.size} / {ACHIEVEMENTS.length} badges unlocked</h3>
          </div>
          <Trophy className="h-6 w-6 text-amber-400"/>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${(unlocked.size / ACHIEVEMENTS.length) * 100}%` }}/>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACHIEVEMENTS.map(a => {
          const isUnlocked = unlocked.has(a.id);
          return (
            <div key={a.id} className={`rounded-2xl border p-4 text-center transition-all ${isUnlocked ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50 opacity-60"}`}>
              <span className="text-2xl">{isUnlocked ? a.icon : "🔒"}</span>
              <p className="mt-2 text-xs font-black text-slate-900">{a.title}</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">{a.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- Calendar tab ---------------------------- */

function CalendarTab({ logs = [] }: { logs?: WorkoutLog[] }) {
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
    <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonthOffset(m => m - 1)} className="rounded-full p-2 hover:bg-slate-100"><ChevronLeft className="h-4 w-4"/></button>
        <h3 className="text-lg font-black text-slate-900">{monthLabel}</h3>
        <button onClick={() => setMonthOffset(m => m + 1)} className="rounded-full p-2 hover:bg-slate-100"><ChevronRight className="h-4 w-4"/></button>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-slate-400">
        {["S","M","T","W","T","F","S"].map((d,i) => <div key={i}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const isToday = isCurrentMonth && day === today.getDate();
          const hasLog = day !== null && loggedDays.has(day);
          return (
            <div key={i} className={`flex aspect-square items-center justify-center rounded-lg text-xs font-bold ${
              day === null ? "" : isToday ? "bg-blue-600 text-white" : hasLog ? "bg-emerald-100 text-emerald-700" : "bg-slate-50 text-slate-500"
            }`}>
              {day}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 text-[10px] font-bold text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400"/> Workout logged</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600"/> Today</span>
      </div>
      {loggedDays.size === 0 && isCurrentMonth && (
        <p className="mt-4 text-center text-xs text-slate-400">No sessions logged yet this month — complete a workout to see it appear here.</p>
      )}
    </div>
  );
}

/* ---------------------------- Main component ---------------------------- */

export default function PremiumHub({ isPremium = true, onTogglePremium, profile, setProfile, logs = [], favorites = [], onStartWorkout }: PremiumHubProps) {
  const [tab, setTab] = useState<HubTab>("overview");
  const [activeFeature, setActiveFeature] = useState(0);
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [autoRest, setAutoRest] = useState(true);
  const [coachVoice, setCoachVoice] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [theme, setTheme] = useState<"light" | "focus">("light");
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("kinetic_premium_preferences");
    if (!saved) return;
    try {
      const p = JSON.parse(saved);
      if (p.units) setUnits(p.units);
      if (typeof p.autoRest === "boolean") setAutoRest(p.autoRest);
      if (typeof p.coachVoice === "boolean") setCoachVoice(p.coachVoice);
      if (typeof p.reminders === "boolean") setReminders(p.reminders);
      if (typeof p.reducedMotion === "boolean") setReducedMotion(p.reducedMotion);
      if (p.theme) setTheme(p.theme);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("kinetic_premium_preferences", JSON.stringify({
      units, autoRest, coachVoice, reminders, reducedMotion, theme
    }));
  }, [units, autoRest, coachVoice, reminders, reducedMotion, theme]);

  // A shorter default preview (8, not 18) keeps the Overview tab from
  // being a huge scroll on first open — "Show all" is one tap away.
  const visibleFeatures = showAll ? FEATURES : FEATURES.slice(0, 8);
  const selected = FEATURES[activeFeature];
  const SelectedIcon = selected[2];

  const premiumMetrics = useMemo(() => [
    { label: "Programs", value: String(PROGRAM_PLANS.length) },
    { label: "Demo library", value: String(DEMO_EXERCISES.length) },
    { label: "Coach tools", value: String(FEATURES.length) },
    { label: "Badges", value: String(ACHIEVEMENTS.length) },
  ], []);

  const exportSettings = () => {
    const payload = {
      product: "Home Fitness Coach",
      subscriptionMode: isPremium ? "Premium activated" : "Basic",
      preferences: { units, autoRest, coachVoice, reminders, reducedMotion, theme },
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "home-fitness-coach-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-5" id="premium-feature-hub">
      <div className={`overflow-hidden rounded-[32px] text-white shadow-xl ${theme === "focus" ? "bg-[#0b0f0a]" : "bg-slate-950"}`}>
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-lime-300/10 blur-3xl" />
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-lime-300">
                <Sparkles className="h-3.5 w-3.5" /> Home Fitness Coach
              </span>
              <button
                onClick={() => onTogglePremium?.(!isPremium)}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider hover:bg-white/15"
              >
                {isPremium ? "Switch to Basic" : "Activate Premium"}
              </button>
            </div>

            <div className="mt-5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${isPremium ? "bg-lime-300 text-slate-950" : "bg-white/10 text-white/70"}`}>
                  {isPremium ? "Premium activated" : "Basic mode"}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">No fake activity • starts empty</span>
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                {isPremium ? "Your full coaching suite is unlocked." : "A clean, focused basic training experience."}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
                {isPremium
                  ? "Use the complete planning, recovery, progress, education and personalization layer. Premium is active locally for this build."
                  : "Basic keeps the essential workout experience simple. Switch back to Premium any time to unlock the full coaching layer."}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {premiumMetrics.map(m => (
                <div key={m.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-lg font-black">{isPremium ? m.value : "—"}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isPremium && (
        <>
          {/* Hub tab switcher */}
          <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm scrollbar-none">
            {HUB_TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-black transition-all ${tab === t.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                >
                  <Icon className="h-3.5 w-3.5"/> {t.label}
                </button>
              );
            })}
          </div>

          {tab === "toolkit" && <ToolkitTab profile={profile} setProfile={setProfile} />}
          {tab === "programs" && <ProgramsTab onStartWorkout={onStartWorkout} />}
          {tab === "achievements" && <AchievementsTab profile={profile} logs={logs} favorites={favorites} />}
          {tab === "calendar" && <CalendarTab logs={logs} />}

          {tab === "overview" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Today's coach plan</p>
                      <h3 className="mt-1 text-lg font-black">Readiness → warm-up → main set</h3>
                    </div>
                    <div className="rounded-xl bg-lime-50 p-2 text-lime-700"><HeartPulse className="h-5 w-5"/></div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {["Readiness", "Warm-up", "Training"].map((x, i) => (
                      <div key={x} className="rounded-2xl bg-slate-50 p-3">
                        <span className="text-[10px] font-black text-slate-400">0{i + 1}</span>
                        <p className="mt-1 text-xs font-bold text-slate-800">{x}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Start from zero, then let completed sessions shape future recommendations.</p>
                </div>

                <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quick start</p>
                      <h3 className="mt-1 text-lg font-black">Pick a session length</h3>
                    </div>
                    <Zap className="h-5 w-5 text-blue-600"/>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {QUICK.map(q => {
                      const Icon = q.icon;
                      return (
                        <button key={q.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left hover:border-blue-200 hover:bg-blue-50/50">
                          <Icon className="h-4 w-4 text-blue-600"/>
                          <p className="mt-2 text-xs font-black">{q.title}</p>
                          <p className="mt-0.5 text-[10px] text-slate-400">{q.meta}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Premium toolkit</p>
                    <h3 className="mt-1 text-xl font-black">Everything in your coaching layer</h3>
                  </div>
                  <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-700 sm:block">{FEATURES.length} modules</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {visibleFeatures.map(([title, desc, Icon], i) => (
                    <button
                      key={title}
                      onClick={() => setActiveFeature(i)}
                      className={`rounded-2xl border p-3 text-left transition-all ${activeFeature === i ? "border-blue-200 bg-blue-50 shadow-sm" : "border-slate-100 bg-slate-50 hover:border-slate-200"}`}
                    >
                      <Icon className={`h-4 w-4 ${activeFeature === i ? "text-blue-600" : "text-slate-500"}`} />
                      <p className="mt-2 text-xs font-black text-slate-900">{title}</p>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{desc}</p>
                    </button>
                  ))}
                </div>

                <button onClick={() => setShowAll(v => !v)} className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl bg-slate-900 py-3 text-xs font-black text-white">
                  {showAll ? "Show fewer modules" : `Show all ${FEATURES.length} premium modules`} <ChevronRight className={`h-4 w-4 transition-transform ${showAll ? "rotate-90" : ""}`}/>
                </button>
              </div>

              <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-950 p-3 text-lime-300"><SelectedIcon className="h-5 w-5"/></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Selected module</p>
                    <h3 className="text-xl font-black">{selected[0]}</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">{selected[1]}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {["Clear next action", "Saved preference", "Progress-aware"].map((x, i) => (
                    <div key={x} className="rounded-2xl bg-slate-50 p-3">
                      <span className="text-[10px] font-black text-blue-600">0{i + 1}</span>
                      <p className="mt-1 text-xs font-bold">{x}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-slate-500"/><h3 className="text-lg font-black">Coach controls</h3></div>
                <div className="mt-4 grid gap-2">
                  {[
                    ["Automatic rest timer", autoRest, setAutoRest],
                    ["Coach voice cues", coachVoice, setCoachVoice],
                    ["Workout reminders", reminders, setReminders],
                    ["Reduced motion", reducedMotion, setReducedMotion],
                  ].map(([label, value, setter]: any) => (
                    <button key={label} onClick={() => setter(!value)} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 text-left">
                      <span className="text-sm font-bold text-slate-800">{label}</span>
                      <span className={`h-6 w-11 rounded-full p-1 transition ${value ? "bg-blue-600" : "bg-slate-300"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${value ? "translate-x-5" : ""}`}/></span>
                    </button>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
                    <span className="text-sm font-bold text-slate-800">Measurement units</span>
                    <div className="flex rounded-xl border border-slate-100 bg-white p-1">
                      {(["metric", "imperial"] as const).map(u => <button key={u} onClick={() => setUnits(u)} className={`rounded-lg px-3 py-1.5 text-[11px] font-black capitalize ${units === u ? "bg-slate-900 text-white" : "text-slate-500"}`}>{u}</button>)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
                    <span className="text-sm font-bold text-slate-800">Workout theme</span>
                    <div className="flex rounded-xl border border-slate-100 bg-white p-1">
                      <button onClick={() => setTheme("light")} className={`rounded-lg px-3 py-1.5 text-[11px] font-black ${theme === "light" ? "bg-slate-900 text-white" : "text-slate-500"}`}>Light</button>
                      <button onClick={() => setTheme("focus")} className={`rounded-lg px-3 py-1.5 text-[11px] font-black ${theme === "focus" ? "bg-lime-200 text-slate-900" : "text-slate-500"}`}>Focus</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[26px] bg-gradient-to-br from-blue-700 to-indigo-900 p-6 text-white">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Membership</p>
                  <h3 className="mt-2 text-2xl font-black">Premium access</h3>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button onClick={() => setPlan("monthly")} className={`rounded-xl p-3 text-left ${plan === "monthly" ? "bg-white text-slate-950" : "bg-white/10"}`}><p className="text-xs font-black">Monthly</p><p className="text-lg font-black">₹399</p></button>
                    <button onClick={() => setPlan("yearly")} className={`rounded-xl p-3 text-left ${plan === "yearly" ? "bg-lime-300 text-slate-950" : "bg-white/10"}`}><p className="text-xs font-black">Yearly</p><p className="text-lg font-black">₹2,999</p></button>
                  </div>
                  <p className="mt-3 text-[10px] text-blue-100/70">Demo subscription UI only. No payment is processed by this build.</p>
                </div>
                <div className="rounded-[26px] border border-slate-100 bg-white p-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Utilities</p>
                  <h3 className="mt-2 text-xl font-black">Your data stays yours</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">Export local preferences or use Reset All Data from Settings to return the app to a clean state.</p>
                  <button onClick={exportSettings} className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white"><Download className="h-4 w-4"/> Export settings</button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {!isPremium && (
        <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-100 p-3"><Lock className="h-5 w-5 text-slate-500"/></div>
            <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Premium modules</p><h3 className="text-xl font-black">Upgrade when you want the full suite</h3></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FEATURES.slice(0, 12).map(([title]) => <div key={title} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"><Lock className="h-3.5 w-3.5 text-slate-400"/><span className="text-xs font-bold text-slate-600">{title}</span></div>)}
          </div>
          <button onClick={() => onTogglePremium?.(true)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3.5 text-sm font-black text-white">Activate Premium <Sparkles className="h-4 w-4 text-lime-300"/></button>
        </div>
      )}
    </section>
  );
}
