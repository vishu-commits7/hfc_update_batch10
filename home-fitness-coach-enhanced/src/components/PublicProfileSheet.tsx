import { useBackClose } from "../lib/backStack";
import ProgressSummary from "./ProgressSummary";
import { ProfileReelsGrid } from "./ReelExtras";
import { useEffect, useRef, useState } from "react";
import { updateProfile } from "firebase/auth";
import { ArrowLeft, Camera, Check, Loader2, Lock, Globe, LogOut, Flag, Ban, MessageCircle, Swords, UserPlus, UserCheck, Clock, X } from "lucide-react";
import OverlayPortal from "./ui/OverlayPortal";
import Avatar from "./ui/Avatar";
import { auth } from "../lib/firebase";
import { logOut } from "../lib/useAuth";
import {
  getProfile, getFollowCounts, requestFollow, cancelFollow, acceptFollow, declineFollow,
  updateMyProfile, canChatWith, friendlySocialError, type SocialProfile,
} from "../lib/social";
import { useMyIdentity, useFollowEdges, setMyAvatarFromFile } from "../lib/useSocial";
import { tapFeedback, successFeedback } from "../lib/haptics";
import ReportSheet from "./ReportSheet";
import { useBlocked, unblockUser } from "../lib/blocks";

interface Props {
  uid: string;
  onClose: () => void;
  onMessage?: (uid: string) => void;
  onChallenge?: (uid: string) => void;
}

export default function PublicProfileSheet({ uid, onClose, onMessage, onChallenge }: Props) {
  useBackClose(true, onClose);
  const me = useMyIdentity();
  const edges = useFollowEdges();
  const isMe = me.uid === uid;
  const blockedSet = useBlocked();
  const iBlocked = blockedSet.has(uid);
  const [reporting, setReporting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([getProfile(uid), getFollowCounts(uid)]);
      setProfile(p);
      setCounts(c);
      if (!p && !isMe) setError("This athlete hasn't set up a profile yet.");
    } catch (e) {
      setError(friendlySocialError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [uid]);
  // refresh counts whenever my follow graph changes
  useEffect(() => {
    const run = () => getFollowCounts(uid).then(setCounts).catch(() => {});
    void run();
    const t = setTimeout(run, 2500); // server counters land a moment after the change
    return () => clearTimeout(t);
  }, [edges, uid]);

  // For my own profile always show the freshest identity (local photo included).
  const shown: SocialProfile | null = isMe
    ? {
        uid,
        displayName: me.name,
        handle: me.handle,
        avatarUrl: me.avatar,
        bio: me.bio,
        public: me.profile?.public !== false,
        accountPublic: me.profile?.accountPublic === true,
        arenaWins: me.profile?.arenaWins,
        totalWorkouts: me.profile?.totalWorkouts,
      }
    : profile;

  const outgoing = edges.outgoing.get(uid);
  const incoming = edges.incoming.get(uid);
  const chatOk = canChatWith(edges, uid);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await fn(); void tapFeedback(); } catch (e) { setError(friendlySocialError(e)); } finally { setBusy(false); }
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setAvatarBusy(true);
    setError(null);
    try {
      await setMyAvatarFromFile(f, me.uid);
      void successFeedback();
    } catch {
      setError("Couldn't read that photo. Try a different image.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const startEdit = () => {
    setNameDraft(me.name);
    setBioDraft(me.bio);
    setEditing(true);
  };

  const saveEdit = () =>
    run(async () => {
      const name = nameDraft.trim().slice(0, 30) || me.name;
      await updateMyProfile(uid, { displayName: name, bio: bioDraft.trim().slice(0, 140) });
      try { if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name }); } catch { /* ignore */ }
      try { localStorage.setItem("kinetic_athlete_alias", name); } catch { /* ignore */ }
      setEditing(false);
      void successFeedback();
    });

  const isAcctPublic = (me.profile as any)?.accountPublic === true;


  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[300] flex flex-col bg-void text-ink animate-fade-in" onClick={e => e.stopPropagation()}>
        <div
          className="flex shrink-0 items-center justify-between border-b border-line bg-carbon px-3 pb-2"
          style={{ paddingTop: "max(var(--safe-t), env(safe-area-inset-top, 24px))" }}
        >
          <button onClick={onClose} className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-ink-2 active:scale-95">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-sm font-bold">{isMe ? "My profile" : "Profile"}</h1>
          <span className="w-16" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-16 pt-6">
          {loading && !shown ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-ink-3" /></div>
          ) : !shown ? (
            <div className="py-16 text-center">
              <p className="text-sm text-ink-2">{error || "Profile unavailable."}</p>
              <button onClick={load} className="mt-4 rounded-xl bg-graphite px-4 py-2 text-xs font-bold text-ink">Retry</button>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <Avatar src={shown.avatarUrl} name={shown.displayName} size={104} ring />
                  {isMe && (
                    <>
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={avatarBusy}
                        aria-label="Change profile photo"
                        className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-void bg-volt text-void shadow active:scale-95"
                      >
                        {avatarBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
                    </>
                  )}
                </div>

                {editing ? (
                  <div className="mt-4 w-full max-w-xs space-y-2 text-left">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Name</label>
                    <input
                      value={nameDraft}
                      onChange={e => setNameDraft(e.target.value)}
                      maxLength={30}
                      className="w-full rounded-xl border border-line bg-carbon px-3 py-2.5 text-base text-ink outline-none focus:border-volt"
                    />
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Bio</label>
                    <textarea
                      value={bioDraft}
                      onChange={e => setBioDraft(e.target.value)}
                      maxLength={140}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-line bg-carbon px-3 py-2.5 text-base text-ink outline-none focus:border-volt"
                    />
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setEditing(false)} className="flex-1 rounded-xl border border-line bg-graphite py-2.5 text-sm font-semibold text-ink-2">Cancel</button>
                      <button onClick={saveEdit} disabled={busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-volt py-2.5 text-sm font-bold text-void">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="mt-4 text-xl font-bold">{shown.displayName}</h2>
                    <p className="text-sm text-ink-3">@{shown.handle}</p>
                    {shown.bio ? <p className="mt-2 max-w-xs text-sm text-ink-2">{shown.bio}</p> : isMe ? <p className="mt-2 text-sm text-ink-3">Add a short bio</p> : null}
                  </>
                )}
              </div>

              <div className="mx-auto mt-6 grid max-w-sm grid-cols-4 gap-2">
                {[
                  { k: "Followers", v: counts.followers },
                  { k: "Following", v: counts.following },
                  { k: "Arena wins", v: shown.arenaWins || 0 },
                  { k: "Workouts", v: shown.totalWorkouts || 0 },
                ].map(s => (
                  <div key={s.k} className="rounded-xl border border-line bg-carbon py-3 text-center">
                    <p className="text-lg font-bold tabular-nums">{s.v}</p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{s.k}</p>
                  </div>
                ))}
              </div>

              <ProgressSummary uid={shown.uid} />

              <ProfileReelsGrid uid={shown.uid} />

              {!isMe && me.signedIn && (
                <div className="mx-auto mt-5 max-w-sm space-y-2">
                  {incoming === "pending" && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-carbon p-3">
                      <p className="text-xs text-ink-2">{shown.displayName} wants to follow you</p>
                      <div className="flex gap-2">
                        <button onClick={() => run(() => acceptFollow(me.uid!, uid))} className="rounded-lg bg-volt px-3 py-1.5 text-xs font-bold text-void">Accept</button>
                        <button onClick={() => run(() => declineFollow(me.uid!, uid))} aria-label="Decline" className="rounded-lg bg-graphite px-2.5 py-1.5 text-ink-2"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {outgoing === "accepted" ? (
                      <button onClick={() => run(() => cancelFollow(me.uid!, uid))} className="flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-graphite text-sm font-semibold text-ink">
                        <UserCheck className="h-4 w-4" /> Following
                      </button>
                    ) : outgoing === "pending" ? (
                      <button onClick={() => run(() => cancelFollow(me.uid!, uid))} className="flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-graphite text-sm font-semibold text-ink-2">
                        <Clock className="h-4 w-4" /> Requested
                      </button>
                    ) : (
                      <button onClick={() => run(() => requestFollow(me.uid!, uid))} disabled={busy} className="flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-volt text-sm font-bold text-void active:scale-95">
                        <UserPlus className="h-4 w-4" /> Follow
                      </button>
                    )}
                    {onMessage && (
                      <button
                        onClick={() => chatOk ? onMessage(uid) : setError("You can message each other once a follow request is accepted.")}
                        className={`flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-semibold ${chatOk ? "bg-graphite text-ink" : "bg-carbon text-ink-3"}`}
                      >
                        <MessageCircle className="h-4 w-4" /> Message
                      </button>
                    )}
                  </div>
                  {onChallenge && (
                    <button onClick={() => onChallenge(uid)} className="flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-carbon text-sm font-semibold text-ink-2">
                      <Swords className="h-4 w-4" /> Challenge in Arena
                    </button>
                  )}
                </div>
              )}

              {!isMe && me.signedIn && (
                <div className="mx-auto mt-3 flex max-w-sm gap-2">
                  {iBlocked ? (
                    <button onClick={() => { void unblockUser(uid); setFlash("Unblocked."); }} className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-graphite text-xs font-semibold text-ink-2">
                      <Ban className="h-4 w-4" /> Unblock
                    </button>
                  ) : null}
                  <button onClick={() => setReporting(true)} className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-graphite text-xs font-semibold text-ink-2">
                    <Flag className="h-4 w-4" /> Report / block
                  </button>
                </div>
              )}
              {flash && <p className="mx-auto mt-3 max-w-sm rounded-xl bg-graphite px-3 py-2 text-center text-xs text-ink-2">{flash}</p>}
              {reporting && shown && (
                <ReportSheet
                  target={{ type: "user", targetId: uid, ownerUid: uid, ownerName: shown.displayName }}
                  onClose={() => setReporting(false)}
                  onDone={setFlash}
                />
              )}

              {!isMe && !me.signedIn && (
                <p className="mx-auto mt-5 max-w-sm text-center text-xs text-ink-3">Sign in to follow athletes and send messages.</p>
              )}

              {isMe && !editing && (
                <div className="mx-auto mt-5 max-w-sm space-y-2">
                  <button onClick={startEdit} className="flex min-h-[46px] w-full items-center justify-center rounded-xl border border-line bg-graphite text-sm font-semibold text-ink">
                    Edit name &amp; bio
                  </button>
                  <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-3">
                    {isAcctPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {isAcctPublic ? "Public account" : "Private account"} · change in Settings
                  </p>
                  <button onClick={() => { void logOut(); onClose(); }} className="flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-rose-400">
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              )}

              {error && <p className="mx-auto mt-4 max-w-sm rounded-xl bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-300">{error}</p>}
            </>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}
