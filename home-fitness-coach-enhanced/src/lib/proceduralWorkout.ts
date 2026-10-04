// Procedural Biomechanical Synthesizer
// Provides structured, safe, multi-planar routines tailored to user parameters
// Runs both on the server (server.ts) and on-device in mobile clients

export interface ProceduralWorkoutOptions {
  fitnessLevel: string;
  goal: string;
  duration: number;
  targetArea: string;
  equipment: string[];
  healthNotes?: string;
}

export interface GeneratedExercise {
  name: string;
  description: string;
  targetMuscle: string;
  durationSeconds: number;
  reps: number;
  sets: number;
  restSeconds: number;
}

export interface GeneratedWorkoutPlan {
  workoutTitle: string;
  workoutDescription: string;
  totalDurationMinutes: number;
  targetArea: string;
  equipmentNeeded: string[];
  exercises: GeneratedExercise[];
  coachingTips: string[];
  engine: string;
  isRealGemini: boolean;
  fallbackUsed?: boolean;
}

export function generateApexNeuralWorkout(options: ProceduralWorkoutOptions): GeneratedWorkoutPlan {
  const { fitnessLevel, goal, duration, targetArea, equipment } = options;

  // Kinetic movement database categorized by plane and joint vectors
  const movementsByRegion: Record<string, Array<{ name: string; description: string; targetMuscle: string; durationSeconds: number; reps: number; restSeconds: number }>> = {
    "Upper Body": [
      { name: "Classic Push-ups", description: "Standard shoulder-width press, maintaining rigid core alignment and full scapular retraction on the descent.", targetMuscle: "Pectoralis Major & Triceps Brachii", durationSeconds: 0, reps: fitnessLevel === "Advanced" ? 22 : fitnessLevel === "Intermediate" ? 14 : 8, restSeconds: 25 },
      { name: "Archer Push-up Glide", description: "Unilateral eccentric glide sliding the torso laterally across the primary pressing arm to overload single-side pectorals.", targetMuscle: "Sternocostal Pectorals & Anterior Deltoid", durationSeconds: 0, reps: fitnessLevel === "Advanced" ? 12 : 8, restSeconds: 30 },
      { name: "Pike Push-ups", description: "Hips elevated into a high inverted V. Press vertically downward aligning load directly along the clavicular deltoid vector.", targetMuscle: "Anterior Deltoids & Upper Trapezius", durationSeconds: 0, reps: fitnessLevel === "Advanced" ? 15 : 10, restSeconds: 30 },
      { name: "Scapular Incline Matrix", description: "Isometric protraction with rhythmic arm pulses to activate the serratus anterior and rotator cuff stabilization.", targetMuscle: "Serratus Anterior & Rotator Cuff", durationSeconds: 40, reps: 0, restSeconds: 20 },
      { name: "Diamond Push-ups", description: "Narrow thumb-to-index hand placement directly beneath the sternum to direct peak torque through the medial triceps.", targetMuscle: "Medial Triceps & Sternum Pecs", durationSeconds: 0, reps: fitnessLevel === "Advanced" ? 16 : 9, restSeconds: 30 },
      { name: "Offset Kinetic Scapular Push-up", description: "Asymmetrical hand positioning inducing rotational trunk anti-flexion while demanding unilateral shoulder stabilization.", targetMuscle: "Serratus Anterior & Deep Stabilizers", durationSeconds: 40, reps: 0, restSeconds: 20 },
      { name: "Prone Cobra Scapular Retraction", description: "Prone position with external humeral rotation, squeezing shoulder blades together against gravity for thoracic extension.", targetMuscle: "Rhomboids & Lower Trapezius", durationSeconds: 45, reps: 0, restSeconds: 15 }
    ],
    "Lower Body": [
      { name: "Bodyweight Squats", description: "Feet shoulder-width apart, hips tracking backward into full knee flexion, driving through mid-foot with upright spine.", targetMuscle: "Quadriceps, Glutes & Adductors", durationSeconds: 45, reps: 0, restSeconds: 20 },
      { name: "Triple-Extension Piston Squat", description: "Explosive rapid cadence squats with synchronous ankle plantarflexion, knee extension, and hip drive at apex.", targetMuscle: "Fast-Twitch Quadriceps & Gluteus", durationSeconds: 35, reps: 0, restSeconds: 25 },
      { name: "Jump Squats", description: "Dynamic reactive plyometric squats converting eccentric deceleration immediately into vertical propulsion.", targetMuscle: "Explosive Tendon Complex & Glutes", durationSeconds: 35, reps: 0, restSeconds: 30 },
      { name: "Pistol Deceleration Squat", description: "Single-leg eccentric lowering drill targeting unilateral hip stability, knee tracking, and ankle dorsiflexion.", targetMuscle: "Unilateral Quadriceps & Glute Medius", durationSeconds: 40, reps: 0, restSeconds: 25 },
      { name: "Reverse Lunges", description: "Controlled backward step maintaining 90° anterior knee angle and vertical torso, loading gluteal stretch.", targetMuscle: "Gluteus Maximus & Hamstrings", durationSeconds: 45, reps: 0, restSeconds: 20 },
      { name: "Glute Bridges", description: "Supine pelvic thrust driving through calcaneus, achieving full hip extension with 1-second peak isometric glute squeeze.", targetMuscle: "Gluteus Maximus & Posterior Chain", durationSeconds: 45, reps: 0, restSeconds: 20 },
      { name: "Curtsy Deficit Lunge Pulse", description: "Cross-body backward step loading the gluteus medius in the transverse plane with a 2-inch bottom pulse.", targetMuscle: "Gluteus Medius & Abductors", durationSeconds: 40, reps: 0, restSeconds: 20 }
    ],
    "Core / Abs": [
      { name: "Forearm Plank", description: "Elbows grounded below shoulders, pelvis tucked in posterior tilt, drawing navel upward toward spine with locked glutes.", targetMuscle: "Transverse Abdominis & Deep Core", durationSeconds: fitnessLevel === "Advanced" ? 60 : 40, reps: 0, restSeconds: 20 },
      { name: "Isometric Hollow Scapular Glide", description: "Lumbar spine anchored flat to floor, legs extended at 30°, small rhythmic arm reaches generating peak intra-abdominal pressure.", targetMuscle: "Rectus Abdominis & Transverse Core", durationSeconds: 40, reps: 0, restSeconds: 20 },
      { name: "Russian Twists", description: "Seated V-sit posture with heels hovering. Controlled torso rotation driving oblique recruitment across transverse plane.", targetMuscle: "Internal & External Obliques", durationSeconds: 40, reps: 0, restSeconds: 20 },
      { name: "Mountain Climbers", description: "High-plank posture with rapid alternating knee drives, stabilizing pelvic girdle against rotational torque.", targetMuscle: "Rectus Abdominis & Hip Flexors", durationSeconds: 35, reps: 0, restSeconds: 20 },
      { name: "Dead Bug", description: "Supine contra-lateral arm and leg extension keeping the lumbar spine pinned firmly to the floor throughout.", targetMuscle: "Deep Lumbar & Pelvic Stability", durationSeconds: 45, reps: 0, restSeconds: 15 },
      { name: "Side Plank Scapular Tap", description: "Lateral bridge with active bottom glute drive while the top arm reaches underneath the ribcage for rotary control.", targetMuscle: "Quadratus Lumborum & Obliques", durationSeconds: 35, reps: 0, restSeconds: 20 }
    ],
    "Cardio Blitz": [
      { name: "Jumping Jacks", description: "Coordinated kinetic jumps with rapid arm abduction and soft landing through the forefoot.", targetMuscle: "Cardiovascular System & Calves", durationSeconds: 45, reps: 0, restSeconds: 15 },
      { name: "Lateral Plyo Skater Bound", description: "Lateral bounding jump landing on single leg with 1-second eccentric deceleration stick to build lateral knee stability.", targetMuscle: "Gluteus Medius & Lateral Kinetic Chain", durationSeconds: 40, reps: 0, restSeconds: 20 },
      { name: "Low-impact Burpee", description: "Step-back burpee with strict plank check and upright reach, avoiding ballistic joint impact while elevating heart rate.", targetMuscle: "Full Body Metabolic Conditioning", durationSeconds: 40, reps: 0, restSeconds: 25 },
      { name: "High Knee Sprint Matrix", description: "Rapid piston knee drive to hip height with aggressive arm pump driving VO2 max stimulation.", targetMuscle: "Cardiopulmonary & Hip Flexors", durationSeconds: 30, reps: 0, restSeconds: 20 }
    ]
  };

  // Select appropriate movement pools based on target area
  let poolKey = "Upper Body";
  const normArea = (targetArea || "Full Body").toLowerCase();
  if (normArea.includes("lower") || normArea.includes("leg")) {
    poolKey = "Lower Body";
  } else if (normArea.includes("core") || normArea.includes("ab")) {
    poolKey = "Core / Abs";
  } else if (normArea.includes("cardio") || normArea.includes("hiit")) {
    poolKey = "Cardio Blitz";
  } else {
    poolKey = "Full Body";
  }

  let candidates: Array<{ name: string; description: string; targetMuscle: string; durationSeconds: number; reps: number; restSeconds: number }> = [];

  if (poolKey === "Full Body") {
    candidates = [
      ...movementsByRegion["Upper Body"],
      ...movementsByRegion["Lower Body"],
      ...movementsByRegion["Core / Abs"],
      ...movementsByRegion["Cardio Blitz"]
    ];
  } else {
    candidates = [...(movementsByRegion[poolKey] || movementsByRegion["Upper Body"])];
  }

  // Shuffle candidates to ensure variety
  const shuffled = candidates.sort(() => 0.5 - Math.random());
  const safeDuration = Number(duration) || 15;
  const exerciseCount = Math.min(6, Math.max(4, Math.round(safeDuration / 3)));
  const selected = shuffled.slice(0, exerciseCount);

  const exercises: GeneratedExercise[] = selected.map((ex) => ({
    ...ex,
    sets: fitnessLevel === "Advanced" ? 4 : fitnessLevel === "Intermediate" ? 3 : 2
  }));

  const safeTarget = targetArea || "Full Body";
  const safeLevel = fitnessLevel || "Beginner";
  const safeGoal = goal || "General Health";

  return {
    workoutTitle: `${safeDuration}-Min ${safeTarget} Protocol`,
    workoutDescription: `Biomechanical protocol customized for ${safeLevel.toLowerCase()} conditioning targeting ${safeTarget.toLowerCase()} for ${safeGoal.toLowerCase()}.`,
    totalDurationMinutes: safeDuration,
    targetArea: safeTarget,
    equipmentNeeded: equipment && equipment.length > 0 ? equipment : ["Bodyweight"],
    exercises,
    coachingTips: [
      "Maintain a 2-second eccentric phase on every repetition for muscular hypertrophy.",
      "Synchronize your breathing: exhale during exertion, inhale during reset.",
      "Engage your deep core stabilizers to protect spine and joints."
    ],
    engine: "procedural-biomechanical",
    isRealGemini: false
  };
}
