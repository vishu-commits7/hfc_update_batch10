#!/usr/bin/env node
/** npm run invites:check — tests the invite rules in functions/src/inviteCore.ts. Installs nothing. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(root, "node_modules/typescript"));
const out = fs.mkdtempSync(path.join(os.tmpdir(), "invites-check-"));
fs.writeFileSync(path.join(out, "core.js"), ts.transpileModule(fs.readFileSync(path.join(root, "functions/src/inviteCore.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const c = require(path.join(out, "core.js"));
fs.rmSync(out, { recursive: true, force: true });

let bad = 0;
const ok = (x, m) => { if (!x) { bad++; console.log("FAIL " + m); } };

// codes
for (let i = 0; i < 500; i++) { const code = c.makeInviteCode(); ok(c.cleanCode(code) === code, "generated code is valid: " + code); }
ok(c.cleanCode(" abc-d2f3 ") === "ABCD2F3" && c.cleanCode("ABC") === "" && c.cleanCode("ABCDEF0") === "" && c.cleanCode(null) === "", "typed codes are tidied, bad ones refused");

// device hash
ok(c.deviceHash("a:1234567890abcdef").length === 40 && c.deviceHash("a:1234567890abcdef") === c.deviceHash("a:1234567890abcdef"), "device hash is stable");
ok(c.deviceHash("a:1234567890abcdef") !== c.deviceHash("a:1234567890abcdeg") && !c.deviceHash("a:1234567890abcdef").includes("1234567890"), "hash differs per device and does not contain the id");
ok(c.deviceHash("") === "" && c.deviceHash("short") === "" && c.deviceHash(undefined) === "", "missing device id gives no hash");

// redeeming
const base = { code: "ABCD2F3", inviterUid: "inviter", uid: "newbie", invitedBy: undefined, totalWorkouts: 0, accountAgeDays: 1, device: "h1" };
ok(c.canRedeem(base) === null, "a new account can use a friend's code");
ok(c.canRedeem({ ...base, inviterUid: null }) === "bad-code", "unknown code");
ok(c.canRedeem({ ...base, inviterUid: "newbie" }) === "own-code", "own code");
ok(c.canRedeem({ ...base, invitedBy: "x" }) === "already", "one code per account");
ok(c.canRedeem({ ...base, totalWorkouts: 1 }) === "has-workout", "not after the first workout");
ok(c.canRedeem({ ...base, accountAgeDays: 15 }) === "too-old", "not after 14 days");
ok(c.canRedeem({ ...base, device: "" }) === "no-device", "needs a device id");

// reward
const r = { uid: "newbie", inviterUid: "inviter", deviceUids: ["newbie"], inviterExists: true, inviterBanned: false, inviterRewarded: 0 };
ok(c.decideReward(r).ok === true && c.decideReward(r).inviterPaid === true, "different devices: both rewarded");
ok(c.decideReward({ ...r, deviceUids: ["newbie", "inviter"] }).reason === "same-device", "inviter used the same device: no reward");
ok(c.decideReward({ ...r, deviceUids: ["someone", "newbie"] }).reason === "same-device", "any other account on the device: no reward");
ok(c.decideReward({ ...r, deviceUids: null }).reason === "no-device", "no device record: no reward");
ok(c.decideReward({ ...r, inviterExists: false }).reason === "inviter-gone" && c.decideReward({ ...r, inviterBanned: true }).reason === "inviter-banned", "deleted or banned inviter: no reward");
const capped = c.decideReward({ ...r, inviterRewarded: c.MAX_REWARDED_INVITES });
ok(capped.ok === true && capped.inviterPaid === false, "after 10 rewards the inviter gets no more, the friend still does");
ok(JSON.stringify(c.grantFreeze(1)) === JSON.stringify({ freezes: 2, gotFreeze: true }) && JSON.stringify(c.grantFreeze(2)) === JSON.stringify({ freezes: 2, gotFreeze: false }), "freeze if there is room, otherwise badge only");

// wiring: reward only on the server, once
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const idx = read("functions/src/index.ts");
ok(idx.includes("Number(p.user.totalWorkouts || 0) === 0 ? await readInvite(tx, p.user) : null"), "reward is only considered on the first workout");
const inv = read("functions/src/invites.ts");
ok(inv.includes("if (!user.invitedBy || user.inviteDone) return null;") && inv.includes('inviteDone: "rewarded"') && inv.includes("inviteDone: d.reason"), "one decision per invited account, recorded either way");
const rules = read("firestore.rules");
ok(["inviteCode", "invitedBy", "inviteDevice", "inviteDone", "inviteJoined", "inviteRewarded"].every(k => rules.split(`'${k}'`).length === 3), "rules: the app cannot write any invite field (create and update)");
ok(/match \/inviteCodes\/\{code\}\s*\{\s*allow read, write: if false;/.test(rules) && /match \/devices\/\{hash\}\s*\{\s*allow read, write: if false;/.test(rules), "rules: codes and device records are server-only");
ok(read("android/app/src/main/java/com/homefitnesscoach/app/ApexNativePlugin.java").includes("public void deviceId(PluginCall call)"), "Android provides a device id");

console.log(bad ? `\n${bad} check(s) failed.` : "All invite checks passed.");
process.exit(bad ? 1 : 0);
