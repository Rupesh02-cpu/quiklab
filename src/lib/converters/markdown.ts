// Markdown -> HTML, via marked (dynamically imported inside an async
// wrapper since this file's own API is otherwise synchronous once marked
// is loaded - the async wrapper here is only to defer the import).

export async function markdownToHtml(text: string): Promise<string> {
  const { marked } = await import("marked");
  return marked.parse(text, { async: false });
}
