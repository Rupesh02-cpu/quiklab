// QuikLab GA4 usage report.
// Pulls active users, sessions/pageviews by path, custom event counts,
// geography, and device/browser breakdowns for the last 7 and 28 days.
// Reads credentials from .env.local (GA4_SERVICE_ACCOUNT_JSON, GA4_PROPERTY_ID).
// Usage: node scripts/ga4-usage-report.mjs
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// --- minimal .env.local loader (no extra dependency) ---
function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  const text = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

const env = loadEnvLocal();
const propertyId = env.GA4_PROPERTY_ID;
const keyPath = env.GA4_SERVICE_ACCOUNT_JSON;

if (!propertyId || !keyPath) {
  console.error("Missing GA4_PROPERTY_ID or GA4_SERVICE_ACCOUNT_JSON in .env.local");
  process.exit(1);
}

const keyFile = path.resolve(root, keyPath);
const client = new BetaAnalyticsDataClient({ keyFilename: keyFile });
const property = `properties/${propertyId}`;

const CUSTOM_EVENTS = [
  "upload_images",
  "compress_images",
  "download_image",
  "download_all_zip",
  "pdf_tool_open",
  "pdf_tool_run",
  "pdf_download",
  "pdf_tool_error",
];

// Collects results into a JSON-serializable structure so we can both
// print to stdout AND programmatically confirm real (non-empty-shaped) data.
const results = {};

async function activeUsersByDate(days) {
  const [report] = await client.runReport({
    property,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });
  return report;
}

async function totals(days) {
  const [report] = await client.runReport({
    property,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    metrics: [
      { name: "activeUsers" },
      { name: "newUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
      { name: "eventCount" },
    ],
  });
  return report;
}

async function byPagePath(days) {
  const [report] = await client.runReport({
    property,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "sessions" }, { name: "screenPageViews" }, { name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 25,
  });
  return report;
}

async function customEvents(days) {
  const [report] = await client.runReport({
    property,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: { values: CUSTOM_EVENTS },
      },
    },
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 50,
  });
  return report;
}

async function byCountry(days) {
  const [report] = await client.runReport({
    property,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "country" }],
    metrics: [{ name: "activeUsers" }, { name: "sessions" }],
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 10,
  });
  return report;
}

async function byDevice(days) {
  const [report] = await client.runReport({
    property,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "deviceCategory" }],
    metrics: [{ name: "activeUsers" }, { name: "sessions" }],
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 10,
  });
  return report;
}

async function byBrowser(days) {
  const [report] = await client.runReport({
    property,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "browser" }],
    metrics: [{ name: "activeUsers" }, { name: "sessions" }],
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 10,
  });
  return report;
}

function rowsToObjects(report) {
  if (!report.rows?.length) return [];
  const dimNames = report.dimensionHeaders.map((h) => h.name);
  const metNames = report.metricHeaders.map((h) => h.name);
  return report.rows.map((row) => {
    const obj = {};
    row.dimensionValues.forEach((v, i) => (obj[dimNames[i]] = v.value));
    row.metricValues.forEach((v, i) => (obj[metNames[i]] = v.value));
    return obj;
  });
}

async function main() {
  console.log(`=== QuikLab GA4 usage report — pulled ${new Date().toISOString()} ===`);
  console.log(`Property: ${property}\n`);

  for (const days of [7, 28]) {
    const label = `last${days}d`;
    results[label] = {};

    const [t, byDate, pages, events, countries, devices, browsers] = await Promise.all([
      totals(days),
      activeUsersByDate(days),
      byPagePath(days),
      customEvents(days),
      byCountry(days),
      byDevice(days),
      byBrowser(days),
    ]);

    results[label].totals = rowsToObjects(t)[0] || null;
    results[label].byDate = rowsToObjects(byDate);
    results[label].byPagePath = rowsToObjects(pages);
    results[label].customEvents = rowsToObjects(events);
    results[label].byCountry = rowsToObjects(countries);
    results[label].byDevice = rowsToObjects(devices);
    results[label].byBrowser = rowsToObjects(browsers);

    console.log(`--- Last ${days} days ---`);
    console.log("Totals:", results[label].totals);
    console.log("By date:", JSON.stringify(results[label].byDate));
    console.log("By page path:", JSON.stringify(results[label].byPagePath));
    console.log("Custom events:", JSON.stringify(results[label].customEvents));
    console.log("By country (top 10):", JSON.stringify(results[label].byCountry));
    console.log("By device:", JSON.stringify(results[label].byDevice));
    console.log("By browser:", JSON.stringify(results[label].byBrowser));
    console.log();
  }

  // Print as a single JSON blob at the end too, for easy machine parsing.
  console.log("=== RAW_JSON_START ===");
  console.log(JSON.stringify(results, null, 2));
  console.log("=== RAW_JSON_END ===");
}

main().catch((err) => {
  console.error("GA4 query failed:", err.message || err);
  process.exit(1);
});
