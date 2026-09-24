# QuikLab GA4 usage report

**Attempted:** 2026-09-23
**Result: BLOCKED — could not pull real numbers.** The GA4 service account currently
configured in `.env.local` does not have access to the GA4 property. No usage
numbers below are real; none were fabricated to fill the gap. This document
records exactly what was tried, what error came back, and what needs to change
before this can produce real numbers.

## What happened

Property queried: `properties/210192570` (from `GA4_PROPERTY_ID` in `.env.local`),
via service account `tsons-966@gen-lang-client-0822679172.iam.gserviceaccount.com`
(from the key file at `secrets/ga4-service-account.json`, referenced by
`GA4_SERVICE_ACCOUNT_JSON`).

Every call to the GA4 Data API (`runReport`, and even the lightweight `metadata`
endpoint) for this property returns the same error:

```
403 PERMISSION_DENIED
"User does not have sufficient permissions for this property."
```

This is **not**:
- an auth/credential-format problem (the key file loads fine, the request is
  correctly authenticated — Google's API tells us *who* we are, which is how
  the 403 gets returned at all, rather than a 401)
- an API-not-enabled problem for the Data API itself (a disabled API returns a
  different error shape entirely — "API has not been used in project ... or is
  disabled"; that specific error *did* show up separately when probing the
  **Analytics Admin API**, which is unrelated to this report and wasn't needed
  for it)
- a malformed property ID (a nonexistent/malformed property ID also returns a
  distinct error; this error is specifically "you're not allowed to see this
  property," which only happens for a property GA4 does recognize)

It is a straightforward **access-grant problem**: as of right now, this service
account is not listed as a Viewer (or any role) on GA4 property `210192570` in
**GA4 Admin → Property Access Management**. `ANALYTICS.md` and the prior
session's script (`scripts/ga4-non-india-24h.mjs`) both assumed this grant was
already in place from earlier work, but it is not currently active — re-running
that pre-existing script produces the identical 403, confirming this is a
standing access issue and not something new introduced by this task.

## What to check / fix

1. In the Google account that owns the QuikLab GA4 property (property ID
   `210192570`, measurement ID `G-43T0WZB3Z0`), go to
   **GA4 Admin → Property Access Management**.
2. Confirm whether `tsons-966@gen-lang-client-0822679172.iam.gserviceaccount.com`
   is listed. If it's missing, add it with at least **Viewer** access. If it's
   listed but the error persists, remove and re-add it (grants can occasionally
   need to be re-applied), and double check it's added at the **property**
   level (not just the account level, which does not automatically cascade in
   all GA4 UI states).
3. Also confirm this is actually the intended property ID — `210192570` came
   from `.env.local`, but nothing in this session's data could independently
   verify it's the ID for the quiklab.online property, since the service
   account can't see *any* property metadata for it right now. If in doubt,
   confirm the ID from GA4 Admin → Property Settings while logged into the
   Google account that owns the property.
4. Once access is confirmed, re-run the script below — no code changes should
   be needed.

## How to re-run once access is fixed

```
node scripts/ga4-usage-report.mjs
```

This script (`scripts/ga4-usage-report.mjs`, written this session, modeled on
the existing `scripts/ga4-non-india-24h.mjs` pattern) queries, for both the
last 7 and last 28 days:

- Total active users, new users, sessions, page views, event count
- Active users by date
- Sessions/page views/users by `pagePath` (so `/` vs `/pdf` traffic can be compared)
- Counts for the custom events: `upload_images`, `compress_images`,
  `download_image`, `download_all_zip`, `pdf_tool_open`, `pdf_tool_run`,
  `pdf_download`, `pdf_tool_error`
- Active users/sessions by country (top 10)
- Active users/sessions by device category (desktop/mobile/tablet)
- Active users/sessions by browser (top 10)

It prints a human-readable summary to stdout for both windows, followed by a
`RAW_JSON_START`/`RAW_JSON_END`-delimited JSON blob of everything pulled, so a
future session can either read the console output directly or parse the JSON
block programmatically. No numbers are hardcoded or estimated in the script —
if GA4 returns zero rows for a query, the script reports that as empty, not as
a placeholder.

It reads credentials the same way the existing `ga4-non-india-24h.mjs` does:
`GA4_PROPERTY_ID` and `GA4_SERVICE_ACCOUNT_JSON` from `.env.local`, resolved
relative to the repo root, via the `@google-analytics/data` npm package
(already a dependency in `package.json`) — no OAuth flow, no browser
interaction, just the service account key file.

## Caveats for next time (independent of the access issue)

- GA4 can take 24–48h to start reporting for a **brand-new property** — worth
  confirming this property isn't itself brand-new, separately from the access
  grant, once access is restored. If both apply, the very newest traffic could
  still be undercounted for a day or two even after permissions are fixed.
- No custom "active user" definition has been configured beyond GA4's default
  (session-based via the standard gtag.js page-view ping), so `activeUsers` in
  the pulled report will reflect standard GA4 semantics, not a custom
  engagement definition.

## Bottom line

No real usage numbers are available in this document because the query could
not authenticate against the property with sufficient permission — every
request returned `403 PERMISSION_DENIED`, confirmed identically both for a
newly written comprehensive report script and for the pre-existing, previously
un-re-verified `ga4-non-india-24h.mjs` script from earlier in this session.
This is an access-grant issue to fix in GA4 Admin, not a code or query problem.
Once the service account is (re-)granted Viewer access on the correct
property, `node scripts/ga4-usage-report.mjs` will produce the real 7-day/28-day
active users, page/session breakdown, custom event counts, geography, and
device/browser numbers this task originally asked for.
