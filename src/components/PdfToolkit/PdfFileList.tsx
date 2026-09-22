"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { fmtBytes } from "@/lib/format";
import type { PdfFileEntry } from "@/lib/pdfTypes";

interface PdfFileListProps {
  readonly files: PdfFileEntry[];
  readonly draggable: boolean;
  readonly onRemove: (id: number) => void;
  readonly onReorder: (fromId: number, toId: number) => void;
}

// How long the row's own exit animation (see .pdf-file-row.is-leaving in
// quiklab.css) takes to play before the row is actually removed from
// toolkit state — kept in sync with that CSS transition's duration so the
// row never flashes away instantly or hangs around after finishing.
const LEAVE_MS = 180;

export function PdfFileList({ files, draggable, onRemove, onReorder }: PdfFileListProps) {
  const dragId = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [leavingId, setLeavingId] = useState<number | null>(null);

  if (!files.length) return null;

  const handleRemove = (id: number) => {
    setLeavingId(id);
    setTimeout(() => onRemove(id), LEAVE_MS);
  };

  return (
    <div className="pdf-file-list">
      {files.map((entry) => (
        <div
          key={entry.id}
          className={`pdf-file-row${entry.id === draggingId ? " is-dragging" : ""}${entry.id === leavingId ? " is-leaving" : ""}`}
          draggable={draggable}
          onDragStart={() => {
            dragId.current = entry.id;
            setDraggingId(entry.id);
          }}
          onDragEnd={() => setDraggingId(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId.current !== null && dragId.current !== entry.id) {
              onReorder(dragId.current, entry.id);
            }
            setDraggingId(null);
          }}
        >
          <Icon name="pdf" className="icon icon-sm" />
          <span className="pdf-file-name">{entry.file.name}</span>
          <span className="pdf-file-meta mono">{fmtBytes(entry.file.size)}</span>
          <button
            type="button"
            className="pdf-file-remove"
            aria-label="Remove file"
            onClick={() => handleRemove(entry.id)}
          >
            <Icon name="trash" className="icon icon-sm" />
          </button>
        </div>
      ))}
    </div>
  );
}
