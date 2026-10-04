import { useState } from "react";
import {
  X,
  CheckCircle2,
  Share2,
  Swords,
  Play,
  Film,
  Archive,
  Eye,
  Calendar,
  Zap,
  MessageCircle,
} from "lucide-react";
import {
  Creator,
  CreatorReel,
  getReelsForCreator,
  isFollowingCreator,
  toggleFollowCreator,
} from "../lib/socialFeed";
import { tapFeedback } from "../lib/haptics";

interface CreatorProfileModalProps {
  creator: Creator;
  onClose: () => void;
  onStartLiveChallenge: (creator: Creator, reel?: CreatorReel) => void;
  onSelectReel?: (reel: CreatorReel) => void;
  onOpenChat?: (creatorId: string) => void;
}

export default function CreatorProfileModal({
  creator,
  onClose,
  onStartLiveChallenge,
  onSelectReel,
  onOpenChat,
}: CreatorProfileModalProps) {
  const [isFollowing, setIsFollowing] = useState(() => isFollowingCreator(creator.id));
  const [activeTab, setActiveTab] = useState<"new" | "old">("new");
  const [previewReel, setPreviewReel] = useState<CreatorReel | null>(null);

  const { newReels, oldReels } = getReelsForCreator(creator.id);
  const displayFollowers = creator.followers + (isFollowing ? 1 : 0);

  const handleFollowToggle = () => {
    tapFeedback();
    const next = toggleFollowCreator(creator.id);
    setIsFollowing(next);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-fade-in select-none">
      <div className="relative h-full w-full max-w-[480px] bg-zinc-950 flex flex-col justify-between overflow-hidden sm:rounded-[36px] border sm:border-white/15 shadow-2xl">
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/60 backdrop-blur sticky top-0 z-20">
          <button
            onClick={() => {
              tapFeedback();
              onClose();
            }}
            className="p-1.5 rounded-full bg-white/10 text-white/80 hover:text-white"
            aria-label="Back"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-white">{creator.handle}</span>
            {creator.verified && (
              <CheckCircle2 className="h-4 w-4 fill-cyan-400 text-black" />
            )}
          </div>
          <button
            onClick={() => {
              tapFeedback();
              if (navigator.share) {
                navigator.share({
                  title: `${creator.name} on Kinetic Fitness`,
                  url: window.location.href,
                }).catch(() => {});
              }
            }}
            className="p-1.5 rounded-full bg-white/10 text-white/80 hover:text-white"
            aria-label="Share creator profile"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Profile Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* Header Stats Block */}
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              {/* Avatar with Story Glow */}
              <div className="relative shrink-0">
                <div className="h-20 w-20 rounded-full p-[2.5px] bg-gradient-to-tr from-cyan-400 via-amber-400 to-rose-500 shadow-lg">
                  <div className="h-full w-full rounded-full overflow-hidden bg-black border-2 border-black">
                    <img
                      src={creator.avatar}
                      alt={creator.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/assets/coaches/coach-beast-male.jpg";
                      }}
                    />
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[9px] font-black text-cyan-300 border border-cyan-400/40 backdrop-blur">
                  {creator.ratingElo} ELO
                </div>
              </div>

              {/* 3 Metric Columns */}
              <div className="flex-1 flex justify-around items-center text-center">
                <div>
                  <p className="text-base font-black text-white">{newReels.length + oldReels.length}</p>
                  <p className="text-[10px] uppercase font-bold text-white/50">Reels</p>
                </div>
                <div>
                  <p className="text-base font-black text-white">{formatNumber(displayFollowers)}</p>
                  <p className="text-[10px] uppercase font-bold text-white/50">Followers</p>
                </div>
                <div>
                  <p className="text-base font-black text-white">{creator.following}</p>
                  <p className="text-[10px] uppercase font-bold text-white/50">Following</p>
                </div>
              </div>
            </div>

            {/* Bio & Details */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">{creator.name}</h2>
                <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-black text-cyan-300">
                  {creator.tier}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                {creator.bio}
              </p>

              {/* Specialty & Biomechanics Card */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 mt-2 space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] font-black uppercase tracking-wider">
                  <Zap className="h-3 w-3" /> Signature Specialty: {creator.specialtyExercise}
                </div>
                <p className="text-[11px] text-white/80 font-medium">
                  Target: {creator.targetMuscle}
                </p>
                <p className="text-[10px] text-white/50 font-normal leading-normal">
                  🧬 {creator.scientificFocus}
                </p>
              </div>
            </div>

            {/* Action Buttons: Follow + Message + LIVE 1V1 CHALLENGE */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-black transition active:scale-95 ${
                    isFollowing
                      ? "bg-white/10 border border-white/20 text-white"
                      : "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 hover:bg-cyan-400"
                  }`}
                >
                  {isFollowing ? "Following" : "+ Follow"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    if (onOpenChat) onOpenChat(creator.id);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-black bg-white/10 border border-white/15 text-white hover:bg-white/20 active:scale-95 transition"
                >
                  <MessageCircle className="h-4 w-4 text-cyan-400" />
                  <span>Message</span>
                </button>
              </div>

              {/* LIVE CHALLENGE BUTTON */}
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  onStartLiveChallenge(creator, newReels[0]);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black bg-gradient-to-r from-amber-400 via-rose-500 to-amber-500 text-slate-950 shadow-lg shadow-rose-500/25 active:scale-95 transition hover:brightness-110 uppercase tracking-wider"
              >
                <Swords className="h-4 w-4 fill-slate-950" />
                <span>⚡ Live 1v1 Camera Challenge</span>
              </button>
            </div>
          </div>

          {/* Reels Tabs (Latest Reels vs Vault Old Reels) */}
          <div className="border-t border-white/10 mt-2">
            <div className="flex border-b border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab("new")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black border-b-2 transition ${
                  activeTab === "new"
                    ? "border-cyan-400 text-cyan-400"
                    : "border-transparent text-white/50 hover:text-white"
                }`}
              >
                <Film className="h-4 w-4" />
                <span>Latest Reels ({newReels.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("old")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black border-b-2 transition ${
                  activeTab === "old"
                    ? "border-amber-400 text-amber-400"
                    : "border-transparent text-white/50 hover:text-white"
                }`}
              >
                <Archive className="h-4 w-4" />
                <span>Vault ({oldReels.length})</span>
              </button>
            </div>

            {/* Reels Grid (3 columns, 9:16 aspect preview) */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-black">
              {(activeTab === "new" ? newReels : oldReels).map((reel) => (
                <div
                  key={reel.id}
                  onClick={() => {
                    tapFeedback();
                    if (onSelectReel) {
                      onSelectReel(reel);
                    } else {
                      setPreviewReel(reel);
                    }
                  }}
                  className="group relative aspect-[9/14] bg-zinc-900 rounded-lg overflow-hidden cursor-pointer"
                >
                  {reel.type === "video" ? (
                    <video
                      src={reel.mediaUrl}
                      preload="metadata"
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={reel.mediaUrl}
                      alt=""
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  )}

                  {/* Top-Right Badge */}
                  <div className="absolute top-1 right-1 z-10">
                    <div className="h-4 w-4 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white">
                      <Play className="h-2.5 w-2.5 fill-current" />
                    </div>
                  </div>

                  {/* Bottom Stats & Publish Date Overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end text-[9px] text-white">
                    <div className="flex items-center gap-1 font-bold">
                      <Eye className="h-2.5 w-2.5" />
                      <span>{reel.views}</span>
                    </div>
                    <div className="text-[8px] text-white/70 truncate flex items-center gap-0.5 mt-0.5">
                      <Calendar className="h-2 w-2 shrink-0" />
                      <span className="truncate">{reel.publishedDate.split("·")[0].trim()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reel Fullscreen Preview Modal if clicked */}
        {previewReel && (
          <div
            className="absolute inset-0 z-30 bg-black flex flex-col justify-between"
            onClick={() => setPreviewReel(null)}
          >
            <div className="relative flex-1 flex items-center justify-center bg-black">
              {previewReel.type === "video" ? (
                <video
                  src={previewReel.mediaUrl}
                  autoPlay
                  loop
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : (
                <img
                  src={previewReel.mediaUrl}
                  alt=""
                  className="h-full w-full object-contain"
                />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewReel(null);
                }}
                className="absolute top-4 left-4 p-2 rounded-full bg-black/60 text-white z-40 backdrop-blur"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Challenge CTA at bottom */}
            <div className="p-4 bg-zinc-950 border-t border-white/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-white">{previewReel.caption}</p>
                <p className="text-[10px] text-cyan-300 mt-0.5">
                  Published: {previewReel.publishedDate}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartLiveChallenge(creator, previewReel);
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 shadow-md active:scale-95"
              >
                <Swords className="h-3.5 w-3.5 fill-slate-950" />
                Challenge
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
