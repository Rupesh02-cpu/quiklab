"use client";

import { useCallback, useRef, useState } from "react";
import JSZip from "jszip";
import { useToast } from "@/components/ToastProvider";
import { saveFile } from "@/lib/saveFile";
import {
  loadPageMeta,
  loadPageSizes,
  runCompress,
  runImg2Pdf,
  runMerge,
  runPdf2Img,
  runRotate,
  runSplit,
  runWatermark,
} from "@/lib/pdfProcessing";
import { runAddTextAndLinks } from "@/lib/pdfEditor";
import {
  PDF_TOOLS,
  type PageMeta,
  type PdfFileEntry,
  type PdfRunResult,
  type PdfToolId,
  type TextAnnotation,
  type WatermarkSettings,
} from "@/lib/pdfTypes";

function track(eventName: string, params?: Record<string, unknown>) {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === "function") gtag("event", eventName, params || {});
}

let nextFileId = 1;

const DEFAULT_WATERMARK: WatermarkSettings = {
  text: "CONFIDENTIAL",
  position: "center",
  opacity: 30,
  size: 48,
  color: "gray",
};

export function usePdfToolkit() {
  const { showToast } = useToast();

  const [activeTool, setActiveTool] = useState<PdfToolId | null>(null);
  const [files, setFiles] = useState<PdfFileEntry[]>([]);
  const [pageMeta, setPageMeta] = useState<PageMeta[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [pageSizes, setPageSizes] = useState<{ width: number; height: number }[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  // Mirrors whether originalBytesRef.current is populated, so canRun (read
  // during render) doesn't have to read the ref directly. Refs aren't
  // meant to be accessed at render time, only in callbacks/effects.
  const [pageBytesReady, setPageBytesReady] = useState(false);
  const [compressQuality, setCompressQuality] = useState(60);
  const [watermark, setWatermarkState] = useState<WatermarkSettings>(DEFAULT_WATERMARK);
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PdfRunResult | null>(null);

  // Holds the originally-uploaded PDF bytes for split/rotate, which both
  // need to re-read the source after page selection/rotation choices are
  // made in the grid, not just at upload time.
  const originalBytesRef = useRef<ArrayBuffer | null>(null);

  // Bumped by resetWorkspace (i.e. every openTool/closeTool). A run() in
  // flight captures the generation it started with and drops its result
  // instead of applying it if the workspace has since been reset. This
  // covers the user hitting Clear or "All tools" (or opening a different
  // tool) before an async merge/compress/etc. resolves; without it, the
  // stale promise's finally/then would clobber whatever the newly-opened
  // workspace is showing with the previous tool's progress/result state.
  const resetGeneration = useRef(0);

  const tool = activeTool ? PDF_TOOLS[activeTool] : null;

  // Explicit "which step the user is looking at" state, separate from
  // whether they *could* be on a later step. Derived defaults (advance
  // automatically once files exist) would fight a deliberate "back" click
  // on the stepper, so a step back is remembered until the user moves
  // forward again themselves.
  const [stepIndex, setStepIndex] = useState(0);

  const resetWorkspace = useCallback(() => {
    setStepIndex(0);
    resetGeneration.current++;
    setFiles([]);
    setPageMeta([]);
    setThumbnails([]);
    setPageSizes([]);
    setPagesLoading(false);
    setPageBytesReady(false);
    setCompressQuality(60);
    setWatermarkState(DEFAULT_WATERMARK);
    setAnnotations([]);
    setIsRunning(false);
    setProgress(0);
    setResult(null);
    originalBytesRef.current = null;
  }, []);

  const openTool = useCallback(
    (id: PdfToolId) => {
      setActiveTool(id);
      resetWorkspace();
      track("pdf_tool_open", { tool: id });
    },
    [resetWorkspace]
  );

  const closeTool = useCallback(() => {
    setActiveTool(null);
    resetWorkspace();
  }, [resetWorkspace]);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (!tool) return;
      const wantsPdf = tool.accept.startsWith("application/pdf");
      const accepted = Array.from(fileList).filter((f) =>
        wantsPdf ? f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf" : f.type.startsWith("image/")
      );
      if (!accepted.length) {
        showToast("No supported files in that selection.");
        return;
      }

      const newEntries: PdfFileEntry[] = accepted.map((file) => ({ id: nextFileId++, file }));
      const startGeneration = resetGeneration.current;
      // Page-grid tools are never `multiple` (see PDF_TOOLS), so the file
      // that matters here is always the newly-dropped one, not whatever
      // was in state before. Read it straight from newEntries rather than
      // relying on a setState updater's side effect, which isn't
      // guaranteed to run synchronously before the code below it.
      const firstFile = newEntries[0]?.file ?? null;
      setFiles((current) => (tool.multiple ? [...current, ...newEntries] : [newEntries[0]]));
      setResult(null);
      setStepIndex(1);

      if ((tool.showPageGrid || tool.showEditCanvas) && firstFile) {
        setPagesLoading(true);
        try {
          const buf = await firstFile.arrayBuffer();
          // The workspace may have been reset (Clear / switch tool) while
          // this await was in flight. Applying a stale PDF's page data
          // onto whatever's now open would show the wrong pages.
          if (resetGeneration.current !== startGeneration) return;
          originalBytesRef.current = buf;
          // The edit canvas needs a much sharper preview than the small
          // grid thumbnails elsewhere, since the user clicks precise
          // positions on it.
          const { pageMeta: meta, thumbnails: thumbs } = await loadPageMeta(
            buf,
            activeTool === "rotate",
            tool.showEditCanvas ? 1.4 : 0.3
          );
          if (resetGeneration.current !== startGeneration) return;
          setPageMeta(meta);
          setThumbnails(thumbs);
          if (tool.showEditCanvas) {
            const sizes = await loadPageSizes(buf);
            if (resetGeneration.current !== startGeneration) return;
            setPageSizes(sizes);
          }
          setPageBytesReady(true);
        } catch (err) {
          console.error(err);
          if (resetGeneration.current === startGeneration) {
            showToast("Couldn't read that PDF. It may be encrypted or corrupted.");
            setFiles([]);
          }
        } finally {
          if (resetGeneration.current === startGeneration) setPagesLoading(false);
        }
      }
    },
    [tool, activeTool, showToast]
  );

  const removeFile = useCallback((id: number) => {
    setFiles((current) => current.filter((f) => f.id !== id));
  }, []);

  const reorderFiles = useCallback((fromId: number, toId: number) => {
    setFiles((current) => {
      const fromIdx = current.findIndex((f) => f.id === fromId);
      const toIdx = current.findIndex((f) => f.id === toId);
      if (fromIdx === -1 || toIdx === -1) return current;
      const next = [...current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const togglePageSelected = useCallback((index: number) => {
    setPageMeta((current) => current.map((p) => (p.index === index ? { ...p, selected: !p.selected } : p)));
  }, []);

  const rotatePage = useCallback((index: number) => {
    setPageMeta((current) =>
      current.map((p) => (p.index === index ? { ...p, rotationAdd: (((p.rotationAdd + 90) % 360) as 0 | 90 | 180 | 270) } : p))
    );
  }, []);

  const setWatermark = useCallback((patch: Partial<WatermarkSettings>) => {
    setWatermarkState((current) => ({ ...current, ...patch }));
  }, []);

  const nextAnnotationId = useRef(1);

  const addAnnotation = useCallback((ann: Omit<TextAnnotation, "id">) => {
    const id = nextAnnotationId.current++;
    setAnnotations((current) => [...current, { ...ann, id }]);
    return id;
  }, []);

  const updateAnnotation = useCallback((id: number, patch: Partial<TextAnnotation>) => {
    setAnnotations((current) => current.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const removeAnnotation = useCallback((id: number) => {
    setAnnotations((current) => current.filter((a) => a.id !== id));
  }, []);

  const canRun = (() => {
    if (!tool) return false;
    if (pagesLoading) return false;
    if (tool.minFiles && files.length < tool.minFiles) return false;
    if (tool.showPageGrid) {
      // originalBytesRef isn't populated until loadPageMeta resolves.
      // Guard on the pageBytesReady flag (set right alongside it) rather
      // than pagesLoading alone, so a click landing in the brief window
      // between "files set" and "loading flag set" can't still slip
      // through and have run() read a null ref.
      if (!pageBytesReady) return false;
      return activeTool === "rotate" ? files.length > 0 : pageMeta.some((p) => p.selected);
    }
    if (tool.showEditCanvas) {
      if (!pageBytesReady) return false;
      return annotations.length > 0;
    }
    return files.length > 0;
  })();

  const hint = (() => {
    if (!tool) return "";
    if (tool.minFiles && files.length < tool.minFiles) return `Add at least ${tool.minFiles} files.`;
    if (tool.showPageGrid) return `${pageMeta.filter((p) => p.selected).length} of ${pageMeta.length} pages selected`;
    if (tool.showEditCanvas) return `${annotations.length} item${annotations.length === 1 ? "" : "s"} placed`;
    return "";
  })();

  const run = useCallback(async () => {
    if (!activeTool || !tool || !canRun) return;
    const startGeneration = resetGeneration.current;
    setIsRunning(true);
    setResult(null);
    setProgress(10);
    try {
      let outcome: PdfRunResult;
      switch (activeTool) {
        case "merge":
          outcome = await runMerge(files.map((f) => f.file), setProgress);
          break;
        case "split": {
          const selected = pageMeta.filter((p) => p.selected).map((p) => p.index);
          outcome = await runSplit(originalBytesRef.current!, selected, pageMeta.length, files[0].file.name, setProgress);
          break;
        }
        case "compress":
          outcome = await runCompress(files[0].file, compressQuality / 100, setProgress);
          break;
        case "rotate":
          outcome = await runRotate(originalBytesRef.current!, pageMeta, files[0].file.name, setProgress);
          break;
        case "watermark":
          outcome = await runWatermark(files[0].file, watermark, setProgress);
          break;
        case "img2pdf":
          outcome = await runImg2Pdf(files.map((f) => f.file), setProgress);
          break;
        case "pdf2img":
          outcome = await runPdf2Img(files[0].file, setProgress);
          break;
        case "edit":
          outcome = await runAddTextAndLinks(files[0].file, annotations, setProgress);
          break;
        default:
          return;
      }
      // The workspace was reset (Clear / switch tool / navigate away) while
      // this run was in flight. Its result belongs to a workspace that no
      // longer exists, so drop it instead of clobbering whatever's shown now.
      if (resetGeneration.current !== startGeneration) return;
      setResult(outcome);
      setStepIndex(2);
      track("pdf_tool_run", { tool: activeTool });
    } catch (err) {
      console.error(err);
      track("pdf_tool_error", { tool: activeTool });
      if (resetGeneration.current === startGeneration) {
        showToast("Something went wrong processing that file. It may be encrypted or corrupted.");
      }
    } finally {
      if (resetGeneration.current === startGeneration) {
        setIsRunning(false);
        setProgress(0);
      }
    }
  }, [activeTool, tool, canRun, files, pageMeta, compressQuality, watermark, annotations, showToast]);

  // How far the user has actually gotten, independent of which step
  // they're currently looking at (they may have clicked back). Drives
  // which stepper dots are clickable.
  const maxReachedIndex = result ? 2 : files.length > 0 ? 1 : 0;

  const goToStep = useCallback(
    (index: number) => {
      if (index <= maxReachedIndex) setStepIndex(index);
    },
    [maxReachedIndex]
  );

  const downloadResult = useCallback(async () => {
    if (!result) return;
    track("pdf_download", { tool: activeTool, zipped: false });
    await saveFile(result.files[0].filename, result.files[0].blob);
  }, [result, activeTool]);

  const downloadAllResult = useCallback(async () => {
    if (!result || result.files.length < 2) return;
    track("pdf_download", { tool: activeTool, zipped: true, file_count: result.files.length });
    const zip = new JSZip();
    result.files.forEach(({ blob, filename }) => zip.file(filename, blob));
    const zipBlob = await zip.generateAsync({ type: "blob" });
    await saveFile("quiklab-pdf-export.zip", zipBlob);
  }, [result, activeTool]);

  return {
    activeTool,
    tool,
    stepIndex,
    maxReachedIndex,
    goToStep,
    files,
    pageMeta,
    thumbnails,
    pageSizes,
    pagesLoading,
    compressQuality,
    setCompressQuality,
    watermark,
    setWatermark,
    annotations,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    isRunning,
    progress,
    result,
    canRun,
    hint,
    openTool,
    closeTool,
    clearWorkspace: resetWorkspace,
    addFiles,
    removeFile,
    reorderFiles,
    togglePageSelected,
    rotatePage,
    run,
    downloadResult,
    downloadAllResult,
  };
}
