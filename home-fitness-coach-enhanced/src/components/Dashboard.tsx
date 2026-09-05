import React, { useState } from "react";
import { UserProfile, Workout, WorkoutLog } from "../types";
import { CURATED_WORKOUTS, FITNESS_LEVELS, WORKOUT_GOALS, PROGRAM_PLANS } from "../constants";
import { ACHIEVEMENTS } from "../lib/achievements";
import WorkoutCard, { CURATED_COACH_MEDIA } from "./WorkoutCard";
import heroBoxJump from "../assets/ui/hero-boxjump.jpg";
import {
  Flame,
  Sparkles,
  ChevronRight,
  Plus,
  Search,
  Settings,
  X,
  RotateCcw,
  UserRound,
  ChevronRight as ChevronRightIcon,
  LayoutGrid,
  Target,
  Dumbbell,
  Footprints,
  Clock3,
  Zap,
  Trophy,
  Check
} from "lucide-react";

// Built straight from the same coach photo/name pairing each Pro Routine
// card actually shows (`CURATED_COACH_MEDIA` in WorkoutCard.tsx) — one
// single source of truth, so clicking a coach here is guaranteed to filter
// down to exactly the routines that carry that coach's own banner, instead
// of a second, disconnected roster of names/photos that didn't match up.
const CERTIFIED_COACHES: { name: string; photo: string }[] = (() => {
  const seen = new Set<string>();
  const list: { name: string; photo: string }[] = [];
  for (const media of Object.values(CURATED_COACH_MEDIA)) {
    if (seen.has(media.coach)) continue;
    seen.add(media.coach);
    list.push({ name: media.coach, photo: media.photo });
  }
  return list;
})();

interface DashboardProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  savedWorkouts: Workout[];
  logs: WorkoutLog[];
  onSelectWorkout: (workout: Workout) => void;
  onDeleteWorkout: (id: string) => void;
  onNavigate: (view: "dashboard" | "ai-generator" | "history-logs" | "exercise-library" | "progress-tracker" | "premium-hub") => void;
  onResetAllData: () => void;
  isPremium?: boolean;
  onTogglePremium?: (value: boolean) => void;
  favorites?: string[];
  onEditProfile?: () => void;
}

const CHALLENGE_TARGET = 30;

export default function Dashboard({ 
  profile, 
  setProfile,
  savedWorkouts, 
  logs, 
  onSelectWorkout, 
  onDeleteWorkout, 
  onNavigate,
  onResetAllData,
  isPremium = true,
  onTogglePremium,
  favorites = [],
  onEditProfile
}: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeCoach, setActiveCoach] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  // Format today's date dynamically
  const today = new Date();
  const currentWeekCount = logs.filter(log => {
    const logDate = new Date(log.completedAt);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return logDate >= oneWeekAgo;
  }).length;

  const weeklyGoal = 3;
  const progressPercent = Math.min(Math.round((currentWeekCount / weeklyGoal) * 100), 100);

  // Generate the current week's days dynamically
  const getWeeklyDays = () => {
    const days = [];
    const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
    const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() + mondayOffset + i);
      days.push({
        date: dayDate.getDate(),
        name: dayDate.toLocaleDateString(undefined, { weekday: "short" })[0], // 'M', 'T', 'W'...
        fullDateString: dayDate.toDateString(),
        isToday: dayDate.toDateString() === today.toDateString(),
      });
    }
    return days;
  };

  const weeklyDays = getWeeklyDays();

  // Categories chips
  const categories = [
    { label: "All", icon: LayoutGrid },
    { label: "Abs", icon: Target },
    { label: "Arm", icon: Dumbbell },
    { label: "Chest", icon: Zap },
    { label: "Leg", icon: Footprints },
  ];

  // Search and Filter Logic
  const filterWorkouts = (workoutList: Workout[]) => {
    return workoutList.filter(workout => {
      const matchesSearch = workout.workoutTitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            workout.workoutDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            workout.targetArea.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesCategory = true;
      if (activeCategory !== "All") {
        const catLower = activeCategory.toLowerCase();
        matchesCategory = workout.targetArea.toLowerCase().includes(catLower) || 
                          workout.workoutTitle.toLowerCase().includes(catLower) ||
                          workout.workoutDescription.toLowerCase().includes(catLower);
      }
      return matchesSearch && matchesCategory;
    });
  };

  const filteredCurated = filterWorkouts(CURATED_WORKOUTS).filter(
    w => !activeCoach || CURATED_COACH_MEDIA[w.id]?.coach === activeCoach
  );
  const filteredSaved = filterWorkouts(savedWorkouts);

  // CTA function for Day 17
  const handleStartChallenge = () => {
    // Select the first curated workout or any active routine to start
    if (CURATED_WORKOUTS.length > 0) {
      onSelectWorkout(CURATED_WORKOUTS[0]);
    }
  };

  // Challenge progress now reflects real logged workouts (capped at the
  // 30-day target) instead of a permanently-stuck "0 / 30" placeholder.
  const challengeCompleted = Math.min(CHALLENGE_TARGET, profile.totalWorkouts);
  const challengePercent = Math.round((challengeCompleted / CHALLENGE_TARGET) * 100);

  const handleResetClick = () => {
    if (confirmingReset) {
      onResetAllData();
      setConfirmingReset(false);
      setShowSettings(false);
    } else {
      setConfirmingReset(true);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 pb-12" id="dashboard-view">
      
      {/* 1. HOME WORKOUT Header & streak & PRO Button */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display shrink-0 whitespace-nowrap text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              HOME WORKOUT
            </h1>
            {/* Fire Streak Badge */}
            <div className="flex shrink-0 items-center gap-1 bg-rose-50 border border-rose-100 text-rose-600 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs">
              <Flame className="h-4 w-4 fill-rose-500/10 animate-bounce" />
              <span>{profile.streakDays} DAYS</span>
            </div>
          </div>
          <p className="font-script -mt-0.5 truncate text-sm text-blue-600/80">your journey, your pace</p>
        </div>

        {/* Settings entry point */}
        <button 
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-full shadow-xs transition-all transform hover:scale-105 active:scale-95"
          id="btn-open-settings"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* Settings Panel (profile preferences + data management) */}
      {showSettings && (
        <div 
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-6"
          id="settings-overlay"
          onClick={() => { setShowSettings(false); setConfirmingReset(false); }}
        >
          <div 
            className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-white p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            id="settings-panel"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Settings</h2>
              <button
                onClick={() => { setShowSettings(false); setConfirmingReset(false); }}
                className="h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
                id="btn-close-settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              <button
                onClick={() => { setShowSettings(false); onEditProfile?.(); }}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left hover:border-blue-200 hover:bg-blue-50/40 transition-all"
                id="btn-edit-my-info"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-lime-300">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900">Edit My Info</p>
                  <p className="truncate text-xs text-slate-400">
                    {profile.gender || profile.age || profile.heightCm || profile.weightKg
                      ? `${profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : "—"} · ${profile.age ? profile.age + "yrs" : "—"} · ${profile.heightCm ? profile.heightCm + "cm" : "—"} · ${profile.weightKg ? profile.weightKg + "kg" : "—"}`
                      : "Gender, age, height & weight — not set yet"}
                  </p>
                </div>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300" />
              </button>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold block">Fitness Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {FITNESS_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setProfile(prev => ({ ...prev, fitnessLevel: level.value as UserProfile["fitnessLevel"] }))}
                      className={`py-2.5 px-2 rounded-xl border text-xs font-bold text-center transition-all ${
                        profile.fitnessLevel === level.value
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold block">Primary Goal</label>
                <div className="grid grid-cols-2 gap-2">
                  {WORKOUT_GOALS.map((g) => (
                    <button
                      key={g.value}
                      onClick={() => setProfile(prev => ({ ...prev, goal: g.value as UserProfile["goal"] }))}
                      className={`flex items-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold text-left transition-all ${
                        profile.goal === g.value
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span>{g.icon}</span>
                      <span className="truncate">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold block">Data</label>
                <button
                  onClick={handleResetClick}
                  onBlur={() => setConfirmingReset(false)}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold transition-all ${
                    confirmingReset
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100"
                  }`}
                  id="btn-reset-all-data"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {confirmingReset ? "Tap again to confirm reset" : "Reset All Data"}
                </button>
                <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                  Wipes your profile, saved AI workouts, and full training history. This cannot be undone.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Sleek Search Bar */}
      <div className="relative w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search workouts, plans..."
          className="w-full bg-white border border-slate-200/80 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden shadow-xs transition-all"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* 3. Horizontal Weekly Goal Tracker */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Weekly Goal</h2>
            <p className="text-xs text-slate-400 mt-0.5">Focus on staying consistent</p>
          </div>
          <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
            {currentWeekCount} / {weeklyGoal} workouts
          </span>
        </div>

        {/* Days of week circles */}
        <div className="grid grid-cols-7 gap-2">
          {weeklyDays.map((day, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{day.name}</span>
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs transition-all ${
                  day.isToday 
                    ? "bg-blue-600 text-white font-extrabold shadow-[0_4px_12px_rgba(37,99,235,0.3)] ring-4 ring-blue-50" 
                    : "bg-slate-50 border border-slate-100 text-slate-700 font-semibold hover:bg-slate-100"
                }`}
                title={day.fullDateString}
              >
                <span>{day.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Gorgeous Challenge Card Banner */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/10">
        {/* Abstract lights */}
        <div className="absolute right-0 top-0 -mr-12 -mt-12 h-48 w-48 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-12 -mb-12 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />

        {/* Real-photo hero, bleeding in from the right edge — a mid-air box
            jump to match the "explosive power" energy of the challenge,
            faded into the card's own indigo so the copy on the left stays
            legible without a heavy scrim. Narrower on phones, wider on
            larger screens, but present at every size — this is a mobile
            app first and foremost. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[30%] overflow-hidden md:w-[45%]">
          <img src={heroBoxJump} alt="" className="h-full w-full object-cover object-[70%_20%]" draggable={false} />
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-900 via-indigo-900/30 to-transparent" />
          <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(147,197,253,0.25)]" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-[68%] space-y-3 md:max-w-none">
            <span className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-extrabold text-blue-200 tracking-wider uppercase">
              🏆 30-DAY CHALLENGE
            </span>
            <h3 className="font-display text-2xl font-black leading-tight sm:text-3xl tracking-tight uppercase">
              Full Body Power
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 max-w-sm">
              Level up your strength and endurance from home. Complete daily workouts to win.
            </p>

            {/* Progress Section */}
            <div className="pt-2 max-w-xs">
              <div className="flex items-center justify-between text-xs text-blue-200 font-bold mb-1.5">
                <span>Challenge Progress</span>
                <span>{challengeCompleted} / {CHALLENGE_TARGET} Completed</span>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${challengePercent}%` }} />
              </div>
            </div>
          </div>

          <button 
            onClick={handleStartChallenge}
            className="self-start md:self-center inline-flex items-center gap-2 bg-white text-slate-900 font-black text-sm px-6 py-4 rounded-2xl hover:bg-slate-50 transition-all transform hover:scale-105 active:scale-95 shadow-lg"
          >
            <span>START DAY 1</span>
            <ChevronRight className="h-4 w-4 text-slate-900" />
          </button>
        </div>
      </div>

      {/* Compact Hub teaser — the full coaching suite (programs, badges,
          wellness tools, AI settings) lives one tap away on its own tab,
          instead of being duplicated inline here. */}
      <button
        onClick={() => onNavigate("premium-hub")}
        className="group relative w-full overflow-hidden rounded-[28px] bg-slate-950 p-6 text-left text-white shadow-xl transition-transform active:scale-[0.99]"
      >
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-lime-400/10 blur-3xl" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-lime-300">
              <Sparkles className="h-3 w-3" /> Coaching Hub
            </span>
            <h3 className="font-display mt-2 text-xl font-black tracking-tight">Programs, badges &amp; tools</h3>
            <p className="mt-1 text-xs text-white/50">Multi-week plans, {ACHIEVEMENTS.length} achievements, BMI &amp; calorie tools, water and breathing coaches.</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-300 text-slate-950 transition-transform group-hover:translate-x-0.5">
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>
        <div className="relative z-10 mt-4 flex gap-4 border-t border-white/10 pt-4 text-xs">
          <div><span className="font-black text-lime-300">{PROGRAM_PLANS.length}</span> <span className="text-white/40">programs</span></div>
          <div><span className="font-black text-lime-300">{ACHIEVEMENTS.length}</span> <span className="text-white/40">badges</span></div>
          <div><span className="font-black text-lime-300">32</span> <span className="text-white/40">tools</span></div>
        </div>
      </button>

      {/* 5. Horizontal Scrolling Body Focus Filter */}
      <div className="space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Body Focus</h2>
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none -mx-2 px-2">
          {categories.map(({ label: cat, icon: CatIcon }) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 py-2 px-5 rounded-full text-xs font-extrabold shrink-0 transition-all active:scale-95 ${
                activeCategory === cat
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              <CatIcon className={`h-3.5 w-3.5 ${activeCategory === cat ? "text-lime-300" : "text-slate-400"}`} />
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Active stats overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="group bg-white rounded-2xl p-4 border border-slate-100 shadow-xs transition-all hover:border-slate-200 hover:shadow-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Dumbbell className="h-3.5 w-3.5"/></div>
          <span className="mt-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Workouts</span>
          <span className="text-2xl font-black text-slate-900 mt-0.5 block">{profile.totalWorkouts}</span>
        </div>
        <div className="group bg-white rounded-2xl p-4 border border-slate-100 shadow-xs transition-all hover:border-slate-200 hover:shadow-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Clock3 className="h-3.5 w-3.5"/></div>
          <span className="mt-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Minutes</span>
          <span className="text-2xl font-black text-slate-900 mt-0.5 block">{profile.totalMinutes}</span>
        </div>
        <div className="group bg-white rounded-2xl p-4 border border-slate-100 shadow-xs transition-all hover:border-slate-200 hover:shadow-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><Flame className="h-3.5 w-3.5"/></div>
          <span className="mt-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Calories</span>
          <span className="text-2xl font-black text-slate-900 mt-0.5 block">{profile.totalCaloriesBurned} kcal</span>
        </div>
        <div className="group bg-white rounded-2xl p-4 border border-slate-100 shadow-xs transition-all hover:border-slate-200 hover:shadow-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-50 text-lime-700"><Trophy className="h-3.5 w-3.5"/></div>
          <span className="mt-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Goal Completed</span>
          <span className="text-2xl font-black text-blue-600 mt-0.5 block">{progressPercent}%</span>
        </div>
      </div>

      {/* 7. Workout Lists (Custom AI & Curated Pro) */}
      <div className="space-y-6 pt-4">
        {/* Custom AI routines section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-sans text-lg font-black tracking-tight text-slate-900 uppercase">
                Your AI Workouts
              </h3>
              <p className="text-xs text-slate-400">Custom sessions designed for you</p>
            </div>
            <button
              onClick={() => onNavigate("ai-generator")}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Generate
            </button>
          </div>

          {filteredSaved.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 p-6 text-center bg-white">
              <Sparkles className="mx-auto h-6 w-6 text-blue-500 animate-pulse" />
              <h4 className="mt-2 text-xs font-bold text-slate-700 uppercase tracking-wider">No matching custom workouts</h4>
              <p className="mt-1 text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                {searchQuery || activeCategory !== "All" 
                  ? "Try refining your search terms or filter tags above." 
                  : "Tap below to let AI design a customized workout based on your criteria."}
              </p>
              {!(searchQuery || activeCategory !== "All") && (
                <button
                  onClick={() => onNavigate("ai-generator")}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-blue-700 transition-all"
                >
                  Generate With AI
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {filteredSaved.map((workout) => (
                <WorkoutCard 
                  key={workout.id} 
                  workout={workout} 
                  onSelect={onSelectWorkout} 
                  onDelete={onDeleteWorkout}
                />
              ))}
            </div>
          )}
        </div>

        {/* Curated Pro routines section */}
        <div className="space-y-4 pt-4">
          <div>
            <h3 className="font-sans text-lg font-black tracking-tight text-slate-900 uppercase">
              Curated Pro Routines
            </h3>
            <p className="text-xs text-slate-400">
              {activeCoach ? (
                <>Showing <strong className="text-slate-600">{activeCoach}</strong>'s routines</>
              ) : (
                "Tap a coach to see just their routines"
              )}
            </p>

            {/* Coach picker — tapping a coach filters the list below down
                to just their routines (tap again, or "All", to reset). The
                selected coach gets a bold ring, a checkmark badge, and a
                colored name so the active filter is obvious at a glance. */}
            <div className="mt-3 flex gap-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              <button
                onClick={() => setActiveCoach(null)}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                  !activeCoach
                    ? "bg-slate-900 text-lime-300 ring-2 ring-slate-900 ring-offset-2 scale-105"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}>
                  All
                </div>
                <span className={`text-[10px] font-bold ${!activeCoach ? "text-slate-900" : "text-slate-400"}`}>Everyone</span>
              </button>

              {CERTIFIED_COACHES.map(c => {
                const isActive = activeCoach === c.name;
                return (
                  <button
                    key={c.name}
                    onClick={() => setActiveCoach(isActive ? null : c.name)}
                    className="flex shrink-0 flex-col items-center gap-1.5"
                  >
                    <div className={`relative rounded-full transition-all ${isActive ? "ring-2 ring-blue-600 ring-offset-2 scale-105" : "ring-2 ring-transparent"}`}>
                      <img
                        src={c.photo}
                        alt=""
                        className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-[0_4px_14px_rgb(0,0,0,0.08)]"
                        draggable={false}
                      />
                      {isActive && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 ring-2 ring-white">
                          <Check className="h-3 w-3 text-white" />
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold ${isActive ? "text-blue-600" : "text-slate-500"}`}>
                      {c.name.replace(/^Coach /, "")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredCurated.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
              <p className="text-xs text-slate-400">No matching trainer workouts found.</p>
              {activeCoach && (
                <button
                  onClick={() => setActiveCoach(null)}
                  className="mt-2 text-xs font-bold text-blue-600 hover:underline"
                >
                  Show all coaches
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {filteredCurated.map((workout) => (
                <WorkoutCard 
                  key={workout.id} 
                  workout={workout} 
                  onSelect={onSelectWorkout} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
