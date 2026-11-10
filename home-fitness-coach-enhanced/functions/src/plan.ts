/** Adaptive plans: the server looks at recent workouts and recovery and recommends the next session. */
import "./init";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { isPro } from "./billing";

const db = getFirestore();
const AREAS = ["Upper Body", "Lower Body", "Core / Abs", "Cardio Blitz"] as const;
type Area = (typeof AREAS)[number];
const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const HOUR = 3_600_000;

interface LogRow { at: number; area: string; minutes: number; feeling: string }

/** Hours of rest an area wants after a session, based on how the last one felt. */
function restNeeded(feeling: string) {
  return feeling === "Exhausted" ? 72 : feeling === "Sore" ? 60 : feeling === "Tired" ? 44 : 36;
}

function areaState(logs: LogRow[], now: number) {
  return AREAS.map(a => {
    // a full-body session loads every strength area but not cardio
    const hit = logs.find(l => l.area === a || (l.area === "Full Body" && a !== "Cardio Blitz"));
    const hours = hit ? (now - hit.at) / HOUR : Infinity;
    const need = hit ? restNeeded(hit.feeling) * (hit.area === "Full Body" ? 0.8 : 1) : 0;
    return { area: a as Area, hours, ready: hours >= need, need };
  });
}

const GENERIC_REASON = "Mix up muscle groups and rest a day or two after hard sessions.";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** How each area reads in the one-line reason, e.g. "Upper body is rested, so push day." */
const PHRASE: Record<Area, { noun: string; day: string }> = {
  "Upper Body": { noun: "Upper body", day: "push day" },
  "Lower Body": { noun: "Legs", day: "leg day" },
  "Core / Abs": { noun: "Core", day: "core day" },
  "Cardio Blitz": { noun: "Cardio", day: "cardio day" },
};

interface Decision {
  kind: "workout" | "rest";
  area: string | null;
  level: (typeof LEVELS)[number];
  minutes: number;
  progress: boolean;
  reason: string;
  readiness: { area: string; hoursSince: number | null; ready: boolean }[];
}

/** One recommendation for the moment `now`, from the sessions in `logs` (newest first). `sim` = outlook mode: never steps the level up. */
function decide(logs: LogRow[], now: number, goal: string, levelIn: (typeof LEVELS)[number], goalMin: number, sim: boolean): Decision {
  const state = areaState(logs, now);
  const last3d = logs.filter(l => now - l.at < 3 * 24 * HOUR);
  const last14d = logs.filter(l => now - l.at < 14 * 24 * HOUR);
  const lastTwo = logs.slice(0, 2);
  const hardRecent = lastTwo.length === 2 && lastTwo.every(l => l.feeling === "Exhausted" || l.feeling === "Sore");

  // distinct calendar days trained in a row, ending today or yesterday (IST days)
  const dayOf = (t: number) => Math.floor((t + 5.5 * HOUR) / (24 * HOUR));
  const days = new Set(logs.map(l => dayOf(l.at)));
  let run = 0;
  for (let d = dayOf(now) - (days.has(dayOf(now)) ? 0 : 1); days.has(d); d--) run++;

  const readiness = state.map(s => ({ area: s.area, hoursSince: Number.isFinite(s.hours) ? Math.round(s.hours) : null, ready: s.ready }));

  // 1) rest or active recovery
  if ((last3d.length >= 3 && hardRecent) || run >= 6 || (hardRecent && now - logs[0].at < 30 * HOUR)) {
    return {
      kind: "rest", area: null, level: levelIn, minutes: 10, progress: false, readiness,
      reason: run >= 6 ? `${run} days in a row, so a rest or light stretching day.` : "Your last sessions left you sore, so a light recovery day.",
    };
  }

  // 2) pick the most rested area, nudged by the user's goal, avoiding an immediate repeat
  const bonus = (a: Area) => (goal.startsWith("Cardio") && a === "Cardio Blitz" ? 14 : goal === "Strength" && (a === "Upper Body" || a === "Lower Body") ? 8 : goal === "Flexibility" && a === "Core / Abs" ? 6 : 0);
  const lastArea = logs[0]?.area;
  const ranked = state
    .map(s => ({ ...s, score: Math.min(s.hours, 240) + bonus(s.area) - (s.area === lastArea ? 20 : 0) }))
    .sort((a, b) => b.score - a.score);
  const readyOnes = ranked.filter(s => s.ready);
  const pick = readyOnes[0] ?? ranked[0];
  const light = !readyOnes.length; // everything was trained recently

  // 3) intensity: step up after a strong fortnight, ease off after a hard patch or when everything is still recovering
  const strong = last14d.length >= 8 && logs.slice(0, 3).every(l => l.feeling === "Energetic" || l.feeling === "Satisfied");
  const levelIdx = LEVELS.indexOf(levelIn);
  const progress = !sim && strong && levelIdx < 2;
  const level = progress ? LEVELS[levelIdx + 1] : levelIn;
  let minutes = goalMin;
  if (light || hardRecent) minutes = Math.round((goalMin * 0.7) / 5) * 5;
  else if (strong) minutes = goalMin + 5;
  minutes = Math.max(10, Math.min(60, minutes));

  const ph = PHRASE[pick.area];
  const reason = logs.length === 0
    ? "A full session to start. We'll adapt as you log workouts."
    : light ? `Everything is still recovering, so a shorter ${ph.noun.toLowerCase()} session.`
    : pick.hours === Infinity ? `${ph.noun} hasn't been worked lately, so ${ph.day}.`
    : `${ph.noun} ${ph.noun === "Legs" ? "are" : "is"} rested, so ${ph.day}.`;

  return {
    kind: "workout", area: logs.length === 0 ? "Full Body" : pick.area, level, minutes, progress, readiness,
    reason: progress ? `${reason} Stepping up to ${level}.` : reason,
  };
}

export const planNext = onCall(async req => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = req.auth.uid;
  // Free users get a generic one-liner, not their own pick: the reason and the 3-day outlook are Pro.
  if (!(await isPro(uid))) return { locked: true, reason: GENERIC_REASON };
  const goalMin = Math.max(10, Math.min(60, Math.round(Number(req.data?.goalMin) || 20)));
  const levelIn = LEVELS.includes(req.data?.level) ? (req.data.level as (typeof LEVELS)[number]) : "Beginner";
  const goal = String(req.data?.goal || "General Health");

  const snap = await db.collection(`users/${uid}/workoutLog`).orderBy("at", "desc").limit(30).get();
  const logs: LogRow[] = snap.docs.map(d => {
    const x = d.data();
    return { at: Number(x.at) || 0, area: String(x.area || "Full Body"), minutes: Number(x.minutes) || 0, feeling: String(x.feeling || "Satisfied") };
  });
  // New installs / older users: borrow up to 20 sessions from the device so advice works from day one.
  // This only shapes a suggestion, nothing is paid out from it.
  if (logs.length < 3 && Array.isArray(req.data?.seed)) {
    for (const x of (req.data.seed as unknown[]).slice(0, 20)) {
      const r = x as Record<string, unknown>;
      const at = Number(r?.at);
      if (!Number.isFinite(at) || at > Date.now() || at < Date.now() - 30 * 24 * HOUR) continue;
      logs.push({ at, area: String(r.area || "Full Body").slice(0, 30), minutes: Math.max(0, Math.min(240, Number(r.minutes) || 0)), feeling: String(r.feeling || "Satisfied") });
    }
    logs.sort((a, b) => b.at - a.at);
  }
  const now = Date.now();
  const today = decide(logs, now, goal, levelIn, goalMin, false);

  // Pro outlook: the next 3 days, assuming today's session gets done and each pick is followed.
  const istDay = (t: number) => Math.floor((t + 5.5 * HOUR) / (24 * HOUR));
  const sim: LogRow[] = [...logs];
  if (logs.length && istDay(logs[0].at) === istDay(now)) { /* already trained today */ }
  else if (today.kind === "workout" && today.area) sim.unshift({ at: now, area: today.area, minutes: today.minutes, feeling: "Satisfied" });
  const upcoming: { label: string; kind: "workout" | "rest"; area: string | null; minutes: number }[] = [];
  for (let k = 1; k <= 3; k++) {
    const t = now + k * 24 * HOUR;
    const d = decide(sim, t, goal, levelIn, goalMin, true);
    const dow = new Date(t + 5.5 * HOUR).getUTCDay();
    upcoming.push({ label: k === 1 ? "Tomorrow" : DAYS[dow], kind: d.kind, area: d.area, minutes: d.minutes });
    if (d.kind === "workout" && d.area) sim.unshift({ at: t, area: d.area, minutes: d.minutes, feeling: "Satisfied" });
  }
  return { ...today, upcoming };
});
