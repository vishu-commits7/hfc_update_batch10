export type PhysiologicalCategory =
  | "strength_power"
  | "hypertrophy"
  | "core_postural"
  | "metabolic_cardio"
  | "mobility_flexibility";

export interface ScientificRestProfile {
  category: PhysiologicalCategory;
  categoryLabel: string;
  energySystem: string;
  durationSeconds: number;
  scientificRationale: string;
  recoveryCue: string;
  targetHeartRateZone: string;
  breathingGuide: {
    inhaleSeconds: number;
    holdSeconds: number;
    exhaleSeconds: number;
    technique: string;
  };
  hydrationTip: string;
}

/**
 * Exercise categorization based on biomechanical demand and primary bioenergetic pathway:
 * 1. Strength & High Neuromuscular Tension (ATP-CP / Phosphagen) -> 50-60s
 * 2. Hypertrophy & Muscular Resistance (Glycolytic / Lactic Buffering) -> 45s
 * 3. Core & Postural Stability (Intra-Abdominal & Spinal Reset) -> 35s
 * 4. Metabolic Cardio & HIIT (Heart Rate Deceleration & Lactic Clearance) -> 40s
 * 5. Mobility & Restorative Cooldown (Parasympathetic Vagal Tone) -> 20s
 */
const REST_PROFILES: Record<PhysiologicalCategory, Omit<ScientificRestProfile, "category">> = {
  strength_power: {
    categoryLabel: "Power & Strength",
    energySystem: "Explosive Energy Recovery",
    durationSeconds: 50,
    scientificRationale:
      "Your muscle energy stores (phosphocreatine) recharge ~90% in 50s. This restores maximum power so you crush your next set with clean form.",
    recoveryCue: "Take deep, smooth belly breaths to oxygenate your muscles.",
    targetHeartRateZone: "Zone 2 (110–125 BPM)",
    breathingGuide: {
      inhaleSeconds: 4,
      holdSeconds: 3,
      exhaleSeconds: 4,
      technique: "Box breathing to steady your heart rate and nervous system.",
    },
    hydrationTip: "Take a sip of water to maintain cellular hydration.",
  },
  hypertrophy: {
    categoryLabel: "Muscle Growth & Tone",
    energySystem: "Muscle Burn Recovery",
    durationSeconds: 45,
    scientificRationale:
      "45 seconds clears metabolic burn and resets muscle pH, giving you the perfect balance of tension and stamina for growth.",
    recoveryCue: "Shake out your arms and legs to keep blood flowing.",
    targetHeartRateZone: "Zone 2/3 (115–130 BPM)",
    breathingGuide: {
      inhaleSeconds: 4,
      holdSeconds: 2,
      exhaleSeconds: 4,
      technique: "Rhythmic breathing to clear muscle fatigue.",
    },
    hydrationTip: "Hydrate: electrolytes support clean muscle contraction.",
  },
  core_postural: {
    categoryLabel: "Core & Stability Reset",
    energySystem: "Spine & Nerve Reset",
    durationSeconds: 35,
    scientificRationale:
      "Relieves abdominal pressure and decompresses your spine, letting core stabilizing fibers recharge for perfect posture.",
    recoveryCue: "Relax your stomach muscles completely; breathe 360 degrees.",
    targetHeartRateZone: "Zone 1/2 (<115 BPM)",
    breathingGuide: {
      inhaleSeconds: 4,
      holdSeconds: 1,
      exhaleSeconds: 5,
      technique: "Slow belly breathing to decompress spinal muscles.",
    },
    hydrationTip: "Hydration keeps joints and spinal discs cushioned.",
  },
  metabolic_cardio: {
    categoryLabel: "Cardio & Stamina",
    energySystem: "Aerobic Recovery & Oxygen Boost",
    durationSeconds: 40,
    scientificRationale:
      "Brings your heart rate down and recharges your oxygen supply so you can sustain high speed and stamina on the next round.",
    recoveryCue: "Hands on hips or overhead to open up your chest and lungs.",
    targetHeartRateZone: "Zone 2 recovery (<130 BPM)",
    breathingGuide: {
      inhaleSeconds: 3,
      holdSeconds: 1,
      exhaleSeconds: 5,
      technique: "Pursed-lip exhales to bring your pulse down smoothly.",
    },
    hydrationTip: "Sip cool water to regulate body temperature.",
  },
  mobility_flexibility: {
    categoryLabel: "Mobility & Restorative Flow",
    energySystem: "Nervous System Calming",
    durationSeconds: 20,
    scientificRationale:
      "Extended exhales signal your nervous system to calm down, allowing tight muscles and connective tissue to lengthen.",
    recoveryCue: "Flow smoothly between stretches without forcing range.",
    targetHeartRateZone: "Resting Zone (60–90 BPM)",
    breathingGuide: {
      inhaleSeconds: 4,
      holdSeconds: 2,
      exhaleSeconds: 6,
      technique: "Long, gentle exhales to deepen your stretch.",
    },
    hydrationTip: "Sip water to support smooth joint movement.",
  },
};

/**
 * Mapping of movements to physiological categories.
 */
const EXERCISE_CATEGORY_MAP: Record<string, PhysiologicalCategory> = {
  // Strength / Power
  "pushups": "strength_power",
  "pushup": "strength_power",
  "classic-push-ups": "strength_power",
  "classic push-ups": "strength_power",
  "diamond-pushup": "strength_power",
  "diamond push-ups": "strength_power",
  "diamond pushup": "strength_power",
  "pike-pushup": "strength_power",
  "pike push-ups": "strength_power",
  "incline": "strength_power",
  "incline push-up": "strength_power",
  "incline push-ups": "strength_power",
  "jump-squat": "strength_power",
  "jump squats": "strength_power",
  "single-leg-deadlift": "strength_power",
  "single leg deadlift": "strength_power",
  "dips": "strength_power",
  "chair tricep dips": "strength_power",

  // Hypertrophy / Resistance
  "squats": "hypertrophy",
  "bodyweight squats": "hypertrophy",
  "lunges": "hypertrophy",
  "reverse lunges": "hypertrophy",
  "sumo-squat": "hypertrophy",
  "sumo squats": "hypertrophy",
  "bicep-curl": "hypertrophy",
  "dumbbell bicep curl": "hypertrophy",
  "lateral-raise": "hypertrophy",
  "lateral raises": "hypertrophy",
  "bent-row": "hypertrophy",
  "bent-over rows": "hypertrophy",
  "donkey-kick": "hypertrophy",
  "donkey kicks": "hypertrophy",
  "calf": "hypertrophy",
  "calf raises": "hypertrophy",
  "stepup": "hypertrophy",
  "supported step-up": "hypertrophy",
  "bridges": "hypertrophy",
  "glute bridges": "hypertrophy",

  // Core & Postural
  "plank": "core_postural",
  "forearm plank": "core_postural",
  "side-plank": "core_postural",
  "side plank": "core_postural",
  "bird-dog": "core_postural",
  "bird dog": "core_postural",
  "deadbug": "core_postural",
  "dead bug": "core_postural",
  "superman": "core_postural",
  "superman hold": "core_postural",
  "situps": "core_postural",
  "sit-ups": "core_postural",
  "crunches": "core_postural",
  "standard crunches": "core_postural",
  "legraises": "core_postural",
  "lying leg raises": "core_postural",
  "russian-twist": "core_postural",
  "russian twists": "core_postural",
  "shoulder-taps": "core_postural",
  "shoulder taps": "core_postural",
  "bicycle": "core_postural",
  "bicycle crunches": "core_postural",
  "wall-sit": "core_postural",
  "wall sit": "core_postural",

  // Cardio / Metabolic
  "burpees": "metabolic_cardio",
  "low-impact burpee": "metabolic_cardio",
  "mountain": "metabolic_cardio",
  "mountain climbers": "metabolic_cardio",
  "jacks": "metabolic_cardio",
  "jumping jacks": "metabolic_cardio",
  "skater-hop": "metabolic_cardio",
  "skater hops": "metabolic_cardio",

  // Mobility / Flexibility
  "world-greatest-stretch": "mobility_flexibility",
  "world's greatest stretch": "mobility_flexibility",
  "cat-cow": "mobility_flexibility",
  "cat-cow stretch": "mobility_flexibility",
  "cobra-stretch": "mobility_flexibility",
  "cobra stretch": "mobility_flexibility",
  "seated-fold": "mobility_flexibility",
  "seated forward fold": "mobility_flexibility",
  "spinal-twist": "mobility_flexibility",
  "supine spinal twist": "mobility_flexibility",
  "childs-pose": "mobility_flexibility",
  "child's pose": "mobility_flexibility",
};

/**
 * Returns a scientifically tailored rest profile based on the exercise performed.
 */
export function getScientificRest(
  exerciseName: string,
  targetMuscle?: string,
  userOrPresetRestSeconds?: number
): ScientificRestProfile {
  const norm = (exerciseName || "").toLowerCase().trim();
  const slug = norm.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  let category: PhysiologicalCategory = "hypertrophy";

  if (EXERCISE_CATEGORY_MAP[slug]) {
    category = EXERCISE_CATEGORY_MAP[slug];
  } else if (EXERCISE_CATEGORY_MAP[norm]) {
    category = EXERCISE_CATEGORY_MAP[norm];
  } else {
    // Infer using target muscle and name patterns
    if (
      norm.includes("stretch") ||
      norm.includes("pose") ||
      norm.includes("fold") ||
      norm.includes("twist") ||
      (targetMuscle && targetMuscle.toLowerCase().includes("flexibility"))
    ) {
      category = "mobility_flexibility";
    } else if (
      norm.includes("plank") ||
      norm.includes("crunch") ||
      norm.includes("core") ||
      norm.includes("ab") ||
      norm.includes("deadbug") ||
      norm.includes("bird") ||
      norm.includes("superman")
    ) {
      category = "core_postural";
    } else if (
      norm.includes("jump") ||
      norm.includes("burpee") ||
      norm.includes("jack") ||
      norm.includes("cardio") ||
      norm.includes("climber") ||
      norm.includes("skater")
    ) {
      category = "metabolic_cardio";
    } else if (
      norm.includes("pushup") ||
      norm.includes("push-up") ||
      norm.includes("press") ||
      norm.includes("dip") ||
      norm.includes("deadlift")
    ) {
      category = "strength_power";
    } else {
      category = "hypertrophy";
    }
  }

  const base = REST_PROFILES[category];
  
  // Use explicit duration if provided and realistic (>= 15s), otherwise use scientific optimal
  const duration =
    userOrPresetRestSeconds && userOrPresetRestSeconds >= 15
      ? userOrPresetRestSeconds
      : base.durationSeconds;

  return {
    category,
    ...base,
    durationSeconds: duration,
  };
}
