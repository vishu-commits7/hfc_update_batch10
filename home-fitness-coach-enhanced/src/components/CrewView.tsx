import OneTimeHint from "./OneTimeHint";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Check, Crown, Loader2, LogOut, Send, Share2, Target, UserMinus, Users } from "lucide-react";
import Avatar from "./ui/Avatar";
import { ErrorState, SkeletonRows } from "./ui/StateViews";
import { shareContent } from "../lib/nativeBridge";
import {
  crewCreate, crewJoin, crewKick, crewLeave, crewSend, crewSetGoal, currentWeekId, useCrew, useCrewId,
} from "../lib/phase3";
import { friendlySocialError } from "../lib/social";
import { tapFeedback } from "../lib/haptics";

export default function CrewView({ meUid, meName }: { meUid: string; meName: string }) {
  const { id: crewId, failed: idFailed, retry: retryId } = useCrewId(meUid);
  const { crew, members, msgs, failed: crewFailed, sideFailed, retry: retryCrew } = useCrew(crewId);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [goalEdit, setGoalEdit] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const week = currentWeekId();
  const done = crew && crew.weekId === week ? crew.weekWorkouts : 0;
  const pct = crew ? Math.min(100, Math.round((done / Math.max(1, crew.weeklyGoal)) * 100)) : 0;
  const isOwner = !!crew && crew.ownerUid === meUid;
  const board = useMemo(() => members.map(m => ({ ...m, n: m.weekId === week ? m.weekWorkouts : 0 })).sort((a, b) => b.n - a.n), [members, week]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { void tapFeedback(); await fn(); } catch (e) { setErr(friendlySocialError(e)); } finally { setBusy(false); }
  };

  if (idFailed || crewFailed) return <ErrorState message="Couldn't load your crew." onRetry={() => { retryId(); retryCrew(); }} />;
  if (crewId === undefined) return <SkeletonRows rows={4} />;

  if (crewId && !crew) return <SkeletonRows rows={4} />;

  if (!crewId || !crew) {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-line bg-carbon p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold"><Users className="h-4 w-4 text-volt" /> Create a crew</h2>
          <p className="mt-0.5 text-xs text-ink-3">Up to 20 friends, one weekly workout goal, one group chat.</p>
          <div className="mt-3 flex gap-2">
            <input value={name} onChange={e => setName(e.target.value.slice(0, 30))} placeholder="Crew name" className="min-w-0 flex-1 rounded-xl border border-line-strong bg-graphite px-3 py-3 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-volt" />
            <button disabled={busy || name.trim().length < 3} onClick={() => void run(async () => { await crewCreate(name.trim()); setName(""); })} className="rounded-xl bg-volt px-5 text-sm font-bold text-void active:scale-95 disabled:opacity-40">Create</button>
          </div>
        </section>
        <section className="rounded-2xl border border-line bg-carbon p-4">
          <h2 className="text-sm font-bold">Join with an invite code</h2>
          <div className="mt-3 flex gap-2">
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="INVITE CODE" autoCapitalize="characters" className="min-w-0 flex-1 rounded-xl border border-line-strong bg-graphite px-3 py-3 text-center text-base font-bold tracking-[0.3em] text-ink placeholder:text-xs placeholder:font-medium placeholder:tracking-normal placeholder:text-ink-3 outline-none focus:border-volt" />
            <button disabled={busy || code.length !== 6} onClick={() => void run(async () => { await crewJoin(code); setCode(""); })} className="rounded-xl bg-graphite px-5 text-sm font-bold text-ink active:scale-95 disabled:opacity-40">Join</button>
          </div>
        </section>
        {err && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-300">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OneTimeHint id="crew">Everyone in the crew adds to one weekly workout goal. Share the invite code to fill it up.</OneTimeHint>
      <section className="rounded-2xl border border-line bg-carbon p-4">
        <div className="flex items-center justify-between">
          <h2 className="truncate text-base font-bold">{crew.name}</h2>
          <span className="text-xs text-ink-3">{crew.memberCount} members</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 font-semibold text-ink-2"><Target className="h-3.5 w-3.5 text-volt" /> Weekly goal</span>
          <span className="font-bold tabular-nums">{done} / {crew.weeklyGoal} workouts</span>
        </div>
        <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-graphite"><div className="h-full rounded-full bg-volt transition-all duration-700" style={{ width: `${pct}%` }} /></div>
        <p className="mt-1.5 text-[11px] text-ink-3">{pct >= 100 ? "Goal reached. Nice work, crew." : "Every workout any member logs counts. Resets Monday."}</p>
        {isOwner && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-ink-3">Goal</span>
            <input type="number" inputMode="numeric" min={1} max={200} value={goalEdit ?? crew.weeklyGoal} onChange={e => setGoalEdit(Number(e.target.value))} className="w-16 rounded-lg border border-line bg-graphite px-2 py-1.5 text-center text-sm font-bold text-ink outline-none" />
            {goalEdit !== null && goalEdit !== crew.weeklyGoal && (
              <button disabled={busy} onClick={() => void run(async () => { await crewSetGoal(goalEdit); setGoalEdit(null); })} className="rounded-full bg-volt px-3 py-1.5 text-xs font-bold text-void active:scale-95">Save</button>
            )}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button aria-label={`Copy invite code ${crew.inviteCode}`} onClick={async () => { try { await navigator.clipboard.writeText(crew.inviteCode); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-line bg-graphite text-xs font-bold active:scale-95">
            {copied ? <Check className="h-4 w-4 text-volt" /> : <Copy className="h-4 w-4" />} {crew.inviteCode}
          </button>
          <button onClick={() => void shareContent({ title: "Join my crew on Apex Pulse", text: `Join my crew "${crew.name}" on Apex Pulse. Open Arena > Crew and enter the invite code ${crew.inviteCode}.` })} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-line bg-graphite text-xs font-bold active:scale-95"><Share2 className="h-4 w-4" /> Invite</button>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-carbon p-3">
        <h3 className="px-1 pb-1 text-xs font-bold uppercase tracking-wide text-ink-3">This week</h3>
        <ul>
          {board.map(m => (
            <li key={m.uid} className="flex items-center gap-3 px-1 py-2">
              <Avatar src={m.avatar} name={m.name} size={36} />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{m.uid === meUid ? `${m.name} (you)` : m.name}{m.role === "owner" && <Crown className="ml-1 inline h-3.5 w-3.5 text-volt" />}</span>
              <span className="text-sm font-bold tabular-nums">{m.n}</span>
              {isOwner && m.uid !== meUid && (
                <button aria-label={`Remove ${m.name}`} disabled={busy} onClick={() => void run(() => crewKick(m.uid))} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 active:scale-90"><UserMinus className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-carbon p-3">
        <h3 className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-ink-3">Crew chat</h3>
        <div className="max-h-72 space-y-2 overflow-y-auto px-1">
          {sideFailed && msgs.length === 0 && <button onClick={retryCrew} className="mx-auto flex min-h-[44px] items-center rounded-xl border border-line px-4 text-xs font-bold text-ink-2">Couldn't load the chat. Try again</button>}
          {!sideFailed && msgs.length === 0 && <p className="py-6 text-center text-xs text-ink-3">No messages yet. Say hi.</p>}
          {msgs.map(m => (
            <div key={m.id} className={`flex ${m.from === meUid ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.from === meUid ? "bg-volt text-void" : "bg-graphite text-ink"}`}>
                {m.from !== meUid && <p className="text-[11px] font-bold opacity-70">{m.name}</p>}
                <p className="break-words">{m.text}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); const t = text.trim(); if (!t) return; setText(""); void crewSend(crew.id, { uid: meUid, name: meName }, t).catch(x => setErr(friendlySocialError(x))); }}>
          <input value={text} onChange={e => setText(e.target.value.slice(0, 500))} placeholder="Message your crew" className="min-w-0 flex-1 rounded-full border border-line-strong bg-graphite px-4 py-2.5 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-volt" />
          <button type="submit" aria-label="Send" disabled={!text.trim()} className="flex h-11 w-11 items-center justify-center rounded-full bg-volt text-void active:scale-90 disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </form>
      </section>

      {confirmLeave ? (
        <div className="flex gap-2">
          <button onClick={() => setConfirmLeave(false)} className="flex-1 rounded-xl border border-line bg-carbon py-3 text-sm font-semibold text-ink-2">Stay</button>
          <button disabled={busy} onClick={() => void run(async () => { await crewLeave(); setConfirmLeave(false); })} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500/20 py-3 text-sm font-bold text-rose-300">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Leave crew</button>
        </div>
      ) : (
        <button onClick={() => setConfirmLeave(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-carbon py-3 text-sm font-semibold text-ink-2"><LogOut className="h-4 w-4" /> Leave crew</button>
      )}
      {err && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-300">{err}</p>}
    </div>
  );
}
