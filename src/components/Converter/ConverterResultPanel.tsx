"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { ConverterResult } from "@/hooks/useConverter";

interface ConverterResultPanelProps {
  readonly result: ConverterResult;
  readonly onDownload: () => Promise<void>;
}

// Renders the converted output plus a download button. For HTML/text
// outputs (DOCX->HTML/text, CSV->JSON/HTML, Markdown->HTML), an inline
// preview is shown so the user can sanity-check the result before
// downloading, per REQUIREMENTS_new-features.md's Result step spec.
export function ConverterResultPanel({ result, onDownload }: ConverterResultPanelProps) {
  const [downloading, setDownloading] = useState(false);
  const [justDownloaded, setJustDownloaded] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    await onDownload();
    setDownloading(false);
    setJustDownloaded(true);
    setTimeout(() => setJustDownloaded(false), 400);
  };

  return (
    <>
      <div className="pdf-result">
        <Icon name="check" />
        <div className="pdf-result-text">
          <strong>{result.filename}</strong>
          <span className="mono">{(result.blob.size / 1024).toFixed(1)} KB</span>
        </div>
        <button
          type="button"
          className={`btn-ghost${justDownloaded ? " is-success" : ""}`}
          disabled={downloading}
          onClick={handleDownload}
        >
          <Icon name="download" /> {downloading ? "Saving..." : "Download"}
        </button>
      </div>

      {result.previewText !== undefined && (
        <div className="converter-preview">
          {result.previewIsHtml ? (
            // The previewed HTML is this user's own locally-converted file
            // (mammoth/marked output from a file they picked or a link
            // they fetched themselves), not third-party remote content, so
            // rendering it directly matches the trust model of every other
            // client-side conversion in this tool.
            <div className="converter-preview-html" dangerouslySetInnerHTML={{ __html: result.previewText }} />
          ) : (
            <pre className="converter-preview-text">{result.previewText}</pre>
          )}
        </div>
      )}
    </>
  );
}
