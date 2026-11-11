import { useEffect, useState } from "react";
import type { UserProfile, WorkoutLog, Workout } from "../../types";
import { callFn } from "../../core/functions";
import { istDayKey, readCache, writeCache } from "../../core/callCache";
import { generateApexNeuralWorkout } from "../workout/proceduralWorkout";
import { AVAILABLE_EQUIPMENT } from "../../constants";
import { DEMO, demoPlan } from "../../core/demo";

export interface NextPlan {
  kind: "workout" | "rest";
  area: string | null;
  level: UserProfile["fitnessLevel"];
  minutes: number;
  progress: boolean;
  reason: string;
  readiness: { area: string; hoursSince: number | null; ready: boolean }[];
  /** Pro only: the next 3 days, assuming today's session is done. */
  upcoming?: { label: string; kind: "workout" | "rest"; area: string | null; minutes: number }[];
}

/** Server picks the next session from workout history and recovery. */
export function useNextPlan(uid: string | null | undefined, profile: Pick<UserProfile, "fitnessLevel" | "goal">, logs: WorkoutLog[], goalMin: number) {
  return DEMO ? DEMO_PLAN : useRealNextPlan(uid, profile, logs, goalMin);
}
const DEMO_PLAN = { plan: demoPlan as NextPlan | null, failed: false, locked: false, genericReason: "" };
function useRealNextPlan(uid: string | null | undefined, profile: Pick<UserProfile, "fitnessLevel" | "goal">, logs: WorkoutLog[], goalMin: number) {
  // refresh when a new workout is logged or the daily goal changes
  const key = `${logs.length}:${logs[0]?.id ?? ""}:${goalMin}:${profile.fitnessLevel}:${profile.goal}`;
  // Today's plan for exactly this history is remembered on the phone, so the Today card is ready at once and the
  // server's answer (which can take a few seconds after a quiet spell) replaces it when it arrives.
  const cacheKey = uid ? `plan:${uid}:${istDayKey()}:${key}` : null;
  type Answer = NextPlan & { locked?: boolean };
  const first = readCache<Answer>(cacheKey, 36 * 3600_000);
  const [plan, setPlan] = useState<NextPlan | null>(first && !first.locked ? first : null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(!!first?.locked);
  const [genericReason, setGenericReason] = useState(first?.locked ? first.reason || "" : "");
  useEffect(() => {
    if (!uid) { setPlan(null); return; }
    let alive = true;
    setFailed(false);
    const had = readCache<Answer>(cacheKey, 36 * 3600_000);
    if (had) { if (had.locked) { setLocked(true); setGenericReason(had.reason || ""); setPlan(null); } else { setLocked(false); setPlan(had); } }
    const seed = logs.slice(0, 20).map(l => ({ at: new Date(l.completedAt).getTime(), area: l.targetArea || "Full Body", minutes: l.durationMinutes, feeling: l.feeling }));
    callFn<NextPlan & { locked?: boolean }>("planNext", { goalMin, level: profile.fitnessLevel, goal: profile.goal, seed })
      .then(p => { writeCache(cacheKey, p); if (!alive) return; if (p.locked) { setLocked(true); setGenericReason(p.reason || ""); setPlan(null); } else { setLocked(false); setPlan(p); } })
      .catch(() => { if (alive && !had) setFailed(true); }); // with a remembered plan on screen, a failed refresh is silent
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key]);
  return { plan, failed, locked, genericReason };
}

/**
 * A gentle ~5 minute full-body session for someone coming back after a break: three simple moves, two easy rounds.
 * Built on the device; nothing is recorded until the user finishes it like any other workout.
 */
export function buildEasyWorkout(profile: Pick<UserProfile, "goal">): Workout {
  const g = generateApexNeuralWorkout({ fitnessLevel: "Beginner", goal: profile.goal, duration: 3, targetArea: "Full Body", equipment: ["Bodyweight"] });
  return {
    id: `easy-${Date.now()}`,
    workoutTitle: "Easy 5-minute restart",
    workoutDescription: "Three simple moves, two gentle rounds. Go at your own pace.",
    totalDurationMinutes: 5,
    targetArea: "Full Body",
    equipmentNeeded: ["Bodyweight"],
    exercises: g.exercises.map(e => ({ ...e, sets: 2 })),
    coachingTips: ["Easy pace. Breathe steadily.", "Stop whenever you need to."],
    isAiGenerated: false,
    createdAt: new Date().toISOString(),
  };
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
    wrap: true,
    createdAt: new Date().toISOString(),
  };
}
