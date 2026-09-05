import { useEffect, useRef, useState } from "react";

/**
 * Drives a small photo-burst loop: cycles 0..n-1..0..n-1... (ping-pong) so a
 * short frame burst (top → mid → bottom) reads as a real rep going down and
 * back up, then repeating — instead of a jarring snap back to frame 0.
 *
 * Cadence: the first couple of transitions play at `fastIntervalMs` (a
 * quick, attention-grabbing flick through the burst) and every transition
 * after that settles into the slower, steady `intervalMs` — rapid intro,
 * then unhurried loop, instead of one constant tempo throughout.
 *
 * Also exposes `jump(dir)` / `goTo(index)` so a caller can wire up manual
 * control (swipe, tap-a-dot) alongside the automatic loop — a manual move
 * just retargets where the autoplay continues from, it never has to be
 * "paused" to be steered.
 */
export function usePingPongFrame(
  count: number,
  intervalMs: number,
  opts?: { paused?: boolean; fastIntervalMs?: number; fastTransitions?: number }
) {
  const [index, setIndex] = useState(0);
  const dirRef = useRef(1);
  const transitionsRef = useRef(0);
  const paused = opts?.paused ?? false;
  const fastIntervalMs = opts?.fastIntervalMs ?? Math.max(160, Math.round(intervalMs * 0.4));
  const fastTransitions = opts?.fastTransitions ?? 2;

  useEffect(() => {
    if (count <= 1 || paused) return;
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const isFast = transitionsRef.current < fastTransitions;
      timeoutId = setTimeout(tick, isFast ? fastIntervalMs : intervalMs);
    };

    const tick = () => {
      setIndex(i => {
        let next = i + dirRef.current;
        if (next >= count) { dirRef.current = -1; next = Math.max(0, count - 2); }
        else if (next < 0) { dirRef.current = 1; next = Math.min(1, count - 1); }
        return next;
      });
      transitionsRef.current += 1;
      scheduleNext();
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [count, intervalMs, paused, fastIntervalMs, fastTransitions]);

  const jump = (dir: 1 | -1) => {
    if (count <= 1) return;
    dirRef.current = dir;
    transitionsRef.current += 1;
    setIndex(i => Math.min(count - 1, Math.max(0, i + dir)));
  };

  const goTo = (i: number) => {
    if (count <= 1) return;
    const clamped = Math.min(count - 1, Math.max(0, i));
    dirRef.current = 1;
    transitionsRef.current += 1;
    setIndex(clamped);
  };

  return { index: count <= 1 ? 0 : index, jump, goTo };
}
