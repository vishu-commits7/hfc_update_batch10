import React, { useCallback, useEffect, useId, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import {
  drawerVariants,
  scrimVariants,
  sheetVariants,
} from "../../design/motion";
import { useIsTablet } from "../../hooks/useMediaQuery";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Sub-line under the title. */
  subtitle?: string;
  /** Rendered in the header, right of the title. */
  action?: React.ReactNode;
  children?: React.ReactNode;
  /** Width of the side panel on tablet and up. */
  width?: number;
}

/**
 * Responsive slide-over.
 *
 * Side panel from the right at ≥640px, bottom sheet below it. That is not
 * cosmetic: a side panel on a phone either covers the whole screen (in
 * which case it should have been a screen) or leaves a useless sliver,
 * and it enters from the edge furthest from the thumb. A bottom sheet
 * enters from where the hand already is and can be dismissed by flicking
 * it back down — which is wired up here with a drag gesture that commits
 * on either distance or velocity, so a fast short flick closes it exactly
 * like a slow long drag.
 *
 * Accessibility is handled properly rather than approximately:
 * `role="dialog"` + `aria-modal`, Escape to close, focus moved in on open
 * and restored to the trigger on close, Tab cycled within the panel, and
 * background scroll locked while it is open.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  action,
  children,
  width = 440,
}: DrawerProps) {
  const isTablet = useIsTablet();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  /* --- Focus management ------------------------------------------- */
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    // Defer to the next frame: the panel is not in the DOM yet on the
    // tick the `open` prop flips.
    const id = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        '[data-autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (first ?? panelRef.current)?.focus();
    });
    return () => {
      cancelAnimationFrame(id);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  /* --- Escape + focus trap ----------------------------------------- */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  /* --- Scroll lock -------------------------------------------------- */
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]" onKeyDown={onKeyDown}>
          <motion.div
            variants={scrimVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 backdrop-blur-[3px]"
            style={{ background: "var(--scrim)" }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            variants={isTablet ? drawerVariants : sheetVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            /* Flick-to-dismiss, bottom sheet only. */
            drag={isTablet ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 640) onClose();
            }}
            className={[
              "glass absolute flex flex-col outline-none",
              isTablet
                ? "right-0 top-0 h-full rounded-l-2xl2 border-y-0 border-r-0"
                : "inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl2 border-x-0 border-b-0",
            ].join(" ")}
            style={{
              width: isTablet ? Math.min(width, 560) : undefined,
              background: "var(--carbon)",
              paddingBottom: isTablet ? undefined : "var(--safe-b)",
            }}
          >
            {/* Grab handle — the affordance that tells a thumb the sheet
                is draggable before it tries. */}
            {!isTablet && (
              <div className="flex justify-center pb-1 pt-3">
                <span className="h-1 w-10 rounded-full bg-[var(--line-strong)]" />
              </div>
            )}

            <header
              className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4"
              style={{ paddingTop: isTablet ? "calc(var(--safe-t) + 18px)" : undefined }}
            >
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="font-display truncate text-lg font-extrabold tracking-tight text-ink"
                >
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-0.5 truncate text-xs text-ink-3">{subtitle}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {action}
                <motion.button
                  onClick={onClose}
                  aria-label="Close"
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.06 }}
                  className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-3 transition-colors hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default Drawer;
