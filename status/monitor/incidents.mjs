// Incidents for the QuikLab status page, backed by GitHub issues.
// ESM, Node 20, built-in fetch only. See BUILD_LOG_status-page.md for the contract.

const API = "https://api.github.com";
const API_VERSION = "2022-11-28";
const USER_AGENT = "quiklab-status-monitor";

export const COMPONENTS = [
  { id: "website", name: "Website" },
  { id: "image", name: "Image compressor" },
  { id: "pdf", name: "PDF toolkit" },
  { id: "cdn", name: "jsDelivr CDN" },
  { id: "dns", name: "DNS" },
  { id: "email", name: "Email" },
];

const IMPACTS = ["degraded", "partial", "major", "maintenance"];
const IMPACT_RANK = { maintenance: 0, degraded: 1, partial: 2, major: 3 };
const IMPACT_TITLE = { degraded: "degraded performance", partial: "partial outage", major: "major outage" };
const STAGES = ["investigating", "identified", "monitoring", "resolved"];
const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const BOT_LOGIN = "github-actions[bot]";
const RESOLVED_BODY = "Resolved: All checks passing again.";

const LABEL_COLORS = {
  incident: "d73a4a",
  maintenance: "1d76db",
  auto: "ededed",
  component: "c5def5",
  impact: "fbca04",
};

// ---------- HTTP ----------

async function gh(path, { token, method = "GET", body, allowStatus = [] } = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": USER_AGENT,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const url = path.startsWith("http") ? path : `${API}${path}`;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (err) {
    throw new Error(`GitHub API ${method} ${url} failed: ${err.message}`);
  }
  if (!res.ok && !allowStatus.includes(res.status)) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      // ignore
    }
    throw new Error(`GitHub API ${method} ${url} returned ${res.status}: ${detail}`);
  }
  if (res.status === 204) return { data: null, res };
  const text = await res.text();
  return { data: text ? JSON.parse(text) : null, res };
}

function nextLink(res) {
  const link = res.headers.get("link") || "";
  const m = link.split(",").find((p) => /rel="next"/.test(p));
  if (!m) return null;
  const u = m.match(/<([^>]+)>/);
  return u ? u[1] : null;
}

async function ghPaged(path, token) {
  const out = [];
  let url = path;
  for (let page = 0; url && page < 50; page++) {
    const { data, res } = await gh(url, { token });
    if (Array.isArray(data)) out.push(...data);
    url = nextLink(res);
  }
  return out;
}

// ---------- helpers ----------

function isTrusted(item) {
  if (!item) return false;
  if (item.user && item.user.login === BOT_LOGIN) return true;
  return TRUSTED_ASSOCIATIONS.has(item.author_association);
}

function labelNames(issue) {
  return (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean);
}

function componentName(id) {
  const c = COMPONENTS.find((x) => x.id === id);
  return c ? c.name : id;
}

// Parse a GitHub issue-form body into { "Heading": "value" }.
export function parseFormBody(body) {
  const sections = {};
  if (!body) return sections;
  const parts = String(body).replace(/\r\n/g, "\n").split(/^###\s+/m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n");
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim();
    const value = nl === -1 ? "" : part.slice(nl + 1).trim();
    sections[heading.toLowerCase()] = value === "_No response_" ? "" : value;
  }
  return sections;
}

function findSection(sections, prefix) {
  const key = Object.keys(sections).find((k) => k.startsWith(prefix));
  return key ? sections[key] : "";
}

function parseComponents(text) {
  const ids = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.match(/^\s*-\s*\[([xX ])\]\s*(.+?)\s*$/);
    if (!m || m[1] === " ") continue;
    const name = m[2].toLowerCase();
    const c = COMPONENTS.find((x) => x.name.toLowerCase() === name || x.id === name);
    if (c && !ids.includes(c.id)) ids.push(c.id);
  }
  return ids;
}

function parseImpact(text) {
  const t = String(text || "").toLowerCase();
  if (t.includes("major")) return "major";
  if (t.includes("partial")) return "partial";
  if (t.includes("degraded")) return "degraded";
  return null;
}

function parseIsoUtc(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  // Accept "2026-09-30T02:00Z", "2026-09-30 02:00", with or without Z (UTC assumed).
  let s = t.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s += "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseUpdateComment(body) {
  const m = String(body || "").trim().match(/^(investigating|identified|monitoring|resolved)\s*:\s*([\s\S]*)$/i);
  if (!m) return null;
  return { stage: m[1].toLowerCase(), body: m[2].trim() };
}

function iso(d) {
  return new Date(d).toISOString();
}

// ---------- labels ----------

async function ensureLabel({ token, repo, name, color, description }) {
  await gh(`/repos/${repo}/labels`, {
    token,
    method: "POST",
    body: { name, color, description: description || "" },
    allowStatus: [422],
  });
}

async function ensureLabels({ token, repo, names }) {
  for (const name of names) {
    const prefix = name.split(":")[0];
    await ensureLabel({ token, repo, name, color: LABEL_COLORS[prefix] || "ededed" });
  }
}

// ---------- reconcileAutoIncidents ----------

function failingDetails(component) {
  const lines = [];
  const checks = Array.isArray(component.checks) ? component.checks : [];
  for (const c of checks) {
    const ok = c.ok ?? (c.status ? c.status === "operational" : true);
    if (ok) continue;
    const name = c.name || c.id || "check";
    const why = c.detail || c.error || c.message || c.status || "failed";
    lines.push(`- ${name}: ${why}`);
  }
  for (const k of ["detail", "message", "error"]) {
    if (component[k]) lines.push(`- ${component[k]}`);
  }
  return lines;
}

async function listOpenAutoIncidents(token, repo) {
  const issues = await ghPaged(`/repos/${repo}/issues?state=open&labels=incident,auto&per_page=100`, token);
  return issues.filter((i) => !i.pull_request && isTrusted(i));
}

function issueComponents(issue) {
  return labelNames(issue)
    .filter((l) => l.startsWith("component:"))
    .map((l) => l.slice("component:".length));
}

function issueImpact(issue) {
  const l = labelNames(issue).find((x) => x.startsWith("impact:"));
  return l ? l.slice("impact:".length) : null;
}

export async function reconcileAutoIncidents({ token, repo, components, now } = {}) {
  if (!token) return;
  if (!repo) throw new Error("reconcileAutoIncidents: repo is required");
  const at = now ? new Date(now) : new Date();
  const list = Array.isArray(components) ? components : [];
  const open = await listOpenAutoIncidents(token, repo);
  const failing = list.filter((c) => c.status === "partial" || c.status === "major");

  // Open or escalate.
  for (const comp of failing) {
    const existing = open.find((i) => issueComponents(i).includes(comp.id));
    if (existing) {
      const cur = issueImpact(existing);
      if (!cur || IMPACT_RANK[comp.status] > IMPACT_RANK[cur]) {
        const label = `impact:${comp.status}`;
        await ensureLabels({ token, repo, names: [label] });
        if (cur) {
          await gh(`/repos/${repo}/issues/${existing.number}/labels/${encodeURIComponent(`impact:${cur}`)}`, {
            token,
            method: "DELETE",
            allowStatus: [404],
          });
        }
        await gh(`/repos/${repo}/issues/${existing.number}/labels`, { token, method: "POST", body: { labels: [label] } });
      }
      continue;
    }
    const labels = ["incident", "auto", `component:${comp.id}`, `impact:${comp.status}`];
    await ensureLabels({ token, repo, names: labels });
    const details = failingDetails(comp);
    const body = [
      `Investigating: Automated monitoring detected a ${IMPACT_TITLE[comp.status]} of ${componentName(comp.id)} at ${iso(at)}.`,
      "",
      details.length ? "Failing checks:" : "Failing checks: no details reported.",
      ...details,
      "",
      "This issue was opened by the QuikLab status monitor and will close automatically once all checks pass again.",
    ].join("\n");
    const { data } = await gh(`/repos/${repo}/issues`, {
      token,
      method: "POST",
      body: { title: `${componentName(comp.id)}: ${IMPACT_TITLE[comp.status]}`, body, labels },
    });
    if (data) open.push(data);
  }

  // Resolve.
  const byId = new Map(list.map((c) => [c.id, c.status]));
  for (const issue of open) {
    const ids = issueComponents(issue);
    if (!ids.length) continue;
    const recovered = ids.every((id) => {
      const s = byId.get(id);
      return s === "operational" || s === "degraded";
    });
    if (!recovered) continue;
    await gh(`/repos/${repo}/issues/${issue.number}/comments`, { token, method: "POST", body: { body: RESOLVED_BODY } });
    await gh(`/repos/${repo}/issues/${issue.number}`, {
      token,
      method: "PATCH",
      body: { state: "closed", state_reason: "completed" },
    });
  }
}

// ---------- syncIncidents ----------

function buildIncident(issue, comments) {
  const labels = labelNames(issue);
  const kind = labels.includes("maintenance") ? "maintenance" : "incident";
  const isAuto = labels.includes("auto");
  const sections = parseFormBody(issue.body);

  let components = issueComponents(issue).filter((id) => COMPONENTS.some((c) => c.id === id));
  if (!components.length) components = parseComponents(findSection(sections, "component") || findSection(sections, "affected"));

  let impact;
  if (kind === "maintenance") impact = "maintenance";
  else {
    impact = issueImpact(issue);
    if (!IMPACTS.includes(impact)) impact = parseImpact(findSection(sections, "impact")) || "degraded";
  }

  let scheduledStart = null;
  let scheduledEnd = null;
  if (kind === "maintenance") {
    scheduledStart = parseIsoUtc(findSection(sections, "start"));
    scheduledEnd = parseIsoUtc(findSection(sections, "end"));
  }

  const updates = [];
  if (isAuto) {
    const parsed = parseUpdateComment(issue.body);
    updates.push({
      stage: "investigating",
      body: parsed ? parsed.body.split("\n")[0].trim() : `Automated monitoring detected a problem.`,
      at: iso(issue.created_at),
    });
  } else {
    const desc = findSection(sections, "description") || (Object.keys(sections).length ? "" : String(issue.body || "").trim());
    updates.push({
      stage: kind === "maintenance" ? "identified" : "investigating",
      body: desc || (kind === "maintenance" ? "Scheduled maintenance." : "We are investigating this issue."),
      at: iso(issue.created_at),
    });
  }

  for (const c of comments) {
    if (!isTrusted(c)) continue;
    const u = parseUpdateComment(c.body);
    if (!u) continue;
    updates.push({ stage: u.stage, body: u.body, at: iso(c.created_at) });
  }
  updates.sort((a, b) => a.at.localeCompare(b.at));

  let resolvedAt = null;
  const resolvedUpdate = updates.find((u) => u.stage === "resolved");
  if (resolvedUpdate) resolvedAt = resolvedUpdate.at;
  if (issue.state === "closed") {
    if (!resolvedUpdate) {
      const at = iso(issue.closed_at || issue.updated_at);
      updates.push({ stage: "resolved", body: kind === "maintenance" ? "Maintenance completed." : "This incident has been resolved.", at });
      resolvedAt = at;
    }
  }
  const last = updates[updates.length - 1];
  const status = issue.state === "closed" || resolvedAt ? "resolved" : last.stage;

  return {
    id: issue.number,
    title: issue.title,
    status,
    impact,
    components,
    createdAt: iso(issue.created_at),
    resolvedAt,
    url: issue.html_url,
    kind,
    scheduledStart,
    scheduledEnd,
    updates: updates.slice().reverse(), // newest first (matches status/site fixtures)
  };
}

export async function syncIncidents({ token, repo, since } = {}) {
  if (!repo) throw new Error("syncIncidents: repo is required");
  const sinceIso = since ? iso(since) : new Date(Date.now() - 90 * 86400000).toISOString();
  const seen = new Map();
  for (const label of ["incident", "maintenance"]) {
    const issues = await ghPaged(
      `/repos/${repo}/issues?state=all&labels=${label}&since=${encodeURIComponent(sinceIso)}&per_page=100`,
      token,
    );
    for (const i of issues) {
      if (i.pull_request || !isTrusted(i)) continue;
      seen.set(i.number, i);
    }
  }
  const incidents = [];
  for (const issue of seen.values()) {
    const comments = issue.comments > 0 ? await ghPaged(`/repos/${repo}/issues/${issue.number}/comments?per_page=100`, token) : [];
    incidents.push(buildIncident(issue, comments));
  }
  incidents.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  return { updatedAt: new Date().toISOString(), incidents };
}

// ---------- activeMaintenance ----------

export function activeMaintenance(incidents, now) {
  const list = Array.isArray(incidents) ? incidents : (incidents && incidents.incidents) || [];
  const t = now ? new Date(now).getTime() : Date.now();
  const out = new Set();
  for (const inc of list) {
    if (inc.kind !== "maintenance" || !inc.scheduledStart || !inc.scheduledEnd) continue;
    const start = new Date(inc.scheduledStart).getTime();
    const end = new Date(inc.scheduledEnd).getTime();
    if (t < start || t >= end) continue;
    if (inc.resolvedAt && new Date(inc.resolvedAt).getTime() <= t) continue;
    for (const c of inc.components || []) out.add(c);
  }
  return out;
}
