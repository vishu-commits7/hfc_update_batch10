import { useCallback, useSyncExternalStore } from "react";
import { en, type TKey } from "./en";
import { hi } from "./hi";

/**
 * Two languages: English (the source of truth) and Hindi.
 * - Every user-visible string on the main screens is a key in en.ts. A missing Hindi string falls back to English.
 * - Placeholders look like {name}. Use t("key", { name: "x" }).
 * - Hindi lines a native speaker should check are listed in hi.ts (REVIEW) and in HINDI_REVIEW.md (npm run i18n:check).
 * - The app starts in English. The person picks Hindi on the first screens or in Settings; the choice is remembered.
 */
export type Lang = "en" | "hi";
export type { TKey };
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
];

const KEY = "ap_lang";
const listeners = new Set<() => void>();

function load(): Lang {
  try { const v = localStorage.getItem(KEY); return v === "hi" ? "hi" : "en"; } catch { return "en"; }
}
let current: Lang = typeof window === "undefined" ? "en" : load();
if (typeof document !== "undefined") document.documentElement.lang = current;

export const getLang = (): Lang => current;

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  if (typeof document !== "undefined") document.documentElement.lang = l;
  listeners.forEach(f => f());
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

const fill = (s: string, params?: Record<string, string | number>) =>
  params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s;

/** Translate outside React (error messages, notifications). Prefer useT() inside components so they re-render on a language change. */
export function t(key: TKey, params?: Record<string, string | number>): string {
  const table = current === "hi" ? (hi as Partial<Record<TKey, string>>) : undefined;
  return fill(table?.[key] ?? en[key] ?? key, params);
}

/** Splits a line around its one {placeholder}, so the caller can style that part (a bold name, an email). */
export function tSplit(key: TKey, name: string): [string, string] {
  const raw = (current === "hi" ? (hi as Partial<Record<TKey, string>>)[key] : undefined) ?? en[key] ?? key;
  const i = raw.indexOf(`{${name}}`);
  return i < 0 ? [raw, ""] : [raw.slice(0, i), raw.slice(i + name.length + 2)];
}

export function useLang(): [Lang, (l: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, getLang, () => "en" as Lang);
  return [lang, setLang];
}

/** The translate function for a component; it re-renders when the language changes. */
export function useT() {
  const lang = useSyncExternalStore(subscribe, getLang, () => "en" as Lang);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(t, [lang]);
}
