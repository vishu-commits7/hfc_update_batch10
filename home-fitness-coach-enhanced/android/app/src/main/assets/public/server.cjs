"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
app.use(import_express.default.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-gemini-key, x-app-secret");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
var PORT = 3e3;
function generateApexNeuralWorkout(options) {
  const { fitnessLevel, goal, duration, targetArea, equipment, healthNotes: _healthNotes } = options;
  const movementsByRegion = {
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
      { name: "Reverse Lunges", description: "Controlled backward step maintaining 90\xB0 anterior knee angle and vertical torso, loading gluteal stretch.", targetMuscle: "Gluteus Maximus & Hamstrings", durationSeconds: 45, reps: 0, restSeconds: 20 },
      { name: "Glute Bridges", description: "Supine pelvic thrust driving through calcaneus, achieving full hip extension with 1-second peak isometric glute squeeze.", targetMuscle: "Gluteus Maximus & Posterior Chain", durationSeconds: 45, reps: 0, restSeconds: 20 },
      { name: "Curtsy Deficit Lunge Pulse", description: "Cross-body backward step loading the gluteus medius in the transverse plane with a 2-inch bottom pulse.", targetMuscle: "Gluteus Medius & Abductors", durationSeconds: 40, reps: 0, restSeconds: 20 }
    ],
    "Core / Abs": [
      { name: "Forearm Plank", description: "Elbows grounded below shoulders, pelvis tucked in posterior tilt, drawing navel upward toward spine with locked glutes.", targetMuscle: "Transverse Abdominis & Deep Core", durationSeconds: fitnessLevel === "Advanced" ? 60 : 40, reps: 0, restSeconds: 20 },
      { name: "Isometric Hollow Scapular Glide", description: "Lumbar spine anchored flat to floor, legs extended at 30\xB0, small rhythmic arm reaches generating peak intra-abdominal pressure.", targetMuscle: "Rectus Abdominis & Transverse Core", durationSeconds: 40, reps: 0, restSeconds: 20 },
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
  let candidates = [];
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
var ANDROID_PACKAGE = "com.homefitnesscoach.app";
var PLAY_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
app.get("/.well-known/assetlinks.json", (_req, res) => {
  const prints = (process.env.ANDROID_CERT_SHA256 || "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  res.type("application/json").send(JSON.stringify(prints.length ? [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: prints }
  }] : []));
});
app.get("/join", (req, res) => {
  const pick = (k) => {
    const v = String(req.query[k] || "").toUpperCase();
    return /^[A-Z0-9]{4,8}$/.test(v) ? v : "";
  };
  const kind = ["crew", "room", "invite"].find((k) => pick(k)) || null;
  const code = kind ? pick(kind) : "";
  const title = kind === "crew" ? "You're invited to a crew" : kind === "room" ? "You're challenged to a match" : kind === "invite" ? "Train with a friend" : "Apex Pulse";
  const line = kind === "crew" ? "Join the crew and hit a weekly goal together." : kind === "room" ? "A 1v1 rep battle is waiting for you in the Arena." : kind === "invite" ? "Use your friend's code before your first workout and you both get a streak freeze." : "Home workouts, live 1v1 rep battles and leagues.";
  const q = kind ? `?${kind}=${code}` : "";
  const intent = `intent://join${q}#Intent;scheme=apexpulse;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_URL)};end`;
  res.set("Cache-Control", "public, max-age=300").type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} \xB7 Apex Pulse</title>
<meta property="og:title" content="${title} on Apex Pulse"><meta property="og:description" content="${line}">
<meta property="og:image" content="/app-logo.jpg"><meta name="theme-color" content="#0a0a0c">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0c;color:#f3f6fb;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px}
main{width:100%;max-width:400px;text-align:center}img{width:72px;height:72px;border-radius:18px}
h1{font-size:26px;line-height:1.2;margin:18px 0 8px}p{color:#a5adbd;margin:0 0 20px}
.code{display:inline-block;margin:0 0 22px;padding:10px 18px;border:1px solid #2a2f3a;border-radius:14px;background:#12141c;font-weight:800;font-size:22px;letter-spacing:.2em}
a{display:flex;align-items:center;justify-content:center;min-height:54px;border-radius:16px;font-weight:800;text-decoration:none;margin-top:10px}
.go{background:#c8ff3d;color:#0a0a0c}.get{border:1px solid #2a2f3a;color:#f3f6fb}.web{color:#8f98a8;font-weight:600;font-size:14px;min-height:44px}
small{display:block;margin-top:18px;color:#737f95}
</style></head><body><main>
<img src="/app-logo.jpg" alt="">
<h1>${title}</h1><p>${line}</p>
${code ? `<div class="code" aria-label="Code ${code.split("").join(" ")}">${code}</div>` : ""}
<a class="go" id="open" href="${intent}">Open in the Apex Pulse app</a>
<a class="get" href="${PLAY_URL}">Get the app on Google Play</a>
<a class="web" href="/${q}">Continue in the browser instead</a>
${code ? `<small>If the app opens without the code, enter ${code} in Arena.</small>` : ""}
</main>
<script>
// "Open in the app" only works on Android. Elsewhere it becomes the Play Store link.
if(!/Android/i.test(navigator.userAgent)){var a=document.getElementById("open");a.href=${JSON.stringify(PLAY_URL)};a.textContent="Apex Pulse is on Android";}
</script></body></html>`);
});
app.get("/api/health", (_req, res) => {
  return res.json({
    status: "ok",
    timestamp: Date.now(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    mode: process.env.NODE_ENV || "development"
  });
});
app.use("/__/auth", async (req, res) => {
  try {
    const targetUrl = `https://fitness-app-1e5f0.firebaseapp.com/__/auth${req.url}`;
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headers[k] = v;
    }
    headers["host"] = "fitness-app-1e5f0.firebaseapp.com";
    const fetchRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? void 0 : JSON.stringify(req.body)
    });
    res.status(fetchRes.status);
    fetchRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });
    const buffer = await fetchRes.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.warn("Auth proxy error:", err?.message || err);
    return res.status(502).json({ error: "Auth proxy error", message: err?.message });
  }
});
app.post("/api/exercises/generate-image", async (req, res) => {
  const { name, targetMuscle, compartment } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: "Exercise name is required" });
  }
  const clientKey = (req.headers["x-gemini-key"] || req.body?.geminiApiKey || process.env.GEMINI_API_KEY || "").trim();
  const hasKey = clientKey.length > 20 && !clientKey.startsWith("MY_");
  if (hasKey) {
    try {
      const genai = new import_genai.GoogleGenAI({
        apiKey: clientKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      const prompt = `Photorealistic cinematic gym photography: an athletic fitness model performing the signature apex pose of ${name} (${targetMuscle || compartment || "Athletic"}) inside a luxury modern gym. Crisp dramatic gym lighting, dark slate and matte steel background, authentic athletic posture, anatomical muscle definition, 8k resolution, photorealistic style.`;
      const imgResponse = await genai.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: "1:1",
          outputMimeType: "image/jpeg"
        }
      });
      if (imgResponse?.generatedImages?.[0]?.image?.imageBytes) {
        return res.json({
          success: true,
          imageUrl: `data:image/jpeg;base64,${imgResponse.generatedImages[0].image.imageBytes}`,
          engine: "imagen-3.0-generate-002",
          prompt
        });
      }
    } catch (err) {
      console.warn("Imagen generation error, fallback active:", err?.message || err);
    }
  }
  return res.json({
    success: true,
    imageUrl: null,
    fallback: true,
    message: "Procedural gym photo archetype assigned"
  });
});
app.get("/api/health", (_req, res) => {
  return res.json({ ok: true, status: "healthy", timestamp: Date.now() });
});
app.post("/api/gemini/validate", async (req, res) => {
  const key = (req.headers["x-gemini-key"] || req.body?.apiKey || "").trim();
  if (!key) {
    return res.status(400).json({ valid: false, message: "No API key provided." });
  }
  try {
    const testAi = new import_genai.GoogleGenAI({ apiKey: key });
    const response = await testAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Respond with the single word: OK"
    });
    if (response && response.text) {
      return res.json({ valid: true, message: "Gemini API key verified successfully!" });
    }
    return res.status(400).json({ valid: false, message: "No response from Gemini." });
  } catch (err) {
    return res.status(401).json({
      valid: false,
      message: err?.message || "Invalid Gemini API key or unauthorized access."
    });
  }
});
app.post("/api/workouts/generate", async (req, res) => {
  const { fitnessLevel, goal, duration, targetArea, equipment, healthNotes, mode } = req.body ?? {};
  const safeDuration = Number.isFinite(Number(duration)) ? Math.min(60, Math.max(5, Math.round(Number(duration)))) : 20;
  const safeEquipment = Array.isArray(equipment) ? equipment.filter((e) => typeof e === "string").slice(0, 10) : [];
  const safeHealthNotes = typeof healthNotes === "string" ? healthNotes.slice(0, 500) : "";
  const safeFitnessLevel = typeof fitnessLevel === "string" ? fitnessLevel.slice(0, 50) : "Beginner";
  const safeGoal = typeof goal === "string" ? goal.slice(0, 50) : "General Health";
  const safeTargetArea = typeof targetArea === "string" ? targetArea.slice(0, 50) : "Full Body";
  const clientKey = (req.headers["x-gemini-key"] || req.body?.geminiApiKey || process.env.GEMINI_API_KEY || "").trim();
  const hasProvidedKey = clientKey.length > 20 && !clientKey.startsWith("MY_");
  if (mode === "procedural" || !hasProvidedKey) {
    const proceduralWorkout = generateApexNeuralWorkout({
      fitnessLevel: safeFitnessLevel,
      goal: safeGoal,
      duration: safeDuration,
      targetArea: safeTargetArea,
      equipment: safeEquipment,
      healthNotes: safeHealthNotes
    });
    return res.json(proceduralWorkout);
  }
  try {
    const client = new import_genai.GoogleGenAI({
      apiKey: clientKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
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
          type: import_genai.Type.OBJECT,
          required: ["workoutTitle", "workoutDescription", "totalDurationMinutes", "targetArea", "equipmentNeeded", "exercises", "coachingTips"],
          properties: {
            workoutTitle: { type: import_genai.Type.STRING },
            workoutDescription: { type: import_genai.Type.STRING },
            totalDurationMinutes: { type: import_genai.Type.INTEGER },
            targetArea: { type: import_genai.Type.STRING },
            equipmentNeeded: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
            exercises: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                required: ["name", "description", "durationSeconds", "reps", "sets", "restSeconds", "targetMuscle"],
                properties: {
                  name: { type: import_genai.Type.STRING },
                  description: { type: import_genai.Type.STRING },
                  durationSeconds: { type: import_genai.Type.INTEGER },
                  reps: { type: import_genai.Type.INTEGER },
                  sets: { type: import_genai.Type.INTEGER },
                  restSeconds: { type: import_genai.Type.INTEGER },
                  targetMuscle: { type: import_genai.Type.STRING }
                }
              }
            },
            coachingTips: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } }
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
  } catch (error) {
    console.warn("Gemini API call failed, falling back to procedural biomechanical engine:", error?.message || error);
    const proceduralWorkout = generateApexNeuralWorkout({
      fitnessLevel: safeFitnessLevel,
      goal: safeGoal,
      duration: safeDuration,
      targetArea: safeTargetArea,
      equipment: safeEquipment,
      healthNotes: safeHealthNotes
    });
    return res.json({
      ...proceduralWorkout,
      fallbackUsed: true,
      warning: "Synthesized via Biomechanical Procedural Engine (Gemini fallback active)"
    });
  }
});
var activeRooms = /* @__PURE__ */ new Map();
var waitingQueue = /* @__PURE__ */ new Map();
app.post("/api/duel/queue/join", (req, res) => {
  const { user, exerciseName, format, targetValue } = req.body;
  if (!user || !user.id || !exerciseName) {
    return res.status(400).json({ error: "Missing required matchmaking parameters" });
  }
  for (const [otherTicketId, otherTicket] of waitingQueue.entries()) {
    if (otherTicket.user.id !== user.id && otherTicket.exerciseName.toLowerCase() === exerciseName.toLowerCase() && otherTicket.format === format && !otherTicket.matchedRoomId) {
      const roomId = `room_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const videoMap = {
        "Classic Push-ups": "/videos/Classic pushup.mp4",
        "Jump Squats": "/videos/jumpsquat.mp4",
        "Diamond Push-ups": "/videos/Diamond Push-ups.mp4",
        "Mountain Climbers": "/videos/Mountain Climbers.mp4",
        "Burpees": "/videos/burpees.mp4",
        "Forearm Plank": "/videos/Forearm plank.mp4"
      };
      const room = {
        id: roomId,
        exerciseName,
        format,
        targetValue: targetValue || otherTicket.targetValue,
        timeSeconds: format === "time_blitz" ? targetValue || 45 : 60,
        targetReps: format === "rep_race" ? targetValue || 35 : 30,
        videoDemoUrl: videoMap[exerciseName] || "/videos/Classic pushup.mp4",
        host: otherTicket.user,
        guest: user,
        status: "active",
        createdAt: Date.now()
      };
      activeRooms.set(roomId, room);
      otherTicket.matchedRoomId = roomId;
      setTimeout(() => {
        waitingQueue.delete(otherTicketId);
      }, 5e3);
      return res.json({
        status: "matched",
        roomId,
        room,
        opponent: otherTicket.user
      });
    }
  }
  const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const ticket = {
    ticketId,
    user,
    exerciseName,
    format: format || "time_blitz",
    targetValue: targetValue || 45,
    createdAt: Date.now()
  };
  waitingQueue.set(ticketId, ticket);
  return res.json({
    status: "waiting",
    ticketId,
    queueSize: waitingQueue.size
  });
});
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
      opponent: room?.guest?.id === ticket.user.id ? room.host : room?.guest
    });
  }
  return res.json({ status: "waiting", elapsedMs: Date.now() - ticket.createdAt });
});
app.post("/api/duel/queue/leave", (req, res) => {
  const { ticketId } = req.body;
  if (ticketId) {
    waitingQueue.delete(ticketId);
  }
  return res.json({ ok: true });
});
app.post("/api/duel/room/create", (req, res) => {
  const { host, exerciseName, format, targetValue, timeSeconds, targetReps } = req.body;
  if (!host || !exerciseName) {
    return res.status(400).json({ error: "Missing required parameters" });
  }
  const roomId = `duel_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const videoMap = {
    "Classic Push-ups": "/videos/Classic pushup.mp4",
    "Jump Squats": "/videos/jumpsquat.mp4",
    "Diamond Push-ups": "/videos/Diamond Push-ups.mp4",
    "Mountain Climbers": "/videos/Mountain Climbers.mp4",
    "Burpees": "/videos/burpees.mp4",
    "Forearm Plank": "/videos/Forearm plank.mp4"
  };
  const room = {
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
    createdAt: Date.now()
  };
  activeRooms.set(roomId, room);
  return res.json({ ok: true, roomId, room });
});
app.get("/api/duel/room/:id", (req, res) => {
  const room = activeRooms.get(req.params.id);
  if (!room) {
    return res.status(404).json({ error: "Room not found or expired" });
  }
  return res.json(room);
});
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
app.get("/api/duel/lobby", (_req, res) => {
  const waitingRooms = Array.from(activeRooms.values()).filter((r) => r.status === "waiting" && Date.now() - r.createdAt < 30 * 60 * 1e3).slice(0, 10);
  return res.json({ rooms: waitingRooms, activeCount: activeRooms.size });
});
var startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted.");
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
};
startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
//# sourceMappingURL=server.cjs.map
