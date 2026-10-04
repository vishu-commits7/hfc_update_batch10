import { useState, useEffect, useRef } from "react";
import {
  Heart,
  Share2,
  Camera,
  MessageCircle,
  Music,
  Swords,
  CheckCircle2,
  Calendar,
  Eye,
} from "lucide-react";
import { MOTIVATION_STORIES } from "./GymBeastMotivationReel";
import ReelCreatorStudio, { type UserReel } from "./ReelCreatorStudio";
import ReelCommentsDrawer from "./ReelCommentsDrawer";
import CreatorProfileModal from "./CreatorProfileModal";
import LiveStreamDuelModal from "./LiveStreamDuelModal";
import FriendsAndChatHub from "./FriendsAndChatHub";
import {
  getAllFeedReels,
  getCreatorById,
  getFollowingCreatorIds,
  toggleFollowCreator,
  getCommentsForReel,
  getLikedReelIds,
  toggleLikeReel,
  Creator,
  CreatorReel,
} from "../lib/socialFeed";
import { tapFeedback } from "../lib/haptics";

interface ReelsFeedViewProps {
  onOpenStoryReel: (index: number) => void;
}

function AutoPlayViewportVideo({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoRef.current?.play().catch(() => {});
        } else {
          videoRef.current?.pause();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      <video
        ref={videoRef}
        src={src}
        loop
        playsInline
        muted
        preload="metadata"
        className={className}
      />
    </div>
  );
}

export default function ReelsFeedView({ onOpenStoryReel }: ReelsFeedViewProps) {
  const [reelStudioOpen, setReelStudioOpen] = useState(false);
  const [userReels, setUserReels] = useState<UserReel[]>([]);
  const [likedReelIds, setLikedReelIds] = useState<Set<string>>(() => getLikedReelIds());
  const [followingIds, setFollowingIds] = useState<Set<string>>(() => getFollowingCreatorIds());

  // Interactive drawer/modal states
  const [activeCommentsReelId, setActiveCommentsReelId] = useState<string | null>(null);
  const [activeCreatorProfile, setActiveCreatorProfile] = useState<Creator | null>(null);
  const [chatHubOpen, setChatHubOpen] = useState(false);
  const [chatTargetFriendId, setChatTargetFriendId] = useState<string | null>(null);
  const [liveChallengeOpponent, setLiveChallengeOpponent] = useState<{
    creator: Creator;
    reel?: CreatorReel;
  } | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("apex_user_reels") || "[]");
      if (Array.isArray(saved) && saved.length > 0) {
        setUserReels(saved);
      }
    } catch {
      setUserReels([]);
    }
  }, []);

  const handleReelPublished = (reel: UserReel) => {
    setUserReels((prev) => [reel, ...prev]);
  };

  const toggleLike = (id: string) => {
    tapFeedback();
    const nextState = toggleLikeReel(id);
    setLikedReelIds((prev) => {
      const next = new Set(prev);
      if (nextState) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleToggleFollow = (creatorId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    tapFeedback();
    const next = toggleFollowCreator(creatorId);
    setFollowingIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(creatorId);
      else copy.delete(creatorId);
      return copy;
    });
  };

  const feedReels = getAllFeedReels();

  return (
    <div className="w-full space-y-4 pb-28 text-slate-100 animate-fade-in select-none">
      {/* ----------------- TOP APP BAR ----------------- */}
      <div className="flex items-center justify-between py-1 px-1">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
            Reels
          </h1>
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              tapFeedback();
              setChatTargetFriendId(null);
              setChatHubOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/10 px-3 py-1.5 text-xs font-bold active:scale-95 transition"
            title="Friends & Messages"
          >
            <MessageCircle className="h-3.5 w-3.5 text-cyan-400" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => {
              tapFeedback();
              setReelStudioOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-3 py-1.5 text-xs font-black active:scale-95 transition shadow-md shadow-cyan-500/20"
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* ----------------- SAVAGE STORY BUBBLES TRAY ----------------- */}
      <div className="px-1">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          {MOTIVATION_STORIES.map((story, idx) => (
            <div
              key={story.id}
              onClick={() => {
                tapFeedback();
                onOpenStoryReel(idx);
              }}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
            >
              <div className="h-16 w-16 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-rose-500 to-cyan-500 shadow-md">
                <div className="h-full w-full rounded-full overflow-hidden bg-black border-2 border-black">
                  <img
                    src={story.image}
                    alt={story.title}
                    className="h-full w-full object-cover group-hover:scale-110 transition duration-300"
                  />
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-300 max-w-[64px] truncate text-center">
                {story.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ----------------- VERTICAL REELS FEED ----------------- */}
      <div className="space-y-6 pt-1">
        {/* User Created Reels (if any) */}
        {userReels.map((reel) => {
          const isLiked = likedReelIds.has(reel.id);
          const displayLikes = (reel.likes || 12) + (isLiked ? 1 : 0);
          const comments = getCommentsForReel(reel.id);

          return (
            <div
              key={reel.id}
              className="relative aspect-[9/14] w-full rounded-[28px] overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl"
            >
              {reel.type === "video" ? (
                <AutoPlayViewportVideo
                  src={reel.mediaUrl}
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={reel.mediaUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 pointer-events-none" />

              <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                <span className="rounded-lg bg-black/60 border border-white/20 px-2 py-0.5 text-[9px] font-black uppercase text-cyan-300 backdrop-blur-md">
                  {reel.badge || "YOU · ORIGINAL"}
                </span>
                <span className="text-[9px] text-white/60 bg-black/50 px-2 py-0.5 rounded-md backdrop-blur">
                  Just now
                </span>
              </div>

              {/* Right Side Interaction Stack */}
              <div className="absolute right-3 bottom-16 flex flex-col items-center gap-4 z-20">
                <button
                  onClick={() => toggleLike(reel.id)}
                  className="flex flex-col items-center gap-1 text-white active:scale-125 transition"
                  title="Like"
                >
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center backdrop-blur-md ${
                      isLiked ? "bg-rose-500 text-white" : "bg-black/40 text-white"
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
                  </div>
                  <span className="text-[10px] font-black">{displayLikes}</span>
                </button>

                <button
                  onClick={() => {
                    tapFeedback();
                    setActiveCommentsReelId(reel.id);
                  }}
                  className="flex flex-col items-center gap-1 text-white active:scale-95 transition"
                  title="Comments"
                >
                  <div className="h-10 w-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md text-white">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-black">{comments.length}</span>
                </button>

                <button
                  onClick={() => {
                    tapFeedback();
                    if (navigator.share) {
                      navigator.share({
                        title: "Apex Workout Reel",
                        text: reel.caption,
                        url: window.location.href,
                      }).catch(() => {});
                    }
                  }}
                  className="flex flex-col items-center gap-1 text-white active:scale-95 transition"
                  title="Share"
                >
                  <div className="h-10 w-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md text-white">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-black">Share</span>
                </button>
              </div>

              <div className="absolute bottom-3 left-3 right-16 z-20 space-y-1.5 text-white">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full overflow-hidden bg-cyan-900 border border-white/40 flex items-center justify-center text-[10px] font-black text-cyan-200">
                    A
                  </div>
                  <span className="text-xs font-black drop-shadow">You (Apex Athlete)</span>
                </div>
                <p className="text-xs font-semibold leading-snug line-clamp-2 drop-shadow">
                  {reel.caption}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-medium pt-0.5">
                  <Music className="h-3 w-3 animate-spin" />
                  <span className="truncate">{reel.musicTrack || "Original Audio"}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Curated Pro Creators Feed */}
        {feedReels.map((reel) => {
          const creator = getCreatorById(reel.creatorId);
          const isLiked = likedReelIds.has(reel.id);
          const displayLikes = reel.likes + (isLiked ? 1 : 0);
          const isFollowing = creator ? followingIds.has(creator.id) : false;
          const comments = getCommentsForReel(reel.id);

          return (
            <div
              key={reel.id}
              className="relative aspect-[9/14] w-full rounded-[28px] overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl"
            >
              {reel.type === "video" ? (
                <AutoPlayViewportVideo
                  src={reel.mediaUrl}
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={reel.mediaUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}

              {/* Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/50 pointer-events-none" />

              {/* Top Header on Reel: Creator Info & Live Challenge Trigger */}
              <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between">
                <span className="rounded-lg bg-black/60 border border-white/20 px-2 py-0.5 text-[9px] font-black uppercase text-cyan-300 backdrop-blur-md">
                  {reel.badge}
                </span>

                {/* Direct 1v1 Live Challenge Button on Reel */}
                {creator && (
                  <button
                    onClick={() => {
                      tapFeedback();
                      setLiveChallengeOpponent({ creator, reel });
                    }}
                    className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 px-2.5 py-1 text-[10px] font-black shadow-lg shadow-rose-500/30 active:scale-95 transition hover:brightness-110"
                  >
                    <Swords className="h-3 w-3 fill-slate-950" />
                    <span>⚡ Live Challenge</span>
                  </button>
                )}
              </div>

              {/* Right Side Interaction Stack (Instagram Style) */}
              <div className="absolute right-3 bottom-16 flex flex-col items-center gap-4 z-20">
                {/* Like Button */}
                <button
                  onClick={() => toggleLike(reel.id)}
                  className="flex flex-col items-center gap-1 text-white active:scale-125 transition"
                  title="Like"
                >
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center backdrop-blur-md ${
                      isLiked ? "bg-rose-500 text-white" : "bg-black/40 text-white"
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
                  </div>
                  <span className="text-[10px] font-black">{displayLikes}</span>
                </button>

                {/* Comments Button (Opens Instagram-style Drawer) */}
                <button
                  onClick={() => {
                    tapFeedback();
                    setActiveCommentsReelId(reel.id);
                  }}
                  className="flex flex-col items-center gap-1 text-white active:scale-95 transition"
                  title="Comments"
                >
                  <div className="h-10 w-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md text-white">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-black">{comments.length}</span>
                </button>

                {/* Share Button */}
                <button
                  onClick={() => {
                    tapFeedback();
                    if (navigator.share) {
                      navigator.share({
                        title: `${creator?.name || "Apex"} Workout Reel`,
                        text: reel.caption,
                        url: window.location.href,
                      }).catch(() => {});
                    }
                  }}
                  className="flex flex-col items-center gap-1 text-white active:scale-95 transition"
                  title="Share"
                >
                  <div className="h-10 w-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md text-white">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-black">{reel.views}</span>
                </button>
              </div>

              {/* Bottom Caption, Creator, Date & Audio Tag */}
              <div className="absolute bottom-3 left-3 right-16 z-20 space-y-1.5 text-white">
                {/* Creator Avatar & Handle */}
                {creator && (
                  <div className="flex items-center gap-2">
                    <div
                      onClick={() => {
                        tapFeedback();
                        setActiveCreatorProfile(creator);
                      }}
                      className="cursor-pointer flex items-center gap-2 group"
                    >
                      <div className="h-7 w-7 rounded-full p-[1.5px] bg-gradient-to-tr from-cyan-400 to-amber-400 shadow-sm shrink-0">
                        <img
                          src={creator.avatar}
                          alt={creator.name}
                          className="h-full w-full rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/assets/coaches/coach-beast-male.jpg";
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black drop-shadow group-hover:text-cyan-300 transition">
                          {creator.handle}
                        </span>
                        {creator.verified && (
                          <CheckCircle2 className="h-3 w-3 fill-cyan-400 text-black shrink-0" />
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleToggleFollow(creator.id, e)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition active:scale-95 ${
                        isFollowing
                          ? "bg-white/10 border-white/20 text-white/70"
                          : "bg-cyan-500/20 border-cyan-400/40 text-cyan-300"
                      }`}
                    >
                      {isFollowing ? "Following" : "+ Follow"}
                    </button>
                  </div>
                )}

                {/* Caption */}
                <p className="text-xs font-semibold leading-snug line-clamp-2 drop-shadow">
                  {reel.caption}
                </p>

                {/* Publishing Date & View Count */}
                <div className="flex items-center gap-2 text-[10px] text-white/60 font-medium">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    <span>{reel.publishedDate}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Eye className="h-2.5 w-2.5" />
                    <span>{reel.views} views</span>
                  </div>
                </div>

                {/* Audio Track */}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-medium pt-0.5">
                  <Music className="h-3 w-3 animate-spin" />
                  <span className="truncate">{reel.musicTrack}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ----------------- COMMENTS BOTTOM DRAWER ----------------- */}
      {activeCommentsReelId && (
        <ReelCommentsDrawer
          isOpen={Boolean(activeCommentsReelId)}
          reelId={activeCommentsReelId}
          onClose={() => setActiveCommentsReelId(null)}
        />
      )}

      {/* ----------------- CREATOR PROFILE MODAL ----------------- */}
      {activeCreatorProfile && (
        <CreatorProfileModal
          creator={activeCreatorProfile}
          onClose={() => setActiveCreatorProfile(null)}
          onStartLiveChallenge={(creator, reel) => {
            setActiveCreatorProfile(null);
            setLiveChallengeOpponent({ creator, reel });
          }}
          onOpenChat={(creatorId) => {
            setActiveCreatorProfile(null);
            setChatTargetFriendId(creatorId);
            setChatHubOpen(true);
          }}
        />
      )}

      {/* ----------------- LIVE STREAM 1V1 BATTLE ARENA ----------------- */}
      {liveChallengeOpponent && (
        <LiveStreamDuelModal
          isOpen={Boolean(liveChallengeOpponent)}
          onClose={() => setLiveChallengeOpponent(null)}
          exerciseName={liveChallengeOpponent.reel?.exerciseChallenge.exerciseName || liveChallengeOpponent.creator.specialtyExercise}
          durationSeconds={liveChallengeOpponent.reel?.exerciseChallenge.timeLimitSeconds || 45}
          opponent={{
            id: liveChallengeOpponent.creator.id,
            name: liveChallengeOpponent.creator.name,
            handle: liveChallengeOpponent.creator.handle,
            avatar: liveChallengeOpponent.creator.avatar,
            ratingElo: liveChallengeOpponent.creator.ratingElo,
            tier: liveChallengeOpponent.creator.tier,
            streamVideoUrl: liveChallengeOpponent.reel?.mediaUrl || liveChallengeOpponent.reel?.exerciseChallenge.videoDemoUrl,
            specialtyExercise: liveChallengeOpponent.creator.specialtyExercise,
            targetMuscle: liveChallengeOpponent.creator.targetMuscle,
            scientificMetric: liveChallengeOpponent.reel?.exerciseChallenge.scientificMetric || liveChallengeOpponent.creator.scientificFocus,
            biologicalMechanism: liveChallengeOpponent.reel?.exerciseChallenge.biologicalMechanism || liveChallengeOpponent.creator.scientificFocus,
          }}
        />
      )}

      {/* Reel Creator Studio Modal */}
      {reelStudioOpen && (
        <ReelCreatorStudio
          onClose={() => setReelStudioOpen(false)}
          onReelPublished={handleReelPublished}
        />
      )}

      {/* Friends & Direct Chat Hub */}
      <FriendsAndChatHub
        isOpen={chatHubOpen}
        onClose={() => setChatHubOpen(false)}
        initialChatFriendId={chatTargetFriendId}
        onChallengeFriend={(friend) => {
          setChatHubOpen(false);
          const creator = getCreatorById(friend.id);
          if (creator) {
            setLiveChallengeOpponent({ creator });
          }
        }}
      />
    </div>
  );
}
