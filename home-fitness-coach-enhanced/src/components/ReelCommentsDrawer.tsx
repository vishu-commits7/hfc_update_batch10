import { useBackClose } from "../lib/backStack";
import { useEffect, useRef, useState } from "react";
import { X, Heart, Send, Loader2, Trash2, Flag } from "lucide-react";
import ReportSheet, { type ReportTarget } from "./ReportSheet";
import { useBlocked } from "../lib/blocks";
import OverlayPortal from "./ui/OverlayPortal";
import Avatar from "./ui/Avatar";
import {
  subscribeReelComments, postReelComment, toggleReelCommentLike, deleteReelComment,
  friendlySocialError, type ReelCommentDoc,
} from "../lib/social";
import { useMyIdentity } from "../lib/useSocial";
import { ErrorState, EmptyState, EmptyAction, SkeletonLines } from "./ui/StateViews";
import { tapFeedback } from "../lib/haptics";

interface ReelCommentsDrawerProps {
  isOpen: boolean;
  reelId: string;
  onClose: () => void;
  /** open someone's profile (tap on their avatar / name) */
  onOpenProfile?: (uid: string) => void;
  onRequireAuth?: () => void;
  ownerUid?: string | null;
}

function ago(ms: number) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m || 1}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ReelCommentsDrawer({ isOpen, reelId, onClose, onOpenProfile, onRequireAuth }: ReelCommentsDrawerProps) {
  useBackClose(isOpen, onClose);
  const me = useMyIdentity();
  const blocked = useBlocked();
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [comments, setComments] = useState<ReelCommentDoc[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tryN, setTryN] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(40); // newest 40; "More comments" raises it

  useEffect(() => {
    if (!isOpen || !reelId) return;
    setComments(null);
    setError(null);
    setLoadFailed(false);
    const unsub = subscribeReelComments(
      reelId,
      list => { setLoadFailed(false); setComments(list); },
      () => { setComments([]); setLoadFailed(true); },
      max,
    );
    const t = window.setTimeout(() => inputRef.current?.focus(), 350);
    return () => { unsub(); clearTimeout(t); };
  }, [isOpen, reelId, tryN, max]);

  if (!isOpen) return null;

  const post = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    if (!me.uid) { onRequireAuth?.(); setError("Sign in to comment."); return; }
    void tapFeedback();
    setSending(true);
    setError(null);
    try {
      await postReelComment(reelId, { uid: me.uid, name: me.name, handle: me.handle, avatarUrl: me.avatar }, value);
      setText("");
      window.dispatchEvent(new CustomEvent("apex_reel_comment_posted", { detail: { reelId } }));
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(friendlySocialError(err));
    } finally {
      setSending(false);
    }
  };

  const like = async (c: ReelCommentDoc) => {
    if (!me.uid) { setError("Sign in to like comments."); return; }
    void tapFeedback();
    try { await toggleReelCommentLike(reelId, c.id, me.uid, c.likedBy.includes(me.uid)); } catch (err) { setError(friendlySocialError(err)); }
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/65 animate-fade-in" onClick={onClose}>
        <div
          className="flex h-[78dvh] max-h-[78dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl border-t border-line bg-carbon text-ink shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex shrink-0 flex-col items-center border-b border-line px-4 pb-2.5 pt-3">
            <div className="mb-2 h-1 w-10 rounded-full bg-line-strong" />
            <div className="flex w-full items-center justify-between">
              <h3 className="text-sm font-bold">
                Comments {comments ? <span className="font-medium text-ink-3">({comments.length})</span> : null}
              </h3>
              <button onClick={() => { void tapFeedback(); onClose(); }} aria-label="Close comments" className="flex h-9 w-9 items-center justify-center rounded-full bg-graphite text-ink-2 active:scale-95">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {loadFailed ? (
              <ErrorState message="Couldn't load the comments." onRetry={() => setTryN(n => n + 1)} />
            ) : comments === null ? (
              <SkeletonLines rows={4} />
            ) : comments.length === 0 ? (
              <EmptyState icon={<Send className="h-6 w-6" />} title="No comments yet" body="Be the first to say something." action={<EmptyAction label="Write a comment" onClick={() => inputRef.current?.focus()} />} />
            ) : (
              <ul className="space-y-4">
                {comments.filter(c => !blocked.has(c.uid)).map(c => {
                  const liked = !!me.uid && c.likedBy.includes(me.uid);
                  return (
                    <li key={c.id} className="flex items-start gap-3">
                      <button onClick={() => onOpenProfile?.(c.uid)} aria-label={`Open ${c.name}'s profile`} className="shrink-0 active:scale-95">
                        <Avatar src={c.avatarUrl} name={c.name} size={36} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <button onClick={() => onOpenProfile?.(c.uid)} className="truncate text-[13px] font-bold text-ink active:opacity-70">{c.name}</button>
                          <span className="shrink-0 text-[11px] text-ink-3">{ago(c.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 break-words text-[13px] leading-relaxed text-ink-2">{c.text}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <button onClick={() => like(c)} aria-label="Like comment" className="flex h-8 w-8 items-center justify-center rounded-full active:scale-90">
                          <Heart className={`h-4 w-4 ${liked ? "fill-rose-500 text-rose-500" : "text-ink-3"}`} />
                        </button>
                        {c.likeCount > 0 && <span className="-mt-1.5 text-[11px] font-semibold text-ink-3">{c.likeCount}</span>}
                        {c.uid !== me.uid && me.uid && (
                          <button onClick={() => setReportTarget({ type: "comment", targetId: `${reelId}/${c.id}`, ownerUid: c.uid, ownerName: c.name })} aria-label="Report comment" className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 active:scale-90">
                            <Flag className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {c.uid === me.uid && (
                          <button onClick={() => void deleteReelComment(reelId, c.id)} aria-label="Delete comment" className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 active:scale-90">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              {comments.length >= max && max < 200 && (
                  <li><button onClick={() => setMax(n => n + 80)} className="mx-auto block min-h-[44px] rounded-full border border-line bg-carbon px-4 text-xs font-bold text-ink-2">Older comments</button></li>
                )}
              </ul>
            )}
          </div>

          {error && <p className="shrink-0 bg-rose-500/10 px-4 py-1.5 text-center text-[11px] text-rose-300">{error}</p>}

          <form
            onSubmit={post}
            className="flex shrink-0 items-center gap-2.5 border-t border-line bg-carbon px-3 pt-2.5"
            style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))" }}
          >
            <Avatar src={me.avatar} name={me.name} size={36} />
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={me.signedIn ? `Comment as ${me.name}…` : "Sign in to comment"}
              maxLength={500}
              enterKeyHint="send"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-full border border-line-strong bg-graphite px-4 py-2.5 text-base text-ink placeholder:text-ink-3 outline-none focus:border-volt"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              aria-label="Post comment"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-volt text-void transition active:scale-90 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
      {reportTarget && <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />}
    </OverlayPortal>
  );
}
