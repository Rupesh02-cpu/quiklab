// HEIC/HEIF -> JPEG/PNG, via heic2any (a pure-JS wrapper over a
// libheif-derived Wasm decoder). iPhones default to HEIC and it's a
// constant source of "why won't this upload/open" user pain.
//
// heic2any is dynamically imported inside the function body, not imported
// at module scope, because its Wasm payload is nontrivial (on the order of
// 1-2MB) and most site visitors never touch a HEIC file - this keeps it
// out of the main bundle, the same lazy-load precedent pdfProcessing.ts
// already set for pdfjs-dist's worker-dependent code.

export type HeicOutputMime = "image/jpeg" | "image/png";

export async function convertHeicToImage(file: File, outputMime: HeicOutputMime): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: outputMime, quality: 0.92 });
  // heic2any returns a single Blob for a single-image HEIC, or an array of
  // Blobs for a multi-image HEIC (e.g. a burst) - this converter only
  // targets the common single-photo case, so only the first result is used.
  return Array.isArray(result) ? result[0] : result;
}
