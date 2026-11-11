/**
 * Every analytics event name lives here. Names are lowercase letters, digits and underscores (max 40).
 * Never put personal data (names, emails, uids, free text) in event parameters: only small fixed
 * choices and counters. `first_open` and `session_start` are collected by Firebase on its own, and
 * Firebase reserves those names, so they are not listed.
 */
export const EV = {
  // the funnel
  appOpen: "app_open",
  signupComplete: "signup_complete",
  signinShown: "signin_shown",
  signinStarted: "signin_started",
  signinCompleted: "signin_completed",
  goalSet: "goal_set",
  firstWorkoutStarted: "first_workout_started",
  firstWorkoutFinished: "first_workout_finished",
  returnD1: "return_d1",
  returnD7: "return_d7",
  returnD30: "return_d30",
  paywallSeen: "paywall_seen",
  arenaMatchPlayed: "arena_match_played",
  challengeSent: "challenge_sent",
  // supporting events
  onboardingStep: "onboarding_step",
  onboardingComplete: "onboarding_complete",
  goalSetupStep: "goalsetup_step",
  goalSetupSkipped: "goalsetup_skipped",
  workoutLogged: "workout_logged",
  levelUp: "level_up",
  programStarted: "program_started",
  programCompleted: "program_completed",
  paywallBuyTap: "paywall_buy_tap",
  subscribed: "subscribed",
  arenaRematch: "arena_rematch",
  firstArenaMatch: "first_arena_match",
} as const;

export type EventName = (typeof EV)[keyof typeof EV];
export type EventParams = Record<string, string | number | boolean>;
