import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { type Accent, accent } from "../../design/accents";
import { SPRING_SNAP } from "../../design/motion";

export interface ChipProps {
  label: string;
  icon?: LucideIcon;
  tone?: Accent;
  active?: boolean;
  onClick?: () => void;
  /** Shared `layoutId` for the sliding active pill within a group. */
  layoutGroup?: string;
  className?: string;
}

/**
 * Filter chip.
 *
 * When several chips share a `layoutGroup`, the active background is a
 * single element that animates between them rather than one fading out
 * while another fades in. Motion's shared-layout machinery interpolates
 * its position, so selection reads as one object moving — the same
 * illusion a native segmented control creates, and the reason it feels
 * continuous instead of switched.
 */
export function Chip({
  label,
  icon: Icon,
  tone = "cyan",
  active = false,
  onClick,
  layoutGroup,
  className = "",
}: ChipProps) {
  const a = accent(tone);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={SPRING_SNAP}
      aria-pressed={active}
      className={[
        "relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2",
        "text-[11px] font-bold tracking-wide transition-colors duration-200",
        active ? "" : "border border-line text-ink-3 hover:text-ink-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={active ? { color: "var(--void)" } : undefined}
    >
      {active && (
        <motion.span
          layoutId={layoutGroup}
          transition={SPRING_SNAP}
          className="absolute inset-0 rounded-full"
          style={{
            background: a.color,
            boxShadow: `0 6px 20px -8px ${a.color}`,
          }}
        />
      )}
      {Icon && <Icon className="relative z-10 h-3.5 w-3.5" strokeWidth={2.5} />}
      <span className="relative z-10">{label}</span>
    </motion.button>
  );
}

export default Chip;
