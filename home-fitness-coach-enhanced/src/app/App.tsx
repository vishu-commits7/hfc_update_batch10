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
  UserRound,
  Compass,
  Dumbbell,
  History,
  Play,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
  Zap,
  Swords,
  Flame,
  Camera,
  Scan,
  Film,
  Cloud,
  Settings as SettingsIcon,
  Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ProgressLog, UserProfile, Workout, WorkoutLog } from "../types";
import Dashboard from "../features/home/Dashboard";
import Confetti from "../shared/Confetti";
import Onboarding from "./Onboarding";
import type { PersonalizeData } from "./PersonalizeFlow";
import type { Command } from "./CommandPalette";
import { computeUnlockedAchievements } from "../features/progress/achievements";
import { CURATED_WORKOUTS } from "../constants";
import { tapFeedback } from "../core/haptics";
import { MagneticButton } from "../shared/ui";
import LofiMusicButton from "../shared/LofiMusicButton";
import { useTheme } from "../hooks/useTheme";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { screenVariants, SPRING_SNAP, SPRING_WEIGHTED } from "../design/motion";

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
} from "../features/progress/analytics";
import { planNudge, shouldNudgeToday } from "../features/home/smartNudge";
import {
  applyAllNotificationPrefs,
  loadNotificationPrefs,
  hasNotificationPermission,
} from "../core/notifications";

// Only the Today screen is in the first bundle. Everything below is loaded when it is first needed (and warmed
// up in the background a moment after launch), so the app has far less code to read before it can draw.
const ActiveWorkout = lazy(() => import("../features/workout/ActiveWorkout"));
const AnalyticsDrawer = lazy(() => import("../features/progress/AnalyticsDrawer"));
const CommandPalette = lazy(() => import("./CommandPalette"));
const PersonalizeFlow = lazy(() => import("./PersonalizeFlow"));
const LevelUpOverlay = lazy(() => import("../features/progress/LevelUpOverlay"));
const CoachTour = lazy(() => import("./CoachTour"));
const PaywallSheet = lazy(() => import("../features/billing/PaywallSheet"));
const FriendsAndChatHub = lazy(() => import("../features/social/FriendsAndChatHub"));
const PublicProfileSheet = lazy(() => import("../features/social/PublicProfileSheet"));
const AiGenerator = lazy(() => import("../features/workout/AiGenerator"));
const SettingsPage = lazy(() => import("../features/account/SettingsPage"));
const CommunityGallery = lazy(() => import("../features/social/CommunityGallery"));
const HistoryLogs = lazy(() => import("../features/progress/HistoryLogs"));
const ExerciseLibrary = lazy(() => import("../features/exercises/ExerciseLibrary"));
const ProgressTracker = lazy(() => import("../features/progress/ProgressTracker"));
const PremiumHub = lazy(() => import("../features/billing/PremiumHub"));
const BeastDuelArena = lazy(() => import("../features/arena/BeastDuelArena"));
const AuthScreen = lazy(() => import("../features/account/AuthScreen"));
const CloudSyncPage = lazy(() => import("../features/account/CloudSyncPage"));
const ProgramsView = lazy(() => import("../features/workout/ProgramsView"));
const AthleteProfileHub = lazy(() => import("../features/account/AthleteProfileHub"));
const ReelsFeedView = lazy(() => import("../features/reels/ReelsFeedView"));
const GymBeastMotivationReel = lazy(() => import("../features/reels/GymBeastMotivationReel"));
const ViralFlexStudio = lazy(() => import("../features/reels/ViralFlexStudio"));
const SmartFormScanner = lazy(() => import("../features/workout/SmartFormScanner"));
import type { FlexStats } from "../features/reels/ViralFlexStudio";
import { useAuthUser } from "../core/useAuth";
import { PAYWALL_MIN_WORKOUTS, paywallUnlocked, useEntitlement } from "../features/billing/billing";
import { popBack } from "../core/backStack";
import { useMyIdentity, useFollowEdges } from "../features/social/useSocial";
import { challengeUser } from "../features/arena/challenge";
import { startNotifier, stopNotifier } from "../features/social/inbox";
import { requestPushAfterFirstWorkout } from "../core/push";
import HubCommandCenter from "./HubCommandCenter";
import { onJoinLink, peekPendingJoin, takePendingJoin } from "../core/deepLink";
import ErrorBoundary from "./ErrorBoundary";
import { App as CapApp } from "@capacitor/app";
import { apiUrl } from "../core/apiBase";
import { track, trackOnce, setAnalyticsUser } from "../core/track";
import { EV } from "../core/analyticsEvents";
import { getAuthGate } from "../core/flags";
import { startBlocks } from "../features/safety/blocks";
import { reportWorkout, type RewardResult } from "../features/progress/progress";
import { flushReports, onQueuedReward } from "../features/workout/reportQueue";
import GoalSetup from "./GoalSetup";
import { OfflineBanner } from "../shared/ui/StateViews";
import { ModerationGate } from "../features/safety/ContentPolicy";
import { registerDeviceOnce } from "../features/arena/invite";
import { DEMO } from "../core/demo";
import { noteFirstOpen, takeReviewTurn, winMomentOf, type WinMoment } from "../features/progress/review";
import ReviewPrompt from "../features/progress/ReviewPrompt";

const FRESH_APP_VERSION = "home-fitness-coach-clean-premium-v6";

type View =
  | "dashboard"
  | "reels"
  | "ai-generator"
  | "history-logs"
  | "active-workout"
  | "exercise-library"
  | "progress-tracker"
  | "premium-hub"
  | "settings"
  | "community"
  | "beast-duels"
  | "profile-hub"
  | "auth"
  | "cloud-sync"
  | "programs";

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
  { view: "dashboard", icon: Dumbbell, label: "Today's Session" },
  { view: "reels", icon: Film, label: "Motivation Feed" },
  { view: "beast-duels", icon: Swords, label: "1v1 Beast Arena" },
  { view: "exercise-library", icon: Compass, label: "Movement Academy" },
  { view: "profile-hub", icon: UserRound, label: "Athlete Profile" },
];

const NAV_HINTS: Partial<Record<NavTarget, string>> = {
  dashboard: "Your plan, streak and today's workout",
  reels: "Short workout videos and motivation",
  "beast-duels": "Challenge friends to live 1v1 duels",
  "exercise-library": "Every exercise with form guides",
  "profile-hub": "Your stats, trophies and posts",
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
  const [, , themeMode, setThemeMode] = useTheme();
  const { user, loading: authLoading } = useAuthUser();
  const authGate = getAuthGate();
  // One identity for the whole app: photo (on-device copy first), name and handle.
  const me = useMyIdentity();
  const [celebration, setCelebration] = useState<RewardResult | null>(null);
  const [reviewMoment, setReviewMoment] = useState<WinMoment | null>(null);
  useEffect(() => { noteFirstOpen(); }, []);
  const [arenaRoomCode, setArenaRoomCode] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxProfileUid, setInboxProfileUid] = useState<string | null>(null);
  const followEdges = useFollowEdges();
  useEffect(() => { if (DEMO) return; if (me.uid) startNotifier(me.uid); else stopNotifier(); startBlocks(me.uid ?? null); setAnalyticsUser(me.uid ?? null); if (me.uid) registerDeviceOnce(me.uid); }, [me.uid]);
  const pendingFollowRequests = [...followEdges.incoming.values()].filter(v => v === "pending").length;

  const [currentView, setCurrentView] = useState<View>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("duelRoom")) return "beast-duels";
    }
    return "dashboard";
  });
  const [previousView, setPreviousView] = useState<View>("dashboard");
  // Real navigation stack: back always returns to the screen you actually came from.
  const viewStackRef = useRef<View[]>([]);
  const currentViewRef = useRef<View>(currentView);
  currentViewRef.current = currentView;
  const goBack = useCallback((fallback: View = "dashboard") => {
    const st = viewStackRef.current;
    let target: View | undefined;
    while (st.length) {
      const v = st.pop()!;
      if (v !== currentViewRef.current && v !== "active-workout" && v !== "auth") { target = v; break; }
    }
    setCurrentView(target ?? fallback);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("duelRoom")) {
      setCurrentView("beast-duels");
    }
  }, []);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [preselectedExerciseForLog, setPreselectedExerciseForLog] =
    useState<string | undefined>();
  // Pro is decided by the server (Google Play subscription). While BILLING_ENABLED is off on the server, everyone is Pro.
  const entitlement = useEntitlement(user?.uid);
  const isPremium = entitlement.pro;
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("kinetic_onboarding_seen"),
  );
  const [showGoalSetup, setShowGoalSetup] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [personalizeMode, setPersonalizeMode] =
    useState<"onboarding" | "edit" | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [analyticsEver, setAnalyticsEver] = useState(false);
  const [paletteEver, setPaletteEver] = useState(false);
  useEffect(() => { if (analyticsOpen) setAnalyticsEver(true); }, [analyticsOpen]);
  useEffect(() => { if (paletteOpen) setPaletteEver(true); }, [paletteOpen]);
  const [storyReelOpen, setStoryReelOpen] = useState(false);
  const [storyReelIndex, setStoryReelIndex] = useState(0);
  const [flexStudioOpen, setFlexStudioOpen] = useState(false);
  const [flexStudioStats, setFlexStudioStats] = useState<FlexStats | undefined>();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerExercise, setScannerExercise] = useState<string | undefined>();

  // Android Hardware Back Button navigation & modal dismissal
  useEffect(() => {
    let listenerHandle: any = null;
    const registerBack = async () => {
      try {
        listenerHandle = await CapApp.addListener("backButton", () => {
          if (popBack()) return; // close the top-most sheet/overlay first
          if (storyReelOpen) {
            setStoryReelOpen(false);
            return;
          }
          if (scannerOpen) {
            setScannerOpen(false);
            return;
          }
          if (flexStudioOpen) {
            setFlexStudioOpen(false);
            return;
          }
          if (analyticsOpen) {
            setAnalyticsOpen(false);
            return;
          }
          if (paletteOpen) {
            setPaletteOpen(false);
            return;
          }
          if (selectedWorkout) {
            setSelectedWorkout(null);
            goBack("dashboard");
            return;
          }
          if (currentView !== "dashboard") {
            goBack("dashboard");
            return;
          }
          CapApp.exitApp();
        });
      } catch {
        const onPopState = () => {
          if (popBack()) return;
          if (storyReelOpen) setStoryReelOpen(false);
          else if (scannerOpen) setScannerOpen(false);
          else if (flexStudioOpen) setFlexStudioOpen(false);
          else if (analyticsOpen) setAnalyticsOpen(false);
          else if (paletteOpen) setPaletteOpen(false);
          else if (selectedWorkout) { setSelectedWorkout(null); goBack("dashboard"); }
          else if (currentView !== "dashboard") goBack("dashboard");
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
      }
    };
    registerBack();
    return () => {
      listenerHandle?.remove?.();
    };
  }, [
    storyReelOpen,
    scannerOpen,
    flexStudioOpen,
    analyticsOpen,
    paletteOpen,
    selectedWorkout,
    currentView,
    previousView,
    goBack,
  ]);

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

  // Silent background wake-up for remote backend on app start (Render cold start mitigation)
  useEffect(() => {
    try {
      fetch(apiUrl("/api/health"), { method: "GET" }).catch(() => {});
    } catch {}
  }, []);

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
    const open = () => openPaywallRef.current();
    window.addEventListener("apex-open-paywall", open);
    return () => window.removeEventListener("apex-open-paywall", open);
  }, []);
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
  // The paywall is only offered once someone has finished 3 workouts and knows what the app is.
  const openPaywall = () => {
    if (paywallUnlocked(logs.length)) setPaywallOpen(true);
    else notify(`Pro plans appear after ${PAYWALL_MIN_WORKOUTS} finished workouts. ${PAYWALL_MIN_WORKOUTS - logs.length} to go.`);
  };
  const openPaywallRef = useRef(openPaywall);
  openPaywallRef.current = openPaywall;
  const handleSubscriptionToggle = (value: boolean) => {
    if (value) openPaywall();
    else notify("Manage or cancel your subscription in Google Play > Subscriptions.");
  };

  const toggleFavorite = useCallback(
    (id: string) =>
      setFavorites((prev) =>
        prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
      ),
    [],
  );

  const dismissOnboarding = () => {
    localStorage.setItem("kinetic_onboarding_seen", "1");
    setShowOnboarding(false);
    if (!localStorage.getItem("ap_goalsetup_status")) {
      setShowGoalSetup(true); // goal / level / equipment -> first workout
    } else if (!localStorage.getItem("kinetic_personalize_status")) {
      setPersonalizeMode("onboarding");
    }
  };

  const finishGoalSetup = (choices: Pick<UserProfile, "goal" | "fitnessLevel" | "preferredEquipment">, first: Workout) => {
    localStorage.setItem("ap_goalsetup_status", "done");
    setProfile(prev => ({ ...prev, ...choices }));
    setShowGoalSetup(false);
    handleWorkoutGenerated(first); // straight into the first workout
  };
  const skipGoalSetup = () => {
    localStorage.setItem("ap_goalsetup_status", "skipped");
    setShowGoalSetup(false);
  };
  const closeTour = () => { try { localStorage.setItem("ap_tour_done", "1"); } catch { /* ignore */ } setTourOpen(false); };
  // one-time tour: after setup, the first time the home screen is visible and quiet
  useEffect(() => {
    if (currentView !== "dashboard" || showOnboarding || showGoalSetup || personalizeMode || celebration || tourOpen) return;
    try {
      if (localStorage.getItem("ap_goalsetup_status") && !localStorage.getItem("ap_tour_done")) {
        const t = setTimeout(() => setTourOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, [currentView, showOnboarding, showGoalSetup, personalizeMode, celebration, tourOpen]);

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
    if (currentViewRef.current !== "active-workout") viewStackRef.current = [...viewStackRef.current.slice(-15), currentViewRef.current];
    setSelectedWorkout(newWorkout);
    setCurrentView("active-workout");
  };

  const handleDeleteWorkout = useCallback(
    (id: string) =>
      setSavedWorkouts((prev) => prev.filter((w) => w.id !== id)),
    [],
  );

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

  // Shows the rewards for one workout report (right away, or later when a queued report is finally sent).
  const showReward = useCallback((r: RewardResult) => {
    if (r.program?.completed) track(EV.programCompleted);
    if (r.levelUp) track(EV.levelUp, { level: r.level });
    if (r.levelUp || r.rankUp || r.newTrophies.length || r.questsCompleted?.length || r.freezeUsed || r.freezeEarned || r.weekGoalHit) setCelebration(r);
    else if (r.program?.credited) notify(r.program.weekComplete ? `Week ${r.program.week} of your program done! +${r.xpGained} XP` : `Program session ${r.program.done} of ${r.program.total} done. +${r.xpGained} XP`);
    else if (r.xpGained) notify(`+${r.xpGained} XP`);
  }, [notify]);

  // Workouts finished offline are sent when signed in and online: at launch, on reconnect, on return to the app.
  useEffect(() => {
    if (!me.uid) return;
    const off = onQueuedReward(showReward);
    const go = () => { void flushReports(); };
    go();
    window.addEventListener("online", go);
    document.addEventListener("visibilitychange", go);
    return () => { off(); window.removeEventListener("online", go); document.removeEventListener("visibilitychange", go); };
  }, [me.uid, showReward]);

  const handleLogWorkout = (newLog: WorkoutLog) => {
    setLogs((prev) => {
      const nextLogs = [newLog, ...prev];
      // Check for new achievements against the guaranteed latest log history
      queueMicrotask(() => {
        checkForNewAchievement(
          { ...profile, ...deriveProfileTotals(nextLogs) },
          nextLogs,
        );
      });
      return nextLogs;
    });
    const programRef = selectedWorkout && selectedWorkout.id === newLog.workoutId ? selectedWorkout.program : undefined;
    setCurrentView("dashboard");
    setSelectedWorkout(null);
    setConfettiActive(true);
    notify("Boom! Session logged and locked in. Outstanding effort today, athlete.");
    trackOnce(EV.firstWorkoutFinished);
    track(EV.workoutLogged, { minutes: newLog.durationMinutes || 0 });
    // ask for notification permission once, after a finished workout (never at launch)
    if (me.uid && !DEMO) { const u = me.uid; window.setTimeout(() => { void requestPushAfterFirstWorkout(u); }, 3000); }
    if (me.uid) {
      void reportWorkout(newLog, programRef).then(r => {
        if (r) showReward(r);
        else if (!navigator.onLine) notify("Saved on your phone. Rewards arrive when you're back online.");
      }).catch(() => {});
    }
  };

  const handleResetAllData = () => {
    clearLocalTrainingData();
    setProfile({ ...EMPTY_PROFILE });
    setSavedWorkouts([]);
    setLogs([]);
    setFavorites([]);
    prevAchievementCount.current = null;
    localStorage.setItem("kinetic_fresh_build_version", FRESH_APP_VERSION);
    notify("Clean slate unlocked. Ready to build something great.");
  };

  const handleClearLogs = () => {
    setLogs([]);
    localStorage.removeItem("kinetic_progress_tracker_logs");
    notify("Session logs reset. Let's record fresh records.");
  };

  const handleDeleteLog = useCallback(
    (id: string) => {
      setLogs((prev) => prev.filter((l) => l.id !== id));
    },
    [],
  );

  const handleSelectWorkout = useCallback((workout: Workout) => {
    // remember where the workout was started from so Back returns there
    if (currentViewRef.current !== "active-workout") viewStackRef.current = [...viewStackRef.current.slice(-15), currentViewRef.current];
    setSelectedWorkout(workout);
    setCurrentView("active-workout");
  }, []);

  const nav = useCallback((view: NavTarget) => {
    tapFeedback();
    setPreselectedExerciseForLog(undefined);
    setPreviousView((prev) => (currentView !== view ? currentView : prev));
    if (view !== currentView) {
      if (["dashboard", "reels", "beast-duels", "exercise-library", "profile-hub"].includes(view)) viewStackRef.current = [];
      else viewStackRef.current = [...viewStackRef.current.slice(-15), currentView];
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [currentView]);

  // empty states elsewhere in the app can send the user to a main screen (see lib/navEvents.ts)
  useEffect(() => {
    const go = (e: Event) => { const v = (e as CustomEvent<NavTarget>).detail; if (v) nav(v); };
    window.addEventListener("apex-nav", go);
    return () => window.removeEventListener("apex-nav", go);
  }, [nav]);

  // Invite links: a crew, match-room or friend code opens the Arena on the right place. Waits for sign-in.
  useEffect(() => {
    if (!user) return;
    const go = (t: { kind: "crew" | "room" | "invite" }) => {
      if (t.kind === "room") { const c = takePendingJoin("room"); if (c) setArenaRoomCode(c); }
      nav("beast-duels");
    };
    const waiting = peekPendingJoin();
    if (waiting) go(waiting);
    return onJoinLink(go);
  }, [user?.uid, nav]); // eslint-disable-line react-hooks/exhaustive-deps

  // A chat-challenge room code only applies to that one arena visit.
  useEffect(() => {
    if (currentView !== "beast-duels" && arenaRoomCode) setArenaRoomCode(null);
  }, [currentView, arenaRoomCode]);

  // Warm the heavy screens while the app is idle so tapping a tab opens instantly
  // instead of sitting on a skeleton while the chunk downloads and parses.
  useEffect(() => {
    // Arena and the workout player first (the two things people tap most), then the rest, one at a time so the
    // phone is never busy reading several screens while the user is scrolling.
    const loaders = [
      () => import("../features/arena/BeastDuelArena"),
      () => import("../features/workout/ActiveWorkout"),
      () => import("../features/reels/ReelsFeedView"),
      () => import("../features/account/AthleteProfileHub"),
      () => import("../features/workout/AiGenerator"),
      () => import("../features/progress/LevelUpOverlay"),
      () => import("../features/social/CommunityGallery"),
    ];
    let stop = false;
    let timer = 0;
    const next = (i: number) => {
      if (stop || i >= loaders.length) return;
      timer = window.setTimeout(() => { void loaders[i]().catch(() => {}).finally(() => next(i + 1)); }, i === 0 ? 1200 : 350);
    };
    next(0);
    return () => { stop = true; clearTimeout(timer); };
  }, []);

  /* --------------------------- command list --------------------------- */
  const commands = useMemo<Command[]>(() => {
    const featured = savedWorkouts[0] ?? CURATED_WORKOUTS[0];
    const list: Command[] = [
      ...NAV.map((n) => ({
        id: `go-${n.view}`,
        label: n.label,
        hint: NAV_HINTS[n.view] ?? "Open",
        icon: n.icon,
        group: "Navigate",
        tone: "cyan" as const,
        keywords: n.view,
        run: () => nav(n.view),
      })),
      {
        id: "start-featured",
        label: featured ? `Crush "${featured.workoutTitle}"` : "Start today's session",
        hint: "Ignite session now with telemetry & audio pacing",
        icon: Play,
        group: "Actions",
        tone: "emerald",
        keywords: "begin train session workout ignite start",
        run: () => featured && handleSelectWorkout(featured),
      },
      {
        id: "ai-generate",
        label: "Build Today's Session with Coach AI",
        hint: "Bespoke session tuned to your energy & equipment",
        icon: Sparkles,
        group: "Actions",
        tone: "emerald",
        keywords: "ai create new routine generate coach build session",
        run: () => nav("ai-generator"),
      },
      {
        id: "analytics",
        label: "Athlete Trophy Room & Performance Review",
        hint: "Review consistency, PRs, and weekly volume",
        icon: Trophy,
        group: "Actions",
        tone: "gold",
        keywords: "stats analytics insights trends weekly pr trophy",
        run: () => setAnalyticsOpen(true),
      },
      {
        id: "beast-duels",
        label: "1v1 Beast Arena Showdowns",
        hint: "Challenge rivals & test your endurance",
        icon: Swords,
        group: "Actions",
        tone: "gold",
        keywords: "duel arena battle challenge 1v1 pvp",
        run: () => nav("beast-duels"),
      },
      {
        id: "daily-stories",
        label: "Savage Motivation Reels",
        hint: "Full-screen daily visual fuel",
        icon: Flame,
        group: "Actions",
        tone: "ember",
        keywords: "motivation savage stories fuel reels wallpaper",
        run: () => {
          setStoryReelIndex(0);
          setStoryReelOpen(true);
        },
      },
      {
        id: "flex-studio",
        label: "Viral Flex Studio 2.0",
        hint: "Create Instagram & WhatsApp story card",
        icon: Camera,
        group: "Actions",
        tone: "cyan",
        keywords: "flex card story instagram share photo",
        run: () => setFlexStudioOpen(true),
      },
      {
        id: "form-scanner",
        label: "AI Form Vision Scanner",
        hint: "Pose telemetry & bio-feedback",
        icon: Scan,
        group: "Actions",
        tone: "cyan",
        keywords: "camera scanner ai form pose angle rep detection",
        run: () => {
          setScannerExercise(undefined);
          setScannerOpen(true);
        },
      },
      {
        id: "nav-progress",
        label: "Progress Tracker & Max PRs",
        hint: "Track bodyweight & PR charts",
        icon: TrendingUp,
        group: "Navigate",
        tone: "cyan",
        keywords: "progress weight tracking pr personal record",
        run: () => nav("progress-tracker"),
      },
      {
        id: "nav-hub",
        label: "Recovery & Biometrics Hub",
        hint: "Sleep, HRV, water & readiness",
        icon: Sparkles,
        group: "Navigate",
        tone: "gold",
        keywords: "recovery biometrics sleep hrv water hub",
        run: () => nav("premium-hub"),
      },
      {
        id: "nav-history",
        label: "Workout History & Logs",
        hint: "Review past workout sessions",
        icon: History,
        group: "Navigate",
        tone: "neutral",
        keywords: "history logs past sessions completed",
        run: () => nav("history-logs"),
      },
      {
        id: "nav-settings",
        label: "Settings",
        hint: "Sound, voice, haptics, appearance and data",
        icon: SettingsIcon,
        group: "Preferences",
        tone: "neutral",
        keywords: "settings voice audio lofi haptics backup data",
        run: () => nav("settings"),
      },
      {
        id: "cloud-sync",
        label: "Cloud Sync",
        hint: user ? "Back up and restore your data" : "Sign in to back up your data",
        icon: Cloud,
        group: "Account",
        tone: "cyan",
        keywords: "google gmail signin login auth account cloud sync backup restore",
        run: () => nav("cloud-sync"),
      },
    ];
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, savedWorkouts, user]);

  const inSession = currentView === "active-workout";
  useEffect(() => { if (inSession) trackOnce(EV.firstWorkoutStarted); }, [inSession]);

  /* ------------------------------ render ------------------------------ */
  return (
    <div
      className="min-h-[100dvh] antialiased selection:bg-emerald-400 selection:text-slate-950 relative"
      style={{ background: "var(--void)", color: "var(--ink)" }}
    >
      {/* Subtle ambient lighting for native OLED depth */}
      {/* (Removed: three full-screen 100px-blur ambient layers. Gaussian blur
          on large fixed layers is repainted every frame on Android WebView and
          was a major cause of scroll lag and GPU memory pressure.) */}

      <LayoutGroup id="app-chrome">
        <div className="mx-auto flex w-full max-w-[1340px] justify-center lg:gap-8 lg:px-6">
          {/* ------------------------ SIDE RAIL (Desktop) ------------------------ */}
          {!inSession && isDesktop && (
            <aside className="sticky top-0 hidden h-[100dvh] w-[252px] shrink-0 flex-col justify-between py-6 lg:flex">
              {/* Rail background — subtle aurora gradient on desktop */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
                style={{
                  background:
                    "radial-gradient(ellipse 100% 50% at 0% 30%, var(--aurora-a) 0%, transparent 70%), radial-gradient(ellipse 80% 40% at 20% 80%, var(--aurora-b) 0%, transparent 60%)",
                }}
              />

              <div>
                {/* Brand mark */}
                <div
                  className="flex items-center gap-3 px-3 cursor-pointer select-none"
                  onClick={() => nav("dashboard")}
                >
                  <motion.div
                    className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-sm"
                    whileHover={{ scale: 1.06 }}
                    transition={SPRING_SNAP}
                  >
                    <img src="/app-logo.jpg" alt="APEX PULSE" className="h-full w-full object-cover" />
                  </motion.div>
                  <span className="min-w-0">
                    <span className="font-display block truncate text-base font-black tracking-tight text-white flex items-center gap-1.5">
                      APEX <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">PULSE</span>
                    </span>
                    <span className="block truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      COACH READY
                    </span>
                  </span>
                </div>

                {/* Daily Coach Focus */}
                <div className="mt-5 mx-1 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-400 block">
                      TODAY'S INTENTION
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-slate-300 leading-snug">
                    Build relentless momentum. Finish every set with control.
                  </p>
                </div>

                <nav className="mt-6 space-y-1.5" aria-label="Main">
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

              <div className="space-y-2.5 px-1">
                {/* Quick-launch: AI generator */}
                <motion.button
                  type="button"
                  onClick={() => nav("ai-generator")}
                  className="flex w-full items-center gap-2.5 rounded-2xl p-3 text-left transition-all border border-emerald-400/40 bg-gradient-to-r from-emerald-400/15 to-teal-400/10 text-emerald-300 shadow-[0_0_18px_rgba(0,229,160,0.12)] hover:border-emerald-400/70"
                  whileHover={{ scale: 1.02, y: -1 }}
                  transition={SPRING_SNAP}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-slate-950 font-black shadow-[0_0_10px_#00e5a0]">
                    <Zap className="h-4 w-4" strokeWidth={2.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-white">Build Today's Session</span>
                    <span className="block truncate text-[11px] text-emerald-400/80 font-medium">Adaptive Coach AI</span>
                  </div>
                </motion.button>

                {/* Search / command palette button */}
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-xs text-slate-400 transition-colors hover:text-white hover:bg-white/[0.06]"
                >
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">Command Center…</span>
                  <kbd className="shrink-0 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[11px] font-mono font-bold text-slate-300">
                    ⌘K
                  </kbd>
                </button>

                <div className="flex gap-2">
                  <LofiMusicButton showLabel size="md" className="flex-1 justify-center rounded-xl" />
                </div>
                <div className="pt-1">
                  <MagneticButton
                    size="sm"
                    variant="ghost"
                    tone="neutral"
                    block
                    className="border border-white/10 text-xs rounded-xl"
                    onClick={() => setAnalyticsOpen(true)}
                  >
                    <Trophy className="h-3.5 w-3.5 text-amber-400" />
                    Athlete Trophy Room
                  </MagneticButton>
                </div>
              </div>
            </aside>
          )}

          {/* ------------------------- CONTENT CONTAINER ------------------------- */}
          <div
            className={[
              "relative w-full min-w-0 transition-all duration-300",
              inSession
                ? ""
                : "max-w-[480px] w-full mx-auto border-x border-zinc-800/80 min-h-screen",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ background: inSession ? undefined : "var(--obsidian)" }}
          >
            {/* Top Command Header — phone only */}
            {!inSession && !isDesktop && (
              <header
                className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#0A0A0C]/95 px-4 py-2.5 backdrop-blur-md"
                style={{ paddingTop: "max(var(--safe-t), env(safe-area-inset-top, 24px))" }}
              >
                <div className="flex items-center justify-between gap-3 min-h-[48px]">
                  <div
                    className="flex shrink-0 min-w-0 items-center gap-2.5 cursor-pointer select-none"
                    onClick={() => nav("dashboard")}
                  >
                    <motion.div
                      className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-zinc-800 shadow-sm"
                      transition={SPRING_SNAP}
                    >
                      <img src="/app-logo.jpg" alt="APEX PULSE" className="h-full w-full object-cover" />
                    </motion.div>
                    <div className="shrink-0">
                      <p className="whitespace-nowrap text-sm font-black tracking-tight text-white flex items-center gap-1 font-display">
                        APEX <span className="text-[#E1FF00]">PULSE</span>
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E1FF00] opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E1FF00]" />
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                          COACH READY
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <LofiMusicButton size="sm" />
                    <motion.button
                      type="button"
                      transition={SPRING_SNAP}
                      aria-label="Search workouts, exercises and coaches"
                      className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      onClick={() => setPaletteOpen(true)}
                    >
                      <Search className="h-5 w-5" />
                    </motion.button>
                    <motion.button
                      type="button"
                      transition={SPRING_SNAP}
                      aria-label="Follow requests and messages"
                      className="relative flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      onClick={() => setInboxOpen(true)}
                    >
                      <Bell className="h-5 w-5" />
                      {pendingFollowRequests > 0 && (
                        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">{pendingFollowRequests}</span>
                      )}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => nav("profile-hub")}
                      className="relative flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full text-zinc-200 cursor-pointer"
                      transition={SPRING_SNAP}
                      title={user?.displayName || user?.email || "Athlete Profile"}
                    >
                      {me.avatar ? (
                        <img src={me.avatar} alt="" className="h-8 w-8 rounded-full object-cover border border-line" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-xs font-bold text-white uppercase">
                          {(user?.displayName || user?.email || "A")[0]}
                        </div>
                      )}
                    </motion.button>
                  </div>
                </div>
              </header>
            )}
            {inboxOpen && (
              <Suspense fallback={null}>
                <FriendsAndChatHub
                  isOpen={inboxOpen}
                  initialTab="requests"
                  onClose={() => setInboxOpen(false)}
                  initialChatUid={null}
                  onOpenProfile={uid => setInboxProfileUid(uid)}
                  onChallenge={async uid => {
                    try {
                      const code = await challengeUser({ uid: me.uid!, name: me.name, avatar: me.avatar }, uid);
                      setInboxOpen(false); setInboxProfileUid(null); setArenaRoomCode(code ?? null); nav("beast-duels");
                    } catch { /* ignore */ }
                  }}
                  onJoinRoom={code => { setInboxOpen(false); setArenaRoomCode(code ?? null); nav("beast-duels"); }}
                />
              </Suspense>
            )}
            {inboxProfileUid && (
              <Suspense fallback={null}>
                <PublicProfileSheet uid={inboxProfileUid} onClose={() => setInboxProfileUid(null)} />
              </Suspense>
            )}

            <main
              className={inSession ? "" : "px-4 pt-4 sm:px-5 lg:px-4 lg:pt-5"}
              style={
                inSession
                  ? undefined
                  : {
                      // the bottom bar is on every screen, so every screen leaves room for it
                      paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)",
                    }
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
                 <ErrorBoundary
                   key={currentView}
                   label={currentView}
                   onReset={() => {
                     setSelectedWorkout(null);
                     setCurrentView("dashboard");
                   }}
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
                      onOpenSettings={() => nav("profile-hub")}
                      onOpenStoryReel={(idx) => {
                        setStoryReelIndex(idx);
                        setStoryReelOpen(true);
                      }}
                      onOpenDuels={() => nav("beast-duels")}
                      onOpenFlexStudio={(stats) => {
                        setFlexStudioStats(stats);
                        setFlexStudioOpen(true);
                      }}
                    />
                  )}

                  {currentView === "reels" && (
                    <ReelsFeedView
                      onOpenStoryReel={(idx) => {
                        setStoryReelIndex(idx);
                        setStoryReelOpen(true);
                      }}
                      onOpenArena={(code) => {
                        setArenaRoomCode(code ?? null);
                        nav("beast-duels");
                      }}
                      onSignIn={() => nav("auth")}
                    />
                  )}

                  {currentView === "profile-hub" && (
                    <AthleteProfileHub
                      profile={derivedProfile}
                      setProfile={setProfile}
                      logs={logs}
                      onOpenSettings={() => nav("settings")}
                      onEditProfile={() => setPersonalizeMode("edit")}
                      onNavigateToWorkout={() => nav("dashboard")}
                    />
                  )}

                  {currentView === "ai-generator" && (
                    <AiGenerator
                      profile={derivedProfile}
                      setProfile={setProfile}
                      onBack={() => goBack("dashboard")}
                      onWorkoutGenerated={handleWorkoutGenerated}
                    />
                  )}

                  {currentView === "exercise-library" && (
                    <ExerciseLibrary
                      onNavigateToLog={(exName) => {
                        nav("progress-tracker"); // goes through nav so Back returns to the library
                        setPreselectedExerciseForLog(exName);
                      }}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                      profile={derivedProfile}
                      onOpenFormScanner={(exName) => {
                        setScannerExercise(exName);
                        setScannerOpen(true);
                      }}
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
                      onBack={() => goBack("dashboard")}
                      onClearLogs={handleClearLogs}
                      onDeleteLog={handleDeleteLog}
                    />
                  )}

                  {currentView === "settings" && (
                    <SettingsPage
                      onBack={() => goBack("profile-hub")}
                      onOpenCommunity={() => nav("community")}
                      onOpenAuth={() => nav("auth")}
                      themeMode={themeMode}
                      onSetThemeMode={setThemeMode}
                      onEditProfile={() => setPersonalizeMode("edit")}
                      onResetAllData={handleResetAllData}
                    />
                  )}

                  {currentView === "community" && (
                    <CommunityGallery onBack={() => goBack("dashboard")} />
                  )}

                  {currentView === "beast-duels" && (
                    <BeastDuelArena
                      onBack={() => goBack("dashboard")}
                      onLogWorkout={handleLogWorkout}
                      initialRoomCode={arenaRoomCode}
                      onSignIn={() => nav("auth")}
                    />
                  )}

                  {currentView === "programs" && (
                    <ProgramsView
                      uid={me.uid ?? null}
                      onStartWorkout={handleSelectWorkout}
                      onBack={() => goBack("dashboard")}
                      onSignIn={() => nav("auth")}
                    />
                  )}

                  {currentView === "cloud-sync" && (
                    <CloudSyncPage
                      onBack={() => goBack("dashboard")}
                      onSignIn={() => nav("auth")}
                    />
                  )}

                  {currentView === "auth" && (
                    <AuthScreen
                      onBack={() => goBack("dashboard")}
                      onAuthed={() => goBack("dashboard")}
                    />
                  )}

                  {inSession && selectedWorkout && (
                    <ActiveWorkout
                      workout={selectedWorkout}
                      onBack={() => {
                        setSelectedWorkout(null);
                        goBack("dashboard");
                      }}
                      onLogWorkout={handleLogWorkout}
                      profile={derivedProfile}
                    />
                  )}
                 </Suspense>
                 </ErrorBoundary>
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>

        {/* ----------------- HUB COMMAND CENTER (Mobile Dock) ---------------- */}
        {!inSession && !isDesktop && (
          <HubCommandCenter
            currentView={currentView}
            onNavigate={(v) => nav(v)}
          />
        )}
      </LayoutGroup>

      {/* --------------------------- OVERLAYS --------------------------- */}
      {/* loaded the first time each is opened, then kept so closing still animates */}
      {analyticsEver && (
        <Suspense fallback={null}>
          <AnalyticsDrawer
            open={analyticsOpen}
            onClose={() => setAnalyticsOpen(false)}
            logs={logs}
            profile={derivedProfile}
          />
        </Suspense>
      )}

      {paletteEver && (
        <Suspense fallback={null}>
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            commands={commands}
          />
        </Suspense>
      )}

      {storyReelOpen && (
        <Suspense fallback={null}>
          <GymBeastMotivationReel
            isOpen={storyReelOpen}
            initialIndex={storyReelIndex}
            onClose={() => setStoryReelOpen(false)}
          />
        </Suspense>
      )}

      {flexStudioOpen && (
        <Suspense fallback={null}>
          <ViralFlexStudio
            isOpen={flexStudioOpen}
            onClose={() => setFlexStudioOpen(false)}
            defaultStats={flexStudioStats}
          />
        </Suspense>
      )}

      {scannerOpen && (
        <Suspense fallback={null}>
          <SmartFormScanner
            isOpen={scannerOpen}
            onClose={() => setScannerOpen(false)}
            exerciseName={scannerExercise}
          />
        </Suspense>
      )}

      {/* Premium gate for the AI generator */}
      <AnimatePresence>
        {currentView === "ai-generator" && !isPremium && paywallUnlocked(logs.length) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] grid place-items-center px-5 backdrop-blur-md"
            style={{ background: "var(--scrim)" }}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              transition={SPRING_WEIGHTED}
              className="w-full max-w-sm rounded-[30px] border border-emerald-400/30 bg-[#0c1018]/95 p-7 text-center shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_30px_rgba(0,229,160,0.15)] backdrop-blur-2xl"
            >
              <motion.span
                className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/40 bg-emerald-400/10 text-emerald-400 shadow-[0_0_20px_rgba(0,229,160,0.25)]"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="h-6 w-6" />
              </motion.span>
              <span className="mt-4 inline-block text-[11px] font-black uppercase tracking-[0.16em] text-emerald-400">
                PRO COACHING SUITE
              </span>
              <h3 className="font-display mt-1 text-2xl font-black text-white">
                Unlock Your Elite AI Coach
              </h3>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                Get bespoke sessions tailored in real-time to your fatigue, equipment, and personal records. Train smarter, break plateaus.
              </p>
              <MagneticButton
                size="lg"
                tone="emerald"
                block
                className="mt-6 font-black uppercase tracking-wider text-xs shadow-[0_0_20px_rgba(0,229,160,0.35)]"
                onClick={() => {
                  openPaywall();
                }}
              >
                Unlock Full Coach Access
              </MagneticButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {paywallOpen && (
        <Suspense fallback={null}>
          <PaywallSheet onClose={() => setPaywallOpen(false)} />
        </Suspense>
      )}

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

      <OfflineBanner />
      {!DEMO && <ModerationGate uid={user?.uid} onSignOut={() => { void import("../core/useAuth").then(m => m.logOut()).catch(() => {}); }} />}
      <Confetti active={confettiActive} />
      {celebration && <Suspense fallback={null}><LevelUpOverlay reward={celebration} onClose={() => { const m = winMomentOf(celebration); setCelebration(null); if (takeReviewTurn(m)) setReviewMoment(m); }} /></Suspense>}
      {reviewMoment && <ReviewPrompt moment={reviewMoment} onClose={() => setReviewMoment(null)} />}

      {showOnboarding && <Onboarding onDone={dismissOnboarding} />}
      {/* Sign-in gate. "login-first": an account is required after the intro slides. "after-first-workout": it appears
          once the first workout is logged (see lib/flags.ts for how to switch). Never during a workout. */}
      {!DEMO && !showOnboarding && !authLoading && !user && !inSession && (authGate === "login-first" || logs.length > 0) && (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950 pt-[env(safe-area-inset-top)]">
          <Suspense fallback={null}>
            <AuthScreen required onBack={() => {}} onAuthed={() => {}} />
          </Suspense>
        </div>
      )}
      {!showOnboarding && (!!user || authGate === "after-first-workout") && showGoalSetup && (
        <GoalSetup
          initial={{ goal: profile.goal, fitnessLevel: profile.fitnessLevel, preferredEquipment: profile.preferredEquipment }}
          onDone={finishGoalSetup}
          onSkip={skipGoalSetup}
        />
      )}
      {tourOpen && <Suspense fallback={null}><CoachTour onClose={closeTour} /></Suspense>}
      {!showOnboarding && personalizeMode && (
        <Suspense fallback={null}>
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
        </Suspense>
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
    <div className="flex flex-col gap-4 py-3 animate-pulse opacity-40" aria-hidden>
      <div className="h-6 w-32 rounded-lg bg-zinc-800/60" />
      <div className="h-44 w-full rounded-2xl bg-zinc-900/60" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-zinc-900/40" />
        <div className="h-24 rounded-2xl bg-zinc-900/40" />
      </div>
    </div>
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
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      transition={SPRING_SNAP}
      className={`relative flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors ${
        active ? "text-emerald-300 font-extrabold" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {active && (
        <motion.span
          layoutId="rail-pill"
          transition={SPRING_SNAP}
          className="absolute inset-0 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"
        />
      )}
      {/* Active glowing indicator on left edge */}
      {active && (
        <motion.span
          layoutId="rail-bar"
          transition={SPRING_SNAP}
          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_10px_#00e5a0]"
        />
      )}
      <Icon
        className={`relative z-10 h-4 w-4 shrink-0 transition-colors ${
          active ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(0,229,160,0.5)]" : "text-slate-400"
        }`}
        strokeWidth={active ? 2.6 : 2}
      />
      <span className="relative z-10 truncate text-[13px] font-bold">
        {label}
      </span>
    </motion.button>
  );
}
