import React from "react";

/**
 * A proper illustrated athlete figure — not a stick-figure line drawing —
 * built entirely from vector shapes (no image/photo assets, so every one
 * of the 39 exercises gets a demo at zero extra download size). Two full
 * body variants (male / female) share the exact same joint coordinates
 * as the original stick-figure rig (head 180,36 · shoulder 180,68 ·
 * hip 180,112 · hands 132/228,95 · feet 145/215,177).
 *
 * v2: real elbow and knee joints. Each limb used to be one rigid straight
 * rod rotated as a whole from the shoulder/hip — fine for a limb that just
 * swings (a jumping-jack arm, a mountain-climber leg) but it meant a squat
 * or a push-up could only rotate or squash the *entire* leg/arm, which
 * reads as stiff and "off". Now every limb is two nested pieces:
 *   leg  = <g leg-l  (hip pivot)>  thigh  → <g knee-l  (knee pivot)>  shin+foot
 *   arm  = <g arm-l  (shoulder pivot)> upper-arm → <g elbow-l (elbow pivot)> forearm+hand
 * The knee/elbow sit at the exact midpoint of the old straight hip→foot /
 * shoulder→hand line, so with no extra transform applied the figure is
 * still pixel-identical to the old rig — every existing whole-limb-swing
 * animation (jacks, mountain climbers, skater hops, bird-dog reaches,
 * sway stretches, deadbug, the generic fallback) keeps working completely
 * unchanged. The new inner `.motion-knee-*` / `.motion-elbow-*` classes
 * are additive — only the exercises that actually need a bend (squats,
 * lunges, push-ups, curls, dips, ...) use them.
 */

export type FigureGender = "male" | "female" | "neutral";

const SKIN = "#e3ab7d";
const HAIR = "#241a15";
const SHORTS = "#20242f";
const SHOE = "#f4f7fb";
const SHOE_ACCENT = "#d4ff00";

function Hair({ gender }: { gender: FigureGender }) {
  if (gender === "female") {
    return (
      <>
        {/* Long hair framing the face + a small ponytail flick */}
        <path d="M162 24 Q180 8 198 24 Q202 40 197 58 Q193 46 189 42 Q192 30 180 26 Q168 30 171 42 Q167 46 163 58 Q158 40 162 24 Z" fill={HAIR} />
        <path d="M196 30 Q210 34 206 50 Q202 44 195 40 Z" fill={HAIR} />
      </>
    );
  }
  if (gender === "male") {
    return <path d="M164 26 Q180 12 196 26 Q196 19 180 17 Q164 19 164 26 Z" fill={HAIR} />;
  }
  // neutral / unspecified — short, simple, androgynous crop
  return <path d="M165 25 Q180 15 195 25 Q193 20 180 18.5 Q167 20 165 25 Z" fill={HAIR} />;
}

/** Torso silhouette as a single filled polygon (not a thick stroke) so male
 *  vs female body shape actually reads — broad boxy taper for male, a
 *  gentle waist nip + hip flare for female. Anchored to the same y=54..112
 *  span as the original line so all torso transforms line up unchanged. */
function torsoPath(gender: FigureGender): string {
  if (gender === "female") {
    return "M165 54 L195 54 L191 80 Q189 87 191 93 L197 112 L163 112 L169 93 Q171 87 169 80 Z";
  }
  if (gender === "male") {
    return "M158 54 L202 54 L198 90 Q199 101 202 112 L158 112 Q161 101 162 90 Z";
  }
  return "M162 54 L198 54 L195 90 L197 112 L163 112 L165 90 Z";
}

export default function HumanFigure({
  gender = "male",
  detailed = false,
  gradientId,
  skinGradientId,
}: {
  gender?: FigureGender;
  detailed?: boolean;
  gradientId?: string;
  skinGradientId?: string;
}) {
  const torsoFill = detailed && gradientId ? `url(#${gradientId})` : gender === "female" ? "#3a4256" : "#282e3d";
  const skinFill = detailed && skinGradientId ? `url(#${skinGradientId})` : SKIN;
  const limbStroke = skinFill;

  // Knee/elbow sit exactly at the midpoint of the old straight hip→foot and
  // shoulder→hand segments, so thigh+shin / upper-arm+forearm are perfectly
  // colinear at rest — zero visual change from the old single-rod rig until
  // an animation actually bends the joint.
  const kneeL = { x: 162.5, y: 144.5 };
  const kneeR = { x: 197.5, y: 144.5 };
  const elbowL = { x: 156, y: 81.5 };
  const elbowR = { x: 204, y: 81.5 };

  return (
    <>
      {/* --- Legs (drawn first so torso/arms overlap them at the hip) --- */}
      <g className="motion-leg-l" style={{ transformOrigin: "180px 112px" }}>
        {/* Shorts segment: hip -> ~25% down the thigh. Kept short on purpose —
            a longer shorts segment visually fused into a "skirt" blob once
            the legs rotated wide apart (jumping jacks, jump squats, skater
            hops), since the two hip-anchored triangles overlapped at rest. */}
        <path d="M180 112 L171 128" className="motion-line motion-thigh" style={{ stroke: SHORTS, strokeWidth: 26 }} />
        {/* Thigh skin: shorts-hem -> knee */}
        <path d={`M171 128 L${kneeL.x} ${kneeL.y}`} className="motion-line motion-thigh" style={{ stroke: limbStroke, strokeWidth: 19 }} />
        <g className="motion-knee-l" style={{ transformOrigin: `${kneeL.x}px ${kneeL.y}px` }}>
          <path d={`M${kneeL.x} ${kneeL.y} L145 177`} className="motion-line motion-shin" style={{ stroke: limbStroke, strokeWidth: 18 }} />
          <ellipse cx="145" cy="180" rx="12" ry="7" className="motion-foot" style={{ fill: SHOE }} />
          <ellipse cx="145" cy="182" rx="7" ry="3" className="motion-foot" style={{ fill: SHOE_ACCENT }} />
        </g>
      </g>
      <g className="motion-leg-r" style={{ transformOrigin: "180px 112px" }}>
        <path d="M180 112 L189 128" className="motion-line motion-thigh" style={{ stroke: SHORTS, strokeWidth: 26 }} />
        <path d={`M189 128 L${kneeR.x} ${kneeR.y}`} className="motion-line motion-thigh" style={{ stroke: limbStroke, strokeWidth: 19 }} />
        <g className="motion-knee-r" style={{ transformOrigin: `${kneeR.x}px ${kneeR.y}px` }}>
          <path d={`M${kneeR.x} ${kneeR.y} L215 177`} className="motion-line motion-shin" style={{ stroke: limbStroke, strokeWidth: 18 }} />
          <ellipse cx="215" cy="180" rx="12" ry="7" className="motion-foot" style={{ fill: SHOE }} />
          <ellipse cx="215" cy="182" rx="7" ry="3" className="motion-foot" style={{ fill: SHOE_ACCENT }} />
        </g>
      </g>

      {/* --- Upper body: arms + torso + head share ONE pivot (the hip,
          180,112 — the exact same point the legs pivot around). Any pose
          that needs to lean/tilt the whole upper half (a push-up, a plank,
          a dip, an incline press) rotates *this* wrapper as one rigid
          piece instead of rotating the torso alone around its own
          mid-point. That one change is what stops the torso, head and
          arm sockets from visibly drifting apart from each other — and
          from the legs — the moment any of those poses tilts the body;
          previously each part spun around a different, unrelated pivot,
          so a "plank" pose left a visible seam/gap at the hip and a
          floating head. Standing exercises never rotate this wrapper, so
          nothing here changes their look at all. */}
      <g className="motion-upper-body" style={{ transformOrigin: "180px 112px" }}>
        {/* --- Arms (behind torso at the shoulder, hands on top) --- */}
        <g className="motion-arm-l" style={{ transformOrigin: "180px 68px" }}>
          <path d={`M180 68 L${elbowL.x} ${elbowL.y}`} className="motion-line motion-upperarm" style={{ stroke: limbStroke, strokeWidth: 18 }} />
          <g className="motion-elbow-l" style={{ transformOrigin: `${elbowL.x}px ${elbowL.y}px` }}>
            <path d={`M${elbowL.x} ${elbowL.y} L132 95`} className="motion-line motion-forearm" style={{ stroke: limbStroke, strokeWidth: 16 }} />
            <circle cx="132" cy="95" r="8.5" className="motion-hand" style={{ fill: limbStroke }} />
          </g>
        </g>
        <g className="motion-arm-r" style={{ transformOrigin: "180px 68px" }}>
          <path d={`M180 68 L${elbowR.x} ${elbowR.y}`} className="motion-line motion-upperarm" style={{ stroke: limbStroke, strokeWidth: 18 }} />
          <g className="motion-elbow-r" style={{ transformOrigin: `${elbowR.x}px ${elbowR.y}px` }}>
            <path d={`M${elbowR.x} ${elbowR.y} L228 95`} className="motion-line motion-forearm" style={{ stroke: limbStroke, strokeWidth: 16 }} />
            <circle cx="228" cy="95" r="8.5" className="motion-hand" style={{ fill: limbStroke }} />
          </g>
        </g>

        {/* --- Torso (filled silhouette, not a line) --- */}
        <path d={torsoPath(gender)} className="motion-line motion-torso" style={{ fill: torsoFill, stroke: "none" }} />

        {/* --- Head + hair --- */}
        <g className="motion-head">
          <circle cx="180" cy="36" r="16" style={{ fill: skinFill, stroke: "none" }} />
          <Hair gender={gender} />
        </g>
      </g>
    </>
  );
}
