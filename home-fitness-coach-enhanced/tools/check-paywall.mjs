#!/usr/bin/env node
/** npm run paywall:check — paywall rules: 3 workouts first, yearly leads, trial wording, saving maths. Installs nothing. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(root, "node_modules/typescript"));
const read = p => fs.readFileSync(path.join(root, p), "utf8");
let bad = 0;
const ok = (x, m) => { if (!x) { bad++; console.log("FAIL " + m); } };

// the pure helpers sit between two markers in billing.ts; run just that part (the rest needs a phone)
const src = read("src/lib/billing.ts");
const a = src.indexOf("export const PAYWALL_MIN_WORKOUTS"), b = src.indexOf("interface BillingPlugin");
const js = ts.transpileModule("interface Offer { offerToken: string; basePlanId: string; price: string; period: string; priceMicros?: number; currency?: string; trial?: string }\n" + src.slice(a, b), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = { exports: {} }; new Function("exports", "module", js)(m.exports, m);
const { PAYWALL_MIN_WORKOUTS, paywallUnlocked, trialLabel, arrangeOffers, yearlySaving, perMonth } = m.exports;

ok(PAYWALL_MIN_WORKOUTS === 3 && !paywallUnlocked(0) && !paywallUnlocked(2) && paywallUnlocked(3) && paywallUnlocked(40), "paywall unlocks at 3 finished workouts");
ok(trialLabel("P7D") === "7-day" && trialLabel("P1W") === "7-day" && trialLabel("P2W") === "14-day" && trialLabel("P1M") === "1-month" && trialLabel("") === "" && trialLabel(undefined) === "" && trialLabel("junk") === "", "trial wording");
const M = { offerToken: "m", basePlanId: "monthly", price: "₹199.00", period: "P1M", priceMicros: 199_000_000, currency: "INR", trial: "" };
const Y = { offerToken: "y", basePlanId: "yearly", price: "₹1,499.00", period: "P1Y", priceMicros: 1_499_000_000, currency: "INR", trial: "" };
const YT = { ...Y, offerToken: "yt", trial: "P7D" };
ok(arrangeOffers([M, Y]).map(o => o.offerToken).join() === "y,m", "yearly comes first");
ok(arrangeOffers([M, Y, YT]).map(o => o.offerToken).join() === "yt,m", "when a plan has a trial offer and a plain one, the trial offer is shown, once");
ok(arrangeOffers([{ ...M, offerToken: "m2", priceMicros: 149_000_000 }, M]).map(o => o.offerToken).join() === "m2", "otherwise the cheaper offer for a period wins");
ok(yearlySaving([M, Y]) === 37, `yearly saving is worked out from Play's own prices (got ${yearlySaving([M, Y])}%)`);
ok(yearlySaving([M]) === 0 && yearlySaving([M, { ...Y, currency: "USD" }]) === 0 && yearlySaving([M, { ...Y, priceMicros: 3_000_000_000 }]) === 0 && yearlySaving([{ ...M, priceMicros: undefined }, Y]) === 0, "no saving claim when it cannot be proved");
ok(/125/.test(perMonth(Y)) && perMonth(M) === "" && perMonth({ ...Y, priceMicros: undefined }) === "", "per-month price for the yearly plan, in the user's currency");

const sheet = read("src/components/PaywallSheet.tsx");
ok(sheet.includes("Restore purchases") && sheet.includes("min-h-[48px]"), "Restore purchases is a real button");
ok(sheet.includes("free trial, then ") && sheet.includes("Cancel in Google Play before the trial ends"), "the trial line says what happens after the trial and how to avoid a charge");
ok(sheet.includes("Renews automatically until cancelled") && sheet.includes("Manage subscription in Google Play"), "renewal and cancellation are stated");
ok(/Arena, leagues, crews, friends and the daily challenge are free/.test(sheet), "the paywall says Arena and social are free");
ok(!/[₹$€£]\s?\d/.test(sheet), "no price is written into the app; every price comes from Google Play");
const app = read("src/App.tsx");
ok(app.includes("if (paywallUnlocked(logs.length)) setPaywallOpen(true);") && (app.match(/setPaywallOpen\(true\)/g) || []).length === 1, "every way into the paywall goes through the 3-workout check");
ok(app.includes('currentView === "ai-generator" && !isPremium && paywallUnlocked(logs.length)'), "the AI generator is not locked before the paywall can be shown");
// Arena and social never ask the server whether the user is Pro
for (const f of ["functions/src/index.ts", "functions/src/arena2.ts", "functions/src/ghosts.ts", "functions/src/daily.ts", "functions/src/leagues.ts", "functions/src/crews.ts", "functions/src/challenges.ts", "functions/src/invites.ts"]) ok(!/isPro\(/.test(read(f)), `${f} must not check Pro (Arena and social stay free)`);
ok(read("android/app/src/main/java/com/homefitnesscoach/app/ApexBillingPlugin.java").includes('.put("trial", trial)'), "Android passes the trial period to the paywall");

console.log(bad ? `\n${bad} check(s) failed.` : "All paywall checks passed.");
process.exit(bad ? 1 : 0);
