# QuikLab — Design Brief for UI/UX Redesign

**Purpose of this document:** everything a designer needs to redesign QuikLab from scratch, without needing to read the code. Covers what the product is, who it's for, every feature in detail, the current design system, technical constraints that shape what's possible, and what's explicitly open for reinterpretation.

**Live site:** [quiklab.online](https://quiklab.online)

---

## 1. What QuikLab is

QuikLab is a free, browser-only file-utility site. It currently has two tools:

1. **Image Compressor** (`/`) — resize and compress JPG, PNG, WebP, SVG, and GIF images.
2. **PDF Toolkit** (`/pdf.html`) — merge, split, compress, rotate, and watermark PDFs, plus convert between PDF and images.

**The core premise, and the thing that must never be lost in a redesign:** nothing is uploaded anywhere. Every operation — image compression, PDF merging, whatever — runs entirely inside the visitor's browser tab using JavaScript (Canvas API for images, the pdf-lib/pdf.js libraries for PDFs). No server ever sees the file. This is not just a technical detail; it's the product's main trust pitch and appears repeatedly in the copy ("your files never leave the tab"). Any redesign should keep this promise visible and credible — it's the reason a privacy-conscious user picks QuikLab over a random web upload tool.

QuikLab is built as an **umbrella brand** — the intent is to keep adding more browser-only tools over time (more PDF operations, format converters, etc.) under the same site, so the redesign should think in terms of a **tool platform/hub**, not a single-purpose landing page.

### Who uses it

No formal user research exists yet — this is inferred from the product's design and copy:

- People who need a quick one-off file operation (compress a photo before emailing it, merge two PDFs before submitting a form) and don't want to sign up for anything or trust a random site with a sensitive document.
- SEO/search-driven traffic — people searching things like "compress jpg online," "merge pdf free," "resize image online." They land directly on the tool they need, use it once, and may never come back. This means **each tool needs to work and explain itself within seconds, with no onboarding.**
- Privacy-conscious users specifically avoiding upload-based tools (this is a real segment — see competitor positioning below).
- No accounts, no login, no saved history — every visit is a fresh session.

### Business model

- Google AdSense (ad slots reserved on desktop, either side of the main tool — see Layout section)
- Google Analytics (GA4) + Microsoft Clarity (heatmaps/session replay of *interface interactions only* — never file contents) for usage analytics
- Free, no paywall currently. A future paid/bulk tier is mentioned as a possibility but not built.

### Competitive framing

Positioned against tools like TinyPNG, iLovePDF, Smallpdf — same category of task, but QuikLab's differentiator is **zero upload**. Competitors process files server-side; QuikLab explicitly doesn't. Worth designers knowing this so trust/privacy messaging isn't watered down into generic "fast and easy" language.

---

## 2. Tool 1: Image Compressor (full feature detail)

### What it does

Users drop in one or more images (JPG, PNG, WebP, SVG, or GIF) and get back resized/compressed versions, with a live before/after size comparison, downloadable individually or as a batch ZIP.

### Step-by-step user flow

1. **Upload** — drag-and-drop onto a drop zone, or click to browse. Multiple files at once.
2. **Configure settings** (left rail):
   - **Settings scope**: "Same settings for all images" vs. "Let me adjust each image separately" (per-image override)
   - **Compress by**: "Quality level" (a 10–100 slider) OR "Target file size" (e.g., "under 100KB" — the app binary-searches for the highest quality that still fits under that size)
   - **Advanced options** (collapsed by default):
     - Max width / max height (resize, aspect ratio always preserved)
     - Output format: keep original, or force JPEG / WebP / PNG
     - "Simplify colors" slider (4–256), shown only for PNG/GIF — since those formats can't shrink via a quality slider, only by reducing the color palette
3. **Process** — click "Compress images." Each image gets its own card ("frame") in a contact-sheet-style grid showing:
   - Thumbnail
   - Original size → compressed size, with a percentage-saved chip
   - A mini progress/savings bar
   - Individual download button
4. **View toggle** — results grid can switch between Grid / Filmstrip (horizontal scroll) / List layout
5. **Batch actions** — "Download all (.zip)" and "Clear all"
6. Running **totals row** — total original size vs. total compressed size vs. overall % saved across the whole batch

### Format-specific behavior (important for designers to understand — this affects what UI states need to exist)

- **JPEG/WebP**: genuinely compress well (real photos tested at 16–29% smaller). Straightforward "quality slider → smaller file" story.
- **PNG**: lossless format — canvas re-encoding barely shrinks it. If the app detects that compressing wouldn't actually help, it **keeps the original file and shows "no gain — original kept"** rather than a misleading/fake percentage. This is a deliberately honest failure state, not a bug — designers should treat this as a first-class UI state, not an edge case to hide.
- **SVG**: not run through canvas at all — minified as text (strips comments/editor metadata/whitespace), since it's vector markup, not pixels.
- **GIF**: decoded and re-processed frame by frame (animated GIFs stay animated).

### Privacy feature (explicit, visible)

Re-encoding a JPEG strips EXIF/GPS metadata (camera info, location) as a byproduct of re-encoding. The app calls this out explicitly as a privacy feature, not just a side effect — copy exists specifically explaining "your photo's location data doesn't travel with the compressed file." The one exception: when the original is kept (PNG no-gain case), metadata isn't stripped either, and the app is honest about that too.

### Full list of settings/controls to account for in redesign

| Control | Type | Notes |
|---|---|---|
| File upload | Drag-drop + file picker | Multi-file |
| Batch mode | Dropdown | Same-for-all vs. per-image |
| Compress-by mode | Dropdown | Quality vs. target size |
| Quality | Slider 10–100 | |
| Target size | Number + unit (KB/MB) | |
| Max width / height | Number inputs | Optional, aspect ratio locked |
| Output format | Dropdown | Original / JPEG / WebP / PNG |
| Color simplification | Slider 4–256 | PNG/GIF only |
| Per-image override | Same controls, scoped to one frame | Only when batch mode = individual |

### States to design for

- Empty state (no files yet)
- Files added, not yet processed
- Processing (per-frame spinner/status)
- Success (size comparison + download)
- "No gain — original kept" (PNG-specific honest-failure state)
- Rejected file (non-image uploaded — currently silently ignored with empty state persisting; could be improved with an explicit error toast)
- Batch totals

---

## 3. Tool 2: PDF Toolkit (full feature detail)

### Structure — this is a hub, not one tool

Unlike the image compressor (one tool, one form), the PDF toolkit is **seven distinct sub-tools** presented as cards on a landing grid. Clicking a card opens a shared "workspace" panel below/instead of the grid, scoped to that one operation. This structure exists because people search for the *specific* operation they need ("merge pdf," "rotate pdf pages") rather than browsing a general PDF tool — so each needs to be discoverable and self-explanatory independently.

### The 7 tools

1. **Merge PDFs** — upload 2+ PDFs, **drag to reorder** them in the list, merge into one file in that order.
2. **Split & Extract** — upload one PDF, see a thumbnail grid of every page, **click pages to select them**, extract the selection as a new PDF.
3. **Compress PDF** — upload one PDF, adjust an image-quality slider, get a smaller file. (Technical note for designers: this works by re-rendering each page as an image and re-encoding it — most effective on scanned/image-heavy PDFs. If it wouldn't actually shrink the file, same "no gain — original kept" honesty pattern as the image compressor.)
4. **Rotate Pages** — thumbnail grid where each page has its own rotate button (90° increments, click multiple times to reach 180°/270°), rotate individual pages or all of them.
5. **Add Watermark** — text watermark with controls for:
   - Text content (default "CONFIDENTIAL")
   - Position: center diagonal / tiled diagonal / bottom center
   - Opacity (5–80%)
   - Font size (16–120px)
   - Color: gray / red / black
6. **Image → PDF** — upload multiple JPG/PNG/WebP images, each becomes its own page, combined into one PDF, in upload order.
7. **PDF → Image** — upload one PDF, every page exported as a separate downloadable PNG (zipped if multiple pages).

### Shared workspace UI pattern (same shell, different controls per tool)

Every tool's workspace panel has, in order:
1. "← All tools" back link
2. Tool title + one-line description
3. Drop zone (file-type-restricted per tool: PDF-only, or image-only for Image→PDF)
4. File list (shows name + size; **draggable to reorder** for Merge and Image→PDF)
5. Page thumbnail grid (only for Split/Extract and Rotate — this is pdf.js rendering real page previews, not placeholder icons)
6. Tool-specific form fields (only Watermark and Compress have extra fields — see above)
7. Toolbar: hint text (e.g. "2 of 5 pages selected"), Clear button, primary Run button
8. Progress bar during processing
9. Result panel: success message, file-size detail, Download button, and "Download all (.zip)" when the output is multiple files (e.g. PDF→Image with multiple pages)

### States to design for

- Tool grid (landing/browsing state)
- Empty workspace (tool selected, no file yet)
- File(s) uploaded, pre-processing
- Page-thumbnail loading (async — pages render one at a time, could take a moment on large PDFs)
- Page selection state (Split/Extract)
- Per-page rotation state (Rotate — needs to visually show current rotation angle per thumbnail)
- Processing/progress
- Success + download
- "No gain — original kept" (Compress)
- Error (e.g. encrypted/corrupted PDF — currently a generic toast, could be more specific)

---

## 4. Current design system (reference — designers can keep, evolve, or fully replace)

### Concept

The existing design is a **darkroom / photo-lab contact-sheet** metaphor: a left "rail" (control panel) styled like a darkroom safelight panel with simulated film-sprocket perforations along its edge, and a main "sheet" area (results) with a faint grid background evoking a light table. This metaphor is **specific to the image compressor** and doesn't naturally extend to PDFs — worth flagging to designers as something that may need to become a more neutral, tool-agnostic system now that there are two (and eventually more) distinct tools sharing one brand.

### Color

- Accent color: a "safelight red" (`#C8331F` light / `#E4432B` dark) — deliberately chosen as the one color a darkroom can use without "exposing film," i.e., used sparingly as the single accent, not decoratively.
- Neutral, cool grays for everything else (background, panels, borders, muted text)
- Full light/dark/system theme support, toggled via a persistent button (saved to localStorage), no flash-of-wrong-theme on load
- Success/savings state uses a green accent (`#2D6E4E` light / `#7FBF9E` dark)

### Typography

- **Fraunces** (serif, display) for headings — warm, editorial feel
- **IBM Plex Mono** (monospace) for everything else — body text, labels, buttons, data (file sizes, percentages). The all-monospace body is a distinctive, slightly technical/utilitarian choice — feels more like a dev tool than a consumer app. Worth a deliberate decision either way in the redesign, not an accident to preserve.

### Layout (current)

- Desktop ≥1240px: three-column layout — ad rail (left) / app (center, max ~1100px) / ad rail (right)
- App itself: two-column — narrow left rail (controls, ~22vw min 260px) / main content area (results grid)
- Collapses to single column under 820px (rail stacks above content)
- New PDF toolkit page uses a different, centered single-column layout (tool grid → workspace) since it doesn't have the same "controls + live results" shape as the image compressor

### Existing UI patterns worth knowing about

- Toast notifications (bottom-center, auto-dismiss, optional action button) for confirmations
- A simple custom SVG icon sprite (sheet of `<symbol>` defs, referenced via `<use>`) — no icon library
- Three result-view modes for the image compressor (grid/filmstrip/list) toggled via a small button group
- "Advanced options" pattern: progressive disclosure via a native `<details>` element for less-common settings

---

## 5. Technical constraints designers should design within

These aren't arbitrary — they come from the "no upload, no build step" architecture, and a redesign that ignores them will produce mockups that can't actually ship without a much bigger rebuild.

1. **No server-side processing.** Every visual state (thumbnails, previews, progress) has to be achievable with in-browser JS. This is fine for almost everything already described, but e.g. "AI-powered smart crop" or anything needing a model/API call is out of scope unless that's an explicit new direction.
2. **No account system.** No "your files" history, no saved presets tied to a login — every session is stateless (only the color theme persists, via localStorage).
3. **No build tooling.** The site is plain HTML/CSS/JS, no React/Vue/bundler. This doesn't restrict visual design, but complex component interactions should be describable simply enough to hand-build in vanilla JS.
4. **Page-thumbnail rendering has a real cost.** For the PDF toolkit's page grids (Split, Rotate), each thumbnail is rendered live from the actual PDF content — this takes a moment for large files. Designs should account for a loading/streaming-in state for the thumbnail grid, not assume instant population.
5. **Ad slots are a fixed business requirement** on desktop (currently two skyscraper-style slots flanking the main content). Any redesign needs to accommodate ad placement without it feeling bolted on — currently they're separated into a dedicated outer rail so they don't interrupt tool flow, which is a pattern worth preserving even if the visual treatment changes.
6. **SEO structure matters.** Both pages carry FAQ structured data (schema.org FAQPage) and About/FAQ sections with real crawlable text — this is a meaningful source of traffic (search-driven landing). A redesign shouldn't strip this content out for the sake of a cleaner-looking page; it can be restyled, collapsed, or moved, but the actual FAQ content and headings should stay crawlable.

---

## 6. What's explicitly open for the redesign

- **Visual identity/theme** — the darkroom metaphor is not sacred. As the tool count grows beyond two, a more neutral "workshop" or "toolkit" framing may fit better than a photography-specific one.
- **Typography** — the all-monospace body text is a strong, opinionated choice; reconsider deliberately.
- **Navigation model** — currently a simple two-link top nav (Image Compressor / PDF Toolkit). This needs to scale to more tools over time; consider whether a hub/homepage listing all tools (rather than the image compressor being the de facto homepage at `/`) makes more sense as the tool count grows.
- **The PDF tool-grid pattern** (cards → workspace) could be a reusable template for future tools too — worth evaluating whether that's the right shape to standardize on site-wide, versus each tool getting a bespoke layout like the image compressor currently has.
- **Empty/error states** — several are currently minimal (e.g., a rejected file upload just does nothing visibly). These are good opportunities for more thoughtful feedback design.
- **Mobile experience** — current responsive behavior is functional (single-column stacking) but not deeply reimagined for mobile-first use; touch-friendly reordering (drag-to-reorder file lists, tap-to-rotate pages) especially needs real design attention, since drag interactions translate awkwardly to touch.

---

## 7. Quick reference — every distinct screen/state that needs a design

**Image Compressor**
- Empty state
- Upload/drag-active state
- Settings panel (all controls)
- Processing state (per-image)
- Result card: success
- Result card: "no gain, original kept"
- Batch totals bar
- Three view modes (grid/filmstrip/list)
- Theme toggle (light/dark/system)

**PDF Toolkit**
- Tool selection grid (7 cards)
- Workspace shell (shared across tools)
- File upload/list (with drag-reorder for Merge, Image→PDF)
- Page thumbnail grid (Split/Extract, Rotate)
- Page selection state (Split/Extract)
- Per-page rotation indicator (Rotate)
- Watermark form (5 fields)
- Compress form (1 field)
- Progress bar
- Result: success + download
- Result: multi-file + "download all as zip"
- Result: "no gain, original kept" (Compress)
- Error state (bad/corrupted file)

**Shared**
- Site header/nav (logo + tool links)
- Toast notifications
- About/FAQ sections (per page)
- Footer/trust copy ("your files never leave this tab")
