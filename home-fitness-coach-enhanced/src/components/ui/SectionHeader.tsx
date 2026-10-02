import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { staggerChild } from "../../design/motion";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Renders a trailing text action with a chevron. */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * Section heading.
 *
 * One consistent header for every band on every screen. The previous
 * build had five variations of this shape — different sizes, different
 * casing, different action affordances — which is the main reason the
 * dashboard scanned as a stack of unrelated widgets rather than one page.
 */
export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  className = "",
}: SectionHeaderProps) {
  return (
    <motion.div
      variants={staggerChild}
      className={`flex items-end justify-between gap-3 ${className}`}
    >
      <div className="min-w-0">
        <h2 className="font-display truncate text-[15px] font-extrabold tracking-tight text-ink">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-ink-3">{subtitle}</p>
        )}
      </div>

      {actionLabel && onAction && (
        <motion.button
          type="button"
          onClick={onAction}
          whileTap={{ scale: 0.95 }}
          className="group inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-cyan-glow"
        >
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </motion.button>
      )}
    </motion.div>
  );
}

export default SectionHeader;
