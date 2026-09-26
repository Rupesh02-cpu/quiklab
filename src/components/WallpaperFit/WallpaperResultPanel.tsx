"use client";

import { memo, useState } from "react";
import { Icon } from "@/components/Icon";
import { fmtBytes } from "@/lib/format";
import type { WallpaperItem } from "@/lib/types";

interface WallpaperResultItemProps {
  readonly item: WallpaperItem;
  readonly index: number;
  readonly targetWidth: number;
  readonly targetHeight: number;
  readonly retryDisabled: boolean;
  readonly onRetry: (item: WallpaperItem) => void;
  readonly onDownload: (item: WallpaperItem) => Promise<void>;
}

// Same memoization rationale as ImageCompressor/Frame.tsx: processAll
// updates one item at a time via a full-array setItems copy, so without
// this every card would re-render on every single item's status change.
const WallpaperResultItem = memo(function WallpaperResultItem({
  item,
  index,
  targetWidth,
  targetHeight,
  retryDisabled,
  onRetry,
  onDownload,
}: WallpaperResultItemProps) {
  const [downloading, setDownloading] = useState(false);
  const [justDownloaded, setJustDownloaded] = useState(false);
  const hasResult = item.status === "done";

  const handleDownload = async () => {
    setDownloading(true);
    await onDownload(item);
    setDownloading(false);
    setJustDownloaded(true);
    setTimeout(() => setJustDownloaded(false), 400);
  };

  return (
    <div className="frame" data-status={item.status}>
      <div className="frame-strip" />
      <div className="frame-shot">
        <span className="frame-num">{String(index + 1).padStart(2, "0")}</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- object URLs/blobs can't go through next/image's optimizer */}
        <img src={item.originalUrl} alt="" />
        {(item.status === "waiting" || item.status === "rendering") && (
          <div className="frame-status">{item.status === "waiting" ? "waiting" : "rendering..."}</div>
        )}
        {item.status === "failed" && (
          <button type="button" className="frame-retry" disabled={retryDisabled} onClick={() => onRetry(item)}>
            <Icon name="system" className="icon icon-sm" /> Retry
          </button>
        )}
      </div>
      <div className="frame-body">
        <div className="frame-name clarity-mask" title={item.file.name}>
          {item.file.name}
        </div>
        <div className="frame-sizes">
          <span className="mono">
            {item.naturalWidth} x {item.naturalHeight}
          </span>
          <span className="arrow">-&gt;</span>
          <span className="mono after">
            {hasResult ? `${targetWidth} x ${targetHeight}` : "not yet"}
          </span>
        </div>
        {hasResult && (
          <div className="frame-sizes">
            <span className="mono">{fmtBytes(item.resultSize)}</span>
          </div>
        )}

        <div className="frame-actions">
          <span className="spacer" />
          <button
            className={`frame-dl${justDownloaded ? " is-success" : ""}`}
            disabled={!hasResult || downloading}
            onClick={handleDownload}
          >
            <Icon name="download" className="icon icon-sm" /> {downloading ? "Saving..." : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
});

interface WallpaperResultPanelProps {
  readonly items: readonly WallpaperItem[];
  readonly targetWidth: number;
  readonly targetHeight: number;
  readonly isProcessing: boolean;
  readonly onRetry: (item: WallpaperItem) => void;
  readonly onDownload: (item: WallpaperItem) => Promise<void>;
}

export function WallpaperResultPanel({
  items,
  targetWidth,
  targetHeight,
  isProcessing,
  onRetry,
  onDownload,
}: WallpaperResultPanelProps) {
  return (
    <div className="frames" data-view="grid">
      {items.map((item, index) => (
        <WallpaperResultItem
          key={item.id}
          item={item}
          index={index}
          targetWidth={targetWidth}
          targetHeight={targetHeight}
          retryDisabled={isProcessing}
          onRetry={onRetry}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}
