import { STATUS_LABEL, STAGE_LABEL, knownStatus, loadJson, fmtTime, el, incidentTimeline, initChrome, setUpdated } from './common.js';

const app = document.getElementById('app');

function row(label, value, mono = true) {
  return el('p', { class: 'detail-row' }, el('strong', { text: `${label} ` }), el('span', { class: mono ? 'mono' : '', text: value }));
}

async function main() {
  initChrome();
  const id = new URLSearchParams(location.search).get('id');
  const [incidents, current] = await Promise.all([loadJson('incidents'), loadJson('current')]);
  setUpdated(current?.updatedAt || incidents?.updatedAt);
  const names = Object.fromEntries((current?.components || []).map((c) => [c.id, c.name]));
  const inc = (incidents?.incidents || []).find((i) => String(i.id) === id);
  if (!inc) {
    app.replaceChildren(el('div', { class: 'empty-state' },
      el('h1', { text: 'Incident not found' }),
      el('p', { text: incidents ? 'This incident may be older than 90 days, or the link is wrong.' : 'Incident data is not available yet.' })));
    return;
  }
  document.title = `${inc.title} | QuikLab Status`;
  const status = knownStatus(inc.impact);
  const affected = (inc.components || []).map((c) => names[c] || c).join(', ');
  const maint = inc.kind === 'maintenance' && inc.scheduledStart;
  app.replaceChildren(
    el('h1', { class: 'page-title', text: inc.title }),
    el('p', { class: 'page-sub' },
      el('span', { class: 'pill', 'data-status': status, text: STATUS_LABEL[status] }),
      el('span', { text: `  ${STAGE_LABEL[inc.status] || inc.status || ''}` })),
    el('div', { class: 'card', 'data-status': status },
      affected ? row('Affected:', affected, false) : null,
      maint ? row('Window:', `${fmtTime(inc.scheduledStart)} to ${fmtTime(inc.scheduledEnd)}`) : null,
      row('Started:', fmtTime(inc.createdAt)),
      inc.resolvedAt ? row('Resolved:', fmtTime(inc.resolvedAt)) : null,
      el('h2', { class: 'section-title', style: 'margin-top:18px', text: 'Updates' }),
      incidentTimeline(inc)),
  );
}

main();
