/**
 * Local (on-device) notifications — a daily workout reminder, a streak
 * warning, and a water reminder. Everything is scheduled on-device: no
 * server, no push service, matching the rest of this app's offline-first
 * design.
 *
 * `@capacitor/local-notifications` is a real dependency now, so this is a
 * plain static import again. It used to be resolved lazily through a
 * string-built `import()` because the plugin was missing from
 * package.json — a static import would have failed the build, and the only
 * reason it did not was that nothing reachable from App.tsx imported this
 * file. That shim can go.
 *
 * On a plain web build there is still no native engine behind the plugin,
 * so every call below stays wrapped and fails quietly rather than breaking
 * the page.
 */
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Nudge } from "./smartNudge";

// Fixed, stable notification ids so re-scheduling one kind always replaces
// the previous one instead of stacking up duplicates.
const ID_DAILY_REMINDER = 1001;
const ID_STREAK_WARNING = 1002;
const ID_WATER_REMINDER = 1003;

/**
 * Schedule every reminder as an INEXACT alarm.
 *
 * The plugin defaults `isExactNotification` to true. On Android 12+ that
 * means the very first `schedule()` call throws the user straight out of
 * the app and onto the system "Alarms & reminders" settings screen to
 * grant SCHEDULE_EXACT_ALARM — which, since Android 14, is denied by
 * default for anything targeting API 33+. This app targets 36, so every
 * single user who flips a reminder on would get ejected into Settings.
 *
 * Nothing here needs to fire to the minute. A workout nudge that arrives
 * inside a short window is indistinguishable from one that arrives exactly
 * on the dot, and it costs the user far less battery. Opting out of exact
 * alarms removes the settings-screen interruption entirely, and lets the
 * app drop the SCHEDULE_EXACT_ALARM permission from its manifest (see
 * android/app/src/main/AndroidManifest.xml) so it never appears in the
 * Play listing.
 *
 * Anything that genuinely must land on a precise second — an interval
 * timer going off mid-set, say — would need this flipped back to true AND
 * the permission restored in the manifest.
 */
const INEXACT = { isExactNotification: false } as const;

export interface NotificationPrefs {
  dailyReminderEnabled: boolean;
  dailyReminderHour: number; // 0-23
  dailyReminderMinute: number; // 0-59
  streakWarningEnabled: boolean;
  waterReminderEnabled: boolean;
  waterReminderIntervalHours: number;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  dailyReminderEnabled: false,
  dailyReminderHour: 18,
  dailyReminderMinute: 0,
  streakWarningEnabled: false,
  waterReminderEnabled: false,
  waterReminderIntervalHours: 3,
};

export function loadNotificationPrefs(): NotificationPrefs {
  try {
    const saved = localStorage.getItem("kinetic_notification_prefs");
    if (saved) return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_NOTIFICATION_PREFS };
}

export function saveNotificationPrefs(prefs: NotificationPrefs) {
  localStorage.setItem("kinetic_notification_prefs", JSON.stringify(prefs));
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  } catch {
    // No native engine (plain web build) — treat as unavailable, not an error.
    return false;
  }
}

export async function hasNotificationPermission(): Promise<boolean> {
  try {
    const result = await LocalNotifications.checkPermissions();
    return result.display === "granted";
  } catch {
    return false;
  }
}

async function cancelIds(ids: number[]) {
  try {
    await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
  } catch {}
}

/**
 * Schedules (or cancels) the repeating daily reminder.
 *
 * With a `nudge` from `planNudge`, the reminder lands shortly before the
 * hour this person actually trains, and its copy is chosen by what is at
 * stake — a streak about to break reads differently from a quiet Tuesday.
 * Without one it uses the hour they set by hand, which is what everybody
 * got before: a fixed 18:00, suited to them or not.
 */
export async function applyDailyReminder(
  prefs: NotificationPrefs,
  nudge?: Nudge,
) {
  await cancelIds([ID_DAILY_REMINDER]);
  if (!prefs.dailyReminderEnabled) return;

  const hour = nudge ? nudge.hour : prefs.dailyReminderHour;
  const minute = nudge ? nudge.minute : prefs.dailyReminderMinute;

  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: ID_DAILY_REMINDER,
        ...INEXACT,
        title: nudge ? nudge.title : "Time to train 💪",
        body: nudge
          ? nudge.body
          : "Your body is ready — let's get today's workout in.",
        schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
      }],
    });
  } catch {
    // Not running as a native app — nothing to schedule.
  }
}

/** Fires once, a fixed number of hours before local midnight, warning that
 *  today's streak will break if no workout is logged before then. Re-arm
 *  this once a day (e.g. from a small check on app open) rather than
 *  scheduling it far in the future, since it depends on "still no workout
 *  logged today" which can only be known close to the time. */
export async function applyStreakWarning(prefs: NotificationPrefs, alreadyWorkedOutToday: boolean) {
  await cancelIds([ID_STREAK_WARNING]);
  if (!prefs.streakWarningEnabled || alreadyWorkedOutToday) return;
  try {
    const now = new Date();
    const fireAt = new Date(now);
    fireAt.setHours(21, 0, 0, 0); // 9 PM local time
    if (fireAt.getTime() <= now.getTime()) return; // already past 9 PM — skip for today
    await LocalNotifications.schedule({
      notifications: [{
        id: ID_STREAK_WARNING,
        ...INEXACT,
        title: "Don't lose your streak 🔥",
        body: "You haven't logged a workout today — a quick session keeps your streak alive.",
        schedule: { at: fireAt, allowWhileIdle: true },
      }],
    });
  } catch {}
}

/** Schedules a repeating "drink water" nudge every N hours during the day. */
export async function applyWaterReminder(prefs: NotificationPrefs) {
  await cancelIds([ID_WATER_REMINDER]);
  if (!prefs.waterReminderEnabled) return;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: ID_WATER_REMINDER,
        ...INEXACT,
        title: "Hydration check 💧",
        body: "A quick glass of water goes a long way — log it in the Water Tracker.",
        schedule: {
          every: "hour",
          count: 24,
          allowWhileIdle: true,
        },
      }],
    });
  } catch {}
}

/** Applies every enabled reminder from the current preferences in one call. */
export async function applyAllNotificationPrefs(
  prefs: NotificationPrefs,
  alreadyWorkedOutToday: boolean,
  nudge?: Nudge,
) {
  await applyDailyReminder(prefs, nudge);
  await applyStreakWarning(prefs, alreadyWorkedOutToday);
  await applyWaterReminder(prefs);
}

export async function cancelAllNotifications() {
  await cancelIds([ID_DAILY_REMINDER, ID_STREAK_WARNING, ID_WATER_REMINDER]);
}
