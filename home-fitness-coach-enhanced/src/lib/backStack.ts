/**
 * Hardware/gesture back for overlays. Any sheet, drawer or full-screen overlay registers a close handler
 * while it is open; the app's back handler calls popBack() first so Back closes the top-most overlay
 * before it navigates between screens.
 */
import { useEffect, useRef } from "react";

const stack: Array<() => void> = [];

export function useBackClose(active: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const h = () => ref.current();
    stack.push(h);
    return () => { const i = stack.lastIndexOf(h); if (i >= 0) stack.splice(i, 1); };
  }, [active]);
}

/** Closes the top-most overlay. Returns true if one was closed. */
export function popBack(): boolean {
  const h = stack[stack.length - 1];
  if (!h) return false;
  h();
  return true;
}
