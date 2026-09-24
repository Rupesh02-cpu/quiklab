// history.json daily aggregates and state.json raw 24h log.

const MAX_DAYS = 90;
const RAW_WINDOW_MS = 24 * 60 * 60 * 1000;
const SEVERITY = ["nodata", "operational", "maintenance", "degraded", "partial", "major"];
const worse = (a, b) => (SEVERITY.indexOf(b) > SEVERITY.indexOf(a) ? b : a);

// Adds one evaluated run to history. entries: [{ id, status }].
// intervalMin is the nominal time a run represents (5 light, 60 synthetic).
export function updateHistory(history, entries, now, intervalMin) {
  const out = { updatedAt: now.toISOString(), components: { ...(history?.components || {}) } };
  const date = now.toISOString().slice(0, 10);
  for (const { id, status } of entries) {
    const days = [...(out.components[id] || [])];
    let day = days[days.length - 1];
    if (!day || day.date !== date) {
      day = { date, checks: 0, failures: 0, worst: "operational", downMinutes: 0 };
      days.push(day);
    } else {
      day = { ...day };
      days[days.length - 1] = day;
    }
    day.checks += 1;
    if (status === "partial" || status === "major") day.failures += 1;
    if (status === "major") day.downMinutes += intervalMin;
    if (status !== "nodata") day.worst = worse(day.worst, status);
    out.components[id] = days.slice(-MAX_DAYS);
  }
  return out;
}

// Appends this run to state.recent and drops anything older than 24h.
export function appendRecent(state, run, now) {
  const cutoff = now.getTime() - RAW_WINDOW_MS;
  const recent = [...(state.recent || []), run].filter((r) => Date.parse(r.at) >= cutoff);
  return { ...state, recent };
}
