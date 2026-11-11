import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Music } from "lucide-react";
import { lofiMusic, LofiMode } from "../core/lofiMusic";
import { tapFeedback } from "../core/haptics";

interface LofiMusicButtonProps {
  mode?: LofiMode;
  showLabel?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export default function LofiMusicButton({
  mode,
  showLabel = false,
  className = "",
  size = "sm",
}: LofiMusicButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMode, setCurrentMode] = useState<LofiMode>(mode || "soothing");

  useEffect(() => {
    const unsub = lofiMusic.subscribe((state) => {
      setIsPlaying(state.isPlaying);
      setCurrentMode(state.mode);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (mode && isPlaying) {
      lofiMusic.setMode(mode);
    }
  }, [mode, isPlaying]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    tapFeedback();
    if (mode && !isPlaying) {
      lofiMusic.setMode(mode);
    }
    lofiMusic.toggle();
  };

  const isSmall = size === "sm";

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      whileHover={{ scale: 1.05 }}
      aria-label={isPlaying ? "Mute Lofi Music" : "Play Lofi Music"}
      title={
        isPlaying
          ? `Mute ${currentMode === "cinematic" ? "Cinematic Workout Lofi" : "Soothing Ambient Lofi"}`
          : `Play ${mode === "cinematic" ? "Cinematic Workout Lofi" : "Soothing Ambient Lofi"}`
      }
      className={`relative inline-flex items-center gap-1.5 rounded-full border transition-all ${
        isPlaying
          ? "border-cyan-400/40 bg-cyan-950/40 text-cyan-300 shadow-sm backdrop-blur"
          : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] backdrop-blur"
      } ${isSmall ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${className}`}
    >
      {isPlaying ? (
        <div className="flex items-end gap-0.5 h-3.5 w-3.5 px-0.5 justify-center">
          <motion.span
            className="w-0.5 h-3 bg-cyan-400 rounded-full origin-bottom will-change-transform"
            animate={{ scaleY: [0.3, 1, 0.45] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="w-0.5 h-3 bg-cyan-400 rounded-full origin-bottom will-change-transform"
            animate={{ scaleY: [0.6, 0.3, 0.9] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
          />
          <motion.span
            className="w-0.5 h-3 bg-cyan-400 rounded-full origin-bottom will-change-transform"
            animate={{ scaleY: [0.4, 0.85, 0.25] }}
            transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          />
        </div>
      ) : (
        <Music className={isSmall ? "h-3.5 w-3.5" : "h-4 w-4"} />
      )}

      {showLabel ? (
        <span className="font-extrabold tracking-tight">
          {isPlaying ? (
            <span className="flex items-center gap-1">
              <span>Lofi Beats</span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </span>
          ) : (
            "Lofi Music"
          )}
        </span>
      ) : (
        <span className="text-[11px] font-black uppercase tracking-wider">
          {isPlaying ? "Lofi ON" : "Lofi"}
        </span>
      )}
    </motion.button>
  );
}
