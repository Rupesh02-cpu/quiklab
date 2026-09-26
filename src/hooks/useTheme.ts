"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

const THEME_KEY = "quiklab-theme";
const NEXT_THEME: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

function readStoredTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // localStorage can throw (private browsing, blocked storage) — fall
    // through to the system default rather than crash the toggle.
  }
  return "system";
}

// Listeners notified whenever applyThemeAttribute changes the stored theme
// (i.e. on every cycleTheme call), so useSyncExternalStore below re-reads
// readStoredTheme and every useTheme() consumer re-renders with the new
// value. There's only ever one writer (cycleTheme, in this same module), so
// this is a minimal store rather than a general pub/sub.
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getServerSnapshot(): Theme {
  return "system";
}

function applyThemeAttribute(theme: Theme) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.removeItem(THEME_KEY);
    } catch {
      /* see readStoredTheme */
    }
  } else {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* see readStoredTheme */
    }
  }
  listeners.forEach((l) => l());
}

// Cycles System -> Light -> Dark -> System, persisted to localStorage.
// The actual data-theme attribute is applied pre-paint by an inline script
// in the root layout (see ThemeInitScript) so there's no flash of the
// wrong theme on load; this hook just keeps React state in sync with it
// and handles clicks after hydration.
//
// Uses useSyncExternalStore rather than reading localStorage inside a
// useEffect: localStorage is synchronously available, so pushing its value
// into React state from an effect (mount with a default, then immediately
// re-render with the real value) is exactly what the
// react-hooks/set-state-in-effect rule flags. useSyncExternalStore reports
// the same "system" default during SSR/hydration (matching the pre-paint
// script's default before it runs) and the real stored value on the
// client's first render, with no extra render and no hydration mismatch.
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, getServerSnapshot);

  const cycleTheme = useCallback(() => {
    const next = NEXT_THEME[readStoredTheme()];
    applyThemeAttribute(next);
  }, []);

  return { theme, cycleTheme };
}
