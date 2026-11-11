import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Check, ClipboardList, Info } from "lucide-react";
import type { Workout } from "../../types";
import {
  GOAL_LABEL, GOAL_ORDER, PROGRAMS, programById, sessionMinutes, totalSessions, locateSession, exerciseName,
  type Program, type ProgramGoal,
} from "../../data/programs";
import { buildProgramWorkout, startProgram, stopProgram, useCurrentProgram, type ProgramState } from "./programs";
import { EmptyState, ErrorState, EmptyAction, SkeletonRows } from "../../shared/ui/StateViews";
import OneTimeHint from "../../shared/OneTimeHint";
import { useBackClose } from "../../core/backStack";
import { track } from "../../core/track";
import { EV } from "../../core/analyticsEvents";

interface Props {
  uid: string | null;
  onStartWorkout: (w: Workout) => void;
  onBack: () => void;
  onSignIn: () => void;
}

const dose = (e: { sets: number; reps?: number; seconds?: number }) => `${e.sets} × ${e.seconds ? `${e.seconds} s` : e.reps}`;

function DraftBadge() {
  return <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">Draft</span>;
}

export default function ProgramsView({ uid, onStartWorkout, onBack, onSignIn }: Props) {
  const cur = useCurrentProgram(uid);
  const [goal, setGoal] = useState<ProgramGoal | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  const open = programById(openId);
  useBackClose(!!open, () => { setOpenId(null); setErr(""); setConfirmSwitch(false); });

  const list = useMemo(() => PROGRAMS.filter(p => goal === "all" || p.goals.includes(goal)), [goal]);
  const current: ProgramState | null = cur.status === "ready" ? cur.current : null;
  const activeProgram = current && !current.completedAt ? programById(current.programId) : null;

  const playNext = (p: Program, done: number) => {
    const w = buildProgramWorkout(p, done);
    if (!w) { setErr("That session could not be loaded. Please try again."); return; }
    onStartWorkout(w);
  };

  const begin = async (p: Program, restart: boolean) => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      await startProgram(p.id);
      if (restart || !current || current.programId !== p.id || current.completedAt) track(EV.programStarted);
      playNext(p, 0);
    } catch {
      setErr("Couldn't start the program. Check your connection and try again.");
    } finally { setBusy(false); }
  };

  const leave = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try { await stopProgram(); setConfirmSwitch(false); }
    catch { setErr("Couldn't stop the program. Please try again."); }
    finally { setBusy(false); }
  };

  /* ---------------- detail ---------------- */
  if (open) {
    const mine = current && current.programId === open.id ? current : null;
    const done = mine ? mine.done : 0;
    const finished = !!mine?.completedAt;
    const other = !!activeProgram && activeProgram.id !== open.id;
    let sessionNo = 0;
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
        <button onClick={() => { setOpenId(null); setErr(""); setConfirmSwitch(false); }} className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-ink-2" aria-label="Back to programs">
          <ArrowLeft className="h-4 w-4" /> Programs
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-extrabold text-ink">{open.title}</h1>
          {open.status === "draft" && <DraftBadge />}
        </div>
        <p className="mt-1 text-sm text-ink-2">{open.tagline}</p>
        <p className="mt-1 text-xs text-ink-3">{open.weeks.length} weeks · {totalSessions(open)} sessions · {open.level} · {open.equipmentNote}</p>
        {open.status === "draft" && (
          <div role="note" className="mt-3 flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-snug text-amber-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>{open.reviewNote}</span>
          </div>
        )}

        <ol className="mt-4 space-y-3">
          {open.weeks.map((w, wi) => {
            const start = sessionNo;
            sessionNo += w.sessions.length;
            const weekDone = Math.max(0, Math.min(w.sessions.length, done - start));
            return (
              <li key={wi} className="rounded-2xl border border-line bg-carbon p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-ink">{w.title}</h2>
                  <span className={`text-xs font-semibold ${weekDone === w.sessions.length && mine ? "text-volt" : "text-ink-3"}`}>
                    {mine ? `${weekDone}/${w.sessions.length} done` : `${w.sessions.length} sessions`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-3">{w.note}</p>
                <ul className="mt-3 space-y-3">
                  {w.sessions.map((s, si) => {
                    const isDone = !!mine && start + si < done;
                    return (
                      <li key={si}>
                        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                          {isDone ? <Check className="h-4 w-4 text-volt" aria-label="Done" /> : <span className="h-4 w-4 rounded-full border border-line" aria-hidden />}
                          <span>{s.title}</span>
                          <span className="ml-auto text-xs font-normal text-ink-3">{sessionMinutes(s)} min</span>
                        </div>
                        <p className="ml-6 text-xs text-ink-3">{s.focus}</p>
                        <ul className="ml-6 mt-1 space-y-0.5">
                          {s.exercises.map((e, ei) => (
                            <li key={ei} className="flex justify-between gap-2 text-xs text-ink-2">
                              <span>{exerciseName(e.id)}</span><span className="shrink-0 text-ink-3">{dose(e)}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>

        {!uid ? (
          <div className="mt-5"><EmptyAction label="Sign in to start this program" onClick={onSignIn} /></div>
        ) : (
          <div className="mt-5 space-y-2">
            {mine && !finished && (
              <button onClick={() => { const loc = locateSession(open, done); if (loc) playNext(open, done); }} className="min-h-[52px] w-full rounded-2xl bg-volt px-4 text-base font-extrabold text-black active:scale-[0.98]">
                Continue: Week {(locateSession(open, done)?.week ?? 0) + 1} · {locateSession(open, done)?.session.title}
              </button>
            )}
            {!mine && !other && (
              <button disabled={busy} onClick={() => void begin(open, false)} className="min-h-[52px] w-full rounded-2xl bg-volt px-4 text-base font-extrabold text-black active:scale-[0.98] disabled:opacity-60">
                {busy ? "Starting…" : "Start program"}
              </button>
            )}
            {!mine && other && !confirmSwitch && (
              <button onClick={() => setConfirmSwitch(true)} className="min-h-[52px] w-full rounded-2xl bg-volt px-4 text-base font-extrabold text-black active:scale-[0.98]">Start program</button>
            )}
            {!mine && other && confirmSwitch && (
              <div className="rounded-2xl border border-line bg-carbon p-4">
                <p className="text-sm text-ink">You're partway through "{activeProgram?.title}". Starting this one ends that program and its progress.</p>
                <div className="mt-3 flex gap-2">
                  <button disabled={busy} onClick={() => void begin(open, true)} className="min-h-[48px] flex-1 rounded-xl bg-volt px-3 text-sm font-bold text-black disabled:opacity-60">{busy ? "Switching…" : "Switch program"}</button>
                  <button onClick={() => setConfirmSwitch(false)} className="min-h-[48px] flex-1 rounded-xl border border-line px-3 text-sm font-semibold text-ink">Keep current</button>
                </div>
              </div>
            )}
            {finished && (
              <button disabled={busy} onClick={() => void begin(open, true)} className="min-h-[52px] w-full rounded-2xl bg-volt px-4 text-base font-extrabold text-black active:scale-[0.98] disabled:opacity-60">
                {busy ? "Starting…" : "Start again"}
              </button>
            )}
            {mine && !finished && (
              confirmSwitch ? (
                <div className="rounded-2xl border border-line bg-carbon p-4">
                  <p className="text-sm text-ink">Leave this program? Your progress in it will be cleared.</p>
                  <div className="mt-3 flex gap-2">
                    <button disabled={busy} onClick={() => void leave()} className="min-h-[48px] flex-1 rounded-xl border border-rose-400/50 px-3 text-sm font-bold text-rose-300 disabled:opacity-60">{busy ? "Leaving…" : "Leave program"}</button>
                    <button onClick={() => setConfirmSwitch(false)} className="min-h-[48px] flex-1 rounded-xl border border-line px-3 text-sm font-semibold text-ink">Stay</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmSwitch(true)} className="min-h-[44px] w-full rounded-xl border border-line px-4 text-sm font-semibold text-ink-2">Leave program</button>
              )
            )}
            {err && <p role="alert" className="text-center text-xs text-rose-400">{err}</p>}
          </div>
        )}
      </div>
    );
  }

  /* ---------------- list ---------------- */
  const nextLoc = activeProgram && current ? locateSession(activeProgram, current.done) : null;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
      <button onClick={onBack} className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-ink-2" aria-label="Back">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-xl font-extrabold text-ink">Programs</h1>
      <p className="mt-1 text-sm text-ink-2">Multi-week plans that tell you what to do each session.</p>
      <OneTimeHint id="programs" className="mt-3">Pick a plan and start. One program session counts per day, and finishing a whole program earns a trophy.</OneTimeHint>
      <p className="mt-3 text-xs text-ink-3">These plans are drafts waiting for a trainer's review. Go easy and stop if anything hurts.</p>

      {!uid ? (
        <div className="mt-4"><EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Sign in to follow a program" body="Your progress is saved to your account." action={<EmptyAction label="Sign in" onClick={onSignIn} />} /></div>
      ) : cur.status === "loading" ? (
        <div className="mt-4"><SkeletonRows rows={3} /></div>
      ) : cur.status === "error" ? (
        <div className="mt-4"><ErrorState message="Couldn't load your program progress." onRetry={cur.retry} /></div>
      ) : (
        <>
          {activeProgram && current && nextLoc && (
            <div className="mt-4 rounded-2xl border border-volt/40 bg-carbon p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Your program</p>
              <p className="mt-0.5 text-base font-bold text-ink">{activeProgram.title}</p>
              <p className="text-xs text-ink-3">{current.done} of {current.total} sessions done</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-graphite" role="progressbar" aria-valuemin={0} aria-valuemax={current.total} aria-valuenow={current.done}>
                <div className="h-full rounded-full bg-volt" style={{ width: `${current.total ? (current.done / current.total) * 100 : 0}%` }} />
              </div>
              <button onClick={() => playNext(activeProgram, current.done)} className="mt-3 min-h-[52px] w-full rounded-2xl bg-volt px-4 text-base font-extrabold text-black active:scale-[0.98]">
                Continue: Week {nextLoc.week + 1} · {nextLoc.session.title}
              </button>
              {err && <p role="alert" className="mt-2 text-center text-xs text-rose-400">{err}</p>}
            </div>
          )}
          {current?.completedAt && programById(current.programId) && (
            <p className="mt-4 rounded-xl border border-line bg-carbon p-3 text-sm text-ink">You finished "{programById(current.programId)?.title}". Nice work.</p>
          )}

          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by goal">
            {(["all", ...GOAL_ORDER] as const).map(g => (
              <button key={g} aria-pressed={goal === g} onClick={() => setGoal(g)}
                className={`min-h-12 shrink-0 rounded-full border px-4 text-sm font-semibold ${goal === g ? "border-volt bg-volt/15 text-volt" : "border-line text-ink-2"}`}>
                {g === "all" ? "All" : GOAL_LABEL[g]}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={<ClipboardList className="h-6 w-6" />} title={`No programs for ${goal === "all" ? "this" : GOAL_LABEL[goal].toLowerCase()} yet`} body="More plans are on the way." action={<EmptyAction label="Show all programs" onClick={() => setGoal("all")} />} />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {list.map(p => (
                <li key={p.id}>
                  <button onClick={() => { setOpenId(p.id); setErr(""); setConfirmSwitch(false); }} className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-line bg-carbon p-4 text-left active:scale-[0.99]">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-ink">{p.title}</span>
                        {p.status === "draft" && <DraftBadge />}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-2">{p.tagline}</span>
                      <span className="mt-1 block text-xs text-ink-3">{p.weeks.length} weeks · {totalSessions(p)} sessions · {p.level}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
