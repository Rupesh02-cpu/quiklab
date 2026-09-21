"use client";

import { useState } from "react";
import { AdRail } from "@/components/AdRail";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useImageCompressor } from "@/hooks/useImageCompressor";
import { DropZone } from "./DropZone";
import { ControlsPanel } from "./ControlsPanel";
import { ViewToggle } from "./ViewToggle";
import { Frame } from "./Frame";
import type { ViewMode } from "@/lib/types";

export function ImageCompressorApp() {
  const {
    items,
    settings,
    setSettings,
    isProcessing,
    isZipping,
    showColorsField,
    totals,
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
      <AdRail side="left" />

      <div className="darkroom">
        <aside className="rail">
          <div className="rail-sprockets" aria-hidden="true" />
          <div className="rail-inner">
            <header className="brand">
              <div className="brand-copy">
                <h1>
                  Image compressor{" "}
                  <span className="tag">resize and compress JPG, PNG and WebP entirely in your browser</span>
                </h1>
              </div>
              <ThemeToggle />
            </header>

            <DropZone onFiles={addFiles} />

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

            <footer className="rail-foot">
              <p>
                Image processing runs on-device via the Canvas API. Your files are never uploaded anywhere. PNG
                re-encoding has a lower compression ceiling than JPEG/WebP, so for photos, WebP usually wins.
              </p>
              <p>
                Re-encoding a JPEG also strips its EXIF and GPS metadata. If a file shows &quot;no gain, original
                kept&quot; that metadata was not removed, since the original bytes were kept unchanged.
              </p>
              <p>
                This page uses Microsoft Clarity to see how the tool itself is used (clicks, scroll, layout issues).
                It has no access to your images or filenames.
              </p>
            </footer>
          </div>
        </aside>

        <main className="sheet">
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
            {items.length === 0 ? (
              <div className="empty-state">
                <Icon name="image" className="icon empty-icon" />
                <p>Uploaded images will appear here so you can compress and download them.</p>
              </div>
            ) : (
              items.map((item, index) => (
                <Frame
                  key={item.id}
                  item={item}
                  index={index}
                  individualMode={settings.batchMode === "individual"}
                  onRetry={processItem}
                  onDownload={downloadOne}
                  onOwnQualityChange={setOwnQuality}
                />
              ))
            )}
          </div>
        </main>
      </div>

      <AdRail side="right" />
    </div>
  );
}
