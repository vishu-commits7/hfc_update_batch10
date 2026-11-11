#!/usr/bin/env node
/**
 * npm run moderation:check
 * Runs the real moderation Cloud Functions (functions/src/moderation.ts) against an in-memory database:
 * report a post, a reel, a comment, a post comment, a user and a match; block a user; hide after 3 reports;
 * remove content as admin; ban; and check the owner gets a clear message. Firebase itself is replaced by a
 * small fake, so this proves the logic, not the deployed rules. Installs nothing.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Module, { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(root, "node_modules/typescript"));

/* ---------- a tiny in-memory Firestore ---------- */
const store = new Map(); // path -> data
const deletedFiles = [], disabledUsers = [];
let auto = 0;
const TS = ms => ({ __ts: ms, toMillis: () => ms });
const val = v => (v && typeof v === "object" && "__ts" in v ? v.__ts : v);
const resolve = d => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v && v.__server ? TS(Date.now()) : v]));
const snapOf = (p) => ({ id: p.split("/").pop(), exists: store.has(p), ref: docRef(p), data: () => (store.has(p) ? { ...store.get(p) } : undefined) });
function docRef(p) {
  return {
    path: p, id: p.split("/").pop(),
    get: async () => snapOf(p),
    set: async (d, o) => { store.set(p, o?.merge ? { ...(store.get(p) ?? {}), ...resolve(d) } : resolve(d)); },
    update: async d => { if (!store.has(p)) throw new Error("not-found " + p); store.set(p, { ...store.get(p), ...resolve(d) }); },
    delete: async () => { store.delete(p); },
  };
}
function colRef(p, filters = [], lim = 1e9) {
  const run = () => [...store.keys()].filter(k => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/"))
    .filter(k => filters.every(([f, op, v]) => { const x = val(store.get(k)[f]); return op === "==" ? x === val(v) : op === ">" ? x > val(v) : false; })).slice(0, lim);
  return {
    where: (f, op, v) => colRef(p, [...filters, [f, op, v]], lim),
    orderBy: () => colRef(p, filters, lim),
    limit: n => colRef(p, filters, n),
    count: () => ({ get: async () => ({ data: () => ({ count: run().length }) }) }),
    get: async () => { const docs = run().map(snapOf); return { docs, empty: !docs.length, size: docs.length }; },
    add: async d => { const id = "auto" + ++auto; store.set(`${p}/${id}`, resolve(d)); return docRef(`${p}/${id}`); },
  };
}
const fakeDb = {
  doc: docRef, collection: p => colRef(p),
  recursiveDelete: async ref => { for (const k of [...store.keys()]) if (k === ref.path || k.startsWith(ref.path + "/")) store.delete(k); },
  getAll: async (...refs) => refs.map(r => snapOf(r.path)),
};
class HttpsError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const triggers = {};
const fakes = {
  "./init": {},
  "./anticheat": { clearFlag: async () => {}, noteCheatReport: async (t, r) => { store.set(`cheatFlags/${t}`, { reporters: [...(store.get(`cheatFlags/${t}`)?.reporters ?? []), r] }); } },
  "firebase-admin/firestore": { getFirestore: () => fakeDb, FieldValue: { serverTimestamp: () => ({ __server: true }) }, Timestamp: { fromMillis: TS } },
  "firebase-admin/auth": { getAuth: () => ({ updateUser: async (uid, d) => { if (d.disabled) disabledUsers.push(uid); } }) },
  "firebase-admin/storage": { getStorage: () => ({ bucket: () => ({ file: f => ({ delete: async () => { deletedFiles.push(f); } }) }) }) },
  "firebase-functions/v2/https": { onCall: fn => fn, HttpsError },
  "firebase-functions/v2/firestore": { onDocumentCreated: (pattern, fn) => { triggers[pattern] = fn; return fn; } },
};
const realLoad = Module._load;
Module._load = function (request, ...rest) { return request in fakes ? fakes[request] : realLoad.call(this, request, ...rest); };
process.env.ADMIN_EMAILS = "mod@example.com";
const out = fs.mkdtempSync(path.join(os.tmpdir(), "moderation-check-"));
fs.writeFileSync(path.join(out, "moderation.js"), ts.transpileModule(fs.readFileSync(path.join(root, "functions/src/moderation.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const mod = require(path.join(out, "moderation.js"));
fs.rmSync(out, { recursive: true, force: true });

let bad = 0;
const ok = (x, m) => { if (!x) { bad++; console.log("FAIL " + m); } else if (process.argv.includes("-v")) console.log("ok   " + m); };
const as = (uid, data, email) => ({ auth: uid ? { uid, token: { email: email ?? `${uid}@example.com`, email_verified: true } } : undefined, data });
const fails = async (p, code) => { try { await p; return false; } catch (e) { return e.code === code; } };
// run the "report created" trigger the way Firestore would
const report = async (uid, data) => { const before = new Set(store.keys()); const r = await mod.reportContent(as(uid, data)); for (const k of store.keys()) if (k.startsWith("reports/") && !before.has(k)) await mod.onReportCreated({ data: { data: () => store.get(k) } }); return r; };
const notices = uid => [...store.entries()].filter(([k]) => k.startsWith(`notifs/${uid}/items/`)).map(([, v]) => v);
const openReports = () => [...store.entries()].filter(([k, v]) => k.startsWith("reports/") && v.status === "open");

/* ---------- the world ---------- */
store.set("users/alice", { displayName: "Alice" });
store.set("users/bob", { displayName: "Bob" });
store.set("posts/p1", { uid: "bob", caption: "spam", storagePath: "posts/bob/p1.jpg" });
store.set("posts/p1/comments/c1", { uid: "bob", text: "rude" });
store.set("publicReels/r1", { ownerUid: "bob" });
store.set("publicReels/r1/chunks/0", { x: 1 });
store.set("reelComments/r1/items/rc1", { uid: "bob", text: "rude" });
store.set("rooms/ROOM22", { hostUid: "alice", guestUid: "bob" });
store.set("follows/alice_bob", { status: "accepted" });
store.set("follows/bob_alice", { status: "accepted" });

/* ---------- reporting ---------- */
ok(await fails(mod.reportContent(as(null, { type: "post", targetId: "p1", reason: "spam" })), "unauthenticated"), "signed-out users cannot report");
ok(await fails(mod.reportContent(as("alice", { type: "banana", targetId: "p1", reason: "spam" })), "invalid-argument"), "unknown report type is refused");
ok(await fails(mod.reportContent(as("alice", { type: "post", targetId: "p1", reason: "because" })), "invalid-argument"), "unknown reason is refused");
ok((await report("alice", { type: "post", targetId: "p1", ownerUid: "bob", reason: "spam" })).ok, "report a post");
ok((await report("alice", { type: "post", targetId: "p1", ownerUid: "bob", reason: "spam" })).duplicate === true, "the same report twice is counted once");
ok((await report("alice", { type: "reel", targetId: "r1", ownerUid: "bob", reason: "nudity" })).ok, "report a reel");
ok((await report("alice", { type: "comment", targetId: "r1/rc1", ownerUid: "bob", reason: "harassment" })).ok, "report a reel comment");
ok((await report("alice", { type: "postComment", targetId: "p1/c1", ownerUid: "bob", reason: "harassment" })).ok, "report a post comment");
ok((await report("alice", { type: "user", targetId: "bob", ownerUid: "bob", reason: "hate" })).ok, "report a user");
ok((await report("alice", { type: "match", targetId: "ROOM22", ownerUid: "someone-else", reason: "cheating" })).ok, "report a match");
ok(store.get("reports/alice_match_ROOM22").ownerUid === "bob", "match report: the other player comes from the room, not from the app");
ok(store.get("cheatFlags/bob")?.reporters.includes("alice"), "a cheating report is added to the player's anti-cheat record");
ok(await fails(mod.reportContent(as("carol", { type: "match", targetId: "ROOM22", reason: "cheating" })), "permission-denied"), "you cannot report a match you did not play");
ok(openReports().length === 6, "six open reports are waiting");

/* ---------- auto-hide after 3 different reporters ---------- */
ok(!store.get("posts/p1").hidden && !store.get("publicReels/r1").hidden, "one report hides nothing");
for (const u of ["carol", "dave"]) { await report(u, { type: "post", targetId: "p1", ownerUid: "bob", reason: "spam" }); await report(u, { type: "reel", targetId: "r1", ownerUid: "bob", reason: "nudity" }); }
ok(store.get("posts/p1").hidden === true, "3 reports hide the post");
ok(store.get("publicReels/r1").hidden === true, "3 reports hide the reel");

/* ---------- daily limit ---------- */
for (let i = 0; i < 25; i++) await mod.reportContent(as("erin", { type: "user", targetId: "u" + i, reason: "spam" })).catch(() => {});
ok([...store.keys()].filter(k => k.startsWith("reports/erin_")).length === 20, "20 reports a day per person, no more");

/* ---------- blocking ---------- */
store.set("users/alice/blocks/bob", { at: 1 }); // the app writes this (allowed by the rules for your own blocks)
await triggers["users/{me}/blocks/{target}"]({ params: { me: "alice", target: "bob" } });
ok(!store.has("follows/alice_bob") && !store.has("follows/bob_alice"), "blocking removes the follow in both directions");

/* ---------- moderators only ---------- */
ok((await mod.modIsAdmin(as("mod", {}, "mod@example.com"))).admin === true && (await mod.modIsAdmin(as("alice", {}))).admin === false, "only ADMIN_EMAILS are moderators");
ok(await fails(mod.modListReports(as("alice", {})), "permission-denied"), "a normal user cannot open the queue");
ok(await fails(mod.modResolveReport(as("alice", { id: "alice_post_p1", action: "remove" })), "permission-denied"), "a normal user cannot remove content");
ok(await fails(mod.modListFlagged(as("alice", {})), "permission-denied"), "a normal user cannot see flagged accounts");
const admin = d => as("mod", d, "mod@example.com");
ok((await mod.modListReports(admin({}))).reports.some(r => r.id === "alice_post_p1"), "the moderator sees the post report");

/* ---------- remove as admin + message to the owner ---------- */
await mod.modResolveReport(admin({ id: "alice_post_p1", action: "remove" }));
ok(!store.has("posts/p1") && !store.has("posts/p1/comments/c1"), "removing a post deletes it and its comments");
ok(deletedFiles.includes("posts/bob/p1.jpg"), "and its photo file");
ok(openReports().every(([, v]) => !(v.type === "post" && v.targetId === "p1")), "other reports about the same post are closed too");
ok(notices("bob").some(n => n.type === "moderation" && /Your post was removed for spam or scam/.test(n.text)), "the owner is told the post was removed, and why");
await mod.modResolveReport(admin({ id: "alice_reel_r1", action: "remove" }));
ok(!store.has("publicReels/r1") && !store.has("publicReels/r1/chunks/0"), "removing a reel deletes it and its parts");
ok(notices("bob").some(n => /Your reel was removed for nudity/.test(n.text)), "the owner is told the reel was removed");
await mod.modResolveReport(admin({ id: "alice_comment_r1-rc1", action: "remove" }));
ok(!store.has("reelComments/r1/items/rc1"), "removing a reel comment deletes it");
store.set("posts/p2", { uid: "bob" }); store.set("posts/p2/comments/c9", { uid: "bob", text: "x" });
await report("alice", { type: "postComment", targetId: "p2/c9", ownerUid: "bob", reason: "hate" });
await mod.modResolveReport(admin({ id: "alice_postComment_p2-c9", action: "remove" }));
ok(!store.has("posts/p2/comments/c9") && store.has("posts/p2"), "removing a post comment leaves the post");
ok(notices("bob").some(n => /Your comment was removed for hate speech/.test(n.text)), "the owner is told the comment was removed");
ok(await fails(mod.modResolveReport(admin({ id: "alice_user_bob", action: "remove" })), "failed-precondition"), "there is nothing to 'remove' on a user report");
ok(await fails(mod.modResolveReport(admin({ id: "nope", action: "dismiss" })), "not-found"), "unknown report id");

/* ---------- dismiss and ban ---------- */
await mod.modResolveReport(admin({ id: "alice_match_ROOM22", action: "dismiss" }));
ok(store.get("reports/alice_match_ROOM22").status === "dismissed", "a report can be dismissed");
await mod.modResolveReport(admin({ id: "alice_user_bob", action: "ban" }));
ok(store.get("users/bob").banned === true && disabledUsers.includes("bob"), "ban marks the profile and disables the sign-in");
ok(notices("bob").some(n => /account has been disabled/.test(n.text)), "the banned user gets a message");
ok(notices("alice").length === 0, "the reporter's identity is never sent to anyone");

/* ---------- the app side is wired ---------- */
const read = p => fs.readFileSync(path.join(root, p), "utf8");
ok(read("src/features/safety/ContentPolicy.tsx").includes('where("type", "==", "moderation")') && read("src/app/App.tsx").includes("<ModerationGate"), "the app shows moderation messages and the disabled-account screen");
ok(read("src/features/account/SettingsPage.tsx").includes("ContentPolicySheet") && read("src/features/account/AuthScreen.tsx").includes("ContentPolicySheet"), "content policy is linked from Settings and from sign-up");
ok(read("src/features/social/CommunityGallery.tsx").includes('type: "post"') && read("src/features/social/CommunityGallery.tsx").includes('type: "postComment"'), "posts and post comments have a report button");
ok(read("src/core/useAuth.ts").includes('"auth/user-disabled"'), "a disabled account gets a clear sign-in message");
ok(/hasAny\(\['likedBy', 'likeCount', 'hidden'\]\)/.test(read("firestore.rules")), "rules: an author cannot un-hide their own reported post");

console.log(bad ? `\n${bad} check(s) failed.` : "All moderation checks passed.");
process.exit(bad ? 1 : 0);
