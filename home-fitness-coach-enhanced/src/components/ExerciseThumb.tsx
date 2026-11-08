import { useMemo, memo, useState, useEffect, useRef, useCallback } from "react";
import type { FigureGender } from "./HumanFigure";
import ExerciseAnimation from "./ExerciseAnimation";
import type { DemoTone } from "../lib/exercisePhotos.generated";
import { photoSetForMotion } from "../lib/exercisePhotos.generated";
import { readDemoModel } from "../lib/demoPrefs";
import { resolveMotion } from "../anim/resolve";
import type { Accent } from "../design/accents";
import { accent } from "../design/accents";
import { getExerciseVideo } from "../lib/exerciseVideos";
import { getCustomExerciseSignaturePose } from "../lib/customExercises";
import { matchPhotoExerciseId } from "../lib/exercisePhotos";
import { RotateCw } from "lucide-react";

import { getAiGymSignaturePhoto } from "../lib/signaturePoseGenerator";

/**
 * Universal Exercise Demo Component:
 * - 100% Unified Visual Assets: Clean 3D motion video or real high-resolution exercise photography.
 * - Hardware Decoder Lifecycle Synchronization:
 *   Static AI thumbnail poster stays 100% visible until first video frame renders.
 *   On native rendering signal (`onPlaying`), executes a clean 150ms cross-fade, then unmounts
 *   the poster image to free GPU memory.
 * - Rigid 16:9 Aspect Ratio: Zero Cumulative Layout Shift (CLS).
 * - Resilient Error Recovery: Retains poster on decode error and offers unobtrusive retry.
 */
function ExerciseThumbInner({
  name,
  targetMuscle,
  gender = "male",
  model: modelProp,
  size = 56,
  emphasized = false,
  intense = false,
  fill = false,
  bare = false,
  still = false,
  tone = "emerald",
  showCue = false,
  paused = false,
  isBlankPhoto: _isBlankPhoto,
  signaturePose,
  preferStickman = false,
}: {
  name: string;
  targetMuscle?: string;
  gender?: FigureGender;
  model?: DemoTone;
  size?: number;
  emphasized?: boolean;
  intense?: boolean;
  fill?: boolean;
  bare?: boolean;
  still?: boolean;
  tone?: Accent;
  showCue?: boolean;
  paused?: boolean;
  isBlankPhoto?: boolean;
  signaturePose?: string;
  preferStickman?: boolean;
}) {
  const match = useMemo(
    () => resolveMotion(name, targetMuscle),
    [name, targetMuscle],
  );

  // One skin tone for every thumbnail on screen. Callers that do not pass a
  // model get the user's saved choice instead of a hard-coded default, so a
  // list never mixes light and dark photographs.
  const tone_: DemoTone = modelProp ?? readDemoModel();

  const ring = emphasized
    ? "ring-1 ring-[color-mix(in_srgb,var(--emerald)_28%,transparent)]"
    : "";
  const className = bare ? "absolute inset-0" : ring;
  const a = accent(tone);

  // 1. Look up animation video in the assets folder
  const videoSrc = useMemo(() => {
    if (_isBlankPhoto || preferStickman) return null;
    return getExerciseVideo(name, undefined, match?.motion?.id);
  }, [name, match?.motion?.id, _isBlankPhoto, preferStickman]);

  // Video decoder lifecycle & memory states
  const [videoReady, setVideoReady] = useState(false);
  const [, setIsPosterFading] = useState(false);
  const [, setIsPosterMounted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // The real-human demo photograph for this exercise, in the single chosen
  // skin tone. This is what every card, list row and "next up" tile shows.
  const humanPhoto = useMemo(() => {
    const id = match?.motion?.id;
    const set = id ? photoSetForMotion(id) : null;
    if (!set) return null;
    const frames =
      set.frames[`male:${tone_}` as keyof typeof set.frames] ??
      set.frames["male:white"] ??
      set.frames["male:black"];
    if (!frames || frames.length === 0) return null;
    return frames[Math.min(set.signature, frames.length - 1)] ?? null;
  }, [match?.motion?.id, tone_]);

  // Check for custom AI generated signature pose image or generated HD thumbnail
  const activeSignaturePose = useMemo(() => {
    if (fallbackSrc) return fallbackSrc;
    const norm = name.trim().toLowerCase();
    if (norm.includes("scorpion")) {
      return "/thumbnails/prone-scorpion.jpg";
    }
    if (norm.includes("scapular") || norm.includes("glide")) {
      return "/thumbnails/shoulder-taps.jpg";
    }

    // Human photograph (uploaded exercise photography) always wins, then the
    // matching /thumbnails image. Stock "gym" imagery is only a last resort
    // for exercises that have no photography at all.
    if (humanPhoto) return humanPhoto;
    const photoId = matchPhotoExerciseId(name);
    if (photoId) return `/thumbnails/${photoId}.jpg`;

    if (signaturePose && !signaturePose.startsWith("data:image/svg") && !signaturePose.includes("pushup-black")) {
      return signaturePose;
    }

    try {
      const customPose = getCustomExerciseSignaturePose(norm);
      if (customPose) return customPose;
    } catch {}

    // Bundled high-res authentic gym athlete photos (guaranteed not to 404)
    try {
      const gymPhoto = getAiGymSignaturePhoto(name, undefined, targetMuscle);
      if (gymPhoto) return gymPhoto;
    } catch {}

    const matchedId = matchPhotoExerciseId(name);
    if (matchedId) {
      return `/thumbnails/${matchedId}.jpg`;
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (slug) {
      return `/thumbnails/${slug}.jpg`;
    }
    return getAiGymSignaturePhoto(name, undefined, targetMuscle);
  }, [name, signaturePose, targetMuscle, fallbackSrc, humanPhoto]);

  // When still is true (browsing grid, workout preview cards, list items, next-move previews):
  // ALWAYS render the AI generated exercise image as the thumbnail!
  // When still is false (during active playback / demo):
  // Play the demo video with lifecycle synchronization!
  const isThumbnail = Boolean(still);
  const shouldShowVideo = !isThumbnail && !preferStickman && Boolean(videoSrc);

  // Reset lifecycle states whenever media source changes
  useEffect(() => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    setVideoReady(false);
    setIsPosterFading(false);
    setIsPosterMounted(true);
    setVideoFailed(false);
  }, [videoSrc, name]);

  // Cleanup pending fade timer on component unmount
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, []);

  // Sync playback state with pause/play controls
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (paused) {
      el.pause();
    } else if (shouldShowVideo && !videoFailed) {
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }
  }, [paused, shouldShowVideo, videoFailed, reloadKey]);

  /**
   * First frame rendered signal:
   * HTML5 `onPlaying` guarantees the decoder buffer is displaying frames.
   * Cross-fade over 150ms, then unmount the poster image to release bitmap memory.
   */
  const handlePlaying = useCallback(() => {
    if (videoFailed) return;
    setVideoReady(true);
    setIsPosterFading(true);

    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
    }
    fadeTimeoutRef.current = setTimeout(() => {
      setIsPosterMounted(false);
    }, 150);
  }, [videoFailed]);

  /**
   * Resilient error recovery:
   * Keep poster image mounted at 100% opacity, halt video playback, show retry affordance.
   */
  const handleVideoError = useCallback(() => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    setVideoFailed(true);
    setVideoReady(false);
    setIsPosterFading(false);
    setIsPosterMounted(true);
  }, []);

  const handleRetry = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    setVideoFailed(false);
    setVideoReady(false);
    setIsPosterFading(false);
    setIsPosterMounted(true);
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleImageError = () => {
    const bundledPhoto = getAiGymSignaturePhoto(name, undefined, targetMuscle);
    if (activeSignaturePose !== bundledPhoto) {
      setFallbackSrc(bundledPhoto);
    } else {
      setImgFailed(true);
    }
  };

  // 1. High-Performance Static Thumbnail (Instant, Zero Lag, Zero Decoder Clashing)
  if (!preferStickman && activeSignaturePose && !imgFailed && !shouldShowVideo) {
    const imgContent = (
      <img
        src={activeSignaturePose}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={handleImageError}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    );

    if (bare) {
      return (
        <div className={`absolute inset-0 overflow-hidden bg-slate-950 ${className}`}>
          {imgContent}
        </div>
      );
    }

    return (
      <div
        className={["flex flex-col overflow-hidden rounded-lg2", fill ? "absolute inset-0" : "relative shrink-0", className].filter(Boolean).join(" ")}
        style={{
          ...(fill ? {} : { width: size, height: size }),
          background: `radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, ${a.color} 12%, var(--graphite)) 0%, var(--obsidian) 72%)`,
          boxShadow: "inset 0 0 0 1px var(--line)",
        }}
      >
        <div className="relative min-h-0 flex-1">{imgContent}</div>
      </div>
    );
  }

  // 2. Active Workout Playback: Synchronized Media Player (Rigid 16:9, Texture/Layer, Crossfade)
  if (shouldShowVideo) {
    const stage = (
      <div
        className="relative h-full w-full overflow-hidden bg-black flex items-center justify-center select-none"
        style={{ aspectRatio: "16 / 9" }}
      >
        {/* Layer 1: Underlying Video Stream */}
        {!videoFailed && (
          <video
            ref={videoRef}
            key={`stream-${videoSrc}-${reloadKey}`}
            src={videoSrc || undefined}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onPlaying={handlePlaying}
            onError={handleVideoError}
            className={`absolute inset-0 h-full w-full object-contain pointer-events-none transition-opacity duration-150 ${
              videoReady ? "opacity-100" : "opacity-0"
            }`}
            style={{ aspectRatio: "16 / 9" }}
          />
        )}

        {/* Layer 2: neutral loading state. The demo player shows ONLY the demo
            video — the human photograph belongs on cards and lists, and
            showing it here made it flash over the video's first frames. */}
        {!videoReady && !videoFailed && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black pointer-events-none">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          </div>
        )}

        {/* Failure state: no video available — fall back to the photograph. */}
        {videoFailed && activeSignaturePose && !imgFailed && (
          <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
            <img
              src={activeSignaturePose}
              alt={name}
              onError={handleImageError}
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Layer 3: Discrete Retry Recovery Affordance */}
        {videoFailed && (
          <div className="absolute inset-0 z-30 flex items-end justify-end p-3 pointer-events-none">
            <button
              type="button"
              onClick={handleRetry}
              aria-label={`Retry loading video for ${name}`}
              className="pointer-events-auto flex items-center justify-center w-9 h-9 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white border border-white/20 shadow-lg backdrop-blur active:scale-95 transition-all"
            >
              <RotateCw className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        )}
      </div>
    );

    if (bare) {
      return (
        <div className={`overflow-hidden ${className}`}>
          {stage}
        </div>
      );
    }
    return (
      <div
        className={["flex flex-col overflow-hidden rounded-lg2", fill ? "absolute inset-0" : "relative shrink-0", className].filter(Boolean).join(" ")}
        style={{
          ...(fill ? {} : { width: size, height: size }),
          background: `radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, ${a.color} 12%, var(--graphite)) 0%, var(--obsidian) 72%)`,
          boxShadow: "inset 0 0 0 1px var(--line)",
        }}
      >
        <div className="relative min-h-0 flex-1">{stage}</div>
      </div>
    );
  }

  // 3. High-Quality Photo fallback (enforcing standardized photographic visual assets)
  if (activeSignaturePose && !imgFailed) {
    return (
      <div
        className={["flex flex-col overflow-hidden rounded-lg2 bg-slate-950", fill ? "absolute inset-0" : "relative shrink-0", className].filter(Boolean).join(" ")}
        style={{ ...(fill ? {} : { width: size, height: size }) }}
      >
        <img
          src={activeSignaturePose}
          alt={name}
          loading="eager"
          decoding="sync"
          onError={handleImageError}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  // 4. Fallback: Display the lightweight Stickman Animation only if explicitly preferred
  return (
    <ExerciseAnimation
      name={name}
      targetMuscle={targetMuscle}
      gender={gender}
      size={size}
      fill={fill}
      bare={bare}
      still={still}
      tone={tone}
      speed={intense ? 1.12 : 1}
      paused={paused}
      showCue={showCue}
      className={className}
    />
  );
}

const ExerciseThumb = memo(ExerciseThumbInner);
export default ExerciseThumb;
