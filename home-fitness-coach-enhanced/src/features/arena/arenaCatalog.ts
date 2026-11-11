/** Rep-countable bodyweight exercises for Arena, grouped by body part. */
export interface ArenaExercise { id: string; name: string; defaultReps: number }
export interface BodyPart { id: string; name: string; emoji: string; exercises: ArenaExercise[] }

export const BODY_PARTS: BodyPart[] = [
  { id: "chest", name: "Chest", emoji: "💪", exercises: [
    { id: "pushups", name: "Classic Push-ups", defaultReps: 20 },
    { id: "wide-pushups", name: "Wide Push-ups", defaultReps: 15 },
    { id: "incline-pushups", name: "Incline Push-ups", defaultReps: 20 },
    { id: "decline-pushups", name: "Decline Push-ups", defaultReps: 12 },
    { id: "diamond", name: "Diamond Push-ups", defaultReps: 12 },
  ] },
  { id: "back", name: "Back", emoji: "🔙", exercises: [
    { id: "superman", name: "Superman Raises", defaultReps: 20 },
    { id: "reverse-snow", name: "Reverse Snow Angels", defaultReps: 15 },
    { id: "prone-y", name: "Prone Y Raises", defaultReps: 15 },
    { id: "good-morning", name: "Good Mornings", defaultReps: 20 },
  ] },
  { id: "shoulders", name: "Shoulders", emoji: "🏋️", exercises: [
    { id: "pike", name: "Pike Push-ups", defaultReps: 12 },
    { id: "plank-tap", name: "Plank Shoulder Taps", defaultReps: 30 },
    { id: "arm-circles", name: "Arm Circles", defaultReps: 40 },
  ] },
  { id: "arms", name: "Arms", emoji: "🦾", exercises: [
    { id: "tri-dips", name: "Chair Tricep Dips", defaultReps: 15 },
    { id: "close-pushups", name: "Close-grip Push-ups", defaultReps: 12 },
    { id: "plank-updown", name: "Plank Up-downs", defaultReps: 16 },
  ] },
  { id: "core", name: "Core", emoji: "🔥", exercises: [
    { id: "situps", name: "Sit-ups", defaultReps: 25 },
    { id: "crunches", name: "Crunches", defaultReps: 30 },
    { id: "climbers", name: "Mountain Climbers", defaultReps: 40 },
    { id: "leg-raises", name: "Leg Raises", defaultReps: 15 },
    { id: "bicycle", name: "Bicycle Crunches", defaultReps: 30 },
    { id: "russian", name: "Russian Twists", defaultReps: 30 },
  ] },
  { id: "legs", name: "Legs", emoji: "🦵", exercises: [
    { id: "squats", name: "Bodyweight Squats", defaultReps: 30 },
    { id: "jumpsquats", name: "Jump Squats", defaultReps: 20 },
    { id: "lunges", name: "Alternating Lunges", defaultReps: 24 },
    { id: "split-squat", name: "Split Squats", defaultReps: 16 },
    { id: "wall-sit-calf", name: "Calf Raises", defaultReps: 40 },
    { id: "glute-bridge", name: "Glute Bridges", defaultReps: 25 },
  ] },
  { id: "full", name: "Full Body", emoji: "⚡", exercises: [
    { id: "burpees", name: "Burpees", defaultReps: 12 },
    { id: "jacks", name: "Jumping Jacks", defaultReps: 40 },
    { id: "high-knees", name: "High Knees", defaultReps: 40 },
    { id: "squat-thrust", name: "Squat Thrusts", defaultReps: 15 },
  ] },
];

export const ALL_EXERCISES: ArenaExercise[] = BODY_PARTS.flatMap(b => b.exercises);
const byId = new Map(ALL_EXERCISES.map(e => [e.id, e]));
export const exerciseById = (id: string) => byId.get(id);

/** What people pick most; shown first. */
export const POPULAR_IDS = ["pushups", "diamond", "squats", "burpees", "situps", "climbers", "jumpsquats", "lunges"];
export const POPULAR: ArenaExercise[] = POPULAR_IDS.map(i => byId.get(i)!).filter(Boolean);

export interface PlanItem { id: string; name: string; reps: number }
