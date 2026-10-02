#!/usr/bin/env node
/**
 * Builds `src/lib/exercisePhotos.generated.ts` from whatever is sitting in
 * `src/assets/exercises/`.
 *
 * WHY THIS EXISTS
 *
 * The demo photography is the one part of this app that cannot be written
 * in code — it has to be shot. So the job of this script is to make
 * *adding* photography a drag-and-drop operation: drop files into the
 * folder, run `npm run photos`, and the app picks them up. No hand-edited
 * import list, no manifest to keep in sync, no component to touch.
 *
 * FILENAME CONTRACT
 *
 *     <exercise>-<tone>-<frame>.jpg            → male (the existing set)
 *     <exercise>-<gender>-<tone>-<frame>.jpg   → explicit gender
 *
 *   exercise  a slug: pushup, squat, jacks, catcow
 *   gender    male | female        (omitted means male)
 *   tone      black | white
 *   frame     1, 2, 3 …            in movement order, top → bottom
 *             or a named stage     (stand, squat, plank / cow, cat)
 *
 *   pushup-white-2.jpg            → pushup · male · white · frame 2
 *   pushup-female-white-2.jpg     → pushup · female · white · frame 2
 *
 * A set with one frame is treated as an isometric hold and breathes
 * instead of pretending to have a rep cycle.
 *
 * THE SIGNATURE FRAME
 *
 * Every set names one frame as its signature — the single image that
 * identifies the movement at a glance (jacks: legs spread, arms overhead).
 * Lists and grids show that frame and nothing else; only a demo the user
 * has opened actually loops. The default is the LAST frame, because these
 * bursts are shot top → bottom and the bottom is the recognisable end of
 * the range. `SIGNATURE_OVERRIDE` below fixes the ones where that is
 * wrong.
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "src/assets/exercises");
const OUT = join(ROOT, "src/lib/exercisePhotos.generated.ts");

/** Named stages, in the order the movement actually happens. */
const STAGE_ORDER = ["stand", "squat", "plank", "cow", "cat"];

/**
 * Sets whose signature is not the last frame.
 *
 * A burpee's last frame is the plank, but the frame that says "burpee" is
 * the stand. Cat-cow is a two-ended stretch with no peak, so it takes the
 * arched end.
 */
const SIGNATURE_OVERRIDE = {
  burpee: 0,
  catcow: 1,
};

const TONES = ["black", "white"];
const GENDERS = ["male", "female"];

/**
 * Motion id (src/anim/library.ts) → photo slug, wherever the two spell the
 * same movement differently.
 *
 * This is what lets the photo layer reuse the movement resolver instead of
 * shipping a second one. `resolveMotion("Wide Push-ups")` already returns
 * `pushup`; the app looks that id up here, finds the `pushup` photographs,
 * and shows them. Every AI-invented name the resolver can place therefore
 * gets photography for free, and anything it cannot place falls through to
 * the drawn figure.
 *
 * Only ids that differ need an entry — an id equal to its slug resolves
 * directly.
 */
const MOTION_TO_SLUG = {
  "bent-row": "bentrow",
  "bicep-curl": "bicepcurl",
  "bird-dog": "birddog",
  "calf-raise": "calf",
  "cat-cow": "catcow",
  "childs-pose": "childspose",
  cobra: "cobrastretch",
  crunch: "crunches",
  "diamond-pushup": "diamondpushup",
  "donkey-kick": "donkeykick",
  "glute-bridge": "bridge",
  "incline-pushup": "incline",
  "jump-squat": "jumpsquat",
  "jumping-jack": "jacks",
  "lateral-raise": "lateralraise",
  "leg-raise": "legraises",
  "mountain-climber": "mountain",
  "pike-pushup": "pikepushup",
  "russian-twist": "russiantwist",
  "seated-fold": "seatedfold",
  "shoulder-taps": "shouldertaps",
  "side-plank": "sideplank",
  situp: "situps",
  "spinal-twist": "spinaltwist",
  "step-up": "stepup",
  "sumo-squat": "sumosquat",
  "wall-sit": "wallsit",
  "world-greatest-stretch": "worldsgreatest",
};

/* ------------------------------------------------------------------ */

function parse(file) {
  const base = file.replace(/\.jpg$/i, "");
  const parts = base.split("-");
  if (parts.length < 3) return null;

  const frame = parts[parts.length - 1];
  const tone = parts[parts.length - 2];
  if (!TONES.includes(tone)) return null;

  const maybeGender = parts[parts.length - 3];
  const hasGender = GENDERS.includes(maybeGender);
  const gender = hasGender ? maybeGender : "male";
  const exercise = parts.slice(0, parts.length - (hasGender ? 3 : 2)).join("-");
  if (!exercise) return null;

  return { exercise, gender, tone, frame, file };
}

function frameRank(frame) {
  const n = Number(frame);
  if (Number.isFinite(n)) return n;
  const i = STAGE_ORDER.indexOf(frame);
  // Named stages sort after numbers only if unknown, so an unrecognised
  // stage name is loud in the output rather than silently first.
  return i === -1 ? 999 : i;
}

const files = readdirSync(ASSETS).filter((f) => /\.jpg$/i.test(f));
const sets = new Map();

for (const file of files) {
  const p = parse(file);
  if (!p) {
    console.warn(`  skipped (name does not match the contract): ${file}`);
    continue;
  }
  if (!sets.has(p.exercise)) sets.set(p.exercise, new Map());
  const byVariant = sets.get(p.exercise);
  const key = `${p.gender}:${p.tone}`;
  if (!byVariant.has(key)) byVariant.set(key, []);
  byVariant.get(key).push(p);
}

/* ---- emit ---- */

const imports = [];
const ident = new Map();
let n = 0;
const identFor = (file) => {
  if (!ident.has(file)) {
    const name = `p${n++}`;
    ident.set(file, name);
    imports.push(`import ${name} from "../assets/exercises/${file}";`);
  }
  return ident.get(file);
};

const entries = [];
let variantCount = 0;

for (const [exercise, byVariant] of [...sets].sort()) {
  const variants = [];
  let frameCount = 0;

  for (const gender of GENDERS) {
    for (const tone of TONES) {
      const list = byVariant.get(`${gender}:${tone}`);
      if (!list || list.length === 0) continue;
      list.sort((a, b) => frameRank(a.frame) - frameRank(b.frame));
      frameCount = Math.max(frameCount, list.length);
      variantCount++;
      variants.push(
        `    "${gender}:${tone}": [${list.map((f) => identFor(f.file)).join(", ")}],`,
      );
    }
  }
  if (variants.length === 0) continue;

  const signature =
    SIGNATURE_OVERRIDE[exercise] ?? Math.max(0, frameCount - 1);

  entries.push(
    `  "${exercise}": {\n` +
      `    signature: ${signature},\n` +
      `    isHold: ${frameCount <= 1},\n` +
      `    frames: {\n${variants.map((v) => "  " + v).join("\n")}\n    },\n` +
      `  },`,
  );
}

const out = `/* GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Rebuild with \`npm run photos\` after adding or removing files in
 * src/assets/exercises/. See tools/photo-manifest.mjs for the filename
 * contract and how the signature frame is chosen.
 *
 * ${files.length} photographs · ${sets.size} exercises · ${variantCount} gender/tone variants
 */
${imports.join("\n")}

export type DemoGender = "male" | "female";
export type DemoTone = "black" | "white";
export type VariantKey = \`\${DemoGender}:\${DemoTone}\`;

export interface PhotoSet {
  /** Index of the frame that identifies the movement at a glance. */
  signature: number;
  /** Single-frame sets breathe rather than faking a rep cycle. */
  isHold: boolean;
  /** Only the variants that actually have photography are present. */
  frames: Partial<Record<VariantKey, string[]>>;
}

export const PHOTO_SETS: Record<string, PhotoSet> = {
${entries.join("\n")}
};

/** Motion id → photo slug, for the ids the two spell differently. */
const MOTION_TO_SLUG: Record<string, string> = {
${Object.entries(MOTION_TO_SLUG)
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join("\n")}
};

/** The photo set for a resolved motion id, or null if none was shot. */
export function photoSetForMotion(motionId: string): PhotoSet | null {
  return PHOTO_SETS[MOTION_TO_SLUG[motionId] ?? motionId] ?? null;
}
`;

writeFileSync(OUT, out);
console.log(
  `photo manifest: ${files.length} files · ${sets.size} exercises · ${variantCount} variants → src/lib/exercisePhotos.generated.ts`,
);

const missing = [...sets]
  .filter(([, v]) => ![...v.keys()].some((k) => k.startsWith("female:")))
  .map(([k]) => k);
if (missing.length) {
  console.log(
    `\n  no female photography yet for ${missing.length} exercise(s):\n  ${missing.join(", ")}`,
  );
}
