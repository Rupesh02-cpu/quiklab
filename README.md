# QuikLab

Free image and PDF tools that run entirely in the browser.
Live at **https://quiklab.online**, status at **https://status.quiklab.online**.

The one rule that shapes everything: **user files never leave the user's
device.** There is no upload and no server processing. Images are processed
with the Canvas API, PDFs with pdf-lib and pdf.js, all client-side. Any change
you make must keep this true.

---

## What it does

Drop any file on the home page. QuikLab detects whether it is an image or a
PDF and shows the right tool.

- **Images** (JPG, PNG, WebP, SVG, GIF): compress by quality or to a target
  file size, resize, convert format, reduce PNG/GIF colors, keep animated
  GIFs animated, strip EXIF/GPS metadata, download one or all as ZIP.
- **PDFs** (8 tools): merge, split and extract, compress, rotate, watermark,
  image to PDF, PDF to image, and add text and clickable links.

Every tool follows the same 3-step flow: **Upload > Configure > Result**.

## Quick start

Requirements: Node.js 20+ and npm.

```bash
git clone https://github.com/Rupesh02-cpu/quiklab.git
cd quiklab
npm install
npm run dev          # http://localhost:3000
```

Other commands:

```bash
npm run build        # production build (also type-checks)
npx tsc --noEmit     # type-check only
npm run lint         # eslint
npx serve status/site   # status page locally; open with ?fixtures=1 for sample data
```

No environment variables are needed to run or build the app locally. The
keys in `.env.local` are only for admin scripts (analytics, deploy checks);
ask the owner if you need access. Never commit `.env.local` or `secrets/`.

## Tech stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Plain CSS in a single stylesheet (`src/app/quiklab.css`)
- pdf-lib (edit/create PDFs), pdfjs-dist (render PDF pages), JSZip, gif.js
- Hosted on Vercel; status monitoring on GitHub Actions

Next.js 16 differs from older versions. When unsure about an API, check the
docs bundled in `node_modules/next/dist/docs/` rather than older tutorials.

## Project structure

```
src/
  app/
    layout.tsx          root layout: fonts, theme, header, analytics scripts
    page.tsx            "/"    home: unified drop zone
    pdf/page.tsx        "/pdf" same page, scoped to PDFs (kept for SEO)
    quiklab.css         all styles: design tokens, light/dark themes, animations
  components/
    UnifiedUpload/      drop zone, file-type detection, routes to a tool
    ImageCompressor/    image tool screens
    PdfToolkit/         PDF tool picker and the 8 tools
    Stepper.tsx         the Upload > Configure > Result indicator
    SiteHeader.tsx, ThemeToggle.tsx, ToastProvider.tsx, Icon*.tsx, ...
  hooks/
    useImageCompressor.ts   all state and logic for the image tool
    usePdfToolkit.ts        all state and logic for the PDF tools
    useTheme.ts
  lib/                  pure processing functions (no React)
    imageProcessing.ts  resize, compress, target size, PNG color reduction
    gifDecoder.ts / gifEncode.ts   animated GIF support
    pdfProcessing.ts    merge, split, compress, rotate, watermark, convert
    pdfEditor.ts        add text and hyperlink annotations
    pdfTypes.ts         tool definitions (add a PDF tool here)
public/                 static files, incl. pdf.worker.min.js
status/
  site/                 status page (plain HTML/CSS/JS, its own Vercel project)
  monitor/              uptime and browser checks run by GitHub Actions
.github/workflows/      status-monitor (5 min), status-synthetic (hourly), status-publish
```

Ignore these legacy files at the repo root: `index.html`, `app.js`,
`styles.css`, `pdf.html`, `pdf.js`, `test/`. They are the old static
version of the site and are not used.

## How the code is organized

- **UI in components, logic in hooks, processing in `lib/`.** Components render,
  hooks hold state and orchestrate, `lib/` functions take a File or bytes and
  return a Blob. Keep processing out of components.
- **Wizard state** lives in each hook: `stepIndex`, `maxReachedIndex`,
  `goToStep`. Users can go back and forward freely, so async work is guarded:
  each hook keeps a generation counter ref (`clearGeneration` /
  `resetGeneration`) and drops results from a run that was started before the
  user reset or navigated away. If you add an async operation, follow the same
  pattern.
- **Adding a PDF tool:** add an entry to `PDF_TOOLS` and `PDF_TOOL_ORDER` in
  `src/lib/pdfTypes.ts`, write the processing function in `src/lib/`, wire it
  in `run()` in `usePdfToolkit.ts`, and add an icon to `IconSprite.tsx`.
- **pdf.js worker:** `public/pdf.worker.min.js` is copied from
  `node_modules/pdfjs-dist/build/`. Copy it again if you upgrade pdfjs-dist.
  `next.config.ts` stubs out pdf.js's optional Node `canvas` dependency.

## Design rules

The look is intentional; please keep it consistent.

- Colors come only from the CSS variables in `quiklab.css` (`--accent`,
  `--ink`, `--panel`, `--border`, `--good`, ...). No hardcoded colors. Every
  change must work in both light and dark themes.
- Font: Inter for all UI. IBM Plex Mono only for numbers and data (file sizes,
  percentages).
- Layout is one centered column with generous spacing. No fixed pixel heights
  for layout; use the existing `--header-h` variable and flex/grid.
- Motion: use the existing keyframes and easing curves in `quiklab.css`, and
  give every animation a `@media (prefers-reduced-motion: reduce)` fallback.
- Copy: short and plain. The privacy line is always "never leave your
  device".

## Before you open a pull request

1. `npx tsc --noEmit` and `npm run build` pass.
2. Try the real flows in the browser: drop an image and compress it; drop a
   PDF, pick a tool, run it, download; drop an image and a PDF together; drop
   an unsupported file; click the logo mid-flow; test both themes and a
   narrow (mobile) window.
3. No user file data is sent anywhere (check the Network tab).

## Branches and deployment

- `main` is production. Every push to `main` deploys both the main site and
  the status page on Vercel automatically.
- Do work on a branch (currently `nextjs-migration`), open a pull request
  into `main`, and merge when checks and review pass.
- Deployment access (Vercel, DNS, email) is limited to the owner. The full
  step-by-step runbook, including verification and rollback, is in
  `DEPLOY.md`.

## Analytics and privacy

The site uses Google Analytics 4 events (usage counts only: uploads, runs,
downloads; never file names or content), Microsoft Clarity (page interaction
heatmaps, not file content), and Google AdSense. See `ANALYTICS.md`.

## Status page

`status.quiklab.online` shows uptime for the website, image tool, PDF tool,
CDN, DNS, and email. GitHub Actions run checks every 5 minutes, plus an hourly
real-browser test that actually compresses an image and merges PDFs. Results
are written to the `gh-pages` branch and read by the status page. Incidents
are GitHub issues labeled `incident`.

## More documentation

| File | For |
|---|---|
| `DEPLOY.md` | deploy runbook, source map, DNS, credentials locations |
| `HANDOFF.md` | full project history, decisions, and open work |
| `ANALYTICS.md` | what is tracked and why |
| `PLAN_status-page.md`, `PLANNING_unified-upload.md` | design docs for past features |

## Contact

Owner: Rupesh (GitHub `RupeshNB-max`). Support: support@quiklab.online.
