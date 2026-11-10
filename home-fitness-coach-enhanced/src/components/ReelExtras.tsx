import { useBackClose } from "../lib/backStack";
import { Fragment, useEffect, useState } from "react";
import { Film, Heart, Loader2, Play, X, Eye } from "lucide-react";
import OverlayPortal from "./ui/OverlayPortal";
import { loadReelMedia, subscribeTagReels, subscribeUserReels, type SharedReel } from "../lib/reelsStore";
import { tapFeedback } from "../lib/haptics";
import { ErrorState, EmptyState, EmptyAction, SkeletonGrid } from "./ui/StateViews";

/** Caption with tappable #hashtags. */
export function Caption({ text, onTag, className }: { text: string; onTag?: (tag: string) => void; className?: string }) {
  const parts = text.split(/(#[\p{L}\p{N}_]{2,30})/gu);
  return (
    <p className={className}>
      {parts.map((p, i) =>
        p.startsWith("#") && onTag ? (
          <button key={i} type="button" onClick={e => { e.stopPropagation(); void tapFeedback(); onTag(p.slice(1).toLowerCase()); }} className="font-bold text-volt">{p}</button>
        ) : <Fragment key={i}>{p}</Fragment>,
      )}
    </p>
  );
}

function Tile({ r, onOpen }: { r: SharedReel; onOpen: (r: SharedReel) => void }) {
  return (
    <button onClick={() => { void tapFeedback(); onOpen(r); }} className="relative aspect-[3/4] overflow-hidden rounded-lg bg-graphite active:scale-[0.97]" aria-label={r.caption || "Open reel"}>
      {r.thumb ? <img src={r.thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : (
        <span className="flex h-full w-full items-center justify-center p-2 text-center text-[11px] font-semibold text-ink-3"><Film className="mr-1 h-4 w-4 shrink-0" />{r.caption.slice(0, 40)}</span>
      )}
      {r.type === "video" && <Play className="absolute right-1.5 top-1.5 h-3.5 w-3.5 fill-white text-white drop-shadow" />}
      <span className="absolute bottom-1 left-1.5 flex items-center gap-1 text-[11px] font-bold text-white drop-shadow"><Heart className="h-3 w-3" />{r.likeCount}</span>
    </button>
  );
}

/** Full-screen player for one reel (grid, hashtag and trending taps). */
export function ReelViewer({ reel, onClose, onTag }: { reel: SharedReel; onClose: () => void; onTag?: (t: string) => void }) {
  useBackClose(true, onClose);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setUrl(null); setFailed(false);
    loadReelMedia(reel).then(u => { if (alive) setUrl(u); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [reel.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
        <div className="flex items-center justify-between p-3">
          <span className="min-w-0 truncate text-sm font-bold">{reel.ownerName}</span>
          <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 active:scale-90"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {failed ? <p className="text-sm text-white/70">Couldn't load this reel.</p>
            : !url ? <Loader2 className="h-6 w-6 animate-spin text-white/60" />
            : reel.type === "photo" ? <img src={url} alt="" className="max-h-full max-w-full object-contain" />
            : <video src={url} className="max-h-full max-w-full" autoPlay loop playsInline controls />}
        </div>
        <div className="space-y-1 p-4 pb-8">
          {reel.caption && <Caption text={reel.caption} onTag={onTag} className="break-words text-sm" />}
          <p className="flex items-center gap-3 text-xs text-white/60"><span className="flex items-center gap-1"><Heart className="h-3 w-3" />{reel.likeCount}</span><span className="flex items-center gap-1"><Eye className="h-3 w-3" />{reel.views}</span></p>
        </div>
      </div>
    </OverlayPortal>
  );
}

/** Reels grid on a profile. Shows what the viewer is allowed to see. */
export function ProfileReelsGrid({ uid, onEmptyAction }: { uid: string; onEmptyAction?: { label: string; run: () => void } }) {
  const [reels, setReels] = useState<SharedReel[] | null>(null);
  const [open, setOpen] = useState<SharedReel | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [tryN, setTryN] = useState(0);
  useEffect(() => { setReels(null); setFailed(false); return subscribeUserReels(uid, setReels, () => setFailed(true)); }, [uid, tryN]);
  return (
    <div className="mx-auto mt-6 w-full max-w-sm text-left">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Film className="h-4 w-4 text-volt" /> Reels</h3>
      {failed ? <ErrorState message="Couldn't load reels." onRetry={() => setTryN(n => n + 1)} />
        : reels === null ? <SkeletonGrid count={3} />
        : reels.length === 0 ? <EmptyState icon={<Film className="h-6 w-6" />} title="No reels to show yet" action={onEmptyAction ? <EmptyAction label={onEmptyAction.label} onClick={onEmptyAction.run} /> : undefined} />
        : <div className="grid grid-cols-3 gap-1.5">{reels.map(r => <Tile key={r.id} r={r} onOpen={setOpen} />)}</div>}
      {open && <ReelViewer reel={open} onClose={() => setOpen(null)} onTag={t => { setOpen(null); setTag(t); }} />}
      {tag && <TagFeed tag={tag} onClose={() => setTag(null)} />}
    </div>
  );
}

/** All public reels with one hashtag. */
export function TagFeed({ tag, onClose }: { tag: string; onClose: () => void }) {
  useBackClose(true, onClose);
  const [reels, setReels] = useState<SharedReel[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tryN, setTryN] = useState(0);
  const [open, setOpen] = useState<SharedReel | null>(null);
  useEffect(() => { setReels(null); setFailed(false); return subscribeTagReels(tag, r => { setFailed(false); setReels(r); }, () => { setFailed(true); setReels([]); }); }, [tag, tryN]);
  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-void text-ink">
        <div className="sticky top-0 flex items-center justify-between bg-void/95 p-3 backdrop-blur">
          <h2 className="text-base font-bold">#{tag}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-carbon active:scale-90"><X className="h-5 w-5" /></button>
        </div>
        <div className="mx-auto max-w-md p-3 pb-24">
          {failed ? <ErrorState message="Couldn't load this hashtag." onRetry={() => setTryN(n => n + 1)} />
            : reels === null ? <SkeletonGrid count={9} />
            : reels.length === 0 ? <EmptyState icon={<Film className="h-6 w-6" />} title={`No public reels use #${tag} yet`} action={<EmptyAction label="Back to reels" onClick={onClose} />} />
            : <div className="grid grid-cols-3 gap-1.5">{reels.map(r => <Tile key={r.id} r={r} onOpen={setOpen} />)}</div>}
        </div>
        {open && <ReelViewer reel={open} onClose={() => setOpen(null)} />}
      </div>
    </OverlayPortal>
  );
}
