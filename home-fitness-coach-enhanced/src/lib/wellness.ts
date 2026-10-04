/**
 * Pure calculation helpers for the Premium Toolkit (BMI, calorie/TDEE
 * estimate, water goal). No network calls, no persisted defaults — every
 * number is derived only from what the user types in.
 */

export function calculateBMI(heightCm: number, weightKg: number): number {
  if (!heightCm || !weightKg) return 0;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi <= 0) return { label: "—", color: "slate" };
  if (bmi < 18.5) return { label: "Underweight", color: "blue" };
  if (bmi < 25) return { label: "Healthy range", color: "emerald" };
  if (bmi < 30) return { label: "Overweight", color: "amber" };
  return { label: "Obese range", color: "rose" };
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export const ACTIVITY_LABELS: { value: string; label: string; desc: string }[] = [
  { value: "sedentary", label: "Sedentary", desc: "Little to no exercise" },
  { value: "light", label: "Light", desc: "1-3 workouts / week" },
  { value: "moderate", label: "Moderate", desc: "3-5 workouts / week" },
  { value: "active", label: "Active", desc: "6-7 workouts / week" },
  { value: "athlete", label: "Athlete", desc: "Twice-daily training" },
];

/** Mifflin-St Jeor equation for estimated daily maintenance calories. */
export function calculateTDEE(params: {
  heightCm: number;
  weightKg: number;
  age: number;
  gender: "male" | "female" | "other";
  activityLevel: string;
}): number {
  const { heightCm, weightKg, age, gender, activityLevel } = params;
  if (!heightCm || !weightKg || !age) return 0;
  let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
  bmr += gender === "male" ? 5 : gender === "female" ? -161 : -78;
  const mult = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.375;
  return Math.round(bmr * mult);
}

export function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

/* ---------------------------- Unit conversion ---------------------------- */

export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inch = Math.round(totalInches - ft * 12);
  return inch === 12 ? { ft: ft + 1, inch: 0 } : { ft, inch };
}

export function ftInToCm(ft: number, inch: number): number {
  return Math.round(((ft * 12) + inch) * 2.54);
}

export function kgToLb(kg: number): number {
  return Math.round(kg * 2.20462);
}

export function lbToKg(lb: number): number {
  return Math.round((lb / 2.20462) * 10) / 10;
}

/* ---------------------------- Hydration helpers ---------------------------- */

export function getTodayWaterGlasses(): number {
  if (typeof window === "undefined") return 0;
  try {
    const saved = localStorage.getItem("kinetic_water_intake");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.date === todayKey()) return typeof parsed.glasses === "number" ? parsed.glasses : 0;
    }
  } catch {}
  return 0;
}

export function logWaterGlass(delta: number = 1): number {
  if (typeof window === "undefined") return 0;
  try {
    const current = getTodayWaterGlasses();
    const next = Math.max(0, current + delta);
    localStorage.setItem("kinetic_water_intake", JSON.stringify({ date: todayKey(), glasses: next }));
    return next;
  } catch {}
  return 0;
}
