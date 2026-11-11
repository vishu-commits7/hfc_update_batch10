import {
  Target,
  Award,
  Trophy,
  Flame,
  Clock,
  Compass,
  BookOpen,
  Star,
  Sun,
  Moon,
  Calendar,
  Zap,
} from "lucide-react";

interface AchievementBadgeIconProps {
  name: string;
  isUnlocked: boolean;
  className?: string;
}

/** Returns the icon for the given badge name with proper unlocked/locked styling.
 *  Locked badges show a muted ghost version of the same icon (not a padlock),
 *  so the user can see what they're working toward. */
export function AchievementBadgeIcon({
  name,
  isUnlocked,
  className = "h-5 w-5",
}: AchievementBadgeIconProps) {
  // Map badge name → icon component + unlocked color
  const iconMap: Record<string, { Icon: React.ElementType; color: string }> = {
    Target:   { Icon: Target,   color: "#10b981" }, // emerald
    Award:    { Icon: Award,    color: "#22d3ee" }, // cyan
    Trophy:   { Icon: Trophy,   color: "#fbbf24" }, // amber
    Flame:    { Icon: Flame,    color: "#f97316" }, // orange
    Clock:    { Icon: Clock,    color: "#60a5fa" }, // blue
    Compass:  { Icon: Compass,  color: "#2dd4bf" }, // teal
    BookOpen: { Icon: BookOpen, color: "#818cf8" }, // indigo
    Star:     { Icon: Star,     color: "#facc15" }, // yellow (filled)
    Sun:      { Icon: Sun,      color: "#f59e0b" }, // amber warm
    Moon:     { Icon: Moon,     color: "#c084fc" }, // purple
    Calendar: { Icon: Calendar, color: "#22d3ee" }, // cyan
    Zap:      { Icon: Zap,      color: "#fde68a" }, // amber light (filled)
  };

  const entry = iconMap[name] ?? { Icon: Trophy, color: "#fbbf24" };
  const { Icon, color } = entry;

  if (!isUnlocked) {
    // Ghost/silhouette version — same icon, desaturated, no fill
    return (
      <Icon
        className={className}
        style={{ color: "rgba(113, 113, 122, 0.55)", opacity: 0.7 }}
      />
    );
  }

  // Filled icons for Star and Zap feel more premium
  const shouldFill = name === "Star" || name === "Zap";

  return (
    <Icon
      className={`${className}${shouldFill ? " fill-current" : ""}`}
      style={{ color }}
    />
  );
}
