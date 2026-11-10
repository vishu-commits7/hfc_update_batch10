import { useSyncExternalStore } from "react";
import { auth } from "./firebase";
import { callFn } from "./functions";
import type { RewardResult } from "./progress";
import type { WorkoutLog } from "../types";

/**
 * Finished workouts are written to this queue (on the phone) BEFORE anything is sent, then sent to the
 * server one at a time, oldest first. An item leaves the queue only when the server answered (credited
 * or "duplicate") or refused it for good. The server keeps one receipt per workout id, so a report that
 * is sent twice (a lost reply, a retry after reconnecting) is never paid twice.
 */
const KEY = "ap_report_queue_v1";
const MAX_ITEMS = 20;
const MAX_AGE_MS = 3 * 24 * 3600_000; // the server only accepts today +-1 day anyway

interface Item {
  id: string;            // the workout id the server dedupes on
  uid: string;
  queuedAt: number;
  payload: Record<string, unknown>;
  program?: { id: string; session: number };
}

type Listener = (r: RewardResult) => void;
const rewardListeners = new Set<Listener>();
const changeListeners = new Set<() => void>();
let version = 0;
let flushing: Promise<void> | null = null;
let again = false;
let retryTimer: number | null = null;
const waiters = new Map<string, (r: RewardResult | null) => void>();

function read(): Item[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function write(items: Item[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full or blocked: queue lives on in memory only for this call */ }
  version++;
  changeListeners.forEach(l => l());
}

const dayKey = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Results of reports that were sent later (after being queued offline). The app shows the rewards. */
export function onQueuedReward(l: Listener) { rewardListeners.add(l); return () => { rewardListeners.delete(l); }; }

export function pendingReports(uid?: string | null): Item[] {
  return read().filter(i => !uid || i.uid === uid);
}

/** Number of workouts waiting to be reported (live). */
export function usePendingReports(): number {
  return useSyncExternalStore(
    cb => { changeListeners.add(cb); return () => { changeListeners.delete(cb); }; },
    () => read().length,
    () => 0,
  );
}

/** Program sessions finished on the phone but not yet confirmed by the server, for one program. */
export function pendingProgramSessions(uid: string, programId: string): number {
  return read().filter(i => i.uid === uid && i.program?.id === programId).length;
}

/** Queues the report, tries to send it now, and resolves with its reward if it was sent. Null = queued for later. */
export function reportWorkout(uid: string, log: WorkoutLog, program?: { id: string; session: number }): Promise<RewardResult | null> {
  const items = read();
  if (!items.some(i => i.id === log.id)) {
    items.push({
      id: log.id, uid, queuedAt: Date.now(), program,
      payload: {
        workoutId: log.id,
        minutes: log.durationMinutes || 1,
        calories: log.estimatedCaloriesBurned || 0,
        dayKey: dayKey(),
        area: log.targetArea || "Full Body",
        feeling: log.feeling,
        ...(program ? { programId: program.id, programSession: program.session } : {}),
      },
    });
    write(items.slice(-MAX_ITEMS));
  }
  const done = new Promise<RewardResult | null>(res => { waiters.set(log.id, res); });
  void flushReports();
  return done;
}

function permanent(code: string) {
  return /invalid-argument|failed-precondition|permission-denied|not-found|out-of-range|already-exists|data-loss/.test(code);
}

async function runFlush() {
  const uid = auth.currentUser?.uid;
  if (!uid || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  let delay = 0;
  for (;;) {
    const now = Date.now();
    const fresh = read().filter(i => now - i.queuedAt < MAX_AGE_MS);
    if (fresh.length !== read().length) write(fresh);
    const next = fresh.find(i => i.uid === uid);
    if (!next) break;
    try {
      const res = await callFn<RewardResult & { duplicate?: boolean }>("recordWorkout", next.payload);
      write(read().filter(i => i.id !== next.id));
      const result = res.duplicate ? null : res;
      const w = waiters.get(next.id);
      if (w) { waiters.delete(next.id); w(result); }
      else if (result) rewardListeners.forEach(l => l(result));
    } catch (e) {
      const code = String((e as { code?: string })?.code || "");
      if (permanent(code)) {
        write(read().filter(i => i.id !== next.id)); // refused for good: do not retry forever
        const w = waiters.get(next.id);
        if (w) { waiters.delete(next.id); w(null); }
        continue;
      }
      // "Slow down" (a report was accepted under a minute ago): try again after a minute. Anything else: next trigger.
      delay = /resource-exhausted/.test(code) ? 65_000 : 60_000;
      break;
    }
  }
  if (delay && read().length) {
    if (retryTimer) window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => { retryTimer = null; void flushReports(); }, delay);
  }
}

/** Sends everything waiting, one at a time. Safe to call from anywhere, any number of times. */
export function flushReports(): Promise<void> {
  if (flushing) { again = true; return flushing; }
  flushing = (async () => {
    try {
      do { again = false; await runFlush(); } while (again);
    } finally {
      flushing = null;
      // anyone still waiting for an answer was queued: they get "later"
      waiters.forEach(w => w(null));
      waiters.clear();
    }
  })();
  return flushing;
}
