import { useCallback, useEffect, useState } from "react";
import { Loader2, Crown, Clock, ChevronUp, ChevronDown, Dumbbell, Swords } from "lucide-react";
import Avatar from "../../shared/ui/Avatar";
import { ErrorState, SkeletonRows } from "../../shared/ui/StateViews";
import {
  joinLeague, subscribeLeague, msUntilLeagueReset, LEAGUE_NAMES, LEAGUE_COLORS, type LeagueRow,
} from "../progress/progress";
import { leagueStatus, leagueZones } from "./league";
import { goToScreen } from "../../core/navEvents";
import { tapFeedback } from "../../core/haptics";
import { readCache, writeCache } from "../../core/callCache";
import { currentWeekId } from "./phase3";

function resetText(ms: number) {
  const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

/** This week's league group: 30 athletes at your tier, ranked by XP earned since Monday. */
export default function LeagueView({ meUid, onOpenProfile, onPlayArena }: { meUid: string; onOpenProfile?: (uid: string) => void; onPlayArena?: () => void }) {
  // this week's group is remembered, so the table opens at once; the server call below confirms it
  const cacheKey = `league:${meUid}:${currentWeekId()}`;
  const [group, setGroup] = useState<{ group: string; tier: number } | null>(() => readCache(cacheKey, 8 * 86_400_000));
  const [rows, setRows] = useState<LeagueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tryN, setTryN] = useState(0);
  const [left, setLeft] = useState(msUntilLeagueReset());

  useEffect(() => { const t = setInterval(() => setLeft(msUntilLeagueReset()), 60_000); return () => clearInterval(t); }, []);

  useEffect(() => {
    let alive = true;
    setError(null);
    const had = readCache<{ group: string; tier: number }>(cacheKey, 8 * 86_400_000);
    if (!had) { setGroup(null); setRows(null); }
    joinLeague().then(g => { writeCache(cacheKey, g); if (alive) setGroup(prev => (prev && prev.group === g.group && prev.tier === g.tier ? prev : g)); }).catch((e: any) => { if (alive && !had) setError(e?.message?.replace(/^.*?:\s*/, "") || "Couldn't join the league."); });
    return () => { alive = false; };
  }, [tryN]);

  useEffect(() => {
    if (!group) return;
    return subscribeLeague(group.group, setRows, () => setError("Couldn't load the league table."));
  }, [group]);

  const retry = useCallback(() => setTryN(n => n + 1), []);
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!group || !rows) return <SkeletonRows rows={6} />;

  const tier = group.tier, color = LEAGUE_COLORS[tier];
  const myIdx = rows.findIndex(r => r.uid === meUid);
  const size = rows.length;
  const zones = leagueZones(size);
  const maxTier = LEAGUE_NAMES.length - 1;
  const status = leagueStatus(rows.map(r => r.weekXp), myIdx, tier, maxTier);
  const lastDay = left < 86_400_000;
  const nextUp = tier < maxTier ? LEAGUE_NAMES[tier + 1] : null;
  const statusText = !status ? "Earn XP this week to get on the table."
    : status.zone === "promote" ? `You're in the top ${zones.promote}. ${status.lead > 0 ? `${status.lead.toLocaleString()} XP ahead of #${zones.promote + 1}.` : "Keep earning to hold your place."}`
    : status.zone === "demote" ? `Demotion zone. ${status.need.toLocaleString()} XP gets you safe.`
    : status.zone === "top" ? "Top league. Hold your place out of the bottom."
    : `${status.need.toLocaleString()} XP to reach the top ${zones.promote}${nextUp ? ` and move up to ${nextUp}` : ""}.`;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-line bg-carbon p-4 text-center" style={{ boxShadow: `0 0 40px ${color}22` }}>
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-3">This week</p>
        <h2 className="mt-1 text-2xl font-black" style={{ color }}>{LEAGUE_NAMES[tier]} League</h2>
        <div className="mt-2 flex justify-center gap-1.5">
          {LEAGUE_NAMES.map((n, i) => <span key={n} className="h-1.5 w-8 rounded-full" style={{ background: i <= tier ? LEAGUE_COLORS[i] : "var(--graphite)" }} />)}
        </div>
        <p className={`mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold ${lastDay ? "text-amber-300" : "text-ink-2"}`}><Clock className="h-3.5 w-3.5" /> {lastDay ? "Last day: " : "Ends in "}{resetText(left)} {lastDay ? "left" : ""}</p>
        <p className="mt-1 text-[11px] text-ink-3">Top {zones.promote} move up{tier > 0 && zones.demote > 0 ? ` · bottom ${zones.demote} move down` : ""} · Monday 00:00 IST</p>
      </div>

      <div className={`rounded-2xl border p-4 ${status?.zone === "demote" ? "border-rose-400/40 bg-rose-500/5" : status?.zone === "promote" ? "border-emerald-400/40 bg-emerald-500/5" : "border-line bg-carbon"}`}>
        {myIdx >= 0 && <p className="text-[11px] font-bold uppercase tracking-widest text-ink-3">You are #{myIdx + 1} of {size} · {rows[myIdx].weekXp.toLocaleString()} XP this week</p>}
        <p className="mt-1 text-sm font-bold">{statusText}</p>
        <button onClick={() => { void tapFeedback(); goToScreen("dashboard"); }} className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-volt text-sm font-bold text-void active:scale-[0.98]">
          <Dumbbell className="h-4 w-4" /> Start a workout
        </button>
        {onPlayArena && (
          <button onClick={() => { void tapFeedback(); onPlayArena(); }} className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-graphite text-xs font-bold text-ink-2 active:scale-[0.98]">
            <Swords className="h-3.5 w-3.5" /> Or play an Arena match for XP
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-carbon p-6 text-center text-xs text-ink-3"><Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />Getting your group ready…</p>
      ) : (
        <ul className="rounded-2xl border border-line bg-carbon p-2">
          {rows.map((r, i) => {
            const promote = tier < maxTier && i < zones.promote && r.weekXp > 0;
            const demote = tier > 0 && zones.demote > 0 && i >= size - zones.demote;
            return (
              <li key={r.uid}>
                {tier < maxTier && i === zones.promote && <div className="my-1 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-widest text-emerald-400"><span className="h-px flex-1 bg-emerald-400/30" /><ChevronUp className="h-3 w-3" /> promotion line (above)<span className="h-px flex-1 bg-emerald-400/30" /></div>}
                {demote && i === size - zones.demote && <div className="my-1 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-widest text-rose-400"><span className="h-px flex-1 bg-rose-400/30" /><ChevronDown className="h-3 w-3" /> demotion zone<span className="h-px flex-1 bg-rose-400/30" /></div>}
                <button onClick={() => onOpenProfile?.(r.uid)} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left ${r.uid === meUid ? "bg-volt/10" : ""}`}>
                  <span className={`w-6 text-center text-sm font-bold tabular-nums ${promote ? "text-emerald-400" : "text-ink-3"}`}>{i + 1}</span>
                  <Avatar src={r.avatarUrl} name={r.name} size={38} />
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-1 truncate text-sm font-bold">{i === 0 && <Crown className="h-3.5 w-3.5 shrink-0" style={{ color }} />}{r.uid === meUid ? `${r.name} (you)` : r.name}</span><span className="block text-[11px] text-ink-3">Level {r.level}</span></span>
                  <span className="text-sm font-bold tabular-nums">{r.weekXp.toLocaleString()} <span className="text-[11px] font-medium text-ink-3">XP</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-2 text-center text-[11px] text-ink-3">Earn XP from workouts, Arena matches, quests and the daily challenge. Your group is players in your league with a similar Arena rating.</p>
    </div>
  );
}
