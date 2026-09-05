import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Dumbbell, Trophy, Wind, ChevronRight, ChevronLeft, X } from "lucide-react";
import { DEMO_EXERCISES } from "./ExerciseLibrary";
import Dumbbell3D from "./Dumbbell3D";
import heroPullupStrip from "../assets/ui/hero-pullup-strip.jpg";

const SLIDES = [
  // (exercise count below is pulled live from the library, never hardcoded)
  {
    icon: Sparkles,
    hero3d: true,
    heroPhoto: true,
    title: "Welcome to Home Fitness Coach",
    body: "This build starts completely empty — zero workouts, zero history, zero fake numbers. Everything you see from here on is real, and it's yours.",
  },
  {
    icon: Trophy,
    hero3d: false,
    heroPhoto: false,
    title: "Premium activated",
    body: "Your full coaching suite is unlocked by default: 30+ premium modules, multi-week programs, badges, a wellness toolkit and more. Switch to Basic any time from the top bar or the Hub.",
  },
  {
    icon: Dumbbell,
    hero3d: true,
    heroPhoto: false,
    title: `${DEMO_EXERCISES.length} illustrated exercises`,
    body: "The Exercise Academy has a fully illustrated, looping demo for every movement — with a male and a female figure to choose from — plus form cues and common mistakes. No video downloads required.",
  },
  {
    icon: Wind,
    hero3d: false,
    heroPhoto: false,
    title: "Tools for the whole routine",
    body: "Breathing timer, water tracker, BMI & calorie calculator, a monthly calendar and 24 achievement badges — all in the Hub tab, all starting at zero.",
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const slide = SLIDES[step];
  const Icon = slide.icon;
  const isLast = step === SLIDES.length - 1;

  const goTo = (delta: number) => {
    setDirection(delta);
    setStep(s => Math.max(0, Math.min(SLIDES.length - 1, s + delta)));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[32px] bg-white shadow-2xl animate-fade-in">
        <button onClick={onDone} className="absolute right-4 top-4 z-10 rounded-full bg-black/20 p-1.5 text-white backdrop-blur-sm hover:bg-black/30">
          <X className="h-4 w-4"/>
        </button>

        {/* Real-photo hero strip — only on the very first "welcome" slide,
            so the app's opening moment is a real gym photo, not just an
            icon. Fades into the white card so it reads as one continuous
            surface rather than a pasted-on banner. */}
        {slide.heroPhoto && (
          <div className="relative h-36 w-full overflow-hidden">
            <img src={heroPullupStrip} alt="" className="h-full w-full object-cover object-[50%_30%]" draggable={false} />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-black/10" />
          </div>
        )}

        <div className={slide.heroPhoto ? "px-7 pb-7 -mt-2" : "p-7"}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 36 : -36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -36 : 36 }}
            transition={{ type: "spring", stiffness: 340, damping: 32, mass: 0.9 }}
          >
            {slide.heroPhoto ? null : slide.hero3d ? (
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-slate-950">
                <Dumbbell3D size={64} />
              </div>
            ) : (
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-lime-300">
                <Icon className="h-6 w-6"/>
              </div>
            )}

            <h2 className="font-display mt-5 text-center text-xl font-black tracking-tight text-slate-900">{slide.title}</h2>
            <p className="mt-3 text-center text-sm leading-6 text-slate-500">{slide.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => { setDirection(i > step ? 1 : -1); setStep(i); }}
              aria-label={`Go to step ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-slate-900" : "w-1.5 bg-slate-200 hover:bg-slate-300"}`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => goTo(-1)}
              className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition-all hover:bg-slate-50 active:scale-95"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4"/>
            </button>
          )}
          <button
            onClick={() => isLast ? onDone() : goTo(1)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-black text-white transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            {isLast ? "Start training" : "Next"} <ChevronRight className="h-4 w-4"/>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
