# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Migration in progress (branch `nextjs-migration`):** the description below
> is the deployed `main` branch (the static site). On this branch, both the
> image compressor and the PDF toolkit have been ported to Next.js 16 +
> React + TypeScript under `src/`:
> - Image compressor: `src/hooks/useImageCompressor.ts` + `src/lib/*` +
>   `src/components/ImageCompressor/*`, served at `/`.
> - PDF toolkit: `src/hooks/usePdfToolkit.ts` + `src/lib/pdfProcessing.ts` +
>   `src/lib/pdfTypes.ts` + `src/components/PdfToolkit/*`, served at `/pdf`.
>   Uses `pdf-lib` (writing/editing) and `pdfjs-dist` (rendering pages to
>   canvas for thumbnails and PDF→image export) as real npm dependencies —
>   the pdf.js worker script is copied to `public/pdf.worker.min.js` (from
>   `node_modules/pdfjs-dist/build/pdf.worker.min.js`) so it loads
>   same-origin; re-copy it if `pdfjs-dist` is version-bumped. `next.config.ts`
>   aliases pdfjs-dist's optional Node `canvas` dependency away (both
>   Turbopack and webpack) since it's never used from the browser.
>
> Both are typed and state-driven instead of DOM-driven, but keep the exact
> same client-side-only processing logic and the existing "darkroom" visual
> design (Fraunces + IBM Plex Mono, safelight-red accent, light/dark themes)
> described below. `package.json` is now real (Next.js, React, JSZip,
> pdf-lib, pdfjs-dist as npm dependencies instead of CDN scripts). The old
> static files (`index.html`/`app.js`/`styles.css`/`pdf.html`/`pdf.js`) are
> still present for reference but unused by this branch. Once verified in
> production, this file should be rewritten for the new architecture and the
> static files removed.

## What this is (main / pre-migration)

QuikLab — a static, client-side image resizer/compressor, live at quiklab.online (deployed on Vercel). It's the first tool of an umbrella "QuikLab" brand; more tools are planned to live alongside it. There is no backend, no build step, and no package.json — the entire app is `index.html` + `styles.css` + `app.js`, plus JSZip loaded from a CDN.

## Run it

No install needed.

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` directly via `file://` mostly works too, except the "Download all" ZIP button (needs JSZip from the CDN over http/https, not `file://`).

## Tests

`test/run-tests.js` is a Playwright script (not a test framework/runner like Jest — it's a plain Node script using `playwright` directly) that drives a real browser against a locally served copy of the app and asserts on DOM state. It expects the app served at `http://127.0.0.1:8123` and a Chromium binary at `/opt/pw-browsers/chromium` (hardcoded `executablePath`) — this only runs in the CI/sandbox environment it was written for, not out of the box on an arbitrary machine.

To run it (after serving the app on port 8123):
```
node test/run-tests.js
```

It generates test images on the fly via canvas (`makeImageBuffer`), drives the UI (upload, resize, compress, batch, drag-and-drop, clear), and exits non-zero if any assertion fails or if any uncaught page error occurred. When adding a feature, add a new numbered `TEST N` block following the existing `ok(name, cond, detail)` pattern rather than a separate test file.

## Architecture

Everything lives in one IIFE in `app.js` (`(() => { ... })()`), organized into clearly marked sections (search for `// ---------- <section> ----------`):

1. **toast** — transient confirmation/undo notifications.
2. **theme toggle** — System → Light → Dark → System, persisted to `localStorage` under `quiklab-theme`. The initial theme is applied in an inline `<script>` in `index.html` *before* first paint (to avoid a flash of wrong theme) and mirrored by `applyTheme()`/`currentTheme()` in `app.js`.
3. **save-file** — `saveFile(filename, data)` abstracts the actual file-save mechanism.
4. **helpers**
5. **rendering a frame** — each uploaded image becomes a "frame" card (`renderFrame`) with its own status/result state (`setFrameStatus`, `setFrameFailed`, `setFrameResult`).
6. **ingest files** — `addFiles(fileList)` validates/adds files (drag-drop and file-picker both funnel through this); non-images are rejected client-side.
7. **processing** — `processItem`, `processAll`, `loadImage`, `compressToTarget` (binary search over quality to hit a target file size), `minifySvgText` (SVGs are minified as text, not run through canvas — they're vector, not pixels).
8. **PNG8 color quantization (median cut)** — `medianCutQuantize`, `nearestPaletteColor`: real PNG compression via palette reduction, since canvas re-encoding alone barely shrinks PNGs (see README "Known limitation"). This is the biggest chunk of custom logic in the file.
9. **GIF decoding (GIF89a)** — a hand-rolled GIF decoder (`decodeGif`, LZW decode, deinterlacing, color tables) plus `processGifItem`. No external GIF library is used.
10. **downloads** — `downloadOne`, `downloadAll` (zips via JSZip), `outputName`.
11. **events** — wires up DOM listeners; `applyBatchMode()` / `updateColorsFieldVisibility()` toggle UI affordances based on selected mode.

### Data model

Each uploaded file becomes an item in the module-level `items` array:
```
{ id, file, originalUrl, originalSize, resultBlob, resultExt, el, ... }
```
`el` ties the item back to its rendered DOM frame. There's no framework — state changes are applied directly to `el` via the `setFrame*` functions.

### Processing pipeline

- **JPEG/WebP**: `canvas.toBlob(mime, quality)`, either at a fixed quality (slider) or via `compressToTarget` binary-searching quality to hit a target file size.
- **PNG**: canvas re-encoding rarely shrinks PNGs (lossless format), so real gains come from the median-cut PNG8 quantizer. If re-encoding wouldn't actually shrink the file, the original is kept automatically and the UI shows "no gain — original kept" instead of a misleading/negative percentage.
- **SVG**: minified as text (strip comments, XML/editor metadata, redundant whitespace) — never touches canvas.
- **GIF**: decoded by the hand-rolled GIF89a decoder, processed via `processGifItem`.
- Resize (max width/height) always preserves aspect ratio and happens via the Canvas API before re-encoding.

### Privacy / analytics

Images never leave the browser tab — no upload, no fetch of image data. Separately, the site uses Microsoft Clarity (heatmaps/session replay of the *page*, not image content) and GA4 custom events (`track()` at the top of `app.js`) for usage counts only (no filenames/image data). Clarity only fires on the real deployment (quiklab.online) — it's a no-op elsewhere (e.g. a hosted Claude artifact link) because the CSP there blocks `www.clarity.ms`. EXIF/GPS metadata is stripped as an explicit, visible privacy feature — don't reintroduce it silently when touching the processing pipeline.

## Deployment

Deployed on Vercel (`.vercel/project.json` links this repo to the `quiklab` project). Since it's a static site, deployment is just publishing the root files — no build command.
