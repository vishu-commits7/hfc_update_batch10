import { useMemo } from "react";
import { motion } from "motion/react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Flame,
  Minus,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import type { UserProfile, WorkoutLog } from "../types";
import {
  computeAnalytics,
  momentumHeadline,
  WEEKLY_GOAL,
  type Analytics,
} from "../lib/analytics";
import { Drawer, ProgressRing, StreakGraph, AnimatedNumber } from "./ui";
import { accent, type Accent } from "../design/accents";
import { staggerChild, staggerParent } from "../design/motion";
import { duration } from "../design/format";

export interface AnalyticsDrawerProps {
  open: boolean;
  onClose: () => void;
  logs: WorkoutLog[];
  profile: UserProfile;
}

/**
 * Weekly performance review.
 *
 * Opens over any screen (button in the top bar, or ⌘J / Ctrl+J) so a
 * user can check their numbers without losing their place — the
 * behaviour a dedicated "stats tab" cannot offer, and the reason this is
 * a drawer rather than a seventh tab.
 *
 * Content order is deliberate and answers, in sequence, the three
 * questions someone actually opens this to ask: *am I on track this
 * week*, *how does that compare to before*, and *what is that made of*.
 */
export function AnalyticsDrawer({
  open,
  onClose,
  logs,
  profile,
}: AnalyticsDrawerProps) {
  // Only recomputed when the drawer is actually open — there is no point
  // scanning the whole log history on every parent render while it is
  // closed, and this component lives at the app root.
  const a = useMemo<Analytics | null>(
    () => (open ? computeAnalytics(logs, profile) : null),
    [open, logs, profile],
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Performance"
      subtitle={a ? momentumHeadline(a) : undefined}
    >
      {a && (
        <motion.div
          variants={staggerParent}
          initial="initial"
          animate="animate"
          className="space-y-5 pb-4"
        >
          {a.totalSessions === 0 ? (
            <EmptyState />
          ) : (
            <>
              <WeeklyGoal a={a} />
              <MomentumRow a={a} />
              <TrendBlock a={a} />
              <SplitBlock a={a} />
              <HabitsBlock a={a} />
            </>
          )}
        </motion.div>
      )}
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <motion.div
      variants={staggerChild}
      className="surface rounded-xl2 px-5 py-10 text-center"
    >
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--cyan-wash)] text-cyan-glow">
        <Activity className="h-5 w-5" />
      </span>
      <h3 className="font-display mt-4 text-base font-extrabold text-ink">
        Nothing to analyse yet
      </h3>
      <p className="mx-auto mt-2 max-w-[34ch] text-xs leading-relaxed text-ink-3">
        Finish and log a session and this fills with your real numbers.
        Nothing here is sample data.
      </p>
    </motion.div>
  );
}

function WeeklyGoal({ a }: { a: Analytics }) {
  const done = a.thisWeek.sessions;
  const hit = done >= WEEKLY_GOAL;

  return (
    <motion.section
      variants={staggerChild}
      className="aurora-card grain relative overflow-hidden rounded-xl2 p-5"
      style={{ ["--glow" as string]: hit ? "var(--emerald)" : "var(--cyan)" }}
    >
      {/* Floating ambient orb — makes the ring section feel lit from inside */}
      <div
        aria-hidden
        className="ambient-orb pointer-events-none"
        style={{
          width: 180,
          height: 180,
          top: -60,
          right: -30,
          background: hit
            ? "radial-gradient(circle, var(--neon-emerald-near) 0%, var(--neon-emerald-far) 60%, transparent 100%)"
            : "radial-gradient(circle, var(--neon-cyan-near) 0%, var(--neon-cyan-far) 60%, transparent 100%)",
        }}
      />

      <div className="relative z-10 flex items-center gap-5">
        <ProgressRing
          value={a.weeklyGoalProgress}
          size={92}
          tone={hit ? "emerald" : "cyan"}
          glow
          label={`${done} of ${WEEKLY_GOAL} sessions completed this week`}
        >
          <span className="font-numeric text-[22px] font-extrabold leading-none text-ink">
            {done}
          </span>
          <span className="mt-0.5 text-[9px] font-bold tracking-widest text-ink-4">
            /{WEEKLY_GOAL}
          </span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <p className="eyebrow">This week</p>
          <h3 className="font-display mt-1 text-lg font-extrabold leading-tight text-ink">
            {hit ? "Goal cleared ✓" : `${WEEKLY_GOAL - done} to go`}
          </h3>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <Metric
              icon={Clock3}
              value={duration(a.thisWeek.minutes)}
              label="trained"
            />
            <Metric
              icon={Flame}
              value={`${a.thisWeek.calories.toLocaleString()}`}
              label="kcal"
              tone="ember"
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-5 border-t border-line pt-4">
        <StreakGraph
          tone={hit ? "emerald" : "cyan"}
          height={64}
          caption="Sessions completed on each day of the current week"
          data={a.week.map((d) => ({
            label: d.initial,
            value: d.sessions,
            detail: d.long,
            current: d.isToday,
          }))}
        />
      </div>
    </motion.section>
  );
}

function MomentumRow({ a }: { a: Analytics }) {
  const cards: {
    label: string;
    value: number;
    unit?: string;
    tone: Accent;
    icon: typeof Trophy;
  }[] = [
    {
      label: "Current streak",
      value: a.currentStreak,
      unit: "d",
      tone: "emerald",
      icon: Zap,
    },
    {
      label: "Best streak",
      value: a.bestStreak,
      unit: "d",
      tone: "gold",
      icon: Trophy,
    },
    {
      label: "Avg session",
      value: a.avgSessionMinutes,
      unit: "m",
      tone: "cyan",
      icon: Clock3,
    },
  ];

  return (
    <motion.section variants={staggerChild} className="grid grid-cols-3 gap-2.5">
      {cards.map((c) => {
        const tone = accent(c.tone);
        return (
          <div
            key={c.label}
            className="aurora-card relative overflow-hidden rounded-lg2 p-3"
            style={{ ["--glow" as string]: tone.color }}
          >
            {/* Small accent orb per card */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full"
              style={{
                background: `radial-gradient(circle, ${tone.wash} 0%, transparent 70%)`,
                filter: "blur(12px)",
              }}
            />
            <c.icon
              className="relative z-10 h-3.5 w-3.5"
              style={{ color: tone.color }}
              strokeWidth={2.6}
            />
            <p className="font-numeric relative z-10 mt-2 text-xl font-extrabold leading-none text-ink">
              <AnimatedNumber
                value={c.value}
                unit={c.unit}
                unitClassName="text-[10px] font-bold text-ink-3"
              />
            </p>
            <p className="relative z-10 mt-1 truncate text-[10px] font-semibold text-ink-4">
              {c.label}
            </p>
          </div>
        );
      })}
    </motion.section>
  );
}

function TrendBlock({ a }: { a: Analytics }) {
  const up = a.momentum > 0;
  const flat = a.momentum === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  // A decline is not framed as a failure — it is information. Crimson is
  // reserved for destructive actions, so a down week gets gold, not red.
  const tone: Accent = flat ? "neutral" : up ? "emerald" : "gold";
  const t = accent(tone);

  return (
    <motion.section variants={staggerChild} className="surface rounded-xl2 p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">12-week trend</p>
          <h3 className="font-display mt-1 text-base font-extrabold text-ink">
            Sessions per week
          </h3>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ background: t.wash, color: t.color }}
        >
          <Icon className="h-3 w-3" strokeWidth={3} />
          {flat ? "Level" : `${Math.abs(a.momentum)}%`}
        </span>
      </header>

      <div className="mt-5">
        <StreakGraph
          tone="cyan"
          height={80}
          caption="Sessions completed in each of the last twelve weeks"
          data={a.trend.map((w, i) => ({
            label: i % 2 === 0 ? w.label : "",
            value: w.sessions,
            detail: `Week of ${w.label}`,
            current: i === a.trend.length - 1,
          }))}
        />
      </div>
    </motion.section>
  );
}

function SplitBlock({ a }: { a: Analytics }) {
  if (!a.split.length) return null;
  const TONES: Accent[] = ["cyan", "emerald", "gold", "ember", "neutral"];

  return (
    <motion.section variants={staggerChild} className="aurora-card rounded-xl2 p-5">
      <p className="eyebrow">Training split</p>
      <h3 className="font-display mt-1 text-base font-extrabold text-ink">
        Where the work went
      </h3>

      <ul className="mt-4 space-y-3">
        {a.split.map((s, i) => {
          const t = accent(TONES[i % TONES.length]);
          return (
            <li key={s.area}>
              <div className="flex items-baseline justify-between gap-3 text-[11px]">
                <span className="truncate font-bold text-ink-2">{s.area}</span>
                <span
                  className="font-numeric shrink-0 font-bold text-[11px]"
                  style={{ color: t.color }}
                >
                  {Math.round(s.share * 100)}%
                </span>
              </div>
              {/* 2px tall progress bar with glow on the fill end */}
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--line)]">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${t.wash} 0%, ${t.color} 100%)`,
                    boxShadow: `0 0 6px 0 ${t.color}`,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${s.share * 100}%` }}
                  transition={{
                    type: "spring",
                    stiffness: 140,
                    damping: 22,
                    delay: 0.06 * i,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}

function HabitsBlock({ a }: { a: Analytics }) {
  const peak =
    a.peakHour === null
      ? null
      : new Date(2000, 0, 1, a.peakHour).toLocaleTimeString(undefined, {
          hour: "numeric",
        });

  const rows = [
    peak && {
      icon: Clock3,
      label: "You train most often around",
      value: peak,
      tone: "cyan" as Accent,
    },
    a.dominantFeeling && {
      icon: Sparkles,
      label: "You most often finish feeling",
      value: a.dominantFeeling,
      tone: "emerald" as Accent,
    },
    {
      icon: Target,
      label: "Sessions logged all time",
      value: String(a.totalSessions),
      tone: "gold" as Accent,
    },
  ].filter(Boolean) as {
    icon: typeof Clock3;
    label: string;
    value: string;
    tone: Accent;
  }[];

  return (
    <motion.section variants={staggerChild} className="surface rounded-xl2 p-5">
      <p className="eyebrow">Patterns</p>
      <ul className="mt-3 divide-y divide-[var(--line-faint)]">
        {rows.map((r) => {
          const t = accent(r.tone);
          return (
            <li key={r.label} className="flex items-center gap-3 py-3">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md2"
                style={{ background: t.wash, color: t.color }}
              >
                <r.icon className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <span className="min-w-0 flex-1 text-xs text-ink-3">
                {r.label}
              </span>
              <span
                className="shrink-0 text-xs font-bold capitalize"
                style={{ color: t.color }}
              >
                {r.value}
              </span>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  tone = "neutral",
}: {
  icon: typeof Clock3;
  value: string;
  label: string;
  tone?: Accent;
}) {
  const t = accent(tone);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3 w-3" style={{ color: t.color }} strokeWidth={2.6} />
      <span className="font-numeric font-bold text-ink">{value}</span>
      <span className="text-ink-4">{label}</span>
    </span>
  );
}

export default AnalyticsDrawer;
