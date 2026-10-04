import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Swords,
  Flame,
  Share2,
  Play,
  CheckCircle2,
  ArrowLeft,
  Radio,
  Timer,
  Camera,
  MessageCircle,
  Plus,
  Minus,
  Copy,
  Check,
  Users,
  Sparkles,
  Trophy,
} from "lucide-react";
import { audio } from "../lib/audio";
import { tapFeedback, celebrateFeedback } from "../lib/haptics";
import Confetti from "./Confetti";
import LiveStreamDuelModal, { LiveDuelOpponent } from "./LiveStreamDuelModal";
import { apiUrl, apiHeaders } from "../lib/apiBase";
import { getCreators, Creator } from "../lib/socialFeed";
import FriendsAndChatHub, { FriendProfile } from "./FriendsAndChatHub";

export interface ExerciseDiscipline {
  id: string;
  name: string;
  targetMuscle: string;
  icon: string;
  color: string;
  videoUrl: string;
  defaultReps: number;
  defaultTime: number;
  cue: string;
}

export const EXERCISE_DISCIPLINES: ExerciseDiscipline[] = [
  {
    id: "pushups",
    name: "Classic Push-ups",
    targetMuscle: "Chest & Triceps",
    icon: "🦾",
    color: "#38bdf8",
    videoUrl: "/videos/Classic pushup.mp4",
    defaultReps: 35,
    defaultTime: 45,
    cue: "Lock 90° elbow depth with rigid plank alignment",
  },
  {
    id: "jumpsquats",
    name: "Jump Squats",
    targetMuscle: "Quads & Glutes",
    icon: "⚡",
    color: "#f59e0b",
    videoUrl: "/videos/jumpsquat.mp4",
    defaultReps: 30,
    defaultTime: 45,
    cue: "Explode into vertical triple extension with soft landing",
  },
  {
    id: "diamond",
    name: "Diamond Push-ups",
    targetMuscle: "Triceps Focus",
    icon: "💎",
    color: "#ec4899",
    videoUrl: "/videos/Diamond Push-ups.mp4",
    defaultReps: 25,
    defaultTime: 45,
    cue: "Thumbs together beneath sternum, isolate triceps torque",
  },
  {
    id: "climbers",
    name: "Mountain Climbers",
    targetMuscle: "Core & Cadence",
    icon: "🏔️",
    color: "#10b981",
    videoUrl: "/videos/Mountain Climbers.mp4",
    defaultReps: 50,
    defaultTime: 30,
    cue: "Piston knee drive while maintaining anti-rotation core",
  },
  {
    id: "burpees",
    name: "Burpees",
    targetMuscle: "Full Body Burn",
    icon: "💥",
    color: "#ef4444",
    videoUrl: "/videos/burpees.mp4",
    defaultReps: 20,
    defaultTime: 45,
    cue: "Chest to ground, dynamic kickback and vertical reach",
  },
  {
    id: "plank",
    name: "Forearm Plank",
    targetMuscle: "Isometric Core",
    icon: "🛡️",
    color: "#a855f7",
    videoUrl: "/videos/Forearm plank.mp4",
    defaultReps: 1,
    defaultTime: 60,
    cue: "Posterior pelvic tilt with 100% intra-abdominal pressure",
  },
];

interface BeastDuelArenaProps {
  onBack: () => void;
  onLogWorkout?: (log: any) => void;
}

export default function BeastDuelArena({ onBack, onLogWorkout }: BeastDuelArenaProps) {
  // Navigation sub-tab
  const [activeTab, setActiveTab] = useState<"challenge" | "creators" | "ladder">("challenge");

  // Custom Challenge Setup State (Chess.com inspired)
  const [selectedDiscipline, setSelectedDiscipline] = useState<ExerciseDiscipline>(EXERCISE_DISCIPLINES[0]);
  const [duelFormat, setDuelFormat] = useState<"time_blitz" | "rep_race">("time_blitz");
  const [targetValue, setTargetValue] = useState<number>(45);

  // Matchmaking & Room States
  const [isSearchingQueue, setIsSearchingQueue] = useState(false);
  const [queueSearchSeconds, setQueueSearchSeconds] = useState(0);
  const [queueStatusMessage, setQueueStatusMessage] = useState<string>("Searching for athlete in queue...");
  const [queueSearchFailed, setQueueSearchFailed] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  // Share Room State
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [isWaitingForFriend, setIsWaitingForFriend] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Live Modal States
  const [liveStreamModalOpen, setLiveStreamModalOpen] = useState(false);
  const [matchedOpponent, setMatchedOpponent] = useState<LiveDuelOpponent | null>(null);
  const [isSoloPracticeMode, setIsSoloPracticeMode] = useState(false);

  // Chat Hub
  const [chatHubOpen, setChatHubOpen] = useState(false);
  const [chatTargetFriendId, setChatTargetFriendId] = useState<string | null>(null);

  // User Stats & ELO
  const [athleteElo, setAthleteElo] = useState(() => {
    return parseInt(localStorage.getItem("kinetic_athlete_elo") || "0", 10);
  });
  const [duelWins, setDuelWins] = useState(() => {
    return parseInt(localStorage.getItem("kinetic_beast_wins") || "0", 10);
  });

  const creators = getCreators();
  const searchPollTimerRef = useRef<any>(null);
  const friendPollTimerRef = useRef<any>(null);

  // Sync targetValue whenever format or discipline changes
  const handleFormatChange = (fmt: "time_blitz" | "rep_race") => {
    tapFeedback();
    setDuelFormat(fmt);
    if (fmt === "time_blitz") {
      setTargetValue(selectedDiscipline.defaultTime);
    } else {
      setTargetValue(selectedDiscipline.defaultReps);
    }
  };

  const handleDisciplineSelect = (disc: ExerciseDiscipline) => {
    tapFeedback();
    setSelectedDiscipline(disc);
    if (duelFormat === "time_blitz") {
      setTargetValue(disc.defaultTime);
    } else {
      setTargetValue(disc.defaultReps);
    }
  };

  const adjustTarget = (delta: number) => {
    tapFeedback();
    if (duelFormat === "time_blitz") {
      setTargetValue((prev) => Math.max(15, Math.min(180, prev + delta * 5)));
    } else {
      setTargetValue((prev) => Math.max(5, Math.min(150, prev + delta * 5)));
    }
  };

  // Check URL on mount for direct challenge join link (?duelRoom=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const duelRoomParam = params.get("duelRoom");
    if (duelRoomParam) {
      handleJoinRoomByUrl(duelRoomParam);
    }
  }, []);

  // Clean up polling timers on unmount to avoid background leaks
  useEffect(() => {
    return () => {
      if (searchPollTimerRef.current) {
        clearInterval(searchPollTimerRef.current);
        searchPollTimerRef.current = null;
      }
      if (friendPollTimerRef.current) {
        clearInterval(friendPollTimerRef.current);
        friendPollTimerRef.current = null;
      }
    };
  }, []);

  const handleJoinRoomByUrl = async (roomId: string) => {
    try {
      const athleteName = localStorage.getItem("apex_user_name") || "Guest Athlete";
      const res = await fetch(apiUrl(`/api/duel/room/${roomId}/join`), {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          guest: {
            id: `user_${Date.now()}`,
            name: athleteName,
            avatar: "/assets/coaches/coach-beast-male.jpg",
            reps: 0,
            ready: true,
          },
        }),
      });
      const data = await res.json();
      if (data.ok && data.room) {
        const room = data.room;
        const matchingDiscipline =
          EXERCISE_DISCIPLINES.find((d) => d.name.toLowerCase() === room.exerciseName.toLowerCase()) ||
          EXERCISE_DISCIPLINES[0];

        setSelectedDiscipline(matchingDiscipline);
        setDuelFormat(room.format);
        setTargetValue(room.targetValue);

        setMatchedOpponent({
          id: room.host.id,
          name: room.host.name,
          handle: `@${room.host.name.toLowerCase().replace(/\s+/g, "_")}`,
          avatar: room.host.avatar || "/assets/coaches/coach-upper-male.jpg",
          ratingElo: 1550,
          tier: "Live Challenger",
          streamVideoUrl: room.videoDemoUrl,
          specialtyExercise: room.exerciseName,
          targetMuscle: matchingDiscipline.targetMuscle,
          scientificMetric: `${room.targetValue} ${room.format === "time_blitz" ? "Seconds" : "Reps"}`,
          biologicalMechanism: matchingDiscipline.cue,
        });
        setIsSoloPracticeMode(false);
        setLiveStreamModalOpen(true);
      }
    } catch (e) {
      console.warn("Direct room join error:", e);
    }
  };

  // 1. FIND LIVE OPPONENT (Matchmaking Queue on Backend)
  const handleFindLiveOpponent = async () => {
    tapFeedback();
    audio.playBeastClick();
    setIsSearchingQueue(true);
    setQueueSearchSeconds(0);
    setQueueSearchFailed(false);
    setQueueStatusMessage("Entering global match queue...");

    const athleteName = localStorage.getItem("apex_user_name") || "You (Athlete)";

    try {
      const res = await fetch(apiUrl("/api/duel/queue/join"), {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          user: {
            id: `user_${Date.now()}`,
            name: athleteName,
            avatar: "/assets/coaches/coach-beast-male.jpg",
            reps: 0,
            ready: true,
          },
          exerciseName: selectedDiscipline.name,
          format: duelFormat,
          targetValue,
        }),
      });

      const data = await res.json();

      if (data.status === "matched") {
        // Matched immediately with someone in queue!
        handleMatchSuccess(data.opponent, data.room);
        return;
      }

      const ticketId = data.ticketId;
      setActiveTicketId(ticketId);

      // Start search timer
      let seconds = 0;
      searchPollTimerRef.current = setInterval(async () => {
        seconds += 1;
        setQueueSearchSeconds(seconds);

        if (seconds >= 8) {
          // Honest empty queue check
          clearInterval(searchPollTimerRef.current);
          setIsSearchingQueue(false);
          setQueueSearchFailed(true);
          // Cancel ticket
          fetch(apiUrl("/api/duel/queue/leave"), {
            method: "POST",
            headers: apiHeaders(),
            body: JSON.stringify({ ticketId }),
          }).catch(() => {});
          return;
        }

        // Poll for real match
        try {
          const pollRes = await fetch(apiUrl(`/api/duel/queue/poll/${ticketId}`));
          const pollData = await pollRes.json();
          if (pollData.status === "matched") {
            clearInterval(searchPollTimerRef.current);
            handleMatchSuccess(pollData.opponent, pollData.room);
          }
        } catch {}
      }, 1000);
    } catch (e) {
      setIsSearchingQueue(false);
      setQueueSearchFailed(true);
    }
  };

  const cancelQueueSearch = () => {
    tapFeedback();
    if (searchPollTimerRef.current) {
      clearInterval(searchPollTimerRef.current);
      searchPollTimerRef.current = null;
    }
    if (activeTicketId) {
      fetch(apiUrl("/api/duel/queue/leave"), {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ ticketId: activeTicketId }),
      }).catch(() => {});
    }
    setIsSearchingQueue(false);
    setQueueSearchFailed(false);
  };

  const handleMatchSuccess = (opponent: any, room: any) => {
    setIsSearchingQueue(false);
    setMatchedOpponent({
      id: opponent?.id || "rival_live",
      name: opponent?.name || "Live Opponent",
      handle: `@${(opponent?.name || "athlete").toLowerCase().replace(/\s+/g, "_")}`,
      avatar: opponent?.avatar || "/assets/coaches/coach-upper-male.jpg",
      ratingElo: 1520,
      tier: "Contender",
      streamVideoUrl: room?.videoDemoUrl || selectedDiscipline.videoUrl,
      specialtyExercise: selectedDiscipline.name,
      targetMuscle: selectedDiscipline.targetMuscle,
      scientificMetric: `${targetValue} ${duelFormat === "time_blitz" ? "Seconds" : "Reps"}`,
      biologicalMechanism: selectedDiscipline.cue,
    });
    setIsSoloPracticeMode(false);
    setLiveStreamModalOpen(true);
    celebrateFeedback();
  };

  // 2. SHARE CHALLENGE LINK VIA SOCIAL MEDIA / CHAT
  const handleCreateShareableChallenge = async () => {
    tapFeedback();
    audio.playBeastClick();
    const athleteName = localStorage.getItem("apex_user_name") || "Apex Athlete";

    try {
      const res = await fetch(apiUrl("/api/duel/room/create"), {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          host: {
            id: `host_${Date.now()}`,
            name: athleteName,
            avatar: "/assets/coaches/coach-beast-male.jpg",
            reps: 0,
            ready: true,
          },
          exerciseName: selectedDiscipline.name,
          format: duelFormat,
          targetValue,
          timeSeconds: duelFormat === "time_blitz" ? targetValue : 60,
          targetReps: duelFormat === "rep_race" ? targetValue : 30,
        }),
      });

      const data = await res.json();
      if (data.ok && data.roomId) {
        setCreatedRoomId(data.roomId);
        setIsWaitingForFriend(true);

        const shareUrl = `${window.location.origin}/?duelRoom=${data.roomId}`;
        const shareText = `⚔️ LIVE 1v1 FITNESS DUEL: I challenge you to "${selectedDiscipline.name}" (${targetValue} ${
          duelFormat === "time_blitz" ? "seconds blitz" : "reps race"
        }) on Kinetic Fitness! Accept and camera-track your reps here: ${shareUrl}`;

        if (navigator.share) {
          try {
            await navigator.share({
              title: "Kinetic Fitness Live Duel Challenge",
              text: shareText,
              url: shareUrl,
            });
          } catch {}
        } else {
          navigator.clipboard?.writeText(shareUrl);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
        }

        // Poll room to detect when friend opens link and joins
        friendPollTimerRef.current = setInterval(async () => {
          try {
            const check = await fetch(apiUrl(`/api/duel/room/${data.roomId}`));
            const roomData = await check.json();
            if (roomData.status === "active" && roomData.guest) {
              clearInterval(friendPollTimerRef.current);
              setIsWaitingForFriend(false);
              handleMatchSuccess(roomData.guest, roomData);
            }
          } catch {}
        }, 1500);
      }
    } catch (e) {
      console.error("Room creation error:", e);
    }
  };

  const cancelWaitingForFriend = () => {
    tapFeedback();
    if (friendPollTimerRef.current) {
      clearInterval(friendPollTimerRef.current);
      friendPollTimerRef.current = null;
    }
    setIsWaitingForFriend(false);
    setCreatedRoomId(null);
  };

  // 3. SOLO CAMERA TRIAL
  const handleStartSoloTrial = () => {
    tapFeedback();
    cancelQueueSearch();
    setIsSoloPracticeMode(true);
    setMatchedOpponent(null);
    setLiveStreamModalOpen(true);
  };

  // 4. MASTER COACH CHALLENGE
  const handleChallengeCoach = (coach: Creator) => {
    tapFeedback();
    const demoVideo =
      coach.specialtyExercise === "Jump Squats"
        ? "/videos/jumpsquat.mp4"
        : coach.specialtyExercise === "Diamond Push-ups"
        ? "/videos/Diamond Push-ups.mp4"
        : coach.specialtyExercise === "Mountain Climbers"
        ? "/videos/Mountain Climbers.mp4"
        : "/videos/Classic pushup.mp4";

    setMatchedOpponent({
      id: coach.id,
      name: coach.name,
      handle: coach.handle,
      avatar: coach.avatar,
      ratingElo: coach.ratingElo,
      tier: coach.tier,
      streamVideoUrl: demoVideo,
      specialtyExercise: coach.specialtyExercise,
      targetMuscle: coach.targetMuscle,
      scientificMetric: "Strict Master Form Drill",
      biologicalMechanism: coach.scientificFocus,
    });
    setIsSoloPracticeMode(false);
    setLiveStreamModalOpen(true);
  };

  const handleMatchComplete = (result: { won: boolean; userReps: number; opponentReps: number; eloGain: number }) => {
    const nextElo = Math.max(800, athleteElo + result.eloGain);
    const nextWins = result.won ? duelWins + 1 : duelWins;

    setAthleteElo(nextElo);
    setDuelWins(nextWins);

    localStorage.setItem("kinetic_athlete_elo", nextElo.toString());
    localStorage.setItem("kinetic_beast_wins", nextWins.toString());

    if (onLogWorkout) {
      onLogWorkout({
        id: `duel-${Date.now()}`,
        workoutTitle: `Live 1v1 Arena: ${selectedDiscipline.name}`,
        date: new Date().toISOString(),
        durationMinutes: 1,
        caloriesBurned: Math.round(result.userReps * 3.8),
        feeling: result.won ? "Victor" : "Challenged",
        exercisesCompleted: 1,
      });
    }
  };

  const getRankBadge = () => {
    if (duelWins === 0 && athleteElo <= 1000) return { title: "Placement", color: "#94a3b8", icon: "🎯" };
    if (athleteElo >= 2000) return { title: "Grandmaster", color: "#ec4899", icon: "👑" };
    if (athleteElo >= 1700) return { title: "Diamond", color: "#f59e0b", icon: "💎" };
    if (athleteElo >= 1300) return { title: "Warrior", color: "#06b6d4", icon: "🛡️" };
    return { title: "Contender", color: "#10b981", icon: "⚡" };
  };

  const rankBadge = getRankBadge();

  return (
    <div className="relative min-h-[90vh] pb-28 text-white max-w-md mx-auto select-none animate-fade-in px-1">
      {/* -------------------- 1. CLEAN TOP APP BAR -------------------- */}
      <div className="flex items-center justify-between py-2 px-3 sticky top-0 z-20 backdrop-blur-xl bg-black/80 border-b border-white/10 rounded-b-2xl">
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            onBack();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white active:scale-95 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider text-white">Live Arena</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setChatTargetFriendId(null);
              setChatHubOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-cyan-500 hover:text-slate-950 border border-white/15 text-xs font-bold text-white transition active:scale-95"
            title="Friends & Messages"
          >
            <MessageCircle className="h-3.5 w-3.5 text-cyan-400" />
            <span>Chat</span>
          </button>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 border border-white/15 text-white/90">
            <span>{rankBadge.icon}</span>
            <span>{athleteElo > 0 ? `${athleteElo} ELO` : `${duelWins} Wins`}</span>
          </div>
        </div>
      </div>

      {/* -------------------- 2. MAIN SEGMENT TABS -------------------- */}
      <div className="px-3 pt-3">
        <div className="grid grid-cols-3 p-1 rounded-2xl bg-white/[0.06] border border-white/10 text-xs font-black">
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setActiveTab("challenge");
            }}
            className={`py-2 rounded-xl transition ${
              activeTab === "challenge"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            ⚔️ Custom Match
          </button>

          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setActiveTab("creators");
            }}
            className={`py-2 rounded-xl transition ${
              activeTab === "creators"
                ? "bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            👑 Coaches
          </button>

          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setActiveTab("ladder");
            }}
            className={`py-2 rounded-xl transition ${
              activeTab === "ladder"
                ? "bg-white/20 text-white shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            🏆 Leaderboard
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: CUSTOM MATCH CREATOR (CHESS.COM STYLE) ==================== */}
      {activeTab === "challenge" && (
        <div className="px-3 pt-3 space-y-4">
          
          {/* STEP 1: CHOOSE DISCIPLINE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400 px-1">
              <span>1. Select Movement</span>
              <span className="text-[11px] text-cyan-400 font-bold lowercase">
                {selectedDiscipline.name}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {EXERCISE_DISCIPLINES.map((disc) => {
                const isSelected = selectedDiscipline.id === disc.id;
                return (
                  <button
                    key={disc.id}
                    type="button"
                    onClick={() => handleDisciplineSelect(disc)}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-95 ${
                      isSelected
                        ? "bg-cyan-950/40 border-cyan-400 shadow-lg shadow-cyan-500/20"
                        : "bg-zinc-900/90 border-white/10 hover:border-white/25"
                    }`}
                  >
                    <span className="text-xl mb-1">{disc.icon}</span>
                    <div>
                      <p className="text-xs font-black text-white leading-tight">{disc.name}</p>
                      <p className="text-[9px] text-white/50 mt-0.5">{disc.targetMuscle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: DUEL FORMAT & TARGET */}
          <div className="space-y-2.5 rounded-3xl bg-zinc-900/90 border border-white/10 p-4 shadow-xl">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400">
              <span>2. Match Format</span>
              <span className="text-white text-[11px]">
                {duelFormat === "time_blitz" ? "⏱️ Time Limit" : "🏁 Target Reps"}
              </span>
            </div>

            {/* Format Toggle */}
            <div className="grid grid-cols-2 p-1 bg-black/60 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => handleFormatChange("time_blitz")}
                className={`py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  duelFormat === "time_blitz"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Timer className="h-3.5 w-3.5" />
                <span>Time Blitz</span>
              </button>

              <button
                type="button"
                onClick={() => handleFormatChange("rep_race")}
                className={`py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  duelFormat === "rep_race"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Trophy className="h-3.5 w-3.5" />
                <span>Rep Race</span>
              </button>
            </div>

            {/* Target Value Dial & Presets */}
            <div className="pt-1 space-y-3">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-bold text-white/70">
                  {duelFormat === "time_blitz" ? "Countdown Duration:" : "Target Reps Goal:"}
                </span>

                {/* Interactive Numeric Stepper */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustTarget(-1)}
                    className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-90 transition font-black"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>

                  <span className="font-mono text-lg font-black text-cyan-300 min-w-[60px] text-center">
                    {targetValue} {duelFormat === "time_blitz" ? "sec" : "reps"}
                  </span>

                  <button
                    type="button"
                    onClick={() => adjustTarget(1)}
                    className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-90 transition font-black"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Preset Chips */}
              <div className="grid grid-cols-4 gap-1.5">
                {(duelFormat === "time_blitz" ? [30, 45, 60, 90] : [20, 35, 50, 75]).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setTargetValue(val);
                    }}
                    className={`py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                      targetValue === val
                        ? "bg-white text-slate-950 font-black shadow-sm"
                        : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {val} {duelFormat === "time_blitz" ? "s" : "r"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 3: THE CHALLENGE CARD & ACTION BUTTONS */}
          <div className="rounded-3xl bg-gradient-to-b from-zinc-900 to-black border border-white/15 p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-cyan-400">
                  Ready to Battle
                </p>
                <h3 className="text-lg font-black text-white">{selectedDiscipline.name}</h3>
                <p className="text-xs text-white/60">
                  {duelFormat === "time_blitz" ? `${targetValue}s Max Rep Blitz` : `First to ${targetValue} Reps`} · AI Camera Validation
                </p>
              </div>

              <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-2xl">
                {selectedDiscipline.icon}
              </div>
            </div>

            {/* DUAL ACTION BUTTONS (Find Opponent vs Share Link) */}
            <div className="space-y-2 pt-1">
              {/* PRIMARY ACTION: FIND LIVE OPPONENT */}
              <button
                type="button"
                onClick={handleFindLiveOpponent}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 active:scale-95 transition hover:brightness-110"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                <span>⚡ Find Live Opponent</span>
              </button>

              {/* SECONDARY ACTION: SHARE CHALLENGE LINK */}
              <button
                type="button"
                onClick={handleCreateShareableChallenge}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition"
              >
                <Share2 className="h-4 w-4 text-cyan-300" />
                <span>🔗 Share Challenge Link (Social / Chat)</span>
              </button>
            </div>
          </div>

          {/* STEP 4: OPEN CHALLENGES LOBBY (LIKE CHESS.COM SEEKS) */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Open Athlete Challenges
              </span>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live Lobby
              </span>
            </div>

            {/* Standing Open Seeks */}
            <div className="space-y-2">
              {[
                {
                  id: "open_1",
                  name: "Marcus Vance",
                  exercise: "Classic Push-ups",
                  target: "35 Reps · 45s",
                  avatar: "/assets/coaches/coach-upper-male.jpg",
                  verified: true,
                },
                {
                  id: "open_2",
                  name: "Chloe Thorne",
                  exercise: "Jump Squats",
                  target: "30 Reps · Blitz",
                  avatar: "/assets/coaches/coach-female-flex.jpg",
                  verified: true,
                },
              ].map((open) => (
                <div
                  key={open.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 border border-white/10 hover:border-white/20 transition shadow-md"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={open.avatar}
                      alt={open.name}
                      className="h-10 w-10 rounded-full object-cover border border-white/20"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/assets/coaches/coach-beast-male.jpg";
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-white">{open.name}</span>
                        {open.verified && (
                          <CheckCircle2 className="h-3 w-3 fill-cyan-400 text-black" />
                        )}
                      </div>
                      <p className="text-[10px] text-cyan-300 font-bold">
                        {open.exercise} · {open.target}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const coach = creators.find((c) => c.name === open.name);
                      if (coach) handleChallengeCoach(coach);
                      else handleStartSoloTrial();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs active:scale-95 transition shadow-sm"
                  >
                    Accept & Duel
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: VERIFIED MASTER COACHES ==================== */}
      {activeTab === "creators" && (
        <div className="px-3 pt-3 space-y-3">
          <p className="text-xs text-white/60 px-1">
            Challenge master instructors on their signature benchmark movement with camera form validation.
          </p>

          <div className="space-y-2.5">
            {creators.map((c) => (
              <div
                key={c.id}
                className="rounded-3xl border border-white/15 bg-zinc-900/90 p-4 flex items-center justify-between gap-3 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={c.avatar}
                      alt={c.name}
                      className="h-12 w-12 rounded-2xl object-cover border border-white/20"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/assets/coaches/coach-beast-male.jpg";
                      }}
                    />
                    <div className="absolute -bottom-1 -right-1 bg-black/80 px-1 py-0.2 rounded text-[8px] font-black text-amber-400 border border-amber-400/30">
                      {c.ratingElo}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1">
                      <h3 className="text-xs font-black text-white">{c.name}</h3>
                      <CheckCircle2 className="h-3 w-3 fill-cyan-400 text-black" />
                    </div>
                    <p className="text-[11px] text-amber-300 font-bold">{c.specialtyExercise}</p>
                    <p className="text-[10px] text-white/50 max-w-[170px] truncate">{c.scientificFocus}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setChatTargetFriendId(c.id);
                      setChatHubOpen(true);
                    }}
                    className="p-2 rounded-xl bg-white/10 hover:bg-cyan-500 hover:text-slate-950 text-white transition active:scale-95 border border-white/10"
                    title={`Chat with ${c.name}`}
                  >
                    <MessageCircle className="h-4 w-4 text-cyan-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChallengeCoach(c)}
                    className="px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 shadow-md active:scale-95 transition flex items-center gap-1"
                  >
                    <Swords className="h-3.5 w-3.5 fill-slate-950" />
                    <span>Duel</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: LADDER / LEADERBOARD ==================== */}
      {activeTab === "ladder" && (
        <div className="px-3 pt-3 space-y-3">
          <div className="rounded-2xl bg-zinc-900/90 border border-white/10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-xl">
                {rankBadge.icon}
              </div>
              <div>
                <h4 className="text-xs font-black text-white">Your Global Ranking</h4>
                <p className="text-[10px] text-cyan-300 font-bold">
                  {athleteElo > 0 ? `${athleteElo} ELO` : "Novice Placement"} · {duelWins} Victories
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleStartSoloTrial}
              className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-black text-white hover:bg-white/20 active:scale-95 transition"
            >
              Test Form
            </button>
          </div>

          <div className="space-y-2">
            {[
              { rank: 1, name: "Marcus Vance", elo: 1600, badge: "Master", icon: "👑" },
              { rank: 2, name: "Chloe Thorne", elo: 1600, badge: "Master", icon: "👑" },
              { rank: 3, name: "Viktor Steele", elo: 1600, badge: "Master", icon: "👑" },
              { rank: 4, name: "Elena Rostova", elo: 1600, badge: "Master", icon: "👑" },
              { rank: 5, name: "You (Athlete)", elo: athleteElo || 1000, badge: rankBadge.title, icon: rankBadge.icon },
            ].map((row) => (
              <div
                key={row.name}
                className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                  row.name.startsWith("You")
                    ? "bg-cyan-950/40 border-cyan-400 shadow-md"
                    : "bg-zinc-900/70 border-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-xs text-white/50 w-4 text-center">
                    #{row.rank}
                  </span>
                  <div>
                    <p className="text-xs font-black text-white flex items-center gap-1">
                      <span>{row.icon}</span>
                      <span>{row.name}</span>
                    </p>
                    <p className="text-[10px] text-white/40">{row.badge}</p>
                  </div>
                </div>
                <span className="font-mono text-xs font-black text-cyan-300">{row.elo} ELO</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== POPUP: MATCHMAKING SEARCH RADAR ==================== */}
      <AnimatePresence>
        {isSearchingQueue && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4"
          >
            <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-cyan-400/40 p-6 text-center space-y-4 shadow-2xl">
              {/* Radar Animation Ring */}
              <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
                <span className="absolute h-full w-full rounded-full bg-cyan-500/20 animate-ping" />
                <span className="absolute h-16 w-16 rounded-full bg-cyan-500/40 animate-pulse" />
                <div className="relative h-12 w-12 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/50">
                  <Radio className="h-6 w-6 animate-spin" />
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                  Live Matchmaker
                </span>
                <h3 className="text-base font-black text-white mt-1">
                  Searching for Athlete...
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Matching on: {selectedDiscipline.name} · {targetValue} {duelFormat === "time_blitz" ? "sec" : "reps"}
                </p>
                <p className="font-mono text-xs text-amber-400 font-bold mt-2">
                  00:{queueSearchSeconds.toString().padStart(2, "0")}
                </p>
              </div>

              <button
                type="button"
                onClick={cancelQueueSearch}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition active:scale-95"
              >
                Cancel Search
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== POPUP: NO OPPONENT FOUND (HONEST EMPTY STATE) ==================== */}
      <AnimatePresence>
        {queueSearchFailed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4"
          >
            <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-white/15 p-6 text-center space-y-4 shadow-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                <span>0 Other Athletes in Queue</span>
              </div>

              <div>
                <h3 className="text-base font-black text-white">No Opponents in Queue Right Now</h3>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  No other athlete is searching for this exact challenge right now. You can invite a friend via link, or test yourself with the AI camera rep counter!
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreateShareableChallenge}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider transition active:scale-95 shadow-md"
                >
                  <Share2 className="h-4 w-4" />
                  <span>Share Challenge Link with Friend</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartSoloTrial}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-black text-xs uppercase tracking-wider transition active:scale-95"
                >
                  <Camera className="h-4 w-4 text-cyan-400" />
                  <span>Start Solo Camera Rep Trial</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQueueSearchFailed(false)}
                  className="w-full py-1 text-xs text-white/40 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== POPUP: WAITING FOR FRIEND TO JOIN LINK ==================== */}
      <AnimatePresence>
        {isWaitingForFriend && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4"
          >
            <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-amber-400/40 p-6 text-center space-y-4 shadow-2xl">
              <div className="h-16 w-16 mx-auto rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                <Share2 className="h-7 w-7 animate-pulse" />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  Custom Challenge Room Active
                </span>
                <h3 className="text-base font-black text-white mt-1">
                  Waiting for Friend to Join...
                </h3>
                <p className="text-xs text-white/60 mt-1">
                  Send the invite link to anyone on WhatsApp, Instagram, or Messages. As soon as they tap the link, the camera duel begins!
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    const shareUrl = `${window.location.origin}/?duelRoom=${createdRoomId}`;
                    navigator.clipboard?.writeText(shareUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2400);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition active:scale-95"
                >
                  {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedLink ? "✓ Link Copied to Clipboard!" : "Copy Challenge Link Again"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartSoloTrial}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider transition active:scale-95"
                >
                  <Camera className="h-4 w-4" />
                  <span>Start Solo Practice While Waiting</span>
                </button>

                <button
                  type="button"
                  onClick={cancelWaitingForFriend}
                  className="w-full py-1 text-xs text-white/40 hover:text-white"
                >
                  Cancel Room
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== LIVE CAMERA DUEL STREAM MODAL ==================== */}
      {liveStreamModalOpen && (
        <LiveStreamDuelModal
          isOpen={liveStreamModalOpen}
          onClose={() => {
            setLiveStreamModalOpen(false);
            setIsSoloPracticeMode(false);
          }}
          opponent={matchedOpponent}
          isSoloPractice={isSoloPracticeMode}
          targetReps={duelFormat === "rep_race" ? targetValue : 25}
          exerciseName={selectedDiscipline.name}
          durationSeconds={duelFormat === "time_blitz" ? targetValue : 60}
          onMatchComplete={handleMatchComplete}
        />
      )}

      {/* ==================== FRIENDS & DIRECT CHAT HUB ==================== */}
      <FriendsAndChatHub
        isOpen={chatHubOpen}
        onClose={() => setChatHubOpen(false)}
        initialChatFriendId={chatTargetFriendId}
        onChallengeFriend={(friend) => {
          setChatHubOpen(false);
          const creatorMatch = creators.find((c) => c.id === friend.id);
          if (creatorMatch) {
            handleChallengeCoach(creatorMatch);
          } else {
            handleStartSoloTrial();
          }
        }}
      />
    </div>
  );
}
