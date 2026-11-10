import { DEMO } from "./demo";
import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { pendingProgramSessions, usePendingReports } from "./reportQueue";
import { prefetchClips } from "./clipCache";
import { callFn } from "./functions";
import type { Workout, Exercise } from "../types";
import { EX_INFO, exerciseName, locateSession, programById, sessionMinutes, type Program } from "../data/programs";

/** The server's record of a user's active program. Clients only read it. */
export interface ProgramState {
  programId: string;
  done: number;
  total: number;
  completedAt: unknown | null;
}

export type CurrentProgram =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; current: ProgramState | null };

// The server's program record is kept on the phone, so "Continue" still works with no connection.
const cacheKey = (uid: string) => `ap_prog_${uid}`;
function readCache(uid: string): { current: ProgramState | null } | null {
  try {
    const v = JSON.parse(localStorage.getItem(cacheKey(uid)) || "null");
    return v && typeof v === "object" && "current" in v ? v : null;
  } catch { return null; }
}
function writeCache(uid: string, current: ProgramState | null) {
  try { localStorage.setItem(cacheKey(uid), JSON.stringify({ current: current ? { ...current, completedAt: current.completedAt ? 1 : null } : null })); } catch { /* ignore */ }
}

export function useCurrentProgram(uid: string | null): CurrentProgram & { retry: () => void; stale: boolean } {
  return DEMO ? DEMO_PROGRAM : useRealCurrentProgram(uid);
}
const DEMO_PROGRAM: CurrentProgram & { retry: () => void; stale: boolean } = { status: "ready", current: null, retry: () => {}, stale: false };
function useRealCurrentProgram(uid: string | null): CurrentProgram & { retry: () => void; stale: boolean } {
  const [state, setState] = useState<CurrentProgram>(() => {
    const c = uid ? readCache(uid) : null;
    return c ? { status: "ready", current: c.current } : { status: "loading" };
  });
  const [stale, setStale] = useState(() => (uid ? !!readCache(uid) : false));
  const [nonce, setNonce] = useState(0);
  const pending = usePendingReports(); // re-run the adjustment below when the queue changes
  const retry = useCallback(() => { setState({ status: "loading" }); setNonce(n => n + 1); }, []);
  useEffect(() => {
    if (!uid) { setState({ status: "ready", current: null }); setStale(false); return; }
    const c = readCache(uid);
    setState(c ? { status: "ready", current: c.current } : { status: "loading" });
    setStale(!!c);
    // no cache and no connection: say so instead of loading forever
    const t = c ? 0 : window.setTimeout(() => { if (!navigator.onLine) setState({ status: "error" }); }, 4000);
    const unsub = onSnapshot(
      doc(db, "users", uid, "program", "current"),
      snap => {
        const d = snap.data();
        const current = d ? { programId: String(d.programId ?? ""), done: Number(d.done) || 0, total: Number(d.total) || 0, completedAt: d.completedAt ?? null } : null;
        writeCache(uid, current);
        setStale(snap.metadata.fromCache);
        setState({ status: "ready", current });
      },
      () => setState(prev => (prev.status === "ready" ? prev : { status: "error" })),
    );
    return () => { if (t) window.clearTimeout(t); unsub(); };
  }, [uid, nonce]);

  // Sessions finished offline count right away, so the next offline session claims the right number.
  void pending;
  if (uid && state.status === "ready" && state.current && !state.current.completedAt) {
    const extra = pendingProgramSessions(uid, state.current.programId);
    if (extra > 0) {
      const done = Math.min(state.current.total, state.current.done + extra);
      return { status: "ready", current: { ...state.current, done, completedAt: done >= state.current.total ? 1 : null }, retry, stale };
    }
  }
  return { ...state, retry, stale };
}

/** Quietly downloads the demo clips for the next two sessions of the current program (online only). */
export async function prefetchProgramClips(programId: string, done: number) {
  const p = programById(programId);
  if (!p) return;
  const names = new Set<string>();
  for (const n of [done, done + 1]) {
    const loc = locateSession(p, n);
    loc?.session.exercises.forEach(e => names.add(exerciseName(e.id)));
  }
  await prefetchClips([...names]);
}

export const startProgram = (programId: string) => callFn<{ already?: boolean }>("startProgram", { programId });
export const stopProgram = () => callFn<{ ok?: boolean }>("stopProgram", {});

/** Turns one program session (1-based number across the whole program) into a normal workout for the player. */
export function buildProgramWorkout(p: Program, n: number): Workout | null {
  const loc = locateSession(p, n);
  if (!loc) return null;
  const exercises: Exercise[] = loc.session.exercises.map(e => ({
    name: exerciseName(e.id),
    description: EX_INFO[e.id]?.cue ?? "",
    durationSeconds: e.seconds ?? 0,
    reps: e.reps ?? 0,
    sets: e.sets,
    restSeconds: e.rest,
    targetMuscle: EX_INFO[e.id]?.muscle ?? "Full Body",
  }));
  return {
    id: `prog_${p.id}_${n}_${Math.random().toString(36).slice(2, 8)}`,
    workoutTitle: `${p.title}: Week ${loc.week + 1}, ${loc.session.title}`,
    workoutDescription: loc.session.focus,
    totalDurationMinutes: sessionMinutes(loc.session),
    targetArea: "Full Body",
    equipmentNeeded: [],
    exercises,
    coachingTips: [],
    createdAt: new Date().toISOString(),
    program: { id: p.id, session: n },
  };
}
