# Requirements: two new features

This document specifies two new features for a future implementation agent.
It assumes you have already read `CLAUDE.md`, `HANDOFF.md`, and `README.md`
and understand: the Next.js 16 / React 19 / TypeScript architecture, the
"files never leave the device" rule, the Upload > Configure > Result wizard
pattern (`stepIndex` / `maxReachedIndex` / `goToStep` / generation-guard refs
in each hook), the `src/components` / `src/hooks` / `src/lib` layering, the
"darkroom" design system in `src/app/quiklab.css`, and the multi-agent build
process in `HANDOFF.md` section 8. Nothing below repeats that context; it
only adds what's new.

No implementation code is in this document. It is research and
specification only, produced by reading the actual current source
(`src/lib/imageProcessing.ts`, `src/hooks/useImageCompressor.ts`,
`src/components/ImageCompressor/*`, `src/components/UnifiedUpload/*`,
`src/lib/types.ts`, `src/lib/format.ts`, `src/lib/saveFile.ts`,
`src/lib/pdfTypes.ts`, `next.config.ts`, `package.json`) as of the
`nextjs-migration` branch, commit `11b0ce2` era.

---

## Feature 1: Wallpaper-ready image fitting

### Problem statement

A user has a photo they want to set as a phone wallpaper. Phone OSes crop
wallpapers to fill the screen using the screen's own aspect ratio (roughly
19.5:9 on modern iPhones, ~20:9 or 19.5:9/18:9 on Android, varies by model).
If the photo's aspect ratio doesn't match, the OS's "set as wallpaper" flow
either crops off important content (a face, a subject) or the user has to
awkwardly pinch-zoom in a system UI that gives little control. QuikLab
already runs a full canvas-based resize pipeline client-side; the natural
extension is a tool that lets the user pick the *exact* target aspect ratio
and resolution up front, control the crop/pan themselves with a live
preview, and export a file that already exactly matches the target so the
OS wallpaper picker needs to do no further cropping.

### Chosen approach and justification

Build a new sibling tool, "Wallpaper fit" (working name; final copy is the
implementer's call, keep it short per the design rules), reusing the
existing `fitDimensions`/canvas-draw plumbing in `src/lib/imageProcessing.ts`
but adding a new pure function for a **cover-crop with user-controlled
offset and zoom**, plus a new interactive pan/zoom UI component. This is
justified because:

- The existing pipeline already does "load image into `<img>`, draw to an
  offscreen `<canvas>` at computed dimensions, `canvas.toBlob`" — the same
  three steps apply here, only the "computed dimensions" step changes from
  "fit within a box" (`fitDimensions`, aspect-preserving, letterboxed by
  omission) to "cover a box exactly, at a chosen pan/zoom" (new function).
- A brand-new interactive crop UI (drag-to-reposition, pinch/wheel-to-zoom)
  is genuinely new work; nothing existing does free-form pointer-driven
  cropping. `PdfEditCanvas.tsx` is the closest precedent in the repo for
  "convert pointer coordinates on a previewed image into logical
  coordinates" (see its `handleCanvasClick`), so follow that same pattern
  (raw pointer events + `getBoundingClientRect()` math, no drag/gesture
  library) rather than pulling in a new dependency — consistent with the
  project's stated preference for pure CSS/no-animation-library and small
  bundle size, and the PDF editor already proves this approach works
  without a library.
- No new npm dependency is required. Do not add `react-easy-crop` or
  similar; the math is simple enough (see Data flow below) and the project
  has a stated bias toward hand-rolled, dependency-free interaction code.

### Exact new/changed files

**New library code** (`src/lib/`):
- `src/lib/wallpaperFit.ts` (new file, pure functions, no React, mirrors the
  style of `imageProcessing.ts`):
  - `WALLPAPER_PRESETS: WallpaperPreset[]` — the aspect-ratio/resolution
    preset list (see Presets below).
  - `type WallpaperPreset = { id: string; label: string; group: "iPhone" | "Android" | "Common" | "Custom"; width: number; height: number; }`
  - `computeCoverCrop(srcWidth: number, srcHeight: number, targetWidth: number, targetHeight: number, offsetX: number, offsetY: number, zoom: number): CropRect` —
    pure function that, given the source image's natural pixel size, the
    target output size, and a normalized pan offset (`offsetX`/`offsetY`,
    each in `[-1, 1]`, representing how far the image has been dragged
    relative to the amount of "slack" available at the current zoom) and a
    `zoom` multiplier (`>= 1`, `1` = the minimum zoom that still fully
    covers the target box), returns `{ sx, sy, sWidth, sHeight }` — the
    source-image rectangle (in source pixels) to draw. This is the
    "cover" analogue of `fitDimensions`: `fitDimensions` shrinks-to-fit
    (may letterbox), this crops-to-fill (never letterboxes, matching what
    "set as wallpaper" actually needs).
  - `renderWallpaperCrop(img: HTMLImageElement, crop: CropRect, targetWidth: number, targetHeight: number): HTMLCanvasElement` —
    creates a canvas at exactly `targetWidth x targetHeight`, and
    `ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight)`.
    This is the export-time equivalent of what the live preview shows
    (same crop math, just rendered into a canvas instead of CSS transforms).
  - Do **not** duplicate `loadImage` — import it from `imageProcessing.ts`.
  - Reuse `compressToTarget` from `imageProcessing.ts` unchanged for the
    final quality/size step (JPEG/WebP output), since export quality
    control is identical to the existing compressor's.

- `src/lib/types.ts` (edit, additive only): add
  ```ts
  export interface WallpaperItem {
    id: number;
    file: File;
    originalUrl: string;
    naturalWidth: number;
    naturalHeight: number;
    offsetX: number;   // -1..1, pan state, persisted per item so switching
    offsetY: number;   // between multiple uploaded photos keeps each one's
    zoom: number;       // crop independent
    resultBlob: Blob | null;
    resultSize: number;
    status: "waiting" | "rendering" | "done" | "failed";
  }
  export interface WallpaperSettings {
    presetId: string;       // one of WALLPAPER_PRESETS ids, or "custom"
    customWidth: number;
    customHeight: number;
    format: "image/jpeg" | "image/png" | "image/webp";
    quality: number; // 10-100, only meaningful for jpeg/webp
    showSafeArea: boolean; // lock-screen clock/widget guide overlay, default true
  }
  ```

**New hook** (`src/hooks/`):
- `src/hooks/useWallpaperFit.ts` — modeled directly on
  `useImageCompressor.ts`'s shape and conventions:
  - `stepIndex` / `maxReachedIndex` / `goToStep`, `clearGeneration` ref,
    `settingsRef` mirror-ref for settings read inside async work — copy
    these patterns exactly, they're battle-tested (see HANDOFF.md's note
    that these guards were "hardened and tested against aggressive
    back/forward clicking. Do not remove them" — the same discipline
    applies to any new hook).
  - `addFiles(fileList)`: accepts the same image MIME allowlist as
    `useImageCompressor` (reuse/import the regex or export it from
    `useImageCompressor.ts` — currently `ACCEPTED_TYPE_RE` is module-private;
    either export it or duplicate it the same way `detectFileType.ts`
    already duplicates it, matching that file's existing precedent and its
    comment explaining why it's duplicated rather than imported).
  - `setPan(id, offsetX, offsetY)`, `setZoom(id, zoom)`: update one item's
    crop state as the user drags/scrolls in Configure. These fire on every
    pointer-move, so keep them cheap (plain `setItems` map, no async work,
    no `track()` calls per-move — only track on drop/complete).
  - `renderPreviewCanvas` is NOT part of the hook — the live preview is
    pure CSS (see UI/UX below), not a canvas re-render on every drag frame;
    only the final export step touches canvas. This matters for perf: a
    canvas redraw per pointer-move on a large photo would jank, whereas a
    CSS `transform: translate()/scale()` on an `<img>` is free.
  - `processAll()`: for each item, call `renderWallpaperCrop` then
    `canvas.toBlob`/`compressToTarget` exactly as `useImageCompressor`'s
    `processOne` does, guarded by the same `clearGeneration` check.
  - `downloadOne` / `downloadAll` (ZIP via JSZip): copy
    `useImageCompressor.ts`'s implementations essentially verbatim (same
    `saveFile`, same `outputName` from `src/lib/format.ts` — note
    `outputName` takes a `resultExt` string, reuse as-is).
  - Do not modify `useImageCompressor.ts` itself; this is a new, separate
    hook with its own state, even though the underlying canvas primitives
    are shared via `imageProcessing.ts`.

**New components** (`src/components/WallpaperFit/`, new directory, mirrors
`src/components/ImageCompressor/`):
- `WallpaperFitApp.tsx` — top-level, same `renderShell` / `initialFiles`
  prop contract as `ImageCompressorApp.tsx` (so it can later be mounted
  inside `UnifiedApp` the same way, or launched from its own route) — same
  3-step `Stepper` with steps `Upload`, `Configure`, `Result`.
- `WallpaperDropZone.tsx` — can likely just be a thin wrapper around, or a
  copy of, `ImageCompressor/DropZone.tsx` with copy changed to mention
  wallpapers; the accept types are identical (JPG/PNG/WebP — SVG and GIF
  are meaningless for a "crop to exact pixel size" wallpaper tool, so
  narrow the accept list to `image/jpeg,image/png,image/webp` only; reject
  SVG/GIF client-side same as the compressor rejects non-images).
- `PresetPicker.tsx` — renders `WALLPAPER_PRESETS` grouped by `group`, plus
  a "Custom" option that reveals width/height number inputs (same
  `field`/`field-row` CSS classes as `ControlsPanel.tsx` uses for max
  width/height, for visual consistency).
- `CropStage.tsx` — the core new interactive piece. Renders:
  - An outer div sized to the target aspect ratio (`aspect-ratio: W / H`
    CSS, matching the chosen preset — this makes the live preview exactly
    proportioned to the real output without any canvas math needed just to
    show it).
  - An inner `<img>` of the original photo, absolutely positioned, with a
    CSS `transform: translate(Xpx, Ypx) scale(zoom)` driven by
    `offsetX`/`offsetY`/`zoom` state — this is the live preview; it is
    pure CSS, not a canvas re-render, exactly analogous to how
    `PdfEditCanvas.tsx` overlays absolutely-positioned annotation divs on
    top of a static `<img>` rather than redrawing anything.
  - Pointer handlers (`onPointerDown`/`onPointerMove`/`onPointerUp`,
    Pointer Events API, not the legacy mouse+touch dual handling) that
    translate drag distance into `offsetX`/`offsetY`, clamped so the image
    can never be dragged to reveal empty space (the clamp bounds are a
    function of `zoom` and the target/source aspect ratios — see Data flow).
  - A `<input type="range">` (reuse the same slider styling class as
    `ControlsPanel.tsx`'s quality slider) for zoom, plus wheel-to-zoom
    (`onWheel`, `e.preventDefault()`) and pinch-to-zoom on touch (two-pointer
    distance delta via the Pointer Events API — track two active pointer
    ids in a ref, compute distance each move).
  - When `settings.showSafeArea` is true, an absolutely-positioned overlay
    (dashed border rectangles, `pointer-events: none`) marking the
    top ~15% (status bar/clock) and bottom ~20% (widgets/dock) of the frame
    as "may be covered by lock-screen UI" — this is guidance only, drawn in
    CSS, never baked into the exported pixels.
  - A "Center" / "Reset crop" button that resets `offsetX/offsetY/zoom` to
    the auto-center default for that item.
- `WallpaperResultPanel.tsx` — grid of finished items with before/after
  aspect-ratio thumbnails and per-item + "download all" buttons; can mirror
  `Frame.tsx` + the result section of `ImageCompressorApp.tsx` fairly
  closely, without the quality-adjustment UI (no per-image quality slider
  needed here — quality is a single shared setting, format/output only).

**New route** (optional for v1, recommend deferring): `src/app/wallpaper/page.tsx`
following the exact pattern of `src/app/pdf/page.tsx` (metadata, JSON-LD,
renders `WallpaperFitApp`). Whether this becomes its own top-level tool
entry (like `/pdf`) or a mode reachable from inside the image compressor
(e.g. a button in `ControlsPanel.tsx`: "Fit to wallpaper instead") is a
product decision, not an architecture one — the architecture above works
either way since `WallpaperFitApp` takes the same `renderShell`/`initialFiles`
contract as the other tool apps. Recommend a dedicated `/wallpaper` route
for SEO (matches the existing pattern of `/` and `/pdf` both being
real indexable routes) and add it to `UnifiedApp`'s file-detection flow only
if/when there's a clear signal a dropped image should default into this
tool rather than the compressor (not obvious there is one — recommend
`/wallpaper` be a separate, deliberately-navigated-to tool for v1, not
something `detectFileType.ts` routes into automatically).

### Aspect ratio / resolution presets

Populate `WALLPAPER_PRESETS` with real, current device resolutions (exact
physical pixel dimensions, not just ratios, so the exported file is
pixel-perfect for that device, not just correctly proportioned):

- **iPhone** (group `"iPhone"`): iPhone 17 Pro Max / 16 Pro Max class
  (1320x2868 logical → use native pixel e.g. 1290x2796 for 6.1" Pro,
  1320x2868 for 6.9" Pro Max — verify current values against Apple's
  published human interface guideline device sizes at implementation time,
  since these shift yearly with new hardware; do not hardcode from memory
  without checking Apple's current documented list), plus one generic
  "iPhone (19.5:9)" ratio-only entry for older/unlisted models.
- **Android** (group `"Android"`): a generic "Android (20:9)" and "Android
  (19.5:9)" ratio-only entry at a common resolution (e.g. 1080x2400,
  1080x2340) since Android device resolutions fragment far more than
  iPhone's; don't try to enumerate every OEM model.
- **Common** (group `"Common"`): `16:9` (1920x1080, desktop/TV), `9:16`
  (1080x1920, generic phone portrait), `1:1` (1080x1080, square/tablet
  split-screen or profile use), `21:9` (ultrawide desktop, optional/stretch).
- **Custom** (group `"Custom"`): user-entered width x height, any values,
  with a sane minimum (e.g. 64px) and maximum (e.g. 8000px, avoid pathological
  canvas sizes that could hang the tab) validated client-side.

Label each with both the marketing name and the pixel dimensions, e.g.
"iPhone 16 Pro Max — 1320 x 2868", so the user can sanity-check against
their own device's actual screen resolution (Settings > General > About >
on iOS, or a quick search on Android) rather than guessing from a name
alone.

### Data flow

1. **Upload**: `addFiles` → for each file, `loadImage` (from
   `imageProcessing.ts`) to get `naturalWidth`/`naturalHeight`, store as a
   `WallpaperItem` with `offsetX: 0, offsetY: 0, zoom: 1` (auto-centered,
   minimum zoom that covers the frame). Advance to Configure
   (`stepIndex = 1`), same as `useImageCompressor`.
2. **Configure**: user picks a preset (sets `settings.presetId` and
   implicitly the target `width`/`height`); `CropStage` computes and shows
   the live CSS-transform preview per the current item's `offsetX/offsetY/zoom`;
   dragging/zooming updates that item's state only (each item has
   independent crop state, since a user may batch multiple photos with
   different subjects needing different framing — do not share one global
   pan/zoom across a batch).
   - Clamping math: at a given `zoom`, the image's displayed size is
     `naturalWidth * zoom * scaleToFrame` where `scaleToFrame` is whatever
     factor makes the image cover the frame at `zoom = 1` (i.e.
     `scaleToFrame = max(targetWidth / naturalWidth, targetHeight / naturalHeight)`).
     The maximum pan distance in pixels is
     `(displayedWidth - targetWidth) / 2` horizontally and the equivalent
     vertically; `offsetX`/`offsetY` in `[-1, 1]` map linearly onto that
     range so `offsetX = ±1` means "panned as far as possible while still
     fully covering the frame, zero empty space."
3. **Result / export**: `processAll` calls, per item,
   `computeCoverCrop(naturalWidth, naturalHeight, targetWidth, targetHeight, offsetX, offsetY, zoom)`
   to get the exact source rectangle, then `renderWallpaperCrop` to produce
   a canvas at exactly `targetWidth x targetHeight`, then
   `canvas.toBlob`/`compressToTarget` for the final encode. The exported
   file's pixel dimensions exactly equal the chosen preset's — this is the
   whole point (no further OS-side cropping needed).

### UI/UX flow (Upload > Configure > Result)

- **Upload**: identical pattern to the compressor's drop zone; copy
  emphasizes "so your wallpaper looks right without the OS cropping it
  weird" or similar (final copy per `ux-copy` conventions: short, plain, no
  em dashes).
- **Configure**: preset picker at top, then the interactive `CropStage`
  showing the currently-selected item (if multiple uploaded, a thin
  filmstrip/thumbnail strip beneath, click to switch which one you're
  positioning — reuse the visual language of the compressor's
  `ViewToggle`/`Frame` grid for that strip, don't invent a new pattern).
  Safe-area overlay toggle lives in an "Advanced options" `<details>`
  block, matching `ControlsPanel.tsx`'s existing collapsed-advanced-options
  convention.
- **Result**: same before/after-style grid as the compressor, but instead
  of a byte-size before/after comparison, show the resolution
  before ("original: 4032 x 3024") and after ("wallpaper: 1290 x 2796")
  since resolution/fit is the value delivered here, not compression ratio
  (though the export quality slider still exists and file size is still
  shown per item, secondarily).

### Edge cases

- Source image smaller than the target resolution in one or both
  dimensions: `zoom = 1` still covers the frame by definition of
  `scaleToFrame`'s `max(...)`, but the image will be upscaled beyond its
  native resolution to do so. Show a small warning badge ("this photo is
  smaller than the target — it'll be upscaled and may look soft") rather
  than silently upscaling; this is the one case where the existing
  compressor's "never upscale" rule (`fitDimensions` never upscales) must
  be knowingly broken, because a wallpaper crop mathematically requires it
  when the source is too small in one dimension. Document this divergence
  clearly in the component's code comments so a future reader doesn't
  "fix" it into a silent letterbox, which would defeat the tool's purpose.
- Extremely elongated custom aspect ratios (e.g. 1x2000 typed by mistake):
  clamp `customWidth`/`customHeight` inputs to the sane range noted above
  and reject/toast on an out-of-range value rather than trying to render it.
- Very large source photos (e.g. 48MP phone photos, 8000x6000): the CSS
  transform preview is cheap regardless of source resolution (the browser
  scales the displayed `<img>`, not a re-decoded bitmap per frame), so no
  special handling needed there; only the final `renderWallpaperCrop` pays
  a real decode/draw cost, once per item, same order of magnitude as the
  existing compressor's per-item cost.
- Portrait photo to a landscape preset (e.g. 16:9 desktop) or vice versa:
  works the same as any other ratio mismatch — cover-crop handles it, no
  special-casing needed, but the safe-area overlay should hide itself for
  presets that aren't phone-shaped (e.g. don't show a "lock-screen clock"
  guide on a 16:9 desktop preset — key the overlay's visibility off
  `preset.group === "iPhone" || preset.group === "Android"`, not a
  standalone toggle only, or at least default it off for non-phone groups).
- Format: default to matching the compressor's own JPEG EXIF-stripping
  behavior (re-encoding through canvas already strips EXIF/GPS as a side
  effect, consistent with the existing stated privacy feature — no special
  code needed, this falls out of using `canvas.toBlob` the same way the
  compressor does).
- Multiple items in one batch with different presets: v1 should apply one
  shared preset to the whole batch (simpler, matches the compressor's
  shared-settings default mode) rather than per-item presets; per-item
  preset override can be a later enhancement mirroring the compressor's
  existing "same settings" vs "adjust each image separately"
  (`BatchMode`) pattern if there's demand.

### Privacy/security notes

No change to the privacy model: everything is canvas-based, in-browser,
identical guarantee to the existing compressor. No new attack surface. The
only thing worth a one-line mention in the UI is the upscale-warning case
above (a UX honesty note, not a privacy/security one).

### Phased build order

1. `src/lib/wallpaperFit.ts` (pure functions, unit-testable in isolation:
   `computeCoverCrop`, `renderWallpaperCrop`, `WALLPAPER_PRESETS`) plus
   `src/lib/types.ts` additions.
2. `src/hooks/useWallpaperFit.ts` (state/wizard logic, no interactive crop
   yet — ship with `offsetX/offsetY/zoom` fixed at auto-center defaults so
   the export path can be verified end-to-end before the interactive UI
   exists).
3. `WallpaperFitApp.tsx`, `WallpaperDropZone.tsx`, `PresetPicker.tsx`,
   `WallpaperResultPanel.tsx` — full wizard working with center-crop-only
   (no drag yet), verify Upload > Configure > Result end-to-end including
   `tsc`/`build`/Playwright per `HANDOFF.md`'s verification bar.
4. `CropStage.tsx` interactive pan/zoom (pointer events, clamping, wheel,
   pinch) — the highest-risk, most novel piece; build and test last,
   against the already-working export pipeline from step 3, so a bug here
   can't be confused with a bug in the canvas math.
5. Safe-area overlay, upscale warning badge, per-item filmstrip switcher —
   polish pass.
6. `src/app/wallpaper/page.tsx` route + metadata/JSON-LD, matching
   `src/app/pdf/page.tsx`'s pattern, if a dedicated route is wanted for v1.

---

## Feature 2: Universal file converter, including "convert from a link"

### Problem statement

Users want to convert files beyond images/PDFs (documents, other image
codecs like HEIC/AVIF) and, separately, want to convert a file they have a
URL to rather than one sitting on their device. The second half is in
direct tension with the site's core privacy promise ("files never leave
your device"), so this section is as much a policy decision as an
engineering one.

### Part A: local file conversion — survey of what's realistically 100% client-side

All of the below run as real npm packages executing in the browser (Wasm or
pure JS), no server involved, consistent with the existing model (pdf-lib/
pdfjs-dist are the existing precedent for "a real npm dependency that does
heavy lifting entirely client-side").

**Image formats:**
- **HEIC/HEIF → JPEG/PNG** (input conversion; iPhones default to HEIC and
  it's a constant source of "why won't this upload/open" user pain):
  `heic2any` (pure-JS wrapper, ~simple API, converts to JPEG/PNG/GIF blobs
  in-browser) is the most commonly used option; under the hood it's built
  on `libheif`-derived Wasm. Bundle cost is nontrivial (the Wasm decoder is
  on the order of 1-2MB) — load it via a dynamic `import()` inside the
  processing function (same lazy-load precedent as `pdfProcessing.ts`
  dynamically importing pdfjs-dist's worker-dependent code, per
  `HANDOFF.md`'s architecture notes) so it's not in the main bundle for
  users who never touch HEIC.
- **AVIF output**: modern Chromium/Firefox/Safari versions can already
  encode AVIF directly via `canvas.toBlob(..., "image/avif", quality)` —
  no library needed at all where supported; feature-detect with a quick
  `canvas.toBlob` probe and fall back to a toast ("AVIF export isn't
  supported in this browser yet") rather than pulling in a Wasm AVIF
  encoder (e.g. `@jsquash/avif`) for v1. This is the cheap, high-value
  first step: extending `targetMimeFor`/`OutputFormat` in the existing
  compressor to include `"image/avif"` as an output option, gated on
  feature detection, requires almost no new code and reuses the entire
  existing compressor pipeline verbatim — recommend doing this inside
  `src/lib/format.ts`/`useImageCompressor.ts` as a small enhancement to
  the *existing* tool rather than routing it through a new "universal
  converter" tool. AVIF *input* (decoding) is already supported natively
  by `<img>`/canvas in modern browsers with no library at all.
- **WebP ⇄ others**: already fully supported today via the existing
  compressor (`canvas.toBlob`), nothing new needed.

**Documents:**
- **DOCX → HTML or plain text**: `mammoth.js` (actively maintained, pure
  JS, no Wasm, small — tens of KB) converts `.docx` to HTML client-side,
  reading the file via `arrayBuffer()`. It is one-directional (docx to
  html/text only, not html/text to docx) and it targets Word's document
  format specifically (not `.doc`, the legacy binary format — that would
  need a different, much heavier approach and is not worth pursuing).
- **CSV parsing/conversion**: `papaparse` (mature, widely used, pure JS,
  ~45KB) parses CSV client-side into JS objects/arrays; pair it with a
  hand-rolled formatter to convert CSV → JSON, CSV → a simple HTML table,
  or (reversed) JSON → CSV. This is fully achievable and cheap.
- **Markdown ⇄ HTML**: `marked` or `markdown-it` (both pure JS, small,
  mature) render Markdown to HTML client-side; the reverse (HTML → Markdown)
  is less common but `turndown` (pure JS) does it. Genuinely easy, small,
  no Wasm.
- **Plain text conversions** (encoding changes, line-ending conversions,
  simple `.txt` ⇄ `.csv` reshaping): trivial, no library needed, just
  `File.text()` / `TextDecoder` and string manipulation.
- **DOCX/XLSX/PPTX *generation*** (the reverse direction — building a new
  Office file client-side): `docx` (npm package, generates .docx),
  `exceljs` (generates .xlsx), `pptxgenjs` (generates .pptx) all exist and
  work fully client-side, but only for *creating new* documents from
  structured data, not for converting an arbitrary uploaded file into
  these formats losslessly — that direction is out of scope for a v1
  "converter" since there's no realistic client-side path from, say,
  "some PDF" to "an editable equivalent .docx" without a real document
  layout engine (that's what makes commercial PDF-to-Word converters a
  server-side, often ML-assisted feature, not a client-side one).
- **What's realistically out of scope for 100%-client-side, and should be
  explicitly *not* promised**: video transcoding (technically possible via
  `ffmpeg.wasm` but the Wasm payload is tens of MB and encode times on a
  phone are impractical — not a good fit for a fast, free web tool), audio
  format conversion (same ffmpeg.wasm caveat, though a narrower single-codec
  Wasm decoder could work for a future v2), full DOC (legacy binary Word)
  support, and any format needing OCR or ML (e.g. scanned-PDF-to-editable-text)
  since there is no small, fast, accurate client-side OCR option comparable
  to a server-side one.

**Recommended v1 scope for the "local conversion" side of this feature:**
- HEIC → JPEG/PNG (via `heic2any`, lazy-loaded).
- AVIF output added to the *existing* image compressor (not a new tool).
- DOCX → plain text / HTML (via `mammoth.js`).
- CSV ⇄ JSON (via `papaparse` + a hand-rolled JSON serializer, no extra
  package needed for the JSON side).
- Markdown → HTML (via `marked`).
This set covers the highest-value, lowest-risk, smallest-bundle-cost
conversions and deliberately excludes anything requiring ffmpeg.wasm-class
payloads or any format that can't round-trip losslessly.

### Part B: "convert from a link" — CORS reality and the privacy tradeoff

**a) Pure client-side `fetch()`:**
`fetch(url)` from `https://quiklab.online` to a third-party origin is
subject to CORS. It succeeds only if the remote server's response includes
`Access-Control-Allow-Origin: *` (or explicitly allows `quiklab.online`).
In practice:
- **Works**: URLs served from origins that intentionally allow
  cross-origin reads — e.g. many CDNs serving public static assets, some
  cloud storage buckets configured with permissive CORS (a public S3
  bucket with a CORS policy, GitHub's raw content CDN
  `raw.githubusercontent.com` allows `*`, jsDelivr/unpkg allow `*` since
  they exist specifically to be fetched cross-origin), and some open APIs
  that explicitly serve files for cross-site use.
- **Silently/predictably fails**: most ordinary file hosts a typical user
  would paste a link from — Google Drive share links, Dropbox share links,
  most personal/business websites' upload folders, most CMS-hosted media,
  and essentially all HTML *pages* (as opposed to direct file URLs) — do
  not send permissive CORS headers by default, because doing so is an
  explicit security decision a server operator has to opt into. The
  failure mode is a `TypeError: Failed to fetch` (or a response with
  `type: "opaque"` if using `no-cors` mode, which is *unusable* for reading
  the response body — this is a common trap: `no-cors` "succeeds" but
  hands back an opaque response the page's JS cannot read at all, so it
  must never be used here, it would look like it "works" and then fail
  silently downstream instead of failing fast with a clear error).
- **Detection/messaging**: wrap the `fetch()` in a try/catch; a caught
  `TypeError` (network-level failure, which is what a CORS rejection
  presents as, since the browser doesn't expose *why* a fetch failed for
  security reasons) should surface a specific, honest message — something
  like "Can't fetch that link directly from your browser (most sites block
  this for security). Try downloading the file and dropping it here
  instead." Do not attempt to sniff or distinguish CORS failure from a
  genuine network error/404 (the browser doesn't tell you which one it
  was) — treat any fetch failure as "couldn't fetch it, here's the direct
  fallback."

**b) Serverless proxy (e.g. a Vercel Edge Function or Route Handler):**
A route like `src/app/api/fetch-remote/route.ts` that takes a `url` query
param, fetches it server-side (no CORS restriction applies to server-to-
server fetches), and streams the bytes back to the browser same-origin,
where the existing client-side processing pipeline then takes over. This
**works for essentially any public URL** since it isn't subject to browser
CORS at all. But it is a real, material exception to the site's core
promise: **the file's bytes do transit Vercel's infrastructure**, even if
not persisted to disk/database. This must be treated as an architectural
exception, not a technicality:
- It should require the user to *paste a URL* as an explicit, separate
  action (never silently triggered), with UI copy that says plainly, before
  the fetch happens, something like: "Files you upload directly never
  leave your browser. Fetching from a link is different: the file passes
  through our server to get around browser security restrictions, then is
  processed in your browser like normal and never stored." This is a
  disclosure, not a hidden implementation detail — it should be visible
  copy at the point of pasting a URL, not buried in a privacy policy page.
- The proxy must not log or persist the fetched bytes anywhere (no writing
  to a database, no third-party logging of body content; standard Vercel
  request logs capturing the requested URL as metadata are normal and
  fine, but response body content must not be retained). Set an explicit
  response size cap (e.g. reject/abort above ~50-100MB) to avoid the
  function becoming a general-purpose proxy/DoS vector, and a reasonable
  timeout.
- Basic hardening: validate the `url` param is `http(s)://` only (block
  `file://`, `data:`, internal/private IP ranges like `127.0.0.1`,
  `10.x`/`172.16-31.x`/`192.168.x`, and cloud-metadata endpoints like
  `169.254.169.254` — this is a classic SSRF vector: without this check, a
  malicious user could use the proxy to make the server fetch internal
  Vercel/AWS metadata endpoints or scan the proxy's own network). Restrict
  the proxy to `GET` only, forward only a minimal set of headers, and do
  not forward cookies/credentials.
- Rate-limit if abuse becomes a problem (out of scope to build proactively
  for v1, but note it as a known follow-up).

**c) Recommendation: build (b), but gate and disclose it explicitly; make (a)
the free first attempt.**

Justification: the site's stated differentiator is privacy ("files never
leave your device" appears in the header/footer copy across the whole
site). A silent proxy would be a real, if narrow, breach of that promise's
literal wording for this one feature. But refusing to support links at all
means the feature barely works in practice (per the CORS survey above, most
real-world links a user would actually paste will fail under approach (a)
alone), which makes the feature not worth shipping. The honest middle
path — attempt (a) first since it's free and genuinely private when it
works, fall back to (b) only when the user explicitly opts into it with
clear disclosure — preserves the "your own files never leave your device"
guarantee (unchanged, still true, still the default and only path for
drag-and-drop / file-picker uploads) while being honest that "fetch a URL"
is a categorically different, clearly-labeled operation. This mirrors how
reputable privacy-forward tools handle inherently-server-requiring features
elsewhere: not by lying about it, but by scoping the exception narrowly and
disclosing it exactly where it applies.

Do not implement approach (b) as silent/automatic fallback from a failed
(a) attempt — always show the user the disclosure and require a second,
explicit action (e.g. a button that only appears after (a) fails: "Try
fetching this through our server instead (bytes pass through our servers
but are not stored) — Continue") so the exception is opt-in, not a
default the user didn't knowingly choose.

### Scope for v1: new tool + UI

**New tool**: "Convert" or "File converter" (naming: implementer's call,
short per design rules), a new top-level tool alongside the image
compressor and PDF toolkit, entry route `src/app/convert/page.tsx`
following the `src/app/pdf/page.tsx` pattern.

**New files** (`src/components/Converter/`, `src/hooks/useConverter.ts`,
`src/lib/converters/`):
- `src/lib/converters/heic.ts` — `convertHeicToImage(file: File, outputMime: "image/jpeg" | "image/png"): Promise<Blob>`,
  dynamically imports `heic2any` inside the function body.
- `src/lib/converters/docx.ts` — `convertDocxToHtml(file: File): Promise<string>`
  and `convertDocxToText(file: File): Promise<string>`, dynamically imports
  `mammoth`.
- `src/lib/converters/csv.ts` — `parseCsv(file: File): Promise<Record<string, string>[]>`
  (via `papaparse`, dynamic import) plus `jsonToCsv`/`csvToJson` pure
  helpers (no import needed for the JSON direction).
- `src/lib/converters/markdown.ts` — `markdownToHtml(text: string): string`
  (via `marked`, dynamic import inside an async wrapper since `marked`'s
  API is otherwise synchronous once loaded).
- `src/lib/converters/registry.ts` — a `CONVERTERS` table analogous to
  `pdfTypes.ts`'s `PDF_TOOLS`: for each supported input type, which output
  types are available and which function performs it. This is the natural
  place to add future converters without touching UI code, matching the
  existing "add an entry to `PDF_TOOLS`" extension pattern the README
  documents for PDF tools.
- `src/lib/converters/remoteFetch.ts` — pure client-side function
  `fetchRemoteFile(url: string): Promise<{ blob: Blob; viaProxy: boolean }>`
  that tries direct `fetch()` first (mode `"cors"`, never `"no-cors"`),
  and on failure throws a typed error the UI catches to offer the proxy
  fallback; a second function `fetchRemoteFileViaProxy(url: string): Promise<Blob>`
  that calls the new API route.
- `src/app/api/fetch-remote/route.ts` — the Edge/serverless proxy from
  approach (b) above. This is the **one exception in the whole codebase**
  to "no API routes that touch user files" (per `HANDOFF.md` section 1) —
  call this out prominently in a code comment at the top of the file
  explaining exactly why it exists and the constraints it must uphold (no
  persistence, size cap, SSRF guard, GET-only), so a future maintainer
  understands it's a deliberate, narrow, disclosed exception rather than
  an architectural drift back toward a server-processing model.
- `src/hooks/useConverter.ts` — same wizard shape (`stepIndex`/
  `maxReachedIndex`/`goToStep`/generation-guard ref) as the other two hooks.
  Upload step accepts either a dropped/picked file OR a pasted URL (two
  affordances in the same drop-zone-equivalent component). Configure step
  shows the available output formats for whatever input type was detected
  (via `CONVERTERS` registry) and any per-converter options (e.g. HEIC
  output format choice). Result step shows the converted output with a
  download button (and, for HTML/text outputs, an inline preview).
- `src/components/Converter/ConverterApp.tsx`,
  `ConverterDropZone.tsx` (extends the drop zone pattern with a "paste a
  link instead" toggle/tab), `RemoteFetchDisclosure.tsx` (the explicit
  disclosure + opt-in UI for the proxy fallback described in (c) above),
  `OutputFormatPicker.tsx`, `ConverterResultPanel.tsx`.

### Data flow

1. **Upload**: either (i) a file is dropped/picked — read via
   `file.type`/extension to find its entry in `CONVERTERS`; or (ii) a URL
   is pasted — call `fetchRemoteFile(url)`; on success, treat the resulting
   Blob exactly like a locally-picked file from that point on (wrap it
   back into a `File` object via `new File([blob], filenameFromUrl, { type: blob.type })`
   so the rest of the pipeline doesn't need to know the difference); on
   CORS failure, show `RemoteFetchDisclosure` and only call
   `fetchRemoteFileViaProxy` if the user explicitly confirms.
2. **Configure**: user picks an output format from the options
   `CONVERTERS` lists for the detected input type; any converter-specific
   options render here (e.g. HEIC target format).
3. **Result**: the hook calls the matching function from the registry,
   gets a `Blob` (or string, wrapped into a `Blob` for HTML/text/CSV/JSON
   outputs), offers it via `saveFile`.

### Edge cases

- URL points to an HTML page, not a direct file (e.g. a Google Drive
  "share" link that's actually a viewer page, not the raw bytes): both
  fetch approaches will "succeed" in the sense of returning bytes, but
  they'll be an HTML document, not the intended file. Detect via
  `Content-Type` on the response (`text/html` when a file was expected) and
  show a specific error ("That link points to a web page, not a file
  download — look for a 'direct download' or 'raw' link instead") rather
  than trying to process HTML as if it were the target format.
- Very large remote files: enforce the same size cap on the proxy route
  server-side (reject/abort) and show a clear "file too large to fetch
  through the proxy (limit: N MB)" message; direct client-side `fetch()`
  has no comparable cap needed since the browser is the one holding memory
  either way, same as any local file drop.
- Redirects: `fetch()` follows redirects by default; the proxy route should
  cap redirect count (fetch's default is reasonable, ~20, but consider
  capping lower, e.g. 5) to avoid redirect loops being used as a denial
  vector.
- Unsupported input type dropped/pasted: same "not supported yet" toast
  pattern as `UnifiedApp`'s `handleReject`.
- A conversion that would be lossy or partial (e.g. DOCX → plain text loses
  all formatting; mammoth's DOCX → HTML is more faithful but still not
  pixel-identical to Word): say so briefly in the Configure step's copy
  next to the format option, so the user isn't surprised in Result ("Plain
  text — formatting, images, and tables are not preserved").

### Privacy/security notes

- The proxy fetch is the one legitimate exception to the "never leaves your
  device" rule anywhere in the codebase and must be: opt-in (not silently
  triggered), disclosed in visible UI copy before it fires, not logged/
  persisted beyond normal ephemeral request handling, guarded against SSRF
  (block private/internal address ranges and non-http(s) schemes), size-
  and redirect-capped, and GET-only with no credential forwarding.
- All local-file conversions (HEIC, DOCX, CSV, Markdown) keep the existing
  100%-client-side guarantee unchanged — they're pure additions to the
  existing model, not exceptions to it.
- Update `README.md`'s privacy language and `HANDOFF.md` section 1 (which
  currently states "no API routes that touch user files" as an absolute)
  to describe this one narrow, explicitly-disclosed exception once shipped,
  so the docs stay accurate — this is a documentation follow-up for
  whoever implements this, not optional.

### Phased build order

1. Local conversions only, no link fetching: `src/lib/converters/heic.ts`,
   `docx.ts`, `csv.ts`, `markdown.ts`, `registry.ts`, plus
   `useConverter.ts`/`ConverterApp.tsx` and the rest of the wizard UI. Ship
   and verify this independently — it has zero privacy-model risk and is
   pure upside.
2. AVIF output added to the *existing* image compressor
   (`src/lib/format.ts`, `useImageCompressor.ts`, `ControlsPanel.tsx`),
   independent of the new Converter tool, since it's a one-line extension
   to code that already exists.
3. `fetchRemoteFile` client-side-only path (approach a): paste-a-link UI,
   direct `fetch()` attempt, clear failure messaging when it doesn't work.
   Ship this and observe real usage/failure rate before building the proxy,
   since it's possible a meaningful fraction of real user-pasted links
   (e.g. GitHub raw URLs, direct CDN links) already work with zero server
   involvement.
4. The serverless proxy (`src/app/api/fetch-remote/route.ts`) and
   `RemoteFetchDisclosure.tsx`, built last and only once (1)-(3) are solid,
   since it's the highest-risk piece (SSRF surface, the one privacy-model
   exception, needs the most careful review before shipping).
