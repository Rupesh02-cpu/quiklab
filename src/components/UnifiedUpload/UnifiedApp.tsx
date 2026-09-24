"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { useToast } from "@/components/ToastProvider";
import { ImageCompressorApp } from "@/components/ImageCompressor/ImageCompressorApp";
import { PdfToolkitApp } from "@/components/PdfToolkit/PdfToolkitApp";
import { UnifiedDropZone } from "./UnifiedDropZone";
import { DetectedChip } from "./DetectedChip";
import { detectFileType } from "./detectFileType";
import { useUnifiedReset } from "./UnifiedResetContext";

export type DetectedKind = "image" | "pdf" | null;

interface UnifiedAppProps {
  /** Pre-seeds the scope of the drop zone before anything is dropped.
   * `"pdf"` == landed on /pdf directly (PDF-only accept/copy). `null` ==
   * `/`, the fully unified entry point (accepts both, no scoping). */
  readonly initialIntent: "image" | "pdf" | null;
}

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,image/gif";
const PDF_ACCEPT = "application/pdf,.pdf";
const UNIFIED_ACCEPT = `${IMAGE_ACCEPT},${PDF_ACCEPT}`;

export function UnifiedApp({ initialIntent }: UnifiedAppProps) {
  const { showToast } = useToast();
  const [detected, setDetected] = useState<DetectedKind>(null);
  const [detectedFiles, setDetectedFiles] = useState<File[]>([]);
  // Mixed-drop case (e.g. 2 images + 1 PDF): the file(s) of the type NOT
  // currently mounted are held here rather than discarded, so the
  // "switch file type" affordance (task 2's UI) can pick them up without
  // re-uploading. Not component state — nothing here needs a re-render on
  // its own; the toast + (future) chip UI is what surfaces it.
  const pendingOppositeRef = useRef<{ kind: "image" | "pdf"; files: File[] } | null>(null);
  const [pendingOpposite, setPendingOpposite] = useState<{ kind: "image" | "pdf"; files: File[] } | null>(null);

  const resetAll = useCallback(() => {
    setDetected(null);
    setDetectedFiles([]);
    pendingOppositeRef.current = null;
    setPendingOpposite(null);
  }, []);

  // Registers this page's resetAll with the layout-level context so
  // SiteHeader's logo click (a sibling, not a descendant, of this
  // component) can reach it. Re-registers if resetAll's identity ever
  // changes (it won't here, empty deps), and clears the registration on
  // unmount so a stale reset from a previous page can't fire.
  const unifiedReset = useUnifiedReset();
  useEffect(() => {
    unifiedReset?.registerReset(resetAll);
    return () => unifiedReset?.registerReset(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetAll]);

  const handleReject = useCallback(() => {
    showToast("That file type isn't supported yet. Try an image (JPG, PNG, WebP, SVG, GIF) or a PDF.");
  }, [showToast]);

  const handleFiles = useCallback(
    (files: File[]) => {
      const { images, pdfs, rejected } = detectFileType(files);

      if (rejected.length && (images.length || pdfs.length)) {
        showToast(
          `${rejected.length} file${rejected.length === 1 ? "" : "s"} in that selection ` +
            `${rejected.length === 1 ? "isn't" : "aren't"} a supported type and ${rejected.length === 1 ? "was" : "were"} skipped.`
        );
      } else if (rejected.length && !images.length && !pdfs.length) {
        handleReject();
        return;
      }

      // initialIntent === "pdf" (landed on /pdf directly): a stray image
      // drop there gets a friendly redirect toast instead of silently
      // misrouting into the image path on a PDF-scoped page.
      if (initialIntent === "pdf" && images.length && !pdfs.length) {
        showToast("That looks like an image — head to quiklab.online to compress it.");
        return;
      }

      if (images.length && pdfs.length) {
        // Mixed drop: run images through immediately (matches "images go
        // straight into Configure, no confirmation" decision), stash the
        // PDF(s) as the pending opposite type, and surface a toast +
        // persistent affordance handoff rather than losing either set.
        pendingOppositeRef.current = { kind: "pdf", files: pdfs };
        setPendingOpposite({ kind: "pdf", files: pdfs });
        showToast(`Also detected ${pdfs.length} PDF${pdfs.length === 1 ? "" : "s"} — switch to it below.`);
        setDetected("image");
        setDetectedFiles(images);
        return;
      }

      if (images.length) {
        setDetected("image");
        setDetectedFiles(images);
        return;
      }

      if (pdfs.length) {
        setDetected("pdf");
        setDetectedFiles(pdfs);
        return;
      }
    },
    [initialIntent, showToast, handleReject]
  );

  const switchToPending = useCallback(() => {
    const pending = pendingOppositeRef.current;
    if (!pending) return;
    pendingOppositeRef.current = null;
    setPendingOpposite(null);
    setDetected(pending.kind);
    setDetectedFiles(pending.files);
  }, []);

  const headline = initialIntent === "pdf" ? "Drop a PDF to get started" : "Drop a file to get started";
  const subCopy =
    initialIntent === "pdf"
      ? "PDFs get merged, split, compressed, and more — all in your browser."
      : "Images get resized and compressed. PDFs get merged, split, compressed, and more — all in your browser.";
  const note =
    initialIntent === "pdf" ? "PDF — nothing leaves your device" : "JPG, PNG, WebP, SVG, GIF, PDF — nothing leaves your device";
  const accept = initialIntent === "pdf" ? PDF_ACCEPT : UNIFIED_ACCEPT;

  return (
    <>
      <div className="page">
        <AmbientBackground />
        <div className="workspace-shell">
          <header className="workspace-head">
            <div className="brand-copy">
              <h1>
                {initialIntent === "pdf" ? (
                  <>
                    PDF toolkit <span className="tag">merge, split, compress, rotate, watermark, or convert PDFs entirely in your browser</span>
                  </>
                ) : (
                  <>
                    QuikLab <span className="tag">image and PDF tools, entirely in your browser</span>
                  </>
                )}
              </h1>
            </div>
          </header>

          <main className="workspace-body">
            {detected === null && (
              <div className="wizard-step">
                <UnifiedDropZone
                  headline={headline}
                  subCopy={subCopy}
                  note={note}
                  accept={accept}
                  onFiles={handleFiles}
                  onReject={handleReject}
                />
              </div>
            )}

            {detected !== null && (
              <>
                <DetectedChip kind={detected} files={detectedFiles} />

                {pendingOpposite && (
                  <button type="button" className="type-switch-chip" onClick={switchToPending}>
                    Also detected {pendingOpposite.files.length} {pendingOpposite.kind === "pdf" ? "PDF" : "image"}
                    {pendingOpposite.files.length === 1 ? "" : "s"} — switch to it
                  </button>
                )}

                <div className="wizard-step wizard-step--cascade">
                  {detected === "image" && <ImageCompressorApp renderShell={false} initialFiles={detectedFiles} />}
                  {detected === "pdf" && <PdfToolkitApp renderShell={false} initialFiles={detectedFiles} />}
                </div>
              </>
            )}
          </main>

          <footer className="workspace-foot">
            <p>
              Processing runs on-device via the Canvas API and pdf-lib. Your files are never uploaded anywhere.
              Re-encoding a JPEG also strips its EXIF and GPS metadata.
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
