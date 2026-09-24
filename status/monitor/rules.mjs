// Status rules (plan section 3) with a 2-consecutive-run debounce.

export const COMPONENTS = [
  { id: "website", group: "QuikLab", name: "Website" },
  { id: "image", group: "QuikLab", name: "Image compressor" },
  { id: "pdf", group: "QuikLab", name: "PDF toolkit" },
  { id: "cdn", group: "Infrastructure", name: "jsDelivr CDN" },
  { id: "dns", group: "Infrastructure", name: "DNS" },
  { id: "email", group: "Infrastructure", name: "Email" },
];

const SEVERITY = ["nodata", "operational", "maintenance", "degraded", "partial", "major"];
export const severity = (s) => SEVERITY.indexOf(s);
export const worstOf = (list) => list.reduce((w, s) => (severity(s) > severity(w) ? s : w), "nodata");
const mildestOf = (a, b) => (severity(a) <= severity(b) ? a : b);

export const SLOW_MS = 3_000;
const DEBOUNCE_RUNS = 2;

// Raw status of one run from its check results, before debounce.
export function rawStatus(checks) {
  if (!checks.length) return "nodata";
  const failed = checks.filter((c) => c.level === "fail");
  if (failed.length === checks.length) return "major";
  if (failed.length) return "partial";
  const slow = checks.some((c) => c.level === "warn" || (c.slowMs && c.ms != null && c.ms > c.slowMs));
  return slow ? "degraded" : "operational";
}

const isBad = (s) => s === "degraded" || s === "partial" || s === "major";

// Debounce: a change only takes effect once the same class (good or bad) has
// been seen for 2 consecutive runs. When two bad runs differ, the milder wins.
// prev: { raw, streak, status } from state.json (or undefined).
export function debounce(raw, prev) {
  if (raw === "nodata") return { raw, streak: 0, status: prev?.status ?? "nodata" };
  if (!prev || !prev.raw || prev.raw === "nodata") {
    // First ever run: show good results immediately, hold back bad ones.
    return { raw, streak: 1, status: isBad(raw) ? "operational" : raw };
  }
  const sameClass = isBad(raw) === isBad(prev.raw);
  const streak = sameClass ? prev.streak + 1 : 1;
  let status = prev.status;
  if (streak >= DEBOUNCE_RUNS) status = isBad(raw) ? mildestOf(raw, prev.raw) : raw;
  return { raw, streak, status };
}

// Final status: maintenance notice overrides the measured status.
export function applyMaintenance(status, id, maintenanceSet) {
  return maintenanceSet?.has(id) ? "maintenance" : status;
}

export function overallStatus(components) {
  return worstOf(components.map((c) => c.status));
}
