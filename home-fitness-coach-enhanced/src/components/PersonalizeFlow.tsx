import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mars, NonBinary, ChevronRight, ChevronLeft, X, Sparkles,
  Ruler, Weight, Cake, Check, Minus, Plus, SkipForward
} from "lucide-react";
import { calculateBMI, bmiCategory, cmToFtIn, ftInToCm, kgToLb, lbToKg } from "../lib/wellness";
import Dumbbell3D from "./Dumbbell3DLazy";
import { audio } from "../lib/audio";
import coachMalePhoto from "../assets/coach/coach-male.png";

type Gender = "male" | "other";

export interface PersonalizeData {
  gender?: Gender;
  age?: number;
  heightCm?: number;
  weightKg?: number;
}

interface PersonalizeFlowProps {
  mode: "onboarding" | "edit";
  initial: PersonalizeData;
  onComplete: (data: PersonalizeData) => void;
  onSkip?: () => void;
  onClose?: () => void;
}

// The "race" step is gone. It existed only to pick which of two
// photographic models appeared in the Academy; now that every demo is the
// posed figure, the question had no effect on anything and was asking a
// new user to state their race before they had seen the app.
const ONBOARDING_STEPS = ["choice", "gender", "age", "height", "weight", "summary"] as const;
const EDIT_STEPS = ["gender", "age", "height", "weight", "summary"] as const;

/* ------------------------------------------------------------------ *
 * Drifting gradient-orb backdrop — the same futuristic language used
 * across the app's dark surfaces, animated with spring/loop motion.
 * ------------------------------------------------------------------ */
function OrbField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-lime-400/20 blur-[90px]"
        animate={{ x: [0, 40, -10, 0], y: [0, 30, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-20 top-10 h-64 w-64 rounded-full bg-blue-500/25 blur-[90px]"
        animate={{ x: [0, -30, 20, 0], y: [0, -25, 15, 0] }}
        transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-[100px]"
        animate={{ x: [0, 25, -25, 0], y: [0, -15, 10, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
        backgroundSize: "34px 34px"
      }} />
    </div>
  );
}

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0, scale: 0.97 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0, scale: 0.97 }),
};

const springTransition = { type: "spring" as const, stiffness: 340, damping: 32, mass: 0.9 };

/** A rotating conic-gradient ring behind an avatar circle — the classic
 *  "live/selected" halo treatment, sped up and brightened once active. */
function GlowRing({ active, colors }: { active: boolean; colors: string }) {
  return (
    <motion.div
      className="absolute -inset-[3px] rounded-full"
      style={{ background: `conic-gradient(from 0deg, ${colors})`, opacity: active ? 1 : 0.55 }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, ease: "linear", duration: active ? 3.2 : 7 }}
    />
  );
}

/** A diagonal glare that periodically sweeps across the avatar — the
 *  "shiny" highlight the photo-based cards asked for, clipped to the
 *  circular photo so it reads as light glinting off it. */
function ShineSweep() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-10 rounded-full"
      style={{ background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.65) 50%, transparent 65%)" }}
      initial={{ x: "-140%" }}
      animate={{ x: "160%" }}
      transition={{ repeat: Infinity, repeatDelay: 2.2, duration: 1.1, ease: "easeInOut" }}
    />
  );
}

function GenderCard({
  active, onClick, icon: Icon, label, glow, ringColors, photo,
}: { active: boolean; onClick: () => void; icon?: any; label: string; glow: string; ringColors: string; photo?: string }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      whileHover={{ y: -3 }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative flex flex-1 flex-col items-center gap-3 overflow-hidden rounded-[26px] border p-4 pt-5 transition-colors ${
        active ? "border-white/30 bg-white/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
      }`}
    >
      {active && (
        <motion.div
          layoutId="gender-glow"
          className={`absolute inset-0 -z-10 ${glow}`}
          transition={springTransition}
        />
      )}

      {/* Idle float + selected "pop" on the avatar itself */}
      <motion.div
        animate={{ y: active ? 0 : [0, -4, 0], scale: active ? 1.06 : 1 }}
        transition={active ? springTransition : { repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className="relative h-20 w-20"
      >
        <GlowRing active={active} colors={ringColors} />
        <div className={`absolute inset-[3px] overflow-hidden rounded-full border-2 ${active ? "border-white/80" : "border-slate-950"} bg-slate-800`}>
          {photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover object-top" draggable={false} />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${active ? "bg-white text-slate-950" : "bg-white/10 text-white/70"}`}>
              {Icon && <Icon className="h-8 w-8" />}
            </div>
          )}
          <ShineSweep />
        </div>
        {active && (
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={springTransition} className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-lime-300 text-slate-950 shadow-[0_0_12px_rgba(212,255,0,0.7)]">
            <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
          </motion.div>
        )}
        {active && (
          <motion.div
            className="absolute -left-1.5 -bottom-1"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1, 0.9], opacity: [0, 1, 0.8] }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.8 }}
          >
            <Sparkles className="h-4 w-4 text-lime-300 drop-shadow-[0_0_4px_rgba(212,255,0,0.8)]" />
          </motion.div>
        )}
      </motion.div>

      <span className={`text-xs font-black uppercase tracking-wider ${active ? "text-white" : "text-white/60"}`}>{label}</span>
    </motion.button>
  );
}

function NumberStepper({
  value, onChange, min, max, step = 1, suffix = "",
}: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={value}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="text-7xl font-black tracking-tighter text-white tabular-nums"
        >
          {value}<span className="ml-1 text-2xl font-bold text-white/40">{suffix}</span>
        </motion.div>
      </AnimatePresence>

      <div className="flex w-full items-center gap-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onChange(Math.max(min, value - step))}
          aria-label="Decrease"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/15"
        >
          <Minus className="h-5 w-5" />
        </motion.button>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="h-1.5 w-full flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-lime-300"
        />

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onChange(Math.min(max, value + step))}
          aria-label="Increase"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/15"
        >
          <Plus className="h-5 w-5" />
        </motion.button>
      </div>
    </div>
  );
}

export default function PersonalizeFlow({ mode, initial, onComplete, onSkip, onClose }: PersonalizeFlowProps) {
  const steps = mode === "onboarding" ? ONBOARDING_STEPS : EDIT_STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const [gender, setGender] = useState<Gender | undefined>(
    initial.gender === ("female" as any) ? "male" : (initial.gender ?? "male")
  );
  const [age, setAge] = useState(initial.age ?? 25);
  const [heightCm, setHeightCm] = useState(initial.heightCm ?? 170);
  const [weightKg, setWeightKg] = useState(initial.weightKg ?? 65);
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">("cm");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");

  // Each question is genuinely optional: a value only "counts" once the
  // person actually accepts that step (via Continue). The top-right "Skip"
  // link advances without marking the step touched, so a skipped question
  // is saved as unset rather than silently persisting a default number.
  const [touched, setTouched] = useState<Record<string, boolean>>({
    gender: initial.gender !== undefined,
    age: initial.age !== undefined,
    height: initial.heightCm !== undefined,
    weight: initial.weightKg !== undefined,
  });

  const step = steps[stepIndex];
  const questionSteps = steps.filter(s => s !== "choice" && s !== "summary");
  const questionPosition = questionSteps.indexOf(step as any);

  const go = (delta: number) => {
    setDirection(delta);
    setStepIndex(i => Math.max(0, Math.min(steps.length - 1, i + delta)));
  };

  const acceptAndGo = () => {
    setTouched(t => ({ ...t, [step]: true }));
    go(1);
  };

  const finish = () => {
    onComplete({
      gender: touched.gender ? gender : undefined,
      age: touched.age ? age : undefined,
      heightCm: touched.height ? heightCm : undefined,
      weightKg: touched.weight ? weightKg : undefined,
    });
  };

  const ftIn = useMemo(() => cmToFtIn(heightCm), [heightCm]);
  const lb = useMemo(() => kgToLb(weightKg), [weightKg]);
  const bmi = touched.height && touched.weight ? calculateBMI(heightCm, weightKg) : 0;
  const cat = bmiCategory(bmi);

  const catColorClass =
    cat.color === "blue" ? "text-blue-300" :
    cat.color === "emerald" ? "text-emerald-300" :
    cat.color === "amber" ? "text-amber-300" :
    cat.color === "rose" ? "text-rose-300" : "text-white/50";

  // Spoken narration on arrival at the summary screen — the same on-device
  // voice engine used mid-workout, so the personalize flow doesn't feel
  // silent even before any workout has started. Respects the user's saved
  // mute preference and never repeats for the same visit to this step.
  const announcedRef = React.useRef(false);
  React.useEffect(() => {
    if (step !== "summary" || announcedRef.current) return;
    announcedRef.current = true;
    const muted = localStorage.getItem("kinetic_sound_muted") === "true";
    audio.setMute(muted);
    const answered = [touched.gender, touched.age, touched.height, touched.weight].filter(Boolean).length;
    audio.speak(
      answered === 0
        ? "All set. You skipped personalization for now — you can add these details any time from Settings."
        : "You're all set. Your profile is saved, and your plan is now personalized."
    );
    return () => audio.stopSpeaking();
  }, [step]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05070c] p-0 sm:p-6">
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-[#05070c] shadow-2xl sm:h-[min(880px,92vh)] sm:rounded-[36px] sm:border sm:border-white/10">
        <OrbField />

        {/* Top bar: progress + close/skip */}
        <div className="relative z-10 flex items-center gap-3 px-6 pt-6">
          {step !== "choice" && stepIndex > 0 && (
            <button onClick={() => go(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/15">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          {questionPosition >= 0 && (
            <div className="flex flex-1 items-center gap-1.5">
              {questionSteps.map((_, i) => (
                <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  {i <= questionPosition && (
                    <motion.div layoutId={`fill-${i}`} className="h-full rounded-full bg-lime-300" initial={{ width: 0 }} animate={{ width: "100%" }} transition={springTransition} />
                  )}
                </div>
              ))}
            </div>
          )}

          {(step === "choice" || step === "summary") && <div className="flex-1" />}

          {mode === "edit" && (
            <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/15">
              <X className="h-4 w-4" />
            </button>
          )}
          {questionPosition >= 0 && (
            <button onClick={() => go(1)} className="flex shrink-0 items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/40 hover:text-white/70">
              Skip <SkipForward className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Step content */}
        <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-6 py-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springTransition}
              className="w-full"
            >
              {step === "choice" && (
                <div className="text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10">
                    <Dumbbell3D size={72} />
                  </div>
                  <h1 className="font-display mt-6 text-3xl font-black leading-tight tracking-tight text-white">Let's personalize<br/>your plan</h1>
                  <p className="font-script mt-1 text-lg text-lime-300/90">crafted around you</p>
                  <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-white/50">
                    Four quick questions — gender, age, height and weight — help the AI coach tailor a plan to you. Totally optional.
                  </p>
                  <div className="mt-8 space-y-3">
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => go(1)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 py-4 text-sm font-black text-slate-950">
                      <Sparkles className="h-4 w-4" /> Personalize with AI
                    </motion.button>
                    <button onClick={onSkip} className="w-full rounded-2xl border border-white/10 py-4 text-sm font-bold text-white/60 hover:bg-white/5">
                      Skip — take me into the app
                    </button>
                  </div>
                </div>
              )}

              {step === "gender" && (
                <div>
                  <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-lime-300">Question {questionPosition + 1} of {questionSteps.length}</p>
                  <h2 className="font-display mt-3 text-center text-2xl font-black text-white">What's your gender?</h2>
                  <p className="mt-1.5 text-center text-xs text-white/40">Used only to fine-tune calorie & recovery estimates.</p>
                  <div className="mt-8 flex justify-center gap-4">
                    <GenderCard active={gender === "male"} onClick={() => setGender("male")} icon={Mars} label="Male" glow="bg-blue-500/20" ringColors="#60a5fa, #22d3ee, #818cf8, #60a5fa" photo={coachMalePhoto} />
                    <GenderCard active={gender === "other"} onClick={() => setGender("other")} icon={NonBinary} label="Prefer not to say" glow="bg-violet-500/20" ringColors="#a78bfa, #818cf8, #c084fc, #a78bfa" />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={!gender}
                    onClick={acceptAndGo}
                    className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-black text-slate-950 disabled:opacity-30"
                  >
                    Continue <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              )}

              {step === "age" && (
                <div>
                  <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-lime-300">Question {questionPosition + 1} of {questionSteps.length}</p>
                  <div className="mx-auto mt-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-lime-300"><Cake className="h-5 w-5" /></div>
                  <h2 className="font-display mt-4 text-center text-2xl font-black text-white">How old are you?</h2>
                  <div className="mt-8">
                    <NumberStepper value={age} onChange={setAge} min={10} max={90} suffix="yrs" />
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={acceptAndGo} className="mt-10 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-black text-slate-950">
                    Continue <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              )}

              {step === "height" && (
                <div>
                  <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-lime-300">Question {questionPosition + 1} of {questionSteps.length}</p>
                  <div className="mx-auto mt-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-lime-300"><Ruler className="h-5 w-5" /></div>
                  <h2 className="font-display mt-4 text-center text-2xl font-black text-white">How tall are you?</h2>

                  <div className="mx-auto mt-5 flex w-fit rounded-full border border-white/10 bg-white/5 p-1">
                    {(["cm", "ft"] as const).map(u => (
                      <button key={u} onClick={() => setHeightUnit(u)} className={`rounded-full px-4 py-1.5 text-[11px] font-black uppercase ${heightUnit === u ? "bg-white text-slate-950" : "text-white/50"}`}>{u === "cm" ? "cm" : "ft / in"}</button>
                    ))}
                  </div>

                  <div className="mt-8">
                    {heightUnit === "cm" ? (
                      <NumberStepper value={heightCm} onChange={setHeightCm} min={120} max={220} suffix="cm" />
                    ) : (
                      <div className="flex flex-col items-center gap-6">
                        <div className="text-7xl font-black tracking-tighter text-white tabular-nums">
                          {ftIn.ft}<span className="text-3xl text-white/40">'</span>{ftIn.inch}<span className="text-3xl text-white/40">"</span>
                        </div>
                        <input
                          type="range" min={48} max={84} value={Math.round(heightCm / 2.54)}
                          onChange={e => setHeightCm(ftInToCm(Math.floor(parseInt(e.target.value) / 12), parseInt(e.target.value) % 12))}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-lime-300"
                        />
                      </div>
                    )}
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={acceptAndGo} className="mt-10 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-black text-slate-950">
                    Continue <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              )}

              {step === "weight" && (
                <div>
                  <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-lime-300">Question {questionPosition + 1} of {questionSteps.length}</p>
                  <div className="mx-auto mt-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-lime-300"><Weight className="h-5 w-5" /></div>
                  <h2 className="font-display mt-4 text-center text-2xl font-black text-white">What's your weight?</h2>

                  <div className="mx-auto mt-5 flex w-fit rounded-full border border-white/10 bg-white/5 p-1">
                    {(["kg", "lb"] as const).map(u => (
                      <button key={u} onClick={() => setWeightUnit(u)} className={`rounded-full px-4 py-1.5 text-[11px] font-black uppercase ${weightUnit === u ? "bg-white text-slate-950" : "text-white/50"}`}>{u}</button>
                    ))}
                  </div>

                  <div className="mt-8">
                    {weightUnit === "kg" ? (
                      <NumberStepper value={weightKg} onChange={setWeightKg} min={30} max={180} suffix="kg" />
                    ) : (
                      <NumberStepper value={lb} onChange={v => setWeightKg(lbToKg(v))} min={66} max={400} suffix="lb" />
                    )}
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={acceptAndGo} className="mt-10 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-black text-slate-950">
                    Continue <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              )}

              {step === "summary" && (
                <div className="text-center">
                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springTransition} className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-lime-300 text-slate-950">
                    <Check className="h-8 w-8" strokeWidth={3} />
                  </motion.div>
                  <h1 className="font-display mt-6 text-2xl font-black text-white">You're all set</h1>
                  <p className="mt-2 text-sm text-white/50">Here's your starting snapshot. Edit it any time from Settings.</p>

                  <div className="mt-7 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Profile</p>
                      <p className="mt-1 text-sm font-bold text-white capitalize">{touched.gender ? gender : "Skipped"} · {touched.age ? `${age}yrs` : "Skipped"}</p>
                      <p className="text-xs text-white/40">{touched.height ? `${heightCm}cm` : "height skipped"} · {touched.weight ? `${weightKg}kg` : "weight skipped"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Est. BMI</p>
                      <p className="mt-1 text-2xl font-black text-white">{bmi > 0 ? bmi : "—"}</p>
                      <p className={`text-xs font-bold ${catColorClass}`}>{cat.label}</p>
                    </div>
                  </div>

                  <motion.button whileTap={{ scale: 0.97 }} onClick={finish} className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 py-4 text-sm font-black text-slate-950">
                    {mode === "onboarding" ? "Enter the app" : "Save changes"} <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
