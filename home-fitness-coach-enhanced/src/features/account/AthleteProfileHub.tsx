import { shareContent } from "../../core/nativeBridge";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Settings as SettingsIcon,
  Trophy,
  Camera,
  Film,
  Plus,
  Heart,
  Activity,
  Share2,
  Play,
  Flame,
  Clock,
  Dumbbell,
  ShieldCheck,
  Scale,
  TrendingUp,
  Crown,
} from "lucide-react";
import type { UserProfile, WorkoutLog } from "../../types";
import { computeUnlockedAchievements } from "../progress/achievements";
import TrophyRoom from "../progress/TrophyRoom";
import { computeRank, computeXp } from "../progress/ranks";
import { tapFeedback } from "../../core/haptics";
import { useMyIdentity, setMyAvatarFromFile } from "../social/useSocial";
import BiometricRecoveryHub from "../progress/BiometricRecoveryHub";
import PublicProfileSheet from "../social/PublicProfileSheet";
import ReelCreatorStudio, { type UserReel } from "../reels/ReelCreatorStudio";

interface AthleteProfileHubProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  logs: WorkoutLog[];
  onOpenSettings: () => void;
  onEditProfile: () => void;
  onNavigateToWorkout: () => void;
}

type TabType = "history" | "biometrics" | "achievements" | "reels";

function AthleteProfileHubInner({
  profile,
  logs,
  onOpenSettings,
  onEditProfile,
  onNavigateToWorkout,
}: AthleteProfileHubProps) {
  const [activeTab, setActiveTab] = useState<TabType>("history");
  const [reelStudioOpen, setReelStudioOpen] = useState(false);
  const [userReels, setUserReels] = useState<UserReel[]>([]);
  const identity = useMyIdentity();
  const [publicOpen, setPublicOpen] = useState(false);
  const avatarUrl = identity.avatar;
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  useEffect(() => setAvatarLoadError(false), [avatarUrl]);
  const [activePlayingReel, setActivePlayingReel] = useState<UserReel | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const unlockedBadges = useMemo(() => {
    return computeUnlockedAchievements(profile, logs, [], 0);
  }, [profile, logs]);

  // Load user reels from localStorage (authentic only)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("apex_user_reels") || "[]");
      if (Array.isArray(saved)) {
        const realReels = saved.filter((r: any) => !r.id?.startsWith("starter_"));
        setUserReels(realReels);
      }
    } catch {
      setUserReels([]);
    }
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    tapFeedback();
    try {
      // Saved on this phone AND on the public profile, so comments and other
      // people see the same photo and it survives restarts.
      await setMyAvatarFromFile(file, identity.uid);
    } catch {
      /* unreadable image: keep the previous avatar */
    }
  };

  const handleReelPublished = (newReel: UserReel) => {
    setUserReels((prev) => [newReel, ...prev]);
  };

  const rankState = useMemo(
    () => computeRank(computeXp(profile, logs.length, unlockedBadges.size)),
    [profile, logs.length, unlockedBadges],
  );

  const displayName = identity.name || "Apex Athlete";
  const userHandle = identity.handle;

  const totalMinutes = useMemo(() => {
    return logs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  }, [logs]);

  const totalCalories = useMemo(() => {
    return logs.reduce((acc, l) => acc + (l.estimatedCaloriesBurned || 0), 0);
  }, [logs]);

  // Accurate BMI Calculation
  const bmiData = useMemo(() => {
    if (!profile.heightCm || !profile.weightKg) return null;
    const hM = profile.heightCm / 100;
    const bmi = +(profile.weightKg / (hM * hM)).toFixed(1);
    let category = "Normal";
    let color = "text-emerald-500";
    if (bmi < 18.5) {
      category = "Underweight";
      color = "text-blue-400";
    } else if (bmi >= 25 && bmi < 30) {
      category = "Overweight";
      color = "text-amber-500";
    } else if (bmi >= 30) {
      category = "High";
      color = "text-rose-500";
    }
    return { bmi, category, color };
  }, [profile.heightCm, profile.weightKg]);

  return (
    <div className="w-full space-y-4 pb-28 text-ink animate-fade-in">
      {/* -------------------- 1. ATHLETE PROFILE HEADER -------------------- */}
      <div className="rounded-2xl border border-line bg-carbon p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          {/* Avatar with Camera Trigger */}
          <div className="relative shrink-0">
            <div className="relative h-20 w-20 rounded-2xl overflow-hidden border border-line-strong bg-carbon flex items-center justify-center">
              {avatarUrl && !avatarLoadError ? (
                <img
                  src={avatarUrl}
                  alt=""
                  onError={() => setAvatarLoadError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-graphite text-ink text-2xl font-bold">
                  {displayName[0]?.toUpperCase() || "A"}
                </div>
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-xl bg-volt text-void border border-black shadow-sm active:scale-95 transition"
              title="Change Profile Photo"
              aria-label="Upload photo"
            >
              <Camera className="h-3.5 w-3.5 stroke-[2.5]" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {/* Profile Name & Status */}
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-ink truncate">
                {displayName}
              </h1>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="text-xs font-medium text-ink-3">@{userHandle}</p>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold"
                style={{ background: `${rankState.rank.color}22`, color: rankState.rank.color }}
              >
                <Crown className="h-3 w-3" /> {rankState.rank.name} · Lv {rankState.level}
              </span>
              <span className="rounded-lg bg-graphite px-2.5 py-1 text-xs font-semibold text-ink-2">
                {profile.fitnessLevel || "Intermediate"}
              </span>
              <span className="rounded-lg bg-graphite px-2.5 py-1 text-xs font-semibold text-ink-2">
                {profile.goal || "Strength"}
              </span>
            </div>
          </div>

          {/* Settings Trigger */}
          <button
            onClick={() => {
              tapFeedback();
              onOpenSettings();
            }}
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-line bg-graphite text-ink-2 hover:text-ink transition active:scale-95"
            title="App Settings"
            aria-label="Settings"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Action Buttons Strip */}
        <div className="mt-4 flex items-center gap-2 pt-2 border-t border-line">
          <button
            onClick={() => {
              tapFeedback();
              onEditProfile();
            }}
            className="flex-1 rounded-xl bg-graphite hover:bg-graphite border border-line py-2.5 text-xs font-semibold text-ink transition text-center active:scale-98 min-h-[44px]"
          >
            Edit Physical Profile
          </button>
          {identity.signedIn && (
            <button
              onClick={() => {
                tapFeedback();
                setPublicOpen(true);
              }}
              className="flex min-h-[44px] px-3 items-center justify-center gap-1.5 rounded-xl bg-graphite border border-line text-xs font-semibold text-ink-2 transition active:scale-98"
              title="Public profile"
            >
              <span>Public profile</span>
            </button>
          )}
          <button
            onClick={() => {
              tapFeedback();
              void shareContent({
                title: `${displayName} — Apex Athlete`,
                text: `Training with Apex Pulse. Completed ${logs.length} sessions!`,
              });
            }}
            className="flex min-h-[44px] px-3 items-center justify-center gap-1.5 rounded-xl bg-graphite hover:bg-graphite border border-line text-xs font-semibold text-ink-2 transition active:scale-98"
            title="Share Profile"
          >
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* -------------------- 2. ATHLETIC TELEMETRY TILES -------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Workouts */}
        <div className="rounded-2xl border border-line bg-carbon p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              Workouts
            </span>
            <Dumbbell className="h-4 w-4 text-ink-3" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
            {logs.length}
          </p>
          <span className="text-xs text-ink-3 font-medium">Logged Sessions</span>
        </div>

        {/* Active Streak */}
        <div className="rounded-2xl border border-line bg-carbon p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              Streak
            </span>
            <Flame className="h-4 w-4 text-orange-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
            {profile.streakDays || 0}
            <span className="text-sm font-semibold text-ink-3 ml-1">days</span>
          </p>
          <span className="text-xs text-ink-3 font-medium">Consecutive Days</span>
        </div>

        {/* Minutes */}
        <div className="rounded-2xl border border-line bg-carbon p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              Time
            </span>
            <Clock className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
            {totalMinutes}
            <span className="text-sm font-semibold text-ink-3 ml-1">min</span>
          </p>
          <span className="text-xs text-ink-3 font-medium">Total Duration</span>
        </div>

        {/* Calories */}
        <div className="rounded-2xl border border-line bg-carbon p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              Calories
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
            {totalCalories}
            <span className="text-sm font-semibold text-ink-3 ml-1">kcal</span>
          </p>
          <span className="text-xs text-ink-3 font-medium">Estimated Burn</span>
        </div>
      </div>

      {/* -------------------- 3. SEGMENTED NAVIGATION PILLS -------------------- */}
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-carbon p-1.5">
        <button
          onClick={() => {
            tapFeedback();
            setActiveTab("history");
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition min-h-[44px] ${
            activeTab === "history"
              ? "bg-graphite text-ink shadow-sm ring-1 ring-line-strong"
              : "text-ink-3 hover:text-ink"
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Workouts</span>
        </button>

        <button
          onClick={() => {
            tapFeedback();
            setActiveTab("biometrics");
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition min-h-[44px] ${
            activeTab === "biometrics"
              ? "bg-graphite text-ink shadow-sm ring-1 ring-line-strong"
              : "text-ink-3 hover:text-ink"
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>Biometrics</span>
        </button>

        <button
          onClick={() => {
            tapFeedback();
            setActiveTab("achievements");
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition min-h-[44px] ${
            activeTab === "achievements"
              ? "bg-graphite text-ink shadow-sm ring-1 ring-line-strong"
              : "text-ink-3 hover:text-ink"
          }`}
        >
          <Trophy className="h-4 w-4" />
          <span>Trophies</span>
        </button>

        <button
          onClick={() => {
            tapFeedback();
            setActiveTab("reels");
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition min-h-[44px] ${
            activeTab === "reels"
              ? "bg-graphite text-ink shadow-sm ring-1 ring-line-strong"
              : "text-ink-3 hover:text-ink"
          }`}
        >
          <Film className="h-4 w-4" />
          <span>Posts</span>
        </button>
      </div>

      {/* -------------------- 4. TAB CONTENTS -------------------- */}

      {/* Tab: Workout History */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="rounded-2xl border border-line bg-carbon p-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-graphite text-ink-3">
                <Dumbbell className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-ink">No Workouts Logged Yet</h3>
              <p className="text-xs text-ink-3 max-w-sm mx-auto leading-relaxed">
                Log your first workout session to track volume, training duration, and weekly progress.
              </p>
              <button
                onClick={() => {
                  tapFeedback();
                  onNavigateToWorkout();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-volt px-5 py-2.5 text-xs font-bold text-void active:scale-95 transition min-h-[44px]"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Start Workout Session</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-3">
                  Completed Sessions
                </h3>
                <span className="text-xs font-semibold text-ink-3">
                  {logs.length} logged
                </span>
              </div>

              {logs
                .slice()
                .reverse()
                .map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-4 rounded-2xl border border-line bg-carbon hover:border-line-strong transition"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-ink">
                        {log.workoutTitle}
                      </h4>
                      <p className="text-xs text-ink-3 mt-1">
                        {new Date(log.completedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        · {log.durationMinutes} min · {log.exercisesCompleted} exercises
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold tabular-nums text-ink block">
                        {log.estimatedCaloriesBurned} kcal
                      </span>
                      <span className="text-xs font-medium text-ink-3">
                        {log.feeling || "Completed"}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Biometrics & Readiness */}
      {activeTab === "biometrics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Height */}
            <div className="rounded-2xl border border-line bg-carbon p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Height
              </span>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
                {profile.heightCm || "—"}
                <span className="text-sm font-semibold text-ink-3 ml-1">cm</span>
              </p>
              <span className="text-xs text-ink-3">Stature</span>
            </div>

            {/* Weight */}
            <div className="rounded-2xl border border-line bg-carbon p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Weight
              </span>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
                {profile.weightKg || "—"}
                <span className="text-sm font-semibold text-ink-3 ml-1">kg</span>
              </p>
              <span className="text-xs text-ink-3">Current Mass</span>
            </div>

            {/* BMI */}
            <div className="rounded-2xl border border-line bg-carbon p-4 col-span-2 sm:col-span-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Body Mass Index
              </span>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
                {bmiData?.bmi || "—"}
              </p>
              <span className={`text-xs font-semibold ${bmiData?.color || "text-ink-3"}`}>
                {bmiData?.category || "Profile incomplete"}
              </span>
            </div>
          </div>

          {/* Integrated Recovery Hub */}
          <BiometricRecoveryHub logs={logs} profile={profile} />
        </div>
      )}

      {/* Tab: Trophies, rank & achievements */}
      {activeTab === "achievements" && (
        <TrophyRoom profile={profile} logs={logs} unlocked={unlockedBadges} />
      )}

      {/* Tab: Posts & Media */}
      {activeTab === "reels" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-3">
              Athlete Posts
            </h3>
            <button
              onClick={() => {
                tapFeedback();
                setReelStudioOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-volt"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Post</span>
            </button>
          </div>

          {userReels.length === 0 ? (
            <div className="rounded-2xl border border-line bg-carbon p-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-graphite text-ink-3">
                <Camera className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-ink">No Posts or Footage Yet</h3>
              <p className="text-xs text-ink-3 max-w-sm mx-auto leading-relaxed">
                Record your workout highlights or capture lifting form to share in the community.
              </p>
              <button
                onClick={() => setReelStudioOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-volt px-4 py-2.5 text-xs font-bold text-void active:scale-95 transition min-h-[44px]"
              >
                <Plus className="h-4 w-4" />
                <span>Create First Post</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {userReels.map((reel) => (
                <div
                  key={reel.id}
                  onClick={() => {
                    tapFeedback();
                    setActivePlayingReel(reel);
                  }}
                  className="group relative aspect-square overflow-hidden bg-carbon cursor-pointer rounded-xl border border-line"
                >
                  {reel.type === "video" ? (
                    <video
                      src={reel.mediaUrl}
                      preload="metadata"
                      muted
                      playsInline
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <img
                      src={reel.mediaUrl}
                      alt=""
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                    <span className="flex items-center gap-1 text-ink text-xs font-bold">
                      <Heart className="h-3 w-3 fill-current text-rose-500" />
                      <span>{reel.likes}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reel Player Modal */}
      {activePlayingReel && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 animate-fade-in">
          <div className="relative w-full max-w-[360px] aspect-[9/16] rounded-2xl overflow-hidden bg-void border border-line shadow-2xl flex flex-col justify-between">
            {activePlayingReel.type === "video" ? (
              <video
                src={activePlayingReel.mediaUrl}
                autoPlay
                loop
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={activePlayingReel.mediaUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white">
              <span className="text-xs font-bold text-ink">@{userHandle}</span>
              <button
                onClick={() => setActivePlayingReel(null)}
                className="h-8 w-8 rounded-full bg-black/60 flex items-center justify-center text-white"
              >
                ✕
              </button>
            </div>
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 to-transparent text-white space-y-1">
              <p className="text-xs font-medium leading-relaxed">
                {activePlayingReel.caption}
              </p>
              <div className="flex items-center justify-between text-xs text-ink-3">
                <span>{activePlayingReel.musicTrack || "Apex Training"}</span>
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <Heart className="h-3 w-3 fill-current" /> {activePlayingReel.likes}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reel Creator Studio Modal */}
      {reelStudioOpen && (
        <ReelCreatorStudio
          onClose={() => setReelStudioOpen(false)}
          onReelPublished={handleReelPublished}
        />
      )}
      {publicOpen && identity.uid && <PublicProfileSheet uid={identity.uid} onClose={() => setPublicOpen(false)} />}
    </div>
  );
}

const AthleteProfileHub = React.memo(AthleteProfileHubInner);
export default AthleteProfileHub;
