"use client";

import { AmbientBackground } from "@/components/AmbientBackground";
import { Icon } from "@/components/Icon";
import { Stepper, type StepDef } from "@/components/Stepper";
import { useConverter } from "@/hooks/useConverter";
import { ConverterDropZone } from "./ConverterDropZone";
import { OutputFormatPicker } from "./OutputFormatPicker";
import { RemoteFetchDisclosure } from "./RemoteFetchDisclosure";
import { ConverterResultPanel } from "./ConverterResultPanel";

const STEPS: readonly StepDef[] = [
  { key: "upload", label: "Upload" },
  { key: "configure", label: "Configure" },
  { key: "result", label: "Result" },
];

interface ConverterAppProps {
  /** Same renderShell contract as the other tool apps, so this can later be
   * mounted inside a unified shell if desired. Defaults to true. */
  readonly renderShell?: boolean;
}

export function ConverterApp({ renderShell = true }: ConverterAppProps = {}) {
  const {
    file,
    inputDef,
    outputFormat,
    setOutputFormat,
    availableOutputs,
    result,
    isProcessing,
    stepIndex,
    maxReachedIndex,
    goToStep,
    setInputFile,
    tryFetchRemote,
    isFetchingRemote,
    remoteFetchFailure,
    setRemoteFetchFailure,
    convert,
    download,
    clearAll,
  } = useConverter();

  const mainContent = (
    <>
      {stepIndex === 0 && (
        <div className="wizard-step">
          <ConverterDropZone onFile={setInputFile} onFetchUrl={tryFetchRemote} isFetchingRemote={isFetchingRemote} />
          {remoteFetchFailure && (
            <RemoteFetchDisclosure failure={remoteFetchFailure} onDismiss={() => setRemoteFetchFailure(null)} />
          )}
        </div>
      )}

      {stepIndex === 1 && file && inputDef && (
        <div className="wizard-step">
          <button type="button" className="btn-text" disabled={isProcessing} onClick={() => goToStep(0)}>
            <Icon name="arrow-left" className="icon icon-sm" /> Choose a different file
          </button>

          <div className="controls">
            <p className="pdf-hint">
              Detected: <strong>{inputDef.label}</strong> - {file.name}
            </p>
            <OutputFormatPicker options={availableOutputs} value={outputFormat} onChange={setOutputFormat} />
          </div>

          <button type="button" className="btn-primary" disabled={!outputFormat || isProcessing} onClick={convert}>
            {isProcessing ? "Converting..." : "Convert"}
          </button>
          <button type="button" className="btn-text" onClick={clearAll}>
            <Icon name="trash" className="icon icon-sm" /> Start over
          </button>
        </div>
      )}

      {stepIndex === 2 && result && (
        <div className="wizard-step">
          <div className="sheet-head">
            <h2>Converted</h2>
          </div>

          <ConverterResultPanel result={result} onDownload={download} />

          <div className="pdf-toolbar">
            <span className="spacer" />
            <button type="button" className="btn-text" onClick={() => goToStep(1)}>
              <Icon name="arrow-left" className="icon icon-sm" /> Back to settings
            </button>
            <button type="button" className="btn-ghost" onClick={clearAll}>
              <Icon name="trash" className="icon icon-sm" /> Start over
            </button>
          </div>
        </div>
      )}
    </>
  );

  const footer = (
    <footer className="workspace-foot">
      <p>
        Conversions run on-device in your browser. Files you upload directly never leave your device. Fetching from
        a pasted link is different: your browser fetches the file directly from that link (no server of ours is
        involved), and it only works when the remote site allows it.
      </p>
    </footer>
  );

  if (!renderShell) {
    return (
      <>
        <Stepper
          steps={STEPS}
          currentIndex={stepIndex}
          maxReachedIndex={maxReachedIndex}
          onStepClick={goToStep}
          locked={isProcessing}
        />
        {mainContent}
      </>
    );
  }

  return (
    <div className="page">
      <AmbientBackground />
      <div className="workspace-shell">
        <header className="workspace-head">
          <div className="brand-copy">
            <h1>
              Convert <span className="tag">HEIC, DOCX, CSV, JSON, and Markdown files, entirely in your browser</span>
            </h1>
          </div>
        </header>
        <Stepper
          steps={STEPS}
          currentIndex={stepIndex}
          maxReachedIndex={maxReachedIndex}
          onStepClick={goToStep}
          locked={isProcessing}
        />
        <main className="workspace-body">{mainContent}</main>
        {footer}
      </div>
    </div>
  );
}
