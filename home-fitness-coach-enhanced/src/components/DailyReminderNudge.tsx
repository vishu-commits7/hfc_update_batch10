import { useState } from "react";
import { Bell, X, CheckCircle2 } from "lucide-react";
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  requestNotificationPermission,
  applyDailyReminder,
} from "../lib/notifications";
import { successFeedback, tapFeedback, warnFeedback } from "../lib/haptics";
import { computeAnalytics, trainedToday } from "../lib/analytics";
import { planNudge, shouldNudgeToday } from "../lib/smartNudge";
import type { WorkoutLog } from "../types";

const DISMISS_KEY = "kinetic_reminder_nudge_dismissed";

function formatTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

/** A small, dismissable Dashboard card nudging the user to turn on the
 *  daily workout reminder (Settings → Reminders already has the full
 *  toggle + time picker — this just surfaces it right where people are,
 *  so they don't have to go dig for it). Once enabled, or once dismissed,
 *  it stays hidden for good. */
export default function DailyReminderNudge({ logs }: { logs: WorkoutLog[] }) {
  const [prefs, setPrefs] = useState(() => loadNotificationPrefs());
  const [denied, setDenied] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"
  );
  const [justEnabled, setJustEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  if (prefs.dailyReminderEnabled || dismissed) return null;

  const handleDismiss = () => {
    tapFeedback();
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  // The hour this person actually trains, not a fixed evening slot.
  const nudge = (() => {
    const trained = trainedToday(logs);
    const n = planNudge(computeAnalytics(logs));
    return shouldNudgeToday(n, trained) ? n : undefined;
  })();

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // The old version threw this result away and reported success
      // regardless, so a user who tapped "Deny" was told their reminder
      // was set and then never received one. Permission is the whole
      // feature — if it is refused there is nothing to celebrate.
      const granted = await requestNotificationPermission();
      if (!granted) {
        setDenied(true);
        warnFeedback();
        return;
      }
      const next = { ...prefs, dailyReminderEnabled: true };
      saveNotificationPrefs(next);
      await applyDailyReminder(next, nudge);
      setPrefs(next);
      successFeedback();
      setJustEnabled(true);
      window.setTimeout(() => {
        try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
      }, 1800);
    } finally {
      setBusy(false);
    }
  };

  if (justEnabled) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-lime-200 bg-lime-50 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-lime-600" />
        <p className="text-xs font-bold text-lime-800">
          Daily reminder set for {formatTime(nudge ? nudge.hour : prefs.dailyReminderHour, nudge ? nudge.minute : prefs.dailyReminderMinute)}. Change it anytime in Settings → Reminders.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 pr-9" id="daily-reminder-nudge">
      <button
        onClick={handleDismiss}
        className="absolute right-2.5 top-2.5 rounded-full p-1 text-blue-300 transition-colors hover:bg-blue-100 hover:text-blue-500"
        title="Dismiss"
        id="btn-dismiss-reminder-nudge"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
        <Bell className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-slate-900">Never miss a workout</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
          {denied
            ? "Notifications are blocked for this app. Turn them on in your phone's settings, then come back."
            : nudge
              ? `A nudge at ${formatTime(nudge.hour, nudge.minute)} — right before the time you usually train.`
              : "Turn on a daily reminder so a session never quietly slips past."}
        </p>
        <button
          onClick={handleEnable}
          disabled={busy}
          className="mt-2.5 inline-flex items-center rounded-xl bg-blue-600 px-3.5 py-1.5 text-[11px] font-black text-white transition-all hover:bg-blue-700 disabled:opacity-60"
          id="btn-enable-daily-reminder"
        >
          {busy ? "Turning on…" : "Turn on reminder"}
        </button>
      </div>
    </div>
  );
}
