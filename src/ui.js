/* ============================================================
   UI PRIMITIVES — icons, buttons, overlays, form controls
   ============================================================ */
const MOD_KEY = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '') ? '⌘' : 'Ctrl';
const icon = (n, cls = '') => `<svg class="icon${n === 'star' ? ' icon-fill' : ''} ${cls}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">${ICONS[n] || ICONS.grid}</svg>`; // v3.65 — Google Material Symbols (outlined)
const attrs = o => Object.entries(o || {}).filter(([, v]) => v != null && v !== false).map(([k, v]) => v === true ? k : `${k}="${esc(v)}"`).join(' ');
function btn(label, action, extra = {}, cls = '') { return `<button type="button" class="btn ${cls}" data-action="${action}" ${attrs(extra)}>${label}</button>`; }
function ibtn(ic, action, title, extra = {}, cls = '') { return `<button type="button" class="btn icon-only ghost ${cls}" data-action="${action}" aria-label="${esc(title)}" data-tip="${esc(title)}" ${attrs(extra)}>${icon(ic)}</button>`; }
function opt(v, label, cur) { return `<option value="${esc(v)}" ${String(v) === String(cur ?? '') ? 'selected' : ''}>${esc(label)}</option>`; }
function options(list, cur, empty) { return (empty != null ? opt('', empty, cur) : '') + list.map(x => Array.isArray(x) ? opt(x[0], x[1], cur) : opt(x, x, cur)).join(''); }
function entityOptions(kind, cur, empty, filter = x => x.active !== false || x.id === cur) { const label = r => kind === 'instruments' ? r.symbol : r.name; return (empty != null ? opt('', empty, cur) : '') + state[kind].filter(filter).slice().sort((a, b) => label(a).localeCompare(label(b))).map(r => opt(r.id, label(r) + (r.active === false ? L(' (เก็บถาวร)', ' (archived)') : ''), cur)).join(''); }
function empty(title, text = '', action = '', ic = 'sparkles') { return `<div class="empty"><div class="empty-ic">${icon(ic)}</div><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action ? `<div class="row center">${action}</div>` : ''}</div>`; }
/* v3.47 — per-chart unit: each chart can show P&L / R / % / pips / points on its own (else follows the top bar) */
const CHART_UNITS = () => [['P&L', 'P&L'], ['R', 'R-Multiple'], ['%', '%'], ['Pips', L('ปิ๊บ', 'Pips')], ['Points', L('จุด', 'Points')]];
const chartUnit = key => { const v = ui.chartUnits?.[key]; return ['P&L', 'R', '%', 'Pips', 'Points'].includes(v) ? v : ui.unit; };
function unitPick(key) { const v = chartUnit(key); return `<select class="tsel sm unit-pick ${ui.chartUnits?.[key] ? 'set' : ''}" data-chart-unit="${key}" aria-label="${L('หน่วยของกราฟนี้', 'Unit for this chart')}">${CHART_UNITS().map(([k, l]) => opt(k, l, v)).join('')}</select>`; }
/* build a panel with ui.unit temporarily set to this chart's unit, and put the unit picker in its header */
function U(key, fn) { const s = ui.unit; ui.unit = chartUnit(key); let html; try { html = fn(ui.unit); } finally { ui.unit = s; } return html.replace('<div class="panel-tools">', `<div class="panel-tools">${unitPick(key)}`); }
function panel(title, body, tools = '', cls = '', sub = '') { return `<section class="panel ${cls}">${title != null ? `<header class="panel-h"><div><h3>${title}</h3>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="panel-tools">${tools}</div></header>` : ''}<div class="panel-b">${body}</div></section>`; }
function pageHead(title, sub = '', actions = '') { return `<div class="pagehead"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="row wrap gap8">${actions}</div></div>` + (typeof scopeBar === 'function' && SCOPE_ROOTS.includes(routeRoot()) && !pageHead._done ? (pageHead._done = true, scopeBar()) : ''); }
function tabs(items, cur, action, extra = '') { return `<div class="tabs" role="tablist">${items.map(([v, l, ic]) => `<button type="button" role="tab" class="tab ${String(v) === String(cur) ? 'on' : ''}" data-action="${action}" data-value="${esc(v)}" ${extra}>${ic ? icon(ic) : ''}${esc(l)}</button>`).join('')}</div>`; }
function seg(items, cur, action, extra = '') { return `<div class="seg" role="group">${items.map(([v, l]) => `<button type="button" class="${String(v) === String(cur) ? 'on' : ''}" data-action="${action}" data-value="${esc(v)}" ${extra}>${l}</button>`).join('')}</div>`; }
function menu(items, label = L('เพิ่มเติม', 'More'), ic = 'ellipsis') { return `<details class="menu"><summary class="btn icon-only ghost" aria-label="${esc(label)}">${icon(ic)}</summary><div class="menu-pop">${items.filter(Boolean).join('')}</div></details>`; }
function menuItem(label, action, extra = {}, ic = '', cls = '') { return `<button type="button" class="menu-item ${cls}" data-action="${action}" ${attrs(extra)}>${ic ? icon(ic) : ''}<span>${label}</span></button>`; }
function badge(text, cls = '') { return `<span class="badge ${cls}">${text}</span>`; }
function sideBadge(side) { return `<span class="side ${side === 'Buy' ? 'long' : 'short'}">${side === 'Buy' ? 'LONG' : 'SHORT'}</span>`; }
function statusBadge(s) { const m = { Open: ['open', L('เปิดอยู่', 'Open')], Closed: ['', L('ปิดแล้ว', 'Closed')], Void: ['void', L('ยกเลิก', 'Void')], Draft: ['', L('ร่าง', 'Draft')], Ready: ['open', L('พร้อมเข้า', 'Ready')], Converted: ['ok', L('เปิดออเดอร์แล้ว', 'Executed')], Cancelled: ['void', L('ยกเลิก', 'Cancelled')], Missed: ['warn', L('พลาดจังหวะ', 'Missed')] }[s] || ['', s]; return badge(m[1], 'st ' + m[0]); }
function stars(n, action = '', name = '') { return `<span class="stars ${action ? 'input' : ''}" ${name ? `data-name="${name}"` : ''}>${[1, 2, 3, 4, 5].map(i => action ? `<button type="button" data-action="${action}" data-value="${i}" class="${i <= (n || 0) ? 'on' : ''}" aria-label="${i}">${icon(i <= (n || 0) ? 'star' : 'star-o')}</button>` : `<i class="${i <= (n || 0) ? 'on' : ''}">${icon(i <= (n || 0) ? 'star' : 'star-o')}</i>`).join('')}</span>`; }

/* instrument icons (reuses the EdgeDesk icon library) */
const FLAG = { USD: 'us', EUR: 'eu', GBP: 'gb', JPY: 'jp', AUD: 'au', CAD: 'ca', CHF: 'ch', NZD: 'nz', HKD: 'hk', CNY: 'cn', SGD: 'sg', THB: 'th' };
const ASSET_LIB = { ADA: 'crypto-ada', BNB: 'crypto-bnb', BTC: 'crypto-btc', DOGE: 'crypto-dog', ETH: 'crypto-eth', SOL: 'crypto-sol', TRX: 'crypto-trx', USDC: 'crypto-usdc', USDT: 'crypto-usdt', XRP: 'crypto-xrp', XAU: 'cfd-xau', XAG: 'cfd-xag', CL: 'cfd-cl', NG: 'cfd-ng', META: 'stock-meta', GOOGL: 'stock-googl', NDVA: 'stock-ndva', NVDA: 'stock-ndva', TSLA: 'stock-tsla', BABA: 'stock-baba', APPL: 'stock-appl', AAPL: 'stock-appl', MSFT: 'stock-msft', AMD: 'stock-amd', AMZN: 'stock-amzn' };
const INDEX_FLAG = { AU200: 'au', DE40: 'de', DE50: 'de', GER40: 'de', EU50: 'eu', FR40: 'fr', IT40: 'it', JP225: 'jp', HK50: 'hk', UK100: 'gb', US30: 'us', US500: 'us', US2000: 'us', USTECH: 'us', NAS100: 'us', SPX500: 'us' };
function libSlot(code) { const uri = typeof ICON_LIBRARY !== 'undefined' && ICON_LIBRARY[code]; return uri ? `<img src="${uri}" alt="" loading="lazy">` : ''; }
function legacySlot(slot) { const s = String(slot?.src || ''); if (s.startsWith('lib:')) return libSlot(s.slice(4)); if (s.startsWith('data:image/')) return `<img src="${s}" alt="">`; const txt = s.startsWith('text:') ? s.slice(5) : s; return txt ? `<b>${esc(txt)}</b>` : icon('circle-dashed'); }
function insIcon(ins, size = '') {
  if (!ins) return `<span class="ins-ic ${size}"><span class="disc"><b>?</b></span></span>`;
  const cfg = iconConfigOf(ins);
  if (cfg) { const pair = cfg.mode === 'Pair' && cfg.second?.src; const bg = s => s?.bg ? `background:${esc(s.bg)}` : ''; return `<span class="ins-ic ${size} ${pair ? 'pair' : ''}"><span class="disc" style="${bg(cfg.first)}">${slotHTML(cfg.first)}</span>${pair ? `<span class="disc d2" style="${bg(cfg.second)}">${slotHTML(cfg.second)}</span>` : ''}</span>`; }
  const sym = String(ins.symbol || '').toUpperCase(), base = String(ins.baseCurrency || '').toUpperCase(), quote = String(ins.quoteCurrency || '').toUpperCase();
  let a = '', b = '';
  if (ins.assetClass === 'Forex') { a = libSlot(FLAG[base]); b = libSlot(FLAG[quote]); }
  else if (ins.assetClass === 'Cryptocurrencies') { a = libSlot(ASSET_LIB[base || sym.replace(/(USDT|USDC|USD)$/, '')]); b = libSlot(FLAG[quote] || ASSET_LIB[quote]); }
  else if (ASSET_LIB[base] || ASSET_LIB[sym.slice(0, 3)]) { a = libSlot(ASSET_LIB[base] || ASSET_LIB[sym.slice(0, 3)]); b = libSlot(FLAG[quote]); }
  else if (/OIL|WTI|BRENT/.test(sym)) { a = libSlot('cfd-cl'); b = libSlot('us'); }
  else if (ins.assetClass === 'Indices') { a = libSlot(INDEX_FLAG[sym] || FLAG[quote]); }
  else if (ins.assetClass === 'Stocks') { a = libSlot(ASSET_LIB[sym]); }
  if (!a) a = sym ? `<b>${esc(sym.slice(0, 2))}</b>` : icon('circle-dashed');
  return `<span class="ins-ic ${size} ${b ? 'pair' : ''}"><span class="disc">${a}</span>${b ? `<span class="disc d2">${b}</span>` : ''}</span>`;
}
function symbolCell(id, sub = '') { const i = get('instruments', id); return `<span class="sym">${insIcon(i)}<span><strong>${esc(i?.symbol || '—')}</strong>${sub ? `<small>${sub}</small>` : ''}</span></span>`; }
function tagChip(id, removable = false) { const t = get('tags', id); if (!t) return ''; const cat = get('tagCategories', t.categoryId); return `<span class="chip ${t.categoryId === 'cat_mistakes' ? 'mistake' : ''}" style="--c:${esc(cat?.color || 'var(--accent)')}">${esc(tagName(t))}${removable ? `<button type="button" data-action="tag-remove" data-id="${t.id}" aria-label="remove">×</button>` : ''}</span>`; }
function tagsHTML(ids, max = 3) { ids = ids || []; return `<span class="chips">${ids.slice(0, max).map(id => tagChip(id)).join('')}${ids.length > max ? `<span class="chip more">+${ids.length - max}</span>` : ''}</span>`; }

/* overlays */
let modalStack = [], returnFocus = null;
function openModal({ title, body, foot = '', size = '', cls = '', onClose = null, dismiss = true, guard = false, draft = null, fromDraft = null, saved = false, center = null, head = '' }) {
  // v3.53: display and edit windows slide in from the right; short yes/no prompts stay centred
  if (center == null) center = size === 'sm' && !/<(input|select|textarea|form)\b/i.test(String(body));
  returnFocus = document.activeElement;
  const id = 'm' + Date.now() + modalStack.length;
  const html = `<div class="modal-back ${center ? 'centered' : 'sheet'}" data-modal="${id}"><section class="modal ${size} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(String(title).replace(/<[^>]+>/g, ''))}"><header class="modal-h"><h2>${title}</h2>${head ? `<div class="modal-hx">${head}</div>` : ''}${ibtn('x', 'close-modal', L('ปิด', 'Close'))}</header><div class="modal-b">${body}</div>${foot ? `<footer class="modal-f">${guard || draft ? '<span class="ed-state"></span>' : ''}${foot}</footer>` : ''}</section></div>`;
  $('#modal-root').insertAdjacentHTML('beforeend', html); const entry = { id, onClose, dismiss, guard: guard || !!draft, draft, fromDraft, saved }; modalStack.push(entry);
  const el = $(`[data-modal="${id}"]`); mountCharts(el); armGuard(entry, el);
  setTimeout(() => (el.querySelector('[autofocus]') || el.querySelector('input:not([type=hidden]),select,textarea,button.primary'))?.focus(), 30);
  return el;
}
function closeModal(all = false) {
  if (!modalStack.length) return false;
  do { const m = modalStack.pop(); $(`[data-modal="${m.id}"]`)?.remove(); m.onClose?.(); } while (all && modalStack.length);
  if (!modalStack.length) { try { returnFocus?.focus(); } catch { } }
  return true;
}
function topModal() { const m = modalStack[modalStack.length - 1]; return m ? $(`[data-modal="${m.id}"]`) : null; }
function confirmDialog(title, text, onYes, yesLabel = L('ยืนยัน', 'Confirm'), danger = true) {
  window.__confirm = onYes;
  openModal({ title, size: 'sm', body: `<p class="muted">${text}</p>`, foot: btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost') + btn(yesLabel, 'confirm-yes', { autofocus: true }, danger ? 'danger-solid' : 'primary') });
}
function promptDialog(title, label, value, onOk) {
  window.__prompt = onOk;
  openModal({ title, size: 'sm', center: true, body: `<form onsubmit="return false" id="prompt-form">${field('promptv', label, value || '', 'text', { attrs: 'autofocus' })}</form>`, foot: btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost') + btn(L('ตกลง', 'OK'), 'prompt-ok', {}, 'primary') });
}
let drawerState = null;
function openDrawer({ title, body, foot = '', wide = false, kind = '', id = '', dialog = false, cls = '' }) {
  const again = !!$('#drawer-root .drawer-back.in'); drawerState = { kind, id }; returnFocus ??= document.activeElement;
  $('#drawer-root').innerHTML = `<div class="drawer-back ${dialog ? 'as-dialog' : ''} ${again ? 'in' : ''}" data-action="close-drawer-bg"><aside class="drawer ${wide ? 'wide' : ''} ${dialog ? 'dlg' : ''} ${cls}" role="dialog" aria-modal="true"><header class="drawer-h">${title}</header><div class="drawer-b">${body}</div>${foot ? `<footer class="drawer-f">${foot}</footer>` : ''}</aside></div>`;
  requestAnimationFrame(() => $('#drawer-root .drawer-back')?.classList.add('in')); mountCharts($('#drawer-root'));
}
function closeDrawer() { const el = $('#drawer-root .drawer-back'); if (!el) return false; drawerState = null; el.classList.remove('in'); setTimeout(() => { if (!drawerState) $('#drawer-root').innerHTML = ''; }, 180); return true; }
function toast(msg, kind = '') { const el = document.createElement('div'); el.className = 'toast ' + kind; el.innerHTML = `${icon(kind === 'bad' ? 'alert' : 'check')}<span>${esc(msg)}</span>`; $('#toasts').appendChild(el); setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3000); }

/* v3.18 — delete with undo: the item is removed at once, kept in memory for 10 s, and
   anything irreversible (screenshots) is only cleaned up when the undo window closes */
const pendingFinal = new Set();
function undoToast(msg, undo, finalize = null) {
  const el = document.createElement('div'); el.className = 'toast undo';
  el.innerHTML = `${icon('trash')}<span>${esc(msg)}</span><button type="button" class="btn sm ghost undo-btn">${icon('undo')}${L('เลิกทำ', 'Undo')}</button><i class="undo-bar"></i>`;
  let done = false; const fin = () => { if (done) return; done = true; pendingFinal.delete(fin); el.classList.add('out'); setTimeout(() => el.remove(), 300); try { finalize?.(); } catch { } };
  pendingFinal.add(fin);
  el.querySelector('.undo-btn').onclick = async ev => { ev.stopPropagation(); if (done) return; done = true; pendingFinal.delete(fin); el.remove(); await undo(); toast(L('กู้คืนแล้ว', 'Restored')); };
  $('#toasts').appendChild(el); setTimeout(fin, 10000);
}
window.addEventListener('pagehide', () => { for (const f of [...pendingFinal]) f(); });

/* form fields */
function field(name, label, val = '', type = 'text', o = {}) {
  const id = 'f_' + name, req = o.required ? 'required' : '', help = o.help ? `<small class="help">${o.help}</small>` : '';
  let input;
  if (type === 'select') input = `<select id="${id}" name="${name}" ${req} ${o.attrs || ''}>${o.html || options(o.options || [], val, o.empty)}</select>`;
  else if (type === 'textarea') input = `<textarea id="${id}" name="${name}" rows="${o.rows || 3}" placeholder="${esc(o.placeholder || '')}" ${o.attrs || ''}>${esc(val)}</textarea>`;
  else input = `<input id="${id}" name="${name}" type="${type}" value="${esc(val ?? '')}" ${type === 'number' ? `step="${o.step || 'any'}" inputmode="decimal"` : ''} placeholder="${esc(o.placeholder || '')}" ${req} ${o.attrs || ''}>`;
  if (o.suffix) input = `<div class="input-affix"><span class="affix">${o.suffix === '%' ? '%' : o.suffix}</span>${input}</div>`; // v3.77: unit box on the left ($ / ¢ / %)
  const tip = o.tip ? ` <span class="info-tip" ${o.tipId ? `id="${o.tipId}"` : ''} data-tip="${esc(o.tip)}">${icon('info', 'tiny')}</span>` : '';
  return `<div class="field ${o.span ? 'span' + o.span : ''} ${o.cls || ''}"><label for="${id}">${label}${o.required ? ' <i class="req">*</i>' : ''}${tip}</label>${input}${help}</div>`;
}
function checkField(name, label, checked, help = '') { return `<label class="check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span class="box"></span><span>${label}${help ? `<small class="help">${help}</small>` : ''}</span></label>`; }
/* v3.73 — Active switch for a dialog header (sits left of ×); `form` ties it to the dialog's form */
function headToggle(name, checked, form, label = L('ใช้งาน', 'Active')) { return `<label class="mh-act"><span>${label}</span>${toggle(name, checked, '', `form="${form}"`)}</label>`; }
/* v3.73 — name field with the colour swatch right after it (no "Color" label) */
function nameColorField(label, name, color, o = {}) { return `<div class="field ${o.span ? 'span' + o.span : ''} nc-field"><label for="f_name">${label}${o.required ? ' <i class="req">*</i>' : ''}</label><div class="nc-row"><input id="f_name" name="name" type="text" value="${esc(name || '')}" ${o.required ? 'required' : ''} autofocus><input type="color" name="color" class="nc-sw" value="${esc(color || '#7b8bff')}" aria-label="${L('สี', 'Color')}" data-tip="${L('สี', 'Color')}"></div></div>`; }
function toggle(name, checked, action = '', extra = '') { return `<label class="switch"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''} ${action ? `data-change="${action}"` : ''} ${extra}><span></span></label>`; }
function formData(form) {
  const o = {}; new FormData(form).forEach((v, k) => { o[k] = v; });
  [...form.elements].filter(c => c.type === 'checkbox' && c.name).forEach(c => { o[c.name] = c.checked; }); return o;
}
/* currency dropdown grouped by kind; keeps an unknown stored code selectable */
function currencySelect(name, label, val, o = {}) {
  const v = String(val || '').toUpperCase(), groups = [['major', L('สกุลหลัก', 'Major')], ['asia', L('เอเชีย', 'Asia')], ['other', L('สกุลอื่น', 'Other')], ['crypto', L('คริปโต', 'Crypto')], ['metal', L('โลหะมีค่า', 'Metals')]];
  const known = CURRENCIES.some(c => c[0] === v), optOf = c => opt(c[0], `${c[0]} — ${L(c[1], c[2])}`, v);
  const html = (o.empty ? opt('', o.empty, v) : '') + (v && !known ? opt(v, v, v) : '') + groups.filter(([g]) => !o.only || o.only.includes(g)).map(([g, gl]) => `<optgroup label="${esc(gl)}">${CURRENCIES.filter(c => c[3] === g && (!isCent(c[0]) || c[0] === v)).map(optOf).join('')}</optgroup>`).join(''); // cent codes come from "Account units: Cent"
  return field(name, label, v, 'select', { html, help: o.help, cls: o.cls, attrs: o.attrs });
}
/* Local / Broker clock switch shown on the trade list and the daily journal */
function timeViewSeg() {
  const any = state.accounts.some(a => a.brokerTz), tip = any ? L('สลับการแสดงเวลาของเทรด: เวลาเครื่อง หรือเวลาเซิร์ฟเวอร์โบรกเกอร์ของแต่ละบัญชี', 'Show trade times in your local time or each account’s broker server time') : L('ตั้งเขตเวลาเซิร์ฟเวอร์ในหน้าแก้ไขบัญชีก่อน จึงจะสลับเป็นเวลาโบรกเกอร์ได้', 'Set a broker server timezone on an account first');
  /* v3.74 — icons instead of words: schedule = local time, globe clock = broker time (names in the tooltips) */
  const b = (v, ic, name) => `<button type="button" class="${timeView() === v ? 'on' : ''}" data-action="time-view" data-value="${v}" data-tip="${esc(name + (any ? '' : ' · ' + tip))}" aria-label="${esc(name)}" ${any ? '' : 'disabled'}>${icon(ic)}</button>`;
  return `<div class="tv-seg"><div class="seg tv-ic" role="group">${b('local', 'schedule', L('เวลาเครื่อง', 'Local time'))}${b('broker', 'globe-clock', L('เวลาโบรกเกอร์', 'Broker time'))}</div></div>`;
}
function instrumentPicker(name, cur, o = {}) {
  const ins = get('instruments', cur);
  /* v3.73 — o.all: adds an "All instruments" choice (blank value) and lists only instruments that have trades — used by Filters */
  return `<div class="field">${o.noLabel ? '' : `<label for="f_${name}_search">${L('สินทรัพย์', 'Instrument')} <i class="req">*</i></label>`}<div class="combo" data-combo="${name}" ${o.all ? `data-all="${esc(o.all)}"` : ''}><span class="combo-ic">${ins ? insIcon(ins) : icon('layers')}</span><input id="f_${name}_search" class="combo-input" autocomplete="off" value="${esc(ins?.symbol || '')}" placeholder="${o.all ? esc(o.all) : L('ค้นหาสัญลักษณ์…', 'Search symbol…')}" data-combo-input="${name}"><input type="hidden" name="${name}" value="${esc(cur || '')}"><div class="combo-list" hidden></div></div></div>`;
}
function comboResults(q) {
  q = q.trim().toUpperCase(); const used = new Map(); state.trades.forEach(t => used.set(t.instrumentId, (used.get(t.instrumentId) || 0) + 1));
  return state.instruments.filter(i => i.active !== false && (!q || i.symbol.includes(q) || (String(i.name || '') + ' ' + insName(i)).toUpperCase().includes(q))).sort((a, b) => (q && a.symbol.startsWith(q) ? -1 : 0) - (q && b.symbol.startsWith(q) ? -1 : 0) || (used.get(b.id) || 0) - (used.get(a.id) || 0) || a.symbol.localeCompare(b.symbol)).slice(0, 40);
}
function renderCombo(input) {
  const box = input.closest('.combo'), list = box.querySelector('.combo-list'), all = box.dataset.all, used = all ? new Set(state.trades.map(t => t.instrumentId)) : null, items = comboResults(input.value).filter(i => !used || used.has(i.id));
  const opts = (all && !input.value.trim() ? [`<button type="button" class="combo-opt act" data-action="combo-pick" data-id="">${icon('layers')}<strong>${esc(all)}</strong><small></small></button>`] : []).concat(items.map((i, k) => `<button type="button" class="combo-opt ${k === 0 && !(all && !input.value.trim()) ? 'act' : ''}" data-action="combo-pick" data-id="${i.id}">${insIcon(i)}<strong>${esc(i.symbol)}</strong><small>${esc(insName(i))}</small></button>`));
  list.innerHTML = opts.length ? opts.join('') : `<div class="combo-none">${L('ไม่พบ — เพิ่มได้ที่ ตั้งค่า → สินทรัพย์', 'Not found — add it in Instruments')}</div>`;
  list.hidden = false;
}
/* v3.74 — tags as a dropdown: the chosen tags sit in a field (× removes), the list opens below it grouped by category */
function tagPicker(selected, highlight = [], open = false) {
  const sel = new Set(selected), col = c => esc(c?.color || 'var(--accent)');
  const chips = selected.map(id => state.tags.find(t => t.id === id)).filter(Boolean).map(t => { const c = get('tagCategories', t.categoryId); return `<span class="chip ${t.categoryId === 'cat_mistakes' ? 'mistake' : ''}" style="--c:${col(c)}">${esc(tagName(t))}<button type="button" data-action="tag-toggle" data-id="${t.id}" aria-label="${L('เอาออก', 'Remove')}">×</button></span>`; }).join('');
  const groups = state.tagCategories.map(c => { const tags = state.tags.filter(t => t.categoryId === c.id && (t.active !== false || sel.has(t.id))); if (!tags.length) return ''; return `<div class="tagdd-h"><i style="background:${col(c)}"></i>${esc(catName(c))}</div>${tags.map(t => `<button type="button" class="tagdd-opt ${sel.has(t.id) ? 'on' : ''} ${highlight.includes(t.id) ? 'hl' : ''}" data-action="tag-toggle" data-id="${t.id}"><span class="tagdd-ck">${icon('check')}</span><span>${esc(tagName(t))}</span>${highlight.includes(t.id) ? `<small>${L('แนะนำ', 'Suggested')}</small>` : ''}</button>`).join('')}`; }).join('');
  return `<div class="tagpick tagdd" data-hl="${esc(JSON.stringify(highlight))}"><div class="tagdd-field ${open ? 'open' : ''}" data-action="tagdd-open" role="button" tabindex="0" aria-expanded="${open}">${chips || `<span class="tagdd-ph">${L('เลือกแท็ก…', 'Select tags…')}</span>`}<span class="tagdd-chev">${icon('chev-down')}</span></div><div class="tagdd-pop" ${open ? '' : 'hidden'}>${groups}<button type="button" class="tagdd-new" data-action="tag-quick-add">${icon('plus')} ${L('สร้างแท็กใหม่', 'New tag')}</button></div></div>`;
}
/* built-in tag / category names are stored in English and shown in Thai when the UI is Thai (a renamed one shows as typed) */
const TAG_TH = { 'Early Entry': 'เข้าเร็วเกินไป', 'Late Entry': 'เข้าช้าเกินไป', 'Early Exit': 'ออกเร็วเกินไป', 'Moved Stop': 'เลื่อน S/L', 'Oversized': 'ขนาดสัญญาใหญ่เกินไป', 'FOMO': 'FOMO (กลัวตกรถ)', 'No Setup / FOMO': 'FOMO (กลัวตกรถ)', 'Revenge Trade': 'เทรดแก้แค้น', 'Broke Rules': 'ทำผิดกฎ', 'Trending': 'ตลาดมีเทรนด์', 'Ranging': 'ตลาดไซด์เวย์', 'High Volatility': 'ผันผวนสูง', 'News Day': 'วันมีข่าว' };
const CAT_TH = { 'Mistakes': 'ความผิดพลาด', 'Market Context': 'บริบทตลาด', 'Setups': 'รูปแบบ (Setups)' };
function tagName(t) { const n = t?.name || ''; return LANG === 'th' && TAG_TH[n] || n; }
function catName(c) { const n = c?.name || ''; return LANG === 'th' && CAT_TH[n] || n; }
function emotionPicker(cur, action = 'emotion-pick') { return `<div class="emo emo-ic">${EMOTIONS.map(([k, th]) => `<button type="button" class="${cur === k ? 'on' : ''}" data-action="${action}" data-value="${k}" data-tip="${esc(L(th, k))}" aria-label="${esc(L(th, k))}">${emoji(k)}</button>`).join('')}</div>`; } // v3.74: emoji only, name in the tooltip
function kpi(label, val, sub = '', cls = '', tip = '') { const g = !tip && glossKeyOf(label); return `<div class="kpi ${cls}"><div class="kpi-l ${tip ? 'ul-tip' : ''}" ${tip ? `data-tip="${esc(tip)}"` : ''}>${g ? gl(label, g) : label}</div><div class="kpi-v">${val}</div>${sub ? `<div class="kpi-s">${sub}</div>` : ''}</div>`; }
function progress(pct, cls = '') { return `<div class="progress ${cls}"><span style="width:${clamp(finite(pct) ? pct : 0, 0, 100)}%"></span></div>`; }

/* ---------- editor tabs (trade / plan modals) ---------- */
function edTabsHTML(list, on = 'main') { return `<div class="ed-tabs" role="tablist">${list.map(([k, l, ic]) => `<button type="button" role="tab" data-action="ed-tab" data-tab="${k}" class="${k === on ? 'on' : ''}" aria-selected="${k === on}">${icon(ic)}<span>${l}</span></button>`).join('')}</div>`; }
function edTab(k) { const root = topModal() || document; if (!root.querySelector(`.ed-pane[data-pane="${k}"]`)) return; root.querySelectorAll('.ed-tabs button').forEach(b => { const on = b.dataset.tab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }); root.querySelectorAll('.ed-pane').forEach(p => p.hidden = p.dataset.pane !== k); const mb = root.querySelector('.modal-b'); if (mb) mb.scrollTop = 0; }
