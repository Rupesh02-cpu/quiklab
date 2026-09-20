# QuikLab — image resizer & compressor

The first tool on QuikLab (live at [quiklab.online](https://quiklab.online), deployed on Vercel), and Phase 1 from the Micro-Tool Field Report: resize and compress images entirely client-side, no upload, no server, no build step. QuikLab is meant as an umbrella brand — more tools (PDF, format conversion, etc.) are planned to live alongside this one on the same site, which is why the name isn't tied to "compress" or "image" specifically.

## Run it

No install needed — it's a static site.

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`. (Opening `index.html` directly via `file://` also works, except the "Download all" ZIP button, which needs JSZip loaded from the CDN — same-origin/http serving avoids any edge-case browser restrictions on local files.)

## What it does

- Drag-and-drop or file-picker upload for JPG / PNG / WebP, multiple files at once.
- Resize by max width/height (aspect ratio preserved) via the Canvas API.
- Recompress via `canvas.toBlob(mime, quality)` — quality slider, or force a different output format (JPEG/WebP/PNG).
- Per-image before/after size, a savings bar, and a running total across the whole batch.
- Download one file, or all of them as a `.zip` (via JSZip 3.10.2, pinned with a Subresource Integrity hash).
- Your images never leave the browser tab — no upload, no fetch, no image data sent anywhere. (Usage analytics, below, is a separate concern from image privacy.)
- If re-encoding wouldn't actually shrink the file (common for already-optimized PNGs — see below), the original file is kept automatically instead of silently handing back something bigger.

## Known limitation (documented, not a bug)

Canvas re-encoding a PNG rarely shrinks it much — PNG is lossless, and the browser's own encoder doesn't do the aggressive palette/quantization tricks a tool like TinyPNG does. Confirmed against real files in testing: two already-optimized PNGs (a screenshot, a design export) came back larger after re-encoding, so the app now detects this and keeps the original instead — you'll see "no gain — original kept" rather than a misleading percentage. JPEG and WebP compress very well through this same pipeline (real photos tested at 16–29% smaller). For genuine PNG compression gains, Phase 2 below is required.

## Analytics (live)

The site is wired to [Microsoft Clarity](https://clarity.microsoft.com) (free, MIT-licensed, heatmaps + session replay of the interface), project id `yl6fc10ssr`. Clarity tracks clicks/scroll/DOM structure of the page itself; it has no access to your images, canvas content, or `<input type="file">` values, and the filename display is marked `clarity-mask` so any real filenames a user uploads are redacted from session replay too.

**This only fires on the real deployment (quiklab.online), not the claude.ai artifact link** — `www.clarity.ms` isn't on the allowed external-script list for a hosted Claude artifact, so the tag is a silent no-op there by design (CSP blocks it).

## Where this sits in the bigger plan (see the Field Report for full detail)

- **Phase 1 (done here):** client-side resize + JPEG/WebP/PNG re-encode, zero backend cost.
- **Phase 2 (not built yet):** real PNG compression server-side via `sharp` (wraps libvips) plus `mozjpeg`/`pngquant` bindings — needed for genuine lossless-feeling PNG shrinkage.
- **Phase 3:** SEO page breadth — `/compress-jpg`, `/compress-png`, `/resize-image`, `/compress-image-without-losing-quality`, `/convert-to-webp`, each with its own landing copy, all linking to each other.
- **Phase 4:** bulk/API tier for e-commerce/dev users processing many images at once, billed via Stripe metered usage or credit packs.

## File structure

```
image-compressor/
├── index.html    # markup + JSZip CDN script tag
├── styles.css    # design tokens (light/dark), layout, components
├── app.js        # all processing logic — no framework, no build step
└── README.md
```
