"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { PageMeta } from "@/lib/pdfTypes";

interface PdfPageGridProps {
  readonly pageMeta: PageMeta[];
  readonly thumbnails: string[];
  readonly loading: boolean;
  readonly mode: "select" | "rotate";
  readonly onToggle: (index: number) => void;
  readonly onRotate: (index: number) => void;
}

const ROTATION_CLASS: Record<number, string> = { 90: "rot-90", 180: "rot-180", 270: "rot-270" };
// Matches .page-thumb-rotate.is-spinning's transition duration in
// quiklab.css — a one-shot spin cue on the button itself (separate from
// the thumbnail image's own persistent rot-* transform) so every click
// reads as "that registered" even when the visual rotation angle repeats
// (e.g. 270deg -> 0deg wraps back to looking unrotated).
const SPIN_MS = 300;

export function PdfPageGrid({ pageMeta, thumbnails, loading, mode, onToggle, onRotate }: PdfPageGridProps) {
  const [spinningIndex, setSpinningIndex] = useState<number | null>(null);

  if (loading) return <p className="pdf-hint pdf-hint-loading">Loading pages…</p>;
  if (!pageMeta.length) return null;

  return (
    <div className="page-grid">
      {pageMeta.map((meta, i) => (
        <div
          key={meta.index}
          className={`page-thumb${meta.selected ? " is-selected" : ""}`}
          style={{ "--thumb-index": i } as React.CSSProperties}
          onClick={mode === "select" ? () => onToggle(meta.index) : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL thumbnails rendered from canvas, not an optimizable asset */}
          <img src={thumbnails[i]} alt="" className={ROTATION_CLASS[meta.rotationAdd] || ""} />
          <span className="page-thumb-check">
            <Icon name="check" className="icon icon-sm" />
          </span>
          <span className="page-thumb-num">Page {meta.index + 1}</span>
          {mode === "rotate" && (
            <button
              type="button"
              className={`page-thumb-rotate${spinningIndex === meta.index ? " is-spinning" : ""}`}
              aria-label={`Rotate page ${meta.index + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                onRotate(meta.index);
                setSpinningIndex(meta.index);
                setTimeout(() => setSpinningIndex((cur) => (cur === meta.index ? null : cur)), SPIN_MS);
              }}
            >
              <Icon name="rotate" className="icon icon-sm" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
