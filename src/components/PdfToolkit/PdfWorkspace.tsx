"use client";

import { Icon } from "@/components/Icon";
import { Stepper, type StepDef } from "@/components/Stepper";
import { usePdfToolkit } from "@/hooks/usePdfToolkit";
import { PdfDropZone } from "./PdfDropZone";
import { PdfFileList } from "./PdfFileList";
import { PdfPageGrid } from "./PdfPageGrid";
import { WatermarkForm } from "./WatermarkForm";
import { CompressForm } from "./CompressForm";
import { PdfEditCanvas } from "./PdfEditCanvas";
import { PdfResultPanel } from "./PdfResultPanel";

type PdfToolkit = ReturnType<typeof usePdfToolkit>;

interface PdfWorkspaceProps {
  readonly toolkit: PdfToolkit;
}

const STEPS: readonly StepDef[] = [
  { key: "upload", label: "Upload" },
  { key: "configure", label: "Configure" },
  { key: "result", label: "Result" },
];

export function PdfWorkspace({ toolkit }: PdfWorkspaceProps) {
  const { tool, activeTool, stepIndex } = toolkit;
  if (!tool || !activeTool) return null;

  return (
    <>
      <button type="button" className="btn-text" disabled={toolkit.isRunning} onClick={toolkit.closeTool}>
        <Icon name="arrow-left" className="icon icon-sm" /> All tools
      </button>
      <div className="pdf-workspace-head">
        <h2>{tool.title}</h2>
      </div>
      <p className="pdf-workspace-desc">{tool.desc}</p>

      <Stepper
        steps={STEPS}
        currentIndex={stepIndex}
        maxReachedIndex={toolkit.maxReachedIndex}
        onStepClick={toolkit.goToStep}
        locked={toolkit.isRunning}
      />

      {stepIndex === 0 && (
        <div className="wizard-step">
          <PdfDropZone accept={tool.accept} multiple={tool.multiple} label={tool.dropLabel} onFiles={toolkit.addFiles} />
        </div>
      )}

      {stepIndex === 1 && (
        <div className="wizard-step">
          {tool.showFileList && (
            <PdfFileList
              files={toolkit.files}
              draggable={tool.multiple}
              onRemove={toolkit.removeFile}
              onReorder={toolkit.reorderFiles}
            />
          )}

          {tool.showPageGrid && (
            <PdfPageGrid
              pageMeta={toolkit.pageMeta}
              thumbnails={toolkit.thumbnails}
              loading={toolkit.pagesLoading}
              mode={activeTool === "rotate" ? "rotate" : "select"}
              onToggle={toolkit.togglePageSelected}
              onRotate={toolkit.rotatePage}
            />
          )}

          {tool.showWatermarkForm && <WatermarkForm settings={toolkit.watermark} onChange={toolkit.setWatermark} />}
          {tool.showCompressForm && <CompressForm quality={toolkit.compressQuality} onChange={toolkit.setCompressQuality} />}
          {tool.showEditCanvas && (
            <PdfEditCanvas
              thumbnails={toolkit.thumbnails}
              pageSizes={toolkit.pageSizes}
              loading={toolkit.pagesLoading}
              annotations={toolkit.annotations}
              onAdd={toolkit.addAnnotation}
              onUpdate={toolkit.updateAnnotation}
              onRemove={toolkit.removeAnnotation}
            />
          )}

          <div className="pdf-toolbar">
            <span className="pdf-hint">{toolkit.hint}</span>
            <span className="spacer" />
            <button type="button" className="btn-text" disabled={toolkit.isRunning} onClick={() => toolkit.goToStep(0)}>
              <Icon name="arrow-left" className="icon icon-sm" /> Back
            </button>
            <button type="button" className="btn-text" disabled={toolkit.isRunning} onClick={toolkit.clearWorkspace}>
              <Icon name="trash" className="icon icon-sm" /> Clear
            </button>
            <button type="button" className="btn-primary" disabled={!toolkit.canRun || toolkit.isRunning} onClick={toolkit.run}>
              {toolkit.isRunning ? "Working…" : tool.runLabel}
            </button>
          </div>

          {toolkit.isRunning && (
            <div className="progress-bar">
              <span style={{ width: `${toolkit.progress}%` }} />
            </div>
          )}
        </div>
      )}

      {stepIndex === 2 && toolkit.result && (
        <div className="wizard-step">
          <PdfResultPanel result={toolkit.result} onDownload={toolkit.downloadResult} onDownloadAll={toolkit.downloadAllResult} />
          <div className="pdf-toolbar">
            <span className="spacer" />
            <button type="button" className="btn-text" onClick={() => toolkit.goToStep(1)}>
              <Icon name="arrow-left" className="icon icon-sm" /> Back to options
            </button>
            <button type="button" className="btn-ghost" onClick={toolkit.clearWorkspace}>
              Start another
            </button>
          </div>
        </div>
      )}
    </>
  );
}
