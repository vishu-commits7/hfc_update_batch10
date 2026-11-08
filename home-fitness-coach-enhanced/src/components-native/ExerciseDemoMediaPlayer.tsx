import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  AccessibilityInfo,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import Video, {
  type OnLoadData,
  type LoadError,
} from "react-native-video";
import { RotateCw } from "lucide-react-native";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type MediaResizeMode = "cover" | "contain";

export interface ExerciseDemoMediaPlayerProps {
  /**
   * Fully qualified remote URI or local bundle asset for the exercise video (MP4/H.264/WebM).
   */
  videoUri: string;

  /**
   * Remote URI, base64 payload, or local path to the high-resolution AI-generated thumbnail poster.
   */
  thumbnailUri: string;

  /**
   * Descriptive movement identifier for accessibility labels, announcements, and semantic tags.
   */
  exerciseName: string;

  /**
   * External playback control wired to workout timers, rep counters, or user pause toggles.
   * @default false
   */
  isPaused?: boolean;

  /**
   * Fitting behavior inside the locked 16:9 container.
   * @default 'cover'
   */
  resizeMode?: MediaResizeMode;

  /**
   * Callback fired strictly when the native hardware decoder commits the first frame to the display buffer.
   */
  onPlaybackReady?: () => void;

  /**
   * Callback fired when native decoding or network transport encounters an irrecoverable fault.
   */
  onError?: (error: LoadError | unknown) => void;

  /**
   * Optional outer container style override (note: 16:9 aspect ratio and overflow:hidden remain locked).
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Optional custom testID for E2E automation (Appium, Detox).
   */
  testID?: string;
}

type DecoderLifecycleState =
  | "INITIALIZING"
  | "BUFFERING"
  | "FIRST_FRAME_READY"
  | "STEADY_PLAYBACK"
  | "DECODER_ERROR";

// ============================================================================
// CONSTANTS & TIMING TOKENS
// ============================================================================

/**
 * 150ms cubic-bezier cross-fade curve:
 * Optimized to balance zero visual flash with rapid bitmap deallocation.
 */
const TRANSITION_DURATION_MS = 150;
const CROSSFADE_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

// ============================================================================
// COMPONENT IMPLEMENTATION
// ============================================================================

/**
 * `ExerciseDemoMediaPlayer`
 *
 * Production-hardened React Native media player engineered specifically to eliminate:
 * 1. Black-screen flash during ExoPlayer / AVPlayer initialization.
 * 2. Visual "ghosting" / collision between static AI placeholder images and active demo videos.
 * 3. Android SurfaceView z-ordering defects and layout clipping failures.
 * 4. Layout thrashing and Cumulative Layout Shift (CLS) on device screens.
 */
export const ExerciseDemoMediaPlayer: React.FC<ExerciseDemoMediaPlayerProps> = ({
  videoUri,
  thumbnailUri,
  exerciseName,
  isPaused = false,
  resizeMode = "cover",
  onPlaybackReady,
  onError,
  style,
  testID = "exercise-demo-media-player",
}) => {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  const [lifecycleState, setLifecycleState] =
    useState<DecoderLifecycleState>("INITIALIZING");
  const [isPosterMounted, setIsPosterMounted] = useState<boolean>(true);
  const [reloadKey, setReloadKey] = useState<number>(0);

  // Reanimated shared value for zero-bridge, 60/120fps GPU opacity interpolation
  const posterOpacity = useSharedValue<number>(1);

  const videoRef = useRef<Video>(null);

  // --------------------------------------------------------------------------
  // REANIMATED STYLES
  // --------------------------------------------------------------------------
  const animatedPosterStyle = useAnimatedStyle(() => ({
    opacity: posterOpacity.value,
  }));

  // --------------------------------------------------------------------------
  // LIFECYCLE EVENT HANDLERS
  // --------------------------------------------------------------------------

  /**
   * Invoked strictly on the JS thread after Reanimated finishes the 150ms fade-out.
   * Removing the image component from the hierarchy deallocates the bitmap from native memory.
   */
  const handleFadeComplete = useCallback(() => {
    setIsPosterMounted(false);
    setLifecycleState("STEADY_PLAYBACK");
  }, []);

  /**
   * CRITICAL EVENT: 'onReadyForDisplay'
   *
   * Fires only when ExoPlayer / AVPlayer has decoded the first frame and rendered
   * it to the TextureView/Layer surface. The AI poster remains 100% visible until this instant.
   */
  const handleReadyForDisplay = useCallback(() => {
    if (lifecycleState === "DECODER_ERROR") return;

    setLifecycleState("FIRST_FRAME_READY");
    onPlaybackReady?.();

    // Trigger precise 150ms cross-fade on the UI thread
    posterOpacity.value = withTiming(
      0,
      {
        duration: TRANSITION_DURATION_MS,
        easing: CROSSFADE_EASING,
      },
      (isFinished?: boolean) => {
        if (isFinished) {
          runOnJS(handleFadeComplete)();
        }
      }
    );
  }, [lifecycleState, onPlaybackReady, handleFadeComplete, posterOpacity]);

  /**
   * 'onLoad'
   * Metadata & tracks are available. DO NOT hide poster yet, as hardware decoders
   * still need several frames to display the first visual buffer.
   */
  const handleVideoLoad = useCallback((_data: OnLoadData) => {
    setLifecycleState((current) =>
      current === "INITIALIZING" ? "BUFFERING" : current
    );
  }, []);

  /**
   * 'onError'
   * Resilient fallback handler. Immediately freezes decoding, preserves the
   * AI thumbnail poster at 100% opacity, and surfaces the retry affordance.
   */
  const handleVideoError = useCallback(
    (err: LoadError) => {
      setLifecycleState("DECODER_ERROR");
      posterOpacity.value = 1;
      setIsPosterMounted(true);
      onError?.(err);

      AccessibilityInfo.announceForAccessibility?.(
        `Video demonstration failed to load for ${exerciseName}. Tap retry to reload.`
      );
    },
    [exerciseName, onError, posterOpacity]
  );

  /**
   * Manual user retry trigger: remounts the video engine without unmounting the container.
   */
  const handleRetry = useCallback(() => {
    posterOpacity.value = 1;
    setIsPosterMounted(true);
    setLifecycleState("INITIALIZING");
    setReloadKey((prev) => prev + 1);
  }, [posterOpacity]);

  // Reset lifecycle state if the exercise movement changes dynamically
  useEffect(() => {
    posterOpacity.value = 1;
    setIsPosterMounted(true);
    setLifecycleState("INITIALIZING");
    setReloadKey((prev) => prev + 1);
  }, [videoUri, thumbnailUri, posterOpacity]);

  // --------------------------------------------------------------------------
  // RENDER PIPELINE
  // --------------------------------------------------------------------------
  return (
    <View
      style={[styles.rigidContainer, style]}
      testID={testID}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={`Video demonstration of ${exerciseName}`}
    >
      {/* ------------------------------------------------------------------ */}
      {/* 1. NATIVE VIDEO LAYER (TEXTUREVIEW ON ANDROID)                     */}
      {/* ------------------------------------------------------------------ */}
      {lifecycleState !== "DECODER_ERROR" && (
        <Video
          ref={videoRef}
          key={`video-stream-${reloadKey}`}
          source={{ uri: videoUri }}
          paused={isPaused}
          repeat={true}
          muted={true}
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
          resizeMode={resizeMode}
          /**
           * CRITICAL ANDROID CONSTRAINT:
           * Enforce TextureView. SurfaceView operates on an asynchronous window layer
           * that punches through views, bypassing borderRadius clipping and z-index ordering.
           */
          viewType={Platform.OS === "android" ? "textureView" : undefined}
          useTextureView={Platform.OS === "android"}
          // Synchronous Frame Handlers
          onLoad={handleVideoLoad}
          onReadyForDisplay={handleReadyForDisplay}
          onError={handleVideoError}
          style={styles.absoluteMediaLayer}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. STATIC AI THUMBNAIL POSTER (CROSS-FADES ON FIRST FRAME READY)   */}
      {/* ------------------------------------------------------------------ */}
      {isPosterMounted && (
        <Animated.View
          style={[styles.absoluteMediaLayer, animatedPosterStyle]}
          pointerEvents="none"
        >
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.imageFill}
            resizeMode={resizeMode}
            fadeDuration={0} // Disable default Android native fade to avoid double-transition jumps
            accessibilityIgnoresInvertColors={true}
          />

          {/* Discreet buffer indicator while hardware decoders initialize */}
          {lifecycleState === "BUFFERING" && (
            <View style={styles.bufferingOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          )}
        </Animated.View>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. RESILIENT ERROR RECOVERY FALLBACK UI                            */}
      {/* ------------------------------------------------------------------ */}
      {lifecycleState === "DECODER_ERROR" && (
        <View style={styles.errorScrimOverlay}>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel={`Retry loading video for ${exerciseName}`}
            accessibilityHint="Double tap to retry video playback"
            activeOpacity={0.8}
          >
            <RotateCw size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ============================================================================
// RIGID 16:9 STYLESHEET (ZERO CUMULATIVE LAYOUT SHIFT)
// ============================================================================

const styles = StyleSheet.create({
  rigidContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
    backgroundColor: "#0A0A0C",
    borderRadius: 16,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  absoluteMediaLayer: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    aspectRatio: 16 / 9,
  },
  imageFill: {
    width: "100%",
    height: "100%",
    aspectRatio: 16 / 9,
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  errorScrimOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 20, 24, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 24,
    width: 38,
    height: 38,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default ExerciseDemoMediaPlayer;

