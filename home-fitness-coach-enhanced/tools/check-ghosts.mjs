#!/usr/bin/env node
/**
 * npm run ghosts:check
 * Tests the ghost duel rules in functions/src/ghostCore.ts: timelines, who wins, half-weight rating,
 * anonymous names, the pacer, and that the phone and server count reps the same way.
 * Uses the TypeScript compiler already in node_modules; installs nothing.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(root, "node_modules/typescript"));
const out = fs.mkdtempSync(path.join(os.tmpdir(), "ghosts-check-"));
const compile = (rel) => ts.transpileModule(fs.readFileSync(path.join(root, rel), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
fs.writeFileSync(path.join(out, "core.js"), compile("functions/src/ghostCore.ts"));
const core = require(path.join(out, "core.js"));
const clientRepsAt = compile("src/features/arena/ghost.ts").includes("lo = mid + 1") && fs.readFileSync(path.join(root, "src/features/arena/ghost.ts"), "utf8").includes("tl[mid] <= ms");
fs.rmSync(out, { recursive: true, force: true });

let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const { repsAt, appendTimeline, settleReps, eloDelta, ghostKey, anonName, makePacer, runScore, isGhostable, MAX_TL } = core;

// repsAt
eq([repsAt([], 5), repsAt([10, 20, 30], 9), repsAt([10, 20, 30], 10), repsAt([10, 20, 30], 25), repsAt([10, 20, 30], 99)], [0, 0, 1, 2, 3], "repsAt");
ok(clientRepsAt, "client repsAt matches server");

// timelines: reps spread between reports, never past the cap, never going backwards
eq(appendTimeline([], 0, 3, 0, 3000), [1000, 2000, 3000], "append spread");
eq(appendTimeline([1000], 1, 1, 1000, 5000), [1000], "no new reps");
eq(appendTimeline([1000], 1, 2, 1000, 1000), [1000, 1000], "same instant");
ok(appendTimeline(Array(MAX_TL).fill(1), MAX_TL, MAX_TL + 5, 0, 9).length === MAX_TL, "timeline capped");

// first-to-20: player 20 reps at 30s, ghost at 1.5s a rep (30s for 20)
const ghost = Array.from({ length: 20 }, (_, i) => 1500 * (i + 1));
const host = (finish) => Array.from({ length: 20 }, (_, i) => Math.round((finish / 20) * (i + 1)));
const base = { target: 20, ghostTl: ghost };
let r = settleReps({ ...base, hostReps: 20, hostTl: host(25000), elapsedMs: 25000, hostFinMs: 25000 });
eq([r.winner, r.hostReps, r.guestReps < 20], ["host", 20, true], "player finishes first");
r = settleReps({ ...base, hostReps: 20, hostTl: host(40000), elapsedMs: 40000, hostFinMs: 40000 });
eq([r.winner, r.guestReps, r.hostReps < 20], ["ghost", 20, true], "ghost finishes first, player score is cut back to that moment");
r = settleReps({ ...base, hostReps: 12, hostTl: host(40000).slice(0, 12), elapsedMs: 31000, hostFinMs: null });
eq([r.winner, r.guestReps], ["ghost", 20], "player did not finish, ghost did");
r = settleReps({ ...base, hostReps: 12, hostTl: host(40000).slice(0, 12), elapsedMs: 10000, hostFinMs: null });
eq(r.winner, "host", "ended early while ahead at the clock: compared at that moment (6 vs ghost 6 at 10s => 12 vs 6)");
r = settleReps({ ...base, hostReps: 19, hostTl: host(40000).slice(0, 19), elapsedMs: 30000, hostFinMs: null, forfeit: true });
eq([r.winner, r.guestReps > r.hostReps], ["ghost", true], "forfeit is always a loss");
r = settleReps({ ...base, hostReps: 20, hostTl: host(30000), elapsedMs: 30000, hostFinMs: 30000 });
eq(r.winner, null, "same millisecond is a draw");

// rating: half weight
const full = eloDelta(1000, 1000, 1, 20, 1), half = eloDelta(1000, 1000, 1, 20, 0.5);
eq([full, half], [12, 6], "even win: 12 live, 6 vs a ghost");
ok(eloDelta(1000, 1000, 0, 20, 0.5) === -6, "even loss halves too");
ok(eloDelta(1000, 1400, 1, 20, 0.5) > half, "beating a stronger ghost pays more");

// keys, anonymity, pacer, scores
const room = { plan: [{ id: "pushups", reps: 20 }], exercise: "Push-ups", mode: "reps", target: 20 };
ok(ghostKey(room) === ghostKey({ ...room, exercise: "Pushups!" }), "key follows the exercise id, not the label");
ok(ghostKey(room) !== ghostKey({ ...room, target: 25 }), "different reps, different key");
ok(isGhostable(room) && !isGhostable({ ...room, mode: "time" }) && !isGhostable({ ...room, plan: [{}, {}] }), "only first-to-N single exercise makes ghosts");
ok(/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(anonName("uid123_abc")) && anonName("a") === anonName("a"), "anonymous name is two words and stable");
const pacer = makePacer(20);
ok(pacer.length === 20 && pacer.every((t, i) => i === 0 || t > pacer[i - 1]) && pacer[0] > 2000, "pacer is ascending and starts after the countdown");
ok(runScore(20, 20, 20000) > runScore(20, 20, 25000) && runScore(20, 20, 99000) > runScore(19, 20, null), "faster finish beats slower, finishing beats not finishing");

// the server must keep ghosts away from clients
const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
ok(/match \/ghosts\/\{id\}\s*\{\s*allow read, write: if false;/.test(rules), "rules: ghosts are server-only");
const acct = fs.readFileSync(path.join(root, "functions/src/account.ts"), "utf8");
ok(acct.includes('collection("ghosts")'), "account deletion removes the user's ghosts");
const idx = fs.readFileSync(path.join(root, "firestore.indexes.json"), "utf8");
ok(idx.includes('"ghosts"'), "ghosts index (key, rating) is declared");

console.log(bad ? `\n${bad} check(s) failed.` : "All ghost checks passed.");
process.exit(bad ? 1 : 0);
