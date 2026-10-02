import { useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect` on purpose:
 * it reads the match during render instead of after mount, so a layout
 * that branches on viewport width (the phone bottom bar vs the desktop
 * side rail) renders correctly on the very first paint instead of
 * flashing the mobile layout for one frame on a wide screen.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(query).matches
        : false,
    () => false, // server snapshot — mobile-first, so assume the narrow case
  );
}

/** Breakpoints, named once. Matches the Tailwind scale in use. */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
export const useIsTablet = () => useMediaQuery("(min-width: 640px)");
export const useIsFinePointer = () => useMediaQuery("(pointer: fine)");
