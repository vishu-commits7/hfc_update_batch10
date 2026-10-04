import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Music } from "lucide-react";
import { lofiMusic, LofiMode } from "../lib/lofiMusic";
import { tapFeedback } from "../lib/haptics";

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
      whileTap={{ scale: 0.94 }}
      aria-label={isPlaying ? "Mute Lofi Music" : "Play Lofi Music"}
      title={
        isPlaying
          ? `Mute ${currentMode === "cinematic" ? "Cinematic Workout Lofi" : "Soothing Ambient Lofi"}`
          : `Play ${mode === "cinematic" ? "Cinematic Workout Lofi" : "Soothing Ambient Lofi"}`
      }
      className={`relative inline-flex items-center gap-2 rounded-full border transition-all ${
        isPlaying
          ? "border-cyan-400/40 bg-slate-900/90 text-cyan-300 shadow-sm shadow-cyan-500/20 backdrop-blur"
          : "border-slate-200/80 bg-white/90 text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-2xs backdrop-blur"
      } ${isSmall ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${className}`}
    >
      {isPlaying ? (
        <div className="flex items-end gap-0.5 h-3.5 w-3.5 px-0.5 justify-center">
          <motion.span
            className="w-0.5 bg-cyan-400 rounded-full"
            animate={{ height: ["30%", "100%", "45%"] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="w-0.5 bg-cyan-400 rounded-full"
            animate={{ height: ["60%", "30%", "90%"] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
          />
          <motion.span
            className="w-0.5 bg-cyan-400 rounded-full"
            animate={{ height: ["40%", "85%", "25%"] }}
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
        <span className="text-[10px] font-black uppercase tracking-wider">
          {isPlaying ? "Lofi ON" : "Lofi"}
        </span>
      )}
    </motion.button>
  );
}
