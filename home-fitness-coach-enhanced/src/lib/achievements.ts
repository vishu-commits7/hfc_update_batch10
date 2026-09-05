import { AchievementDef, UserProfile, WorkoutLog, ProgressLog } from "../types";

/**
 * The full badge catalogue. Nothing here is unlocked by default — every
 * badge is earned purely from real activity the user has logged in this
 * install. A fresh profile therefore starts at 0/24, exactly like the rest
 * of the app starts at zero records.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_workout", title: "First Rep", description: "Complete your first workout.", icon: "🎯", tier: "bronze" },
  { id: "workouts_5", title: "Getting Started", description: "Complete 5 workouts.", icon: "🥉", tier: "bronze" },
  { id: "workouts_10", title: "Ten & Counting", description: "Complete 10 workouts.", icon: "🥈", tier: "silver" },
  { id: "workouts_25", title: "Quarter Century", description: "Complete 25 workouts.", icon: "🥇", tier: "gold" },
  { id: "workouts_50", title: "Half Century", description: "Complete 50 workouts.", icon: "🏅", tier: "gold" },
  { id: "workouts_100", title: "Centurion", description: "Complete 100 workouts.", icon: "💯", tier: "platinum" },
  { id: "streak_3", title: "Momentum", description: "Reach a 3-day streak.", icon: "🔥", tier: "bronze" },
  { id: "streak_7", title: "One Week Strong", description: "Reach a 7-day streak.", icon: "🔥", tier: "silver" },
  { id: "streak_14", title: "Two-Week Warrior", description: "Reach a 14-day streak.", icon: "🔥", tier: "gold" },
  { id: "streak_30", title: "Unstoppable", description: "Reach a 30-day streak.", icon: "🏆", tier: "platinum" },
  { id: "minutes_100", title: "Time Invested", description: "Log 100 total training minutes.", icon: "⏱️", tier: "bronze" },
  { id: "minutes_500", title: "Half a Grand", description: "Log 500 total training minutes.", icon: "⏱️", tier: "silver" },
  { id: "minutes_1000", title: "1000 Minute Club", description: "Log 1,000 total training minutes.", icon: "⏱️", tier: "gold" },
  { id: "calories_1000", title: "Furnace", description: "Burn 1,000 estimated calories.", icon: "🔥", tier: "bronze" },
  { id: "calories_5000", title: "Inferno", description: "Burn 5,000 estimated calories.", icon: "🔥", tier: "silver" },
  { id: "calories_10000", title: "Metabolic Machine", description: "Burn 10,000 estimated calories.", icon: "🔥", tier: "gold" },
  { id: "explorer_5", title: "Explorer", description: "Log 5 different exercises in Progress Tracker.", icon: "🧭", tier: "bronze" },
  { id: "explorer_15", title: "Movement Scholar", description: "Log 15 different exercises in Progress Tracker.", icon: "📚", tier: "silver" },
  { id: "favorites_5", title: "Curator", description: "Favorite 5 exercises in the Academy.", icon: "⭐", tier: "bronze" },
  { id: "favorites_10", title: "Collector", description: "Favorite 10 exercises in the Academy.", icon: "🌟", tier: "silver" },
  { id: "early_bird", title: "Early Bird", description: "Complete a workout before 7 AM.", icon: "🌅", tier: "silver" },
  { id: "night_owl", title: "Night Owl", description: "Complete a workout after 9 PM.", icon: "🌙", tier: "silver" },
  { id: "weekend_warrior", title: "Weekend Warrior", description: "Complete workouts on both Saturday and Sunday.", icon: "🗓️", tier: "silver" },
  { id: "feeling_energetic_5", title: "Energized", description: "Finish 5 sessions feeling Energetic.", icon: "⚡", tier: "bronze" },
];

export interface AchievementProgress {
  def: AchievementDef;
  unlocked: boolean;
}

export function computeUnlockedAchievements(
  profile: UserProfile,
  logs: WorkoutLog[],
  progressLogs: ProgressLog[],
  favoritesCount: number
): Set<string> {
  const unlocked = new Set<string>();

  const totalWorkouts = profile.totalWorkouts;
  if (totalWorkouts >= 1) unlocked.add("first_workout");
  if (totalWorkouts >= 5) unlocked.add("workouts_5");
  if (totalWorkouts >= 10) unlocked.add("workouts_10");
  if (totalWorkouts >= 25) unlocked.add("workouts_25");
  if (totalWorkouts >= 50) unlocked.add("workouts_50");
  if (totalWorkouts >= 100) unlocked.add("workouts_100");

  if (profile.streakDays >= 3) unlocked.add("streak_3");
  if (profile.streakDays >= 7) unlocked.add("streak_7");
  if (profile.streakDays >= 14) unlocked.add("streak_14");
  if (profile.streakDays >= 30) unlocked.add("streak_30");

  if (profile.totalMinutes >= 100) unlocked.add("minutes_100");
  if (profile.totalMinutes >= 500) unlocked.add("minutes_500");
  if (profile.totalMinutes >= 1000) unlocked.add("minutes_1000");

  if (profile.totalCaloriesBurned >= 1000) unlocked.add("calories_1000");
  if (profile.totalCaloriesBurned >= 5000) unlocked.add("calories_5000");
  if (profile.totalCaloriesBurned >= 10000) unlocked.add("calories_10000");

  const uniqueExercises = new Set<string>();
  progressLogs.forEach(pl => pl.exercises.forEach(ex => uniqueExercises.add(ex.exerciseName.toLowerCase())));
  if (uniqueExercises.size >= 5) unlocked.add("explorer_5");
  if (uniqueExercises.size >= 15) unlocked.add("explorer_15");

  if (favoritesCount >= 5) unlocked.add("favorites_5");
  if (favoritesCount >= 10) unlocked.add("favorites_10");

  let sawSaturday = false, sawSunday = false, energeticCount = 0;
  logs.forEach(log => {
    const d = new Date(log.completedAt);
    const hour = d.getHours();
    if (hour < 7) unlocked.add("early_bird");
    if (hour >= 21) unlocked.add("night_owl");
    const day = d.getDay();
    if (day === 6) sawSaturday = true;
    if (day === 0) sawSunday = true;
    if (log.feeling === "Energetic") energeticCount++;
  });
  if (sawSaturday && sawSunday) unlocked.add("weekend_warrior");
  if (energeticCount >= 5) unlocked.add("feeling_energetic_5");

  return unlocked;
}
