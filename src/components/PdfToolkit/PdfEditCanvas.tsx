"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { Icon } from "@/components/Icon";
import type { TextAnnotation, TextAnnotationColor } from "@/lib/pdfTypes";

interface PdfEditCanvasProps {
  readonly thumbnails: string[];
  readonly pageSizes: { width: number; height: number }[];
  readonly loading: boolean;
  readonly annotations: TextAnnotation[];
  readonly onAdd: (ann: Omit<TextAnnotation, "id">) => number;
  readonly onUpdate: (id: number, patch: Partial<TextAnnotation>) => void;
  readonly onRemove: (id: number) => void;
}

const COLOR_OPTIONS: { value: TextAnnotationColor; label: string }[] = [
  { value: "ink", label: "Ink" },
  { value: "accent", label: "Accent" },
  { value: "blue", label: "Blue" },
];

export function PdfEditCanvas({
  thumbnails,
  pageSizes,
  loading,
  annotations,
  onAdd,
  onUpdate,
  onRemove,
}: PdfEditCanvasProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [placeMode, setPlaceMode] = useState<"text" | "link">("text");
  const [activeId, setActiveId] = useState<number | null>(null);

  // thumbnails/pageSizes identity changes whenever a new file is loaded
  // (Upload -> Configure with a different PDF, or back-then-reupload).
  // pageIndex/activeId are local UI state indexed into that array, so
  // without this reset an old pageIndex from a longer previous PDF would
  // stay selected and index out of bounds into the new, possibly shorter,
  // pageSizes array.
  useEffect(() => {
    setPageIndex(0);
    setActiveId(null);
  }, [thumbnails, pageSizes]);

  if (loading) return <p className="pdf-hint">Loading pages…</p>;
  if (!thumbnails.length || !pageSizes.length) return null;

  // Defensive clamp: even between the effect above and this render, a
  // pageIndex left over from a longer document could momentarily be out of
  // range for a shorter one (e.g. the effect hasn't committed yet on the
  // very first render after props change).
  const safePageIndex = Math.min(pageIndex, pageSizes.length - 1);
  const pageSize = pageSizes[safePageIndex];
  const pageAnnotations = annotations.filter((a) => a.pageIndex === safePageIndex);

  function handleCanvasClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickXpx = e.clientX - rect.left;
    const clickYpx = e.clientY - rect.top;
    // Convert on-screen preview pixels (top-left origin) into PDF page
    // points (bottom-left origin, y grows upward) — the same flip
    // runWatermark/runPdf2Img rely on when placing content via pdf-lib.
    const x = (clickXpx / rect.width) * pageSize.width;
    const y = pageSize.height - (clickYpx / rect.height) * pageSize.height;

    const id = onAdd({
      pageIndex: safePageIndex,
      type: placeMode,
      x,
      y,
      text: placeMode === "text" ? "New text" : "Link text",
      url: placeMode === "link" ? "https://" : undefined,
      fontSize: 18,
      color: placeMode === "link" ? "blue" : "ink",
    });
    setActiveId(id);
  }

  return (
    <div className="pdf-edit">
      <div className="pdf-edit-toolbar">
        {pageSizes.length > 1 && (
          <div className="pdf-edit-pager">
            <button
              type="button"
              className="btn-ghost"
              disabled={safePageIndex === 0}
              onClick={() => {
                setPageIndex((i) => Math.max(0, i - 1));
                setActiveId(null);
              }}
            >
              <Icon name="arrow-left" className="icon icon-sm" />
            </button>
            <span className="mono">
              Page {safePageIndex + 1} / {pageSizes.length}
            </span>
            <button
              type="button"
              className="btn-ghost"
              disabled={safePageIndex === pageSizes.length - 1}
              onClick={() => {
                setPageIndex((i) => Math.min(pageSizes.length - 1, i + 1));
                setActiveId(null);
              }}
            >
              <Icon name="arrow-left" className="icon icon-sm" style={{ transform: "rotate(180deg)" }} />
            </button>
          </div>
        )}
        <div className="view-toggle">
          <button
            type="button"
            className={`view-btn${placeMode === "text" ? " is-active" : ""}`}
            onClick={() => setPlaceMode("text")}
          >
            <Icon name="edit" className="icon icon-sm" /> Text
          </button>
          <button
            type="button"
            className={`view-btn${placeMode === "link" ? " is-active" : ""}`}
            onClick={() => setPlaceMode("link")}
          >
            <Icon name="link" className="icon icon-sm" /> Link
          </button>
        </div>
        <span className="pdf-hint">Click the page to place {placeMode === "text" ? "text" : "a link"}</span>
      </div>

      <div className="pdf-edit-page" onClick={handleCanvasClick}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URL page render from pdf.js, not an optimizable asset */}
        <img src={thumbnails[safePageIndex]} alt="" draggable={false} />
        {pageAnnotations.map((ann) => {
          const leftPct = (ann.x / pageSize.width) * 100;
          const topPct = (1 - ann.y / pageSize.height) * 100;
          return (
            <button
              type="button"
              key={ann.id}
              className={`pdf-edit-marker pdf-edit-marker-${ann.type}${activeId === ann.id ? " is-active" : ""}`}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveId(ann.id === activeId ? null : ann.id);
              }}
              title={ann.type === "link" ? ann.url : ann.text}
            >
              <Icon name={ann.type === "link" ? "link" : "edit"} className="icon icon-sm" />
            </button>
          );
        })}
      </div>

      {activeId !== null &&
        (() => {
          const ann = annotations.find((a) => a.id === activeId);
          if (!ann) return null;
          return (
            <div className="pdf-edit-form">
              <div className="field">
                <label htmlFor="annText">{ann.type === "link" ? "Link label" : "Text"}</label>
                <input
                  id="annText"
                  type="text"
                  value={ann.text}
                  maxLength={120}
                  onChange={(e) => onUpdate(ann.id, { text: e.target.value })}
                />
              </div>
              {ann.type === "link" && (
                <div className="field">
                  <label htmlFor="annUrl">URL</label>
                  <input
                    id="annUrl"
                    type="text"
                    value={ann.url ?? ""}
                    placeholder="https://example.com"
                    onChange={(e) => onUpdate(ann.id, { url: e.target.value })}
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="annSize">
                  Font size <span className="mono">{ann.fontSize}</span>px
                </label>
                <input
                  id="annSize"
                  type="range"
                  min={10}
                  max={72}
                  value={ann.fontSize}
                  onChange={(e) => onUpdate(ann.id, { fontSize: Number(e.target.value) })}
                />
              </div>
              {ann.type === "text" && (
                <div className="field">
                  <label htmlFor="annColor">Color</label>
                  <select
                    id="annColor"
                    value={ann.color}
                    onChange={(e) => onUpdate(ann.id, { color: e.target.value as TextAnnotationColor })}
                  >
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                className="btn-text"
                onClick={() => {
                  onRemove(ann.id);
                  setActiveId(null);
                }}
              >
                <Icon name="trash" className="icon icon-sm" /> Remove
              </button>
            </div>
          );
        })()}

      {annotations.length > 0 && (
        <ul className="pdf-edit-list">
          {annotations.map((ann) => (
            <li key={ann.id}>
              <button
                type="button"
                className={`pdf-edit-list-row${activeId === ann.id ? " is-active" : ""}`}
                onClick={() => {
                  setPageIndex(ann.pageIndex);
                  setActiveId(ann.id);
                }}
              >
                <Icon name={ann.type === "link" ? "link" : "edit"} className="icon icon-sm" />
                <span>{ann.text || (ann.type === "link" ? ann.url : "")}</span>
                <span className="pdf-edit-list-page mono">p.{ann.pageIndex + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
