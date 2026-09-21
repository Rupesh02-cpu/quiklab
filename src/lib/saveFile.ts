// Triggers a real browser download of in-memory data via a temporary
// object URL + a synthetic <a download> click — the standard way to save
// a Blob/File the page generated itself, without any server round trip.
export async function saveFile(filename: string, data: Blob): Promise<boolean> {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
