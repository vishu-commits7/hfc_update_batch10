#!/usr/bin/env node
/**
 * Builds `src/features/exercises/exercisePhotos.generated.ts` from whatever is sitting in
 * `src/assets/exercises/`.
 *
 * Supports .jpg, .jpeg, .webp, .png
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "src/assets/exercises");
const OUT = join(ROOT, "src/features/exercises/exercisePhotos.generated.ts");

/** Named stages, in the order the movement actually happens. */
const STAGE_ORDER = ["stand", "squat", "plank", "cow", "cat"];

/**
 * Sets whose signature is not the last frame.
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
 */
const MOTION_TO_SLUG = {
  "bent-row": "bentrow",
  "bicep-curl": "bicepcurl",
  "bird-dog": "birddog",
  "calf-raise": "calf",
  "cat-cow": "catcow",
  "childs-pose": "childspose",
  "cobra": "cobrastretch",
  "crunch": "crunches",
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
  "single-leg-deadlift": "singleleg",
  "single-leg": "singleleg",
  "deadlift": "singleleg",
  "situp": "situps",
  "skater": "skaterhop",
  "skater-hop": "skaterhop",
  "skater-hops": "skaterhop",
  "skaterhop": "skaterhop",
  "spinal-twist": "spinaltwist",
  "step-up": "stepup",
  "sumo-squat": "sumosquat",
  "wall-sit": "wallsit",
  "world-greatest-stretch": "worldsgreatest",
};

/* ------------------------------------------------------------------ */

function parse(file) {
  const base = file.replace(/\.(jpg|jpeg|webp|png)$/i, "");
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
  return i === -1 ? 999 : i;
}

const files = readdirSync(ASSETS).filter((f) => /\.(jpg|jpeg|webp|png)$/i.test(f));
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

  // Deduplicate if both .jpg and .webp exist for the same frame
  const existingIndex = byVariant.get(key).findIndex((x) => x.frame === p.frame);
  if (existingIndex >= 0) {
    if (/\.jpg$/i.test(p.file)) {
      byVariant.get(key)[existingIndex] = p;
    }
  } else {
    byVariant.get(key).push(p);
  }
}

/* ---- emit ---- */

const imports = [];
const ident = new Map();
let n = 0;
const identFor = (file) => {
  if (!ident.has(file)) {
    const name = `p${n++}`;
    ident.set(file, name);
    imports.push(`import ${name} from "../../assets/exercises/${file}";`);
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
export const MOTION_TO_SLUG: Record<string, string> = {
${Object.entries(MOTION_TO_SLUG)
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join("\n")}
};

/** The photo set for a resolved motion id, or null if none was shot. */
export function photoSetForMotion(motionId: string): PhotoSet | null {
  if (!motionId) return null;
  const slug = MOTION_TO_SLUG[motionId] ?? motionId;
  if (PHOTO_SETS[slug]) return PHOTO_SETS[slug];

  // Also check without hyphens
  const compact = slug.replace(/[^a-z0-9]/g, "");
  if (PHOTO_SETS[compact]) return PHOTO_SETS[compact];

  return null;
}
`;

writeFileSync(OUT, out);
console.log(
  `photo manifest: ${files.length} files · ${sets.size} exercises · ${variantCount} variants → src/features/exercises/exercisePhotos.generated.ts`,
);
