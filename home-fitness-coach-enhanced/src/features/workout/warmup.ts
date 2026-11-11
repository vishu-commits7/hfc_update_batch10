import type { Exercise, Workout } from "../../types";

/**
 * A short warm-up (3 moves) before and cool-down (3 stretches) after a generated workout.
 * Added by the workout screen at start time, so saved workouts stay as they were generated.
 * Only workouts flagged `wrap` get them: AI-generated and plan-built sessions. The 2-minute
 * starter, the easy restart, programs and hand-built workouts do not set the flag.
 */
const KEY = "ap_warmup_off";

export const readWrapOn = (): boolean => { try { return localStorage.getItem(KEY) !== "1"; } catch { return true; } };
export const writeWrapOn = (on: boolean) => { try { localStorage.setItem(KEY, on ? "0" : "1"); } catch { /* ignore */ } };

const move = (name: string, description: string, targetMuscle: string, phase: "warmup" | "cooldown", seconds = 30): Exercise => ({
  name, description, targetMuscle, durationSeconds: seconds, reps: 0, sets: 1, restSeconds: 10, phase,
});

export const WARMUP: Exercise[] = [
  move("Arm Circles", "Stand tall and make slow circles with straight arms, small then bigger. Loosen the shoulders.", "Shoulders", "warmup"),
  move("Standing Knee Raises", "Lift one knee at a time to hip height at an easy pace. Stand tall and swing the arms.", "Hips and Legs", "warmup"),
  move("Cat-Cow Stretch", "On hands and knees, round your back up, then drop it and lift your chest. Move with your breath.", "Spine and Core", "warmup"),
];

export const COOLDOWN: Exercise[] = [
  move("Standing Chest & Shoulder Stretch", "Clasp your hands behind you, straighten the arms and lift gently. Breathe slowly.", "Chest and Shoulders", "cooldown"),
  move("Standing Forward Fold", "Hinge at the hips and let your head and arms hang. Bend the knees if the backs of your legs pull.", "Hamstrings and Back", "cooldown"),
  move("Child's Pose", "Sit back on your heels, reach your arms forward and rest your forehead down. Breathe deep.", "Back and Hips", "cooldown"),
];

/** Returns the workout with the warm-up first and the cool-down last. */
export function withWarmupCooldown(w: Workout): Workout {
  if (!w.wrap || w.exercises.some(e => e.phase)) return w;
  return {
    ...w,
    exercises: [...WARMUP.map(e => ({ ...e })), ...w.exercises, ...COOLDOWN.map(e => ({ ...e }))],
    totalDurationMinutes: w.totalDurationMinutes + 3,
  };
}
