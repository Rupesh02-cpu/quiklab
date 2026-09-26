import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type { PageMeta, PdfRunResult, WatermarkSettings } from "./pdfTypes";

// pdf.js needs its worker set up before any getDocument() call. The worker
// script (node_modules/pdfjs-dist/build/pdf.worker.min.js) is copied into
// public/pdf.worker.min.js so it loads same-origin instead of depending on
// a CDN at runtime. Re-copy it if the pdfjs-dist version is bumped.
async function getPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  return pdfjsLib;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

async function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export async function runMerge(files: File[], onProgress: (pct: number) => void): Promise<PdfRunResult> {
  const out = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const buf = await readAsArrayBuffer(files[i]);
    const src = await PDFDocument.load(buf);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    onProgress(10 + Math.round(((i + 1) / files.length) * 80));
  }
  const bytes = await out.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  return {
    title: "Merged",
    detail: `${files.length} files → 1 PDF, ${fmtSize(blob.size)}`,
    files: [{ blob, filename: "quiklab-merged.pdf" }],
  };
}

export async function loadPageMeta(
  bytes: ArrayBuffer,
  preselectAll: boolean,
  scale = 0.3
): Promise<{ pageMeta: PageMeta[]; thumbnails: string[] }> {
  const pdfjsLib = await getPdfjs();
  const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  try {
    const count = doc.numPages;
    const pageMeta: PageMeta[] = Array.from({ length: count }, (_, i) => ({
      index: i,
      rotationAdd: 0,
      selected: preselectAll,
    }));

    const thumbnails: string[] = [];
    for (let i = 1; i <= count; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      thumbnails.push(canvas.toDataURL("image/png"));
    }
    return { pageMeta, thumbnails };
  } finally {
    // pdf.js documents hold worker-side resources that aren't freed by
    // garbage collection alone; destroy() must be called explicitly or
    // every PDF operation leaks worker memory.
    doc.destroy();
  }
}

// Page dimensions in PDF points (bottom-left origin, y-up), used by the
// edit canvas to convert a click position in on-screen preview pixels back
// into PDF coordinates for drawText/link-annotation placement.
export async function loadPageSizes(bytes: ArrayBuffer): Promise<{ width: number; height: number }[]> {
  const pdfjsLib = await getPdfjs();
  const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  try {
    const sizes: { width: number; height: number }[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      sizes.push({ width: viewport.width, height: viewport.height });
    }
    return sizes;
  } finally {
    doc.destroy();
  }
}

export async function runSplit(
  originalBytes: ArrayBuffer,
  selectedIndices: number[],
  totalPages: number,
  originalFileName: string,
  onProgress: (pct: number) => void
): Promise<PdfRunResult> {
  const src = await PDFDocument.load(originalBytes.slice(0));
  onProgress(40);

  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, selectedIndices);
  pages.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  onProgress(90);

  return {
    title: "Extracted",
    detail: `${selectedIndices.length} of ${totalPages} pages → 1 PDF, ${fmtSize(blob.size)}`,
    files: [{ blob, filename: `${stripExt(originalFileName)}-extracted.pdf` }],
  };
}

export async function runCompress(
  file: File,
  quality: number,
  onProgress: (pct: number) => void
): Promise<PdfRunResult> {
  const buf = await readAsArrayBuffer(file);
  const originalSize = file.size;
  const pdfjsLib = await getPdfjs();
  const doc = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  const out = await PDFDocument.create();

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      // The render viewport uses scale:1.5 for a sharper rasterization (more
      // source pixels for the JPEG re-encode to work with), but the output
      // PDF page must keep the ORIGINAL page's point dimensions (scale:1) —
      // otherwise every page comes out ~150% of its real physical size.
      const pageSize = page.getViewport({ scale: 1 });
      const renderViewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

      const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
      const jpegBytes = await (await fetch(jpegDataUrl)).arrayBuffer();
      const embedded = await out.embedJpg(jpegBytes);
      const pdfPage = out.addPage([pageSize.width, pageSize.height]);
      pdfPage.drawImage(embedded, { x: 0, y: 0, width: pageSize.width, height: pageSize.height });

      onProgress(25 + Math.round((i / doc.numPages) * 65));
    }
  } finally {
    doc.destroy();
  }

  const bytes = await out.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });

  if (blob.size >= originalSize) {
    return {
      title: "No gain, original kept",
      detail: `Compression wouldn't shrink this file (${fmtSize(originalSize)}), so the original was kept.`,
      files: [{ blob: file, filename: file.name }],
    };
  }
  const pct = Math.round((1 - blob.size / originalSize) * 100);
  return {
    title: "Compressed",
    detail: `${fmtSize(originalSize)} → ${fmtSize(blob.size)} (−${pct}%)`,
    files: [{ blob, filename: `${stripExt(file.name)}-compressed.pdf` }],
  };
}

export async function runRotate(
  originalBytes: ArrayBuffer,
  pageMeta: PageMeta[],
  originalFileName: string,
  onProgress: (pct: number) => void
): Promise<PdfRunResult> {
  const src = await PDFDocument.load(originalBytes.slice(0));
  const pages = src.getPages();
  pageMeta.forEach((meta, i) => {
    if (meta.rotationAdd) {
      const page = pages[i];
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + meta.rotationAdd) % 360));
    }
  });
  onProgress(70);
  const bytes = await src.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const rotatedCount = pageMeta.filter((m) => m.rotationAdd).length;
  return {
    title: "Rotated",
    detail: `${rotatedCount} page(s) rotated, ${fmtSize(blob.size)}`,
    files: [{ blob, filename: `${stripExt(originalFileName)}-rotated.pdf` }],
  };
}

const WATERMARK_COLORS = {
  gray: rgb(0.5, 0.5, 0.5),
  red: rgb(0.78, 0.2, 0.12),
  black: rgb(0.1, 0.1, 0.1),
};

export async function runWatermark(
  file: File,
  settings: WatermarkSettings,
  onProgress: (pct: number) => void
): Promise<PdfRunResult> {
  const buf = await readAsArrayBuffer(file);
  const doc = await PDFDocument.load(buf);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const text = settings.text.trim() || "CONFIDENTIAL";
  const opacity = settings.opacity / 100;
  const size = settings.size;
  const color = WATERMARK_COLORS[settings.color] || WATERMARK_COLORS.gray;

  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, size);

    if (settings.position === "center") {
      page.drawText(text, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size,
        font,
        color,
        opacity,
        rotate: degrees(45),
      });
    } else if (settings.position === "bottom") {
      page.drawText(text, {
        x: width / 2 - textWidth / 2,
        y: Math.max(24, height * 0.06),
        size,
        font,
        color,
        opacity,
      });
    } else if (settings.position === "tile") {
      const stepX = textWidth + 80;
      const stepY = size + 80;
      for (let y = -height; y < height * 2; y += stepY) {
        for (let x = -width; x < width * 2; x += stepX) {
          page.drawText(text, { x, y, size, font, color, opacity, rotate: degrees(45) });
        }
      }
    }
    onProgress(20 + Math.round(((i + 1) / pages.length) * 70));
  });

  const bytes = await doc.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  return {
    title: "Watermarked",
    detail: `${pages.length} page(s), ${fmtSize(blob.size)}`,
    files: [{ blob, filename: `${stripExt(file.name)}-watermarked.pdf` }],
  };
}

// Pixel dimensions aren't PDF points, so a photo's raw pixel count (e.g.
// 4000x3000) used directly as points would produce a page many times
// larger than any real paper size. Assume a reasonable screen/print
// density and convert pixels -> points (72 points per inch) at that DPI.
const IMG2PDF_DPI = 96;
function pxToPt(px: number): number {
  return (px / IMG2PDF_DPI) * 72;
}

export async function runImg2Pdf(files: File[], onProgress: (pct: number) => void): Promise<PdfRunResult> {
  const out = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let img;
    if (file.type === "image/png") {
      const buf = await readAsArrayBuffer(file);
      img = await out.embedPng(buf);
    } else {
      // JPEG is re-encoded through canvas too (not embedded raw) so it goes
      // through the same privacy guarantee as every other processing path
      // in this app: canvas drawImage/toDataURL does not carry over EXIF/GPS
      // metadata from the source file. WebP isn't embeddable by pdf-lib
      // directly, so it needed this path already; JPEG now shares it rather
      // than embedding the original bytes (and their EXIF/GPS) unchanged.
      // Follow-up: EXIF orientation isn't read/applied here, so a photo
      // whose orientation relies on EXIF (rather than baked-in pixels) may
      // appear rotated relative to how it looks in an EXIF-aware viewer.
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
      const jpegBuf = await (await fetch(canvas.toDataURL("image/jpeg", 0.92))).arrayBuffer();
      img = await out.embedJpg(jpegBuf);
    }
    const pageWidth = pxToPt(img.width);
    const pageHeight = pxToPt(img.height);
    const page = out.addPage([pageWidth, pageHeight]);
    page.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    onProgress(10 + Math.round(((i + 1) / files.length) * 80));
  }
  const bytes = await out.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  return {
    title: "PDF created",
    detail: `${files.length} image(s) → 1 PDF, ${fmtSize(blob.size)}`,
    files: [{ blob, filename: "quiklab-images.pdf" }],
  };
}

export async function runPdf2Img(file: File, onProgress: (pct: number) => void): Promise<PdfRunResult> {
  const buf = await readAsArrayBuffer(file);
  const pdfjsLib = await getPdfjs();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const baseName = stripExt(file.name);
  const pngs: { blob: Blob; filename: string }[] = [];

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
      pngs.push({ blob, filename: `${baseName}-page${String(i).padStart(2, "0")}.png` });
      onProgress(10 + Math.round((i / doc.numPages) * 80));
    }
  } finally {
    doc.destroy();
  }

  return {
    title: "Exported",
    detail: `${pngs.length} page(s) as PNG`,
    files: pngs,
  };
}
