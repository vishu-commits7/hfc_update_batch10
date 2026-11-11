#!/usr/bin/env node
/**
 * npm run arch:check
 * Keeps the code structure honest (see ARCHITECTURE.md):
 *  1. every relative import points at a real file, with the exact same upper/lower case
 *     (Windows forgives a wrong case; the Linux build server does not);
 *  2. the layers only point one way:  app -> features -> shared -> core.
 *     core (platform services) and shared (small building blocks) must never import a feature or the app shell,
 *     and a feature must never import the app shell. ("import type" is allowed: it adds no code.)
 * Rule 1 problems fail the check. Rule 2 problems fail it too, except the ones listed in KNOWN below,
 * which existed when the folders were introduced and are printed as a to-do list.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");
const SPEC = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|@import\s+)(["'])(\.{1,2}\/[^"'\n]*)\2/g;
const TRY = ["", ".ts", ".tsx", ".d.ts", "/index.ts", "/index.tsx"];

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "assets") walk(p); }
    else if (/\.(ts|tsx|css)$/.test(e.name)) files.push(p);
  }
})(src);

const listing = new Map();
const exactCase = (p) => {            // true when every part of the path is spelled exactly as on disk
  let cur = p;
  while (cur.length > root.length) {
    const dir = path.dirname(cur);
    if (!listing.has(dir)) listing.set(dir, new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []));
    if (!listing.get(dir).has(path.basename(cur))) return false;
    cur = dir;
  }
  return true;
};
const resolve = (from, spec) => {
  const base = path.normalize(path.join(path.dirname(from), spec));
  for (const t of TRY) { const p = base + t; if (fs.existsSync(p) && fs.statSync(p).isFile()) return p; }
  return null;
};
const layerOf = (p) => {
  const r = path.relative(src, p).split(path.sep);
  return ["app", "features", "shared", "core"].includes(r[0]) ? r[0] : "base"; // base = types, constants, data, anim, design, hooks, i18n, styles
};
const featureOf = (p) => { const r = path.relative(src, p).split(path.sep); return r[0] === "features" ? r[1] : null; };
const rank = { app: 3, features: 2, shared: 1, core: 0, base: -1 };

// Imports that pointed "upwards" when the folders were introduced. Shrink this list; never add to it.
const KNOWN = new Set(JSON.parse(fs.readFileSync(path.join(root, "tools", "arch-known.json"), "utf8")));

let broken = 0, fresh = 0;
const upward = [], cross = new Map();
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  for (const m of text.matchAll(SPEC)) {
    const target = resolve(f, m[3]);
    const rel = path.relative(root, f).replace(/\\/g, "/");
    if (!target) { broken++; console.log(`ERROR  ${rel}: "${m[3]}" does not exist`); continue; }
    if (!exactCase(target)) { broken++; console.log(`ERROR  ${rel}: "${m[3]}" has the wrong upper/lower case (breaks the Linux build)`); continue; }
    const a = layerOf(f), b = layerOf(target);
    // "import type" only borrows a shape for the type checker; it adds no code, so it is not a dependency
    const head = text.slice(Math.max(0, m.index - 400), m.index);
    const typeOnly = m[1].startsWith("from") && /^import\s+type\b/.test(head.slice(head.lastIndexOf("import")));
    if (!typeOnly && a !== "base" && b !== "base" && rank[b] > rank[a]) {
      const key = `${rel} -> ${path.relative(root, target).replace(/\\/g, "/")}`;
      upward.push(key);
      if (!KNOWN.has(key)) { fresh++; console.log(`ERROR  ${a} must not import ${b}: ${key}`); }
    }
    const fa = featureOf(f), fb = featureOf(target);
    if (fa && fb && fa !== fb) cross.set(`${fa} -> ${fb}`, (cross.get(`${fa} -> ${fb}`) || 0) + 1);
  }
}
if (process.argv.includes("--write-known")) {
  fs.writeFileSync(path.join(root, "tools", "arch-known.json"), JSON.stringify([...new Set(upward)].sort(), null, 1) + "\n");
  console.log(`wrote ${new Set(upward).size} known upward imports to tools/arch-known.json`);
  process.exit(0);
}
console.log(`${files.length} files checked. Broken imports: ${broken}. New layer violations: ${fresh}. Known (to clean up): ${new Set(upward).size}.`);
const pairs = [...cross.entries()].sort((x, y) => y[1] - x[1]);
if (pairs.length) console.log("Feature-to-feature imports (allowed, shown for awareness): " + pairs.slice(0, 14).map(([k, n]) => `${k} (${n})`).join(", "));
process.exit(broken || fresh ? 1 : 0);
