import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  Activity,
  Command as CommandIcon,
  Compass,
  Dumbbell,
  History,
  Moon,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  SunMedium,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ProgressLog, UserProfile, Workout, WorkoutLog } from "./types";
import Dashboard from "./components/Dashboard";
import ActiveWorkout from "./components/ActiveWorkout";
import Confetti from "./components/Confetti";
import Onboarding from "./components/Onboarding";
import PersonalizeFlow, { type PersonalizeData } from "./components/PersonalizeFlow";
import AnalyticsDrawer from "./components/AnalyticsDrawer";
import CommandPalette, { type Command } from "./components/CommandPalette";
import { computeUnlockedAchievements } from "./lib/achievements";
import { CURATED_WORKOUTS } from "./constants";
import { tapFeedback } from "./lib/haptics";
import { MagneticButton } from "./components/ui";
import { useTheme } from "./hooks/useTheme";
import { useIsDesktop } from "./hooks/useMediaQuery";
import { screenVariants, SPRING_SNAP, SPRING_WEIGHTED } from "./design/motion";
import { accent } from "./design/accents";

/**
 * Secondary screens are code-split.
 *
 * Dashboard and ActiveWorkout stay in the main bundle because they are
 * the core loop — open the app, start a session — and a spinner on that
 * path would be a downgrade. Everything below is reached by an explicit
 * tap, which is exactly the moment there is budget to fetch a chunk.
 */
import {
  computeAnalytics,
  deriveProfileTotals,
  trainedToday,
} from "./lib/analytics";
import { planNudge, shouldNudgeToday } from "./lib/smartNudge";
import {
  applyAllNotificationPrefs,
  loadNotificationPrefs,
  hasNotificationPermission,
} from "./lib/notifications";

const AiGenerator = lazy(() => import("./components/AiGenerator"));
const SettingsPage = lazy(() => import("./components/SettingsPage"));
const CommunityGallery = lazy(() => import("./components/CommunityGallery"));
const HistoryLogs = lazy(() => import("./components/HistoryLogs"));
const ExerciseLibrary = lazy(() => import("./components/ExerciseLibrary"));
const ProgressTracker = lazy(() => import("./components/ProgressTracker"));
const PremiumHub = lazy(() => import("./components/PremiumHub"));

const FRESH_APP_VERSION = "home-fitness-coach-clean-premium-v5";

type View =
  | "dashboard"
  | "ai-generator"
  | "history-logs"
  | "active-workout"
  | "exercise-library"
  | "progress-tracker"
  | "premium-hub"
  | "settings"
  | "community";

type NavTarget = Exclude<View, "active-workout">;

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

const NAV: { view: NavTarget; icon: LucideIcon; label: string }[] = [
  { view: "dashboard", icon: Dumbbell, label: "Train" },
  { view: "exercise-library", icon: Compass, label: "Academy" },
  { view: "progress-tracker", icon: TrendingUp, label: "Progress" },
  { view: "premium-hub", icon: Sparkles, label: "Hub" },
  { view: "history-logs", icon: History, label: "History" },
];

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
  ].forEach((k) => localStorage.removeItem(k));
}

/**
 * Application shell.
 *
 * Responsibilities are deliberately narrow: own the persisted state,
 * decide which screen is mounted, and provide the three things that must
 * be reachable from anywhere — navigation, the performance drawer and
 * the command palette. No screen-specific logic lives here.
 *
 * The chrome is adaptive rather than scaled. On a phone it is a bottom
 * tab bar within thumb reach; from 1024px it becomes a left rail with
 * labels, because a bottom bar on a 27" display is a phone layout
 * stretched across a desk. Both share one `LayoutGroup`, so the active
 * indicator is a single element that travels between items instead of
 * cross-fading — the detail that makes tab switching feel continuous.
 *
 * Session mode hides all chrome. During a workout, navigation is not
 * just unnecessary, it is a hazard: the most common accidental tap in a
 * fitness app is hitting a tab bar mid-burpee and losing the session.
 */
export default function App() {
  // The first launch of this build starts with zero records. A versioned
  // marker stops the clean-up repeating on every refresh.
  const [freshReady] = useState(() => {
    if (localStorage.getItem("kinetic_fresh_build_version") !== FRESH_APP_VERSION) {
      clearLocalTrainingData();
      localStorage.setItem("kinetic_fresh_build_version", FRESH_APP_VERSION);
    }
    return true;
  });

  const isDesktop = useIsDesktop();
  const [theme, toggleTheme] = useTheme();

  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [preselectedExerciseForLog, setPreselectedExerciseForLog] =
    useState<string | undefined>();
  const [isPremium, setIsPremium] = useState(
    () => localStorage.getItem("kinetic_subscription_mode") !== "basic",
  );
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("kinetic_onboarding_seen"),
  );
  const [personalizeMode, setPersonalizeMode] =
    useState<"onboarding" | "edit" | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem("kinetic_profile");
    if (saved) {
      try {
        return { ...EMPTY_PROFILE, ...JSON.parse(saved) };
      } catch {
        /* corrupt entry — fall through to a clean profile */
      }
    }
    return { ...EMPTY_PROFILE };
  });

  const [savedWorkouts, setSavedWorkouts] = useState<Workout[]>(() => {
    const saved = localStorage.getItem("kinetic_workouts");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }
    return [];
  });

  const [logs, setLogs] = useState<WorkoutLog[]>(() => {
    const saved = localStorage.getItem("kinetic_logs");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }
    return [];
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem("kinetic_favorites");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }
    return [];
  });

  /**
   * The profile every screen actually receives.
   * Session totals are DERIVED from `logs` rather than stored on the profile.
   */
  const derivedProfile = useMemo<UserProfile>(
    () => ({ ...profile, ...deriveProfileTotals(logs) }),
    [profile, logs],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = loadNotificationPrefs();
      const anyEnabled =
        prefs.dailyReminderEnabled ||
        prefs.streakWarningEnabled ||
        prefs.waterReminderEnabled;
      if (!anyEnabled) return;
      if (!(await hasNotificationPermission())) return;
      if (cancelled) return;

      const trained = trainedToday(logs);
      const nudge = planNudge(computeAnalytics(logs, profile));
      await applyAllNotificationPrefs(
        prefs,
        trained,
        shouldNudgeToday(nudge, trained) ? nudge : undefined,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [logs, profile]);

  const prevAchievementCount = useRef<number | null>(null);

  /* ---------------------------- persistence --------------------------- */
  useEffect(() => {
    if (freshReady) localStorage.setItem("kinetic_profile", JSON.stringify(profile));
  }, [profile, freshReady]);
  useEffect(() => {
    if (freshReady)
      localStorage.setItem("kinetic_workouts", JSON.stringify(savedWorkouts));
  }, [savedWorkouts, freshReady]);
  useEffect(() => {
    if (freshReady) localStorage.setItem("kinetic_logs", JSON.stringify(logs));
  }, [logs, freshReady]);
  useEffect(() => {
    localStorage.setItem("kinetic_subscription_mode", isPremium ? "premium" : "basic");
  }, [isPremium]);
  useEffect(() => {
    if (freshReady)
      localStorage.setItem("kinetic_favorites", JSON.stringify(favorites));
  }, [favorites, freshReady]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!confettiActive) return;
    const id = window.setTimeout(() => setConfettiActive(false), 2600);
    return () => window.clearTimeout(id);
  }, [confettiActive]);

  const notify = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  /* ------------------------ keyboard shortcuts ------------------------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAnalyticsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ------------------------------ actions ----------------------------- */
  const handleSubscriptionToggle = (value: boolean) => {
    setIsPremium(value);
    notify(
      value
        ? "Premium activated — all coaching modules unlocked."
        : "Basic mode enabled — essential training remains available.",
    );
  };

  const toggleFavorite = (id: string) =>
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );

  const dismissOnboarding = () => {
    localStorage.setItem("kinetic_onboarding_seen", "1");
    setShowOnboarding(false);
    if (!localStorage.getItem("kinetic_personalize_status")) {
      setPersonalizeMode("onboarding");
    }
  };

  const handlePersonalizeComplete = (data: PersonalizeData) => {
    setProfile((prev) => ({ ...prev, ...data }));
    localStorage.setItem("kinetic_personalize_status", "done");
    setPersonalizeMode(null);
    notify("Profile saved. Your plan is now personalized.");
  };

  const handlePersonalizeSkip = () => {
    localStorage.setItem("kinetic_personalize_status", "skipped");
    setPersonalizeMode(null);
  };

  const handleWorkoutGenerated = (newWorkout: Workout) => {
    setSavedWorkouts((prev) => [newWorkout, ...prev]);
    setSelectedWorkout(newWorkout);
    setCurrentView("active-workout");
  };

  const handleDeleteWorkout = (id: string) =>
    setSavedWorkouts((prev) => prev.filter((w) => w.id !== id));

  const checkForNewAchievement = (
    nextProfile: UserProfile,
    nextLogs: WorkoutLog[],
  ) => {
    try {
      const progressLogs: ProgressLog[] = JSON.parse(
        localStorage.getItem("kinetic_progress_tracker_logs") || "[]",
      );
      const unlocked = computeUnlockedAchievements(
        nextProfile,
        nextLogs,
        progressLogs,
        favorites.length,
      );
      if (
        prevAchievementCount.current !== null &&
        unlocked.size > prevAchievementCount.current
      ) {
        notify(`New badge unlocked — ${unlocked.size} total. Check the Hub.`);
      }
      prevAchievementCount.current = unlocked.size;
    } catch {
      /* progress log unreadable — badge check skipped, not fatal */
    }
  };

  const handleLogWorkout = (newLog: WorkoutLog) => {
    setLogs((prev) => [newLog, ...prev]);
    const nextProfile: UserProfile = { ...profile };
    setProfile(nextProfile);
    setCurrentView("dashboard");
    setSelectedWorkout(null);
    setConfettiActive(true);
    notify("Workout saved. Your progress starts building from this session.");
    const nextLogs = [newLog, ...logs];
    checkForNewAchievement(
      { ...nextProfile, ...deriveProfileTotals(nextLogs) },
      nextLogs,
    );
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
    notify("Everything reset. Your training profile is completely empty.");
  };

  const handleClearLogs = () => {
    setLogs([]);
    localStorage.removeItem("kinetic_progress_tracker_logs");
    notify("Training records cleared.");
  };

  const handleDeleteLog = (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSelectWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
    setCurrentView("active-workout");
  };

  const nav = useCallback((view: NavTarget) => {
    tapFeedback();
    setPreselectedExerciseForLog(undefined);
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  /* --------------------------- command list --------------------------- */
  const commands = useMemo<Command[]>(() => {
    const featured = savedWorkouts[0] ?? CURATED_WORKOUTS[0];
    const list: Command[] = [
      ...NAV.map((n) => ({
        id: `go-${n.view}`,
        label: n.label,
        hint: "Go to screen",
        icon: n.icon,
        group: "Navigate",
        tone: "cyan" as const,
        keywords: n.view,
        run: () => nav(n.view),
      })),
      {
        id: "start-featured",
        label: featured ? `Start "${featured.workoutTitle}"` : "Start a workout",
        hint: "Begin a session now",
        icon: Play,
        group: "Actions",
        tone: "emerald",
        keywords: "begin train session workout",
        run: () => featured && handleSelectWorkout(featured),
      },
      {
        id: "ai-generate",
        label: "Generate a workout with AI",
        hint: "Build a routine for your profile",
        icon: Sparkles,
        group: "Actions",
        tone: "emerald",
        keywords: "ai create new routine generate",
        run: () => nav("ai-generator"),
      },
      {
        id: "analytics",
        label: "Performance review",
        hint: "Weekly insights and trends",
        icon: Trophy,
        group: "Actions",
        tone: "gold",
        keywords: "stats analytics insights trends weekly",
        run: () => setAnalyticsOpen(true),
      },
      {
        id: "theme",
        label: theme === "obsidian" ? "Switch to daylight" : "Switch to obsidian",
        hint: "Change the app theme",
        icon: theme === "obsidian" ? SunMedium : Moon,
        group: "Preferences",
        tone: "neutral",
        keywords: "theme dark light mode appearance",
        run: () => toggleTheme(),
      },
      {
        id: "premium",
        label: isPremium ? "Switch to basic" : "Activate premium",
        hint: "Toggle the subscription mode",
        icon: Sparkles,
        group: "Preferences",
        tone: "gold",
        keywords: "premium basic subscription upgrade",
        run: () => handleSubscriptionToggle(!isPremium),
      },
      {
        id: "reset",
        label: "Reset all data",
        hint: "Wipe profile, routines and history",
        icon: RotateCcw,
        group: "Danger",
        tone: "crimson",
        keywords: "reset wipe delete clear erase",
        run: handleResetAllData,
      },
    ];
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, savedWorkouts, theme, isPremium]);

  const inSession = currentView === "active-workout";

  /* ------------------------------ render ------------------------------ */
  return (
    <div
      className="min-h-[100dvh] antialiased"
      style={{ background: "var(--void)", color: "var(--ink)" }}
    >
      <LayoutGroup id="app-chrome">
        <div className="mx-auto flex w-full max-w-[1320px] justify-center lg:gap-6 lg:px-6">
          {/* ------------------------ SIDE RAIL ------------------------ */}
          {!inSession && isDesktop && (
            <aside className="sticky top-0 hidden h-[100dvh] w-[232px] shrink-0 flex-col justify-between py-7 lg:flex">
              {/* Rail background — subtle aurora gradient on desktop */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                  background:
                    "radial-gradient(ellipse 100% 50% at 0% 30%, var(--aurora-a) 0%, transparent 70%), radial-gradient(ellipse 80% 40% at 20% 80%, var(--aurora-b) 0%, transparent 60%)",
                }}
              />

              <div>
                {/* Brand mark */}
                <div className="flex items-center gap-2.5 px-3">
                  <motion.span
                    className="grid h-9 w-9 place-items-center rounded-md2"
                    style={{
                      background: "var(--emerald-wash)",
                      color: "var(--emerald)",
                    }}
                    whileHover={{ scale: 1.08, rotate: 4 }}
                    transition={SPRING_SNAP}
                  >
                    <Activity className="h-4.5 w-4.5" strokeWidth={2.6} />
                  </motion.span>
                  <span className="min-w-0">
                    <span className="font-display block truncate text-sm font-extrabold tracking-tight text-ink">
                      Home Fitness
                    </span>
                    <span className="block truncate text-[10px] font-bold text-ink-4">
                      {isPremium ? "Premium" : "Basic"} ·{" "}
                      {derivedProfile.totalWorkouts} logged
                    </span>
                  </span>
                </div>

                <nav className="mt-8 space-y-1" aria-label="Main">
                  {NAV.map((item) => (
                    <RailItem
                      key={item.view}
                      {...item}
                      active={currentView === item.view}
                      onClick={() => nav(item.view)}
                    />
                  ))}
                </nav>
              </div>

              <div className="space-y-2 px-1">
                {/* Quick-launch: AI generator */}
                <motion.button
                  type="button"
                  onClick={() => nav("ai-generator")}
                  className="flex w-full items-center gap-2.5 rounded-lg2 px-3 py-2.5 text-left text-xs font-semibold transition-colors"
                  style={{
                    background: "var(--emerald-wash)",
                    color: "var(--emerald)",
                  }}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING_SNAP}
                >
                  <Zap className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                  <span className="flex-1 truncate">AI Workout</span>
                </motion.button>

                {/* Search / command palette button */}
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="flex w-full items-center gap-2.5 rounded-lg2 border border-line px-3 py-2.5 text-left text-xs text-ink-4 transition-colors hover:text-ink-2"
                >
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">Search…</span>
                  <kbd className="shrink-0 rounded border border-line px-1 py-0.5 text-[9px] font-bold">
                    ⌘K
                  </kbd>
                </button>

                <div className="flex gap-2">
                  <MagneticButton
                    size="md"
                    variant="ghost"
                    tone="neutral"
                    block
                    className="border border-line"
                    onClick={() => setAnalyticsOpen(true)}
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    Stats
                  </MagneticButton>
                  <MagneticButton
                    size="md"
                    icon
                    variant="ghost"
                    tone="neutral"
                    aria-label={`Switch to ${theme === "obsidian" ? "daylight" : "obsidian"} theme`}
                    className="border border-line"
                    onClick={() => toggleTheme()}
                  >
                    <ThemeIcon theme={theme} />
                  </MagneticButton>
                </div>
              </div>
            </aside>
          )}

          {/* ------------------------- CONTENT ------------------------- */}
          <div
            className={[
              "relative w-full min-w-0",
              inSession ? "" : "max-w-lg lg:max-w-none",
              inSession ? "" : "border-x border-line lg:border-x-0",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ background: inSession ? undefined : "var(--obsidian)" }}
          >
            {/* Top bar — phone only */}
            {!inSession && !isDesktop && (
              <div
                className="glass sticky top-0 z-40 border-x-0 border-t-0 px-4 pb-2.5"
                style={{ paddingTop: "calc(var(--safe-t) + 10px)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <motion.span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px]"
                      style={{
                        background: isPremium
                          ? "var(--emerald-wash)"
                          : "var(--line-faint)",
                        color: isPremium ? "var(--emerald)" : "var(--ink-3)",
                      }}
                      whileTap={{ scale: 0.9 }}
                      transition={SPRING_SNAP}
                    >
                      <Activity className="h-3.5 w-3.5" strokeWidth={2.6} />
                    </motion.span>
                    <div className="min-w-0">
                      <p
                        className="truncate text-[10px] font-extrabold uppercase tracking-[0.14em]"
                        style={{
                          color: isPremium ? "var(--emerald)" : "var(--ink-3)",
                        }}
                      >
                        {isPremium ? "Premium" : "Basic"}
                      </p>
                      <p className="truncate text-[9px] font-bold text-ink-4">
                        {derivedProfile.totalWorkouts} sessions logged
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <MagneticButton
                      size="sm"
                      icon
                      variant="ghost"
                      tone="neutral"
                      aria-label="Open command palette"
                      className="border border-line"
                      onClick={() => setPaletteOpen(true)}
                    >
                      <CommandIcon className="h-3.5 w-3.5" />
                    </MagneticButton>
                    <MagneticButton
                      size="sm"
                      icon
                      variant="ghost"
                      tone="neutral"
                      aria-label={`Switch to ${theme === "obsidian" ? "daylight" : "obsidian"} theme`}
                      className="border border-line"
                      onClick={() => toggleTheme()}
                    >
                      <ThemeIcon theme={theme} />
                    </MagneticButton>
                    <MagneticButton
                      size="sm"
                      variant={isPremium ? "ghost" : "solid"}
                      tone={isPremium ? "neutral" : "emerald"}
                      className={isPremium ? "border border-line" : ""}
                      onClick={() => handleSubscriptionToggle(!isPremium)}
                    >
                      {isPremium ? "Basic" : "Premium"}
                    </MagneticButton>
                  </div>
                </div>
              </div>
            )}

            <main
              className={inSession ? "" : "px-4 pt-5 sm:px-6 lg:px-0 lg:pt-8"}
              style={
                inSession
                  ? undefined
                  : { paddingBottom: "calc(var(--safe-b) + 108px)" }
              }
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentView}
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                 <Suspense fallback={<ScreenSkeleton />}>
                  {currentView === "dashboard" && (
                    <Dashboard
                      profile={derivedProfile}
                      setProfile={setProfile}
                      savedWorkouts={savedWorkouts}
                      logs={logs}
                      onSelectWorkout={handleSelectWorkout}
                      onDeleteWorkout={handleDeleteWorkout}
                      onNavigate={(v) => nav(v)}
                      onResetAllData={handleResetAllData}
                      isPremium={isPremium}
                      onTogglePremium={handleSubscriptionToggle}
                      favorites={favorites}
                      onEditProfile={() => setPersonalizeMode("edit")}
                      onOpenAnalytics={() => setAnalyticsOpen(true)}
                      onOpenSettings={() => nav("settings")}
                    />
                  )}

                  {currentView === "ai-generator" && (
                    <AiGenerator
                      profile={derivedProfile}
                      setProfile={setProfile}
                      onBack={() => nav("dashboard")}
                      onWorkoutGenerated={handleWorkoutGenerated}
                    />
                  )}

                  {currentView === "exercise-library" && (
                    <ExerciseLibrary
                      onNavigateToLog={(exName) => {
                        setPreselectedExerciseForLog(exName);
                        setCurrentView("progress-tracker");
                      }}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                      profile={derivedProfile}
                    />
                  )}

                  {currentView === "premium-hub" && (
                    <PremiumHub
                      isPremium={isPremium}
                      onTogglePremium={handleSubscriptionToggle}
                      profile={derivedProfile}
                      setProfile={setProfile}
                      logs={logs}
                      favorites={favorites}
                      onStartWorkout={handleSelectWorkout}
                    />
                  )}

                  {currentView === "progress-tracker" && (
                    <ProgressTracker
                      preselectedExercise={preselectedExerciseForLog}
                    />
                  )}

                  {currentView === "history-logs" && (
                    <HistoryLogs
                      logs={logs}
                      onBack={() => nav("dashboard")}
                      onClearLogs={handleClearLogs}
                      onDeleteLog={handleDeleteLog}
                    />
                  )}

                  {currentView === "settings" && (
                    <SettingsPage
                      onBack={() => nav("dashboard")}
                      onOpenCommunity={() => nav("community")}
                      theme={theme === "daylight" ? "light" : "dark"}
                      onToggleTheme={toggleTheme}
                      onEditProfile={() => setPersonalizeMode("edit")}
                      onResetAllData={handleResetAllData}
                    />
                  )}

                  {currentView === "community" && (
                    <CommunityGallery onBack={() => nav("settings")} />
                  )}

                  {inSession && selectedWorkout && (
                    <ActiveWorkout
                      workout={selectedWorkout}
                      onBack={() => {
                        setCurrentView("dashboard");
                        setSelectedWorkout(null);
                      }}
                      onLogWorkout={handleLogWorkout}
                      profile={derivedProfile}
                    />
                  )}
                 </Suspense>
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>

        {/* ----------------------- BOTTOM NAV (phone) ------------------- */}
        {!inSession && !isDesktop && (
          <nav
            aria-label="Main"
            className="glass fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-lg items-stretch justify-around rounded-t-[26px] border-x-0 border-b-0 px-2 pt-2"
            style={{ paddingBottom: "calc(var(--safe-b) + 8px)" }}
          >
            {NAV.map((item) => (
              <TabItem
                key={item.view}
                {...item}
                active={currentView === item.view}
                onClick={() => nav(item.view)}
              />
            ))}
          </nav>
        )}
      </LayoutGroup>

      {/* --------------------------- OVERLAYS --------------------------- */}
      <AnalyticsDrawer
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        logs={logs}
        profile={derivedProfile}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />

      {/* Premium gate for the AI generator. */}
      <AnimatePresence>
        {currentView === "ai-generator" && !isPremium && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] grid place-items-center px-5 backdrop-blur-sm"
            style={{ background: "var(--scrim)" }}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              transition={SPRING_WEIGHTED}
              className="aurora-card w-full max-w-sm rounded-xl2 p-6 text-center"
              style={{ ["--glow" as string]: "var(--emerald)" }}
            >
              <motion.span
                className="mx-auto grid h-12 w-12 place-items-center rounded-md2"
                style={{
                  background: "var(--emerald-wash)",
                  color: "var(--emerald)",
                }}
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="h-5 w-5" />
              </motion.span>
              <h3 className="font-display mt-4 text-xl font-extrabold text-ink">
                AI coach is premium
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-3">
                Switch to premium to unlock adaptive AI workout generation.
              </p>
              <MagneticButton
                size="lg"
                tone="emerald"
                block
                className="mt-5"
                onClick={() => {
                  handleSubscriptionToggle(true);
                  nav("premium-hub");
                }}
              >
                Activate premium
              </MagneticButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast — elevated with accent indicator pulse */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={SPRING_WEIGHTED}
            className="glass fixed left-1/2 z-[95] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2.5 rounded-full px-4 py-2.5"
            style={{
              bottom: "calc(var(--safe-b) + 92px)",
              background: "var(--graphite)",
            }}
          >
            {/* Pulsing dot */}
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ background: "var(--emerald)" }}
              />
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--emerald)" }}
              />
            </span>
            <span className="truncate text-[11px] font-semibold text-ink">
              {toast.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <Confetti active={confettiActive} />

      {showOnboarding && <Onboarding onDone={dismissOnboarding} />}
      {!showOnboarding && personalizeMode && (
        <PersonalizeFlow
          mode={personalizeMode}
          initial={{
            gender: profile.gender,
            age: profile.age,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
          }}
          onComplete={handlePersonalizeComplete}
          onSkip={handlePersonalizeSkip}
          onClose={() => setPersonalizeMode(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Placeholder for a code-split screen.
 * Shaped like the content it replaces — a layout that resolves into
 * place reads as fast, while a spinner reads as two separate waits.
 */
function ScreenSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.18, duration: 0.3 }}
      className="space-y-4 py-2"
      aria-hidden
    >
      <div className="h-7 w-2/5 rounded-full bg-[var(--line)]" />
      <div className="h-3 w-3/5 rounded-full bg-[var(--line-faint)]" />
      <div className="surface shimmer relative h-40 overflow-hidden rounded-xl2" />
      <div className="grid grid-cols-2 gap-3">
        <div className="surface shimmer relative h-24 overflow-hidden rounded-xl2" />
        <div className="surface shimmer relative h-24 overflow-hidden rounded-xl2" />
      </div>
      <div className="surface shimmer relative h-28 overflow-hidden rounded-xl2" />
    </motion.div>
  );
}

function ThemeIcon({ theme }: { theme: "obsidian" | "daylight" }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={theme}
        initial={{ opacity: 0, rotate: -70, scale: 0.6 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={{ opacity: 0, rotate: 70, scale: 0.6 }}
        transition={{ duration: 0.22 }}
        className="grid place-items-center"
      >
        {theme === "obsidian" ? (
          <SunMedium className="h-3.5 w-3.5" />
        ) : (
          <Moon className="h-3.5 w-3.5" />
        )}
      </motion.span>
    </AnimatePresence>
  );
}

function TabItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const a = accent("cyan");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="relative flex flex-1 flex-col items-center gap-1 rounded-[14px] px-1 py-1.5"
    >
      {active && (
        <motion.span
          layoutId="tab-pill"
          transition={SPRING_SNAP}
          className="absolute inset-0 rounded-[14px]"
          style={{ background: a.wash }}
        />
      )}
      <motion.span
        animate={{ y: active ? -1 : 0, scale: active ? 1.08 : 1 }}
        transition={SPRING_SNAP}
        className="relative z-10 grid place-items-center"
        style={{ color: active ? a.color : "var(--ink-4)" }}
      >
        <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.6 : 2.1} />
      </motion.span>
      <span
        className="relative z-10 text-[9px] font-extrabold uppercase tracking-[0.08em]"
        style={{ color: active ? a.color : "var(--ink-4)" }}
      >
        {label}
      </span>
    </button>
  );
}

function RailItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const a = accent("cyan");
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      whileTap={{ scale: 0.97 }}
      transition={SPRING_SNAP}
      className="relative flex w-full items-center gap-3 rounded-lg2 px-3 py-2.5 text-left"
    >
      {active && (
        <motion.span
          layoutId="rail-pill"
          transition={SPRING_SNAP}
          className="absolute inset-0 rounded-lg2"
          style={{ background: a.wash }}
        />
      )}
      {/* Active indicator bar on left edge */}
      {active && (
        <motion.span
          layoutId="rail-bar"
          transition={SPRING_SNAP}
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full"
          style={{ background: a.color }}
        />
      )}
      <Icon
        className="relative z-10 h-4 w-4 shrink-0"
        strokeWidth={active ? 2.6 : 2.1}
        style={{ color: active ? a.color : "var(--ink-3)" }}
      />
      <span
        className="relative z-10 truncate text-[13px] font-bold"
        style={{ color: active ? a.color : "var(--ink-2)" }}
      >
        {label}
      </span>
    </motion.button>
  );
}
