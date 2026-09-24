// Light checks: Node 20 built-ins only (fetch, dns/promises).
import { resolve4, resolveMx } from "node:dns/promises";

export const TIMEOUT_MS = 10_000;
export const SLOW_MS = 3_000;
export const GIF_JS_URL = "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js";
// Present in the HTML of both the old wizard UI and the unified upload UI.
const MARKER = "QuikLab";
// Vercel anycast ranges (legacy 76.76.21.x and 66.33.60.x, current 216.198.79.x and 64.29.17.x).
const VERCEL_PREFIXES = ["76.76.21.", "66.33.60.", "216.198.79.", "64.29.17."];
const isVercelIp = (ip) => VERCEL_PREFIXES.some((p) => ip.startsWith(p));
const MX_HOSTS = ["mx1.hostinger.com", "mx2.hostinger.com"];

// A check result: { name, ok, level, ms, detail }.
// level is "ok" | "warn" (degraded) | "fail".
function result(name, level, ms, detail) {
  return { name, ok: level !== "fail", level, ms: ms ?? null, detail };
}

async function timed(fn) {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

async function httpCheck(name, url, opts = {}) {
  const r = await httpCheckRaw(name, url, opts);
  return { ...r, slowMs: SLOW_MS };
}

async function httpCheckRaw(name, url, { marker } = {}) {
  try {
    const { value: res, ms } = await timed(async () => {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "QuikLab-Status-Monitor/1.0 (+https://status.quiklab.online)" },
        redirect: "follow",
      });
      // Read the body inside the timer so response time includes transfer.
      r.bodyText = await r.text();
      return r;
    });
    if (res.status !== 200) return result(name, "fail", ms, `HTTP ${res.status} from ${url}`);
    if (marker && !res.bodyText.includes(marker)) {
      return result(name, "fail", ms, `Content marker missing on ${url}`);
    }
    return result(name, "ok", ms, `HTTP 200 in ${ms} ms`);
  } catch (err) {
    const why = err?.name === "TimeoutError" ? `timed out after ${TIMEOUT_MS} ms` : err?.message || String(err);
    return result(name, "fail", null, `${url}: ${why}`);
  }
}

async function dnsCheck(host) {
  try {
    const { value: ips, ms } = await timed(() => resolve4(host));
    if (!ips.length) return result("dns-a", "fail", ms, "No A records");
    if (ips.some(isVercelIp)) return result("dns-a", "ok", ms, `A ${ips.join(", ")}`);
    return result("dns-a", "warn", ms, `A resolves to ${ips.join(", ")} (not a known Vercel IP)`);
  } catch (err) {
    return result("dns-a", "fail", null, `A lookup failed: ${err?.code || err?.message}`);
  }
}

async function mxCheck(host) {
  try {
    const { value: mx, ms } = await timed(() => resolveMx(host));
    const names = mx.map((r) => r.exchange.toLowerCase().replace(/\.$/, ""));
    const found = MX_HOSTS.filter((h) => names.includes(h));
    if (found.length === MX_HOSTS.length) return result("mx", "ok", ms, `MX ${names.join(", ")}`);
    if (found.length) return result("mx", "warn", ms, `MX partially matches: ${names.join(", ")}`);
    return result("mx", "fail", ms, `MX not pointing at Hostinger: ${names.join(", ") || "none"}`);
  } catch (err) {
    return result("mx", "fail", null, `MX lookup failed: ${err?.code || err?.message}`);
  }
}

// Returns { componentId: [checkResult, ...] } for the light components.
// pdf only gets its light asset check here; synthetic results are merged by run.mjs.
export async function runLightChecks(base) {
  const [home, pdfPage, worker, gif, a, mx] = await Promise.all([
    httpCheck("home", `${base}/`, { marker: MARKER }),
    httpCheck("pdf-page", `${base}/pdf`, { marker: MARKER }),
    httpCheck("pdf-worker", `${base}/pdf.worker.min.js`),
    httpCheck("gif-js", GIF_JS_URL),
    // DNS and MX always target the real domain, even with --base.
    dnsCheck("quiklab.online"),
    mxCheck("quiklab.online"),
  ]);
  return {
    website: [home, pdfPage],
    pdf: [worker],
    cdn: [gif],
    dns: [a],
    email: [mx],
  };
}

export function simulatedFailure(name) {
  return result(name, "fail", null, "Simulated failure (workflow_dispatch test)");
}
