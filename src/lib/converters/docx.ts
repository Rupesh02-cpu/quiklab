// DOCX -> HTML or plain text, via mammoth (pure JS, no Wasm). One
// directional (docx to html/text only) and targets Word's modern .docx
// format specifically, not the legacy binary .doc format.
//
// mammoth is dynamically imported inside each function body (not at module
// scope) for the same lazy-load reason as heic.ts/csv.ts - most visitors
// never convert a DOCX file, so it shouldn't cost anyone else bundle size.

export async function convertDocxToHtml(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}

export async function convertDocxToText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
