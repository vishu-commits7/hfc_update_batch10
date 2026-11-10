#!/usr/bin/env node
/** npm run leagues:check — tests the weekly league rules (server) and that the app shows the same zones. Installs nothing. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(root, "node_modules/typescript"));
const out = fs.mkdtempSync(path.join(os.tmpdir(), "leagues-check-"));
const load = (rel, name) => { fs.writeFileSync(path.join(out, name), ts.transpileModule(fs.readFileSync(path.join(root, rel), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText); return require(path.join(out, name)); };
const srv = load("functions/src/leagueCore.ts", "srv.js");
const app = load("src/lib/league.ts", "app.js");
fs.rmSync(out, { recursive: true, force: true });

let bad = 0;
const ok = (x, m) => { if (!x) { bad++; console.log("FAIL " + m); } };
const MAX = 4;

// zones: full group 5/5, small groups scale, app == server
ok(JSON.stringify(srv.leagueZones(30)) === JSON.stringify({ promote: 5, demote: 5 }), "30 players: top 5 up, bottom 5 down");
for (let n = 1; n <= 30; n++) {
  const z = srv.leagueZones(n), a = app.leagueZones(n);
  ok(z.promote === a.promote && z.demote === a.demote, `app and server agree for ${n} players`);
  ok(z.promote + z.demote <= n && z.promote >= 1 && z.promote <= 5 && z.demote <= 5, `zones fit in a group of ${n}`);
  ok(n < 4 || z.promote + z.demote <= Math.ceil(n * 0.67), `most of a group of ${n} never moves at once`);
}

// outcomes in a full group
const o = (rank, xp, tier, size = 30) => srv.leagueOutcome(rank, size, xp, tier, MAX);
ok(o(1, 500, 0) === "promoted" && o(5, 10, 0) === "promoted" && o(6, 10, 0) === "stayed", "ranks 1-5 go up, 6 stays");
ok(o(1, 0, 0) === "stayed", "no promotion with 0 XP");
ok(o(26, 0, 1) === "demoted" && o(25, 0, 1) === "stayed", "ranks 26-30 go down, 25 stays");
ok(o(30, 0, 0) === "stayed", "Bronze cannot go down");
ok(o(1, 900, MAX) === "stayed" && o(30, 0, MAX) === "demoted", "Diamond cannot go up but can go down");
ok(o(3, 50, 1, 6) === "stayed" && o(2, 50, 1, 6) === "promoted" && o(6, 0, 1, 6) === "stayed", "group of 6: 2 up, nobody down");

// counts over a full group: exactly 5 up and 5 down
const members = Array.from({ length: 30 }, (_, i) => ({ id: "u" + String(i).padStart(2, "0"), xp: 1000 - i * 10 }));
const ranked = srv.rankMembers(members);
const res = ranked.map((m, i) => srv.leagueOutcome(i + 1, 30, m.xp, 2, MAX));
ok(res.filter(r => r === "promoted").length === 5 && res.filter(r => r === "demoted").length === 5, "exactly 5 up and 5 down");
const tie = srv.rankMembers([{ id: "a", xp: 5 }, { id: "c", xp: 5 }, { id: "b", xp: 9 }]).map(m => m.id).join("");
ok(tie === "bca", "ties are ordered the same way every time");

// rating bands
ok([srv.bandOf(600), srv.bandOf(899), srv.bandOf(900), srv.bandOf(1000), srv.bandOf(1100), srv.bandOf(1299), srv.bandOf(1300), srv.bandOf(2400), srv.bandOf(NaN)].join() === "0,0,1,1,2,2,3,3,1", "rating bands");

// what the screen tells the player
const xp = Array.from({ length: 30 }, (_, i) => 600 - i * 20); // 600, 580, ... 20
let s = app.leagueStatus(xp, 2, 1, MAX);
ok(s.zone === "promote" && s.lead === xp[2] - xp[5], "in the top 5: lead over #6");
s = app.leagueStatus(xp, 9, 1, MAX);
ok(s.zone === "safe" && s.need === xp[4] - xp[9] + 1, "mid-table: XP needed to pass #5");
s = app.leagueStatus(xp, 28, 1, MAX);
ok(s.zone === "demote" && s.need === xp[24] - xp[28] + 1, "bottom 5: XP needed to pass #25");
ok(app.leagueStatus(xp, 28, 0, MAX).zone === "safe", "Bronze: bottom is not a demotion zone");
ok(app.leagueStatus(xp, 0, MAX, MAX).zone === "top", "Diamond leader: nowhere higher");
ok(app.leagueStatus(xp, -1, 1, MAX) === null, "not on the table yet");
ok(app.leagueStatus(Array(30).fill(0), 0, 0, MAX).zone === "safe", "0 XP at the top is not promotion");

// wiring
const lg = fs.readFileSync(path.join(root, "functions/src/leagues.ts"), "utf8");
ok(lg.includes("leagueOutcome(") && lg.includes("bandOf(") && /schedule: "5 0 \* \* 1", timeZone: "Asia\/Kolkata"/.test(lg), "rollover uses the shared rules and runs Monday 00:05 IST");
const view = fs.readFileSync(path.join(root, "src/components/LeagueView.tsx"), "utf8");
ok(!/top 10|i < 10|size - 5/.test(view), "screen no longer uses the old top-10 rule");

console.log(bad ? `\n${bad} check(s) failed.` : "All league checks passed.");
process.exit(bad ? 1 : 0);
