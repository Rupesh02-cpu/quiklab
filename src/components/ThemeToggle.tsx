"use client";

import { Icon } from "@/components/Icon";
import { useTheme, type Theme } from "@/hooks/useTheme";

const THEME_ICON: Record<Theme, string> = { system: "system", light: "sun", dark: "moon" };

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Theme: ${theme}. Click to change.`}
      title="Theme"
      onClick={cycleTheme}
    >
      <Icon name={THEME_ICON[theme]} />
    </button>
  );
}
