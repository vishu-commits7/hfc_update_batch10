import { useEffect, useRef, useState } from "react";
import { CalendarClock, Hand, Loader2, Trophy } from "lucide-react";
import { getDailyInfo, msToIstMidnight, startDaily, submitDaily, subscribeDailyBoard, type BoardRow, type DailyInfo, type DailyResult } from "./daily";
import { friendlySocialError } from "../social/social";
import { celebrateFeedback, tapFeedback } from "../../core/haptics";
import Avatar from "../../shared/ui/Avatar";
import { istDayKey, readCache, writeCache } from "../../core/callCache";

type Phase = "idle" | "starting" | "countdown" | "run" | "sending" | "result";

/** One exercise for everyone, 60 seconds, new at midnight IST. The server checks the count and keeps the board. */
export default function DailyChallenge({ meUid }: { meUid: string }) {
  // remembered for the day, so the card is on screen at once and refreshes behind the scenes
  const cacheKey = `daily:${meUid}:${istDayKey()}`;
  const [info, setInfoRaw] = useState<DailyInfo | null>(() => readCache<DailyInfo>(cacheKey, 26 * 3600_000));
  const setInfo: typeof setInfoRaw = v => setInfoRaw(prev => { const next = typeof v === "function" ? v(prev) : v; if (next) writeCache(`daily:${meUid}:${next.dayKey}`, next); return next; });
  const [failed, setFailed] = useState(false);
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(3);
  const [left, setLeft] = useState(60);
  const [reps, setReps] = useState(0);
  const repsRef = useRef(0);
  const endRef = useRef(0);
  const [result, setResult] = useState<DailyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetIn, setResetIn] = useState(msToIstMidnight());
  const [showAll, setShowAll] = useState(false);

  const load = () => { setFailed(false); getDailyInfo().then(setInfo).catch(() => { if (!readCache(cacheKey, 26 * 3600_000)) setFailed(true); }); };
  useEffect(load, []);
  // top 10 live; the other 90 are only read when the player asks for the full list
  useEffect(() => { if (!info) return; return subscribeDailyBoard(info.dayKey, setBoard, () => setBoard([]), showAll ? 100 : 10); }, [info?.dayKey, showAll]); // eslint-disable-line react-hooks/exhaustive-deps

  // "resets in" clock; when midnight IST passes, load the new day's challenge
  useEffect(() => {
    const id = window.setInterval(() => {
      const ms = msToIstMidnight();
      setResetIn(prev => { if (ms > prev + 60_000 && phase === "idle") load(); return ms; });
    }, 30_000);
    return () => clearInterval(id);
  }, [phase]);

  const begin = async () => {
    if (!info || phase !== "idle") return;
    void tapFeedback(); setError(null); setPhase("starting");
    try {
      const s = await startDaily(); // the server's clock starts here; the 3-2-1 below is inside its allowance
      setInfo(i => (i ? { ...i, me: { ...i.me, attempts: s.attempts } } : i));
      repsRef.current = 0; setReps(0); setCount(3); setPhase("countdown");
    } catch (e) { setError(friendlySocialError(e)); setPhase("idle"); }
  };

  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) { endRef.current = Date.now() + (info?.seconds ?? 60) * 1000; setLeft(info?.seconds ?? 60); setPhase("run"); void celebrateFeedback(); return; }
    const t = window.setTimeout(() => setCount(c => c - 1), 900);
    return () => clearTimeout(t);
  }, [phase, count]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    setPhase("sending");
    try {
      const r = await submitDaily(repsRef.current);
      setResult(r);
      setInfo(i => (i ? { ...i, me: { ...i.me, best: r.best, attempts: r.attempts, xpAwarded: i.me.xpAwarded || r.xpGained > 0 } } : i));
      if (r.newBest) void celebrateFeedback();
      setPhase("result");
    } catch (e) { setError(friendlySocialError(e)); setPhase("idle"); }
  };

  // the 60 seconds run off the wall clock, so a slow phone or a locked screen cannot stretch them
  useEffect(() => {
    if (phase !== "run") return;
    const id = window.setInterval(() => {
      const ms = endRef.current - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) { clearInterval(id); void send(); }
    }, 200);
    return () => clearInterval(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = () => { if (phase !== "run" || Date.now() >= endRef.current) return; repsRef.current += 1; setReps(repsRef.current); void tapFeedback(); };

  if (failed) {
    return (
      <section className="mb-4 rounded-2xl border border-line bg-carbon p-4 text-center">
        <p className="text-sm font-semibold">Couldn't load today's challenge.</p>
        <button onClick={load} className="mt-3 min-h-[44px] rounded-xl border border-line bg-graphite px-5 text-xs font-bold text-ink active:scale-95">Try again</button>
      </section>
    );
  }
  if (!info) return <section className="mb-4 flex justify-center rounded-2xl border border-line bg-carbon p-6"><Loader2 className="h-5 w-5 animate-spin text-ink-3" /></section>;

  const h = Math.floor(resetIn / 3600_000), m = Math.floor((resetIn % 3600_000) / 60_000);
  const attemptsLeft = Math.max(0, info.me.attemptsMax - info.me.attempts);
  const myIdx = board ? board.findIndex(r => r.uid === meUid) : -1;
  const rows = board ?? [];

  /* ----- live attempt ----- */
  if (phase === "countdown" || phase === "run" || phase === "sending") {
    return (
      <section className="mb-4 rounded-2xl border border-volt/40 bg-carbon p-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-3">Daily challenge · {info.exercise.name}</p>
        {phase === "countdown" ? (
          <div className="flex h-64 items-center justify-center"><span className="text-8xl font-bold tabular-nums text-volt">{count > 0 ? count : "GO"}</span></div>
        ) : phase === "sending" ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-volt" /><p className="text-sm font-semibold">Checking your {reps} reps…</p></div>
        ) : (
          <>
            <p className="mt-2 text-5xl font-bold tabular-nums" aria-live="off">{left}<span className="text-xl text-ink-3">s</span></p>
            <p className="text-sm font-semibold text-ink-2"><span className="text-2xl font-bold tabular-nums text-ink">{reps}</span> reps</p>
            <button onPointerDown={tap} aria-label="Tap to count a rep" className="mt-3 flex h-56 w-full touch-manipulation select-none flex-col items-center justify-center gap-2 rounded-3xl bg-volt text-void active:scale-[0.98]">
              <Hand className="h-10 w-10" />
              <span className="text-2xl font-bold">TAP EACH REP</span>
              <span className="px-4 text-xs font-semibold opacity-70">{info.exercise.tip}</span>
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="mb-4 rounded-2xl border border-line bg-carbon p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-3"><CalendarClock className="h-3.5 w-3.5 text-volt" /> Daily challenge</p>
          <h2 className="mt-0.5 truncate text-lg font-bold">{info.exercise.name}</h2>
          <p className="text-xs text-ink-3">Most reps in {info.seconds} seconds. Same for everyone today.</p>
        </div>
        <span className="shrink-0 rounded-full bg-graphite px-2.5 py-1 text-[11px] font-semibold text-ink-2">New in {h}h {m}m</span>
      </div>

      {phase === "result" && result && (
        <div className="mt-3 rounded-xl bg-graphite p-3 text-center">
          <p className="text-3xl font-bold tabular-nums text-volt">{result.reps} <span className="text-sm font-semibold text-ink-3">reps</span></p>
          <p className="mt-1 text-xs font-semibold text-ink-2">
            {!result.counts ? `You need at least ${info.minReps} reps to get on the board.` : result.newBest ? (result.rank ? `New best. You're #${result.rank} today.` : "New best.") : `Your best today is still ${result.best}${result.rank ? ` (#${result.rank})` : ""}.`}
          </p>
          {result.xpGained > 0 && <p className="mt-1 text-xs font-bold text-volt">+{result.xpGained} XP{result.levelUp ? " · Level up" : ""}</p>}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-ink-3">
        <span>{info.me.best > 0 ? `Your best: ${info.me.best}` : "No attempt yet"}</span>
        <span>{info.me.xpAwarded ? "XP earned today" : `+${info.xp} XP, once a day`}</span>
      </div>
      <button onClick={() => { if (phase === "result") { setResult(null); setPhase("idle"); return; } void begin(); }} disabled={phase === "starting" || (attemptsLeft === 0 && phase !== "result")}
        className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-volt text-sm font-bold text-void active:scale-[0.98] disabled:opacity-40">
        {phase === "starting" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {phase === "result" ? "Done" : attemptsLeft === 0 ? "No attempts left today" : info.me.attempts === 0 ? "Start 60 seconds" : `Try again (${attemptsLeft} left)`}
      </button>
      {error && <p className="mt-2 rounded-xl bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-300">{error}</p>}

      <div className="mt-4">
        <p className="flex items-center gap-1.5 text-xs font-bold"><Trophy className="h-3.5 w-3.5 text-volt" /> Today's top 100</p>
        {board === null ? (
          <div className="flex justify-center py-5"><Loader2 className="h-4 w-4 animate-spin text-ink-3" /></div>
        ) : board.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-3">Nobody is on the board yet. Be the first.</p>
        ) : (
          <>
            <ol className="mt-1">
              {rows.map((r, i) => (
                <li key={r.uid} className={`flex items-center gap-3 rounded-lg px-1.5 py-1.5 ${r.uid === meUid ? "bg-volt/10" : ""}`}>
                  <span className="w-7 text-center text-xs font-bold tabular-nums text-ink-3">{i + 1}</span>
                  <Avatar src={r.avatar} name={r.name} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}{r.uid === meUid ? " (you)" : ""}</span>
                  <span className="text-sm font-bold tabular-nums">{r.reps}</span>
                </li>
              ))}
            </ol>
            {myIdx < 0 && result?.rank && result.rank > rows.length && <p className="mt-1 rounded-lg bg-volt/10 px-3 py-1.5 text-center text-xs font-semibold">You're #{result.rank} with {result.best} reps</p>}
            {(showAll || board.length >= 10) && <button onClick={() => setShowAll(v => !v)} className="mt-2 min-h-[44px] w-full rounded-xl border border-line bg-graphite text-xs font-bold text-ink-2 active:scale-95">{showAll ? "Show top 10" : "Show top 100"}</button>}
          </>
        )}
      </div>
    </section>
  );
}
