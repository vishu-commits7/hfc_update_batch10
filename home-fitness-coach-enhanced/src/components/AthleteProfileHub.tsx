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
  MessageCircle,
} from "lucide-react";
import type { UserProfile, WorkoutLog } from "../types";
import { useAuthUser } from "../lib/useAuth";
import { ACHIEVEMENTS, computeUnlockedAchievements } from "../lib/achievements";
import { tapFeedback } from "../lib/haptics";
import BiometricRecoveryHub from "./BiometricRecoveryHub";
import ReelCreatorStudio, { type UserReel } from "./ReelCreatorStudio";
import FriendsAndChatHub from "./FriendsAndChatHub";

interface AthleteProfileHubProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  logs: WorkoutLog[];
  onOpenSettings: () => void;
  onEditProfile: () => void;
  onNavigateToWorkout: () => void;
}

type TabType = "reels" | "readiness" | "badges";

export default function AthleteProfileHub({
  profile,
  logs,
  onOpenSettings,
  onEditProfile,
  onNavigateToWorkout,
}: AthleteProfileHubProps) {
  const { user } = useAuthUser();
  const [activeTab, setActiveTab] = useState<TabType>("reels");
  const [reelStudioOpen, setReelStudioOpen] = useState(false);
  const [chatHubOpen, setChatHubOpen] = useState(false);
  const [userReels, setUserReels] = useState<UserReel[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    return localStorage.getItem("apex_user_avatar") || null;
  });
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [activePlayingReel, setActivePlayingReel] = useState<UserReel | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const unlockedBadges = useMemo(() => {
    return computeUnlockedAchievements(profile, logs, [], 0);
  }, [profile, logs]);

  // Load user reels from localStorage (authentic only, no fake starter items)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("apex_user_reels") || "[]");
      if (Array.isArray(saved)) {
        // Filter out any legacy starter items from older sessions
        const realReels = saved.filter((r: any) => !r.id?.startsWith("starter_"));
        setUserReels(realReels);
        if (realReels.length !== saved.length) {
          localStorage.setItem("apex_user_reels", JSON.stringify(realReels));
        }
      } else {
        setUserReels([]);
      }
    } catch {
      setUserReels([]);
    }
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    tapFeedback();
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
    setAvatarLoadError(false);
    localStorage.setItem("apex_user_avatar", url);
  };

  const handleReelPublished = (newReel: UserReel) => {
    setUserReels((prev) => [newReel, ...prev]);
  };

  const displayName = user?.displayName || "Apex Athlete";
  const userHandle = displayName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 16) || "apex_athlete";

  const HIGHLIGHTS = [
    { id: "h1", name: "PRs", icon: "🏆", bg: "from-amber-500/20 to-orange-500/20" },
    { id: "h2", name: "Chest", icon: "⚡", bg: "from-cyan-500/20 to-blue-500/20" },
    { id: "h3", name: "Legs", icon: "🦵", bg: "from-purple-500/20 to-pink-500/20" },
    { id: "h4", name: "Fuel", icon: "🥗", bg: "from-emerald-500/20 to-teal-500/20" },
  ];

  return (
    <div className="w-full space-y-4 pb-28 text-slate-100 animate-fade-in">
      {/* -------------------- 1. INSTAGRAM TOP BAR -------------------- */}
      <div className="flex items-center justify-between py-1 px-1">
        {/* Username & Verified Badge */}
        <div className="flex items-center gap-1.5 cursor-pointer">
          <h1 className="text-base font-black tracking-tight text-white">
            {userHandle}
          </h1>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-black text-[9px] font-black" title="Verified Athlete">
            ✓
          </span>
        </div>

        {/* Top Actions: (💬) Friends & Chat, (+) Create Reel, (⚙️) Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              tapFeedback();
              setChatHubOpen(true);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/10 active:scale-95 transition"
            title="Friends & Messages"
          >
            <MessageCircle className="h-4 w-4 text-cyan-400" />
          </button>

          <button
            onClick={() => {
              tapFeedback();
              setReelStudioOpen(true);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/10 active:scale-95 transition"
            title="Create Reel / Story"
          >
            <Plus className="h-5 w-5" />
          </button>

          <button
            onClick={() => {
              tapFeedback();
              onOpenSettings();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/10 active:scale-95 transition"
            title="App Settings"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* -------------------- 2. AVATAR + STATS ROW -------------------- */}
      <div className="flex items-center gap-5 pt-1 px-1">
        {/* Instagram Story-Ring Avatar */}
        <div className="relative shrink-0">
          <div className="relative h-20 w-20 rounded-full p-[2.5px] bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-500 shadow-md">
            <div className="h-full w-full rounded-full overflow-hidden bg-slate-900 border-2 border-black flex items-center justify-center">
              {(avatarUrl || user?.photoURL) && !avatarLoadError ? (
                <img
                  src={avatarUrl || user?.photoURL || ""}
                  alt=""
                  onError={() => setAvatarLoadError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-cyan-900/80 via-slate-900 to-blue-950 text-cyan-300 text-2xl font-black">
                  {displayName[0]?.toUpperCase() || "A"}
                </div>
              )}
            </div>
          </div>

          {/* Quick Camera Upload Button */}
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 text-black border-2 border-black shadow-md hover:scale-110 active:scale-95 transition"
            title="Upload Photo"
          >
            <Camera className="h-3 w-3 stroke-[2.5]" />
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        {/* 3 Stats Columns (Instagram Style) */}
        <div className="flex-1 grid grid-cols-3 gap-1 text-center">
          <div className="p-1">
            <p className="text-base font-black text-white">{profile.totalWorkouts || 0}</p>
            <p className="text-[11px] font-medium text-slate-400">Workouts</p>
          </div>
          <div className="p-1">
            <p className="text-base font-black text-amber-400">{profile.streakDays || 0}d</p>
            <p className="text-[11px] font-medium text-slate-400">Streak</p>
          </div>
          <div className="p-1">
            <p className="text-base font-black text-cyan-400">{userReels.length}</p>
            <p className="text-[11px] font-medium text-slate-400">Reels</p>
          </div>
        </div>
      </div>

      {/* -------------------- 3. BIO & DETAILS BLOCK -------------------- */}
      <div className="space-y-1 px-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-black text-white">{displayName}</p>
          <span className="rounded-md bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.5 text-[9px] font-black uppercase text-cyan-300">
            {profile.fitnessLevel}
          </span>
        </div>
        <p className="text-xs text-slate-400 font-medium">
          Goal: <span className="text-slate-200">{profile.goal}</span>
        </p>
        <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
          Discipline over motivation. Every rep counted on Apex Pulse. 🔥
        </p>
      </div>

      {/* -------------------- 4. ACTION BUTTONS ROW -------------------- */}
      <div className="flex items-center gap-2 pt-1 px-1">
        <button
          onClick={() => {
            tapFeedback();
            onEditProfile();
          }}
          className="flex-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 py-2 text-xs font-bold text-white transition text-center active:scale-98"
        >
          Edit Profile
        </button>

        <button
          onClick={() => {
            tapFeedback();
            onOpenSettings();
          }}
          className="flex-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 py-2 text-xs font-bold text-slate-200 transition text-center active:scale-98 flex items-center justify-center gap-1.5"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
          <span>App Settings</span>
        </button>

        <button
          onClick={() => {
            tapFeedback();
            if (navigator.share) {
              navigator.share({
                title: `${displayName}'s Apex Profile`,
                text: `Check out my workouts and reels on Apex Pulse!`,
                url: window.location.href,
              }).catch(() => {});
            }
          }}
          className="h-8 w-8 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 flex items-center justify-center text-slate-200 active:scale-95 transition"
          title="Share Profile"
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* -------------------- 5. STORY HIGHLIGHTS TRAY -------------------- */}
      <div className="pt-2 px-1">
        <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar pb-1">
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.id}
              onClick={() => {
                tapFeedback();
                setActiveTab("reels");
              }}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
            >
              <div className="h-14 w-14 rounded-full p-[2px] border border-white/20 group-hover:border-cyan-400 transition bg-black flex items-center justify-center">
                <div className={`h-full w-full rounded-full bg-gradient-to-br ${h.bg} flex items-center justify-center text-lg`}>
                  {h.icon}
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-300 group-hover:text-white">
                {h.name}
              </span>
            </div>
          ))}

          {/* Add Highlight */}
          <div
            onClick={() => {
              tapFeedback();
              setReelStudioOpen(true);
            }}
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
          >
            <div className="h-14 w-14 rounded-full border border-dashed border-white/30 group-hover:border-cyan-400 flex items-center justify-center bg-white/[0.04]">
              <Plus className="h-5 w-5 text-slate-400 group-hover:text-white" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400">New</span>
          </div>
        </div>
      </div>

      {/* -------------------- 6. INSTAGRAM 3-TAB BAR -------------------- */}
      <div className="flex border-b border-white/10 pt-2">
        <button
          onClick={() => {
            tapFeedback();
            setActiveTab("reels");
          }}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === "reels"
              ? "border-white text-white"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
          title="Reels & Posts"
        >
          <Film className="h-4 w-4" />
          <span>Reels ({userReels.length})</span>
        </button>

        <button
          onClick={() => {
            tapFeedback();
            setActiveTab("readiness");
          }}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === "readiness"
              ? "border-white text-white"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
          title="Readiness & Recovery"
        >
          <Activity className="h-4 w-4" />
          <span>Recovery</span>
        </button>

        <button
          onClick={() => {
            tapFeedback();
            setActiveTab("badges");
          }}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === "badges"
              ? "border-white text-white"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
          title="Trophies & Badges"
        >
          <Trophy className="h-4 w-4" />
          <span>Badges</span>
        </button>
      </div>

      {/* -------------------- 7. TAB CONTENT -------------------- */}

      {/* Tab 1: Instagram 3-Column Square Grid */}
      {activeTab === "reels" && (
        <div>
          {userReels.length === 0 ? (
            <div className="py-12 text-center space-y-3 rounded-2xl border border-dashed border-white/10 p-6 bg-white/[0.02]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white">
                <Camera className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black text-white">No Reels or Posts Yet</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Record your workout footage or upload gym photos to start your fitness reel gallery.
              </p>
              <button
                onClick={() => setReelStudioOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-black hover:brightness-110"
              >
                <Plus className="h-4 w-4" /> Create First Reel
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {userReels.map((reel) => (
                <div
                  key={reel.id}
                  onClick={() => {
                    tapFeedback();
                    setActivePlayingReel(reel);
                  }}
                  className="group relative aspect-square overflow-hidden bg-slate-900 cursor-pointer rounded-md"
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

                  {/* Gradient overlay & Play icon + Likes */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-1.5">
                    <div className="flex items-center justify-between text-white text-[10px] font-black drop-shadow">
                      <span className="flex items-center gap-0.5">
                        <Play className="h-2.5 w-2.5 fill-current" /> {reel.likes}
                      </span>
                      <span className="text-[8px] bg-black/60 px-1 py-0.2 rounded font-bold uppercase text-cyan-300">
                        {reel.type}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Clean Nested iOS Health Recovery Cards */}
      {activeTab === "readiness" && (
        <div className="space-y-4 pt-1">
          <BiometricRecoveryHub
            logs={logs}
            profile={profile}
            onNavigateToWorkout={onNavigateToWorkout}
          />
        </div>
      )}

      {/* Tab 3: Achievements & Badges Grid */}
      {activeTab === "badges" && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {ACHIEVEMENTS.map((a) => {
            const isUnlocked = unlockedBadges.has(a.id);
            return (
              <div
                key={a.id}
                className={`rounded-2xl border p-3 text-center transition ${
                  isUnlocked
                    ? "border-amber-400/40 bg-amber-950/20 text-white"
                    : "border-white/5 bg-white/[0.03] opacity-40"
                }`}
              >
                <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">
                  {a.icon}
                </div>
                <h3 className="text-[11px] font-black leading-tight truncate">{a.title}</h3>
                <span className="mt-1.5 inline-block rounded-full bg-white/10 px-1.5 py-0.5 text-[8px] font-bold">
                  {isUnlocked ? "Unlocked 🏆" : "Locked 🔒"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* -------------------- 8. FULLSCREEN REEL VIEWER MODAL -------------------- */}
      {activePlayingReel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-2 animate-fade-in">
          <div className="relative w-full max-w-[360px] aspect-[9/16] rounded-3xl overflow-hidden bg-black border border-white/20 shadow-2xl flex flex-col justify-between">
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

            {/* Top Bar with Close */}
            <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">@{userHandle}</span>
                <span className="text-[10px] text-cyan-400 font-black px-1.5 py-0.5 rounded bg-black/50">
                  {activePlayingReel.badge}
                </span>
              </div>
              <button
                onClick={() => setActivePlayingReel(null)}
                className="h-8 w-8 rounded-full bg-black/60 flex items-center justify-center text-white"
              >
                ✕
              </button>
            </div>

            {/* Bottom Caption & Music */}
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 to-transparent text-white space-y-1">
              <p className="text-xs font-bold leading-relaxed">{activePlayingReel.caption}</p>
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>🎵 {activePlayingReel.musicTrack}</span>
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <Heart className="h-3 w-3 fill-current" /> {activePlayingReel.likes}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- 9. REEL CREATOR STUDIO MODAL -------------------- */}
      {reelStudioOpen && (
        <ReelCreatorStudio
          onClose={() => setReelStudioOpen(false)}
          onReelPublished={handleReelPublished}
        />
      )}

      {/* -------------------- 10. FRIENDS & DIRECT CHAT HUB -------------------- */}
      <FriendsAndChatHub
        isOpen={chatHubOpen}
        onClose={() => setChatHubOpen(false)}
      />
    </div>
  );
}
