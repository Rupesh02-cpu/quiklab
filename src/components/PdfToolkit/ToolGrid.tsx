"use client";

import { Icon } from "@/components/Icon";
import { PDF_TOOLS, PDF_TOOL_ORDER, type PdfToolId } from "@/lib/pdfTypes";

interface ToolGridProps {
  readonly activeTool: PdfToolId | null;
  readonly onSelect: (id: PdfToolId) => void;
}

export function ToolGrid({ activeTool, onSelect }: ToolGridProps) {
  return (
    <div className="tool-grid" role="tablist" aria-label="PDF tools">
      {PDF_TOOL_ORDER.map((id, index) => {
        const t = PDF_TOOLS[id];
        return (
          <button
            key={id}
            type="button"
            className={`tool-card${activeTool === id ? " is-active" : ""}`}
            role="tab"
            aria-selected={activeTool === id}
            style={{ "--tool-index": index } as React.CSSProperties}
            onClick={() => onSelect(id)}
          >
            <span className="tool-card-icon">
              <Icon name={t.icon} />
            </span>
            <span className="tool-card-title">{t.title}</span>
            <span className="tool-card-desc">{t.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
