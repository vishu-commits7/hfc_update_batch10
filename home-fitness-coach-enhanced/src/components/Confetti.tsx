import React, { useMemo } from "react";

const COLORS = ["#D4FF00", "#3B82F6", "#F472B6", "#34D399", "#FBBF24", "#818CF8"];

/**
 * A lightweight, dependency-free confetti burst. Pure CSS animation over a
 * handful of absolutely-positioned divs — no canvas, no external library.
 * Mount when `active` becomes true; the parent should unmount it again
 * after ~2.5s (a timeout is convenient) since the pieces don't loop.
 */
export default function Confetti({ active }: { active: boolean }) {
  const pieces = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.8 + Math.random() * 1.2,
    color: COLORS[i % COLORS.length],
    rotate: Math.random() * 360,
    drift: (Math.random() - 0.5) * 160,
    size: 6 + Math.random() * 6,
    isCircle: Math.random() > 0.5,
  })), [active]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[95] overflow-hidden" aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: "-5%",
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? "50%" : "2px",
            animation: `confetti-fall ${p.duration}s cubic-bezier(0.4,0,0.6,1) ${p.delay}s forwards`,
            // @ts-ignore custom property consumed by the keyframe below
            "--drift": `${p.drift}px`,
            "--rotate": `${p.rotate}deg`,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--drift), 115vh) rotate(var(--rotate)); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
