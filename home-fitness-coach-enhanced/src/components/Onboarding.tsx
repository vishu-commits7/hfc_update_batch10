import { track } from "../lib/track";
import { EV } from "../lib/analyticsEvents";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Trophy, ChevronRight, ChevronLeft, X } from "lucide-react";
import Dumbbell3D from "./Dumbbell3DLazy";
import heroPullupStrip from "../assets/ui/hero-pullup-strip.jpg";
import { tapFeedback, successFeedback } from "../lib/haptics";
import { SPRING_SNAP, SPRING_WEIGHTED } from "../design/motion";
import { useT, type TKey } from "../i18n";
import LanguageSwitch from "./LanguageSwitch";

const SLIDES = [
  {
    icon: Sparkles,
    hero3d: false,
    heroPhoto: true,
    title: "onb.s1.title" as TKey,
    body: "onb.s1.body" as TKey,
  },
  {
    icon: Trophy,
    hero3d: false,
    heroPhoto: false,
    title: "onb.s2.title" as TKey,
    body: "onb.s2.body" as TKey,
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const slide = SLIDES[step];
  const Icon = slide.icon;
  const isLast = step === SLIDES.length - 1;

  const goTo = (delta: number) => {
    tapFeedback();
    setDirection(delta);
    track(EV.onboardingStep, { step: Math.max(0, Math.min(SLIDES.length - 1, step + delta)) });
    setStep((s) => Math.max(0, Math.min(SLIDES.length - 1, s + delta)));
  };

  const handleFinish = () => {
    successFeedback();
    track(EV.onboardingComplete);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-5 backdrop-blur-md">
      <div className="aurora-card relative w-full max-w-sm overflow-hidden rounded-[28px] border border-cyan-500/30 bg-slate-950 shadow-[0_0_50px_rgba(6,182,212,0.18)]">
        <button
          onClick={handleFinish}
          className="absolute right-3.5 top-3.5 z-20 rounded-full border border-white/10 bg-black/50 p-1.5 text-ink-3 backdrop-blur transition hover:text-white"
          aria-label={t("onb.skipAria")}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="absolute left-3 top-3 z-20"><LanguageSwitch /></div>

        {slide.heroPhoto && (
          <div className="relative h-40 w-full overflow-hidden">
            <img
              src={heroPullupStrip}
              alt=""
              className="h-full w-full object-cover object-[50%_30%]"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          </div>
        )}

        <div className={slide.heroPhoto ? "px-6 pb-6 pt-2" : "p-6"}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 28 : -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -28 : 28 }}
              transition={SPRING_WEIGHTED}
              className="text-center"
            >
              {!slide.heroPhoto && (
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
                  {slide.hero3d ? (
                    <Dumbbell3D size={54} />
                  ) : (
                    <Icon className="h-7 w-7 text-cyan-300" />
                  )}
                </div>
              )}

              <h2 className="font-display mt-4 text-xl font-black tracking-tight text-white">
                {t(slide.title)}
              </h2>
              <p className="mx-auto mt-2 max-w-[28ch] text-xs leading-relaxed text-ink-3">
                {t(slide.body)}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Clean indicator dots */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  tapFeedback();
                  setDirection(i > step ? 1 : -1);
                  setStep(i);
                }}
                aria-label={t("onb.gotoAria", { n: i + 1 })}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-cyan-400" : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex items-center gap-2">
            {step > 0 && (
              <motion.button
                type="button"
                transition={SPRING_SNAP}
                onClick={() => goTo(-1)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-ink-3 hover:text-white"
                aria-label={t("onb.prevAria")}
              >
                <ChevronLeft className="h-4 w-4" />
              </motion.button>
            )}
            <motion.button
              type="button"
              transition={SPRING_SNAP}
              onClick={() => (isLast ? handleFinish() : goTo(1))}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl py-2 bg-gradient-to-r from-cyan-400 to-emerald-400 text-xs font-black text-slate-950 shadow-md"
            >
              <span>{isLast ? t("onb.start") : t("onb.next")}</span>
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
