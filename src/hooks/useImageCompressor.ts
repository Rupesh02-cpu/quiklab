"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { useToast } from "@/components/ToastProvider";
import { saveFile } from "@/lib/saveFile";
import { extFor, fmtBytes, outputName, supportsAvifEncode, targetMimeFor } from "@/lib/format";
import { canvasToBlob, compressToTarget, fitDimensions, loadImage, medianCutQuantize, minifySvgText } from "@/lib/imageProcessing";
import { compressGif } from "@/lib/gifEncode";
import type { CompressorSettings, ImageItem } from "@/lib/types";

let nextId = 1;

const ACCEPTED_TYPE_RE = /^image\/(jpeg|png|webp|svg\+xml|gif)$/;

function track(eventName: string, params?: Record<string, unknown>) {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === "function") gtag("event", eventName, params || {});
}

export const DEFAULT_SETTINGS: CompressorSettings = {
  sizeMode: "quality",
  quality: 80,
  targetSize: 100,
  targetUnit: "KB",
  maxWidth: null,
  maxHeight: null,
  format: "original",
  colors: 256,
  batchMode: "same",
};

export function useImageCompressor() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [settings, setSettingsState] = useState<CompressorSettings>(DEFAULT_SETTINGS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [avifSupported, setAvifSupported] = useState(false);
  // Mirrors avifSupported for processOne to read without needing it in its
  // dependency array - same settingsRef-style pattern used throughout this
  // hook for values read inside async processing.
  const avifSupportedRef = useRef(false);
  const { showToast } = useToast();

  // AVIF encode support varies by browser/version; canvas.toBlob doesn't
  // throw for an unsupported mime (it silently falls back or resolves
  // null), so this is feature-detected via a real probe rather than a UA
  // sniff. Checked once on mount - see supportsAvifEncode's own comment.
  useEffect(() => {
    let cancelled = false;
    supportsAvifEncode().then((supported) => {
      if (!cancelled) {
        setAvifSupported(supported);
        avifSupportedRef.current = supported;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Upload -> Configure -> Result. Explicit rather than derived purely from
  // items/results, so a deliberate "back" click sticks instead of being
  // immediately overridden by "well, files exist, so step 1."
  const [stepIndex, setStepIndex] = useState(0);

  // Settings are read inside async processing loops where React state can
  // go stale mid-batch (the user could change a slider while 10 images are
  // still compressing) — a ref mirrors the latest value so each item reads
  // whatever's current at the moment it's actually processed, matching the
  // original DOM-value-read-on-each-item behavior exactly.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Bumped every time the sheet is cleared. processAll's loop checks this
  // against the value it captured at start; if it's changed mid-batch (the
  // user cleared while compression was still running), the loop stops
  // instead of continuing to await/decode items whose object URLs
  // clearSheet may since have revoked.
  const clearGeneration = useRef(0);

  const setSettings = useCallback((patch: Partial<CompressorSettings>) => {
    setSettingsState((current) => ({ ...current, ...patch }));
  }, []);

  const updateItem = useCallback((id: number, patch: Partial<ImageItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => ACCEPTED_TYPE_RE.test(f.type));
    if (!files.length) return;
    track("upload_images", { file_count: files.length });
    const newItems: ImageItem[] = files.map((file) => ({
      id: nextId++,
      file,
      originalUrl: URL.createObjectURL(file),
      originalSize: file.size,
      ownQuality: 80,
      status: "waiting",
      resultBlob: null,
      resultSize: 0,
      resultExt: "jpg",
      keptOriginal: false,
    }));
    setItems((current) => [...current, ...newItems]);
    setStepIndex(1);
  }, []);

  const setOwnQuality = useCallback(
    (id: number, quality: number) => {
      updateItem(id, { ownQuality: quality });
    },
    [updateItem]
  );

  // Processes a single item and returns the finished item fields — kept
  // side-effect-light (no setItems calls inside) so processAll can await
  // every item in sequence and apply each result as it lands, exactly
  // matching the original for-loop's one-at-a-time processing order.
  const processOne = useCallback(async (item: ImageItem): Promise<Partial<ImageItem>> => {
    const s = settingsRef.current;
    try {
      if (item.file.type === "image/gif") {
        const { blob } = await compressGif(item.file, {
          maxWidth: s.maxWidth,
          maxHeight: s.maxHeight,
          colorCount: s.colors,
        });
        const noGain = blob.size >= item.originalSize;
        return noGain
          ? { resultBlob: item.file, resultSize: item.originalSize, resultExt: "gif", keptOriginal: true, status: "done" }
          : { resultBlob: blob, resultSize: blob.size, resultExt: "gif", keptOriginal: false, status: "done" };
      }

      if (item.file.type === "image/svg+xml") {
        const text = await item.file.text();
        const minified = minifySvgText(text);
        const blob = new Blob([minified], { type: "image/svg+xml" });
        const noGain = blob.size >= item.originalSize;
        return noGain
          ? { resultBlob: item.file, resultSize: item.originalSize, resultExt: "svg", keptOriginal: true, status: "done" }
          : { resultBlob: blob, resultSize: blob.size, resultExt: "svg", keptOriginal: false, status: "done" };
      }

      const img = await loadImage(item.originalUrl);
      const { width, height } = fitDimensions(img.naturalWidth, img.naturalHeight, s.maxWidth, s.maxHeight);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      let mime = targetMimeFor(item.file, s.format);

      // AVIF export isn't supported in every browser yet. canvas.toBlob
      // doesn't throw for an unsupported mime - it silently falls back to
      // PNG or resolves null - so this falls back to JPEG explicitly
      // rather than pulling in a Wasm AVIF encoder for v1, per the
      // requirements doc's recommendation.
      if (mime === "image/avif" && !avifSupportedRef.current) {
        mime = "image/jpeg";
      }

      // PNG has no lossy "quality" knob (canvas.toBlob ignores it for PNG
      // entirely) — the real compression lever is how many distinct
      // colors it's allowed to use.
      if (mime === "image/png" && s.colors < 256) {
        const imageData = ctx.getImageData(0, 0, width, height);
        ctx.putImageData(medianCutQuantize(imageData, s.colors), 0, 0);
      }

      let blob: Blob;
      if (s.sizeMode === "target") {
        const targetBytes = s.targetUnit === "MB" ? s.targetSize * 1024 * 1024 : s.targetSize * 1024;
        blob = await compressToTarget(canvas, mime, targetBytes);
      } else {
        // In "adjust each image" mode, each item's own quality slider
        // wins over the shared one — that's the whole point of the
        // per-image override. Otherwise everyone uses the shared slider.
        const rawQuality = s.batchMode === "individual" ? item.ownQuality : s.quality;
        const quality = Math.min(1, Math.max(0.1, rawQuality / 100));
        blob = await canvasToBlob(canvas, mime, quality);
      }

      // Canvas re-encoding can come back larger than the original — PNG
      // re-encoding ignores the quality slider and can't match a
      // well-optimized encoder, and some JPEGs (e.g. WhatsApp exports
      // with unusual chroma subsampling) re-encode heavier at the same
      // visual quality. A "compressed" file must never be bigger than
      // what the user uploaded, even when a resize/reformat was
      // requested — if the encode came back larger, fall back to the
      // original bytes.
      const noGain = blob.size >= item.originalSize;
      if (noGain) {
        return { resultBlob: item.file, resultSize: item.originalSize, resultExt: extFor(item.file.type), keptOriginal: true, status: "done" };
      }
      return { resultBlob: blob, resultSize: blob.size, resultExt: extFor(mime), keptOriginal: false, status: "done" };
    } catch (err) {
      console.error(err);
      return { status: "failed" };
    }
  }, []);

  const processItem = useCallback(
    async (item: ImageItem) => {
      updateItem(item.id, { status: "compressing" });
      const result = await processOne(item);
      updateItem(item.id, result);
    },
    [processOne, updateItem]
  );

  const processAll = useCallback(async () => {
    setIsProcessing(true);
    const startGeneration = clearGeneration.current;
    track("compress_images", {
      file_count: items.length,
      mode: settingsRef.current.sizeMode,
      output_format: settingsRef.current.format,
    });

    // Sequential, matching the original for-loop — keeps memory bounded
    // (one canvas/decode in flight at a time) rather than blowing up on a
    // big batch processed in parallel.
    let succeeded = 0;
    let failed = 0;
    for (const item of items) {
      // The sheet was cleared mid-batch (clearGeneration bumped) — the
      // remaining items' object URLs may already be revoked by
      // clearSheet's cleanup timer, and they no longer exist in state to
      // show a result on. Stop rather than keep decoding into the void.
      if (clearGeneration.current !== startGeneration) break;
      updateItem(item.id, { status: "compressing" });
      const result = await processOne(item);
      if (clearGeneration.current !== startGeneration) break;
      updateItem(item.id, result);
      if (result.status === "failed") failed++;
      else succeeded++;
    }

    setIsProcessing(false);
    if (clearGeneration.current !== startGeneration) return;
    if (succeeded > 0 || failed > 0) setStepIndex(2);
    if (failed > 0) {
      showToast(`${succeeded} compressed, ${failed} failed. Use Retry on the failed image${failed === 1 ? "" : "s"}.`);
    } else if (succeeded > 0) {
      showToast(`${succeeded} image${succeeded === 1 ? "" : "s"} compressed and ready to download`);
    }
    // items is read fresh via the closure each call; processAll is
    // re-created whenever items changes so this always sees the latest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, processOne, updateItem, showToast]);

  const downloadOne = useCallback(
    async (item: ImageItem) => {
      if (!item.resultBlob) return;
      track("download_image", { kept_original: !!item.keptOriginal });
      await saveFile(outputName(item.file.name, item.resultExt), item.resultBlob);
    },
    []
  );

  const downloadAll = useCallback(async () => {
    const done = items.filter((i) => i.resultBlob);
    if (!done.length) return;
    setIsZipping(true);
    track("download_all_zip", { file_count: done.length });
    try {
      const zip = new JSZip();
      done.forEach((item) => zip.file(outputName(item.file.name, item.resultExt), item.resultBlob!));
      const zipBlob = await zip.generateAsync({ type: "blob" });
      await saveFile("quiklab-compressed.zip", zipBlob);
    } catch (err) {
      console.error(err);
      showToast("Couldn't create the zip file. Try downloading images individually instead.");
    } finally {
      setIsZipping(false);
    }
  }, [items, showToast]);

  const clearSheet = useCallback(() => {
    if (!items.length) return;
    const clearedItems = items;
    setItems([]);
    setStepIndex(0);
    // Signal any in-flight processAll loop to stop. See the check in
    // processAll for why (its remaining items' object URLs are about to
    // be revoked below, and they're no longer in state to show on).
    clearGeneration.current++;
    setIsProcessing(false);

    let restored = false;
    showToast(`Cleared ${clearedItems.length} image${clearedItems.length === 1 ? "" : "s"}`, {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        restored = true;
        setItems(clearedItems);
      },
    });
    // The undo window has to actually own the delayed cleanup — revoking
    // these object URLs any earlier would blank out the previews while
    // the toast (and undo) is still on screen.
    setTimeout(() => {
      if (restored) return;
      clearedItems.forEach((i) => URL.revokeObjectURL(i.originalUrl));
    }, 5200);
  }, [items, showToast]);

  // Both scan the full items array, so only recompute when items or the
  // output format actually change — not on every incidental re-render
  // (e.g. a Frame's own local "adjust settings" toggle).
  const showColorsField = useMemo(() => {
    const willOutputPng =
      settings.format === "image/png" ||
      (settings.format === "original" && items.some((i) => i.file.type === "image/png"));
    const hasGif = items.some((i) => i.file.type === "image/gif");
    return willOutputPng || hasGif;
  }, [items, settings.format]);

  const totals = useMemo(() => {
    const done = items.filter((i) => i.resultBlob);
    if (!done.length) return null;
    const before = done.reduce((s, i) => s + i.originalSize, 0);
    const after = done.reduce((s, i) => s + i.resultSize, 0);
    const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0;
    return { before: fmtBytes(before), after: fmtBytes(after), pct };
  }, [items]);

  const hasResults = items.some((i) => i.resultBlob);
  const maxReachedIndex = hasResults || items.some((i) => i.status !== "waiting") ? 2 : items.length > 0 ? 1 : 0;

  const goToStep = useCallback(
    (index: number) => {
      // Blocked while a batch compress is in flight. processAll's loop
      // isn't cancelled by navigating away from it (only clearSheet stops
      // it, via clearGeneration) — without this guard, jumping back to
      // Upload mid-batch and adding more files would let the original
      // processAll run to completion afterward and silently force
      // setStepIndex(2), yanking the user back to a Result they didn't
      // ask to see.
      if (isProcessing) return;
      if (index <= maxReachedIndex) setStepIndex(index);
    },
    [maxReachedIndex, isProcessing]
  );

  return {
    items,
    settings,
    setSettings,
    isProcessing,
    isZipping,
    showColorsField,
    avifSupported,
    totals,
    stepIndex,
    maxReachedIndex,
    goToStep,
    addFiles,
    processItem,
    processAll,
    downloadOne,
    downloadAll,
    clearSheet,
    setOwnQuality,
  };
}
