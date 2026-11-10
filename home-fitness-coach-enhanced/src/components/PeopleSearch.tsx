import { useBackClose } from "../lib/backStack";
import { useBlocked } from "../lib/blocks";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, X, UserPlus, UserCheck, Clock, Film } from "lucide-react";
import OverlayPortal from "./ui/OverlayPortal";
import Avatar from "./ui/Avatar";
import { searchProfiles, requestFollow, cancelFollow, friendlySocialError, type SocialProfile } from "../lib/social";
import { useMyIdentity, useFollowEdges } from "../lib/useSocial";
import { ErrorState, EmptyState, EmptyAction, SkeletonRows } from "./ui/StateViews";
import { getAllFeedReels, getCreatorById } from "../lib/socialFeed";
import { tapFeedback } from "../lib/haptics";

interface Props {
  onClose: () => void;
  onOpenProfile: (uid: string) => void;
  onPickReel: (reelId: string) => void;
}

export default function PeopleSearch({ onClose, onOpenProfile, onPickReel }: Props) {
  useBackClose(true, onClose);
  const me = useMyIdentity();
  const edges = useFollowEdges();
  const [term, setTerm] = useState("");
  const blocked = useBlocked();
  const [people, setPeople] = useState<SocialProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searchTry, setSearchTry] = useState(0);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 250); return () => clearTimeout(t); }, []);

  // debounce Firestore search
  useEffect(() => {
    if (!me.signedIn) { setPeople([]); return; }
    const id = ++seq.current;
    setError(null);
    setSearchFailed(false);
    const t = setTimeout(async () => {
      try {
        const res = await searchProfiles(term, me.uid);
        if (id === seq.current) setPeople(res);
      } catch {
        if (id === seq.current) { setPeople([]); setSearchFailed(true); }
      }
    }, term ? 280 : 0);
    return () => clearTimeout(t);
  }, [term, me.uid, me.signedIn, searchTry]);

  const videos = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (q.length < 2) return [];
    return getAllFeedReels()
      .filter(r => {
        const c = getCreatorById(r.creatorId);
        return (
          r.caption.toLowerCase().includes(q) ||
          r.exerciseChallenge.exerciseName.toLowerCase().includes(q) ||
          r.badge.toLowerCase().includes(q) ||
          (c?.name.toLowerCase().includes(q) ?? false)
        );
      })
      .slice(0, 6);
  }, [term]);

  const toggleFollow = async (uid: string) => {
    if (!me.uid || busyUid) return;
    setBusyUid(uid);
    setError(null);
    try {
      void tapFeedback();
      const st = edges.outgoing.get(uid);
      if (st) await cancelFollow(me.uid, uid);
      else await requestFollow(me.uid, uid);
    } catch (e) {
      setError(friendlySocialError(e));
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[260] flex flex-col bg-void text-ink animate-fade-in">
        <div
          className="flex shrink-0 items-center gap-2 border-b border-line bg-carbon px-3 pb-2.5"
          style={{ paddingTop: "max(var(--safe-t), env(safe-area-inset-top, 24px))" }}
        >
          <button onClick={onClose} aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              ref={inputRef}
              value={term}
              onChange={e => setTerm(e.target.value)}
              placeholder="Search athletes, @handles or videos"
              enterKeyHint="search"
              autoComplete="off"
              className="w-full rounded-full border border-line-strong bg-graphite py-2.5 pl-10 pr-10 text-base text-ink placeholder:text-ink-3 outline-none focus:border-volt"
            />
            {term && (
              <button onClick={() => setTerm("")} aria-label="Clear" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-3">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-3">
          {!me.signedIn && (
            <p className="rounded-xl border border-line bg-carbon p-4 text-center text-sm text-ink-2">
              Sign in from the profile menu to find and follow other athletes.
            </p>
          )}
          {error && <p className="mb-3 rounded-xl bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-300">{error}</p>}

          {me.signedIn && (
            <>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{term ? "People" : "People on Apex"}</p>
              {searchFailed ? (
                <ErrorState message="Couldn't search right now." onRetry={() => { setPeople(null); setSearchTry(n => n + 1); }} />
              ) : people === null ? (
                <SkeletonRows rows={5} />
              ) : people.length === 0 ? (
                <EmptyState icon={<Search className="h-6 w-6" />} title={term ? "No athletes found" : "No other athletes yet"} body={term ? "Check the spelling or try another name." : "Be one of the first. Invite a friend to join."} action={term ? <EmptyAction label="Clear search" onClick={() => setTerm("")} /> : <EmptyAction label="Invite a friend" onClick={() => { const text = "Train with me on Apex Pulse."; if (navigator.share) void navigator.share({ text }).catch(() => {}); else void navigator.clipboard?.writeText(text).catch(() => {}); }} />} />
              ) : (
                <ul className="space-y-1">
                  {people.filter(p => !blocked.has(p.uid)).map(p => {
                    const st = edges.outgoing.get(p.uid);
                    return (
                      <li key={p.uid} className="flex items-center gap-3 rounded-2xl px-1 py-2">
                        <button onClick={() => onOpenProfile(p.uid)} className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70">
                          <Avatar src={p.avatarUrl} name={p.displayName} size={46} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold">{p.displayName}</span>
                            <span className="block truncate text-xs text-ink-3">@{p.handle}</span>
                          </span>
                        </button>
                        <button
                          onClick={() => toggleFollow(p.uid)}
                          disabled={busyUid === p.uid}
                          className={`flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold active:scale-95 ${
                            st === "accepted" ? "border border-line bg-graphite text-ink-2" : st === "pending" ? "border border-line bg-graphite text-ink-3" : "bg-volt text-void"
                          }`}
                        >
                          {st === "accepted" ? <><UserCheck className="h-3.5 w-3.5" /> Following</> : st === "pending" ? <><Clock className="h-3.5 w-3.5" /> Requested</> : <><UserPlus className="h-3.5 w-3.5" /> Follow</>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {videos.length > 0 && (
            <>
              <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Videos</p>
              <ul className="space-y-1">
                {videos.map(v => (
                  <li key={v.id}>
                    <button onClick={() => { onPickReel(v.id); onClose(); }} className="flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left active:opacity-70">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-graphite text-ink-2"><Film className="h-5 w-5" /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{v.exerciseChallenge.exerciseName}</span>
                        <span className="block truncate text-xs text-ink-3">{v.caption}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}
