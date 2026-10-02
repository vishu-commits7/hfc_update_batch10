import { WorkoutLog } from "../types";

/** Counts consecutive calendar days (ending today or yesterday) that have
 *  at least one logged workout — the simplest honest signal for "you've
 *  been at this every day for a while", without needing a training-load
 *  model this app doesn't have data for. */
export function getConsecutiveTrainingDays(logs: WorkoutLog[]): number {
  const dates = new Set(logs.map(l => new Date(l.completedAt).toDateString()));
  const cursor = new Date();
  if (!dates.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let count = 0;
  while (dates.has(cursor.toDateString())) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function shouldSuggestRestDay(logs: WorkoutLog[], threshold = 4): boolean {
  return getConsecutiveTrainingDays(logs) >= threshold;
}

export const RECOVERY_SUGGESTIONS: { name: string; focus: string }[] = [
  { name: "Cat-Cow Stretch", focus: "Spinal mobility" },
  { name: "World's Greatest Stretch", focus: "Hips, thoracic spine" },
  { name: "Seated Forward Fold", focus: "Hamstrings, lower back" },
  { name: "Cobra Stretch", focus: "Abdominals, spine" },
];

const DISMISS_KEY = "kinetic_rest_day_dismissed_date";

export function isRestDayDismissedToday(): boolean {
  return localStorage.getItem(DISMISS_KEY) === new Date().toDateString();
}

export function dismissRestDayForToday() {
  localStorage.setItem(DISMISS_KEY, new Date().toDateString());
}
