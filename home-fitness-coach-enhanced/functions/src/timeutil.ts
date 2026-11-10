/** Day / week keys in Indian Standard Time (the app's home timezone). */
const IST_OFFSET_MS = 5.5 * 3600_000;
const pad = (n: number) => String(n).padStart(2, "0");

function istDate(ms: number) { return new Date(ms + IST_OFFSET_MS); }

/** YYYY-MM-DD in IST. */
export function dayKeyIST(ms = Date.now()): string {
  const d = istDate(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** ISO week id (weeks run Monday to Sunday) in IST, e.g. 2026-W45. */
export function weekIdIST(ms = Date.now()): string {
  const d = istDate(ms);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

/** ISO week id (Monday to Sunday) of a YYYY-MM-DD calendar day, e.g. 2026-W46. Same numbering as weekIdIST. */
export function weekIdOfDay(dayKey: string): string {
  return weekIdIST(Date.parse(`${dayKey}T00:00:00+05:30`));
}
