/**
 * OBSIDIAN — UI primitives
 *
 * Everything here is theme-driven and presentational. No primitive reads
 * app state, touches localStorage or knows what a workout is; that keeps
 * them reusable and keeps the screens honest about where their state
 * lives.
 */
export { default as GlassCard } from "./GlassCard";
export type { GlassCardProps } from "./GlassCard";

export { default as MagneticButton, PressableRow } from "./MagneticButton";
export type { MagneticButtonProps } from "./MagneticButton";

export { default as ProgressRing } from "./ProgressRing";
export type { ProgressRingProps } from "./ProgressRing";

export { default as AnimatedNumber } from "./AnimatedNumber";
export type { AnimatedNumberProps } from "./AnimatedNumber";

export { default as StatTile } from "./StatTile";
export type { StatTileProps } from "./StatTile";

export { default as StreakGraph } from "./StreakGraph";
export type { StreakGraphProps, StreakPoint } from "./StreakGraph";

export { default as Drawer } from "./Drawer";
export type { DrawerProps } from "./Drawer";

export { default as Chip } from "./Chip";
export type { ChipProps } from "./Chip";

export { default as SectionHeader } from "./SectionHeader";
export type { SectionHeaderProps } from "./SectionHeader";

export { default as PulseOrb } from "./PulseOrb";
export type { PulseOrbProps } from "./PulseOrb";

export { default as LiveMetricsBar } from "./LiveMetricsBar";
export type { LiveMetricsBarProps } from "./LiveMetricsBar";

export { default as MotivationBanner } from "./MotivationBanner";
export type { MotivationBannerProps } from "./MotivationBanner";

export { default as WeeklyHeatmap } from "./WeeklyHeatmap";
export type { WeeklyHeatmapProps, HeatmapDay } from "./WeeklyHeatmap";

