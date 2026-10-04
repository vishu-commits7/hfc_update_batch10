export interface Exercise {
  name: string;
  description: string;
  durationSeconds: number; // 0 if rep-based
  reps: number;            // 0 if duration-based
  sets: number;
  restSeconds: number;
  targetMuscle: string;
}

export interface Workout {
  id: string;
  workoutTitle: string;
  workoutDescription: string;
  totalDurationMinutes: number;
  targetArea: string;
  equipmentNeeded: string[];
  exercises: Exercise[];
  coachingTips: string[];
  isAiGenerated?: boolean;
  createdAt: string;
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  workoutTitle: string;
  completedAt: string;
  durationMinutes: number;
  exercisesCompleted: number;
  feeling: "Energetic" | "Tired" | "Satisfied" | "Sore" | "Exhausted";
  userNotes?: string;
  estimatedCaloriesBurned: number;
}

export interface UserProfile {
  fitnessLevel: "Beginner" | "Intermediate" | "Advanced";
  goal: "Strength" | "Cardio / Fat Loss" | "Flexibility" | "General Health";
  preferredEquipment: string[];
  streakDays: number;
  lastWorkoutDate?: string;
  totalWorkouts: number;
  totalMinutes: number;
  totalCaloriesBurned: number;
  // Optional body metrics. Undefined until the user fills them in on a
  // fresh install — never pre-populated with sample numbers.
  heightCm?: number;
  weightKg?: number;
  age?: number;
  gender?: "male" | "other";
  // Which model demonstrates the (small, growing) set of real-photo
  // exercise demos — purely a display preference for the Academy /
  // in-workout demo cards, never used for anything else.
  race?: "black" | "white";
  activityLevel?: "sedentary" | "light" | "moderate" | "active" | "athlete";
}

export interface ProgressSet {
  reps: number;
  weight: number; // in lbs or kgs
}

export interface ProgressExercise {
  exerciseName: string;
  sets: ProgressSet[];
}

export interface ProgressLog {
  id: string;
  date: string; // "YYYY-MM-DD"
  workoutTitle: string;
  exercises: ProgressExercise[];
  feeling: "Energetic" | "Tired" | "Satisfied" | "Sore" | "Exhausted";
  notes?: string;
}

export interface WaterEntry {
  date: string; // "YYYY-MM-DD"
  glasses: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
}

export interface ProgramDay {
  day: number;
  title: string;
  focus: string;
  isRestDay?: boolean;
  curatedIndex?: number; // which CURATED_WORKOUTS entry this day launches
}

export interface ProgramWeek {
  week: number;
  theme: string;
  days: ProgramDay[];
}

export interface ProgramPlan {
  id: string;
  title: string;
  tagline: string;
  weeks: ProgramWeek[];
  level: "Beginner" | "Intermediate" | "Advanced";
  goal: string;
}
