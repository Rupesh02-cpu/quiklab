// Pure cover-crop math and canvas export for the wallpaper-fit tool.
// Mirrors imageProcessing.ts's style (no React, no DOM state beyond the
// canvas it creates). fitDimensions in imageProcessing.ts shrinks-to-fit
// (may letterbox, never upscales); computeCoverCrop is the "cover" analogue
// used here: it always fills the target box exactly, cropping whatever
// doesn't fit, and will upscale a too-small source rather than letterbox it
// (see the upscale warning in useWallpaperFit/CropStage - a wallpaper crop
// mathematically requires this in the one-dimension-too-small case).

export interface WallpaperPreset {
  id: string;
  label: string;
  group: "iPhone" | "Android" | "Common" | "Custom";
  width: number;
  height: number;
}

export interface CropRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

// Real device resolutions, not just ratios, so the exported file is
// pixel-perfect for that device. Verified against Apple's published
// display specifications (support.apple.com/en-us/111349) and common
// Android reference resolutions as of this writing; re-check yearly as new
// hardware ships.
export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: "iphone-16-pro-max", label: "iPhone 16 Pro Max - 1320 x 2868", group: "iPhone", width: 1320, height: 2868 },
  { id: "iphone-16-pro", label: "iPhone 16 Pro - 1206 x 2622", group: "iPhone", width: 1206, height: 2622 },
  { id: "iphone-16", label: "iPhone 16 - 1179 x 2556", group: "iPhone", width: 1179, height: 2556 },
  { id: "iphone-generic", label: "iPhone (19.5:9, generic)", group: "iPhone", width: 1170, height: 2532 },
  { id: "android-20-9", label: "Android (20:9, generic) - 1080 x 2400", group: "Android", width: 1080, height: 2400 },
  { id: "android-19-5-9", label: "Android (19.5:9, generic) - 1080 x 2340", group: "Android", width: 1080, height: 2340 },
  { id: "common-16-9", label: "16:9 desktop / TV - 1920 x 1080", group: "Common", width: 1920, height: 1080 },
  { id: "common-9-16", label: "9:16 phone portrait - 1080 x 1920", group: "Common", width: 1080, height: 1920 },
  { id: "common-1-1", label: "1:1 square - 1080 x 1080", group: "Common", width: 1080, height: 1080 },
  { id: "common-21-9", label: "21:9 ultrawide - 3440 x 1440", group: "Common", width: 3440, height: 1440 },
];

export const CUSTOM_DIMENSION_MIN = 64;
export const CUSTOM_DIMENSION_MAX = 8000;

// Given the source image's natural size, the target output size, and a
// normalized pan offset ([-1, 1] each axis) plus a zoom multiplier (>= 1,
// where 1 is the minimum zoom that still fully covers the target box),
// returns the source-pixel rectangle to draw. offsetX/offsetY of +-1 mean
// "panned as far as possible while still fully covering the frame."
export function computeCoverCrop(
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number,
  offsetX: number,
  offsetY: number,
  zoom: number
): CropRect {
  const clampedZoom = Math.max(1, zoom);
  // Minimum scale (source px -> target px) that covers the target box at
  // zoom = 1: the larger of the two axis ratios, so neither axis falls
  // short.
  const scaleToFrame = Math.max(targetWidth / srcWidth, targetHeight / srcHeight);
  const scale = scaleToFrame * clampedZoom;

  // Size, in source pixels, of the target box at the current scale.
  const visibleWidth = targetWidth / scale;
  const visibleHeight = targetHeight / scale;

  // Maximum distance (in source pixels) the visible window's center can
  // move from the image's own center while still staying fully inside the
  // source image.
  const maxOffsetX = Math.max(0, (srcWidth - visibleWidth) / 2);
  const maxOffsetY = Math.max(0, (srcHeight - visibleHeight) / 2);

  const clampedOffsetX = Math.max(-1, Math.min(1, offsetX));
  const clampedOffsetY = Math.max(-1, Math.min(1, offsetY));

  const centerX = srcWidth / 2 + clampedOffsetX * maxOffsetX;
  const centerY = srcHeight / 2 + clampedOffsetY * maxOffsetY;

  return {
    sx: centerX - visibleWidth / 2,
    sy: centerY - visibleHeight / 2,
    sWidth: visibleWidth,
    sHeight: visibleHeight,
  };
}

// Export-time render: creates a canvas at exactly targetWidth x
// targetHeight and draws the computed crop into it. Re-encoding through
// canvas.toBlob afterward (done by the caller) strips EXIF/GPS the same
// way the existing compressor's pipeline does, with no special-case code
// needed here.
export function renderWallpaperCrop(
  img: HTMLImageElement,
  crop: CropRect,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, crop.sx, crop.sy, crop.sWidth, crop.sHeight, 0, 0, targetWidth, targetHeight);
  return canvas;
}

// True when the source image is smaller than the target in at least one
// dimension, meaning even zoom = 1 (minimum cover) must upscale beyond the
// source's native resolution. This is the one case where the compressor's
// usual "never upscale" rule (see fitDimensions) is knowingly broken -
// a cover-crop wallpaper mathematically requires it. Do not "fix" this
// into a silent letterbox; that would defeat the tool's purpose.
export function needsUpscale(srcWidth: number, srcHeight: number, targetWidth: number, targetHeight: number): boolean {
  return srcWidth < targetWidth || srcHeight < targetHeight;
}
