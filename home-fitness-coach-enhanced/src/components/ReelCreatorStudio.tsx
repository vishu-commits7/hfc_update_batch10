import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Music,
  Play,
  Pause,
  CheckCircle2,
  Camera,
  RotateCcw,
  Tag,
  Type as TypeIcon,
  Video,
  Upload,
  SwitchCamera,
  Mic,
  MicOff,
  Flame,
  Zap,
  Gauge,
  X,
} from "lucide-react";
import { tapFeedback, successFeedback } from "../lib/haptics";

export interface UserReel {
  id: string;
  type: "video" | "photo";
  mediaUrl: string;
  caption: string;
  badge: string;
  musicTrack: string;
  filter: string;
  speed?: number;
  createdAt: string;
  likes: number;
}

interface ReelCreatorStudioProps {
  onClose: () => void;
  onReelPublished?: (reel: UserReel) => void;
}

const BADGES = [
  "⚡ BEAST MODE: 100%",
  "🏆 NEW PR SMASHED",
  "🔥 NO DAYS OFF",
  "🦾 APEX FORM CHECK",
  "💀 100% PAIN CAVE",
  "⚔️ 1v1 DUEL VICTOR",
  "🧬 TECHNIQUE MASTERY",
];

const FILTERS = [
  { id: "none", name: "Natural", class: "", previewBg: "bg-slate-700" },
  { id: "beast", name: "Obsidian", class: "contrast-125 saturate-150 brightness-95", previewBg: "bg-zinc-900 border-cyan-400" },
  { id: "cyber", name: "Cyber Cyan", class: "hue-rotate-15 contrast-115 saturate-125", previewBg: "bg-cyan-900 border-cyan-300" },
  { id: "gold", name: "Molten Gold", class: "sepia-30 contrast-125 brightness-105", previewBg: "bg-amber-800 border-amber-300" },
  { id: "noir", name: "Monochrome", class: "grayscale contrast-130", previewBg: "bg-neutral-800 border-white" },
  { id: "neon", name: "Neon Surge", class: "hue-rotate-90 saturate-150 contrast-110", previewBg: "bg-purple-900 border-fuchsia-400" },
];

const TRACKS = [
  "Phonk 808 Bass - Heavy Drift",
  "Savage Gym Horns - Aggressive",
  "Lo-Fi Chillhop - Recovery Flow",
  "Cyberpunk Industrial - Peak BPM",
  "Original Audio (Live Mic)",
];

const SPEEDS = [
  { label: "0.8x Slo-Mo", value: 0.8 },
  { label: "1.0x Normal", value: 1.0 },
  { label: "1.25x Dynamic", value: 1.25 },
  { label: "1.5x Sprint", value: 1.5 },
];

type ActiveDrawer = "none" | "filters" | "badges" | "audio" | "caption" | "speed";

export default function ReelCreatorStudio({
  onClose,
  onReelPublished,
}: ReelCreatorStudioProps) {
  // Capture Mode: "camera" (live recording) or "gallery" (file upload)
  const [captureSource, setCaptureSource] = useState<"camera" | "gallery">("camera");

  // Media state
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"video" | "photo">("video");
  const [caption, setCaption] = useState("Discipline over motivation. Every single rep counts.");
  const [selectedBadge, setSelectedBadge] = useState(BADGES[0]);
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[1]);
  const [selectedTrack, setSelectedTrack] = useState(TRACKS[0]);
  const [selectedSpeed, setSelectedSpeed] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishedSuccess, setPublishedSuccess] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>("none");

  // Live Camera states
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const liveVideoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const recordedVideoPlayerRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize camera when in camera mode and no media is captured yet
  useEffect(() => {
    if (!mediaUrl && captureSource === "camera") {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      stopCamera();
    };
  }, [captureSource, mediaUrl, facingMode, micEnabled]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      stopCamera();

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
        audio: micEnabled,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setCameraStream(stream);
      if (liveVideoPreviewRef.current) {
        liveVideoPreviewRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Camera init error:", err);
      // If audio fails, try video-only
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        streamRef.current = stream;
        setCameraStream(stream);
        if (liveVideoPreviewRef.current) {
          liveVideoPreviewRef.current.srcObject = stream;
        }
      } catch (videoErr: any) {
        setCameraError("Camera access denied or unavailable. You can upload from your gallery.");
        setCaptureSource("gallery");
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const toggleCameraFacing = () => {
    tapFeedback();
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const toggleMic = () => {
    tapFeedback();
    setMicEnabled((prev) => !prev);
  };

  const startLiveRecording = () => {
    if (!cameraStream) return;
    tapFeedback();
    recordedChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      const mimeTypes = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
      let selectedMime = "";
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const recorder = selectedMime
        ? new MediaRecorder(cameraStream, { mimeType: selectedMime })
        : new MediaRecorder(cameraStream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: selectedMime || "video/webm",
        });
        const url = URL.createObjectURL(blob);
        setMediaUrl(url);
        setMediaType("video");
        stopCamera();
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 60) {
            stopLiveRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (e: any) {
      console.error("Recording error:", e);
      setCameraError("Unable to start video recorder: " + (e?.message || "Unknown error"));
    }
  };

  const stopLiveRecording = () => {
    tapFeedback();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    tapFeedback();
    stopCamera();
    const isVid = file.type.startsWith("video");
    setMediaType(isVid ? "video" : "photo");

    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setActiveDrawer("filters");
  };

  const handleRetake = () => {
    tapFeedback();
    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
    }
    setMediaUrl(null);
    setPublishedSuccess(false);
    setActiveDrawer("none");
    if (captureSource === "camera") {
      startCamera();
    }
  };

  const togglePlay = () => {
    if (!recordedVideoPlayerRef.current) return;
    if (recordedVideoPlayerRef.current.paused) {
      recordedVideoPlayerRef.current.play();
      setIsPlaying(true);
    } else {
      recordedVideoPlayerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const cycleBadge = () => {
    tapFeedback();
    const nextIdx = (BADGES.indexOf(selectedBadge) + 1) % BADGES.length;
    setSelectedBadge(BADGES[nextIdx]);
  };

  const handleSpeedSelect = (val: number) => {
    tapFeedback();
    setSelectedSpeed(val);
    if (recordedVideoPlayerRef.current) {
      recordedVideoPlayerRef.current.playbackRate = val;
    }
  };

  const handlePublish = () => {
    if (!mediaUrl) return;
    setPublishing(true);
    tapFeedback();

    setTimeout(() => {
      // Authentic likes count starts at 0
      const newReel: UserReel = {
        id: `reel_${Date.now()}`,
        type: mediaType,
        mediaUrl,
        caption: caption.trim() || "Workout done.",
        badge: selectedBadge,
        musicTrack: selectedTrack,
        filter: selectedFilter.id,
        speed: selectedSpeed,
        createdAt: new Date().toISOString(),
        likes: 0,
      };

      try {
        const existing = JSON.parse(localStorage.getItem("apex_user_reels") || "[]");
        const updated = [newReel, ...existing];
        localStorage.setItem("apex_user_reels", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("kinetic_user_reel_created", { detail: newReel }));
      } catch {}

      successFeedback();
      setPublishing(false);
      setPublishedSuccess(true);

      if (onReelPublished) onReelPublished(newReel);
      setTimeout(() => {
        onClose();
      }, 1200);
    }, 600);
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-2 sm:p-4 animate-fade-in select-none">
      {/* Mobile Instagram Reel Container */}
      <div className="relative w-full max-w-[420px] h-[92vh] max-h-[780px] rounded-[32px] overflow-hidden bg-black border border-white/15 shadow-2xl flex flex-col justify-between">
        
        {/* ----------------- TOP APP BAR ----------------- */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/95 via-black/80 to-transparent z-20">
          <button
            onClick={() => {
              tapFeedback();
              stopCamera();
              onClose();
            }}
            className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </button>

          {/* Mode Switcher when media hasn't been captured yet */}
          {!mediaUrl && (
            <div className="flex items-center bg-white/10 p-0.5 rounded-full border border-white/10 text-[11px] font-black">
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  setCaptureSource("camera");
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-full transition ${
                  captureSource === "camera"
                    ? "bg-rose-500 text-white shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Video className="h-3 w-3" />
                <span>Live Record</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  stopCamera();
                  setCaptureSource("gallery");
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-full transition ${
                  captureSource === "gallery"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Upload className="h-3 w-3" />
                <span>Gallery</span>
              </button>
            </div>
          )}

          {mediaUrl && (
            <span className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Edit Reel</span>
            </span>
          )}

          <button
            onClick={handlePublish}
            disabled={!mediaUrl || publishing}
            className={`rounded-full px-3.5 py-1 text-xs font-bold transition flex items-center gap-1 ${
              mediaUrl && !publishing
                ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-md font-black"
                : "bg-white/10 text-slate-500 cursor-not-allowed"
            }`}
          >
            {publishing ? "Sharing..." : "Share"}
          </button>
        </div>

        {/* ----------------- CENTER CANVAS ----------------- */}
        <div className="relative flex-1 w-full overflow-hidden bg-zinc-950 flex items-center justify-center">
          {publishedSuccess ? (
            <div className="flex flex-col items-center justify-center p-6 text-center animate-fade-in">
              <CheckCircle2 className="h-16 w-16 text-emerald-400 mb-3 animate-bounce" />
              <h3 className="text-xl font-black text-white">Reel Shared Authentically!</h3>
              <p className="text-xs text-slate-400 mt-1">Live on your profile and community feed (0 likes starting base).</p>
            </div>
          ) : !mediaUrl ? (
            /* ================= STATE 1: LIVE RECORDING OR GALLERY PICKER ================= */
            captureSource === "camera" ? (
              <div className="relative h-full w-full bg-black flex items-center justify-center">
                {/* Live Camera Viewfinder */}
                <video
                  ref={liveVideoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${
                    facingMode === "user" ? "scale-x-[-1]" : ""
                  }`}
                />

                {/* Camera Overlay Controls (Flip, Mic, Timer) */}
                <div className="absolute top-4 inset-x-4 flex items-center justify-between z-10">
                  {/* Timer Badge */}
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-mono font-black flex items-center gap-1.5 backdrop-blur-md ${
                      isRecording
                        ? "bg-rose-600 text-white animate-pulse"
                        : "bg-black/60 text-white/80 border border-white/20"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isRecording ? "bg-white animate-ping" : "bg-rose-500"
                      }`}
                    />
                    <span>{formatTimer(recordingSeconds)} / 01:00</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle Mic */}
                    <button
                      type="button"
                      onClick={toggleMic}
                      className="h-9 w-9 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center backdrop-blur active:scale-90 transition"
                      title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
                    >
                      {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-rose-400" />}
                    </button>

                    {/* Flip Camera */}
                    <button
                      type="button"
                      onClick={toggleCameraFacing}
                      className="h-9 w-9 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center backdrop-blur active:scale-90 transition"
                      title="Flip Camera (Front/Back)"
                    >
                      <SwitchCamera className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom Live Record Shutter Button */}
                <div className="absolute bottom-6 inset-x-0 flex flex-col items-center justify-center gap-3 z-20">
                  <button
                    type="button"
                    onClick={isRecording ? stopLiveRecording : startLiveRecording}
                    className="relative flex items-center justify-center active:scale-90 transition-transform"
                    title={isRecording ? "Stop Recording" : "Start Live Recording"}
                  >
                    {/* Outer Ring */}
                    <div
                      className={`h-20 w-20 rounded-full border-4 flex items-center justify-center transition-all ${
                        isRecording
                          ? "border-rose-500 scale-110 shadow-lg shadow-rose-500/50"
                          : "border-white/90 hover:border-rose-400"
                      }`}
                    >
                      {/* Inner Button */}
                      <div
                        className={`transition-all ${
                          isRecording
                            ? "h-8 w-8 rounded-lg bg-rose-500"
                            : "h-14 w-14 rounded-full bg-rose-500 shadow-md"
                        }`}
                      />
                    </div>
                  </button>
                  <p className="text-[11px] font-bold text-white/70 drop-shadow">
                    {isRecording ? "Tap square to stop & edit" : "Tap red circle to record workout reel"}
                  </p>
                </div>
              </div>
            ) : (
              /* State 1B: Gallery Picker */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 text-center cursor-pointer group h-full w-full"
              >
                <div className="h-20 w-20 rounded-full bg-cyan-500/10 border-2 border-dashed border-cyan-400/50 flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:border-cyan-400 transition mb-4 shadow-xl">
                  <Upload className="h-8 w-8 stroke-[1.8]" />
                </div>
                <h4 className="text-base font-black text-white">Choose Video or Photo</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                  Select workout clips or gym progress photos from your device gallery.
                </p>
                <button
                  type="button"
                  className="mt-5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-4 py-2 text-xs shadow-lg active:scale-95 transition"
                >
                  Browse Device Gallery
                </button>
              </div>
            )
          ) : (
            /* ================= STATE 2: EDITING SUITE ================= */
            <div className="relative h-full w-full flex items-center justify-center group">
              {mediaType === "video" ? (
                <video
                  ref={recordedVideoPlayerRef}
                  src={mediaUrl}
                  autoPlay
                  loop
                  playsInline
                  onClick={togglePlay}
                  className={`h-full w-full object-cover cursor-pointer ${selectedFilter.class}`}
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt=""
                  className={`h-full w-full object-cover ${selectedFilter.class}`}
                />
              )}

              {/* Play / Pause Toggle Indicator */}
              {mediaType === "video" && !isPlaying && (
                <div
                  onClick={togglePlay}
                  className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white cursor-pointer backdrop-blur"
                >
                  <Play className="h-7 w-7 fill-current ml-1" />
                </div>
              )}

              {/* Floating Badge Sticker Overlay (Tap to Cycle) */}
              <div
                onClick={cycleBadge}
                className="absolute top-4 self-center cursor-pointer select-none active:scale-95 transition z-10"
                title="Tap to change badge sticker"
              >
                <span className="inline-block rounded-xl border border-cyan-400/60 bg-black/75 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-cyan-300 shadow-xl backdrop-blur-md">
                  {selectedBadge}
                </span>
              </div>

              {/* Floating Right-Side Editing Tools Column */}
              <div className="absolute right-3 top-16 flex flex-col gap-2.5 z-20">
                <button
                  onClick={() => {
                    tapFeedback();
                    setActiveDrawer((prev) => (prev === "caption" ? "none" : "caption"));
                  }}
                  className={`h-9 w-9 rounded-full flex items-center justify-center shadow-lg backdrop-blur transition active:scale-90 ${
                    activeDrawer === "caption" ? "bg-cyan-500 text-black font-black" : "bg-black/60 text-white"
                  }`}
                  title="Add Caption"
                >
                  <TypeIcon className="h-4 w-4" />
                </button>

                <button
                  onClick={() => {
                    tapFeedback();
                    setActiveDrawer((prev) => (prev === "filters" ? "none" : "filters"));
                  }}
                  className={`h-9 w-9 rounded-full flex items-center justify-center shadow-lg backdrop-blur transition active:scale-90 ${
                    activeDrawer === "filters" ? "bg-cyan-500 text-black" : "bg-black/60 text-white"
                  }`}
                  title="Aesthetic Filters"
                >
                  <Sparkles className="h-4 w-4" />
                </button>

                <button
                  onClick={() => {
                    tapFeedback();
                    setActiveDrawer((prev) => (prev === "speed" ? "none" : "speed"));
                  }}
                  className={`h-9 w-9 rounded-full flex items-center justify-center shadow-lg backdrop-blur transition active:scale-90 ${
                    activeDrawer === "speed" ? "bg-cyan-500 text-black" : "bg-black/60 text-white"
                  }`}
                  title="Playback Speed"
                >
                  <Gauge className="h-4 w-4" />
                </button>

                <button
                  onClick={() => {
                    tapFeedback();
                    setActiveDrawer((prev) => (prev === "badges" ? "none" : "badges"));
                  }}
                  className={`h-9 w-9 rounded-full flex items-center justify-center shadow-lg backdrop-blur transition active:scale-90 ${
                    activeDrawer === "badges" ? "bg-cyan-500 text-black" : "bg-black/60 text-white"
                  }`}
                  title="Badge Stickers"
                >
                  <Tag className="h-4 w-4" />
                </button>

                <button
                  onClick={() => {
                    tapFeedback();
                    setActiveDrawer((prev) => (prev === "audio" ? "none" : "audio"));
                  }}
                  className={`h-9 w-9 rounded-full flex items-center justify-center shadow-lg backdrop-blur transition active:scale-90 ${
                    activeDrawer === "audio" ? "bg-cyan-500 text-black" : "bg-black/60 text-white"
                  }`}
                  title="Audio Soundtrack"
                >
                  <Music className="h-4 w-4" />
                </button>

                {/* Retake / Discard button */}
                <button
                  onClick={handleRetake}
                  className="h-9 w-9 rounded-full bg-rose-600/80 text-white flex items-center justify-center shadow-lg backdrop-blur transition active:scale-90"
                  title="Retake / Discard"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>

              {/* Bottom Caption Overlay Preview */}
              <div className="absolute bottom-2 inset-x-3 pointer-events-none text-white p-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
                <p className="text-xs font-bold line-clamp-2 leading-tight">
                  {caption || "Write a caption..."}
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-semibold truncate max-w-[200px]">
                    <Music className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{selectedTrack}</span>
                  </div>
                  {selectedSpeed !== 1.0 && (
                    <span className="text-amber-400 font-mono font-bold bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/30">
                      {selectedSpeed}x
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input for Gallery Selection */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* ----------------- BOTTOM CONTEXTUAL TOOL DRAWER ----------------- */}
        <div className="bg-gradient-to-t from-black via-zinc-950 to-zinc-950/95 border-t border-white/10 p-3 z-20">
          {activeDrawer === "caption" && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span>Reel Caption</span>
                <button onClick={() => setActiveDrawer("none")} className="text-cyan-400">Done</button>
              </div>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write caption... #fitness #pushup"
                maxLength={120}
                className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                autoFocus
              />
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {["Form check 90°", "New PR crushed!", "Strict tempo reps", "Pain cave survivor"].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setCaption(chip);
                    }}
                    className="shrink-0 rounded-lg bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-slate-300 hover:text-white"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDrawer === "filters" && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span>Aesthetic Color Grading</span>
                <button onClick={() => setActiveDrawer("none")} className="text-cyan-400">Done</button>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      tapFeedback();
                      setSelectedFilter(f);
                    }}
                    className={`flex flex-col items-center gap-1 shrink-0 p-1 rounded-xl transition ${
                      selectedFilter.id === f.id ? "bg-white/15 scale-105" : "opacity-60"
                    }`}
                  >
                    <div className={`h-9 w-9 rounded-full border-2 ${f.previewBg}`} />
                    <span className="text-[10px] font-bold text-white">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDrawer === "speed" && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span>Video Playback Speed</span>
                <button onClick={() => setActiveDrawer("none")} className="text-cyan-400">Done</button>
              </div>
              <div className="grid grid-cols-4 gap-2 py-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleSpeedSelect(s.value)}
                    className={`py-2 rounded-xl text-xs font-mono font-bold transition ${
                      selectedSpeed === s.value
                        ? "bg-cyan-500 text-slate-950 font-black shadow-md"
                        : "bg-white/10 text-white/70 hover:bg-white/15"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDrawer === "badges" && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span>Workout Badge Overlay</span>
                <button onClick={() => setActiveDrawer("none")} className="text-cyan-400">Done</button>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {BADGES.map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      tapFeedback();
                      setSelectedBadge(b);
                    }}
                    className={`shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-black uppercase transition ${
                      selectedBadge === b
                        ? "bg-cyan-500 text-black"
                        : "bg-white/10 text-slate-300 hover:bg-white/15"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDrawer === "audio" && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span>Soundtrack Overlay</span>
                <button onClick={() => setActiveDrawer("none")} className="text-cyan-400">Done</button>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {TRACKS.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      tapFeedback();
                      setSelectedTrack(t);
                    }}
                    className={`shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-bold transition ${
                      selectedTrack === t
                        ? "bg-amber-400 text-black font-black"
                        : "bg-white/10 text-slate-300 hover:bg-white/15"
                    }`}
                  >
                    🎵 {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDrawer === "none" && mediaUrl && (
            <div className="flex items-center justify-around py-1">
              <button
                onClick={() => {
                  tapFeedback();
                  setActiveDrawer("caption");
                }}
                className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-white"
              >
                <TypeIcon className="h-4 w-4" />
                <span>Text</span>
              </button>

              <button
                onClick={() => {
                  tapFeedback();
                  setActiveDrawer("filters");
                }}
                className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-white"
              >
                <Sparkles className="h-4 w-4" />
                <span>Filters</span>
              </button>

              <button
                onClick={() => {
                  tapFeedback();
                  setActiveDrawer("speed");
                }}
                className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-white"
              >
                <Gauge className="h-4 w-4" />
                <span>Speed</span>
              </button>

              <button
                onClick={() => {
                  tapFeedback();
                  setActiveDrawer("badges");
                }}
                className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-white"
              >
                <Tag className="h-4 w-4" />
                <span>Stickers</span>
              </button>

              <button
                onClick={() => {
                  tapFeedback();
                  setActiveDrawer("audio");
                }}
                className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-white"
              >
                <Music className="h-4 w-4" />
                <span>Audio</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
