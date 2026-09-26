export type SizeMode = "quality" | "target";
export type BatchMode = "same" | "individual";
export type OutputFormat = "original" | "image/jpeg" | "image/webp" | "image/png" | "image/avif";
export type ViewMode = "grid" | "filmstrip" | "list";
export type SizeUnit = "KB" | "MB";

export interface CompressorSettings {
  sizeMode: SizeMode;
  quality: number; // 10-100
  targetSize: number;
  targetUnit: SizeUnit;
  maxWidth: number | null;
  maxHeight: number | null;
  format: OutputFormat;
  colors: number; // 4-256
  batchMode: BatchMode;
}

export interface ImageItem {
  id: number;
  file: File;
  originalUrl: string;
  originalSize: number;
  ownQuality: number;
  status: "waiting" | "compressing" | "done" | "failed";
  resultBlob: Blob | null;
  resultSize: number;
  resultExt: string;
  keptOriginal: boolean;
}

// ---------- Wallpaper fit ----------

export interface WallpaperItem {
  id: number;
  file: File;
  originalUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  offsetX: number; // -1..1, pan state, persisted per item so switching
  offsetY: number; // between multiple uploaded photos keeps each one's
  zoom: number; // crop independent
  resultBlob: Blob | null;
  resultSize: number;
  status: "waiting" | "rendering" | "done" | "failed";
}

export type WallpaperFormat = "image/jpeg" | "image/png" | "image/webp";

export interface WallpaperSettings {
  presetId: string; // one of WALLPAPER_PRESETS ids, or "custom"
  customWidth: number;
  customHeight: number;
  format: WallpaperFormat;
  quality: number; // 10-100, only meaningful for jpeg/webp
  showSafeArea: boolean; // lock-screen clock/widget guide overlay, default true
}
