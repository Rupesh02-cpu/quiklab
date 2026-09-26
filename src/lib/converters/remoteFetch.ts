// Client-side-only "convert from a link" fetch (approach (a) from
// REQUIREMENTS_new-features.md's Feature 2 Part B). This is the free first
// attempt: fetch(url) from the browser, subject to normal CORS rules. It
// works for origins that intentionally allow cross-origin reads (public
// CDNs, raw.githubusercontent.com, jsDelivr/unpkg, some open buckets) and
// fails for most ordinary file hosts (Google Drive/Dropbox share links,
// most CMS media, most personal sites) because permissive CORS headers are
// an explicit opt-in most servers don't make.
//
// mode is always "cors", never "no-cors" - a "no-cors" fetch "succeeds" but
// hands back an opaque response this page's JS cannot read at all, which
// would look like it worked and then fail silently downstream instead of
// failing fast with a clear, honest error. Do not change this.
//
// The serverless proxy fallback (approach (b): src/app/api/fetch-remote/
// route.ts) is intentionally NOT implemented here - see
// REQUIREMENTS_new-features.md's phased build order, step 4. This module
// only exposes the direct-fetch attempt and a typed failure the UI can
// show a clear "couldn't fetch this link directly" message for.

export class RemoteFetchError extends Error {
  readonly reason: "network" | "not-ok" | "html-page" | "invalid-url";
  constructor(reason: RemoteFetchError["reason"], message: string) {
    super(message);
    this.name = "RemoteFetchError";
    this.reason = reason;
  }
}

function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop();
    return last || "downloaded-file";
  } catch {
    return "downloaded-file";
  }
}

export async function fetchRemoteFile(url: string): Promise<{ file: File; viaProxy: false }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new RemoteFetchError("invalid-url", "That doesn't look like a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new RemoteFetchError("invalid-url", "Only http:// and https:// links are supported.");
  }

  let response: Response;
  try {
    // mode "cors" (the default, stated explicitly for clarity) - never
    // "no-cors". A caught failure here is most likely a CORS rejection,
    // but the browser deliberately doesn't expose why a fetch failed for
    // security reasons, so this is not distinguished from a genuine
    // network error/404 - both are treated as "couldn't fetch it."
    response = await fetch(parsed.toString(), { mode: "cors", credentials: "omit" });
  } catch {
    throw new RemoteFetchError(
      "network",
      "Can't fetch that link directly from your browser (most sites block this for security). Try downloading the file and dropping it here instead."
    );
  }

  if (!response.ok) {
    throw new RemoteFetchError("not-ok", `That link returned an error (HTTP ${response.status}).`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new RemoteFetchError(
      "html-page",
      "That link points to a web page, not a file download - look for a 'direct download' or 'raw' link instead."
    );
  }

  const blob = await response.blob();
  const filename = filenameFromUrl(parsed.toString());
  const file = new File([blob], filename, { type: blob.type || contentType || "application/octet-stream" });
  return { file, viaProxy: false };
}
