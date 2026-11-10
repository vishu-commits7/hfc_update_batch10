import { useMemo, useState } from "react";
import { Flame, Swords, Dumbbell, Trophy, Zap } from "lucide-react";
import TrophyIcon from "./TrophyIcon";
import { TROPHY_CATALOG, rankFor, useProgress } from "../lib/progress";

const clock = (ms: number) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");

/** Level, rank, trophies and arena history for any user (server-owned numbers). */
export default function ProgressSummary({ uid }: { uid: string }) {
  const p = useProgress(uid);
  const r = rankFor(p.xp);
  const [showAll, setShowAll] = useState(false);
  const earned = useMemo(() => TROPHY_CATALOG.filter(t => p.trophies.has(t.id)), [p.trophies]);
  const locked = useMemo(() => TROPHY_CATALOG.filter(t => !p.trophies.has(t.id)), [p.trophies]);
  const shown = showAll ? [...earned, ...locked] : earned.length ? earned : locked.slice(0, 6);
  const winRate = p.arenaMatches ? Math.round((p.arenaWins / p.arenaMatches) * 100) : 0;

  return (
    <div className="mx-auto mt-6 w-full max-w-sm space-y-4 text-left">
      {/* level card */}
      <div className="rounded-2xl border border-line bg-carbon p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl font-black text-void"
            style={{ background: `linear-gradient(135deg, ${r.rank.color}, ${r.rank.color}99)` }}
          >
            {r.level}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-3">Level {r.level}</p>
            <p className="text-lg font-black" style={{ color: r.rank.color }}>{r.rank.name}</p>
            <p className="text-xs text-ink-2">{p.xp.toLocaleString()} XP · {p.rating} RP{r.next ? ` · ${r.xpToNext.toLocaleString()} to ${r.next.name}` : " · max rank"}</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-graphite">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round(r.progress * 100)}%`, background: r.rank.color }} />
        </div>
      </div>

      {/* stat tiles */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Dumbbell, k: "Workouts", v: p.totalWorkouts },
          { icon: Flame, k: "Streak", v: p.streakDays },
          { icon: Swords, k: "Arena wins", v: p.arenaWins },
          { icon: Zap, k: "Win rate", v: `${winRate}%` },
        ].map(({ icon: I, k, v }) => (
          <div key={k} className="rounded-xl border border-line bg-carbon px-1 py-3 text-center">
            <I className="mx-auto h-4 w-4 text-ink-2" />
            <p className="mt-1 text-lg font-black tabular-nums">{v}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{k}</p>
          </div>
        ))}
      </div>

      {/* trophies */}
      <div className="rounded-2xl border border-line bg-carbon p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-bold"><Trophy className="h-4 w-4 text-volt" /> Trophies</p>
          <button onClick={() => setShowAll(s => !s)} className="text-xs font-semibold text-volt">
            {earned.length}/{TROPHY_CATALOG.length} · {showAll ? "Hide locked" : "View all"}
          </button>
        </div>
        {earned.length === 0 && !showAll && <p className="mb-3 text-xs text-ink-2">No trophies yet. Finish a workout to earn your first.</p>}
        <div className="grid grid-cols-3 gap-3">
          {shown.map(t => {
            const isLocked = !p.trophies.has(t.id);
            return (
              <div key={t.id} className="flex flex-col items-center text-center" title={t.desc}>
                <TrophyIcon def={t} locked={isLocked} />
                <p className={`mt-1.5 text-[11px] font-bold leading-tight ${isLocked ? "text-ink-3" : "text-ink"}`}>{t.title}</p>
                <p className="text-[11px] leading-tight text-ink-3">{isLocked ? t.desc : clock(p.trophies.get(t.id) || 0)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* arena history */}
      <div className="rounded-2xl border border-line bg-carbon p-4">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Swords className="h-4 w-4 text-volt" /> Arena history</p>
        {p.loading ? (
          <div className="space-y-2" aria-hidden>{[0, 1].map(i => <div key={i} className="h-11 animate-pulse rounded-xl bg-graphite" />)}</div>
        ) : p.matches.length === 0 ? (
          <p className="text-xs text-ink-2">No matches yet. Challenge someone in the Arena.</p>
        ) : (
          <ul className="space-y-2">
            {p.matches.map(m => (
              <li key={m.code} className="flex items-center gap-3 rounded-xl bg-graphite px-3 py-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${m.result === "win" ? "bg-emerald-500/20 text-emerald-400" : m.result === "draw" ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-400"}`}>
                  {m.result === "win" ? "W" : m.result === "draw" ? "D" : "L"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">vs {m.oppName}</span>
                  <span className="block truncate text-[11px] text-ink-2">{m.exercise} · {m.myReps}–{m.oppReps}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-bold text-volt">+{m.xpGained} XP</span>
                  <span className="block text-[11px] text-ink-3">{clock(m.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
