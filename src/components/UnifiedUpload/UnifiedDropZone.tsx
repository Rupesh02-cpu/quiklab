"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";

// Deliberate minimum hold for the "reading…" state before detection
// resolves; see PLANNING_unified-upload.md section 3 item 1. An instant
// swap here reads as a glitch, not speed, even though the type sniff
// itself is synchronous.
const READING_HOLD_MS = 220;
const REJECT_FLASH_MS = 200;
// Matches .drop.is-leaving's drop-out animation duration in quiklab.css
// (.22s): the drop zone animates out before UnifiedApp swaps in the
// detected chip, so the two moments read as one continuous cascade rather
// than an instant cut.
const LEAVE_MS = 220;

interface UnifiedDropZoneProps {
  readonly headline: string;
  readonly subCopy: string;
  readonly note: string;
  readonly accept: string;
  /** Called once files have been read and are ready to be classified/routed. */
  readonly onFiles: (files: File[]) => void;
  /** Called when a drop/pick contained no usable files at all. */
  readonly onReject: () => void;
}

export function UnifiedDropZone({ headline, subCopy, note, accept, onFiles, onReject }: UnifiedDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [rejected, setRejected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const flashReject = () => {
    setRejected(true);
    onReject();
    if (rejectTimer.current) clearTimeout(rejectTimer.current);
    rejectTimer.current = setTimeout(() => setRejected(false), REJECT_FLASH_MS);
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const files = Array.from(fileList);

    setReading(true);
    const resolveDetection = () => {
      setReading(false);
      // Play the drop-out reveal (.drop.is-leaving), then hand off to
      // UnifiedApp, which unmounts this drop zone and mounts the detected
      // chip + destination in the same transition wave. Reduced-motion
      // skips straight to hand-off, no artificial hold either way.
      if (reduceMotion) {
        onFiles(files);
      } else {
        setLeaving(true);
        setTimeout(() => onFiles(files), LEAVE_MS);
      }
    };

    if (reduceMotion) {
      resolveDetection();
    } else {
      setTimeout(resolveDetection, READING_HOLD_MS);
    }
  };

  const classes = [
    "drop",
    dragging && "drag",
    reading && "drop-reading",
    leaving && "is-leaving",
    rejected && "is-rejected",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
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
        if (!e.dataTransfer.files.length) {
          flashReject();
          return;
        }
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <span className="drop-icon-fade">
        <Icon name="upload" className={`icon drop-icon${reading ? " is-leaving" : " is-entering"}`} />
        <Icon name="file" className={`icon drop-icon${reading ? " is-entering" : " is-leaving"}`} />
      </span>
      <p className="drop-label">{reading ? "Reading file…" : headline}</p>
      {!reading && (
        <>
          <p className="drop-sub">{subCopy}</p>
          <p className="drop-sub">
            or{" "}
            <button type="button" className="btn-primary drop-choose" onClick={() => inputRef.current?.click()}>
              Choose files
            </button>
          </p>
          <p className="drop-note">{note}</p>
        </>
      )}
    </div>
  );
}
