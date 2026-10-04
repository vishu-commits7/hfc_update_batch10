import { useMemo, useState, useEffect, useRef, useDeferredValue, memo } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import {
  Search,
  Play,
  Pause,
  Star,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Dumbbell,
  HeartPulse,
  X,
  Mars,
  Volume2,
  VolumeX,
  Square,
  Video,
  Shield,
  Crosshair,
  Layers,
  Zap,
  Activity,
  Flame,
  Wind,
  Sparkles,
  BarChart2,
  Scan,
} from "lucide-react";
import type { FigureGender } from "./HumanFigure";
import ExerciseThumb from "./ExerciseThumb";
import type { DemoTone } from "../lib/exercisePhotos.generated";
import { readDemoModel, writeDemoModel } from "../lib/demoPrefs";
import { UserProfile } from "../types";
import { audio } from "../lib/audio";
import { getExerciseVideo } from "../lib/exerciseVideos";
import {
  getCustomAcademyExercises,
  CustomExerciseItem,
  AnatomicalCompartment,
  IntensityLevel,
} from "../lib/customExercises";
import LofiMusicButton from "./LofiMusicButton";
import gymUpperBodyImg from "../assets/ui/gym-upper-body.jpg";
import gymLowerBodyImg from "../assets/ui/gym-lower-body.jpg";
import gymHiitBeastImg from "../assets/ui/gym-hiit-beast.jpg";
import gymDailyMotivationImg from "../assets/ui/gym-daily-motivation.jpg";
import coachCoreMaleImg from "../assets/coaches/coach-core-male.jpg";
import coachMobilityMaleImg from "../assets/coaches/coach-mobility-male.jpg";

export interface ExerciseDemo {
  id: string;
  name: string;
  category: string;
  focus: string;
  description: string;
  difficulty: string;
  keyPoints: string[];
  mistakes: string[];
  tempo: string;
  /** Optional: reuse another id's CSS motion animation instead of defining a new one. */
  pattern?: string;
  equipment?: string;
  /** Optional: path to an MP4/WebM video or remote video URL. */
  videoUrl?: string;
  /** Anatomical compartment grouping (Chest, Shoulders, Back, Legs, Core, Cardio, Flexibility) */
  compartment: AnatomicalCompartment;
  /** Biological intensity tier (Low, Moderate, High, Extreme) */
  intensityLevel: IntensityLevel;
  /** Succession ranking (1=Lowest, increasing monotonically to Extreme) */
  intensityRank: number;
  /** Biomechanical and biological metric */
  scientificMetric: string;
  /** Physiological rationale explaining the loading position */
  biologicalMechanism?: string;
  /** Blank photo indicator for custom AI movements */
  isBlankPhoto?: boolean;
  /** Flag for dynamically registered AI movements */
  isCustomAi?: boolean;
  /** Instant biomechanical vector thumbnail */
  signaturePose?: string;
}

export interface CompartmentDef {
  id: AnatomicalCompartment;
  title: string;
  shortName: string;
  subtitle: string;
  scientificPrinciple: string;
  loadingCurve: string;
  icon: any;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  coverImage?: string;
}

export const COMPARTMENTS: CompartmentDef[] = [
  {
    id: "Chest",
    title: "Chest & Pectorals Compartment",
    shortName: "Chest",
    subtitle: "Horizontal pressing, sternocostal adduction & anterior kinetic chain",
    scientificPrinciple: "Mechanical moment arm scales via inclination vector (~45% to ~75% bodyweight load)",
    loadingCurve: "Incline Push-ups (L1: ~45% BW) → Classic (L2: ~64% BW) → Diamond (L3: ~75% BW)",
    icon: Shield,
    accentColor: "#38bdf8",
    badgeBg: "bg-sky-500/10",
    badgeBorder: "border-sky-500/25",
    badgeText: "text-sky-400",
    coverImage: gymUpperBodyImg,
  },
  {
    id: "Shoulders",
    title: "Shoulders & Deltoids Compartment",
    shortName: "Shoulders",
    subtitle: "Scapular stabilization, rotator cuff integrity & vertical pressing",
    scientificPrinciple: "Rotational lever torque advances into inverted near-vertical axial load (~80% BW)",
    loadingCurve: "Lateral Raises (L1) → Chair Dips (L2) → Shoulder Taps (L3) → Pike Push-ups (L4)",
    icon: Crosshair,
    accentColor: "#60a5fa",
    badgeBg: "bg-blue-500/10",
    badgeBorder: "border-blue-500/25",
    badgeText: "text-blue-400",
    coverImage: gymUpperBodyImg,
  },
  {
    id: "Back",
    title: "Back & Posterior Chain Compartment",
    shortName: "Back",
    subtitle: "Spinal erectors, latissimus dorsi, scapular retractors & posterior chain",
    scientificPrinciple: "Prone isometric anti-flexion progresses to compound hip-hinged pulling kinetics",
    loadingCurve: "Superman Hold (L1) → Dumbbell Bicep Curl (L2) → Bent-over Rows (L3)",
    icon: Layers,
    accentColor: "#818cf8",
    badgeBg: "bg-indigo-500/10",
    badgeBorder: "border-indigo-500/25",
    badgeText: "text-indigo-400",
    coverImage: gymDailyMotivationImg,
  },
  {
    id: "Legs",
    title: "Legs, Quads & Glutes Compartment",
    shortName: "Legs",
    subtitle: "Knee extension, hip hinge, ankle plantarflexion & unilateral stability",
    scientificPrinciple: "Bilateral closed chain advances to high-shear unilateral deceleration and hip rotatory torque",
    loadingCurve: "Bridges (L1) → Squats/Donkey Kicks (L2) → Lunges/Sumo (L3) → Single-Leg Deadlift (L4)",
    icon: Zap,
    accentColor: "#34d399",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/25",
    badgeText: "text-emerald-400",
    coverImage: gymLowerBodyImg,
  },
  {
    id: "Core",
    title: "Core & Abdominals Compartment",
    shortName: "Core",
    subtitle: "Lumbopelvic anti-extension, anti-rotation, lateral stability & pelvic control",
    scientificPrinciple: "Short-range trunk flexion progresses to extended lower-limb lever torque and oblique torque",
    loadingCurve: "Bird Dog (L1) → Crunches/Plank (L2) → Russian/Side Plank (L3) → Lying Leg Raises (L4)",
    icon: Activity,
    accentColor: "#fbbf24",
    badgeBg: "bg-amber-500/10",
    badgeBorder: "border-amber-500/25",
    badgeText: "text-amber-400",
    coverImage: coachCoreMaleImg,
  },
  {
    id: "Cardio",
    title: "Metabolic Cardio Compartment",
    shortName: "Cardio",
    subtitle: "Bioenergetic conditioning, agility, metabolic turnover & plyometrics",
    scientificPrinciple: "Aerobic rhythmic cadence advances to anaerobic glycolytic rate of force development & 3-4x BW ground impacts",
    loadingCurve: "Jumping Jacks (L1) → Skater Hops (L2) → Mountain/Burpee (L3) → Jump Squats (L4)",
    icon: Flame,
    accentColor: "#fb7185",
    badgeBg: "bg-rose-500/10",
    badgeBorder: "border-rose-500/25",
    badgeText: "text-rose-400",
    coverImage: gymHiitBeastImg,
  },
  {
    id: "Flexibility",
    title: "Mobility & Flexibility Compartment",
    shortName: "Mobility",
    subtitle: "Myofascial decompression, spinal articulation & kinetic chain range",
    scientificPrinciple: "Restorative parasympathetic poses progress to dynamic multi-joint mobility flows",
    loadingCurve: "Child's Pose (L1) → Cat-Cow (L1) → Cobra/Fold/Twist (L2) → World's Greatest Stretch (L3)",
    icon: Wind,
    accentColor: "#2dd4bf",
    badgeBg: "bg-teal-500/10",
    badgeBorder: "border-teal-500/25",
    badgeText: "text-teal-400",
    coverImage: coachMobilityMaleImg,
  },
];

export const DEMO_EXERCISES: ExerciseDemo[] = [
  // ==========================================
  // CHEST & PECTORALS COMPARTMENT (Low -> Extreme)
  // ==========================================
  {
    id: "incline",
    name: "Incline Push-up",
    category: "Upper Body",
    focus: "Chest, triceps, shoulders",
    description: "A beginner-friendly pressing variation using a stable elevated surface.",
    difficulty: "Beginner",
    tempo: "2–1–2",
    keyPoints: ["Surface must be stable", "Keep body in one line", "Control the descent"],
    mistakes: ["Unstable support", "Hips sagging", "Partial rushed reps"],
    videoUrl: "/videos/Incline Push-ups.mp4",
    compartment: "Chest",
    intensityLevel: "Low",
    intensityRank: 1,
    scientificMetric: "~45% BW load · Low glenohumeral shear",
    biologicalMechanism: "Elevating the hands shifts the gravity line, reducing upper extremity load to ~45% bodyweight and minimizing anterior shoulder joint shear.",
  },
  {
    id: "pushups",
    name: "Classic Push-ups",
    category: "Upper Body",
    focus: "Chest, triceps, shoulders",
    description: "A controlled horizontal press from a stable plank position.",
    difficulty: "Intermediate",
    tempo: "2–1–2",
    keyPoints: ["Hands under or slightly outside shoulders", "Keep the trunk braced", "Lower only through a comfortable range"],
    mistakes: ["Hips dropping", "Elbows flaring hard", "Rushing the lowering phase"],
    videoUrl: "/videos/Classic pushup.mp4",
    compartment: "Chest",
    intensityLevel: "Moderate",
    intensityRank: 2,
    scientificMetric: "~64% BW load · Standard moment arm",
    biologicalMechanism: "Horizontal plane pressing displaces ~64% bodyweight through sternocostal pectoralis major and triceps brachii with closed kinetic chain stability.",
  },
  {
    id: "diamond-pushup",
    name: "Diamond Push-ups",
    category: "Upper Body",
    focus: "Triceps, inner chest",
    pattern: "pushups",
    description: "A narrow hand-position press that shifts emphasis to the triceps.",
    difficulty: "Advanced",
    tempo: "2–1–2",
    keyPoints: ["Hands close, thumbs and index fingers touching", "Elbows track back, not out wide", "Keep the trunk rigid"],
    mistakes: ["Elbows flaring outward", "Hips sagging", "Partial range reps"],
    videoUrl: "/videos/Diamond Push-ups.mp4",
    compartment: "Chest",
    intensityLevel: "Extreme",
    intensityRank: 3,
    scientificMetric: "~75% BW load · Narrow base of support",
    biologicalMechanism: "Narrowing the base of support concentrates high flexor torque on medial triceps heads and sternal pectoralis fibers, reaching peak upper-body EMG recruitment.",
  },

  // ==========================================
  // SHOULDERS & DELTOIDS COMPARTMENT (Low -> Extreme)
  // ==========================================
  {
    id: "lateral-raise",
    name: "Lateral Raises",
    category: "Upper Body",
    focus: "Side shoulders",
    pattern: "raise",
    equipment: "Dumbbells",
    description: "An isolation raise that builds shoulder width and definition.",
    difficulty: "Beginner",
    tempo: "2–1–2",
    keyPoints: ["Slight bend in the elbows", "Lead with the elbows, not the hands", "Stop around shoulder height"],
    mistakes: ["Using momentum to swing up", "Shrugging the traps", "Raising too high"],
    videoUrl: "/videos/Lateral Raises.mp4",
    compartment: "Shoulders",
    intensityLevel: "Low",
    intensityRank: 1,
    scientificMetric: "Isolation lever · Deltoid pennation fibers",
    biologicalMechanism: "Frontal plane abduction maximizes lateral deltoid pennation torque while keeping axial spinal loading near zero.",
  },
  {
    id: "dips",
    name: "Chair Tricep Dips",
    category: "Upper Body",
    focus: "Triceps, shoulders",
    description: "A chair-assisted pressing movement using a stable surface and comfortable range.",
    difficulty: "Beginner",
    tempo: "2–1–2",
    keyPoints: ["Use a stable chair", "Keep shoulders comfortable", "Move slowly"],
    mistakes: ["Chair sliding", "Going too deep", "Shrugging shoulders"],
    videoUrl: "/videos/Chair Tricep Dips .mp4",
    compartment: "Shoulders",
    intensityLevel: "Moderate",
    intensityRank: 2,
    scientificMetric: "~55% BW load · Scapular depression",
    biologicalMechanism: "Supports ~55% bodyweight with feet planted; activates anterior deltoids and triceps with controlled latissimus depression.",
  },
  {
    id: "shoulder-taps",
    name: "Shoulder Taps",
    category: "Upper Body",
    focus: "Shoulders, anti-rotation core",
    pattern: "plank",
    description: "A plank variation that adds an anti-rotation shoulder tap.",
    difficulty: "Intermediate",
    tempo: "Steady",
    keyPoints: ["Widen your feet for stability", "Keep hips as still as possible", "Tap lightly, don't slam"],
    mistakes: ["Hips rocking side to side", "Feet too close together", "Rushing the tempo"],
    videoUrl: "/videos/Shoulder Taps.mp4",
    compartment: "Shoulders",
    intensityLevel: "High",
    intensityRank: 3,
    scientificMetric: "Tripod anti-rotation · Serratus anterior",
    biologicalMechanism: "Unilateral ground support forces the stance shoulder to bear rotational and anti-lateral torque, firing serratus anterior and rotator cuff stabilizers.",
  },
  {
    id: "pike-pushup",
    name: "Pike Push-ups",
    category: "Upper Body",
    focus: "Shoulders, upper chest",
    pattern: "pushups",
    description: "An inverted-V pressing variation that emphasizes the shoulders.",
    difficulty: "Advanced",
    tempo: "2–1–2",
    keyPoints: ["Hips high, forming an inverted V", "Head aims toward the floor between hands", "Keep the movement slow"],
    mistakes: ["Hips dropping toward a normal push-up", "Flaring elbows wide", "Rushing the descent"],
    videoUrl: "/videos/Pike push-ups.mp4",
    compartment: "Shoulders",
    intensityLevel: "Extreme",
    intensityRank: 4,
    scientificMetric: "~80% BW load · Inverted axial line",
    biologicalMechanism: "Inverted hip angle places ~80% bodyweight directly in an overhead vertical line of action, requiring maximal recruitment of anterior and medial deltoid motor units.",
  },

  // ==========================================
  // BACK & POSTERIOR CHAIN COMPARTMENT (Low -> Extreme)
  // ==========================================
  {
    id: "superman",
    name: "Superman Hold",
    category: "Core",
    focus: "Lower back, glutes",
    pattern: "bridges",
    description: "A prone extension hold that strengthens the posterior chain.",
    difficulty: "Beginner",
    tempo: "Timed hold",
    keyPoints: ["Lift a comfortable height", "Lengthen through fingers and toes", "Breathe steadily during the hold"],
    mistakes: ["Overextending the neck", "Bouncing instead of holding", "Holding the breath"],
    videoUrl: "/videos/Superman-Hold.mp4",
    compartment: "Back",
    intensityLevel: "Low",
    intensityRank: 1,
    scientificMetric: "Multifidus isometric · Zero shear load",
    biologicalMechanism: "Prone isometric anti-flexion conditions lumbar multifidus and thoracic erector spinae against gravity without compressive spinal loading.",
  },
  {
    id: "bicep-curl",
    name: "Dumbbell Bicep Curl",
    category: "Upper Body",
    focus: "Biceps",
    pattern: "curl",
    equipment: "Dumbbells",
    description: "A classic elbow-flexion isolation move for the biceps.",
    difficulty: "Beginner",
    tempo: "2–1–2",
    keyPoints: ["Elbows pinned to your sides", "Curl without swinging the torso", "Lower with full control"],
    mistakes: ["Swinging the weight up", "Only doing the top half of the range", "Flaring elbows forward"],
    videoUrl: "/videos/Dumbell Bicep Curls.mp4",
    compartment: "Back",
    intensityLevel: "Moderate",
    intensityRank: 2,
    scientificMetric: "Elbow flexion torque · Biceps brachii",
    biologicalMechanism: "Isolates the elbow flexor complex (biceps brachii and brachialis) through sagittal rotation, building pulling synergy for compound back movements.",
  },
  {
    id: "bent-row",
    name: "Bent-over Rows",
    category: "Upper Body",
    focus: "Back, biceps",
    pattern: "row",
    equipment: "Dumbbells",
    description: "A hip-hinged pulling movement that builds a stronger back.",
    difficulty: "Intermediate",
    tempo: "2–1–2",
    keyPoints: ["Hinge at the hips, flat back", "Pull elbows back and up", "Squeeze the shoulder blades together"],
    mistakes: ["Rounding the lower back", "Standing too upright", "Yanking with momentum"],
    videoUrl: "/videos/Bent over Rows.mp4",
    compartment: "Back",
    intensityLevel: "Extreme",
    intensityRank: 3,
    scientificMetric: "Compound posterior chain · High lat recruitment",
    biologicalMechanism: "Hip-hinge posture demands sustained isometric hamstring/glute bracing while dynamic pulling activates latissimus dorsi, rhomboids, and mid-trapezius.",
  },

  // ==========================================
  // LEGS, QUADS & GLUTES COMPARTMENT (Low -> Extreme)
  // ==========================================
  {
    id: "bridges",
    name: "Glute Bridges",
    category: "Lower Body",
    focus: "Glutes, hamstrings",
    description: "A floor-based hip extension movement emphasizing controlled glute engagement.",
    difficulty: "Beginner",
    tempo: "2–2–2",
    keyPoints: ["Feet planted", "Lift through the hips", "Pause briefly at the top"],
    mistakes: ["Overarching the back", "Pushing from toes", "Dropping quickly"],
    videoUrl: "/videos/Glute Bridges .mp4",
    compartment: "Legs",
    intensityLevel: "Low",
    intensityRank: 1,
    scientificMetric: "Supine non-weight-bearing · Pure glute drive",
    biologicalMechanism: "Supine kinetic alignment eliminates knee joint compression while providing isolated neuromuscular gluteus maximus motor unit activation.",
  },
  {
    id: "calf",
    name: "Calf Raises",
    category: "Lower Body",
    focus: "Calves, ankle control",
    description: "A simple standing calf-strengthening movement with a stable base.",
    difficulty: "Beginner",
    tempo: "2–1–2",
    keyPoints: ["Use a stable stance", "Rise smoothly", "Lower under control"],
    mistakes: ["Bouncing", "Rolling ankles", "Rushing the descent"],
    videoUrl: "/videos/Calf Raises.mp4",
    compartment: "Legs",
    intensityLevel: "Low",
    intensityRank: 2,
    scientificMetric: "Class 2 lever · Triceps surae complex",
    biologicalMechanism: "Plantarflexion through second-class ankle levers engages gastrocnemius and soleus without fatiguing proximal knee or hip structures.",
  },
  {
    id: "stepup",
    name: "Supported Step-up",
    category: "Lower Body",
    focus: "Glutes, quads, balance",
    description: "A controlled step-up using a stable low platform and optional support.",
    difficulty: "Beginner",
    tempo: "2–1–2",
    keyPoints: ["Platform must be stable", "Drive through the stepping leg", "Use support for balance if needed"],
    mistakes: ["Jumping onto platform", "Knee collapsing inward", "Rushing down"],
    videoUrl: "/videos/Supported step-up.mp4",
    compartment: "Legs",
    intensityLevel: "Moderate",
    intensityRank: 3,
    scientificMetric: "Assisted unilateral · Patellofemoral balance",
    biologicalMechanism: "Unilateral concentric elevation with external support limits hip adductor instability while conditioning vastus medialis oblique and glute fibers.",
  },
  {
    id: "donkey-kick",
    name: "Donkey Kicks",
    category: "Lower Body",
    focus: "Glutes",
    pattern: "bird-dog",
    description: "A quadruped hip-extension isolation move for the glutes.",
    difficulty: "Beginner",
    tempo: "2–2–2",
    keyPoints: ["Keep the knee bent at 90 degrees", "Drive through the heel", "Squeeze the glute at the top"],
    mistakes: ["Arching the lower back", "Kicking too high", "Rushing the reps"],
    videoUrl: "/videos/Donkey Kicks.mp4",
    compartment: "Legs",
    intensityLevel: "Moderate",
    intensityRank: 4,
    scientificMetric: "90° knee flexion · Isolated superior gluteal",
    biologicalMechanism: "Flexing the knee to 90° induces active insufficiency in the hamstrings, isolating the hip extension moment exclusively to gluteus maximus.",
  },
  {
    id: "squats",
    name: "Bodyweight Squats",
    category: "Lower Body",
    focus: "Quads, glutes, hamstrings",
    description: "A foundational squat pattern using bodyweight resistance.",
    difficulty: "Beginner",
    tempo: "3–1–2",
    keyPoints: ["Feet stable and comfortable", "Hips travel back and down", "Stand tall without rushing"],
    mistakes: ["Knees collapsing inward", "Heels lifting", "Bouncing at the bottom"],
    videoUrl: "/videos/Bodyweight squats.mp4",
    compartment: "Legs",
    intensityLevel: "Moderate",
    intensityRank: 5,
    scientificMetric: "Bilateral kinetic chain · Balanced quadriceps",
    biologicalMechanism: "Displaces ~70% bodyweight through triple flexion (hip, knee, ankle), balancing quad, hamstring, and gluteal force vectors in a closed kinetic chain.",
  },
  {
    id: "wall-sit",
    name: "Wall Sit",
    category: "Lower Body",
    focus: "Quads, glutes",
    description: "An isometric lower-body hold using a wall for support.",
    difficulty: "Beginner",
    tempo: "Timed hold",
    keyPoints: ["Back supported", "Feet stable", "Use a comfortable knee angle"],
    mistakes: ["Feet too close", "Holding breath", "Pushing beyond comfort"],
    videoUrl: "/videos/Wall sit exercise.mp4",
    compartment: "Legs",
    intensityLevel: "High",
    intensityRank: 6,
    scientificMetric: "Continuous isometric TUT · Hypoxic motor recruitment",
    biologicalMechanism: "Sustained 90° knee flexion maintains high intramuscular pressure in rectus femoris and vastus lateralis, inducing rapid metabolic fatigue and Type-II motor recruitment.",
  },
  {
    id: "sumo-squat",
    name: "Sumo Squats",
    category: "Lower Body",
    focus: "Inner thighs, glutes",
    pattern: "squats",
    description: "A wide-stance squat variation targeting the inner thighs.",
    difficulty: "Beginner",
    tempo: "3–1–2",
    keyPoints: ["Toes turned out comfortably", "Track knees over toes", "Sit down, not just back"],
    mistakes: ["Knees caving inward", "Leaning too far forward", "Partial range"],
    videoUrl: "/videos/Sumo Squats.mp4",
    compartment: "Legs",
    intensityLevel: "High",
    intensityRank: 7,
    scientificMetric: "Abducted wide stance · Adductor magnus emphasis",
    biologicalMechanism: "Hip external rotation and wide base increase the moment arm on hip adductors (adductor magnus and gracilis), increasing inner thigh EMG load.",
  },
  {
    id: "lunges",
    name: "Reverse Lunges",
    category: "Lower Body",
    focus: "Glutes, quads, balance",
    description: "A unilateral leg pattern with a controlled backward step.",
    difficulty: "Beginner",
    tempo: "2–1–2",
    keyPoints: ["Step back smoothly", "Front foot stays planted", "Use a comfortable depth"],
    mistakes: ["Front knee collapsing", "Uncontrolled step", "Pushing only from the toes"],
    videoUrl: "/videos/Reverse Lunges.mp4",
    compartment: "Legs",
    intensityLevel: "High",
    intensityRank: 8,
    scientificMetric: "85%+ unilateral dynamic lead-limb deceleration",
    biologicalMechanism: "Transfers >85% bodyweight onto the lead limb during the eccentric phase, forcing gluteus medius and quadriceps to control dynamic single-leg deceleration.",
  },
  {
    id: "single-leg-deadlift",
    name: "Single-Leg Deadlift",
    category: "Lower Body",
    focus: "Hamstrings, balance",
    pattern: "hinge",
    description: "A single-leg hip hinge that builds balance and posterior-chain strength.",
    difficulty: "Advanced",
    tempo: "3–1–3",
    keyPoints: ["Hinge from the hip, not the waist", "Keep the standing knee soft", "Use a wall for balance if needed"],
    mistakes: ["Rounding the back", "Rotating the hips open", "Rushing the tempo"],
    videoUrl: "/videos/Single Leg Deadlift.mp4",
    compartment: "Legs",
    intensityLevel: "Extreme",
    intensityRank: 9,
    scientificMetric: "Unilateral rotatory hip hinge · High eccentric load",
    biologicalMechanism: "Highest lower-body neuromuscular coordination challenge; standing hip must counteract pelvic transverse rotation while eccentric hamstring stretch reaches maximal tensile strain.",
  },

  // ==========================================
  // CORE & ABDOMINALS COMPARTMENT (Low -> Extreme)
  // ==========================================
  {
    id: "bird-dog",
    name: "Bird Dog",
    category: "Core",
    focus: "Core, hips, coordination",
    description: "A slow quadruped stability drill for controlled opposite-limb movement.",
    difficulty: "Beginner",
    tempo: "3–1–3",
    keyPoints: ["Brace before reaching", "Keep hips square", "Move slowly"],
    mistakes: ["Rotating the pelvis", "Overreaching", "Arching the back"],
    videoUrl: "/videos/Bird Dog Exercise .mp4",
    compartment: "Core",
    intensityLevel: "Low",
    intensityRank: 1,
    scientificMetric: "Cross-body anti-rotation · McGill Big 3 drill",
    biologicalMechanism: "Stuart McGill laboratory benchmark: maintains lumbar compression under 3,000 N while developing high contralateral anterior-posterior stabilizer synchronization.",
  },
  {
    id: "deadbug",
    name: "Dead Bug",
    category: "Core",
    focus: "Core, coordination",
    description: "A floor-based anti-extension drill emphasizing controlled limb movement.",
    difficulty: "Beginner",
    tempo: "Slow",
    keyPoints: ["Keep ribs comfortably down", "Move opposite limbs slowly", "Stop before losing control"],
    mistakes: ["Back arching", "Moving too fast", "Holding breath"],
    videoUrl: "/videos/Dead Bug.mp4",
    compartment: "Core",
    intensityLevel: "Low",
    intensityRank: 2,
    scientificMetric: "Supine anti-extension · Transverse abdominis",
    biologicalMechanism: "Supine posture prevents anterior pelvic tilt; moving opposing limbs creates an anti-extension moment controlled by the transverse abdominis and internal obliques.",
  },
  {
    id: "crunches",
    name: "Standard Crunches",
    category: "Core",
    focus: "Upper abdominals",
    pattern: "curlcore",
    description: "A shorter-range trunk curl that isolates the upper abdominals.",
    difficulty: "Beginner",
    tempo: "2–1–2",
    keyPoints: ["Small controlled range", "Keep chin off the chest", "Squeeze at the top"],
    mistakes: ["Pulling on the head", "Rushing reps", "Holding the breath"],
    videoUrl: "/videos/Standard-crunches.mp4",
    compartment: "Core",
    intensityLevel: "Moderate",
    intensityRank: 3,
    scientificMetric: "0–30° thoracic curl · Upper rectus isolation",
    biologicalMechanism: "Restricting trunk flexion to 0–30° maximizes rectus abdominis mechanical advantage while avoiding hip flexor (psoas) dominance or lumbar disc shear.",
  },
  {
    id: "situps",
    name: "Sit-ups",
    category: "Core",
    focus: "Abdominals, hip flexors",
    pattern: "curlcore",
    description: "A classic full-range trunk flexion movement from lying to seated.",
    difficulty: "Beginner",
    tempo: "2–1–2",
    keyPoints: ["Anchor or brace your feet if needed", "Lead with your chest, not your neck", "Exhale as you curl up"],
    mistakes: ["Yanking the neck forward", "Using momentum to swing up", "Feet popping up off the floor"],
    videoUrl: "/videos/Sit-ups.mp4",
    compartment: "Core",
    intensityLevel: "Moderate",
    intensityRank: 4,
    scientificMetric: "Full excursion trunk flexion · Combined hip flexors",
    biologicalMechanism: "Combines initial 0–30° rectus abdominis curling with secondary iliopsoas hip flexion, transitioning from flat supine to vertical seated posture.",
  },
  {
    id: "plank",
    name: "Forearm Plank",
    category: "Core",
    focus: "Core, shoulders, glutes",
    description: "An isometric brace for trunk stability and body control.",
    difficulty: "Beginner",
    tempo: "Steady hold",
    keyPoints: ["Elbows below shoulders", "Brace gently throughout", "Keep hips level"],
    mistakes: ["Holding the breath", "Hips too high", "Lower back sagging"],
    videoUrl: "/videos/Forearm plank.mp4",
    compartment: "Core",
    intensityLevel: "Moderate",
    intensityRank: 5,
    scientificMetric: "Sagittal anti-extension · Anterior core brace",
    biologicalMechanism: "Horizontal isometric bridge creates a sustained extension gravity moment that requires constant co-contraction of rectus, obliques, and serratus anterior.",
  },
  {
    id: "russian-twist",
    name: "Russian Twists",
    category: "Core",
    focus: "Obliques, rotation",
    pattern: "bicycle",
    description: "A seated rotational movement that challenges the obliques.",
    difficulty: "Intermediate",
    tempo: "Controlled",
    keyPoints: ["Lean back to a stable angle", "Rotate from the ribcage", "Keep the movement smooth"],
    mistakes: ["Rounding the lower back", "Moving too fast for control", "Barely rotating the arms without the torso"],
    videoUrl: "/videos/Russian Twists.mp4",
    compartment: "Core",
    intensityLevel: "High",
    intensityRank: 6,
    scientificMetric: "Dynamic transverse torque · Oblique rotational load",
    biologicalMechanism: "Seated 45° torso angle requires sustained isometric hip flexor and rectus brace while thoracic rotation dynamically stresses internal and external obliques.",
  },
  {
    id: "side-plank",
    name: "Side Plank",
    category: "Core",
    focus: "Obliques, hip stability",
    pattern: "plank",
    description: "A lateral isometric hold that targets the often-neglected obliques.",
    difficulty: "Intermediate",
    tempo: "Steady hold",
    keyPoints: ["Stack shoulders and hips", "Keep hips lifted and level", "Brace the whole side body"],
    mistakes: ["Hips sagging toward the floor", "Shoulder creeping forward", "Holding the breath"],
    videoUrl: "/videos/Side-Plank.mp4",
    compartment: "Core",
    intensityLevel: "High",
    intensityRank: 7,
    scientificMetric: "Frontal anti-lateral flexion · Quadratus lumborum",
    biologicalMechanism: "High frontal-plane demand; lateral gravity shear demands near-maximal isometric endurance from quadratus lumborum, gluteus medius, and obliques.",
  },
  {
    id: "bicycle",
    name: "Bicycle Crunches",
    category: "Core",
    focus: "Abdominals, rotation",
    description: "A controlled trunk exercise combining flexion and rotation.",
    difficulty: "Intermediate",
    tempo: "Slow",
    keyPoints: ["Move from the trunk", "Keep neck relaxed", "Exhale through each controlled rep"],
    mistakes: ["Pulling the neck", "Rushing reps", "Forcing range"],
    videoUrl: "/videos/Bicycle Crunches.mp4",
    compartment: "Core",
    intensityLevel: "High",
    intensityRank: 8,
    scientificMetric: "Maximal EMG peak · Reciprocal rotatory flexion",
    biologicalMechanism: "SDSU biomechanics study ranked #1 in overall abdominal activation due to simultaneous contralateral rotation, upper torso flexion, and lower limb lever extensions.",
  },
  {
    id: "legraises",
    name: "Lying Leg Raises",
    category: "Core",
    focus: "Lower abdominals",
    pattern: "deadbug",
    description: "A leg-lift pattern that targets the lower abdominal region.",
    difficulty: "Intermediate",
    tempo: "3–1–3",
    keyPoints: ["Press your lower back down", "Lift only as high as control allows", "Lower slowly, don't drop"],
    mistakes: ["Lower back arching off the floor", "Using momentum", "Locking the knees hard"],
    videoUrl: "/videos/Lying leg raises.mp4",
    compartment: "Core",
    intensityLevel: "Extreme",
    intensityRank: 9,
    scientificMetric: "Longest lower limb lever · High anti-extension load",
    biologicalMechanism: "Extending both lower limbs creates the longest resistance moment arm against the anterior pelvis, demanding extreme rectus abdominis tension to prevent lumbar hyperextension.",
  },

  // ==========================================
  // METABOLIC CARDIO COMPARTMENT (Low -> Extreme)
  // ==========================================
  {
    id: "jacks",
    name: "Jumping Jacks",
    category: "Cardio",
    focus: "Full body, coordination",
    description: "A simple rhythmic conditioning movement that can be stepped instead of jumped.",
    difficulty: "Beginner",
    tempo: "Rhythmic",
    keyPoints: ["Land softly", "Keep breathing steady", "Scale to step jacks when needed"],
    mistakes: ["Stiff landings", "Holding breath", "Chasing speed over control"],
    videoUrl: "/videos/Jumping Jacks .mp4",
    compartment: "Cardio",
    intensityLevel: "Low",
    intensityRank: 1,
    scientificMetric: "3–4 METs · Low ground reaction force (~1.5x BW)",
    biologicalMechanism: "Light aerobic multi-segmental stimulus; low ground impact (~1.5x BW) facilitates steady-state oxygen uptake with low lactate accumulation.",
  },
  {
    id: "skater-hop",
    name: "Skater Hops",
    category: "Cardio",
    focus: "Lateral power, glutes",
    pattern: "skater",
    description: "A lateral bounding movement that builds frontal-plane control.",
    difficulty: "Intermediate",
    tempo: "Rhythmic",
    keyPoints: ["Land softly on the outside foot", "Keep the chest up", "Scale to a step-touch if needed"],
    mistakes: ["Landing hard and loud", "Losing balance on the landing", "Leaning too far forward"],
    videoUrl: "/videos/Skater Hops .mp4",
    compartment: "Cardio",
    intensityLevel: "Moderate",
    intensityRank: 2,
    scientificMetric: "~6 METs · Frontal plane lateral deceleration",
    biologicalMechanism: "Frontal-plane lateral displacement trains dynamic unilateral hip deceleration while maintaining moderate aerobic and anaerobic cardiovascular demand.",
  },
  {
    id: "mountain",
    name: "Mountain Climbers",
    category: "Cardio",
    focus: "Core, shoulders, conditioning",
    description: "Alternating knee drives from a stable high-plank position.",
    difficulty: "Intermediate",
    tempo: "Steady",
    keyPoints: ["Hands stable", "Keep hips reasonably controlled", "Choose a sustainable pace"],
    mistakes: ["Hips bouncing high", "Losing plank alignment", "Going faster than form allows"],
    videoUrl: "/videos/Mountain Climbers .mp4",
    compartment: "Cardio",
    intensityLevel: "High",
    intensityRank: 3,
    scientificMetric: "8–9 METs · Horizontal high-cadence hip drive",
    biologicalMechanism: "High-cadence hip flexion in a horizontal plank combines isometric upper-body stabilizer endurance with rapid heart rate elevation (8–9 METs).",
  },
  {
    id: "burpees",
    name: "Low-impact Burpee",
    category: "Cardio",
    focus: "Full body, conditioning",
    description: "A scalable full-body conditioning pattern without requiring a jump.",
    difficulty: "Intermediate",
    tempo: "Controlled",
    keyPoints: ["Step rather than jump if needed", "Brace before returning up", "Keep landings quiet if jumping"],
    mistakes: ["Rushing transitions", "Hard landings", "Losing trunk control"],
    videoUrl: "/videos/Low.mp4",
    compartment: "Cardio",
    intensityLevel: "High",
    intensityRank: 4,
    scientificMetric: "Multi-segmental ground-to-stand transitions",
    biologicalMechanism: "Rapid vertical displacement and positional changes demand massive full-body cardiac output and venous return without high plyometric joint shock.",
  },
  {
    id: "jump-squat",
    name: "Jump Squats",
    category: "Cardio",
    focus: "Explosive power, quads",
    pattern: "squats",
    description: "An explosive squat variation for power and conditioning.",
    difficulty: "Advanced",
    tempo: "Explosive",
    keyPoints: ["Land softly through the whole foot", "Absorb the landing into the next squat", "Scale to a regular squat if needed"],
    mistakes: ["Landing stiff-legged", "Knees caving on landing", "Chasing height over control"],
    videoUrl: "/videos/Jump Squats.mp4",
    compartment: "Cardio",
    intensityLevel: "Extreme",
    intensityRank: 5,
    scientificMetric: "Peak stretch-shortening cycle · 3–4x BW impact",
    biologicalMechanism: "Maximal rate of force development (RFD); stretch-shortening cycle in knee extensors with peak ground reaction forces reaching 3.5x bodyweight on eccentric landings.",
  },

  // ==========================================
  // MOBILITY & FLEXIBILITY COMPARTMENT (Low -> Extreme)
  // ==========================================
  {
    id: "childs-pose",
    name: "Child's Pose",
    category: "Flexibility",
    focus: "Back, hips, shoulders",
    pattern: "sway",
    description: "A restorative resting stretch for the back and hips.",
    difficulty: "Beginner",
    tempo: "Timed hold",
    keyPoints: ["Sit hips back toward the heels", "Let the arms relax forward", "Breathe into the lower back"],
    mistakes: ["Forcing hips down when tight hips resist", "Holding tension in the shoulders", "Rushing out of the pose"],
    videoUrl: "/videos/Child's Pose.mp4",
    compartment: "Flexibility",
    intensityLevel: "Low",
    intensityRank: 1,
    scientificMetric: "Parasympathetic down-regulation · Spinal decompression",
    biologicalMechanism: "Passive hip flexion and axial spinal decompression stimulate vagal tone, lowering sympathetic nervous system activation and resting heart rate.",
  },
  {
    id: "cat-cow",
    name: "Cat-Cow Stretch",
    category: "Flexibility",
    focus: "Spinal mobility",
    pattern: "hinge",
    description: "A gentle spinal wave that improves segmental mobility.",
    difficulty: "Beginner",
    tempo: "Slow flow",
    keyPoints: ["Move one vertebra at a time", "Sync breath with movement", "Keep the motion smooth"],
    mistakes: ["Moving too fast", "Shrugging the shoulders", "Holding the breath"],
    videoUrl: "/videos/Cat Cow pose.mp4",
    compartment: "Flexibility",
    intensityLevel: "Low",
    intensityRank: 2,
    scientificMetric: "Segmental spinal articulation & disc hydration",
    biologicalMechanism: "Alternating sagittal spinal flexion and extension stimulates synovial fluid diffusion and promotes intervertebral disc health.",
  },
  {
    id: "cobra-stretch",
    name: "Cobra Stretch",
    category: "Flexibility",
    focus: "Abdominals, spine",
    pattern: "bridges",
    description: "A gentle backbend that opens the front of the body.",
    difficulty: "Beginner",
    tempo: "Timed hold",
    keyPoints: ["Push up only as far as comfortable", "Keep hips on the floor", "Relax the shoulders down"],
    mistakes: ["Overextending the neck", "Shrugging the shoulders up", "Pushing into sharp pain"],
    videoUrl: "/videos/Cobra Stretch.mp4",
    compartment: "Flexibility",
    intensityLevel: "Moderate",
    intensityRank: 3,
    scientificMetric: "Anterior fascia release · Psoas & rectus stretch",
    biologicalMechanism: "Elongates the anterior superficial myofascial chain (rectus abdominis, psoas major) counteracting prolonged sitting posture.",
  },
  {
    id: "seated-fold",
    name: "Seated Forward Fold",
    category: "Flexibility",
    focus: "Hamstrings, lower back",
    pattern: "sway",
    description: "A seated hinge that lengthens the entire posterior chain.",
    difficulty: "Beginner",
    tempo: "Timed hold",
    keyPoints: ["Hinge from the hips, not the back", "Keep the spine long", "Only fold as far as comfortable"],
    mistakes: ["Rounding aggressively to reach the toes", "Bouncing into the stretch", "Locking the knees hard"],
    videoUrl: "/videos/Seated Forward Fold.mp4",
    compartment: "Flexibility",
    intensityLevel: "Moderate",
    intensityRank: 4,
    scientificMetric: "Superficial back line myofascial elongation",
    biologicalMechanism: "Sustained passive hip flexion under relaxed breathing triggers the Golgi tendon organ reflex in hamstrings and gastrocnemius, releasing tonic tension.",
  },
  {
    id: "spinal-twist",
    name: "Supine Spinal Twist",
    category: "Flexibility",
    focus: "Spine, obliques",
    pattern: "bicycle",
    description: "A relaxed lying twist that releases tension through the spine.",
    difficulty: "Beginner",
    tempo: "Timed hold",
    keyPoints: ["Keep both shoulders on the floor", "Let gravity do the work", "Breathe slowly into the stretch"],
    mistakes: ["Forcing the knees down", "Lifting the opposite shoulder", "Holding the breath"],
    videoUrl: "/videos/SUPINE Spinal Twist.mp4",
    compartment: "Flexibility",
    intensityLevel: "Moderate",
    intensityRank: 5,
    scientificMetric: "Transverse paraspinal & piriformis release",
    biologicalMechanism: "Transverse plane spinal rotation gently mobilizes thoracic facet joints while stretching the piriformis and tensor fasciae latae complex.",
  },
  {
    id: "world-greatest-stretch",
    name: "World's Greatest Stretch",
    category: "Flexibility",
    focus: "Hips, thoracic spine",
    pattern: "sway",
    description: "A multi-joint mobility flow that opens the hips and upper back.",
    difficulty: "Beginner",
    tempo: "Slow flow",
    keyPoints: ["Sink deep into the lunge", "Rotate from the upper back", "Breathe deeply through the stretch"],
    mistakes: ["Rushing between positions", "Forcing the rotation", "Holding the breath"],
    videoUrl: "/videos/World's Greatest Stretch.mp4",
    compartment: "Flexibility",
    intensityLevel: "High",
    intensityRank: 6,
    scientificMetric: "Multi-joint kinetic flow · Thoracic & hip mobility",
    biologicalMechanism: "Tri-planar dynamic flow: combines deep hip flexion (anterior chain), hamstring lengthening (posterior chain), and thoracic spine rotation in one seamless kinetic movement.",
  },
];

const CATEGORY_TABS = [
  "All Compartments",
  "Chest",
  "Shoulders",
  "Back",
  "Legs",
  "Core",
  "Cardio",
  "Flexibility",
  "Favorites",
];

function getIntensityBadgeStyle(level: IntensityLevel) {
  switch (level) {
    case "Low":
      return {
        bg: "bg-emerald-500/15",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
        dot: "bg-emerald-400",
        label: "Low (Level 1)",
      };
    case "Moderate":
      return {
        bg: "bg-sky-500/15",
        text: "text-sky-400",
        border: "border-sky-500/30",
        dot: "bg-sky-400",
        label: "Moderate (Level 2)",
      };
    case "High":
      return {
        bg: "bg-amber-500/15",
        text: "text-amber-400",
        border: "border-amber-500/30",
        dot: "bg-amber-400",
        label: "High (Level 3)",
      };
    case "Extreme":
      return {
        bg: "bg-rose-500/15",
        text: "text-rose-400",
        border: "border-rose-500/30",
        dot: "bg-rose-400",
        label: "Extreme (Level 4)",
      };
  }
}

/**
 * Large motion video / model renderer for modal preview
 */
function MotionDemo({
  exercise,
  gender,
  model,
}: {
  exercise: ExerciseDemo;
  gender: FigureGender;
  model: DemoTone;
}) {
  const hot = "#38d6ff";
  const cool = "#00e5a0";

  const videoSrc = useMemo(
    () => (exercise.isBlankPhoto ? null : getExerciseVideo(exercise.id, exercise.videoUrl, exercise.name)),
    [exercise.id, exercise.videoUrl, exercise.name, exercise.isBlankPhoto]
  );
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setVideoError(false);
    setIsPlaying(true);
  }, [exercise.id, videoSrc]);

  const hasVideo = !!videoSrc && !videoError;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div
      className="relative h-72 overflow-hidden rounded-[24px] sm:h-80"
      style={{
        background: "radial-gradient(130% 100% at 50% 0%, #131826 0%, #080a11 70%)",
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${hot} 26%, transparent), 0 0 44px -14px ${hot}`,
      }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(60% 55% at 28% 22%, ${hot}59 0%, transparent 62%), radial-gradient(58% 60% at 76% 82%, ${cool}4d 0%, transparent 64%)`,
        }}
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-10 bottom-5 h-16 rounded-[50%]"
        style={{ background: `radial-gradient(closest-side, ${hot}3d, transparent)` }}
      />

      {hasVideo ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            key={videoSrc}
            src={videoSrc}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => setVideoError(true)}
            onClick={togglePlay}
            className="h-full w-full cursor-pointer object-contain"
          />
        </div>
      ) : (
        <ExerciseThumb
          name={exercise.name}
          targetMuscle={exercise.focus}
          gender={gender}
          model={model}
          tone="cyan"
          bare
          isBlankPhoto={exercise.isBlankPhoto}
          signaturePose={exercise.signaturePose}
        />
      )}

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 z-20 w-1/3 skew-x-[-18deg]"
        style={{ background: "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.13), transparent)" }}
        animate={{ x: ["0%", "460%"] }}
        transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }}
      />

      <div
        className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest backdrop-blur"
        style={{ color: hot }}
      >
        {exercise.isBlankPhoto ? (
          <>
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            AI Dynamic Movement
          </>
        ) : hasVideo ? (
          <>
            <Video className="h-3.5 w-3.5" style={{ color: hot }} />
            Video Form
          </>
        ) : (
          <>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: hot, boxShadow: `0 0 8px ${hot}` }} />
            Live Form
          </>
        )}
      </div>

      <div className="pointer-events-none absolute right-4 top-4 z-30 flex items-center gap-2">
        <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[10px] font-bold text-white/70 backdrop-blur">
          MALE PRO
        </div>
      </div>

      <div className="absolute inset-x-4 bottom-4 z-30 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Tempo</p>
          <p className="text-sm font-black text-white">{exercise.tempo}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasVideo ? (
            <>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause video" : "Play video"}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur transition hover:bg-black/80"
              >
                {isPlaying ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                className="flex items-center justify-center rounded-full border border-white/15 bg-black/60 p-1.5 text-white/80 backdrop-blur transition hover:bg-black/80 hover:text-white"
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1 text-[10px] font-bold text-white/50">
              <Play className="h-3.5 w-3.5 fill-current" /> Looping
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ExerciseCardItemProps {
  ex: ExerciseDemo;
  idx: number;
  isFavorited: boolean;
  figureGender: FigureGender;
  demoModel: DemoTone;
  onSelect: (ex: ExerciseDemo) => void;
  onToggleFavorite: (id: string) => void;
}

const ExerciseCardItem = memo(function ExerciseCardItem({
  ex,
  idx,
  isFavorited,
  figureGender,
  demoModel,
  onSelect,
  onToggleFavorite,
}: ExerciseCardItemProps) {
  const badge = getIntensityBadgeStyle(ex.intensityLevel);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[20px] border border-white/10 bg-gradient-to-b from-slate-900/90 to-black/90 text-left shadow-md transition-all hover:-translate-y-0.5 hover:border-cyan-500/40 active:scale-[0.98]">
      {/* Visual Thumb / Blank Photo */}
      <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
        <ExerciseThumb
          name={ex.name}
          targetMuscle={ex.focus}
          gender={figureGender}
          model={demoModel}
          tone="emerald"
          bare
          still
          isBlankPhoto={ex.isBlankPhoto}
          signaturePose={ex.signaturePose}
        />

        {/* Succession order badge (1, 2, 3...) */}
        <div className="absolute left-2 top-2 z-20 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur">
          <span>#{idx + 1}</span>
          <span className="text-slate-400">·</span>
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
          <span className={badge.text}>{ex.intensityLevel}</span>
        </div>

        {/* Favorite button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(ex.id);
          }}
          aria-pressed={isFavorited}
          aria-label={isFavorited ? `Unfavorite ${ex.name}` : `Favorite ${ex.name}`}
          className="absolute right-2 top-2 z-20 rounded-full bg-black/50 p-1.5 text-white/80 backdrop-blur hover:bg-black/70 hover:text-white"
        >
          <Star
            className={`h-3.5 w-3.5 ${isFavorited ? "fill-amber-400 text-amber-400" : ""}`}
          />
        </button>
      </div>

      {/* Card Content */}
      <div className="flex flex-1 flex-col justify-between p-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${badge.bg} ${badge.border} ${badge.text}`}
            >
              {badge.label}
            </span>
            {ex.isCustomAi && (
              <span className="flex items-center gap-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 px-1 py-0.5 text-[8px] font-black text-cyan-400">
                <Sparkles className="h-2.5 w-2.5" /> AI
              </span>
            )}
          </div>
          <h3 className="mt-1.5 line-clamp-1 text-sm font-black tracking-tight text-white">
            {ex.name}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-slate-400">
            {ex.focus}
          </p>
        </div>

        {/* Biomechanical Data Pill */}
        <div className="mt-2.5 rounded-xl border border-white/10 bg-white/5 p-1.5">
          <p className="line-clamp-1 text-[9px] font-semibold text-cyan-300">
            ⚡ {ex.scientificMetric}
          </p>
        </div>
      </div>

      {/* Tap to open detail */}
      <button
        type="button"
        onClick={() => onSelect(ex)}
        aria-label={`Open biomechanical details for ${ex.name}`}
        className="absolute inset-0 z-10 rounded-[20px]"
      />
    </div>
  );
});

interface ExerciseLibraryProps {
  onNavigateToLog?: (exName: string) => void;
  favorites?: string[];
  onToggleFavorite?: (id: string) => void;
  profile?: UserProfile;
  onOpenFormScanner?: (exName?: string) => void;
}

export default function ExerciseLibrary({
  onNavigateToLog,
  favorites = [],
  onToggleFavorite,
  profile: _profile,
  onOpenFormScanner,
}: ExerciseLibraryProps) {
  const [selected, setSelected] = useState<ExerciseDemo | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("All Compartments");

  const [figureGender] = useState<FigureGender>("male");
  const [demoModel, setDemoModel] = useState<DemoTone>(readDemoModel);
  const setModelPersisted = (m: DemoTone) => {
    setDemoModel(m);
    writeDemoModel(m);
  };

  // Dynamically ingested AI exercises
  const [customAiExercises, setCustomAiExercises] = useState<CustomExerciseItem[]>(getCustomAcademyExercises);

  useEffect(() => {
    const handleCustomUpdate = () => {
      setCustomAiExercises(getCustomAcademyExercises());
    };
    window.addEventListener("kinetic_custom_exercises_updated", handleCustomUpdate);
    window.addEventListener("storage", handleCustomUpdate);
    return () => {
      window.removeEventListener("kinetic_custom_exercises_updated", handleCustomUpdate);
      window.removeEventListener("storage", handleCustomUpdate);
    };
  }, []);

  // Merge built-in exercises with dynamic AI exercises
  const allExercises = useMemo<ExerciseDemo[]>(() => {
    const customDemos: ExerciseDemo[] = customAiExercises.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      focus: c.focus,
      description: c.description,
      difficulty: c.difficulty,
      keyPoints: c.keyPoints,
      mistakes: c.mistakes,
      tempo: c.tempo,
      compartment: c.compartment,
      intensityLevel: c.intensityLevel,
      intensityRank: c.intensityRank,
      scientificMetric: `AI Biomechanical Target · ${c.compartment}`,
      biologicalMechanism: `Dynamic AI generated movement calibrated for progressive neuromuscular stimulus in the ${c.compartment} compartment.`,
      isBlankPhoto: false,
      isCustomAi: true,
      signaturePose: c.signaturePose,
      videoUrl: c.videoUrl,
    }));

    return [...DEMO_EXERCISES, ...customDemos];
  }, [customAiExercises]);

  // Voice narration
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  useEffect(() => {
    audio.stopSpeaking();
    setSpeakingId(null);
  }, [selected?.id]);
  useEffect(() => () => audio.stopSpeaking(), []);

  const toggleVoiceOver = (ex: ExerciseDemo) => {
    if (speakingId === ex.id) {
      audio.stopSpeaking();
      setSpeakingId(null);
      return;
    }
    const narration = `${ex.name}. ${ex.description}. Anatomical compartment: ${ex.compartment}. Biomechanical level: ${ex.intensityLevel}. Scientific principle: ${ex.scientificMetric}. Coach cues: ${ex.keyPoints.join(". ")}.`;
    audio.speak(narration, {
      gender: figureGender,
      onStart: () => setSpeakingId(ex.id),
      onEnd: () => setSpeakingId(null),
    });
  };

  const toggleFavorite = (id: string) => onToggleFavorite?.(id);

  // Non-blocking deferred query for concurrent UI responsiveness
  const deferredQuery = useDeferredValue(query);

  // Group exercises by compartment, STRICTLY SORTED FROM LOW TO EXTREME (1 to N)
  const compartmentMap = useMemo(() => {
    const map = new Map<AnatomicalCompartment, ExerciseDemo[]>();
    COMPARTMENTS.forEach((comp) => {
      map.set(comp.id, []);
    });

    const q = deferredQuery.trim().toLowerCase();

    allExercises.forEach((ex) => {
      const matchesSearch =
        !q ||
        ex.name.toLowerCase().includes(q) ||
        ex.focus.toLowerCase().includes(q) ||
        ex.category.toLowerCase().includes(q) ||
        ex.compartment.toLowerCase().includes(q) ||
        ex.scientificMetric.toLowerCase().includes(q);

      if (!matchesSearch) return;

      if (activeTab === "Favorites") {
        if (!favorites.includes(ex.id)) return;
      } else if (activeTab !== "All Compartments" && ex.compartment !== activeTab) {
        return;
      }

      const list = map.get(ex.compartment) || [];
      list.push(ex);
      map.set(ex.compartment, list);
    });

    // STRICT SUCCESSIVE SORTING: LOW (1) -> MODERATE (2) -> HIGH (3) -> EXTREME (4+)
    map.forEach((list) => {
      list.sort((a, b) => a.intensityRank - b.intensityRank);
    });

    return map;
  }, [allExercises, deferredQuery, activeTab, favorites]);

  const totalFilteredCount = useMemo(() => {
    let count = 0;
    compartmentMap.forEach((list) => {
      count += list.length;
    });
    return count;
  }, [compartmentMap]);

  return (
    <div className="animate-fade-in pb-12" id="exercise-library-view">
      {/* Top Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-600">
            Scientific Anatomy Compartments
          </span>
          {customAiExercises.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-600">
              <Sparkles className="h-3 w-3" /> {customAiExercises.length} AI Custom
            </span>
          )}
        </div>

        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight text-slate-950">
              Movement Academy
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Exercises are strictly compartmentalized by anatomical chain and arranged sequentially from low to extreme biomechanical load based on real motor unit recruitment data.
            </p>
          </div>
          <div className="hidden rounded-2xl bg-slate-900 px-3 py-2 text-right text-white sm:block">
            <p className="text-lg font-black">{allExercises.length}</p>
            <p className="text-[9px] uppercase tracking-widest text-white/50">movements</p>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="relative mt-4 overflow-hidden rounded-[24px] p-[2px]">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-indigo-500 to-emerald-400 opacity-80" />
          <div className="relative flex h-32 items-center overflow-hidden rounded-[22px] bg-slate-950 sm:h-36">
            <img
              src={gymDailyMotivationImg}
              alt="Exercise Science &amp; Athletic Training"
              className="absolute inset-0 h-full w-full object-cover object-[65%_25%] opacity-80"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent" />
            <div className="relative z-10 max-w-[70%] pl-5 pr-3 sm:max-w-[58%] sm:pl-6">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-cyan-300">
                <BarChart2 className="h-3.5 w-3.5" /> Bioenergetic Progression
              </div>
              <p className="mt-1 text-sm font-black leading-tight text-white sm:text-lg">
                Zero Mixed Groups · Low to Extreme Succession
              </p>
              <p className="mt-1 text-[11px] font-semibold text-slate-300 sm:text-xs">
                Biomechanical moment arms &amp; biological motor unit recruitment
              </p>
            </div>
          </div>
        </div>

        {/* Athlete model lock & tone preferences */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-1.5 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Athlete Model</span>
            <span className="flex items-center gap-1 rounded-xl bg-slate-900 px-2.5 py-1 text-xs font-black text-white">
              <Mars className="h-3.5 w-3.5 text-cyan-400" /> Male Pro
            </span>
          </div>

          <div className="flex items-center gap-2">
            <LofiMusicButton mode="soothing" />
            <div className="flex items-center gap-1 rounded-2xl border border-slate-100 bg-white px-2 py-1 shadow-xs">
              <span className="pl-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Tone</span>
              {(["white", "black"] as const).map((m) => (
                <button
                  key={m}
                  id={`btn-demo-model-${m}`}
                  aria-pressed={demoModel === m}
                  onClick={() => setModelPersisted(m)}
                  className={`rounded-xl px-2.5 py-1 text-xs font-black capitalize transition-all ${
                    demoModel === m ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movements, muscles or biological loading..."
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Compartment Tabs (Clean horizontal scroll) */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORY_TABS.map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black transition-all ${
                isSelected
                  ? "bg-slate-950 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab === "Favorites" ? (
                <>
                  <Star className={`h-3 w-3 ${favorites.length > 0 ? "fill-amber-400 text-amber-400" : ""}`} />
                  Favorites {favorites.length > 0 ? `(${favorites.length})` : ""}
                </>
              ) : tab === "All Compartments" ? (
                <>
                  <Layers className="h-3 w-3 text-sky-400" />
                  All Compartments
                </>
              ) : (
                tab
              )}
            </button>
          );
        })}
      </div>

      {/* Compartment Shelves (Unmixed Sections) */}
      <div className="mt-4 space-y-7">
        {COMPARTMENTS.map((comp) => {
          const exercisesInComp = compartmentMap.get(comp.id) || [];
          if (exercisesInComp.length === 0) return null;

          const CompIcon = comp.icon;

          return (
            <section
              key={comp.id}
              id={`compartment-shelf-${comp.id.toLowerCase()}`}
              className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-black/95 p-4 shadow-xl sm:p-5 backdrop-blur-xl"
              style={{ contentVisibility: "auto", containIntrinsicSize: "0 360px" }}
            >
              {/* Compartment Header: Title, Biological Principle, Progression Indicator */}
              <div className="mb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {comp.coverImage && (
                      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-xl border border-cyan-500/30 shadow-md">
                        <img
                          src={comp.coverImage}
                          alt={comp.title}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${comp.badgeBg} ${comp.badgeText}`}>
                          <CompIcon className="h-3 w-3 mr-1" />
                          {comp.shortName}
                        </span>
                        <h2 className="text-base font-black tracking-tight text-white sm:text-lg">
                          {comp.title}
                        </h2>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-400">
                        {comp.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-cyan-300">
                    <span>{exercisesInComp.length} movements</span>
                  </div>
                </div>

                {/* Biological Principle & Loading Ladder Card - Upgraded Biomechanical HUD */}
                <div className="mt-3.5 rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-950/40 via-slate-900/80 to-blue-950/40 p-3.5 shadow-md">
                  <div className="flex items-start gap-2.5">
                    <BarChart2 className="h-4 w-4 mt-0.5 shrink-0 text-cyan-400" />
                    <div className="text-xs">
                      <span className="font-black uppercase tracking-wider text-[10px] text-cyan-300 block mb-0.5">
                        Biomechanical Principle
                      </span>
                      <span className="text-slate-200 font-medium leading-relaxed">
                        {comp.scientificPrinciple}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-xs">
                    <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-300 shrink-0">
                      Successive Curve:
                    </span>
                    <span className="truncate font-mono text-[11px] text-slate-300">{comp.loadingCurve}</span>
                  </div>
                </div>
              </div>

              {/* Successive Exercise Grid (strictly sorted Low -> Extreme, fully memoized) */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
                {exercisesInComp.map((ex, idx) => (
                  <ExerciseCardItem
                    key={ex.id}
                    ex={ex}
                    idx={idx}
                    isFavorited={favorites.includes(ex.id)}
                    figureGender={figureGender}
                    demoModel={demoModel}
                    onSelect={setSelected}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {totalFilteredCount === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xs">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-3 text-base font-black text-slate-900">No movements found</h3>
            <p className="mt-1 text-xs text-slate-500">
              No exercises match your query in this compartment. Try adjusting your search term.
            </p>
            <button
              onClick={() => {
                setQuery("");
                setActiveTab("All Compartments");
              }}
              className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal: Complete Biomechanical & Physiological Analysis */}
      {selected &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 backdrop-blur-xs sm:items-center sm:p-6"
            onClick={() => setSelected(null)}
          >
            <div
              className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-slate-950 p-4 text-white shadow-2xl animate-fade-in sm:rounded-[28px] sm:p-5"
              style={{ paddingBottom: "calc(var(--safe-b, 0px) + 24px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-400">
                    {selected.compartment} Compartment
                  </span>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      getIntensityBadgeStyle(selected.intensityLevel).bg
                    } ${getIntensityBadgeStyle(selected.intensityLevel).border} ${
                      getIntensityBadgeStyle(selected.intensityLevel).text
                    }`}
                  >
                    Level {selected.intensityRank}: {selected.intensityLevel}
                  </span>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <MotionDemo exercise={selected} gender={figureGender} model={demoModel} />

              <div className="mt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-white">{selected.name}</h2>
                    <p className="mt-1 text-xs text-white/60">{selected.focus}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleVoiceOver(selected)}
                      aria-label={speakingId === selected.id ? "Stop voice-over" : "Play voice-over"}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition-all ${
                        speakingId === selected.id
                          ? "bg-cyan-400 text-slate-950"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {speakingId === selected.id ? (
                        <>
                          <Square className="h-3.5 w-3.5 fill-current" /> Stop
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3.5 w-3.5" /> Narrate
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => toggleFavorite(selected.id)}
                      className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black ${
                        favorites.includes(selected.id) ? "bg-amber-400 text-slate-950" : "bg-white/10 text-white"
                      }`}
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${favorites.includes(selected.id) ? "fill-current" : ""}`}
                      />
                      {favorites.includes(selected.id) ? "Favorited" : "Favorite"}
                    </button>
                    <button
                      onClick={() => onOpenFormScanner?.(selected.name)}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-3 py-2 text-xs font-black text-slate-950 shadow-md active:scale-95 transition-transform"
                    >
                      <Scan className="h-3.5 w-3.5" /> Form Check
                    </button>
                    <button
                      onClick={() => onNavigateToLog?.(selected.name)}
                      className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 hover:bg-slate-100"
                    >
                      Log <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Biological & Biomechanical Analysis Card */}
                <div className="mt-4 rounded-2xl border border-cyan-500/25 bg-cyan-950/20 p-4">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <BarChart2 className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      🧬 Biological & Biomechanical Rationale
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-cyan-100/90">
                    {selected.biologicalMechanism || selected.scientificMetric}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-cyan-500/20 pt-2 text-[10px] text-cyan-300">
                    <span>Target Loading: {selected.scientificMetric}</span>
                    <span className="font-black">Intensity Rank: #{selected.intensityRank}</span>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-white/70">{selected.description}</p>

                {/* Coach Cues & Mistakes */}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Coach Cues</span>
                    </div>
                    {selected.keyPoints.map((x) => (
                      <p key={x} className="mt-2 text-xs text-white/75">
                        • {x}
                      </p>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-rose-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Common Mistakes</span>
                    </div>
                    {selected.mistakes.map((x) => (
                      <p key={x} className="mt-2 text-xs text-white/75">
                        • {x}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Parameters */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <Timer className="h-4 w-4 text-white/40" />
                    <p className="mt-1 text-[10px] uppercase text-white/35">Tempo</p>
                    <p className="text-xs font-black">{selected.tempo}</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <Dumbbell className="h-4 w-4 text-white/40" />
                    <p className="mt-1 text-[10px] uppercase text-white/35">Equipment</p>
                    <p className="text-xs font-black">{selected.equipment || "Bodyweight"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <HeartPulse className="h-4 w-4 text-white/40" />
                    <p className="mt-1 text-[10px] uppercase text-white/35">Compartment</p>
                    <p className="text-xs font-black">{selected.compartment}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
