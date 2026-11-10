import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCw } from "lucide-react";
import { clipBundledUrl, clipRemoteUrl } from "../data/exerciseClips";
import { loadClip, purgeStaleClips } from "../lib/clipCache";

/**
 * Looping exercise demo.
 *
 * - The still image is always there first and stays until the video is really
 *   playing, so there is never a black flash.
 * - Lazy: nothing is downloaded until the player is near the screen, and it
 *   pauses when scrolled away. Pass lazy={false} for the active workout.
 * - Sources, in order: the offline copy / fresh Storage download, a direct
 *   stream from Storage (works even if CORS is not set up), then the clip
 *   bundled in the app. If every one fails the still image stays, with a retry.
 * - Reduced-motion users get the still image and a Play button.
 */
function ExerciseClipInner({
  clipId,
  name,
  poster,
  paused = false,
  lazy = true,
  fallbackUrl,
  className = "",
  onFailed,
}: {
  clipId: string;
  name: string;
  poster?: string | null;
  paused?: boolean;
  lazy?: boolean;
  /** An explicit bundled path, used when the clip has none of its own. */
  fallbackUrl?: string | null;
  className?: string;
  onFailed?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(!lazy);
  const [inView, setInView] = useState(true);
  const [sources, setSources] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reduced] = useState(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  });
  const [userPlay, setUserPlay] = useState(false);

  // Lazy loading + pause when off screen.
  useEffect(() => {
    if (!lazy) {
      setNear(true);
      return;
    }
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const ioNear = new IntersectionObserver(
      (es) => es.some((e) => e.isIntersecting) && setNear(true),
      { rootMargin: "240px" },
    );
    const ioView = new IntersectionObserver((es) => setInView(es.some((e) => e.isIntersecting)), { threshold: 0.1 });
    ioNear.observe(el);
    ioView.observe(el);
    return () => {
      ioNear.disconnect();
      ioView.disconnect();
    };
  }, [lazy]);

  // Work out where to play from, once the player is near the screen.
  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    const made: string[] = [];
    setPlaying(false);
    setFailed(false);
    setIdx(0);
    setSources([]);
    (async () => {
      void purgeStaleClips();
      const list: string[] = [];
      const remote = clipRemoteUrl(clipId);
      if (remote) {
        try {
          const r = await loadClip(remote);
          made.push(r.objectUrl);
          list.push(r.objectUrl);
        } catch {
          // Offline, or the bucket has no CORS rule: stream directly if we can.
          if (typeof navigator === "undefined" || navigator.onLine) list.push(remote);
        }
      }
      const bundled = clipBundledUrl(clipId) ?? (fallbackUrl ? encodeURI(fallbackUrl) : null);
      if (bundled) list.push(bundled);
      if (cancelled) {
        made.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      setSources(list);
      if (list.length === 0) setFailed(true);
    })();
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [near, clipId, fallbackUrl, attempt]);

  useEffect(() => {
    if (failed) onFailed?.();
  }, [failed, onFailed]);

  const wantPlay = !paused && inView && (!reduced || userPlay);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (wantPlay) el.play().catch(() => {});
    else el.pause();
  }, [wantPlay, idx, sources]);

  const onError = useCallback(() => {
    setPlaying(false);
    if (idx + 1 < sources.length) setIdx(idx + 1);
    else setFailed(true);
  }, [idx, sources.length]);

  const src = sources[idx];

  return (
    <div ref={rootRef} className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      {poster && (
        <img
          src={poster}
          alt={name}
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {src && !failed && (
        <video
          ref={videoRef}
          key={src}
          src={src}
          muted
          loop
          playsInline
          autoPlay={wantPlay}
          preload="auto"
          aria-label={`${name} demo`}
          onPlaying={() => setPlaying(true)}
          onError={onError}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-150 ${playing ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {near && !playing && !failed && !(reduced && !userPlay) && (
        <span aria-hidden className="absolute inset-0 grid place-items-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
        </span>
      )}
      {reduced && !userPlay && !failed && (
        <button
          type="button"
          onClick={() => setUserPlay(true)}
          aria-label={`Play ${name} demo`}
          className="absolute bottom-2 right-2 grid min-h-12 min-w-12 place-items-center rounded-full border border-white/20 bg-black/70 text-white"
        >
          <Play className="h-5 w-5 fill-current" />
        </button>
      )}
      {failed && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
          <span className="text-xs font-bold text-white/80">Demo needs a connection</span>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            aria-label={`Retry loading ${name} demo`}
            className="grid min-h-12 min-w-12 place-items-center rounded-full border border-white/20 bg-black/70 text-white"
          >
            <RotateCw className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

const ExerciseClip = memo(ExerciseClipInner);
export default ExerciseClip;
