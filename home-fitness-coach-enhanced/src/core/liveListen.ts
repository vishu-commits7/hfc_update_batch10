/**
 * A live listener that comes back by itself.
 *
 * A Firestore listener stops for good after any error (a refused read, a dropped connection on some phones), and
 * a screen with a dead listener looks fine but never updates again. That is what made chat messages "disappear":
 * the chat screen opened before the first message, its listener was refused once, and nothing ever showed after.
 * This wrapper waits and listens again: 1 s, 2 s, 4 s, ... at most 30 s between tries, until it is stopped.
 *
 * `start` opens one listener and must call the given onError when it fails; it returns that listener's stop function.
 * `onFirstError` is told about the first failure only (so a screen can show a message once, not every retry).
 */
export function liveListen(
  start: (onError: (e: unknown) => void) => () => void,
  onFirstError?: (e: unknown) => void,
  schedule: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms),
  cancel: (t: unknown) => void = t => clearTimeout(t as ReturnType<typeof setTimeout>),
): () => void {
  let stop: (() => void) | null = null;
  let timer: unknown = null;
  let closed = false;
  let tries = 0;
  const go = () => {
    timer = null;
    if (closed) return;
    stop = start(e => {
      const s = stop; stop = null; s?.();
      if (tries === 0) onFirstError?.(e);
      if (closed) return;
      timer = schedule(go, Math.min(30_000, 1000 * 2 ** Math.min(tries++, 5)));
    });
  };
  go();
  return () => { closed = true; if (timer !== null) cancel(timer); const s = stop; stop = null; s?.(); };
}
