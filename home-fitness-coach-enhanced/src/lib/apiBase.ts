/**
 * Where to send API calls (currently just AI workout generation).
 *
 * In the browser dev/preview flow this stays empty, so `fetch("/api/...")`
 * hits this same origin's Express server (see server.ts) exactly as before.
 *
 * Inside the installed Android/iOS app there is no server running on the
 * device at all — the app only ships the compiled frontend — so a relative
 * `/api/...` call resolves to nothing and the WebView hands back its own
 * index.html instead of JSON (the "Unexpected token '<'... not valid JSON"
 * error). `VITE_API_BASE_URL` points those same calls at a real backend
 * deployed somewhere reachable from the phone (Render, Railway, Cloud Run,
 * etc.) instead. Set it in `.env` before running `npm run build` — Vite
 * bakes it into the compiled app at build time.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

// Sent alongside API requests when the backend has API_SHARED_SECRET
// configured — see the comment on `checkSharedSecret` in server.ts for what
// this does and doesn't protect against. Harmless to leave unset.
const APP_SECRET = import.meta.env.VITE_API_SHARED_SECRET as string | undefined;

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(APP_SECRET ? { "x-app-secret": APP_SECRET } : {}),
    ...extra,
  };
}

/**
 * Parses a fetch Response as JSON, but fails with a clear, specific error
 * instead of the cryptic "Unexpected token '<'... is not valid JSON" when
 * the server returns HTML (a 404 page, a cold-start timeout page, or — on
 * a misconfigured native build — the app's own index.html).
 */
export async function parseJsonResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    const hint = !API_BASE_URL
      ? " No backend URL is configured for this build (VITE_API_BASE_URL is empty) — this only works when a matching dev/production server is reachable at the same origin."
      : ` Backend URL in use: ${API_BASE_URL}`;
    throw new Error(
      `Server didn't return JSON (got "${contentType || "unknown"}", status ${response.status}).${hint} First bit of the response: ${text.slice(0, 120)}`
    );
  }
  return response.json();
}
