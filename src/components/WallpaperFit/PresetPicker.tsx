"use client";

import { CUSTOM_DIMENSION_MAX, CUSTOM_DIMENSION_MIN, WALLPAPER_PRESETS } from "@/lib/wallpaperFit";
import type { WallpaperSettings } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";

interface PresetPickerProps {
  readonly settings: WallpaperSettings;
  readonly onSettingsChange: (patch: Partial<WallpaperSettings>) => void;
}

const GROUPS: readonly ("iPhone" | "Android" | "Common")[] = ["iPhone", "Android", "Common"];

export function PresetPicker({ settings, onSettingsChange }: PresetPickerProps) {
  const { showToast } = useToast();
  const isCustom = settings.presetId === "custom";

  function clampDimension(value: number): number {
    return Math.max(CUSTOM_DIMENSION_MIN, Math.min(CUSTOM_DIMENSION_MAX, value));
  }

  function handleCustomChange(field: "customWidth" | "customHeight", raw: number) {
    if (!Number.isFinite(raw) || raw <= 0) return;
    if (raw < CUSTOM_DIMENSION_MIN || raw > CUSTOM_DIMENSION_MAX) {
      showToast(`Custom dimensions must be between ${CUSTOM_DIMENSION_MIN} and ${CUSTOM_DIMENSION_MAX} pixels`);
    }
    onSettingsChange({ [field]: clampDimension(raw) } as Partial<WallpaperSettings>);
  }

  return (
    <div className="field">
      <label htmlFor="presetId">Target size</label>
      <select
        id="presetId"
        value={settings.presetId}
        onChange={(e) => onSettingsChange({ presetId: e.target.value })}
      >
        {GROUPS.map((group) => (
          <optgroup key={group} label={group}>
            {WALLPAPER_PRESETS.filter((p) => p.group === group).map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </optgroup>
        ))}
        <optgroup label="Custom">
          <option value="custom">Custom size</option>
        </optgroup>
      </select>

      {isCustom && (
        <div className="field-row">
          <div className="field">
            <label htmlFor="customWidth">Width</label>
            <input
              id="customWidth"
              type="number"
              min={CUSTOM_DIMENSION_MIN}
              max={CUSTOM_DIMENSION_MAX}
              value={settings.customWidth}
              onChange={(e) => handleCustomChange("customWidth", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="customHeight">Height</label>
            <input
              id="customHeight"
              type="number"
              min={CUSTOM_DIMENSION_MIN}
              max={CUSTOM_DIMENSION_MAX}
              value={settings.customHeight}
              onChange={(e) => handleCustomChange("customHeight", Number(e.target.value))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
