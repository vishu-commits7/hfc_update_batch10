import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Share2,
  Download,
  Camera,
} from "lucide-react";
import { audio } from "../lib/audio";
import { tapFeedback, celebrateFeedback } from "../lib/haptics";
import gymBeastChalk from "../assets/ui/gym-beast-chalk.jpg";
import gymBeastIron from "../assets/ui/gym-beast-iron.jpg";
import gymBeastPump from "../assets/ui/gym-beast-pump.jpg";
import gymBeastAbs from "../assets/ui/gym-beast-abs.jpg";
import gymBeastBoxing from "../assets/ui/gym-beast-boxing.jpg";
import gymBeastSquat from "../assets/ui/gym-beast-squat.jpg";

export interface FlexStats {
  title?: string;
  calories?: number;
  durationMinutes?: number;
  streakDays?: number;
  exercisesCompleted?: number;
}

interface ViralFlexStudioProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStats?: FlexStats;
}

const BG_OPTIONS = [
  { id: "chalk", name: "Chalk & Fire", img: gymBeastChalk, color: "#f59e0b" },
  { id: "iron", name: "Iron Deadlift", img: gymBeastIron, color: "#06b6d4" },
  { id: "pump", name: "Dumbbell Press", img: gymBeastPump, color: "#10b981" },
  { id: "abs", name: "Core Pullup", img: gymBeastAbs, color: "#8b5cf6" },
  { id: "boxing", name: "Heavy Bag", img: gymBeastBoxing, color: "#ef4444" },
  { id: "squat", name: "Heavy Squat", img: gymBeastSquat, color: "#eab308" },
];

const STICKER_PRESETS = [
  { id: "beast", label: "⚡ BEAST MODE: 100%", tone: "#f59e0b" },
  { id: "pr", label: "🏆 NEW PR SMASHED", tone: "#06b6d4" },
  { id: "flame", label: "🔥 NO DAYS OFF", tone: "#ef4444" },
  { id: "iron", label: "🛡️ UNBREAKABLE WILL", tone: "#10b981" },
  { id: "sweat", label: "💦 SWEAT EQUITY PAID", tone: "#8b5cf6" },
];

export default function ViralFlexStudio({
  isOpen,
  onClose,
  defaultStats,
}: ViralFlexStudioProps) {
  const [selectedBg, setSelectedBg] = useState(BG_OPTIONS[0]);
  const [format, setFormat] = useState<"story" | "square">("story");
  const [selectedStickers, setSelectedStickers] = useState<string[]>([
    "beast",
    "flame",
  ]);
  const [quote, setQuote] = useState(
    "Work in silence. Let your physique make the noise."
  );
  const [stats, setStats] = useState<FlexStats>({
    title: defaultStats?.title || "Savage Hypertrophy",
    calories: defaultStats?.calories || 420,
    durationMinutes: defaultStats?.durationMinutes || 35,
    streakDays: defaultStats?.streakDays || 14,
    exercisesCompleted: defaultStats?.exercisesCompleted || 6,
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  // Update stats if defaults arrive
  useEffect(() => {
    if (defaultStats) {
      setStats((prev) => ({
        ...prev,
        ...defaultStats,
      }));
    }
  }, [defaultStats]);

  // Render high-res export image to canvas
  const renderCard = useCallback(async () => {
    const canvas = document.createElement("canvas");
    const width = format === "story" ? 1080 : 1080;
    const height = format === "story" ? 1920 : 1080;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Load background image
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = selectedBg.img;

    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });

    // Draw background cover
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    if (img.width > 0) {
      const scale = Math.max(width / img.width, height / img.height);
      const nw = img.width * scale;
      const nh = img.height * scale;
      const nx = (width - nw) / 2;
      const ny = (height - nh) / 2;
      ctx.drawImage(img, nx, ny, nw, nh);
    }

    // Gradient Overlay
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(0, 0, 0, 0.75)");
    grad.addColorStop(0.35, "rgba(0, 0, 0, 0.2)");
    grad.addColorStop(0.7, "rgba(0, 0, 0, 0.65)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0.95)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Header Branding
    ctx.save();
    ctx.fillStyle = selectedBg.color;
    ctx.font = "900 28px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("HOME FITNESS COACH", 70, 110);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 64px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(stats.title?.toUpperCase() || "BEAST WORKOUT", 70, 185);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "700 28px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("VERIFIED SESSION COMPLETED", 70, 230);
    ctx.restore();

    // Stickers strip
    let stickerY = 280;
    selectedStickers.forEach((stId) => {
      const sticker = STICKER_PRESETS.find((s) => s.id === stId);
      if (!sticker) return;
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.strokeStyle = sticker.tone;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(70, stickerY, 440, 54, 27);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 24px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(sticker.label, 95, stickerY + 36);
      ctx.restore();
      stickerY += 70;
    });

    // Stats Grid Box
    const statBoxY = height - 440;
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(70, statBoxY, width - 140, 260, 32);
    ctx.fill();
    ctx.stroke();

    // Stats Columns
    const statItems = [
      { label: "CALORIES", val: `${stats.calories || 350} kcal`, icon: "🔥" },
      { label: "TIME", val: `${stats.durationMinutes || 30} min`, icon: "⏱️" },
      { label: "STREAK", val: `${stats.streakDays || 1} days`, icon: "👑" },
    ];

    const colWidth = (width - 140) / 3;
    statItems.forEach((st, idx) => {
      const cx = 70 + colWidth * idx + colWidth / 2;
      ctx.textAlign = "center";

      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.font = "900 22px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(st.label, cx, statBoxY + 70);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 44px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(st.val, cx, statBoxY + 140);
    });

    // Custom Quote Watermark at Bottom
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "italic 700 30px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`"${quote}"`, width / 2, height - 120);

    ctx.fillStyle = selectedBg.color;
    ctx.font = "900 22px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("#HOMEFITNESSCOACH · BEAST LEVEL UNLOCKED", width / 2, height - 70);
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/png");
    setPreviewUrl(dataUrl);
  }, [format, selectedBg, selectedStickers, stats, quote]);

  useEffect(() => {
    if (isOpen) {
      renderCard();
    }
  }, [isOpen, renderCard]);

  const toggleSticker = (id: string) => {
    tapFeedback();
    setSelectedStickers((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    tapFeedback();
    celebrateFeedback();
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `kinetic-flex-card-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    audio.playSuccessChime();
  };

  const handleNativeShare = async () => {
    if (!previewUrl) return;
    tapFeedback();
    celebrateFeedback();

    try {
      const blob = await (await fetch(previewUrl)).blob();
      const file = new File([blob], `beast-workout-${Date.now()}.png`, {
        type: "image/png",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Home Fitness Coach Flex Card",
          text: `Crushed a savage session today! 🔥\n${quote}\n#HomeFitnessCoach #BeastMode`,
        });
        return;
      }
    } catch {
      // Fallback
    }

    // Fallback: download + copy caption
    handleDownload();
    navigator.clipboard?.writeText(
      `Crushed a savage session today! 🔥\n"${quote}"\n#HomeFitnessCoach #BeastMode`
    );
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
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 select-none overflow-y-auto"
      >
        <div className="relative w-full max-w-lg rounded-[32px] border border-white/15 bg-slate-950 p-5 shadow-2xl flex flex-col gap-4 my-auto max-h-[95vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400">
              <Camera className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-wider">
                Viral Flex Studio 2.0
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                onClose();
              }}
              className="h-8 w-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/80 active:scale-90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Card Preview */}
          <div className="relative flex justify-center py-2">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Flex Card Preview"
                className={`rounded-2xl border border-white/20 shadow-2xl object-cover ${
                  format === "story" ? "h-72 w-44" : "h-56 w-56"
                }`}
              />
            ) : (
              <div
                className={`rounded-2xl bg-slate-900 border border-white/15 flex items-center justify-center text-white/50 text-xs font-mono ${
                  format === "story" ? "h-72 w-44" : "h-56 w-56"
                }`}
              >
                Rendering...
              </div>
            )}

            {/* Format toggle pill */}
            <div className="absolute top-4 right-4 flex gap-1 bg-black/70 p-1 rounded-xl border border-white/15">
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  setFormat("story");
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  format === "story" ? "bg-amber-400 text-black" : "text-white/60"
                }`}
              >
                9:16 Story
              </button>
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  setFormat("square");
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  format === "square" ? "bg-amber-400 text-black" : "text-white/60"
                }`}
              >
                1:1 Post
              </button>
            </div>
          </div>

          {/* Background Photo Picker */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/60 block mb-2">
              Select Motivation Visual
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {BG_OPTIONS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    setSelectedBg(bg);
                  }}
                  className={`h-16 w-16 shrink-0 rounded-xl overflow-hidden relative border-2 transition-transform active:scale-95 ${
                    selectedBg.id === bg.id
                      ? "border-amber-400 scale-105"
                      : "border-white/10 opacity-70"
                  }`}
                >
                  <img
                    src={bg.img}
                    alt={bg.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30" />
                  <span className="absolute bottom-1 inset-x-1 text-[8px] font-black uppercase text-white truncate text-center">
                    {bg.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Stickers Selector */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/60 block mb-2">
              Add Viral Stickers
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STICKER_PRESETS.map((st) => {
                const active = selectedStickers.includes(st.id);
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => toggleSticker(st.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border transition-all ${
                      active
                        ? "bg-amber-400 text-black border-amber-400"
                        : "bg-white/5 text-white/60 border-white/10 hover:text-white"
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Motivational Quote Input */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/60 block mb-1">
              Custom Beast Caption
            </label>
            <input
              type="text"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
              placeholder="Your personal gym mantra"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleNativeShare}
              className="flex-1 py-3.5 rounded-xl bg-amber-400 text-black font-black text-xs uppercase tracking-wider active:scale-95 shadow-lg flex items-center justify-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              {copiedShare ? "Copied & Saved!" : "Share to Story"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider active:scale-95 border border-white/15 flex items-center justify-center gap-1.5"
              title="Save PNG"
            >
              <Download className="h-4 w-4" />
              <span>Save HD</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
