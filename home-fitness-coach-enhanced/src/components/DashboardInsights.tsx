import { useEffect, useRef, useState } from "react";
import { WorkoutLog } from "../types";
import { computeWeeklyRecap, trendDelta } from "../lib/weeklyRecap";
import {
  getConsecutiveTrainingDays, shouldSuggestRestDay, isRestDayDismissedToday,
  dismissRestDayForToday, RECOVERY_SUGGESTIONS,
} from "../lib/recovery";
import { Moon, TrendingUp, TrendingDown, Minus, Share2, Download, X, CalendarRange } from "lucide-react";

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const t = trendDelta(current, previous);
  if (t.direction === "flat") {
    return <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400"><Minus className="h-3 w-3" /> same</span>;
  }
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${t.direction === "up" ? "text-emerald-600" : "text-amber-600"}`}>
      {t.direction === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {t.pct}%
    </span>
  );
}

/** Two small, dismissible/optional cards on the Dashboard: a rest-day
 *  nudge when someone has trained many days in a row, and a rolling
 *  7-day recap of their activity with a shareable summary image. Both
 *  quietly disappear when there's nothing meaningful to show yet. */
export default function DashboardInsights({ logs, onGoToRecovery }: { logs: WorkoutLog[]; onGoToRecovery: () => void }) {
  const [restDismissed, setRestDismissed] = useState(isRestDayDismissedToday());
  const [shareOpen, setShareOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const consecutiveDays = getConsecutiveTrainingDays(logs);
  const showRestBanner = shouldSuggestRestDay(logs) && !restDismissed;
  const recap = computeWeeklyRecap(logs);
  const hasAnyHistory = recap.workouts > 0 || recap.prevWorkouts > 0;

  const drawShareCard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const W = 1080, H = 1080;
    canvas.width = W; canvas.height = H;

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e3a8a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#00E5A0";
    ctx.font = "bold 38px sans-serif";
    ctx.fillText("HOME FITNESS COACH", 70, 120);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "28px sans-serif";
    ctx.fillText("Weekly Recap · Last 7 days", 70, 165);

    const stats: [string, string][] = [
      ["🏋️ Workouts", `${recap.workouts}`],
      ["⏱️ Minutes trained", `${recap.minutes}`],
      ["⚡ Calories burned", `${recap.calories} kcal`],
    ];
    let y = 320;
    stats.forEach(([label, value]) => {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.roundRect(70, y - 55, W - 140, 110, 24);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "26px sans-serif";
      ctx.fillText(label, 110, y - 12);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px sans-serif";
      ctx.fillText(value, 110, y + 34);
      y += 150;
    });

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "22px sans-serif";
    ctx.fillText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }), 70, H - 70);
  };

  useEffect(() => {
    if (shareOpen) drawShareCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareOpen]);

  const downloadImage = () => {
    canvasRef.current?.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "weekly-recap.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const shareImage = async () => {
    canvasRef.current?.toBlob(async blob => {
      if (!blob) return;
      const file = new File([blob], "weekly-recap.png", { type: "image/png" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "My Weekly Recap" });
          return;
        }
      } catch {}
      downloadImage();
    }, "image/png");
  };

  if (!showRestBanner && !hasAnyHistory) return null;

  return (
    <div className="space-y-4">
      {showRestBanner && (
        <div className="rounded-[24px] border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-600"><Moon className="h-4.5 w-4.5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-amber-900">{consecutiveDays} days straight — consider a rest day</p>
              <p className="mt-1 text-xs text-amber-700/80">Recovery is part of training too. A light stretch session today keeps you fresh for tomorrow.</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {RECOVERY_SUGGESTIONS.slice(0, 3).map(s => (
                  <span key={s.name} className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold text-amber-700">{s.name}</span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={onGoToRecovery} className="rounded-xl bg-amber-500 px-3.5 py-2 text-[11px] font-black text-white">See stretches</button>
                <button
                  onClick={() => { dismissRestDayForToday(); setRestDismissed(true); }}
                  className="rounded-xl bg-white/70 px-3.5 py-2 text-[11px] font-black text-amber-700"
                >
                  Not today, thanks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasAnyHistory && (
        <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Weekly Recap</h3>
            </div>
            <button onClick={() => setShareOpen(true)} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">Last 7 days vs. the 7 before that</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-lg font-black text-slate-900">{recap.workouts}</p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Workouts</p>
              <TrendBadge current={recap.workouts} previous={recap.prevWorkouts} />
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-lg font-black text-slate-900">{recap.minutes}</p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Minutes</p>
              <TrendBadge current={recap.minutes} previous={recap.prevMinutes} />
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-lg font-black text-slate-900">{recap.calories}</p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Calories</p>
              <TrendBadge current={recap.calories} previous={recap.prevCalories} />
            </div>
          </div>
        </div>
      )}

      {shareOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-6" onClick={() => setShareOpen(false)}>
          <div className="w-full sm:max-w-sm max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-white p-6 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Weekly Recap</h2>
              <button onClick={() => setShareOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <canvas ref={canvasRef} className="w-full rounded-2xl border border-slate-100" style={{ aspectRatio: "1 / 1" }} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={downloadImage} className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-xs font-black text-slate-700 hover:bg-slate-200">
                <Download className="h-4 w-4" /> Download
              </button>
              <button onClick={shareImage} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-black text-white hover:bg-blue-700">
                <Share2 className="h-4 w-4" /> Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
