import { resolveMotion } from "../anim/resolve";

/**
 * Registry mapping exercise IDs and names to video file paths.
 * 
 * All 39 exercises in the Academy and throughout the app have their
 * dedicated video form demonstration in public/videos/.
 */
export const EXERCISE_VIDEOS: Record<string, string> = {
  // 1. Classic Push-ups
  "pushups": "/videos/Classic pushup.mp4",
  "pushup": "/videos/Classic pushup.mp4",
  "classic-push-ups": "/videos/Classic pushup.mp4",
  "classic-pushups": "/videos/Classic pushup.mp4",
  "classic-pushup": "/videos/Classic pushup.mp4",
  "classic push-ups": "/videos/Classic pushup.mp4",
  "classic pushups": "/videos/Classic pushup.mp4",
  "classic pushup": "/videos/Classic pushup.mp4",

  // 2. Diamond Push-ups
  "diamond-pushup": "/videos/Diamond Push-ups.mp4",
  "diamondpushup": "/videos/Diamond Push-ups.mp4",
  "diamond-push-ups": "/videos/Diamond Push-ups.mp4",
  "diamond-pushups": "/videos/Diamond Push-ups.mp4",
  "diamond push-ups": "/videos/Diamond Push-ups.mp4",
  "diamond pushups": "/videos/Diamond Push-ups.mp4",
  "diamond push up": "/videos/Diamond Push-ups.mp4",
  "diamond push-up": "/videos/Diamond Push-ups.mp4",

  // 3. Bodyweight Squats
  "squats": "/videos/Bodyweight squats.mp4",
  "squat": "/videos/Bodyweight squats.mp4",
  "bodyweight-squats": "/videos/Bodyweight squats.mp4",
  "bodyweight squats": "/videos/Bodyweight squats.mp4",
  "bodyweight squat": "/videos/Bodyweight squats.mp4",

  // 4. Forearm Plank
  "plank": "/videos/Forearm plank.mp4",
  "forearm-plank": "/videos/Forearm plank.mp4",
  "forearm plank": "/videos/Forearm plank.mp4",

  // 5. Reverse Lunges
  "lunges": "/videos/Reverse Lunges.mp4",
  "lunge": "/videos/Reverse Lunges.mp4",
  "reverse-lunges": "/videos/Reverse Lunges.mp4",
  "reverse lunges": "/videos/Reverse Lunges.mp4",
  "reverse lunge": "/videos/Reverse Lunges.mp4",

  // 6. Low-impact Burpee
  "burpees": "/videos/Low.mp4",
  "burpee": "/videos/Low.mp4",
  "low-impact-burpee": "/videos/Low.mp4",
  "low impact burpee": "/videos/Low.mp4",
  "low-impact burpee": "/videos/Low.mp4",

  // 7. Glute Bridges
  "bridges": "/videos/Glute Bridges .mp4",
  "bridge": "/videos/Glute Bridges .mp4",
  "glute-bridges": "/videos/Glute Bridges .mp4",
  "glutebridge": "/videos/Glute Bridges .mp4",
  "glute bridges": "/videos/Glute Bridges .mp4",
  "glute bridge": "/videos/Glute Bridges .mp4",

  // 8. Mountain Climbers
  "mountain": "/videos/Mountain Climbers .mp4",
  "mountainclimber": "/videos/Mountain Climbers .mp4",
  "mountain-climbers": "/videos/Mountain Climbers .mp4",
  "mountain climbers": "/videos/Mountain Climbers .mp4",
  "mountain climber": "/videos/Mountain Climbers .mp4",

  // 9. Chair Tricep Dips
  "dips": "/videos/Chair Tricep Dips .mp4",
  "dip": "/videos/Chair Tricep Dips .mp4",
  "chair-tricep-dips": "/videos/Chair Tricep Dips .mp4",
  "chair tricep dips": "/videos/Chair Tricep Dips .mp4",
  "chair dips": "/videos/Chair Tricep Dips .mp4",
  "tricep-dips": "/videos/Chair Tricep Dips .mp4",

  // 10. Jumping Jacks
  "jacks": "/videos/Jumping Jacks .mp4",
  "jumpingjack": "/videos/Jumping Jacks .mp4",
  "jumping-jacks": "/videos/Jumping Jacks .mp4",
  "jumping jacks": "/videos/Jumping Jacks .mp4",
  "jumping jack": "/videos/Jumping Jacks .mp4",

  // 11. Bicycle Crunches
  "bicycle": "/videos/Bicycle Crunches.mp4",
  "bicycle-crunches": "/videos/Bicycle Crunches.mp4",
  "bicycle crunches": "/videos/Bicycle Crunches.mp4",
  "bicycle crunch": "/videos/Bicycle Crunches.mp4",

  // 12. Wall Sit
  "wall-sit": "/videos/Wall sit exercise.mp4",
  "wallsit": "/videos/Wall sit exercise.mp4",
  "wall sit": "/videos/Wall sit exercise.mp4",
  "wall sit exercise": "/videos/Wall sit exercise.mp4",

  // 13. Bird Dog
  "bird-dog": "/videos/Bird Dog Exercise .mp4",
  "birddog": "/videos/Bird Dog Exercise .mp4",
  "bird dog": "/videos/Bird Dog Exercise .mp4",
  "bird dog exercise": "/videos/Bird Dog Exercise .mp4",

  // 14. Calf Raises
  "calf": "/videos/Calf Raises.mp4",
  "calfraise": "/videos/Calf Raises.mp4",
  "calf-raises": "/videos/Calf Raises.mp4",
  "calf raises": "/videos/Calf Raises.mp4",
  "calf raise": "/videos/Calf Raises.mp4",

  // 15. Dead Bug
  "deadbug": "/videos/Dead Bug.mp4",
  "dead-bug": "/videos/Dead Bug.mp4",
  "dead bug": "/videos/Dead Bug.mp4",

  // 16. Incline Push-up
  "incline": "/videos/Incline Push-ups.mp4",
  "inclinepushup": "/videos/Incline Push-ups.mp4",
  "incline-push-up": "/videos/Incline Push-ups.mp4",
  "incline-pushup": "/videos/Incline Push-ups.mp4",
  "incline push-up": "/videos/Incline Push-ups.mp4",
  "incline push-ups": "/videos/Incline Push-ups.mp4",
  "incline push up": "/videos/Incline Push-ups.mp4",

  // 17. Supported Step-up
  "stepup": "/videos/Supported step-up.mp4",
  "supported-step-up": "/videos/Supported step-up.mp4",
  "supported step-up": "/videos/Supported step-up.mp4",
  "supported step up": "/videos/Supported step-up.mp4",
  "step-up": "/videos/Supported step-up.mp4",

  // 18. Sit-ups
  "situps": "/videos/Sit-ups.mp4",
  "situp": "/videos/Sit-ups.mp4",
  "sit-ups": "/videos/Sit-ups.mp4",
  "sit-up": "/videos/Sit-ups.mp4",
  "sit ups": "/videos/Sit-ups.mp4",
  "sit up": "/videos/Sit-ups.mp4",

  // 19. Standard Crunches
  "crunches": "/videos/Standard-crunches.mp4",
  "crunch": "/videos/Standard-crunches.mp4",
  "standard-crunches": "/videos/Standard-crunches.mp4",
  "standard crunches": "/videos/Standard-crunches.mp4",

  // 20. Lying Leg Raises
  "legraises": "/videos/Lying leg raises.mp4",
  "legraise": "/videos/Lying leg raises.mp4",
  "lying-leg-raises": "/videos/Lying leg raises.mp4",
  "lying leg raises": "/videos/Lying leg raises.mp4",
  "leg raises": "/videos/Lying leg raises.mp4",

  // 21. Russian Twists
  "russian-twist": "/videos/Russian Twists.mp4",
  "russiantwist": "/videos/Russian Twists.mp4",
  "russian twists": "/videos/Russian Twists.mp4",
  "russian twist": "/videos/Russian Twists.mp4",

  // 22. Superman Hold
  "superman": "/videos/Superman-Hold.mp4",
  "superman-hold": "/videos/Superman-Hold.mp4",
  "superman hold": "/videos/Superman-Hold.mp4",

  // 23. Side Plank
  "side-plank": "/videos/Side-Plank.mp4",
  "sideplank": "/videos/Side-Plank.mp4",
  "side plank": "/videos/Side-Plank.mp4",

  // 24. Pike Push-ups
  "pike-pushup": "/videos/Pike push-ups.mp4",
  "pikepushup": "/videos/Pike push-ups.mp4",
  "pike-push-ups": "/videos/Pike push-ups.mp4",
  "pike push-ups": "/videos/Pike push-ups.mp4",
  "pike pushups": "/videos/Pike push-ups.mp4",
  "pike push up": "/videos/Pike push-ups.mp4",

  // 25. Shoulder Taps
  "shoulder-taps": "/videos/Shoulder Taps.mp4",
  "shouldertap": "/videos/Shoulder Taps.mp4",
  "shoulder taps": "/videos/Shoulder Taps.mp4",
  "shoulder tap": "/videos/Shoulder Taps.mp4",

  // 26. Dumbbell Bicep Curl
  "bicep-curl": "/videos/Dumbell Bicep Curls.mp4",
  "bicepcurl": "/videos/Dumbell Bicep Curls.mp4",
  "dumbbell-bicep-curl": "/videos/Dumbell Bicep Curls.mp4",
  "dumbbell bicep curl": "/videos/Dumbell Bicep Curls.mp4",
  "bicep curls": "/videos/Dumbell Bicep Curls.mp4",
  "bicep curl": "/videos/Dumbell Bicep Curls.mp4",

  // 27. Lateral Raises
  "lateral-raise": "/videos/Lateral Raises.mp4",
  "lateralraise": "/videos/Lateral Raises.mp4",
  "lateral-raises": "/videos/Lateral Raises.mp4",
  "lateral raises": "/videos/Lateral Raises.mp4",
  "lateral raise": "/videos/Lateral Raises.mp4",

  // 28. Bent-over Rows
  "bent-row": "/videos/Bent over Rows.mp4",
  "bentrow": "/videos/Bent over Rows.mp4",
  "bent-over-rows": "/videos/Bent over Rows.mp4",
  "bent-over rows": "/videos/Bent over Rows.mp4",
  "bent over rows": "/videos/Bent over Rows.mp4",
  "bent-over row": "/videos/Bent over Rows.mp4",

  // 29. Donkey Kicks
  "donkey-kick": "/videos/Donkey Kicks.mp4",
  "donkeykick": "/videos/Donkey Kicks.mp4",
  "donkey-kicks": "/videos/Donkey Kicks.mp4",
  "donkey kicks": "/videos/Donkey Kicks.mp4",
  "donkey kick": "/videos/Donkey Kicks.mp4",

  // 30. Sumo Squats
  "sumo-squat": "/videos/Sumo Squats.mp4",
  "sumosquat": "/videos/Sumo Squats.mp4",
  "sumo-squats": "/videos/Sumo Squats.mp4",
  "sumo squats": "/videos/Sumo Squats.mp4",
  "sumo squat": "/videos/Sumo Squats.mp4",

  // 31. Jump Squats
  "jump-squat": "/videos/Jump Squats.mp4",
  "jumpsquat": "/videos/Jump Squats.mp4",
  "jump-squats": "/videos/Jump Squats.mp4",
  "jump squats": "/videos/Jump Squats.mp4",
  "jump squat": "/videos/Jump Squats.mp4",

  // 32. Skater Hops
  "skater-hop": "/videos/Skater Hops .mp4",
  "skater": "/videos/Skater Hops .mp4",
  "skaterhop": "/videos/Skater Hops .mp4",
  "skater-hops": "/videos/Skater Hops .mp4",
  "skater hops": "/videos/Skater Hops .mp4",
  "skater hop": "/videos/Skater Hops .mp4",

  // 33. Single-Leg Deadlift
  "single-leg-deadlift": "/videos/Single Leg Deadlift.mp4",
  "single-leg deadlift": "/videos/Single Leg Deadlift.mp4",
  "single leg deadlift": "/videos/Single Leg Deadlift.mp4",
  "deadlift": "/videos/Single Leg Deadlift.mp4",

  // 34. World's Greatest Stretch
  "world-greatest-stretch": "/videos/World's Greatest Stretch.mp4",
  "world's-greatest-stretch": "/videos/World's Greatest Stretch.mp4",
  "world's greatest stretch": "/videos/World's Greatest Stretch.mp4",
  "worlds greatest stretch": "/videos/World's Greatest Stretch.mp4",
  "greateststretch": "/videos/World's Greatest Stretch.mp4",

  // 35. Cat-Cow Stretch
  "cat-cow": "/videos/Cat Cow pose.mp4",
  "catcow": "/videos/Cat Cow pose.mp4",
  "cat-cow stretch": "/videos/Cat Cow pose.mp4",
  "cat cow stretch": "/videos/Cat Cow pose.mp4",
  "cat cow pose": "/videos/Cat Cow pose.mp4",

  // 36. Cobra Stretch
  "cobra-stretch": "/videos/Cobra Stretch.mp4",
  "cobra": "/videos/Cobra Stretch.mp4",
  "cobra stretch": "/videos/Cobra Stretch.mp4",

  // 37. Seated Forward Fold
  "seated-fold": "/videos/Seated Forward Fold.mp4",
  "seated forward fold": "/videos/Seated Forward Fold.mp4",
  "forwardfold": "/videos/Seated Forward Fold.mp4",

  // 38. Supine Spinal Twist
  "spinal-twist": "/videos/SUPINE Spinal Twist.mp4",
  "spinaltwist": "/videos/SUPINE Spinal Twist.mp4",
  "supine spinal twist": "/videos/SUPINE Spinal Twist.mp4",
  "supine-spinal-twist": "/videos/SUPINE Spinal Twist.mp4",

  // 39. Child's Pose
  "childs-pose": "/videos/Child's Pose.mp4",
  "childspose": "/videos/Child's Pose.mp4",
  "child's pose": "/videos/Child's Pose.mp4",
  "childs pose": "/videos/Child's Pose.mp4",
};

/**
 * Returns the video URL for a given exercise ID or name, checking:
 * 1. Explicit videoUrl passed in exercise definition
 * 2. Exact match in EXERCISE_VIDEOS dictionary
 * 3. Normalized / slugified lookup
 * 4. Fallback motion match from the Obsidian motion resolver
 * 5. Returns null if no video is found
 */
export function getExerciseVideo(
  exerciseIdOrName?: string | null,
  explicitUrl?: string | null,
  nameFallback?: string | null
): string | null {
  if (explicitUrl && explicitUrl.trim().length > 0) {
    return explicitUrl;
  }
  if (!exerciseIdOrName && !nameFallback) return null;

  const candidates = [exerciseIdOrName, nameFallback].filter(Boolean) as string[];

  for (const raw of candidates) {
    const key = raw.trim();
    if (!key) continue;

    // 1. Direct match
    if (EXERCISE_VIDEOS[key]) {
      return EXERCISE_VIDEOS[key];
    }

    // 2. Lowercase trimmed match
    const lower = key.toLowerCase();
    if (EXERCISE_VIDEOS[lower]) {
      return EXERCISE_VIDEOS[lower];
    }

    // 3. Slugified match (hyphenated)
    const slug = lower.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (EXERCISE_VIDEOS[slug]) {
      return EXERCISE_VIDEOS[slug];
    }

    // 4. Compact match (no hyphens)
    const compact = slug.replace(/-/g, "");
    if (EXERCISE_VIDEOS[compact]) {
      return EXERCISE_VIDEOS[compact];
    }

    // 5. Check via Obsidian motion resolver
    try {
      const match = resolveMotion(key);
      if (match?.motion?.id) {
        const motionId = match.motion.id;
        if (EXERCISE_VIDEOS[motionId]) {
          return EXERCISE_VIDEOS[motionId];
        }
        const motionSlug = motionId.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        if (EXERCISE_VIDEOS[motionSlug]) {
          return EXERCISE_VIDEOS[motionSlug];
        }
      }
    } catch {
      // Ignore motion resolver errors
    }
  }

  return null;
}
