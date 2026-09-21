"use client";

import { useCallback, useEffect, useState } from "react";

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
}

// Cycles System -> Light -> Dark -> System, persisted to localStorage.
// The actual data-theme attribute is applied pre-paint by an inline script
// in the root layout (see ThemeInitScript) so there's no flash of the
// wrong theme on load; this hook just keeps React state in sync with it
// and handles clicks after hydration.
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = NEXT_THEME[current];
      applyThemeAttribute(next);
      return next;
    });
  }, []);

  return { theme, cycleTheme };
}
