"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { useToast } from "@/components/ToastProvider";
import { saveFile } from "@/lib/saveFile";
import { extFor, fmtBytes, outputName } from "@/lib/format";
import { loadImage } from "@/lib/imageProcessing";
import { computeCoverCrop, needsUpscale, renderWallpaperCrop, WALLPAPER_PRESETS } from "@/lib/wallpaperFit";
import type { WallpaperItem, WallpaperSettings } from "@/lib/types";

let nextId = 1;

// Wallpaper fit only makes sense for real photos being cropped to an exact
// pixel size - SVG (vector, no fixed pixel size) and GIF (animation would
// be destroyed by a static crop/export) are meaningless here, so this is
// narrower than useImageCompressor's ACCEPTED_TYPE_RE by design, not an
// oversight.
export const WALLPAPER_ACCEPTED_TYPE_RE = /^image\/(jpeg|png|webp)$/;

function track(eventName: string, params?: Record<string, unknown>) {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === "function") gtag("event", eventName, params || {});
}

export const DEFAULT_WALLPAPER_SETTINGS: WallpaperSettings = {
  presetId: WALLPAPER_PRESETS[0].id,
  customWidth: 1170,
  customHeight: 2532,
  format: "image/jpeg",
  quality: 90,
  showSafeArea: true,
};

export function resolveTargetSize(settings: WallpaperSettings): { width: number; height: number } {
  if (settings.presetId === "custom") {
    return { width: settings.customWidth, height: settings.customHeight };
  }
  const preset = WALLPAPER_PRESETS.find((p) => p.id === settings.presetId) ?? WALLPAPER_PRESETS[0];
  return { width: preset.width, height: preset.height };
}

export function useWallpaperFit() {
  const [items, setItems] = useState<WallpaperItem[]>([]);
  const [settings, setSettingsState] = useState<WallpaperSettings>(DEFAULT_WALLPAPER_SETTINGS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const { showToast } = useToast();

  // Upload -> Configure -> Result, same explicit-not-derived pattern as
  // useImageCompressor (see its comment for why).
  const [stepIndex, setStepIndex] = useState(0);

  // Settings read inside async processing - see useImageCompressor's
  // settingsRef comment for why a ref mirror is needed here too.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Bumped when the sheet is cleared; processAll's loop checks this to
  // stop early if the batch was cleared mid-run. Same discipline as
  // useImageCompressor's clearGeneration - do not remove.
  const clearGeneration = useRef(0);

  const setSettings = useCallback((patch: Partial<WallpaperSettings>) => {
    setSettingsState((current) => ({ ...current, ...patch }));
  }, []);

  const updateItem = useCallback((id: number, patch: Partial<WallpaperItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => WALLPAPER_ACCEPTED_TYPE_RE.test(f.type));
    if (!files.length) return;
    track("wallpaper_upload", { file_count: files.length });

    const loaded = await Promise.all(
      files.map(async (file) => {
        const originalUrl = URL.createObjectURL(file);
        try {
          const img = await loadImage(originalUrl);
          return { file, originalUrl, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
        } catch {
          URL.revokeObjectURL(originalUrl);
          return null;
        }
      })
    );

    const newItems: WallpaperItem[] = loaded
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .map((l) => ({
        id: nextId++,
        file: l.file,
        originalUrl: l.originalUrl,
        naturalWidth: l.naturalWidth,
        naturalHeight: l.naturalHeight,
        offsetX: 0,
        offsetY: 0,
        zoom: 1,
        resultBlob: null,
        resultSize: 0,
        status: "waiting",
      }));

    if (!newItems.length) return;
    setItems((current) => {
      const merged = [...current, ...newItems];
      // Auto-select the first newly added item so Configure opens showing
      // something instead of an empty CropStage.
      if (current.length === 0) setActiveItemId(merged[0].id);
      return merged;
    });
    setStepIndex(1);
  }, []);

  // Fire on every pointer-move while dragging/zooming, so these stay cheap:
  // a plain setItems map, no async work, no track() calls per-move (only
  // on drop/complete, matching the requirements doc's perf guidance).
  const setPan = useCallback(
    (id: number, offsetX: number, offsetY: number) => {
      updateItem(id, { offsetX, offsetY });
    },
    [updateItem]
  );

  const setZoom = useCallback(
    (id: number, zoom: number) => {
      updateItem(id, { zoom });
    },
    [updateItem]
  );

  const resetCrop = useCallback(
    (id: number) => {
      updateItem(id, { offsetX: 0, offsetY: 0, zoom: 1 });
    },
    [updateItem]
  );

  const processOne = useCallback(async (item: WallpaperItem): Promise<Partial<WallpaperItem>> => {
    const s = settingsRef.current;
    try {
      const { width: targetWidth, height: targetHeight } = resolveTargetSize(s);
      const img = await loadImage(item.originalUrl);
      const crop = computeCoverCrop(
        img.naturalWidth,
        img.naturalHeight,
        targetWidth,
        targetHeight,
        item.offsetX,
        item.offsetY,
        item.zoom
      );
      const canvas = renderWallpaperCrop(img, crop, targetWidth, targetHeight);

      // Wallpaper export has a single shared quality slider, not a "target
      // file size" mode, so this encodes directly at the chosen quality
      // rather than reusing compressToTarget's binary search (that helper
      // stays imported and used as-is by other tools; it doesn't fit this
      // one's simpler quality-only control).
      let blob: Blob;
      if (s.format === "image/png") {
        blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), s.format));
      } else {
        const quality = Math.min(1, Math.max(0.1, s.quality / 100));
        blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), s.format, quality));
      }

      return { resultBlob: blob, resultSize: blob.size, status: "done" };
    } catch (err) {
      console.error(err);
      return { status: "failed" };
    }
  }, []);

  const processItem = useCallback(
    async (item: WallpaperItem) => {
      updateItem(item.id, { status: "rendering" });
      const result = await processOne(item);
      updateItem(item.id, result);
    },
    [processOne, updateItem]
  );

  const processAll = useCallback(async () => {
    setIsProcessing(true);
    const startGeneration = clearGeneration.current;
    const { width: targetWidth, height: targetHeight } = resolveTargetSize(settingsRef.current);
    track("wallpaper_export", { file_count: items.length, preset: settingsRef.current.presetId });

    let succeeded = 0;
    let failed = 0;
    for (const item of items) {
      if (clearGeneration.current !== startGeneration) break;
      updateItem(item.id, { status: "rendering" });
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
      showToast(`${succeeded} exported, ${failed} failed. Use Retry on the failed image${failed === 1 ? "" : "s"}.`);
    } else if (succeeded > 0) {
      showToast(
        `${succeeded} wallpaper${succeeded === 1 ? "" : "s"} ready at ${targetWidth} x ${targetHeight}`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, processOne, updateItem, showToast]);

  const downloadOne = useCallback(async (item: WallpaperItem) => {
    if (!item.resultBlob) return;
    track("wallpaper_download", {});
    const ext = extFor(settingsRef.current.format);
    await saveFile(outputName(item.file.name, ext), item.resultBlob);
  }, []);

  const downloadAll = useCallback(async () => {
    const done = items.filter((i) => i.resultBlob);
    if (!done.length) return;
    setIsZipping(true);
    track("wallpaper_download_all_zip", { file_count: done.length });
    const ext = extFor(settingsRef.current.format);
    const zip = new JSZip();
    done.forEach((item) => zip.file(outputName(item.file.name, ext), item.resultBlob!));
    const zipBlob = await zip.generateAsync({ type: "blob" });
    await saveFile("quiklab-wallpapers.zip", zipBlob);
    setIsZipping(false);
  }, [items]);

  const clearSheet = useCallback(() => {
    if (!items.length) return;
    const clearedItems = items;
    setItems([]);
    setActiveItemId(null);
    setStepIndex(0);
    clearGeneration.current++;
    setIsProcessing(false);

    let restored = false;
    showToast(`Cleared ${clearedItems.length} image${clearedItems.length === 1 ? "" : "s"}`, {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        restored = true;
        setItems(clearedItems);
        setActiveItemId(clearedItems[0]?.id ?? null);
      },
    });
    setTimeout(() => {
      if (restored) return;
      clearedItems.forEach((i) => URL.revokeObjectURL(i.originalUrl));
    }, 5200);
  }, [items, showToast]);

  const { width: targetWidth, height: targetHeight } = resolveTargetSize(settings);

  const activeItem = useMemo(() => items.find((i) => i.id === activeItemId) ?? null, [items, activeItemId]);

  const anyNeedsUpscale = useMemo(
    () => items.some((i) => needsUpscale(i.naturalWidth, i.naturalHeight, targetWidth, targetHeight)),
    [items, targetWidth, targetHeight]
  );

  const hasResults = items.some((i) => i.resultBlob);
  const maxReachedIndex = hasResults || items.some((i) => i.status !== "waiting") ? 2 : items.length > 0 ? 1 : 0;

  const goToStep = useCallback(
    (index: number) => {
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
    stepIndex,
    maxReachedIndex,
    goToStep,
    addFiles,
    activeItemId,
    setActiveItemId,
    activeItem,
    setPan,
    setZoom,
    resetCrop,
    processItem,
    processAll,
    downloadOne,
    downloadAll,
    clearSheet,
    targetWidth,
    targetHeight,
    anyNeedsUpscale,
  };
}
