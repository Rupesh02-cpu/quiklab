"use client";

import { Icon } from "@/components/Icon";
import type { CompressorSettings } from "@/lib/types";

interface ControlsPanelProps {
  readonly settings: CompressorSettings;
  readonly onSettingsChange: (patch: Partial<CompressorSettings>) => void;
  readonly showColorsField: boolean;
  readonly avifSupported: boolean;
  readonly itemCount: number;
  readonly hasResults: boolean;
  readonly isProcessing: boolean;
  readonly isZipping: boolean;
  readonly onCompress: () => void;
  readonly onDownloadAll: () => void;
  readonly onClear: () => void;
}

export function ControlsPanel({
  settings,
  onSettingsChange,
  showColorsField,
  avifSupported,
  itemCount,
  hasResults,
  isProcessing,
  isZipping,
  onCompress,
  onDownloadAll,
  onClear,
}: ControlsPanelProps) {
  const isTarget = settings.sizeMode === "target";
  const showQualityField = !isTarget && settings.batchMode !== "individual";

  return (
    <div className="controls">
      <div className="field">
        <label htmlFor="batchMode">Settings</label>
        <select
          id="batchMode"
          value={settings.batchMode}
          onChange={(e) => onSettingsChange({ batchMode: e.target.value as CompressorSettings["batchMode"] })}
        >
          <option value="same">Same settings for all images</option>
          <option value="individual">Let me adjust each image separately</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="sizeMode">Compress by</label>
        <select
          id="sizeMode"
          value={settings.sizeMode}
          onChange={(e) => onSettingsChange({ sizeMode: e.target.value as CompressorSettings["sizeMode"] })}
        >
          <option value="quality">Quality level</option>
          <option value="target">Target file size</option>
        </select>
      </div>

      {showQualityField && (
        <div className="field">
          <label htmlFor="quality">
            Quality <span className="mono">{settings.quality}</span>
          </label>
          <input
            id="quality"
            type="range"
            min={10}
            max={100}
            value={settings.quality}
            onChange={(e) => onSettingsChange({ quality: Number(e.target.value) })}
          />
        </div>
      )}

      {isTarget && (
        <div className="field">
          <label htmlFor="targetSize">Target size</label>
          <div className="field-row" id="targetField">
            <input
              id="targetSize"
              type="number"
              placeholder="e.g. 100"
              min={1}
              value={settings.targetSize}
              onChange={(e) => onSettingsChange({ targetSize: Number(e.target.value) || 100 })}
            />
            <select
              value={settings.targetUnit}
              onChange={(e) => onSettingsChange({ targetUnit: e.target.value as CompressorSettings["targetUnit"] })}
            >
              <option value="KB">KB</option>
              <option value="MB">MB</option>
            </select>
          </div>
        </div>
      )}

      <details className="advanced">
        <summary>Advanced options</summary>
        <div className="advanced-body">
          <div className="field-row">
            <div className="field">
              <label htmlFor="maxWidth">Max width</label>
              <input
                id="maxWidth"
                type="number"
                placeholder="e.g. 1600"
                min={1}
                value={settings.maxWidth ?? ""}
                onChange={(e) => onSettingsChange({ maxWidth: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div className="field">
              <label htmlFor="maxHeight">Max height</label>
              <input
                id="maxHeight"
                type="number"
                placeholder="auto"
                min={1}
                value={settings.maxHeight ?? ""}
                onChange={(e) => onSettingsChange({ maxHeight: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="format">Output format</label>
            <select
              id="format"
              value={settings.format}
              onChange={(e) => onSettingsChange({ format: e.target.value as CompressorSettings["format"] })}
            >
              <option value="original">Keep original</option>
              <option value="image/jpeg">Force JPEG</option>
              <option value="image/webp">Force WebP</option>
              <option value="image/png">Force PNG</option>
              {avifSupported && <option value="image/avif">Force AVIF</option>}
            </select>
            {!avifSupported && settings.format === "image/avif" && (
              <p className="field-hint">AVIF export isn&apos;t supported in this browser yet - JPEG will be used instead.</p>
            )}
          </div>

          {showColorsField && (
            <div className="field">
              <label htmlFor="colors">
                Simplify colors (PNG/GIF only) <span className="mono">{settings.colors}</span>
              </label>
              <input
                id="colors"
                type="range"
                min={4}
                max={256}
                step={1}
                value={settings.colors}
                onChange={(e) => onSettingsChange({ colors: Number(e.target.value) })}
              />
              <p className="field-hint">
                PNG and GIF files can&apos;t get smaller with a quality slider, only by using fewer colors. Lower
                this for flat graphics like screenshots, icons, or logos. Photos and animations with lots of color
                will look worse if you go too low.
              </p>
            </div>
          )}
        </div>
      </details>

      <button type="button" className="btn-primary" disabled={itemCount === 0 || isProcessing} onClick={onCompress}>
        {isProcessing ? "Compressing..." : "Compress images"}{" "}
        {itemCount > 0 && !isProcessing && <span className="count-badge">{itemCount}</span>}
      </button>
      {hasResults && (
        <button type="button" className="btn-ghost" disabled={isZipping} onClick={onDownloadAll}>
          <Icon name="zip" /> {isZipping ? "Zipping..." : "Download all (.zip)"}
        </button>
      )}
      {itemCount > 0 && (
        <button type="button" className="btn-text" onClick={onClear}>
          <Icon name="trash" className="icon icon-sm" /> Clear all
        </button>
      )}
    </div>
  );
}
