// CSV <-> JSON. Parsing uses papaparse (dynamically imported, same
// lazy-load reasoning as the other converters); the JSON direction is
// hand-rolled since there's no meaningful library need for it.

export async function parseCsv(file: File): Promise<Record<string, string>[]> {
  const Papa = (await import("papaparse")).default;
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err: Error) => reject(err),
    });
  });
}

// Pure helper: an array of flat objects -> a CSV string. Column order is
// taken from the union of keys across all rows, in first-seen order, so a
// ragged array of objects (some rows missing a key another row has) still
// produces a well-formed table with empty cells for missing fields.
export function jsonToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }

  function escapeCell(value: unknown): string {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }

  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(","));
  }
  return lines.join("\n");
}

// Pure helper: parsed CSV rows -> a pretty-printed JSON string.
export function csvToJson(rows: Record<string, string>[]): string {
  return JSON.stringify(rows, null, 2);
}
