#!/usr/bin/env node
/**
 * npm run programs:check
 * Checks src/data/programs.ts: every exercise exists in the app, reps/seconds are valid, weeks and sessions are
 * in range, and each program matches the shape the server knows (functions/src/programs.ts).
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
const out = fs.mkdtempSync(path.join(os.tmpdir(), "programs-check-"));
for (const rel of ["data/programs.ts", "data/exerciseClips.ts", "data/exerciseClips.generated.ts", "features/exercises/exerciseVideos.ts"]) {
  const src = fs.readFileSync(path.join(root, "src", rel), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const dest = path.join(out, rel.replace(/\.ts$/, ".js"));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, js);
}
const { PROGRAMS, sessionMinutes, EX_INFO } = require(path.join(out, "data/programs.js"));
const { CLIPS } = require(path.join(out, "data/exerciseClips.js"));
fs.rmSync(out, { recursive: true, force: true });

const known = new Map(CLIPS.map(c => [c.id, c]));
const serverSrc = fs.readFileSync(path.join(root, "functions/src/programs.ts"), "utf8");
const shapeBlock = serverSrc.match(/PROGRAM_SHAPES[^=]*=\s*\{([\s\S]*?)\};/)?.[1] ?? "";
const server = Object.fromEntries([...shapeBlock.matchAll(/"([^"]+)":\s*\[([^\]]*)\]/g)].map(m => [m[1], m[2].split(",").map(n => Number(n.trim()))]));

const errors = [], notes = [];
const err = (p, msg) => errors.push(`${p}: ${msg}`);
const seenIds = new Set();
for (const p of PROGRAMS) {
  if (seenIds.has(p.id)) err(p.id, "duplicate program id");
  seenIds.add(p.id);
  if (p.weeks.length < 4 || p.weeks.length > 8) err(p.id, `${p.weeks.length} weeks (must be 4-8)`);
  if (!p.goals.length) err(p.id, "no goals");
  if (p.status === "draft") notes.push(`${p.id}: DRAFT, needs a trainer review before it is marked reviewed`);
  if (p.status === "reviewed" && !p.reviewedBy) err(p.id, "marked reviewed but reviewedBy is empty");
  p.weeks.forEach((w, wi) => {
    if (w.sessions.length < 2 || w.sessions.length > 6) err(p.id, `week ${wi + 1} has ${w.sessions.length} sessions (must be 2-6)`);
    w.sessions.forEach((s, si) => {
      const where = `${p.id} week ${wi + 1} session ${si + 1}`;
      if (s.exercises.length < 3) err(where, "fewer than 3 exercises");
      const m = sessionMinutes(s);
      if (m < 8 || m > 60) err(where, `${m} min (expected 8-60)`);
      s.exercises.forEach(e => {
        const c = known.get(e.id);
        if (!c) err(where, `unknown exercise id "${e.id}"`);
        else if (c.from) err(where, `"${e.id}" is not a Library exercise (it is one with no clip yet)`);
        if (!EX_INFO[e.id]) err(where, `"${e.id}" has no entry in EX_INFO`);
        if ((e.reps == null) === (e.seconds == null)) err(where, `"${e.id}" needs reps or seconds, not both or neither`);
        if (!(e.sets >= 1 && e.sets <= 6)) err(where, `"${e.id}" sets ${e.sets}`);
      });
    });
  });
  const shape = p.weeks.map(w => w.sessions.length);
  if (!server[p.id]) err(p.id, "missing from PROGRAM_SHAPES in functions/src/programs.ts");
  else if (JSON.stringify(server[p.id]) !== JSON.stringify(shape)) err(p.id, `server shape [${server[p.id]}] does not match app shape [${shape}]`);
}
for (const id of Object.keys(server)) if (!PROGRAMS.some(p => p.id === id)) err(id, "in the server list but not in src/data/programs.ts");

for (const p of PROGRAMS) {
  const mins = p.weeks.flatMap(w => w.sessions.map(sessionMinutes));
  console.log(`${p.id}: ${p.weeks.length} weeks, ${mins.length} sessions, ${Math.min(...mins)}-${Math.max(...mins)} min each`);
}
notes.forEach(n => console.log("NOTE  " + n));
if (errors.length) { console.log(""); errors.forEach(e => console.log("ERROR " + e)); process.exit(1); }
console.log("\nAll programs OK.");
