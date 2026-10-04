import { Exercise } from "../types";

export type AnatomicalCompartment =
  | "Chest"
  | "Shoulders"
  | "Back"
  | "Legs"
  | "Core"
  | "Cardio"
  | "Flexibility";

export type IntensityLevel = "Low" | "Moderate" | "High" | "Extreme";

import { generateSignaturePoseSvg } from "./signaturePoseGenerator";
import { EXERCISE_VIDEOS } from "./exerciseVideos";

export interface CustomExerciseItem {
  id: string;
  name: string;
  category: string;
  focus: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  intensityLevel: IntensityLevel;
  intensityRank: number;
  compartment: AnatomicalCompartment;
  tempo: string;
  keyPoints: string[];
  mistakes: string[];
  isCustomAi: true;
  isBlankPhoto?: boolean;
  signaturePose?: string;
  videoUrl?: string;
  createdAt: string;
}

const STORAGE_KEY = "kinetic_custom_academy_exercises";

/**
 * Infer anatomical compartment based on exercise name and target muscles
 */
export function inferCompartment(name: string, targetMuscle?: string): AnatomicalCompartment {
  const norm = `${name} ${targetMuscle || ""}`.toLowerCase();

  if (
    norm.includes("chest") ||
    norm.includes("pec") ||
    norm.includes("pushup") ||
    norm.includes("push up") ||
    norm.includes("press")
  ) {
    if (norm.includes("overhead") || norm.includes("shoulder") || norm.includes("pike")) {
      return "Shoulders";
    }
    return "Chest";
  }

  if (
    norm.includes("shoulder") ||
    norm.includes("delt") ||
    norm.includes("pike") ||
    norm.includes("lateral raise") ||
    norm.includes("dip") ||
    norm.includes("overhead")
  ) {
    return "Shoulders";
  }

  if (
    norm.includes("back") ||
    norm.includes("lat") ||
    norm.includes("row") ||
    norm.includes("pullup") ||
    norm.includes("pull-up") ||
    norm.includes("superman") ||
    norm.includes("deadlift")
  ) {
    if (norm.includes("single-leg deadlift") || norm.includes("leg")) {
      return "Legs";
    }
    return "Back";
  }

  if (
    norm.includes("leg") ||
    norm.includes("squat") ||
    norm.includes("lunge") ||
    norm.includes("calf") ||
    norm.includes("glute") ||
    norm.includes("quad") ||
    norm.includes("hamstring") ||
    norm.includes("stepup") ||
    norm.includes("step-up") ||
    norm.includes("bridge") ||
    norm.includes("kick")
  ) {
    return "Legs";
  }

  if (
    norm.includes("core") ||
    norm.includes("ab") ||
    norm.includes("plank") ||
    norm.includes("crunch") ||
    norm.includes("situp") ||
    norm.includes("sit-up") ||
    norm.includes("twist") ||
    norm.includes("bird") ||
    norm.includes("bug")
  ) {
    return "Core";
  }

  if (
    norm.includes("cardio") ||
    norm.includes("burpee") ||
    norm.includes("jack") ||
    norm.includes("jump") ||
    norm.includes("mountain") ||
    norm.includes("skater") ||
    norm.includes("hiit")
  ) {
    return "Cardio";
  }

  if (
    norm.includes("stretch") ||
    norm.includes("pose") ||
    norm.includes("fold") ||
    norm.includes("twist") ||
    norm.includes("flex") ||
    norm.includes("mobility") ||
    norm.includes("yoga")
  ) {
    return "Flexibility";
  }

  return "Core";
}

/**
 * Infer intensity rank (1=Low, 2=Moderate, 3=High, 4=Extreme) based on biomechanical loading
 */
export function inferIntensity(name: string): { intensityLevel: IntensityLevel; intensityRank: number } {
  const norm = name.toLowerCase();

  if (
    norm.includes("jump") ||
    norm.includes("plyo") ||
    norm.includes("explosive") ||
    norm.includes("pistol") ||
    norm.includes("burpee") ||
    norm.includes("single-leg") ||
    norm.includes("handstand")
  ) {
    return { intensityLevel: "Extreme", intensityRank: 4 };
  }

  if (
    norm.includes("diamond") ||
    norm.includes("pike") ||
    norm.includes("mountain") ||
    norm.includes("reverse lunge") ||
    norm.includes("russian") ||
    norm.includes("bicycle") ||
    norm.includes("side plank") ||
    norm.includes("leg raise")
  ) {
    return { intensityLevel: "High", intensityRank: 3 };
  }

  if (
    norm.includes("incline") ||
    norm.includes("bridge") ||
    norm.includes("bird") ||
    norm.includes("dead bug") ||
    norm.includes("deadbug") ||
    norm.includes("calf") ||
    norm.includes("child") ||
    norm.includes("cat") ||
    norm.includes("wall")
  ) {
    return { intensityLevel: "Low", intensityRank: 1 };
  }

  return { intensityLevel: "Moderate", intensityRank: 2 };
}

/**
 * Get all dynamically registered AI exercises
 */
export function getCustomAcademyExercises(): CustomExerciseItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}


/**
 * Detect if an exercise collides with an existing Academy exercise.
 * If collision is found, returns the video URL and the matched Academy name.
 */
export function findCollidingAcademyVideo(exerciseName: string): { videoUrl?: string; matchedAcademyName?: string } {
  if (!exerciseName) return {};
  const norm = exerciseName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Direct or slug match against EXERCISE_VIDEOS
  for (const [key, url] of Object.entries(EXERCISE_VIDEOS)) {
    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanKey === norm) {
      return { videoUrl: url, matchedAcademyName: key };
    }
  }

  // 2. Semantic collision detection against Academy library
  if (norm.includes("diamondpush") || (norm.includes("diamond") && norm.includes("push"))) {
    return { videoUrl: "/videos/Diamond Push-ups.mp4", matchedAcademyName: "Diamond Push-ups" };
  }
  if (norm.includes("pikepush") || (norm.includes("pike") && norm.includes("push"))) {
    return { videoUrl: "/videos/pikepushup.mp4", matchedAcademyName: "Pike Push-ups" };
  }
  if (norm.includes("inclinepush") || (norm.includes("incline") && norm.includes("push"))) {
    return { videoUrl: "/videos/Incline Push-ups.mp4", matchedAcademyName: "Incline Push-ups" };
  }
  if (norm.includes("pushup") || norm.includes("push up") || norm.includes("push-up")) {
    return { videoUrl: "/videos/Classic pushup.mp4", matchedAcademyName: "Classic Push-ups" };
  }
  if (norm.includes("jumpsquat") || (norm.includes("jump") && norm.includes("squat"))) {
    return { videoUrl: "/videos/jumpsquat.mp4", matchedAcademyName: "Jump Squats" };
  }
  if (norm.includes("squat")) {
    return { videoUrl: "/videos/Bodyweight squats.mp4", matchedAcademyName: "Bodyweight Squats" };
  }
  if (norm.includes("plank")) {
    return { videoUrl: "/videos/Forearm plank.mp4", matchedAcademyName: "Forearm Plank" };
  }
  if (norm.includes("lunge")) {
    return { videoUrl: "/videos/Reverse Lunges.mp4", matchedAcademyName: "Reverse Lunges" };
  }
  if (norm.includes("burpee")) {
    return { videoUrl: "/videos/Low.mp4", matchedAcademyName: "Low-impact Burpee" };
  }
  if (norm.includes("glutebridge") || (norm.includes("glute") && norm.includes("bridge")) || norm.includes("bridge")) {
    return { videoUrl: "/videos/Glute Bridges .mp4", matchedAcademyName: "Glute Bridges" };
  }
  if (norm.includes("mountainclimber") || (norm.includes("mountain") && norm.includes("climber"))) {
    return { videoUrl: "/videos/Mountain Climbers.mp4", matchedAcademyName: "Mountain Climbers" };
  }
  if (norm.includes("jumpingjack") || norm.includes("jack")) {
    return { videoUrl: "/videos/Jumping Jacks.mp4", matchedAcademyName: "Jumping Jacks" };
  }
  if (norm.includes("russiantwist") || (norm.includes("russian") && norm.includes("twist"))) {
    return { videoUrl: "/videos/Russian twist.mp4", matchedAcademyName: "Russian Twists" };
  }
  if (norm.includes("deadbug") || (norm.includes("dead") && norm.includes("bug"))) {
    return { videoUrl: "/videos/Dead bug.mp4", matchedAcademyName: "Dead Bug" };
  }
  if (norm.includes("birdbug") || norm.includes("birddog") || (norm.includes("bird") && norm.includes("dog"))) {
    return { videoUrl: "/videos/Bird-Dog.mp4", matchedAcademyName: "Bird-Dog" };
  }

  return {};
}

/**
 * Register a new exercise (from AI Generator or active workout) into the Academy.
 * If it collides with an existing Academy exercise, it binds the videoUrl.
 * If it is completely novel, it creates a new Academy entry with its signature pose SVG thumbnail.
 */
export function registerCustomExercise(ex: {
  name: string;
  targetMuscle?: string;
  description?: string;
  category?: string;
}): CustomExerciseItem | null {
  if (typeof window === "undefined" || !ex.name) return null;

  const current = getCustomAcademyExercises();
  const normName = ex.name.trim().toLowerCase();

  // Avoid duplicate registrations
  const existing = current.find((c) => c.name.trim().toLowerCase() === normName);
  if (existing) return existing;

  const compartment = inferCompartment(ex.name, ex.targetMuscle);
  const { intensityLevel, intensityRank } = inferIntensity(ex.name);

  const slug = normName.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `custom-${Date.now()}`;

  // Collision detection with curated Academy exercises
  const collision = findCollidingAcademyVideo(ex.name);
  const collisionVideo = collision.videoUrl;

  // Dynamic AI signature pose diagram generated in fractions of a millisecond
  const signaturePose = generateSignaturePoseSvg(ex.name, compartment, ex.targetMuscle);

  const newItem: CustomExerciseItem = {
    id: `ai_${slug}_${Date.now()}`,
    name: ex.name.trim(),
    category: ex.category || compartment,
    focus: ex.targetMuscle || `${compartment} conditioning`,
    description: ex.description || `AI customized movement focusing on ${compartment.toLowerCase()} engagement.`,
    difficulty: intensityRank >= 3 ? "Advanced" : intensityRank === 2 ? "Intermediate" : "Beginner",
    intensityLevel,
    intensityRank,
    compartment,
    tempo: "Controlled 2–1–2",
    keyPoints: [
      "Maintain active core bracing",
      "Control the eccentric descent phase",
      "Breathe rhythmically throughout the movement",
    ],
    mistakes: ["Rushing the tempo", "Losing trunk stability"],
    isCustomAi: true,
    isBlankPhoto: false,
    signaturePose,
    videoUrl: collisionVideo,
    createdAt: new Date().toISOString(),
  };

  try {
    const next = [...current, newItem];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("kinetic_custom_exercises_updated"));
    return newItem;
  } catch {
    return null;
  }
}

/**
 * Auto-registers all exercises in a workout
 */
export function registerWorkoutExercises(exercises: Exercise[]) {
  if (!exercises || !Array.isArray(exercises)) return;
  exercises.forEach((ex) => {
    registerCustomExercise(ex);
  });
}
