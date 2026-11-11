import { Exercise } from "../../types";

export type AnatomicalCompartment =
  | "Chest"
  | "Shoulders"
  | "Back"
  | "Legs"
  | "Core"
  | "Cardio"
  | "Flexibility";

export type IntensityLevel = "Low" | "Moderate" | "High" | "Extreme";

import { getAiGymSignaturePhoto, generateAiGymImage } from "./signaturePoseGenerator";
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
 * Curated Academy exercise identifiers.
 * Custom AI exercises must never duplicate these core curriculum movements.
 */
export const BUILT_IN_ACADEMY_NAMES = new Set([
  "inclinepushup", "inclinepushups", "classicpushup", "classicpushups", "pushups", "pushup",
  "diamondpushup", "diamondpushups", "pikepushup", "pikepushups", "shouldertaps", "shouldertap",
  "lateralraise", "lateralraises", "dumbbellbicepcurl", "bicepcurl", "bicepcurls",
  "chairtricepdips", "chairdips", "tricepdips", "dips", "dip", "bentoverrows", "bentrow",
  "forearmplank", "plank", "standardcrunches", "crunches", "crunch", "situps", "situp",
  "bicyclecrunches", "bicyclecrunch", "bicycle", "russiantwists", "russiantwist",
  "deadbug", "lyinglegraises", "legraises", "legraise", "glutebridges", "glutebridge", "bridges", "bridge",
  "bodyweightsquats", "bodyweightsquat", "squats", "squat", "wallsit", "reverselunges", "reverselunge",
  "lunges", "lunge", "calfraises", "calfraise", "calf", "donkeykicks", "donkeykick",
  "supportedstepup", "stepup", "sumosquats", "sumosquat", "singlelegdeadlift", "deadlift",
  "jumpsquats", "jumpsquat", "skaterhops", "skaterhop", "skater", "lowimpactburpee", "burpees", "burpee",
  "jumpingjacks", "jumpingjack", "jacks", "mountainclimbers", "mountainclimber", "mountain",
  "sideplank", "supermanhold", "superman", "birddog", "childspose", "catcowstretch", "catcow",
  "cobrastretch", "cobra", "seatedforwardfold", "forwardfold", "supinespinaltwist", "spinaltwist",
  "worldsgreateststretch", "greateststretch",
  "highknees", "highknee", "widegrippushup", "widepushup", "burpeepushup",
  "standingkneeraises", "standingkneeraise", "hamstringstretchleft", "hamstringstretchright",
  "9090hipstretchleft", "9090hipstretchright", "hipstretch9090left", "hipstretch9090right",
  "armcircles", "armcircle", "arnoldpress", "jumprope", "boxjump", "neckrolls", "neckroll"
]);

/**
 * Detect if an exercise is an existing built-in Academy movement.
 */
export function isBuiltInAcademyExercise(exerciseName: string): boolean {
  if (!exerciseName) return false;
  const clean = exerciseName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (BUILT_IN_ACADEMY_NAMES.has(clean)) return true;
  for (const name of BUILT_IN_ACADEMY_NAMES) {
    if (clean === name || (name.length >= 5 && (clean.includes(name) || name.includes(clean)))) {
      return true;
    }
  }
  const colliding = findCollidingAcademyVideo(exerciseName);
  return !!colliding.matchedAcademyName;
}

let memoryCustomExercises: CustomExerciseItem[] | null = null;
let memoryPoseMap: Map<string, string> | null = null;

export function invalidateCustomExercisesCache() {
  memoryCustomExercises = null;
  memoryPoseMap = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) invalidateCustomExercisesCache();
  });
  window.addEventListener("kinetic_custom_exercises_updated", invalidateCustomExercisesCache);
}

/**
 * Fast O(1) in-memory signature pose lookup for thumbnails
 */
export function getCustomExerciseSignaturePose(exerciseName: string): string | undefined {
  if (!exerciseName) return undefined;
  if (!memoryPoseMap) {
    getCustomAcademyExercises();
  }
  const norm = exerciseName.trim().toLowerCase();
  return memoryPoseMap?.get(norm);
}

/**
 * Get all dynamically registered AI exercises, automatically pruning any duplicates of core Academy movements
 */
export function getCustomAcademyExercises(): CustomExerciseItem[] {
  if (typeof window === "undefined") return [];
  if (memoryCustomExercises !== null) {
    return memoryCustomExercises;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const seen = new Set<string>();
        const sanitized: CustomExerciseItem[] = [];
        const poseMap = new Map<string, string>();
        let hasChanges = false;

        for (const item of parsed) {
          if (!item || !item.name) {
            hasChanges = true;
            continue;
          }
          const clean = item.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
          if (isBuiltInAcademyExercise(item.name) || seen.has(clean)) {
            hasChanges = true;
            continue;
          }
          seen.add(clean);
          if (clean.includes("scorpion")) {
            if (!item.signaturePose || item.signaturePose.includes("pushup-black") || item.signaturePose.startsWith("data:") || !item.signaturePose.includes("scorpion")) {
              item.signaturePose = "/thumbnails/prone-scorpion.jpg";
              hasChanges = true;
            }
          }
          if (item.signaturePose) {
            poseMap.set(item.name.trim().toLowerCase(), item.signaturePose);
          }
          sanitized.push(item);
        }

        if (hasChanges) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
          } catch {}
        }

        memoryPoseMap = poseMap;
        memoryCustomExercises = sanitized;
        return sanitized;
      }
    }
  } catch {}

  memoryPoseMap = new Map();
  memoryCustomExercises = [];
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
    return { videoUrl: "/videos/Pike push-ups.mp4", matchedAcademyName: "Pike Push-ups" };
  }
  if (norm.includes("inclinepush") || (norm.includes("incline") && norm.includes("push"))) {
    return { videoUrl: "/videos/Incline Push-ups.mp4", matchedAcademyName: "Incline Push-ups" };
  }
  if (norm.includes("pushup") || norm.includes("push up") || norm.includes("push-up")) {
    return { videoUrl: "/videos/Classic pushup.mp4", matchedAcademyName: "Classic Push-ups" };
  }
  if (norm.includes("jumpsquat") || (norm.includes("jump") && norm.includes("squat"))) {
    return { videoUrl: "/videos/Jump Squats.mp4", matchedAcademyName: "Jump Squats" };
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
    return { videoUrl: "/videos/Russian Twists.mp4", matchedAcademyName: "Russian Twists" };
  }
  if (norm.includes("deadbug") || (norm.includes("dead") && norm.includes("bug"))) {
    return { videoUrl: "/videos/Dead Bug.mp4", matchedAcademyName: "Dead Bug" };
  }
  if (norm.includes("birdbug") || norm.includes("birddog") || (norm.includes("bird") && norm.includes("dog"))) {
    return { videoUrl: "/videos/Bird Dog Exercise .mp4", matchedAcademyName: "Bird-Dog" };
  }

  return {};
}

/**
 * Register a new exercise (from AI Generator or active workout) into the Academy.
 * If it collides with an existing Academy exercise, it binds the videoUrl.
 * Sets the authentic AI gym photo signature pose as its thumbnail, and triggers
 * background AI image generation.
 */
export function registerCustomExercise(ex: {
  name: string;
  targetMuscle?: string;
  description?: string;
  category?: string;
  signaturePose?: string;
  videoUrl?: string;
}): CustomExerciseItem | null {
  if (typeof window === "undefined" || !ex.name) return null;

  // Never duplicate core Academy movements
  if (isBuiltInAcademyExercise(ex.name)) {
    return null;
  }

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
  const collisionVideo = ex.videoUrl || collision.videoUrl;

  // Authentic gym photography signature pose (identical to classic pushup thumbnail quality)
  let initialSignaturePose =
    ex.signaturePose || getAiGymSignaturePhoto(ex.name, compartment, ex.targetMuscle);

  if (normName.includes("scorpion")) {
    initialSignaturePose = "/thumbnails/prone-scorpion.jpg";
  }

  const newItem: CustomExerciseItem = {
    id: `ai_${slug}_${Date.now()}`,
    name: ex.name.trim(),
    category: ex.category || compartment,
    focus: ex.targetMuscle || `${compartment} conditioning`,
    description: ex.description || `Movement focusing on ${compartment.toLowerCase()} engagement.`,
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
    signaturePose: initialSignaturePose,
    videoUrl: collisionVideo,
    createdAt: new Date().toISOString(),
  };

  try {
    const next = [...current, newItem];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("kinetic_custom_exercises_updated"));

    // Concurrently trigger Imagen 3 generation in background to upgrade to fresh AI gym image
    generateAiGymImage({
      name: newItem.name,
      compartment: newItem.compartment,
      targetMuscle: newItem.focus,
      description: newItem.description,
    }).then((aiImageUrl) => {
      if (aiImageUrl) {
        updateCustomExerciseImage(newItem.id, aiImageUrl);
      }
    }).catch(() => {});

    return newItem;
  } catch {
    return null;
  }
}

/**
 * Manually update or add a video demo for an exercise in the Academy.
 * Allows user to bind videos manually at any time.
 */
export function updateCustomExerciseVideo(idOrName: string, videoUrl: string): boolean {
  if (typeof window === "undefined" || !idOrName) return false;
  const current = getCustomAcademyExercises();
  const norm = idOrName.trim().toLowerCase();

  const idx = current.findIndex(
    (c) => c.id.toLowerCase() === norm || c.name.toLowerCase() === norm
  );

  if (idx !== -1) {
    current[idx].videoUrl = videoUrl.trim();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent("kinetic_custom_exercises_updated"));
    return true;
  }

  // If exercise is a built-in Academy exercise, register an override
  const newItem = registerCustomExercise({
    name: idOrName,
    videoUrl: videoUrl.trim(),
  });
  return !!newItem;
}

/**
 * Update the AI Gym photo / image thumbnail for an exercise in the Academy.
 */
export function updateCustomExerciseImage(idOrName: string, imageUrl: string): boolean {
  if (typeof window === "undefined" || !idOrName) return false;
  const current = getCustomAcademyExercises();
  const norm = idOrName.trim().toLowerCase();

  const idx = current.findIndex(
    (c) => c.id.toLowerCase() === norm || c.name.toLowerCase() === norm
  );

  if (idx !== -1) {
    current[idx].signaturePose = imageUrl;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent("kinetic_custom_exercises_updated"));
    return true;
  }
  return false;
}

/**
 * Delete a custom exercise from the Academy
 */
export function deleteCustomExercise(id: string): boolean {
  if (typeof window === "undefined" || !id) return false;
  const current = getCustomAcademyExercises();
  const filtered = current.filter((c) => c.id !== id);
  if (filtered.length !== current.length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent("kinetic_custom_exercises_updated"));
    return true;
  }
  return false;
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
