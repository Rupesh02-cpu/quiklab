import { PDFDocument, PDFString, StandardFonts, rgb } from "pdf-lib";
import type { PdfRunResult, TextAnnotation } from "./pdfTypes";
import { stripExt } from "./pdfProcessing";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const TEXT_COLORS = {
  ink: rgb(0.1, 0.1, 0.1),
  accent: rgb(0.78, 0.2, 0.12),
  blue: rgb(0.13, 0.32, 0.66),
};

/**
 * Attaches a clickable URI link annotation to a PDF page.
 *
 * pdf-lib has no high-level API for hyperlinks — `page.drawText()` only
 * draws static glyphs, there is no `page.drawLink()`. The standard
 * workaround (documented across pdf-lib GitHub issues, e.g. pdf-lib#173
 * "How can I add a link (URL) to my PDF using pdf-lib", and used by
 * community wrapper packages such as `pdf-lib-plus-encrypt`) is to drop
 * down to pdf-lib's low-level `context` API and construct the raw PDF
 * object graph the spec requires for a Link annotation:
 *
 *   12.5.2 "Annotation Dictionaries" + 12.5.6.5 "Link Annotations" +
 *   12.6.4.7 "URI Actions" of ISO 32000-1:
 *     <</Type /Annot /Subtype /Link /Rect [x1 y1 x2 y2]
 *       /Border [0 0 0] /A <</Type /Action /S /URI /URI (https://...)>>>>
 *
 * This mirrors exactly how pdf-lib's own form-field widgets attach
 * themselves to a page (see node_modules/pdf-lib's
 * core/annotation/PDFWidgetAnnotation.ts, which also builds a raw
 * `context.obj({...})` dict of Subtype /Widget and hangs it off the
 * page's /Annots array via `PDFPageLeaf.addAnnot`) — link annotations use
 * the exact same `/Annots` mechanism, just a different /Subtype and no
 * associated form field. `page.node.addAnnot()` (the same method
 * PDFWidgetAnnotation-backed form fields use internally) is what actually
 * pushes the ref onto the page's /Annots array here.
 */
function addLinkAnnotation(
  doc: PDFDocument,
  page: ReturnType<PDFDocument["getPage"]>,
  rect: [number, number, number, number],
  url: string
) {
  const context = doc.context;
  const linkAnnotDict = context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: rect,
    Border: [0, 0, 0],
    C: [],
    A: {
      Type: "Action",
      S: "URI",
      URI: PDFString.of(url),
    },
  });
  const linkAnnotRef = context.register(linkAnnotDict);
  page.node.addAnnot(linkAnnotRef);
}

export async function runAddTextAndLinks(
  file: File,
  annotations: TextAnnotation[],
  onProgress: (pct: number) => void
): Promise<PdfRunResult> {
  const buf = await file.arrayBuffer();
  const doc = await PDFDocument.load(buf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  let linkCount = 0;
  let textCount = 0;

  annotations.forEach((ann, i) => {
    const page = pages[ann.pageIndex];
    if (!page) return;
    const color = TEXT_COLORS[ann.color] || TEXT_COLORS.ink;

    if (ann.type === "text") {
      page.drawText(ann.text || "", {
        x: ann.x,
        y: ann.y,
        size: ann.fontSize,
        font,
        color,
      });
      textCount++;
    } else {
      // Draw the link's label as visible text, then lay an invisible
      // clickable Link annotation rectangle over it so it reads and
      // behaves like a normal hyperlink in a PDF viewer.
      const label = ann.text || ann.url || "";
      page.drawText(label, {
        x: ann.x,
        y: ann.y,
        size: ann.fontSize,
        font,
        color: TEXT_COLORS.blue,
      });
      const width = font.widthOfTextAtSize(label, ann.fontSize);
      const height = ann.fontSize * 1.15;
      // Underline, since link annotations carry no visual affordance of
      // their own — without this the text is indistinguishable from a
      // plain label until hovered/clicked.
      page.drawLine({
        start: { x: ann.x, y: ann.y - 2 },
        end: { x: ann.x + width, y: ann.y - 2 },
        thickness: 0.75,
        color: TEXT_COLORS.blue,
      });
      if (ann.url) {
        addLinkAnnotation(doc, page, [ann.x, ann.y - 2, ann.x + width, ann.y + height], ann.url);
        linkCount++;
      }
    }
    onProgress(20 + Math.round(((i + 1) / annotations.length) * 60));
  });

  const bytes = await doc.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const parts = [];
  if (textCount) parts.push(`${textCount} text`);
  if (linkCount) parts.push(`${linkCount} link${linkCount === 1 ? "" : "s"}`);

  return {
    title: "Edited",
    detail: `${parts.join(", ") || "No annotations"} added, ${fmtSize(blob.size)}`,
    files: [{ blob, filename: `${stripExt(file.name)}-edited.pdf` }],
  };
}
