#!/usr/bin/env node
/** npm run demo:check — demo mode must be impossible in a normal build and must never reach the server. Installs nothing. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
let bad = 0;
const ok = (x, m) => { if (!x) { bad++; console.log("FAIL " + m); } };

const demo = read("src/lib/demo.ts");
ok(/if \(env\.VITE_DEMO_MODE === "1"\) return true;\s*if \(!env\.DEV\) return false;/.test(demo), "a release build without VITE_DEMO_MODE can never enter demo mode");
ok(/if \(DEMO\) return demoCall<T>\(name, data\);/.test(read("src/lib/functions.ts")), "every server call is replaced in demo mode");
ok(/if \(!h\) throw new Error\("Not available in demo mode\."\)/.test(demo), "calls with no sample answer are refused, not sent");
ok(!/firebase\//.test(demo.replace(/^import type.*$/gm, "")), "demo data does not import Firebase");
for (const [f, hook] of [["src/lib/useSocial.ts", "useMyIdentity"], ["src/lib/progress.ts", "useProgress"], ["src/lib/progress.ts", "useQuests"], ["src/lib/plan.ts", "useNextPlan"], ["src/lib/programs.ts", "useCurrentProgram"]]) {
  const src = read(f), at = src.indexOf(`export function ${hook}(`);
  ok(at >= 0 && /\n\s*(\/\/[^\n]*\n\s*)?return DEMO \?/.test(src.slice(at, at + 400)), `${hook} has a demo branch`);
}
for (const fn of ["subscribeRoom", "subscribeOpenRooms", "subscribeLiveRooms"]) ok(new RegExp(`export function ${fn}\\([^)]*\\)[^{]*\\{\\s*if \\(DEMO\\)`).test(read("src/lib/social.ts")), `${fn} has a demo branch`);
ok(read("src/App.tsx").includes("{!DEMO && !showOnboarding && !authLoading && !user"), "the sign-in screen stays out of the way in demo mode");
// the env files that get built must not have it on
for (const f of [".env", ".env.production", ".env.local"]) if (fs.existsSync(path.join(root, f))) ok(!/^\s*VITE_DEMO_MODE\s*=\s*1/m.test(read(f)), `${f} has VITE_DEMO_MODE=1: remove it before a store build`);
// sample names only
ok(!/@[a-z0-9.-]+\.[a-z]{2,}/i.test(demo), "no email addresses in the sample data");

console.log(bad ? `\n${bad} check(s) failed.` : "All demo-mode checks passed.");
process.exit(bad ? 1 : 0);
