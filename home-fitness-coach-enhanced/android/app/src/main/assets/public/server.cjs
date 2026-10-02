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
var PORT = 3e3;
var ai = null;
function getGeminiClient() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not defined.");
    }
    ai = new import_genai.GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return ai;
}
app.post("/api/workouts/generate", async (req, res) => {
  try {
    const { fitnessLevel, goal, duration, targetArea, equipment, healthNotes } = req.body ?? {};
    const client = getGeminiClient();
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Missing API Key",
        message: "Gemini API key is not configured. Please add GEMINI_API_KEY in the Secrets panel."
      });
    }
    const safeDuration = Number.isFinite(Number(duration)) ? Math.min(60, Math.max(5, Math.round(Number(duration)))) : 20;
    const safeEquipment = Array.isArray(equipment) ? equipment.filter((e) => typeof e === "string").slice(0, 10) : [];
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
          type: import_genai.Type.OBJECT,
          required: ["workoutTitle", "workoutDescription", "totalDurationMinutes", "targetArea", "equipmentNeeded", "exercises", "coachingTips"],
          properties: {
            workoutTitle: {
              type: import_genai.Type.STRING,
              description: "An inspiring, literal name for the workout, e.g., '15-Minute Beginner Core Burner'."
            },
            workoutDescription: {
              type: import_genai.Type.STRING,
              description: "A motivating explanation of the workout's benefits and focus."
            },
            totalDurationMinutes: {
              type: import_genai.Type.INTEGER,
              description: "The total length of the workout in minutes."
            },
            targetArea: {
              type: import_genai.Type.STRING,
              description: "The targeted muscle group or focus area."
            },
            equipmentNeeded: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING },
              description: "List of equipment required (or 'Bodyweight' if none)."
            },
            exercises: {
              type: import_genai.Type.ARRAY,
              description: "The list of exercises, sequenced in training order.",
              items: {
                type: import_genai.Type.OBJECT,
                required: ["name", "description", "durationSeconds", "reps", "sets", "restSeconds", "targetMuscle"],
                properties: {
                  name: {
                    type: import_genai.Type.STRING,
                    description: "Name of the exercise (e.g., 'Glute Bridges', 'Jumping Jacks')."
                  },
                  description: {
                    type: import_genai.Type.STRING,
                    description: "Clear instructions on proper form and execution."
                  },
                  durationSeconds: {
                    type: import_genai.Type.INTEGER,
                    description: "Duration for timed exercises (e.g., 30 for planks), or 0 if rep-based."
                  },
                  reps: {
                    type: import_genai.Type.INTEGER,
                    description: "Number of target repetitions, or 0 if duration-based."
                  },
                  sets: {
                    type: import_genai.Type.INTEGER,
                    description: "Number of sets to perform."
                  },
                  restSeconds: {
                    type: import_genai.Type.INTEGER,
                    description: "Rest time in seconds after completing a set."
                  },
                  targetMuscle: {
                    type: import_genai.Type.STRING,
                    description: "Primary muscle targeted by this movement."
                  }
                }
              }
            },
            coachingTips: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING },
              description: "2-3 highly specific posture and safety tips tailored to the constraints or fitness level."
            }
          }
        }
      }
    });
    const resultText = response.text || "{}";
    const workoutData = JSON.parse(resultText);
    return res.json(workoutData);
  } catch (error) {
    console.error("Error in AI workout generator:", error);
    return res.status(500).json({
      error: "Generation Failed",
      message: error.message || "Failed to generate AI workout plan."
    });
  }
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
