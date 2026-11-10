import { track } from "../lib/track";
import { EV } from "../lib/analyticsEvents";
import OneTimeHint from "./OneTimeHint";
import { useMemo, useState } from "react";
import { Flame, Loader2, Swords, Trophy, Users } from "lucide-react";
import Avatar from "./ui/Avatar";
import { EmptyState, EmptyAction, ErrorState, SkeletonRows } from "./ui/StateViews";
import { useFollowEdges } from "../lib/useSocial";
import { rankFor } from "../lib/progress";
import {
  createChallenge, respondChallenge, useChallenges, useFriendsBoard, type Challenge,
} from "../lib/phase3";
import { friendlySocialError } from "../lib/social";
import { goToScreen } from "../lib/navEvents";
import { tapFeedback } from "../lib/haptics";
import InviteFriend from "./InviteFriend";

const MEDAL = ["#F5C451", "#C0C6D0", "#D08B5B"];

function timeLeft(ms: number) {
  const left = Math.max(0, ms - Date.now());
  const d = Math.floor(left / 86_400_000), h = Math.floor((left % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

function ChallengeCard({ c, meUid, onAnswer, busy }: { c: Challenge; meUid: string; onAnswer: (id: string, accept: boolean) => void; busy: boolean }) {
  const oppUid = c.creatorUid === meUid ? c.opponentUid : c.creatorUid;
  const oppName = c.names[oppUid] || "Friend";
  const mine = c.counts[meUid] || 0, theirs = c.counts[oppUid] || 0;
  const incoming = c.status === "pending" && c.opponentUid === meUid;
  return (
    <li className="rounded-xl border border-line bg-graphite p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold">You vs {oppName}</span>
        <span className="text-ink-3">{c.days}-day · most workouts</span>
      </div>
      {c.status === "pending" ? (
        incoming ? (
          <div className="mt-2 flex items-center gap-2">
            <p className="flex-1 text-xs text-ink-2">{oppName} challenged you.</p>
            <button disabled={busy} onClick={() => onAnswer(c.id, false)} className="rounded-full border border-line px-3.5 py-2 text-xs font-bold text-ink-2 active:scale-95 disabled:opacity-50">Decline</button>
            <button disabled={busy} onClick={() => onAnswer(c.id, true)} className="rounded-full bg-volt px-3.5 py-2 text-xs font-bold text-void active:scale-95 disabled:opacity-50">Accept</button>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <p className="flex-1 text-xs text-ink-3">Waiting for {oppName} to accept…</p>
            <button disabled={busy} onClick={() => onAnswer(c.id, false)} className="rounded-full border border-line px-3.5 py-2 text-xs font-bold text-ink-2 active:scale-95 disabled:opacity-50">Withdraw</button>
          </div>
        )
      ) : (
        <>
          <div className="mt-2 flex items-center justify-center gap-4">
            <span className="text-center"><span className="block text-3xl font-black tabular-nums text-volt">{mine}</span><span className="text-[11px] font-semibold uppercase text-ink-3">You</span></span>
            <span className="text-xs font-bold text-ink-3">-</span>
            <span className="text-center"><span className="block text-3xl font-black tabular-nums">{theirs}</span><span className="max-w-[5rem] truncate text-[11px] font-semibold uppercase text-ink-3">{oppName}</span></span>
          </div>
          <p className="mt-1 text-center text-[11px] text-ink-3">
            {c.status === "active" ? timeLeft(c.endAt)
              : c.winnerUid === meUid ? "You won (+150 XP)" : c.winnerUid ? "You lost (+40 XP)" : "Draw (+75 XP)"}
          </p>
        </>
      )}
    </li>
  );
}

export default function FriendsView({ meUid }: { meUid: string }) {
  const edges = useFollowEdges();
  const friendUids = useMemo(() => {
    const s = new Set<string>();
    edges.outgoing.forEach((st, u) => { if (st === "accepted") s.add(u); });
    edges.incoming.forEach((st, u) => { if (st === "accepted") s.add(u); });
    return [...s].sort();
  }, [edges]);
  const { rows, failed, retry } = useFriendsBoard(meUid, friendUids);
  const challenges = useChallenges(meUid);
  const [by, setBy] = useState<"xp" | "weekXp">("weekXp");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  const sorted = useMemo(() => (rows ?? []).slice().sort((a, b) => b[by] - a[by]), [rows, by]);
  const busyWith = useMemo(() => new Set((challenges ?? []).filter(c => c.status === "pending" || c.status === "active").map(c => (c.creatorUid === meUid ? c.opponentUid : c.creatorUid))), [challenges, meUid]);

  const answer = async (id: string, accept: boolean) => {
    setBusy(true); setMsg(null);
    try { void tapFeedback(); await respondChallenge(id, accept); } catch (e) { setMsg(friendlySocialError(e)); } finally { setBusy(false); }
  };
  const send = async (uid: string) => {
    setBusy(true); setMsg(null);
    try { void tapFeedback(); await createChallenge(uid, days); track(EV.challengeSent, { days }); setPicking(null); setMsg("Challenge sent."); } catch (e) { setMsg(friendlySocialError(e)); } finally { setBusy(false); }
  };

  if (failed) return <ErrorState message="Couldn't load your friends." onRetry={retry} />;
  if (rows === null) return <SkeletonRows rows={5} />;

  return (
    <div className="space-y-4">
      <InviteFriend />
      <OneTimeHint id="friends">Tap the swords next to a friend to start a 3 to 7 day challenge. Most workouts wins.</OneTimeHint>
      {(challenges ?? []).length > 0 && (
        <section className="rounded-2xl border border-line bg-carbon p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold"><Swords className="h-4 w-4 text-volt" /> Challenges</h2>
          <ul className="mt-2 space-y-2">
            {(challenges ?? []).slice(0, 8).map(c => <ChallengeCard key={c.id} c={c} meUid={meUid} onAnswer={answer} busy={busy} />)}
          </ul>
        </section>
      )}

      {friendUids.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No friends yet" body="Follow athletes from Reels > Search. Once a follow is accepted, they show up here and you can challenge them." action={<EmptyAction label="Find athletes" onClick={() => goToScreen("reels")} />} />
      ) : (
        <section className="rounded-2xl border border-line bg-carbon p-3">
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            {([["weekXp", "This week"], ["xp", "All-time"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => { void tapFeedback(); setBy(k); }} className={`rounded-xl py-2 text-xs font-semibold ${by === k ? "bg-graphite text-volt ring-1 ring-volt/40" : "border border-line text-ink-2"}`}>{l}</button>
            ))}
          </div>
          <ul>
            {sorted.map((r, i) => {
              const rk = rankFor(r.xp).rank;
              return (
                <li key={r.uid} className={`rounded-xl px-2 py-2 ${r.isMe ? "bg-volt/10" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm font-bold tabular-nums" style={i < 3 ? { color: MEDAL[i] } : undefined}>{i < 3 ? <Trophy className="mx-auto h-4 w-4" /> : i + 1}</span>
                    <Avatar src={r.avatarUrl} name={r.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{r.isMe ? `${r.name} (you)` : r.name}</span>
                      <span className="block truncate text-xs" style={{ color: rk.color }}>{rk.name} · Lv {r.level}{r.streakDays > 1 ? <> · <Flame className="inline h-3 w-3" />{r.streakDays}d</> : null}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold tabular-nums">{r[by].toLocaleString()} <span className="text-[11px] font-medium text-ink-3">XP</span></span>
                    </span>
                    {!r.isMe && (
                      <button
                        disabled={busy || busyWith.has(r.uid)}
                        onClick={() => { void tapFeedback(); setPicking(p => (p === r.uid ? null : r.uid)); }}
                        aria-label={`Challenge ${r.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-graphite text-volt active:scale-90 disabled:opacity-30"
                      ><Swords className="h-4 w-4" /></button>
                    )}
                  </div>
                  {picking === r.uid && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl bg-graphite p-2">
                      <span className="text-xs text-ink-2">Most workouts in</span>
                      {[3, 5, 7].map(n => (
                        <button key={n} onClick={() => setDays(n)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${days === n ? "bg-volt text-void" : "border border-line text-ink-2"}`}>{n}d</button>
                      ))}
                      <button disabled={busy} onClick={() => void send(r.uid)} className="ml-auto flex items-center gap-1 rounded-full bg-volt px-3.5 py-1.5 text-xs font-bold text-void active:scale-95 disabled:opacity-50">
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Send
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {msg && <p className="rounded-xl bg-graphite px-3 py-2 text-center text-xs text-ink-2">{msg}</p>}
    </div>
  );
}
