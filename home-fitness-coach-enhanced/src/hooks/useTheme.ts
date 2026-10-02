import { useCallback, useEffect, useState } from "react";

export type Theme = "obsidian" | "daylight";

const STORAGE_KEY = "hfc_theme";

/**
 * Theme state, mirrored onto `<html>` as a class.
 *
 * The class is applied by an inline script in index.html before first
 * paint; this hook adopts whatever that script decided rather than
 * re-deciding, so there is never a frame where React and the DOM
 * disagree. Obsidian is the default — the app is designed dark first and
 * daylight is the alternate, not the other way round.
 */
export function useTheme(): [Theme, (next?: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "obsidian";
    return document.documentElement.classList.contains("theme-daylight")
      ? "daylight"
      : "obsidian";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-obsidian", "theme-daylight");
    root.classList.add(`theme-${theme}`);

    // Keep the OS chrome (Android status bar, iOS Safari toolbar) in step
    // with the canvas. Without this the notch area stays the old colour
    // and the app visibly stops at the status bar.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "daylight" ? "#eef1f6" : "#04050a");
    }

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage disabled — the theme still applies for this session */
    }
  }, [theme]);

  const toggle = useCallback((next?: Theme) => {
    setTheme((current) =>
      next ?? (current === "obsidian" ? "daylight" : "obsidian"),
    );
  }, []);

  return [theme, toggle];
}
