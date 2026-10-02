import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  useMotionValue,
  useSpring,
  useReducedMotion,
  type MotionValue,
} from "motion/react";

export interface MagneticOptions {
  /**
   * How far the element is allowed to travel toward the pointer, in px.
   * Past roughly 14px the element visibly detaches from its own layout
   * box and the effect reads as a bug rather than as attraction.
   */
  strength?: number;
  /**
   * Extra catchment area outside the element's bounds, in px. Without it
   * the pull only starts once the pointer is already on the target,
   * which defeats the purpose — the point is that the control reaches
   * out to meet the cursor.
   */
  radius?: number;
  /** Independent multiplier for vertical pull. */
  strengthY?: number;
}

export interface Magnetic {
  ref: RefObject<HTMLElement | null>;
  x: MotionValue<number>;
  y: MotionValue<number>;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerLeave: () => void;
}

/**
 * Magnetic pointer tracking.
 *
 * The element eases toward the cursor while the cursor is nearby, and
 * springs back when it leaves. Three details separate a good version of
 * this from the many bad ones:
 *
 *  1. FALLOFF. Pull scales with distance from the element's centre, so
 *     the attraction builds smoothly instead of snapping on at the edge
 *     of the catchment area.
 *
 *  2. FINE POINTERS ONLY. On touch there is no hover state, so a
 *     "magnetic" element would jump under the finger at the exact moment
 *     it is being tapped — actively harmful to aim. React's synthetic
 *     pointer events carry `pointerType`, which is checked on every move.
 *
 *  3. NO LAYOUT READS IN THE HOT PATH. `getBoundingClientRect()` forces
 *     style recalculation; calling it per `pointermove` at 120Hz is a
 *     measurable frame cost. The rect is cached on entry and only
 *     refreshed when the pointer has been away.
 *
 * Returns motion values rather than state — nothing re-renders while the
 * pointer moves; the transform is written straight to the compositor.
 */
export function useMagnetic({
  strength = 10,
  radius = 90,
  strengthY,
}: MagneticOptions = {}): Magnetic {
  const ref = useRef<HTMLElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const reduced = useReducedMotion();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const x = useSpring(rawX, { stiffness: 150, damping: 18, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 150, damping: 18, mass: 0.6 });

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (reduced || e.pointerType !== "mouse") return;
      const el = ref.current;
      if (!el) return;

      let rect = rectRef.current;
      if (!rect) {
        rect = el.getBoundingClientRect();
        rectRef.current = rect;
      }

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      // Normalise against the element's own half-extent plus the catchment
      // radius, so a wide button and a small icon both reach full pull at
      // the same *visual* distance rather than the same pixel distance.
      const reachX = rect.width / 2 + radius;
      const reachY = rect.height / 2 + radius;
      const falloff = Math.min(
        1,
        Math.hypot(dx / reachX, dy / reachY),
      );
      const pull = 1 - falloff * falloff; // quadratic: gentle at the edge

      rawX.set((dx / reachX) * strength * pull);
      rawY.set((dy / reachY) * (strengthY ?? strength) * pull);
    },
    [radius, rawX, rawY, reduced, strength, strengthY],
  );

  const onPointerLeave = useCallback(() => {
    rectRef.current = null;
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  return { ref, x, y, onPointerMove, onPointerLeave };
}
