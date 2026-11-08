/**
 * Bridge to the in-app Android plugin (android/.../ApexNativePlugin.java).
 *
 * `share()` opens the real OS share sheet (WhatsApp, Instagram, Messages…)
 * with text, a link and an optional image. Before this existed every
 * "Share" button fell back to copying text to the clipboard inside the
 * WebView, because navigator.share is not dependable there.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

interface ApexNativePlugin {
  share(opts: {
    title?: string;
    text?: string;
    url?: string;
    fileBase64?: string;
    fileName?: string;
    mimeType?: string;
  }): Promise<void>;
  googleSignIn(opts: { serverClientId: string }): Promise<{
    idToken: string;
    email?: string;
    displayName?: string;
    photoUrl?: string | null;
  }>;
}

export const ApexNative = registerPlugin<ApexNativePlugin>("ApexNative");

export const isNative = () => Capacitor.isNativePlatform();

/** Public page people land on from a shared link. */
export const APP_SHARE_URL: string =
  (import.meta.env.VITE_APP_SHARE_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "";

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export interface ShareInput {
  title?: string;
  text?: string;
  url?: string;
  /** PNG/JPEG image to attach. */
  blob?: Blob;
  fileName?: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

/**
 * One share entry point for the whole app.
 * Native → Android share sheet. Web → navigator.share. Last resort → copy.
 */
export async function shareContent(input: ShareInput): Promise<ShareResult> {
  const { title = "Apex Pulse", text = "", blob } = input;
  const url =
    input.url && /^https?:\/\//.test(input.url) && !/^https?:\/\/localhost/.test(input.url)
      ? input.url
      : APP_SHARE_URL;
  const fileName = input.fileName || "apex-pulse.png";

  if (isNative()) {
    try {
      await ApexNative.share({
        title,
        text,
        url,
        fileBase64: blob ? await blobToBase64(blob) : undefined,
        fileName,
        mimeType: blob?.type || "image/png",
      });
      return "shared";
    } catch {
      /* plugin missing (old APK) — fall through to web paths */
    }
  }

  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      if (blob) {
        const file = new File([blob], fileName, { type: blob.type || "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title, text, files: [file] });
          return "shared";
        }
      }
      await navigator.share({ title, text, url });
      return "shared";
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "cancelled";
  }

  try {
    await navigator.clipboard?.writeText([text, url].filter(Boolean).join(" "));
    return "copied";
  } catch {
    return "failed";
  }
}
