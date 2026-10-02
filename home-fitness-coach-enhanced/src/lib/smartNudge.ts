import type { Analytics } from "./analytics";

/**
 * When to nudge somebody, and what to say.
 *
 * `computeAnalytics` already works out the hour a person actually trains,
 * their streak, their momentum and how close they are to the weekly goal.
 * None of it was ever used: the reminder fired at a hard-coded 18:00 for
 * everyone. This turns that data into the schedule.
 *
 * ── The delivery layer is not wired yet ───────────────────────────────
 *
 * `@capacitor/local-notifications` is not installed, and the only files
 * importing `notifications.ts` are screens nothing routes to. This module
 * is deliberately pure — no plugin import, no side effects — so it is
 * correct and testable now, and `applyDailyReminder` can call it the day
 * the plugin lands.
 */

export interface Nudge {
  /** Local hour, 0–23. */
  hour: number;
  minute: number;
  title: string;
  body: string;
  /** Why this nudge was chosen. Useful in a debug screen and in tests. */
  reason: "streak" | "slipping" | "goal-close" | "usual-time" | "no-data";
}

/**
 * Nudges land BEFORE the session, not at it.
 *
 * A reminder that arrives at the exact hour somebody trains is competing
 * with the thing it is reminding them about. Twenty-five minutes earlier
 * catches them while they can still decide.
 */
const LEAD_MINUTES = 25;

/**
 * Below this many sessions, `peakHour` is one person's Tuesday rather than
 * a pattern, and scheduling against it produces a reminder at 2am for
 * somebody who once trained late.
 */
const MIN_SESSIONS_FOR_PERSONALISATION = 3;

/** Where the reminder goes until there is enough history to do better. */
const DEFAULT_HOUR = 18;

export function planNudge(a: Analytics): Nudge {
  if (a.totalSessions < MIN_SESSIONS_FOR_PERSONALISATION || a.peakHour === null) {
    return {
      hour: DEFAULT_HOUR,
      minute: 0,
      title: "Time to train",
      body: "Even ten minutes counts. Pick something short.",
      reason: "no-data",
    };
  }

  // Wrap through midnight rather than going negative: somebody whose peak
  // hour is 00:xx would otherwise get hour -1.
  const total = (a.peakHour * 60 - LEAD_MINUTES + 24 * 60) % (24 * 60);
  const hour = Math.floor(total / 60);
  const minute = total % 60;

  // Ordered by what is actually at stake. A streak about to break is a
  // stronger motivator than a weekly goal, and both beat a generic ping.
  if (a.currentStreak >= 3) {
    return {
      hour,
      minute,
      title: `${a.currentStreak}-day streak`,
      body: "Keep it alive — a short session is enough.",
      reason: "streak",
    };
  }

  if (a.momentum < -20) {
    return {
      hour,
      minute,
      title: "Let's get back to it",
      body: "Last week was quieter. Start small today.",
      reason: "slipping",
    };
  }

  const remaining = Math.max(0, 3 - a.thisWeek.sessions);
  if (a.weeklyGoalProgress >= 0.6 && remaining > 0) {
    return {
      hour,
      minute,
      title: remaining === 1 ? "One more this week" : `${remaining} more this week`,
      body: "You're close to your weekly goal.",
      reason: "goal-close",
    };
  }

  return {
    hour,
    minute,
    title: "Your usual time",
    body: "This is when you train best.",
    reason: "usual-time",
  };
}

/**
 * Whether a nudge should be sent at all today.
 *
 * Two rules, and both matter more than the copy: never nudge somebody who
 * has already trained today, and never nudge at an hour they would be
 * asleep. A reminder that arrives after the workout, or at 4am, is how an
 * app gets its notifications switched off permanently.
 */
export function shouldNudgeToday(
  nudge: Nudge,
  alreadyTrainedToday: boolean,
): boolean {
  if (alreadyTrainedToday) return false;
  if (nudge.hour < 6 || nudge.hour >= 23) return false;
  return true;
}
