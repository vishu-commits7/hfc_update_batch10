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
    name: "Barbell / Bodyweight Squat",
    targetAngle: 90,
    unit: "knee flexion",
    cues: ["Chest proud", "Knees track over toes", "Drive through midfoot"],
  },
  {
    id: "pushup",
    name: "Standard Athletic Pushup",
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
  const [feedbackCue, setFeedbackCue] = useState("Depth optimal. Drive up!");
  const [isMuted, setIsMuted] = useState(false);
  const [completedScan, setCompletedScan] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const repIntervalRef = useRef<number | null>(null);

  // Sync initial exercise if passed
  useEffect(() => {
    if (exerciseName) {
      const match = MOVEMENTS.find(
        (m) => m.name.toLowerCase().includes(exerciseName.toLowerCase())
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

    // Telemetry tick
    const tickInterval = window.setInterval(() => {
      // Fluctuate angle naturally around optimal
      const variance = Math.round((Math.random() - 0.5) * 6);
      const angle = selectedMove.targetAngle + variance;
      setCurrentAngle(angle);

      // Fluctuate symmetry
      setSymmetry(Math.min(100, Math.max(92, 98 + Math.round((Math.random() - 0.5) * 4))));
    }, 400);

    // Reps loop
    repIntervalRef.current = window.setInterval(() => {
      setRepCount((prev) => {
        const next = prev + 1;
        audio.playBeastClick();
        tapFeedback();

        if (next === 5) {
          setFeedbackCue("Spot-on cadence! Keep ribs pinned down.");
          if (!isMuted) audio.speak("Great depth! Drive up!", { gender: "female" });
        } else if (next === 8) {
          setFeedbackCue("Symmetry flawless. 2 reps to Apex certification!");
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
    setFeedbackCue("Analyzing joint angles...");
  };

  const handleShareCertificate = async () => {
    tapFeedback();
    const shareText = `🎯 AI Bio-Form Certification: Scored 98% APEX ACCURACY on ${selectedMove.name} with Home Fitness Coach!\nCheck your biomechanics and train like a beast! #AIFormCoach #HomeFitnessCoach`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "AI Form Coach Certificate",
          text: shareText,
        });
        return;
      } catch {
        // fallback
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
        className="fixed inset-0 z-[105] flex items-center justify-center bg-black/90 backdrop-blur-md select-none p-3 sm:p-6"
      >
        <div className="relative h-full w-full max-w-md overflow-hidden bg-slate-950 flex flex-col justify-between rounded-[32px] border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.25)]">
          {/* Top Bar HUD */}
          <div className="relative z-20 flex items-center justify-between p-4 border-b border-white/10 bg-black/60 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1">
                  <Scan className="h-3 w-3" /> AI Biometric Scanner
                </span>
                <span className="text-xs font-bold text-white truncate max-w-[200px]">
                  {selectedMove.name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  setIsMuted(!isMuted);
                }}
                className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 active:scale-90"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
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
          </div>

          {/* Viewfinder Main View */}
          <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
            {/* Background Athlete Preview with Biomechanical Overlay */}
            <div className="absolute inset-0 z-0">
              <img
                src={gymBeastSquat}
                alt=""
                className="h-full w-full object-cover opacity-40 filter contrast-125"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/80" />
            </div>

            {/* Laser scanning line */}
            {isScanning && !completedScan && (
              <motion.div
                animate={{ top: ["10%", "85%", "10%"] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#06b6d4] z-10"
              />
            )}

            {/* Cyber Reticle Frame Corners */}
            <div className="absolute inset-6 pointer-events-none z-10 border border-cyan-500/20 rounded-2xl">
              <div className="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-cyan-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-cyan-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-cyan-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-cyan-400 rounded-br-xl" />
            </div>

            {/* Interactive Skeletal Joints Overlay (Simulated Pose Nodes) */}
            <svg
              className="absolute inset-0 h-full w-full pointer-events-none z-10"
              viewBox="0 0 400 600"
            >
              {/* Spine connection */}
              <line
                x1="200"
                y1="160"
                x2="200"
                y2="320"
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />
              {/* Shoulders */}
              <line x1="140" y1="200" x2="260" y2="200" stroke="#10b981" strokeWidth="3" />
              {/* Left Leg */}
              <line x1="170" y1="320" x2="150" y2="430" stroke="#06b6d4" strokeWidth="3" />
              <line x1="150" y1="430" x2="160" y2="520" stroke="#06b6d4" strokeWidth="3" />
              {/* Right Leg */}
              <line x1="230" y1="320" x2="250" y2="430" stroke="#06b6d4" strokeWidth="3" />
              <line x1="250" y1="430" x2="240" y2="520" stroke="#06b6d4" strokeWidth="3" />

              {/* Joint Nodes */}
              {[
                { cx: 200, cy: 150, color: "#10b981", label: "Cervical" },
                { cx: 140, cy: 200, color: "#06b6d4", label: "L Shoulder" },
                { cx: 260, cy: 200, color: "#06b6d4", label: "R Shoulder" },
                { cx: 200, cy: 320, color: "#10b981", label: "Pelvis" },
                { cx: 150, cy: 430, color: "#f59e0b", label: "Knee" },
                { cx: 250, cy: 430, color: "#f59e0b", label: "Knee" },
                { cx: 160, cy: 520, color: "#06b6d4", label: "Ankle" },
                { cx: 240, cy: 520, color: "#06b6d4", label: "Ankle" },
              ].map((node, i) => (
                <circle
                  key={i}
                  cx={node.cx}
                  cy={node.cy}
                  r="5"
                  fill={node.color}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="animate-pulse"
                />
              ))}
            </svg>

            {/* Live Center HUD Gauge */}
            {!completedScan ? (
              <div className="relative z-20 flex flex-col items-center">
                <div className="relative h-32 w-32 rounded-full border-2 border-cyan-400/40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md shadow-2xl">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">
                    REPS COUNTED
                  </span>
                  <span className="text-5xl font-black font-mono text-white">
                    {repCount}
                  </span>
                  <span className="text-[9px] text-white/50 font-bold">/ 10 REPS</span>
                </div>

                <div className="mt-4 px-3.5 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold shadow-lg backdrop-blur-md flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  <span>{feedbackCue}</span>
                </div>
              </div>
            ) : (
              /* CERTIFICATE POPUP */
              <motion.div
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative z-30 p-5 rounded-3xl bg-slate-900/90 border border-amber-400/40 backdrop-blur-xl shadow-2xl text-center max-w-[90%]"
              >
                <div className="h-12 w-12 rounded-full bg-amber-400 text-black mx-auto flex items-center justify-center mb-2 shadow-lg">
                  <Sparkles className="h-6 w-6 fill-black" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                  APEX BIOMETRIC PASS
                </span>
                <h3 className="text-xl font-black uppercase text-white mt-1">
                  Form Certified: {formScore}%
                </h3>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  Flawless joint alignment, optimal {selectedMove.targetAngle}° depth, zero valgus knee collapse across 10 reps.
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleShareCertificate}
                    className="flex-1 py-3 rounded-xl bg-amber-400 text-black font-black text-xs uppercase tracking-wider active:scale-95 flex items-center justify-center gap-1.5 shadow-lg"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    {copiedShare ? "Link Copied!" : "Share Certificate"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetScan}
                    className="h-11 w-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white active:scale-90"
                    title="Rescan"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Bottom Telemetry Metrics Strip */}
          <div className="relative z-20 p-4 border-t border-white/10 bg-black/80 backdrop-blur-md">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[9px] font-black uppercase tracking-wider text-white/50 block">
                  Angle Depth
                </span>
                <span className="text-base font-black font-mono text-cyan-400">
                  {currentAngle}°
                </span>
                <span className="text-[8px] text-emerald-400 block font-bold">Optimal</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[9px] font-black uppercase tracking-wider text-white/50 block">
                  Symmetry
                </span>
                <span className="text-base font-black font-mono text-emerald-400">
                  {symmetry}%
                </span>
                <span className="text-[8px] text-white/40 block">Balanced</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[9px] font-black uppercase tracking-wider text-white/50 block">
                  Form Accuracy
                </span>
                <span className="text-base font-black font-mono text-amber-400">
                  {formScore}%
                </span>
                <span className="text-[8px] text-amber-300 block font-bold">Apex Tier</span>
              </div>
            </div>

            {/* Quick movement switcher */}
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5 no-scrollbar">
              {MOVEMENTS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    setSelectedMove(m);
                    handleResetScan();
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors ${
                    selectedMove.id === m.id
                      ? "bg-cyan-400 text-black font-black"
                      : "bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  {m.name.split(" ")[0]}
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
