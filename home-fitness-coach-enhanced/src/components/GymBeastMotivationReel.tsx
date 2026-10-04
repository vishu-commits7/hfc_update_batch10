import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Flame,
  Volume2,
  VolumeX,
  Share2,
  Download,
  Zap,
  Check,
} from "lucide-react";
import { audio } from "../lib/audio";
import { tapFeedback, celebrateFeedback } from "../lib/haptics";
import gymBeastChalk from "../assets/ui/gym-beast-chalk.jpg";
import gymBeastIron from "../assets/ui/gym-beast-iron.jpg";
import gymBeastPump from "../assets/ui/gym-beast-pump.jpg";
import gymBeastAbs from "../assets/ui/gym-beast-abs.jpg";
import gymBeastBoxing from "../assets/ui/gym-beast-boxing.jpg";
import gymBeastSquat from "../assets/ui/gym-beast-squat.jpg";

export interface MotivationStory {
  id: string;
  title: string;
  tag: string;
  quote: string;
  author: string;
  image: string;
  accentColor: string;
  musicMood: string;
}

export const MOTIVATION_STORIES: MotivationStory[] = [
  {
    id: "chalk-fire",
    title: "Chalk & Fire",
    tag: "POWERLIFTING",
    quote: "The pain of today is the victory of tomorrow. Step onto the platform and take what is yours.",
    author: "BEAST CODE #01",
    image: gymBeastChalk,
    accentColor: "#f59e0b",
    musicMood: "Raw Heavy Drive",
  },
  {
    id: "iron-temple",
    title: "The Iron Temple",
    tag: "STRENGTH & HONESTY",
    quote: "Iron never lies to you. 500 lbs is 500 lbs. Respect the weight, master your fear, and lift.",
    author: "BEAST CODE #02",
    image: gymBeastIron,
    accentColor: "#06b6d4",
    musicMood: "Deep Sub-Bass Focus",
  },
  {
    id: "beyond-failure",
    title: "Beyond Failure",
    tag: "HYPERTROPHY",
    quote: "The last three or four reps is what makes the muscle grow. This area of pain divides a champion from someone who isn't.",
    author: "BEAST CODE #03",
    image: gymBeastPump,
    accentColor: "#10b981",
    musicMood: "Maximum Pump",
  },
  {
    id: "aesthetic-beast",
    title: "Warrior Mindset",
    tag: "CALISTHENICS & DISCIPLINE",
    quote: "Your body can stand almost anything. It's your mind you have to conquer. Rule yourself, rule your world.",
    author: "BEAST CODE #04",
    image: gymBeastAbs,
    accentColor: "#8b5cf6",
    musicMood: "Ascension Beats",
  },
  {
    id: "boxing-warrior",
    title: "The Champion's Ring",
    tag: "FIGHT DISCIPLINE",
    quote: "It's not about how hard you hit, it's about how hard you can get hit and keep moving forward.",
    author: "BEAST CODE #05",
    image: gymBeastBoxing,
    accentColor: "#ef4444",
    musicMood: "Heavy Bag Rhythms",
  },
  {
    id: "squat-iron",
    title: "The Heavy Hole",
    tag: "MAX POWER",
    quote: "When 400 lbs is on your back, you either rise or break. Champions always find a way to rise.",
    author: "BEAST CODE #06",
    image: gymBeastSquat,
    accentColor: "#eab308",
    musicMood: "Maximum Loading",
  },
];

interface GymBeastMotivationReelProps {
  isOpen: boolean;
  initialIndex?: number;
  onClose: () => void;
}

const STORY_DURATION_MS = 6500;

export default function GymBeastMotivationReel({
  isOpen,
  initialIndex = 0,
  onClose,
}: GymBeastMotivationReelProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hypeCounts, setHypeCounts] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem("kinetic_beast_hypes") || "{}");
    } catch {
      return {};
    }
  });
  const [floatingParticles, setFloatingParticles] = useState<
    { id: number; x: number; y: number }[]
  >([]);
  const [copiedShare, setCopiedShare] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const activeStory = MOTIVATION_STORIES[currentIndex] || MOTIVATION_STORIES[0];
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedBeforePauseRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(initialIndex, MOTIVATION_STORIES.length - 1));
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = Date.now();
      audio.playBeastDrop();
    }
  }, [isOpen, initialIndex]);

  // Story progression loop
  useEffect(() => {
    if (!isOpen || isPaused) {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      return;
    }

    const start = Date.now() - elapsedBeforePauseRef.current;
    startTimeRef.current = start;

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / STORY_DURATION_MS) * 100, 100);
      setProgress(pct);

      if (pct >= 100) {
        if (currentIndex < MOTIVATION_STORIES.length - 1) {
          setCurrentIndex((prev) => prev + 1);
          setProgress(0);
          elapsedBeforePauseRef.current = 0;
          startTimeRef.current = Date.now();
        } else {
          // Wrapped around or close
          onClose();
        }
      } else {
        timerRef.current = requestAnimationFrame(tick);
      }
    };

    timerRef.current = requestAnimationFrame(tick);
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [isOpen, isPaused, currentIndex, onClose]);

  const handlePause = () => {
    if (!isPaused) {
      elapsedBeforePauseRef.current = Date.now() - startTimeRef.current;
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    if (isPaused) {
      setIsPaused(false);
    }
  };

  const handleNext = useCallback(() => {
    tapFeedback();
    audio.playBeastClick();
    if (currentIndex < MOTIVATION_STORIES.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = Date.now();
    } else {
      onClose();
    }
  }, [currentIndex, onClose]);

  const handlePrev = useCallback(() => {
    tapFeedback();
    audio.playBeastClick();
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = Date.now();
    }
  }, [currentIndex]);

  const handleHype = (e: React.MouseEvent) => {
    e.stopPropagation();
    celebrateFeedback();
    audio.playBeastDrop();

    const storyId = activeStory.id;
    const current = (hypeCounts[storyId] || 42) + 1;
    const nextHypes = { ...hypeCounts, [storyId]: current };
    setHypeCounts(nextHypes);
    localStorage.setItem("kinetic_beast_hypes", JSON.stringify(nextHypes));

    // Spawn floating particle
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const newParticle = {
      id: Date.now() + Math.random(),
      x: rect.left + rect.width / 2 + (Math.random() * 40 - 20),
      y: rect.top - 10,
    };
    setFloatingParticles((prev) => [...prev.slice(-12), newParticle]);
    setTimeout(() => {
      setFloatingParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
    }, 1200);
  };

  const handleVoiceQuote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    tapFeedback();
    if (speaking) {
      audio.stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    setIsPaused(true);
    await audio.speak(activeStory.quote, {
      gender: "male",
      onEnd: () => {
        setSpeaking(false);
        setIsPaused(false);
      },
    });
  };

  const handleDownloadWallpaper = async (e: React.MouseEvent) => {
    e.stopPropagation();
    tapFeedback();
    try {
      const response = await fetch(activeStory.image);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gym-beast-${activeStory.id}-wallpaper.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(activeStory.image, "_blank");
    }
  };

  const handleShareStory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    tapFeedback();
    const shareText = `🔥 "${activeStory.quote}"\n— Savage Gym Motivation from Home Fitness Coach\n#BeastMode #GymMotivation #NoExcuses`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: activeStory.title,
          text: shareText,
        });
        return;
      } catch {
        // Fall back to copy
      }
    }
    navigator.clipboard?.writeText(shareText);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2400);
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 select-none"
        onMouseDown={handlePause}
        onMouseUp={handleResume}
        onTouchStart={handlePause}
        onTouchEnd={handleResume}
      >
        {/* Mobile Story Frame */}
        <div className="relative h-full w-full max-w-md overflow-hidden bg-black flex flex-col justify-between sm:h-[92vh] sm:rounded-[36px] sm:border sm:border-white/10 sm:shadow-2xl">
          {/* Background Image with Ken Burns zoom animation */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStory.id}
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="absolute inset-0 z-0"
            >
              <img
                src={activeStory.image}
                alt={activeStory.title}
                className="h-full w-full object-cover object-center"
              />
              {/* Gradients for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/80" />
              <div
                className="absolute inset-0 mix-blend-overlay opacity-30"
                style={{
                  background: `radial-gradient(circle at 50% 30%, ${activeStory.accentColor}, transparent 70%)`,
                }}
              />
            </motion.div>
          </AnimatePresence>

          {/* Top Story Progress Bars */}
          <div className="relative z-20 px-4 pt-4 sm:pt-6">
            <div className="flex gap-1.5 items-center">
              {MOTIVATION_STORIES.map((story, idx) => (
                <div
                  key={story.id}
                  className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-all duration-75"
                    style={{
                      width:
                        idx < currentIndex
                          ? "100%"
                          : idx === currentIndex
                          ? `${progress}%`
                          : "0%",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Top Bar Header */}
            <div className="mt-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-9 w-9 rounded-full p-0.5 flex items-center justify-center shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${activeStory.accentColor}, #000)`,
                  }}
                >
                  <img
                    src={activeStory.image}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      {activeStory.title}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-black"
                      style={{ background: activeStory.accentColor }}
                    >
                      {activeStory.tag}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/60 font-medium">
                    Daily Savage Fuel · {currentIndex + 1} of{" "}
                    {MOTIVATION_STORIES.length}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  tapFeedback();
                  onClose();
                }}
                className="h-9 w-9 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/90 active:scale-90 transition-transform"
                aria-label="Close stories"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Left / Right Tap zones for Story navigation */}
          <div className="absolute inset-x-0 top-24 bottom-36 z-10 flex">
            <div
              className="w-1/3 h-full cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
            />
            <div
              className="w-2/3 h-full cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
            />
          </div>

          {/* Floating Fire Particles */}
          <div className="pointer-events-none fixed inset-0 z-40">
            {floatingParticles.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 1, scale: 0.8, y: 0 }}
                animate={{ opacity: 0, scale: 2.2, y: -120 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                className="absolute flex items-center gap-1 text-amber-400 font-black text-sm drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]"
                style={{ left: p.x, top: p.y }}
              >
                <Flame className="h-5 w-5 fill-amber-400" />
                <span>+1 HYPE</span>
              </motion.div>
            ))}
          </div>

          {/* Bottom Card Content */}
          <div className="relative z-20 px-5 pb-6 pt-4 flex flex-col gap-3.5">
            {/* Motivational Quote Glass Pill */}
            <motion.div
              key={`quote-${activeStory.id}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl p-4 border border-white/15 backdrop-blur-xl shadow-2xl"
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                borderLeft: `4px solid ${activeStory.accentColor}`,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-[9px] font-extrabold uppercase tracking-widest"
                  style={{ color: activeStory.accentColor }}
                >
                  {activeStory.author}
                </span>
                <span className="text-[10px] text-white/50 flex items-center gap-1 font-mono">
                  <Zap className="h-3 w-3" style={{ color: activeStory.accentColor }} />
                  {activeStory.musicMood}
                </span>
              </div>
              <p className="text-sm font-bold text-white leading-relaxed italic drop-shadow-sm">
                "{activeStory.quote}"
              </p>
            </motion.div>

            {/* Action Bar */}
            <div className="flex items-center gap-2">
              {/* Hype Reaction Button */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={handleHype}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider text-black shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${activeStory.accentColor}, #ffffff)`,
                }}
              >
                <Flame className="h-4 w-4 fill-black" />
                <span>
                  Hype ({(hypeCounts[activeStory.id] || 48).toLocaleString()})
                </span>
              </motion.button>

              {/* TTS Voice Readout */}
              <button
                type="button"
                onClick={handleVoiceQuote}
                className="h-11 w-11 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 backdrop-blur-md flex items-center justify-center text-white transition-all"
                title="Hear Coach Voice"
              >
                {speaking ? (
                  <VolumeX className="h-4 w-4 text-amber-400 animate-pulse" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>

              {/* Download HD Wallpaper */}
              <button
                type="button"
                onClick={handleDownloadWallpaper}
                className="h-11 w-11 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 backdrop-blur-md flex items-center justify-center text-white transition-all"
                title="Save HD Wallpaper"
              >
                <Download className="h-4 w-4" />
              </button>

              {/* Share to IG / WhatsApp */}
              <button
                type="button"
                onClick={handleShareStory}
                className="h-11 w-11 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 backdrop-blur-md flex items-center justify-center text-white transition-all"
                title="Share Status"
              >
                {copiedShare ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
