#!/usr/bin/env node
/**
 * npm run costs:check
 * 1) Fails if a Firestore collection query in src/ has no limit (the usual way a bill grows by surprise).
 * 2) Tests the shared-listener cache (src/lib/sharedQuery.ts).
 * Installs nothing.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(root, "node_modules/typescript"));
let bad = 0;
const ok = (x, m) => { if (!x) { bad++; console.log("FAIL " + m); } };

/* ---- 1. unbounded queries ---- */
// Collections that are small by design, so a query without a limit is fine. Say why.
const ALLOW = {
  "blocks": "one document per user you blocked",
  "trophies": "at most ~30 per user",
  "members": "a crew has at most 20 members",
  "cands": "WebRTC candidates for one match",
  "chunks": "the parts of one reel",
  "chats": "one document per conversation the user is in",
};
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : []);
const found = [];
for (const f of walk(path.join(root, "src"))) {
  const src = fs.readFileSync(f, "utf8");
  // every statement that reads a collection: from "collection(" to the end of that call chain (rough but enough)
  for (const m of src.matchAll(/(onSnapshot|getDocs)\(\s*(query\()?\s*collection(Group)?\(db,([^)]*)\)/g)) {
    const start = m.index, stmt = src.slice(start, start + 600).split(/\n\s*\n/)[0];
    const names = [...m[4].matchAll(/"([^"]+)"/g)].map(x => x[1]);
    const last = names[names.length - 1] ?? "?";
    const head = stmt.split("snap =>")[0].split("=> {")[0];
    const limited = /fsLimit\(|limitToLast\(|\blimit\(/.test(head) || /documentId\(\), "in"/.test(head); // an "in" list is at most 30 ids
    const line = src.slice(0, start).split("\n").length;
    found.push({ file: path.relative(root, f), line, col: names.join("/"), limited, allowed: ALLOW[last] });
  }
}
for (const q of found) ok(q.limited || q.allowed, `${q.file}:${q.line} reads "${q.col}" with no limit (add one, or list it in tools/check-costs.mjs with the reason)`);
console.log(`${found.length} collection reads checked: ${found.filter(q => q.limited).length} limited, ${found.filter(q => !q.limited && q.allowed).length} small by design.`);

/* ---- 2. shared listener ---- */
const out = fs.mkdtempSync(path.join(os.tmpdir(), "costs-check-"));
fs.writeFileSync(path.join(out, "sq.js"), ts.transpileModule(fs.readFileSync(path.join(root, "src/lib/sharedQuery.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const { sharedQuery, clearSharedQueries } = require(path.join(out, "sq.js"));
fs.rmSync(out, { recursive: true, force: true });
const tick = () => new Promise(r => setTimeout(r, 5));
let starts = 0, stops = 0, emit;
const start = (e) => { starts++; emit = e; return () => { stops++; }; };
const got = { a: [], b: [], c: [] };
const ua = sharedQuery("k", start, v => got.a.push(v), undefined, 30);
const ub = sharedQuery("k", start, v => got.b.push(v), undefined, 30);
emit(1); await tick();
ok(starts === 1 && got.a.join() === "1" && got.b.join() === "1", "two screens share one listener");
ua(); ub(); await tick();
ok(stops === 0, "the listener is kept for a while after the last screen leaves");
const uc = sharedQuery("k", start, v => got.c.push(v), undefined, 30); await tick();
ok(starts === 1 && got.c.join() === "1", "re-opening soon reuses it and shows the last data at once (no new reads)");
emit(2); await tick();
ok(got.c.join() === "1,2" && got.a.join() === "1", "updates still arrive live, and only to screens that are open");
uc(); await new Promise(r => setTimeout(r, 60));
ok(stops === 1, "after the linger time the listener is closed");
sharedQuery("k", start, () => {}, undefined, 30);
ok(starts === 2, "later it starts fresh");
clearSharedQueries();
ok(stops === 2, "sign-out closes everything");
let errs = 0, fail;
sharedQuery("e", (e, f) => { fail = f; return () => {}; }, () => {}, () => errs++, 30);
fail(new Error("x"));
ok(errs === 1, "errors reach the screen");

/* ---- 3. the changes this batch made are still in place ---- */
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const social = read("src/lib/social.ts");
ok(/subscribeMessages[\s\S]{0,400}limitToLast\(max\)/.test(social) && /max = 50/.test(social), "chat opens with the newest 50 messages, not 300");
ok(/export function subscribeLiveRooms[\s\S]{0,900}getDocs\(/.test(social) && !/export function subscribeLiveRooms[\s\S]{0,900}onSnapshot\(/.test(social), "the live-rooms list is polled, not a live listener");
ok(read("src/components/BeastDuelArena.tsx").includes("REPORT_EVERY_MS = 400"), "rep reports are sent every 400 ms");

console.log(bad ? `\n${bad} check(s) failed.` : "All cost checks passed.");
process.exit(bad ? 1 : 0);
