"use client";

import { Icon } from "@/components/Icon";
import type { ViewMode } from "@/lib/types";

const VIEWS: { mode: ViewMode; icon: string; label: string }[] = [
  { mode: "grid", icon: "grid", label: "Grid view" },
  { mode: "filmstrip", icon: "filmstrip", label: "Filmstrip view" },
  { mode: "list", icon: "list", label: "List view" },
];

interface ViewToggleProps {
  readonly view: ViewMode;
  readonly onChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="view-toggle" role="group" aria-label="View layout">
      {VIEWS.map(({ mode, icon, label }) => (
        <button
          key={mode}
          type="button"
          className={`view-btn${view === mode ? " is-active" : ""}`}
          aria-label={label}
          title={mode[0].toUpperCase() + mode.slice(1)}
          onClick={() => onChange(mode)}
        >
          <Icon name={icon} className="icon icon-sm" />
        </button>
      ))}
    </div>
  );
}
