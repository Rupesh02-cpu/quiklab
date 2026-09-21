"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { fmtBytes } from "@/lib/format";
import type { ImageItem } from "@/lib/types";

interface FrameProps {
  readonly item: ImageItem;
  readonly index: number;
  readonly individualMode: boolean;
  readonly onRetry: (item: ImageItem) => void;
  readonly onDownload: (item: ImageItem) => Promise<void>;
  readonly onOwnQualityChange: (id: number, quality: number) => void;
}

export function Frame({ item, index, individualMode, onRetry, onDownload, onOwnQualityChange }: FrameProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const hasResult = item.status === "done";
  const pct = hasResult && item.originalSize > 0 ? Math.round((1 - item.resultSize / item.originalSize) * 100) : 0;
  const barWidth = hasResult ? Math.max(0, Math.min(100, 100 - pct)) : 0;

  const saveTagText = !hasResult
    ? ""
    : item.keptOriginal
      ? "no gain, original kept"
      : pct >= 0
        ? `-${pct}% smaller`
        : `+${Math.abs(pct)}% larger`;

  const saveTagTitle = !hasResult
    ? undefined
    : item.keptOriginal
      ? "Re-encoding this file would have made it larger, so the original bytes were kept instead." +
        (item.file.type === "image/jpeg"
          ? " Since the original bytes were kept as-is, any EXIF/GPS data in this file was not removed."
          : "")
      : item.file.type === "image/jpeg"
        ? "Re-encoding also removes EXIF/GPS metadata from the original photo."
        : undefined;

  const handleDownload = async () => {
    setDownloading(true);
    await onDownload(item);
    setDownloading(false);
  };

  return (
    <div className="frame">
      <div className="frame-strip" />
      <div className="frame-shot">
        <span className="frame-num">{String(index + 1).padStart(2, "0")}</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- object URLs / blobs can't go through next/image's optimizer */}
        <img src={item.originalUrl} alt="" />
        {(item.status === "waiting" || item.status === "compressing") && (
          <div className="frame-status">{item.status === "waiting" ? "waiting" : "compressing..."}</div>
        )}
        {item.status === "failed" && (
          <button type="button" className="frame-retry" onClick={() => onRetry(item)}>
            <Icon name="system" className="icon icon-sm" /> Retry
          </button>
        )}
      </div>
      <div className="frame-body">
        <div className="frame-name clarity-mask" title={item.file.name}>
          {item.file.name}
        </div>
        <div className="frame-sizes">
          <span className="mono">{fmtBytes(item.originalSize)}</span>
          <span className="arrow">→</span>
          <span className="mono after">{hasResult ? fmtBytes(item.resultSize) : "not yet"}</span>
        </div>
        <div className="frame-bar">
          <span style={{ width: `${barWidth}%` }} />
        </div>

        {individualMode && (
          <button
            type="button"
            className="frame-adjust"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            {settingsOpen ? "Hide settings" : "Adjust this image"}
          </button>
        )}
        {individualMode && settingsOpen && (
          <div className="frame-own-settings">
            <label>
              Quality <span className="mono">{item.ownQuality}</span>
            </label>
            <input
              type="range"
              min={10}
              max={100}
              value={item.ownQuality}
              onChange={(e) => onOwnQualityChange(item.id, Number(e.target.value))}
            />
          </div>
        )}

        <div className="frame-actions">
          <span className="frame-save" title={saveTagTitle}>
            {saveTagText}
          </span>
          <button className="frame-dl" disabled={!hasResult || downloading} onClick={handleDownload}>
            <Icon name="download" className="icon icon-sm" /> {downloading ? "Saving..." : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
