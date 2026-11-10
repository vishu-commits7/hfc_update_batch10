#!/usr/bin/env node
/** npm run share:check — share-card link and QR code checks. Installs nothing. (Scanning the code needs a phone.) */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(root, "node_modules/typescript"));
const out = fs.mkdtempSync(path.join(os.tmpdir(), "share-check-"));
const load = (rel, name) => { fs.writeFileSync(path.join(out, name), ts.transpileModule(fs.readFileSync(path.join(root, rel), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText); return require(path.join(out, name)); };
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
const qr = load("src/lib/qr.ts", "qr.js");
const link = load("src/lib/shareLink.ts", "shareLink.js");
fs.rmSync(out, { recursive: true, force: true });

let bad = 0;
const ok = (x, m) => { if (!x) { bad++; console.log("FAIL " + m); } };

// links
for (const s of ["arena", "level", "streak", "session", "milestone", "app"]) {
  const u = link.playStoreUrl(s);
  ok(u.startsWith("https://play.google.com/store/apps/details?id=com.homefitnesscoach.app&referrer="), `${s}: Play Store listing link`);
  ok(u.length <= 84, `${s}: link fits the small QR code (${u.length} chars)`);
  const m = qr.qrMatrix(u);
  ok(m.length === 37 && m.every(r => r.length === 37), `${s}: QR is 37x37`);
  // the three corner squares a scanner looks for
  const finder = (x0, y0) => [0, 1, 2, 3, 4, 5, 6].every(i => m[y0][x0 + i] && m[y0 + 6][x0 + i] && m[y0 + i][x0] && m[y0 + i][x0 + 6]) && m[y0 + 3][x0 + 3] && !m[y0 + 1][x0 + 1];
  ok(finder(0, 0) && finder(30, 0) && finder(0, 30), `${s}: finder patterns present`);
  ok(JSON.stringify(m) === JSON.stringify(qr.qrMatrix(u)), `${s}: same link gives the same code`);
}
ok(new Set(["arena", "level", "streak"].map(s => link.playStoreUrl(s))).size === 3, "each kind of card has its own referrer");
ok(qr.qrMatrix("HELLO").length === 21 && qr.qrMatrix("x".repeat(106)).length === 41, "sizes: 21 for short text, 41 at the limit");
let threw = false; try { qr.qrMatrix("x".repeat(107)); } catch { threw = true; }
ok(threw, "over-long text is refused, not truncated");

// the name is opt-in
ok(link.getShowNameOnCards() === false, "name on cards is off by default");
link.setShowNameOnCards(true); ok(link.getShowNameOnCards() === true, "turning it on is remembered");
link.setShowNameOnCards(false); ok(link.getShowNameOnCards() === false, "and off again");
const card = fs.readFileSync(path.join(root, "src/lib/flexCard.ts"), "utf8");
ok(/if \(data\.name\)/.test(card) && !/name: opts\./.test(card), "card builders never fill in a name themselves");
const arena = card.slice(card.indexOf("export function arenaCard"));
ok(!/oppName|opponentName/.test(arena), "the opponent is not named on an Arena card");

console.log(bad ? `\n${bad} check(s) failed.` : "All share-card checks passed.");
process.exit(bad ? 1 : 0);
