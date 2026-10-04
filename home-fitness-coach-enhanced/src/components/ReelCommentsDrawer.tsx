import { useState, useEffect, useRef } from "react";
import { X, Heart, Send } from "lucide-react";
import {
  ReelComment,
  getCommentsForReel,
  addCommentToReel,
  toggleLikeComment,
} from "../lib/socialFeed";
import { tapFeedback } from "../lib/haptics";

interface ReelCommentsDrawerProps {
  isOpen: boolean;
  reelId: string;
  onClose: () => void;
  onCommentCountChange?: (count: number) => void;
}

export default function ReelCommentsDrawer({
  isOpen,
  reelId,
  onClose,
  onCommentCountChange,
}: ReelCommentsDrawerProps) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && reelId) {
      const data = getCommentsForReel(reelId);
      setComments(data);
      onCommentCountChange?.(data.length);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, reelId]);

  if (!isOpen) return null;

  const handlePostComment = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    tapFeedback();

    const created = addCommentToReel(reelId, inputText);
    const updated = [created, ...comments];
    setComments(updated);
    setInputText("");
    onCommentCountChange?.(updated.length);

    // Scroll top
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleLike = (commentId: string) => {
    tapFeedback();
    const updated = toggleLikeComment(reelId, commentId);
    setComments(updated);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] bg-zinc-950 border-t border-white/15 rounded-t-[32px] max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle & Header */}
        <div className="pt-3 pb-2 px-4 border-b border-white/10 flex flex-col items-center relative">
          <div className="w-10 h-1 rounded-full bg-white/25 mb-2" />
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white">Comments</h3>
              <span className="text-xs text-white/50 font-bold">({comments.length})</span>
            </div>
            <button
              onClick={() => {
                tapFeedback();
                onClose();
              }}
              className="p-1 rounded-full bg-white/10 text-white/70 hover:text-white"
              aria-label="Close comments"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Comments Scrollable Body */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar divide-y divide-white/5"
        >
          {comments.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <p className="text-sm font-bold">No comments yet.</p>
              <p className="text-xs mt-1">Start the conversation below!</p>
            </div>
          ) : (
            comments.map((comm) => (
              <div key={comm.id} className="pt-3 first:pt-0 flex items-start gap-3">
                <img
                  src={comm.authorAvatar}
                  alt={comm.authorName}
                  className="h-8 w-8 rounded-full object-cover border border-white/20 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-black text-white">{comm.authorHandle}</span>
                    <span className="text-[10px] text-white/40">{comm.createdAt}</span>
                  </div>
                  <p className="text-xs text-slate-200 mt-0.5 leading-relaxed break-words">
                    {comm.text}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleLike(comm.id)}
                  className="flex flex-col items-center gap-0.5 text-white/60 hover:text-rose-400 shrink-0 pt-1"
                >
                  <Heart
                    className={`h-3.5 w-3.5 ${
                      comm.isLiked ? "fill-rose-500 text-rose-500" : ""
                    }`}
                  />
                  {comm.likes > 0 && (
                    <span className="text-[9px] font-bold text-white/50">{comm.likes}</span>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handlePostComment}
          className="p-3 bg-black/80 border-t border-white/10 flex items-center gap-2 safe-bottom"
        >
          <div className="h-8 w-8 rounded-full overflow-hidden bg-cyan-900 border border-white/20 shrink-0">
            <img
              src="/assets/coaches/coach-beast-male.jpg"
              alt="You"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex-1 relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Add a comment for creator..."
              className="w-full bg-white/10 text-white placeholder-white/40 text-xs rounded-full py-2.5 pl-4 pr-10 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
            {inputText.trim() && (
              <button
                type="submit"
                className="absolute right-1.5 p-1.5 rounded-full bg-cyan-500 text-slate-950 font-black hover:bg-cyan-400 active:scale-90 transition"
              >
                <Send className="h-3 w-3" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
