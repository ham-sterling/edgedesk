/* ============================================================
   WORKSPACE TABS (v3.39) — several pages open at once, like a
   browser: click to switch, × or middle-click to close, + for a
   new tab, drag to reorder, Ctrl/⌘-click or middle-click any
   in-app link to open it in a new tab. Each tab keeps its own
   route and scroll position. Remembered per device.
   ============================================================ */
const WS_KEY = 'edgedesk-tabs', WS_MAX = 15;
let ws = null, wsPendingScroll = null, wsDragId = null;
function wsLoad() {
  if (ws) return ws;
  try { const v = JSON.parse(localStorage.getItem(WS_KEY) || 'null'); if (v && Array.isArray(v.tabs) && v.tabs.length) ws = { tabs: v.tabs.filter(t => t && t.id && typeof t.route === 'string').slice(0, WS_MAX), active: v.active }; } catch { }
  if (!ws || !ws.tabs.length) ws = { tabs: [{ id: uid('tab'), route: ui.route || 'dashboard', scroll: 0 }], active: '' };
  if (!ws.tabs.some(t => t.id === ws.active)) ws.active = ws.tabs[0].id;
  return ws;
}
function wsSave() { try { localStorage.setItem(WS_KEY, JSON.stringify(ws)); } catch { } }
const wsActive = () => wsLoad().tabs.find(t => t.id === ws.active) || ws.tabs[0];
/* called by the router: the active tab follows navigation */
function wsOnRoute(route) { const t = wsActive(); if (t && t.route !== route) { t.route = route; wsSave(); } }
/* label + icon for a route */
function wsTitle(route) {
  const [root, sub, sub2] = String(route || 'dashboard').split('/');
  const nav = NAV().flatMap(g => g[1]).find(x => x[0] === root) || ['', root, 'dashboard'];
  let label = nav[1], ic = nav[2];
  try {
    if (root === 'trades' && sub) { const t = get('trades', sub); if (t) label = `${nameOf('instruments', t.instrumentId, 'symbol')} · ${fmtDate(t.entryDateTime, { year: false })}`; }
    else if (root === 'playbooks' && sub) label = nameOf('playbooks', sub);
    else if (root === 'notes') {
      if (sub === 'n' && sub2) label = noteTitle(get('notebooks', sub2) || {}) || label;
      else if (sub === 'journal') { label = L('บันทึกประจำวัน', 'Journal') + (sub2 ? ' · ' + fmtDate(sub2, { year: false }) : ''); ic = 'journal-day'; }
      else if (sub === 'f' && sub2) label = nameOf('notebookFolders', sub2);
    }
    else if (root === 'reports' && sub) { const m = { insights: L('วิเคราะห์เชิงลึก', 'Insights'), compare: L('เปรียบเทียบ', 'Compare'), psychology: L('จิตวิทยา', 'Psychology'), calendar: L('ปฏิทิน', 'Calendar'), simulation: L('จำลองผล', 'Simulation') }; label = m[sub] || label; if (sub === 'insights' && sub2) { const t = INS_TABS().find(x => x[0] === sub2); if (t) label += ' · ' + t[1]; } }
    else if (root === 'settings' && sub) { const m = { rules: L('กฎความเสี่ยง', 'Risk rules'), instruments: L('สินทรัพย์', 'Instruments'), tags: L('แท็ก', 'Tags'), data: L('ข้อมูล & สำรอง', 'Data & backup') }; label = L('ตั้งค่า', 'Settings') + (m[sub] ? ' · ' + m[sub] : ''); }
  } catch { }
  return { label: label && label !== '—' ? label : nav[1], ic };
}
function wsBarHTML() {
  wsLoad();
  return `<nav class="wstabs" aria-label="${L('แท็บที่เปิดอยู่', 'Open tabs')}"><div class="wstabs-list" role="tablist">${ws.tabs.map(t => { const { label, ic } = wsTitle(t.route), on = t.id === ws.active; return `<div class="wstab ${on ? 'on' : ''}" role="tab" tabindex="0" aria-selected="${on}" draggable="true" data-ws="${t.id}" data-action="ws-tab" title="${esc(label)}">${icon(ic)}<span class="t">${esc(label)}</span>${ws.tabs.length > 1 ? `<button type="button" class="x" data-action="ws-close" data-ws="${t.id}" aria-label="${L('ปิดแท็บ', 'Close tab')}">${icon('x')}</button>` : ''}</div>`; }).join('')}</div><button type="button" class="ws-new" data-action="ws-new" aria-label="${L('แท็บใหม่', 'New tab')}" data-tip="${L('แท็บใหม่ · Ctrl/⌘-คลิกลิงก์เพื่อเปิดในแท็บใหม่', 'New tab · Ctrl/⌘-click a link to open it in a new tab')}">${icon('plus')}</button></nav>`;
}
function wsGoTo(t) {
  const cur = wsActive(); if (cur) cur.scroll = window.scrollY;
  ws.active = t.id; wsSave(); wsPendingScroll = t.scroll || 0;
  if (decodeURIComponent(location.hash.slice(1)) === t.route) { ui.route = t.route; closeDrawer(); render(); wsRestoreScroll(); } else location.hash = t.route;
}
function wsRestoreScroll() { if (wsPendingScroll != null) { const y = wsPendingScroll; wsPendingScroll = null; requestAnimationFrame(() => window.scrollTo(0, y)); } }
function wsOpen(route = 'dashboard', activate = true) {
  wsLoad(); if (ws.tabs.length >= WS_MAX) { toast(L(`เปิดได้สูงสุด ${WS_MAX} แท็บ`, `Up to ${WS_MAX} tabs`), 'bad'); return; }
  const cur = wsActive(), t = { id: uid('tab'), route, scroll: 0 }, i = ws.tabs.indexOf(cur);
  ws.tabs.splice(i + 1, 0, t); wsSave();
  if (activate) wsGoTo(t); else { render(); toast(L('เปิดในแท็บใหม่แล้ว', 'Opened in a new tab')); }
}
function wsClose(id) {
  wsLoad(); if (ws.tabs.length <= 1) return;
  const i = ws.tabs.findIndex(t => t.id === id); if (i < 0) return;
  const wasActive = ws.active === id; ws.tabs.splice(i, 1);
  if (wasActive) wsGoTo(ws.tabs[Math.min(i, ws.tabs.length - 1)]); else { wsSave(); render(); }
}
const WS_ACTIONS = {
  'ws-tab': (el, e) => { if (e?.target?.closest('.x')) return; const t = wsLoad().tabs.find(x => x.id === el.dataset.ws); if (t && t.id !== ws.active) wsGoTo(t); },
  'ws-close': (el, e) => { e?.stopPropagation?.(); wsClose(el.dataset.ws); },
  'ws-new': () => wsOpen('dashboard'),
};
/* in-app links: Ctrl/⌘-click or middle-click opens a new tab (in the background, like a browser) */
function wsLinkRoute(e) {
  const a = e.target.closest?.('#app a[href^="#"]'); if (!a || a.closest('.wstabs')) return null;
  const r = decodeURIComponent(a.getAttribute('href').slice(1)); return r && r !== 'main' ? r : null;
}
function wsInit() {
  wsLoad(); return; // v3.60: workspace tabs removed — links open normally (Ctrl/⌘-click = browser tab)
  document.addEventListener('click', e => { if (!(e.ctrlKey || e.metaKey) || e.button !== 0) return; const r = wsLinkRoute(e); if (!r) return; e.preventDefault(); e.stopPropagation(); wsOpen(r, e.shiftKey); }, true);
  document.addEventListener('auxclick', e => {
    if (e.button !== 1) return;
    const tab = e.target.closest?.('.wstab'); if (tab) { e.preventDefault(); wsClose(tab.dataset.ws); return; }
    const r = wsLinkRoute(e); if (r) { e.preventDefault(); wsOpen(r, false); }
  });
  document.addEventListener('mousedown', e => { if (e.button === 1 && (e.target.closest?.('.wstab') || wsLinkRoute(e))) e.preventDefault(); }); // no autoscroll cursor
  document.addEventListener('keydown', e => {
    const tab = e.target.closest?.('.wstab'); if (!tab) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tab.click(); }
    else if (e.key === 'Delete') { e.preventDefault(); wsClose(tab.dataset.ws); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const all = $$('.wstab'), i = all.indexOf(tab), n = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length]; n?.focus(); }
  });
  document.addEventListener('dragstart', e => { const t = e.target.closest?.('.wstab'); if (!t) return; wsDragId = t.dataset.ws; t.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', wsDragId); } catch { } });
  document.addEventListener('dragover', e => { const t = e.target.closest?.('.wstab'); if (!wsDragId || !t) return; e.preventDefault(); $$('.wstab.drop-before').forEach(x => x.classList.remove('drop-before')); if (t.dataset.ws !== wsDragId) t.classList.add('drop-before'); });
  document.addEventListener('drop', e => {
    const t = e.target.closest?.('.wstab'); if (!wsDragId) return; e.preventDefault();
    if (t && t.dataset.ws !== wsDragId) { const from = ws.tabs.findIndex(x => x.id === wsDragId), moved = ws.tabs.splice(from, 1)[0], to = ws.tabs.findIndex(x => x.id === t.dataset.ws); ws.tabs.splice(to, 0, moved); wsSave(); }
    wsDragId = null; render();
  });
  document.addEventListener('dragend', () => { if (wsDragId) { wsDragId = null; $$('.wstab').forEach(x => x.classList.remove('dragging', 'drop-before')); } });
}
