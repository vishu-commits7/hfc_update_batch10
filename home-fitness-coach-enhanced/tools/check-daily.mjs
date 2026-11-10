#!/usr/bin/env node
/** npm run daily:check — tests the daily challenge rules in functions/src/dailyCore.ts. Installs nothing. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(root, "node_modules/typescript"));
const out = fs.mkdtempSync(path.join(os.tmpdir(), "daily-check-"));
fs.writeFileSync(path.join(out, "core.js"), ts.transpileModule(fs.readFileSync(path.join(root, "functions/src/dailyCore.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const c = require(path.join(out, "core.js"));
fs.rmSync(out, { recursive: true, force: true });

let bad = 0;
const ok = (x, m) => { if (!x) { bad++; console.log("FAIL " + m); } };

// the pick: same for a day, never two days running, every exercise gets used
const day = i => new Date(Date.UTC(2026, 10, 1) + i * 86_400_000).toISOString().slice(0, 10);
const seen = new Set(); let repeats = 0;
for (let i = 0; i < 730; i++) {
  const a = c.exerciseFor(day(i)), b = c.exerciseFor(day(i + 1));
  seen.add(a.id);
  if (a.id === b.id) repeats++;
  ok(a.id === c.exerciseFor(day(i)).id, "pick is stable for " + day(i));
}
ok(repeats === 0, `no exercise two days in a row (found ${repeats})`);
ok(seen.size === c.POOL.length, `all ${c.POOL.length} exercises come up within two years (saw ${seen.size})`);
ok(new Set(c.POOL.map(e => e.id)).size === c.POOL.length && c.POOL.every(e => e.rate > 0 && e.rate <= 5 && e.name && e.tip), "pool entries are valid");

// validation
const push = c.POOL.find(e => e.id === "pushups");
const v = (reps, s) => c.validateSubmission(push, reps, s * 1000);
ok(v(40, 64).ok, "40 push-ups in a minute is accepted");
ok(v(c.maxReps(push), 64).ok && v(c.maxReps(push) + 1, 64).reason === "too-fast", "rate limit is exact");
ok(v(40, 30).reason === "too-early", "cannot submit before the minute is up");
ok(v(40, 181).reason === "expired", "a stale start is refused");
ok(v(-1, 64).reason === "range" && v(2.5, 64).reason === "range" && v(5000, 64).reason === "range", "bad numbers are refused");
ok(c.maxReps(c.POOL.find(e => e.id === "burpees")) < c.maxReps(push), "limits differ by exercise");

// board order: more reps first, then earlier in the IST day
const ist = (h, m) => Date.UTC(2026, 10, 10, h, m) - 5.5 * 3600_000;
ok(c.boardScore(41, ist(23, 59)) > c.boardScore(40, ist(0, 1)), "more reps beats earlier");
ok(c.boardScore(40, ist(9, 0)) > c.boardScore(40, ist(9, 1)), "same reps: earlier wins");
ok(c.boardScore(40, ist(0, 0)) < c.boardScore(41, ist(23, 59)), "tie-break never outweighs a rep");

// wiring
const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
ok(/match \/dailyBoard\/\{day\}\/entries\/\{uid\}\s*\{\s*allow read: if signedIn\(\);\s*allow write: if false;/.test(rules), "rules: board is read-only for clients");
const idx = fs.readFileSync(path.join(root, "functions/src/index.ts"), "utf8");
ok(["dailyChallengeInfo", "dailyChallengeStart", "dailyChallengeSubmit", "dailyChallengeSweep"].every(n => idx.includes(n)), "functions are exported");

console.log(bad ? `\n${bad} check(s) failed.` : "All daily challenge checks passed.");
process.exit(bad ? 1 : 0);
