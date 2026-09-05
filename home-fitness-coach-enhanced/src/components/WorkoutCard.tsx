import React from "react";
import { Workout } from "../types";
import { Dumbbell, Timer, Sparkles, ChevronRight, Trash2 } from "lucide-react";
import coverMorning from "../assets/coaches/coach-smile-hip.jpg";
import coverCore from "../assets/coaches/cat-core.jpg";
import coverLower from "../assets/coaches/coach-squat.jpg";
import coverUpper from "../assets/coaches/coach-flex-towel.jpg";
import coverCardio from "../assets/coaches/cat-hiit.jpg";
import coverFlex from "../assets/coaches/cat-mobility.jpg";

interface WorkoutCardProps {
  key?: string;
  workout: Workout;
  onSelect: (workout: Workout) => void;
  onDelete?: (id: string) => void;
}

/* Each Pro Routine is fronted by its own coach photo and first name — the
   real face behind "Ready-to-go workouts by certified coaches" instead of
   a bare text card. AI-generated workouts have no entry here and simply
   render without a banner, as before. */
export const CURATED_COACH_MEDIA: Record<string, { photo: string; coach: string }> = {
  curated_1: { photo: coverMorning, coach: "Coach Sam" },
  curated_2: { photo: coverCore, coach: "Coach Priya" },
  curated_3: { photo: coverLower, coach: "Coach Ryan" },
  curated_4: { photo: coverUpper, coach: "Coach Theo" },
  curated_5: { photo: coverCardio, coach: "Coach Devon" },
  curated_6: { photo: coverFlex, coach: "Coach Mia" },
};

export default function WorkoutCard({ workout, onSelect, onDelete }: WorkoutCardProps) {
  const isCurated = workout.id.startsWith("curated_");
  const media = isCurated ? CURATED_COACH_MEDIA[workout.id] : undefined;

  return (
    <div
      className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:scale-[1.02] hover:border-blue-100 hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)]"
      id={`workout-card-${workout.id}`}
    >
      {media && (
        <div className="relative h-32 w-full shrink-0 overflow-hidden">
          <img
            src={media.photo}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />
          <span className="absolute left-4 top-3 inline-flex items-center gap-1 rounded-full bg-amber-50/95 border border-amber-100 px-2.5 py-1 text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">
            PRO Routine
          </span>
          <span className="absolute bottom-2.5 left-4 text-xs font-black uppercase tracking-wider text-white drop-shadow">
            {media.coach}
          </span>
        </div>
      )}

      <div className="p-6">
        <div>
          {/* Header tags */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              <Timer className="h-3.5 w-3.5 text-blue-600" />
              {workout.totalDurationMinutes} min
            </span>

            <div className="flex items-center gap-1.5">
              {!media && (workout.isAiGenerated || !isCurated ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">
                  <Sparkles className="h-3 w-3 fill-blue-600/10" />
                  AI Custom
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-100 px-2.5 py-1 text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">
                  PRO Routine
                </span>
              ))}

              {onDelete && !isCurated && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(workout.id);
                  }}
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all"
                  title="Delete Routine"
                  id={`btn-delete-${workout.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Workout Details */}
          <h3 className="mt-4 font-sans text-lg font-black tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors uppercase">
            {workout.workoutTitle}
          </h3>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">
            {workout.workoutDescription}
          </p>

          {/* Exercises preview badge */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-slate-50 border border-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {workout.exercises.length} movements
            </span>
            <span className="rounded-md bg-slate-50 border border-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              🎯 {workout.targetArea}
            </span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          {/* Equipment info */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Dumbbell className="h-3.5 w-3.5 text-slate-400" />
            <span className="truncate max-w-[120px]">
              {workout.equipmentNeeded.join(", ") || "Bodyweight"}
            </span>
          </div>

          {/* Start Workout Action */}
          <button
            onClick={() => onSelect(workout)}
            className="inline-flex items-center gap-1 text-sm font-extrabold text-blue-600 uppercase tracking-wider group-hover:translate-x-1 transition-transform"
            id={`btn-start-card-${workout.id}`}
          >
            Start
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
