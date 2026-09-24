// Pure, unit-testable file-type routing logic for the unified drop zone.
// No component/hook state here on purpose — UnifiedDropZone/UnifiedApp own
// the "reading" delay and detected/pending-file state; this only classifies
// a raw file list.

// Source of truth for accepted image MIME types is
// useImageCompressor.ts's ACCEPTED_TYPE_RE — duplicated here (not
// imported) because that constant isn't exported and task 1 was told not
// to modify useImageCompressor.ts's processing logic beyond reading from
// it. Keep in sync if the accepted image types ever change.
const IMAGE_TYPE_RE = /^image\/(jpeg|png|webp|svg\+xml|gif)$/;

export interface DetectedFiles {
  readonly images: File[];
  readonly pdfs: File[];
  readonly rejected: File[];
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isImage(file: File): boolean {
  return IMAGE_TYPE_RE.test(file.type);
}

export function detectFileType(files: FileList | File[]): DetectedFiles {
  const all = Array.from(files);
  const images: File[] = [];
  const pdfs: File[] = [];
  const rejected: File[] = [];

  for (const file of all) {
    if (isImage(file)) images.push(file);
    else if (isPdf(file)) pdfs.push(file);
    else rejected.push(file);
  }

  return { images, pdfs, rejected };
}
