export type SizeMode = "quality" | "target";
export type BatchMode = "same" | "individual";
export type OutputFormat = "original" | "image/jpeg" | "image/webp" | "image/png";
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
