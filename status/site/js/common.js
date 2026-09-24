// Shared helpers for every status page: data loading, formatting, theme toggle.

export const STATUS_LABEL = {
  operational: 'Operational',
  degraded: 'Degraded performance',
  partial: 'Partial outage',
  major: 'Major outage',
  maintenance: 'Under maintenance',
  nodata: 'No data',
};
export const SEVERITY = ['nodata', 'operational', 'maintenance', 'degraded', 'partial', 'major'];
export const STAGE_LABEL = {
  investigating: 'Investigating', identified: 'Identified', monitoring: 'Monitoring', resolved: 'Resolved',
  scheduled: 'Scheduled', 'in progress': 'In progress', completed: 'Completed',
};

export function worst(a, b) {
  return SEVERITY.indexOf(b) > SEVERITY.indexOf(a) ? b : a;
}
export function knownStatus(s) {
  return SEVERITY.includes(s) ? s : 'nodata';
}

const useFixtures = new URLSearchParams(location.search).has('fixtures');
export const dataBase = useFixtures ? 'fixtures/' : 'data/';

// Carry ?fixtures=1 across internal links so the demo data stays loaded.
export function pageUrl(path, params = {}) {
  const q = new URLSearchParams(params);
  if (useFixtures) q.set('fixtures', '1');
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

// Returns parsed JSON, or null when the file is missing or invalid
// (for example before the monitor has run for the first time).
export async function loadJson(name) {
  try {
    const res = await fetch(`${dataBase}${name}.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n) => String(n).padStart(2, '0');

export function parseDate(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
// "Sep 24, 10:05 UTC"
export function fmtTime(v) {
  const d = parseDate(v);
  if (!d) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
// "Sep 24, 2026" from a YYYY-MM-DD string or date
export function fmtDay(v) {
  const d = typeof v === 'string' && v.length === 10 ? parseDate(v + 'T00:00:00Z') : parseDate(v);
  if (!d) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
export function fmtMonth(d) {
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function isoDay(d) {
  return d.toISOString().slice(0, 10);
}
export function fmtPct(p) {
  if (p == null || Number.isNaN(p)) return '';
  if (p >= 100) return '100%';
  return `${(Math.floor(p * 100) / 100).toFixed(2)}%`;
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function statusLabel(status) {
  const s = knownStatus(status);
  return el('span', { class: 'status-label', 'data-status': s, text: STATUS_LABEL[s] });
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#icon-${name}`);
  svg.append(use);
  return svg;
}

export function incidentTimeline(inc) {
  const ul = el('ol', { class: 'timeline' });
  for (const u of inc.updates || []) {
    ul.append(el('li', {},
      el('span', { class: 'stage', text: (STAGE_LABEL[u.stage] || u.stage || 'Update') + '. ' }),
      el('span', { text: u.body || '' }),
      el('time', { class: 'mono', datetime: u.at || '', text: fmtTime(u.at) })));
  }
  return ul;
}

// Theme toggle: System -> Light -> Dark -> System, same key as quiklab.online.
const THEME_KEY = 'quiklab-theme';
const NEXT = { system: 'light', light: 'dark', dark: 'system' };
function readTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch { /* storage blocked */ }
  return 'system';
}
function applyTheme(t) {
  const root = document.documentElement;
  try {
    if (t === 'system') { root.removeAttribute('data-theme'); localStorage.removeItem(THEME_KEY); }
    else { root.setAttribute('data-theme', t); localStorage.setItem(THEME_KEY, t); }
  } catch {
    if (t !== 'system') root.setAttribute('data-theme', t);
  }
}
export function initChrome() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    let theme = readTheme();
    const sync = () => {
      btn.setAttribute('aria-label', `Theme: ${theme}. Click to change.`);
      btn.querySelector('use').setAttribute('href', `#icon-${{ system: 'system', light: 'sun', dark: 'moon' }[theme]}`);
    };
    sync();
    btn.addEventListener('click', () => { theme = NEXT[theme]; applyTheme(theme); sync(); });
  }
  const sub = document.getElementById('subscribe-btn');
  const panel = document.getElementById('subscribe-panel');
  if (sub && panel) {
    const close = () => { panel.hidden = true; sub.setAttribute('aria-expanded', 'false'); };
    sub.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = panel.hidden;
      panel.hidden = !open;
      sub.setAttribute('aria-expanded', String(open));
      if (open) panel.querySelector('a')?.focus();
    });
    document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { close(); sub.focus(); } });
  }
  for (const a of document.querySelectorAll('a[data-internal]')) {
    const u = new URL(a.getAttribute('href'), location.href);
    a.setAttribute('href', pageUrl(u.pathname.split('/').pop(), Object.fromEntries(u.searchParams)));
  }
}

export function setUpdated(iso) {
  const node = document.getElementById('last-updated');
  if (node) node.textContent = iso ? fmtTime(iso) : 'not yet';
}
