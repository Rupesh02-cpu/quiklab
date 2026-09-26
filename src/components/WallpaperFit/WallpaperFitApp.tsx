"use client";

import { useEffect, useRef } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Icon } from "@/components/Icon";
import { Stepper, type StepDef } from "@/components/Stepper";
import { useWallpaperFit } from "@/hooks/useWallpaperFit";
import { WallpaperDropZone } from "./WallpaperDropZone";
import { PresetPicker } from "./PresetPicker";
import { CropStage } from "./CropStage";
import { WallpaperResultPanel } from "./WallpaperResultPanel";
import type { WallpaperFormat } from "@/lib/types";

const STEPS: readonly StepDef[] = [
  { key: "upload", label: "Upload" },
  { key: "configure", label: "Configure" },
  { key: "result", label: "Result" },
];

interface WallpaperFitAppProps {
  /** When false, renders only the stepper + body (no outer page/shell/header)
   * so a parent (UnifiedApp) can own the single shared shell - same contract
   * as ImageCompressorApp/PdfToolkitApp. Defaults to true so this component
   * stays independently usable/testable. */
  readonly renderShell?: boolean;
  /** Pre-existing files to seed into addFiles exactly once on mount. */
  readonly initialFiles?: File[];
}

export function WallpaperFitApp({ renderShell = true, initialFiles }: WallpaperFitAppProps = {}) {
  const {
    items,
    settings,
    setSettings,
    isProcessing,
    isZipping,
    stepIndex,
    maxReachedIndex,
    goToStep,
    addFiles,
    activeItemId,
    setActiveItemId,
    activeItem,
    setPan,
    setZoom,
    resetCrop,
    processItem,
    processAll,
    downloadOne,
    downloadAll,
    clearSheet,
    targetWidth,
    targetHeight,
    anyNeedsUpscale,
  } = useWallpaperFit();

  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (initialFiles && initialFiles.length) {
      seededRef.current = true;
      addFiles(initialFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles]);

  const hasResults = items.some((i) => i.resultBlob);

  const mainContent = (
    <>
      {stepIndex === 0 && (
        <div className="wizard-step">
          <WallpaperDropZone onFiles={addFiles} />
        </div>
      )}

      {stepIndex === 1 && (
        <div className="wizard-step">
          <button type="button" className="btn-text" disabled={isProcessing} onClick={() => goToStep(0)}>
            <Icon name="arrow-left" className="icon icon-sm" /> Add more photos
          </button>

          <div className="controls">
            <PresetPicker settings={settings} onSettingsChange={setSettings} />

            {activeItem && (
              <CropStage
                item={activeItem}
                targetWidth={targetWidth}
                targetHeight={targetHeight}
                showSafeArea={settings.showSafeArea}
                onPan={setPan}
                onZoom={setZoom}
                onReset={resetCrop}
              />
            )}

            {items.length > 1 && (
              <div className="wallpaper-filmstrip">
                {items.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`wallpaper-filmstrip-item${item.id === activeItemId ? " is-active" : ""}`}
                    onClick={() => setActiveItemId(item.id)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- object URL thumbnail */}
                    <img src={item.originalUrl} alt="" />
                  </button>
                ))}
              </div>
            )}

            {anyNeedsUpscale && (
              <p className="crop-warning">
                <Icon name="system" className="icon icon-sm" /> One or more photos are smaller than the target size
                and will be upscaled.
              </p>
            )}

            <details className="advanced">
              <summary>Advanced options</summary>
              <div className="advanced-body">
                <div className="field">
                  <label htmlFor="wallpaperFormat">Output format</label>
                  <select
                    id="wallpaperFormat"
                    value={settings.format}
                    onChange={(e) => setSettings({ format: e.target.value as WallpaperFormat })}
                  >
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/webp">WebP</option>
                    <option value="image/png">PNG</option>
                  </select>
                </div>

                {settings.format !== "image/png" && (
                  <div className="field">
                    <label htmlFor="wallpaperQuality">
                      Quality <span className="mono">{settings.quality}</span>
                    </label>
                    <input
                      id="wallpaperQuality"
                      type="range"
                      min={10}
                      max={100}
                      value={settings.quality}
                      onChange={(e) => setSettings({ quality: Number(e.target.value) })}
                    />
                  </div>
                )}

                <label className="crop-safe-area-toggle">
                  <input
                    type="checkbox"
                    checked={settings.showSafeArea}
                    onChange={(e) => setSettings({ showSafeArea: e.target.checked })}
                  />
                  Show lock-screen safe-area guide
                </label>
              </div>
            </details>
          </div>

          <button type="button" className="btn-primary" disabled={items.length === 0 || isProcessing} onClick={processAll}>
            {isProcessing ? "Exporting..." : "Export wallpapers"}{" "}
            {items.length > 0 && !isProcessing && <span className="count-badge">{items.length}</span>}
          </button>
          {items.length > 0 && (
            <button type="button" className="btn-text" onClick={clearSheet}>
              <Icon name="trash" className="icon icon-sm" /> Clear all
            </button>
          )}
        </div>
      )}

      {stepIndex === 2 && (
        <div className="wizard-step">
          <div className="sheet-head">
            <h2>Your wallpapers</h2>
            <div className="sheet-head-right">
              <span className="mono">
                {targetWidth} x {targetHeight}
              </span>
            </div>
          </div>

          <WallpaperResultPanel
            items={items}
            targetWidth={targetWidth}
            targetHeight={targetHeight}
            isProcessing={isProcessing}
            onRetry={processItem}
            onDownload={downloadOne}
          />

          <div className="pdf-toolbar">
            {hasResults && (
              <button type="button" className="btn-ghost" disabled={isZipping} onClick={downloadAll}>
                <Icon name="zip" /> {isZipping ? "Zipping..." : "Download all (.zip)"}
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn-text" onClick={() => goToStep(1)}>
              <Icon name="arrow-left" className="icon icon-sm" /> Back to settings
            </button>
            <button type="button" className="btn-ghost" onClick={clearSheet}>
              <Icon name="trash" className="icon icon-sm" /> Start over
            </button>
          </div>
        </div>
      )}
    </>
  );

  const footer = (
    <footer className="workspace-foot">
      <p>
        Wallpaper cropping runs on-device via the Canvas API. Your photos are never uploaded anywhere. Re-encoding
        also strips EXIF and GPS metadata.
      </p>
    </footer>
  );

  if (!renderShell) {
    return (
      <>
        <Stepper
          steps={STEPS}
          currentIndex={stepIndex}
          maxReachedIndex={maxReachedIndex}
          onStepClick={goToStep}
          locked={isProcessing}
        />
        {mainContent}
      </>
    );
  }

  return (
    <div className="page">
      <AmbientBackground />
      <div className="workspace-shell">
        <header className="workspace-head">
          <div className="brand-copy">
            <h1>
              Wallpaper fit{" "}
              <span className="tag">crop a photo to your exact phone resolution before you set it</span>
            </h1>
          </div>
        </header>
        <Stepper
          steps={STEPS}
          currentIndex={stepIndex}
          maxReachedIndex={maxReachedIndex}
          onStepClick={goToStep}
          locked={isProcessing}
        />
        <main className="workspace-body">{mainContent}</main>
        {footer}
      </div>
    </div>
  );
}
