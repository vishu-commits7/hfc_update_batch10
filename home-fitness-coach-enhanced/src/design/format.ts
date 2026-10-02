/**
 * Display formatters.
 *
 * Centralised because the same number was previously rendered three
 * different ways on three different screens (`1240`, `1,240`, `1.2k`),
 * which quietly undermines trust in the numbers themselves.
 */

/** `147` → `"147"`, `1240` → `"1,240"`. Locale-aware grouping. */
export function grouped(n: number): string {
  return Math.round(n).toLocaleString();
}

/**
 * Compact form for tiles where width is constrained.
 * `940` → `"940"`, `1240` → `"1.2k"`, `18400` → `"18k"`.
 */
export function compact(n: number): string {
  const v = Math.round(n);
  if (v < 1000) return String(v);
  if (v < 10_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (v < 1_000_000) return `${Math.round(v / 1000)}k`;
  return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

/** Seconds → `"04:37"`. Always two-digit minutes so the clock never reflows. */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** Minutes → `"1h 24m"` / `"47m"`. */
export function duration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

/** `"2026-09-19T..."` → `"Fri 19 Sep"`. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Human relative time, capped at a week before falling back to a date. */
export function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return shortDate(iso);
}

/** `"YYYY-MM-DD"` in local time — not `toISOString()`, which is UTC and
 *  silently shifts a late-evening workout onto the following day. */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Clamp helper used by every progress calculation in the app. */
export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** Safe ratio — returns 0 rather than NaN/Infinity when the divisor is 0. */
export function ratio(part: number, whole: number): number {
  if (!whole || !Number.isFinite(whole)) return 0;
  const r = part / whole;
  return Number.isFinite(r) ? clamp(r) : 0;
}
