import { resolveMotion } from "./src/anim/resolve";
import { MOTIONS } from "./src/anim/library";
import type { Motion } from "./src/anim/types";
import { samplePose, peakPose } from "./src/anim/sample";
import { solveLeg, HIP, GROUND_Y, THIGH_LEN, SHIN_LEN, REST } from "./src/anim/rig";

let fail = 0;
const bad = (m: string) => { console.log("  ✗ " + m); fail++; };

/* ---------- 1. IK keeps the foot planted ---------- */
// The rig stands at full leg extension: hip→foot is 73.82px against a
// 73.82px leg. So a *reachable* target requires either a narrower stance
// or a dropped hip — 35px half-stance at drop 0 is the singular case and
// anything wider is geometrically impossible for a straight leg. These
// targets are all reachable; the impossible ones are covered by test 1b.
console.log("IK — foot stays on the floor through a squat:");
for (const [drop, half] of [[0, 35], [10, 38], [20, 41], [27, 43], [34, 45]] as const) {
  const hip = { x: HIP.x, y: HIP.y + drop };
  const foot = { x: HIP.x - half, y: GROUND_Y };
  const s = solveLeg(hip, foot, "L");
  // Re-derive the foot from the solved angles (forward kinematics).
  const thigh = (REST.thighL + s.leg) * Math.PI / 180;
  const knee = { x: hip.x + Math.cos(thigh) * THIGH_LEN, y: hip.y + Math.sin(thigh) * THIGH_LEN };
  const shin = (REST.thighL + s.leg + s.knee) * Math.PI / 180;
  const got = { x: knee.x + Math.cos(shin) * SHIN_LEN, y: knee.y + Math.sin(shin) * SHIN_LEN };
  const err = Math.hypot(got.x - foot.x, got.y - foot.y);
  console.log(`  drop ${String(drop).padStart(2)}px half-stance ${half} → leg ${s.leg.toFixed(1).padStart(6)}° knee ${s.knee.toFixed(1).padStart(6)}°  foot err ${err.toFixed(3)}px`);
  if (err > 0.01) bad(`foot drifted ${err.toFixed(2)}px at drop=${drop}`);
  if (s.knee > 6) bad(`knee hyperextended (${s.knee.toFixed(1)}°) at drop=${drop}`);
}

/* ---------- 1b. The reach guard rescues impossible stances ---------- */
// Authoring a wide stance at zero hip drop asks for something a straight
// leg cannot do. Rather than clamp and leave a foot hanging in mid-air,
// the sampler lowers the hip until the stance is reachable — which is
// exactly what widening your stance does to your hips in real life.
// Verified end-to-end through samplePose, including the root translate.
console.log("\nReach guard — a wide stance lowers the hips instead of floating the feet:");
for (const half of [38, 44, 50]) {
  const probe: Motion = {
    id: "probe", label: "probe", pattern: "squat", tempo: 2, grounded: true,
    keys: [{ t: 0, pose: { hipDrop: 0, stance: half } }],
  };
  const p = samplePose(probe, 0);
  // FK from the figure's local hip, then apply the root translate the
  // renderer will apply. The foot must land on the floor.
  const thigh = (REST.thighL + p.legL) * Math.PI / 180;
  const knee = { x: HIP.x + Math.cos(thigh) * THIGH_LEN, y: HIP.y + Math.sin(thigh) * THIGH_LEN };
  const shin = (REST.thighL + p.legL + p.kneeL) * Math.PI / 180;
  const footY = knee.y + Math.sin(shin) * SHIN_LEN + p.y;
  const footX = knee.x + Math.cos(shin) * SHIN_LEN + p.x;
  console.log(`  half-stance ${half} → hips sank ${p.y.toFixed(1)}px · foot (${footX.toFixed(1)}, ${footY.toFixed(1)})`);
  if (Math.abs(footY - GROUND_Y) > 0.05) bad(`foot left the floor by ${(footY - GROUND_Y).toFixed(2)}px at half-stance ${half}`);
  if (Math.abs(footX - (HIP.x - half)) > 0.05) bad(`foot slid ${(footX - (HIP.x - half)).toFixed(2)}px at half-stance ${half}`);
}

/* ---------- 2. Jumping jacks now go the right way ---------- */
console.log("\nJumping jack — direction check (the old rig had this inverted):");
const jack = MOTIONS.find(m => m.id === "jumping-jack")!;
const closed = samplePose(jack, 0);
const open = samplePose(jack, 0.46);
const handY = (armDelta: number) => { // absolute y of the left hand
  const a = (REST.upperArmL + armDelta) * Math.PI / 180;
  return 68 + Math.sin(a) * (27.54 + 27.54);
};
console.log(`  closed: armL ${closed.armL.toFixed(0)}°  hand y ${handY(closed.armL).toFixed(0)}`);
console.log(`  open  : armL ${open.armL.toFixed(0)}°  hand y ${handY(open.armL).toFixed(0)}`);
if (!(handY(open.armL) < 68)) bad("hands do not rise above the shoulder at the open position");
if (!(handY(closed.armL) > 68)) bad("hands are not down at the closed position");

/* ---------- 3. Every motion samples cleanly across a full cycle ---------- */
console.log("\nAll motions — 60 samples each, checking for NaN and limit breaks:");
for (const mo of MOTIONS) {
  for (let i = 0; i < 60; i++) {
    const p = samplePose(mo, i / 60, i % 2);
    for (const [k, v] of Object.entries(p)) {
      // `lying` is an attitude flag, not a joint angle.
      if (typeof v !== "number") continue;
      if (!Number.isFinite(v)) { bad(`${mo.id} produced ${v} for ${k} at phase ${(i/60).toFixed(2)}`); break; }
    }
    if (p.kneeL > 6.01 || p.kneeR < -6.01) bad(`${mo.id} hyperextended a knee at phase ${(i/60).toFixed(2)}`);
  }
  // The peak frame must also be finite — it is what renders under
  // prefers-reduced-motion, so a NaN here is a blank figure, not a
  // stutter.
  const peak = peakPose(mo);
  for (const [k, v] of Object.entries(peak)) {
    if (typeof v !== "number") continue;
    if (!Number.isFinite(v)) bad(`${mo.id} peak pose produced ${v} for ${k}`);
  }
}
console.log(`  ${MOTIONS.length} motions × 60 frames = ${MOTIONS.length * 60} samples`);

/* ---------- 4. Resolver against the real catalogue ---------- */
const CATALOGUE: [string, string?][] = [
  ["Classic Push-ups"], ["Bodyweight Squats"], ["Forearm Plank"], ["Reverse Lunges"],
  ["Low-impact Burpee"], ["Glute Bridges"], ["Mountain Climbers"], ["Chair Tricep Dips"],
  ["Jumping Jacks"], ["Bicycle Crunches"], ["Wall Sit"], ["Bird Dog"], ["Calf Raises"],
  ["Dead Bug"], ["Incline Push-up"], ["Supported Step-up"], ["Sit-ups"], ["Standard Crunches"],
  ["Lying Leg Raises"], ["Russian Twists"], ["Superman Hold"], ["Side Plank"], ["Pike Push-ups"],
  ["Diamond Push-ups"], ["Shoulder Taps"], ["Dumbbell Bicep Curl"], ["Lateral Raises"],
  ["Bent-over Rows"], ["Donkey Kicks"], ["Sumo Squats"], ["Jump Squats"], ["Skater Hops"],
  ["Single-Leg Deadlift"], ["World's Greatest Stretch"], ["Cat-Cow Stretch"], ["Cobra Stretch"],
  ["Seated Forward Fold"], ["Supine Spinal Twist"], ["Child's Pose"],
  ["High Knees"], ["Plank Hold"], ["Leg Raises"], ["Donkey Kicks (Left Side)"],
  ["Incline Push-ups or Floor Push-ups"], ["Warm-up Bodyweight Squats"],
  ["Cat-Cow Dynamic Stretch"], ["Standing Quad & Glute Stretch"],
  // Names the AI might invent — these must NOT all land on "generic".
  ["Sled Push", "Chest, triceps, shoulders"],
  ["Bulgarian Split Squat", "Quads, glutes"],
  ["Cossack Squat", "Adductors, quads"],
  ["Kettlebell Swing", "Glutes, hamstrings"],
  ["Hip Airplane", "Glutes, hip stability"],
  ["Arnold Press", "Shoulders, triceps"],
  ["Copenhagen Plank", "Core, adductors"],
  ["Jefferson Curl", "Hamstrings, lower back"],
];
console.log("\nResolver:");
let generic = 0, exact = 0, scored = 0, pattern = 0;
const rows: string[] = [];
for (const [name, muscle] of CATALOGUE) {
  const r = resolveMotion(name, muscle);
  if (r.motion.id === "generic") generic++;
  if (r.via === "exact") exact++; else if (r.via === "scored") scored++; else pattern++;
  rows.push(`  ${name.padEnd(36)} → ${r.motion.id.padEnd(24)} ${r.via}${r.motion.id === "generic" ? "  ← GENERIC" : ""}`);
}
console.log(rows.join("\n"));
console.log(`\n  exact ${exact} · scored ${scored} · pattern ${pattern} · fell through to generic: ${generic}/${CATALOGUE.length}`);
if (generic > 0) bad(`${generic} name(s) fell through to the generic motion`);

console.log(fail === 0 ? "\n✅ ALL CHECKS PASSED" : `\n❌ ${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
