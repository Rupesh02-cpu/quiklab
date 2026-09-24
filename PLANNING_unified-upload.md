# Unified upload entry point — planning doc

Branch: `nextjs-migration`. Do not touch `main` (deployed at quiklab.online).

## 1. UX decisions

### Idle/empty state
Single drop zone at `/`, replacing both the image-only home and the `/pdf`
tool grid. `accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,application/pdf,.pdf"`.
Copy: headline "Drop a file to get started", sub-copy "Images get resized and
compressed. PDFs get merged, split, compressed, and more — all in your
browser." Small note row below (existing `.drop-note` style) lists accepted
types: "JPG, PNG, WebP, SVG, GIF, PDF — nothing leaves your device." No tool
picker, no mode toggle, before a file lands.

### The detection moment
This is the single most important new "alive" moment on the page. Sequence:
1. On drop/pick, the drop zone immediately transitions to a compact
   "reading file…" state (icon swaps to a pulsing generic file glyph,
   border pulses once in `--accent-soft`) for a deliberately-felt minimum
   of ~220ms even though sniffing `file.type` is instant — an instant cut
   feels like nothing happened; a beat sells "the app looked at this."
2. Detection resolves to image or PDF by MIME type primarily
   (`ACCEPTED_TYPE_RE` for images, `application/pdf` or `.pdf` extension
   fallback for PDFs — some OS pickers report empty MIME for PDFs). The
   drop zone card cross-fades (opacity + 6px translateY, same
   `wizard-step-in` timing/easing already in quiklab.css) into a small
   "detected" chip: file-type icon (icon-image or icon-pdf) drawing in
   with the existing `icon-check-draw` stroke pattern, plus filename and
   size, then the destination UI mounts directly underneath in the same
   transition wave (staggered ~60ms after the chip). No separate "click to
   continue" confirmation step — see reasoning below.
3. If multiple files of one type are dropped, the chip shows a count
   ("3 images detected") instead of a filename.

No confirmation click for images: images go straight into the existing
Configure step. Requiring an extra click to confirm "yes, this is an image"
adds friction the tool never had before (today's `/` already skips straight
to Configure on drop) and the detection reveal (chip + icon draw-in) already
supplies the "the app noticed" feedback the user wants — a click is
redundant, not additive.

### PDF drop → tool selection
Concrete recommendation: **show the 8-tool picker grid inline, directly
below the detection chip, on the same page — not a guess, not a modal
question.** Reasoning:
- The tools are meaningfully different destructive/transformative actions
  (merge vs. split vs. watermark) with no safe universal default — guessing
  "compress" (the closest thing to an obvious default) would be wrong most
  of the time and would force a "no wait, actually merge" backtrack that's
  worse than just asking via the grid.
- A modal/dialog interrupts the "drop and go" flow the user explicitly
  wants; an inline grid does not — it's the same visual weight as today's
  `/pdf` ToolGrid, just relocated.
- The dropped PDF is preloaded: selecting a tool from the grid reuses the
  already-uploaded file(s) instead of asking the user to drop again. This
  is a real behavioral improvement over today's `/pdf` (which requires
  picking a tool *then* dropping). `usePdfToolkit`'s `openTool` currently
  calls `resetWorkspace()` unconditionally — the new flow needs
  `openTool` to accept the pre-existing file(s) and skip straight to
  `stepIndex 1` (Configure) instead of clearing back to Upload. See task 1
  below for the precise change.
- Tools requiring 2+ files (merge, `minFiles: 2`) still work fine — the
  single dropped PDF becomes file 1, and the tool's own Configure-step
  drop zone (already rendered by `PdfWorkspace`/`PdfFileList`) lets the
  user add the second file, exactly as it does today.

### Mixed multi-file drops (e.g. 2 images + 1 PDF)
Decision: **split by type, run the image files through the image
compressor path, and treat the PDF file(s) as a separate simultaneous
detection** — do not silently drop either, and do not block the whole
upload with an error. Concretely: if the drop contains any image files,
`addFiles` (image hook) receives just the image subset; if it contains any
PDF files, a toast fires ("Also detected 1 PDF — switch to it below") and a
small persistent "switch file type" affordance appears (see Header section)
letting the user flip to the PDF path without re-uploading. Only one
"active" tool workspace is mounted at a time (avoids doubling all the
race-condition-guarded state at once) but neither file set is lost — the
inactive set is held in a lightweight pending-files ref until the user
switches. This avoids the two bad extremes: silently ignoring one type
(surprising data loss) or blocking entirely on ambiguity (punishing normal
messy drag-selects, e.g. selecting a folder's contents in Finder/Explorer).

### Unsupported file type
Toast (existing `ToastProvider` mechanism, same as today's PDF toolkit "No
supported files in that selection.") — "That file type isn't supported yet.
Try an image (JPG, PNG, WebP, SVG, GIF) or a PDF." Drop zone itself does a
quick shake/border-flash in `--accent` (new, small, ~200ms, reduced-motion
guarded) rather than silently no-op'ing, so a bad drop still gets visible
feedback. If a drop is entirely mixed unsupported + supported, the
supported subset still proceeds and the toast covers only the rejected
files' count.

### URL / back-forward / bookmarks
Decision: **fully single-page state for the file-type routing itself (no
`/?tool=merge` query params driving core navigation), but `/pdf` is kept
alive as a real, working, SEO-indexed deep link** — not a redirect, not a
404. Reasoning:
- The user's request is explicit that `/pdf` "goes away entirely as a
  separate destination" — i.e., it should no longer be presented as a
  first-class nav destination or dead-end tool-picker page. But
  `/pdf` is presumably already indexed/linked externally (AdSense-approved
  page, potential backlinks); a hard 404 or bare redirect throws that away
  for no benefit and reintroduces a full navigation (page load) where a
  same-page reveal now exists everywhere else.
- Resolution: `/pdf/page.tsx` becomes a thin wrapper that renders the same
  unified `UnifiedApp` component but pre-seeds its `initialIntent` prop to
  `"pdf"` — landing on `/pdf` directly shows the same drop zone but already
  scoped/labeled for PDFs (headline "Drop a PDF to get started", accept
  narrowed to PDF-only, so a stray image drop there still gets a friendly
  "looks like an image — head to quiklab.online" toast + a link rather than
  silently misrouting). This preserves the SEO value of `/pdf` and gives
  power users/bookmarks a working shortcut, while `/` remains the single
  true entry point for everyone else. No `/pdf?tool=merge`-style deep
  links into a specific tool are introduced — that's meaningfully more
  routing/state-sync work (the wizard's step/file state would need URL
  serialization) for a use case (sharing a link to "the merge tool
  specifically, pre-scoped") nobody asked for. Browser back/forward within
  the wizard continues to work exactly as it does today, via each hook's
  own `stepIndex`/`goToStep` (client state, not URL-driven) — unchanged
  from current behavior, so the already-fixed race-condition guards stay
  valid untouched.
- The old bare "image compressor only" identity of `/` goes away in favor
  of the unified drop zone — that's the whole point of the request.

### Header/nav
`SiteHeader`'s two-link nav (`/` vs `/pdf`) no longer makes sense — there's
one destination. Simplify to: logo only (links to `/`, and clicking it from
anywhere resets to the idle drop-zone state — wire this via a
`resetAll()` callback exposed from the new orchestrating component, not a
hard navigation, so it doesn't lose the View Transition polish). Keep
`ThemeToggle` on the right, unchanged. Remove `NAV_LINKS`/`site-nav`
rendering entirely (leave the CSS rules in quiklab.css harmlessly unused
initially — task 2 can decide whether to prune them, see below). Add back
the "switch file type" affordance mentioned above (mixed-drop case) as a
small chip near the top of the workspace, not in the header itself — it's
per-session workspace state, not global nav.

## 2. Technical architecture decision

**Recommendation: a thin routing/orchestration layer on top of the two
existing hooks, not a new unified hook.** Reasoning:
- `useImageCompressor` and `usePdfToolkit` are large (330–405 lines each),
  independently already hardened this session against adversarial
  back/forward navigation via their generation-counter ref patterns
  (`clearGeneration`, `resetGeneration`). A full DRY merge would mean
  re-deriving and re-verifying those guards against a new shared state
  shape — real regression risk for a UX-only feature request that never
  asked for internal refactoring.
- The two domains genuinely don't share much beyond surface shape (files
  array, step index, run/result state) — the actual processing logic
  (canvas encode vs. pdf-lib/pdfjs operations), settings shapes, and
  per-tool branching are entirely different. A generic shared hook would
  end up being a thin interface both already satisfy in spirit, for
  marginal line-count savings and real coupling risk.
- New component: `src/components/UnifiedUpload/UnifiedApp.tsx` (client
  component), the new default export for both `src/app/page.tsx` and
  `src/app/pdf/page.tsx` (parameterized by `initialIntent?: "image" |
  "pdf" | null`). It owns exactly one piece of new state: `detected: null |
  "image" | "pdf"` (plus the pending-opposite-type file stash for the
  mixed-drop case) and a single top-level `DropZone`-like component,
  `UnifiedDropZone`, that replaces `ImageCompressor/DropZone.tsx` and
  `PdfToolkit/PdfDropZone.tsx` **only at the top (undetected) level** —
  both existing per-tool drop zones inside Configure steps (e.g. re-drop to
  add more images, PDF tool's own file input) are UNCHANGED and keep using
  their existing components. Once `detected` is set, `UnifiedApp` mounts
  `useImageCompressor()`+`ImageCompressorApp`'s existing internals (minus
  its own top-level `DropZone`/page shell) or `usePdfToolkit()`+the PDF
  tool grid/workspace, feeding the just-dropped file(s) into
  `addFiles`/`openTool`+preload on mount via a `useEffect` keyed off a
  ref-guarded "already seeded" flag (so it fires exactly once, immune to
  StrictMode double-invoke).
- Both `ImageCompressorApp` and `PdfToolkitApp` currently render their own
  full `<div className="page"><AmbientBackground/><div
  className="workspace-shell">…` shell. `UnifiedApp` becomes the sole owner
  of that outer shell (page/AmbientBackground/workspace-shell/head) so
  there's exactly one of each on screen; both existing App components are
  refactored to accept a "shell-less" render mode (a `renderShell?:
  boolean` prop defaulting true, so they remain independently usable/
  testable) or are split into `*Inner` components the shell wraps. Prefer
  the prop-flag approach — smaller diff, no new files to keep in sync.
- `usePdfToolkit.openTool` needs one behavior change: accept optional
  pre-existing files so selecting a tool after a PDF is already detected
  doesn't discard it. Add an optional second argument,
  `openTool(id: PdfToolId, seedFiles?: File[])`, that — after the existing
  `resetWorkspace()` call — calls the existing `addFiles(seedFiles)` path
  if provided. This is additive (default `undefined` preserves all current
  `/pdf`-page-removed call sites/behavior) and keeps the existing
  `resetGeneration` guard correct since `addFiles` already reads
  `resetGeneration.current` fresh.

### `/pdf` URL and metadata
- `/pdf/page.tsx`: keep the route, replace `PdfToolkitApp` with
  `<UnifiedApp initialIntent="pdf" />`. Metadata (JSON-LD, OG, canonical)
  stays PDF-flavored as today, unchanged in content — only the rendered
  component changes.
- `/page.tsx`: replace `ImageCompressorApp` with `<UnifiedApp
  initialIntent={null} />`. Metadata needs rewriting since `/` is no longer
  image-only: title becomes "QuikLab - image & PDF tools, no upload" (or
  similar), description mentions both, WebApplication JSON-LD description
  updated. `AboutSection`/`FaqJsonLd` (image-specific) and
  `PdfAboutSection`/`PdfFaqJsonLd` (PDF-specific) both still render, one
  after another, below the workspace, regardless of detected type — they're
  SEO/content-value sections, not part of the interactive flow, and
  removing either would be a content/SEO regression for whichever tool's
  copy got cut. This is explicitly in scope for task 2 (see below).

## 3. Motion/animation spec for new transition points

All new motion must reuse existing tokens/timings, be wrapped in
`@media (prefers-reduced-motion: reduce)` fallbacks exactly like every
existing block in quiklab.css, and use the established spring curve
`cubic-bezier(.34, 1.56, .64, 1)` for "arrival/overshoot" moments vs.
`cubic-bezier(.21, .8, .36, 1)` for straightforward reveal/settle moments
(matches current usage: stepper dot vs. `wizard-step-in`).

1. **File lands → "reading" state** (new): drop zone border does one pulse
   using the existing `stepper-pulse` keyframe pattern
   (`box-shadow: 0 0 0 0 var(--accent-soft)` → `0 0 0 8px transparent`,
   `.6s ease-out`, reuse the keyframe, don't duplicate it) while the icon
   swaps to a new generic "file" glyph (add `icon-file` to IconSprite,
   simple rounded-rect-with-folded-corner path matching the existing PDF
   icon's stroke weight) that fades in over the upload icon fading out,
   120ms cross-fade. Minimum hold ~220ms via a `setTimeout` before
   resolving detection, even though the type check itself is synchronous —
   this is the one deliberately-artificial delay in the whole spec, and
   only because an instant swap here reads as a glitch, not speed.
   Reduced-motion: skip the pulse and hold, detection resolves immediately.

2. **Reading → detected chip reveal**: the drop zone card itself animates
   out using `wizard-step-in`'s reverse (opacity 1→0, translateY 0→-10px,
   `.22s cubic-bezier(.21,.8,.36,1)`) while the new `.detected-chip`
   element animates in with `wizard-step-in` itself (already defined,
   reused verbatim) at 60ms stagger. Inside the chip, the type icon
   (icon-image or icon-pdf) draws in via the existing `icon-check-draw`
   stroke-dasharray/dashoffset pattern (`.35s cubic-bezier(.21,.8,.36,1)`
   already defined for checkmarks — reuse the same mechanism, new
   `stroke-dasharray` length tuned per icon's own path length) instead of
   a plain fade, so the "identified" moment reads as drawn/confirmed, not
   just appeared.

3. **Chip settle → destination UI mounts**: the destination (Configure step
   for images, or the 8-tool grid for PDFs) mounts via the existing
   `wizard-step-in` animation (already applied to `.wizard-step` — no new
   CSS needed), staggered to start ~60ms after the chip's own animation
   begins (not after it ends) so the two reveals feel like one continuous
   cascade rather than two sequential waits. Implementation detail: since
   these are two different DOM subtrees appearing via conditional render
   (not a single list), the stagger is achieved with a fixed
   `animation-delay: .06s` utility class on the destination's outer
   `.wizard-step` wrapper for this specific transition only, not a global
   change to `wizard-step-in`'s default timing (which other steps still
   use at 0 delay).

4. **PDF tool grid appearing specifically** (subset of #3, since it's a
   grid of cards rather than a single panel): reuse the existing
   `tool-card-in` keyframe/stagger exactly as `ToolGrid` already does via
   `--tool-index` — no changes needed here, it already staggers per-card.
   The only new piece is that the grid's *container* now appears via the
   chip-triggered cascade above rather than being present at page-load —
   confirm `tool-card-in`'s `animation-delay` math (likely
   `calc(var(--tool-index) * Nms)`) still reads naturally stacked on top of
   the new 60ms outer stagger; if the combined delay makes the grid feel
   sluggish for the 7th/8th card, cap the total cascade (outer stagger +
   per-card stagger) so the last card is on-screen well under ~700ms from
   drop.

5. **Mixed-drop "switch file type" chip**: slides/fades in using the same
   `toast-in` keyframe already defined for the toast system (reuse, don't
   duplicate) since it's conceptually a similar "new, dismissible-ish,
   non-blocking" affordance, positioned inline near the workspace head
   rather than as a floating toast (it needs to persist until acted on,
   unlike a toast).

6. **Unsupported-type shake**: new, small — `@keyframes drop-reject { 0%,
   100% { transform: translateX(0); } 25% { transform: translateX(-6px); }
   75% { transform: translateX(6px); } }`, `.2s ease` on `.drop`/border
   flashing to `var(--accent)` for that duration only, then back to
   resting border color. Reduced-motion: border flash only (color change,
   no translateX), consistent with how other reduced-motion fallbacks in
   quiklab.css keep the color/state change but drop the transform.

## 4. Task breakdown for build agents

Each task lists exact files to create/touch, what NOT to touch, and the
verification bar. Work is scoped so tasks can run in parallel worktrees/
branches without touching the same file. **All tasks build on top of each
other's *interfaces*, not implementation** — agree on the prop/callback
shapes below before starting if anything is unclear, rather than guessing.

---

### Task 1 — Core unified routing component + hook wiring
**Owns:** the actual "one entry point, auto-detect, mount the right tool"
logic.

Creates:
- `src/components/UnifiedUpload/UnifiedApp.tsx`
- `src/components/UnifiedUpload/UnifiedDropZone.tsx`
- `src/components/UnifiedUpload/DetectedChip.tsx`
- `src/components/UnifiedUpload/detectFileType.ts` (pure function: `(files:
  File[] | FileList) => { images: File[]; pdfs: File[] }`, unit-testable
  logic isolated from components — MIME-type check for images
  (`ACCEPTED_TYPE_RE` equivalent, import/reuse the existing regex from
  `useImageCompressor.ts` if it's exported, or duplicate the single regex
  constant with a comment pointing at the source of truth) and PDF
  detection (`application/pdf` MIME OR `.pdf` extension fallback))

Touches:
- `src/app/page.tsx` — replace `ImageCompressorApp` usage with
  `<UnifiedApp initialIntent={null} />`; keep `AboutSection`/`FaqJsonLd`
  imports/rendering as-is below it (task 2 handles metadata content, not
  this file's component wiring — coordinate: task 1 should leave the
  existing metadata export untouched and let task 2 edit it, to avoid both
  editing the same export block).
- `src/app/pdf/page.tsx` — replace `PdfToolkitApp` usage with
  `<UnifiedApp initialIntent="pdf" />`; keep existing PDF-specific
  `AboutSection`/`FaqJsonLd` rendering.
- `src/components/ImageCompressor/ImageCompressorApp.tsx` — add
  `renderShell?: boolean` prop (default `true`); when `false`, skip the
  outer `<div className="page"><AmbientBackground/><div
  className="workspace-shell"><header className="workspace-head">…`
  wrapper and render only the `Stepper`+`main.workspace-body`+footer note
  content, so `UnifiedApp` can supply its own single shell. Also add an
  optional `initialFiles?: File[]` prop that seeds `addFiles` once via a
  `useRef`-guarded effect on mount.
- `src/components/PdfToolkit/PdfToolkitApp.tsx` — same `renderShell?:
  boolean` treatment. Also add `initialFiles?: File[]` — when present,
  DON'T show `ToolGrid` immediately; still show it (per the UX decision:
  PDF drop → inline tool grid), but pass the seeded files through so
  `onSelect`/`openTool` can preload them.
- `src/hooks/usePdfToolkit.ts` — change `openTool` signature to `(id:
  PdfToolId, seedFiles?: File[]) => void`; after `resetWorkspace()`, if
  `seedFiles?.length`, call the existing `addFiles(seedFiles)` (note:
  `addFiles` depends on `tool`/`activeTool` from closure — verify
  `setActiveTool(id)` has been applied before `addFiles` reads `tool`; if
  there's a stale-closure issue since `tool` is derived from state not yet
  re-rendered, restructure by extracting the file-accepting/page-loading
  body of `addFiles` into a plain async helper parameterized by the
  resolved `PdfToolDef` rather than reading `tool` from hook state, OR
  simply defer the seed-files call to a `useEffect` on `activeTool`
  change in the calling component instead of doing it synchronously
  inside `openTool` — prefer the `useEffect`-in-caller approach, it's
  simpler and doesn't touch `addFiles`'s existing closure behavior at
  all).

Must NOT touch: `src/app/quiklab.css` (task 3 owns all new CSS/keyframes),
`src/components/SiteHeader.tsx` (task 2), `src/components/IconSprite.tsx`
(task 3 owns the new `icon-file` glyph), `useImageCompressor.ts`'s
processing logic (only read from it, don't modify), `usePdfToolkit.ts`
beyond the one `openTool` signature change described above.

Verify before reporting done:
- `npx tsc --noEmit` clean.
- `npm run build` clean (both `/` and `/pdf` routes build).
- Manual/Playwright: drop a JPG at `/` → lands in image Configure step with
  the file present in `items`. Drop a PDF at `/` → tool grid appears inline
  with no page navigation; selecting "Compress PDF" shows the compress
  Configure step with the dropped file already listed (not re-prompted to
  upload). Drop 2 images + 1 PDF at `/` → images proceed into the image
  Configure step; confirm the PDF isn't silently lost (check for whatever
  hand-off task 1 exposes — even a `console.log`/toast stub is fine here,
  task 2 wires the actual "switch file type" chip UI).
- Navigate to `/pdf` directly → drop zone renders PDF-scoped copy/accept;
  a PDF drop there works exactly as `/` does for PDFs.
- Back/forward through the wizard steps (browser back button) still works
  without errors after seeding via `initialFiles` — specifically test
  clicking "Add more" / back-to-Upload after a seeded drop doesn't throw
  (the existing `goToStep`/`maxReachedIndex` guards should just work, but
  confirm with the new seed-on-mount path in the loop).

---

### Task 2 — Header, SEO/metadata, old-route cleanup
**Owns:** everything about how the app presents itself as "one thing" at
the chrome/metadata level, not the interactive drop/detect logic itself.

Creates: none.

Touches:
- `src/components/SiteHeader.tsx` — remove `NAV_LINKS` array and the
  `<nav className="site-nav">` block entirely; logo `Link href="/"`
  gets an `onClick` that, only when already on `/` or `/pdf`, calls a
  passed-down `resetAll` callback (exposed via a small context or a prop
  threaded from `UnifiedApp` — coordinate with task 1: task 1 should
  export a `useUnifiedReset()` hook or context provider from
  `UnifiedApp.tsx` that `SiteHeader` can safely import; if task 1 hasn't
  landed yet when this task starts, stub it as a no-op and leave a
  `// TODO(task1)` comment rather than blocking).
- `src/app/page.tsx` — metadata export only (title, description, JSON-LD
  WebApplication description) rewritten to cover both image + PDF, e.g.
  title `"QuikLab - image & PDF tools, no upload"`. Do not touch the
  component-rendering JSX (task 1 owns that).
- `src/app/pdf/page.tsx` — metadata stays PDF-flavored; only update
  wording if it currently implies `/pdf` is a separate app rather than a
  scoped entry point into the same one (light copy pass, not a rewrite).
- Delete the now-fully-superseded `src/components/PdfToolkit/ToolGrid`
  usage from `PdfToolkitApp`'s standalone top-level render path — NOT the
  file itself (task 1 still uses `ToolGrid` inside the unified flow after
  PDF detection) — verify with task 1 before removing anything; if in
  doubt, leave `ToolGrid.tsx` untouched, this bullet is about confirming
  no dead duplicate render path remains, not deleting the component.

Must NOT touch: `UnifiedApp.tsx`/`UnifiedDropZone.tsx`/`DetectedChip.tsx`
(task 1), `usePdfToolkit.ts`/`useImageCompressor.ts` (task 1),
`quiklab.css` (task 3), `IconSprite.tsx` (task 3).

Verify before reporting done:
- `npx tsc --noEmit` clean, `npm run build` clean.
- View source / Next metadata output for `/` shows the updated title+OG+
  JSON-LD; `/pdf` still shows its own distinct metadata.
- Header renders with no nav links, just logo + theme toggle, on both `/`
  and `/pdf`; clicking the logo while mid-wizard returns to the idle drop
  zone without a full page reload (once task 1's reset hook exists — if
  stubbed, note this explicitly in the build log as a follow-up).
- No broken imports from removed `NAV_LINKS`/`Icon` usage in
  `SiteHeader.tsx` (the `Icon` import may now be unused — remove it if so,
  `eslint`/`tsc` will flag it).

---

### Task 3 — Motion/animation for the new detection + reveal moments
**Owns:** all new CSS (keyframes, classes) and the one new icon glyph. Does
NOT own component logic/structure — works against the class names task 1's
components already render (coordinate class-name contract up front, e.g.
`.detected-chip`, `.drop-reading`, `.drop-reject`, `.type-switch-chip` —
task 1 should apply these exact class names even before task 3's CSS
exists, so both tasks can proceed without waiting on each other).

Creates: none (all edits to existing shared files).

Touches:
- `src/app/quiklab.css` — add the keyframes/classes described in section 3
  above: `.drop-reading` (pulse via reused `stepper-pulse` keyframe),
  icon cross-fade rule for the file glyph swap, `.detected-chip` reveal
  (reuse `wizard-step-in`), `icon-check-draw`-style stroke-in applied to
  the chip's type icon, `.wizard-step--cascade` (or similar) utility class
  for the 60ms `animation-delay`, `.type-switch-chip` (reuse `toast-in`),
  `@keyframes drop-reject` + `.drop.is-rejected` class, all under existing
  `@media (prefers-reduced-motion: reduce)` guards following the exact
  pattern already used throughout the file (grep for
  `prefers-reduced-motion` to see every existing instance and match that
  style — don't introduce a new motion-guarding convention).
- `src/components/IconSprite.tsx` — add one new `<symbol id="icon-file">`
  (generic document glyph, same stroke weight/style as neighboring icons
  — base it on `icon-pdf`'s outer path minus the "PDF" text and fold-corner
  simplified, ~1.6 strokeWidth, `viewBox="0 0 24 24"`).

Must NOT touch: any `.tsx` component files, `usePdfToolkit.ts`/
`useImageCompressor.ts`. If a class name task 1 actually used differs from
what's listed here, follow task 1's real class names (check their diff/
build log entry first) rather than inventing new ones that won't match.

Verify before reporting done:
- `npx tsc --noEmit` clean (icon sprite is `.tsx`), `npm run build` clean.
- Manual check in-browser (light + dark theme) of: drop → reading pulse →
  chip draw-in → destination cascade, at both normal speed and with OS
  "reduce motion" enabled (confirm all animations collapse to instant/
  simple per the reduced-motion rules, nothing left spinning/looping).
- Confirm no regressions to existing animations reused (stepper pulse,
  wizard-step-in, tool-card-in, toast-in, icon-check-draw) by spot-checking
  the flows that already used them (stepper navigation, PDF tool grid,
  a toast, an image result checkmark) still look/feel identical to before
  this change.

---

## 5. Deploy-agent readiness note

Dispatched last, separately, after all three build agents have appended
their `## Agent N report` section to `BUILD_LOG_unified-upload.md`. Before
considering this mergeable toward `main`:

- All three tasks' files exist as described above and `git status` on
  `nextjs-migration` shows a clean, intentional diff (no stray debug code,
  no leftover `console.log`s from task 1's mixed-drop stub unless
  intentionally left as a documented TODO).
- `npx tsc --noEmit` and `npm run build` both clean at the point of
  integration (re-run after all three tasks land together, not just
  per-task — task 3's class names must actually match what task 1
  rendered, verify by inspecting the built/dev-served page, not just
  trusting each report).
- Read all three `## Agent N report` sections in
  `BUILD_LOG_unified-upload.md` for any noted deviations (e.g. if task 1
  had to stub the reset-hook contract, confirm task 2 actually wired the
  real thing afterward, or flag it as an open follow-up rather than
  silently merging a stub).
- Manually walk (or Playwright-script) the core scenarios end to end on
  the integrated branch: image drop at `/`, PDF drop at `/` through to a
  completed tool run and download, direct visit to `/pdf` with a PDF drop,
  mixed-type drop, unsupported-type drop, browser back/forward through a
  wizard, theme toggle + reduced-motion still correct.
- `/pdf` and `/` both still produce valid, distinct metadata/JSON-LD (spot
  check via view-source or `curl`).
- This is still on `nextjs-migration`, not merged to `main` — confirm the
  deploy agent's actual mandate (this planning doc does not authorize a
  merge to `main`/production; that's a separate explicit decision for
  whoever dispatches the deploy agent).
