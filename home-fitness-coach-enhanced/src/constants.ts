import { Workout, ProgramPlan, ProgramWeek, ProgramDay } from "./types";

export const AVAILABLE_EQUIPMENT = [
  { id: "bodyweight", name: "Bodyweight Only", icon: "🧍" },
  { id: "dumbbells", name: "Dumbbells", icon: "🏋️" },
  { id: "resistance_bands", name: "Resistance Bands", icon: "🎗️" },
  { id: "yoga_mat", name: "Yoga Mat", icon: "🧘" },
  { id: "chair", name: "Chair / Stool", icon: "🪑" },
  { id: "kettlebell", name: "Kettlebell", icon: "⚱️" },
];

export const FITNESS_LEVELS = [
  { value: "Beginner", label: "Beginner", desc: "Just starting out or returning from a break. Gentle exercises." },
  { value: "Intermediate", label: "Intermediate", desc: "Active regularly. Moderate intensity & basic body control." },
  { value: "Advanced", label: "Advanced", desc: "Highly active. High intensity, power, and coordination." },
];

export const WORKOUT_GOALS = [
  { value: "Strength", label: "Build Strength", icon: "⚡", desc: "Tone muscle and improve baseline strength." },
  { value: "Cardio / Fat Loss", label: "Cardio & Fat Loss", icon: "🔥", desc: "Elevate heart rate and burn calories." },
  { value: "Flexibility", label: "Flexibility & Recovery", icon: "🧘", desc: "Stretch, release tension, and improve mobility." },
  { value: "General Health", label: "General Health & Tone", icon: "❤️", desc: "Stay active, improve posture, and feel great." },
];

export const TARGET_AREAS = [
  { value: "Full Body", label: "Full Body" },
  { value: "Upper Body", label: "Upper Body (Arms, Chest, Back)" },
  { value: "Lower Body", label: "Lower Body (Glutes, Quads, Calves)" },
  { value: "Core / Abs", label: "Core & Abs (Stability, Midsection)" },
  { value: "Cardio Blitz", label: "High-Intensity Cardio" },
];

export const CURATED_WORKOUTS: Workout[] = [
  {
    id: "curated_1",
    workoutTitle: "10-Min Morning Energizer",
    workoutDescription: "A fast-paced, high-energy bodyweight routine designed to jumpstart your metabolic rate, increase blood circulation, and shake off any morning stiffness.",
    totalDurationMinutes: 10,
    targetArea: "Full Body",
    equipmentNeeded: ["Bodyweight"],
    createdAt: "Curated",
    coachingTips: [
      "Keep a glass of water nearby to hydrate right after completion.",
      "Focus on smooth, deep breathing—inhale through your nose, exhale through your mouth.",
      "Engage your abdominal muscles throughout all vertical exercises to protect your lower back."
    ],
    exercises: [
      {
        name: "Jumping Jacks",
        description: "Stand straight with arms at your sides. Jump your feet out wide while swinging your arms up above your head. Jump back to starting position and repeat fluidly.",
        durationSeconds: 45,
        reps: 0,
        sets: 1,
        restSeconds: 15,
        targetMuscle: "Cardiovascular System / Full Body"
      },
      {
        name: "Bodyweight Squats",
        description: "Stand with feet shoulder-width apart. Lower your hips back and down as if sitting in a chair, keeping your chest upright and knees behind your toes. Push through your heels to stand.",
        durationSeconds: 45,
        reps: 0,
        sets: 1,
        restSeconds: 15,
        targetMuscle: "Quadriceps & Glutes"
      },
      {
        name: "Incline Push-ups or Floor Push-ups",
        description: "Place your hands slightly wider than shoulder-width on the floor (or edge of a sturdy chair/couch for beginner support). Keep your body in a straight line, lower your chest, and push back up.",
        durationSeconds: 40,
        reps: 0,
        sets: 1,
        restSeconds: 20,
        targetMuscle: "Chest, Shoulders & Triceps"
      },
      {
        name: "High Knees",
        description: "Run in place, bringing your knees up toward your chest as high as possible. Pump your arms in rhythm and stay light on the balls of your feet.",
        durationSeconds: 30,
        reps: 0,
        sets: 1,
        restSeconds: 15,
        targetMuscle: "Cardiovascular System / Core"
      },
      {
        name: "Glute Bridges",
        description: "Lie on your back with knees bent and feet flat on the floor, hip-width apart. Squeeze your glutes and lift your hips toward the ceiling until your body forms a straight line. Lower slowly.",
        durationSeconds: 45,
        reps: 0,
        sets: 1,
        restSeconds: 15,
        targetMuscle: "Glutes & Hamstrings"
      },
      {
        name: "Plank Hold",
        description: "Support your weight on your forearms and toes, keeping your body perfectly straight from head to heels. Draw your belly button inward and hold.",
        durationSeconds: 45,
        reps: 0,
        sets: 1,
        restSeconds: 15,
        targetMuscle: "Core & Abdominals"
      },
      {
        name: "Cat-Cow Dynamic Stretch",
        description: "Start on all fours. Inhale as you arch your back and look up (Cow). Exhale as you round your spine toward the ceiling and tuck your chin (Cat). Move smoothly to finish.",
        durationSeconds: 60,
        reps: 0,
        sets: 1,
        restSeconds: 0,
        targetMuscle: "Spinal Mobility & Core"
      }
    ]
  },
  {
    id: "curated_2",
    workoutTitle: "15-Min Core & Abs Crusher",
    workoutDescription: "A targeted midsection routine that goes deep beyond superficial abs, building true functional spinal stability, posture, and rotational power.",
    totalDurationMinutes: 15,
    targetArea: "Core / Abs",
    equipmentNeeded: ["Yoga Mat"],
    createdAt: "Curated",
    coachingTips: [
      "Never pull on your neck during crunches; use your core muscles to lift.",
      "Keep your lower back pressed flat against the floor during leg raises.",
      "Squeeze your glutes during forearm planks to ensure your lower back doesn't sag."
    ],
    exercises: [
      {
        name: "Bird Dog",
        description: "Start on hands and knees. Slowly extend your right arm forward and left leg backward until they are parallel to the floor. Hold for 2 seconds, return, and alternate sides.",
        durationSeconds: 45,
        reps: 0,
        sets: 1,
        restSeconds: 15,
        targetMuscle: "Deep Core & Lower Back"
      },
      {
        name: "Forearm Plank",
        description: "Hold a rigid bridge on forearms and toes. Keep your neck relaxed, shoulder blades pulled back, and core deeply engaged.",
        durationSeconds: 45,
        reps: 0,
        sets: 2,
        restSeconds: 15,
        targetMuscle: "Transverse Abdominis"
      },
      {
        name: "Dead Bug",
        description: "Lie flat on your back with arms reaching toward the ceiling and knees bent at 90 degrees. Slowly lower your right arm backward and left leg forward. Return to start and repeat on opposite sides.",
        durationSeconds: 45,
        reps: 0,
        sets: 1,
        restSeconds: 15,
        targetMuscle: "Lower Abdominals & Core Stability"
      },
      {
        name: "Russian Twists",
        description: "Sit with knees bent, feet flat on the floor (or elevated for a challenge). Lean back slightly, clasp hands, and twist your torso side to side, touching the floor beside your hips.",
        durationSeconds: 40,
        reps: 0,
        sets: 2,
        restSeconds: 15,
        targetMuscle: "Obliques & Core"
      },
      {
        name: "Leg Raises",
        description: "Lie on your back, hands under your hips for support. Keeping legs as straight as possible, lift them to 90 degrees, then lower them slowly, stopping just before they touch the ground.",
        durationSeconds: 40,
        reps: 0,
        sets: 1,
        restSeconds: 20,
        targetMuscle: "Rectus Abdominis / Lower Abs"
      },
      {
        name: "Cobra Stretch",
        description: "Lie face down, hands under shoulders. Gently push your chest up off the ground, stretching your abs. Hold and breathe deeply.",
        durationSeconds: 45,
        reps: 0,
        sets: 1,
        restSeconds: 0,
        targetMuscle: "Abdominal Stretch & Spine"
      }
    ]
  },
  {
    id: "curated_3",
    workoutTitle: "20-Min Lower Body Sculpt",
    workoutDescription: "A progressive lower body workout focusing on strength, endurance, and mobility. Excellent for calorie burning due to targeting large muscle groups.",
    totalDurationMinutes: 20,
    targetArea: "Lower Body",
    equipmentNeeded: ["Bodyweight"],
    createdAt: "Curated",
    coachingTips: [
      "Keep your bodyweight balanced in your heels during squats and lunges.",
      "Push your knees slightly outward when squatting—do not let them cave in.",
      "If you have dumbbells, you can hold them at your sides to increase intensity!"
    ],
    exercises: [
      {
        name: "Warm-up Bodyweight Squats",
        description: "Perform slow, controlled squats to warm up the knees, hips, and ankles. Focus on a deep range of motion.",
        durationSeconds: 60,
        reps: 0,
        sets: 1,
        restSeconds: 15,
        targetMuscle: "Quadriceps, Glutes & Hamstrings"
      },
      {
        name: "Reverse Lunges",
        description: "Step back with your right foot and lower your hips until your left thigh is parallel to the ground and your right knee points down. Push up through the front heel to return. Alternate legs.",
        durationSeconds: 45,
        reps: 0,
        sets: 2,
        restSeconds: 15,
        targetMuscle: "Quads, Glutes & Balance"
      },
      {
        name: "Glute Bridges",
        description: "Lie on your back with knees bent and feet flat. Squeeze glutes and raise hips. Hold for 1 second at the top.",
        durationSeconds: 45,
        reps: 0,
        sets: 2,
        restSeconds: 15,
        targetMuscle: "Glutes & Hamstrings"
      },
      {
        name: "Sumo Squats",
        description: "Take a wide stance with toes pointed outward at 45 degrees. Lower your hips down, feeling a stretch in the inner thighs. Drive back up and squeeze glutes.",
        durationSeconds: 45,
        reps: 0,
        sets: 2,
        restSeconds: 20,
        targetMuscle: "Inner Thighs, Adductors & Glutes"
      },
      {
        name: "Donkey Kicks (Left Side)",
        description: "Get on all fours. Keep your left knee at 90 degrees, kick your left heel straight up toward the ceiling. Squeeze your left glute at the peak.",
        durationSeconds: 30,
        reps: 0,
        sets: 1,
        restSeconds: 10,
        targetMuscle: "Gluteus Maximus"
      },
      {
        name: "Donkey Kicks (Right Side)",
        description: "Switch sides and kick your right heel straight up toward the ceiling, keeping your core stable and hips square.",
        durationSeconds: 30,
        reps: 0,
        sets: 1,
        restSeconds: 15,
        targetMuscle: "Gluteus Maximus"
      },
      {
        name: "Calf Raises",
        description: "Stand straight. Raise up on your toes as high as possible, hold briefly, then lower slowly. Stand near a wall if you need balance help.",
        durationSeconds: 45,
        reps: 0,
        sets: 2,
        restSeconds: 15,
        targetMuscle: "Gastrocnemius & Soleus (Calves)"
      },
      {
        name: "Standing Quad & Glute Stretch",
        description: "Grab one foot behind you to stretch the thigh, then cross one ankle over the opposite knee and bend to stretch the glute. Repeat on both sides.",
        durationSeconds: 60,
        reps: 0,
        sets: 1,
        restSeconds: 0,
        targetMuscle: "Quadriceps & Glutes Recovery"
      }
    ]
  },
  {
    id: "curated_4",
    workoutTitle: "12-Min Upper Body Push & Pull",
    workoutDescription: "A balanced upper-body session pairing pressing and pulling-style bodyweight moves so your chest, back, shoulders and arms all get equal attention.",
    totalDurationMinutes: 12,
    targetArea: "Upper Body",
    equipmentNeeded: ["Bodyweight"],
    createdAt: "Curated",
    coachingTips: [
      "Keep wrists stacked under elbows during every pressing movement.",
      "Squeeze your shoulder blades together on every pulling motion.",
      "Quality over speed — a slow, controlled rep beats a fast sloppy one."
    ],
    exercises: [
      { name: "Wall Push-ups", description: "Stand arm's length from a wall, hands flat at chest height. Bend your elbows to bring your chest toward the wall, then press back. A gentle way to warm up the pressing muscles.", durationSeconds: 40, reps: 0, sets: 1, restSeconds: 15, targetMuscle: "Chest & Triceps" },
      { name: "Superman Pulls", description: "Lie face down, arms extended overhead. Lift your chest and legs slightly, then pull your elbows back like rowing. Squeeze your back at the top.", durationSeconds: 40, reps: 0, sets: 2, restSeconds: 15, targetMuscle: "Upper & Lower Back" },
      { name: "Classic Push-ups", description: "Hands slightly wider than shoulders, body in a straight line. Lower your chest to the floor and press back up with control.", durationSeconds: 40, reps: 0, sets: 2, restSeconds: 20, targetMuscle: "Chest, Shoulders & Triceps" },
      { name: "Chair Tricep Dips", description: "Hands on the edge of a sturdy chair, legs extended. Bend your elbows to lower your hips, then press back up.", durationSeconds: 35, reps: 0, sets: 2, restSeconds: 15, targetMuscle: "Triceps & Shoulders" },
      { name: "Prone Y-Raises", description: "Lie face down, arms extended overhead in a 'Y' shape. Lift your arms a few inches off the ground, hold briefly, then lower.", durationSeconds: 35, reps: 0, sets: 2, restSeconds: 15, targetMuscle: "Rear Delts & Upper Back" },
      { name: "Standing Chest & Shoulder Stretch", description: "Clasp your hands behind your back and gently lift, opening the chest. Breathe deeply and hold.", durationSeconds: 45, reps: 0, sets: 1, restSeconds: 0, targetMuscle: "Chest & Shoulder Mobility" }
    ]
  },
  {
    id: "curated_5",
    workoutTitle: "18-Min Cardio HIIT Ignition",
    workoutDescription: "Short, sharp intervals designed to spike your heart rate, torch calories, and build conditioning — all scalable to any fitness level.",
    totalDurationMinutes: 18,
    targetArea: "Cardio Blitz",
    equipmentNeeded: ["Bodyweight"],
    createdAt: "Curated",
    coachingTips: [
      "Scale intensity to your level — step instead of jump if needed.",
      "Keep your core braced throughout every interval to protect your spine.",
      "Full recovery breaths during rest — don't rush back in gasping."
    ],
    exercises: [
      { name: "Jumping Jacks", description: "Full-body rhythmic cardio starter. Jump feet out while raising arms overhead, then back to start.", durationSeconds: 40, reps: 0, sets: 2, restSeconds: 15, targetMuscle: "Cardiovascular System" },
      { name: "High Knees", description: "Drive your knees up toward your chest rapidly while pumping your arms. Stay light on your feet.", durationSeconds: 30, reps: 0, sets: 2, restSeconds: 15, targetMuscle: "Cardio / Hip Flexors" },
      { name: "Low-impact Burpee", description: "Step back into a plank, step back in, then stand tall (add a hop if comfortable). A full-body conditioning classic.", durationSeconds: 35, reps: 0, sets: 2, restSeconds: 20, targetMuscle: "Full Body / Conditioning" },
      { name: "Mountain Climbers", description: "From a high plank, alternate driving your knees toward your chest at a controlled, sustainable pace.", durationSeconds: 30, reps: 0, sets: 2, restSeconds: 15, targetMuscle: "Core & Conditioning" },
      { name: "Skater Hops", description: "Hop laterally from one foot to the other in a skating motion, swinging your arms for balance and momentum.", durationSeconds: 30, reps: 0, sets: 2, restSeconds: 15, targetMuscle: "Glutes / Lateral Stability" },
      { name: "Standing Forward Fold", description: "Slowly roll down vertebra by vertebra, letting your arms hang. A calming cooldown stretch for the whole posterior chain.", durationSeconds: 45, reps: 0, sets: 1, restSeconds: 0, targetMuscle: "Hamstrings & Lower Back" }
    ]
  },
  {
    id: "curated_6",
    workoutTitle: "15-Min Flexibility & Recovery Flow",
    workoutDescription: "A slow, breath-led mobility sequence to release tight hips, shoulders and spine — perfect on rest days or before bed.",
    totalDurationMinutes: 15,
    targetArea: "Flexibility",
    equipmentNeeded: ["Yoga Mat"],
    createdAt: "Curated",
    coachingTips: [
      "Move slowly — mobility work rewards patience, not speed.",
      "Never stretch into sharp pain, only a comfortable pull.",
      "Sync each movement with a slow inhale or exhale."
    ],
    exercises: [
      { name: "Cat-Cow Dynamic Stretch", description: "On all fours, alternate arching (Cow) and rounding (Cat) your spine in rhythm with your breath.", durationSeconds: 60, reps: 0, sets: 1, restSeconds: 0, targetMuscle: "Spinal Mobility" },
      { name: "World's Greatest Stretch", description: "From a deep lunge, plant both hands inside your front foot and rotate your torso toward the ceiling, opening the chest.", durationSeconds: 45, reps: 0, sets: 1, restSeconds: 10, targetMuscle: "Hips, Hamstrings & Thoracic Spine" },
      { name: "Cobra Stretch", description: "Lie face down, push your chest up gently through your hands, keeping hips on the floor.", durationSeconds: 45, reps: 0, sets: 1, restSeconds: 0, targetMuscle: "Abdominals & Spine" },
      { name: "Seated Forward Fold", description: "Sit with legs extended, hinge forward from the hips reaching toward your feet. Keep your back long.", durationSeconds: 50, reps: 0, sets: 1, restSeconds: 10, targetMuscle: "Hamstrings & Lower Back" },
      { name: "Standing Quad & Glute Stretch", description: "Grab one foot behind you to stretch the thigh, then cross an ankle over the opposite knee and fold forward.", durationSeconds: 60, reps: 0, sets: 1, restSeconds: 0, targetMuscle: "Quadriceps & Glutes" },
      { name: "Supine Spinal Twist", description: "Lying on your back, drop both knees to one side while keeping shoulders flat. Breathe deeply, then switch sides.", durationSeconds: 60, reps: 0, sets: 1, restSeconds: 0, targetMuscle: "Spinal Mobility & Obliques" }
    ]
  }
];

/* ---------------------------------------------------------------------
 * Multi-week coaching programs (Premium). Each program day points at a
 * CURATED_WORKOUTS index so "Start" always launches a real, fully-formed
 * workout — nothing here is a placeholder or a fake data point.
 * ------------------------------------------------------------------- */

function buildWeek(week: number, theme: string, pattern: (number | null)[]): ProgramWeek {
  const days: ProgramDay[] = pattern.map((curatedIndex, i) => {
    if (curatedIndex === null) {
      return { day: i + 1, title: `Day ${i + 1}`, focus: "Active Recovery", isRestDay: true };
    }
    const w = CURATED_WORKOUTS[curatedIndex];
    return { day: i + 1, title: `Day ${i + 1} · ${w.workoutTitle}`, focus: w.targetArea, curatedIndex };
  });
  return { week, theme, days };
}

export const PROGRAM_PLANS: ProgramPlan[] = [
  {
    id: "prog_foundation",
    title: "4-Week Foundation Builder",
    tagline: "Build the habit first. Full-body basics, sustainable pacing.",
    level: "Beginner",
    goal: "General Health",
    weeks: [
      buildWeek(1, "Learn the movements", [0, null, 2, null, 5, null, null]),
      buildWeek(2, "Add a session", [0, 2, null, 5, 0, null, null]),
      buildWeek(3, "Build consistency", [0, 2, 1, null, 5, 0, null]),
      buildWeek(4, "Lock in the habit", [0, 2, 1, 5, 0, 2, null]),
    ],
  },
  {
    id: "prog_strength",
    title: "6-Week Strength Surge",
    tagline: "Upper/lower split with progressive overload mindset.",
    level: "Intermediate",
    goal: "Strength",
    weeks: [1, 2, 3, 4, 5, 6].map(w =>
      buildWeek(w, w <= 2 ? "Foundation phase" : w <= 4 ? "Build phase" : "Peak phase",
        [4, 2, null, 4, 2, 1, null])
    ),
  },
  {
    id: "prog_cardio",
    title: "2-Week Cardio Kickstart",
    tagline: "Short, intense conditioning to jumpstart your engine.",
    level: "Intermediate",
    goal: "Cardio / Fat Loss",
    weeks: [
      buildWeek(1, "Build your engine", [5, null, 1, 5, null, 0, null]),
      buildWeek(2, "Push the pace", [5, 1, null, 5, 0, 5, null]),
    ],
  },
  {
    id: "prog_mobility",
    title: "4-Week Mobility & Recovery Reset",
    tagline: "Undo the desk-hunch. Daily mobility for a resilient body.",
    level: "Beginner",
    goal: "Flexibility",
    weeks: [1, 2, 3, 4].map(w => buildWeek(w, "Open up & recover", [5, 2, 5, null, 5, 1, 5])),
  },
];
