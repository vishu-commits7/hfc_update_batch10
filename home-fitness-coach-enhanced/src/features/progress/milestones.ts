/**
 * Milestone detection — what to celebrate, and only once.
 *
 * The app already computes streaks and unlocked achievements. What it
 * never did was notice the moment one of them CHANGED, so achievements
 * unlocked silently and a streak hitting 30 days looked exactly like it
 * hitting 29. An unlock with no moment attached is not a reward.
 *
 * This is the smallest thing that fixes it: remember what the user has
 * already been shown, and report anything new. Everything is stored
 * locally — a celebration that re-fires after a reinstall is a far smaller
 * problem than one that needs a backend.
 */

/** Streak lengths worth stopping for. Deliberately sparse: celebrating
 *  every single day trains people to ignore the celebration. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365] as const;

const SEEN_STREAK_KEY = "kinetic_seen_streak_milestone";
const SEEN_BADGES_KEY = "kinetic_seen_badge_count";

export interface Milestone {
  kind: "streak" | "badge";
  /** Streak length, or the new unlocked-badge count. */
  value: number;
  title: string;
  detail: string;
}

function readNumber(key: string): number {
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Blocked storage — the celebration may repeat, which is a better
    // failure than the screen throwing.
  }
}

/**
 * The highest milestone this streak has reached.
 *
 * Takes the highest rather than the exact match on purpose: somebody who
 * opens the app on day 9 having last opened it on day 6 should still get
 * their 7-day moment, not silently skip it.
 */
function highestStreakMilestone(streak: number): number {
  let hit = 0;
  for (const m of STREAK_MILESTONES) if (streak >= m) hit = m;
  return hit;
}

/**
 * Anything newly earned since the last time this was called.
 *
 * Returns at most one milestone. Two celebrations stacked on one screen
 * cancel each other out, and the streak is the one people care about.
 */
export function detectNewMilestone(opts: {
  currentStreak: number;
  unlockedBadges: number;
}): Milestone | null {
  const reachedStreak = highestStreakMilestone(opts.currentStreak);
  const seenStreak = readNumber(SEEN_STREAK_KEY);
  const seenBadges = readNumber(SEEN_BADGES_KEY);

  // A streak that breaks and rebuilds should celebrate again, so the
  // stored value follows the streak down as well as up.
  if (reachedStreak < seenStreak) writeNumber(SEEN_STREAK_KEY, reachedStreak);

  if (reachedStreak > seenStreak) {
    writeNumber(SEEN_STREAK_KEY, reachedStreak);
    // Badges are marked seen at the same time: the user is getting a
    // moment now, and a second one on the next render would be noise.
    writeNumber(SEEN_BADGES_KEY, opts.unlockedBadges);
    // The TITLE states the streak they actually have; `value` carries the
    // milestone that triggered this. Titling it by the milestone meant
    // somebody on day five — who had crossed three but not yet seven —
    // saw "3-day streak" sitting next to a card reading "5 days".
    return {
      kind: "streak",
      value: reachedStreak,
      title: `${opts.currentStreak}-day streak`,
      detail:
        reachedStreak >= 30
          ? "That is a habit now."
          : reachedStreak >= 7
            ? `${reachedStreak} days straight — keep it going.`
            : "Keep it going.",
    };
  }

  if (opts.unlockedBadges > seenBadges) {
    const gained = opts.unlockedBadges - seenBadges;
    writeNumber(SEEN_BADGES_KEY, opts.unlockedBadges);
    return {
      kind: "badge",
      value: opts.unlockedBadges,
      title: gained === 1 ? "Achievement unlocked" : `${gained} achievements unlocked`,
      detail: `${opts.unlockedBadges} earned so far.`,
    };
  }

  return null;
}

/**
 * Marks the current state as seen without celebrating.
 *
 * Call this once on a first run. Without it, somebody restoring a backup
 * with a 40-day streak gets a "3-day streak" celebration, which is worse
 * than no celebration at all.
 */
export function primeMilestones(opts: {
  currentStreak: number;
  unlockedBadges: number;
}) {
  writeNumber(SEEN_STREAK_KEY, highestStreakMilestone(opts.currentStreak));
  writeNumber(SEEN_BADGES_KEY, opts.unlockedBadges);
}
