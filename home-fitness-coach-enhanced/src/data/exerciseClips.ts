import { EXERCISE_VIDEOS } from "../features/exercises/exerciseVideos";
import { READY_CLIPS } from "./exerciseClips.generated";

/**
 * Exercise demo clips: one id -> one short looping mp4 in Firebase Storage.
 *
 * THE FILE NAME CONTRACT
 *   Every clip is named exactly  <id>.mp4  (lower case, hyphens, no spaces),
 *   e.g. pushups.mp4, wall-push-up.mp4, 90-90-hip-stretch-left.mp4.
 *   It lives in Storage at  exercise-demos/<id>.mp4.
 *   5-8 seconds, under 1,000,000 bytes, silent, H.264, seamless loop.
 *
 * HOW A CLIP GOES LIVE
 *   1. Put the file in  exercise-clips/  (project root, not committed).
 *   2. npm run clips   - checks every file, writes exerciseClips.generated.ts
 *      (only checked files are marked ready) and prints what is still missing.
 *   3. Upload to Storage (the command npm run clips prints), then rebuild the app.
 *   Until an id is "ready" the app keeps using the bundled clip in public/videos,
 *   so nothing disappears while you are filming.
 *
 * MATCHING IS EXACT ON PURPOSE
 *   A name resolves to a clip only by id, display name or an alias below. There
 *   is no fuzzy matching: showing a different exercise's demo is worse than
 *   showing the still photo. "aliases" are other names for the SAME movement.
 */
export interface ClipEntry {
  id: string;
  name: string;
  aliases?: string[];
  /** Where the exercise appears; only set for ones that had no clip at all. */
  from?: string;
}

export const CLIPS: ClipEntry[] = [
  // In the Academy (Exercise Library). These also have a bundled clip today.
  { id: "incline", name: "Incline Push-up", aliases: ["Incline Push-ups or Floor Push-ups"] },
  { id: "pushups", name: "Classic Push-ups" },
  { id: "diamond-pushup", name: "Diamond Push-ups" },
  { id: "lateral-raise", name: "Lateral Raises" },
  { id: "dips", name: "Chair Tricep Dips" },
  { id: "shoulder-taps", name: "Shoulder Taps", aliases: ["Plank Shoulder Taps"] },
  { id: "pike-pushup", name: "Pike Push-ups" },
  { id: "superman", name: "Superman Hold", aliases: ["Superman Raises"] },
  { id: "bicep-curl", name: "Dumbbell Bicep Curl" },
  { id: "bent-row", name: "Bent-over Rows" },
  { id: "bridges", name: "Glute Bridges" },
  { id: "calf", name: "Calf Raises" },
  { id: "stepup", name: "Supported Step-up" },
  { id: "donkey-kick", name: "Donkey Kicks", aliases: ["Donkey Kicks (Left Side)", "Donkey Kicks (Right Side)"] },
  { id: "squats", name: "Bodyweight Squats", aliases: ["Warm-up Bodyweight Squats"] },
  { id: "wall-sit", name: "Wall Sit" },
  { id: "sumo-squat", name: "Sumo Squats" },
  { id: "lunges", name: "Reverse Lunges" },
  { id: "single-leg-deadlift", name: "Single-Leg Deadlift" },
  { id: "bird-dog", name: "Bird Dog" },
  { id: "deadbug", name: "Dead Bug" },
  { id: "crunches", name: "Standard Crunches" },
  { id: "situps", name: "Sit-ups" },
  { id: "plank", name: "Forearm Plank", aliases: ["Plank Hold"] },
  { id: "russian-twist", name: "Russian Twists" },
  { id: "side-plank", name: "Side Plank" },
  { id: "bicycle", name: "Bicycle Crunches" },
  { id: "legraises", name: "Lying Leg Raises" },
  { id: "jacks", name: "Jumping Jacks" },
  { id: "skater-hop", name: "Skater Hops", aliases: ["Lateral Plyo Skater Bound"] },
  { id: "mountain", name: "Mountain Climbers" },
  { id: "burpees", name: "Low-impact Burpee" },
  { id: "jump-squat", name: "Jump Squats" },
  { id: "childs-pose", name: "Child's Pose" },
  { id: "cat-cow", name: "Cat-Cow Stretch", aliases: ["Cat-Cow Dynamic Stretch"] },
  { id: "cobra-stretch", name: "Cobra Stretch" },
  { id: "seated-fold", name: "Seated Forward Fold" },
  { id: "spinal-twist", name: "Supine Spinal Twist" },
  { id: "world-greatest-stretch", name: "World's Greatest Stretch" },
  { id: "wide-grip-pushup", name: "Wide-Grip Push-up", aliases: ["Wide Push-ups"] },
  { id: "arm-circles", name: "Arm Circles" },
  { id: "arnold-press", name: "Arnold Press" },
  { id: "box-jump", name: "Box Jump" },
  { id: "standing-knee-raises", name: "Standing Knee Raises" },
  { id: "jump-rope", name: "Jump Rope" },
  { id: "high-knees", name: "High Knees", aliases: ["High Knee Sprint Matrix"] },
  { id: "burpee-pushup", name: "Burpee Push-up" },
  { id: "neck-rolls", name: "Neck Rolls" },
  { id: "hamstring-stretch-left", name: "Hamstring Stretch (Left)" },
  { id: "hamstring-stretch-right", name: "Hamstring Stretch (Right)" },
  { id: "90-90-hip-stretch-left", name: "90/90 Hip Stretch (Left)" },
  { id: "90-90-hip-stretch-right", name: "90/90 Hip Stretch (Right)" },

  // Used elsewhere in the app but with NO clip anywhere yet.
  { id: "wall-push-up", name: "Wall Push-ups", from: "Curated workouts" },
  { id: "superman-pulls", name: "Superman Pulls", from: "Curated workouts" },
  { id: "prone-y-raises", name: "Prone Y-Raises", aliases: ["Prone Y Raises"], from: "Curated workouts" },
  { id: "standing-chest-shoulder-stretch", name: "Standing Chest & Shoulder Stretch", from: "Curated workouts" },
  { id: "standing-forward-fold", name: "Standing Forward Fold", from: "Curated workouts" },
  { id: "standing-quad-glute-stretch", name: "Standing Quad & Glute Stretch", from: "Curated workouts" },
  { id: "archer-push-up-glide", name: "Archer Push-up Glide", from: "Offline AI generator" },
  { id: "offset-scapular-push-up", name: "Offset Kinetic Scapular Push-up", from: "Offline AI generator" },
  { id: "prone-cobra-scapular-retraction", name: "Prone Cobra Scapular Retraction", from: "Offline AI generator" },
  { id: "triple-extension-piston-squat", name: "Triple-Extension Piston Squat", from: "Offline AI generator" },
  { id: "pistol-deceleration-squat", name: "Pistol Deceleration Squat", from: "Offline AI generator" },
  { id: "curtsy-lunge-pulse", name: "Curtsy Deficit Lunge Pulse", from: "Offline AI generator" },
  { id: "side-plank-scapular-tap", name: "Side Plank Scapular Tap", from: "Offline AI generator" },
  { id: "decline-push-up", name: "Decline Push-ups", from: "Arena" },
  { id: "reverse-snow-angels", name: "Reverse Snow Angels", from: "Arena" },
  { id: "good-mornings", name: "Good Mornings", from: "Arena" },
  { id: "close-grip-push-up", name: "Close-grip Push-ups", from: "Arena" },
  { id: "plank-up-downs", name: "Plank Up-downs", from: "Arena" },
  { id: "alternating-lunges", name: "Alternating Lunges", from: "Arena" },
  { id: "split-squats", name: "Split Squats", from: "Arena" },
  { id: "squat-thrusts", name: "Squat Thrusts", from: "Arena" },
];

export const CLIP_MAX_BYTES = 1_000_000;
export const CLIP_MIN_SECONDS = 5;
export const CLIP_MAX_SECONDS = 8;
export const CLIP_FOLDER = "exercise-demos";
/** Same bucket as src/lib/firebase.ts. */
const BUCKET = "fitness-app-1e5f0.firebasestorage.app";

export const clipFileName = (id: string) => `${id}.mp4`;

const norm = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

let lookup: Map<string, string> | null = null;

function buildLookup(): Map<string, string> {
  const m = new Map<string, string>();
  const put = (key: string, id: string) => {
    const k = norm(key);
    if (!k) return;
    if (!m.has(k)) m.set(k, id);
    const c = k.replace(/-/g, "");
    if (!m.has(c)) m.set(c, id);
  };
  for (const e of CLIPS) {
    put(e.id, e.id);
    put(e.name, e.id);
    for (const a of e.aliases ?? []) put(a, e.id);
  }
  // Older spellings the app already used for the bundled clips ("pushup",
  // "classic pushups"...): a key maps to the entry whose own id points at the
  // same file.
  const fileToId = new Map<string, string>();
  for (const e of CLIPS) {
    const f = EXERCISE_VIDEOS[e.id];
    if (f && !fileToId.has(f)) fileToId.set(f, e.id);
  }
  for (const [key, file] of Object.entries(EXERCISE_VIDEOS)) {
    const id = fileToId.get(file);
    if (id) put(key, id);
  }
  return m;
}

/** Exact lookup by id, name or alias. Returns null when there is no such exercise. */
export function resolveClipId(nameOrId?: string | null): string | null {
  if (!nameOrId) return null;
  if (!lookup) lookup = buildLookup();
  const k = norm(nameOrId);
  return lookup.get(k) ?? lookup.get(k.replace(/-/g, "")) ?? null;
}

/** Storage URL, only once the clip has been checked and marked ready. */
export function clipRemoteUrl(id: string): string | null {
  const r = READY_CLIPS[id];
  if (!r) return null;
  const path = encodeURIComponent(`${CLIP_FOLDER}/${clipFileName(id)}`);
  // h = content hash: the URL changes only when the file does, so it can be cached forever.
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${path}?alt=media&h=${r.h}`;
}

/** The clip bundled inside the app (public/videos), used until Storage has one. */
export function clipBundledUrl(id: string): string | null {
  const f = EXERCISE_VIDEOS[id];
  return f ? encodeURI(f) : null;
}

export function hasClip(id: string | null, explicitBundled?: string | null): boolean {
  if (!id) return false;
  return Boolean(READY_CLIPS[id] || clipBundledUrl(id) || explicitBundled);
}

export function allRemoteUrls(): string[] {
  return Object.keys(READY_CLIPS).map((id) => clipRemoteUrl(id)!).filter(Boolean);
}
