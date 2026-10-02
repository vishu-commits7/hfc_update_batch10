import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Heart, MessageCircle, Camera, X, LogOut, Send, Loader2,
  Trash2, ImageOff, UserCircle2, Pencil, Globe, Lock, Trophy, Flame, Rss,
} from "lucide-react";
import { useAuthUser, logOut, getUserProfile, saveUserProfile, UserProfileDoc } from "../lib/useAuth";
import { compressImageToBlob } from "../lib/imageCompress";
import { tapFeedback, successFeedback } from "../lib/haptics";
import {
  CommunityPost, CommunityComment, createPost, subscribeToFeed, toggleLike,
  subscribeToComments, addComment, deletePost, fetchUserPosts, uploadAvatar,
  subscribeToLeaderboard, LeaderboardEntry,
} from "../lib/community";
import AuthScreen from "./AuthScreen";

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
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
  const [tab, setTab] = useState<"feed" | "leaderboard">("feed");

  useEffect(() => {
    const unsub = subscribeToFeed(setPosts);
    return unsub;
  }, []);

  useEffect(() => {
    getUserProfile(uid).then(setProfile);
  }, [uid]);

  return (
    <div className="max-w-3xl mx-auto animate-fade-in text-slate-800 pb-12">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="group flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600">Kinetic Community</span>
            <h1 className="font-sans text-2xl font-black uppercase tracking-tight text-slate-900">Progress Feed</h1>
          </div>
        </div>
        <button onClick={() => setProfileUid(uid)} className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
          {profile?.avatarUrl ? <img src={profile.avatarUrl} className="h-full w-full object-cover" alt="" /> : <UserCircle2 className="h-6 w-6 text-slate-400" />}
        </button>
      </div>

      <div className="mb-5 flex gap-1.5 rounded-2xl border border-slate-100 bg-slate-50 p-1.5">
        <button
          onClick={() => { tapFeedback(); setTab("feed"); }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black uppercase tracking-wide transition-all ${tab === "feed" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500"}`}
        >
          <Rss className="h-3.5 w-3.5" /> Feed
        </button>
        <button
          onClick={() => { tapFeedback(); setTab("leaderboard"); }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black uppercase tracking-wide transition-all ${tab === "leaderboard" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500"}`}
        >
          <Trophy className="h-3.5 w-3.5" /> Leaderboard
        </button>
      </div>

      {tab === "leaderboard" && <LeaderboardTab myUid={uid} onOpenProfile={u => setProfileUid(u)} />}

      {tab === "feed" && (
      <div>
        <button
          onClick={() => setComposerOpen(true)}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-xs font-black uppercase tracking-wider text-white active:scale-95"
        >
          <Camera className="h-4 w-4" /> Share Your Progress
        </button>

        {posts === null ? (
          <div className="space-y-4">
            {[0, 1, 2].map(i => <PostCardSkeleton key={i} />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <ImageOff className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 font-black text-slate-600">No posts yet</p>
            <p className="mt-1 text-xs text-slate-400">Be the first to share your progress with the community.</p>
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
        <Composer uid={uid} profile={profile} onClose={() => setComposerOpen(false)} />
      )}
      {commentsPost && (
        <CommentsSheet post={commentsPost} myUid={uid} onClose={() => setCommentsPost(null)} />
      )}
      {profileUid && (
        <ProfileSheet uid={profileUid} isMe={profileUid === uid} onClose={() => setProfileUid(null)}
          onProfileSaved={p => { if (profileUid === uid) setProfile(p); }} />
      )}
    </div>
  );
}

/** A shimmering placeholder shaped like a post card / leaderboard row —
 *  used while Firestore's first snapshot is still loading, so the feed
 *  feels like it's materializing rather than staring at a blank spinner. */
function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className || ""}`} />;
}

function PostCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
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

function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5">
      <Shimmer className="h-5 w-5 shrink-0 rounded-full" />
      <Shimmer className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Shimmer className="h-3 w-28" />
        <Shimmer className="h-2.5 w-20" />
      </div>
      <Shimmer className="h-6 w-10 shrink-0" />
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

function LeaderboardTab({ myUid, onOpenProfile }: { myUid: string; onOpenProfile: (uid: string) => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    const unsub = subscribeToLeaderboard(setEntries);
    return unsub;
  }, []);

  if (entries === null) {
    return (
      <div className="space-y-2.5">
        {[0, 1, 2, 3, 4].map(i => <LeaderboardRowSkeleton key={i} />)}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <Trophy className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 font-black text-slate-600">No rankings yet</p>
        <p className="mt-1 text-xs text-slate-400">Complete workouts and keep your profile public to appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="px-1 text-[11px] text-slate-400">Ranked by total workouts completed — from public profiles only.</p>
      {entries.map((e, i) => (
        <button
          key={e.uid}
          onClick={() => onOpenProfile(e.uid)}
          className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
            e.uid === myUid ? "border-blue-200 bg-blue-50/50" : "border-slate-100 bg-white hover:border-slate-200"
          }`}
        >
          <span className="w-7 shrink-0 text-center text-lg">{MEDALS[i] || <span className="text-xs font-black text-slate-400">#{i + 1}</span>}</span>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
            {e.avatarUrl ? <img src={e.avatarUrl} className="h-full w-full object-cover" alt="" /> : <UserCircle2 className="h-5 w-5 text-slate-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-slate-900">{e.displayName}{e.uid === myUid ? " (you)" : ""}</p>
            <p className="flex items-center gap-1 text-[10px] text-slate-400"><Flame className="h-3 w-3 text-rose-400" /> {e.streakDays} day streak</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-black text-blue-600">{e.totalWorkouts}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">workouts</p>
          </div>
        </button>
      ))}
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
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
      <button onClick={onOpenProfile} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
          {post.avatarUrl ? <img src={post.avatarUrl} className="h-full w-full object-cover" alt="" /> : <UserCircle2 className="h-5 w-5 text-slate-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black text-slate-800">{post.displayName || "Anonymous"}</p>
          <p className="text-[10px] text-slate-400">{timeAgo(post.createdAt)}</p>
        </div>
        {post.uid === myUid && (
          <span onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="rounded-full p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-400">
            <Trash2 className="h-4 w-4" />
          </span>
        )}
      </button>

      <img src={post.photoUrl} alt={post.caption} className="aspect-square w-full object-cover" />

      <div className="px-4 py-3">
        {post.caption && <p className="mb-2 text-sm text-slate-700">{post.caption}</p>}
        <div className="flex items-center gap-4">
          <button onClick={handleLike} className="flex items-center gap-1.5 text-xs font-black text-slate-500">
            <Heart className={`h-[18px] w-[18px] ${liked ? "fill-red-500 text-red-500" : "text-slate-400"}`} />
            {post.likeCount || 0}
          </button>
          <button onClick={onOpenComments} className="flex items-center gap-1.5 text-xs font-black text-slate-500">
            <MessageCircle className="h-[18px] w-[18px] text-slate-400" /> Comment
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
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-5" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black">Share Your Progress</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        {preview ? (
          <img src={preview.url} className="mb-3 max-h-72 w-full rounded-2xl object-cover" alt="Preview" />
        ) : (
          <button onClick={() => fileRef.current?.click()} className="mb-3 flex h-56 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
            <Camera className="h-7 w-7" />
            <span className="text-xs font-bold">Tap to choose a photo</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pick} className="hidden" />

        {preview && (
          <button onClick={() => fileRef.current?.click()} className="mb-3 text-xs font-bold text-blue-600 underline">Choose a different photo</button>
        )}

        <input
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Say something about this progress..."
          className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
        />

        {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</p>}

        <button
          onClick={post}
          disabled={!preview || busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
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
    <div className="fixed inset-0 z-[95] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div className="flex max-h-[75vh] flex-col rounded-t-3xl bg-white" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-black">Comments</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {comments === null ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
          ) : comments.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No comments yet — say something encouraging!</p>
          ) : comments.map(c => (
            <div key={c.id} className="rounded-2xl bg-slate-50 px-3.5 py-2.5">
              <p className="text-xs font-black text-slate-800">{c.displayName}</p>
              <p className="mt-0.5 text-sm text-slate-600">{c.text}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 p-4">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Add a comment..."
            className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
          />
          <button onClick={send} disabled={busy || !text.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileSheet({ uid, isMe, onClose, onProfileSaved }: {
  uid: string; isMe: boolean; onClose: () => void; onProfileSaved: (p: UserProfileDoc) => void;
}) {
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [busyAvatar, setBusyAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getUserProfile(uid).then(p => { setProfile(p); setBioDraft(p?.bio || ""); });
    fetchUserPosts(uid).then(setPosts);
  }, [uid]);

  const pickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;
    setBusyAvatar(true);
    try {
      const blob = await compressImageToBlob(file);
      const url = await uploadAvatar(uid, blob);
      await saveUserProfile(uid, { avatarUrl: url });
      const updated = { ...profile, avatarUrl: url };
      setProfile(updated);
      onProfileSaved(updated);
    } finally { setBusyAvatar(false); }
  };

  const saveBio = async () => {
    if (!profile) return;
    await saveUserProfile(uid, { bio: bioDraft.trim() });
    const updated = { ...profile, bio: bioDraft.trim() };
    setProfile(updated);
    onProfileSaved(updated);
    setEditingBio(false);
  };

  const togglePublic = async () => {
    if (!profile) return;
    const next = !profile.public;
    await saveUserProfile(uid, { public: next });
    const updated = { ...profile, public: next };
    setProfile(updated);
    onProfileSaved(updated);
  };

  return (
    <div className="fixed inset-0 z-[96] overflow-y-auto bg-slate-50" onClick={e => e.stopPropagation()}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/90 px-4 py-3.5 backdrop-blur">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-bold text-slate-600"><ArrowLeft className="h-4 w-4" /> Back</button>
        <h1 className="text-sm font-black uppercase tracking-wider text-slate-800">Profile</h1>
        <span className="w-12" />
      </div>

      <div className="px-5 py-6 text-center">
        <div className="relative mx-auto h-24 w-24">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-slate-100 ring-4 ring-white">
            {profile?.avatarUrl ? <img src={profile.avatarUrl} className="h-full w-full object-cover" alt="" /> : <UserCircle2 className="h-full w-full text-slate-300" />}
          </div>
          {isMe && (
            <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow">
              {busyAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            </button>
          )}
          {isMe && <input ref={avatarInputRef} type="file" accept="image/*" onChange={pickAvatar} className="hidden" />}
        </div>

        <p className="mt-3 text-base font-black text-slate-900">{profile?.displayName || "..."}</p>

        {editingBio ? (
          <div className="mx-auto mt-2 flex max-w-xs items-center gap-2">
            <input value={bioDraft} onChange={e => setBioDraft(e.target.value)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none" placeholder="Add a short bio" />
            <button onClick={saveBio} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white">Save</button>
          </div>
        ) : (
          <button onClick={() => isMe && setEditingBio(true)} className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
            {profile?.bio || (isMe ? "Add a bio" : "")} {isMe && <Pencil className="h-3 w-3" />}
          </button>
        )}

        {isMe && (
          <button onClick={togglePublic} className="mx-auto mt-4 flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600">
            {profile?.public ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {profile?.public ? "Public profile — visible in feed" : "Private — hidden from feed"}
          </button>
        )}

        {isMe && (
          <button onClick={() => logOut()} className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-bold text-red-500">
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        )}
      </div>

      <div className="px-3 pb-10">
        {posts === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
        ) : posts.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">No posts yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {posts.map(p => (
              <div key={p.id} className="aspect-square overflow-hidden rounded-xl bg-slate-100">
                <img src={p.photoUrl} className="h-full w-full object-cover" alt="" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
