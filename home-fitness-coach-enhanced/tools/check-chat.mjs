#!/usr/bin/env node
/**
 * npm run chat:check
 * Direct messages and the reel camera: the pieces that broke on a real phone, tested without one.
 *  - the live listener comes back after an error (a dead listener is why sent messages never showed)
 *  - the rules let both people read a chat before its first message, and allow the first message itself
 *  - a refused message is reported, not swallowed
 *  - the reel camera records at a quality that still fits the upload limit, and explains every way it can fail
 * It cannot run the real Firestore rules (that needs the emulator) or a real camera.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Module, { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(root, "node_modules/typescript"));
const out = fs.mkdtempSync(path.join(os.tmpdir(), "chat-check-"));
const realLoad = Module._load;
Module._load = function (req, ...rest) { return req === "react" ? { useState() {}, useRef() {}, useEffect() {}, useCallback(f) { return f; } } : realLoad.call(this, req, ...rest); };
const load = (rel, name) => { fs.writeFileSync(path.join(out, name), ts.transpileModule(fs.readFileSync(path.join(root, rel), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText); return require(path.join(out, name)); };
const { liveListen } = load("src/core/liveListen.ts", "live.js");
const cam = load("src/features/reels/useReelCamera.ts", "cam.js");
Module._load = realLoad;
fs.rmSync(out, { recursive: true, force: true });

let bad = 0;
const ok = (x, m) => { if (!x) { bad++; console.log("FAIL " + m); } };
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

/* ---- the listener comes back ---- */
{
  const timers = [];
  let opened = 0, stopped = 0, firstErrors = 0, fail = null;
  const stop = liveListen(onErr => { opened++; fail = onErr; return () => { stopped++; }; }, () => { firstErrors++; },
    (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, () => {});
  ok(opened === 1, "listens straight away");
  fail(new Error("permission-denied"));
  ok(stopped === 1 && firstErrors === 1 && timers.length === 1 && timers[0].ms === 1000, "after an error it stops that listener and tries again in 1 s");
  timers.shift().fn();
  ok(opened === 2, "and really listens again");
  fail(new Error("again"));
  ok(firstErrors === 1 && timers[0].ms === 2000, "waits longer each time, and reports only the first failure");
  for (let i = 0; i < 8; i++) { timers.shift().fn(); fail(new Error("x")); }
  ok(timers[0].ms === 30000, "never waits more than 30 s");
  timers.shift().fn();
  stop();
  ok(stopped === opened, "stopping it closes the open listener");
  const before = opened; fail(new Error("late")); ok(timers.length === 0 && opened === before, "nothing restarts after it was stopped");
}

/* ---- rules ---- */
const rules = read("firestore.rules");
const chats = rules.slice(rules.indexOf("match /chats/{chatId}"), rules.indexOf("match /reelComments"));
ok(/allow get: if signedIn\(\) && request\.auth\.uid in chatId\.split\('_'\);/.test(chats), "either person can open a chat before it exists (read by chat id)");
ok(/allow list: if signedIn\(\) && request\.auth\.uid in resource\.data\.members;/.test(chats), "the chat list query is still limited to your own chats");
ok(/match \/messages\/\{mid\} \{\s*allow read: if signedIn\(\) && request\.auth\.uid in chatId\.split\('_'\);/.test(chats), "messages can be read by the two people in the chat, even before the first one");
ok(chats.includes("chatId == request.resource.data.members[0] + '_' + request.resource.data.members[1]") && chats.includes("request.resource.data.members == resource.data.members"),
  "the chat id always matches its members and members can never change (this is what makes reading by id safe)");
ok(chats.includes("otherMemberAfter(chatId)") && /function otherMemberAfter[\s\S]{0,400}getAfter\(/.test(rules) && !/function otherMember\(/.test(rules),
  "the block check works for the very first message (it reads the chat as it will be after the write)");
ok(/request\.resource\.data\.from == request\.auth\.uid/.test(chats) && chats.includes("accepted("), "you can only send as yourself, and only to someone with an accepted follow either way");

/* ---- the app ---- */
const social = read("src/features/social/social.ts");
for (const fn of ["subscribeMessages", "subscribeChatReceipts", "subscribeChats"]) {
  const body = social.slice(social.indexOf(`export function ${fn}`), social.indexOf("\n}\n", social.indexOf(`export function ${fn}`)));
  ok(body.includes("liveListen("), `${fn} comes back after an error`);
}
const send = social.slice(social.indexOf("export async function sendMessage"), social.indexOf("\n}\n", social.indexOf("export async function sendMessage")));
ok(send.includes("await batch.commit()") && !/commit\(\)\.catch\(\(\) => \{\}\)/.test(send), "a refused message reaches the caller instead of vanishing");
const hub = read("src/features/social/FriendsAndChatHub.tsx");
ok(/sendMessage\(myUid, otherUid, v\)\s*\.catch\(/.test(hub) && hub.includes("setText(t => (t ? t : v))"), "the chat screen shows why a message failed and puts the text back");
ok(!/disabled=\{!text\.trim\(\) \|\| sending\}/.test(hub), "the send button does not lock while waiting for the server");

/* ---- reel camera ---- */
ok(cam.REEL_MAX_SECONDS === 60, "reels are up to 60 s");
const bytes60 = ((cam.REEL_VIDEO_BPS + cam.REEL_AUDIO_BPS) * 60) / 8;
ok(bytes60 < 25 * 1024 * 1024 * 0.95, `a full 60 s reel fits the 25 MB limit (${(bytes60 / 1048576).toFixed(1)} MB)`);
ok(cam.REEL_VIDEO_BPS >= 2_000_000, "recording quality is at least 2 Mbit/s (it was 0.9)");
globalThis.MediaRecorder = { isTypeSupported: m => ["video/webm;codecs=vp8,opus", "video/mp4"].includes(m) };
ok(cam.pickRecorderMime() === "video/mp4", "prefers MP4 (hardware H.264) when the phone has it");
globalThis.MediaRecorder = { isTypeSupported: m => m === "video/webm;codecs=vp8,opus" };
ok(cam.pickRecorderMime() === "video/webm;codecs=vp8,opus", "falls back to VP8 (light on the phone), not VP9");
globalThis.MediaRecorder = { isTypeSupported: () => false };
ok(cam.pickRecorderMime() === "", "no supported type: lets the phone choose");
delete globalThis.MediaRecorder;
for (const [name, word] of [["NotAllowedError", "Settings"], ["NotReadableError", "busy"], ["NotFoundError", "No camera"], ["Weird", "try again"]]) {
  ok(cam.cameraErrorText({ name }).includes(word), `explains ${name} in plain words`);
}
const studio = read("src/features/reels/ReelCreatorStudio.tsx");
ok(studio.includes("ref={cam.attach}") && !studio.includes("liveVideoPreviewRef"), "the viewfinder gets the camera picture when it appears (the old code attached it too early: black screen)");
ok(studio.includes("shrinkVideo(") && studio.includes("MAX_REEL_BYTES"), "a clip over the limit is made smaller instead of refused");
ok(studio.includes("<OverlayPortal>"), "the studio is drawn above the bottom bar");
const hook = read("src/features/reels/useReelCamera.ts");
ok(hook.includes("visibilitychange") && hook.includes("seq.current"), "the camera is released in the background and an old open request cannot leave a stream running");

console.log(bad ? `\n${bad} check(s) failed.` : "All chat and reel camera checks passed.");
process.exit(bad ? 1 : 0);
