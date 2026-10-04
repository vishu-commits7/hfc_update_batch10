import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Flame,
  Download,
  Maximize2,
} from "lucide-react";
import { MOTIVATION_STORIES, type MotivationStory } from "./GymBeastMotivationReel";
import { audio } from "../lib/audio";
import { tapFeedback, celebrateFeedback } from "../lib/haptics";

interface GymMotivationGalleryProps {
  onOpenStoryReel: (index: number) => void;
}

export default function GymMotivationGallery({
  onOpenStoryReel,
}: GymMotivationGalleryProps) {
  const [hypeCounts, setHypeCounts] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem("kinetic_beast_hypes") || "{}");
    } catch {
      return {};
    }
  });

  const handleHype = (e: React.MouseEvent, storyId: string) => {
    e.stopPropagation();
    celebrateFeedback();
    audio.playBeastDrop();

    const current = (hypeCounts[storyId] || 45) + 1;
    const nextHypes = { ...hypeCounts, [storyId]: current };
    setHypeCounts(nextHypes);
    localStorage.setItem("kinetic_beast_hypes", JSON.stringify(nextHypes));
  };

  const handleDownload = async (e: React.MouseEvent, story: MotivationStory) => {
    e.stopPropagation();
    tapFeedback();
    try {
      const response = await fetch(story.image);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gym-beast-${story.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(story.image, "_blank");
    }
  };

  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Flame className="h-3.5 w-3.5 fill-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-ink">
              Daily Savage Fuel
            </h2>
            <p className="text-[10px] text-ink-4">
              Tap any visual for full-screen immersive beast reels
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            onOpenStoryReel(0);
          }}
          className="text-[11px] font-black uppercase text-amber-400 hover:text-amber-300 flex items-center gap-1 active:scale-95 transition-transform"
        >
          <span>View All</span>
          <Maximize2 className="h-3 w-3" />
        </button>
      </div>

      {/* Horizontal Swipeable Cards for Mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {MOTIVATION_STORIES.map((story, idx) => {
          const hypes = hypeCounts[story.id] || 48 + idx * 7;
          return (
            <motion.div
              key={story.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                tapFeedback();
                onOpenStoryReel(idx);
              }}
              className="group relative h-64 w-44 shrink-0 rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-lg bg-slate-900 select-none"
            >
              {/* Image */}
              <img
                src={story.image}
                alt={story.title}
                className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />

              {/* Gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60" />

              {/* Tag pill top left */}
              <div className="absolute top-2.5 left-2.5">
                <span
                  className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-black"
                  style={{ background: story.accentColor }}
                >
                  {story.tag}
                </span>
              </div>

              {/* Fullscreen icon top right */}
              <div className="absolute top-2.5 right-2.5 h-6 w-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80">
                <Maximize2 className="h-3 w-3" />
              </div>

              {/* Quote & details at bottom */}
              <div className="absolute inset-x-2.5 bottom-2.5 flex flex-col gap-1.5">
                <h3 className="text-xs font-black uppercase text-white truncate drop-shadow">
                  {story.title}
                </h3>
                <p className="text-[10px] text-white/80 line-clamp-2 leading-tight italic">
                  "{story.quote}"
                </p>

                {/* Micro Action Bar */}
                <div className="flex items-center justify-between pt-1 border-t border-white/15">
                  <button
                    type="button"
                    onClick={(e) => handleHype(e, story.id)}
                    className="flex items-center gap-1 text-[10px] font-bold text-amber-400 active:scale-90 transition-transform"
                  >
                    <Flame className="h-3 w-3 fill-amber-400" />
                    <span>{hypes}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDownload(e, story)}
                    className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center text-white/70 hover:text-white active:scale-90 transition-transform"
                    title="Save Wallpaper"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
