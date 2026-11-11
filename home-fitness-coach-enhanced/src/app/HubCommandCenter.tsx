import { motion } from "motion/react";
import {
  Dumbbell,
  Film,
  Sparkles,
  Swords,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { tapFeedback } from "../core/haptics";
import { SPRING_SNAP } from "../design/motion";

export type HubNavTarget =
  | "dashboard"
  | "reels"
  | "ai-generator"
  | "beast-duels"
  | "profile-hub"
  | "exercise-library";

export interface HubCommandCenterProps {
  currentView: string;
  onNavigate: (view: HubNavTarget) => void;
  className?: string;
  unreadCount?: number;
}

interface HubTabConfig {
  view: HubNavTarget;
  label: string;
  icon: LucideIcon;
  subtext?: string;
  isCenterHero?: boolean;
}

// Arena is the heart of the app, so it takes the raised centre slot.
const HUB_TABS: HubTabConfig[] = [
  { view: "dashboard", label: "Train", icon: Dumbbell, subtext: "Today's Plan" },
  { view: "reels", label: "Feed", icon: Film, subtext: "Motivation" },
  { view: "beast-duels", label: "Arena", icon: Swords, subtext: "1v1 Showdown", isCenterHero: true },
  { view: "ai-generator", label: "Coach", icon: Sparkles, subtext: "Smart Protocol" },
  { view: "profile-hub", label: "Profile", icon: UserRound, subtext: "Records & PRs" },
];

/**
 * HubCommandCenter — Native Mobile Tab Bar & Navigation Dock.
 *
 * Designed to Google Play Store production quality:
 * - Editorial dark dock surface (#12141C) with subtle 1px hairline border.
 * - Solid icon rendering with explicit width/height to eliminate icon vanishing during re-renders.
 * - Arena sits in the raised centre slot and keeps its accent colour even when another tab is open.
 * - Respects safe-area-inset-bottom clearance.
 */
export default function HubCommandCenter({
  currentView,
  onNavigate,
  className = "",
}: HubCommandCenterProps) {
  return (
    <nav
      aria-label="Bottom Navigation Bar"
      className={`fixed inset-x-0 bottom-0 z-50 flex items-center justify-center border-t border-zinc-800 bg-[#0A0A0C] pb-[env(safe-area-inset-bottom,0px)] ${className}`}
    >
      <div className="relative flex h-16 w-full max-w-lg items-center justify-around px-2">
        {HUB_TABS.map((tab) => {
          const isActive = currentView === tab.view;
          const Icon = tab.icon;

          if (tab.isCenterHero) {
            return (
              <motion.button
                key={tab.view}
                type="button"
                onClick={() => {
                  tapFeedback();
                  onNavigate(tab.view);
                }}
                transition={SPRING_SNAP}
                aria-current={isActive ? "page" : undefined}
                className="relative flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-end px-2 pb-1 focus:outline-none cursor-pointer select-none"
              >
                <div
                  className={`-mt-5 flex h-[52px] w-[52px] items-center justify-center rounded-2xl border-4 border-[#0A0A0C] transition-colors duration-150 ${
                    isActive
                      ? "bg-[#C8FF3D] text-black shadow-[0_0_18px_rgba(200,255,61,0.45)]"
                      : "bg-[#7AA2FF] text-black"
                  }`}
                >
                  <Icon
                    style={{ width: "24px", height: "24px", flexShrink: 0 }}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span
                  className={`mt-0.5 text-[11px] font-black uppercase tracking-wider transition-colors ${
                    isActive ? "text-[#C8FF3D]" : "text-[#C4C4CC]"
                  }`}
                >
                  {tab.label}
                </span>
              </motion.button>
            );
          }

          return (
            <motion.button
              key={tab.view}
              type="button"
              onClick={() => {
                tapFeedback();
                onNavigate(tab.view);
              }}
              transition={SPRING_SNAP}
              aria-current={isActive ? "page" : undefined}
              className="relative flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center px-2 py-1 focus:outline-none cursor-pointer select-none"
            >
              {isActive && (
                <motion.span
                  layoutId="hub-active-pill"
                  transition={SPRING_SNAP}
                  className="absolute inset-x-2 inset-y-1 rounded-xl bg-[#141418] border border-zinc-800"
                />
              )}

              <div className="relative z-10 flex flex-col items-center gap-1">
                <Icon
                  style={{ width: "20px", height: "20px", flexShrink: 0 }}
                  className={`transition-colors duration-150 ${
                    isActive ? "text-[#7AA2FF]" : "text-[#9A9AA6] hover:text-[#C4C4CC]"
                  }`}
                  strokeWidth={isActive ? 2.5 : 1.9}
                />
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    isActive ? "text-[#7AA2FF] font-black" : "text-[#9A9AA6]"
                  }`}
                >
                  {tab.label}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
