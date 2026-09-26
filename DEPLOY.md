# QuikLab: source map and deploy runbook

Point a new session at this file ("read DEPLOY.md and deploy") and it has
everything needed to find the code, run it, and ship it. For project history,
design rules, and owner preferences see `HANDOFF.md`.

Last verified: 2026-09-26.

---

## 1. What gets deployed

Two sites, one repo (`github.com/Rupesh02-cpu/quiklab`, public), both on Vercel,
both auto-deploy on every push to `main`:

| Site | URL | Vercel project | Root dir | Source |
|---|---|---|---|---|
| Main app (Next.js) | https://quiklab.online | `quiklab` `prj_NGYOIv7wyBN82FbUvAhbWmtIkxdZ` | repo root | `src/` |
| Status page (static HTML/JS) | https://status.quiklab.online | `quiklab-status` `prj_4ryLpXpQiGcXo1nGI9hCW536d2z3` | `status/site` | `status/site/` |

Vercel team id: `team_TtG3rQS3mDRwxoS4Vm1vcQBN`.

Plus GitHub Actions (no deploy step needed, they run from `main`):
- `status-monitor.yml`: every 5 min, HTTP/asset/DNS checks.
- `status-synthetic.yml`: hourly at :17, headless browser really compresses an
  image and merges PDFs.
- `status-publish.yml`: on push to `main`.
Monitor results are committed to the `gh-pages` branch (`data/*.json`,
`feed.atom`). The status site does not host that data itself: its
`status/site/vercel.json` rewrites `/data/*` and `/feed.atom` to
`raw.githubusercontent.com/.../gh-pages/...`, and disables Vercel deploys for
the `gh-pages` branch. So new monitor data shows up live without redeploying.

## 2. Source map

```
src/app/                 Next.js App Router
  layout.tsx             fonts, theme pre-paint script, GA4/AdSense/Clarity,
                         UnifiedResetProvider, SiteHeader, ToastProvider
  page.tsx               "/"    unified drop zone (image or PDF, auto-detect)
  pdf/page.tsx           "/pdf" same component, PDF-scoped (kept for SEO)
  quiklab.css            the one stylesheet: tokens, light/dark, all motion
src/components/
  UnifiedUpload/         entry point: detect file type, route to a tool,
                         reset context used by the header logo
  ImageCompressor/       image tool UI (wizard: Upload > Configure > Result)
  PdfToolkit/            PDF tool grid + 8 tools incl. "Add text & links"
  SiteHeader, Stepper, ThemeToggle, ToastProvider, AmbientBackground,
  PageTransition, Icon, IconSprite
src/hooks/               useImageCompressor, usePdfToolkit, useTheme
                         (all state + stale-async guards live here)
src/lib/                 pure processing: imageProcessing, gifDecoder,
                         gifEncode, pdfProcessing, pdfEditor, pdfTypes, format
public/                  static assets incl. pdf.worker.min.js (copy of
                         node_modules/pdfjs-dist/build/pdf.worker.min.js)
next.config.ts           aliases pdfjs-dist's optional `canvas` dep away
status/site/             status page: index/incident/history.html, js/,
                         status.css, fixtures/ (sample data), vercel.json
status/monitor/          Node check scripts used by the Actions workflows
.github/workflows/       status-monitor, status-synthetic, status-publish
.github/ISSUE_TEMPLATE/  incident + maintenance templates (incidents are
                         GitHub issues labeled `incident`)
scripts/                 ga4-usage-report.mjs, ga4-non-india-24h.mjs
```

Legacy files at repo root (`index.html`, `app.js`, `styles.css`, `pdf.html`,
`pdf.js`, `test/`) are the old static site. Unused. Do not edit.

Everything the user touches runs in the browser. Never add server code that
receives user files.

## 3. Run locally

```bash
npm install
npm run dev                      # main app at http://localhost:3000
npx serve status/site            # status page; add ?fixtures=1 for sample data
```

Port 3000 busy from a stale server (Windows):
```bash
netstat -ano | grep ":3000 " | grep LISTENING   # last column is the PID
taskkill //PID <pid> //F
```

## 4. Branches

- `main` = production. Pushing to it deploys both sites.
- `nextjs-migration` = working branch. Do work here, merge to `main` to ship.

## 5. Deploy (exact steps)

### 5.1 Verify on the working branch
```bash
git checkout nextjs-migration
npx tsc --noEmit                 # must print nothing
npm run build                    # must end with "/" and "/pdf" as ○ Static
```
Then test the real flows in a browser (Playwright, text assertions, no
screenshots): drop an image at `/` -> Configure -> compress -> Result; drop a
PDF -> 8-tool grid -> Merge opens with the file preloaded; mixed drop shows the
switch chip; unsupported file shows a toast; logo click resets without reload;
`/pdf` direct works. Test fixtures go in `.playwright-mcp/testassets/`
(gitignored); Playwright MCP can only upload files from inside the repo.

### 5.2 Commit and push the branch
Stage specific files (other sessions may have uncommitted work in the tree),
check nothing secret is staged, commit, push:
```bash
git add <files>
git diff --cached | grep -nE "vcp_|eyJhbGci|PRIVATE KEY" || echo clean
git commit -m "..."              # end with the Co-Authored-By line the session gives
git push origin nextjs-migration
```

### 5.3 Merge to main in a throwaway worktree
Keeps the working tree untouched:
```bash
git fetch origin
git worktree add ../quiklab-main-merge main
cd ../quiklab-main-merge
git pull origin main
git merge nextjs-migration --no-ff -m "Merge nextjs-migration: <what>"
npm install && npm run build     # takes a few minutes; must succeed
git push origin main
cd ../Quiklab
git worktree remove ../quiklab-main-merge --force
```
Notes: in a fresh worktree `tsc` complains about `LayoutProps` until
`next-env.d.ts` is generated by the build; that is expected. If `next build`
says another build is running, wait for it.

### 5.4 Confirm Vercel shipped it
```bash
T=$(grep "^VERCEL_TOKEN=" .env.local | cut -d= -f2)
curl -s "https://api.vercel.com/v6/deployments?projectId=prj_NGYOIv7wyBN82FbUvAhbWmtIkxdZ&teamId=team_TtG3rQS3mDRwxoS4Vm1vcQBN&target=production&limit=1" \
  -H "Authorization: Bearer $T" | python3 -c "import json,sys;d=json.load(sys.stdin)['deployments'][0];print(d['meta'].get('githubCommitSha','')[:7],d['readyState'],d.get('readySubstate'))"
```
Expect the merge commit's short sha, `READY`, `PROMOTED` (poll every ~10 s,
builds take 1-2 min). For the status site use project id
`prj_4ryLpXpQiGcXo1nGI9hCW536d2z3`.

Then check live content (cache-bust):
```bash
curl -s "https://quiklab.online/?x=$(date +%s)" | grep -o "Drop a file to get started"
curl -s -o /dev/null -w "%{http_code}\n" "https://quiklab.online/pdf?x=$(date +%s)"
curl -s -o /dev/null -w "%{http_code}\n" "https://status.quiklab.online/"
```

### 5.5 If it breaks
- Deploy READY but every page 404s with `X-Vercel-Error: NOT_FOUND`: check the
  project's framework preset. `quiklab` must be `nextjs` (this happened once).
  Also try https://quiklab.vercel.app to tell a DNS problem from an app problem.
- Roll back fast: in Vercel promote the previous production deployment, or
  `git revert -m 1 <merge sha>` on `main` and push.

## 6. Credentials (values never in chat, never committed)

All in `.env.local` / `secrets/` (both gitignored, verified):

| Name | Used for |
|---|---|
| `VERCEL_TOKEN` | deploy checks, project settings, Vercel DNS (owner deferred rotating it) |
| `HOSTINGER_API_TOKEN` | email/mailbox API (`developers.hostinger.com/api/mail/v1`) |
| `CLARITY_API_TOKEN` | Clarity data export |
| `GA4_SERVICE_ACCOUNT_JSON` -> `secrets/ga4-service-account.json`, `GA4_PROPERTY_ID` | GA4 Data API (blocked until the service account is granted Viewer in GA4) |

GitHub Actions need no extra secrets (they use the built-in `GITHUB_TOKEN`).

## 7. DNS (changed: now at Vercel)

Nameservers are `ns1/ns2.vercel-dns.com`, so DNS is managed in Vercel (API or
dashboard), not Hostinger anymore. The domain is still registered at
Hostinger. Records that must exist:
- apex and `www`: Vercel (automatic)
- `status`: points to the `quiklab-status` Vercel project
- mail (Hostinger mailbox `support@quiklab.online`): `MX 5 mx1.hostinger.com`,
  `MX 10 mx2.hostinger.com` (verified present 2026-09-26), SPF TXT
  `v=spf1 include:_spf.mail.hostinger.com ~all`, `_dmarc TXT v=DMARC1; p=none`,
  DKIM CNAMEs `hostingermail-{a,b,c}._domainkey` -> `hostingermail-{a,b,c}.dkim.mail.hostinger.com`,
  `autodiscover`/`autoconfig` CNAMEs to `*.mail.hostinger.com`.
Only add records; never delete existing ones without asking.

Quick check: `nslookup -type=MX quiklab.online 8.8.8.8`.
