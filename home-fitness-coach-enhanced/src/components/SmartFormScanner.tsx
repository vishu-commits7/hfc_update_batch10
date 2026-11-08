import { shareContent } from "../lib/nativeBridge";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Scan,
  Share2,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  Activity,
} from "lucide-react";
import { audio } from "../lib/audio";
import { tapFeedback, celebrateFeedback } from "../lib/haptics";
import gymBeastSquat from "../assets/ui/gym-beast-squat.jpg";

interface SmartFormScannerProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName?: string;
}

const MOVEMENTS = [
  {
    id: "squat",
    name: "Bodyweight Squat",
    targetAngle: 90,
    unit: "knee flexion",
    cues: ["Chest upright", "Knees track over toes", "Drive through midfoot"],
  },
  {
    id: "pushup",
    name: "Athletic Pushup",
    targetAngle: 85,
    unit: "elbow angle",
    cues: ["45° elbow flare", "Glutes locked", "Full range of motion"],
  },
  {
    id: "plank",
    name: "Iron Plank Hold",
    targetAngle: 180,
    unit: "spine neutrality",
    cues: ["Neutral pelvis", "Scapular protraction", "Breathe steadily"],
  },
];

export default function SmartFormScanner({
  isOpen,
  onClose,
  exerciseName,
}: SmartFormScannerProps) {
  const [selectedMove, setSelectedMove] = useState(MOVEMENTS[0]);
  const [isScanning, setIsScanning] = useState(true);
  const [repCount, setRepCount] = useState(0);
  const [currentAngle, setCurrentAngle] = useState(90);
  const [symmetry, setSymmetry] = useState(98);
  const [formScore, setFormScore] = useState(96);
  const [feedbackCue, setFeedbackCue] = useState("Depth optimal. Drive up through heels!");
  const [isMuted, setIsMuted] = useState(false);
  const [completedScan, setCompletedScan] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const repIntervalRef = useRef<number | null>(null);

  // Sync initial exercise if passed
  useEffect(() => {
    if (exerciseName) {
      const match = MOVEMENTS.find((m) =>
        m.name.toLowerCase().includes(exerciseName.toLowerCase())
      );
      if (match) setSelectedMove(match);
    }
  }, [exerciseName]);

  // Telemetry simulation loop
  useEffect(() => {
    if (!isOpen || completedScan || !isScanning) {
      if (repIntervalRef.current) clearInterval(repIntervalRef.current);
      return;
    }

    const tickInterval = window.setInterval(() => {
      const variance = Math.round((Math.random() - 0.5) * 6);
      const angle = selectedMove.targetAngle + variance;
      setCurrentAngle(angle);
      setSymmetry(Math.min(100, Math.max(92, 98 + Math.round((Math.random() - 0.5) * 4))));
    }, 400);

    repIntervalRef.current = window.setInterval(() => {
      setRepCount((prev) => {
        const next = prev + 1;
        audio.playBeastClick();
        tapFeedback();

        if (next === 4) {
          setFeedbackCue("Optimal tempo! Core tight, ribs down.");
          if (!isMuted) audio.speak("Great depth! Drive up!", { gender: "female" });
        } else if (next === 8) {
          setFeedbackCue("Symmetry flawless. 2 reps to certification!");
          if (!isMuted) audio.speak("Form flawless! Finish strong!", { gender: "female" });
        } else if (next >= 10) {
          handleScanFinish();
          return 10;
        }
        return next;
      });
    }, 2400);

    return () => {
      clearInterval(tickInterval);
      if (repIntervalRef.current) clearInterval(repIntervalRef.current);
    };
  }, [isOpen, completedScan, isScanning, selectedMove, isMuted]);

  const handleScanFinish = () => {
    if (repIntervalRef.current) clearInterval(repIntervalRef.current);
    setCompletedScan(true);
    setIsScanning(false);
    celebrateFeedback();
    audio.playBeastHypeFanfare();
    setFormScore(98);
  };

  const handleResetScan = () => {
    tapFeedback();
    setCompletedScan(false);
    setRepCount(0);
    setIsScanning(true);
    setFeedbackCue("Calibrating joint angles...");
  };

  const handleShareCertificate = async () => {
    tapFeedback();
    const shareText = `Biometric Form Certification: Scored 98% Form Accuracy on ${selectedMove.name} with Apex Pulse. #ApexPulse #FormCoach`;
    const result = await shareContent({ title: "AI Form Coach Certificate", text: shareText });
    if (result === "copied") {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2400);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[105] flex items-center justify-center bg-black/85 select-none p-3 sm:p-5"
      >
        <div className="relative w-full max-w-md overflow-hidden bg-[#0A0A0C] flex flex-col justify-between rounded-2xl border border-zinc-800 shadow-2xl">
          {/* Top Bar Navigation */}
          <div className="relative z-20 flex items-center justify-between p-3.5 border-b border-zinc-800 bg-[#141418]/95">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#10B981] animate-ping" />
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#E1FF00] flex items-center gap-1">
                  <Scan className="h-3 w-3" /> Hologram Form Guidance
                </span>
                <span className="text-xs font-bold text-white block truncate max-w-[200px]">
                  {selectedMove.name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  setIsMuted(!isMuted);
                }}
                className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  onClose();
                }}
                className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Locked Viewport Container: Strict 4:5 Aspect Ratio — No CLS */}
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-900">
            {/* Background Athlete Preview with Unobstructed View */}
            <img
              src={gymBeastSquat}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60 filter contrast-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-transparent to-[#0A0A0C]/50" />

            {/* Laser scanning line */}
            {isScanning && !completedScan && (
              <motion.div
                animate={{ top: ["12%", "85%", "12%"] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-[#E1FF00] to-transparent shadow-sm z-10"
              />
            )}

            {/* Skeletal Joints Overlay (Simulated Pose Nodes) */}
            <svg
              className="absolute inset-0 h-full w-full pointer-events-none z-10 opacity-80"
              viewBox="0 0 400 600"
            >
              <line x1="200" y1="160" x2="200" y2="320" stroke="#E1FF00" strokeWidth="2" strokeDasharray="3 3" />
              <line x1="140" y1="200" x2="260" y2="200" stroke="#10B981" strokeWidth="2.5" />
              <line x1="170" y1="320" x2="150" y2="430" stroke="#E1FF00" strokeWidth="2.5" />
              <line x1="150" y1="430" x2="160" y2="520" stroke="#E1FF00" strokeWidth="2.5" />
              <line x1="230" y1="320" x2="250" y2="430" stroke="#E1FF00" strokeWidth="2.5" />
              <line x1="250" y1="430" x2="240" y2="520" stroke="#E1FF00" strokeWidth="2.5" />

              {[
                { cx: 200, cy: 150, color: "#10B981" },
                { cx: 140, cy: 200, color: "#E1FF00" },
                { cx: 260, cy: 200, color: "#E1FF00" },
                { cx: 200, cy: 320, color: "#10B981" },
                { cx: 150, cy: 430, color: "#F59E0B" },
                { cx: 250, cy: 430, color: "#F59E0B" },
                { cx: 160, cy: 520, color: "#E1FF00" },
                { cx: 240, cy: 520, color: "#E1FF00" },
              ].map((node, i) => (
                <circle
                  key={i}
                  cx={node.cx}
                  cy={node.cy}
                  r="4.5"
                  fill={node.color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              ))}
            </svg>

            {/* UN-OBSTRUCTED HUD OVERLAYS: PINNED TO COMPACT CORNERS */}
            {!completedScan && (
              <>
                {/* Top-Left: Reps Pill Badge */}
                <div className="absolute top-3 left-3 z-20 rounded-xl border border-zinc-800 bg-[#0A0A0C]/90 px-3 py-1.5 backdrop-blur-md">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-zinc-400 block">
                    Reps Counted
                  </span>
                  <p className="text-xl font-bold tabular-nums text-[#E1FF00] leading-tight">
                    {repCount} <span className="text-xs text-zinc-500 font-normal">/ 10</span>
                  </p>
                </div>

                {/* Top-Right: Joint Angle Depth Badge */}
                <div className="absolute top-3 right-3 z-20 rounded-xl border border-zinc-800 bg-[#0A0A0C]/90 px-3 py-1.5 backdrop-blur-md text-right">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-zinc-400 block">
                    {selectedMove.unit}
                  </span>
                  <p className="text-xl font-bold tabular-nums text-white leading-tight">
                    {currentAngle}°
                  </p>
                </div>
              </>
            )}

            {/* Completed Certificate Popup */}
            {completedScan && (
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute inset-4 z-30 flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-[#141418]/95 p-5 text-center shadow-xl backdrop-blur-md"
              >
                <div className="h-11 w-11 rounded-xl bg-[#E1FF00] text-black flex items-center justify-center mb-2 shadow-sm">
                  <Sparkles className="h-5 w-5 fill-black" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#E1FF00]">
                  Form Certified
                </span>
                <h3 className="text-lg font-bold uppercase text-white mt-0.5">
                  Accuracy: {formScore}%
                </h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-[280px] leading-relaxed">
                  Optimal {selectedMove.targetAngle}° depth maintained with neutral spine and balanced symmetry across 10 reps.
                </p>

                <div className="mt-4 flex gap-2 w-full max-w-[260px]">
                  <button
                    type="button"
                    onClick={handleShareCertificate}
                    className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-[#E1FF00] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    {copiedShare ? "Copied!" : "Share Pass"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetScan}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-zinc-800 bg-[#1E1E24] text-zinc-300 hover:text-white flex items-center justify-center active:scale-95 cursor-pointer"
                    title="Rescan"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Bottom Control Bar & Real-time Cues */}
          <div className="relative z-20 p-3.5 border-t border-zinc-800 bg-[#141418] space-y-3">
            {/* Live Real-time Cue Banner Pinned Cleanly to Bottom Bar */}
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#1E1E24] px-3 py-2 text-xs font-semibold text-white">
              <Activity className="h-4 w-4 text-[#E1FF00] shrink-0" />
              <span className="truncate">{feedbackCue}</span>
            </div>

            {/* Telemetry Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl border border-zinc-800 bg-[#0A0A0C]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Angle Depth
                </span>
                <span className="text-base font-bold tabular-nums text-white">
                  {currentAngle}°
                </span>
              </div>
              <div className="p-2 rounded-xl border border-zinc-800 bg-[#0A0A0C]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Symmetry
                </span>
                <span className="text-base font-bold tabular-nums text-[#10B981]">
                  {symmetry}%
                </span>
              </div>
              <div className="p-2 rounded-xl border border-zinc-800 bg-[#0A0A0C]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Accuracy
                </span>
                <span className="text-base font-bold tabular-nums text-[#E1FF00]">
                  {formScore}%
                </span>
              </div>
            </div>

            {/* Quick Movement Switcher Segmented Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {MOVEMENTS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    setSelectedMove(m);
                    handleResetScan();
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer select-none ${
                    selectedMove.id === m.id
                      ? "bg-[#E1FF00] text-black"
                      : "bg-[#1E1E24] text-zinc-400 border border-zinc-800 hover:text-white"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
