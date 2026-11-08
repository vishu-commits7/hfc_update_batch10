import { useEffect, useRef } from "react";
import { Loader2, VideoOff } from "lucide-react";
import type { DuelVideoState } from "../lib/duelVideo";

function Stream({ stream, mirror, muted = true, className }: { stream: MediaStream | null; mirror?: boolean; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = stream;
    if (stream) v.play().catch(() => {});
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${className ?? ""} ${mirror ? "-scale-x-100" : ""}`} />;
}

export default function DuelVideo({
  local, remote, state, error, oppName, compact,
}: {
  local: MediaStream | null;
  remote: MediaStream | null;
  state: DuelVideoState;
  error: string | null;
  oppName: string;
  compact?: boolean;
}) {
  if (state === "off") return null;
  return (
    <div className={`relative w-full overflow-hidden rounded-3xl border border-line bg-carbon ${compact ? "aspect-[4/3]" : "aspect-[3/4]"}`}>
      {remote ? (
        <Stream stream={remote} muted className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
          {state === "error" ? <VideoOff className="h-7 w-7 text-ink-3" /> : <Loader2 className="h-6 w-6 animate-spin text-ink-3" />}
          <p className="text-xs font-semibold text-ink-2">
            {state === "error" ? error : state === "starting" ? "Starting camera…" : state === "waiting" ? "Waiting for your opponent to join…" : `Connecting to ${oppName}…`}
          </p>
        </div>
      )}
      {local && (
        <div className="absolute bottom-2 right-2 h-28 w-20 overflow-hidden rounded-xl border-2 border-white/30 bg-black shadow-lg">
          <Stream stream={local} mirror muted className="h-full w-full object-cover" />
        </div>
      )}
      {state === "live" && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">● LIVE · {oppName}</span>}
    </div>
  );
}
