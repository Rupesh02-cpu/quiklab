# QuikLab analytics: Clarity + GA4 reference

Working notes for whoever (or whichever session) picks up analytics work next.
This is a reference doc, not code. Nothing here is wired to the build.

## What's already live in the app

Both are wired in `src/app/layout.tsx` via `next/script` (`strategy="afterInteractive"`),
ported straight from the original static site's inline `<script>` tags:

- **GA4 (gtag.js)**, property `G-43T0WZB3Z0`. Loaded globally, `gtag('config', ...)`
  called once at layout level. Custom events are fired via a small `track()` helper
  duplicated in both hooks:
  - `src/hooks/useImageCompressor.ts:16` → `track()` → events: `upload_images`,
    `compress_images`, `download_image`, `download_all_zip`
  - `src/hooks/usePdfToolkit.ts:19` → `track()` → events: `pdf_tool_open`, `pdf_tool_run`
  - `track()` just calls `window.gtag('event', name, params)` if `gtag` exists on
    `window`, and is a no-op otherwise (e.g. if the script hasn't loaded yet, or is blocked).
  - **Known duplication**: the `track()` function is copy-pasted in both hooks
    instead of shared from `src/lib/`. Worth extracting to `src/lib/analytics.ts`
    if you're touching this area anyway.

- **Microsoft Clarity**, project id `yl6fc10ssr`, dashboard at clarity.microsoft.com.
  Loaded the same way (inline script snippet in `layout.tsx`, `afterInteractive`).
  Clarity does session-replay/heatmaps of the **interface only**: clicks, scroll,
  DOM structure. It has no access to image/PDF file contents or anything drawn to
  `<canvas>`, since those never leave the browser tab in the first place (that's
  the whole privacy premise of this app; see `CLAUDE.md`).
  - `.clarity-mask` class exists on some elements (e.g. filenames in the image
    compressor's Frame component) to explicitly exclude that text from Clarity's
    recordings, since filenames can be personally identifying.
  - Clarity is a no-op on non-production hosts (e.g. a hosted preview link) because
    the CSP there blocks `www.clarity.ms`. This was flagged in `CLAUDE.md`, not a bug.

## What's NOT wired (API access, for pulling/analyzing data programmatically)

Earlier in this project's history, API-level access was set up (not from this
codebase; credentials were handled out-of-band in chat, not committed):

- **GA4 Data API**: read access via a Google Cloud **service account** JSON
  credential plus the numeric GA4 Property ID. This lets you query GA4 data
  programmatically (e.g. via `@google-analytics/data` npm package or the REST API)
  instead of only viewing it in the GA4 web dashboard. The service account needs to
  be added as a "Viewer" on the GA4 property (Admin → Property Access Management)
  for the API calls to succeed.
- **Microsoft Clarity Data Export API**: a bearer JWT token was used to pull
  session/heatmap data via Clarity's REST API (`https://www.clarity.ms/export-data/api/v1/project-live-insights`
  or similar; check Clarity's current API docs, this evolves). Clarity's API is
  more limited than GA4's: it exposes aggregate insights, not raw event-level
  data.

**Neither credential is stored in this repo.** That's by design, since committing
API keys/service-account JSON to git is a real leak risk. If you pick this up
again, you'll need to regenerate/re-obtain:
1. A GA4 service account JSON (Google Cloud Console → IAM → Service Accounts →
   create key → grant it Viewer on the GA4 property in GA4 Admin).
2. A fresh Clarity bearer token (Clarity dashboard → Settings → Data Export API).

Treat both as secrets. Don't paste them into chat if you can avoid it (screenshots
or a local `.env.local`, already gitignored, are safer), and rotate immediately
if one does end up pasted somewhere it shouldn't.

## Ideas for what to actually build with this access

Not started, just documented as options since the request to work on this was
open-ended:

1. **A simple internal analytics dashboard.** Pull GA4 event counts (compress,
   download, pdf_tool_run broken out by tool) plus Clarity's rage-click/dead-click
   insights into one page, so usage patterns are visible without jumping between
   two external dashboards.
2. **Event coverage audit.** The PDF toolkit only tracks `pdf_tool_open` and
   `pdf_tool_run` (tool-level), not per-operation outcomes. For example, it doesn't
   distinguish a successful merge from a failed one, or track `pdf_download`
   the way the image compressor tracks `download_image`/`download_all_zip`.
   Worth deciding if that's intentional or a gap.
3. **Extract the duplicated `track()` helper** into `src/lib/analytics.ts` so
   there's one place to add new events or swap analytics providers later.
4. **A "top failure reasons" report.** Both hooks `console.error()` on failure
   but don't currently send failures to GA4 as their own event. Could add a
   `pdf_tool_error` / `compress_error` event with just the tool/error-type (no
   file contents) to see what's actually breaking for real users.

## Where to look in the code

- `src/app/layout.tsx`: both scripts' setup (search for "Google tag" and
  "Microsoft Clarity")
- `src/hooks/useImageCompressor.ts` / `src/hooks/usePdfToolkit.ts`: the `track()`
  calls and what events currently exist
- `CLAUDE.md`: the privacy/analytics section explaining the "images/PDFs never
  leave the tab" boundary that any analytics work here must not cross

## Verified status (re-checked against the live codebase, not assumed)

- This file is a **reference doc, not code**: nothing in it is wired to the build.
  Reading it won't mislead anyone into thinking a dashboard already exists.
- The four ideas above are genuinely **not started**. Confirmed directly:
  `src/lib/analytics.ts` does not exist in the repo, so idea 3 (extracting the
  duplicated `track()` helper) is still fully open, not partially done.
- **Credential blocker, worth flagging explicitly**: the GA4 service-account JSON
  and the Clarity bearer token mentioned above as "handled out-of-band in chat"
  are gone. Neither is recoverable from this session or this repo. If idea 1
  (the API-pulling dashboard) is the goal, someone has to regenerate both first:
  - GA4: Google Cloud Console → IAM → Service Accounts → create key → grant it
    Viewer on the GA4 property in GA4 Admin.
  - Clarity: Clarity dashboard → Settings → Data Export API.

### Recommended next step, in order

Nothing here is broken; this is a planning doc for optional future work, not a
bug list. Of the four ideas, two need no credentials and can start immediately:

1. **Extract `track()` into `src/lib/analytics.ts`.** Quick, safe, no secrets
   involved. Removes the duplication between the two hooks.
2. **Add the missing PDF toolkit events** (`pdf_download`, `pdf_tool_error`).
   Also quick, also no secrets needed. Brings PDF toolkit tracking up to the
   same coverage the image compressor already has.
3. **Build the actual API-pulling dashboard (idea 1).** Blocked until both
   credentials above are regenerated and dropped into a local `.env.local`
   (already gitignored, never commit it).

Do 1 and 2 first regardless of whether the dashboard happens, since they're
self-contained and make the eventual dashboard work easier either way.

## "Clarity isn't showing anything" (troubleshooting)

If the Clarity dashboard (clarity.microsoft.com) looks empty or isn't updating,
it's very unlikely to be a fonts/assets/CDN problem. `next/font/google` (used
for Inter and IBM Plex Mono, see `src/app/layout.tsx`) **self-hosts** the font
files at build time: they're downloaded once during `next build` and served
from your own domain (`/​_next/static/...`), not fetched live from
`fonts.googleapis.com` on every visit. Same for the icon sprite: it's inline
SVG in `IconSprite.tsx`, part of the HTML itself, not a separate asset request.
Neither depends on reaching any Google CDN at runtime, so neither can be why
Clarity looks empty. They're unrelated systems: fonts/icons render regardless
of whether Clarity's own script loads or reports anything.

The actual script tag (`src/app/layout.tsx`, search "Microsoft Clarity") is
confirmed still correctly wired with project id `yl6fc10ssr`, unchanged by any
UI/font work done in this session. If the dashboard looks empty, check instead:

1. **Testing on `localhost`.** Clarity sessions from `localhost`/`127.0.0.1`
   may be filtered, delayed, or excluded depending on the project's domain
   settings. Test against the real deployed domain (quiklab.online) to be sure.
2. **An ad-blocker or privacy extension.** `www.clarity.ms` is a common target
   for uBlock Origin, Brave Shields, Privacy Badger, etc. Try an incognito
   window with no extensions.
3. **Dashboard processing lag.** Clarity doesn't always show session
   recordings instantly. Give it a few minutes to a few hours after a real
   visit before assuming it isn't tracking.
4. **Browser DevTools check.** Open Network tab, filter for "clarity", reload
   the page. If a request to `clarity.ms/collect` (or similar) fires with a
   2xx response, the tracking call itself is working and the gap is on
   Clarity's dashboard side, not the site's.

## Full credential/setup reference (for regenerating access)

Everything below is what existed before, spelled out in one place so nothing
has to be reconstructed from memory:

- **GA4 property**: `G-43T0WZB3Z0` (this is the public measurement ID, already
  visible in the page source; not a secret by itself). To get API read access
  beyond the public dashboard, create a Google Cloud service account, generate
  a JSON key for it, then in **GA4 Admin → Property Access Management**, add
  that service account's email as a **Viewer** on the property. The resulting
  JSON key file is the actual secret; keep it out of git (a local
  `.env.local`, already gitignored, or a secrets manager).
- **Clarity project**: `yl6fc10ssr` (also public, visible in page source). For
  API export access, go to the Clarity dashboard → **Settings → Data Export
  API**, generate a bearer token there. That token is the secret.
- Both IDs above being public is normal and not a leak. It's the **service
  account JSON** and the **bearer token** that must never be committed or
  pasted somewhere persistent.
