"use client";

import { useState } from "react";
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

export function ImageCompressorApp() {
  const {
    items,
    settings,
    setSettings,
    isProcessing,
    isZipping,
    showColorsField,
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

  const hasResults = items.some((i) => i.resultBlob);

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

        <main className="workspace-body">
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
        </main>

        <footer className="workspace-foot">
          <p>
            Image processing runs on-device via the Canvas API. Your files are never uploaded anywhere. Re-encoding
            a JPEG also strips its EXIF and GPS metadata.
          </p>
        </footer>
      </div>
    </div>
  );
}
