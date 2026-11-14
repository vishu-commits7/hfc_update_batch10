#!/usr/bin/env node
/**
 * npm run reps:check
 * Tests the camera rep judge end to end, with made-up skeletons instead of a camera:
 *   phone:  src/features/arena/repEngine.ts   (counts a rep only if it is deep, locked out and clean)
 *   server: functions/src/repVerify.ts        (re-checks every rep's evidence; decides if a match is rated)
 * It cannot tell how well the real pose model sees a real person; that needs a phone.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(root, "node_modules/typescript"));
const out = fs.mkdtempSync(path.join(os.tmpdir(), "reps-check-"));
const load = (rel, name) => { fs.writeFileSync(path.join(out, name), ts.transpileModule(fs.readFileSync(path.join(root, rel), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText); return require(path.join(out, name)); };
const app = load("src/features/arena/repEngine.ts", "engine.js");
const srv = load("functions/src/repVerify.ts", "verify.js");
fs.rmSync(out, { recursive: true, force: true });

let bad = 0;
const ok = (x, m) => { if (!x) { bad++; console.log("FAIL " + m); } };
const rad = d => (d * Math.PI) / 180;

/* ---- made-up bodies: 33 points, the same on the left and the right side ---- */
const body = (pts) => { const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 })); for (const [i, p] of Object.entries(pts)) lm[i] = { x: p[0], y: p[1], visibility: p[2] ?? 0.95 }; return lm; };
const both = (l, r, p) => ({ [l]: p, [r]: p });
// side view push-up. elbow = elbow angle; sag pushes the hips toward the floor; upright stands the body up.
function pushup(elbow, { sag = 0, upright = false } = {}) {
  const a = 0.13, wrist = [0.3, 0.8];
  const sh = [0.3, wrist[1] - 2 * a * Math.sin(rad(elbow / 2))];
  const el = [0.3 - a * Math.cos(rad(elbow / 2)), (sh[1] + wrist[1]) / 2];
  const an = upright ? [0.3, 0.98] : [0.8, 0.8];
  const hip = upright ? [0.3, (sh[1] + an[1]) / 2] : [sh[0] + (an[0] - sh[0]) * 0.55, sh[1] + (an[1] - sh[1]) * 0.55 + sag];
  const kn = [(hip[0] + an[0]) / 2, (hip[1] + an[1]) / 2];
  return body({ ...both(11, 12, sh), ...both(13, 14, el), ...both(15, 16, wrist), ...both(23, 24, hip), ...both(25, 26, kn), ...both(27, 28, an) });
}
// side view squat. knee = knee angle (175 standing).
function squat(knee) {
  const f = 180 - knee, len = 0.2, an = [0.5, 0.92];
  const kn = [an[0] + len * Math.sin(rad(f * 0.35)), an[1] - len * Math.cos(rad(f * 0.35))];
  const hip = [kn[0] - len * Math.sin(rad(f * 0.65)), kn[1] - len * Math.cos(rad(f * 0.65))];
  const sh = [hip[0] + 0.25 * Math.sin(rad(f * 0.4)), hip[1] - 0.25 * Math.cos(rad(f * 0.4))];
  return body({ ...both(11, 12, sh), ...both(23, 24, hip), ...both(25, 26, kn), ...both(27, 28, an) });
}
// front view jumping jack. arm = how far the arms are raised (0 down, 170 overhead); feet = half the distance between the ankles.
function jack(arm, feet) {
  const pts = { 11: [0.42, 0.3], 12: [0.58, 0.3], 23: [0.45, 0.55], 24: [0.55, 0.55], 27: [0.5 - feet, 0.95], 28: [0.5 + feet, 0.95] };
  pts[15] = [0.42 - 0.25 * Math.sin(rad(arm)), 0.3 + 0.25 * Math.cos(rad(arm))];
  pts[16] = [0.58 + 0.25 * Math.sin(rad(arm)), 0.3 + 0.25 * Math.cos(rad(arm))];
  return body(pts);
}
/** Runs `reps` smooth cycles between `top` and `bottom` at 15 frames a second. make(value, phase 0..1) builds one frame. */
function run(family, make, { top, bottom, reps = 5, periodMs = 2000, startMs = 3000, jitter = 0 } = {}) {
  const e = new app.RepEngine(family);
  const ev = [], rejects = [], cues = new Set();
  let t = startMs;
  for (let i = 0; i < 10; i++, t += 66) e.feed(make(top, 0), t);           // settle at the top first
  for (let r = 0; r < reps; r++) {
    const period = periodMs * (1 + jitter * Math.sin(r * 1.7)), depth = bottom + jitter * 8 * Math.cos(r * 2.3);
    for (let k = 0; k * 66 < period; k++, t += 66) {
      const ph = (k * 66) / period;
      const f = e.feed(make(top + (depth - top) * (1 - Math.cos(ph * 2 * Math.PI)) / 2, ph), t);
      cues.add(f.cue);
      if (f.rep?.ok) ev.push(f.rep.ev); else if (f.rep) rejects.push(f.rep.reason);
    }
    for (let i = 0; i < 4; i++, t += 66) { const f = e.feed(make(top, 0), t); if (f.rep?.ok) ev.push(f.rep.ev); else if (f.rep) rejects.push(f.rep.reason); }
  }
  return { counted: e.counted, rejected: e.rejected, ev, rejects, cues, endMs: t };
}

/* ---- the phone's judge ---- */
let r = run("pushup", v => pushup(v), { top: 170, bottom: 80, jitter: 0.12 });
ok(r.counted === 5 && r.rejected === 0, `5 full push-ups count (got ${r.counted}, ${r.rejected} refused)`);
const goodPush = r;
r = run("pushup", v => pushup(v), { top: 170, bottom: 122 });
ok(r.counted === 0 && r.rejects.filter(x => x === "depth").length >= 4, `half push-ups are refused for depth (counted ${r.counted}, refused ${r.rejects.join()})`);
r = run("pushup", v => pushup(v, { sag: 0.12 }), { top: 170, bottom: 80 });
ok(r.counted === 0 && r.rejects.includes("form"), `push-ups with sagging hips are refused for form (counted ${r.counted})`);
r = run("pushup", v => pushup(v, { upright: true }), { top: 170, bottom: 80 });
ok(r.counted === 0 && r.cues.has("position"), `bending the arms while standing is not a push-up (counted ${r.counted})`);
r = run("pushup", v => pushup(v), { top: 170, bottom: 80, periodMs: 260, reps: 12 });
ok(r.counted === 0, `arm flapping faster than a real rep is not counted (counted ${r.counted})`);
r = run("squat", v => squat(v), { top: 175, bottom: 90, jitter: 0.1 });
ok(r.counted === 5, `5 full squats count (got ${r.counted}, refused ${r.rejects.join()})`);
const goodSquat = r;
r = run("squat", v => squat(v), { top: 175, bottom: 130 });
ok(r.counted === 0 && r.rejects.includes("depth"), `shallow squats are refused (counted ${r.counted})`);
r = run("jack", (v, ph) => jack(v, 0.05 + 0.1 * (1 - Math.cos(ph * 2 * Math.PI)) / 2), { top: 12, bottom: 168, periodMs: 900, jitter: 0.1 });
ok(r.counted === 5, `5 jumping jacks count (got ${r.counted}, refused ${r.rejects.join()})`);
r = run("jack", v => jack(v, 0.05), { top: 12, bottom: 168, periodMs: 900 });
ok(r.counted === 0, `waving the arms with the feet together is not a jumping jack (counted ${r.counted})`);
const lostBody = pushup(170).map(p => ({ ...p, visibility: 0.2 }));
ok(new app.RepEngine("pushup").feed(lostBody, 3000).cue === "frame", "a body that is not clearly visible asks the player to step back");

/* ---- phone and server agree ---- */
for (const fam of Object.keys(app.LIMITS)) ok(JSON.stringify(app.LIMITS[fam]) === JSON.stringify(srv.LIMITS[fam]), `limits match for ${fam}`);
const names = ["Classic Push-ups", "Wide Push-ups", "Diamond Push-ups", "Pike Push-ups", "Plank Shoulder Taps", "Chair Tricep Dips", "Sit-ups", "Crunches", "Bicycle Crunches",
  "Bodyweight Squats", "Jump Squats", "Alternating Lunges", "Split Squats", "Burpees", "Jumping Jacks", "High Knees", "Squat Thrusts", "Mountain Climbers", "Plank Up-downs", ""];
ok(names.every(n => app.familyFor(n) === srv.familyFor(n)), "phone and server pick the same exercises for the camera");
ok(app.familyFor("Classic Push-ups") === "pushup" && app.familyFor("Pike Push-ups") === null && app.familyFor("Jump Squats") === null && app.familyFor("Split Squats") === "lunge" && app.familyFor("Jumping Jacks") === "jack" && app.familyFor("Burpees") === null, "family rules");
ok(srv.roomFamily({ plan: [{ id: "pushups", name: "Classic Push-ups" }] }) === "pushup" && srv.roomFamily({ plan: [{ name: "Classic Push-ups" }, { name: "Sit-ups" }] }) === null, "a mixed plan is not camera-judged");

/* ---- the server re-checks the phone's evidence ---- */
let v = srv.verifyBatch("pushup", goodPush.ev, 0, goodPush.endMs);
ok(v.accepted === 5 && v.refused === 0, `server accepts the 5 honest push-ups (accepted ${v.accepted}, refused ${JSON.stringify(v.reasons)})`);
ok(srv.verifyBatch("squat", goodSquat.ev, 0, goodSquat.endMs).accepted === 5, "server accepts the 5 honest squats");
ok(srv.verifyBatch("pushup", goodPush.ev, v.lastEndMs, goodPush.endMs, v.stats).accepted === 0, "the same evidence sent again is not counted twice");
ok(!srv.looksForged(v.stats) && srv.sideVerified(5, 5, v.stats), "honest reps are verified");
ok(!srv.sideVerified(5, 4, v.stats) && srv.sideVerified(20, 18, v.stats) && !srv.sideVerified(0, 0, v.stats), "at least 90% of a player's reps must be verified");
const one = (e, last = 0, elapsed = 60000) => srv.checkOne("pushup", e, last, elapsed);
ok(one([5000, 1500, 80, 160, 90, 90]) === null, "a clean record passes");
ok(one([5000, 1500, 125, 160, 90, 90]) === "depth" && one([5000, 1500, 80, 130, 90, 90]) === "lockout", "not deep enough / not locked out is refused");
ok(one([5000, 150, 80, 160, 90, 90]) === "tempo" && one([5000, 1500, 80, 160, 40, 90]) === "form" && one([5000, 1500, 80, 160, 90, 20]) === "visibility", "too fast / bad form / not visible is refused");
ok(one([70000, 1500, 80, 160, 90, 90]) === "clock" && one([5000, 1500, 80, 160, 90, 90], 4900) === "order", "a rep from the future, or on top of the last one, is refused");
ok(srv.verifyBatch("pushup", [[5000, 1500, 80, 160, 90], "x", null], 0, 60000).refused === 3, "malformed records are refused");
const forged = Array.from({ length: 10 }, (_, i) => [3000 + i * 1000, 900, 85, 160, 100, 99]);
v = srv.verifyBatch("pushup", forged, 0, 60000);
ok(v.accepted === 10 && srv.looksForged(v.stats) && !srv.sideVerified(10, 10, v.stats), "ten identical records pass one by one but are caught as generated");

/* ---- when a match is rated ---- */
const pol = (o) => srv.ratingPolicy({ requireCamera: true, family: "pushup", hostVerified: false, guestVerified: false, winner: "host", ...o });
ok(pol({ hostVerified: true, guestVerified: true }).rated, "both verified: rated");
ok(pol({ hostVerified: true }).rated, "verified winner beats a tapper: rated (the tapper chose taps)");
ok(!pol({ guestVerified: true }).rated && pol({ guestVerified: true }).reason === "winner-not-verified", "a tapper cannot take rating from a verified player");
ok(!pol({}).rated && pol({}).reason === "nobody-verified", "nobody verified: not rated");
ok(!pol({ hostVerified: true, winner: null }).rated && pol({ hostVerified: true, guestVerified: true, winner: null }).rated, "a draw needs both verified");
ok(!pol({ family: null, hostVerified: true, guestVerified: true }).rated, "an exercise the camera cannot judge is a friendly");
ok(srv.ratingPolicy({ requireCamera: false, family: null, hostVerified: false, guestVerified: false, winner: "host" }).rated, "with the switch off, every match is rated as before");

/* ---- wiring ---- */
const idx = fs.readFileSync(path.join(root, "functions/src/index.ts"), "utf8");
ok(idx.includes("verifyBatch(") && idx.includes("ratingPolicy(") && idx.includes("arenaWin: won && rated"), "the server checks evidence and only rated wins count as wins");
ok(fs.readFileSync(path.join(root, "functions/src/ghosts.ts"), "utf8").includes("camOk"), "ghost matches follow the same rule");
ok(fs.readFileSync(path.join(root, "functions/src/init.ts"), "utf8").includes("ARENA_REQUIRE_CAMERA"), "there is a server switch to turn the rule off");

console.log(bad ? `\n${bad} check(s) failed.` : "All rep-judge checks passed.");
process.exit(bad ? 1 : 0);
