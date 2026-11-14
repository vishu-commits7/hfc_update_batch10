import OneTimeHint from "../../shared/OneTimeHint";
import { shareContent } from "../../core/nativeBridge";
import { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import {
  Film, Heart, Share2, Camera, MessageCircle, Music, Swords, CheckCircle2, Calendar, Eye, Search, Loader2, RotateCcw, Flag, Volume2, VolumeX,
} from "lucide-react";
import { MOTIVATION_STORIES } from "./GymBeastMotivationReel";
import ReelCreatorStudio from "./ReelCreatorStudio";
import ReelCommentsDrawer from "./ReelCommentsDrawer";
import CreatorProfileModal from "./CreatorProfileModal";
import FriendsAndChatHub from "../social/FriendsAndChatHub";
import PeopleSearch from "../social/PeopleSearch";
import PublicProfileSheet from "../social/PublicProfileSheet";
import Avatar from "../../shared/ui/Avatar";
import {
  getAllFeedReels, getCreatorById, getFollowingCreatorIds, toggleFollowCreator, isReelLiked, toggleLikeReel,
  type Creator,
} from "./socialFeed";
import { subscribeMyReelLike, setReelLike, recordReelView, requestFollow, cancelFollow } from "../social/social";
import ReportSheet, { type ReportTarget } from "../safety/ReportSheet";
import { useBlocked } from "../safety/blocks";
import { subscribeReelFeed, subscribeTrendingReels, loadReelMedia, deleteReel, type SharedReel } from "./reelsStore";
import { Caption, TagFeed } from "./ReelExtras";
import { EmptyState, EmptyAction, SkeletonRows } from "../../shared/ui/StateViews";
import { useProfiles } from "../social/useProfiles";
import { useMyIdentity, useFollowEdges } from "../social/useSocial";
import { challengeUser } from "../arena/challenge";
import { tapFeedback } from "../../core/haptics";

interface ReelsFeedViewProps {
  onOpenStoryReel: (index: number) => void;
  onOpenArena?: (roomCode?: string | null) => void;
  onSignIn?: () => void;
}

/* 1x1 transparent image: stops Android WebView from drawing its grey "play" glyph over a loading <video>. */
const BLANK_POSTER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Sound on or off for the whole feed, like Instagram: one tap on any reel switches it for every reel. */
let feedSound = false;
const soundSubs = new Set<(on: boolean) => void>();
function setFeedSound(on: boolean) { feedSound = on; soundSubs.forEach(f => f(on)); }
function useFeedSound(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(feedSound);
  useEffect(() => { soundSubs.add(setOn); return () => { soundSubs.delete(setOn); }; }, []);
  return [on, setFeedSound];
}

function ReelVideo({ src, loader, thumb }: { src?: string; loader?: () => Promise<string>; thumb?: string }) {
  const [sound, setSound] = useFeedSound();
  const [flash, setFlash] = useState(0); // shows the speaker icon for a moment after a tap
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!loader || !active || resolved) return;
    let alive = true;
    loader().then(u => { if (alive) setResolved(u); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [active, attempt, loader, resolved]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    // Only the reel you are looking at holds a decoder; others are unmounted.
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.5) setActive(true);
        else if (e.intersectionRatio < 0.15) { setActive(false); setReady(false); }
      },
      { threshold: [0, 0.15, 0.5, 0.75] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const url = useMemo(() => (src ? encodeURI(src) : resolved || ""), [src, resolved]);
  useEffect(() => { if (videoRef.current) videoRef.current.muted = !sound; }, [sound, ready]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(0), 700); return () => clearTimeout(t); }, [flash]);

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 overflow-hidden bg-carbon"
      onClick={() => { if (!ready) return; void tapFeedback(); setSound(!sound); setFlash(f => f + 1); }}
      role="button"
      aria-label={sound ? "Mute reels" : "Play reels with sound"}
    >
      {/* the reel's own still, softened, while the video loads: the screen is never an empty box */}
      {thumb && !ready && <img src={thumb} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover blur-md" />}
      {active && !failed && url && (
        <video
          key={attempt}
          ref={videoRef}
          src={url}
          poster={BLANK_POSTER}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          onLoadedData={() => { setReady(true); videoRef.current?.play().catch(() => {}); }}
          onPlaying={() => setReady(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {!ready && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-white/70" />
        </div>
      )}
      {flash > 0 && (
        <span key={flash} className="pointer-events-none absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white animate-fade-in">
          {sound ? <Volume2 className="h-7 w-7" /> : <VolumeX className="h-7 w-7" />}
        </span>
      )}
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm font-semibold text-ink-2">Video couldn't load</p>
          <button
            onClick={() => { setFailed(false); setReady(false); setAttempt(a => a + 1); }}
            className="flex items-center gap-1.5 rounded-full bg-graphite px-4 py-2 text-xs font-bold text-ink active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}
    </div>
  );
}

interface CardReel {
  id: string;
  type: "video" | "photo";
  mediaUrl: string;
  caption: string;
  badge: string;
  musicTrack: string;
  publishedDate?: string;
  views?: string;
  remote?: SharedReel;
}

const ReelCard = memo(function ReelCard({
  reel, creator, mine, onOpenComments, onOpenCreator, onOpenMyProfile, onChallenge, onOpenUser, onChallengeUser, onDeleted, onTag,
}: {
  onTag?: (tag: string) => void;
  reel: CardReel;
  creator?: Creator;
  mine?: boolean;
  commentsVersion: number;
  onOpenComments: (id: string) => void;
  onOpenCreator: (c: Creator) => void;
  onOpenMyProfile: () => void;
  onChallenge: () => void;
  onOpenUser?: (uid: string) => void;
  onChallengeUser?: (uid: string) => void;
  onDeleted?: () => void;
}) {
  const me = useMyIdentity();
  const edgesCard = useFollowEdges();
  const ownerUid = reel.remote?.ownerUid;
  const ownerProfiles = useProfiles(ownerUid ? [ownerUid] : []);
  const ownerProfile = ownerUid ? ownerProfiles.get(ownerUid) : null;
  const followState = ownerUid ? edgesCard.outgoing.get(ownerUid) : undefined;
  const isMineRemote = !!ownerUid && ownerUid === me.uid;
  const loadMedia = useCallback(() => loadReelMedia(reel.remote!), [reel.remote]);
  const [liked, setLiked] = useState(() => isReelLiked(reel.id));
  const [likeCount, setLikeCount] = useState(() => (reel.remote ? reel.remote.likeCount : isReelLiked(reel.id) ? 1 : 0));
  const commentCount = reel.remote ? reel.remote.commentCount : 0;
  const [reportOpen, setReportOpen] = useState<ReportTarget | null>(null);
  const [following, setFollowing] = useState(() => (creator ? getFollowingCreatorIds().has(creator.id) : false));

  // shared like total comes from the reel doc (server-maintained); my own like state is a tiny live listener
  useEffect(() => { if (reel.remote) setLikeCount(reel.remote.likeCount); }, [reel.remote?.likeCount]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!me.uid) {
      const l = isReelLiked(reel.id);
      setLiked(l); if (!reel.remote) setLikeCount(l ? 1 : 0);
      return;
    }
    if (!reel.remote) { const l = isReelLiked(reel.id); setLiked(l); setLikeCount(l ? 1 : 0); return; }
    return subscribeMyReelLike(reel.id, me.uid, setLiked, () => setLiked(isReelLiked(reel.id)));
  }, [reel.id, me.uid, !!reel.remote]); // eslint-disable-line react-hooks/exhaustive-deps

  // count a view once the card is mostly on screen for 1.5s (server de-duplicates per user)
  useEffect(() => {
    if (!reel.remote || !me.uid || isMineRemote) return;
    const el = document.getElementById(`reel-${reel.id}`);
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(timer);
      if (e.isIntersecting) timer = setTimeout(() => { void recordReelView(reel.id).catch(() => {}); io.disconnect(); }, 1500);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { clearTimeout(timer); io.disconnect(); };
  }, [reel.id, me.uid, isMineRemote]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => {
    void tapFeedback();
    const next = !liked;
    setLiked(next);
    setLikeCount(c => Math.max(0, c + (next ? 1 : -1)));
    // Sample reels live only on this phone: keep their like here too. (Signed in, the like used to go to the
    // server for a reel that does not exist there, so it vanished the next time the card was redrawn.)
    if (!me.uid || !reel.remote) { toggleLikeReel(reel.id); return; }
    try {
      await setReelLike(reel.id, me.uid, next);
    }
    catch { setLiked(!next); setLikeCount(c => Math.max(0, c + (next ? -1 : 1))); }
  };

  return (
    <div id={`reel-${reel.id}`} className="relative aspect-[9/14] w-full overflow-hidden rounded-[28px] border border-line bg-carbon shadow-xl">
      {reel.remote ? (
        reel.type === "video" ? <ReelVideo loader={loadMedia} thumb={reel.remote.thumb} /> : <RemoteImage load={loadMedia} />
      ) : reel.type === "video" ? (
        <ReelVideo src={reel.mediaUrl} />
      ) : (
        <img src={reel.mediaUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/45" />

      <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="rounded-lg border border-white/20 bg-black/60 px-2 py-0.5 text-[11px] font-bold uppercase text-white">{reel.badge || "ORIGINAL"}</span>
          {reel.remote && !isMineRemote && me.uid && (
            <button
              onClick={() => { void tapFeedback(); setReportOpen({ type: "reel", targetId: reel.id, ownerUid: reel.remote!.ownerUid, ownerName: ownerProfile?.displayName || reel.remote!.ownerName, audience: reel.remote!.audience }); }}
              aria-label="Report or block"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/80 active:scale-90"
            ><Flag className="h-3.5 w-3.5" /></button>
          )}
        </span>
        {(creator || (reel.remote && !isMineRemote)) && (
          <button
            onClick={() => { void tapFeedback(); if (reel.remote) onChallengeUser?.(reel.remote.ownerUid); else onChallenge(); }}
            className="flex min-h-[32px] items-center gap-1 rounded-full border border-volt/60 bg-volt/10 px-2.5 py-1 text-[11px] font-bold text-volt active:scale-95"
          >
            <Swords className="h-3 w-3" />
            <span>Challenge</span>
          </button>
        )}
      </div>

      <div className="absolute bottom-16 right-3 z-20 flex flex-col items-center gap-4">
        <button onClick={toggle} className="flex flex-col items-center gap-1 text-white active:scale-110" aria-label="Like">
          <span className={`flex h-11 w-11 items-center justify-center rounded-full ${liked ? "bg-rose-500" : "bg-black/50"}`}>
            <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
          </span>
          <span className="text-[11px] font-bold tabular-nums">{likeCount}</span>
        </button>
        <button onClick={() => { void tapFeedback(); onOpenComments(reel.id); }} className="flex flex-col items-center gap-1 text-white active:scale-95" aria-label="Comments">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50"><MessageCircle className="h-5 w-5" /></span>
          <span className="text-[11px] font-bold tabular-nums">{commentCount}</span>
        </button>
        <button
          onClick={() => { void tapFeedback(); void shareContent({ title: `${creator?.name || me.name} on Apex Pulse`, text: reel.caption }); }}
          className="flex flex-col items-center gap-1 text-white active:scale-95"
          aria-label="Share"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50"><Share2 className="h-5 w-5" /></span>
          <span className="text-[11px] font-bold">Share</span>
        </button>
      </div>

      <div className="absolute bottom-3 left-3 right-16 z-20 space-y-1.5 text-white">
        {creator ? (
          <div className="flex items-center gap-2">
            <button onClick={() => { void tapFeedback(); onOpenCreator(creator); }} className="flex items-center gap-2 text-left">
              <Avatar src={creator.avatar} name={creator.name} size={28} />
              <span className="text-xs font-bold drop-shadow">{creator.handle}</span>
              {creator.verified && <CheckCircle2 className="h-3 w-3 shrink-0 fill-sky-400 text-black" />}
            </button>
            <button
              type="button"
              onClick={() => { void tapFeedback(); setFollowing(toggleFollowCreator(creator.id)); }}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold active:scale-95 ${following ? "border-white/25 bg-white/10 text-white/70" : "border-volt/60 bg-volt/15 text-volt"}`}
            >
              {following ? "Following" : "+ Follow"}
            </button>
          </div>
        ) : reel.remote ? (
          <div className="flex items-center gap-2">
            <button onClick={() => { void tapFeedback(); onOpenUser?.(reel.remote!.ownerUid); }} className="flex items-center gap-2 text-left">
              <Avatar src={ownerProfile?.avatarUrl ?? null} name={reel.remote.ownerName} size={28} />
              <span className="text-xs font-bold drop-shadow">@{ownerProfile?.handle || reel.remote.ownerHandle}</span>
            </button>
            {!isMineRemote && me.uid && (
              <button
                type="button"
                onClick={() => {
                  void tapFeedback();
                  if (followState) void cancelFollow(me.uid!, reel.remote!.ownerUid);
                  else void requestFollow(me.uid!, reel.remote!.ownerUid);
                }}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold active:scale-95 ${followState ? "border-white/25 bg-white/10 text-white/70" : "border-volt/60 bg-volt/15 text-volt"}`}
              >
                {followState === "accepted" ? "Following" : followState === "pending" ? "Requested" : "+ Follow"}
              </button>
            )}
            {isMineRemote && (
              <button
                type="button"
                onClick={() => { if (window.confirm("Delete this reel?")) void deleteReel(reel.remote!).then(() => onDeleted?.()).catch(() => {}); }}
                className="rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-white/80 active:scale-95"
              >
                Delete
              </button>
            )}
          </div>
        ) : mine ? (
          <button onClick={onOpenMyProfile} className="flex items-center gap-2 text-left">
            <Avatar src={me.avatar} name={me.name} size={28} />
            <span className="text-xs font-bold drop-shadow">{me.name}</span>
          </button>
        ) : null}

        <Caption text={reel.caption} onTag={onTag} className="line-clamp-3 break-words pr-2 text-xs font-semibold leading-snug drop-shadow" />

        {reel.remote && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-white/60"><Eye className="h-2.5 w-2.5" />{reel.remote.views} views</div>
        )}
        {reel.publishedDate && (
          <div className="flex items-center gap-2 text-[11px] font-medium text-white/60">
            <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{reel.publishedDate}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Eye className="h-2.5 w-2.5" />{reel.views ?? "0"} views</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 pt-0.5 text-[11px] font-medium text-white/70">
          <Music className="h-3 w-3" />
          <span className="truncate">{reel.musicTrack || "Original audio"}</span>
        </div>
      </div>
      {reportOpen && <ReportSheet target={reportOpen} onClose={() => setReportOpen(null)} />}
    </div>
  );
});

function RemoteImage({ load }: { load: () => Promise<string> }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let a = true; load().then(u => { if (a) setUrl(u); }).catch(() => {}); return () => { a = false; }; }, [load]);
  return url
    ? <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
    : <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-ink-3" /></div>;
}

function ReelsFeedViewInner({ onOpenStoryReel, onOpenArena, onSignIn }: ReelsFeedViewProps) {
  const me = useMyIdentity();
  const edges = useFollowEdges();

  const [reelStudioOpen, setReelStudioOpen] = useState(false);
  const [remoteReels, setRemoteReels] = useState<SharedReel[]>([]);
  const [commentsReelId, setCommentsReelId] = useState<string | null>(null);
  const [commentsVersion, setCommentsVersion] = useState(0);
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUid, setChatUid] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [feedTry, setFeedTry] = useState(0);
  const [feedMode, setFeedMode] = useState<"latest" | "trending">("latest");
  const [trending, setTrending] = useState<SharedReel[] | null>(null);
  const [tag, setTag] = useState<string | null>(null);

  const blocked = useBlocked();
  const feedReels = useMemo(() => getAllFeedReels(), []);
  const pendingRequests = useMemo(() => [...edges.incoming.values()].filter(s => s === "pending").length, [edges]);

  const followeeKey = [...edges.outgoing].filter(([, s]) => s === "accepted").map(([u]) => u).sort().join(",");
  useEffect(() => {
    if (!me.uid) { setRemoteReels([]); return; }
    return subscribeReelFeed(
      me.uid,
      followeeKey ? followeeKey.split(",") : [],
      setRemoteReels,
      () => setNotice("Couldn't load the latest reels. Check your connection."),
    );
  }, [me.uid, followeeKey, feedTry]);

  useEffect(() => {
    if (feedMode !== "trending" || !me.uid) return;
    setTrending(null);
    return subscribeTrendingReels(setTrending, () => { setTrending([]); setNotice("Couldn't load trending reels. Check your connection."); });
  }, [feedMode, me.uid, feedTry]);

  const openComments = useCallback((id: string) => setCommentsReelId(id), []);
  const openCreator = useCallback((c: Creator) => setCreatorProfile(c), []);
  const openMine = useCallback(() => { if (me.uid) setProfileUid(me.uid); }, [me.uid]);
  const goArena = useCallback(() => onOpenArena?.(null), [onOpenArena]);

  const openChatWith = (uid: string | null) => { setChatUid(uid); setChatOpen(true); };

  const challenge = async (uid: string) => {
    if (!me.uid) { setNotice("Sign in to challenge athletes."); return; }
    try {
      const code = await challengeUser({ uid: me.uid, name: me.name, avatar: me.avatar }, uid);
      setChatOpen(false); setProfileUid(null);
      onOpenArena?.(code);
    } catch {
      setNotice("Couldn't create the challenge. You can only challenge athletes who accepted your follow request.");
    }
  };

  const scrollToReel = (id: string) => {
    window.setTimeout(() => document.getElementById(`reel-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
  };

  return (
    <div className="w-full space-y-4 pb-28 text-ink animate-fade-in">
      <div className="flex items-center justify-between px-1 py-1">
        <h1 className="text-lg font-bold tracking-tight">Reels</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { void tapFeedback(); openChatWith(null); }}
            className="relative flex min-h-[40px] items-center gap-1.5 rounded-full border border-line bg-carbon px-3.5 text-xs font-bold active:scale-95"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Chat</span>
            {pendingRequests > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">{pendingRequests}</span>
            )}
          </button>
          <button
            onClick={() => { void tapFeedback(); setReelStudioOpen(true); }}
            className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-volt px-3.5 text-xs font-bold text-void active:scale-95"
          >
            <Camera className="h-4 w-4" />
            <span>Create</span>
          </button>
        </div>
      </div>

      <button
        onClick={() => { void tapFeedback(); setSearchOpen(true); }}
        className="flex w-full items-center gap-2.5 rounded-full border border-line bg-carbon px-4 py-3 text-left text-sm text-ink-3 active:scale-[0.99]"
        aria-label="Search athletes and videos"
      >
        <Search className="h-4 w-4" />
        Search athletes, @handles or videos
      </button>

      <div className="min-h-[96px] px-1">
        <div className="no-scrollbar flex items-center gap-3 overflow-x-auto py-2">
          {MOTIVATION_STORIES.map((story, idx) => (
            <button
              key={story.id}
              onClick={() => { void tapFeedback(); onOpenStoryReel(idx); }}
              className="group flex shrink-0 flex-col items-center gap-1"
            >
              <span className="block h-16 w-16 rounded-full bg-gradient-to-tr from-volt to-emerald-400 p-[2px]">
                <span className="block h-full w-full overflow-hidden rounded-full border-2 border-void bg-void">
                  <img src={story.image} alt={story.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </span>
              </span>
              <span className="max-w-[64px] truncate text-center text-[11px] font-semibold text-ink-2">{story.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 px-1">
        {([["latest", "Latest"], ["trending", "Trending"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => { void tapFeedback(); setFeedMode(k); }} className={`rounded-full py-2 text-xs font-bold transition ${feedMode === k ? "bg-volt text-void" : "border border-line bg-carbon text-ink-2"}`}>{l}</button>
        ))}
      </div>

      {feedMode === "trending" && <OneTimeHint id="trending" className="mx-1">Trending shows the reels getting the most likes right now.</OneTimeHint>}

      {notice && (
        <button onClick={() => { setNotice(null); setFeedTry(n => n + 1); }} className="w-full rounded-xl bg-graphite px-3 py-2 text-center text-xs text-ink-2">{notice} <span className="font-bold text-volt">Tap to retry</span></button>
      )}

      <div className="space-y-6 pt-1">
        {feedMode === "trending" && trending === null && <div className="px-1"><SkeletonRows rows={4} /></div>}
        {feedMode === "trending" && trending !== null && trending.length === 0 && <div className="px-1"><EmptyState icon={<Film className="h-6 w-6" />} title="Nothing is trending yet" body="Like and comment on reels to get it going." action={<EmptyAction label="See latest reels" onClick={() => setFeedMode("latest")} />} /></div>}
        {(feedMode === "trending" ? trending ?? [] : remoteReels).filter(r => !blocked.has(r.ownerUid)).map(r => (
          <ReelCard
            key={r.id}
            reel={{ id: r.id, type: r.type, mediaUrl: "", caption: r.caption, badge: r.badge, musicTrack: r.musicTrack, remote: r }}
            mine={r.ownerUid === me.uid}
            commentsVersion={commentsVersion}
            onOpenComments={openComments}
            onOpenCreator={openCreator}
            onOpenMyProfile={openMine}
            onChallenge={goArena}
            onOpenUser={uid => setProfileUid(uid)}
            onChallengeUser={challenge}
            onTag={setTag}
          />
        ))}
        {feedMode === "latest" && feedReels.map(r => (
          <ReelCard
            key={r.id}
            reel={r}
            creator={getCreatorById(r.creatorId)}
            commentsVersion={commentsVersion}
            onOpenComments={openComments}
            onOpenCreator={openCreator}
            onOpenMyProfile={openMine}
            onChallenge={goArena}
          />
        ))}
      </div>

      {tag && <TagFeed tag={tag} onClose={() => setTag(null)} />}

      {commentsReelId && (
        <ReelCommentsDrawer
          isOpen
          reelId={commentsReelId}
          onClose={() => { setCommentsReelId(null); setCommentsVersion(v => v + 1); }}
          onOpenProfile={uid => { setCommentsReelId(null); setCommentsVersion(v => v + 1); setProfileUid(uid); }}
          onRequireAuth={onSignIn}
          ownerUid={remoteReels.find(r => r.id === commentsReelId)?.ownerUid ?? null}
        />
      )}

      {creatorProfile && (
        <CreatorProfileModal
          creator={creatorProfile}
          onClose={() => setCreatorProfile(null)}
          onStartLiveChallenge={() => { setCreatorProfile(null); goArena(); }}
        />
      )}

      {searchOpen && (
        <PeopleSearch
          onClose={() => setSearchOpen(false)}
          onOpenProfile={uid => setProfileUid(uid)}
          onPickReel={scrollToReel}
        />
      )}

      {profileUid && (
        <PublicProfileSheet
          uid={profileUid}
          onClose={() => setProfileUid(null)}
          onMessage={uid => { setProfileUid(null); setSearchOpen(false); openChatWith(uid); }}
          onChallenge={challenge}
        />
      )}

      <FriendsAndChatHub
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        initialChatUid={chatUid}
        onOpenProfile={uid => setProfileUid(uid)}
        onChallenge={challenge}
        onJoinRoom={code => { setChatOpen(false); onOpenArena?.(code); }}
      />

      {reelStudioOpen && (
        <ReelCreatorStudio
          onClose={() => setReelStudioOpen(false)}
        />
      )}
    </div>
  );
}

const ReelsFeedView = memo(ReelsFeedViewInner);
export default ReelsFeedView;
