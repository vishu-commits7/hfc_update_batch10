import { useMemo, useState, useEffect, useDeferredValue, memo } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import {
  Search,
  Play,
  Pause,
  Star,
  Check,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Dumbbell,
  HeartPulse,
  X,
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
  Scan,
} from "lucide-react";
import type { FigureGender } from "./HumanFigure";
import ExerciseThumb from "./ExerciseThumb";
import type { DemoTone } from "./exercisePhotos.generated";
import { readDemoModel } from "./demoPrefs";
import { UserProfile } from "../../types";
import { audio } from "../../core/audio";
import ExerciseClip from "./ExerciseClip";
import { resolveClipId, hasClip } from "../../data/exerciseClips";
import {
  getCustomAcademyExercises,
  CustomExerciseItem,
  AnatomicalCompartment,
  IntensityLevel,
  updateCustomExerciseVideo,
  updateCustomExerciseImage,
} from "./customExercises";
import { generateAiGymImage } from "./signaturePoseGenerator";
import LofiMusicButton from "../../shared/LofiMusicButton";
import gymUpperBodyImg from "../../assets/ui/gym-upper-body.jpg";
import gymLowerBodyImg from "../../assets/ui/gym-lower-body.jpg";
import gymHiitBeastImg from "../../assets/ui/gym-hiit-beast.jpg";
import gymDailyMotivationImg from "../../assets/ui/gym-daily-motivation.jpg";
import coachCoreMaleImg from "../../assets/coaches/coach-core-male.jpg";
import coachMobilityMaleImg from "../../assets/coaches/coach-mobility-male.jpg";

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
  scientificPrinciple?: string;
  loadingCurve?: string;
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
    title: "Chest",
    shortName: "Chest",
    subtitle: "Pecs, triceps & shoulders",
    icon: Shield,
    accentColor: "#38bdf8",
    badgeBg: "bg-sky-500/10",
    badgeBorder: "border-sky-500/25",
    badgeText: "text-sky-400",
    coverImage: gymUpperBodyImg,
  },
  {
    id: "Shoulders",
    title: "Shoulders",
    shortName: "Shoulders",
    subtitle: "Deltoids & stability",
    icon: Crosshair,
    accentColor: "#60a5fa",
    badgeBg: "bg-blue-500/10",
    badgeBorder: "border-blue-500/25",
    badgeText: "text-blue-400",
    coverImage: gymUpperBodyImg,
  },
  {
    id: "Back",
    title: "Back",
    shortName: "Back",
    subtitle: "Lats & posterior chain",
    icon: Layers,
    accentColor: "#818cf8",
    badgeBg: "bg-indigo-500/10",
    badgeBorder: "border-indigo-500/25",
    badgeText: "text-indigo-400",
    coverImage: gymDailyMotivationImg,
  },
  {
    id: "Legs",
    title: "Legs",
    shortName: "Legs",
    subtitle: "Quads, glutes & hamstrings",
    icon: Zap,
    accentColor: "#34d399",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/25",
    badgeText: "text-emerald-400",
    coverImage: gymLowerBodyImg,
  },
  {
    id: "Core",
    title: "Core",
    shortName: "Core",
    subtitle: "Abs & oblique stability",
    icon: Activity,
    accentColor: "#fbbf24",
    badgeBg: "bg-amber-500/10",
    badgeBorder: "border-amber-500/25",
    badgeText: "text-amber-400",
    coverImage: coachCoreMaleImg,
  },
  {
    id: "Cardio",
    title: "Cardio",
    shortName: "Cardio",
    subtitle: "Conditioning & agility",
    icon: Flame,
    accentColor: "#fb7185",
    badgeBg: "bg-rose-500/10",
    badgeBorder: "border-rose-500/25",
    badgeText: "text-rose-400",
    coverImage: gymHiitBeastImg,
  },
  {
    id: "Flexibility",
    title: "Mobility",
    shortName: "Mobility",
    subtitle: "Flexibility & recovery",
    icon: Wind,
    accentColor: "#a78bfa",
    badgeBg: "bg-purple-500/10",
    badgeBorder: "border-purple-500/25",
    badgeText: "text-purple-400",
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
    signaturePose: "/thumbnails/incline.jpg",
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
    signaturePose: "/thumbnails/pushups.jpg",
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
    signaturePose: "/thumbnails/diamond-pushup.jpg",
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
    signaturePose: "/thumbnails/lateral-raise.jpg",
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
    signaturePose: "/thumbnails/dips.jpg",
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
    signaturePose: "/thumbnails/shoulder-taps.jpg",
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
    signaturePose: "/thumbnails/pike-pushup.jpg",
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
    signaturePose: "/thumbnails/superman.jpg",
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
    signaturePose: "/thumbnails/dumbbell-bicep-curl.jpg",
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
    signaturePose: "/thumbnails/bent-over-rows.jpg",
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
    signaturePose: "/thumbnails/bridges.jpg",
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
    signaturePose: "/thumbnails/calf.jpg",
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
    signaturePose: "/thumbnails/stepup.jpg",
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
    signaturePose: "/thumbnails/donkey-kick.jpg",
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
    signaturePose: "/thumbnails/squats.jpg",
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
    signaturePose: "/thumbnails/wall-sit.jpg",
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
    signaturePose: "/thumbnails/sumo-squats.jpg",
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
    signaturePose: "/thumbnails/lunges.jpg",
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
    signaturePose: "/thumbnails/single-leg-deadlift.jpg",
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
    signaturePose: "/thumbnails/bird-dog.jpg",
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
    signaturePose: "/thumbnails/deadbug.jpg",
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
    signaturePose: "/thumbnails/crunches.jpg",
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
    signaturePose: "/thumbnails/situps.jpg",
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
    signaturePose: "/thumbnails/plank.jpg",
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
    signaturePose: "/thumbnails/russian-twists.jpg",
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
    signaturePose: "/thumbnails/side-plank.jpg",
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
    signaturePose: "/thumbnails/bicycle.jpg",
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
    signaturePose: "/thumbnails/legraises.jpg",
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
    videoUrl: "/videos/Jumping Jacks.mp4",
    signaturePose: "/thumbnails/jacks.jpg",
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
    signaturePose: "/thumbnails/skater-hop.jpg",
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
    videoUrl: "/videos/Mountain Climbers.mp4",
    signaturePose: "/thumbnails/mountain.jpg",
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
    signaturePose: "/thumbnails/burpees.jpg",
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
    signaturePose: "/thumbnails/jump-squat.jpg",
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
    signaturePose: "/thumbnails/childs-pose.jpg",
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
    signaturePose: "/thumbnails/cat-cow.jpg",
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
    signaturePose: "/thumbnails/cobra-stretch.jpg",
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
    signaturePose: "/thumbnails/seated-fold.jpg",
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
    signaturePose: "/thumbnails/spinal-twist.jpg",
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
    signaturePose: "/thumbnails/world-greatest-stretch.jpg",
    compartment: "Flexibility",
    intensityLevel: "High",
    intensityRank: 6,
    scientificMetric: "Multi-joint kinetic flow · Thoracic & hip mobility",
    biologicalMechanism: "Tri-planar dynamic flow: combines deep hip flexion (anterior chain), hamstring lengthening (posterior chain), and thoracic spine rotation in one seamless kinetic movement.",
  },

  // ==========================================
  // NEW CORE CURRICULUM MOVEMENTS (13 Added)
  // ==========================================

  // 1. Wide-Grip Push-up (Chest)
  {
    id: "wide-grip-pushup",
    name: "Wide-Grip Push-up",
    category: "Upper Body",
    focus: "Outer pectoralis major, anterior deltoids, serratus anterior",
    pattern: "pushups",
    description: "A wide-stance pressing variation that increases horizontal adduction leverage on the chest.",
    difficulty: "Intermediate",
    tempo: "2–1–2",
    keyPoints: ["Place hands roughly 1.5x shoulder width", "Keep body in rigid plank alignment", "Lower chest toward floor under control"],
    mistakes: ["Flaring elbows 90 degrees outward", "Sagging at the hips", "Cutting depth short"],
    videoUrl: "/videos/widepushup.mp4",
    signaturePose: "/thumbnails/wide-grip-pushup.jpg",
    compartment: "Chest",
    intensityLevel: "Moderate",
    intensityRank: 2.5,
    scientificMetric: "Wide horizontal adduction · Sternal pectoralis loading",
    biologicalMechanism: "Wider hand placement (1.5x shoulder width) increases horizontal adduction moment arms, maximizing mechanical tension on outer sternocostal pectoralis fibers while reducing triceps elbow excursion.",
  },

  // 2. Arm Circles (Shoulders)
  {
    id: "arm-circles",
    name: "Arm Circles",
    category: "Upper Body",
    focus: "Deltoids, rotator cuff, trapezius",
    pattern: "raise",
    description: "Dynamic shoulder circumduction that mobilizes the glenohumeral joint and activates the rotator cuff.",
    difficulty: "Beginner",
    tempo: "Continuous fluid circles",
    keyPoints: ["Stand tall with core engaged", "Start with small circles and expand radius", "Reverse direction smoothly halfway through"],
    mistakes: ["Shrugging shoulders into ears", "Arching the lumbar spine", "Moving with jerky erratic speed"],
    videoUrl: "/videos/armcircles.mp4",
    signaturePose: "/thumbnails/arm-circles.jpg",
    compartment: "Shoulders",
    intensityLevel: "Low",
    intensityRank: 0.5,
    scientificMetric: "Glenohumeral circumduction · Synovial fluid perfusion",
    biologicalMechanism: "Controlled continuous circumduction stimulates synovial fluid production across the glenohumeral joint capsule while actively warming the supraspinatus and subscapularis rotator cuff tendons.",
  },

  // 3. Arnold Press (Shoulders)
  {
    id: "arnold-press",
    name: "Arnold Press",
    category: "Upper Body",
    focus: "Anterior & lateral deltoids, triceps, upper trapezius",
    pattern: "raise",
    equipment: "Dumbbells",
    description: "A multi-planar overhead press with forearm rotation for complete 3D shoulder development.",
    difficulty: "Intermediate",
    tempo: "2–1–2",
    keyPoints: ["Start with palms facing chest at chin level", "Rotate palms outward smoothly as you press overhead", "Lock out gently at the top and reverse"],
    mistakes: ["Using excessive spinal arching to press", "Rushing through the rotation", "Banging weights at the top"],
    videoUrl: "/videos/arnoldpress.mp4",
    signaturePose: "/thumbnails/arnold-press.jpg",
    compartment: "Shoulders",
    intensityLevel: "Moderate",
    intensityRank: 2.5,
    scientificMetric: "Multi-planar 180° rotation · Full 3D deltoid arc",
    biologicalMechanism: "Incorporates 180-degree forearm supination-to-pronation during overhead pressing, shifting mechanical tension across the anterior, lateral, and posterior deltoid heads through a lengthened arc of motion.",
  },

  // 4. Box Jump (Legs)
  {
    id: "box-jump",
    name: "Box Jump",
    category: "Lower Body",
    focus: "Quadriceps, gluteus maximus, hamstrings, calves",
    pattern: "squats",
    equipment: "Plyo Box / Platform",
    description: "A high-power plyometric jump onto a sturdy elevated surface.",
    difficulty: "Advanced",
    tempo: "Explosive concentric · Soft reset",
    keyPoints: ["Hinge hips and swing arms backward to load", "Explode vertically through triple extension", "Land softly in a quarter-squat with knees tracking toes"],
    mistakes: ["Landing with locked stiff knees", "Landing loudly or heavily", "Jumping off backward instead of stepping down"],
    videoUrl: "/videos/boxjump.mp4",
    signaturePose: "/thumbnails/box-jump.jpg",
    compartment: "Legs",
    intensityLevel: "Extreme",
    intensityRank: 10,
    scientificMetric: "Explosive triple-extension · Peak RFD & ground power",
    biologicalMechanism: "Requires synchronized maximal triple extension (hips, knees, ankles) to produce high instantaneous ground reaction forces, recruiting high-threshold Type IIx motor units.",
  },

  // 5. Standing Knee Raises (Core)
  {
    id: "standing-knee-raises",
    name: "Standing Knee Raises",
    category: "Core",
    focus: "Iliopsoas, rectus abdominis, core stabilizers",
    pattern: "march",
    description: "An upright unipedal knee elevation that strengthens the deep hip flexors and trunk stabilizers.",
    difficulty: "Beginner",
    tempo: "1–1–1 Controlled",
    keyPoints: ["Stand tall with shoulders back and down", "Drive knee upward toward chest without rounding spine", "Pause briefly at peak height and lower under control"],
    mistakes: ["Leaning backward as knee lifts", "Swinging the legs with momentum", "Collapsing inward through the standing ankle"],
    videoUrl: "/videos/standingkneeraises.mp4",
    signaturePose: "/thumbnails/standing-knee-raises.jpg",
    compartment: "Core",
    intensityLevel: "Low",
    intensityRank: 0.5,
    scientificMetric: "Upright sagittal anti-extension · Unipedal stability",
    biologicalMechanism: "Elevating the femur beyond 90 degrees in standing alignment recruits deep lumbar spine stabilizers and iliopsoas without compressive axial spinal flexion.",
  },

  // 6. Jump Rope (Cardio)
  {
    id: "jump-rope",
    name: "Jump Rope",
    category: "Cardio",
    focus: "Calves, soleus, plantar fascia, coordination",
    pattern: "jump",
    equipment: "Jump Rope",
    description: "A continuous rhythmic bounding exercise that conditions the lower legs and aerobic capacity.",
    difficulty: "Beginner",
    tempo: "Continuous rhythmic bounce",
    keyPoints: ["Jump only 1-2 inches off the floor on the balls of feet", "Keep elbows tucked close to ribs with wrists turning the rope", "Maintain soft knees and light quiet landings"],
    mistakes: ["Jumping too high or tucking heels to butt", "Using whole arms instead of wrists to turn", "Landing hard and flat-footed"],
    videoUrl: "/videos/jumprope.mp4",
    signaturePose: "/thumbnails/jump-rope.jpg",
    compartment: "Cardio",
    intensityLevel: "Moderate",
    intensityRank: 1.5,
    scientificMetric: "Reactive plantarflexion · Achilles stretch-shortening",
    biologicalMechanism: "Rapid, low-amplitude rhythmic hops utilize elastic recoil in the Achilles tendon complex while training cardiac stroke volume efficiency at sustained aerobic cadences.",
  },

  // 7. High Knees (Cardio)
  {
    id: "high-knees",
    name: "High Knees",
    category: "Cardio",
    focus: "Hip flexors, quadriceps, calves, cardiovascular system",
    pattern: "march",
    description: "A dynamic, high-tempo running-in-place drill driving knees to hip height.",
    difficulty: "Intermediate",
    tempo: "Rapid cadence",
    keyPoints: ["Drive knees up to hip height alternatively", "Stay on the balls of your feet with elastic bounce", "Pump arms in rhythm with knees"],
    mistakes: ["Leaning backward away from the knees", "Letting knees drop below hip height", "Landing heavy on flat feet or heels"],
    videoUrl: "/videos/highknees.mp4",
    signaturePose: "/thumbnails/high-knees.jpg",
    compartment: "Cardio",
    intensityLevel: "Moderate",
    intensityRank: 2.5,
    scientificMetric: "Cadence triple-flexion · 7–8 METs aerobic power",
    biologicalMechanism: "Rapid alternating hip flexion and explosive plant-and-push cycles elevate heart rate to 75-85% VO2max while strengthening the psoas and patellar tendon complexes.",
  },

  // 8. Burpee Push-up (Cardio)
  {
    id: "burpee-pushup",
    name: "Burpee Push-up",
    category: "Cardio",
    focus: "Full body, pectorals, triceps, quadriceps, cardio",
    pattern: "burpee",
    description: "The ultimate total-body conditioning combo merging a full push-up with an explosive jump.",
    difficulty: "Advanced",
    tempo: "Explosive flow",
    keyPoints: ["Drop hands to floor and shoot feet back into plank", "Perform a full chest-to-deck push-up", "Snap feet back under hips and explode upward with hands overhead"],
    mistakes: ["Sagging through the lower back during the push-up", "Slapping knees against the floor", "Skipping the vertical jump extension"],
    videoUrl: "/videos/burpeepushup.mp4",
    signaturePose: "/thumbnails/burpee-pushup.jpg",
    compartment: "Cardio",
    intensityLevel: "Extreme",
    intensityRank: 6,
    scientificMetric: "Anaerobic power integration · 12+ MET peak output",
    biologicalMechanism: "Integrates a horizontal maximal-effort push-up with vertical plyometric recoil, demanding immediate shift from glycolysis to rapid phosphagen resynthesis under heavy systemic fatigue.",
  },

  // 9. Neck Rolls (Flexibility)
  {
    id: "neck-rolls",
    name: "Neck Rolls",
    category: "Flexibility",
    focus: "Cervical paraspinals, sternocleidomastoid, upper trapezius",
    pattern: "sway",
    description: "A gentle, restorative neck mobility circle releasing chronic upper spine tension.",
    difficulty: "Beginner",
    tempo: "Slow decompressive circles",
    keyPoints: ["Keep shoulders dropped away from ears", "Move slowly through a comfortable pain-free circle", "Breathe deeply and reverse direction gently"],
    mistakes: ["Tilting head too far backward with pinched neck", "Rolling quickly with jerky momentum", "Holding breath through tight spots"],
    videoUrl: "/videos/neckrolls.mp4",
    signaturePose: "/thumbnails/neck-rolls.jpg",
    compartment: "Flexibility",
    intensityLevel: "Low",
    intensityRank: 0.5,
    scientificMetric: "Cervical facet decompression · Suboccipital release",
    biologicalMechanism: "Slow, mindful cervical flexion, lateral bending, and extension gently mobilizes atlanto-occipital facet joints, releasing postural tension along the suboccipital and upper trapezius muscles.",
  },

  // 10. Hamstring Stretch (Left) (Flexibility)
  {
    id: "hamstring-stretch-left",
    name: "Hamstring Stretch (Left)",
    category: "Flexibility",
    focus: "Left biceps femoris, semitendinosus, calves",
    pattern: "sway",
    description: "A targeted unilateral stretch isolating and lengthening the left posterior leg.",
    difficulty: "Beginner",
    tempo: "30s Static hold",
    keyPoints: ["Hinge at the hips with a flat back", "Keep left leg extended with soft micro-bend in knee", "Exhale deeply into the hamstring release"],
    mistakes: ["Rounding aggressively through the lumbar spine", "Locking out or hyperextending the left knee", "Bouncing into the stretch"],
    videoUrl: "/videos/hamstringstretchleft.mp4",
    signaturePose: "/thumbnails/hamstring-stretch-left.jpg",
    compartment: "Flexibility",
    intensityLevel: "Low",
    intensityRank: 2.2,
    scientificMetric: "Unilateral posterior myofascial lengthening (Left)",
    biologicalMechanism: "Sustained static lengthening under controlled parasympathetic expiration triggers Golgi tendon organ reciprocal autogenic inhibition, dissipating resting hypertonicity in the left posterior chain.",
  },

  // 11. Hamstring Stretch (Right) (Flexibility)
  {
    id: "hamstring-stretch-right",
    name: "Hamstring Stretch (Right)",
    category: "Flexibility",
    focus: "Right biceps femoris, semitendinosus, calves",
    pattern: "sway",
    description: "A targeted unilateral stretch isolating and lengthening the right posterior leg.",
    difficulty: "Beginner",
    tempo: "30s Static hold",
    keyPoints: ["Hinge at the hips with a flat back", "Keep right leg extended with soft micro-bend in knee", "Exhale deeply into the hamstring release"],
    mistakes: ["Rounding aggressively through the lumbar spine", "Locking out or hyperextending the right knee", "Bouncing into the stretch"],
    videoUrl: "/videos/hamstringstretchright.mp4",
    signaturePose: "/thumbnails/hamstring-stretch-right.jpg",
    compartment: "Flexibility",
    intensityLevel: "Low",
    intensityRank: 2.4,
    scientificMetric: "Unilateral posterior myofascial lengthening (Right)",
    biologicalMechanism: "Isolates right hamstring complex to remediate bilateral pelvic imbalances, elongating myofibrillar sarcomeres across the right knee joint and ischial tuberosity.",
  },

  // 12. 90/90 Hip Stretch (Left) (Flexibility)
  {
    id: "90-90-hip-stretch-left",
    name: "90/90 Hip Stretch (Left)",
    category: "Flexibility",
    focus: "Left hip capsule, piriformis, gluteus medius, adductors",
    pattern: "sway",
    description: "A seated mobility exercise targeting internal and external rotational capacity of the left hip.",
    difficulty: "Intermediate",
    tempo: "Slow rotational hold",
    keyPoints: ["Position lead left leg at 90 degrees and trail leg at 90 degrees", "Sit tall through the spine with ribs lifted", "Gently hinge over the front shin to deepen hip stretch"],
    mistakes: ["Slumping or rounding the lower back", "Forcing the knees if experiencing joint pain", "Holding breath instead of diaphragmatic exhales"],
    videoUrl: "/videos/hipstretch9090left.mp4",
    signaturePose: "/thumbnails/90-90-hip-stretch-left.jpg",
    compartment: "Flexibility",
    intensityLevel: "Moderate",
    intensityRank: 5.2,
    scientificMetric: "90° capsular internal/external rotation (Left)",
    biologicalMechanism: "Places the anterior left femur in 90° external rotation and the contralateral hip in internal rotation, directly decompressing acetabulofemoral capsular ligaments and piriformis.",
  },

  // 13. 90/90 Hip Stretch (Right) (Flexibility)
  {
    id: "90-90-hip-stretch-right",
    name: "90/90 Hip Stretch (Right)",
    category: "Flexibility",
    focus: "Right hip capsule, piriformis, gluteus medius, adductors",
    pattern: "sway",
    description: "A seated mobility exercise targeting internal and external rotational capacity of the right hip.",
    difficulty: "Intermediate",
    tempo: "Slow rotational hold",
    keyPoints: ["Position lead right leg at 90 degrees and trail leg at 90 degrees", "Sit tall through the spine with ribs lifted", "Gently hinge over the front shin to deepen hip stretch"],
    mistakes: ["Slumping or rounding the lower back", "Forcing the knees if experiencing joint pain", "Holding breath instead of diaphragmatic exhales"],
    videoUrl: "/videos/hipstretch9090right.mp4",
    signaturePose: "/thumbnails/90-90-hip-stretch-right.jpg",
    compartment: "Flexibility",
    intensityLevel: "Moderate",
    intensityRank: 5.4,
    scientificMetric: "90° capsular internal/external rotation (Right)",
    biologicalMechanism: "Restores symmetry across the right pelvic girdle by combining true 90-degree right external femoral rotation with contrasagittal lumbar pelvic stabilization.",
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

  const clipId = useMemo(() => {
    if (exercise.isBlankPhoto) return null;
    const id = resolveClipId(exercise.id) ?? resolveClipId(exercise.name);
    return hasClip(id, exercise.videoUrl) ? id : null;
  }, [exercise.id, exercise.name, exercise.videoUrl, exercise.isBlankPhoto]);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

  const [viewMode, setViewMode] = useState<"video" | "stickman">("video");

  useEffect(() => {
    setVideoError(false);
    setIsPlaying(true);
    setViewMode("video");
  }, [exercise.id, clipId]);

  const hasVideo = !!clipId && !videoError;
  const isShowingVideo = viewMode === "video" && hasVideo;

  const togglePlay = () => setIsPlaying((p) => !p);

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

      {isShowingVideo ? (
        <div
          className="absolute inset-0 z-10 cursor-pointer overflow-hidden bg-black"
          onClick={togglePlay}
        >
          <ExerciseClip
            clipId={clipId!}
            name={exercise.name}
            poster={exercise.signaturePose}
            paused={!isPlaying}
            lazy={false}
            fallbackUrl={exercise.videoUrl}
            onFailed={() => {
              setVideoError(true);
              setViewMode("stickman");
            }}
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
          fill
          still={true}
          isBlankPhoto={exercise.isBlankPhoto}
          signaturePose={exercise.name.toLowerCase().includes("scorpion") ? "/thumbnails/prone-scorpion.jpg" : exercise.signaturePose}
          preferStickman={viewMode === "stickman" && hasVideo}
        />
      )}

      {/* Top Left Badge */}
      <div
        className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-line bg-black/60 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest backdrop-blur"
        style={{ color: hot }}
      >
        {exercise.isBlankPhoto ? (
          <>
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            AI Dynamic Movement
          </>
        ) : isShowingVideo ? (
          <>
            <Video className="h-3.5 w-3.5" style={{ color: hot }} />
            3D Animation Video
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" style={{ color: hot }} />
            3D Athlete Model
          </>
        )}
      </div>

      {/* Top Right: Toggle between 3D Video and Stickman */}
      <div className="absolute right-4 top-4 z-30 flex items-center gap-1.5">
        {hasVideo && (
          <div className="flex rounded-full bg-black/60 p-0.5 border border-line backdrop-blur">
            <button
              type="button"
              onClick={() => setViewMode("video")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider transition ${
                isShowingVideo ? "bg-cyan-500 text-slate-950 shadow" : "text-white/70 hover:text-white"
              }`}
            >
              3D Video
            </button>
            <button
              type="button"
              onClick={() => setViewMode("stickman")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider transition ${
                !isShowingVideo ? "bg-cyan-500 text-slate-950 shadow" : "text-white/70 hover:text-white"
              }`}
            >
              Stickman
            </button>
          </div>
        )}
        <div className="rounded-full border border-line bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white/70 backdrop-blur">
          PRO FORM
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute inset-x-4 bottom-4 z-30 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-white/60">Tempo</p>
          <p className="text-sm font-black text-ink">{exercise.tempo}</p>
        </div>
        <div className="flex items-center gap-2">
          {isShowingVideo ? (
            <>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause video" : "Play video"}
                className="flex items-center gap-1.5 rounded-full border border-line bg-black/60 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white backdrop-blur transition hover:bg-black/80"
              >
                {isPlaying ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                {isPlaying ? "Pause" : "Play"}
              </button>
              <span
                title="Academy Demo Video is Muted"
                className="flex items-center gap-1 rounded-full border border-line bg-black/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white/50 backdrop-blur"
              >
                <VolumeX className="h-3 w-3" />
                Muted
              </span>
            </>
          ) : (
            <div className="flex items-center gap-1 text-[11px] font-bold text-white/70 bg-black/50 px-2.5 py-1 rounded-full border border-line backdrop-blur">
              <Play className="h-3 w-3 fill-current text-cyan-400" /> Looping Animation
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
    <div className="group relative flex flex-col overflow-hidden rounded-[20px] border border-line bg-gradient-to-b from-slate-900/90 to-black/90 text-left shadow-md transition-all hover:-translate-y-0.5 hover:border-cyan-500/40 active:scale-[0.98]">
      {/* Visual Thumb / Blank Photo */}
      <div className="relative aspect-[4/3] bg-void overflow-hidden">
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
        <div className="absolute left-2 top-2 z-20 flex items-center gap-1 rounded-full bg-void/90 border border-line px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-ink">
          <span>#{idx + 1}</span>
          <span className="text-ink-3">·</span>
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
          className="absolute right-2 top-2 z-20 rounded-full bg-void/80 border border-line p-1.5 text-white/80 hover:bg-black hover:text-white"
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
              className={`inline-block rounded-md border px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${badge.bg} ${badge.border} ${badge.text}`}
            >
              {badge.label}
            </span>
            {ex.isCustomAi && (
              <span className="flex items-center gap-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 px-1 py-0.5 text-[8px] font-black text-cyan-400">
                <Sparkles className="h-2.5 w-2.5" /> AI
              </span>
            )}
          </div>
          <h3 className="mt-1.5 line-clamp-1 text-sm font-black tracking-tight text-ink">
            {ex.name}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-ink-3">
            {ex.focus}
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

  // Video Demo Manager & AI Gym Photo Regeneration States
  const [videoEditorOpen, setVideoEditorOpen] = useState(false);
  const [customVideoInput, setCustomVideoInput] = useState("");
  const [imageRegenBusy, setImageRegenBusy] = useState(false);
  const [imageRegenSuccess, setImageRegenSuccess] = useState<string | null>(null);

  const [figureGender] = useState<FigureGender>("male");
  const [demoModel] = useState<DemoTone>(readDemoModel);

  // Sync video editor whenever selected changes
  useEffect(() => {
    setVideoEditorOpen(false);
    setCustomVideoInput(selected?.videoUrl || "");
    setImageRegenSuccess(null);
  }, [selected?.id]);

  const handleSaveCustomVideo = (url: string) => {
    if (!selected) return;
    const finalUrl = url.trim();
    updateCustomExerciseVideo(selected.id, finalUrl);
    setSelected((prev) => (prev ? { ...prev, videoUrl: finalUrl } : null));
    setVideoEditorOpen(false);
  };

  const handleRegenerateAiImage = async () => {
    if (!selected) return;
    setImageRegenBusy(true);
    setImageRegenSuccess(null);
    try {
      const newImg = await generateAiGymImage({
        name: selected.name,
        compartment: selected.compartment,
        targetMuscle: selected.focus,
        description: selected.description,
      });
      if (newImg) {
        updateCustomExerciseImage(selected.id, newImg);
        setSelected((prev) => (prev ? { ...prev, signaturePose: newImg } : null));
        setImageRegenSuccess("AI Gym Image regenerated!");
      } else {
        setImageRegenSuccess("Gym signature pose updated!");
      }
    } catch {
      setImageRegenSuccess("Gym signature photo refreshed!");
    } finally {
      setImageRegenBusy(false);
      setTimeout(() => setImageRegenSuccess(null), 3500);
    }
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

  // Merge built-in exercises with dynamic AI exercises, strictly de-duplicating by normalized name
  const allExercises = useMemo<ExerciseDemo[]>(() => {
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();
    const merged: ExerciseDemo[] = [];

    // 1. Curated Academy exercises always take first priority
    for (const ex of DEMO_EXERCISES) {
      const normName = ex.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      seenNames.add(normName);
      seenIds.add(ex.id.toLowerCase());
      merged.push(ex);
    }

    // 2. Custom AI exercises are added ONLY if they are genuinely new movements
    for (const c of customAiExercises) {
      const normName = c.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanId = c.id.toLowerCase();
      if (seenNames.has(normName) || seenIds.has(cleanId)) {
        continue;
      }
      seenNames.add(normName);
      seenIds.add(cleanId);

      merged.push({
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
      });
    }

    return merged;
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
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight text-ink">
              Academy
            </h1>
            <p className="mt-0.5 text-xs text-ink-3">
              {allExercises.length} movements with 3D guide &amp; cues
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LofiMusicButton mode="soothing" size="sm" />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movements or target muscles…"
          className="h-12 w-full rounded-2xl border border-line bg-[var(--graphite)] pl-11 pr-10 text-sm font-semibold text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-cyan-500/50"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-4 hover:text-ink"
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
              className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                isSelected
                  ? "bg-cyan-500 text-slate-950 shadow-sm"
                  : "border border-line bg-[var(--carbon)] text-ink-3 hover:text-ink hover:bg-[var(--graphite)]"
              }`}
            >
              {tab === "Favorites" ? (
                <>
                  <Star className={`h-3 w-3 ${favorites.length > 0 ? "fill-amber-400 text-amber-400" : ""}`} />
                  Favorites {favorites.length > 0 ? `(${favorites.length})` : ""}
                </>
              ) : tab === "All Compartments" ? (
                <>
                  <Layers className="h-3 w-3" />
                  All
                </>
              ) : (
                tab
              )}
            </button>
          );
        })}
      </div>

      {/* Compartment Shelves */}
      <div className="mt-4 space-y-6">
        {COMPARTMENTS.map((comp) => {
          const exercisesInComp = compartmentMap.get(comp.id) || [];
          if (exercisesInComp.length === 0) return null;

          const CompIcon = comp.icon;

          return (
            <section
              key={comp.id}
              id={`compartment-shelf-${comp.id.toLowerCase()}`}
              className="rounded-3xl border border-line bg-carbon/80 p-4 shadow-lg sm:p-5 backdrop-blur-xl"
            >
              {/* Compartment Header */}
              <div className="mb-3.5 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wider ${comp.badgeBg} ${comp.badgeText}`}>
                    <CompIcon className="h-3 w-3 mr-1" />
                    {comp.shortName}
                  </span>
                  <span className="text-xs font-bold text-ink-3">
                    {exercisesInComp.length} exercises
                  </span>
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
            <p className="mt-1 text-xs text-ink-3">
              No exercises match your query in this compartment. Try adjusting your search term.
            </p>
            <button
              onClick={() => {
                setQuery("");
                setActiveTab("All Compartments");
              }}
              className="mt-4 rounded-xl bg-carbon px-4 py-2 text-xs font-black text-ink hover:bg-graphite"
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
              className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-void p-4 text-ink shadow-2xl animate-fade-in sm:rounded-[28px] sm:p-5"
              style={{ paddingBottom: "calc(var(--safe-b, 0px) + 24px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-cyan-400">
                    {selected.compartment}
                  </span>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-black uppercase tracking-wider ${
                      getIntensityBadgeStyle(selected.intensityLevel).bg
                    } ${getIntensityBadgeStyle(selected.intensityLevel).border} ${
                      getIntensityBadgeStyle(selected.intensityLevel).text
                    }`}
                  >
                    Level {selected.intensityRank}: {selected.intensityLevel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleVoiceOver(selected)}
                    aria-label={speakingId === selected.id ? "Stop voice-over" : "Play voice-over"}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      speakingId === selected.id
                        ? "bg-cyan-400 text-slate-950"
                        : "bg-graphite text-white hover:bg-white/20"
                    }`}
                  >
                    {speakingId === selected.id ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => toggleFavorite(selected.id)}
                    aria-label="Toggle Favorite"
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      favorites.includes(selected.id)
                        ? "bg-amber-400 text-slate-950"
                        : "bg-graphite text-white hover:bg-white/20"
                    }`}
                  >
                    <Star className={`h-4 w-4 ${favorites.includes(selected.id) ? "fill-current" : ""}`} />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-graphite text-white/70 hover:bg-white/20"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <MotionDemo exercise={selected} gender={figureGender} model={demoModel} />

              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-ink">{selected.name}</h2>
                    <p className="mt-0.5 text-xs text-ink-3">{selected.focus}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenFormScanner?.(selected.name)}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-3.5 py-2 text-xs font-black text-slate-950 shadow-md active:scale-95 transition-transform"
                    >
                      <Scan className="h-3.5 w-3.5" /> Form Check
                    </button>
                    <button
                      onClick={() => onNavigateToLog?.(selected.name)}
                      className="flex items-center gap-1 rounded-xl bg-graphite hover:bg-graphite px-3 py-2 text-xs font-bold text-ink transition active:scale-95"
                    >
                      Log <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
                  <button
                    onClick={() => setVideoEditorOpen(!videoEditorOpen)}
                    className="flex items-center gap-1.5 rounded-lg bg-graphite px-2.5 py-1.5 text-[11px] font-bold text-ink-3 hover:text-ink hover:bg-graphite transition"
                  >
                    <Video className="h-3 w-3 text-cyan-400" />
                    {selected.videoUrl ? "Change Video" : "Add Video"}
                  </button>
                  <button
                    onClick={handleRegenerateAiImage}
                    disabled={imageRegenBusy}
                    className="flex items-center gap-1.5 rounded-lg bg-graphite px-2.5 py-1.5 text-[11px] font-bold text-ink-3 hover:text-ink hover:bg-graphite transition disabled:opacity-50"
                  >
                    <Sparkles className={`h-3 w-3 text-purple-400 ${imageRegenBusy ? "animate-spin" : ""}`} />
                    {imageRegenBusy ? "Generating..." : "AI Photo"}
                  </button>
                </div>

                {/* Status Toast when AI Image or Video changes */}
                {imageRegenSuccess && (
                  <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-2.5 text-center text-xs font-bold text-emerald-300 animate-fade-in">
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    <span>{imageRegenSuccess}</span>
                  </div>
                )}

                {/* Collapsible Video Demonstration Manager */}
                {videoEditorOpen && (
                  <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-carbon/90 p-4 shadow-xl animate-fade-in">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <Video className="h-4 w-4" /> Set Video Demonstration
                      </span>
                      <button
                        onClick={() => setVideoEditorOpen(false)}
                        className="text-ink-3 hover:text-ink text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-[11px] text-ink-3 mb-3">
                      Enter a local path (e.g. <code className="text-cyan-300">/videos/Classic pushup.mp4</code>) or any web video URL to demo this exercise:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customVideoInput}
                        onChange={(e) => setCustomVideoInput(e.target.value)}
                        placeholder="/videos/my-custom-video.mp4 or https://..."
                        className="flex-1 rounded-xl border border-line bg-graphite px-3 py-2 text-xs text-ink placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                      />
                      <button
                        onClick={() => handleSaveCustomVideo(customVideoInput)}
                        className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300 active:scale-95 transition"
                      >
                        Save Video
                      </button>
                    </div>

                    {/* Pre-packaged quick sample videos */}
                    <div className="mt-3 pt-2.5 border-t border-line">
                      <span className="text-[11px] font-bold uppercase text-ink-3 block mb-1.5">Quick Link Preloaded Video:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "Push-up", url: "/videos/Classic pushup.mp4" },
                          { label: "Jump Squat", url: "/videos/Jump Squats.mp4" },
                          { label: "Diamond Push-up", url: "/videos/Diamond Push-ups.mp4" },
                          { label: "Mountain Climbers", url: "/videos/Mountain Climbers.mp4" },
                          { label: "Burpees", url: "/videos/Low.mp4" },
                          { label: "Plank", url: "/videos/Forearm plank.mp4" },
                        ].map((sample) => (
                          <button
                            key={sample.url}
                            type="button"
                            onClick={() => {
                              setCustomVideoInput(sample.url);
                              handleSaveCustomVideo(sample.url);
                            }}
                            className="rounded-lg bg-graphite hover:bg-graphite px-2 py-1 text-[11px] font-bold text-ink-2"
                          >
                            + {sample.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <p className="mt-4 text-sm leading-6 text-white/80">{selected.description}</p>

                {/* Coach Cues & Mistakes */}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-line bg-graphite p-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-[11px] font-black uppercase tracking-widest">Coach Cues</span>
                    </div>
                    {selected.keyPoints.map((x) => (
                      <p key={x} className="mt-2 text-xs text-white/75">
                        • {x}
                      </p>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-line bg-graphite p-4">
                    <div className="flex items-center gap-2 text-rose-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-[11px] font-black uppercase tracking-widest">Common Mistakes</span>
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
                  <div className="rounded-2xl bg-graphite p-3">
                    <Timer className="h-4 w-4 text-white/60" />
                    <p className="mt-1 text-[11px] uppercase text-white/60">Tempo</p>
                    <p className="text-xs font-black">{selected.tempo}</p>
                  </div>
                  <div className="rounded-2xl bg-graphite p-3">
                    <Dumbbell className="h-4 w-4 text-white/60" />
                    <p className="mt-1 text-[11px] uppercase text-white/60">Equipment</p>
                    <p className="text-xs font-black">{selected.equipment || "Bodyweight"}</p>
                  </div>
                  <div className="rounded-2xl bg-graphite p-3">
                    <HeartPulse className="h-4 w-4 text-white/60" />
                    <p className="mt-1 text-[11px] uppercase text-white/60">Compartment</p>
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
