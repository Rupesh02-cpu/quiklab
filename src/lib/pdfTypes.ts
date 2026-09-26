export type PdfToolId = "merge" | "split" | "compress" | "rotate" | "watermark" | "img2pdf" | "pdf2img" | "edit";

export interface PdfToolDef {
  id: PdfToolId;
  title: string;
  desc: string;
  accept: string;
  multiple: boolean;
  dropLabel: string;
  icon: string;
  showFileList: boolean;
  showPageGrid: boolean;
  showWatermarkForm: boolean;
  showCompressForm: boolean;
  showEditCanvas: boolean;
  runLabel: string;
  minFiles?: number;
}

export const PDF_TOOLS: Record<PdfToolId, PdfToolDef> = {
  merge: {
    id: "merge",
    title: "Merge PDFs",
    desc: "Add two or more PDFs, drag to reorder, then merge into one file.",
    accept: "application/pdf",
    multiple: true,
    dropLabel: "Drop PDF files here",
    icon: "merge",
    showFileList: true,
    showPageGrid: false,
    showWatermarkForm: false,
    showCompressForm: false,
    showEditCanvas: false,
    runLabel: "Merge PDFs",
    minFiles: 2,
  },
  split: {
    id: "split",
    title: "Split & extract",
    desc: "Upload one PDF, select the pages you want, then pull them into a new PDF.",
    accept: "application/pdf",
    multiple: false,
    dropLabel: "Drop a PDF here",
    icon: "split",
    showFileList: false,
    showPageGrid: true,
    showWatermarkForm: false,
    showCompressForm: false,
    showEditCanvas: false,
    runLabel: "Extract selected pages",
  },
  compress: {
    id: "compress",
    title: "Compress PDF",
    desc: "Re-encodes embedded images at a lower quality to shrink file size.",
    accept: "application/pdf",
    multiple: false,
    dropLabel: "Drop a PDF here",
    icon: "compress",
    showFileList: true,
    showPageGrid: false,
    showWatermarkForm: false,
    showCompressForm: true,
    showEditCanvas: false,
    runLabel: "Compress PDF",
  },
  rotate: {
    id: "rotate",
    title: "Rotate pages",
    desc: "Click a page to rotate it 90°, or rotate every page at once.",
    accept: "application/pdf",
    multiple: false,
    dropLabel: "Drop a PDF here",
    icon: "rotate",
    showFileList: false,
    showPageGrid: true,
    showWatermarkForm: false,
    showCompressForm: false,
    showEditCanvas: false,
    runLabel: "Save rotated PDF",
  },
  watermark: {
    id: "watermark",
    title: "Add watermark",
    desc: "Stamp text across every page of your PDF.",
    accept: "application/pdf",
    multiple: false,
    dropLabel: "Drop a PDF here",
    icon: "watermark",
    showFileList: true,
    showPageGrid: false,
    showWatermarkForm: true,
    showCompressForm: false,
    showEditCanvas: false,
    runLabel: "Add watermark",
  },
  img2pdf: {
    id: "img2pdf",
    title: "Image → PDF",
    desc: "Upload JPG, PNG, or WebP images, each becomes its own page, in the order added.",
    accept: "image/png,image/jpeg,image/webp",
    multiple: true,
    dropLabel: "Drop images here",
    icon: "img2pdf",
    showFileList: true,
    showPageGrid: false,
    showWatermarkForm: false,
    showCompressForm: false,
    showEditCanvas: false,
    runLabel: "Create PDF",
  },
  pdf2img: {
    id: "pdf2img",
    title: "PDF → image",
    desc: "Upload a PDF and export every page as a PNG image.",
    accept: "application/pdf",
    multiple: false,
    dropLabel: "Drop a PDF here",
    icon: "pdf2img",
    showFileList: true,
    showPageGrid: false,
    showWatermarkForm: false,
    showCompressForm: false,
    showEditCanvas: false,
    runLabel: "Export pages as PNG",
  },
  edit: {
    id: "edit",
    title: "Add text & links",
    desc: "Click anywhere on a page to place text or a clickable hyperlink, then export.",
    accept: "application/pdf",
    multiple: false,
    dropLabel: "Drop a PDF here",
    icon: "edit",
    showFileList: false,
    showPageGrid: false,
    showWatermarkForm: false,
    showCompressForm: false,
    showEditCanvas: true,
    runLabel: "Save edited PDF",
  },
};

export const PDF_TOOL_ORDER: PdfToolId[] = [
  "merge",
  "split",
  "compress",
  "rotate",
  "watermark",
  "img2pdf",
  "pdf2img",
  "edit",
];

export interface PdfFileEntry {
  id: number;
  file: File;
}

export interface PageMeta {
  index: number;
  rotationAdd: 0 | 90 | 180 | 270;
  selected: boolean;
}

export type WatermarkPosition = "center" | "tile" | "bottom";
export type WatermarkColor = "gray" | "red" | "black";

export interface WatermarkSettings {
  text: string;
  position: WatermarkPosition;
  opacity: number; // 5-80
  size: number; // 16-120
  color: WatermarkColor;
}

export type TextAnnotationColor = "ink" | "accent" | "blue";

// One placed item on the "Add text & links" canvas. x/y are already in PDF
// page coordinates (bottom-left origin, points) by the time this reaches
// runAddTextAndLinks — the conversion from on-screen preview pixels happens
// in PdfEditCanvas.
export interface TextAnnotation {
  id: number;
  pageIndex: number;
  type: "text" | "link";
  x: number;
  y: number;
  text: string;
  url?: string;
  fontSize: number;
  color: TextAnnotationColor;
}

export interface ResultFile {
  blob: Blob;
  filename: string;
}

export interface PdfRunResult {
  title: string;
  detail: string;
  files: ResultFile[]; // files[0] is the primary single download; multiple => zip-all offered
}
