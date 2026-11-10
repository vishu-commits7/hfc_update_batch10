#!/usr/bin/env node
/** npm run anticheat:check — tests the rep-rate limits and the flagging rule. Installs nothing. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(root, "node_modules/typescript"));
const out = fs.mkdtempSync(path.join(os.tmpdir(), "anticheat-check-"));
const load = (rel, name) => { fs.writeFileSync(path.join(out, name), ts.transpileModule(fs.readFileSync(path.join(root, rel), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText); return require(path.join(out, name)); };
const L = load("functions/src/repLimits.ts", "limits.js");
const cat = load("src/lib/arenaCatalog.ts", "catalog.js");
fs.rmSync(out, { recursive: true, force: true });

let bad = 0;
const ok = (x, m) => { if (!x) { bad++; console.log("FAIL " + m); } };

// every Arena exercise has its own limit, and every limit is sane
const ids = cat.BODY_PARTS.flatMap(p => p.exercises.map(e => e.id));
for (const id of ids) ok(L.REP_RATE[id] !== undefined, `no rep-rate limit for Arena exercise "${id}" (it would use the default)`);
for (const [id, r] of Object.entries(L.REP_RATE)) ok(r >= 0.5 && r <= L.HARD_CAP, `limit for ${id} is out of range`);
ok(L.rateFor("burpees") < L.rateFor("pushups") && L.rateFor("pushups") < L.rateFor("high-knees"), "limits differ by exercise");
ok(L.rateFor("made-up") === L.DEFAULT_RATE && L.rateFor(undefined) === L.DEFAULT_RATE, "unknown exercise uses the default");
ok(L.roomRate({ plan: [{ id: "burpees" }, { id: "jacks" }] }) === L.rateFor("jacks"), "a mixed room is judged by its fastest move");
ok(L.roomRate({ plan: null }) === L.DEFAULT_RATE, "a room with no plan uses the default");

// honest pace passes, impossible pace is cut and counted
const push = L.rateFor("pushups");
ok(L.plausibleReps(push, 1) === 3 && L.plausibleReps(push, 2) === 3, "nothing but the small allowance during the countdown");
ok(L.plausibleReps(push, 32) === Math.floor(push * 30) + 3, "limit grows with time after the countdown");
const honest = 30; // 30 push-ups in 30 seconds of work: fast but real
ok(honest <= L.plausibleReps(push, 32), "1 push-up a second is accepted");
ok(!L.isStrike(L.plausibleReps(push, 32) + L.STRIKE_MARGIN, L.plausibleReps(push, 32)), "a little over the limit is cut, not counted against the account");
ok(L.isStrike(200, L.plausibleReps(push, 32)), "200 push-ups in 30 seconds is a strike");

// flagging: 3 in a week
const now = Date.UTC(2026, 10, 10), day = 86_400_000;
let st = L.addStrike([], now);
ok(!st.flagged && st.recent.length === 1, "one strike does not flag");
st = L.addStrike(st.recent, now + 1000); ok(!st.flagged, "two strikes do not flag");
st = L.addStrike(st.recent, now + 2000); ok(st.flagged, "three strikes in a week flag the account");
st = L.addStrike([now - 9 * day, now - 8 * day], now); ok(!st.flagged && st.recent.length === 1, "strikes older than a week drop off");
ok(L.addStrike(Array.from({ length: 40 }, (_, i) => now - i), now).recent.length === 20, "history is capped");

// wiring
const idx = fs.readFileSync(path.join(root, "functions/src/index.ts"), "utf8");
ok(idx.includes("plausibleReps(rate, elapsed)") && idx.includes('strike(uid, "arena-rate"'), "Arena reports use the limits and record strikes");
ok(fs.readFileSync(path.join(root, "functions/src/daily.ts"), "utf8").includes('strike(uid, "daily-rate"'), "daily challenge records strikes");
const mod = fs.readFileSync(path.join(root, "functions/src/moderation.ts"), "utf8");
ok(/export const modListFlagged = onCall\(async req => \{\s*needAdmin\(req\);/.test(mod) && /export const modReviewFlag = onCall\(async req => \{\s*needAdmin\(req\);/.test(mod), "flagged-account tools are moderators only");
ok(/match \/cheatFlags\/\{uid\}\s*\{\s*allow read, write: if false;/.test(fs.readFileSync(path.join(root, "firestore.rules"), "utf8")), "rules: cheat records are server-only");

console.log(bad ? `\n${bad} check(s) failed.` : "All anti-cheat checks passed.");
process.exit(bad ? 1 : 0);
