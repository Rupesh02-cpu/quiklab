// Table of supported conversions, analogous to pdfTypes.ts's PDF_TOOLS: for
// each supported input type, which output formats are available and a
// human label/lossiness note for each. This is the extension point for
// future converters - add an entry here without touching UI code, matching
// the existing "add an entry to PDF_TOOLS" pattern the README documents
// for PDF tools.

export type ConverterInputKind = "heic" | "docx" | "csv" | "json" | "markdown";

export type ConverterOutputFormat =
  | "image/jpeg"
  | "image/png"
  | "text/html"
  | "text/plain"
  | "application/json"
  | "text/csv";

export interface ConverterOutputOption {
  format: ConverterOutputFormat;
  label: string;
  extension: string;
  // Shown in the Configure step next to the format option so the user
  // isn't surprised by what's lost in Result (e.g. DOCX -> plain text
  // drops all formatting).
  lossNote?: string;
}

export interface ConverterInputDef {
  kind: ConverterInputKind;
  label: string;
  detect: (file: File) => boolean;
  outputs: ConverterOutputOption[];
}

function hasExtension(file: File, ...extensions: string[]): boolean {
  const name = file.name.toLowerCase();
  return extensions.some((ext) => name.endsWith(ext));
}

export const CONVERTERS: ConverterInputDef[] = [
  {
    kind: "heic",
    label: "HEIC / HEIF photo",
    detect: (file) =>
      file.type === "image/heic" || file.type === "image/heif" || hasExtension(file, ".heic", ".heif"),
    outputs: [
      { format: "image/jpeg", label: "JPEG", extension: "jpg" },
      { format: "image/png", label: "PNG", extension: "png" },
    ],
  },
  {
    kind: "docx",
    label: "Word document (.docx)",
    detect: (file) =>
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      hasExtension(file, ".docx"),
    outputs: [
      { format: "text/html", label: "HTML", extension: "html" },
      {
        format: "text/plain",
        label: "Plain text",
        extension: "txt",
        lossNote: "Formatting, images, and tables are not preserved.",
      },
    ],
  },
  {
    kind: "csv",
    label: "CSV file",
    detect: (file) => file.type === "text/csv" || hasExtension(file, ".csv"),
    outputs: [
      { format: "application/json", label: "JSON", extension: "json" },
      { format: "text/html", label: "HTML table", extension: "html" },
    ],
  },
  {
    kind: "json",
    label: "JSON file",
    detect: (file) => file.type === "application/json" || hasExtension(file, ".json"),
    outputs: [{ format: "text/csv", label: "CSV", extension: "csv" }],
  },
  {
    kind: "markdown",
    label: "Markdown file",
    detect: (file) => hasExtension(file, ".md", ".markdown"),
    outputs: [{ format: "text/html", label: "HTML", extension: "html" }],
  },
];

export function detectConverterInput(file: File): ConverterInputDef | null {
  return CONVERTERS.find((c) => c.detect(file)) ?? null;
}
