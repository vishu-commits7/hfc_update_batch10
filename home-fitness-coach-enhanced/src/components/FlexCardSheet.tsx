import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, Download, Share2, X } from "lucide-react";
import {
  renderFlexCard,
  shareFlexCard,
  type FlexCardData,
  type FlexCardShape,
} from "../lib/flexCard";
import { successFeedback, tapFeedback } from "../lib/haptics";
import { MagneticButton } from "./ui";
import { dialogVariants, scrimVariants } from "../design/motion";

/**
 * Preview and share sheet for the card.
 *
 * Renders the real PNG — not a CSS mock of it — so what the user approves
 * is byte-identical to what lands in their story. A preview that only
 * approximates the export is how people end up posting something they did
 * not expect.
 *
 * Portalled to `document.body`: every screen in this app is wrapped in an
 * element that animates `opacity`, and any opacity below 1 creates a
 * stacking context, so a z-index set inside a screen cannot rise above the
 * tab bar at the document root.
 */
export default function FlexCardSheet({
  data,
  shareText,
  onClose,
}: {
  data: FlexCardData;
  /** Caption pre-filled in the OS share sheet. */
  shareText: string;
  onClose: () => void;
}) {
  const [shape, setShape] = useState<FlexCardShape>("story");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"shared" | "downloaded" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The rendered blob, kept so sharing does not redraw the card and risk
  // handing over an image the user never saw.
  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setError(null);

    renderFlexCard(data, shape)
      .then((blob) => {
        if (cancelled) return;
        blobRef.current = blob;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(blob);
        setPreview(urlRef.current);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not build the card.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [data, shape]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onShare = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob || busy) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await shareFlexCard(
        blob,
        `${data.kind}-${Date.now()}.png`,
        shareText,
      );
      if (outcome !== "cancelled") {
        successFeedback();
        setDone(outcome);
        // Long enough to register, short enough not to trap the user in a
        // confirmation state they have to dismiss.
        setTimeout(() => setDone(null), 2400);
      }
    } catch {
      setError("Sharing failed. You can still save the image.");
    } finally {
      setBusy(false);
    }
  }, [busy, data.kind, shareText]);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="scrim"
        variants={scrimVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        onClick={onClose}
        className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      >
        <motion.div
          variants={dialogVariants}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Share your result"
          className="surface w-full max-w-md overflow-y-auto rounded-t-[28px] sm:rounded-[28px]"
          style={{
            maxHeight: "92vh",
            paddingBottom: "calc(var(--safe-b, 0px) + 20px)",
          }}
        >
          <div className="flex items-center justify-between px-5 pt-5">
            <p className="eyebrow">Share</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-3"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Shape switch */}
          <div className="mx-5 mt-4 flex gap-1 rounded-lg2 border border-line p-1">
            {(["story", "square"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  tapFeedback();
                  setShape(s);
                }}
                aria-pressed={shape === s}
                className="flex-1 rounded-md2 py-2 text-[11px] font-bold capitalize transition-colors"
                style={{
                  background: shape === s ? "var(--graphite)" : "transparent",
                  color: shape === s ? "var(--ink)" : "var(--ink-3)",
                }}
              >
                {s === "story" ? "Story 9:16" : "Square 1:1"}
              </button>
            ))}
          </div>

          {/* Preview — the real PNG, scaled down */}
          {/* Sized by HEIGHT, not width. A 9:16 preview at full sheet
              width is ~660px tall on a phone, which pushed the Share
              button off the bottom of the sheet — the one control the
              whole screen exists for. */}
          <div className="mx-5 mt-4 flex justify-center">
            <div
              className="relative overflow-hidden rounded-xl2 border border-line bg-[var(--obsidian)]"
              style={{
                height: shape === "story" ? "46vh" : "34vh",
                aspectRatio: shape === "story" ? "9 / 16" : "1 / 1",
              }}
            >
              {preview ? (
                <motion.img
                  key={preview}
                  src={preview}
                  alt="Preview of the card you are about to share"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="text-[11px] font-bold text-ink-4">
                    {error ?? "Building your card…"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {error && preview && (
            <p className="mx-5 mt-3 text-[11px] font-semibold text-[var(--ember)]">
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-3 px-5">
            <MagneticButton
              type="button"
              size="xl"
              variant="ghost"
              tone="neutral"
              block
              className="border border-line"
              disabled={!preview}
              onClick={() => {
                const url = urlRef.current;
                if (!url) return;
                const a = document.createElement("a");
                a.href = url;
                a.download = `${data.kind}-${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
            >
              <Download className="h-4 w-4" />
              Save
            </MagneticButton>

            <MagneticButton
              type="button"
              size="xl"
              tone={data.kind === "streak" ? "emerald" : data.kind === "milestone" ? "gold" : "cyan"}
              block
              magnet={5}
              disabled={!preview || busy}
              onClick={onShare}
            >
              {done ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={3} />
                  {done === "shared" ? "Shared" : "Saved"}
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  {busy ? "Opening…" : "Share"}
                </>
              )}
            </MagneticButton>
          </div>

          <p className="mt-3 px-5 text-center text-[10px] leading-relaxed text-ink-4">
            Opens your phone's share sheet — Instagram, WhatsApp, anywhere.
            Nothing is uploaded; the image is made on your device.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
