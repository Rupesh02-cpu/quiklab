"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";

interface PdfDropZoneProps {
  readonly accept: string;
  readonly multiple: boolean;
  readonly label: string;
  readonly onFiles: (files: FileList) => void;
}

export function PdfDropZone({ accept, multiple, label, onFiles }: PdfDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`pdf-drop${dragging ? " drag" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Icon name="upload" className="icon drop-icon" />
      <p className="pdf-drop-label">{label}</p>
      <p className="pdf-drop-sub">
        or{" "}
        <button type="button" className="btn-primary drop-choose" onClick={() => inputRef.current?.click()}>
          Choose files
        </button>
      </p>
    </div>
  );
}
