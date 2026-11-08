import TodayCard from "./TodayCard";
import React, { useEffect, useMemo, useState, useDeferredValue } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Compass,
  Dumbbell,
  Flame,
  Footprints,
  LayoutGrid,
  Play,
  Bell,
  Share2,
  X,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Zap,
} from "lucide-react";

import type { ProgressLog, UserProfile, Workout, WorkoutLog } from "../types";
import {
  CURATED_WORKOUTS,
  FITNESS_LEVELS,
  PROGRAM_PLANS,
  WORKOUT_GOALS,
} from "../constants";
import { ACHIEVEMENTS, computeUnlockedAchievements } from "../lib/achievements";
import { detectNewMilestone, type Milestone } from "../lib/milestones";
import DailyReminderNudge from "./DailyReminderNudge";
import { milestoneCard, streakCard, type FlexCardData } from "../lib/flexCard";
import FlexCardSheet from "./FlexCardSheet";
import { computeAnalytics, WEEKLY_GOAL } from "../lib/analytics";
import { celebrateFeedback, tapFeedback } from "../lib/haptics";
import WorkoutCard, { CURATED_COACH_MEDIA } from "./WorkoutCard";
import {
  Chip,
  Drawer,
  GlassCard,
  MagneticButton,
  ProgressRing,
  SectionHeader,
  StatTile,
  StreakGraph,
} from "./ui";
import { accent } from "../design/accents";
import { staggerChild, staggerParent, SPRING_SNAP } from "../design/motion";
import { duration, pluralize } from "../design/format";
import gymHeroImg from "../assets/ui/gym-hero-dashboard.jpg";
import gymPremiumBeastImg from "../assets/ui/gym-premium-beast.jpg";
import gymDailyMotivationImg from "../assets/ui/gym-daily-motivation.jpg";
import GymMotivationGallery from "./GymMotivationGallery";
import { MOTIVATION_STORIES } from "./GymBeastMotivationReel";
import BiometricRecoveryHub, { BiometricSummaryCard } from "./BiometricRecoveryHub";

/**
 * Coach roster, derived from the same photo/name pairing the routine
 * cards render. One source of truth, so tapping a coach always filters
 * to exactly the routines carrying that coach's banner.
 */
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

type NavTarget =
  | "dashboard"
  | "ai-generator"
  | "history-logs"
  | "exercise-library"
  | "progress-tracker"
  | "premium-hub"
  | "beast-duels";

interface DashboardProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  savedWorkouts: Workout[];
  logs: WorkoutLog[];
  onSelectWorkout: (workout: Workout) => void;
  onDeleteWorkout: (id: string) => void;
  onNavigate: (view: NavTarget) => void;
  onResetAllData: () => void;
  isPremium?: boolean;
  onTogglePremium?: (value: boolean) => void;
  favorites?: string[];
  onEditProfile?: () => void;
  /** Opens the performance drawer. Supplied by the app shell. */
  onOpenAnalytics?: () => void;
  /** Opens the full app settings screen — notifications, haptics, backup. */
  onOpenSettings?: () => void;
  onOpenStoryReel?: (index: number) => void;
  onOpenDuels?: () => void;
  onOpenFlexStudio?: (stats?: any) => void;
}

const CATEGORIES = [
  { label: "All", icon: LayoutGrid },
  { label: "Abs", icon: Target },
  { label: "Arm", icon: Dumbbell },
  { label: "Chest", icon: Zap },
  { label: "Leg", icon: Footprints },
] as const;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * The Dashboard Hub.
 *
 * Restructured from a vertical stack of eight unrelated widgets into a
 * bento grid with one clear focal point. The organising principle: a
 * person opening a fitness app is answering one question — *what am I
 * doing right now* — so the hero occupies the top of the fold and
 * everything else is subordinate to it. Search, filters and libraries
 * are browsing tools and belong below the decision.
 *
 * The grid reflows rather than rearranging: 2 columns on a phone,
 * 4 on a tablet, 6 on desktop, with spans chosen so the hero always
 * holds the top-left mass and the stat tiles always sit in one visual
 * row. Nothing is hidden at any breakpoint.
 */
function DashboardInner({
  profile,
  setProfile,
  savedWorkouts,
  logs,
  onSelectWorkout,
  onDeleteWorkout,
  onNavigate,
  onResetAllData,
  isPremium = true,
  favorites = [],
  onEditProfile,
  onOpenAnalytics,
  onOpenSettings,
  onOpenStoryReel,
  onOpenDuels: _onOpenDuels,
  onOpenFlexStudio: _onOpenFlexStudio,
}: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeCoach, setActiveCoach] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showBiometricsDrawer, setShowBiometricsDrawer] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const analytics = useMemo(
    () => computeAnalytics(logs, profile),
    [logs, profile],
  );

  /**
   * Real unlocked-badge count, computed from the same function the Hub
   * uses. The progress-tracker logs live in their own storage key rather
   * than in props, so they are read here; a corrupt entry degrades to an
   * empty list instead of taking the dashboard down with it.
   */
  const unlockedCount = useMemo(() => {
    let progressLogs: ProgressLog[] = [];
    try {
      progressLogs = JSON.parse(
        localStorage.getItem("kinetic_progress_tracker_logs") || "[]",
      );
    } catch {
      /* unreadable — treat as no progress logs */
    }
    return computeUnlockedAchievements(
      profile,
      logs,
      progressLogs,
      favorites.length,
    ).size;
  }, [profile, logs, favorites.length]);

  /* ---------------- milestones ---------------- */

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [shareCard, setShareCard] = useState<FlexCardData | null>(null);

  // Runs when the numbers change, not on every render. `detectNewMilestone`
  // writes what it has shown to storage, so it reports each milestone once
  // and a re-render never re-fires the celebration.
  useEffect(() => {
    const found = detectNewMilestone({
      currentStreak: analytics.currentStreak,
      unlockedBadges: unlockedCount,
    });
    if (found) {
      setMilestone(found);
      celebrateFeedback();
    }
  }, [analytics.currentStreak, unlockedCount]);

  const shareStreak = () => {
    tapFeedback();
    setShareCard(
      streakCard({
        days: analytics.currentStreak,
        best: analytics.bestStreak,
        sessions: analytics.totalSessions,
      }),
    );
  };

  const filteredCurated = useMemo(() => {
    const q = deferredSearchQuery.toLowerCase();
    return CURATED_WORKOUTS.filter((w) => {
      const matchesSearch =
        !q ||
        w.workoutTitle.toLowerCase().includes(q) ||
        w.workoutDescription.toLowerCase().includes(q) ||
        w.targetArea.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (activeCategory !== "All") {
        const cat = activeCategory.toLowerCase();
        const matchesCategory =
          w.targetArea.toLowerCase().includes(cat) ||
          w.workoutTitle.toLowerCase().includes(cat) ||
          w.workoutDescription.toLowerCase().includes(cat);
        if (!matchesCategory) return false;
      }

      if (activeCoach && CURATED_COACH_MEDIA[w.id]?.coach !== activeCoach) {
        return false;
      }
      return true;
    });
  }, [deferredSearchQuery, activeCategory, activeCoach]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const filteredSaved = useMemo(() => {
    const q = deferredSearchQuery.toLowerCase();
    const seen = new Set<string>();
    const seenContent = new Set<string>();
    const deduplicated = savedWorkouts.filter((w) => {
      if (seen.has(w.id)) return false;
      seen.add(w.id);

      // Deduplicate identical procedural routines with identical title, duration, and exercise length
      const contentKey = `${w.workoutTitle}_${w.totalDurationMinutes}_${w.exercises?.length || 0}`.toLowerCase();
      if (seenContent.has(contentKey)) return false;
      seenContent.add(contentKey);

      return true;
    });

    return deduplicated.filter((w) => {
      const matchesSearch =
        !q ||
        w.workoutTitle.toLowerCase().includes(q) ||
        w.workoutDescription.toLowerCase().includes(q) ||
        w.targetArea.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (activeCategory === "All") return true;

      const cat = activeCategory.toLowerCase();
      return (
        w.targetArea.toLowerCase().includes(cat) ||
        w.workoutTitle.toLowerCase().includes(cat) ||
        w.workoutDescription.toLowerCase().includes(cat)
      );
    });
  }, [deferredSearchQuery, activeCategory, savedWorkouts]);

  /** The session the hero offers. Most recent AI routine, else the first
   *  curated one — never an empty CTA. */
  const featured: Workout | undefined = savedWorkouts[0] ?? CURATED_WORKOUTS[0];
  const featuredMedia = featured
    ? CURATED_COACH_MEDIA[featured.id]
    : undefined;

  const goalHit = analytics.thisWeek.sessions >= WEEKLY_GOAL;

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
    <motion.div
      variants={staggerParent}
      initial="initial"
      animate="animate"
      className="space-y-7 pb-10"
      id="dashboard-view"
    >
      {/* ============================= HEADER ========================= */}
      <motion.header
        variants={staggerChild}
        className="flex items-start justify-between gap-4"
      >
        <div className="min-w-0">
          <p className="eyebrow">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="font-display mt-1.5 text-2xl font-extrabold leading-none tracking-tight text-ink sm:text-3xl">
            {greeting()}
          </h1>
          <p className="mt-1.5 text-xs text-ink-3">
            {analytics.currentStreak > 0 ? (
              <>
                <span className="font-bold text-emerald-glow">
                  {analytics.currentStreak}-day streak
                </span>{" "}
                · keep it alive
              </>
            ) : (
              "Log a session today to start a streak"
            )}
          </p>
        </div>
      </motion.header>

      <motion.div variants={staggerChild}>
        <TodayCard
          logs={logs}
          profile={profile}
          onStartPlan={onSelectWorkout}
          onStartWorkout={() => { if (featured) onSelectWorkout(featured); else onNavigate("ai-generator"); }}
          onOpenArena={() => onNavigate("beast-duels")}
          onSignIn={onOpenSettings}
        />
      </motion.div>

      {/* ====================== DAILY MOTIVATION HIGHLIGHTS ====================== */}
      <motion.div variants={staggerChild} className="w-full">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
            Daily Focus
          </span>
          <span className="text-[11px] font-medium text-zinc-500">Coach Highlights</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {MOTIVATION_STORIES.map((st, idx) => (
            <button
              key={st.id}
              type="button"
              onClick={() => {
                tapFeedback();
                onOpenStoryReel?.(idx);
              }}
              className="flex flex-col items-center gap-1.5 shrink-0 group active:scale-95 transition-transform cursor-pointer"
            >
              <div className="relative h-14 w-14 rounded-full p-[2px] border border-white/15 group-hover:border-white/50 transition-colors shadow-sm">
                <div className="h-full w-full rounded-full overflow-hidden bg-zinc-900">
                  <img
                    src={st.image}
                    alt={st.title}
                    className="h-full w-full rounded-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>
              <span className="text-[11px] font-semibold text-zinc-300 group-hover:text-white max-w-[64px] truncate">
                {st.title}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ============================ BENTO =========================== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {/* ---- Hero: today's session ---- */}
        <motion.div
          variants={staggerChild}
          className="col-span-2 sm:col-span-4 lg:col-span-4"
        >
          <div
            className="relative h-full min-h-[220px] overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#141418] p-4 sm:p-5"
          >
            {/* Motivational background athlete photo with flat matte overlay */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl"
            >
              <img
                src={featuredMedia?.photo ?? gymHeroImg}
                alt=""
                className="h-full w-full object-cover object-[80%_20%] opacity-40 transition-transform duration-700"
                draggable={false}
              />
              <div
                className="absolute inset-0 bg-gradient-to-r from-[#141418] via-[#141418]/90 to-transparent"
              />
            </div>

            <div className="relative z-10 flex h-full flex-col justify-between gap-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow">
                    {goalHit ? "Weekly goal cleared" : "Up next"}
                  </p>
                  <h2 className="font-display mt-2 text-xl font-extrabold leading-tight tracking-tight text-ink sm:text-2xl">
                    {featured?.workoutTitle ?? "Build your first session"}
                  </h2>
                  {featured && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-3">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        {featured.totalDurationMinutes} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {featured.targetArea}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Dumbbell className="h-3 w-3" />
                        {featured.exercises.length} moves
                      </span>
                    </div>
                  )}
                </div>

                <ProgressRing
                  value={analytics.weeklyGoalProgress}
                  size={80}
                  tone={goalHit ? "emerald" : "cyan"}
                  glow
                  label={`${analytics.thisWeek.sessions} of ${WEEKLY_GOAL} weekly sessions complete`}
                  className="hidden shrink-0 sm:inline-grid"
                >
                  <span className="font-numeric text-lg font-extrabold leading-none text-ink">
                    {analytics.thisWeek.sessions}
                  </span>
                  <span className="text-[8px] font-bold tracking-[0.18em] text-ink-4">
                    /{WEEKLY_GOAL}
                  </span>
                </ProgressRing>
              </div>

              {/* Week strip — the single most glanceable thing on the
                  screen, so it sits directly above the primary action. */}
              <StreakGraph
                tone={goalHit ? "emerald" : "cyan"}
                height={44}
                caption="Sessions completed on each day of this week"
                data={analytics.week.map((d) => ({
                  label: d.initial,
                  value: d.sessions,
                  detail: d.long,
                  current: d.isToday,
                }))}
              />

              <div className="flex items-center gap-2.5">
                <MagneticButton
                  size="lg"
                  tone={goalHit ? "emerald" : "cyan"}
                  block
                  magnet={6}
                  id="btn-start-featured"
                  onClick={() => {
                    tapFeedback();
                    if (featured) onSelectWorkout(featured);
                    else onNavigate("ai-generator");
                  }}
                >
                  <Play className="h-4 w-4 fill-current" />
                  {featured ? "Start session" : "Create a workout"}
                </MagneticButton>

                <MagneticButton
                  size="lg"
                  icon
                  variant="outline"
                  tone="cyan"
                  aria-label="Generate a workout with AI"
                  onClick={() => {
                    tapFeedback();
                    onNavigate("ai-generator");
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                </MagneticButton>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ---- Reminder opt-in ---- */}
        <motion.div
          variants={staggerChild}
          className="col-span-2 sm:col-span-2 lg:col-span-4"
        >
          <DailyReminderNudge logs={logs} />
        </motion.div>

        {/* ---- Streak / consistency ---- */}
        <motion.div
          variants={staggerChild}
          className="col-span-2 sm:col-span-2 lg:col-span-2"
        >
          <div
            className="flex h-full min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#141418] p-4"
          >
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Consistency</p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-numeric text-[32px] font-bold tabular-nums text-white leading-none">
                    {analytics.currentStreak > 0 ? analytics.currentStreak : "0"}
                  </span>
                  <span className="text-xs font-semibold text-zinc-400">
                    {analytics.currentStreak > 0
                      ? pluralize(analytics.currentStreak, "day", "days", false)
                      : "days streak"}
                  </span>
                </div>
              </div>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800/80 text-[#E1FF00]"
              >
                <Flame className="h-4 w-4" />
              </span>
            </div>

            <dl className="mt-4 space-y-2">
              <Row label="Best streak" value={pluralize(analytics.bestStreak, "day")} />
              <Row
                label="This week"
                value={duration(analytics.thisWeek.minutes)}
              />
              <Row
                label="Avg session"
                value={`${analytics.avgSessionMinutes} min`}
              />
            </dl>

            <div className="mt-4 flex items-center justify-between pt-2 border-t border-zinc-800/60">
              {analytics.currentStreak > 0 ? (
                <button
                  type="button"
                  onClick={shareStreak}
                  aria-label={`Share your ${analytics.currentStreak}-day streak`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-[#1E1E24] px-3 py-1 text-[11px] font-bold text-zinc-300 hover:text-white cursor-pointer"
                >
                  <Share2 className="h-3 w-3" />
                  Share streak
                </button>
              ) : (
                <span className="text-[11px] text-zinc-400 font-medium italic">Day 1 starts today — log a session</span>
              )}

              <button
                type="button"
                onClick={() => onOpenAnalytics?.()}
                className="group inline-flex items-center gap-1 text-[11px] font-bold text-[#E1FF00] hover:underline cursor-pointer"
              >
                Breakdown
                <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ---- Stat tiles ---- */}
        <StatTile
          label="Workouts"
          value={profile.totalWorkouts}
          icon={Dumbbell}
          tone="cyan"
          className="col-span-1 lg:col-span-1"
          hint={
            analytics.thisWeek.sessions > 0
              ? `+${analytics.thisWeek.sessions} wk`
              : undefined
          }
        />
        <StatTile
          label="Minutes"
          value={profile.totalMinutes}
          unit="min"
          icon={Clock3}
          tone="cyan"
          format="compact"
          className="col-span-1 lg:col-span-1"
        />
        <StatTile
          label="Calories"
          value={profile.totalCaloriesBurned}
          unit="kcal"
          icon={Flame}
          tone="ember"
          format="compact"
          className="col-span-1 lg:col-span-2"
        />
        <StatTile
          label="Badges"
          value={unlockedCount}
          unit={`/ ${ACHIEVEMENTS.length}`}
          icon={Trophy}
          tone="gold"
          className="col-span-1 lg:col-span-2"
          onClick={() => onNavigate("premium-hub")}
        />
      </div>

      {/* ===================== BIOMETRIC RECOVERY & STRAIN ===================== */}
      <motion.div variants={staggerChild} className="my-5">
        <BiometricSummaryCard
          logs={logs}
          onOpenFull={() => setShowBiometricsDrawer(true)}
        />
      </motion.div>

      {/* ============================ BROWSE ========================== */}
      <motion.div variants={staggerChild} className="space-y-3.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search routines, focus areas…"
            aria-label="Search workouts"
            className="h-12 w-full rounded-full border border-line bg-[var(--graphite)] pl-11 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-[color-mix(in_srgb,var(--cyan)_46%,transparent)]"
          />
        </div>

        <div className="rail -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {CATEGORIES.map(({ label, icon }) => (
            <Chip
              key={label}
              label={label}
              icon={icon}
              active={activeCategory === label}
              layoutGroup="dash-category"
              onClick={() => {
                tapFeedback();
                setActiveCategory(label);
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* ===================== ZERO LOGS ONBOARDING CARD ===================== */}
      {logs.length === 0 && (
        <motion.div
          variants={staggerChild}
          className="rounded-2xl border border-zinc-800 bg-[#141418] p-4 sm:p-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-[#E1FF00]">
                <Dumbbell className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#E1FF00]">
                  Get Started
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Complete your first workout
                </h3>
                <p className="mt-1 text-xs text-zinc-400 max-w-md leading-relaxed">
                  Log your first session to unlock biometric tracking, streak milestones, and workout analytics.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  if (featured) onSelectWorkout(featured);
                }}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#E1FF00] px-4 py-2.5 text-xs font-bold text-black shadow-sm transition-transform active:scale-95 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Start Now
              </button>
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  onNavigate("ai-generator");
                }}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#1E1E24] px-3.5 py-2.5 text-xs font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#E1FF00]" />
                Build Custom
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================= RECOMMENDED WORKOUTS ======================== */}
      <section className="space-y-4">
        <SectionHeader
          title="Recommended For You"
          subtitle="Sessions tailored to your current goals"
          actionLabel="Build New"
          onAction={() => onNavigate("ai-generator")}
        />

        {filteredSaved.length === 0 ? (
          <motion.div
            variants={staggerChild}
            className="rounded-xl2 border border-dashed border-line-strong px-5 py-9 text-center"
          >
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white/[0.04] text-cyan-400">
              <Sparkles className="h-5 w-5" />
            </span>
            <h4 className="font-display mt-3.5 text-sm font-extrabold text-ink">
              {searchQuery
                ? "No matching routines found"
                : activeCategory !== "All"
                ? `No custom ${activeCategory} routines yet`
                : "No custom routines yet"}
            </h4>
            <p className="mx-auto mt-1.5 max-w-[38ch] text-xs leading-relaxed text-ink-3">
              {searchQuery
                ? "Try a different search term or synthesize a new routine below."
                : activeCategory !== "All"
                ? `Tap below to generate an AI ${activeCategory} protocol, or scroll down for coach routines.`
                : "Create custom workouts tailored to your goals and equipment."}
            </p>
            <div className="mt-4 flex justify-center">
              <MagneticButton
                size="md"
                tone="cyan"
                onClick={() => {
                  tapFeedback();
                  onNavigate("ai-generator");
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                {activeCategory !== "All" ? `Build ${activeCategory} Routine` : "Build workout"}
              </MagneticButton>
            </div>
          </motion.div>
        ) : (
          <motion.div
            variants={staggerParent}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {filteredSaved.map((w) => (
              <WorkoutCard
                key={w.id}
                workout={w}
                onSelect={onSelectWorkout}
                onDelete={onDeleteWorkout}
              />
            ))}
          </motion.div>
        )}
      </section>

      {/* ===================== DAILY MOTIVATION SPOTLIGHT ===================== */}
      <motion.div variants={staggerChild}>
        <div className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#12141c] shadow-xl">
          <div className="flex flex-col sm:flex-row items-stretch">
            {/* Left text column */}
            <div className="relative z-10 flex flex-1 flex-col justify-between p-6 sm:p-7 pb-6">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] bg-white/[0.05] text-slate-300 border border-white/10">
                  ATHLETE SPOTLIGHT
                </span>
                <h3 className="font-display mt-3 text-xl font-black tracking-tight text-white sm:text-2xl">
                  Discipline Over Motivation
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400 max-w-[36ch] sm:text-sm">
                  "The pain of discipline is temporary. The pride of achievement lasts forever."
                </p>
              </div>

              <div className="mt-5 flex items-center gap-3 pt-1">
                <MagneticButton
                  size="md"
                  tone="cyan"
                  onClick={() => {
                    tapFeedback();
                    onNavigate("ai-generator");
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Start Session
                </MagneticButton>
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    if (CURATED_WORKOUTS[0]) onSelectWorkout(CURATED_WORKOUTS[0]);
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-slate-300 hover:text-white transition-colors"
                >
                  Quick Start
                </button>
              </div>
            </div>

            {/* Right photo banner: 100% visible, crisp AI gym graphic */}
            <div className="relative h-56 sm:h-auto sm:w-[48%] shrink-0 overflow-hidden">
              <img
                src={gymDailyMotivationImg}
                alt="Explosive Battle Ropes Training"
                className="h-full w-full object-cover object-[50%_25%] transition-transform duration-700 hover:scale-105"
                draggable={false}
              />
              {/* Directional gradient to seamlessly blend into card background */}
              <div
                className="absolute inset-0 hidden sm:block"
                style={{
                  background:
                    "linear-gradient(to right, var(--graphite) 0%, color-mix(in srgb, var(--graphite) 50%, transparent) 25%, transparent 60%)",
                }}
              />
              <div
                className="absolute inset-0 sm:hidden"
                style={{
                  background:
                    "linear-gradient(to bottom, transparent 60%, var(--graphite) 100%)",
                }}
              />
              <span className="absolute bottom-3 right-3 rounded-full bg-slate-950/90 border border-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-cyan-300">
                Battle Ropes Core &amp; Power
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ===================== SAVAGE VISUALS GALLERY ===================== */}
      <motion.div variants={staggerChild} className="mt-2">
        <GymMotivationGallery
          onOpenStoryReel={(idx) => {
            tapFeedback();
            onOpenStoryReel?.(idx);
          }}
        />
      </motion.div>

      {/* ======================= CURATED ROUTINES ===================== */}
      <section className="space-y-4">
        <SectionHeader
          title="Curated by coaches"
          subtitle={
            activeCoach
              ? `Showing ${activeCoach}'s routines`
              : "Tap a coach to filter"
          }
        />

        <motion.div
          variants={staggerChild}
          className="rail -mx-1 flex gap-3.5 overflow-x-auto px-1 pb-1"
        >
          <CoachPip
            label="Everyone"
            active={!activeCoach}
            onClick={() => setActiveCoach(null)}
          />
          {CERTIFIED_COACHES.map((c) => (
            <CoachPip
              key={c.name}
              label={c.name.replace(/^Coach /, "")}
              photo={c.photo}
              active={activeCoach === c.name}
              onClick={() =>
                setActiveCoach(activeCoach === c.name ? null : c.name)
              }
            />
          ))}
        </motion.div>

        {filteredCurated.length === 0 ? (
          <motion.div
            variants={staggerChild}
            className="rounded-xl2 border border-dashed border-line-strong px-5 py-8 text-center"
          >
            <p className="text-xs text-ink-3">No routines match that filter.</p>
            {activeCoach && (
              <button
                type="button"
                onClick={() => setActiveCoach(null)}
                className="mt-2 text-xs font-bold text-cyan-glow"
              >
                Show all coaches
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            variants={staggerParent}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {filteredCurated.map((w) => (
              <WorkoutCard key={w.id} workout={w} onSelect={onSelectWorkout} />
            ))}
          </motion.div>
        )}
      </section>

      {/* =========================== HUB CTA ========================== */}
      <motion.div variants={staggerChild}>
        <GlassCard
          glow="gold"
          variant="prism"
          grain
          radius="2xl"
          interactive
          className="cursor-pointer p-5 sm:p-6"
          onClick={() => {
            tapFeedback();
            onNavigate("premium-hub");
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onNavigate("premium-hub");
            }
          }}
        >
          {/* Motivational luxury gym powerhouse background */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl"
          >
            <img
              src={gymPremiumBeastImg}
              alt=""
              className="h-full w-full object-cover object-[80%_25%] opacity-75"
              draggable={false}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, var(--carbon) 0%, var(--carbon) 38%, color-mix(in srgb, var(--carbon) 55%, transparent) 70%, transparent 100%)",
              }}
            />
          </div>

          {/* Gold ambient bloom — large, soft, top-right */}
          <div
            aria-hidden
            className="ambient-orb pointer-events-none"
            style={{
              width: 200,
              height: 200,
              top: -60,
              right: -40,
              background: "radial-gradient(circle, var(--neon-gold-near) 0%, var(--neon-gold-far) 60%, transparent 100%)",
              animationDelay: "-4s",
            }}
          />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em]"
                style={{
                  background: "var(--gold-wash)",
                  color: "var(--gold)",
                }}
              >
                <Compass className="h-3 w-3" />
                {isPremium ? "Coaching hub" : "Premium"}
              </span>
              <h3 className="font-display mt-2.5 text-lg font-extrabold tracking-tight text-ink">
                Programs, badges &amp; tools
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-3">
                Multi-week training plans, achievements, and wellness tools.
              </p>
            </div>
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
              style={{ background: "var(--gold)", color: "var(--void)" }}
            >
              <ArrowUpRight className="h-5 w-5" />
            </span>
          </div>

          <div className="relative z-10 mt-4 flex gap-5 border-t border-line pt-4 text-[11px]">
            <HubStat value={PROGRAM_PLANS.length} label="programs" />
            <HubStat value={ACHIEVEMENTS.length} label="badges" />
            <HubStat value={favorites.length} label="saved" />
          </div>
        </GlassCard>
      </motion.div>

      {/* ========================== SETTINGS ========================== */}
      <Drawer
        open={showSettings}
        onClose={() => {
          setShowSettings(false);
          setConfirmingReset(false);
        }}
        title="Settings"
        subtitle="Profile preferences and data"
      >
        <div className="space-y-6">
          {/* First, deliberately. Notifications and backup are what people
              open settings FOR; the profile controls below are things they
              set once. Burying the entry point under three fieldsets is how
              a settings screen ends up unused. */}
          {onOpenSettings && (
            <button
              type="button"
              id="btn-open-app-settings"
              onClick={() => {
                tapFeedback();
                setShowSettings(false);
                onOpenSettings();
              }}
              className="surface flex w-full items-center gap-3 rounded-lg2 p-4 text-left transition-colors hover:border-[color-mix(in_srgb,var(--emerald)_40%,var(--line))]"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md2"
                style={{
                  background: "var(--emerald-wash)",
                  color: "var(--emerald)",
                }}
              >
                <Bell className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">
                  App settings
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-4">
                  Reminders, haptics, sound and data backup
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-4" />
            </button>
          )}

          <button
            type="button"
            id="btn-edit-my-info"
            onClick={() => {
              setShowSettings(false);
              onEditProfile?.();
            }}
            className="surface flex w-full items-center gap-3 rounded-lg2 p-4 text-left transition-colors hover:border-[color-mix(in_srgb,var(--cyan)_40%,var(--line))]"
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md2"
              style={{ background: "var(--cyan-wash)", color: "var(--cyan)" }}
            >
              <UserRound className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">
                Edit my info
              </span>
              <span className="mt-0.5 block truncate text-xs text-ink-4">
                {profile.gender ||
                profile.age ||
                profile.heightCm ||
                profile.weightKg
                  ? [
                      profile.gender
                        ? profile.gender[0].toUpperCase() +
                          profile.gender.slice(1)
                        : "—",
                      profile.age ? `${profile.age} yrs` : "—",
                      profile.heightCm ? `${profile.heightCm} cm` : "—",
                      profile.weightKg ? `${profile.weightKg} kg` : "—",
                    ].join(" · ")
                  : "Gender, age, height and weight — not set yet"}
              </span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-4" />
          </button>

          <fieldset className="space-y-2">
            <legend className="eyebrow mb-2">Fitness level</legend>
            <div className="grid grid-cols-3 gap-2">
              {FITNESS_LEVELS.map((level) => {
                const on = profile.fitnessLevel === level.value;
                return (
                  <motion.button
                    key={level.value}
                    type="button"
                    transition={SPRING_SNAP}
                    onClick={() =>
                      setProfile((p) => ({
                        ...p,
                        fitnessLevel:
                          level.value as UserProfile["fitnessLevel"],
                      }))
                    }
                    className="relative rounded-md2 border px-2 py-2.5 text-center text-[11px] font-bold transition-colors"
                    style={{
                      borderColor: on
                        ? "color-mix(in srgb, var(--cyan) 46%, transparent)"
                        : "var(--line)",
                      background: on ? "var(--cyan-wash)" : "var(--graphite)",
                      color: on ? "var(--cyan)" : "var(--ink-2)",
                    }}
                  >
                    {level.label}
                  </motion.button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="eyebrow mb-2">Primary goal</legend>
            <div className="grid grid-cols-2 gap-2">
              {WORKOUT_GOALS.map((g) => {
                const on = profile.goal === g.value;
                return (
                  <motion.button
                    key={g.value}
                    type="button"
                    transition={SPRING_SNAP}
                    onClick={() =>
                      setProfile((p) => ({
                        ...p,
                        goal: g.value as UserProfile["goal"],
                      }))
                    }
                    className="flex items-center gap-2 rounded-md2 border px-3 py-2.5 text-left text-[11px] font-bold transition-colors"
                    style={{
                      borderColor: on
                        ? "color-mix(in srgb, var(--cyan) 46%, transparent)"
                        : "var(--line)",
                      background: on ? "var(--cyan-wash)" : "var(--graphite)",
                      color: on ? "var(--cyan)" : "var(--ink-2)",
                    }}
                  >
                    <span aria-hidden>{g.icon}</span>
                    <span className="truncate">{g.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-2 border-t border-line pt-5">
            <p className="eyebrow mb-2">Data</p>
            <motion.button
              type="button"
              id="btn-reset-all-data"
              onClick={handleResetClick}
              onBlur={() => setConfirmingReset(false)}
              className="flex w-full items-center justify-center gap-2 rounded-md2 border px-4 py-3 text-xs font-extrabold transition-colors"
              style={
                confirmingReset
                  ? { background: "var(--crimson)", color: "var(--void)", borderColor: "transparent" }
                  : {
                      background: "var(--crimson-wash)",
                      color: "var(--crimson)",
                      borderColor:
                        "color-mix(in srgb, var(--crimson) 28%, transparent)",
                    }
              }
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {confirmingReset ? "Tap again to confirm" : "Reset all data"}
            </motion.button>
            <p className="text-center text-[11px] leading-relaxed text-ink-4">
              Wipes your profile, saved AI workouts and full training history.
              This cannot be undone.
            </p>
          </div>
        </div>
      </Drawer>

      {/* Biometric Readiness Drawer */}
      <Drawer
        open={showBiometricsDrawer}
        onClose={() => setShowBiometricsDrawer(false)}
        title="Biometric Readiness"
        subtitle="Daily Recovery & Strain"
      >
        <BiometricRecoveryHub
          logs={logs}
          profile={profile}
          onNavigateToWorkout={() => {
            setShowBiometricsDrawer(false);
            if (featured) onSelectWorkout(featured);
            else onNavigate("ai-generator");
          }}
          onClose={() => setShowBiometricsDrawer(false)}
        />
      </Drawer>

      {/* Milestone moment. A dismissible banner, not a blocking modal: it
          arrives unprompted, and something that interrupts you in order to
          congratulate you gets resented by the third time. The haptic
          already fired when it was detected. */}
      <AnimatePresence>
        {milestone && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="glass fixed inset-x-4 bottom-24 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-xl2 p-4"
            style={{ boxShadow: "0 0 48px -16px var(--gold)" }}
            role="status"
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
              style={{ background: "var(--gold-wash)", color: "var(--gold)" }}
            >
              <Trophy className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-ink">
                {milestone.title}
              </p>
              <p className="truncate text-[11px] text-ink-3">{milestone.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                setShareCard(
                  milestone.kind === "streak"
                    ? streakCard({
                        days: analytics.currentStreak,
                        best: analytics.bestStreak,
                        sessions: analytics.totalSessions,
                      })
                    : milestoneCard({
                        name: milestone.title,
                        detail: "Unlocked",
                        unlocked: milestone.value,
                        total: ACHIEVEMENTS.length,
                      }),
                );
                setMilestone(null);
              }}
              className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold"
              style={{ background: "var(--gold)", color: "var(--void)" }}
            >
              Share
            </button>
            <button
              type="button"
              onClick={() => setMilestone(null)}
              aria-label="Dismiss"
              className="shrink-0 text-ink-4"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {shareCard && (
        <FlexCardSheet
          data={shareCard}
          shareText={
            shareCard.kind === "streak"
              ? `${analytics.currentStreak}-day streak`
              : "Milestone unlocked"
          }
          onClose={() => setShareCard(null)}
        />
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="truncate text-[11px] text-ink-4">{label}</dt>
      <dd className="font-numeric shrink-0 text-xs font-bold text-ink-2">
        {value}
      </dd>
    </div>
  );
}

function HubStat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="font-numeric font-extrabold text-gold-glow">
        {value}
      </span>{" "}
      <span className="text-ink-4">{label}</span>
    </span>
  );
}

/** Renders a coach photo with an initials-gradient fallback if the image fails to load.
 *  Prevents the "all white circles" bug when image assets are missing. */
function CoachAvatar({ photo, name }: { photo: string; name: string }) {
  const [imgError, setImgError] = React.useState(false);
  // Generate a consistent hue from the name for the gradient
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const initials = name
    .replace(/^Coach\s+/i, "")
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  if (imgError) {
    return (
      <span
        className="flex h-full w-full items-center justify-center text-[11px] font-black text-white"
        style={{
          background: `linear-gradient(135deg, hsl(${hue},60%,28%) 0%, hsl(${(hue + 40) % 360},55%,40%) 100%)`,
        }}
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={photo}
      alt=""
      draggable={false}
      className="h-full w-full object-cover"
      onError={() => setImgError(true)}
    />
  );
}


function CoachPip({
  label,
  photo,
  active,
  onClick,
}: {
  label: string;
  photo?: string;
  active: boolean;
  onClick: () => void;
}) {
  const a = accent("cyan");
  return (
    <motion.button
      type="button"
      onClick={() => {
        tapFeedback();
        onClick();
      }}
      whileHover={{ y: -2 }}
      transition={SPRING_SNAP}
      aria-pressed={active}
      className="flex shrink-0 flex-col items-center gap-1.5"
    >
      <span
        className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full"
        style={{
          boxShadow: active
            ? `0 0 0 2px var(--carbon), 0 0 0 4px ${a.color}, 0 8px 22px -8px ${a.color}`
            : "inset 0 0 0 1px var(--line)",
          background: photo ? undefined : "var(--graphite)",
        }}
      >
        {photo ? (
          <CoachAvatar photo={photo} name={label} />
        ) : (
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-ink-3">
            All
          </span>
        )}
        <AnimatePresence>
          {active && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={SPRING_SNAP}
              className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full"
              style={{ background: a.color, color: "var(--void)" }}
            >
              <Check className="h-3 w-3" strokeWidth={3.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span
        className="max-w-[60px] truncate text-[11px] font-bold"
        style={{ color: active ? a.color : "var(--ink-4)" }}
      >
        {label}
      </span>
    </motion.button>
  );
}

const Dashboard = React.memo(DashboardInner);
export default Dashboard;

