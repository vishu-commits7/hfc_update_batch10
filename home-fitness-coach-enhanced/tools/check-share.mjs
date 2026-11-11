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
const qr = load("src/core/qr.ts", "qr.js");
const link = load("src/core/shareLink.ts", "shareLink.js");
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
const card = fs.readFileSync(path.join(root, "src/features/progress/flexCard.ts"), "utf8");
ok(/if \(data\.name\)/.test(card) && !/name: opts\./.test(card), "card builders never fill in a name themselves");
const arena = card.slice(card.indexOf("export function arenaCard"));
ok(!/oppName|opponentName/.test(arena), "the opponent is not named on an Arena card");

// invite links: they must point at the /join landing page (never the web app's front page) and read back correctly
ok(link.joinLink("crew", "qbsuth") === "https://hfc-update-batch10.onrender.com/join?crew=QBSUTH", "crew link");
ok(link.joinLink() === "https://hfc-update-batch10.onrender.com/join" && link.joinLink("room", "bad code!") === link.joinLink(), "no or bad code gives the plain landing page");
link.setLinkBase("https://apexpulse.example/"); ok(link.joinLink("invite", "ABC1234") === "https://apexpulse.example/join?invite=ABC1234", "link host can be changed");
link.setLinkBase("http://insecure.example"); ok(link.joinLink().startsWith("https://apexpulse.example/"), "non-https host is ignored");
const pj = u => JSON.stringify(link.parseJoinLink(u));
ok(pj("https://x.example/join?crew=QBSUTH") === '{"kind":"crew","code":"QBSUTH"}', "reads an https join link");
ok(pj("apexpulse://join?room=AB12CD") === '{"kind":"room","code":"AB12CD"}', "reads the app-scheme link");
ok(pj("apexpulse://oauth?crew=QBSUTH") === "null" && pj("https://x.example/join?crew=<script>") === "null" && pj("not a url") === "null", "ignores other links and bad codes");
const server = fs.readFileSync(path.join(root, "server.ts"), "utf8");
ok(server.includes('app.get("/join"') && server.includes('"/.well-known/assetlinks.json"') && server.indexOf('app.get("/join"') < server.indexOf('app.get("*"'), "server answers /join and assetlinks before the web app");
const manifest = fs.readFileSync(path.join(root, "android/app/src/main/AndroidManifest.xml"), "utf8");
ok(manifest.includes('android:scheme="apexpulse" android:host="join"') && manifest.includes('android:pathPrefix="/join"'), "Android opens join links");

console.log(bad ? `\n${bad} check(s) failed.` : "All share-card checks passed.");
process.exit(bad ? 1 : 0);
