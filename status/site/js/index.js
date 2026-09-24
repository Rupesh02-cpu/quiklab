import {
  STATUS_LABEL, STAGE_LABEL, knownStatus, worst, loadJson, pageUrl, fmtTime, fmtDay, fmtPct,
  isoDay, parseDate, el, statusLabel, icon, incidentTimeline, initChrome, setUpdated,
} from './common.js';

const REFRESH_MS = 60_000;
const PAST_DAYS = 15;
const narrowQuery = matchMedia('(max-width: 600px)');
const app = document.getElementById('app');
const tooltip = document.getElementById('tooltip');

let data = null;
let previous = null; // last rendered statuses, used for the refresh cross-fade
let rendered = false;

function dayCount() {
  return narrowQuery.matches ? 30 : 90;
}

function referenceDate() {
  const d = parseDate(data?.current?.updatedAt) || parseDate(data?.history?.updatedAt) || new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function nowish() {
  return parseDate(data?.current?.updatedAt) || new Date();
}

function isActive(inc, now) {
  if (inc.status === 'resolved') return false;
  if (inc.kind === 'maintenance') {
    const end = parseDate(inc.scheduledEnd);
    return !end || end > now;
  }
  return true;
}

function incidentsOn(componentId, dayStart) {
  const dayEnd = new Date(dayStart.getTime() + 864e5);
  return (data.incidents?.incidents || []).filter((inc) => {
    if (!(inc.components || []).includes(componentId)) return false;
    const maint = inc.kind === 'maintenance';
    const start = parseDate(maint ? inc.scheduledStart || inc.createdAt : inc.createdAt);
    if (!start) return false;
    const end = parseDate(maint ? inc.resolvedAt || inc.scheduledEnd : inc.resolvedAt) || nowish();
    return start < dayEnd && end >= dayStart;
  });
}

function daysFor(componentId) {
  const n = dayCount();
  const ref = referenceDate();
  const byDate = new Map((data.history?.components?.[componentId] || []).map((e) => [e.date, e]));
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getTime() - i * 864e5);
    const e = byDate.get(isoDay(d));
    const checks = e?.checks || 0;
    const failures = checks ? Math.min(e.failures || 0, checks) : 0;
    const status = checks === 0 ? 'nodata' : knownStatus(e.worst);
    const uptime = checks ? ((checks - failures) / checks) * 100 : null;
    days.push({ date: d, status, uptime, checks, failures });
  }
  return days;
}

function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ---------- banner ----------
function overallStatus(components) {
  if (data.current.overall) return knownStatus(data.current.overall);
  return components.reduce((w, c) => worst(w, knownStatus(c.status)), 'nodata');
}

function renderBanner(components, overall) {
  const affected = components.filter((c) => !['operational', 'nodata'].includes(knownStatus(c.status)));
  let title;
  let sub = '';
  if (overall === 'operational') {
    title = 'All systems operational';
    sub = 'Every tool and service is working normally.';
  } else if (overall === 'nodata') {
    title = 'Waiting for first check';
    sub = 'Status appears here after the first monitoring run.';
  } else {
    title = {
      degraded: 'Degraded performance', partial: 'Partial outage', major: 'Major outage', maintenance: 'Maintenance in progress',
    }[overall];
    const names = affected.map((c) => c.name);
    if (names.length) sub = `${listNames(names)} ${names.length === 1 ? 'is' : 'are'} affected.`;
  }
  const iconName = { operational: 'check', maintenance: 'wrench', nodata: 'clock' }[overall] || 'alert';
  const banner = el('div', { class: 'banner', 'data-status': overall, role: 'status' },
    el('span', { class: 'banner-icon' }, icon(iconName)),
    el('div', {}, el('h1', { text: title }), sub ? el('p', { text: sub }) : null));
  if (previous && previous.overall !== overall) banner.classList.add('xfade');
  return banner;
}

function renderActive() {
  const now = nowish();
  const active = (data.incidents?.incidents || []).filter((i) => isActive(i, now));
  if (!active.length) return null;
  return el('div', { class: 'active-list' }, active.map((inc) => {
    const latest = (inc.updates || [])[0];
    const status = knownStatus(inc.impact);
    const stage = STAGE_LABEL[latest?.stage || inc.status] || latest?.stage || inc.status;
    const when = inc.kind === 'maintenance' && inc.scheduledStart
      ? `${fmtTime(inc.scheduledStart)} to ${fmtTime(inc.scheduledEnd)}`
      : `${stage}, ${fmtTime(latest?.at || inc.createdAt)}`;
    return el('a', { class: 'active-item', 'data-status': status, href: pageUrl('incident.html', { id: inc.id }) },
      el('h3', { text: inc.title }),
      el('div', { class: 'meta' },
        el('span', { class: 'pill', 'data-status': status, text: STATUS_LABEL[status] }), ' ',
        el('span', { class: 'mono', text: when })),
      latest?.body ? el('div', { class: 'body', text: latest.body }) : null);
  }));
}

// ---------- components ----------
function renderComponent(c) {
  const status = knownStatus(c.status);
  const days = daysFor(c.id);
  const checks = days.reduce((t, d) => t + d.checks, 0);
  const failures = days.reduce((t, d) => t + d.failures, 0);
  const uptime = checks ? ((checks - failures) / checks) * 100 : null;
  const n = days.length;
  const prevDays = previous?.days?.[c.id];

  const label = statusLabel(status);
  if (previous && previous.components[c.id] !== status) label.classList.add('xfade');

  const bars = el('div', {
    class: 'bars', role: 'group',
    'aria-label': `${c.name}, last ${n} days. Use arrow keys to move between days and Enter for details.`,
  });
  days.forEach((d, i) => {
    const text = `${fmtDay(d.date)}: ${STATUS_LABEL[d.status].toLowerCase()}${d.uptime != null ? `, ${fmtPct(d.uptime)}` : ''}`;
    const bar = el('button', {
      type: 'button', class: 'bar', 'data-status': d.status, 'aria-label': text,
      tabindex: i === n - 1 ? '0' : '-1', style: `--i:${i}`,
    });
    if (prevDays && prevDays.length === n && prevDays[i] !== d.status) bar.classList.add('xfade');
    bar._day = d;
    bar._component = c;
    bars.append(bar);
  });

  return el('div', { class: 'component', 'data-component': c.id },
    el('div', { class: 'component-head' }, el('h3', { class: 'component-name', text: c.name }), label),
    bars,
    el('div', { class: 'bars-legend' },
      el('span', { text: `${n} days ago` }),
      uptime != null
        ? el('span', {}, el('span', { class: 'uptime mono', text: fmtPct(uptime) }), ' uptime')
        : el('span', { text: 'No data yet' }),
      el('span', { text: 'Today' })));
}

function renderComponents(components) {
  const groups = new Map();
  for (const c of components) {
    const g = c.group || 'Other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  }
  return el('section', { 'aria-labelledby': 'components-title' },
    el('h2', { class: 'section-title', id: 'components-title', text: 'Components' }),
    [...groups].map(([name, list]) => el('div', { class: 'group' },
      el('h2', { class: 'group-name', text: name }),
      list.map(renderComponent))));
}

// ---------- past incidents ----------
function renderPast() {
  const ref = referenceDate();
  const all = data.incidents?.incidents || [];
  const card = el('div', { class: 'card' });
  for (let i = 0; i < PAST_DAYS; i++) {
    const d = new Date(ref.getTime() - i * 864e5);
    const key = isoDay(d);
    const list = all.filter((inc) => (inc.createdAt || '').slice(0, 10) === key);
    card.append(el('div', { class: 'day' },
      el('h3', { class: 'day-date', text: fmtDay(d) }),
      list.length
        ? list.map((inc) => {
          const status = knownStatus(inc.impact);
          return el('article', { class: 'incident', 'data-status': status },
            el('a', { class: 'incident-title', href: pageUrl('incident.html', { id: inc.id }), text: inc.title }),
            ' ', el('span', { class: 'pill', 'data-status': status, text: STATUS_LABEL[status] }),
            incidentTimeline(inc));
        })
        : el('p', { class: 'day-empty', text: 'No incidents reported.' })));
  }
  return el('section', { 'aria-labelledby': 'past-title' },
    el('h2', { class: 'section-title', id: 'past-title', text: 'Past incidents' }), card);
}

// ---------- tooltip ----------
let tipBar = null;
let hideTimer = 0;
let lastPointer = 'mouse';

function showTip(bar) {
  clearTimeout(hideTimer);
  if (tipBar && tipBar !== bar) {
    tipBar.classList.remove('is-active');
    tipBar.removeAttribute('aria-describedby');
  }
  tipBar = bar;
  bar.classList.add('is-active');
  const d = bar._day;
  const incs = incidentsOn(bar._component.id, d.date);
  tooltip.replaceChildren(
    el('div', { class: 'tt-date', text: `${bar._component.name}, ${fmtDay(d.date)}` }),
    el('div', { class: 'tt-row' }, statusLabel(d.status),
      d.uptime != null ? el('span', { class: 'mono', text: fmtPct(d.uptime) }) : null),
    incs.length
      ? el('ul', {}, incs.map((inc) => el('li', {}, el('a', { href: pageUrl('incident.html', { id: inc.id }), text: inc.title }))))
      : el('div', { class: 'tt-row', style: 'color:var(--ink-muted)', text: d.status === 'nodata' ? 'No checks recorded' : 'No incidents' }));
  tooltip.hidden = false;
  bar.setAttribute('aria-describedby', 'tooltip');
  const r = bar.getBoundingClientRect();
  const t = tooltip.getBoundingClientRect();
  const left = Math.min(Math.max(16, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 16);
  let top = r.top - t.height - 10;
  if (top < 8) top = r.bottom + 10;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  requestAnimationFrame(() => tooltip.classList.add('open'));
}

function hideTip() {
  clearTimeout(hideTimer);
  if (!tipBar) return;
  tipBar.classList.remove('is-active');
  tipBar.removeAttribute('aria-describedby');
  tipBar = null;
  tooltip.classList.remove('open');
  tooltip.hidden = true;
}

function hideSoon() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideTip, 160);
}

function wireTooltips() {
  app.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || 'mouse'; });
  app.addEventListener('mouseover', (e) => {
    const b = e.target.closest('.bar');
    if (b && lastPointer === 'mouse') showTip(b);
  });
  app.addEventListener('mouseout', (e) => { if (e.target.closest('.bar') && lastPointer === 'mouse') hideSoon(); });
  tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  tooltip.addEventListener('mouseleave', hideSoon);
  app.addEventListener('focusin', (e) => { const b = e.target.closest('.bar'); if (b) showTip(b); });
  app.addEventListener('focusout', (e) => {
    if (e.target.closest('.bar') && !tooltip.contains(e.relatedTarget)) hideSoon();
  });
  app.addEventListener('click', (e) => {
    const b = e.target.closest('.bar');
    if (!b) return;
    e.stopPropagation();
    // Touch: tapping the open bar again closes it. Mouse and keyboard keep it open.
    if (lastPointer === 'touch' && tipBar === b && tooltip.classList.contains('open')) hideTip();
    else showTip(b);
  });
  app.addEventListener('keydown', (e) => {
    const b = e.target.closest('.bar');
    if (!b) return;
    const bars = [...b.parentElement.children];
    let i = bars.indexOf(b);
    if (e.key === 'ArrowLeft') i -= 1;
    else if (e.key === 'ArrowRight') i += 1;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = bars.length - 1;
    else if (e.key === 'Escape') { hideTip(); return; }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (tipBar === b) hideTip(); else showTip(b);
      return;
    } else return;
    e.preventDefault();
    const next = bars[Math.max(0, Math.min(bars.length - 1, i))];
    b.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  });
  document.addEventListener('click', (e) => { if (tipBar && !tooltip.contains(e.target)) hideTip(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
  addEventListener('scroll', hideTip, { passive: true });
  addEventListener('resize', hideTip);
}

// ---------- render ----------
function renderWaiting() {
  app.replaceChildren(el('div', { class: 'banner', 'data-status': 'nodata', role: 'status' },
    el('span', { class: 'banner-icon' }, icon('clock')),
    el('div', {}, el('h1', { text: 'Waiting for first check' }),
      el('p', { text: 'The monitor has not reported yet. This page fills in automatically after its first run.' }))));
  setUpdated(null);
}

function render() {
  hideTip();
  const components = data?.current?.components;
  if (!Array.isArray(components) || !components.length) {
    renderWaiting();
    return;
  }
  const overall = overallStatus(components);
  app.replaceChildren(
    el('section', { 'aria-label': 'Current status' }, renderBanner(components, overall), renderActive()),
    renderComponents(components),
    renderPast());
  setUpdated(data.current.updatedAt);

  previous = {
    overall,
    components: Object.fromEntries(components.map((c) => [c.id, knownStatus(c.status)])),
    days: Object.fromEntries(components.map((c) => [c.id, daysFor(c.id).map((d) => d.status)])),
  };
  if (!rendered) {
    rendered = true;
    // Load animations play once. Later refreshes only cross-fade what changed.
    setTimeout(() => app.classList.add('is-refresh'), 1500);
  }
}

async function refresh() {
  const [current, history, incidents] = await Promise.all([loadJson('current'), loadJson('history'), loadJson('incidents')]);
  data = { current, history, incidents };
  render();
}

initChrome();
wireTooltips();
narrowQuery.addEventListener('change', () => {
  if (!data) return;
  previous = null;
  render();
});
refresh();
setInterval(refresh, REFRESH_MS);
