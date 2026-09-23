// One-off script: last-24h GA4 activity, excluding India.
// Reads credentials from .env.local (GA4_SERVICE_ACCOUNT_JSON, GA4_PROPERTY_ID).
// Usage: node scripts/ga4-non-india-24h.mjs
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

async function main() {
  // 1) Country breakdown, last 24h, excluding India
  const [countryReport] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "1daysAgo", endDate: "today" }],
    dimensions: [{ name: "country" }],
    metrics: [
      { name: "activeUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
      { name: "eventCount" },
    ],
    dimensionFilter: {
      notExpression: {
        filter: {
          fieldName: "country",
          stringFilter: { matchType: "EXACT", value: "India" },
        },
      },
    },
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 50,
  });

  console.log("\n=== Non-India traffic by country, last 24h ===");
  if (!countryReport.rows?.length) {
    console.log("(no rows — either no non-India traffic in the last 24h, or no data at all)");
  } else {
    for (const row of countryReport.rows) {
      const country = row.dimensionValues[0].value;
      const [users, sessions, pageviews, events] = row.metricValues.map((m) => m.value);
      console.log(
        `${country.padEnd(30)} users=${users.padStart(5)} sessions=${sessions.padStart(5)} pageviews=${pageviews.padStart(6)} events=${events.padStart(6)}`
      );
    }
  }

  // 2) Custom event breakdown (non-India), last 24h — upload/compress/download/pdf events
  const [eventReport] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "1daysAgo", endDate: "today" }],
    dimensions: [{ name: "eventName" }, { name: "country" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            notExpression: {
              filter: {
                fieldName: "country",
                stringFilter: { matchType: "EXACT", value: "India" },
              },
            },
          },
          {
            filter: {
              fieldName: "eventName",
              inListFilter: {
                values: [
                  "upload_images",
                  "compress_images",
                  "download_image",
                  "download_all_zip",
                  "pdf_tool_open",
                  "pdf_tool_run",
                ],
              },
            },
          },
        ],
      },
    },
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 100,
  });

  console.log("\n=== Non-India custom events, last 24h ===");
  if (!eventReport.rows?.length) {
    console.log("(no matching custom events from non-India traffic in the last 24h)");
  } else {
    for (const row of eventReport.rows) {
      const [eventName, country] = row.dimensionValues.map((d) => d.value);
      const count = row.metricValues[0].value;
      console.log(`${eventName.padEnd(20)} ${country.padEnd(25)} count=${count}`);
    }
  }
}

main().catch((err) => {
  console.error("GA4 query failed:", err.message || err);
  process.exit(1);
});
