import { useEffect, useState } from "react";

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
  ring?: boolean;
}

/** Round avatar that falls back to a coloured initial instead of a broken image. */
export default function Avatar({ src, name = "A", size = 40, className = "", ring = false }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initial = (name.trim()[0] || "A").toUpperCase();
  const hue = [...name].reduce((a, c) => (a + c.charCodeAt(0)) % 360, 0);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-graphite ${ring ? "ring-2 ring-volt/70" : "border border-line"} ${className}`}
      style={{ width: size, height: size }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-bold text-white"
          style={{ background: `hsl(${hue} 45% 32%)`, fontSize: Math.max(11, size * 0.42) }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}
