"use client";

import { useEffect, useRef } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { usePdfToolkit } from "@/hooks/usePdfToolkit";
import { ToolGrid } from "./ToolGrid";
import { PdfWorkspace } from "./PdfWorkspace";

interface PdfToolkitAppProps {
  /** When false, renders only the body (no outer page/shell/header) so a
   * parent (UnifiedApp) can own the single shared shell. Defaults to true
   * so this component stays independently usable/testable. */
  readonly renderShell?: boolean;
  /** A PDF already dropped on the unified drop zone before a tool was
   * chosen. Still shows the tool grid (per the UX decision — PDF drop
   * shows the inline grid, not an auto-picked tool); once the user picks a
   * tool, these files preload into that tool's workspace instead of
   * re-prompting for upload. */
  readonly initialFiles?: File[];
}

export function PdfToolkitApp({ renderShell = true, initialFiles }: PdfToolkitAppProps = {}) {
  const toolkit = usePdfToolkit();

  // Preload the pre-dropped PDF once a tool is chosen. Deferred to an
  // effect keyed on activeTool (rather than passing seedFiles synchronously
  // inside openTool/onSelect) to sidestep the stale-closure risk flagged in
  // PLANNING_unified-upload.md: addFiles reads `tool`/`activeTool` from the
  // hook's own state, which hasn't re-rendered yet at the moment
  // openTool(id) itself runs. Waiting for the effect to fire after
  // setActiveTool's render means toolkit.addFiles is reading the freshly
  // resolved `tool` for the just-opened id. Ref-guarded so it only ever
  // seeds once, not on every activeTool change (e.g. user opens a second
  // tool afterward without new initialFiles).
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (toolkit.activeTool && initialFiles && initialFiles.length) {
      seededRef.current = true;
      toolkit.addFiles(initialFiles);
    }
    // toolkit.addFiles is recreated when `tool` changes; only re-run this
    // effect when activeTool itself changes, not on every toolkit identity
    // change, so it stays a one-shot seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolkit.activeTool, initialFiles]);

  const inner = toolkit.activeTool ? (
    <PdfWorkspace toolkit={toolkit} />
  ) : (
    <div className="wizard-step">
      <ToolGrid activeTool={toolkit.activeTool} onSelect={toolkit.openTool} />
    </div>
  );

  // Shell-less mode is only ever mounted inside UnifiedApp's own single
  // <main className="workspace-body">, so it renders its content directly
  // (no nested <main>/duplicate .workspace-body wrapper).
  if (!renderShell) return inner;

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
        <main className="workspace-body">{inner}</main>
      </div>
    </div>
  );
}
