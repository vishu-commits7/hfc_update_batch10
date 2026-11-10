import { CLIPS } from "./exerciseClips";

/**
 * Training programs: 4-8 week plans.
 *
 * DATA FORMAT
 *   Program -> weeks[] -> sessions[] -> exercises[]
 *   - An exercise is only an id from the exercise list (src/data/exerciseClips.ts), so a program can
 *     never point at a movement the app does not have. `npm run programs:check` enforces that.
 *   - Reps and seconds are exclusive: reps for counted moves (per side where the cue says so), seconds for holds.
 *   - Session minutes are worked out from the sets, reps, holds and rests, never typed in by hand.
 *   - `status` is "draft" until a trainer has reviewed the program; the app shows a draft label.
 *   - Adding a program also needs a line in functions/src/programs.ts (same id, same sessions per week),
 *     because the server owns progress. The check script compares the two.
 */
export type ProgramGoal = "fat-loss" | "muscle" | "mobility" | "beginner" | "no-equipment";
export const GOAL_LABEL: Record<ProgramGoal, string> = {
  "fat-loss": "Fat loss",
  muscle: "Muscle",
  mobility: "Mobility",
  beginner: "Beginner",
  "no-equipment": "No equipment",
};
export const GOAL_ORDER: ProgramGoal[] = ["fat-loss", "muscle", "mobility", "beginner", "no-equipment"];

export interface ProgramExercise {
  id: string;
  sets: number;
  reps?: number;
  seconds?: number;
  rest: number;
}
export interface ProgramSession {
  title: string;
  focus: string;
  exercises: ProgramExercise[];
}
export interface ProgramWeek {
  title: string;
  note: string;
  sessions: ProgramSession[];
}
export interface Program {
  id: string;
  title: string;
  tagline: string;
  goals: ProgramGoal[];
  level: "Beginner" | "Beginner to Intermediate" | "Intermediate" | "Advanced";
  equipmentNote: string;
  weeks: ProgramWeek[];
  status: "draft" | "reviewed";
  reviewedBy?: string;
  reviewNote: string;
}

/** Short coaching cue and muscle label for every exercise a program uses. */
export const EX_INFO: Record<string, { muscle: string; cue: string }> = {
  "arm-circles": { muscle: "Shoulders", cue: "Small circles, then bigger. Keep your neck relaxed." },
  "cat-cow": { muscle: "Spine and core", cue: "Move with your breath: round your back, then lift your chest." },
  squats: { muscle: "Quads and glutes", cue: "Sit your hips back, keep your chest up and knees over your toes." },
  incline: { muscle: "Chest and triceps", cue: "Hands on a sturdy table or sofa edge, body in one straight line." },
  bridges: { muscle: "Glutes and hamstrings", cue: "Press through your heels and squeeze at the top for one second." },
  plank: { muscle: "Core", cue: "Straight line from head to heels. Keep breathing." },
  "childs-pose": { muscle: "Back and hips", cue: "Sit back toward your heels and let your shoulders drop." },
  "bird-dog": { muscle: "Core and back", cue: "Reach the opposite arm and leg. Keep your hips level. Reps are per side." },
  superman: { muscle: "Lower back and glutes", cue: "Lift your chest and legs a little, hold, then lower slowly." },
  crunches: { muscle: "Abs", cue: "Lift your shoulder blades off the floor. Do not pull on your neck." },
  "world-greatest-stretch": { muscle: "Hips and spine", cue: "Lunge, rotate and reach. Move slowly and do both sides." },
  "seated-fold": { muscle: "Hamstrings", cue: "Reach forward with a long spine and stop at a gentle stretch." },
  lunges: { muscle: "Quads and glutes", cue: "Step back and lower with control. Reps are per leg." },
  calf: { muscle: "Calves", cue: "Rise onto the balls of your feet, pause, then lower slowly." },
  "spinal-twist": { muscle: "Spine and hips", cue: "Drop both knees to one side with your shoulders flat. Do both sides." },
  jacks: { muscle: "Full body", cue: "Land softly. Step side to side instead if jumping bothers your knees." },
  "wall-sit": { muscle: "Quads", cue: "Back flat on the wall, knees at a right angle." },
  "side-plank": { muscle: "Obliques", cue: "Stack your feet and lift your hips. Do both sides." },
  pushups: { muscle: "Chest and triceps", cue: "Straight line from head to heels. Lower with control." },
  mountain: { muscle: "Core and cardio", cue: "Drive your knees toward your chest at a steady pace." },
  "high-knees": { muscle: "Cardio", cue: "Lift your knees to hip height and stay light on your feet." },
  "skater-hop": { muscle: "Glutes and legs", cue: "Hop side to side and land softly on one leg." },
  burpees: { muscle: "Full body", cue: "Low-impact version: step back and step in, no jump." },
  "jump-squat": { muscle: "Legs and power", cue: "Land softly with bent knees. Do normal squats if your knees hurt." },
  bicycle: { muscle: "Abs", cue: "Slow, controlled twists. Keep your shoulders off the floor." },
  legraises: { muscle: "Lower abs", cue: "Press your lower back down and lower your legs slowly." },
  "russian-twist": { muscle: "Obliques", cue: "Lean back a little and turn from your ribs." },
  "shoulder-taps": { muscle: "Core and shoulders", cue: "Keep your hips still while you tap each shoulder." },
  "standing-knee-raises": { muscle: "Hips and core", cue: "Lift each knee toward your chest and stand tall." },
  "hamstring-stretch-left": { muscle: "Left hamstring", cue: "Keep your back straight and ease into the stretch." },
  "hamstring-stretch-right": { muscle: "Right hamstring", cue: "Keep your back straight and ease into the stretch." },
  "cobra-stretch": { muscle: "Abs and spine", cue: "Press up gently with your hips down. Stop if your back pinches." },
  "sumo-squat": { muscle: "Inner thighs and glutes", cue: "Wide stance, toes out, sit straight down." },
  "donkey-kick": { muscle: "Glutes", cue: "Keep your back flat, kick up and squeeze. Reps are per leg." },
};

/** ex("squats", 3, "10", 40) = 3 sets of 10 reps with 40 s rest; ex("plank", 3, "30s", 30) = 3 holds of 30 s. */
const ex = (id: string, sets: number, amount: string, rest = 30): ProgramExercise =>
  amount.endsWith("s")
    ? { id, sets, seconds: parseInt(amount, 10), rest }
    : { id, sets, reps: parseInt(amount, 10), rest };
const S = (title: string, focus: string, exercises: ProgramExercise[]): ProgramSession => ({ title, focus, exercises });

const DRAFT_NOTE =
  "Draft written without a trainer. A qualified trainer should review the exercise choice, volume and progression before this program is marked reviewed.";

/* ------------------------------------------------------------------ */
/* 1. Beginner Foundations: 4 weeks, 3 sessions a week                  */
/* ------------------------------------------------------------------ */
const FULL_A = "Full body A";
const CORE_M = "Core and mobility";
const FULL_B = "Full body B";

const BEGINNER: Program = {
  id: "beginner-foundations",
  title: "Beginner Foundations",
  tagline: "Learn the basic moves and build a habit. 3 short sessions a week.",
  goals: ["beginner", "no-equipment"],
  level: "Beginner",
  equipmentNote: "No equipment. A sturdy table or sofa edge for incline push-ups.",
  status: "draft",
  reviewNote: DRAFT_NOTE,
  weeks: [
    {
      title: "Learn the moves",
      note: "Go slowly and stop any move that hurts. Rest a day between sessions if you can.",
      sessions: [
        S(FULL_A, "Legs, chest and core", [ex("arm-circles", 1, "30s", 10), ex("squats", 2, "8", 45), ex("incline", 2, "6", 45), ex("bridges", 2, "10", 40), ex("plank", 2, "15s", 40), ex("childs-pose", 1, "30s", 0)]),
        S(CORE_M, "Core and flexibility", [ex("cat-cow", 1, "40s", 10), ex("bird-dog", 2, "6", 40), ex("superman", 2, "15s", 40), ex("crunches", 2, "8", 40), ex("world-greatest-stretch", 1, "40s", 10), ex("seated-fold", 1, "30s", 0)]),
        S(FULL_B, "Legs, chest and glutes", [ex("arm-circles", 1, "30s", 10), ex("lunges", 2, "6", 45), ex("incline", 2, "8", 45), ex("calf", 2, "12", 35), ex("bridges", 2, "12", 40), ex("spinal-twist", 1, "40s", 0)]),
      ],
    },
    {
      title: "Build the habit",
      note: "Same moves, one more set. If a set feels too hard, stop two reps early.",
      sessions: [
        S(FULL_A, "Legs, chest and core", [ex("arm-circles", 1, "30s", 10), ex("squats", 3, "8", 45), ex("incline", 3, "6", 45), ex("bridges", 3, "10", 40), ex("plank", 3, "20s", 40), ex("childs-pose", 1, "40s", 0)]),
        S(CORE_M, "Core and flexibility", [ex("cat-cow", 1, "40s", 10), ex("bird-dog", 3, "6", 40), ex("superman", 3, "20s", 40), ex("crunches", 3, "8", 40), ex("world-greatest-stretch", 1, "45s", 10), ex("seated-fold", 1, "40s", 0)]),
        S(FULL_B, "Legs, chest and glutes", [ex("arm-circles", 1, "30s", 10), ex("lunges", 3, "6", 45), ex("incline", 3, "8", 45), ex("calf", 3, "12", 35), ex("bridges", 3, "12", 40), ex("spinal-twist", 1, "45s", 0)]),
      ],
    },
    {
      title: "A little more challenge",
      note: "New moves this week: jumping jacks, wall sit and side plank. Step the jacks side to side if you prefer.",
      sessions: [
        S(FULL_A, "Legs, chest and core", [ex("arm-circles", 1, "30s", 10), ex("jacks", 1, "30s", 15), ex("squats", 3, "12", 40), ex("incline", 3, "10", 45), ex("bridges", 3, "12", 40), ex("plank", 3, "25s", 40), ex("wall-sit", 2, "20s", 40), ex("childs-pose", 1, "40s", 0)]),
        S(CORE_M, "Core and flexibility", [ex("cat-cow", 1, "40s", 10), ex("bird-dog", 3, "8", 40), ex("side-plank", 2, "15s", 40), ex("superman", 3, "20s", 40), ex("bicycle", 3, "10", 40), ex("world-greatest-stretch", 1, "45s", 10), ex("seated-fold", 1, "40s", 0)]),
        S(FULL_B, "Legs, chest and glutes", [ex("arm-circles", 1, "30s", 10), ex("lunges", 3, "8", 45), ex("incline", 3, "10", 45), ex("calf", 3, "15", 35), ex("sumo-squat", 3, "10", 40), ex("bridges", 3, "12", 40), ex("spinal-twist", 1, "45s", 0)]),
      ],
    },
    {
      title: "Show what you can do",
      note: "Your last week. Notice how much easier week 1 would feel now.",
      sessions: [
        S(FULL_A, "Legs, chest and core", [ex("arm-circles", 1, "30s", 10), ex("jacks", 1, "30s", 15), ex("squats", 3, "15", 40), ex("incline", 3, "12", 45), ex("bridges", 3, "15", 40), ex("plank", 3, "30s", 40), ex("wall-sit", 2, "30s", 40), ex("childs-pose", 1, "40s", 0)]),
        S(CORE_M, "Core and flexibility", [ex("cat-cow", 1, "40s", 10), ex("bird-dog", 3, "10", 40), ex("side-plank", 2, "20s", 40), ex("superman", 3, "25s", 40), ex("bicycle", 3, "12", 40), ex("world-greatest-stretch", 1, "45s", 10), ex("seated-fold", 1, "40s", 0)]),
        S("Final session", "Whole body", [ex("arm-circles", 1, "30s", 10), ex("squats", 3, "15", 40), ex("incline", 3, "12", 45), ex("lunges", 3, "10", 45), ex("plank", 3, "30s", 40), ex("mountain", 2, "20s", 40), ex("cobra-stretch", 1, "40s", 10), ex("childs-pose", 1, "40s", 0)]),
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 2. Fat Loss, No Equipment: 6 weeks, 4 sessions a week                */
/* ------------------------------------------------------------------ */
const LOWER = "Lower body and cardio";
const UPPER = "Upper body and core";
const CARDIO = "Cardio circuit";
const FULLM = "Full body and mobility";
const HS_L = "hamstring-stretch-left";
const HS_R = "hamstring-stretch-right";

const FATLOSS: Program = {
  id: "fat-loss-no-equipment",
  title: "Fat Loss: No Equipment",
  tagline: "Cardio, legs and core at home. 4 sessions a week for 6 weeks.",
  goals: ["fat-loss", "no-equipment"],
  level: "Beginner to Intermediate",
  equipmentNote: "No equipment. A sturdy table or sofa edge for incline push-ups.",
  status: "draft",
  reviewNote: DRAFT_NOTE,
  weeks: [
    {
      title: "Get moving",
      note: "Low impact only this week. Keep a pace where you can still talk.",
      sessions: [
        S(LOWER, "Legs and light cardio", [ex("arm-circles", 1, "30s", 10), ex("squats", 3, "10", 40), ex("lunges", 3, "8", 40), ex("bridges", 3, "12", 40), ex("standing-knee-raises", 3, "30s", 30), ex("calf", 3, "15", 30), ex(HS_L, 1, "30s", 0), ex(HS_R, 1, "30s", 0)]),
        S(UPPER, "Chest, shoulders and core", [ex("arm-circles", 1, "30s", 10), ex("incline", 3, "8", 45), ex("shoulder-taps", 3, "20s", 40), ex("plank", 3, "20s", 40), ex("crunches", 3, "10", 35), ex("superman", 3, "20s", 35), ex("childs-pose", 1, "30s", 0)]),
        S(CARDIO, "Heart rate", [ex("jacks", 3, "30s", 30), ex("standing-knee-raises", 3, "30s", 30), ex("mountain", 3, "20s", 40), ex("bicycle", 3, "12", 30), ex("cobra-stretch", 1, "30s", 10), ex("seated-fold", 1, "30s", 0)]),
        S(FULLM, "Whole body and stretching", [ex("cat-cow", 1, "40s", 10), ex("squats", 3, "10", 40), ex("incline", 3, "8", 45), ex("bridges", 3, "12", 40), ex("bird-dog", 3, "8", 35), ex("world-greatest-stretch", 1, "45s", 10), ex("spinal-twist", 1, "45s", 0)]),
      ],
    },
    {
      title: "Add volume",
      note: "A few more reps and longer rounds. Rest as long as you need between sets.",
      sessions: [
        S(LOWER, "Legs and light cardio", [ex("arm-circles", 1, "30s", 10), ex("squats", 3, "12", 40), ex("lunges", 3, "10", 40), ex("bridges", 3, "15", 40), ex("standing-knee-raises", 3, "40s", 30), ex("calf", 3, "18", 30), ex(HS_L, 1, "35s", 0), ex(HS_R, 1, "35s", 0)]),
        S(UPPER, "Chest, shoulders and core", [ex("arm-circles", 1, "30s", 10), ex("incline", 3, "10", 45), ex("shoulder-taps", 3, "25s", 40), ex("plank", 3, "25s", 40), ex("crunches", 3, "12", 35), ex("superman", 3, "25s", 35), ex("childs-pose", 1, "30s", 0)]),
        S(CARDIO, "Heart rate", [ex("jacks", 3, "40s", 30), ex("standing-knee-raises", 3, "40s", 30), ex("mountain", 3, "25s", 35), ex("bicycle", 3, "14", 30), ex("cobra-stretch", 1, "30s", 10), ex("seated-fold", 1, "35s", 0)]),
        S(FULLM, "Whole body and stretching", [ex("cat-cow", 1, "40s", 10), ex("squats", 3, "12", 40), ex("incline", 3, "10", 45), ex("bridges", 3, "15", 40), ex("bird-dog", 3, "10", 35), ex("world-greatest-stretch", 1, "45s", 10), ex("spinal-twist", 1, "45s", 0)]),
      ],
    },
    {
      title: "Raise the pace",
      note: "New this week: high knees, skater hops, push-ups and low-impact burpees. Keep each rep clean.",
      sessions: [
        S(LOWER, "Legs and cardio", [ex("arm-circles", 1, "30s", 10), ex("squats", 4, "12", 35), ex("lunges", 3, "10", 40), ex("sumo-squat", 3, "12", 40), ex("bridges", 3, "15", 40), ex("high-knees", 3, "30s", 30), ex("calf", 3, "20", 30), ex(HS_L, 1, "35s", 0), ex(HS_R, 1, "35s", 0)]),
        S(UPPER, "Chest, shoulders and core", [ex("arm-circles", 1, "30s", 10), ex("incline", 3, "12", 40), ex("pushups", 2, "5", 60), ex("shoulder-taps", 3, "30s", 40), ex("plank", 3, "30s", 35), ex("bicycle", 3, "14", 35), ex("superman", 3, "30s", 35), ex("childs-pose", 1, "30s", 0)]),
        S(CARDIO, "Heart rate", [ex("jacks", 4, "40s", 25), ex("high-knees", 3, "30s", 30), ex("mountain", 3, "30s", 30), ex("skater-hop", 3, "20s", 35), ex("burpees", 2, "5", 50), ex("cobra-stretch", 1, "30s", 10), ex("seated-fold", 1, "35s", 0)]),
        S(FULLM, "Whole body and stretching", [ex("cat-cow", 1, "40s", 10), ex("squats", 3, "15", 40), ex("lunges", 3, "10", 40), ex("incline", 3, "12", 40), ex("bridges", 3, "15", 40), ex("bird-dog", 3, "10", 35), ex("world-greatest-stretch", 1, "45s", 10), ex("spinal-twist", 1, "45s", 0)]),
      ],
    },
    {
      title: "Intervals",
      note: "First jumping moves: jump squats. Swap in normal squats whenever your knees or joints complain.",
      sessions: [
        S(LOWER, "Legs and power", [ex("arm-circles", 1, "30s", 10), ex("squats", 4, "15", 35), ex("lunges", 4, "10", 35), ex("jump-squat", 2, "8", 50), ex("sumo-squat", 3, "15", 40), ex("bridges", 3, "18", 40), ex("calf", 3, "20", 30), ex(HS_L, 1, "35s", 0), ex(HS_R, 1, "35s", 0)]),
        S(UPPER, "Chest, shoulders and core", [ex("arm-circles", 1, "30s", 10), ex("pushups", 3, "8", 50), ex("shoulder-taps", 3, "30s", 40), ex("plank", 3, "35s", 35), ex("russian-twist", 3, "14", 35), ex("legraises", 3, "8", 40), ex("superman", 3, "30s", 35), ex("childs-pose", 1, "30s", 0)]),
        S(CARDIO, "Heart rate", [ex("high-knees", 4, "30s", 25), ex("jacks", 4, "40s", 25), ex("mountain", 4, "30s", 25), ex("skater-hop", 3, "30s", 30), ex("burpees", 3, "6", 45), ex("cobra-stretch", 1, "30s", 10), ex("seated-fold", 1, "35s", 0)]),
        S(FULLM, "Whole body and stretching", [ex("cat-cow", 1, "40s", 10), ex("squats", 3, "15", 40), ex("pushups", 3, "6", 50), ex("bridges", 3, "18", 40), ex("side-plank", 2, "20s", 40), ex("bird-dog", 3, "12", 35), ex("world-greatest-stretch", 1, "45s", 10), ex("spinal-twist", 1, "45s", 0)]),
      ],
    },
    {
      title: "Push",
      note: "The hardest block. If you are very tired, finish the session with fewer sets rather than skipping it.",
      sessions: [
        S(LOWER, "Legs and power", [ex("arm-circles", 1, "30s", 10), ex("jump-squat", 3, "10", 45), ex("lunges", 4, "12", 35), ex("squats", 4, "18", 30), ex("donkey-kick", 3, "12", 35), ex("wall-sit", 3, "30s", 40), ex("calf", 3, "25", 30), ex(HS_L, 1, "40s", 0), ex(HS_R, 1, "40s", 0)]),
        S(UPPER, "Chest, shoulders and core", [ex("arm-circles", 1, "30s", 10), ex("pushups", 4, "8", 45), ex("shoulder-taps", 3, "40s", 35), ex("plank", 3, "40s", 30), ex("russian-twist", 3, "16", 35), ex("legraises", 3, "10", 40), ex("superman", 3, "35s", 35), ex("childs-pose", 1, "30s", 0)]),
        S(CARDIO, "Heart rate", [ex("burpees", 3, "8", 40), ex("high-knees", 4, "40s", 20), ex("mountain", 4, "40s", 25), ex("skater-hop", 4, "30s", 25), ex("jacks", 3, "45s", 20), ex("cobra-stretch", 1, "30s", 10), ex("seated-fold", 1, "35s", 0)]),
        S(FULLM, "Whole body and stretching", [ex("cat-cow", 1, "40s", 10), ex("squats", 3, "18", 40), ex("pushups", 3, "8", 50), ex("bridges", 3, "20", 40), ex("side-plank", 3, "25s", 40), ex("bird-dog", 3, "12", 35), ex("world-greatest-stretch", 1, "45s", 10), ex("spinal-twist", 1, "45s", 0)]),
      ],
    },
    {
      title: "Peak week",
      note: "Your best week. Finish strong, then take two easy days before you pick your next program.",
      sessions: [
        S(LOWER, "Legs and power", [ex("arm-circles", 1, "30s", 10), ex("jump-squat", 3, "12", 45), ex("lunges", 4, "12", 35), ex("squats", 4, "20", 30), ex("sumo-squat", 3, "15", 35), ex("wall-sit", 3, "40s", 40), ex("calf", 3, "25", 30), ex(HS_L, 1, "40s", 0), ex(HS_R, 1, "40s", 0)]),
        S(UPPER, "Chest, shoulders and core", [ex("arm-circles", 1, "30s", 10), ex("pushups", 4, "10", 45), ex("shoulder-taps", 3, "40s", 35), ex("plank", 3, "45s", 30), ex("bicycle", 3, "20", 35), ex("legraises", 3, "12", 40), ex("superman", 3, "40s", 35), ex("childs-pose", 1, "30s", 0)]),
        S(CARDIO, "Heart rate", [ex("burpees", 4, "8", 35), ex("high-knees", 4, "40s", 20), ex("mountain", 4, "40s", 25), ex("skater-hop", 4, "30s", 25), ex("jacks", 4, "45s", 20), ex("cobra-stretch", 1, "30s", 10), ex("seated-fold", 1, "35s", 0)]),
        S(FULLM, "Whole body and stretching", [ex("cat-cow", 1, "40s", 10), ex("squats", 3, "20", 40), ex("pushups", 3, "10", 50), ex("bridges", 3, "20", 40), ex("side-plank", 3, "30s", 40), ex("bird-dog", 3, "12", 35), ex("world-greatest-stretch", 1, "45s", 10), ex("spinal-twist", 1, "45s", 0), ex("childs-pose", 1, "40s", 0)]),
      ],
    },
  ],
};

export const PROGRAMS: Program[] = [BEGINNER, FATLOSS];

export const programById = (id: string | null | undefined): Program | null => PROGRAMS.find(p => p.id === id) ?? null;
export const sessionsPerWeek = (p: Program): number[] => p.weeks.map(w => w.sessions.length);
export const totalSessions = (p: Program): number => p.weeks.reduce((n, w) => n + w.sessions.length, 0);

/** Where session number `n` (0-based, counted across the whole program) sits: week, session in week, and the session itself. */
export function locateSession(p: Program, n: number): { week: number; index: number; session: ProgramSession } | null {
  let left = n;
  for (let w = 0; w < p.weeks.length; w++) {
    const list = p.weeks[w].sessions;
    if (left < list.length) return { week: w, index: left, session: list[left] };
    left -= list.length;
  }
  return null;
}

/** Minutes for one session, from its sets, reps (3 s each), holds and rests. */
export function sessionMinutes(s: ProgramSession): number {
  const sec = s.exercises.reduce((t, e) => t + e.sets * ((e.seconds ?? (e.reps ?? 0) * 3) + e.rest), 0);
  return Math.max(1, Math.ceil(sec / 60));
}

/** Exercise name shown to the user, from the shared exercise list. */
export const exerciseName = (id: string): string => CLIPS.find(c => c.id === id)?.name ?? id;
