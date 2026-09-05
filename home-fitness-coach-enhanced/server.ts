import express from "express";
import path from "path";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// The installed Android/iOS app has no server of its own — it calls this
// same server over the network from a *different* origin (the app's local
// WebView origin, not this server's domain), so the browser's CORS check
// has to be explicitly allowed here or every request from the app gets
// silently blocked. Left wide open (`*`) since this endpoint has no
// per-user auth/session to protect — the shared-secret header below is
// this API's actual access control.
app.use(cors());

// Render (and most host-your-own-server platforms) assign the port at
// runtime via the PORT env var — a hardcoded port means the platform's
// health checks can never reach the app.
const PORT = Number(process.env.PORT) || 3000;

// Optional lightweight gate: if API_SHARED_SECRET is set, only requests
// carrying the matching header are served. This is *not* strong security
// (the secret ships inside the compiled app, same as any client secret
// would), but once this server has a public URL it stops random bots/
// scanners that find the URL from quietly burning through the Gemini
// quota — the actual API key never leaves this server either way.
const REQUIRED_SECRET = process.env.API_SHARED_SECRET;
function checkSharedSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!REQUIRED_SECRET) return next(); // not configured — gate disabled
  if (req.header("x-app-secret") === REQUIRED_SECRET) return next();
  return res.status(401).json({ error: "Unauthorized", message: "Missing or invalid app secret." });
}

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

// API endpoint to generate custom AI workouts
app.post("/api/workouts/generate", checkSharedSecret, async (req, res) => {
  try {
    const { fitnessLevel, goal, duration, targetArea, equipment, healthNotes } = req.body ?? {};

    const client = getGeminiClient();
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Missing API Key",
        message: "Gemini API key is not configured. Please add GEMINI_API_KEY in the Secrets panel."
      });
    }

    // Basic input validation/sanitization — clamp duration to a sane range
    // and cap free-text fields so a malformed or abusive request can't blow
    // up the prompt or the generated plan.
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

    const prompt = `Generate a highly personalized, structured at-home workout routine based on these specifications:
- Fitness Level: ${safeFitnessLevel}
- Workout Goal: ${safeGoal}
- Duration: ${safeDuration} minutes
- Target Focus: ${safeTargetArea}
- Available Equipment: ${safeEquipment.length > 0 ? safeEquipment.join(", ") : "Bodyweight only"}
- Medical/Physical Constraints/Notes: ${safeHealthNotes || "None"}

Please design a safe, effective home workout. Ensure the exercises fit the requested focus area and available equipment. Include warm-up, core working exercises, and a cool-down.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an elite certified home fitness personal trainer. You craft precise, scientifically-backed at-home workout plans that maximize efficiency with minimal equipment. Always follow the requested JSON structure.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["workoutTitle", "workoutDescription", "totalDurationMinutes", "targetArea", "equipmentNeeded", "exercises", "coachingTips"],
          properties: {
            workoutTitle: {
              type: Type.STRING,
              description: "An inspiring, literal name for the workout, e.g., '15-Minute Beginner Core Burner'."
            },
            workoutDescription: {
              type: Type.STRING,
              description: "A motivating explanation of the workout's benefits and focus."
            },
            totalDurationMinutes: {
              type: Type.INTEGER,
              description: "The total length of the workout in minutes."
            },
            targetArea: {
              type: Type.STRING,
              description: "The targeted muscle group or focus area."
            },
            equipmentNeeded: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of equipment required (or 'Bodyweight' if none)."
            },
            exercises: {
              type: Type.ARRAY,
              description: "The list of exercises, sequenced in training order.",
              items: {
                type: Type.OBJECT,
                required: ["name", "description", "durationSeconds", "reps", "sets", "restSeconds", "targetMuscle"],
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "Name of the exercise (e.g., 'Glute Bridges', 'Jumping Jacks')."
                  },
                  description: {
                    type: Type.STRING,
                    description: "Clear instructions on proper form and execution."
                  },
                  durationSeconds: {
                    type: Type.INTEGER,
                    description: "Duration for timed exercises (e.g., 30 for planks), or 0 if rep-based."
                  },
                  reps: {
                    type: Type.INTEGER,
                    description: "Number of target repetitions, or 0 if duration-based."
                  },
                  sets: {
                    type: Type.INTEGER,
                    description: "Number of sets to perform."
                  },
                  restSeconds: {
                    type: Type.INTEGER,
                    description: "Rest time in seconds after completing a set."
                  },
                  targetMuscle: {
                    type: Type.STRING,
                    description: "Primary muscle targeted by this movement."
                  }
                }
              }
            },
            coachingTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-3 highly specific posture and safety tips tailored to the constraints or fitness level."
            }
          }
        }
      }
    });

    const resultText = response.text || "{}";
    const workoutData = JSON.parse(resultText);

    return res.json(workoutData);
  } catch (error: any) {
    console.error("Error in AI workout generator:", error);
    return res.status(500).json({
      error: "Generation Failed",
      message: error.message || "Failed to generate AI workout plan."
    });
  }
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
    app.get("*", (req, res) => {
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
