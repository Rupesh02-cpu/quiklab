# Build log: status page

Plan: `PLAN_status-page.md`. Owner decisions (2026-09-25): all six
recommended defaults accepted (GitHub Pages at status.quiklab.online, custom
monitor instead of Upptime, 5 min light + 60 min synthetic checks, add
`--warn` amber and `--partial` orange tokens, Atom feed only, no analytics).

## Shared contracts (orchestrator)

Status values: `operational | degraded | partial | major | maintenance | nodata`.
Severity order (worst last): nodata < operational < maintenance < degraded < partial < major.

Component ids and groups:
| id | group | name |
|---|---|---|
| website | QuikLab | Website |
| image | QuikLab | Image compressor |
| pdf | QuikLab | PDF toolkit |
| cdn | Infrastructure | jsDelivr CDN |
| dns | Infrastructure | DNS |
| email | Infrastructure | Email |

Data files on the `gh-pages` branch under `data/` (schemas in plan section 4):
`current.json`, `history.json`, `incidents.json`, `state.json` (monitor-private:
consecutive counters, last 24h raw checks). Feed at `feed.atom` (gh-pages root).

`history.json` shape:
```json
{ "updatedAt": "...", "components": { "website": [ { "date": "2026-09-24", "checks": 288, "failures": 0, "worst": "operational", "downMinutes": 0 } ] } }
```
(max 90 entries per component, oldest first).

`incidents.json` shape: `{ "updatedAt": "...", "incidents": [ { "id": 12, "title": "...", "status": "investigating|identified|monitoring|resolved", "impact": "degraded|partial|major|maintenance", "components": ["pdf"], "createdAt": "...", "resolvedAt": null, "url": "https://github.com/...", "kind": "incident|maintenance", "scheduledStart": null, "scheduledEnd": null, "updates": [ { "stage": "investigating", "body": "...", "at": "..." } ] } ] }` newest first.

Module interface (Task C writes, Task A calls), ESM, Node 20, built-in `fetch` only:
```js
// status/monitor/incidents.mjs
export async function reconcileAutoIncidents({ token, repo, components, now })
//   components: current.json components array (after status rules applied).
//   Opens an issue for any component at partial/major with no open auto incident,
//   comments "Resolved: ..." and closes auto incidents whose components are
//   all operational/degraded. Label auto issues `incident`, `auto`, `component:<id>`.
//   If token is falsy, no-op. Returns nothing.
export async function syncIncidents({ token, repo, since })
//   Reads issues labeled incident or maintenance (state all, since 90 days) and
//   their comments, returns the incidents.json object.
export function activeMaintenance(incidents, now)
//   Returns Set of component ids under an in-window maintenance notice.
// status/monitor/feed.mjs
export function buildAtomFeed(incidentsJson, { siteUrl })  // returns XML string
```

Workflows all use `concurrency: { group: status-gh-pages, cancel-in-progress: false }`
because they all push to `gh-pages`. Scheduled workflows only run from the
default branch (`main`), so these files must be merged to `main` to be active.

## Agent C report

Files created:
- `status/monitor/incidents.mjs`, `status/monitor/feed.mjs`
- `.github/ISSUE_TEMPLATE/incident.yml`, `.github/ISSUE_TEMPLATE/maintenance.yml`
- `.github/workflows/status-publish.yml`
- App link: `src/components/UnifiedUpload/UnifiedApp.tsx` footer gets `<p className="workspace-foot-links"><a href="https://status.quiklab.online">Status</a></p>` (same tab); CSS rule appended to end of `src/app/quiklab.css`. UnifiedApp's footer is the only one rendered on `/` and `/pdf` (ImageCompressorApp/PdfToolkitApp are mounted with `renderShell={false}`), so the link shows once per page.

Interface as implemented (matches the contract):
```js
// incidents.mjs
export async function reconcileAutoIncidents({ token, repo, components, now }) // no-op if !token
export async function syncIncidents({ token, repo, since })  // token optional; since defaults to now - 90 days
export function activeMaintenance(incidents, now)            // accepts the array OR the incidents.json object; returns Set<id>
// extras: export const COMPONENTS, export function parseFormBody(body)
// feed.mjs
export function buildAtomFeed(incidentsJson, { siteUrl })   // siteUrl defaults to https://status.quiklab.online
// extra: export function escapeXml(s)
```
Notes for Agent A:
- `components` items need `id` and `status`. For the issue body, failing check details are read from optional `component.checks[]` (`{ name|id, ok|status, detail|error|message }`, entries with `ok !== false`/`status === "operational"` skipped) and optional `component.detail|message|error`.
- Auto open: any component at `partial`/`major` with no open trusted issue labeled `incident`+`auto`+`component:<id>`. Title `"<Display name>: partial outage"` / `"...: major outage"`. Body starts `Investigating: Automated monitoring detected ...` then the failing check list.
- Escalation: if the component worsens (partial -> major) the `impact:*` label is swapped. It never de-escalates.
- Resolve: when every `component:*` of an open auto issue is `operational` or `degraded`, comments `Resolved: All checks passing again.` and closes it (`nodata`/`maintenance` keep it open).
- All thrown errors look like `GitHub API <METHOD> <url> returned <status>: <body excerpt>`; callers can catch.

incidents.json details: `updates` are newest first (matches Agent B fixtures). Manual incidents: first update is the form Description at `created_at` (stage `investigating`, or `identified` for maintenance). Trusted comments starting `Investigating:|Identified:|Monitoring:|Resolved:` (case-insensitive) become updates; others ignored. Closed without a Resolved comment adds a synthetic resolved update at `closed_at`. `status` is `resolved` if closed or a Resolved update exists, else the latest update stage. Only issues/comments by OWNER, MEMBER, COLLABORATOR or `github-actions[bot]` count; pull requests ignored. Maintenance impact is always `maintenance`; start/end parsed from "Start (UTC)" / "End (UTC)" (ISO 8601; a missing zone is treated as UTC). activeMaintenance window is `start <= now < end`, skipped once resolved.

Labels: `incident`, `maintenance`, `auto`, `component:website|image|pdf|cdn|dns|email`, `impact:degraded|partial|major`. Created on demand via POST /labels (422 ignored). Templates auto-apply `incident` / `maintenance`. Manual incident impact comes from the form dropdown (Degraded performance / Partial outage / Major outage) unless an `impact:*` label is present.

status-publish.yml: push to main on `status/site/**` + workflow_dispatch; `contents: write`; concurrency `status-gh-pages` (no cancel). Clones gh-pages (or inits an orphan), deletes everything except `.git`, `data/`, `feed.atom`, copies `status/site/.` in (including `CNAME` and `fixtures/`), adds `.nojekyll`, commits `status: publish site` as github-actions[bot], pushes with 5 attempts (fetch + rebase between). Note: feed.atom itself is written by the monitor (Agent A calls buildAtomFeed).

Tests (scratch `test-incidents.mjs`, mocked fetch): all PASS. Manual incident with 3 update comments + 1 chatter + 1 stranger Resolved (ignored), non-collaborator issue and PR ignored, closed-without-comment resolved at closed_at, maintenance in/out of window (end exclusive), auto open, no duplicate, escalate label swap, resolve+close, 500 error message. Atom with hostile title (`<b>`, quotes, `&`, control char) parsed OK by Python minidom plus a tag-balance check. Real unauthenticated `syncIncidents({ repo: "Rupesh02-cpu/quiklab" })` returned `{"updatedAt":"...","incidents":[]}`. `npx tsc --noEmit` clean, `npm run build` clean.

Manual steps for owner/orchestrator (not done here):
1. Merge to `main`, then run `status-publish` via workflow_dispatch once so `gh-pages` exists.
2. GitHub repo Settings > Pages > Build and deployment > Source: "Deploy from a branch", Branch `gh-pages`, folder `/ (root)`, Save.
3. Same page: Custom domain `status.quiklab.online`, Save (the `CNAME` file in status/site keeps it set across publishes). After the DNS check passes and the cert is issued, tick "Enforce HTTPS".
4. Hostinger DNS for quiklab.online: add ONLY `status  CNAME  rupesh02-cpu.github.io.` (TTL default). Do not touch existing A/CNAME/MX/TXT records.
5. Optional: Settings > Actions > General > Workflow permissions: ensure "Read and write" is allowed (workflows also declare `contents: write`; auto incidents need `issues: write` in Agent A's workflow).

## Agent B report

Status site frontend, static, no build step. All files under `status/site/`:
- `index.html`, `incident.html` (`?id=N`), `history.html`: shared header (QL logo to https://quiklab.online, "Subscribe to updates" panel with `feed.atom`, System/Light/Dark toggle on `quiklab-theme` with pre-paint inline script), footer ("Incident history", quiklab.online, "Checks run about every 5 minutes from GitHub Actions. Last updated ...").
- `status.css`: token blocks copied from `src/app/quiklab.css`, plus status tokens, motion (reuses `wizard-step-in`, `tool-card-in`, `icon-check-draw`, spring/settle curves), `prefers-reduced-motion` fallbacks.
- `js/common.js` (data loading, UTC formatting "Sep 24, 10:05 UTC", theme, subscribe), `js/index.js`, `js/incident.js`, `js/history.js`.
- `fixtures/current.json|history.json|incidents.json` (all states incl. nodata days, active incident #14, resolved 4-stage incident #12, maintenance #13). `?fixtures=1` reads `fixtures/` and is carried through internal links; default reads `data/`.
- `CNAME` (`status.quiklab.online`), `.nojekyll`.

Behavior: refresh every 60 s; only changed statuses/bars/banner get a cross-fade (`.xfade`). Missing or invalid `data/*.json` shows "Waiting for first check" (index) / "No incidents reported" (history) / "Incident data is not available yet" (incident). Note: before the monitor's first run the browser console logs the 404 for `data/*.json` (network log, not a JS error). Overall banner uses `current.overall`, falling back to the worst component status. Bars: 90 at >600px, 30 at <=600px (re-rendered on media change), days missing from history render as `nodata`; uptime % = sum(checks - failures)/sum(checks) over the shown window. Tooltip: hover, focus, Enter/Space toggle, Escape, tap toggle on touch; bars use roving tabindex (one tab stop per component, arrows/Home/End). Every bar has an aria-label like "Sep 24, 2026: operational, 100%". Past incidents: 15 days back from `current.updatedAt`.

Tokens added (fill color and status text color; hex, contrast vs --panel / --bg):
| token | light | dark |
|---|---|---|
| --warn (degraded) | #8F5E00 (5.57 / 5.06) | #E2B04A (8.86 / 9.52) |
| --partial (partial) | #B1470F (5.56 / 5.05) | #EE8B4F (7.10 / 7.62) |
| --maint (maintenance) | #4D6784 (5.85 / 5.32) | #93AAC6 (7.40 / 7.95) |
| --nodata (bar fill only) | #C9CED7 | #3A3530 |
| existing --good | #2D6E4E (6.08 / 5.53) | #7FBF9E (8.28 / 8.89) |
| existing --accent (major fill) | #C8331F (5.32 / 4.83) | #E4432B (4.32 / 4.64) |
| existing --accent-ink (major text) | #8F2415 (8.64 / 7.85) | #FF7A5C (6.88 / 7.39) |
Plus `-soft` tints (--warn-soft, --partial-soft, --maint-soft) for banners/pills, where text is --ink. Dark --accent is under 4.5 on panel, so "Major outage" text uses --accent-ink (via `--s-ink`); the red fill is only used for bars/dots (non-text, over 3:1).

Run locally: `cd status/site && python -m http.server 5055`, open `http://localhost:5055/?fixtures=1` (or without `?fixtures=1` to see the no-data state).

Tests (Playwright 1.63 script, DOM/text only, no screenshots): 68/68 pass. Covered: every state has a text label, all 6 bar states present, aria-labels, banner + active incidents, 90 bars at 1280 and 30 at 375, no horizontal overflow on all 3 pages at 375/768/1280, tooltip on hover (with linked incident), hide on leave, on focus, arrow navigation, Enter toggle, Escape, touch tap open/close, subscribe panel + Escape, theme cycle System>Light>Dark>System with localStorage and persistence across reload, dark via emulated prefers-color-scheme, reduced motion sets animation-name none, 60 s refresh (fake clock) cross-fades only the changed component and banner, incident page (4 stages, affected, maintenance window, unknown id), history by month, no-data state, contrast (above), zero console errors (fixtures mode). No em dashes in any file.

## Agent A report

Files created (all new, nothing committed):
- `status/monitor/package.json`, `status/monitor/package-lock.json` (type module; deps playwright 1.63, pdf-lib 1.17; used only by the synthetic workflow)
- `status/monitor/checks.mjs` light checks, Node built-ins only, 10 s timeouts
- `status/monitor/rules.mjs` component list, raw status, 2-run debounce, maintenance override, worst-of overall
- `status/monitor/history.mjs` daily aggregates (UTC, max 90 per component) and 24h raw log
- `status/monitor/synthetic.mjs` Playwright image compress + PDF merge flows
- `status/monitor/run.mjs` entry point
- `.github/workflows/status-monitor.yml` (cron `*/5 * * * *`), `.github/workflows/status-synthetic.yml` (cron `17 * * * *`), both with `workflow_dispatch` input `simulate` (none, website, image, pdf, cdn, dns, email), permissions contents/issues write, concurrency `status-gh-pages`.

CLI: `node status/monitor/run.mjs --mode light|synthetic --data <dir> [--simulate <id>] [--base <url>]`.
Reads/writes `<dir>/current.json`, `history.json`, `state.json`, `incidents.json` and `<dir>/../feed.atom`.
With `GITHUB_TOKEN` set it calls C's `reconcileAutoIncidents` then `syncIncidents`
(errors are logged and the previous incidents.json is kept); without a token it
skips GitHub and keeps incidents.json. `activeMaintenance` and `buildAtomFeed` run
either way. Both modules are imported dynamically, so the monitor still runs if they are missing.

Checks per component:
- website: GET `/` and `/pdf`, 200 + marker `QuikLab`, slow if over 3000 ms
- pdf: GET `/pdf.worker.min.js` (light) + `pdf-synthetic` (merge two generated PDFs)
- image: `image-synthetic` only (generated noisy PNG, Compress images, wait for Download)
- cdn: GET `https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js`
- dns: A for quiklab.online; any known Vercel range (76.76.21.x, 66.33.60.x, 216.198.79.x, 64.29.17.x) = ok, other IP = degraded, lookup failure = major. DNS/MX always target quiklab.online, even with `--base`.
- email: MX includes mx1 and mx2.hostinger.com (one of them = degraded)

Rules: raw status per run (all checks fail = major, some = partial, a warn or a slow check = degraded). A change takes effect only after 2 consecutive runs in the same class (good vs bad); for two different bad runs the milder wins. First ever run shows good results immediately and holds bad ones. Maintenance overrides. Light mode evaluates website, pdf, cdn, dns, email; synthetic mode evaluates image and pdf. The pdf light evaluation includes the cached synthetic result (under 3 h old) only once the synthetic failure has repeated, so one synthetic blip does not get confirmed by light runs. Synthetic slow threshold: 45 s.

Contract additions (additive, please tolerate): each `current.json` component also has `checks: [{ name, ok, level, ms, detail }]` (C's `failingDetails` reads this for the issue body). `responseMs` is the slowest check of that component, null for DNS-free cases with no timing. history: `failures` counts runs whose effective status is partial or major; `downMinutes` adds 5 (light) or 60 (synthetic) per major run; image only gets about 24 checks per day.

Testing (real results, 2026-09-25, temp data dirs in the scratchpad, no token):
- Light x2, then `--simulate pdf` x2, then light x2 against production: pdf went operational, operational (held), major, then held major one recovery run, then operational. history.json pdf day: checks 6, failures 2, worst major, downMinutes 10. Shapes match the contract.
- Synthetic against a fresh `next start -p 3101` of the current build (new unified UI): image 3.4 s, pdf 3.6 s, pass (twice). Against https://quiklab.online: pass (image 3.1 s, pdf 3.5 s). `--simulate image` x2 in synthetic mode: operational then major.
- The server already on :3100 serves a stale build (its JS chunks return 404, so the page never hydrates and uploads do nothing). Synthetic correctly reported `Failed at "click Compress"` / `Failed at "upload PDFs and pick Merge"` there. I tested on :3101 instead and stopped it afterwards.
- Production already runs the unified UI, so the old grid-first branch in synthetic.mjs (tool grid visible first: pick Merge, then upload) was not exercised live.

Findings and caveats for the orchestrator:
1. IMPORTANT: quiklab.online nameservers are currently `ns1/ns2.vercel-dns.com` (checked via 8.8.8.8 and 1.1.1.1), NOT Hostinger, and there are NO MX records (ENODATA from every resolver). So email to support@quiklab.online is likely broken right now, and the `email` component will show major outage. Records added through the Hostinger DNS API (Task C's `status` CNAME) will not be served while Vercel DNS is authoritative. HANDOFF section 7 says the owner wants DNS at Hostinger; someone changed the nameservers or HANDOFF is out of date. Owner decision needed.
2. The A record is 216.198.79.1 / 64.29.17.x (Vercel's newer IPs), not 76.76.21.21, so the DNS check accepts all known Vercel ranges.
3. Root `.gitignore` has `/node_modules` (root only), so `status/monitor/node_modules` is NOT ignored. I removed my local install; add `node_modules/` or `status/monitor/node_modules` to .gitignore before anyone runs npm install there.
4. The workflows create gh-pages as an orphan via `git worktree add --orphan` (needs git 2.42+, fine on ubuntu-latest) if it does not exist. Task C's publish workflow and these can both create it; whichever runs first wins, the other rebases.
5. Scheduled workflows only run from `main`.
