import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile, Workout, WorkoutLog, ProgressLog } from "./types";
import Dashboard from "./components/Dashboard";
import AiGenerator from "./components/AiGenerator";
import ActiveWorkout from "./components/ActiveWorkout";
import HistoryLogs from "./components/HistoryLogs";
import ExerciseLibrary from "./components/ExerciseLibrary";
import ProgressTracker from "./components/ProgressTracker";
import PremiumHub from "./components/PremiumHub";
import Confetti from "./components/Confetti";
import Onboarding from "./components/Onboarding";
import PersonalizeFlow, { PersonalizeData } from "./components/PersonalizeFlow";
import { computeUnlockedAchievements } from "./lib/achievements";
import { Dumbbell, History, TrendingUp, Compass, Sparkles, CheckCircle2, Moon, SunMedium } from "lucide-react";

const FRESH_APP_VERSION = "home-fitness-coach-clean-premium-v5";

const EMPTY_PROFILE: UserProfile = {
  fitnessLevel: "Beginner",
  goal: "General Health",
  preferredEquipment: ["bodyweight"],
  streakDays: 0,
  totalWorkouts: 0,
  totalMinutes: 0,
  totalCaloriesBurned: 0,
  lastWorkoutDate: undefined,
};

function clearLocalTrainingData() {
  [
    "kinetic_profile",
    "kinetic_workouts",
    "kinetic_logs",
    "kinetic_progress_tracker_logs",
    "kinetic_premium_preferences",
    "kinetic_favorites",
    "kinetic_water_intake",
    "kinetic_onboarding_seen",
    "kinetic_personalize_status",
  ].forEach(k => localStorage.removeItem(k));
}

export default function App() {
  // The first launch of this premium build deliberately starts with zero records.
  // A versioned marker prevents the clean-up from repeating on every refresh.
  const [freshReady] = useState(() => {
    if (localStorage.getItem("kinetic_fresh_build_version") !== FRESH_APP_VERSION) {
      clearLocalTrainingData();
      localStorage.setItem("kinetic_fresh_build_version", FRESH_APP_VERSION);
    }
    return true;
  });

  const [currentView, setCurrentView] = useState<"dashboard" | "ai-generator" | "history-logs" | "active-workout" | "exercise-library" | "progress-tracker" | "premium-hub">("dashboard");
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [preselectedExerciseForLog, setPreselectedExerciseForLog] = useState<string | undefined>();
  const [isPremium, setIsPremium] = useState(() => localStorage.getItem("kinetic_subscription_mode") !== "basic");
  const [toast, setToast] = useState<string | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("kinetic_onboarding_seen"));
  const [personalizeMode, setPersonalizeMode] = useState<"onboarding" | "edit" | null>(null);

  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("kinetic_app_theme") as "light" | "dark") || "light");

  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem("kinetic_profile");
    if (saved) {
      try { return { ...EMPTY_PROFILE, ...JSON.parse(saved) }; } catch {}
    }
    return { ...EMPTY_PROFILE };
  });

  const [savedWorkouts, setSavedWorkouts] = useState<Workout[]>(() => {
    const saved = localStorage.getItem("kinetic_workouts");
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return [];
  });

  const [logs, setLogs] = useState<WorkoutLog[]>(() => {
    const saved = localStorage.getItem("kinetic_logs");
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return [];
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem("kinetic_favorites");
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return [];
  });

  const prevAchievementCount = useRef<number | null>(null);

  useEffect(() => { if (freshReady) localStorage.setItem("kinetic_profile", JSON.stringify(profile)); }, [profile, freshReady]);
  useEffect(() => { if (freshReady) localStorage.setItem("kinetic_workouts", JSON.stringify(savedWorkouts)); }, [savedWorkouts, freshReady]);
  useEffect(() => { if (freshReady) localStorage.setItem("kinetic_logs", JSON.stringify(logs)); }, [logs, freshReady]);
  useEffect(() => { localStorage.setItem("kinetic_subscription_mode", isPremium ? "premium" : "basic"); }, [isPremium]);
  useEffect(() => { if (freshReady) localStorage.setItem("kinetic_favorites", JSON.stringify(favorites)); }, [favorites, freshReady]);
  useEffect(() => { localStorage.setItem("kinetic_app_theme", theme); }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!confettiActive) return;
    const id = window.setTimeout(() => setConfettiActive(false), 2600);
    return () => window.clearTimeout(id);
  }, [confettiActive]);

  const handleSubscriptionToggle = (value: boolean) => {
    setIsPremium(value);
    setToast(value ? "Premium activated — all coaching modules are unlocked." : "Basic mode enabled — essential training remains available.");
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");

  const dismissOnboarding = () => {
    localStorage.setItem("kinetic_onboarding_seen", "1");
    setShowOnboarding(false);
    // First launch only: flow straight from the welcome slides into the
    // optional personalize wizard. Editing later never re-triggers this.
    if (!localStorage.getItem("kinetic_personalize_status")) {
      setPersonalizeMode("onboarding");
    }
  };

  const handlePersonalizeComplete = (data: PersonalizeData) => {
    setProfile(prev => ({ ...prev, ...data }));
    localStorage.setItem("kinetic_personalize_status", "done");
    setPersonalizeMode(null);
    setToast("Profile saved. Your plan is now personalized.");
  };

  const handlePersonalizeSkip = () => {
    localStorage.setItem("kinetic_personalize_status", "skipped");
    setPersonalizeMode(null);
  };

  const openEditProfile = () => setPersonalizeMode("edit");

  const handleWorkoutGenerated = (newWorkout: Workout) => {
    setSavedWorkouts(prev => [newWorkout, ...prev]);
    setSelectedWorkout(newWorkout);
    setCurrentView("active-workout");
  };

  const handleDeleteWorkout = (id: string) => setSavedWorkouts(prev => prev.filter(w => w.id !== id));

  const checkForNewAchievement = (nextProfile: UserProfile, nextLogs: WorkoutLog[]) => {
    try {
      const progressLogs: ProgressLog[] = JSON.parse(localStorage.getItem("kinetic_progress_tracker_logs") || "[]");
      const unlocked = computeUnlockedAchievements(nextProfile, nextLogs, progressLogs, favorites.length);
      if (prevAchievementCount.current !== null && unlocked.size > prevAchievementCount.current) {
        setToast(`🏆 New badge unlocked! (${unlocked.size}/24 total) — check the Hub.`);
      }
      prevAchievementCount.current = unlocked.size;
    } catch {}
  };

  const handleLogWorkout = (newLog: WorkoutLog) => {
    setLogs(prev => {
      const next = [newLog, ...prev];
      return next;
    });
    let updatedStreak = 1;
    if (profile.lastWorkoutDate) {
      const last = new Date(profile.lastWorkoutDate);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (last.toDateString() === yesterday.toDateString()) updatedStreak = profile.streakDays + 1;
      else if (last.toDateString() === new Date().toDateString()) updatedStreak = profile.streakDays;
    }
    const nextProfile: UserProfile = {
      ...profile,
      totalWorkouts: profile.totalWorkouts + 1,
      totalMinutes: profile.totalMinutes + newLog.durationMinutes,
      totalCaloriesBurned: profile.totalCaloriesBurned + newLog.estimatedCaloriesBurned,
      streakDays: Math.max(1, updatedStreak),
      lastWorkoutDate: new Date().toISOString()
    };
    setProfile(nextProfile);
    setCurrentView("dashboard");
    setSelectedWorkout(null);
    setConfettiActive(true);
    setToast("Workout saved. Your progress now starts building from this session.");
    checkForNewAchievement(nextProfile, [newLog, ...logs]);
  };

  const handleResetAllData = () => {
    clearLocalTrainingData();
    setProfile({ ...EMPTY_PROFILE });
    setSavedWorkouts([]);
    setLogs([]);
    setFavorites([]);
    setIsPremium(true);
    prevAchievementCount.current = null;
    localStorage.setItem("kinetic_fresh_build_version", FRESH_APP_VERSION);
    setToast("Everything reset. Your training profile is completely empty.");
  };

  const handleClearLogs = () => {
    setLogs([]);
    setProfile(prev => ({ ...prev, totalWorkouts: 0, totalMinutes: 0, totalCaloriesBurned: 0, streakDays: 0, lastWorkoutDate: undefined }));
    localStorage.removeItem("kinetic_progress_tracker_logs");
    setToast("Training records cleared.");
  };

  const handleDeleteLog = (id: string) => {
    const target = logs.find(l => l.id === id);
    if (!target) return;
    setLogs(prev => prev.filter(l => l.id !== id));
    setProfile(prev => ({
      ...prev,
      totalWorkouts: Math.max(0, prev.totalWorkouts - 1),
      totalMinutes: Math.max(0, prev.totalMinutes - target.durationMinutes),
      totalCaloriesBurned: Math.max(0, prev.totalCaloriesBurned - target.estimatedCaloriesBurned)
    }));
  };

  const handleSelectWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
    setCurrentView("active-workout");
  };

  const nav = (view: typeof currentView) => {
    setPreselectedExerciseForLog(undefined);
    setCurrentView(view);
  };

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="min-h-screen bg-slate-100/60 text-slate-800 font-sans antialiased flex justify-center">
        <div className={`w-full max-w-lg min-h-screen border-x border-slate-100 bg-[#F8F9FA] shadow-2xl relative ${currentView === "active-workout" ? "pb-4" : "pb-28"}`}>
          {currentView !== "active-workout" && (
            <div className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 px-5 py-2.5 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isPremium ? "bg-slate-950 text-lime-300" : "bg-slate-100 text-slate-600"}`}><Sparkles className="h-3.5 w-3.5"/></div>
                  <div className="min-w-0">
                    <p className={`truncate text-[10px] font-black uppercase tracking-[.14em] ${isPremium ? "text-lime-700" : "text-slate-500"}`}>
                      {isPremium ? "Premium activated" : "Basic version"}
                    </p>
                    <p className="truncate text-[9px] font-bold text-slate-400">Fresh profile • {profile.totalWorkouts} completed</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={toggleTheme} title="Toggle dark mode" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 active:scale-90">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={theme}
                        initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
                        transition={{ duration: 0.2 }}
                        className="flex"
                      >
                        {theme === "dark" ? <SunMedium className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                  <button onClick={() => handleSubscriptionToggle(!isPremium)} className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 ${isPremium ? "bg-slate-950 text-white" : "bg-lime-300 text-slate-950"}`}>
                    {isPremium ? "Basic" : "Premium"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <main className={`min-h-screen ${currentView === "active-workout" ? "p-0" : "p-5"}`}>
           <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
            {currentView === "dashboard" && (
              <Dashboard
                profile={profile}
                setProfile={setProfile}
                savedWorkouts={savedWorkouts}
                logs={logs}
                onSelectWorkout={handleSelectWorkout}
                onDeleteWorkout={handleDeleteWorkout}
                onNavigate={(view) => setCurrentView(view)}
                onResetAllData={handleResetAllData}
                isPremium={isPremium}
                onTogglePremium={handleSubscriptionToggle}
                favorites={favorites}
                onEditProfile={openEditProfile}
              />
            )}

            {currentView === "ai-generator" && (
              <AiGenerator profile={profile} setProfile={setProfile} onBack={() => setCurrentView("dashboard")} onWorkoutGenerated={handleWorkoutGenerated}/>
            )}

            {currentView === "exercise-library" && (
              <ExerciseLibrary
                onNavigateToLog={(exName) => { setPreselectedExerciseForLog(exName); setCurrentView("progress-tracker"); }}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                profile={profile}
              />
            )}

            {currentView === "premium-hub" && (
              <PremiumHub
                isPremium={isPremium}
                onTogglePremium={handleSubscriptionToggle}
                profile={profile}
                setProfile={setProfile}
                logs={logs}
                favorites={favorites}
                onStartWorkout={handleSelectWorkout}
              />
            )}

            {currentView === "progress-tracker" && <ProgressTracker preselectedExercise={preselectedExerciseForLog}/>}

            {currentView === "history-logs" && (
              <HistoryLogs logs={logs} onBack={() => setCurrentView("dashboard")} onClearLogs={handleClearLogs} onDeleteLog={handleDeleteLog}/>
            )}

            {currentView === "active-workout" && selectedWorkout && (
              <ActiveWorkout workout={selectedWorkout} onBack={() => { setCurrentView("dashboard"); setSelectedWorkout(null); }} onLogWorkout={handleLogWorkout} profile={profile}/>
            )}

            {currentView === "ai-generator" && !isPremium && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-5 backdrop-blur-sm">
                <div className="max-w-sm rounded-[28px] bg-white p-6 text-center shadow-2xl">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lime-300"><Sparkles className="h-5 w-5"/></div>
                  <h3 className="mt-4 text-xl font-black">AI Coach is Premium</h3>
                  <p className="mt-2 text-sm text-slate-500">Switch to Premium to unlock adaptive AI workout generation.</p>
                  <button onClick={() => { handleSubscriptionToggle(true); setCurrentView("premium-hub"); }} className="mt-5 w-full rounded-2xl bg-slate-950 py-3 text-sm font-black text-white">Activate Premium</button>
                </div>
              </div>
            )}
            </motion.div>
           </AnimatePresence>
          </main>

          {currentView !== "active-workout" && (
            <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-lg items-center justify-around rounded-t-[24px] border-t border-slate-100 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,.04)] backdrop-blur-md">
              {[
                ["dashboard", Dumbbell, "Train"],
                ["exercise-library", Compass, "Academy"],
                ["progress-tracker", TrendingUp, "Progress"],
                ["premium-hub", Sparkles, "Hub"],
                ["history-logs", History, "History"]
              ].map(([view, Icon, label]: any) => (
                <button key={view} onClick={() => nav(view)} className={`relative flex flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 transition-colors ${currentView === view ? "text-blue-600" : "text-slate-400 hover:text-slate-500"}`}>
                  {currentView === view && (
                    <motion.div
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-xl bg-blue-50"
                      transition={{ type: "spring", stiffness: 480, damping: 34 }}
                    />
                  )}
                  <motion.span
                    animate={{ y: currentView === view ? -1 : 0, scale: currentView === view ? 1.08 : 1 }}
                    transition={{ type: "spring", stiffness: 480, damping: 24 }}
                    className="relative"
                  >
                    <Icon className="h-5 w-5"/>
                  </motion.span>
                  <span className="relative text-[9px] font-black uppercase tracking-wider">{label}</span>
                </button>
              ))}
            </nav>
          )}

          {toast && (
            <div className="fixed bottom-24 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-[10px] font-black text-white shadow-xl">
              <CheckCircle2 className="h-3.5 w-3.5 text-lime-300"/> {toast}
            </div>
          )}

          <Confetti active={confettiActive} />
          {showOnboarding && <Onboarding onDone={dismissOnboarding} />}
          {!showOnboarding && personalizeMode && (
            <PersonalizeFlow
              mode={personalizeMode}
              initial={{ gender: profile.gender, race: profile.race, age: profile.age, heightCm: profile.heightCm, weightKg: profile.weightKg }}
              onComplete={handlePersonalizeComplete}
              onSkip={handlePersonalizeSkip}
              onClose={() => setPersonalizeMode(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
