import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Heart, MessageCircle, Camera, X, Send, Loader2,
  Trash2, ImageOff, UserCircle2,
} from "lucide-react";
import { useAuthUser, getUserProfile, UserProfileDoc } from "../lib/useAuth";
import { compressImageToBlob } from "../lib/imageCompress";
import { tapFeedback, successFeedback } from "../lib/haptics";
import {
  CommunityPost, CommunityComment, createPost, subscribeToFeed, toggleLike,
  subscribeToComments, addComment, deletePost,
} from "../lib/community";
import AuthScreen from "./AuthScreen";
import PublicProfileSheet from "./PublicProfileSheet";
import OverlayPortal from "./ui/OverlayPortal";
import Avatar from "./ui/Avatar";
import { useMyIdentity } from "../lib/useSocial";

interface CommunityGalleryProps {
  onBack: () => void;
}

function timeAgo(ts: { toDate: () => Date } | null | undefined) {
  if (!ts) return "just now";
  const diffMs = Date.now() - ts.toDate().getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommunityGallery({ onBack }: CommunityGalleryProps) {
  const { user, loading } = useAuthUser();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void">
        <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
      </div>
    );
  }

  if (!user) return <AuthScreen onBack={onBack} onAuthed={() => {}} />;

  return <FeedView uid={user.uid} onBack={onBack} />;
}

function FeedView({ uid, onBack }: { uid: string; onBack: () => void }) {
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentsPost, setCommentsPost] = useState<CommunityPost | null>(null);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const tab = "feed" as const;
  const [feedError, setFeedError] = useState<string | null>(null);
  const me = useMyIdentity();

  useEffect(() => {
    const unsub = subscribeToFeed(setPosts, 60, () => {
      setPosts([]);
      setFeedError("Couldn't load the feed. Publish the Firestore rules (see BUGFIX_NOTES.md) and check your connection.");
    });
    return unsub;
  }, []);

  useEffect(() => {
    getUserProfile(uid).then(setProfile);
  }, [uid]);

  return (
    <div className="max-w-3xl mx-auto animate-fade-in text-ink pb-12">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="group flex h-10 w-10 items-center justify-center rounded-full border border-line bg-carbon text-ink-2 shadow-xs transition-all hover:border-line-strong hover:bg-void"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-volt">Kinetic Community</span>
            <h1 className="font-sans text-2xl font-black uppercase tracking-tight text-ink">Progress Feed</h1>
          </div>
        </div>
        <button onClick={() => setProfileUid(uid)} className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-graphite">
          <Avatar src={me.avatar} name={me.name} size={40} />
        </button>
      </div>
      {feedError && <p className="mb-4 rounded-xl bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-300">{feedError}</p>}

      {tab === "feed" && (
      <div>
        <button
          onClick={() => setComposerOpen(true)}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-volt py-3.5 text-xs font-black uppercase tracking-wider text-white active:scale-95"
        >
          <Camera className="h-4 w-4" /> Share Your Progress
        </button>

        {posts === null ? (
          <div className="space-y-4">
            {[0, 1, 2].map(i => <PostCardSkeleton key={i} />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line bg-carbon p-10 text-center">
            <ImageOff className="mx-auto h-8 w-8 text-ink-3" />
            <p className="mt-3 font-black text-ink-2">No posts yet</p>
            <p className="mt-1 text-xs text-ink-3">Be the first to share your progress with the community.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                myUid={uid}
                onOpenComments={() => setCommentsPost(post)}
                onOpenProfile={() => setProfileUid(post.uid)}
                onDeleted={() => {}}
              />
            ))}
          </div>
        )}
      </div>
      )}

      {composerOpen && (
        <OverlayPortal><Composer uid={uid} profile={profile} onClose={() => setComposerOpen(false)} /></OverlayPortal>
      )}
      {commentsPost && (
        <OverlayPortal><CommentsSheet post={commentsPost} myUid={uid} onClose={() => setCommentsPost(null)} /></OverlayPortal>
      )}
      {profileUid && (
        <PublicProfileSheet uid={profileUid} onClose={() => setProfileUid(null)} />
      )}
    </div>
  );
}

/** A shimmering placeholder shaped like a post card / leaderboard row —
 *  used while Firestore's first snapshot is still loading, so the feed
 *  feels like it's materializing rather than staring at a blank spinner. */
function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-graphite ${className || ""}`} />;
}

function PostCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-carbon shadow-sm">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <Shimmer className="h-8 w-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-2.5 w-16" />
        </div>
      </div>
      <Shimmer className="aspect-square w-full rounded-none" />
      <div className="space-y-2 px-4 py-3">
        <Shimmer className="h-3 w-3/4" />
        <Shimmer className="h-4 w-20" />
      </div>
    </div>
  );
}

function PostCard({ post, myUid, onOpenComments, onOpenProfile, onDeleted }: {
  key?: string; post: CommunityPost; myUid: string; onOpenComments: () => void; onOpenProfile: () => void; onDeleted: () => void;
}) {
  const liked = post.likedBy?.includes(myUid);
  const [busy, setBusy] = useState(false);

  const handleLike = async () => {
    if (busy) return;
    setBusy(true);
    if (liked) tapFeedback(); else successFeedback();
    try { await toggleLike(post.id, myUid, !!liked); } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    await deletePost(post as CommunityPost & { storagePath?: string });
    onDeleted();
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-carbon shadow-sm">
      <button onClick={onOpenProfile} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-graphite">
          {post.avatarUrl ? <img src={post.avatarUrl} className="h-full w-full object-cover" alt="" /> : <UserCircle2 className="h-5 w-5 text-ink-3" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black text-ink">{post.displayName || "Anonymous"}</p>
          <p className="text-[11px] text-ink-3">{timeAgo(post.createdAt)}</p>
        </div>
        {post.uid === myUid && (
          <span onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="rounded-full p-1.5 text-ink-3 hover:bg-red-50 hover:text-red-400">
            <Trash2 className="h-4 w-4" />
          </span>
        )}
      </button>

      <img src={post.photoUrl} alt={post.caption} className="aspect-square w-full object-cover" />

      <div className="px-4 py-3">
        {post.caption && <p className="mb-2 text-sm text-ink-2">{post.caption}</p>}
        <div className="flex items-center gap-4">
          <button onClick={handleLike} className="flex items-center gap-1.5 text-xs font-black text-ink-3">
            <Heart className={`h-[18px] w-[18px] ${liked ? "fill-red-500 text-red-500" : "text-ink-3"}`} />
            {post.likeCount || 0}
          </button>
          <button onClick={onOpenComments} className="flex items-center gap-1.5 text-xs font-black text-ink-3">
            <MessageCircle className="h-[18px] w-[18px] text-ink-3" /> Comment
          </button>
        </div>
      </div>
    </div>
  );
}

function Composer({ uid, profile, onClose }: { uid: string; profile: UserProfileDoc | null; onClose: () => void }) {
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await compressImageToBlob(file);
      setPreview({ blob, url: URL.createObjectURL(blob) });
    } catch { setError("Could not process that photo."); }
  };

  const post = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await createPost({
        uid,
        displayName: profile?.displayName || "Anonymous",
        avatarUrl: profile?.avatarUrl ?? null,
        caption: caption.trim(),
        photoBlob: preview.blob,
      });
      onClose();
    } catch {
      setError("Could not post right now — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-carbon p-5" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black">Share Your Progress</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-ink-3" /></button>
        </div>

        {preview ? (
          <img src={preview.url} className="mb-3 max-h-72 w-full rounded-2xl object-cover" alt="Preview" />
        ) : (
          <button onClick={() => fileRef.current?.click()} className="mb-3 flex h-56 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-ink-3">
            <Camera className="h-7 w-7" />
            <span className="text-xs font-bold">Tap to choose a photo</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pick} className="hidden" />

        {preview && (
          <button onClick={() => fileRef.current?.click()} className="mb-3 text-xs font-bold text-volt underline">Choose a different photo</button>
        )}

        <input
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Say something about this progress..."
          className="mb-3 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-blue-500"
        />

        {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</p>}

        <button
          onClick={post}
          disabled={!preview || busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-volt py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post to Community
        </button>
      </div>
    </div>
  );
}

function CommentsSheet({ post, myUid, onClose }: { post: CommunityPost; myUid: string; onClose: () => void }) {
  const [comments, setComments] = useState<CommunityComment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [myName, setMyName] = useState("Anonymous");

  useEffect(() => {
    getUserProfile(myUid).then(p => p && setMyName(p.displayName));
    const unsub = subscribeToComments(post.id, setComments);
    return unsub;
  }, [post.id, myUid]);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await addComment(post.id, myUid, myName, text.trim());
      setText("");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[240] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div className="flex max-h-[75vh] flex-col rounded-t-3xl bg-carbon" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-sm font-black">Comments</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-ink-3" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {comments === null ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-ink-3" /></div>
          ) : comments.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-3">No comments yet — say something encouraging!</p>
          ) : comments.map(c => (
            <div key={c.id} className="rounded-2xl bg-void px-3.5 py-2.5">
              <p className="text-xs font-black text-ink">{c.displayName}</p>
              <p className="mt-0.5 text-sm text-ink-2">{c.text}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-line p-4">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Add a comment..."
            className="flex-1 rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
          />
          <button onClick={send} disabled={busy || !text.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-volt text-void disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
