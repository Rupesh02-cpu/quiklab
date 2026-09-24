# Plan: QuikLab status page (like status.claude.com)

Read `HANDOFF.md` first for project context, credentials, design system,
deploy procedure, and the multi-agent working pattern. This file is the
planning doc for the status page feature and follows the same format as
`PLANNING_unified-upload.md`: decisions, architecture, spec, task split,
verification. Build agents append reports to `BUILD_LOG_status-page.md`
(create it when work starts).

Status: planned, not started. Decisions marked "Recommended" still need a
quick yes from the owner (see section 10) before building.

---

## 1. Reference: what Claude's status page has

status.claude.com (Atlassian Statuspage) shows:
- Overall banner: "All Systems Operational", or the worst active state.
- Component list (claude.ai, Console, API, Claude Code, ...), each with a
  current status and a 90-day uptime bar (one bar per day) plus an uptime
  percentage. Colors: green operational, yellow degraded performance,
  orange partial outage, red major outage. Hovering a day shows that day's
  incidents.
- Past incidents grouped by date, each with a title, status badge, and an
  update timeline: Investigating, Identified, Monitoring, Resolved, with UTC
  timestamps.
- Incident history page and per-incident pages.
- Subscribe: email, SMS, Slack, Teams, webhook, Atom/RSS.
- Scheduled maintenance notices.

QuikLab v1 should match the layout and behavior of all of that except the
heavier subscription channels (see section 8).

## 2. What "up" means for a client-side app (the key design point)

QuikLab does all processing in the browser, so an HTTP 200 on `/` does not
prove the product works. Two real incidents from this project show why:
- After the Next.js launch, Vercel returned a platform 404 on every page
  while the deployment itself reported READY (framework preset was wrong).
- A Clarity recording showed a visitor getting unstyled giant icons because
  the stylesheet loaded late.

So monitoring has two layers:
1. Lightweight checks every 5 minutes: HTTP status, a content marker in the
   HTML, response time, key static assets, DNS.
2. A synthetic browser check every hour: headless Chromium actually drops a
   generated image and compresses it, and merges two generated PDFs, then
   asserts the result exists. This is the check that proves the tools work.
   It uses generated fixture files only, never user data.

## 3. Components to show

| Component | Checks behind it |
|---|---|
| Website (quiklab.online) | GET `/` and `/pdf`: 200, content marker present, response time |
| Image compressor | Synthetic: drop PNG at `/`, compress, result frame appears with a size smaller than input |
| PDF toolkit | Synthetic: drop two PDFs, merge, result panel appears; plus GET `/pdf.worker.min.js` 200 |
| Third-party: jsDelivr CDN | GET gif.js on cdn.jsdelivr.net 200 (animated GIF support depends on it) |
| DNS | `quiklab.online` A record resolves to a Vercel IP |
| Email (support@quiklab.online) | MX records present and pointing at Hostinger |

Group them like Claude does: "QuikLab" (Website, Image compressor, PDF
toolkit) and "Infrastructure" (CDN, DNS, Email).

Status rules (to avoid flapping on one-off blips):
- Operational: last checks pass.
- Degraded: response time over a threshold (for example 3 s) for 2+
  consecutive checks, or a synthetic check slower than expected.
- Partial outage: some checks for the component fail (for example `/pdf`
  down but `/` up) for 2+ consecutive runs.
- Major outage: all checks for the component fail for 2+ consecutive runs.
- Maintenance: an open maintenance notice covers the component.

## 4. Architecture

### Where it is hosted: separate infrastructure (Recommended)

A status page on the same Vercel deployment goes down together with the
site, which is exactly when people need it. Claude avoids this by hosting
the status page on Atlassian's infrastructure. QuikLab should do the same.

Recommended: `status.quiklab.online` served by GitHub Pages from this repo,
monitored by GitHub Actions. Independent of Vercel, free for a public repo
(unlimited Actions minutes), no backend, no database.

Rejected alternatives:
- `/status` route inside the Next.js app: dies with the site; also needs
  live data without a rebuild.
- Vercel Cron + KV/Upstash: adds server functions and a database to a
  deliberately serverless app, and still shares Vercel as a single point of
  failure.
- Hosted services (Atlassian Statuspage, Instatus, BetterStack): fastest,
  but the design would not match QuikLab and free tiers are limited. Worth
  mentioning to the owner as the quick option if speed matters more than
  custom design.
- Upptime (open source, github.com/upptime/upptime) does GitHub Actions
  monitoring + GitHub Pages + issue-based incidents already. Option: use its
  monitoring engine and write our own frontend. Decision for the build
  session: evaluate Upptime first (about 30 minutes); if its synthetic
  (Playwright) check support and data format fit, reuse it; otherwise build
  the small custom monitor described below. The custom version is not large.

### Moving parts

```
GitHub Actions (cron)
  status-monitor.yml   every 5 min: HTTP, asset, DNS checks
  status-synthetic.yml every 60 min: Playwright tool checks
        |
        |  writes JSON, opens/updates/closes GitHub issues
        v
gh-pages branch
  /index.html, /incident.html, /history.html, /assets/*   (static site, rarely changes)
  /data/current.json      latest status per component
  /data/history.json      90 days of daily aggregates per component
  /data/incidents.json    incidents synced from GitHub issues
  /feed.atom              Atom feed of incidents
        |
        v
GitHub Pages at status.quiklab.online  (CNAME record at Hostinger)
  page fetches /data/*.json from its own origin on load and every 60 s
```

The frontend is plain static HTML, CSS, and vanilla JS modules with no build
step. It is a small page, and keeping it outside the Next.js app avoids
coupling it to that build and to the Vercel deploy. Put its source in
`status/site/` and the monitor scripts in `status/monitor/` (use `.mjs`, not
`.ts`, so the root `tsconfig.json` does not pick them up; if any `.ts` is
added, add `status/` to the root tsconfig `exclude`). A publish step in the
workflow copies `status/site/` to the `gh-pages` branch. Data files are
written by the monitor and never touched by the site publish step.

GitHub Actions cron caveats: the minimum interval is 5 minutes and runs are
often delayed several minutes under load. That is acceptable for a
status page; document it on the page ("checks run about every 5 minutes").
Scheduled workflows are disabled after 60 days without repo activity on
public repos; the monitor committing data counts as activity.

### Data model

`current.json`
```json
{
  "updatedAt": "2026-09-24T10:05:00Z",
  "overall": "operational",
  "components": [
    { "id": "website", "group": "QuikLab", "name": "Website",
      "status": "operational", "responseMs": 212, "lastCheck": "..." }
  ]
}
```

`history.json`: per component, 90 entries of
`{ "date": "2026-09-24", "checks": 288, "failures": 0, "worst": "operational", "downMinutes": 0 }`.
Uptime % = (checks - failures) / checks over the window. Keep raw check
results only for the last 24 hours (for response time sparklines if wanted);
older data is aggregated daily so the file stays small.

`incidents.json`: array of
`{ id, title, status, impact, components[], createdAt, resolvedAt,
   updates: [{ stage, body, at }] }`
where `stage` is one of investigating, identified, monitoring, resolved.

## 5. Incidents and maintenance

Use GitHub Issues as the incident store (same idea as Upptime):
- Automatic: when a component reaches partial or major outage, the monitor
  opens an issue labeled `incident` plus `component:<id>`, first update
  "Investigating: <check that failed>". When checks recover for 2+ runs it
  comments "Resolved" and closes the issue.
- Manual: the owner can open an issue from an `incident` issue template
  (component checkboxes, impact level) and post updates as comments that
  start with `Investigating:`, `Identified:`, `Monitoring:`, or `Resolved:`.
- Maintenance: issue label `maintenance` with start and end times in the
  body (template provides fields).
- The monitor workflow syncs issues into `incidents.json` each run using the
  built-in `GITHUB_TOKEN` (needs `issues: write`, `contents: write`
  permissions). No extra secrets.

## 6. Status page UI spec

Match the existing QuikLab design system (see HANDOFF.md section 4). Copy
the `:root` and dark-theme token blocks from `src/app/quiklab.css` into
`status/site/status.css` so colors, fonts, and spacing are identical. Load
Inter and IBM Plex Mono from Google Fonts or self-host the same files.

New tokens needed (the owner asked not to change the palette, so keep these
minimal and confirm them): `--warn` (amber, degraded) and `--partial`
(orange, partial outage). Operational uses the existing `--good` green;
major outage uses the existing `--accent` red; maintenance uses a muted
neutral or blue. Provide light and dark values for each.

Page structure (index):
1. Header: QuikLab logo linking to https://quiklab.online, "Subscribe to
   updates" button on the right (opens a small panel with the Atom feed link
   in v1).
2. Overall banner: large, full-width, colored by overall state. "All systems
   operational" with a check icon, or the worst state with a short summary.
   Active incidents appear directly under it with their latest update.
3. Components: grouped list. Each row: name, current status label, then the
   90-day bar (90 thin bars, each colored by that day's worst state, gray
   for days with no data), "90 days ago" and "Today" labels, uptime % in
   Plex Mono. Hover or tap a bar: tooltip with date, uptime for the day,
   and linked incidents. On narrow screens show 30 days instead of 90.
4. Past incidents: last 15 days, grouped by date, "No incidents reported"
   for quiet days, each incident showing title, impact color, and its
   update timeline with UTC timestamps.
5. Footer: "Incident history" link, link back to quiklab.online, "Checks run
   about every 5 minutes from GitHub Actions", last-updated time.

Other pages: `incident.html?id=<n>` (full timeline), `history.html` (all
incidents by month).

Motion (same conventions as the main app): bars stagger in on load,
banner eases in, status changes cross-fade on the 60 s refresh, tooltip
uses the settle curve, everything has a `prefers-reduced-motion` fallback.
Respect `prefers-color-scheme` plus a theme toggle stored in
`localStorage` under the same `quiklab-theme` key the main site uses.

Accessibility: status must not be color-only. Every bar and badge has a
text label or `aria-label` ("Sept 24: operational, 100%"), tooltips are
keyboard reachable, contrast checked in both themes.

## 7. Link from the main app

Add a small "Status" link to the main app (workspace footer next to the
privacy note is a good spot), pointing at https://status.quiklab.online.
This is the only change inside the Next.js app.

## 8. Subscriptions

- v1: Atom feed (`/feed.atom`) generated by the monitor from
  `incidents.json`. RSS readers and Slack's RSS app can consume it, which
  covers most of Claude's list for free.
- v2 (later, needs owner decision): email alerts sent from
  `support@quiklab.online` via Hostinger SMTP, with the SMTP password stored
  as a GitHub Actions secret and a subscriber list somewhere. This needs a
  double opt-in flow and an unsubscribe link, and storing subscriber emails
  is a privacy decision for a privacy-branded product. Not in v1.
- Owner alerting (v1, cheap): the monitor opening a GitHub issue already
  emails the repo owner through GitHub notifications.

## 9. Build task split (for parallel agents)

Each task owns distinct files. Agents append `## Agent N report` to
`BUILD_LOG_status-page.md`.

### Task A: Monitor
Owns `status/monitor/**` and `.github/workflows/status-monitor.yml`,
`.github/workflows/status-synthetic.yml`.
- HTTP, asset, DNS, MX checks (Node, no dependencies beyond built-ins where
  possible; `dns/promises` for DNS).
- Synthetic Playwright checks (`npx playwright install chromium` in the
  workflow), generating PNG and PDF fixtures at runtime (pdf-lib is already a
  dependency; the unified upload page and wizard are the flow to drive).
  After the unified upload deploy, the flows are: drop file at `/`, image
  goes straight to Configure; PDF shows the tool grid, pick Merge.
- Status rules from section 3, writing `current.json` and updating
  `history.json` aggregates, committing to `gh-pages` under `data/`.
- Workflow inputs for testing: `workflow_dispatch` with an optional
  "simulate failure for component X" input.
Must not touch the Next.js app or `status/site/`.

### Task B: Status site frontend
Owns `status/site/**`.
- index, incident, history pages per section 6, reading `data/*.json`.
- Ships with `status/site/fixtures/` sample data covering every state
  (operational, degraded, partial, major, maintenance, no data) for local
  testing with a query flag like `?fixtures=1`.
- Serve locally with any static server (`npx serve status/site`) for
  Playwright checks.
Must not touch the monitor or the Next.js app.

### Task C: Incidents, feed, publishing, DNS, app link
Owns `.github/ISSUE_TEMPLATE/incident.yml`,
`.github/ISSUE_TEMPLATE/maintenance.yml`, `status/monitor/incidents.mjs`
(coordinate with Task A: A calls it, C writes it), `status/monitor/feed.mjs`,
`.github/workflows/status-publish.yml` (copies `status/site/` to `gh-pages`
without touching `data/`), GitHub Pages setup, the `status` CNAME record at
Hostinger, and the one-line "Status" link in the main app footer.
- GitHub Pages: enable on `gh-pages` branch with custom domain
  `status.quiklab.online` and HTTPS. Check `gh auth status` first; if the gh
  CLI is not authenticated, give the owner exact click steps instead.
- DNS: add `status CNAME rupesh02-cpu.github.io.` via the Hostinger DNS API
  (`HOSTINGER_API_TOKEN`). Add only; do not modify the existing A, CNAME, MX,
  TXT records (listed in HANDOFF.md section 7).

### Integration and deploy (orchestrator)
- Run each workflow via `workflow_dispatch`, confirm data files land on
  `gh-pages` and the page shows real data at status.quiklab.online.
- Simulate an outage with the dispatch input: confirm the bar turns
  orange/red, an issue opens with the incident label, `incidents.json` and
  the feed update, then recovery closes it.
- Deploy the main app "Status" link via the normal procedure (HANDOFF.md
  section 5). This can ship together with the pending unified upload deploy.

## 10. Questions for the owner (with recommended defaults)

1. Host on `status.quiklab.online` via GitHub Pages? Recommended: yes (stays
   up when the site is down).
2. Custom build vs Upptime vs a hosted service? Recommended: evaluate
   Upptime for the monitor, custom frontend either way.
3. Check frequency: 5 min light checks, 60 min synthetic? Recommended: yes.
4. Add amber and orange status tokens? Recommended: yes, minimal.
5. Email subscriptions in v1? Recommended: no, Atom feed only in v1.
6. Analytics on the status page? Recommended: none, keeps it light and
   privacy-clean. If wanted, reuse the same GA4 tag.

## 11. Verification checklist

- Fixture mode renders every state correctly in light and dark, at 375px,
  768px, desktop; 30-day bars on mobile, 90 on desktop.
- Tooltips work with mouse, touch, and keyboard; status is readable without
  color.
- `prefers-reduced-motion` stops the stagger and cross-fades.
- Real run: data refreshes on the live page within about a minute of a
  workflow run without a redeploy.
- Simulated outage opens and closes an incident end to end, and the Atom
  feed validates.
- The main Next.js app still passes `tsc` and `build` (the only change there
  is the footer link), and nothing under `status/` is picked up by the root
  tsconfig or eslint.
- Kill test: temporarily make the main site unreachable in a check (dispatch
  input) and confirm the status page itself stays reachable and reports it.
