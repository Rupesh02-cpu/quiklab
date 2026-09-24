// Monitor entry point.
// node status/monitor/run.mjs --mode light|synthetic --data <dir> [--simulate <id>] [--base <url>]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { runLightChecks, simulatedFailure } from "./checks.mjs";
import { COMPONENTS, rawStatus, debounce, applyMaintenance, overallStatus } from "./rules.mjs";
import { updateHistory, appendRecent } from "./history.mjs";

const SITE_URL = "https://status.quiklab.online";
const SYNTHETIC_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const LIGHT_IDS = ["website", "pdf", "cdn", "dns", "email"];
const SYNTHETIC_IDS = ["image", "pdf"];

function parseCli() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "light" },
      data: { type: "string" },
      simulate: { type: "string" },
      base: { type: "string", default: "https://quiklab.online" },
    },
  });
  if (!["light", "synthetic"].includes(values.mode)) throw new Error(`Unknown --mode ${values.mode}`);
  if (!values.data) throw new Error("--data <dir> is required");
  const simulate = values.simulate && values.simulate !== "none" ? values.simulate : null;
  if (simulate && !COMPONENTS.some((c) => c.id === simulate)) throw new Error(`Unknown component ${simulate}`);
  return { ...values, simulate, base: values.base.replace(/\/+$/, "") };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await writeFile(file, JSON.stringify(value, null, 2) + "\n");
}

// The incidents and feed modules are optional so the monitor still runs without them.
async function optionalImport(spec) {
  try {
    return await import(spec);
  } catch (err) {
    console.warn(`Skipping ${spec}: ${err.message}`);
    return null;
  }
}

// Collects fresh check results for the components this run evaluates.
async function collectChecks(mode, base, state, now) {
  if (mode === "light") {
    const fresh = await runLightChecks(base);
    // pdf also carries its last synthetic result while it is recent. A single
    // synthetic failure is not merged until it repeats (synthetic debounce).
    const cached = state.synthetic?.pdf;
    if (cached && now - Date.parse(cached.at) < SYNTHETIC_MAX_AGE_MS && cached.failStreak !== 1) {
      fresh.pdf = [...fresh.pdf, cached.check];
    }
    return fresh;
  }
  const { runSyntheticChecks } = await import("./synthetic.mjs");
  const synth = await runSyntheticChecks(base);
  if (synth.error) throw new Error(synth.error);
  const cachedWorker = state.light?.pdf;
  return { image: synth.image, pdf: cachedWorker ? [...synth.pdf, cachedWorker] : synth.pdf };
}

// Remembers results that the other mode merges in.
function rememberChecks(mode, state, checks, now) {
  const next = { ...state };
  if (mode === "light") {
    next.light = { pdf: checks.pdf.find((c) => c.name === "pdf-worker") };
    return next;
  }
  next.synthetic = { ...(state.synthetic || {}) };
  for (const id of SYNTHETIC_IDS) {
    const check = checks[id].find((c) => c.name.endsWith("-synthetic"));
    if (!check) continue;
    const prev = next.synthetic[id];
    const failStreak = check.ok ? 0 : (prev?.failStreak || 0) + 1;
    next.synthetic[id] = { at: now.toISOString(), check, failStreak };
  }
  return next;
}

// --simulate forces every check of one component to fail.
function simulate(checks, id) {
  if (!id) return checks;
  const list = checks[id] || [{ name: `${id}-synthetic` }];
  return { ...checks, [id]: list.map((c) => simulatedFailure(c.name)) };
}

function componentEntry(meta, checks, status, now) {
  const times = checks.map((c) => c.ms).filter((ms) => typeof ms === "number");
  return {
    ...meta,
    status,
    responseMs: times.length ? Math.max(...times) : null,
    lastCheck: now.toISOString(),
    checks: checks.map(({ name, ok, level, ms, detail }) => ({ name, ok, level, ms, detail })),
  };
}

async function main() {
  const args = parseCli();
  const now = new Date();
  const dataDir = path.resolve(args.data);
  await mkdir(dataDir, { recursive: true });
  const files = {
    current: path.join(dataDir, "current.json"),
    history: path.join(dataDir, "history.json"),
    state: path.join(dataDir, "state.json"),
    incidents: path.join(dataDir, "incidents.json"),
    feed: path.join(dataDir, "..", "feed.atom"),
  };
  const [current, history, state0, incidents0] = await Promise.all([
    readJson(files.current, null),
    readJson(files.history, { updatedAt: null, components: {} }),
    readJson(files.state, { components: {}, recent: [] }),
    readJson(files.incidents, { updatedAt: null, incidents: [] }),
  ]);

  const incMod = await optionalImport("./incidents.mjs");
  const feedMod = await optionalImport("./feed.mjs");
  const maintenance = incMod ? incMod.activeMaintenance(incidents0, now) : new Set();

  let checks = await collectChecks(args.mode, args.base, state0, now);
  checks = simulate(checks, args.simulate);
  let state = rememberChecks(args.mode, state0, checks, now);

  // Evaluate the components this run owns; carry the rest over from current.json.
  const owned = args.mode === "light" ? [...LIGHT_IDS] : [...SYNTHETIC_IDS];
  if (args.mode === "light" && args.simulate === "image") owned.push("image");
  const prevById = Object.fromEntries((current?.components || []).map((c) => [c.id, c]));
  const stateComponents = { ...(state.components || {}) };
  const evaluated = [];
  const components = COMPONENTS.map((meta) => {
    if (!owned.includes(meta.id) || !checks[meta.id]) {
      const prev = prevById[meta.id];
      const status = applyMaintenance(stateComponents[meta.id]?.status ?? "nodata", meta.id, maintenance);
      return prev ? { ...prev, ...meta, status } : { ...meta, status, responseMs: null, lastCheck: null, checks: [] };
    }
    const deb = debounce(rawStatus(checks[meta.id]), stateComponents[meta.id]);
    stateComponents[meta.id] = deb;
    const status = applyMaintenance(deb.status, meta.id, maintenance);
    evaluated.push({ id: meta.id, status });
    return componentEntry(meta, checks[meta.id], status, now);
  });

  const nextCurrent = { updatedAt: now.toISOString(), overall: overallStatus(components), components };
  const nextHistory = updateHistory(history, evaluated, now, args.mode === "light" ? 5 : 60);
  state = appendRecent({ ...state, components: stateComponents }, {
    at: now.toISOString(),
    mode: args.mode,
    results: Object.fromEntries(evaluated.map(({ id, status }) => [id, {
      status,
      raw: stateComponents[id].raw,
      checks: checks[id].map(({ name, level, ms }) => ({ name, level, ms })),
    }])),
  }, now);

  // Incidents: GitHub issues are the source of truth; skip calls without a token.
  let incidents = incidents0;
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY || "Rupesh02-cpu/quiklab";
  if (incMod && token) {
    try {
      await incMod.reconcileAutoIncidents({ token, repo, components, now });
      incidents = await incMod.syncIncidents({ token, repo });
    } catch (err) {
      console.error(`Incident sync failed, keeping previous incidents.json: ${err.message}`);
    }
  } else if (!token) {
    console.log("No GITHUB_TOKEN: skipping incident reconcile and sync.");
  }

  await writeJson(files.current, nextCurrent);
  await writeJson(files.history, nextHistory);
  await writeJson(files.state, state);
  await writeJson(files.incidents, incidents);
  if (feedMod) await writeFile(files.feed, feedMod.buildAtomFeed(incidents, { siteUrl: SITE_URL }));

  for (const c of components) {
    const note = evaluated.some((e) => e.id === c.id) ? "" : " (carried over)";
    console.log(`${c.id.padEnd(8)} ${c.status.padEnd(12)} ${c.responseMs ?? "-"} ms${note}`);
    for (const k of c.checks || []) if (!k.ok) console.log(`         ${k.name}: ${k.detail}`);
  }
  console.log(`overall  ${nextCurrent.overall}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
