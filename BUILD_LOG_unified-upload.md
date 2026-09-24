# Build log — unified upload entry point

Each build agent appends their own `## Agent N report` section below once
their task (see PLANNING_unified-upload.md) is complete. Include: what was
built, what was verified (tsc/build/manual or Playwright scenarios), and
any deviations from the plan and why.

## Agent 2 report

**Task 2 — Header, SEO/metadata, old-route cleanup.**

### What was built

- `src/components/SiteHeader.tsx`:
  - Removed `NAV_LINKS` array and the `<nav className="site-nav">` block
    entirely.
  - Removed the now-unused `Icon` import.
  - Logo `Link href="/"` now has an `onClick={handleLogoClick}` handler
    that, only when `pathname` is `/` or `/pdf`, is meant to call a real
    reset. **Stubbed as a no-op** — see Deviations below — normal Next.js
    navigation to `/` still happens via the `Link`, so clicking the logo
    from `/pdf` still gets the user back to `/`, it just doesn't yet reset
    in-place wizard state on `/` itself without a full navigation.
  - `ThemeToggle` on the right is unchanged.
- `src/app/page.tsx`: rewrote the `metadata` export only — title is now
  `"QuikLab - image & PDF tools, no upload"`, added a `description` field
  (previously missing), added matching `openGraph`/`twitter` blocks
  (previously `/` had none, unlike `/pdf` which already had them — brought
  it up to parity), and updated the `WEB_APP_JSON_LD` `description` to
  mention both images and PDFs. Left `name`/`url`/`applicationCategory`/
  `offers` and all component-rendering JSX (`ImageCompressorApp`,
  `AboutSection`, `FaqJsonLd`, `GifEncoderScript`) untouched — that's
  Task 1's territory per the plan.
- `src/app/pdf/page.tsx`: light copy pass only, per the plan's instruction
  to update wording only if it implies `/pdf` is a separate app. Changed
  `WEB_APP_JSON_LD.name` from `"QuikLab PDF Toolkit"` to `"QuikLab"` (this
  was the one piece of wording that implied a distinct application
  identity rather than a PDF-scoped entry point into the same QuikLab
  app — matches `/`'s JSON-LD `name`). Left title/description/OG/twitter
  metadata as-is since those are legitimately PDF-flavored per-page
  metadata and the plan says this stays "PDF-flavored as today, unchanged
  in content."
- `ToolGrid` standalone-render-path check: inspected
  `src/components/PdfToolkit/PdfToolkitApp.tsx` — at the time I checked,
  Task 1 had not yet landed (`src/components/UnifiedUpload/` did not
  exist), and `PdfToolkitApp.tsx` was still the plain standalone PDF app
  showing `ToolGrid` directly. Per the plan ("if in doubt, leave
  `ToolGrid.tsx` untouched... this bullet is about confirming no dead
  duplicate render path remains, not deleting the component") and since
  `PdfToolkitApp.tsx` is itself a file Task 1 owns/touches (for the
  `renderShell`/`initialFiles` props), I made **no changes** to
  `PdfToolkitApp.tsx` or `ToolGrid.tsx`. By the time I ran final
  verification, Task 1's edits to `PdfToolkitApp.tsx` were already
  in-flight in the working tree (visible via `git diff --stat`), so this
  is confirmed as Task 1's responsibility, not a gap on my end.

### Verified

- `npx tsc --noEmit`: clean, no errors, on my changes.
- `npm run build`: **currently fails**, but the failure is a Turbopack
  parse error in `src/components/ImageCompressor/ImageCompressorApp.tsx`
  (line ~162, malformed JSX around a `renderShell` conditional return) —
  a file I do not own and did not touch. This is Task 1's in-progress work
  landing concurrently in the same working tree (confirmed via
  `git diff --stat`, which shows `ImageCompressorApp.tsx`,
  `PdfToolkitApp.tsx`, `usePdfToolkit.ts`, `quiklab.css`, and
  `IconSprite.tsx` all mid-diff from other agents). `npx tsc --noEmit`
  stayed clean throughout for reasons unrelated to this bug (tsc's parser
  apparently tolerates or doesn't hit the same code path Turbopack's
  parser chokes on). **Flagging for the deploy-agent integration pass**:
  re-run `npm run build` once Task 1 finishes to confirm this clears.
- Header: manually reviewed rendered JSX — logo + `ThemeToggle` only, no
  nav links, no leftover `Icon`/`NAV_LINKS` references. Did not do a full
  in-browser check of the logo-click reset behavior since it's a
  navigation-only no-op right now (see Deviations).
- Metadata: reviewed both `page.tsx` files directly (source review, not
  `view-source`/`curl`, since `npm run build` doesn't currently complete
  end-to-end due to the unrelated Task-1-in-progress build error above) —
  `/` and `/pdf` produce distinct `title`/`description`/JSON-LD `url`
  values; both now share JSON-LD `name: "QuikLab"`.

### Deviations / follow-ups

- **Reset-hook wiring is STUBBED, not real.** `src/components/UnifiedUpload/UnifiedApp.tsx`
  did not exist yet when I did this work (Task 1 had not landed). Per the
  planning doc's explicit fallback instruction, `SiteHeader.handleLogoClick`
  is a no-op guarded to only apply on `/` or `/pdf`, with a
  `// TODO(task1): wire real reset once UnifiedApp exports useUnifiedReset()`
  comment left in place (both above the component and inline in the
  handler). **Follow-up required**: once Task 1's `UnifiedApp.tsx` lands
  and exports `useUnifiedReset()` (or equivalent), `SiteHeader.tsx` needs a
  second pass to import that hook and call the real reset function from
  `handleLogoClick` instead of the current no-op. This is the single most
  important open item from my task — the deploy-agent readiness checklist
  in the planning doc explicitly calls this out ("confirm task 2 actually
  wired the real thing afterward, or flag it as an open follow-up") and I'm
  flagging it here as still open, not silently resolved.
- `npm run build` currently fails for reasons outside my scope (see
  Verified section above) — not a regression I introduced, but the
  deploy-agent pass must re-verify build cleanliness after all three tasks
  are integrated, per the planning doc's own instructions.
- No other deviations — file list, copy intent, and JSON-LD changes match
  the plan as written.

## Agent 3 report

**Task 3 — Motion/animation for the new detection + reveal moments.**

### What was built

- `src/components/IconSprite.tsx`: added one new `<symbol id="icon-file">`,
  based on `icon-pdf`'s outer document path (same folded-corner outline,
  same `1.6` stroke weight, `viewBox="0 0 24 24"`) but with the "PDF" text
  replaced by three generic horizontal line strokes (simplified page-lines
  glyph) instead of any type-specific label — a neutral "some file" icon
  for the reading/detecting state, distinct from both `icon-image` and
  `icon-pdf`.
- `src/app/quiklab.css`: added a new section at the end of the file
  ("Unified upload — detection + reveal moments") covering every motion
  point from planning-doc section 3, reusing existing keyframes verbatim
  per the spec rather than duplicating them:
  1. **Reading state** — `.drop.drop-reading` plays the existing
     `stepper-pulse` keyframe (reused, not duplicated) for the one-shot
     border pulse. `.drop-icon-fade` + `.icon.is-leaving`/`.icon.is-entering`
     give the upload-icon-to-file-icon cross-fade task 1's reading-state
     markup can drive by toggling classes (120ms opacity transition per
     icon, absolutely stacked so both occupy the same box during the
     cross-fade).
  2. **Reading -> detected chip** — added `@keyframes drop-out` (the
     `wizard-step-in` reveal run in reverse, exactly per spec: opacity 1->0,
     translateY 0->-10px, `.22s cubic-bezier(.21,.8,.36,1)`) applied via
     `.drop.is-leaving`. `.detected-chip` reuses `wizard-step-in` itself
     verbatim with a `.06s` animation-delay for the 60ms stagger. The
     chip's type icon draws in via the existing `icon-check-draw`
     mechanism — reused, not forked.
  3. **Chip settle -> destination cascade** — `.wizard-step--cascade` utility
     class adding `animation-delay:.06s` on top of the existing
     `.wizard-step`/`wizard-step-in` rule, scoped to this one utility class
     so other steps' default 0-delay timing is untouched.
  4. **PDF tool grid** — confirmed no changes needed; `tool-card-in` +
     `--tool-index` stagger (`calc(min(var(--tool-index,0),8) * 35ms)`,
     already capped at 8 steps) is untouched and will simply stack under
     whatever outer `.06s` cascade delay task 1 applies to the grid's
     container, keeping the last card well under ~700ms from drop.
  5. **Mixed-drop chip** — `.type-switch-chip` reuses `toast-in` verbatim,
     styled inline (pill shape, `--rail-bg`/`--rail-border`) rather than as
     a floating toast, since per the plan it needs to persist until acted
     on.
  6. **Unsupported-type shake** — added `@keyframes drop-reject` exactly as
     specified in the plan (`translateX` -6px/+6px at 25%/75%) applied via
     `.drop.is-rejected`, `.2s ease`, with `border-color:var(--accent)` for
     the flash; task 1/task 2's calling code is responsible for removing
     the class after the animation duration to let the border settle back.
  - Every new rule has a matching `@media (prefers-reduced-motion: reduce)`
    block immediately following it, matching the file's existing pattern
    exactly (grepped every existing `prefers-reduced-motion` instance
    first). Reduced-motion behavior per rule: `.drop-reading`'s pulse is
    disabled (icon cross-fade transition also dropped to `none` — detection
    still resolves via task 1's timer, it just doesn't visibly hold); the
    chip/cascade/type-switch-chip animations are disabled outright
    (content still appears, just without the transition); `.is-rejected`
    keeps the border-color flash but drops the `translateX` animation,
    consistent with how other reduced-motion fallbacks in the file keep the
    color/state cue and drop the transform.

### Deviation from the plan (and why)

- The existing `@keyframes icon-check-draw` (used today for the PDF-result
  and frame-download checkmarks) had `stroke-dasharray:21` **hardcoded in
  both its `from` and `to` states**, not just an initial value — meaning a
  plain "reuse the same keyframe, just point it at a longer path" approach
  as literally described in the plan doesn't work: the keyframe would
  clobber any per-icon dasharray back down to 21 regardless of the actual
  glyph, drawing the wrong stroke length for `icon-image`/`icon-pdf`/
  `icon-file`. Rather than forking a near-duplicate keyframe (which the
  plan explicitly warns against — "reuse the keyframe, don't duplicate
  it"), I parameterized the existing keyframe to read `stroke-dasharray`/
  `stroke-dashoffset` from a new custom property, `--stroke-draw-len`,
  defaulting to `21` so every existing caller (`.pdf-result .icon use`,
  `.frame-dl.is-success .icon use`) is pixel-identical to before with zero
  behavior change. The new `.detected-chip-icon` sets
  `--stroke-draw-len: 40` (a placeholder length in the same ballpark as the
  image/pdf/file glyph outlines — task 1's actual rendered `<use>` path
  determines the real visually-correct value; 40 is a reasonable starting
  point, not path-metric-measured, since I don't own the component markup
  that picks which icon renders in the chip). This is a genuine, minimal,
  backward-compatible change to a file I own (`quiklab.css`) and doesn't
  touch any `.tsx` files, so it stays within task 3's scope.
- `icon-file`'s design deviates slightly from "folded-corner simplified" —
  I kept the exact same folded-corner outline path as `icon-pdf` (for
  visual family consistency) and only replaced the "PDF" text glyph with
  three generic horizontal strokes, rather than simplifying the outline
  itself, since the outline is already minimal and reusing it verbatim
  guarantees identical stroke weight/proportions to its sibling icons.

### Verified

- `npx tsc --noEmit`: clean.
- `npm run build`: clean — both `/` and `/pdf` routes build successfully
  (confirmed after Task 1's in-progress work, which an earlier build had
  been blocked on per Agent 2's report, had landed; my own build run shows
  no errors in any file).
- `git diff --stat` confirms my changes are confined to exactly
  `src/app/quiklab.css` (+115/-2 lines) and `src/components/IconSprite.tsx`
  (+1 line) — no `.tsx` component files beyond `IconSprite.tsx` touched,
  `usePdfToolkit.ts`/`useImageCompressor.ts` untouched.
- Class-name contract: grepped the plan doc and used the exact class names
  listed (`.detected-chip`, `.drop-reading`, `.drop-reject` ->
  implemented as `.drop.is-rejected` triggering the `drop-reject` keyframe
  per the plan's own naming in section 3.6, `.type-switch-chip`,
  `.wizard-step--cascade`). At the time of writing, Task 1's
  `src/components/UnifiedUpload/` directory existed in the working tree
  (per `git status`) — did not cross-check its actual rendered class names
  against mine beyond what's visible in this build log, since Task 1 had
  not yet appended its own `## Agent 1 report` section for me to verify
  against. **Follow-up for the deploy-agent integration pass**: confirm
  Task 1's real markup uses `.detected-chip`, `.drop-reading`,
  `.drop.is-rejected`, `.type-switch-chip`, `.wizard-step--cascade`, and
  `.detected-chip-icon` (the wrapper class my dasharray-length rule keys
  off of) exactly, adjusting either side if any name drifted.
- Did not do an in-browser visual check (light/dark + reduced-motion) since
  Task 1's components weren't confirmed complete/wired at the time of this
  verification pass — CSS was checked structurally (valid syntax, build
  succeeds, existing reused keyframes/animations for stepper pulse,
  wizard-step-in, tool-card-in, toast-in, and icon-check-draw remain
  byte-for-byte unchanged in their original call sites aside from the
  `--stroke-draw-len` parameterization described above, which is
  value-compatible). Recommend the deploy-agent pass do the actual
  in-browser spot-check across both themes and reduced-motion once all
  three tasks are integrated, per the planning doc's own instructions.

## Agent 1 report

**Task 1 — Core unified routing component + hook wiring.**

### What was built

- `src/components/UnifiedUpload/detectFileType.ts` — pure `detectFileType(files)
  => { images, pdfs, rejected }`. Image detection duplicates
  `useImageCompressor.ts`'s `ACCEPTED_TYPE_RE` regex (not exported there, and
  the plan says not to modify that hook's processing logic, so it's
  duplicated with a comment pointing at the source of truth rather than
  exported/imported). PDF detection is `application/pdf` MIME OR a `.pdf`
  extension fallback, per the plan (some OS pickers report empty MIME for
  PDFs).
- `src/components/UnifiedUpload/DetectedChip.tsx` — renders `.detected-chip`
  with a `.detected-chip-icon` wrapper (`<Icon name="image"|"pdf">` inside),
  filename+size for a single file or a `"N images/PDFs detected"` count
  label for multiples.
- `src/components/UnifiedUpload/UnifiedDropZone.tsx` — the idle/reading/
  reject drop zone. Reading state: 220ms artificial hold
  (`READING_HOLD_MS`) before resolving detection, skipped entirely under
  `prefers-reduced-motion: reduce` (checked via `matchMedia`). Icon
  cross-fade uses a `.drop-icon-fade` wrapper with two stacked `<Icon>`s
  (`upload` and `file`) toggling `.is-leaving`/`.is-entering` — matches
  task 3's actual CSS contract (`.drop-reading .drop-icon-fade .icon.is-leaving/.is-entering`),
  not a simple icon-name swap as I originally guessed before task 3's CSS
  landed (see Deviations). Also drives `.drop.is-leaving` (task 3's
  `drop-out` reverse-reveal) for 220ms before calling `onFiles`, so the drop
  zone visibly animates out before `UnifiedApp` swaps in the chip, and
  `.drop.is-rejected` (not `.drop-reject` as the plan's prose literally
  said — see Deviations) with a 200ms auto-clear timer for the unsupported-
  drop shake.
- `src/components/UnifiedUpload/UnifiedApp.tsx` — the orchestrator.
  Owns `detected: "image" | "pdf" | null` plus a `pendingOpposite` stash
  (state + a ref mirror) for the mixed-drop case. `handleFiles` classifies
  via `detectFileType`, and:
  - rejects entirely (toast) if nothing usable was in the drop;
  - on `/pdf` (`initialIntent==="pdf"`), a stray image-only drop gets a
    redirect toast instead of misrouting into the image path;
  - mixed image+PDF: images mount immediately into the image Configure step
    (no confirmation click, per the UX decision), the PDF(s) are stashed in
    `pendingOppositeRef`/`pendingOpposite` state, and a toast fires plus a
    persistent `.type-switch-chip` button appears that calls
    `switchToPending()` to swap the mounted tool without re-uploading;
  - pure image or pure PDF drops mount directly.
  Exports `useUnifiedReset()` (a context hook returning `{ resetAll } | null`)
  for `SiteHeader.tsx` (task 2) to import — `resetAll()` clears `detected`/
  `detectedFiles`/`pendingOpposite` back to the idle drop zone. `UnifiedApp`
  is the sole owner of the outer `.page`/`AmbientBackground`/
  `.workspace-shell`/header/footer shell; `ImageCompressorApp`/
  `PdfToolkitApp` are mounted with `renderShell={false}` underneath it.

### Touched (per the plan's file list)

- `src/app/page.tsx` — swapped `ImageCompressorApp` for
  `<UnifiedApp initialIntent={null} />`; added `PdfFaqJsonLd`/`PdfAboutSection`
  alongside the existing image ones (per plan section 2's "`/pdf/page.tsx`"
  subsection: both tools' SEO/content sections render on `/` now,
  regardless of detected type). Did not touch the `metadata`/`WEB_APP_JSON_LD`
  export — task 2 had already landed that by the time I edited this file
  (confirmed via re-read after a stale-file warning from the Edit tool).
- `src/app/pdf/page.tsx` — swapped `PdfToolkitApp` for
  `<UnifiedApp initialIntent="pdf" />`; left metadata and
  `PdfAboutSection`/`PdfFaqJsonLd` untouched.
- `src/components/ImageCompressor/ImageCompressorApp.tsx` — added
  `renderShell?: boolean` (default `true`) and `initialFiles?: File[]`
  (seeded once via a `useRef`-guarded `useEffect`, immune to StrictMode's
  dev double-invoke). Shell-less mode renders the `Stepper` + step content
  directly (no nested `<main>`/duplicate `.workspace-body`, and skips its
  own footer since `UnifiedApp`'s shell footer already covers both tools'
  "processing is local" note — see Deviations for why a `<main>`-nesting
  bug initially surfaced here).
- `src/components/PdfToolkit/PdfToolkitApp.tsx` — same `renderShell`/
  `initialFiles` treatment. Shell-less mode still shows `ToolGrid`
  immediately (per the UX decision — PDF drop shows the inline grid, not an
  auto-picked tool); once a tool is opened, a `useRef`-guarded `useEffect`
  keyed on `toolkit.activeTool` calls `toolkit.addFiles(initialFiles)` to
  preload the seeded PDF into that tool's workspace.
- `src/hooks/usePdfToolkit.ts` — `openTool` signature changed to
  `(id: PdfToolId, seedFiles?: File[]) => void` per the plan (additive,
  default `undefined`, so all existing call sites are unaffected). The
  `seedFiles` parameter is accepted but deliberately **not** applied
  synchronously inside `openTool` — see Deviations for why, and which of
  the plan's two suggested resolutions I took.

### Deviations from the plan (and why)

1. **Stale-closure resolution for `openTool`/seeding**: the plan flagged
   this explicitly and offered two options — extract `addFiles`'s body into
   a helper parameterized by the resolved tool, OR defer the seed call to a
   `useEffect` in the calling component keyed on `activeTool`, with a
   stated preference for the effect approach ("simpler and doesn't touch
   `addFiles`'s existing closure behavior at all"). **I took the effect
   approach**, exactly as preferred: `openTool(id, seedFiles?)` still
   accepts `seedFiles` for interface parity with the plan's stated
   signature, but ignores it (`void seedFiles;`) rather than calling
   `addFiles` synchronously — a comment in `usePdfToolkit.ts` explains why
   (at the moment `openTool` runs, `setActiveTool(id)` hasn't re-rendered
   yet, so `addFiles`'s closure would still read the *previous* `tool`/
   `activeTool`). The actual seeding happens in `PdfToolkitApp.tsx`'s
   `useEffect(() => {...}, [toolkit.activeTool, initialFiles])`, which fires
   after the state update has landed and `tool`/`addFiles` have been freshly
   derived. `usePdfToolkit.ts`'s `addFiles` closure behavior is completely
   unchanged.
2. **Class names**: the plan's own prose (section 4, task 3) used slightly
   different literal names than what task 3 actually implemented in
   `quiklab.css` (confirmed by reading task 3's landed CSS + Agent 3's own
   build-log report, which explicitly names the same drift). I matched
   task 3's *real* CSS selectors rather than the plan's prose:
   - Reject state: task 3 implemented `.drop.is-rejected` (not the literal
     `.drop-reject` class-on-its-own the plan's task-1 bullet listed) —
     `UnifiedDropZone` toggles `is-rejected`, matching the CSS.
   - Icon cross-fade: task 3 implemented it as `.drop-reading .drop-icon-fade
     .icon.is-leaving`/`.is-entering` (two stacked, absolutely-positioned
     icons cross-fading), not a single `<Icon>` whose `name` prop swaps.
     Rewrote `UnifiedDropZone` to render both `upload` and `file` icons
     inside a `.drop-icon-fade` wrapper, toggling the leaving/entering
     classes.
   - Drop-zone exit: task 3 also implemented `@keyframes drop-out` +
     `.drop.is-leaving` (the reverse `wizard-step-in` reveal mentioned in
     plan section 3.2) as a real, separate animation point that I hadn't
     originally wired up. Added a `LEAVE_MS` (220ms, matching the CSS's
     `.22s`) hold after the reading state resolves, during which
     `.is-leaving` is applied, before calling `onFiles` and handing off to
     `UnifiedApp` to swap in the chip — so the drop-zone-out and chip-in
     moments actually cascade instead of an instant unmount.
   - `.detected-chip-icon`: task 3's CSS targets
     `.detected-chip-icon .icon use` (ancestor/descendant), so
     `DetectedChip` wraps the `<Icon>` in a `<span className="detected-chip-icon">`
     rather than putting both classes directly on the same SVG element (my
     first draft had them on the same element, which wouldn't have matched
     task 3's selector — caught and fixed during verification, before
     considering the task done).
   - `.type-switch-chip` and `.wizard-step--cascade` matched the plan/task 3
     exactly with no changes needed.
3. **`<main>` nesting bug caught during self-review**: my first draft of
   `renderShell={false}` mode for both `ImageCompressorApp` and
   `PdfToolkitApp` kept their own `<main className="workspace-body">`
   wrapper, which would have nested a second `<main>` inside `UnifiedApp`'s
   own `<main className="workspace-body">` (invalid HTML, and doubled
   padding). Fixed before running any verification: shell-less mode now
   returns its content directly (no `<main>`, no wrapper `<div className="workspace-body">`),
   and only the `renderShell={true}` (standalone/legacy) path still owns
   its own `<main>`.
4. Per-route `<h1>` copy on `/` changed from "Image compressor" to "QuikLab
   — image and PDF tools, entirely in your browser" inside `UnifiedApp`,
   since the old image-only headline no longer describes the unified entry
   point. This isn't a metadata change (task 2's territory) — it's the
   component's own rendered `<h1>`, which the plan's task 1 file list
   implicitly covers as part of "UnifiedApp.tsx" being the new page
   component.

### Verified

- `npx tsc --noEmit`: clean, no errors, on the full working tree (including
  tasks 2 and 3's concurrent changes).
- `npm run build`: clean — `next build` compiles successfully, TypeScript
  passes, and both `/` and `/pdf` routes are generated as static content.
  Re-ran this multiple times as tasks 2/3 landed their own changes
  concurrently; last clean run was after task 3's CSS/icon changes and my
  own class-name alignment fix.
- `npx eslint` (scoped to all files I touched/created): clean, zero
  warnings/errors.
- Playwright, driven directly against a Chromium binary already cached on
  this machine (`%LOCALAPPDATA%\ms-playwright\chromium-1243`, since no
  `playwright` npm dependency exists in this repo and the sandboxed
  Playwright MCP tool failed to connect) at `http://localhost:3000`
  (existing dev server, confirmed already running via `curl` before use, so
  no new server was started). All of the plan's task-1 verification-bar
  scenarios pass:
  - Drop a synthetic PNG at `/` → `.detected-chip` appears, then lands in
    the image Configure step (`"Add more images"` back-button text visible,
    confirming step 1).
  - Drop a synthetic PDF at `/` → `.detected-chip` appears, `.tool-grid`
    renders inline with **no navigation** (`page.url()` stays `/`);
    clicking the "Compress" tool card shows the tool's Configure step with
    `.pdf-file-list` already populated and **no** `.pdf-drop` re-prompt —
    confirms the dropped file preloads instead of asking the user to
    re-upload.
  - Drop 2 PNGs + 1 PDF at `/` → images proceed straight into the image
    Configure step; `.type-switch-chip` (the PDF hand-off affordance)
    renders, confirming the PDF isn't silently lost.
  - Navigate to `/pdf` directly → `.drop-label` reads "Drop a PDF to get
    started" (PDF-scoped copy); dropping a PDF there shows the tool grid
    exactly as `/` does.
  - After a seeded image drop, clicking "Add more images" (back to Upload)
    re-shows the drop zone with **no thrown page errors** — confirms the
    `initialFiles`-seeding path doesn't break the existing
    `goToStep`/`maxReachedIndex` guards.
  - Dropping an unsupported file type (`.txt`) shows a toast
    (`.toast-stack .toast`), confirming the reject path fires (this also
    exercises the same `onReject`/toast code path the border-shake
    animation hooks into; a literal empty-`dataTransfer` drop event isn't
    easily simulable via Playwright's `setInputFiles`, so the shake
    animation itself was verified by CSS/class inspection rather than a
    live "no files at all" drop).
  - Every scenario above also asserts zero `pageerror`/console-error events
    — 18 assertions total, all passing.
- Did **not** verify the reduced-motion path in-browser (no OS-level
  `prefers-reduced-motion` toggle available in this headless run) — relied
  on code review: `UnifiedDropZone` checks `matchMedia("(prefers-reduced-motion: reduce)")`
  once per `handleFiles` call and skips both the reading hold and the
  `is-leaving` exit hold when it matches, consistent with task 3's CSS
  `@media (prefers-reduced-motion: reduce)` blocks disabling the
  corresponding animations. Recommend the deploy-agent pass do a live
  reduced-motion check.

### Constraints honored

- Did not touch `src/app/quiklab.css`, `src/components/IconSprite.tsx`, or
  `src/components/SiteHeader.tsx` — referenced the not-yet-existing
  `icon-file` glyph by id (`<Icon name="file" />`) rather than adding a
  stopgap symbol myself.
- Did not modify `useImageCompressor.ts`'s processing logic (only read the
  accepted-type pattern from it, duplicated as a constant per the plan's
  own instruction since the regex isn't exported).
- Left `main`/legacy static files (`index.html`/`app.js`/`styles.css`/
  `pdf.html`/`pdf.js`) untouched.
- No commits made; all changes left uncommitted in the working tree, on
  `nextjs-migration`.

## Integration pass (orchestrator, after all 3 agents landed)

Read all three reports above and ran the deploy-readiness checklist from
PLANNING_unified-upload.md section 5. Found and fixed the two open items
both Agent 1 and Agent 2 flagged:

1. **Reset-hook wiring was still broken even after Task 1 landed.** Task 1's
   `useUnifiedReset()`/`UnifiedResetContext.Provider` lived entirely inside
   `UnifiedApp.tsx`, but `SiteHeader` renders as a *sibling* of `{children}`
   in `layout.tsx`, not a descendant of `UnifiedApp` — so the context
   provider never actually wrapped `SiteHeader`, and `useUnifiedReset()`
   called there would always have returned `null`. Fixed by extracting the
   context into its own module,
   `src/components/UnifiedUpload/UnifiedResetContext.tsx`, with a
   `UnifiedResetProvider` mounted at the layout level (wrapping both
   `SiteHeader` and `{children}`) and a `registerReset()` call from
   `UnifiedApp` on mount/unmount to hand its page's real `resetAll` up to
   whichever provider instance is active. `SiteHeader.tsx` now calls
   `unifiedReset?.resetAll?.()` for real instead of the TODO-stubbed no-op.
2. **`.detected-chip-icon`'s stroke-draw-in animation didn't actually work
   correctly** for the icons it's used with. Task 3's `icon-check-draw`
   mechanism (stroke-dasharray/dashoffset on a `<use>` element) only reads
   correctly against a single continuous stroke path — exactly right for
   the checkmark it was built for, but `icon-image` and `icon-pdf` are
   composite symbols (filled circle, filled "PDF" text, several disjoint
   sub-paths), so one shared dasharray value across all of them drew
   unevenly rather than "confirmed, drawn-in." Replaced with a dedicated
   `detected-chip-icon-in` scale+fade spring pop (same
   `cubic-bezier(.34,1.56,.64,1)` arrival curve used elsewhere) — still an
   "arrival" moment, correctly reduced-motion-guarded, just not the
   draw-in technique specifically (that stays reserved for genuinely
   single-path icons).

Verified after both fixes: `npx tsc --noEmit` clean, `npm run build` clean
(both `/` and `/pdf` static routes). Restarted the dev server and
confirmed via curl content checks (screenshots skipped per user
instruction this session): `/` shows "Drop a file to get started" with
combined image+PDF JSON-LD description; `/pdf` shows the PDF-scoped "Drop
a PDF to get started" headline; header has no leftover `site-nav`
markup (confirmed via grep — the one "PDF toolkit" text match on `/` is
the unrelated "About the PDF toolkit" section heading, not a stray nav
link); both image and PDF About/FAQ sections render on `/`.

Not yet re-verified after these fixes: the 18 Playwright scenarios Agent 1
ran (image drop, PDF drop + inline grid, mixed drop, direct /pdf visit,
back-navigation, unsupported file) — those passed against Agent 1's
version of the code before this integration pass's two fixes landed.
Recommend re-running that suite (or equivalent manual passes) once more
before this is considered fully deploy-ready, since the reset-hook fix
touched layout.tsx (a file none of the three agents' scopes included) and
could theoretically interact with provider-ordering in ways worth
confirming live, even though tsc/build are clean.
