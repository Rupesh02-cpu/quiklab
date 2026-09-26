"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";

interface WallpaperDropZoneProps {
  readonly onFiles: (files: FileList) => void;
}

// Narrower accept list than the compressor's DropZone - SVG and GIF are
// meaningless for a "crop to exact pixel size" tool, so only JPG/PNG/WebP
// are accepted; anything else is rejected client-side by addFiles's own
// type filter same as the compressor rejects non-images.
export function WallpaperDropZone({ onFiles }: WallpaperDropZoneProps) {
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
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Icon name="upload" className="icon drop-icon" />
      <p className="drop-label">Drop a photo here</p>
      <p className="drop-sub">
        or{" "}
        <button type="button" className="link-btn" onClick={() => inputRef.current?.click()}>
          choose files
        </button>
      </p>
      <p className="drop-note">
        JPG, PNG, WebP - so your wallpaper looks right without the OS cropping it weird
      </p>
    </div>
  );
}
