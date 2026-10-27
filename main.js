/* ============================================================
   APP CONTROLLER — render, router, events, palette, init
   ============================================================ */
/* top-bar selects size to the chosen option, not the longest one */
function fitSelect(el) {
  if (!el || el.tagName !== 'SELECT') return;
  const cs = getComputedStyle(el), c = fitSelect.c ||= document.createElement('canvas').getContext('2d');
  c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const txt = el.options[el.selectedIndex]?.text || '';
  el.style.width = Math.ceil(c.measureText(txt).width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + 2) + 'px';
}
function fitTopSelects() { $$('.topbar select[data-ui=preset], .topbar select[data-ui=unit], .unit-pick').forEach(fitSelect); }
document.addEventListener('change', e => { if (e.target.matches?.('.topbar select')) fitSelect(e.target); });
document.fonts?.ready?.then(() => { try { fitTopSelects(); } catch { } });
function render() {
  try {
    document.documentElement.dataset.theme = state.settings.theme || 'dark'; document.documentElement.lang = LANG;
    flushNote(); chartSpecs.clear(); const y = window.scrollY, same = render._route === ui.route; render._route = ui.route;
    $('#app').innerHTML = shell(); mountCharts($('#app')); hydrateShots($('#app')); fitTopSelects(); if ($('#main #calc-form')) updateCalc();
    window.scrollTo(0, same ? y : 0);
  } catch (e) { console.error(e); $('#app').innerHTML = `<main class="content">${empty(L('แสดงหน้านี้ไม่ได้', 'This view could not be rendered'), L('ข้อมูลของคุณยังอยู่ครบ', 'Your data is safe') + ' — ' + e.message, `<a class="btn" href="#dashboard">${L('ภาพรวม', 'Dashboard')}</a>${btn(L('สำรองข้อมูล', 'Backup'), 'backup')}`)}</main>`; }
}
function renderMain() {
  const m = $('#main'); if (!m) return render();
  for (const k of [...chartSpecs.keys()]) if (!document.querySelector(`#modal-root [data-chart="${k}"],#drawer-root [data-chart="${k}"]`)) chartSpecs.delete(k);
  flushNote(); const y = window.scrollY; m.innerHTML = view(); mountCharts(m); hydrateShots(m); $$('.unit-pick', m).forEach(fitSelect); if ($('#main #calc-form')) updateCalc(); window.scrollTo(0, y);
}
async function changed(msg) { invalidate(); persist(); render(); if (drawerState?.kind === 'trade' && get('trades', drawerState.id)) tradeDetail(drawerState.id); else if (drawerState) closeDrawer(); if (msg) toast(msg); }
function go(route) { if (location.hash.slice(1) === route) { ui.route = route; render(); } else location.hash = route; }
function onRoute() { if (/^backtest(\/|$)/.test(decodeURIComponent(location.hash.slice(1)))) history.replaceState(null, '', '#dashboard'); ui.route = decodeURIComponent(location.hash.slice(1)) || 'dashboard'; if (ui.route === 'reports/overview') ui.route = 'reports'; { const alias = { 'reports/breakdown': 'reports/insights', 'reports/risk': 'reports/simulation' }[ui.route]; if (alias) { history.replaceState(null, '', '#' + alias); ui.route = alias; } } if (/^journal(\/|$)/.test(ui.route)) { const d = ui.route.split('/')[1]; history.replaceState(null, '', '#notes/journal' + (d ? '/' + d : '')); ui.route = 'notes/journal' + (d ? '/' + d : ''); } if (/^plans(\/|$)/.test(ui.route)) { history.replaceState(null, '', '#trades'); ui.route = 'trades'; } ui.page = 1; closeDrawer(); $('#shell')?.classList.remove('navopen'); wsOnRoute(ui.route); render(); wsRestoreScroll(); }

/* ---------- filters drawer ---------- */
function openFilters() {
  const f = ui.filters, sel = new Set(f.tags || []);
  openModal({ title: icon('filter') + L(' ตัวกรองทั้งระบบ', ' Global filters'), size: 'lg', body: `<form id="filter-form" onsubmit="return false"><div class="formgrid c3">${field('instrumentId', L('สินทรัพย์', 'Instrument'), f.instrumentId, 'select', { html: entityOptions('instruments', f.instrumentId, L('ทั้งหมด', 'All'), i => state.trades.some(t => t.instrumentId === i.id)) })}${field('assetClass', L('ประเภทสินทรัพย์', 'Asset class'), f.assetClass, 'select', { options: ASSET_CLASSES.map(c => [c, L(ASSET_TH[c], c)]), empty: L('ทั้งหมด', 'All') })}${field('playbookId', L('กลยุทธ์', 'Strategy'), f.playbookId, 'select', { html: entityOptions('playbooks', f.playbookId, L('ทั้งหมด', 'All')) })}${field('side', L('ทิศทาง', 'Side'), f.side, 'select', { options: [['Buy', 'Long'], ['Sell', 'Short']], empty: L('ทั้งหมด', 'All') })}${field('status', L('สถานะ', 'Status'), f.status, 'select', { options: [['Closed', L('ปิดแล้ว', 'Closed')], ['Open', L('เปิดอยู่', 'Open')]], empty: L('ทั้งหมด', 'All') })}${field('session', L('เซสชัน', 'Session'), f.session, 'select', { options: ['Asia', 'London', 'London–NY', 'New York', 'After hours'].map(s => [s, sessionLabel(s)]), empty: L('ทั้งหมด', 'All') })}${field('weekday', L('วันในสัปดาห์', 'Weekday'), f.weekday, 'select', { options: [1, 2, 3, 4, 5, 6, 0].map(d => [d, dayName(d, true)]), empty: L('ทั้งหมด', 'All') })}${field('emotion', L('อารมณ์', 'Emotion'), f.emotion, 'select', { options: EMOTIONS.map(e => [e[0], L(e[1], e[0])]), empty: L('ทั้งหมด', 'All') })}${field('mistakes', L('ความผิดพลาด', 'Mistakes'), f.mistakes, 'select', { options: [['none', L('ไม่มีความผิดพลาด', 'Without mistakes')], ['any', L('มีความผิดพลาด', 'With mistakes')]], empty: L('ทั้งหมด', 'All') })}${field('reviewed', L('การรีวิว', 'Review'), f.reviewed, 'select', { options: [['yes', L('รีวิวแล้ว', 'Reviewed')], ['no', L('ยังไม่รีวิว', 'Not reviewed')]], empty: L('ทั้งหมด', 'All') })}<div class="field"><label>${L('ช่วง R', 'R range')}</label><div class="row gap4"><input name="minR" type="number" step="any" value="${esc(f.minR ?? '')}" placeholder="${L('ต่ำสุด', 'min')}"><input name="maxR" type="number" step="any" value="${esc(f.maxR ?? '')}" placeholder="${L('สูงสุด', 'max')}"></div></div></div>
  <div class="sec mt24">${L('แท็ก', 'Tags')}</div><div class="row mb16">${seg([['any', L('มีอย่างน้อยหนึ่ง', 'Any')], ['all', L('มีทั้งหมด', 'All')]], f.tagMode || 'any', 'filter-tagmode')}</div><div id="filter-tags">${state.tagCategories.map(c => `<div class="tagpick-g mb16"><div class="tagpick-h"><i style="background:${esc(c.color)}"></i>${esc(catName(c))}</div><div class="chips">${state.tags.filter(t => t.categoryId === c.id).map(t => `<button type="button" class="chip pick ${sel.has(t.id) ? 'on' : ''}" style="--c:${esc(c.color)}" data-action="filter-tag" data-id="${t.id}">${esc(tagName(t))}</button>`).join('')}</div></div>`).join('')}</div></form>`, foot: `${btn(L('ล้างตัวกรอง', 'Reset'), 'filters-reset', {}, 'ghost')}<div class="grow"></div>${btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost')}${btn(L('ใช้ตัวกรอง', 'Apply'), 'filters-apply', {}, 'primary')}` });
  window.__ftags = new Set(f.tags || []); window.__ftagmode = f.tagMode || 'any';
}
function customRange() {
  openModal({ title: L('กำหนดช่วงวันที่', 'Custom date range'), size: 'sm', body: `<div class="formgrid">${field('rfrom', L('ตั้งแต่', 'From'), ui.from, 'date')}${field('rto', L('ถึง', 'To'), ui.to, 'date')}</div>`, foot: `${btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost')}${btn(L('ใช้', 'Apply'), 'range-apply', {}, 'primary')}`, onClose: () => { if (ui.preset === 'custom' && !ui.from && !ui.to) { ui.preset = 'all'; render(); } } });
}

/* ---------- command palette ---------- */
let palItems = [], palIdx = 0;
function openPalette() {
  returnFocus = document.activeElement;
  $('#modal-root').insertAdjacentHTML('beforeend', `<div class="modal-back" data-modal="pal"><section class="palette" role="dialog" aria-label="Command palette"><input id="pal-q" placeholder="${L('ค้นหาเทรด, กลยุทธ์, โน้ต, วันที่ หรือคำสั่ง…', 'Search trades, strategies, notes, dates or commands…')}" autocomplete="off"><div class="pal-list" id="pal-list"></div><div class="foot"><kbd>${icon('chev-up')}</kbd><kbd>${icon('chev-down')}</kbd> ${L('เลือก', 'navigate')} · <kbd>Enter</kbd> ${L('เปิด', 'open')} · <kbd>Esc</kbd> ${L('ปิด', 'close')}</div></section></div>`);
  modalStack.push({ id: 'pal' }); palSearch(''); setTimeout(() => $('#pal-q')?.focus(), 20);
}
function palSearch(q) {
  q = q.toLowerCase().trim();
  const cmds = [['new-trade', L('บันทึกเทรดใหม่', 'New trade'), 'plus'], ['journal-today', L('เปิดบันทึกประจำวันของวันนี้', 'Open today’s journal'), 'journal-day'], ['calc-size', L('เครื่องคำนวณขนาดสัญญา', 'Position size calculator'), 'calculator'], ['note-new', L('โน้ตใหม่', 'New note'), 'notes'], ['import-csv', L('นำเข้า CSV', 'Import CSV'), 'upload'], ['backup', L('ส่งออกไฟล์สำรอง', 'Export backup'), 'download'], ['theme', L('สลับธีม มืด/สว่าง', 'Toggle theme'), 'moon'], ['filters', L('ตัวกรอง', 'Filters'), 'filter']].map(([a, l, ic]) => ({ group: L('คำสั่ง', 'Commands'), label: l, ic, action: a }));
  const navs = NAV().flatMap(g => g[1]).map(([r, l, ic]) => ({ group: L('ไปที่', 'Go to'), label: l, ic, action: 'nav', route: r }));
  let items = [...cmds, ...navs].filter(x => !q || x.label.toLowerCase().includes(q));
  if (q) {
    const tr = state.trades.filter(t => [t.displayId, nameOf('instruments', t.instrumentId, 'symbol'), plain(t.note), nameOf('playbooks', t.playbookId), ...(t.tags || []).map(id => nameOf('tags', id))].join(' ').toLowerCase().includes(q)).sort((a, b) => String(b.entryDateTime).localeCompare(String(a.entryDateTime))).slice(0, 12);
    items.push(...tr.map(t => ({ group: L('เทรด', 'Trades'), label: `${nameOf('instruments', t.instrumentId, 'symbol')} ${t.side === 'Buy' ? 'Long' : 'Short'} · ${fmtDate(t.entryDateTime, { zone: tradeZone(t) })}`, sub: t.status === 'Closed' ? unitFmt(value(t)) : L('เปิดอยู่', 'Open'), ic: 'trades', action: 'view-trade', id: t.id })));
    items.push(...state.playbooks.filter(p => p.name.toLowerCase().includes(q)).map(p => ({ group: L('กลยุทธ์', 'Strategies'), label: p.name, ic: 'playbooks', action: 'nav', route: 'playbooks/' + p.id })));
    items.push(...sortNotes(state.notebooks.filter(n => noteHay(n).includes(q))).slice(0, 8).map(n => ({ group: isJournal(n) ? L('บันทึกประจำวัน', 'Journal') : L('โน้ต', 'Notes'), label: noteTitle(n), ic: isJournal(n) ? 'journal-day' : 'notes', action: 'note-goto', id: n.id })));
    if (/^\d{4}-\d{2}-\d{2}$/.test(q)) items.unshift({ group: L('บันทึกประจำวัน', 'Journal'), label: journalDayLabel(q), ic: 'journal-day', action: 'nav', route: 'notes/journal/' + q });
  }
  palItems = items.slice(0, 40); palIdx = 0; drawPal();
}
function drawPal() { let g = ''; $('#pal-list').innerHTML = palItems.length ? palItems.map((x, i) => (x.group !== g ? `<div class="pal-sec">${esc(g = x.group)}</div>` : '') + `<button class="pal-item ${i === palIdx ? 'act' : ''}" data-action="pal-go" data-i="${i}">${icon(x.ic)}<span>${esc(x.label)}</span>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('') : `<p class="dim small" style="padding:12px">${L('ไม่พบผลลัพธ์', 'No results')}</p>`; $('.pal-item.act')?.scrollIntoView({ block: 'nearest' }); }
function palRun(i) { const x = palItems[i]; if (!x) return; closeModal(); const fake = document.createElement('button'); fake.dataset.action = x.action; if (x.route) fake.dataset.route = x.route; if (x.id) fake.dataset.id = x.id; runAction(x.action, fake, null); }

/* ---------- misc dialogs ---------- */
function columnsDialog() {
  const all = COLS(), vis = ui.columns.filter(c => all[c]), hid = Object.keys(all).filter(k => !vis.includes(k));
  window.__cols = vis.slice();
  const draw = () => `<p class="help" style="margin-top:0">${L('ติ๊กเพื่อแสดง ใช้ลูกศรเพื่อจัดลำดับ', 'Tick to show, use arrows to reorder')}</p><div class="col" style="gap:4px">${[...window.__cols, ...Object.keys(all).filter(k => !window.__cols.includes(k))].map(k => { const on = window.__cols.includes(k), i = window.__cols.indexOf(k); return `<div class="row" style="padding:4px 8px;border:1px solid var(--border);border-radius:8px"><label class="check grow" style="padding:2px 0"><input type="checkbox" data-change="col-toggle" data-k="${k}" ${on ? 'checked' : ''}><span class="box"></span><span>${esc(all[k])}</span></label>${on ? ibtn('chev-up', 'col-move', 'up', { 'data-k': k, 'data-d': -1, disabled: i === 0 }, 'sm') + ibtn('chev-down', 'col-move', 'down', { 'data-k': k, 'data-d': 1, disabled: i === window.__cols.length - 1 }, 'sm') : ''}</div>`; }).join('')}</div>`;
  window.__drawCols = () => { const b = topModal()?.querySelector('.modal-b'); if (b) b.innerHTML = draw(); };
  openModal({ title: icon('columns') + L(' คอลัมน์ตาราง', ' Table columns'), size: 'sm', body: draw(), foot: `${btn(L('ค่าเริ่มต้น', 'Reset'), 'cols-reset', {}, 'ghost')}<div class="grow"></div>${btn(L('ใช้', 'Apply'), 'cols-apply', {}, 'primary')}` });
}
function bulkDialog(op) {
  const ids = [...ui.selected], rows = ids.map(id => get('trades', id)).filter(Boolean); if (!rows.length) return;
  if (op === 'export') return exportTradesCSV(rows);
  if (op === 'delete') return confirmDialog(L(`ลบ ${rows.length} เทรด?`, `Delete ${rows.length} trades?`), L('กด "เลิกทำ" ได้ภายใน 10 วินาทีหลังลบ', 'You can undo for 10 seconds after deleting'), async () => { const set = new Set(ids), gone = state.trades.map((t, i) => [i, t]).filter(([, t]) => set.has(t.id)); state.trades = state.trades.filter(t => !set.has(t.id)); ui.selected.clear(); await changed(); undoToast(L(`ลบ ${gone.length} เทรดแล้ว`, `Deleted ${gone.length} trades`), async () => { for (const [i, t] of gone) state.trades.splice(Math.min(i, state.trades.length), 0, t); await changed(); }, () => gone.forEach(([, t]) => (t.images || []).forEach(deleteImage))); }, L('ลบ', 'Delete'));
  if (op === 'reviewed') { rows.forEach(t => { t.reviewed = true; t.updatedAt = now(); }); ui.selected.clear(); return changed(L('ทำเครื่องหมายรีวิวแล้ว', 'Marked as reviewed')); }
  if (op === 'playbook') { openModal({ title: L('กำหนดกลยุทธ์', 'Set strategy'), size: 'sm', body: field('bulkpb', L('กลยุทธ์', 'Strategy'), '', 'select', { html: entityOptions('playbooks', '', L('— ไม่ระบุ —', '— None —')) }), foot: btn(L('ใช้', 'Apply'), 'bulk-apply-pb', {}, 'primary') }); return; }
  if (op === 'tag') { window.__bulkTags = new Set(); openModal({ title: L(`เพิ่ม/ลบแท็ก (${rows.length} เทรด)`, `Tags for ${rows.length} trades`), body: `<div id="bulk-tags">${state.tagCategories.map(c => `<div class="tagpick-g mb16"><div class="tagpick-h"><i style="background:${esc(c.color)}"></i>${esc(catName(c))}</div><div class="chips">${state.tags.filter(t => t.categoryId === c.id).map(t => `<button type="button" class="chip pick" style="--c:${esc(c.color)}" data-action="bulk-tag-toggle" data-id="${t.id}">${esc(tagName(t))}</button>`).join('')}</div></div>`).join('')}</div>`, foot: `${btn(L('ลบแท็กที่เลือก', 'Remove selected'), 'bulk-tags-apply', { 'data-mode': 'remove' }, 'ghost danger')}<div class="grow"></div>${btn(L('เพิ่มแท็กที่เลือก', 'Add selected'), 'bulk-tags-apply', { 'data-mode': 'add' }, 'primary')}` }); }
}
function lightbox(id) { getImage(id).then(rec => { if (!rec) return; const el = document.createElement('div'); el.className = 'lightbox'; el.innerHTML = `<img src="${rec.data}" alt="">`; el.onclick = () => el.remove(); document.body.appendChild(el); }); }
function riskSizeDialog() {
  openModal({ title: icon('calculator') + L(' จำนวนจาก % ความเสี่ยง', ' Quantity from risk %'), size: 'sm', body: `${field('rsz', L('ความเสี่ยงต่อเทรด (% ของยอดเงิน)', 'Risk per trade (% of balance)'), state.settings.preferredRisk || 1, 'number', { suffix: '%', attrs: 'autofocus' })}<div id="rsz-out" class="mt16"></div>`, foot: `${btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost')}${btn(L('ใช้ขนาดนี้', 'Use this size'), 'rsz-apply', {}, 'primary')}` });
  updateRiskSize();
}
function updateRiskSize() {
  const pct = num($('#f_rsz')?.value), r = readTradeForm(), p = planCalc({ ...r, riskPct: pct }), cur = get('accounts', r.accountId)?.currency;
  window.__rsz = p.qty; $('#rsz-out').innerHTML = !(r.entryPrice > 0 && r.stopLoss > 0) ? `<div class="notice warn">${icon('alert')}<span>${L('ใส่ราคาเข้าและ S/L ในฟอร์มก่อน', 'Enter the entry price and S/L first')}</span></div>` : `<div class="live"><div><label>${L('จำนวน', 'Quantity')}</label><strong class="accent">${fmt(p.qty, 2)}</strong></div><div><label>${L('ความเสี่ยงจริง', 'Actual risk')}</label><strong>${money(p.risk, cur)}</strong></div><div><label>${L('ยอดเงิน', 'Balance')}</label><strong>${money(p.bal, cur)}</strong></div></div>`;
}
async function loadDemo() { const doIt = async () => { state = demoWorkspace(seed()); state.settings.language = LANG; invalidate(); ui.account = ''; ui.preset = 'all'; ui.from = ui.to = ''; ui.filters = {}; closeModal(true); await changed(L('โหลดข้อมูลตัวอย่างแล้ว', 'Demo workspace loaded')); go('dashboard'); }; if (state.trades.length) confirmDialog(L('แทนที่ด้วยข้อมูลตัวอย่าง?', 'Replace with demo data?'), L('ข้อมูลปัจจุบันจะถูกแทนที่ — แนะนำให้ส่งออกไฟล์สำรองก่อน', 'Current data will be replaced — export a backup first'), doIt, L('โหลดตัวอย่าง', 'Load demo')); else doIt(); }

/* ---------- action dispatcher ---------- */
const A = {
  'nav': el => go(el.dataset.route),
  'toggle-collapse': () => { ui.sidebarCollapsed = !ui.sidebarCollapsed; savePrefs(); $('#shell').classList.toggle('collapsed', ui.sidebarCollapsed); setTimeout(() => mountCharts(), 50); },
  'mobile-nav': () => $('#shell').classList.toggle('navopen'),
  'palette': openPalette, 'pal-go': el => palRun(+el.dataset.i), 'filters': openFilters,
  'theme': async () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; persist(); render(); },
  'lang': async () => { LANG = state.settings.language = LANG === 'th' ? 'en' : 'th'; persist(); render(); },
  'clear-scope': () => { ui.filters = {}; ui.account = ''; ui.preset = 'all'; ui.from = ui.to = ''; ui.search = ''; ui.tradeQuick = 'all'; savePrefs(); render(); },
  'new-trade': el => { const d = el?.dataset?.date; openTradeEditor('', d ? { entryDateTime: toISO(d + 'T' + (fmtTime(now()))) } : {}); },
  'view-trade': el => { if (el.dataset.id) tradeDetail(el.dataset.id); },
  'edit-trade': el => openTradeEditor(el.dataset.id, {}, !!el.dataset.close, el.dataset.tab || 'main'),
  'edit-trade-time': el => { openTradeEditor(el.dataset.id, {}, false, 'main'); setTimeout(() => { const f = $('#f_entryDateTime'); f?.scrollIntoView({ block: 'center' }); f?.focus(); }, 120); },
  'td-time': el => { ui.tdTime = el.dataset.value === 'broker' ? 'broker' : 'local'; tradeDetail(el.dataset.id); }, 'ed-tab': el => edTab(el.dataset.tab),
  'dup-trade': el => { const t = get('trades', el.dataset.id); if (!t) return; const c = clone(t); delete c.externalId; delete c.instrumentSnapshot; if (c.executions) c.executions = c.executions.map(x => ({ ...x, id: uid('ex') })); delete c.planId; openTradeEditor('', { ...c, id: uid('trd'), displayId: '', images: [], createdAt: now(), reviewed: false }); },
  'del-trade': el => { const t = get('trades', el.dataset.id); if (!t) return; confirmDialog(L('ลบเทรดนี้?', 'Delete this trade?'), `${esc(nameOf('instruments', t.instrumentId, 'symbol'))} · ${fmtDate(t.entryDateTime, { zone: tradeZone(t) })} — ${L('กดเลิกทำได้ภายใน 10 วินาที', 'undo available for 10 seconds')}`, async () => { const i = state.trades.indexOf(t); state.trades = state.trades.filter(x => x.id !== t.id); ui.selected.delete(t.id); closeModal(true); closeDrawer(); await changed(); undoToast(L('ลบเทรดแล้ว', 'Trade deleted'), async () => { state.trades.splice(Math.min(i, state.trades.length), 0, t); await changed(); }, () => (t.images || []).forEach(deleteImage)); }, L('ลบ', 'Delete')); },
  'close-modal': () => requestCloseModal(), 'confirm-yes': async () => { const f = window.__confirm; closeModal(); await f?.(); },
  'close-drawer': () => closeDrawer(), 'close-drawer-bg': (el, e) => { if (e.target === el) closeDrawer(); },
  'save-trade': el => saveTrade(!!el.dataset.again), 'ed-size': riskSizeDialog, 'rsz-apply': () => { if (finite(window.__rsz)) { closeModal(); $('#f_quantity').value = +window.__rsz.toFixed(4); updateLive(); } },
  'ed-tf': el => { const h = $('#editor-form [name=timeframe]'), on = el.classList.contains('on'); el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', !on && b === el)); if (h) { h.value = on ? '' : el.dataset.value; h.dispatchEvent(new Event('input', { bubbles: true })); } },
  'ed-side': el => { editor.side = el.dataset.value; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); updateLive(); },
  'ed-status': el => { editor.status = el.dataset.value; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); if (editor.status === 'Closed' && !$('#f_exitDateTime').value) $('#f_exitDateTime').value = localInput(now()); updateLive(); },
  'ed-rating': el => { editor.rating = editor.rating === +el.dataset.value ? 0 : +el.dataset.value; $('#ed-rating').innerHTML = stars(editor.rating, 'ed-rating'); },
  'ed-emotion': el => { editor.emotion = editor.emotion === el.dataset.value ? '' : el.dataset.value; $('#ed-emotion').innerHTML = emotionPicker(editor.emotion, 'ed-emotion'); },
  'tag-toggle': el => { const id = el.dataset.id, i = editor.tags.indexOf(id); if (i >= 0) editor.tags.splice(i, 1); else editor.tags.push(id); el.classList.toggle('on', i < 0); },
  'tag-quick-add': el => openTagEditor('', el.dataset.cat || ''),
  'combo-pick': el => { const box = el.closest('.combo'), id = el.dataset.id, ins = get('instruments', id); box.querySelector('input[type=hidden]').value = id; box.querySelector('.combo-input').value = ins.symbol; box.querySelector('.combo-ic').innerHTML = insIcon(ins); box.querySelector('.combo-list').hidden = true; refreshForm(box); },
  'lightbox': (el, e) => { if (e.target.closest('[data-action="shot-del"]')) return; lightbox(el.dataset.img); },
  'shot-del': async (el, e) => { e.stopPropagation(); const { img, kind, id } = el.dataset; if (kind === 'editor') { editor.images = editor.images.filter(x => x !== img); $('#editor-shots').innerHTML = shotsHTML(editor.images, 'editor', 'x'); hydrateShots($('#editor-shots')); return; } const r = get(kind, id); if (!r) return; r.images = (r.images || []).filter(x => x !== img); await deleteImage(img); persist(); refreshShots(kind, id); },
  'quick-rating': async el => { const id = el.closest('[data-id]').dataset.id, t = get('trades', id); t.rating = t.rating === +el.dataset.value ? null : +el.dataset.value; t.updatedAt = now(); persist(); el.closest('.stars').outerHTML = stars(t.rating, 'quick-rating').replace('class="stars input"', `class="stars input" data-id="${id}"`); },
  'quick-emotion': async el => { const id = el.closest('[data-id]').dataset.id, t = get('trades', id); t.emotion = t.emotion === el.dataset.value ? '' : el.dataset.value; t.updatedAt = now(); persist(); el.closest('.emo').outerHTML = emotionPicker(t.emotion, 'quick-emotion').replace('class="emo"', `class="emo" data-id="${id}"`); },
  'eq-mode': el => { ui.eqMode = el.dataset.value; renderMain(); },
  'cal-month': el => { let m = ui.month + +el.dataset.dir, y = ui.year; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } ui.month = m; ui.year = y; renderMain(); },
  'cal-today': () => { const t = new Date(); ui.month = t.getMonth(); ui.year = t.getFullYear(); renderMain(); },
  'cal-year': el => { ui.calYear = +el.dataset.y + +el.dataset.dir; renderMain(); },
  'open-day': el => go('notes/journal/' + el.dataset.day), 'journal-today': () => go('notes/journal/' + todayKey()),
  'review-queue': () => { ui.tradeQuick = 'review'; go('trades'); },
  'go-dim': (el, e) => { e.preventDefault(); ui.dimension = el.dataset.dim; savePrefs(); go('reports/insights/' + insTabOf(el.dataset.dim)); },
  'ins-tab': el => go('reports/insights/' + el.dataset.value),
  'ins-tagcat': el => { ui.insTagCat = el.dataset.value; savePrefs(); renderMain(); },
  'sort': el => { const k = el.dataset.key; if (ui.sortKey === k) ui.sortDir = ui.sortDir === 'asc' ? 'desc' : 'asc'; else { ui.sortKey = k; ui.sortDir = 'desc'; } savePrefs(); renderMain(); },
  'sel-row': (el, e) => { e.stopPropagation(); const id = el.dataset.id; el.checked ? ui.selected.add(id) : ui.selected.delete(id); renderMain(); },
  'sel-page': el => { $$('[data-action="sel-row"]').forEach(c => el.checked ? ui.selected.add(c.dataset.id) : ui.selected.delete(c.dataset.id)); renderMain(); },
  'sel-clear': () => { ui.selected.clear(); renderMain(); },
  'trade-quick': el => { ui.tradeQuick = el.dataset.value; ui.page = 1; renderMain(); },
  'page': el => { ui.page += +el.dataset.dir; renderMain(); window.scrollTo(0, 0); },
  'columns': columnsDialog,
  'col-move': el => { const c = window.__cols, i = c.indexOf(el.dataset.k), j = i + +el.dataset.d; if (j < 0 || j >= c.length) return;[c[i], c[j]] = [c[j], c[i]]; window.__drawCols(); },
  'cols-reset': () => { window.__cols = defaultCols.slice(); window.__drawCols(); },
  'cols-apply': () => { ui.columns = window.__cols.length ? window.__cols.slice() : defaultCols.slice(); savePrefs(); closeModal(); renderMain(); },
  'bulk': el => bulkDialog(el.dataset.op),
  'bulk-apply-pb': async () => { const pb = $('#f_bulkpb').value; ui.selected.forEach(id => { const t = get('trades', id); if (t) { t.playbookId = pb; t.updatedAt = now(); } }); closeModal(); ui.selected.clear(); await changed(L('อัปเดตกลยุทธ์แล้ว', 'Strategy updated')); },
  'bulk-tag-toggle': el => { const s = window.__bulkTags; s.has(el.dataset.id) ? s.delete(el.dataset.id) : s.add(el.dataset.id); el.classList.toggle('on'); },
  'bulk-tags-apply': async el => { const s = window.__bulkTags, add = el.dataset.mode === 'add'; ui.selected.forEach(id => { const t = get('trades', id); if (!t) return; t.tags = add ? [...new Set([...(t.tags || []), ...s])] : (t.tags || []).filter(x => !s.has(x)); t.updatedAt = now(); }); closeModal(); ui.selected.clear(); await changed(L('อัปเดตแท็กแล้ว', 'Tags updated')); },
  'export-csv': () => exportTradesCSV(sortTrades(filtered({ search: ui.search }))), 'export-csv-all': () => exportTradesCSV(state.trades),
  'csv-template': () => download('edgedesk-template.csv', '﻿symbol,type,open_time,open_price,volume,sl,tp,close_time,close_price,profit,commission,swap,playbook,tags,note\r\nXAUUSD,buy,2026-01-05 09:30,2650.50,0.50,2644.00,2665.00,2026-01-05 11:10,2661.20,535.00,3.50,0,Pure Price Action,Pullback|Trending,ตัวอย่าง\r\n', 'text/csv'),
  'import-csv': () => { if (!state.accounts.length) { toast(L('สร้างบัญชีก่อนนำเข้า', 'Create an account first')); openAccountEditor(); return; } pickFile('.csv,text/csv,.txt', startCSV); },
  'csv-validate': validateCSV, 'csv-commit': commitCSV,
  'backup': exportBackup, 'restore': () => pickFile('.json,application/json', f => f.text().then(t => { try { restoreFrom(JSON.parse(t), f.name); } catch (e) { toast(L('ไฟล์ JSON ไม่ถูกต้อง', 'Invalid JSON'), 'bad'); } })),
  'restore-yes': () => window.__restore?.(), 'health': healthCheck, 'load-demo': loadDemo,
  'reset': () => confirmDialog(L('ล้างพื้นที่ทำงานทั้งหมด?', 'Reset the whole workspace?'), L('เทรด แผนบันทึกประจำวัน โน้ต และบัญชีทั้งหมดจะถูกลบถาวร — โปรดส่งออกไฟล์สำรองก่อน', 'Everything will be permanently deleted — export a backup first'), async () => { const imgs = await allImages(); for (const id of Object.keys(imgs)) await deleteImage(id); state = seed(); state.settings.language = LANG; ui.account = ''; ui.filters = {}; await changed(L('ล้างพื้นที่ทำงานแล้ว', 'Workspace reset')); go('dashboard'); }, L('ล้างทั้งหมด', 'Reset')),
  'undo-batch': el => { const b = get('importBatches', el.dataset.id); if (!b) return; confirmDialog(L('ย้อนการนำเข้านี้?', 'Undo this import?'), L(`จะลบ ${b.added?.length || 0} เทรดที่เพิ่มและคืนค่า ${b.replaced?.length || 0} เทรดที่ถูกแทนที่`, `Removes ${b.added?.length || 0} added trades and restores ${b.replaced?.length || 0} replaced`), async () => { const add = new Set(b.added || []); state.trades = state.trades.filter(t => !add.has(t.id)); for (const r of b.replaced || []) { const i = state.trades.findIndex(t => t.id === r.id); if (i >= 0) state.trades[i] = r; } const tx = new Set(b.transactions || []); state.transactions = state.transactions.filter(t => !tx.has(t.id)); const ins = new Set(b.instruments || []); state.instruments = state.instruments.filter(i => !ins.has(i.id) || state.trades.some(t => t.instrumentId === i.id)); state.importBatches = state.importBatches.filter(x => x.id !== b.id); await changed(L('ย้อนการนำเข้าแล้ว', 'Import undone')); }, L('ย้อนกลับ', 'Undo')); },
  // filters
  'filter-tag': el => { const s = window.__ftags; s.has(el.dataset.id) ? s.delete(el.dataset.id) : s.add(el.dataset.id); el.classList.toggle('on'); },
  'filter-tagmode': el => { window.__ftagmode = el.dataset.value; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); },
  'filters-apply': () => { const d = formData($('#filter-form')); ui.filters = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== '' && v != null)); ui.filters.tags = [...window.__ftags]; ui.filters.tagMode = window.__ftagmode; ui.page = 1; closeModal(); savePrefs(); render(); },
  'filters-reset': () => { ui.filters = {}; closeModal(); render(); },
  'range-apply': () => { ui.from = $('#f_rfrom').value; ui.to = $('#f_rto').value; ui.preset = ui.from || ui.to ? 'custom' : 'all'; closeModal(); savePrefs(); render(); },
  // journal
  // playbooks
  'new-playbook': () => openPlaybookEditor(), 'edit-playbook': (el, e) => { e.stopPropagation(); el.closest('details')?.removeAttribute('open'); openPlaybookEditor(el.dataset.id); }, 'save-playbook': savePlaybook,
  'dup-playbook': async (el, e) => { e.stopPropagation(); const pb = clone(get('playbooks', el.dataset.id)); pb.id = uid('pb'); pb.name += L(' (สำเนา)', ' (copy)'); pb.createdAt = now(); state.playbooks.push(pb); await changed(L('ทำสำเนาแล้ว', 'Duplicated')); },
  'del-playbook': (el, e) => { e.stopPropagation(); const id = el.dataset.id, n = state.trades.filter(t => t.playbookId === id).length; confirmDialog(L('ลบกลยุทธ์?', 'Delete strategy?'), n ? L(`มี ${n} เทรดที่ใช้กลยุทธ์นี้ — เทรดจะยังอยู่แต่ไม่มีกลยุทธ์ (แนะนำให้ตั้งสถานะเป็น "ปิดใช้งาน" แทน)`, `${n} trades use it — they will lose the link (consider setting Inactive)`) : '', async () => { const pi = state.playbooks.findIndex(p => p.id === id), pb = state.playbooks[pi], linked = state.trades.filter(t => t.playbookId === id); state.playbooks = state.playbooks.filter(p => p.id !== id); linked.forEach(t => t.playbookId = ''); await changed(); go('playbooks'); undoToast(L('ลบกลยุทธ์แล้ว', 'Strategy deleted'), async () => { state.playbooks.splice(Math.min(pi, state.playbooks.length), 0, pb); linked.forEach(t => t.playbookId = id); await changed(); }); }, L('ลบ', 'Delete')); },
  'pb-view': el => { ui.playbookView = el.dataset.value; savePrefs(); renderMain(); },
  'pb-tab': el => go(el.dataset.value === 'overview' ? 'playbooks/' + el.dataset.id : `playbooks/${el.dataset.id}/${el.dataset.value}`),
  'pb-trades': el => { ui.filters = { playbookId: el.dataset.id }; go('trades'); },
  'rule-group-add': () => { editor.rules.push({ id: uid('rg'), name: '', items: [{ id: uid('r'), label: '' }] }); $('#rule-builder').innerHTML = rulesBuilder(); },
  'rule-group-del': el => { editor.rules.splice(+el.dataset.g, 1); $('#rule-builder').innerHTML = rulesBuilder(); },
  'rule-add': el => { editor.rules[+el.dataset.g].items.push({ id: uid('r'), label: '' }); $('#rule-builder').innerHTML = rulesBuilder(); $$(`[data-rule-item^="${el.dataset.g}:"]`).at(-1)?.focus(); },
  'rule-del': el => { editor.rules[+el.dataset.g].items.splice(+el.dataset.i, 1); $('#rule-builder').innerHTML = rulesBuilder(); },
  // notes
  'folder-new': () => promptDialog(L('โฟลเดอร์ใหม่', 'New folder'), L('ชื่อโฟลเดอร์', 'Folder name'), '', n => { if (!n?.trim()) return; state.notebookFolders.push({ id: uid('nbf'), name: n.trim(), createdAt: now() }); changed(); }),
  'folder-rename': el => { const f = get('notebookFolders', el.dataset.id); promptDialog(L('เปลี่ยนชื่อโฟลเดอร์', 'Rename folder'), L('ชื่อโฟลเดอร์', 'Folder name'), f.name, n => { if (!n?.trim()) return; f.name = n.trim(); changed(); }); },
  'prompt-ok': () => { const v = $('#f_promptv')?.value, fn = window.__prompt; closeModal(); fn?.(v); },
  'folder-del': el => { const id = el.dataset.id; if (state.notebookFolders.length <= 1) return toast(L('ต้องมีอย่างน้อยหนึ่งโฟลเดอร์', 'Keep at least one folder'), 'bad'); confirmDialog(L('ลบโฟลเดอร์?', 'Delete folder?'), L('โน้ตในโฟลเดอร์จะถูกย้ายไปโฟลเดอร์แรก', 'Notes move to the first folder'), async () => { state.notebookFolders = state.notebookFolders.filter(f => f.id !== id); state.notebooks.forEach(n => { if (n.folderId === id) n.folderId = state.notebookFolders[0].id; }); ui.notebookFolder = ''; await changed(); }, L('ลบ', 'Delete')); },
  'note-new': () => newNote(),
  'note-template': el => newNoteFromTemplate(el.dataset.id),
  'note-open': el => go('notes/n/' + el.dataset.id), 'note-goto': el => go('notes/n/' + el.dataset.id),
  'note-pin': async el => { flushNote(); const n = get('notebooks', el.dataset.id); n.pinned = !n.pinned; persist(); renderMain(); },
  'note-dup': async el => { flushNote(); const n = clone(get('notebooks', el.dataset.id)); n.id = uid('note'); n.title += L(' (สำเนา)', ' (copy)'); n.createdAt = n.updatedAt = now(); state.notebooks.push(n); invalidate(); persist(); go('notes/n/' + n.id); },
  'note-move': el => { const n = get('notebooks', el.dataset.id); openModal({ title: L('ย้ายไปโฟลเดอร์', 'Move to folder'), size: 'sm', body: field('mvf', L('โฟลเดอร์', 'Folder'), n.folderId, 'select', { html: state.notebookFolders.map(f => opt(f.id, f.name, n.folderId)).join('') }), foot: btn(L('ย้าย', 'Move'), 'note-move-apply', { 'data-id': n.id }, 'primary') }); },
  'note-move-apply': async el => { get('notebooks', el.dataset.id).folderId = $('#f_mvf').value; closeModal(); await changed(L('ย้ายแล้ว', 'Moved')); },
  'note-export': el => { flushNote(); const n = get('notebooks', el.dataset.id), t = noteTitle(n); download((t || 'note') + '.html', `<!doctype html><meta charset="utf-8"><title>${esc(t)}</title><body style="font-family:sans-serif;max-width:760px;margin:40px auto;line-height:1.7"><h1>${esc(t)}</h1>${n.html}</body>`, 'text/html'); },
  'note-del': el => confirmDialog(L('ลบโน้ตนี้?', 'Delete this note?'), '', async () => { const dn = get('notebooks', el.dataset.id); if (!dn) return; clearTimeout(noteTimer); noteTimer = null; const ni = state.notebooks.indexOf(dn); state.notebooks = state.notebooks.filter(n => n.id !== dn.id); ui.notebookId = ''; await changed(); if (ui.route.startsWith('notes/n/')) go('notes'); undoToast(L('ลบโน้ตแล้ว', 'Note deleted'), async () => { state.notebooks.splice(Math.min(ni, state.notebooks.length), 0, dn); await changed(); }, () => (dn.images || []).forEach(deleteImage)); }, L('ลบ', 'Delete')),
  'rte': el => rteCommand(el.dataset.cmd, el.dataset.target || 'note-rich'),
  // reports
  'report-tab': el => go(el.dataset.value === 'overview' ? 'reports' : 'reports/' + el.dataset.value),
  'bd-metric': el => { ui.breakdownMetric = el.dataset.value; savePrefs(); renderMain(); },
  'cross-metric': el => { ui.crossMetric = el.dataset.value; savePrefs(); renderMain(); },
  'drill': el => { const dim = el.dataset.dim, key = el.dataset.key, ids = new Set(filtered().filter(t => t.status === 'Closed' && groupKeys(t, dim).includes(key)).map(t => t.id)); openModal({ title: `${esc(dimLabel(dim))}: ${esc(dimKeyLabel(dim, key))}`, size: 'xl', body: `<div class="tablewrap"><table><thead><tr><th>${L('วันที่', 'Date')}</th><th>${L('สินทรัพย์', 'Instrument')}</th><th>${L('ทิศทาง', 'Side')}</th><th>${L('กลยุทธ์', 'Strategy')}</th><th class="num">R</th><th class="num">${L('ผลลัพธ์', 'Result')}</th></tr></thead><tbody>${sortTrades(state.trades.filter(t => ids.has(t.id))).map(t => `<tr class="click" data-action="view-trade" data-id="${t.id}"><td>${fmtDate(t.entryDateTime, { time: true, zone: tradeZone(t) })}</td><td>${symbolCell(t.instrumentId)}</td><td>${sideBadge(t.side)}</td><td>${esc(nameOf('playbooks', t.playbookId))}</td><td class="num ${tone(calc(t).r)}">${finite(calc(t).r) ? fmt(calc(t).r, 2, true) + 'R' : '—'}</td><td class="num"><strong class="${tone(calc(t).net)}">${unitFmt(value(t))}</strong></td></tr>`).join('')}</tbody></table></div>`, foot: btn(L('ปิด', 'Close'), 'close-modal', {}, 'ghost') }); },
  'export-report': exportReportCSV, 'print': () => window.print(), 'mc-run': () => { ui.mc.seed = (ui.mc.seed || 7) + 1; renderMain(); },
  // accounts
  'new-account': () => openAccountEditor(), 'edit-account': el => openAccountEditor(el.dataset.id), 'save-account': saveAccount,
  'acc-trades': el => { ui.account = el.dataset.id; go('trades'); },
  'del-account': el => { const id = el.dataset.id, n = state.trades.filter(t => t.accountId === id).length; if (n) { openModal({ title: L('บัญชีนี้มีเทรดอยู่', 'Account in use'), size: 'sm', body: `<p class="muted">${L(`มี ${n} เทรดในบัญชีนี้ แนะนำให้ "เก็บถาวร" แทนการลบ เพื่อรักษาประวัติ`, `${n} trades use this account. Archive it instead to keep history.`)}</p>`, foot: `${btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost')}${btn(L('เก็บถาวร', 'Archive'), 'archive-account', { 'data-id': id }, 'primary')}` }); return; } confirmDialog(L('ลบบัญชี?', 'Delete account?'), '', async () => { state.accounts = state.accounts.filter(a => a.id !== id); state.transactions = state.transactions.filter(t => t.accountId !== id); if (ui.account === id) ui.account = ''; await changed(L('ลบแล้ว', 'Deleted')); }, L('ลบ', 'Delete')); },
  'archive-account': async el => { get('accounts', el.dataset.id).active = false; closeModal(); await changed(L('เก็บถาวรแล้ว', 'Archived')); },
  'new-txn': el => openTxnEditor('', el.dataset.acc), 'edit-txn': el => openTxnEditor(el.dataset.id), 'save-txn': saveTxn,
  'del-txn': el => confirmDialog(L('ลบรายการนี้?', 'Delete this transaction?'), '', async () => { state.transactions = state.transactions.filter(t => t.id !== el.dataset.id); await changed(L('ลบแล้ว', 'Deleted')); }, L('ลบ', 'Delete')),
  // settings
  'settings-tab': el => go('settings/' + el.dataset.value),
  'ed-input-clock': () => { const h = $('[data-ed-tz]'), from = edZone(); state.settings.inputClock = state.settings.inputClock === 'local' ? 'broker' : 'local'; persist(); const to = edZone(); convertEdTimes(from, to); if (h) { h.dataset.zone = to; h.dataset.key = ''; } updateLive(); },
  'time-view': el => { if (el.disabled) return; state.settings.timeView = el.dataset.value === 'broker' ? 'broker' : 'local'; changed(el.dataset.value === 'broker' ? L('แสดงเวลาโบรกเกอร์', 'Showing broker time') : L('แสดงเวลาเครื่อง', 'Showing local time')); },
  'save-general': async () => { const d = formData($('#gen-form')), s = state.settings; Object.assign(s, { language: d.language, theme: d.theme, timezone: d.timezone, timeView: d.timeView === 'broker' ? 'broker' : 'local', weekStart: +d.weekStart, dayBasis: d.dayBasis === 'entry' ? 'entry' : 'exit', currencyDecimals: +d.currencyDecimals, numberLocale: d.numberLocale, defaultAccount: d.defaultAccount, defaultUnit: d.defaultUnit, preferredRisk: num(d.preferredRisk) || 1, riskWarning: num(d.riskWarning) || 2 }); LANG = s.language; partCache.clear(); await changed(L('บันทึกการตั้งค่าแล้ว', 'Settings saved')); },
  'save-rules': async () => { const d = formData($('#rules-form')); state.settings.rules = { maxDailyLossPct: num(d.maxDailyLossPct) || 0, maxTradesPerDay: num(d.maxTradesPerDay) || 0, maxConsecLosses: num(d.maxConsecLosses) || 0, minRR: num(d.minRR) || 0, requireStop: !!d.requireStop }; await changed(L('บันทึกกฎแล้ว', 'Rules saved')); },
  'new-instrument': () => openInstrumentEditor(), 'edit-instrument': el => openInstrumentEditor(el.dataset.id), 'save-instrument': saveInstrument,
  'ins-derive': () => { const f = $('#ins-form'), dec = num(f.decimals.value), cs = num(f.contractSize.value); if (dec == null || !cs) return; f.tickSize.value = +(10 ** -dec).toPrecision(8); f.tickValue.value = +(cs * 10 ** -dec).toPrecision(10); updateInsPreview(); },
  'del-instrument': el => { const id = el.dataset.id; if (state.trades.some(t => t.instrumentId === id) || false) { toast(L('มีเทรดที่ใช้สินทรัพย์นี้ — ปิดการใช้งานแทน', 'In use — deactivate instead'), 'bad'); return; } confirmDialog(L('ลบสินทรัพย์?', 'Delete instrument?'), '', async () => { state.instruments = state.instruments.filter(i => i.id !== id); closeModal(true); await changed(L('ลบแล้ว', 'Deleted')); }, L('ลบ', 'Delete')); },
  'new-category': () => openCategoryEditor(), 'edit-category': el => openCategoryEditor(el.dataset.id),
  'save-category': async () => { const f = $('#cat-form'), d = formData(f); if (!d.name?.trim()) return toast(L('ใส่ชื่อ', 'Name required'), 'bad'); const ex = get('tagCategories', f.dataset.id); if (ex) Object.assign(ex, { name: d.name.trim(), color: d.color }); else state.tagCategories.push({ id: f.dataset.id, name: d.name.trim(), color: d.color }); closeModal(); await changed(L('บันทึกแล้ว', 'Saved')); },
  'del-category': el => { const id = el.dataset.id; if (state.tags.some(t => t.categoryId === id)) return toast(L('ย้ายหรือลบแท็กในหมวดนี้ก่อน', 'Move or delete its tags first'), 'bad'); state.tagCategories = state.tagCategories.filter(c => c.id !== id); closeModal(); changed(L('ลบแล้ว', 'Deleted')); },
  'edit-tag': el => openTagEditor(el.dataset.id), 'save-tag': saveTag,
  'del-tag': el => { const id = el.dataset.id, n = state.trades.filter(t => t.tags?.includes(id)).length; confirmDialog(L('ลบแท็ก?', 'Delete tag?'), n ? L(`จะถูกลบออกจาก ${n} เทรด — ปิดใช้งานแทนได้หากต้องการเก็บประวัติ`, `Removes it from ${n} trades — deactivate to keep history`) : '', async () => { state.tags = state.tags.filter(t => t.id !== id); for (const k of ['trades', 'plans']) state[k].forEach(t => t.tags = (t.tags || []).filter(x => x !== id)); state.playbooks.forEach(p => p.relevantTagIds = (p.relevantTagIds || []).filter(x => x !== id)); closeModal(true); await changed(L('ลบแท็กแล้ว', 'Tag deleted')); }, L('ลบ', 'Delete')); },
};
Object.assign(A, ICON_ACTIONS, EXEC_ACTIONS, TPL_ACTIONS, GUARD_ACTIONS, NOTE_ACTIONS, TOOL_ACTIONS, STRATEGY_ACTIONS, TBL_ACTIONS, AB_ACTIONS, CLOUD_ACTIONS, WS_ACTIONS, SPEC_ACTIONS);
A['conflict-reload'] = () => { conflictOpen = false; reloadFromDB(L('โหลดข้อมูลล่าสุดแล้ว', 'Latest data loaded')); };
A['conflict-overwrite'] = () => { closeModal(); conflictOpen = false; dirty = true; flushSave(true).then(ok => ok && toast(L('บันทึกทับแล้ว', 'Overwritten'))); };
function runAction(name, el, e) { const fn = A[name]; if (fn) { try { const r = fn(el, e || { preventDefault() { }, stopPropagation() { }, target: el }); if (r?.catch) r.catch(err => { console.error(err); toast(err.message, 'bad'); }); } catch (err) { console.error(err); toast(err.message, 'bad'); } } }
function rteCommand(cmd, target = 'note-rich') {
  const ed = $('#' + target); if (!ed) return; ed.focus(); const after = () => { if (target === 'note-rich') saveNote(); };
  if (['h2', 'h3', 'blockquote'].includes(cmd)) document.execCommand('formatBlock', false, cmd);
  else if (cmd === 'table') { const sl = window.getSelection(); if (sl?.rangeCount && rteCellOf(sl.anchorNode)) { toast(L('อยู่ในตารางแล้ว — ใช้แถบเครื่องมือตารางเพื่อเพิ่มแถวหรือคอลัมน์', 'Already in a table — use the table toolbar to add rows or columns')); return; } document.execCommand('insertHTML', false, '<table><tbody>' + '<tr><td><br></td><td><br></td><td><br></td></tr>'.repeat(3) + '</tbody></table><p><br></p>'); }
  else if (cmd === 'checklist') { rteChecklist(ed); return; }
  else if (cmd === 'hr') document.execCommand('insertHorizontalRule');
  else if (cmd === 'link') { const sel = window.getSelection(), range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null; promptDialog(L('แทรกลิงก์', 'Insert link'), 'URL', 'https://', u => { if (!u || !/^(https?:|mailto:)/i.test(u)) return; ed.focus(); if (range) { sel.removeAllRanges(); sel.addRange(range); } if (range && !range.collapsed) document.execCommand('createLink', false, u); else document.execCommand('insertHTML', false, `<a href="${esc(u)}">${esc(u)}</a>`); after(); }); return; }
  else if (cmd === 'image') { pickFile('image/*', async f => { const { data } = await compressImage(f, 1400, .85); ed.focus(); document.execCommand('insertImage', false, data); after(); }); return; }
  else document.execCommand(cmd);
  after();
}

/* ---------- event wiring ---------- */
function wire() {
  document.addEventListener('click', e => {
    if (!e.target.closest('details.menu')) $$('details.menu[open]').forEach(d => d.removeAttribute('open'));
    else if (e.target.closest('.menu-item')) e.target.closest('details.menu')?.removeAttribute('open');
    if (!e.target.closest('.combo')) $$('.combo-list').forEach(l => l.hidden = true);
    const back = e.target.classList?.contains('modal-back') ? e.target : null; if (back && modalStack.length) { const top = topModal(); if (back === top && isFormModal(top)) { const box = top.querySelector('.modal'); box?.classList.remove('nudge'); void box?.offsetWidth; box?.classList.add('nudge'); } else closeModal(); return; }
    { const gEl = e.target.closest('[data-gloss]'); if (gEl) showGloss(gEl); else hideGloss(); } // tap support for definitions
    const el = e.target.closest('[data-action]'), inMenu = e.target.closest('details.menu');
    if (inMenu && el && el !== inMenu && el.contains(inMenu)) return; // open the ⋯ menu, not the card/row behind it
    { const sw = e.target.closest('label.switch'); if (sw && el && !sw.contains(el) && el.contains(sw)) return; } // flip the switch, not the row behind it
    if (el) { if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault(); if (el.matches('input[type=checkbox]') && !['sel-row', 'sel-page'].includes(el.dataset.action)) return; runAction(el.dataset.action, el, e); return; }
    const row = e.target.closest('tr[data-row]'); if (row && !e.target.closest('details,input,button,a')) tradeDetail(row.dataset.row);
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (iconFieldInput(t)) return;
    if (t.dataset.ui && ['search', 'noteSearch', 'insSearch'].includes(t.dataset.ui)) { ui[t.dataset.ui] = t.value; ui.page = 1; debouncedMain(t); return; }
    if (t.matches('[data-combo-input]')) { renderCombo(t); return; }
    if (t.closest('#editor-form')) { if (t.name === 'commission' && editor) editor.commTouched = true; updateLive(); return; }
    if (t.closest('#calc-form')) { refreshForm(t); return; }
    if (t.id === 'f_rsz') { updateRiskSize(); return; }
    if (t.closest('#ins-form')) { insFormInput(t); return; }
    if (t.id === 'note-title' || t.closest('#note-rich')) { saveNote(); return; }
    if (t.id === 'pal-q') { palSearch(t.value); return; }
    if (t.dataset.ruleGroup != null) { editor.rules[+t.dataset.ruleGroup].name = t.value; return; }
    if (t.dataset.ruleItem) { const [g, i] = t.dataset.ruleItem.split(':').map(Number); editor.rules[g].items[i].label = t.value; return; }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.ui && !['search', 'noteSearch', 'insSearch'].includes(t.dataset.ui)) {
      const k = t.dataset.ui; ui[k] = k === 'pageSize' ? +t.value : t.value;
      if (k === 'preset') { if (t.value === 'custom') { customRange(); return; } const [f, to] = presetRange(t.value); ui.from = f; ui.to = to; }
      ui.page = 1; ui.selected.clear(); savePrefs(); render(); return;
    }
    if (t.dataset.change === 'ab-keep') { abCfg().keep = +t.value; persist(); return; }
    if (t.dataset.chartUnit) { ui.chartUnits = { ...(ui.chartUnits || {}), [t.dataset.chartUnit]: t.value }; savePrefs(); renderMain(); return; }
    if (t.dataset.change === 'pb-active') { const pb = get('playbooks', t.dataset.id); if (pb) { pb.status = t.checked ? 'Active' : 'Inactive'; pb.updatedAt = now(); changed(t.checked ? L(`เปิดใช้ ${pb.name} แล้ว`, `${pb.name} active`) : L(`ปิด ${pb.name} แล้ว`, `${pb.name} inactive`)); } return; }
    if (t.dataset.change === 'ins-active') { const i = get('instruments', t.dataset.id); if (i) { i.active = t.checked; i.updatedAt = now(); changed(t.checked ? L(`เปิดใช้ ${i.symbol} แล้ว`, `${i.symbol} on`) : L(`ปิด ${i.symbol} แล้ว — ซ่อนจากตัวเลือก`, `${i.symbol} off — hidden from pickers`)); } return; }
    if (t.dataset.change === 'exec-toggle') { setExecMode(t.checked); return; }
    if (t.dataset.change === 'bd-hide') { ui.bdHideSmall = t.checked; savePrefs(); renderMain(); return; }
    if (t.dataset.change === 'cross-hide') { ui.crossHideSmall = t.checked; savePrefs(); renderMain(); return; }
    if (t.dataset.change === 'quick-reviewed') { const tr = get('trades', t.dataset.id); tr.reviewed = t.checked; tr.updatedAt = now(); persist(); toast(t.checked ? L('ทำเครื่องหมายรีวิวแล้ว', 'Marked reviewed') : L('ยกเลิกสถานะรีวิว', 'Unmarked')); return; }
    if (t.dataset.change === 'col-toggle') { const c = window.__cols; if (t.checked) c.push(t.dataset.k); else c.splice(c.indexOf(t.dataset.k), 1); window.__drawCols(); return; }
    if (t.dataset.change === 'what-if') { ui.whatIf = { ...(ui.whatIf || {}), [t.dataset.k]: t.checked }; renderMain(); return; }
    if (t.dataset.upload) { const [kind, id] = t.dataset.upload.split(':'); addImages(kind, id, [...t.files]); return; }
    if (t.dataset.cmp) { const key = t.dataset.cmp, k = t.dataset.k; ui[key] = { ...(ui[key] || {}), [k]: t.value }; if (t.value === '') delete ui[key][k]; renderMain(); return; }
    if (t.closest('#mc-form')) { const d = formData($('#mc-form')); ui.mc = { ...ui.mc, basis: d.basis, riskPct: num(d.riskPct) ?? ui.mc.riskPct, start: num(d.start), trades: clamp(num(d.trades) || 100, 10, 1000), runs: +d.runs || 500, ruin: clamp(num(d.ruin) || 30, 1, 100) }; savePrefs(); renderMain(); return; }
    if (t.closest('#editor-form') && t.name === 'playbookId') { const pb = get('playbooks', t.value); $('#ed-tags').innerHTML = tagPicker(editor.tags, pb?.relevantTagIds || []); updateLive(); return; }
    if (t.dataset.change === 'note-strat-add') { noteStrategyAdd(t); return; }
    if (t.closest('#editor-form')) updateLive(); if (t.closest('#calc-form')) updateCalc();
  });
  document.addEventListener('keydown', e => {
    const t = e.target, typing = t.matches('input,textarea,select,[contenteditable=true]');
    if (t.matches('[data-combo-input]')) { const list = t.closest('.combo').querySelector('.combo-list'), opts = [...list.querySelectorAll('.combo-opt')]; let i = opts.findIndex(o => o.classList.contains('act')); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (list.hidden) renderCombo(t); i = clamp(i + (e.key === 'ArrowDown' ? 1 : -1), 0, opts.length - 1); opts.forEach((o, k) => o.classList.toggle('act', k === i)); opts[i]?.scrollIntoView({ block: 'nearest' }); return; } if (e.key === 'Enter') { e.preventDefault(); if (!list.hidden && opts[i]) opts[i].click(); return; } }
    if ($('#pal-q') && document.activeElement === $('#pal-q')) { if (e.key === 'ArrowDown') { e.preventDefault(); palIdx = Math.min(palItems.length - 1, palIdx + 1); drawPal(); return; } if (e.key === 'ArrowUp') { e.preventDefault(); palIdx = Math.max(0, palIdx - 1); drawPal(); return; } if (e.key === 'Enter') { e.preventDefault(); palRun(palIdx); return; } }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if ($('[data-modal="pal"]')) closeModal(); else openPalette(); return; }
    if (e.key === 'Enter' && t.id === 'f_promptv') { e.preventDefault(); A['prompt-ok'](); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { const m = topModal(); const b = m?.querySelector('.modal-f .btn.primary'); if (b) { e.preventDefault(); b.click(); } return; }
    if (e.key === 'Escape') { if ($('.lightbox')) { $('.lightbox').remove(); return; } if ($$('.combo-list:not([hidden])').length) { $$('.combo-list').forEach(l => l.hidden = true); return; } if (requestCloseModal()) return; if (closeDrawer()) return; $('#shell')?.classList.remove('navopen'); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || modalStack.length) return;
    if (drawerState?.kind === 'trade' && (e.key === '[' || e.key === ']')) { const b = $$('#drawer-root [data-action="view-trade"]')[e.key === '[' ? 0 : 1]; if (b && !b.disabled) b.click(); return; }
    if (wire.g) { wire.g = false; const r = { d: 'dashboard', t: 'trades', j: 'notes/journal', r: 'reports', p: 'playbooks', n: 'notes', a: 'accounts', s: 'settings', i: 'reports/insights', c: 'reports/calendar', m: 'reports/simulation'}[e.key.toLowerCase()]; if (r) go(r); else if (e.key.toLowerCase() === 'k') sizeCalculator(); return; }
    if (e.key === 'g') { wire.g = true; setTimeout(() => wire.g = false, 900); return; }
    if (e.key === 'n') { e.preventDefault(); openTradeEditor(); } else if (e.key === 'j') go('notes/journal/' + todayKey()); else if (e.key === 'c') { e.preventDefault(); sizeCalculator(); } else if (e.key === '/') { const s = $('[data-ui="search"]'); if (s) { e.preventDefault(); s.focus(); } else { e.preventDefault(); openPalette(); } }
  });
  document.addEventListener('focusin', e => { if (e.target.matches?.('[data-combo-input]')) { e.target.select(); renderCombo(e.target); } });
  document.addEventListener('mousemove', e => { const gEl = e.target.closest?.('[data-gloss]'); if (gEl) { showGloss(gEl); return; } hideGloss(); onChartMove(e); const tip = e.target.closest?.('[data-tip]'); if (tip && !e.target.closest('[data-chart]')) { const txt = tip.dataset.tip; chartTip(esc(txt).replace(/\n/g, '<br>'), e.clientX, e.clientY); } else if (!e.target.closest?.('[data-chart]')) chartTip(''); });
  document.addEventListener('focusin', e => { const g = e.target.closest?.('[data-gloss]'); if (g) showGloss(g); });
  document.addEventListener('focusout', e => { if (e.target.closest?.('[data-gloss]')) hideGloss(); });
  document.addEventListener('scroll', () => { const a = document.activeElement?.closest?.('[data-gloss]'); if (a) showGloss(a); else hideGloss(); }, true);
  document.addEventListener('mouseout', e => { if (e.target.closest?.('[data-chart]') && !e.relatedTarget?.closest?.('[data-chart]')) onChartLeave(e); });
  // drag & drop / paste images
  document.addEventListener('dragover', e => { const z = e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
  document.addEventListener('dragleave', e => e.target.closest?.('[data-drop]')?.classList.remove('over'));
  document.addEventListener('drop', e => { const z = e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('over'); const [kind, id] = z.dataset.drop.split(':'); addImages(kind, id, [...e.dataTransfer.files]); });
  document.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/')); if (!files.length) return;
    const rich = e.target.closest?.('.rich[contenteditable]'); if (rich) { e.preventDefault(); compressImage(files[0], 1400, .85).then(({ data }) => { document.execCommand('insertImage', false, data); if (rich.id === 'note-rich') saveNote(); }); return; }
    const zone = $('#editor-shots [data-drop]') || $('#drawer-root [data-drop]') || $('#main [data-drop]'); if (!zone) return; e.preventDefault(); const [kind, id] = zone.dataset.drop.split(':'); addImages(kind, id, files);
  });
  window.addEventListener('hashchange', onRoute);
  window.addEventListener('beforeunload', e => { if (editor && modalStack.length) { e.preventDefault(); e.returnValue = ''; } });
}
const debouncedMain = debounce(t => { const id = t.dataset.ui, pos = t.selectionStart; renderMain(); const n = $(`[data-ui="${id}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch { } } }, 220);

/* ---------- init ---------- */
async function init() {
  if (CLOUD) { const me = await cloudMe(); if (!me.authed && !me.offline) { cloudLoginView(me); return; } }
  try { state = await loadState(); } catch (e) { if (CLOUD && e.status === 401) { cloudLoginView({}); return; } throw e; } await loadDrafts(); reindex(); LANG = state.settings.language || 'th'; loadPrefs();
  if (!ui.preset || ui.preset === 'all') { ui.from = ''; ui.to = ''; }
  if (!localStorage.getItem(UI_KEY) && state.settings.defaultUnit) ui.unit = state.settings.defaultUnit;
  wire(); setupSync(); ui.route = decodeURIComponent(location.hash.slice(1)) || 'dashboard'; wsInit(); wsOnRoute(ui.route); render();
  if (initProblem) openModal({ title: L('กู้คืนข้อมูลไม่สำเร็จ', 'Could not load saved data'), size: 'sm', body: `<p class="muted">${esc(initProblem)}</p>`, foot: btn('OK', 'close-modal', {}, 'primary') });
  if (state.meta.specReview?.length && !initProblem) setTimeout(() => { if (!specReviewDialog(state.meta.specReview, L('อัปเดตสเปกดัชนีแล้ว: 1 ล็อต = 100 ต่อ 1 จุด (0.1 ล็อต = 10 ต่อจุด) เทรดเดิมยังคิดเงินเหมือนเดิมทุกไม้ จนกว่าคุณจะเลือกด้านล่าง', 'Index specs updated: 1 lot = 100 per point (0.1 lot = 10 per point). Existing trades keep their money exactly as before until you choose below.'))) { delete state.meta.specReview; persist(); } }, 400);
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => { });
  startAutoBackup();
  if (CLOUD) cloudStart();
}
init();
