import { useEffect, useState } from "react";
import type { UserProfile, WorkoutLog, Workout } from "../types";
import { callFn } from "./functions";
import { generateApexNeuralWorkout } from "./proceduralWorkout";
import { AVAILABLE_EQUIPMENT } from "../constants";

export interface NextPlan {
  kind: "workout" | "rest";
  area: string | null;
  level: UserProfile["fitnessLevel"];
  minutes: number;
  progress: boolean;
  reason: string;
  readiness: { area: string; hoursSince: number | null; ready: boolean }[];
}

/** Server picks the next session from workout history and recovery. */
export function useNextPlan(uid: string | null | undefined, profile: Pick<UserProfile, "fitnessLevel" | "goal">, logs: WorkoutLog[], goalMin: number) {
  const [plan, setPlan] = useState<NextPlan | null>(null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  // refresh when a new workout is logged or the daily goal changes
  const key = `${logs.length}:${logs[0]?.id ?? ""}:${goalMin}:${profile.fitnessLevel}:${profile.goal}`;
  useEffect(() => {
    if (!uid) { setPlan(null); return; }
    let alive = true;
    setFailed(false);
    const seed = logs.slice(0, 20).map(l => ({ at: new Date(l.completedAt).getTime(), area: l.targetArea || "Full Body", minutes: l.durationMinutes, feeling: l.feeling }));
    callFn<NextPlan & { locked?: boolean }>("planNext", { goalMin, level: profile.fitnessLevel, goal: profile.goal, seed })
      .then(p => { if (!alive) return; if (p.locked) { setLocked(true); setPlan(null); } else { setLocked(false); setPlan(p); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key]);
  return { plan, failed, locked };
}

/** Turns the recommendation into a ready-to-run workout using the on-device generator. */
export function buildWorkoutFromPlan(p: NextPlan, profile: Pick<UserProfile, "goal" | "preferredEquipment">): Workout {
  const names = (profile.preferredEquipment?.length ? profile.preferredEquipment : ["bodyweight"])
    .map(id => AVAILABLE_EQUIPMENT.find(e => e.id === id)?.name || id);
  const area = p.area || "Full Body";
  const g = generateApexNeuralWorkout({ fitnessLevel: p.level, goal: profile.goal, duration: p.minutes, targetArea: area, equipment: names });
  return {
    id: `plan-${Date.now()}`,
    workoutTitle: g.workoutTitle || `${area} session`,
    workoutDescription: g.workoutDescription || p.reason,
    totalDurationMinutes: g.totalDurationMinutes || p.minutes,
    targetArea: g.targetArea || area,
    equipmentNeeded: g.equipmentNeeded || names,
    exercises: g.exercises,
    coachingTips: g.coachingTips || [],
    isAiGenerated: false,
    createdAt: new Date().toISOString(),
  };
}
