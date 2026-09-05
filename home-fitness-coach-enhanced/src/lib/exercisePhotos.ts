/**
 * Real-photo demo sequences for a growing subset of exercises. Every
 * exercise in this map ships two photo sets — "black" and "white" — each
 * an ordered burst of frames captured through one rep (or, for an
 * isometric hold, a single frame). `PhotoExerciseDemo` / `PhotoExerciseThumb`
 * ping-pong through the frames to fake a looping rep animation.
 *
 * Anything NOT in this map keeps using the illustrated stick-figure demo
 * (HumanFigure) exactly as before — this is additive, not a replacement,
 * so the other ~35 movements in the Academy are unaffected until real
 * photos exist for them too.
 */
import pushupWhite1 from "../assets/exercises/pushup-white-1.jpg";
import pushupWhite2 from "../assets/exercises/pushup-white-2.jpg";
import pushupWhite3 from "../assets/exercises/pushup-white-3.jpg";
import pushupBlack1 from "../assets/exercises/pushup-black-1.jpg";
import pushupBlack2 from "../assets/exercises/pushup-black-2.jpg";
import pushupBlack3 from "../assets/exercises/pushup-black-3.jpg";
import squatBlack1 from "../assets/exercises/squat-black-1.jpg";
import squatBlack2 from "../assets/exercises/squat-black-2.jpg";
import squatBlack3 from "../assets/exercises/squat-black-3.jpg";
import squatWhite1 from "../assets/exercises/squat-white-1.jpg";
import squatWhite2 from "../assets/exercises/squat-white-2.jpg";
import squatWhite3 from "../assets/exercises/squat-white-3.jpg";
import plankBlack1 from "../assets/exercises/plank-black-1.jpg";
import plankWhite1 from "../assets/exercises/plank-white-1.jpg";
import bridgeBlack1 from "../assets/exercises/bridge-black-1.jpg";
import bridgeBlack2 from "../assets/exercises/bridge-black-2.jpg";
import bridgeBlack3 from "../assets/exercises/bridge-black-3.jpg";
import bridgeWhite1 from "../assets/exercises/bridge-white-1.jpg";
import bridgeWhite2 from "../assets/exercises/bridge-white-2.jpg";
import bridgeWhite3 from "../assets/exercises/bridge-white-3.jpg";
import burpeeBlackStand from "../assets/exercises/burpee-black-stand.jpg";
import burpeeBlackSquat from "../assets/exercises/burpee-black-squat.jpg";
import burpeeBlackPlank from "../assets/exercises/burpee-black-plank.jpg";
import burpeeWhiteStand from "../assets/exercises/burpee-white-stand.jpg";
import burpeeWhiteSquat from "../assets/exercises/burpee-white-squat.jpg";
import burpeeWhitePlank from "../assets/exercises/burpee-white-plank.jpg";
import lungeBlackStand from "../assets/exercises/lunge-black-stand.jpg";
import lungeBlack1 from "../assets/exercises/lunge-black-1.jpg";
import lungeBlack2 from "../assets/exercises/lunge-black-2.jpg";
import lungeWhite1 from "../assets/exercises/lunge-white-1.jpg";
import jacksBlack1 from "../assets/exercises/jacks-black-1.jpg";
import jacksBlack2 from "../assets/exercises/jacks-black-2.jpg";
import jacksBlack3 from "../assets/exercises/jacks-black-3.jpg";
import jacksWhite1 from "../assets/exercises/jacks-white-1.jpg";
import jacksWhite2 from "../assets/exercises/jacks-white-2.jpg";
import jacksWhite3 from "../assets/exercises/jacks-white-3.jpg";
import dipsBlack1 from "../assets/exercises/dips-black-1.jpg";
import dipsBlack2 from "../assets/exercises/dips-black-2.jpg";
import dipsBlack3 from "../assets/exercises/dips-black-3.jpg";
import dipsWhite1 from "../assets/exercises/dips-white-1.jpg";
import dipsWhite2 from "../assets/exercises/dips-white-2.jpg";
import dipsWhite3 from "../assets/exercises/dips-white-3.jpg";
import mountainWhite1 from "../assets/exercises/mountain-white-1.jpg";
import mountainWhite2 from "../assets/exercises/mountain-white-2.jpg";
import mountainWhite3 from "../assets/exercises/mountain-white-3.jpg";
import mountainBlack1 from "../assets/exercises/mountain-black-1.jpg";
import wallsitBlack1 from "../assets/exercises/wallsit-black-1.jpg";
import wallsitBlack2 from "../assets/exercises/wallsit-black-2.jpg";
import wallsitWhite1 from "../assets/exercises/wallsit-white-1.jpg";
import wallsitWhite2 from "../assets/exercises/wallsit-white-2.jpg";
import bicycleBlack1 from "../assets/exercises/bicycle-black-1.jpg";
import bicycleBlack2 from "../assets/exercises/bicycle-black-2.jpg";
import bicycleBlack3 from "../assets/exercises/bicycle-black-3.jpg";
import bicycleWhite1 from "../assets/exercises/bicycle-white-1.jpg";
import bicycleWhite2 from "../assets/exercises/bicycle-white-2.jpg";
import bicycleWhite3 from "../assets/exercises/bicycle-white-3.jpg";
import birddogWhite1 from "../assets/exercises/birddog-white-1.jpg";
import birddogWhite2 from "../assets/exercises/birddog-white-2.jpg";
import birddogBlack1 from "../assets/exercises/birddog-black-1.jpg";
import birddogBlack2 from "../assets/exercises/birddog-black-2.jpg";
import calfBlack1 from "../assets/exercises/calf-black-1.jpg";
import calfBlack2 from "../assets/exercises/calf-black-2.jpg";
import calfWhite1 from "../assets/exercises/calf-white-1.jpg";
import calfWhite2 from "../assets/exercises/calf-white-2.jpg";
import deadbugBlack1 from "../assets/exercises/deadbug-black-1.jpg";
import deadbugBlack2 from "../assets/exercises/deadbug-black-2.jpg";
import deadbugWhite1 from "../assets/exercises/deadbug-white-1.jpg";
import deadbugWhite2 from "../assets/exercises/deadbug-white-2.jpg";
import situpsBlack1 from "../assets/exercises/situps-black-1.jpg";
import situpsBlack2 from "../assets/exercises/situps-black-2.jpg";
import situpsWhite1 from "../assets/exercises/situps-white-1.jpg";
import situpsWhite2 from "../assets/exercises/situps-white-2.jpg";
import stepupBlack1 from "../assets/exercises/stepup-black-1.jpg";
import stepupWhite1 from "../assets/exercises/stepup-white-1.jpg";
import inclineBlack1 from "../assets/exercises/incline-black-1.jpg";
import inclineBlack2 from "../assets/exercises/incline-black-2.jpg";
import pikepushupBlack1 from "../assets/exercises/pikepushup-black-1.jpg";
import pikepushupWhite1 from "../assets/exercises/pikepushup-white-1.jpg";
import sideplankBlack1 from "../assets/exercises/sideplank-black-1.jpg";
import sideplankWhite1 from "../assets/exercises/sideplank-white-1.jpg";
import supermanBlack1 from "../assets/exercises/superman-black-1.jpg";
import supermanWhite1 from "../assets/exercises/superman-white-1.jpg";
import russiantwistBlack1 from "../assets/exercises/russiantwist-black-1.jpg";
import russiantwistBlack2 from "../assets/exercises/russiantwist-black-2.jpg";
import russiantwistWhite1 from "../assets/exercises/russiantwist-white-1.jpg";
import russiantwistWhite2 from "../assets/exercises/russiantwist-white-2.jpg";
import legraisesBlack1 from "../assets/exercises/legraises-black-1.jpg";
import legraisesBlack2 from "../assets/exercises/legraises-black-2.jpg";
import legraisesWhite1 from "../assets/exercises/legraises-white-1.jpg";
import legraisesWhite2 from "../assets/exercises/legraises-white-2.jpg";
import crunchesBlack1 from "../assets/exercises/crunches-black-1.jpg";
import crunchesBlack2 from "../assets/exercises/crunches-black-2.jpg";
import lateralraiseBlack1 from "../assets/exercises/lateralraise-black-1.jpg";
import lateralraiseBlack2 from "../assets/exercises/lateralraise-black-2.jpg";
import lateralraiseWhite1 from "../assets/exercises/lateralraise-white-1.jpg";
import lateralraiseWhite2 from "../assets/exercises/lateralraise-white-2.jpg";
import bicepcurlBlack1 from "../assets/exercises/bicepcurl-black-1.jpg";
import bicepcurlWhite1 from "../assets/exercises/bicepcurl-white-1.jpg";
import shouldertapsBlack1 from "../assets/exercises/shouldertaps-black-1.jpg";
import shouldertapsBlack2 from "../assets/exercises/shouldertaps-black-2.jpg";
import shouldertapsBlack3 from "../assets/exercises/shouldertaps-black-3.jpg";
import shouldertapsWhite1 from "../assets/exercises/shouldertaps-white-1.jpg";
import shouldertapsWhite2 from "../assets/exercises/shouldertaps-white-2.jpg";
import shouldertapsWhite3 from "../assets/exercises/shouldertaps-white-3.jpg";
import diamondpushupBlack1 from "../assets/exercises/diamondpushup-black-1.jpg";
import diamondpushupBlack2 from "../assets/exercises/diamondpushup-black-2.jpg";
import diamondpushupBlack3 from "../assets/exercises/diamondpushup-black-3.jpg";
import diamondpushupWhite1 from "../assets/exercises/diamondpushup-white-1.jpg";
import sumosquatBlack1 from "../assets/exercises/sumosquat-black-1.jpg";
import sumosquatBlack2 from "../assets/exercises/sumosquat-black-2.jpg";
import sumosquatWhite1 from "../assets/exercises/sumosquat-white-1.jpg";
import sumosquatWhite2 from "../assets/exercises/sumosquat-white-2.jpg";
import donkeykickBlack1 from "../assets/exercises/donkeykick-black-1.jpg";
import donkeykickBlack2 from "../assets/exercises/donkeykick-black-2.jpg";
import donkeykickWhite1 from "../assets/exercises/donkeykick-white-1.jpg";
import donkeykickWhite2 from "../assets/exercises/donkeykick-white-2.jpg";
import bentrowBlack1 from "../assets/exercises/bentrow-black-1.jpg";
import bentrowBlack2 from "../assets/exercises/bentrow-black-2.jpg";
import bentrowWhite1 from "../assets/exercises/bentrow-white-1.jpg";
import bentrowWhite2 from "../assets/exercises/bentrow-white-2.jpg";
import jumpsquatBlack1 from "../assets/exercises/jumpsquat-black-1.jpg";
import jumpsquatBlack2 from "../assets/exercises/jumpsquat-black-2.jpg";
import jumpsquatWhite1 from "../assets/exercises/jumpsquat-white-1.jpg";
import jumpsquatWhite2 from "../assets/exercises/jumpsquat-white-2.jpg";
import catcowBlackCow from "../assets/exercises/catcow-black-cow.jpg";
import catcowBlackCat from "../assets/exercises/catcow-black-cat.jpg";
import catcowWhiteCow from "../assets/exercises/catcow-white-cow.jpg";
import catcowWhiteCat from "../assets/exercises/catcow-white-cat.jpg";
import worldsgreatestBlack1 from "../assets/exercises/worldsgreatest-black-1.jpg";
import worldsgreatestWhite1 from "../assets/exercises/worldsgreatest-white-1.jpg";
import cobrastretchBlack1 from "../assets/exercises/cobrastretch-black-1.jpg";
import cobrastretchWhite1 from "../assets/exercises/cobrastretch-white-1.jpg";
import seatedfoldBlack1 from "../assets/exercises/seatedfold-black-1.jpg";
import seatedfoldWhite1 from "../assets/exercises/seatedfold-white-1.jpg";
import childsposeBlack1 from "../assets/exercises/childspose-black-1.jpg";
import childsposeWhite1 from "../assets/exercises/childspose-white-1.jpg";
import spinaltwistBlack1 from "../assets/exercises/spinaltwist-black-1.jpg";
import spinaltwistWhite1 from "../assets/exercises/spinaltwist-white-1.jpg";

export type DemoRace = "black" | "white";

export interface PhotoExerciseSet {
  /** Ordered rep frames (top → mid → bottom) for a moving exercise, or a
   *  single frame for an isometric hold. */
  black: string[];
  white: string[];
  /** True for holds (plank, wall-sit, ...) — renders a slow breathing
   *  pulse instead of pretending there's a rep cycle. */
  isHold?: boolean;
  label: string;
}

// Keyed by the same `id` used in ExerciseLibrary's DEMO_EXERCISES, so the
// Academy's big/small demos can look a set up directly by exercise id.
export const EXERCISE_PHOTO_SETS: Record<string, PhotoExerciseSet> = {
  pushups: {
    label: "Classic Push-ups",
    black: [pushupBlack1, pushupBlack2, pushupBlack3],
    white: [pushupWhite1, pushupWhite2, pushupWhite3],
  },
  squats: {
    label: "Bodyweight Squats",
    black: [squatBlack1, squatBlack2, squatBlack3],
    white: [squatWhite1, squatWhite2, squatWhite3],
  },
  plank: {
    label: "Forearm Plank",
    black: [plankBlack1],
    white: [plankWhite1],
    isHold: true,
  },
  lunges: {
    label: "Reverse Lunges",
    // Standing → lunge → lunge gives a full down-and-back-up cycle for
    // black; white only has one frame so far (more to come) — the
    // ping-pong helper already renders a single frame statically.
    black: [lungeBlackStand, lungeBlack1, lungeBlack2],
    white: [lungeWhite1],
  },
  burpees: {
    label: "Low-impact Burpee",
    // Stand → squat/hands-down → plank represents the "down" half of a
    // scalable burpee; the ping-pong loop brings it back up again.
    black: [burpeeBlackStand, burpeeBlackSquat, burpeeBlackPlank],
    white: [burpeeWhiteStand, burpeeWhiteSquat, burpeeWhitePlank],
  },
  bridges: {
    label: "Glute Bridges",
    black: [bridgeBlack3, bridgeBlack1, bridgeBlack2],
    white: [bridgeWhite2, bridgeWhite1, bridgeWhite3],
  },
  jacks: {
    label: "Jumping Jacks",
    // Closed → open → closed reads as one full jack; a second closed
    // frame on each end gives the ping-pong loop a believable landing.
    black: [jacksBlack1, jacksBlack2, jacksBlack3],
    white: [jacksWhite1, jacksWhite2, jacksWhite3],
  },
  dips: {
    label: "Chair Tricep Dips",
    // Down → up → down gives a real press cycle; the extra frame on
    // each side is a natural variation at the same end of the rep.
    black: [dipsBlack1, dipsBlack2, dipsBlack3],
    white: [dipsWhite2, dipsWhite1, dipsWhite3],
  },
  mountain: {
    label: "Mountain Climbers",
    // Plank → knee drive → knee drive (alt) for white; black only has
    // one frame so far (more to come) — ping-pong renders it statically.
    black: [mountainBlack1],
    white: [mountainWhite1, mountainWhite2, mountainWhite3],
  },
  "wall-sit": {
    label: "Wall Sit",
    // Seated hold → standing — a slow settle-in/out cycle rather than a
    // fast rep, using the long "hold" interval so it reads as calm.
    isHold: true,
    black: [wallsitBlack1, wallsitBlack2],
    white: [wallsitWhite1, wallsitWhite2],
  },
  bicycle: {
    label: "Bicycle Crunches",
    // Twist one way → neutral → twist the other way, so the ping-pong
    // loop reads as a real side-to-side bicycle crunch through center.
    black: [bicycleBlack1, bicycleBlack3, bicycleBlack2],
    white: [bicycleWhite1, bicycleWhite3, bicycleWhite2],
  },
  "bird-dog": {
    label: "Bird Dog",
    // All-fours → opposite arm/leg extended — a clean reach-and-return.
    black: [birddogBlack1, birddogBlack2],
    white: [birddogWhite1, birddogWhite2],
  },
  calf: {
    label: "Calf Raises",
    // Up on the toes → flat-footed — a simple, satisfying rep cycle.
    black: [calfBlack1, calfBlack2],
    white: [calfWhite1, calfWhite2],
  },
  deadbug: {
    label: "Dead Bug",
    // Opposite arm/leg extended → tabletop reset.
    black: [deadbugBlack1, deadbugBlack2],
    white: [deadbugWhite1, deadbugWhite2],
  },
  situps: {
    label: "Sit-ups",
    // Curled up → reclined — a full-range trunk-flexion cycle.
    black: [situpsBlack1, situpsBlack2],
    white: [situpsWhite1, situpsWhite2],
  },
  stepup: {
    label: "Supported Step-up",
    // Only one frame per race so far (more to come) — ping-pong renders
    // each statically, same as the early lunges/mountain-climber sets.
    black: [stepupBlack1],
    white: [stepupWhite1],
  },
  incline: {
    label: "Incline Push-up",
    // Black only so far (more to come) — two close frames of the same
    // top-of-rep position give it a subtle living-photo feel.
    black: [inclineBlack1, inclineBlack2],
    white: [inclineBlack1, inclineBlack2],
  },
  "pike-pushup": {
    label: "Pike Push-ups",
    // Single top-of-the-inverted-V frame per race so far (more to come).
    black: [pikepushupBlack1],
    white: [pikepushupWhite1],
  },
  "side-plank": {
    label: "Side Plank",
    isHold: true,
    black: [sideplankBlack1],
    white: [sideplankWhite1],
  },
  superman: {
    label: "Superman Hold",
    isHold: true,
    black: [supermanBlack1],
    white: [supermanWhite1],
  },
  "russian-twist": {
    label: "Russian Twists",
    // Two close frames of the twisted crunch position per race — a
    // living-photo feel until a full twist-to-twist sequence arrives.
    black: [russiantwistBlack1, russiantwistBlack2],
    white: [russiantwistWhite1, russiantwistWhite2],
  },
  legraises: {
    label: "Lying Leg Raises",
    // Legs up → legs down — a clean full-range rep cycle.
    black: [legraisesBlack1, legraisesBlack2],
    white: [legraisesWhite1, legraisesWhite2],
  },
  crunches: {
    label: "Standard Crunches",
    // Black only so far (more to come); up → down for a real curl cycle.
    black: [crunchesBlack1, crunchesBlack2],
    white: [crunchesBlack1, crunchesBlack2],
  },
  "lateral-raise": {
    label: "Lateral Raises",
    // Arms out → arms down — a clean full rep cycle.
    black: [lateralraiseBlack1, lateralraiseBlack2],
    white: [lateralraiseWhite1, lateralraiseWhite2],
  },
  "bicep-curl": {
    label: "Dumbbell Bicep Curl",
    // Single top-of-curl frame per race so far (more to come).
    black: [bicepcurlBlack1],
    white: [bicepcurlWhite1],
  },
  "shoulder-taps": {
    label: "Shoulder Taps",
    // Neutral plank → tap → tap (alt side) — a real anti-rotation cycle.
    black: [shouldertapsBlack3, shouldertapsBlack1, shouldertapsBlack2],
    white: [shouldertapsWhite3, shouldertapsWhite1, shouldertapsWhite2],
  },
  "diamond-pushup": {
    label: "Diamond Push-ups",
    // Three close black frames give a living-photo hold; white only has
    // one frame so far (more to come) — ping-pong renders it statically.
    black: [diamondpushupBlack1, diamondpushupBlack2, diamondpushupBlack3],
    white: [diamondpushupWhite1],
  },
  "sumo-squat": {
    label: "Sumo Squats",
    // Wide-stance down → wide-stance stand — a clean full rep cycle.
    black: [sumosquatBlack1, sumosquatBlack2],
    white: [sumosquatWhite1, sumosquatWhite2],
  },
  "donkey-kick": {
    label: "Donkey Kicks",
    // Heel kicked up → tabletop reset — a real hip-extension rep cycle.
    black: [donkeykickBlack1, donkeykickBlack2],
    white: [donkeykickWhite1, donkeykickWhite2],
  },
  "bent-row": {
    label: "Bent-over Rows",
    // Elbows pulled up → arms extended down — a real dumbbell row cycle.
    black: [bentrowBlack1, bentrowBlack2],
    white: [bentrowWhite1, bentrowWhite2],
  },
  "jump-squat": {
    label: "Jump Squats",
    // Crouched load → airborne — a real explosive rep cycle.
    black: [jumpsquatBlack1, jumpsquatBlack2],
    white: [jumpsquatWhite1, jumpsquatWhite2],
  },
  "cat-cow": {
    label: "Cat-Cow Stretch",
    // Cow (back dipped, chest lifted) → cat (back rounded) — a slow,
    // breath-synced spinal wave, using the long "hold" interval.
    isHold: true,
    black: [catcowBlackCow, catcowBlackCat],
    white: [catcowWhiteCow, catcowWhiteCat],
  },
  "world-greatest-stretch": {
    label: "World's Greatest Stretch",
    // Single deep-lunge-with-rotation frame per race so far (more to come).
    isHold: true,
    black: [worldsgreatestBlack1],
    white: [worldsgreatestWhite1],
  },
  "cobra-stretch": {
    label: "Cobra Stretch",
    // Single chest-lifted hold frame per race so far (more to come).
    isHold: true,
    black: [cobrastretchBlack1],
    white: [cobrastretchWhite1],
  },
  "seated-fold": {
    label: "Seated Forward Fold",
    // Single forward-hinge hold frame per race so far (more to come).
    isHold: true,
    black: [seatedfoldBlack1],
    white: [seatedfoldWhite1],
  },
  "childs-pose": {
    label: "Child's Pose",
    // Single resting-fold hold frame per race so far (more to come).
    isHold: true,
    black: [childsposeBlack1],
    white: [childsposeWhite1],
  },
  "spinal-twist": {
    label: "Supine Spinal Twist",
    // Single lying-twist hold frame per race so far (more to come).
    isHold: true,
    black: [spinaltwistBlack1],
    white: [spinaltwistWhite1],
  },
};

/**
 * Loosely matches a free-text exercise name (from an AI-generated workout,
 * a curated program, or a challenge day) to one of the photo sets above.
 * Deliberately narrow: a name that names a *variant* we don't have real
 * photos for (split squat, bulgarian split squat, pistol squat, ...) falls
 * through to the illustrated stick-figure demo instead of showing the
 * wrong photos.
 */
export function matchPhotoExerciseId(name: string): string | null {
  const n = (name || "").toLowerCase();
  if (/push[- ]?up|press[- ]?up/.test(n) && !/incline|diamond|pike|decline|wall/.test(n)) return "pushups";
  if (/sumo/.test(n) && /squat/.test(n)) return "sumo-squat";
  if (/jump/.test(n) && /squat/.test(n)) return "jump-squat";
  if (/squat/.test(n) && !/split|bulgarian|pistol|wall/.test(n)) return "squats";
  if (/plank/.test(n) && !/side|shoulder tap/.test(n)) return "plank";
  if (/lunge/.test(n) && !/curtsy|lateral|side/.test(n)) return "lunges";
  if (/burpee/.test(n)) return "burpees";
  if (/bridge/.test(n) && !/side/.test(n)) return "bridges";
  if (/jumping jack|star jump|^jack/.test(n)) return "jacks";
  if (/\bdip/.test(n)) return "dips";
  if (/mountain climber|climber/.test(n)) return "mountain";
  if (/wall sit/.test(n)) return "wall-sit";
  if (/bicycle/.test(n)) return "bicycle";
  if (/bird dog/.test(n)) return "bird-dog";
  if (/calf raise/.test(n)) return "calf";
  if (/dead bug/.test(n)) return "deadbug";
  if (/sit[- ]?up/.test(n)) return "situps";
  if (/step[- ]?up/.test(n)) return "stepup";
  if (/incline/.test(n)) return "incline";
  if (/pike/.test(n)) return "pike-pushup";
  if (/side plank/.test(n)) return "side-plank";
  // Excludes "Superman Pulls" — a different rowing-pull movement that
  // just happens to share the "superman" name prefix.
  if (/superman/.test(n) && !/pull/.test(n)) return "superman";
  if (/russian twist/.test(n)) return "russian-twist";
  if (/leg raise/.test(n)) return "legraises";
  if (/crunch/.test(n)) return "crunches";
  if (/lateral raise/.test(n)) return "lateral-raise";
  if (/bicep curl/.test(n)) return "bicep-curl";
  if (/shoulder tap/.test(n)) return "shoulder-taps";
  if (/diamond/.test(n)) return "diamond-pushup";
  if (/donkey kick/.test(n)) return "donkey-kick";
  if (/bent.?over row|bent row/.test(n)) return "bent-row";
  if (/cat.?cow/.test(n)) return "cat-cow";
  if (/world.?s greatest/.test(n)) return "world-greatest-stretch";
  if (/cobra/.test(n)) return "cobra-stretch";
  if (/seated (forward )?fold|forward fold/.test(n)) return "seated-fold";
  if (/child.?s pose/.test(n)) return "childs-pose";
  if (/spinal twist|supine twist/.test(n)) return "spinal-twist";
  return null;
}

export function getPhotoSet(idOrName: string): PhotoExerciseSet | null {
  if (EXERCISE_PHOTO_SETS[idOrName]) return EXERCISE_PHOTO_SETS[idOrName];
  const matched = matchPhotoExerciseId(idOrName);
  return matched ? EXERCISE_PHOTO_SETS[matched] : null;
}

export function readSavedRace(profileRace?: DemoRace): DemoRace {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem("kinetic_demo_race");
    if (saved === "black" || saved === "white") return saved;
  }
  if (profileRace === "black" || profileRace === "white") return profileRace;
  return "white";
}
