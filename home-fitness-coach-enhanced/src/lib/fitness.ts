/**
 * Shared fitness calculation helpers.
 *
 * Previously two different calorie formulas were duplicated inline in
 * ActiveWorkout.tsx (one for the live "quick stats" preview, a slightly
 * different one for the value actually saved to the log) which meant the
 * number a user saw before saving didn't match what got recorded. Centralizing
 * the formula here keeps every screen in sync.
 */

/** Rough calories-per-minute burn rate by workout focus area. */
const CALORIES_PER_MINUTE: Record<string, number> = {
  "Cardio Blitz": 9.5,
  "Lower Body": 8,
  "Full Body": 7.5,
  "Upper Body": 6.5,
  "Core / Abs": 6,
};

const DEFAULT_CALORIES_PER_MINUTE = 7.2;

export function estimateCaloriesBurned(durationMinutes: number, targetArea: string): number {
  const rate = CALORIES_PER_MINUTE[targetArea] ?? DEFAULT_CALORIES_PER_MINUTE;
  return Math.max(1, Math.round(durationMinutes * rate));
}
