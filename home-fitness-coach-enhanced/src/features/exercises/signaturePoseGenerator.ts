/**
 * AI Gym Photo & Signature Pose Engine.
 *
 * Generates photorealistic gym athlete thumbnails for AI-generated and custom exercises.
 * Completely replaces old wireframe stickman figures with real gym photography
 * (identical to the Classic Push-up signature thumbnail) and connects to
 * Gemini / Imagen 3 API for continuous dynamic visual synthesis.
 */

import pushupPhoto from "../../assets/exercises/pushup-black-2.jpg";
import diamondPhoto from "../../assets/exercises/diamondpushup-black-2.jpg";
import inclinePhoto from "../../assets/exercises/incline-black-1.jpg";
import pikePhoto from "../../assets/exercises/pikepushup-black-1.jpg";
import jumpSquatPhoto from "../../assets/exercises/jumpsquat-black-1.jpg";
import squatPhoto from "../../assets/exercises/squat-black-2.jpg";
import sumoSquatPhoto from "../../assets/exercises/sumosquat-black-1.jpg";
import wallSitPhoto from "../../assets/exercises/wallsit-black-1.jpg";
import lungePhoto from "../../assets/exercises/lunge-black-1.jpg";
import stepUpPhoto from "../../assets/exercises/stepup-black-1.jpg";
import plankPhoto from "../../assets/exercises/plank-black-1.jpg";
import sidePlankPhoto from "../../assets/exercises/sideplank-black-1.jpg";
import shoulderTapsPhoto from "../../assets/exercises/shouldertaps-black-2.jpg";
import crunchesPhoto from "../../assets/exercises/crunches-black-1.jpg";
import situpPhoto from "../../assets/exercises/situps-black-1.jpg";
import russianTwistPhoto from "../../assets/exercises/russiantwist-black-1.jpg";
import legRaisesPhoto from "../../assets/exercises/legraises-black-1.jpg";
import deadbugPhoto from "../../assets/exercises/deadbug-black-1.jpg";
import birdDogPhoto from "../../assets/exercises/birddog-black-1.jpg";
import bridgePhoto from "../../assets/exercises/bridge-black-2.jpg";
import burpeePhoto from "../../assets/exercises/burpee-black-squat.jpg";
import mountainPhoto from "../../assets/exercises/mountain-black-1.jpg";
import jacksPhoto from "../../assets/exercises/jacks-black-2.jpg";
import bicepCurlPhoto from "../../assets/exercises/bicepcurl-black-1.jpg";
import bentRowPhoto from "../../assets/exercises/bentrow-black-1.jpg";
import dipsPhoto from "../../assets/exercises/dips-black-2.jpg";
import lateralRaisePhoto from "../../assets/exercises/lateralraise-black-1.jpg";
import calfPhoto from "../../assets/exercises/calf-black-1.jpg";
import supermanPhoto from "../../assets/exercises/superman-black-1.jpg";
import cobraStretchPhoto from "../../assets/exercises/cobrastretch-black-1.jpg";
import childsPosePhoto from "../../assets/exercises/childspose-black-1.jpg";
import worldsGreatestPhoto from "../../assets/exercises/worldsgreatest-black-1.jpg";
import { apiUrl, apiHeaders } from "../../core/apiBase";

/**
 * Returns a high-resolution, authentic gym photograph of an athlete executing
 * the movement's apex signature pose — NEVER a stickman figure.
 */
export function getAiGymSignaturePhoto(
  exerciseName: string,
  compartment?: string,
  targetMuscle?: string
): string {
  const norm = `${exerciseName} ${compartment || ""} ${targetMuscle || ""}`.toLowerCase();

  // 1. CHEST & PRESSING VARIATIONS
  if (norm.includes("diamond") || norm.includes("narrow")) return diamondPhoto;
  if (norm.includes("incline") || norm.includes("elevated")) return inclinePhoto;
  if (norm.includes("pike") || norm.includes("handstand") || norm.includes("vertical push")) return pikePhoto;
  if (norm.includes("pushup") || norm.includes("push up") || norm.includes("press") || norm.includes("chest")) return pushupPhoto;

  // 2. LEGS & SQUATS
  if (norm.includes("sumo")) return sumoSquatPhoto;
  if (norm.includes("jump squat") || norm.includes("plyo squat") || norm.includes("explosive squat")) return jumpSquatPhoto;
  if (norm.includes("wall sit") || norm.includes("isometric squat")) return wallSitPhoto;
  if (norm.includes("lunge") || norm.includes("split") || norm.includes("bulgarian")) return lungePhoto;
  if (norm.includes("step up") || norm.includes("step-up")) return stepUpPhoto;
  if (norm.includes("squat") || norm.includes("quad") || norm.includes("leg")) return squatPhoto;
  if (norm.includes("calf") || norm.includes("ankle")) return calfPhoto;

  // 3. CORE & POSTERIOR CHAIN
  if (norm.includes("side plank")) return sidePlankPhoto;
  if (norm.includes("shoulder tap")) return shoulderTapsPhoto;
  if (norm.includes("plank") || norm.includes("hollow") || norm.includes("brace")) return plankPhoto;
  if (norm.includes("twist") || norm.includes("oblique") || norm.includes("rotational")) return russianTwistPhoto;
  if (norm.includes("leg raise") || norm.includes("flutter")) return legRaisesPhoto;
  if (norm.includes("dead bug") || norm.includes("deadbug")) return deadbugPhoto;
  if (norm.includes("bird dog") || norm.includes("birddog")) return birdDogPhoto;
  if (norm.includes("bridge") || norm.includes("thrust")) return bridgePhoto;
  if (norm.includes("situp") || norm.includes("sit up")) return situpPhoto;
  if (norm.includes("crunch") || norm.includes("abs") || norm.includes("core")) return crunchesPhoto;
  if (norm.includes("superman") || norm.includes("erector")) return supermanPhoto;

  // 4. METABOLIC & CARDIO
  if (norm.includes("burpee")) return burpeePhoto;
  if (norm.includes("mountain") || norm.includes("climber")) return mountainPhoto;
  if (norm.includes("jack") || norm.includes("star jump") || norm.includes("cardio")) return jacksPhoto;

  // 5. ARMS & SHOULDERS
  if (norm.includes("dip") || norm.includes("tricep")) return dipsPhoto;
  if (norm.includes("curl") || norm.includes("bicep")) return bicepCurlPhoto;
  if (norm.includes("row") || norm.includes("pull") || norm.includes("lat")) return bentRowPhoto;
  if (norm.includes("raise") || norm.includes("deltoid") || norm.includes("shoulder")) return lateralRaisePhoto;

  // 6. MOBILITY & STRETCH
  if (norm.includes("scorpion")) return "/thumbnails/prone-scorpion.jpg";
  if (norm.includes("cobra") || norm.includes("upward dog")) return cobraStretchPhoto;
  if (norm.includes("child") || norm.includes("rest pose")) return childsPosePhoto;
  if (norm.includes("world") || norm.includes("stretch") || norm.includes("mobility")) return worldsGreatestPhoto;

  // Default to Classic Push-up signature gym photo
  return pushupPhoto;
}

/**
 * Backward-compatible helper: ensures all existing call sites return
 * the authentic gym photograph instead of an SVG stickman figure.
 */
export function generateSignaturePoseSvg(
  exerciseName: string,
  compartment: string,
  targetMuscle?: string
): string {
  return getAiGymSignaturePhoto(exerciseName, compartment, targetMuscle);
}

/**
 * Triggers backend AI image generation via Imagen 3 / Gemini.
 * Returns the generated image data URL or null if offline.
 */
export async function generateAiGymImage(options: {
  name: string;
  compartment?: string;
  targetMuscle?: string;
  description?: string;
  geminiApiKey?: string;
}): Promise<string | null> {
  const { name, compartment, targetMuscle, description, geminiApiKey } = options;
  const key = geminiApiKey || localStorage.getItem("kinetic_gemini_api_key") || "";

  try {
    const res = await fetch(apiUrl("/api/exercises/generate-image"), {
      method: "POST",
      headers: apiHeaders(key ? { "x-gemini-key": key } : {}),
      body: JSON.stringify({
        name,
        compartment,
        targetMuscle,
        description,
        geminiApiKey: key,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.imageUrl) {
      return data.imageUrl;
    }
  } catch (err) {
    console.warn("AI Gym image generation request failed:", err);
  }

  return null;
}
