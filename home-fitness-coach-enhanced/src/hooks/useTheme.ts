import { useCallback, useEffect, useState } from "react";

export type Theme = "obsidian" | "daylight";
export type ThemeMode = "system" | "light" | "dark";

const MODE_KEY = "hfc_theme_mode";
const LEGACY_KEY = "hfc_theme";

function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "obsidian";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "obsidian" : "daylight";
}

function readMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    /* storage unavailable */
  }
  // Follow the phone's appearance by default. (Earlier builds stored an
  // explicit choice under a different key; that is deliberately not carried
  // over, since most people never picked it and ended up stuck in light.)
  return "system";
}

function resolve(mode: ThemeMode): Theme {
  if (mode === "light") return "daylight";
  if (mode === "dark") return "obsidian";
  return systemTheme();
}

/**
 * Theme state, mirrored onto `<html>` as a class.
 *
 * The app follows the device's light/dark setting by default and re-skins
 * live when it changes. An explicit override lives in Settings → Appearance.
 * index.html applies the same logic before first paint so there is no flash.
 */
export function useTheme(): [Theme, (next?: unknown) => void, ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const [theme, setTheme] = useState<Theme>(() => resolve(readMode()));

  // Re-resolve when the mode changes, or when the OS flips while on "system".
  useEffect(() => {
    setTheme(resolve(mode));
    if (mode !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(mq.matches ? "obsidian" : "daylight");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-obsidian", "theme-daylight");
    root.classList.add(`theme-${theme}`);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "daylight" ? "#f4f5f7" : "#0a0a0c");
    try {
      localStorage.setItem(LEGACY_KEY, theme);
    } catch {
      /* storage disabled — the theme still applies for this session */
    }
  }, [theme]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(
    (next?: unknown) => {
      if (next === "obsidian") return setMode("dark");
      if (next === "daylight") return setMode("light");
      setMode(resolve(mode) === "obsidian" ? "light" : "dark");
    },
    [mode, setMode],
  );

  return [theme, toggle, mode, setMode];
}
