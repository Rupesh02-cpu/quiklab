"use client";

import { AmbientBackground } from "@/components/AmbientBackground";
import { usePdfToolkit } from "@/hooks/usePdfToolkit";
import { ToolGrid } from "./ToolGrid";
import { PdfWorkspace } from "./PdfWorkspace";

export function PdfToolkitApp() {
  const toolkit = usePdfToolkit();

  return (
    <div className="page">
      <AmbientBackground />
      <div className="workspace-shell">
        <header className="workspace-head">
          <div className="brand-copy">
            <h1>
              PDF toolkit{" "}
              <span className="tag">
                merge, split, compress, rotate, watermark, or convert PDFs entirely in your browser
              </span>
            </h1>
          </div>
        </header>

        <main className="workspace-body">
          {toolkit.activeTool ? (
            <PdfWorkspace toolkit={toolkit} />
          ) : (
            <div className="wizard-step">
              <ToolGrid activeTool={toolkit.activeTool} onSelect={toolkit.openTool} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
