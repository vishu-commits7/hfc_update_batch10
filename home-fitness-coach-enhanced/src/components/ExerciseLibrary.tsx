import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Search, Play, Star, ChevronRight, CheckCircle2, AlertTriangle, Timer, Dumbbell, HeartPulse, X, Mars, Venus, Volume2, Square } from "lucide-react";
import type { FigureGender } from "./HumanFigure";
import ExerciseThumb from "./ExerciseThumb";
import type { DemoTone } from "../lib/exercisePhotos.generated";
import { readDemoModel, writeDemoModel } from "../lib/demoPrefs";
import { UserProfile } from "../types";
import { audio } from "../lib/audio";
import heroDeadlift from "../assets/ui/hero-deadlift.jpg";

export interface ExerciseDemo {
  id: string; name: string; category: string; focus: string; description: string;
  difficulty: string; keyPoints: string[]; mistakes: string[]; tempo: string;
  /** Optional: reuse another id's CSS motion animation instead of defining a new one. */
  pattern?: string;
  equipment?: string;
}

export const DEMO_EXERCISES: ExerciseDemo[] = [
 {id:"pushups",name:"Classic Push-ups",category:"Upper Body",focus:"Chest, triceps, shoulders",description:"A controlled horizontal press from a stable plank position.",difficulty:"Intermediate",tempo:"2–1–2",keyPoints:["Hands under or slightly outside shoulders","Keep the trunk braced","Lower only through a comfortable range"],mistakes:["Hips dropping","Elbows flaring hard","Rushing the lowering phase"]},
 {id:"squats",name:"Bodyweight Squats",category:"Lower Body",focus:"Quads, glutes, hamstrings",description:"A foundational squat pattern using bodyweight resistance.",difficulty:"Beginner",tempo:"3–1–2",keyPoints:["Feet stable and comfortable","Hips travel back and down","Stand tall without rushing"],mistakes:["Knees collapsing inward","Heels lifting","Bouncing at the bottom"]},
 {id:"plank",name:"Forearm Plank",category:"Core",focus:"Core, shoulders, glutes",description:"An isometric brace for trunk stability and body control.",difficulty:"Beginner",tempo:"Steady hold",keyPoints:["Elbows below shoulders","Brace gently throughout","Keep hips level"],mistakes:["Holding the breath","Hips too high","Lower back sagging"]},
 {id:"lunges",name:"Reverse Lunges",category:"Lower Body",focus:"Glutes, quads, balance",description:"A unilateral leg pattern with a controlled backward step.",difficulty:"Beginner",tempo:"2–1–2",keyPoints:["Step back smoothly","Front foot stays planted","Use a comfortable depth"],mistakes:["Front knee collapsing","Uncontrolled step","Pushing only from the toes"]},
 {id:"burpees",name:"Low-impact Burpee",category:"Cardio",focus:"Full body, conditioning",description:"A scalable full-body conditioning pattern without requiring a jump.",difficulty:"Intermediate",tempo:"Controlled",keyPoints:["Step rather than jump if needed","Brace before returning up","Keep landings quiet if jumping"],mistakes:["Rushing transitions","Hard landings","Losing trunk control"]},
 {id:"bridges",name:"Glute Bridges",category:"Lower Body",focus:"Glutes, hamstrings",description:"A floor-based hip extension movement emphasizing controlled glute engagement.",difficulty:"Beginner",tempo:"2–2–2",keyPoints:["Feet planted","Lift through the hips","Pause briefly at the top"],mistakes:["Overarching the back","Pushing from toes","Dropping quickly"]},
 {id:"mountain",name:"Mountain Climbers",category:"Cardio",focus:"Core, shoulders, conditioning",description:"Alternating knee drives from a stable high-plank position.",difficulty:"Intermediate",tempo:"Steady",keyPoints:["Hands stable","Keep hips reasonably controlled","Choose a sustainable pace"],mistakes:["Hips bouncing high","Losing plank alignment","Going faster than form allows"]},
 {id:"dips",name:"Chair Tricep Dips",category:"Upper Body",focus:"Triceps, shoulders",description:"A chair-assisted pressing movement using a stable surface and comfortable range.",difficulty:"Beginner",tempo:"2–1–2",keyPoints:["Use a stable chair","Keep shoulders comfortable","Move slowly"],mistakes:["Chair sliding","Going too deep","Shrugging shoulders"]},
 {id:"jacks",name:"Jumping Jacks",category:"Cardio",focus:"Full body, coordination",description:"A simple rhythmic conditioning movement that can be stepped instead of jumped.",difficulty:"Beginner",tempo:"Rhythmic",keyPoints:["Land softly","Keep breathing steady","Scale to step jacks when needed"],mistakes:["Stiff landings","Holding breath","Chasing speed over control"]},
 {id:"bicycle",name:"Bicycle Crunches",category:"Core",focus:"Abdominals, rotation",description:"A controlled trunk exercise combining flexion and rotation.",difficulty:"Intermediate",tempo:"Slow",keyPoints:["Move from the trunk","Keep neck relaxed","Exhale through each controlled rep"],mistakes:["Pulling the neck","Rushing reps","Forcing range"]},
 {id:"wall-sit",name:"Wall Sit",category:"Lower Body",focus:"Quads, glutes",description:"An isometric lower-body hold using a wall for support.",difficulty:"Beginner",tempo:"Timed hold",keyPoints:["Back supported","Feet stable","Use a comfortable knee angle"],mistakes:["Feet too close","Holding breath","Pushing beyond comfort"]},
 {id:"bird-dog",name:"Bird Dog",category:"Core",focus:"Core, hips, coordination",description:"A slow quadruped stability drill for controlled opposite-limb movement.",difficulty:"Beginner",tempo:"3–1–3",keyPoints:["Brace before reaching","Keep hips square","Move slowly"],mistakes:["Rotating the pelvis","Overreaching","Arching the back"]},
 {id:"calf",name:"Calf Raises",category:"Lower Body",focus:"Calves, ankle control",description:"A simple standing calf-strengthening movement with a stable base.",difficulty:"Beginner",tempo:"2–1–2",keyPoints:["Use a stable stance","Rise smoothly","Lower under control"],mistakes:["Bouncing","Rolling ankles","Rushing the descent"]},
 {id:"deadbug",name:"Dead Bug",category:"Core",focus:"Core, coordination",description:"A floor-based anti-extension drill emphasizing controlled limb movement.",difficulty:"Beginner",tempo:"Slow",keyPoints:["Keep ribs comfortably down","Move opposite limbs slowly","Stop before losing control"],mistakes:["Back arching","Moving too fast","Holding breath"]},
 {id:"incline",name:"Incline Push-up",category:"Upper Body",focus:"Chest, triceps, shoulders",description:"A beginner-friendly pressing variation using a stable elevated surface.",difficulty:"Beginner",tempo:"2–1–2",keyPoints:["Surface must be stable","Keep body in one line","Control the descent"],mistakes:["Unstable support","Hips sagging","Partial rushed reps"]},
 {id:"stepup",name:"Supported Step-up",category:"Lower Body",focus:"Glutes, quads, balance",description:"A controlled step-up using a stable low platform and optional support.",difficulty:"Beginner",tempo:"2–1–2",keyPoints:["Platform must be stable","Drive through the stepping leg","Use support for balance if needed"],mistakes:["Jumping onto platform","Knee collapsing inward","Rushing down"]},

 // ---- Expanded library: new movements below, each reusing a close CSS
 // motion pattern via `pattern` so no exercise ever ships without an
 // animated demo, while keeping the stylesheet small. ----
 {id:"situps",name:"Sit-ups",category:"Core",focus:"Abdominals, hip flexors",pattern:"curlcore",description:"A classic full-range trunk flexion movement from lying to seated.",difficulty:"Beginner",tempo:"2–1–2",keyPoints:["Anchor or brace your feet if needed","Lead with your chest, not your neck","Exhale as you curl up"],mistakes:["Yanking the neck forward","Using momentum to swing up","Feet popping up off the floor"]},
 {id:"crunches",name:"Standard Crunches",category:"Core",focus:"Upper abdominals",pattern:"curlcore",description:"A shorter-range trunk curl that isolates the upper abdominals.",difficulty:"Beginner",tempo:"2–1–2",keyPoints:["Small controlled range","Keep chin off the chest","Squeeze at the top"],mistakes:["Pulling on the head","Rushing reps","Holding the breath"]},
 {id:"legraises",name:"Lying Leg Raises",category:"Core",focus:"Lower abdominals",pattern:"deadbug",description:"A leg-lift pattern that targets the lower abdominal region.",difficulty:"Intermediate",tempo:"3–1–3",keyPoints:["Press your lower back down","Lift only as high as control allows","Lower slowly, don't drop"],mistakes:["Lower back arching off the floor","Using momentum","Locking the knees hard"]},
 {id:"russian-twist",name:"Russian Twists",category:"Core",focus:"Obliques, rotation",pattern:"bicycle",description:"A seated rotational movement that challenges the obliques.",difficulty:"Intermediate",tempo:"Controlled",keyPoints:["Lean back to a stable angle","Rotate from the ribcage","Keep the movement smooth"],mistakes:["Rounding the lower back","Moving too fast for control","Barely rotating the arms without the torso"]},
 {id:"superman",name:"Superman Hold",category:"Core",focus:"Lower back, glutes",pattern:"bridges",description:"A prone extension hold that strengthens the posterior chain.",difficulty:"Beginner",tempo:"Timed hold",keyPoints:["Lift a comfortable height","Lengthen through fingers and toes","Breathe steadily during the hold"],mistakes:["Overextending the neck","Bouncing instead of holding","Holding the breath"]},
 {id:"side-plank",name:"Side Plank",category:"Core",focus:"Obliques, hip stability",pattern:"plank",description:"A lateral isometric hold that targets the often-neglected obliques.",difficulty:"Intermediate",tempo:"Steady hold",keyPoints:["Stack shoulders and hips","Keep hips lifted and level","Brace the whole side body"],mistakes:["Hips sagging toward the floor","Shoulder creeping forward","Holding the breath"]},
 {id:"pike-pushup",name:"Pike Push-ups",category:"Upper Body",focus:"Shoulders, upper chest",pattern:"pushups",description:"An inverted-V pressing variation that emphasizes the shoulders.",difficulty:"Advanced",tempo:"2–1–2",keyPoints:["Hips high, forming an inverted V","Head aims toward the floor between hands","Keep the movement slow"],mistakes:["Hips dropping toward a normal push-up","Flaring elbows wide","Rushing the descent"]},
 {id:"diamond-pushup",name:"Diamond Push-ups",category:"Upper Body",focus:"Triceps, inner chest",pattern:"pushups",description:"A narrow hand-position press that shifts emphasis to the triceps.",difficulty:"Advanced",tempo:"2–1–2",keyPoints:["Hands close, thumbs and index fingers touching","Elbows track back, not out wide","Keep the trunk rigid"],mistakes:["Elbows flaring outward","Hips sagging","Partial range reps"]},
 {id:"shoulder-taps",name:"Shoulder Taps",category:"Upper Body",focus:"Shoulders, anti-rotation core",pattern:"plank",description:"A plank variation that adds an anti-rotation shoulder tap.",difficulty:"Intermediate",tempo:"Steady",keyPoints:["Widen your feet for stability","Keep hips as still as possible","Tap lightly, don't slam"],mistakes:["Hips rocking side to side","Feet too close together","Rushing the tempo"]},
 {id:"bicep-curl",name:"Dumbbell Bicep Curl",category:"Upper Body",focus:"Biceps",pattern:"curl",equipment:"Dumbbells",description:"A classic elbow-flexion isolation move for the biceps.",difficulty:"Beginner",tempo:"2–1–2",keyPoints:["Elbows pinned to your sides","Curl without swinging the torso","Lower with full control"],mistakes:["Swinging the weight up","Only doing the top half of the range","Flaring elbows forward"]},
 {id:"lateral-raise",name:"Lateral Raises",category:"Upper Body",focus:"Side shoulders",pattern:"raise",equipment:"Dumbbells",description:"An isolation raise that builds shoulder width and definition.",difficulty:"Beginner",tempo:"2–1–2",keyPoints:["Slight bend in the elbows","Lead with the elbows, not the hands","Stop around shoulder height"],mistakes:["Using momentum to swing up","Shrugging the traps","Raising too high"]},
 {id:"bent-row",name:"Bent-over Rows",category:"Upper Body",focus:"Back, biceps",pattern:"row",equipment:"Dumbbells",description:"A hip-hinged pulling movement that builds a stronger back.",difficulty:"Intermediate",tempo:"2–1–2",keyPoints:["Hinge at the hips, flat back","Pull elbows back and up","Squeeze the shoulder blades together"],mistakes:["Rounding the lower back","Standing too upright","Yanking with momentum"]},
 {id:"donkey-kick",name:"Donkey Kicks",category:"Lower Body",focus:"Glutes",pattern:"bird-dog",description:"A quadruped hip-extension isolation move for the glutes.",difficulty:"Beginner",tempo:"2–2–2",keyPoints:["Keep the knee bent at 90 degrees","Drive through the heel","Squeeze the glute at the top"],mistakes:["Arching the lower back","Kicking too high","Rushing the reps"]},
 {id:"sumo-squat",name:"Sumo Squats",category:"Lower Body",focus:"Inner thighs, glutes",pattern:"squats",description:"A wide-stance squat variation targeting the inner thighs.",difficulty:"Beginner",tempo:"3–1–2",keyPoints:["Toes turned out comfortably","Track knees over toes","Sit down, not just back"],mistakes:["Knees caving inward","Leaning too far forward","Partial range"]},
 {id:"jump-squat",name:"Jump Squats",category:"Cardio",focus:"Explosive power, quads",pattern:"squats",description:"An explosive squat variation for power and conditioning.",difficulty:"Advanced",tempo:"Explosive",keyPoints:["Land softly through the whole foot","Absorb the landing into the next squat","Scale to a regular squat if needed"],mistakes:["Landing stiff-legged","Knees caving on landing","Chasing height over control"]},
 {id:"skater-hop",name:"Skater Hops",category:"Cardio",focus:"Lateral power, glutes",pattern:"skater",description:"A lateral bounding movement that builds frontal-plane control.",difficulty:"Intermediate",tempo:"Rhythmic",keyPoints:["Land softly on the outside foot","Keep the chest up","Scale to a step-touch if needed"],mistakes:["Landing hard and loud","Losing balance on the landing","Leaning too far forward"]},
 {id:"single-leg-deadlift",name:"Single-Leg Deadlift",category:"Lower Body",focus:"Hamstrings, balance",pattern:"hinge",description:"A single-leg hip hinge that builds balance and posterior-chain strength.",difficulty:"Advanced",tempo:"3–1–3",keyPoints:["Hinge from the hip, not the waist","Keep the standing knee soft","Use a wall for balance if needed"],mistakes:["Rounding the back","Rotating the hips open","Rushing the tempo"]},
 {id:"world-greatest-stretch",name:"World's Greatest Stretch",category:"Flexibility",focus:"Hips, thoracic spine",pattern:"sway",description:"A multi-joint mobility flow that opens the hips and upper back.",difficulty:"Beginner",tempo:"Slow flow",keyPoints:["Sink deep into the lunge","Rotate from the upper back","Breathe deeply through the stretch"],mistakes:["Rushing between positions","Forcing the rotation","Holding the breath"]},
 {id:"cat-cow",name:"Cat-Cow Stretch",category:"Flexibility",focus:"Spinal mobility",pattern:"hinge",description:"A gentle spinal wave that improves segmental mobility.",difficulty:"Beginner",tempo:"Slow flow",keyPoints:["Move one vertebra at a time","Sync breath with movement","Keep the motion smooth"],mistakes:["Moving too fast","Shrugging the shoulders","Holding the breath"]},
 {id:"cobra-stretch",name:"Cobra Stretch",category:"Flexibility",focus:"Abdominals, spine",pattern:"bridges",description:"A gentle backbend that opens the front of the body.",difficulty:"Beginner",tempo:"Timed hold",keyPoints:["Push up only as far as comfortable","Keep hips on the floor","Relax the shoulders down"],mistakes:["Overextending the neck","Shrugging the shoulders up","Pushing into sharp pain"]},
 {id:"seated-fold",name:"Seated Forward Fold",category:"Flexibility",focus:"Hamstrings, lower back",pattern:"sway",description:"A seated hinge that lengthens the entire posterior chain.",difficulty:"Beginner",tempo:"Timed hold",keyPoints:["Hinge from the hips, not the back","Keep the spine long","Only fold as far as comfortable"],mistakes:["Rounding aggressively to reach the toes","Bouncing into the stretch","Locking the knees hard"]},
 {id:"spinal-twist",name:"Supine Spinal Twist",category:"Flexibility",focus:"Spine, obliques",pattern:"bicycle",description:"A relaxed lying twist that releases tension through the spine.",difficulty:"Beginner",tempo:"Timed hold",keyPoints:["Keep both shoulders on the floor","Let gravity do the work","Breathe slowly into the stretch"],mistakes:["Forcing the knees down","Lifting the opposite shoulder","Holding the breath"]},
 {id:"childs-pose",name:"Child's Pose",category:"Flexibility",focus:"Back, hips, shoulders",pattern:"sway",description:"A restorative resting stretch for the back and hips.",difficulty:"Beginner",tempo:"Timed hold",keyPoints:["Sit hips back toward the heels","Let the arms relax forward","Breathe into the lower back"],mistakes:["Forcing hips down when tight hips resist","Holding tension in the shoulders","Rushing out of the pose"]},
];

const CATEGORIES = ["All", "Favorites", "Upper Body", "Lower Body", "Core", "Cardio", "Flexibility"];

/**
 * The movement, enlarged, lit and looping — what you get when you open an
 * exercise rather than browse past it.
 *
 * The grid holds signature poses; this is the one place the figure
 * actually moves, so it is the one place worth spending on. Two neon
 * gradient washes rake the stage from opposite corners, keyed to the demo
 * figure's gender (cyan for male, magenta for female), with a slow
 * specular sweep across the glass. All of it is `pointer-events: none`
 * decoration layered under and over the figure — the figure itself is the
 * same renderer the 44px list thumbnails use.
 */
function MotionDemo({ exercise, gender, model }: { exercise: ExerciseDemo; gender: FigureGender; model: DemoTone }) {
  const female = gender === "female";
  const hot = female ? "#ff5fae" : "#38d6ff";
  const cool = female ? "#a45cff" : "#00e5a0";

  return (
    <div
      className="relative h-72 overflow-hidden rounded-[24px] sm:h-80"
      style={{
        background: "radial-gradient(130% 100% at 50% 0%, #131826 0%, #080a11 70%)",
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${hot} 26%, transparent), 0 0 44px -14px ${hot}`,
      }}
    >
      {/* Backlight. Sits behind the figure and is what makes the whole
          panel read as lit rather than as a picture on a dark card. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(60% 55% at 28% 22%, ${hot}59 0%, transparent 62%), radial-gradient(58% 60% at 76% 82%, ${cool}4d 0%, transparent 64%)`,
        }}
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floor pool, so the figure is standing in the light rather than
          floating in front of it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-10 bottom-5 h-16 rounded-[50%]"
        style={{ background: `radial-gradient(closest-side, ${hot}3d, transparent)` }}
      />

      {/* Photographs where they exist, drawn figure otherwise — the rule
          lives in ExerciseThumb so the hero, the grid and the session
          panel can never disagree about which demo an exercise gets. */}
      <ExerciseThumb
        name={exercise.name}
        targetMuscle={exercise.focus}
        gender={gender}
        model={model}
        tone={female ? "crimson" : "cyan"}
        bare
      />

      {/* Specular sweep. Skewed and travelling well past both edges so it
          enters and leaves cleanly instead of blinking on mid-panel. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg]"
        style={{ background: "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.13), transparent)" }}
        animate={{ x: ["0%", "460%"] }}
        transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }}
      />

      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest backdrop-blur" style={{ color: hot }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: hot, boxShadow: `0 0 8px ${hot}` }} />
        Live form
      </div>
      <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-bold text-white/55 backdrop-blur">
        {female ? "FEMALE" : gender === "male" ? "MALE" : "NEUTRAL"}
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Tempo</p>
          <p className="text-sm font-black text-white">{exercise.tempo}</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-white/50">
          <Play className="h-3.5 w-3.5 fill-current" /> Looping
        </div>
      </div>
    </div>
  );
}

interface ExerciseLibraryProps {
  onNavigateToLog?: (exName: string) => void;
  favorites?: string[];
  onToggleFavorite?: (id: string) => void;
  profile?: UserProfile;
}

export default function ExerciseLibrary({ onNavigateToLog, favorites = [], onToggleFavorite, profile }: ExerciseLibraryProps) {
  // No exercise is "open" by default — the detail view is a modal the user
  // opts into per-card, so browsing the library never means scrolling past
  // a full-size demo panel to reach the next row of results.
  const [selected, setSelected] = useState<ExerciseDemo | null>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");

  // Demonstration figure gender: defaults to the person's own profile
  // selection (set during Personalize / editable in Settings) the first
  // time they open the Academy, then remembers whatever they pick here —
  // every exercise has both a male and a female illustrated demo.
  const [figureGender, setFigureGender] = useState<FigureGender>(() => {
    const saved = localStorage.getItem("kinetic_demo_gender");
    if (saved === "male" || saved === "female" || saved === "neutral") return saved;
    if (profile?.gender === "male" || profile?.gender === "female") return profile.gender;
    return "female";
  });
  // Which photographic model the demos use. Remembered, never asked for:
  // the old onboarding question made a new user state their race before
  // they had seen the app, to pick between two photo sets.
  const [demoModel, setDemoModel] = useState<DemoTone>(readDemoModel);
  const setModelPersisted = (m: DemoTone) => {
    setDemoModel(m);
    writeDemoModel(m);
  };

  const setGenderPersisted = (g: FigureGender) => {
    setFigureGender(g);
    localStorage.setItem("kinetic_demo_gender", g);
  };

  // Voice-over: reads the exercise name, description and coach cues aloud
  // using the browser's built-in speech synthesis, in a voice matched to
  // the Demo figure gender toggle above (male voice for the male figure,
  // female for the female one). No TTS engine can vary voice by race, so
  // the black/white model toggle stays purely visual — only gender ever
  // changes the narrator.
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  useEffect(() => { audio.stopSpeaking(); setSpeakingId(null); }, [selected?.id]);
  useEffect(() => () => audio.stopSpeaking(), []);
  const toggleVoiceOver = (ex: ExerciseDemo) => {
    if (speakingId === ex.id) {
      audio.stopSpeaking();
      setSpeakingId(null);
      return;
    }
    const narration = `${ex.name}. ${ex.description} Coach cues: ${ex.keyPoints.join(". ")}.`;
    audio.speak(narration, {
      gender: figureGender,
      onStart: () => setSpeakingId(ex.id),
      onEnd: () => setSpeakingId(null),
    });
  };

  const filtered = useMemo(() => DEMO_EXERCISES.filter(e => {
    const q = query.toLowerCase();
    const matchesQuery = (e.name + " " + e.focus + " " + e.category).toLowerCase().includes(q);
    if (cat === "Favorites") return matchesQuery && favorites.includes(e.id);
    return matchesQuery && (cat === "All" || e.category === cat);
  }), [query, cat, favorites]);

  const toggleFavorite = (id: string) => onToggleFavorite?.(id);

  return (
    <div className="animate-fade-in pb-10" id="exercise-library-view">
      <div className="mb-6">
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Exercise academy</span>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div><h1 className="font-display text-2xl font-black tracking-tight">Movement library</h1><p className="mt-2 text-sm leading-5 text-slate-500">Every movement is demonstrated by a posed figure built from real joint angles — in your choice of male or female — plus form cues and common mistakes.</p></div>
          <div className="hidden rounded-2xl bg-slate-900 px-3 py-2 text-right text-white sm:block"><p className="text-lg font-black">{DEMO_EXERCISES.length}</p><p className="text-[9px] uppercase tracking-widest text-white/50">movements</p></div>
        </div>

        {/* Real-photo hero strip — a shiny neon-glow card matching the same
            "3D card, neon glow" language as the exercise demo cards below,
            so the Academy reads as one photographic destination rather than
            a page of illustrations with a couple of photo exceptions. */}
        <div className="relative mt-4 overflow-hidden rounded-[22px] p-[2px]">
          <div className="absolute inset-0 bg-gradient-to-r from-lime-300 via-cyan-400 to-indigo-400 opacity-70" />
          <div className="relative flex h-24 items-center overflow-hidden rounded-[20px] bg-slate-950 sm:h-28">
            <img src={heroDeadlift} alt="" className="absolute inset-0 h-full w-full object-cover object-[75%_15%] opacity-80" draggable={false} />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/55 to-transparent" />
            <div className="relative z-10 max-w-[65%] pl-5 pr-3 sm:max-w-[55%] sm:pl-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-lime-300">Train with real form</p>
              <p className="mt-1 text-sm font-black leading-tight text-white sm:text-base">Real form, demonstrated. Zero guesswork.</p>
            </div>
          </div>
        </div>

        {/* Demo preferences. Both drive every demo in the app. */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xs">
          <span className="pl-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Demo</span>
          <div className="ml-auto flex gap-1">
            <button id="btn-demo-gender-male" aria-label="Show male demo figure" onClick={() => setGenderPersisted("male")} className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${figureGender === "male" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              <Mars className="h-3.5 w-3.5"/> Male
            </button>
            <button id="btn-demo-gender-female" aria-label="Show female demo figure" onClick={() => setGenderPersisted("female")} className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${figureGender === "female" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              <Venus className="h-3.5 w-3.5"/> Female
            </button>
          </div>
        </div>

        {/* Model tone. Only reaches the photographic demos — the drawn
            figure has no photographic counterpart, so this is hidden while
            a gender with no photography is selected rather than sitting
            there doing nothing. */}
        {figureGender !== "female" && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xs">
            <span className="pl-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Model</span>
            <div className="ml-auto flex gap-1">
              {(["white", "black"] as const).map(m => (
                <button
                  key={m}
                  id={`btn-demo-model-${m}`}
                  aria-pressed={demoModel === m}
                  aria-label={`Show the ${m} demo model`}
                  onClick={() => setModelPersisted(m)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black capitalize transition-all ${demoModel === m ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search exercises, muscles or category" className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"/>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)} className={`shrink-0 flex items-center gap-1 rounded-full px-4 py-2 text-xs font-black ${cat === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
            {c === "Favorites" && <Star className="h-3 w-3"/>}
            {c}{c === "Favorites" && favorites.length > 0 ? ` (${favorites.length})` : ""}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
        {filtered.map(ex => (
          /* A <div>, not a <button>. The favourite toggle lives inside this
             card, and a <button> nested in a <button> is invalid HTML:
             React logs it, and browsers resolve the ambiguity however they
             like — which is why the star sometimes opened the exercise
             instead of favouriting it. The card's own hit target is a
             stretched sibling button below, and the star sits above it, so
             both are real buttons, both are keyboard reachable, and z-order
             decides the tap rather than the parser. */
          <div key={ex.id} className="relative overflow-hidden rounded-[20px] border border-slate-100 bg-white text-left shadow-sm transition hover:-translate-y-0.5 active:scale-[0.98]">
            <div className="relative aspect-[4/3] bg-[var(--obsidian)]">
              {/* Photographs where they exist, the pose engine everywhere
                  else — the rule lives in ExerciseThumb so the grid, the
                  workout lists and the in-session panel can never drift
                  apart on which demo an exercise gets. */}
              <ExerciseThumb
                name={ex.name}
                targetMuscle={ex.focus}
                gender={figureGender}
                model={demoModel}
                tone="emerald"
                bare
                still
              />
              <span className="absolute left-2 top-2 rounded-full bg-black/35 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-lime-300">Play</span>
            </div>
            <div className="p-2.5 sm:p-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">{ex.category}</span>
              <h3 className="mt-0.5 truncate text-sm font-black leading-tight">{ex.name}</h3>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{ex.focus}</p>
            </div>

            <button
              type="button"
              onClick={() => setSelected(ex)}
              aria-label={`Open ${ex.name}`}
              className="absolute inset-0 z-10 rounded-[20px]"
            />
            <button
              type="button"
              onClick={() => toggleFavorite(ex.id)}
              aria-pressed={favorites.includes(ex.id)}
              aria-label={favorites.includes(ex.id) ? `Remove ${ex.name} from favorites` : `Add ${ex.name} to favorites`}
              className="absolute right-1.5 top-1.5 z-20 rounded-full bg-black/35 p-1 hover:bg-black/50"
            >
              <Star className={`h-3 w-3 ${favorites.includes(ex.id) ? "fill-current text-amber-400" : "text-white/70"}`}/>
            </button>
          </div>
        ))}
      </div>

      {filtered.length === 0 && <div className="mt-5 rounded-3xl bg-white p-8 text-center border border-slate-100"><p className="font-black">No exercise found</p><p className="mt-1 text-xs text-slate-500">Try another movement or category.</p></div>}

      {/* Detail view opens as a full-screen modal on demand — browsing the
          grid never means scrolling past a large demo panel first.

          PORTALLED TO <body>, and that is a fix rather than a preference.
          Each screen is wrapped in an animating element that sets
          `opacity`, and any opacity below 1 creates a stacking context —
          so this sheet's `z-[90]` was only ever 90 *within that screen*,
          and the tab bar's `z-50` at the document root still painted over
          it. The result was the last ~80px of every exercise sheet
          sitting underneath the tab bar. A portal lifts the sheet out to
          the root, where its z-index means what it says. */}
      {selected && createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 backdrop-blur-xs sm:items-center sm:p-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-slate-950 p-4 text-white shadow-2xl animate-fade-in sm:rounded-[28px] sm:p-5"
            // The sheet now covers the tab bar rather than hiding behind
            // it, so it owes the viewport its own bottom inset.
            style={{ paddingBottom: "calc(var(--safe-b, 0px) + 24px)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button onClick={() => setSelected(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20" aria-label="Close">
                <X className="h-4 w-4"/>
              </button>
            </div>
            <MotionDemo exercise={selected} gender={figureGender} model={demoModel} />
            <div className="mt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-lime-300">{selected.category} • {selected.difficulty}</span>
                  <h2 className="mt-1 text-2xl font-black">{selected.name}</h2>
                  <p className="mt-1 text-xs text-white/50">{selected.focus}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleVoiceOver(selected)}
                    aria-label={speakingId === selected.id ? "Stop voice-over" : "Play voice-over"}
                    className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black transition-all ${speakingId === selected.id ? "bg-lime-300 text-slate-950" : "bg-white/10 text-white hover:bg-white/20"}`}
                  >
                    {speakingId === selected.id ? (
                      <><Square className="h-3.5 w-3.5 fill-current"/> Stop</>
                    ) : (
                      <><Volume2 className="h-3.5 w-3.5"/> Narrate</>
                    )}
                  </button>
                  <button onClick={() => toggleFavorite(selected.id)} className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black ${favorites.includes(selected.id) ? "bg-amber-400 text-slate-950" : "bg-white/10 text-white"}`}>
                    <Star className={`h-3.5 w-3.5 ${favorites.includes(selected.id) ? "fill-current" : ""}`}/> {favorites.includes(selected.id) ? "Favorited" : "Favorite"}
                  </button>
                  <button onClick={() => onNavigateToLog?.(selected.name)} className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950">Log movement <ChevronRight className="h-3.5 w-3.5"/></button>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/65">{selected.description}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/5 p-4"><div className="flex items-center gap-2 text-lime-300"><CheckCircle2 className="h-4 w-4"/><span className="text-[10px] font-black uppercase tracking-widest">Coach cues</span></div>{selected.keyPoints.map(x => <p key={x} className="mt-2 text-xs text-white/65">• {x}</p>)}</div>
                <div className="rounded-2xl bg-white/5 p-4"><div className="flex items-center gap-2 text-amber-300"><AlertTriangle className="h-4 w-4"/><span className="text-[10px] font-black uppercase tracking-widest">Common mistakes</span></div>{selected.mistakes.map(x => <p key={x} className="mt-2 text-xs text-white/65">• {x}</p>)}</div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/5 p-3"><Timer className="h-4 w-4 text-white/40"/><p className="mt-1 text-[10px] uppercase text-white/35">Tempo</p><p className="text-xs font-black">{selected.tempo}</p></div>
                <div className="rounded-2xl bg-white/5 p-3"><Dumbbell className="h-4 w-4 text-white/40"/><p className="mt-1 text-[10px] uppercase text-white/35">Equipment</p><p className="text-xs font-black">{selected.equipment || "Bodyweight"}</p></div>
                <div className="rounded-2xl bg-white/5 p-3"><HeartPulse className="h-4 w-4 text-white/40"/><p className="mt-1 text-[10px] uppercase text-white/35">Focus</p><p className="text-xs font-black">Control</p></div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
