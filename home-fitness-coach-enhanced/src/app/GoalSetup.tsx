import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Check, Loader2, Zap, Flame, Activity, Heart } from "lucide-react";
import { AVAILABLE_EQUIPMENT, FITNESS_LEVELS, WORKOUT_GOALS } from "../constants";
import { generateApexNeuralWorkout } from "../features/workout/proceduralWorkout";
import { tapFeedback, successFeedback } from "../core/haptics";
import { track } from "../core/track";
import { EV } from "../core/analyticsEvents";
import type { UserProfile, Workout } from "../types";
import { useT, type TKey } from "../i18n";

const GOAL_ICON: Record<string, React.ElementType> = { Zap, Flame, Activity, Heart };
const STEPS = ["gs.step0", "gs.step1", "gs.step2"] as const;
const GOAL_KEY: Record<string, string> = { Strength: "strength", "Cardio / Fat Loss": "cardio", Flexibility: "flex", "General Health": "health" };

/** Three quick questions, then a first workout built on the spot. Skippable at every step. */
export default function GoalSetup({
  initial, onDone, onSkip,
}: {
  initial: Pick<UserProfile, "goal" | "fitnessLevel" | "preferredEquipment">;
  onDone: (choices: Pick<UserProfile, "goal" | "fitnessLevel" | "preferredEquipment">, firstWorkout: Workout) => void;
  onSkip: () => void;
}) {
  const t = useT();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<UserProfile["goal"]>(initial.goal);
  const [level, setLevel] = useState<UserProfile["fitnessLevel"]>(initial.fitnessLevel);
  const [equip, setEquip] = useState<string[]>(initial.preferredEquipment.length ? initial.preferredEquipment : ["bodyweight"]);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => {
    void tapFeedback();
    setEquip(cur => {
      if (id === "bodyweight") return ["bodyweight"];
      const without = cur.filter(x => x !== "bodyweight");
      const next = without.includes(id) ? without.filter(x => x !== id) : [...without, id];
      return next.length ? next : ["bodyweight"];
    });
  };

  const next = () => {
    void tapFeedback();
    track(EV.goalSetupStep, { step: step + 1 });
    if (step < 2) { setStep(step + 1); return; }
    setBusy(true);
    const names = equip.map(id => AVAILABLE_EQUIPMENT.find(e => e.id === id)?.name || id);
    const plan = generateApexNeuralWorkout({ fitnessLevel: level, goal, duration: 2, targetArea: "Full Body", equipment: names });
    const workout: Workout = {
      id: `first-${Date.now()}`,
      workoutTitle: plan.workoutTitle || "2-Minute Starter",
      workoutDescription: plan.workoutDescription || "Built for your goal, level and equipment.",
      totalDurationMinutes: plan.totalDurationMinutes || 2,
      targetArea: plan.targetArea || "Full Body",
      equipmentNeeded: plan.equipmentNeeded || names,
      exercises: plan.exercises,
      coachingTips: plan.coachingTips || [],
      isAiGenerated: false,
      createdAt: new Date().toISOString(),
    };
    void successFeedback();
    track(EV.goalSet, { goal, level });
    onDone({ goal, fitnessLevel: level, preferredEquipment: equip }, workout);
  };

  return (
    <div className="fixed inset-0 z-[110] flex flex-col overflow-y-auto bg-void px-5 pb-8 pt-6 text-ink">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center justify-between">
          <button onClick={() => (step ? setStep(step - 1) : onSkip())} aria-label={t("common.back")} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-carbon active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button onClick={() => { track(EV.goalSetupSkipped, { step }); onSkip(); }} className="text-xs font-semibold text-ink-3">{t("common.skip")}</button>
        </div>
        <div className="mt-4 flex gap-1.5">{STEPS.map((s, i) => <span key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-volt" : "bg-graphite"}`} />)}</div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }} className="mt-8 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-3">{t("gs.stepOf", { n: step + 1 })}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">{t(`gs.h${step}` as TKey)}</h1>
            <p className="mt-1 text-sm text-ink-2">{t(`gs.s${step}` as TKey)}</p>

            <div className="mt-6 space-y-2.5">
              {step === 0 && WORKOUT_GOALS.map(g => {
                const Icon = GOAL_ICON[g.icon] || Zap;
                return <Option key={g.value} active={goal === g.value} onClick={() => { void tapFeedback(); setGoal(g.value as UserProfile["goal"]); }} icon={<Icon className="h-5 w-5" />} title={t(`goal.${GOAL_KEY[g.value]}.label` as TKey)} sub={t(`goal.${GOAL_KEY[g.value]}.desc` as TKey)} />;
              })}
              {step === 1 && FITNESS_LEVELS.map(l => (
                <Option key={l.value} active={level === l.value} onClick={() => { void tapFeedback(); setLevel(l.value as UserProfile["fitnessLevel"]); }} title={t(`level.${l.value.toLowerCase()}.label` as TKey)} sub={t(`level.${l.value.toLowerCase()}.desc` as TKey)} />
              ))}
              {step === 2 && AVAILABLE_EQUIPMENT.map(e => (
                <Option key={e.id} active={equip.includes(e.id)} onClick={() => toggle(e.id)} title={t(`equip.${e.id}` as TKey)} />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <button onClick={next} disabled={busy} className="mt-6 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-volt text-base font-black text-void active:scale-[0.98] disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {step < 2 ? t("common.continue") : t("gs.start")}
        </button>
      </div>
    </div>
  );
}

function Option({ active, onClick, title, sub, icon }: { active: boolean; onClick: () => void; title: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${active ? "border-volt bg-volt/10" : "border-line bg-carbon"}`}>
      {icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-graphite text-volt">{icon}</span>}
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{title}</span>{sub && <span className="block text-xs text-ink-3">{sub}</span>}</span>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${active ? "border-volt bg-volt text-void" : "border-line"}`}>{active && <Check className="h-4 w-4" />}</span>
    </button>
  );
}
