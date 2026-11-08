import OneTimeHint from "./OneTimeHint";
import { useEffect, useMemo, useState } from "react";
import { Flame, Snowflake, Play, Swords, Target, CheckCircle2, Bell, Minus, Plus, ChevronDown, LogIn, Trophy } from "lucide-react";
import type { WorkoutLog } from "../types";
import { useMyIdentity } from "../lib/useSocial";
import { useProgress, useQuests, streakStatus, LEAGUE_NAMES, LEAGUE_COLORS, type Quest } from "../lib/progress";
import { loadNotificationPrefs, saveNotificationPrefs, requestNotificationPermission, applyStreakWarning } from "../lib/notifications";
import { tapFeedback } from "../lib/haptics";
import { useNextPlan, buildWorkoutFromPlan } from "../lib/plan";
import { useHealth } from "../lib/health";
import { Footprints, Lock } from "lucide-react";
import type { UserProfile, Workout } from "../types";

const GOAL_KEY = "ap_daily_goal_min";
const REMINDER_ASKED = "ap_evening_reminder_asked";

const sameDay = (iso: string) => {
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

function readGoal(): number {
  try { const v = Number(localStorage.getItem(GOAL_KEY)); return v >= 5 && v <= 120 ? v : 20; } catch { return 20; }
}

function QuestRow({ q }: { q: Quest }) {
  const pct = Math.round((q.progress / q.target) * 100);
  return (
    <li className="flex items-center gap-3">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${q.done ? "bg-emerald-500 text-white" : "border border-line text-ink-4"}`}>
        {q.done ? <CheckCircle2 className="h-4 w-4" /> : <Target className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-xs font-semibold ${q.done ? "text-ink-3 line-through" : "text-ink"}`}>{q.title}</span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-graphite"><span className="block h-full rounded-full bg-volt transition-all duration-500" style={{ width: `${pct}%` }} /></span>
      </span>
      <span className="shrink-0 text-right text-[11px] font-bold text-ink-3">{q.progress}/{q.target}<span className="block text-volt">+{q.xp} XP</span></span>
    </li>
  );
}

export default function TodayCard({
  logs, onStartWorkout, onOpenArena, onSignIn, profile, onStartPlan,
}: {
  profile: UserProfile;
  onStartPlan: (w: Workout) => void;
  logs: WorkoutLog[];
  onStartWorkout: () => void;
  onOpenArena: () => void;
  onSignIn?: () => void;
}) {
  const me = useMyIdentity();
  const prog = useProgress(me.uid);
  const quests = useQuests(me.uid);
  const [goal, setGoal] = useState(readGoal);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [askReminder, setAskReminder] = useState(() => { try { return !localStorage.getItem(REMINDER_ASKED); } catch { return false; } });

  const { plan, locked } = useNextPlan(me.uid, profile, logs, goal);
  const health = useHealth();
  const todayMinutes = useMemo(() => logs.filter(l => sameDay(l.completedAt)).reduce((a, l) => a + (l.durationMinutes || 0), 0), [logs]);
  const trainedToday = todayMinutes > 0;
  const streak = me.uid ? streakStatus(prog) : { days: 0, state: "none" as const };
  const goalPct = Math.min(100, Math.round((todayMinutes / goal) * 100));

  // re-arm the 9 PM "don't lose your streak" reminder each day if the user turned it on
  useEffect(() => {
    const prefs = loadNotificationPrefs();
    if (prefs.streakWarningEnabled) void applyStreakWarning(prefs, trainedToday);
  }, [trainedToday]);

  const setGoalSafe = (n: number) => { const v = Math.max(5, Math.min(120, n)); setGoal(v); try { localStorage.setItem(GOAL_KEY, String(v)); } catch { /* ignore */ } };

  const enableReminder = async () => {
    try { localStorage.setItem(REMINDER_ASKED, "1"); } catch { /* ignore */ }
    setAskReminder(false);
    if (!(await requestNotificationPermission())) return;
    const next = { ...loadNotificationPrefs(), streakWarningEnabled: true };
    saveNotificationPrefs(next);
    await applyStreakWarning(next, trainedToday);
  };

  const dailyPending = quests?.daily.filter(q => !q.done) ?? [];
  const arenaQuest = dailyPending.find(q => q.metric === "arena_matches" || q.metric === "arena_wins");

  // one clear next step
  let action: { label: string; sub: string; run: () => void; icon: React.ReactNode };
  if (!trainedToday) {
    action = {
      label: streak.state === "at-risk" || streak.state === "frozen" ? `Keep your ${streak.days}-day streak` : "Start today's workout",
      sub: streak.state === "frozen" ? "A streak freeze will cover yesterday if you train today" : `${goal} min goal · +60 XP quest`,
      run: onStartWorkout, icon: <Play className="h-5 w-5 fill-current" />,
    };
    if (plan && plan.kind === "workout") {
      action = { ...action, sub: `${plan.area} · ${plan.minutes} min · picked for your recovery`, run: () => onStartPlan(buildWorkoutFromPlan(plan, profile)) };
    }
  } else if (arenaQuest) {
    action = { label: "Play an Arena match", sub: `${arenaQuest.title} · +${arenaQuest.xp} XP`, run: onOpenArena, icon: <Swords className="h-5 w-5" /> };
  } else if (goalPct < 100) {
    action = { label: "Finish your daily goal", sub: `${goal - todayMinutes} more minutes`, run: onStartWorkout, icon: <Play className="h-5 w-5 fill-current" /> };
  } else {
    action = { label: "You're done for today", sub: "Climb your weekly league in the Arena", run: onOpenArena, icon: <Trophy className="h-5 w-5" /> };
  }

  const stateText = { safe: "Done for today", "at-risk": "Train today to keep it", frozen: "Freeze ready", lost: "Start a new streak", none: "Start your streak" }[streak.state];
  const lr = prog.lastLeagueResult;

  return (
    <section className="rounded-3xl border border-line bg-carbon p-4" aria-label="Today">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-ink-3">Today</h2>
        {me.uid && (
          <span className="flex items-center gap-2 text-xs font-bold">
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${streak.days ? "bg-orange-500/15 text-orange-400" : "bg-graphite text-ink-3"}`}>
              <Flame className="h-3.5 w-3.5" /> {streak.days}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-sky-300" title="Streak freezes: forgive one missed day. Earn one every 7 days.">
              <Snowflake className="h-3.5 w-3.5" /> {prog.freezes}
            </span>
          </span>
        )}
      </div>
      {me.uid && <p className="mt-0.5 text-[11px] text-ink-3">{stateText}</p>}

      <button
        onClick={() => { void tapFeedback(); action.run(); }}
        className="mt-3 flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-volt px-4 text-left text-void active:scale-[0.98]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-void/15">{action.icon}</span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-black">{action.label}</span><span className="block truncate text-xs font-semibold opacity-70">{action.sub}</span></span>
      </button>

      {locked && (
        <button onClick={() => window.dispatchEvent(new Event("apex-open-paywall"))} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-graphite px-3 py-2 text-left text-[11px] text-ink-2 active:scale-[0.99]">
          <Lock className="h-3.5 w-3.5 shrink-0 text-volt" /><span><b className="text-ink">Adaptive plans are part of Pro.</b> We'd pick your next workout from your recovery. Tap to see Pro.</span>
        </button>
      )}
      {plan && <OneTimeHint id="adaptive" className="mt-2">Your next workout is picked from what you trained and how it felt.</OneTimeHint>}
      {plan && (
        <p className="mt-2 rounded-xl bg-graphite px-3 py-2 text-[11px] leading-snug text-ink-2">
          <b className="text-ink">{plan.kind === "rest" ? "Recovery day suggested. " : `Next: ${plan.area}, ${plan.level}. `}</b>{plan.reason}
          {plan.kind === "rest" && <button onClick={() => { void tapFeedback(); onStartPlan(buildWorkoutFromPlan({ ...plan, area: "Core / Abs" }, profile)); }} className="ml-1 font-bold text-volt">Do a light session anyway</button>}
        </p>
      )}

      {health.state === "ready" && health.today && (
        <div className="mt-2 flex items-center justify-between rounded-xl bg-graphite px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 font-bold"><Footprints className="h-4 w-4 text-volt" />{health.today.steps.toLocaleString()} steps</span>
          <span className="text-ink-2">{health.today.kcal} active kcal</span>
        </div>
      )}
      {(health.state === "off" || health.state === "needs-install") && (
        <button onClick={() => void health.connect()} disabled={health.busy || health.state === "needs-install"} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-left text-[11px] text-ink-2 active:scale-[0.99] disabled:opacity-60">
          <Footprints className="h-4 w-4 shrink-0 text-volt" />
          <span className="flex-1">{health.state === "needs-install" ? "Install Health Connect from Google Play to show your steps." : <><b className="text-ink">Connect Health Connect</b> to see today's steps and calories here. Read-only, stays on your phone.</>}</span>
        </button>
      )}
      {health.error && <p className="mt-1 text-center text-[11px] text-rose-300">{health.error}</p>}

      {/* daily goal */}
      <div className="mt-4 rounded-2xl border border-line bg-graphite p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold">Daily goal</span>
          <span className="flex items-center gap-2 text-xs font-semibold text-ink-2">
            <button aria-label="Lower goal" onClick={() => setGoalSafe(goal - 5)} className="flex h-6 w-6 items-center justify-center rounded-full bg-carbon active:scale-90"><Minus className="h-3 w-3" /></button>
            {todayMinutes}/{goal} min
            <button aria-label="Raise goal" onClick={() => setGoalSafe(goal + 5)} className="flex h-6 w-6 items-center justify-center rounded-full bg-carbon active:scale-90"><Plus className="h-3 w-3" /></button>
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-carbon"><div className={`h-full rounded-full transition-all duration-700 ${goalPct >= 100 ? "bg-emerald-400" : "bg-volt"}`} style={{ width: `${goalPct}%` }} /></div>
      </div>

      {/* quests */}
      {!me.uid ? (
        <button onClick={onSignIn} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line px-3 py-3 text-left active:scale-[0.99]">
          <LogIn className="h-4 w-4 text-volt" /><span className="text-xs text-ink-2"><b className="text-ink">Sign in</b> to unlock daily quests, streak freezes and weekly leagues.</span>
        </button>
      ) : quests ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-3">Daily quests</p>
          <ul className="space-y-3">{quests.daily.map(q => <QuestRow key={q.id} q={q} />)}</ul>
          <button onClick={() => setWeeklyOpen(o => !o)} className="mt-3 flex w-full items-center justify-between text-[11px] font-bold uppercase tracking-widest text-ink-3">
            This week <ChevronDown className={`h-4 w-4 transition ${weeklyOpen ? "rotate-180" : ""}`} />
          </button>
          {weeklyOpen && <ul className="mt-2 space-y-3">{quests.weekly.map(q => <QuestRow key={q.id} q={q} />)}</ul>}
        </div>
      ) : (
        <div className="mt-4 space-y-3" aria-hidden>{[0, 1, 2].map(i => <div key={i} className="h-8 animate-pulse rounded-xl bg-graphite" />)}</div>
      )}

      {me.uid && lr && (
        <p className="mt-3 rounded-xl bg-graphite px-3 py-2 text-center text-[11px] font-semibold text-ink-2">
          Last week: <b style={{ color: LEAGUE_COLORS[lr.tier] }}>{LEAGUE_NAMES[lr.tier]}</b> league, rank #{lr.rank} of {lr.size} ·{" "}
          {lr.outcome === "promoted" ? `promoted to ${LEAGUE_NAMES[lr.newTier]}!` : lr.outcome === "demoted" ? `moved down to ${LEAGUE_NAMES[lr.newTier]}` : "you stayed"}
        </p>
      )}

      {askReminder && (
        <button onClick={enableReminder} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-line px-3 py-3 text-left active:scale-[0.99]">
          <Bell className="h-4 w-4 text-volt" /><span className="min-w-0 flex-1 text-xs text-ink-2"><b className="text-ink">Evening reminder.</b> A gentle 9 PM nudge only if you haven't trained, so you never lose your streak.</span><span className="text-xs font-bold text-volt">Turn on</span>
        </button>
      )}
    </section>
  );
}
