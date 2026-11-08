import { Award, Crown, Flame, Footprints, HeartPulse, Dumbbell, Lock, Wind } from "lucide-react";
import type { UserProfile, WorkoutLog } from "../types";
import { ACHIEVEMENTS } from "../lib/achievements";
import {
  RANKS,
  TIER_COLORS,
  TIER_NAMES,
  computeDisciplines,
  computeRank,
  computeXp,
  type DisciplineId,
} from "../lib/ranks";
import { AchievementBadgeIcon } from "./ui/AchievementBadgeIcon";

const DISCIPLINE_ICON: Record<DisciplineId, React.ElementType> = {
  upper: Dumbbell,
  lower: Footprints,
  core: Flame,
  cardio: HeartPulse,
  mobility: Wind,
};

const TIER_BADGE_COLOR: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#aab4c3",
  gold: "#f5b301",
  platinum: "#22b8cf",
};

/**
 * Trophy Room: a rank and level up top, discipline trophies with three
 * tiers each (what kind of training you have actually done), then the
 * flat milestone badges. Colours come from design tokens so it reads in
 * both light and dark.
 */
export default function TrophyRoom({
  profile,
  logs,
  unlocked,
}: {
  profile: UserProfile;
  logs: WorkoutLog[];
  unlocked: Set<string>;
}) {
  const xp = computeXp(profile, logs.length, unlocked.size);
  const state = computeRank(xp);
  const disciplines = computeDisciplines(logs);

  return (
    <div className="space-y-5">
      {/* ---------- Rank card ---------- */}
      <section
        className="relative overflow-hidden rounded-3xl border border-line bg-carbon p-5"
        aria-label="Rank and level"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25"
          style={{ background: `radial-gradient(closest-side, ${state.rank.color}, transparent)` }}
        />
        <div className="relative flex items-center gap-4">
          <div
            className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-2xl border-2"
            style={{ borderColor: state.rank.color, background: `${state.rank.color}1f`, color: state.rank.color }}
          >
            <Crown className="h-8 w-8" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">Current rank</p>
            <h3 className="text-2xl font-black tracking-tight text-ink">{state.rank.name}</h3>
            <p className="text-xs font-semibold text-ink-3">
              Level {state.level} · {state.xp.toLocaleString()} XP
            </p>
          </div>
        </div>

        <div className="relative mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-graphite">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.max(4, state.progress * 100)}%`, background: state.rank.color }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-semibold text-ink-3">
            <span>{state.rank.name}</span>
            <span>
              {state.next
                ? `${state.xpToNext.toLocaleString()} XP to ${state.next.name}`
                : "Max rank reached"}
            </span>
          </div>
        </div>

        <div className="relative mt-4 flex gap-1.5 overflow-x-auto no-scrollbar">
          {RANKS.map((r) => {
            const reached = xp >= r.minXp;
            return (
              <span
                key={r.id}
                className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                style={
                  reached
                    ? { borderColor: r.color, color: r.color, background: `${r.color}14` }
                    : { borderColor: "var(--line)", color: "var(--ink-4)" }
                }
              >
                {r.name}
              </span>
            );
          })}
        </div>
        <p className="relative mt-3 text-[11px] leading-relaxed text-ink-3">
          Earn XP from every session, minute trained, streak day and badge.
        </p>
      </section>

      {/* ---------- Discipline trophies ---------- */}
      <section aria-label="Discipline trophies" className="space-y-2.5">
        <div className="flex items-baseline justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-3">Discipline trophies</h3>
          <span className="text-[11px] font-semibold text-ink-3">Bronze 3 · Silver 10 · Gold 25 sessions</span>
        </div>

        {disciplines.map((d) => {
          const Icon = DISCIPLINE_ICON[d.discipline.id];
          const color = d.tierReached >= 0 ? TIER_COLORS[d.tierReached] : "var(--ink-4)";
          return (
            <div key={d.discipline.id} className="rounded-2xl border border-line bg-carbon p-4">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2"
                  style={{
                    borderColor: color,
                    color,
                    background: d.tierReached >= 0 ? `${TIER_COLORS[d.tierReached]}1a` : "transparent",
                  }}
                >
                  {d.tierReached >= 0 ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {d.tierReached >= 0 ? d.discipline.tiers[d.tierReached] : d.discipline.label}
                  </p>
                  <p className="text-xs text-ink-3">
                    {d.tierReached >= 0 ? `${TIER_NAMES[d.tierReached]} · ` : ""}
                    {d.sessions} {d.sessions === 1 ? "session" : "sessions"}
                    {d.nextTarget ? ` · next at ${d.nextTarget}` : " · maxed"}
                  </p>
                </div>
                <div className="flex gap-1" aria-hidden>
                  {TIER_COLORS.map((c, i) => (
                    <span
                      key={c}
                      className="h-3 w-3 rounded-full border"
                      style={
                        i <= d.tierReached
                          ? { background: c, borderColor: c }
                          : { borderColor: "var(--line-strong)" }
                      }
                    />
                  ))}
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-graphite">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(d.sessions > 0 ? 6 : 0, d.progress * 100)}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </section>

      {/* ---------- Milestone badges ---------- */}
      <section aria-label="Milestone badges" className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-3">Milestone badges</h3>
          <span className="text-xs font-bold tabular-nums text-ink">
            {unlocked.size} / {ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const isUnlocked = unlocked.has(a.id);
            const tierColor = TIER_BADGE_COLOR[a.tier ?? "bronze"] ?? "#cd7f32";
            return (
              <div
                key={a.id}
                className={`rounded-2xl border p-4 ${isUnlocked ? "border-line-strong bg-carbon" : "border-line bg-carbon opacity-55"}`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-xl"
                    style={{ background: isUnlocked ? `${tierColor}22` : "var(--graphite)" }}
                  >
                    <AchievementBadgeIcon name={a.icon} isUnlocked={isUnlocked} className="h-5 w-5" />
                  </div>
                  <Award className="h-4 w-4" style={{ color: isUnlocked ? tierColor : "var(--ink-4)" }} />
                </div>
                <h4 className="mt-2.5 truncate text-[13px] font-bold text-ink">{a.title}</h4>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-3">{a.description}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
