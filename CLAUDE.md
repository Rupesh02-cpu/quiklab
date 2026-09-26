# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Read `HANDOFF.md` first.** It has the full project history, current
> state, credentials locations, and the owner's working preferences.
> `README.md` has the public-facing overview (stack, project structure,
> design rules). This file only adds what those two don't already cover.
> To deploy, follow `DEPLOY.md`. The next planned feature is in
> `PLAN_status-page.md`.

## What this is

QuikLab — free image and PDF tools that run entirely in the browser, at
https://quiklab.online. **The one rule that shapes everything: user files
never leave the user's device.** No upload, no server processing, no API
routes that touch user files. Any change must keep this true.

Current branch `nextjs-migration` is a Next.js 16 + React 19 + TypeScript
rewrite of both tools (image compressor at `/`, PDF toolkit at `/pdf`) and
is what you'll almost always be working on. The repo root also has a legacy
static-site version (`index.html`, `app.js`, `styles.css`, `pdf.html`,
`pdf.js`, `test/`) — **ignore these**, they are unused reference only.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (also type-checks)
npx tsc --noEmit     # type-check only — run this before every commit
npm run lint         # eslint
npx serve status/site   # status page locally; ?fixtures=1 for sample data
```

There is no unit test suite on this branch. Verification before opening a
PR is `npx tsc --noEmit` + `npm run build` passing, plus manually exercising
the real flows in a browser (see README "Before you open a pull request").

No env vars are needed to run or build locally. `.env.local` / `secrets/`
are for admin scripts only (analytics, deploy checks) — never commit them.

Next.js 16 has breaking changes vs. older training data; check
`node_modules/next/dist/docs/` rather than relying on memory for Next APIs.

## Architecture

See README.md "Project structure" and "How the code is organized" for the
file map and the components/hooks/lib layering rule. The parts worth
calling out beyond that:

- **Wizard + generation-guard pattern**: both `useImageCompressor.ts` and
  `usePdfToolkit.ts` implement a 3-step wizard (`stepIndex`,
  `maxReachedIndex`, `goToStep`) where the user can freely navigate back
  and forward while async processing is in flight. Each hook keeps a
  `clearGeneration` ref that increments whenever the user resets or
  navigates away mid-run; the async work checks
  `clearGeneration.current !== startGeneration` at each yield point and
  bails out if it changed, so stale results from an abandoned run never
  get applied. `useImageCompressor.ts:187-214` is the reference
  implementation. Any new async operation in either hook must follow this
  same guard pattern or it will risk applying stale state after a user
  navigates back mid-processing.
- **Adding a PDF tool**: add an entry to `PDF_TOOLS` and `PDF_TOOL_ORDER`
  in `src/lib/pdfTypes.ts`, write the processing function in `src/lib/`,
  wire it into `run()` in `usePdfToolkit.ts`, and add an icon to
  `IconSprite.tsx`.
- **PNG/GIF are hand-rolled, not canvas re-encoding**: canvas re-encoding
  barely shrinks PNGs (lossless format) or fixed-multi-frame animation, so
  `imageProcessing.ts` implements real PNG8 median-cut quantization and
  `gifDecoder.ts`/`gifEncode.ts` implement/consume a GIF89a codec. If
  re-encoding wouldn't actually shrink a file, the original is kept
  automatically rather than showing a misleading result.
- **pdf.js worker is same-origin**: `public/pdf.worker.min.js` is a copy of
  `node_modules/pdfjs-dist/build/pdf.worker.min.js`, and must be re-copied
  by hand after any `pdfjs-dist` version bump. `next.config.ts` aliases
  pdfjs-dist's optional Node `canvas` dependency to
  `src/lib/emptyModule.ts` (both Turbopack and webpack configs) since it's
  only ever invoked from the browser.
- **Status page is a separate app**: `status/site` (plain HTML/CSS/JS, its
  own Vercel project) reads uptime data written to the `gh-pages` branch by
  GitHub Actions in `.github/workflows/` (a 5-minute uptime check and an
  hourly real-browser synthetic check that actually compresses an image and
  merges PDFs). Incidents are GitHub issues labeled `incident`.

## Design rules

Full detail in README.md "Design rules" and HANDOFF.md section 4 — the
owner cares about this a lot and reads deviations as tells. In short:
colors only from the CSS variables in `src/app/quiklab.css` (darkroom
theme, safelight-red accent) in both light and dark; Inter for all UI text,
IBM Plex Mono only for numeric data; no fixed pixel heights; every
animation needs a `prefers-reduced-motion` fallback; no em dashes in
user-facing copy or code comments; privacy line is always "never leave
your device".

## Branches and deployment

`main` is production (Vercel auto-deploys on push). Work happens on
`nextjs-migration`, PR into `main`. Deployment access (Vercel, DNS, email)
is owner-only — see `DEPLOY.md` for the exact runbook, source map, and
credentials locations.
