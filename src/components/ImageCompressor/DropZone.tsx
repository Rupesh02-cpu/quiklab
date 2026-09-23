"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";

interface DropZoneProps {
  readonly onFiles: (files: FileList) => void;
}

export function DropZone({ onFiles }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
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
        onFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Icon name="upload" className="icon drop-icon" />
      <p className="drop-label">Drop images here</p>
      <p className="drop-sub">
        or{" "}
        <button type="button" className="link-btn" onClick={() => inputRef.current?.click()}>
          choose files
        </button>
      </p>
      <p className="drop-note">JPG, PNG, WebP, SVG, GIF - your images never leave your device</p>
    </div>
  );
}
