#!/usr/bin/env node
/** npm run review:check — the rating prompt's timing rules. Installs nothing. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
let bad = 0;
const ok = (x, m) => { if (!x) { bad++; console.log("FAIL " + m); } };

// the rule is pure, so lift it straight out of the source (the file's imports need a browser)
const src = read("src/lib/review.ts");
const grab = name => { const m = src.match(new RegExp(`export function ${name}\\([\\s\\S]*?\\n}\\n`)); if (!m) throw new Error("missing " + name); return m[0].replace("export ", "").replace(/\(([a-z]+): \{[^)]*\}\)(: [A-Za-z| ]+)?/, "($1)"); };
const consts = "const MIN_DAYS_SINCE_FIRST_OPEN = 3, MIN_DAYS_BETWEEN_PROMPTS = 60, DAY = 86400000;";
ok(/MIN_DAYS_SINCE_FIRST_OPEN = 3;/.test(src) && /MIN_DAYS_BETWEEN_PROMPTS = 60;/.test(src), "3 days and 60 days are the values in the code");
const { shouldAskReview, winMomentOf } = new Function(`${consts}\n${grab("shouldAskReview")}\n${grab("winMomentOf")}\nreturn { shouldAskReview, winMomentOf };`)();

const DAY = 86_400_000, now = Date.UTC(2026, 10, 10);
const ask = (o) => shouldAskReview({ now, firstOpen: now - 10 * DAY, lastPrompt: 0, moment: "level-up", ...o });
ok(ask({}) === true, "after a level-up, 10 days in, never asked: ask");
ok(ask({ moment: "program-week" }) === true, "a finished program week also counts");
ok(ask({ moment: null }) === false, "no win moment: never ask");
ok(ask({ firstOpen: now - 2.9 * DAY }) === false && ask({ firstOpen: now - 3 * DAY }) === true, "never in the first 3 days");
ok(ask({ firstOpen: 0 }) === false, "unknown first-open date: do not ask");
ok(ask({ lastPrompt: now - 59 * DAY }) === false && ask({ lastPrompt: now - 60 * DAY }) === true, "at most once per 60 days");
ok(winMomentOf({ levelUp: true }) === "level-up", "level-up is a win moment");
ok(winMomentOf({ program: { credited: true, weekComplete: true } }) === "program-week", "finished program week is a win moment");
ok(winMomentOf({ program: { credited: true, weekComplete: false } }) === null && winMomentOf({ program: { credited: false, weekComplete: true } }) === null && winMomentOf({}) === null, "an ordinary session, a trophy or a quest is not");

// wiring
const app = read("src/App.tsx");
ok(app.includes("if (takeReviewTurn(m)) setReviewMoment(m);") && app.includes("noteFirstOpen()"), "asked only when the level-up screen closes, and the first open is recorded");
const sheet = read("src/components/ReviewPrompt.tsx");
ok(sheet.includes("Rate on Google Play") && sheet.includes("Send private feedback") && sheet.includes("Not now"), "the sheet offers rating, private feedback and a way out");
ok(!/do you (like|love|enjoy)|enjoying/i.test(sheet), "no opinion question before the rating card (Google's in-app review rule)");
ok(read("android/app/build.gradle").includes("com.google.android.play:review") && read("android/app/src/main/java/com/homefitnesscoach/app/ApexNativePlugin.java").includes("public void requestReview("), "Android has the Play review library and the method");
ok(/match \/feedback\/\{id\}\s*\{\s*allow read, write: if false;/.test(read("firestore.rules")), "rules: feedback is server-only");

console.log(bad ? `\n${bad} check(s) failed.` : "All rating-prompt checks passed.");
process.exit(bad ? 1 : 0);
