export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const EXT_FOR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
  "image/avif": "avif",
};

export function extFor(mime: string): string {
  return EXT_FOR_MIME[mime] || "jpg";
}

export function targetMimeFor(file: File, format: string): string {
  if (file.type === "image/svg+xml") return "image/svg+xml";
  if (file.type === "image/gif") return "image/gif";
  if (format !== "original") return format;
  // keep original type when possible, default to jpeg for anything unrecognized (e.g. avif upload)
  return ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) ? file.type : "image/jpeg";
}

// Feature-detects AVIF encode support via a real canvas.toBlob probe rather
// than a browser/UA sniff - the only reliable way to know, since support
// varies by browser and version and canvas.toBlob silently falls back to
// PNG (or resolves null) for an unsupported mime instead of throwing.
// Cached after the first check since the answer can't change mid-session.
let avifSupportPromise: Promise<boolean> | null = null;
export function supportsAvifEncode(): Promise<boolean> {
  if (avifSupportPromise) return avifSupportPromise;
  avifSupportPromise = new Promise<boolean>((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      canvas.toBlob(
        (blob) => resolve(!!blob && blob.type === "image/avif"),
        "image/avif"
      );
    } catch {
      resolve(false);
    }
  });
  return avifSupportPromise;
}

// Strip path separators and control characters from an untrusted filename
// before it's used as a real output name — a "/" here would silently nest
// the file into a subfolder inside the generated ZIP, and control
// characters have no legitimate reason to be in a filename.
export function outputName(fileName: string, resultExt: string): string {
  const safeOriginal = fileName.replace(/[/\\\x00-\x1f]/g, "_");
  const base = safeOriginal.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${resultExt}`;
}
