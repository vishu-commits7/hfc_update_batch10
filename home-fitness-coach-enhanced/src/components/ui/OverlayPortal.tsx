import { createPortal } from "react-dom";
import type { ReactNode } from "react";

/**
 * Renders overlays on document.body. Screens animate with CSS transforms, and a
 * `position: fixed` child of a transformed parent is positioned against that
 * parent, not the screen. That is what made the comments sheet slide *under*
 * the bottom navigation and hide its text box.
 */
export default function OverlayPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
