"use client";

import { Icon } from "@/components/Icon";
import { fmtBytes } from "@/lib/format";

interface DetectedChipProps {
  readonly kind: "image" | "pdf";
  readonly files: readonly File[];
}

// The "the app noticed" reveal, see PLANNING_unified-upload.md section 1
// ("the detection moment") and section 3 item 2. Class names
// (`.detected-chip`, the icon draw-in) are a contract with task 3's CSS;
// applied here even though the CSS doesn't exist yet.
export function DetectedChip({ kind, files }: DetectedChipProps) {
  const count = files.length;
  const label =
    count > 1
      ? `${count} ${kind === "image" ? "images" : "PDFs"} detected`
      : files[0]?.name ?? (kind === "image" ? "Image detected" : "PDF detected");
  const size = count === 1 ? fmtBytes(files[0]?.size ?? 0) : null;

  return (
    <div className="detected-chip">
      <span className="detected-chip-icon">
        <Icon name={kind === "image" ? "image" : "pdf"} className="icon" />
      </span>
      <span className="detected-chip-label">{label}</span>
      {size && <span className="detected-chip-size">{size}</span>}
    </div>
  );
}
