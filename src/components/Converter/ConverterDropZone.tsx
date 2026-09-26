"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";

interface ConverterDropZoneProps {
  readonly onFile: (file: File) => void;
  readonly onFetchUrl: (url: string) => void;
  readonly isFetchingRemote: boolean;
}

// Drop zone with a "paste a link instead" second affordance, per
// REQUIREMENTS_new-features.md Feature 2. Direct file drop/pick is the
// default tab - the link tab is a deliberate second choice, not the
// default, since it's a categorically different (server-touching-on-
// fallback) operation from the rest of the site's private-by-default flow.
export function ConverterDropZone({ onFile, onFetchUrl, isFetchingRemote }: ConverterDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="converter-upload">
      <div className="view-toggle converter-mode-toggle">
        <button
          type="button"
          className={`view-btn${mode === "file" ? " is-active" : ""}`}
          onClick={() => setMode("file")}
        >
          Upload a file
        </button>
        <button
          type="button"
          className={`view-btn${mode === "link" ? " is-active" : ""}`}
          onClick={() => setMode("link")}
        >
          Paste a link
        </button>
      </div>

      {mode === "file" ? (
        <div
          className={`drop${dragging ? " drag" : ""}`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files[0];
            if (dropped) onFile(dropped);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) onFile(picked);
              e.target.value = "";
            }}
          />
          <Icon name="upload" className="icon drop-icon" />
          <p className="drop-label">Drop a file here</p>
          <p className="drop-sub">
            or{" "}
            <button type="button" className="link-btn" onClick={() => inputRef.current?.click()}>
              choose a file
            </button>
          </p>
          <p className="drop-note">HEIC, DOCX, CSV, JSON, or Markdown - your file never leaves your device</p>
        </div>
      ) : (
        <form
          className="converter-link-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) onFetchUrl(url.trim());
          }}
        >
          <div className="field">
            <label htmlFor="remoteUrl">File URL</label>
            <div className="field-row">
              <input
                id="remoteUrl"
                type="url"
                placeholder="https://example.com/file.docx"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary" disabled={isFetchingRemote || !url.trim()}>
                {isFetchingRemote ? "Fetching..." : "Fetch"}
              </button>
            </div>
            <p className="field-hint">
              Files you upload directly never leave your browser. Most links to actual files work here too - some
              sites block this for security, in which case you&apos;ll get a clear message and can download the
              file and drop it in instead.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
