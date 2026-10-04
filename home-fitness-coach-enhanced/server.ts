import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Enable CORS for mobile apps (Capacitor/WebView) and web clients
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-gemini-key, x-app-secret");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const PORT = 3000;

// Initialize Gemini safely
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not defined.");
    }
    ai = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
}

// Rich generative biomechanical synthesizer providing dynamic variations tailored to user inputs
function generateApexNeuralWorkout(options: {
  fitnessLevel: string;
  goal: string;
  duration: number;
  targetArea: string;
  equipment: string[];
  healthNotes?: string;
}) {
  const { fitnessLevel, goal, duration, targetArea, equipment, healthNotes } = options;

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
  const normArea = targetArea.toLowerCase();
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
    candidates = [...movementsByRegion[poolKey]];
  }

  // Shuffle candidates to ensure variety
  const shuffled = candidates.sort(() => 0.5 - Math.random());
  const exerciseCount = Math.min(6, Math.max(4, Math.round(duration / 3)));
  const selected = shuffled.slice(0, exerciseCount);

  const exercises = selected.map((ex) => ({
    ...ex,
    sets: fitnessLevel === "Advanced" ? 4 : fitnessLevel === "Intermediate" ? 3 : 2
  }));

  return {
    workoutTitle: `${duration}-Min ${targetArea} Protocol`,
    workoutDescription: `Biomechanical protocol customized for ${fitnessLevel.toLowerCase()} conditioning targeting ${targetArea.toLowerCase()} for ${goal.toLowerCase()}.`,
    totalDurationMinutes: duration,
    targetArea,
    equipmentNeeded: equipment.length > 0 ? equipment : ["Bodyweight"],
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

// API endpoint to validate Gemini API key
app.post("/api/gemini/validate", async (req, res) => {
  const key = ((req.headers["x-gemini-key"] as string) || req.body?.apiKey || "").trim();
  if (!key) {
    return res.status(400).json({ valid: false, message: "No API key provided." });
  }

  try {
    const testAi = new GoogleGenAI({ apiKey: key });
    const response = await testAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Respond with the single word: OK",
    });
    if (response && response.text) {
      return res.json({ valid: true, message: "Gemini API key verified successfully!" });
    }
    return res.status(400).json({ valid: false, message: "No response from Gemini." });
  } catch (err: any) {
    return res.status(401).json({
      valid: false,
      message: err?.message || "Invalid Gemini API key or unauthorized access."
    });
  }
});

// API endpoint to generate custom AI workouts
app.post("/api/workouts/generate", async (req, res) => {
  const { fitnessLevel, goal, duration, targetArea, equipment, healthNotes, mode } = req.body ?? {};

  const safeDuration = Number.isFinite(Number(duration))
    ? Math.min(60, Math.max(5, Math.round(Number(duration))))
    : 20;
  const safeEquipment = Array.isArray(equipment)
    ? equipment.filter((e) => typeof e === "string").slice(0, 10)
    : [];
  const safeHealthNotes = typeof healthNotes === "string" ? healthNotes.slice(0, 500) : "";
  const safeFitnessLevel = typeof fitnessLevel === "string" ? fitnessLevel.slice(0, 50) : "Beginner";
  const safeGoal = typeof goal === "string" ? goal.slice(0, 50) : "General Health";
  const safeTargetArea = typeof targetArea === "string" ? targetArea.slice(0, 50) : "Full Body";

  // Check for client-supplied or environment Gemini API key
  const clientKey = ((req.headers["x-gemini-key"] as string) || req.body?.geminiApiKey || process.env.GEMINI_API_KEY || "").trim();
  const hasProvidedKey = clientKey.length > 20 && !clientKey.startsWith("MY_");

  // If user requested procedural mode or no key provided, use dynamic procedural engine
  if (mode === "procedural" || !hasProvidedKey) {
    const proceduralWorkout = generateApexNeuralWorkout({
      fitnessLevel: safeFitnessLevel,
      goal: safeGoal,
      duration: safeDuration,
      targetArea: safeTargetArea,
      equipment: safeEquipment,
      healthNotes: safeHealthNotes,
    });
    return res.json(proceduralWorkout);
  }

  // Attempt real live generation using Google Gemini AI
  try {
    const client = new GoogleGenAI({
      apiKey: clientKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `Generate a scientifically accurate, highly customized at-home workout routine:
- Fitness Level: ${safeFitnessLevel}
- Workout Goal: ${safeGoal}
- Duration: ${safeDuration} minutes
- Target Focus: ${safeTargetArea}
- Available Equipment: ${safeEquipment.length > 0 ? safeEquipment.join(", ") : "Bodyweight only"}
- Medical/Physical Constraints: ${safeHealthNotes || "None"}

BIOMECHANICAL DESIGN INSTRUCTIONS:
1. Synthesize 5 to 7 specific exercises matching the user's focus.
2. Mix proven foundational movements with innovative biomechanical variations tailored to the user's goal.
3. Every exercise must specify:
   - name: Descriptive biomechanical name (e.g. "Archer Push-up Glide", "Triple-Extension Piston Squat", "Isometric Hollow Scapular Glide")
   - targetMuscle: Exact anatomical muscles
   - description: Biomechanical execution and joint alignment cues
   - durationSeconds (0 if rep-based)
   - reps (e.g. 10 to 20, or 0 if time-based)
   - sets (2 to 4)
   - restSeconds (15 to 45)`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an elite certified exercise physiologist. Craft precise, scientifically-backed workout plans maximizing neuromuscular stimulus and biomechanical efficiency. Always return valid JSON matching the requested schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["workoutTitle", "workoutDescription", "totalDurationMinutes", "targetArea", "equipmentNeeded", "exercises", "coachingTips"],
          properties: {
            workoutTitle: { type: Type.STRING },
            workoutDescription: { type: Type.STRING },
            totalDurationMinutes: { type: Type.INTEGER },
            targetArea: { type: Type.STRING },
            equipmentNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "description", "durationSeconds", "reps", "sets", "restSeconds", "targetMuscle"],
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  durationSeconds: { type: Type.INTEGER },
                  reps: { type: Type.INTEGER },
                  sets: { type: Type.INTEGER },
                  restSeconds: { type: Type.INTEGER },
                  targetMuscle: { type: Type.STRING }
                }
              }
            },
            coachingTips: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const resultText = response.text || "{}";
    const workoutData = JSON.parse(resultText);
    return res.json({
      ...workoutData,
      engine: "gemini-2.5-flash",
      isRealGemini: true
    });
  } catch (error: any) {
    console.warn("Gemini API call failed, falling back to procedural biomechanical engine:", error?.message || error);
    // Graceful server fallback: never crash or return HTML; always serve a valid workout!
    const proceduralWorkout = generateApexNeuralWorkout({
      fitnessLevel: safeFitnessLevel,
      goal: safeGoal,
      duration: safeDuration,
      targetArea: safeTargetArea,
      equipment: safeEquipment,
      healthNotes: safeHealthNotes,
    });
    return res.json({
      ...proceduralWorkout,
      fallbackUsed: true,
      warning: "Synthesized via Biomechanical Procedural Engine (Gemini fallback active)"
    });
  }
});

// ---------------------------------------------------------------------
// REAL-TIME DUEL ROOMS & MATCHMAKING QUEUE (CHESS.COM STYLE)
// ---------------------------------------------------------------------
interface DuelParticipant {
  id: string;
  name: string;
  avatar: string;
  reps: number;
  ready: boolean;
}

interface ServerDuelRoom {
  id: string;
  exerciseName: string;
  format: "time_blitz" | "rep_race";
  targetValue: number;
  timeSeconds: number;
  targetReps: number;
  videoDemoUrl: string;
  host: DuelParticipant;
  guest: DuelParticipant | null;
  status: "waiting" | "active" | "finished";
  createdAt: number;
}

interface QueueTicket {
  ticketId: string;
  user: DuelParticipant;
  exerciseName: string;
  format: "time_blitz" | "rep_race";
  targetValue: number;
  createdAt: number;
  matchedRoomId?: string;
}

const activeRooms: Map<string, ServerDuelRoom> = new Map();
const waitingQueue: Map<string, QueueTicket> = new Map();

// Join Matchmaking Queue
app.post("/api/duel/queue/join", (req, res) => {
  const { user, exerciseName, format, targetValue } = req.body;
  if (!user || !user.id || !exerciseName) {
    return res.status(400).json({ error: "Missing required matchmaking parameters" });
  }

  // Check if someone else in the queue matches this exercise and format
  for (const [otherTicketId, otherTicket] of waitingQueue.entries()) {
    if (
      otherTicket.user.id !== user.id &&
      otherTicket.exerciseName.toLowerCase() === exerciseName.toLowerCase() &&
      otherTicket.format === format &&
      !otherTicket.matchedRoomId
    ) {
      // Match found!
      const roomId = `room_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const videoMap: Record<string, string> = {
        "Classic Push-ups": "/videos/Classic pushup.mp4",
        "Jump Squats": "/videos/jumpsquat.mp4",
        "Diamond Push-ups": "/videos/Diamond Push-ups.mp4",
        "Mountain Climbers": "/videos/Mountain Climbers.mp4",
        "Burpees": "/videos/burpees.mp4",
        "Forearm Plank": "/videos/Forearm plank.mp4",
      };

      const room: ServerDuelRoom = {
        id: roomId,
        exerciseName,
        format,
        targetValue: targetValue || otherTicket.targetValue,
        timeSeconds: format === "time_blitz" ? (targetValue || 45) : 60,
        targetReps: format === "rep_race" ? (targetValue || 35) : 30,
        videoDemoUrl: videoMap[exerciseName] || "/videos/Classic pushup.mp4",
        host: otherTicket.user,
        guest: user,
        status: "active",
        createdAt: Date.now(),
      };

      activeRooms.set(roomId, room);
      otherTicket.matchedRoomId = roomId;

      // Clean up tickets
      setTimeout(() => {
        waitingQueue.delete(otherTicketId);
      }, 5000);

      return res.json({
        status: "matched",
        roomId,
        room,
        opponent: otherTicket.user,
      });
    }
  }

  // No match immediately available; enqueue ticket
  const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const ticket: QueueTicket = {
    ticketId,
    user,
    exerciseName,
    format: format || "time_blitz",
    targetValue: targetValue || 45,
    createdAt: Date.now(),
  };

  waitingQueue.set(ticketId, ticket);
  return res.json({
    status: "waiting",
    ticketId,
    queueSize: waitingQueue.size,
  });
});

// Poll Matchmaking Queue
app.get("/api/duel/queue/poll/:ticketId", (req, res) => {
  const ticket = waitingQueue.get(req.params.ticketId);
  if (!ticket) {
    return res.json({ status: "expired" });
  }

  if (ticket.matchedRoomId) {
    const room = activeRooms.get(ticket.matchedRoomId);
    return res.json({
      status: "matched",
      roomId: ticket.matchedRoomId,
      room,
      opponent: room?.guest?.id === ticket.user.id ? room.host : room?.guest,
    });
  }

  return res.json({ status: "waiting", elapsedMs: Date.now() - ticket.createdAt });
});

// Leave Queue
app.post("/api/duel/queue/leave", (req, res) => {
  const { ticketId } = req.body;
  if (ticketId) {
    waitingQueue.delete(ticketId);
  }
  return res.json({ ok: true });
});

// Create Custom Shareable Duel Room
app.post("/api/duel/room/create", (req, res) => {
  const { host, exerciseName, format, targetValue, timeSeconds, targetReps } = req.body;
  if (!host || !exerciseName) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const roomId = `duel_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const videoMap: Record<string, string> = {
    "Classic Push-ups": "/videos/Classic pushup.mp4",
    "Jump Squats": "/videos/jumpsquat.mp4",
    "Diamond Push-ups": "/videos/Diamond Push-ups.mp4",
    "Mountain Climbers": "/videos/Mountain Climbers.mp4",
    "Burpees": "/videos/burpees.mp4",
    "Forearm Plank": "/videos/Forearm plank.mp4",
  };

  const room: ServerDuelRoom = {
    id: roomId,
    exerciseName,
    format: format || "time_blitz",
    targetValue: targetValue || 45,
    timeSeconds: timeSeconds || (format === "time_blitz" ? targetValue : 60),
    targetReps: targetReps || (format === "rep_race" ? targetValue : 30),
    videoDemoUrl: videoMap[exerciseName] || "/videos/Classic pushup.mp4",
    host,
    guest: null,
    status: "waiting",
    createdAt: Date.now(),
  };

  activeRooms.set(roomId, room);
  return res.json({ ok: true, roomId, room });
});

// Get Room State
app.get("/api/duel/room/:id", (req, res) => {
  const room = activeRooms.get(req.params.id);
  if (!room) {
    return res.status(404).json({ error: "Room not found or expired" });
  }
  return res.json(room);
});

// Join Room via Share Link
app.post("/api/duel/room/:id/join", (req, res) => {
  const room = activeRooms.get(req.params.id);
  if (!room) {
    return res.status(404).json({ error: "Room not found or expired" });
  }

  const { guest } = req.body;
  if (!guest || !guest.id) {
    return res.status(400).json({ error: "Guest profile required" });
  }

  if (room.host.id === guest.id) {
    return res.json({ ok: true, room, isHost: true });
  }

  room.guest = guest;
  room.status = "active";
  return res.json({ ok: true, room, isHost: false });
});

// Get Open Challenges Lobby
app.get("/api/duel/lobby", (_req, res) => {
  const waitingRooms = Array.from(activeRooms.values())
    .filter((r) => r.status === "waiting" && Date.now() - r.createdAt < 30 * 60 * 1000)
    .slice(0, 10);
  return res.json({ rooms: waitingRooms, activeCount: activeRooms.size });
});

// Serve static assets or mount Vite middleware
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    // In development mode, load Vite's dev server middleware
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted.");
  } else {
    // Serve pre-built static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
