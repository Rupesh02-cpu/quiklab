"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { PdfRunResult } from "@/lib/pdfTypes";

interface PdfResultPanelProps {
  readonly result: PdfRunResult;
  readonly onDownload: () => Promise<void>;
  readonly onDownloadAll: () => Promise<void>;
}

export function PdfResultPanel({ result, onDownload, onDownloadAll }: PdfResultPanelProps) {
  const [downloading, setDownloading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [justDownloaded, setJustDownloaded] = useState(false);
  const [justZipped, setJustZipped] = useState(false);
  const hasMultiple = result.files.length > 1;

  return (
    <div className="pdf-result">
      <Icon name="check" />
      <div className="pdf-result-text">
        <strong>{result.title}</strong>
        <span>{result.detail}</span>
      </div>
      <button
        type="button"
        className={`btn-ghost${justDownloaded ? " is-success" : ""}`}
        disabled={downloading}
        onClick={async () => {
          setDownloading(true);
          await onDownload();
          setDownloading(false);
          setJustDownloaded(true);
          setTimeout(() => setJustDownloaded(false), 400);
        }}
      >
        <Icon name="download" /> {downloading ? "Saving..." : "Download"}
      </button>
      {hasMultiple && (
        <button
          type="button"
          className={`btn-ghost${justZipped ? " is-success" : ""}`}
          disabled={zipping}
          onClick={async () => {
            setZipping(true);
            await onDownloadAll();
            setZipping(false);
            setJustZipped(true);
            setTimeout(() => setJustZipped(false), 400);
          }}
        >
          <Icon name="zip" /> {zipping ? "Zipping..." : "Download all (.zip)"}
        </button>
      )}
    </div>
  );
}
