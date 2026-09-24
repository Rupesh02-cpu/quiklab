import { STATUS_LABEL, knownStatus, loadJson, pageUrl, fmtTime, fmtMonth, parseDate, el, initChrome, setUpdated } from './common.js';

const app = document.getElementById('app');

async function main() {
  initChrome();
  const [incidents, current] = await Promise.all([loadJson('incidents'), loadJson('current')]);
  setUpdated(current?.updatedAt || incidents?.updatedAt);
  const list = (incidents?.incidents || []).filter((i) => parseDate(i.createdAt));
  if (!list.length) {
    app.replaceChildren(el('div', { class: 'empty-state' }, el('p', { text: 'No incidents reported in the last 90 days.' })));
    return;
  }
  list.sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt));
  const months = new Map();
  for (const inc of list) {
    const key = fmtMonth(parseDate(inc.createdAt));
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(inc);
  }
  app.replaceChildren(...[...months].map(([month, incs]) => el('section', { class: 'month' },
    el('h2', { text: month }),
    el('div', { class: 'card' }, incs.map((inc) => {
      const status = knownStatus(inc.impact);
      return el('div', { class: 'history-item', 'data-status': status },
        el('div', {},
          el('a', { href: pageUrl('incident.html', { id: inc.id }), text: inc.title }), ' ',
          el('span', { class: 'pill', 'data-status': status, text: STATUS_LABEL[status] })),
        el('span', { class: 'when mono', text: fmtTime(inc.createdAt) + (inc.resolvedAt ? ` to ${fmtTime(inc.resolvedAt)}` : '') }));
    })))));
}

main();
