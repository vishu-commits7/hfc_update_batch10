# Exercise Videos Directory

Place your exercise video files (`.mp4`, `.webm`) in this folder.

### File Naming Convention & Exercise IDs

| Exercise Name | Exercise ID | Recommended Filename |
|---|---|---|
| Jumping Jacks | `jacks` | `jacks.mp4` |
| Bicycle Crunches | `bicycle` | `bicycle.mp4` |
| Mountain Climbers | `mountain` | `mountain.mp4` |
| Chair Tricep Dips | `dips` | `dips.mp4` |
| Wall Sit | `wall-sit` | `wallsit.mp4` |
| Bird Dog | `bird-dog` | `birddog.mp4` |
| Classic Push-ups | `pushups` | `pushups.mp4` |
| Bodyweight Squats | `squats` | `squats.mp4` |
| Forearm Plank | `plank` | `plank.mp4` |
| Reverse Lunges | `lunges` | `lunges.mp4` |
| Low-impact Burpee | `burpees` | `burpees.mp4` |
| Glute Bridges | `bridges` | `bridges.mp4` |
| Calf Raises | `calf` | `calf.mp4` |
| Dead Bug | `deadbug` | `deadbug.mp4` |
| Incline Push-up | `incline` | `incline.mp4` |
| Supported Step-up | `stepup` | `stepup.mp4` |
| Sit-ups | `situps` | `situps.mp4` |
| Standard Crunches | `crunches` | `crunches.mp4` |
| Lying Leg Raises | `legraises` | `legraises.mp4` |
| Russian Twists | `russian-twist` | `russiantwist.mp4` |
| Superman Hold | `superman` | `superman.mp4` |
| Side Plank | `side-plank` | `sideplank.mp4` |
| Pike Push-ups | `pike-pushup` | `pikepushup.mp4` |
| Diamond Push-ups | `diamond-pushup` | `diamondpushup.mp4` |
| Dumbbell Bicep Curl | `bicep-curl` | `bicepcurl.mp4` |
| Lateral Raises | `lateral-raise` | `lateralraise.mp4` |
| Bent-over Rows | `bent-row` | `bentrow.mp4` |
| Donkey Kicks | `donkey-kick` | `donkeykick.mp4` |
| Sumo Squats | `sumo-squat` | `sumosquat.mp4` |
| Jump Squats | `jump-squat` | `jumpsquat.mp4` |

### How to Register Your Video:

Open `src/lib/exerciseVideos.ts` and add your video:
```ts
export const EXERCISE_VIDEOS: Record<string, string> = {
  "jacks": "/videos/jacks.mp4",
  "bicycle": "/videos/bicycle.mp4",
  "mountain": "/videos/mountain.mp4",
  "dips": "/videos/dips.mp4",
  "wall-sit": "/videos/wallsit.mp4",
  "bird-dog": "/videos/birddog.mp4",
};
```
Or directly in `ExerciseLibrary.tsx` by setting `videoUrl: "/videos/jacks.mp4"` on the exercise.
