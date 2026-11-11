import { paywallUnlocked } from "../billing/billing";
import OneTimeHint from "../../shared/OneTimeHint";
import { useT, type TKey } from "../../i18n";
import { useEffect, useMemo, useState } from "react";
import { Flame, Snowflake, Play, Swords, Target, CheckCircle2, Bell, Minus, Plus, ChevronDown, LogIn, Trophy } from "lucide-react";
import type { WorkoutLog } from "../../types";
import { useMyIdentity } from "../social/useSocial";
import { useProgress, useQuests, streakStatus, localWeekId, LEAGUE_NAMES, LEAGUE_COLORS, type Quest } from "../progress/progress";
import { loadNotificationPrefs, saveNotificationPrefs, requestNotificationPermission, applyStreakWarning } from "../../core/notifications";
import { tapFeedback } from "../../core/haptics";
import { callFn } from "../../core/functions";
import { useNextPlan, buildWorkoutFromPlan, buildEasyWorkout } from "./plan";
import { useHealth } from "../progress/health";
import { Footprints, Lock, ClipboardList } from "lucide-react";
import { goToScreen } from "../../core/navEvents";
import { useCurrentProgram, prefetchProgramClips } from "../workout/programs";
import { programById, sessionsPerWeek } from "../../data/programs";
import type { UserProfile, Workout } from "../../types";

const GOAL_KEY = "ap_daily_goal_min";
const REMINDER_ASKED = "ap_evening_reminder_asked";
const WELCOME_BACK_KEY = "ap_welcome_back_for"; // the last-workout day of the break we already welcomed the user back from
const WELCOME_BACK_DAYS = 3;

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const readWelcomed = () => { try { return localStorage.getItem(WELCOME_BACK_KEY) || ""; } catch { return ""; } };
const writeWelcomed = (v: string) => { try { localStorage.setItem(WELCOME_BACK_KEY, v); } catch { /* ignore */ } };

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
  const t = useT();
  const areaLabel = (a: string | null) => (a && ["Full Body", "Upper Body", "Lower Body", "Core / Abs", "Cardio Blitz"].includes(a) ? t(`area.${a}` as TKey) : a ?? "");
  const levelLabel = (l: string) => t(`level.${l.toLowerCase()}.label` as TKey);
  const prog = useProgress(me.uid);
  const quests = useQuests(me.uid);
  const program = useCurrentProgram(me.uid ?? null);
  const activeId = program.status === "ready" && program.current && !program.current.completedAt ? program.current.programId : null;
  const activeDone = program.status === "ready" && program.current ? program.current.done : 0;
  useEffect(() => { if (activeId) void prefetchProgramClips(activeId, activeDone); }, [activeId, activeDone]);
  const [goal, setGoal] = useState(readGoal);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [questTry, setQuestTry] = useState(0);
  const [questsSlow, setQuestsSlow] = useState(false);
  const [askReminder, setAskReminder] = useState(() => { try { return !localStorage.getItem(REMINDER_ASKED); } catch { return false; } });

  // if today's quests have not arrived after 8 seconds, show a retry instead of a skeleton that never ends
  useEffect(() => {
    setQuestsSlow(false);
    if (!me.uid || quests) return;
    const t = window.setTimeout(() => setQuestsSlow(true), 8000);
    return () => window.clearTimeout(t);
  }, [me.uid, quests, questTry]);

  const { plan, locked, genericReason } = useNextPlan(me.uid, profile, logs, goal);
  const health = useHealth();
  const todayMinutes = useMemo(() => logs.filter(l => sameDay(l.completedAt)).reduce((a, l) => a + (l.durationMinutes || 0), 0), [logs]);
  const trainedToday = todayMinutes > 0;
  const streak = me.uid ? streakStatus(prog) : { days: 0, state: "none" as const };
  const goalPct = Math.min(100, Math.round((todayMinutes / goal) * 100));

  // Welcome back: after a break of 3+ days, one friendly card, once per break. A break is identified by the day of the
  // last workout before it, so it can never come back for the same break (a new workout starts a new "last day").
  const lastDay = useMemo(() => {
    let best = 0;
    for (const l of logs) { const t = Date.parse(l.completedAt); if (t > best) best = t; }
    return best ? localKey(new Date(best)) : "";
  }, [logs]);
  const daysAway = lastDay ? daysBetween(lastDay, localKey(new Date())) : 0;
  const [wbShown, setWbShown] = useState("");   // break we are showing the card for right now
  const [wbClosed, setWbClosed] = useState(""); // break the user dismissed
  useEffect(() => {
    if (lastDay && daysAway >= WELCOME_BACK_DAYS && !wbShown && readWelcomed() !== lastDay && wbClosed !== lastDay) {
      writeWelcomed(lastDay); // remembered the moment it is first shown, so it never appears twice
      setWbShown(lastDay);
    }
  }, [lastDay, daysAway, wbShown, wbClosed]);
  const welcomeBack = wbShown !== "" && wbShown === lastDay && wbClosed !== lastDay && !trainedToday;
  // weekly goal (server-owned: the app only shows it and asks the server to change the target)
  const weekDone = prog.weekDoneId === localWeekId() ? prog.weekDone : 0;
  const weekGoal = prog.weeklyGoal;
  const [goalBusy, setGoalBusy] = useState(false);
  const [goalErr, setGoalErr] = useState(false);
  const nextWeekGoal = async () => {
    if (goalBusy) return;
    setGoalBusy(true); setGoalErr(false);
    try { await callFn("setWeeklyGoal", { goal: weekGoal >= 5 ? 3 : weekGoal + 1 }); } catch { setGoalErr(true); }
    setGoalBusy(false);
  };

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
  if (welcomeBack) {
    action = {
      label: t("today.easy.label"), sub: t("today.easy.sub"),
      run: () => { setWbClosed(lastDay); onStartPlan(buildEasyWorkout(profile)); }, icon: <Play className="h-5 w-5 fill-current" />,
    };
  } else if (!trainedToday) {
    action = {
      label: streak.state === "at-risk" || streak.state === "frozen" ? t("today.keepStreak", { n: streak.days }) : t("today.startToday"),
      sub: streak.state === "frozen" ? t("today.sub.frozen") : t("today.sub.goal", { n: goal }),
      run: onStartWorkout, icon: <Play className="h-5 w-5 fill-current" />,
    };
    if (plan && plan.kind === "workout") {
      action = { ...action, sub: t("today.sub.plan", { area: areaLabel(plan.area), n: plan.minutes }), run: () => onStartPlan(buildWorkoutFromPlan(plan, profile)) };
    }
  } else if (arenaQuest) {
    action = { label: t("today.arena.label"), sub: `${arenaQuest.title} · +${arenaQuest.xp} XP`, run: onOpenArena, icon: <Swords className="h-5 w-5" /> };
  } else if (goalPct < 100) {
    action = { label: t("today.finishGoal"), sub: t("today.moreMinutes", { n: goal - todayMinutes }), run: onStartWorkout, icon: <Play className="h-5 w-5 fill-current" /> };
  } else {
    action = { label: t("today.done"), sub: t("today.doneSub"), run: onOpenArena, icon: <Trophy className="h-5 w-5" /> };
  }

  const stateText = { safe: t("today.state.safe"), "at-risk": t("today.state.atRisk"), frozen: t("today.state.frozen"), lost: t("today.state.lost"), none: t("today.state.none") }[streak.state];
  const lr = prog.lastLeagueResult;

  return (
    <section className="rounded-3xl border border-line bg-carbon p-4" aria-label={t("today.title")}>
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-ink-3">{t("today.title")}</h2>
        {me.uid && (
          <span className="flex items-center gap-2 text-xs font-bold">
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${streak.days ? "bg-orange-500/15 text-orange-400" : "bg-graphite text-ink-3"}`}>
              <Flame className="h-3.5 w-3.5" /> {streak.days}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-sky-300" title={t("today.streakFreezeTip")}>
              <Snowflake className="h-3.5 w-3.5" /> {prog.freezes}
            </span>
          </span>
        )}
      </div>
      {me.uid && <p className="mt-0.5 text-[11px] text-ink-3">{stateText}</p>}

      {welcomeBack && (
        <div role="note" className="mt-3 rounded-2xl border border-volt/30 bg-volt/10 px-3 py-2.5">
          <p className="text-sm font-bold text-ink">{t("today.wb.title")}</p>
          <p className="mt-0.5 text-xs leading-snug text-ink-2">{t("today.wb.body")}</p>
        </div>
      )}
      <button
        onClick={() => { void tapFeedback(); action.run(); }}
        className="mt-3 flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-volt px-4 text-left text-void active:scale-[0.98]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-void/15">{action.icon}</span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-black">{action.label}</span><span className="block text-xs font-semibold opacity-70">{action.sub}</span></span>
      </button>

      {welcomeBack && (
        <button onClick={() => { void tapFeedback(); setWbClosed(lastDay); }} className="mt-1 flex min-h-[48px] w-full items-center justify-center text-xs font-bold text-ink-3 active:opacity-70">{t("today.wb.notNow")}</button>
      )}

      {locked && !paywallUnlocked(prog.totalWorkouts) && genericReason && (
        <p className="mt-2 rounded-xl bg-graphite px-3 py-2 text-[11px] text-ink">{genericReason}</p>
      )}
      {locked && paywallUnlocked(prog.totalWorkouts) && (
        <button onClick={() => window.dispatchEvent(new Event("apex-open-paywall"))} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-graphite px-3 py-2 text-left text-[11px] text-ink-2 active:scale-[0.99]">
          <Lock className="h-3.5 w-3.5 shrink-0 text-volt" /><span>{genericReason && <span className="block text-ink">{genericReason}</span>}<b className="text-ink">Pro</b> {t("today.proUpsell")}</span>
        </button>
      )}
      {plan && <OneTimeHint id="adaptive" className="mt-2">{t("today.adaptiveHint")}</OneTimeHint>}
      {plan && (
        <p className="mt-2 rounded-xl bg-graphite px-3 py-2 text-[11px] leading-snug text-ink-2">
          <b className="text-ink">{plan.kind === "rest" ? t("today.recoveryDay") : t("today.nextArea", { area: areaLabel(plan.area), level: levelLabel(plan.level) })}</b>{plan.reason}
          {plan.kind === "rest" && <button onClick={() => { void tapFeedback(); onStartPlan(buildWorkoutFromPlan({ ...plan, area: "Core / Abs" }, profile)); }} className="ml-1 font-bold text-volt">{t("today.lightAnyway")}</button>}
        </p>
      )}
      {plan?.upcoming && plan.upcoming.length > 0 && (
        <ul className="mt-1.5 grid grid-cols-3 gap-1.5" aria-label={t("today.next3")}>
          {plan.upcoming.map(u => (
            <li key={u.label} className="rounded-xl border border-line px-2 py-1.5 text-center">
              <span className="block text-[10px] font-semibold text-ink-3">{u.label}</span>
              <span className="block truncate text-[11px] font-bold text-ink">{u.kind === "rest" ? t("today.rest") : areaLabel(u.area)}</span>
            </li>
          ))}
        </ul>
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
          <span className="flex-1">{health.state === "needs-install" ? t("today.installHC") : <><b className="text-ink">{t("today.connectHC1")}</b>{t("today.connectHC2")}</>}</span>
        </button>
      )}
      {health.error && <p className="mt-1 text-center text-[11px] text-rose-300">{health.error}</p>}

      {/* daily goal */}
      <div className="mt-4 rounded-2xl border border-line bg-graphite p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold">{t("today.dailyGoal")}</span>
          <span className="flex items-center gap-2 text-xs font-semibold text-ink-2">
            <button aria-label={t("today.lowerGoal")} onClick={() => setGoalSafe(goal - 5)} className="flex h-6 w-6 items-center justify-center rounded-full bg-carbon active:scale-90"><Minus className="h-3 w-3" /></button>
            {todayMinutes}/{goal} min
            <button aria-label={t("today.raiseGoal")} onClick={() => setGoalSafe(goal + 5)} className="flex h-6 w-6 items-center justify-center rounded-full bg-carbon active:scale-90"><Plus className="h-3 w-3" /></button>
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-carbon"><div className={`h-full rounded-full transition-all duration-700 ${goalPct >= 100 ? "bg-emerald-400" : "bg-volt"}`} style={{ width: `${goalPct}%` }} /></div>
      </div>

      {/* weekly goal */}
      {me.uid && (
        <button onClick={() => { void tapFeedback(); void nextWeekGoal(); }} disabled={goalBusy} aria-label={t("today.weekAria", { done: weekDone, goal: weekGoal })}
          className="mt-2 flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-line bg-graphite px-3 py-2 text-left active:scale-[0.99] disabled:opacity-60">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold">{t("today.weekLine", { done: weekDone, goal: weekGoal })}</span>
            <span className={`block text-[11px] ${goalErr ? "text-rose-300" : "text-ink-3"}`}>{goalErr ? t("today.weekErr") : weekDone >= weekGoal ? t("today.weekReached") : t("today.weekTap")}</span>
          </span>
          <span className="flex shrink-0 gap-1.5" aria-hidden>
            {Array.from({ length: weekGoal }, (_, i) => <span key={i} className={`h-3 w-3 rounded-full ${i < weekDone ? "bg-emerald-400" : "border border-line"}`} />)}
          </span>
        </button>
      )}

      {/* quests */}
      {!me.uid ? (
        <button onClick={onSignIn} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line px-3 py-3 text-left active:scale-[0.99]">
          <LogIn className="h-4 w-4 text-volt" /><span className="text-xs text-ink-2"><b className="text-ink">{t("today.signInCta1")}</b>{t("today.signInCta2")}</span>
        </button>
      ) : quests ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-3">{t("today.dailyQuests")}</p>
          <ul className="space-y-3">{quests.daily.map(q => <QuestRow key={q.id} q={q} />)}</ul>
          <button onClick={() => setWeeklyOpen(o => !o)} className="mt-3 flex w-full items-center justify-between text-[11px] font-bold uppercase tracking-widest text-ink-3">
            {t("today.thisWeek")} <ChevronDown className={`h-4 w-4 transition ${weeklyOpen ? "rotate-180" : ""}`} />
          </button>
          {weeklyOpen && <ul className="mt-2 space-y-3">{quests.weekly.map(q => <QuestRow key={q.id} q={q} />)}</ul>}
        </div>
      ) : questsSlow ? (
        <button onClick={() => { void callFn("getQuests").catch(() => {}); setQuestTry(n => n + 1); }} className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-line px-3 text-xs font-bold text-ink-2 active:scale-[0.99]">
          {t("today.questsFail")}
        </button>
      ) : (
        <div className="mt-4 space-y-3" aria-hidden>{[0, 1, 2].map(i => <div key={i} className="h-8 animate-pulse rounded-xl bg-graphite" />)}</div>
      )}

      {me.uid && lr && (
        <p className="mt-3 rounded-xl bg-graphite px-3 py-2 text-center text-[11px] font-semibold text-ink-2">
          {t("today.lastWeek")}<b style={{ color: LEAGUE_COLORS[lr.tier] }}>{LEAGUE_NAMES[lr.tier]}</b>{t("today.leagueRank", { rank: lr.rank, size: lr.size })}
          {lr.outcome === "promoted" ? t("today.promoted", { tier: LEAGUE_NAMES[lr.newTier] }) : lr.outcome === "demoted" ? t("today.demoted", { tier: LEAGUE_NAMES[lr.newTier] }) : t("today.stayed")}
        </p>
      )}

      {(() => {
        const c = program.status === "ready" ? program.current : null;
        const p = c && !c.completedAt ? programById(c.programId) : null;
        let weekLine = "";
        if (p && c) {
          let left = c.done, w = 0;
          const per = sessionsPerWeek(p);
          while (w < per.length - 1 && left >= per[w]) { left -= per[w]; w++; }
          weekLine = t("today.programWeek", { w: w + 1, n: per.length });
        }
        return (
          <button onClick={() => goToScreen("programs")} className="mt-3 flex min-h-[48px] w-full items-center gap-3 rounded-2xl border border-line px-3 py-3 text-left active:scale-[0.99]">
            <ClipboardList className="h-4 w-4 text-volt" aria-hidden />
            <span className="min-w-0 flex-1 text-xs text-ink-2">
              {p ? <><b className="text-ink">{p.title}</b> · {weekLine}</> : <><b className="text-ink">{t("today.programsLine")}</b>{t("today.programsBody")}</>}
            </span>
            <span className="text-xs font-bold text-volt">{p ? t("today.continue") : t("today.browse")}</span>
          </button>
        );
      })()}

      {askReminder && (
        <button onClick={enableReminder} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-line px-3 py-3 text-left active:scale-[0.99]">
          <Bell className="h-4 w-4 text-volt" /><span className="min-w-0 flex-1 text-xs text-ink-2"><b className="text-ink">{t("today.reminder1")}</b>{t("today.reminder2")}</span><span className="text-xs font-bold text-volt">{t("today.turnOn")}</span>
        </button>
      )}
    </section>
  );
}
