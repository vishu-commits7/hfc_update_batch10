/**
 * OBSIDIAN — shared animation clock
 *
 * One `requestAnimationFrame` loop for the entire application.
 *
 * The naive version of this feature gives every animated figure its own
 * rAF loop. On the Academy screen that is thirty-nine loops; on a workout
 * list, a dozen. Each one is a separate callback the browser must schedule
 * and a separate place to forget a cleanup, and together they make the
 * main thread's frame budget impossible to reason about. One loop
 * broadcasting a timestamp costs the same as one figure and stays flat no
 * matter how many mount.
 *
 * Two behaviours worth noting:
 *
 *  · The loop stops entirely when nothing is subscribed. An idle app burns
 *    no frames, which on a phone is battery.
 *
 *  · It stops while the document is hidden and resumes on return, with the
 *    elapsed background time discounted. Without that, a figure would jump
 *    forward by however many minutes the phone spent in a pocket — and
 *    during a workout, the on-screen demo would desynchronise from the
 *    timer that kept running.
 */

type Tick = (elapsedMs: number) => void;

const subscribers = new Set<Tick>();

let rafId = 0;
let elapsed = 0;
let lastFrame = 0;

function frame(now: number) {
  // Discount any gap larger than a few frames. That covers a backgrounded
  // tab, a long main-thread block, and a device waking from sleep — all of
  // which would otherwise arrive as one enormous delta.
  const delta = lastFrame === 0 ? 16.7 : Math.min(now - lastFrame, 64);
  lastFrame = now;
  elapsed += delta;

  for (const tick of subscribers) {
    try {
      tick(elapsed);
    } catch {
      // One misbehaving figure must never take down every other animation
      // on the screen. Swallow and keep the loop running.
    }
  }

  rafId = requestAnimationFrame(frame);
}

function start() {
  if (rafId) return;
  lastFrame = 0;
  rafId = requestAnimationFrame(frame);
}

function stop() {
  if (!rafId) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
  lastFrame = 0;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      stop();
    } else if (subscribers.size > 0) {
      start();
    }
  });
}

/**
 * Subscribes to the shared clock. The callback receives milliseconds
 * elapsed since the clock first started — a single monotonic timeline, so
 * two figures with the same tempo stay in phase with each other rather
 * than drifting apart by however long apart they mounted.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToClock(tick: Tick): () => void {
  subscribers.add(tick);
  start();
  return () => {
    subscribers.delete(tick);
    if (subscribers.size === 0) stop();
  };
}

/** Milliseconds on the shared timeline. Exposed for phase alignment. */
export function clockNow(): number {
  return elapsed;
}

/** Diagnostics: how many figures are currently animating. */
export function clockSubscriberCount(): number {
  return subscribers.size;
}

/** Test seam — resets the module between runs. */
export function __resetClock(): void {
  stop();
  subscribers.clear();
  elapsed = 0;
}
