import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, Ghost, Loader2, Minus, Plus, Swords, Zap } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { callFn } from "../lib/functions";
import { POPULAR } from "../lib/arenaCatalog";
import { friendlySocialError, subscribeLiveRooms, subscribeRoom, type ArenaRoom } from "../lib/social";
import { tapFeedback } from "../lib/haptics";
import { GHOST_FALLBACK_S, startGhostMatch, type GhostAsk } from "../lib/ghost";
import Avatar from "./ui/Avatar";

const SEARCH_LIMIT_S = 60;

/** Auto-pairs you with someone waiting for the same exercise and reps. */
export function QuickMatchCard({ meUid, onMatched }: { meUid: string; onMatched: (code: string) => void }) {
  const [exId, setExId] = useState(POPULAR[0]?.id ?? "pushups");
  const [reps, setReps] = useState(POPULAR[0]?.defaultReps ?? 20);
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const done = useRef(false);
  const ghostTried = useRef(false);
  const [ghostBusy, setGhostBusy] = useState(false);

  const cancel = (note?: string) => {
    setSearching(false); setElapsed(0);
    if (note) setMsg(note);
    void callFn("arenaQuickCancel").catch(() => {});
  };

  // matched while waiting: the server flips my queue doc to { status: "matched", code }
  useEffect(() => {
    if (!searching) return;
    done.current = false;
    const un = onSnapshot(doc(db, "matchQueue", meUid), snap => {
      const x = snap.data();
      if (x?.status === "matched" && x.code && !done.current) {
        done.current = true;
        setSearching(false);
        void callFn("arenaQuickCancel").catch(() => {});
        onMatched(String(x.code));
      }
    }, () => {});
    const tick = window.setInterval(() => setElapsed(s => s + 1), 1000);
    return () => { un(); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, meUid]);

  // no live opponent after GHOST_FALLBACK_S seconds: race a ghost instead (the server hands back the live room if one just appeared)
  useEffect(() => {
    if (!searching || elapsed < GHOST_FALLBACK_S || ghostTried.current || done.current) return;
    ghostTried.current = true;
    const ex = POPULAR.find(e => e.id === exId);
    if (!ex) return;
    startGhostMatch(ex.id, ex.name, reps, "auto").then(r => {
      if (done.current) return;
      done.current = true; setSearching(false); onMatched(r.code);
    }).catch(() => { /* keep waiting for a live opponent */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, searching]);

  const ghostDuel = async (kind: GhostAsk) => {
    const ex = POPULAR.find(e => e.id === exId);
    if (!ex || ghostBusy) return;
    void tapFeedback(); setMsg(null); setGhostBusy(true);
    try {
      const r = await startGhostMatch(ex.id, ex.name, reps, kind);
      done.current = true; onMatched(r.code);
    } catch (e) { setMsg(friendlySocialError(e)); } finally { setGhostBusy(false); }
  };

  useEffect(() => {
    if (searching && elapsed >= SEARCH_LIMIT_S) cancel("No one is searching for this right now. Try a popular exercise, or create a room and share the code.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, searching]);

  // leaving the screen while searching removes me from the queue
  useEffect(() => () => { if (!done.current) void callFn("arenaQuickCancel").catch(() => {}); }, []);

  const start = async () => {
    const ex = POPULAR.find(e => e.id === exId);
    if (!ex) return;
    void tapFeedback(); setMsg(null); setElapsed(0); ghostTried.current = false; setSearching(true);
    try {
      const r = await callFn<{ status: "matched" | "waiting"; code?: string }>("arenaQuickMatch", { exerciseId: ex.id, name: ex.name, reps });
      if (r.status === "matched" && r.code) { done.current = true; setSearching(false); onMatched(r.code); }
    } catch (e) { setSearching(false); setMsg(friendlySocialError(e)); }
  };

  return (
    <section className="rounded-2xl border border-line bg-carbon p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-bold"><Zap className="h-4 w-4 text-volt" /> Quick match</h2>
      <p className="mt-0.5 text-xs text-ink-3">Get paired with the next athlete who picks the same exercise and reps. Ranked, so your rating moves.</p>
      {searching ? (
        <div className="mt-4 rounded-xl bg-graphite p-5 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-volt" />
          <p className="mt-3 text-sm font-semibold">Looking for an opponent… {elapsed}s</p>
          <p className="text-xs text-ink-3">{POPULAR.find(e => e.id === exId)?.name} · first to {reps}</p>
          <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-ink-3">
            <Ghost className="h-3.5 w-3.5" />
            {elapsed < GHOST_FALLBACK_S ? `A ghost joins in ${GHOST_FALLBACK_S - elapsed}s if nobody turns up` : "Bringing in a ghost…"}
          </p>
          <button onClick={() => cancel()} className="mt-4 rounded-full border border-line px-5 py-2 text-xs font-bold text-ink-2 active:scale-95">Cancel</button>
        </div>
      ) : (
        <>
          <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {POPULAR.slice(0, 8).map(e => (
              <button key={e.id} onClick={() => { void tapFeedback(); setExId(e.id); setReps(e.defaultReps); }}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${exId === e.id ? "bg-volt text-void" : "border border-line bg-graphite text-ink-2"}`}>{e.name}</button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between rounded-xl border border-line bg-graphite px-3 py-2">
            <span className="text-xs font-semibold text-ink-2">First to</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setReps(r => Math.max(5, r - 5))} aria-label="Fewer reps" className="flex h-9 w-9 items-center justify-center rounded-full bg-carbon active:scale-90"><Minus className="h-4 w-4" /></button>
              <span className="w-10 text-center text-lg font-bold tabular-nums">{reps}</span>
              <button onClick={() => setReps(r => Math.min(100, r + 5))} aria-label="More reps" className="flex h-9 w-9 items-center justify-center rounded-full bg-carbon active:scale-90"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          <button onClick={start} className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-volt text-sm font-bold text-void active:scale-[0.98]"><Swords className="h-4 w-4" /> Find opponent</button>
          <div className="mt-3 rounded-xl border border-line bg-graphite p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold"><Ghost className="h-3.5 w-3.5 text-volt" /> Race a ghost</p>
            <p className="mt-0.5 text-[11px] text-ink-3">A recorded run, no waiting. Against another player's ghost your rating moves at half weight.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={() => void ghostDuel("peer")} disabled={ghostBusy} className="min-h-[44px] rounded-xl border border-line bg-carbon text-xs font-bold text-ink active:scale-95 disabled:opacity-50">Player at my level</button>
              <button onClick={() => void ghostDuel("self")} disabled={ghostBusy} className="min-h-[44px] rounded-xl border border-line bg-carbon text-xs font-bold text-ink active:scale-95 disabled:opacity-50">My best run</button>
            </div>
          </div>
        </>
      )}
      {msg && <p className="mt-2 rounded-xl bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-300">{msg}</p>}
    </section>
  );
}

/** Public matches in progress. */
export function LiveRoomsCard({ onWatch }: { onWatch: (code: string) => void }) {
  const [rooms, setRooms] = useState<ArenaRoom[] | null>(null);
  useEffect(() => subscribeLiveRooms(setRooms, () => setRooms([])), []);
  if (!rooms || rooms.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line bg-carbon p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-bold"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> Live now</h2>
      <ul className="mt-2 space-y-1">
        {rooms.map(r => (
          <li key={r.code} className="flex items-center gap-3 py-2">
            <Avatar src={r.hostAvatar} name={r.hostName} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{r.hostName} vs {r.guestName || "…"}</span>
              <span className="block truncate text-xs text-ink-3">{r.exercise} · {r.hostReps} - {r.guestReps}</span>
            </span>
            <button onClick={() => { void tapFeedback(); onWatch(r.code); }} className="flex items-center gap-1 rounded-full border border-line bg-graphite px-3.5 py-2 text-xs font-bold text-ink active:scale-95"><Eye className="h-3.5 w-3.5" /> Watch</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Scores only: spectators don't get the players' camera feed. */
export function SpectateScreen({ code, onExit }: { code: string; onExit: () => void }) {
  const [room, setRoom] = useState<ArenaRoom | null | undefined>(undefined);
  useEffect(() => subscribeRoom(code, setRoom, () => setRoom(null)), [code]);

  const total = room ? (room.mode === "reps" ? room.target : 0) : 0;
  const bar = (reps: number) => (total ? Math.min(100, Math.round((reps / total) * 100)) : Math.min(100, reps));
  const done = room?.status === "finished" || room?.status === "cancelled";
  const winner = room && room.status === "finished" ? (room.hostReps > room.guestReps ? room.hostName : room.guestReps > room.hostReps ? room.guestName : null) : null;

  return (
    <div className="mx-auto w-full max-w-md space-y-4 pb-28 text-ink animate-fade-in">
      <div className="flex items-center justify-between">
        <button onClick={onExit} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-carbon text-ink-2 active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="flex items-center gap-1.5 text-base font-bold"><Eye className="h-4 w-4 text-volt" /> Spectating</h1>
        <span className="w-11" />
      </div>
      {room === undefined ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-ink-3" /></div>
      ) : room === null ? (
        <p className="py-16 text-center text-sm text-ink-3">This match isn't available any more.</p>
      ) : (
        <>
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-ink-3">{room.exercise} · {room.mode === "time" ? `${room.target}s, most reps` : `first to ${room.target}`}</p>
          {([[room.hostName, room.hostAvatar, room.hostReps], [room.guestName || "Waiting…", room.guestAvatar, room.guestReps]] as const).map(([n, a, reps], i) => (
            <div key={i} className="rounded-2xl border border-line bg-carbon p-4">
              <div className="flex items-center gap-3">
                <Avatar src={a} name={n} size={44} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{n}</span>
                <span className="text-4xl font-black tabular-nums text-volt">{reps}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-graphite"><div className="h-full rounded-full bg-volt transition-all duration-300" style={{ width: `${bar(reps)}%` }} /></div>
            </div>
          ))}
          <p className="rounded-xl bg-graphite px-3 py-3 text-center text-sm font-semibold text-ink-2">
            {done ? (winner ? `${winner} won` : room.status === "cancelled" ? "Match cancelled" : "Draw") : room.status === "live" ? "Live" : "Starting soon…"}
          </p>
        </>
      )}
    </div>
  );
}
