/**
 * Ultra-fast biomechanical signature pose SVG generator.
 * Creates an aesthetic dark-cyan vector diagram of the exercise's apex joint position
 * with active muscle heatmaps, joint angles, and motion vector arrows in fractions of a millisecond.
 */

export function generateSignaturePoseSvg(
  exerciseName: string,
  compartment: string,
  targetMuscle?: string
): string {
  const norm = `${exerciseName} ${compartment} ${targetMuscle || ""}`.toLowerCase();

  // Pose archetypes based on movement kinematics
  let poseType: "pushup" | "squat" | "pike" | "plank" | "lunge" | "pull" | "burpee" = "pushup";

  if (norm.includes("squat") || norm.includes("jump squat") || norm.includes("sumo")) {
    poseType = "squat";
  } else if (norm.includes("lunge") || norm.includes("split") || norm.includes("step")) {
    poseType = "lunge";
  } else if (norm.includes("pike") || norm.includes("overhead") || norm.includes("shoulder") || norm.includes("handstand")) {
    poseType = "pike";
  } else if (norm.includes("plank") || norm.includes("crunch") || norm.includes("twist") || norm.includes("core") || norm.includes("hollow")) {
    poseType = "plank";
  } else if (norm.includes("row") || norm.includes("pull") || norm.includes("back") || norm.includes("superman")) {
    poseType = "pull";
  } else if (norm.includes("burpee") || norm.includes("cardio") || norm.includes("jack") || norm.includes("mountain")) {
    poseType = "burpee";
  }

  // Generate vector coordinates for wireframe figure in apex contraction
  let figureSvg = "";
  let muscleHighlight = "";

  switch (poseType) {
    case "squat":
      figureSvg = `
        <!-- Torso & Head -->
        <circle cx="80" cy="55" r="10" fill="#38bdf8" />
        <line x1="80" y1="65" x2="88" y2="105" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
        <!-- Femur (Thigh) parallel to floor -->
        <line x1="88" y1="105" x2="135" y2="105" stroke="#00f0ff" stroke-width="4.5" stroke-linecap="round" />
        <!-- Tibia (Shin) -->
        <line x1="135" y1="105" x2="135" y2="150" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
        <!-- Foot -->
        <line x1="135" y1="150" x2="155" y2="150" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" />
        <!-- Arms counterbalanced -->
        <line x1="82" y1="78" x2="50" y2="78" stroke="#67e8f9" stroke-width="3.5" stroke-linecap="round" />
        <!-- Joint nodes -->
        <circle cx="88" cy="105" r="4.5" fill="#f59e0b" />
        <circle cx="135" cy="105" r="5" fill="#f59e0b" />
        <circle cx="135" cy="150" r="4" fill="#38bdf8" />
        <!-- Angle marker -->
        <path d="M 110 105 A 25 25 0 0 1 125 125" fill="none" stroke="#f59e0b" stroke-dasharray="2 2" stroke-width="2" />
        <text x="142" y="112" fill="#f59e0b" font-size="9" font-family="monospace" font-weight="bold">90° DEPTH</text>
      `;
      muscleHighlight = `
        <ellipse cx="112" cy="102" rx="18" ry="6" fill="#00f0ff" opacity="0.3" filter="blur(4px)" />
        <ellipse cx="82" cy="102" rx="10" ry="12" fill="#f59e0b" opacity="0.35" filter="blur(5px)" />
      `;
      break;

    case "pike":
      figureSvg = `
        <!-- Head inverted -->
        <circle cx="100" cy="135" r="9" fill="#38bdf8" />
        <!-- Inverted torso -->
        <line x1="100" y1="126" x2="100" y2="75" stroke="#00f0ff" stroke-width="4" stroke-linecap="round" />
        <!-- Arms supporting vertical drive -->
        <line x1="100" y1="110" x2="80" y2="150" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
        <line x1="100" y1="110" x2="120" y2="150" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
        <!-- Legs down in inverted V -->
        <line x1="100" y1="75" x2="60" y2="150" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
        <line x1="100" y1="75" x2="140" y2="150" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
        <!-- Apex joint node -->
        <circle cx="100" cy="75" r="5" fill="#f59e0b" />
        <circle cx="80" cy="150" r="3.5" fill="#00f0ff" />
        <circle cx="120" cy="150" r="3.5" fill="#00f0ff" />
        <text x="108" y="72" fill="#00f0ff" font-size="9" font-family="monospace" font-weight="bold">DELTS LOADED</text>
      `;
      muscleHighlight = `
        <circle cx="100" cy="115" r="14" fill="#00f0ff" opacity="0.4" filter="blur(6px)" />
      `;
      break;

    case "plank":
      figureSvg = `
        <!-- Head -->
        <circle cx="50" cy="90" r="8" fill="#38bdf8" />
        <!-- Rigid Torso -->
        <line x1="58" y1="94" x2="115" y2="98" stroke="#00f0ff" stroke-width="4.5" stroke-linecap="round" />
        <!-- Forearm & Arm -->
        <line x1="68" y1="96" x2="68" y2="130" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
        <line x1="68" y1="130" x2="85" y2="130" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" />
        <!-- Legs Locked -->
        <line x1="115" y1="98" x2="165" y2="115" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
        <!-- Toes -->
        <line x1="165" y1="115" x2="168" y2="130" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" />
        <!-- Nodes -->
        <circle cx="68" cy="96" r="4" fill="#f59e0b" />
        <circle cx="115" cy="98" r="4.5" fill="#f59e0b" />
        <circle cx="165" cy="115" r="3.5" fill="#00f0ff" />
        <!-- Tension line -->
        <line x1="60" y1="90" x2="165" y2="112" stroke="#f59e0b" stroke-dasharray="3 3" stroke-width="1.5" />
        <text x="80" y="85" fill="#f59e0b" font-size="9" font-family="monospace" font-weight="bold">180° SPINE</text>
      `;
      muscleHighlight = `
        <ellipse cx="90" cy="100" rx="20" ry="8" fill="#00f0ff" opacity="0.4" filter="blur(5px)" />
      `;
      break;

    case "lunge":
      figureSvg = `
        <!-- Head & Torso Upright -->
        <circle cx="85" cy="48" r="9" fill="#38bdf8" />
        <line x1="85" y1="57" x2="85" y2="102" stroke="#00f0ff" stroke-width="4" stroke-linecap="round" />
        <!-- Front Leg (90 deg) -->
        <line x1="85" y1="102" x2="125" y2="102" stroke="#00f0ff" stroke-width="4" stroke-linecap="round" />
        <line x1="125" y1="102" x2="125" y2="145" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
        <!-- Back Leg (Trailing) -->
        <line x1="85" y1="102" x2="55" y2="125" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" />
        <line x1="55" y1="125" x2="55" y2="145" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" />
        <!-- Nodes -->
        <circle cx="85" cy="102" r="4.5" fill="#f59e0b" />
        <circle cx="125" cy="102" r="4.5" fill="#f59e0b" />
        <circle cx="55" cy="125" r="4" fill="#38bdf8" />
        <text x="100" y="85" fill="#00f0ff" font-size="9" font-family="monospace" font-weight="bold">90/90 SPLIT</text>
      `;
      muscleHighlight = `
        <ellipse cx="105" cy="102" rx="15" ry="5" fill="#00f0ff" opacity="0.35" filter="blur(4px)" />
      `;
      break;

    default: // pushup & upper body pressing
      figureSvg = `
        <!-- Head -->
        <circle cx="45" cy="88" r="8" fill="#38bdf8" />
        <!-- Torso Line -->
        <line x1="53" y1="92" x2="115" y2="102" stroke="#00f0ff" stroke-width="4.5" stroke-linecap="round" />
        <!-- Elbow & Forearm at bottom flexion -->
        <line x1="62" y1="94" x2="72" y2="115" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
        <line x1="72" y1="115" x2="72" y2="138" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
        <!-- Hand on ground -->
        <circle cx="72" cy="138" r="3.5" fill="#f59e0b" />
        <!-- Extended Legs -->
        <line x1="115" y1="102" x2="165" y2="122" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
        <!-- Toes -->
        <circle cx="165" cy="125" r="3.5" fill="#f59e0b" />
        <!-- Joint Nodes -->
        <circle cx="62" cy="94" r="4.5" fill="#f59e0b" />
        <circle cx="72" cy="115" r="4.5" fill="#f59e0b" />
        <text x="78" y="118" fill="#00f0ff" font-size="9" font-family="monospace" font-weight="bold">45° ELBOW FLARE</text>
      `;
      muscleHighlight = `
        <ellipse cx="65" cy="96" rx="14" ry="10" fill="#00f0ff" opacity="0.4" filter="blur(5px)" />
        <ellipse cx="88" cy="100" rx="18" ry="6" fill="#f59e0b" opacity="0.3" filter="blur(4px)" />
      `;
      break;
  }

  const svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" width="100%" height="100%">
  <defs>
    <radialGradient id="poseGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#020617" stop-opacity="0" />
    </radialGradient>
    <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(56, 189, 248, 0.07)" stroke-width="0.75" />
    </pattern>
  </defs>

  <!-- Background Base -->
  <rect width="200" height="180" fill="#030712" />
  <rect width="200" height="180" fill="url(#grid)" />
  <circle cx="100" cy="100" r="80" fill="url(#poseGlow)" />

  <!-- Ground Line -->
  <line x1="20" y1="150" x2="180" y2="150" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1.5" stroke-dasharray="4 3" />

  <!-- Dynamic Muscle Heatmap -->
  ${muscleHighlight}

  <!-- Biomechanical Figure -->
  ${figureSvg}

  <!-- HUD Overlay Info -->
  <g transform="translate(10, 16)">
    <rect x="0" y="0" width="94" height="16" rx="4" fill="rgba(0, 240, 255, 0.15)" stroke="rgba(0, 240, 255, 0.35)" stroke-width="0.75" />
    <text x="6" y="11" fill="#38bdf8" font-size="8" font-family="system-ui, sans-serif" font-weight="900" letter-spacing="0.5">AI SIGNATURE POSE</text>
  </g>
</svg>
`.trim();

  // Return as data URL ready to embed directly in img src
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}
