import { useEffect, useRef } from "react";

/**
 * Holds a screen wake lock while `active` is true.
 *
 * A workout timer whose screen dims mid-plank is the kind of failure that
 * makes people stop using an app, and it is invisible in every review
 * except the one-star ones. The Screen Wake Lock API fixes it on Android
 * Chrome and iOS 16.4+; elsewhere this is a no-op rather than an error.
 *
 * The lock is re-acquired on `visibilitychange` because the browser
 * releases it automatically whenever the tab is backgrounded — without
 * that listener the lock silently stops working the first time a user
 * checks a notification mid-session.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const request = async () => {
      try {
        if (!("wakeLock" in navigator) || document.visibilityState !== "visible") {
          return;
        }
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // Denied by policy, low battery, or unsupported. Not recoverable
        // and not worth surfacing — the timer still works.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
