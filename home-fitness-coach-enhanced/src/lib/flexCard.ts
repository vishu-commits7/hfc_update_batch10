/**
 * The share card.
 *
 * Renders a finished session, a streak or an unlocked milestone to a PNG
 * sized for Instagram Stories or a square feed post, then hands it to the
 * OS share sheet.
 *
 * ── Why canvas, and why nothing else ──────────────────────────────────
 *
 * The obvious approach is html2canvas or dom-to-image over a React
 * component. Both are wrong here. They add ~200KB, they re-implement CSS
 * badly (backdrop-filter, color-mix and CSS custom properties — which is
 * most of this app's design system — all render incorrectly or not at
 * all), and they produce a different image on every WebView version. A
 * share card is the one artefact in the app whose entire job is to look
 * identical everywhere it lands, so it is drawn explicitly.
 *
 * Nothing here touches the network, a backend or a third-party SDK. The
 * card is rendered on-device from data the app already has.
 */

export type FlexCardKind = "session" | "streak" | "milestone";
export type FlexCardShape = "story" | "square";

export interface FlexCardStat {
  label: string;
  value: string;
}

export interface FlexCardData {
  kind: FlexCardKind;
  /** Small line above the numeral: "12-day streak", "Session complete". */
  eyebrow: string;
  /** The hero numeral. Kept to 1–3 characters wherever possible. */
  value: string;
  /** Unit beside the numeral: "min", "days", "kcal". */
  unit?: string;
  /** The workout or achievement name. */
  title: string;
  /** Up to three supporting stats. */
  stats: FlexCardStat[];
  /** 0–1. Draws the ring; omit for kinds with nothing to complete. */
  progress?: number;
  /** App name in the footer. */
  brand?: string;
}

const PALETTE: Record<FlexCardKind, { accent: string; glow: string }> = {
  session: { accent: "#38d6ff", glow: "rgba(56, 214, 255, 0.45)" },
  streak: { accent: "#00e5a0", glow: "rgba(0, 229, 160, 0.45)" },
  milestone: { accent: "#ffc94a", glow: "rgba(255, 201, 74, 0.45)" },
};

const INK = "#f3f6fb";
const INK_DIM = "#737f95";
const VOID = "#04050a";
const CARBON = "#0f1219";

const FONT_STACK =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const SHAPES: Record<FlexCardShape, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

/* ------------------------------------------------------------------ */
/*  Drawing helpers                                                    */
/* ------------------------------------------------------------------ */

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/**
 * `letterSpacing` is Chrome 99+. Android WebView on a phone that predates
 * it would otherwise silently render tracked-out eyebrow text at default
 * spacing, which is a cosmetic difference rather than a broken card — so
 * this sets it when available and moves on when not.
 */
function setTracking(c: CanvasRenderingContext2D, px: number) {
  try {
    (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${px}px`;
  } catch {
    /* older WebView — default spacing */
  }
}

/** Shrinks the font until the text fits, rather than letting it overflow. */
function fitText(
  c: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  weight = 800,
): number {
  let px = startPx;
  c.font = `${weight} ${px}px ${FONT_STACK}`;
  while (c.measureText(text).width > maxWidth && px > 16) {
    px -= 4;
    c.font = `${weight} ${px}px ${FONT_STACK}`;
  }
  return px;
}

/* ------------------------------------------------------------------ */
/*  The card                                                           */
/* ------------------------------------------------------------------ */

export async function renderFlexCard(
  data: FlexCardData,
  shape: FlexCardShape = "story",
): Promise<Blob> {
  const { w, h } = SHAPES[shape];
  const { accent, glow } = PALETTE[data.kind];
  const brand = data.brand ?? "KINETIC";

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("This device could not open a 2D canvas.");

  // Web fonts are loaded asynchronously and canvas does not wait for them.
  // Drawing before they resolve silently falls back to the system font, so
  // the card would look different on a cold start than on a warm one.
  try {
    await document.fonts.ready;
  } catch {
    /* no font loading API — the stack falls back on its own */
  }

  /* ---- background ---- */
  const bg = c.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0a0d15");
  bg.addColorStop(1, VOID);
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);

  // Two blooms, off-centre and different sizes, so the light reads as
  // lighting rather than as a symmetrical vignette.
  const bloom = (cx: number, cy: number, r: number, alpha: number) => {
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, glow.replace(/[\d.]+\)$/, `${alpha})`));
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  };
  bloom(w * 0.24, h * 0.18, w * 0.85, 0.32);
  bloom(w * 0.84, h * 0.74, w * 0.7, 0.16);

  const pad = 96;
  const isStory = shape === "story";

  /* ---- brand ---- */
  c.textBaseline = "alphabetic";
  setTracking(c, 6);
  c.font = `800 30px ${FONT_STACK}`;
  c.fillStyle = accent;
  c.fillText(brand.toUpperCase(), pad, isStory ? 190 : 120);
  setTracking(c, 0);

  /* ---- the ring ---- */
  const ringCy = isStory ? h * 0.42 : h * 0.44;
  const ringR = isStory ? 300 : 240;
  const ringCx = w / 2;

  c.lineWidth = isStory ? 16 : 14;
  c.lineCap = "round";
  c.strokeStyle = "rgba(255,255,255,0.07)";
  c.beginPath();
  c.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
  c.stroke();

  if (data.progress !== undefined) {
    const p = Math.max(0, Math.min(1, data.progress));
    if (p > 0) {
      c.save();
      c.shadowColor = glow;
      c.shadowBlur = 40;
      c.strokeStyle = accent;
      c.beginPath();
      // Starts at twelve o'clock and runs clockwise, which is the only
      // direction a progress arc reads as progress.
      c.arc(ringCx, ringCy, ringR, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  /* ---- eyebrow ---- */
  c.textAlign = "center";
  setTracking(c, 5);
  c.font = `800 30px ${FONT_STACK}`;
  c.fillStyle = accent;
  c.fillText(data.eyebrow.toUpperCase(), ringCx, ringCy - (isStory ? 128 : 104));
  setTracking(c, 0);

  /* ---- hero numeral ---- */
  const heroPx = fitText(c, data.value, ringR * 1.5, isStory ? 300 : 240);
  c.save();
  c.shadowColor = glow;
  c.shadowBlur = 70;
  c.fillStyle = INK;
  c.font = `800 ${heroPx}px ${FONT_STACK}`;
  c.fillText(data.value, ringCx, ringCy + heroPx * 0.34);
  c.restore();

  /* ---- unit ---- */
  if (data.unit) {
    c.font = `700 40px ${FONT_STACK}`;
    c.fillStyle = INK_DIM;
    c.fillText(data.unit, ringCx, ringCy + (isStory ? 150 : 124));
  }

  /* ---- title ---- */
  const titlePx = fitText(c, data.title, w - pad * 2, isStory ? 64 : 52);
  c.fillStyle = INK;
  c.font = `800 ${titlePx}px ${FONT_STACK}`;
  c.fillText(data.title, ringCx, ringCy + ringR + (isStory ? 150 : 120));

  /* ---- stat tiles ---- */
  const stats = data.stats.slice(0, 3);
  if (stats.length) {
    const gap = 24;
    const tileW = (w - pad * 2 - gap * (stats.length - 1)) / stats.length;
    const tileH = isStory ? 190 : 160;
    const tileY = isStory ? h - 430 : h - 300;

    stats.forEach((s, i) => {
      const x = pad + i * (tileW + gap);
      c.fillStyle = CARBON;
      roundRect(c, x, tileY, tileW, tileH, 36);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.08)";
      c.lineWidth = 2;
      c.stroke();

      c.textAlign = "center";
      const cx = x + tileW / 2;

      const vPx = fitText(c, s.value, tileW - 40, 60);
      c.fillStyle = INK;
      c.font = `800 ${vPx}px ${FONT_STACK}`;
      c.fillText(s.value, cx, tileY + tileH * 0.52);

      setTracking(c, 3);
      c.font = `700 24px ${FONT_STACK}`;
      c.fillStyle = INK_DIM;
      c.fillText(s.label.toUpperCase(), cx, tileY + tileH - 36);
      setTracking(c, 0);
    });
  }

  /* ---- footer ---- */
  c.textAlign = "center";
  c.font = `600 26px ${FONT_STACK}`;
  c.fillStyle = "rgba(115,127,149,0.85)";
  c.fillText(
    `Tracked with ${brand.toLowerCase()}`,
    w / 2,
    isStory ? h - 150 : h - 70,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode the card."))),
      "image/png",
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Sharing                                                            */
/* ------------------------------------------------------------------ */

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Hands the card to the OS share sheet, falling back to a download.
 *
 * `navigator.share` with files needs a secure context and a user gesture.
 * Capacitor serves the Android app from `https://localhost`, so it is
 * available there; a plain http:// dev server is not, which is why the
 * download path exists rather than an error message.
 *
 * The cancel case matters: `navigator.share` rejects with an AbortError
 * when the user dismisses the sheet, and treating that as a failure would
 * show an error toast to somebody who simply changed their mind.
 */
export async function shareFlexCard(
  blob: Blob,
  filename: string,
  text: string,
): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    navigator.canShare?.({ files: [file] }) &&
    navigator.share
  ) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "cancelled";
      // Anything else — a share target that rejected the file, a WebView
      // quirk — falls through to the download rather than dead-ending.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download on some WebViews.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

/* ------------------------------------------------------------------ */
/*  Builders                                                           */
/* ------------------------------------------------------------------ */

export function sessionCard(opts: {
  title: string;
  minutes: number;
  moves: number;
  calories: number;
  /** Target area — "Full Body", "Core". Fills the third tile with
   *  something the hero numeral does not already say. */
  focus?: string;
  brand?: string;
}): FlexCardData {
  const stats: FlexCardStat[] = [
    { label: "Moves", value: String(opts.moves) },
    { label: "Kcal", value: String(opts.calories) },
  ];
  // Never restate the hero numeral in a tile. The first version of this
  // card put minutes in the hero AND in a tile, so a short session
  // rendered "1" three times, which reads as a rendering fault rather
  // than as emphasis.
  if (opts.focus) stats.push({ label: "Focus", value: opts.focus });

  return {
    kind: "session",
    eyebrow: "Session complete",
    value: String(opts.minutes),
    unit: opts.minutes === 1 ? "minute" : "minutes",
    title: opts.title,
    // A finished session is a closed ring, always. There is nothing left
    // to complete, and an empty circle behind the numeral reads as a
    // progress bar that failed to load.
    progress: 1,
    brand: opts.brand,
    stats,
  };
}

export function streakCard(opts: {
  days: number;
  best: number;
  sessions: number;
  brand?: string;
}): FlexCardData {
  return {
    kind: "streak",
    eyebrow: "Current streak",
    value: String(opts.days),
    unit: opts.days === 1 ? "day" : "days",
    title: opts.days >= opts.best ? "Personal best" : "Still going",
    // Against the personal best, so the ring says how close this run is to
    // beating it rather than filling arbitrarily.
    progress: opts.best > 0 ? Math.min(1, opts.days / opts.best) : 1,
    brand: opts.brand,
    // No "Days" tile: the hero numeral IS the day count, and repeating it
    // made a fresh user's card read "8 / 8 / 8".
    stats: [
      { label: "Best run", value: String(opts.best) },
      { label: "Sessions", value: String(opts.sessions) },
    ],
  };
}

export function milestoneCard(opts: {
  name: string;
  detail: string;
  unlocked: number;
  total: number;
  brand?: string;
}): FlexCardData {
  return {
    kind: "milestone",
    eyebrow: "Unlocked",
    value: `${opts.unlocked}`,
    unit: `of ${opts.total} milestones`,
    title: opts.name,
    progress: opts.total > 0 ? opts.unlocked / opts.total : 0,
    brand: opts.brand,
    // The achievement's name is already the title. The tile carries the
    // collection progress, which is the part worth bragging about.
    stats: [
      { label: "Unlocked", value: `${opts.unlocked}/${opts.total}` },
      { label: opts.detail, value: "\u2713" },
    ],
  };
}
