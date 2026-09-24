// Atom 1.0 feed for the QuikLab status page. ESM, no dependencies.

const DEFAULT_SITE = "https://status.quiklab.online";

const STAGE_LABEL = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

// Strip characters that are not allowed in XML 1.0, then escape.
export function escapeXml(value) {
  return String(value ?? "")
    .replace(/[^\x09\x0A\x0D\x20-퟿-�\u{10000}-\u{10FFFF}]/gu, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIso(value, fallback) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

function entryUpdated(inc, fallback) {
  const times = [inc.createdAt, inc.resolvedAt, ...(inc.updates || []).map((u) => u.at)]
    .map((t) => new Date(t).getTime())
    .filter((t) => !Number.isNaN(t));
  return times.length ? new Date(Math.max(...times)).toISOString() : fallback;
}

function entryHtml(inc) {
  const parts = [];
  if (inc.kind === "maintenance" && (inc.scheduledStart || inc.scheduledEnd)) {
    parts.push(`<p><strong>Scheduled:</strong> ${escapeXml(inc.scheduledStart || "?")} to ${escapeXml(inc.scheduledEnd || "?")} (UTC)</p>`);
  }
  if (inc.components && inc.components.length) {
    parts.push(`<p><strong>Affected:</strong> ${escapeXml(inc.components.join(", "))}</p>`);
  }
  for (const u of inc.updates || []) {
    const label = STAGE_LABEL[u.stage] || u.stage;
    parts.push(`<p><strong>${escapeXml(label)}</strong> (${escapeXml(u.at)}): ${escapeXml(u.body)}</p>`);
  }
  return parts.join("\n");
}

export function buildAtomFeed(incidentsJson, { siteUrl = DEFAULT_SITE } = {}) {
  const base = String(siteUrl || DEFAULT_SITE).replace(/\/+$/, "");
  const incidents = (incidentsJson && Array.isArray(incidentsJson.incidents) ? incidentsJson.incidents : []).slice();
  const nowIso = new Date().toISOString();
  const entries = incidents.map((inc) => ({ inc, updated: entryUpdated(inc, nowIso) }));
  entries.sort((a, b) => b.updated.localeCompare(a.updated));
  const feedUpdated = entries.length ? entries[0].updated : toIso(incidentsJson && incidentsJson.updatedAt, nowIso);

  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${escapeXml(`${base}/feed.atom`)}</id>`,
    "  <title>QuikLab status</title>",
    "  <subtitle>Incidents and scheduled maintenance for QuikLab</subtitle>",
    `  <link rel="self" type="application/atom+xml" href="${escapeXml(`${base}/feed.atom`)}"/>`,
    `  <link rel="alternate" type="text/html" href="${escapeXml(`${base}/`)}"/>`,
    `  <updated>${feedUpdated}</updated>`,
    "  <author><name>QuikLab</name></author>",
  ];
  for (const { inc, updated } of entries) {
    const url = `${base}/incident.html?id=${encodeURIComponent(inc.id)}`;
    const status = STAGE_LABEL[inc.status] || inc.status || "";
    lines.push(
      "  <entry>",
      `    <id>${escapeXml(url)}</id>`,
      `    <title>${escapeXml(status ? `${inc.title} [${status}]` : inc.title)}</title>`,
      `    <link rel="alternate" type="text/html" href="${escapeXml(url)}"/>`,
      `    <published>${toIso(inc.createdAt, updated)}</published>`,
      `    <updated>${updated}</updated>`,
      `    <content type="html">${escapeXml(entryHtml(inc))}</content>`,
      "  </entry>",
    );
  }
  lines.push("</feed>", "");
  return lines.join("\n");
}
