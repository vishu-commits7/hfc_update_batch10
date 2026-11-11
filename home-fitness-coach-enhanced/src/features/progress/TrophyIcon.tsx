import { Dumbbell, Flame, Swords, Medal, Lock } from "lucide-react";
import { TIER_COLOR, type TrophyDef } from "./progress";

const ICONS = { dumbbell: Dumbbell, flame: Flame, swords: Swords, medal: Medal } as const;

/** A round tier-coloured trophy badge. Locked trophies are dim with a padlock. */
export default function TrophyIcon({ def, locked, size = 56 }: { def: Pick<TrophyDef, "icon" | "tier">; locked?: boolean; size?: number }) {
  const Icon = locked ? Lock : ICONS[def.icon];
  const c = TIER_COLOR[def.tier];
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size, height: size,
        background: locked ? "var(--graphite)" : `radial-gradient(circle at 30% 25%, ${c}55, ${c}1f 70%)`,
        border: `2px solid ${locked ? "var(--line)" : c}`,
        boxShadow: locked ? "none" : `0 0 ${size / 3}px ${c}40`,
      }}
    >
      <Icon style={{ width: size * 0.45, height: size * 0.45, color: locked ? "var(--ink-4)" : c }} />
    </span>
  );
}
