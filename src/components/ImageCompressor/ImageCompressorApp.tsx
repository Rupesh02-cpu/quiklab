"use client";

import { useEffect, useRef, useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Icon } from "@/components/Icon";
import { Stepper, type StepDef } from "@/components/Stepper";
import { useImageCompressor } from "@/hooks/useImageCompressor";
import { DropZone } from "./DropZone";
import { ControlsPanel } from "./ControlsPanel";
import { ViewToggle } from "./ViewToggle";
import { Frame } from "./Frame";
import type { ViewMode } from "@/lib/types";

const STEPS: readonly StepDef[] = [
  { key: "upload", label: "Upload" },
  { key: "configure", label: "Configure" },
  { key: "result", label: "Result" },
];

interface ImageCompressorAppProps {
  /** When false, renders only the stepper + body (no outer page/shell/header)
   * so a parent (UnifiedApp) can own the single shared shell. Defaults to
   * true so this component stays independently usable/testable. */
  readonly renderShell?: boolean;
  /** Pre-existing files (e.g. from the unified drop zone) to seed into
   * addFiles exactly once on mount. */
  readonly initialFiles?: File[];
}

export function ImageCompressorApp({ renderShell = true, initialFiles }: ImageCompressorAppProps = {}) {
  const {
    items,
    settings,
    setSettings,
    isProcessing,
    isZipping,
    showColorsField,
    avifSupported,
    totals,
    stepIndex,
    maxReachedIndex,
    goToStep,
    addFiles,
    processItem,
    processAll,
    downloadOne,
    downloadAll,
    clearSheet,
    setOwnQuality,
  } = useImageCompressor();
  const [view, setView] = useState<ViewMode>("grid");

  // Seed once on mount — ref-guarded so React StrictMode's dev double-invoke
  // of effects can't double-add the same seeded files.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (initialFiles && initialFiles.length) {
      seededRef.current = true;
      addFiles(initialFiles);
    }
    // addFiles is stable (useCallback with empty deps); only run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles]);

  const hasResults = items.some((i) => i.resultBlob);

  const mainContent = (
    <>
          {stepIndex === 0 && (
            <div className="wizard-step">
              <DropZone onFiles={addFiles} />
            </div>
          )}

          {stepIndex === 1 && (
            <div className="wizard-step">
              <button type="button" className="btn-text" disabled={isProcessing} onClick={() => goToStep(0)}>
                <Icon name="arrow-left" className="icon icon-sm" /> Add more images
              </button>
              <ControlsPanel
                settings={settings}
                onSettingsChange={setSettings}
                showColorsField={showColorsField}
                avifSupported={avifSupported}
                itemCount={items.length}
                hasResults={hasResults}
                isProcessing={isProcessing}
                isZipping={isZipping}
                onCompress={processAll}
                onDownloadAll={downloadAll}
                onClear={clearSheet}
              />
            </div>
          )}

          {stepIndex === 2 && (
            <div className="wizard-step">
              <div className="sheet-head">
                <h2>Your images</h2>
                <div className="sheet-head-right">
                  {totals && (
                    <div className="totals">
                      <span>
                        <span className="mono">{totals.before}</span> original
                      </span>
                      <span className="arrow">→</span>
                      <span>
                        <span className="mono">{totals.after}</span> compressed
                      </span>
                      <span className="save-chip">
                        {totals.pct >= 0 ? "-" : "+"}
                        {Math.abs(totals.pct)}%
                      </span>
                    </div>
                  )}
                  <ViewToggle view={view} onChange={setView} />
                </div>
              </div>

              <div className="frames" data-view={view}>
                {items.map((item, index) => (
                  <Frame
                    key={item.id}
                    item={item}
                    index={index}
                    individualMode={settings.batchMode === "individual"}
                    retryDisabled={isProcessing}
                    onRetry={processItem}
                    onDownload={downloadOne}
                    onOwnQualityChange={setOwnQuality}
                  />
                ))}
              </div>

              <div className="pdf-toolbar">
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
        Image processing runs on-device via the Canvas API. Your files are never uploaded anywhere. Re-encoding a
        JPEG also strips its EXIF and GPS metadata.
      </p>
    </footer>
  );

  // Shell-less mode is only ever mounted inside UnifiedApp's own single
  // <main className="workspace-body">, so the stepper/content render
  // directly (no nested <main>/duplicate .workspace-body wrapper). The
  // footer is owned by UnifiedApp's own shell in this mode (it already
  // covers both tools' processing-is-local note), so it's skipped here to
  // avoid a duplicate footer.
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
              Image compressor{" "}
              <span className="tag">resize and compress JPG, PNG and WebP entirely in your browser</span>
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
