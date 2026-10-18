/* ============================================================
   INSTRUMENT ICON EDITOR · PLAYBOOK NOTES · RICH TEXT TOOLBAR
   ============================================================ */
const ICON_CATS = () => [['flags', L('ธงประเทศ/สกุลเงิน', 'Flags & currencies')], ['crypto', L('คริปโต', 'Crypto')], ['cfd', L('สินค้าโภคภัณฑ์', 'Commodities')], ['stock', L('หุ้น', 'Stocks')], ['custom', L('ที่เคยอัปโหลด', 'Uploaded')]];
const ASSET_NAMES = { 'crypto-ada': 'ADA · Cardano', 'crypto-bnb': 'BNB', 'crypto-btc': 'BTC · Bitcoin', 'crypto-dog': 'DOGE · Dogecoin', 'crypto-eth': 'ETH · Ethereum', 'crypto-sol': 'SOL · Solana', 'crypto-trx': 'TRX · Tron', 'crypto-usdc': 'USDC', 'crypto-usdt': 'USDT · Tether', 'crypto-xrp': 'XRP', 'cfd-xau': 'XAU · Gold', 'cfd-xag': 'XAG · Silver', 'cfd-cl': 'CL · Crude oil', 'cfd-ng': 'NG · Natural gas', 'stock-meta': 'META', 'stock-googl': 'GOOGL', 'stock-ndva': 'NVDA', 'stock-tsla': 'TSLA', 'stock-baba': 'BABA', 'stock-appl': 'AAPL', 'stock-msft': 'MSFT', 'stock-amd': 'AMD', 'stock-amzn': 'AMZN' };
let regionNames = null;
function iconLabel(code) {
  if (ASSET_NAMES[code]) return ASSET_NAMES[code];
  const cur = Object.entries(FLAG).find(([, f]) => f === code)?.[0];
  try { regionNames ??= new Intl.DisplayNames([LANG === 'th' ? 'th' : 'en'], { type: 'region' }); const n = /^[a-z]{2}$/.test(code) ? regionNames.of(code.toUpperCase()) : ''; return (cur ? cur + ' · ' : '') + (n && n !== code.toUpperCase() ? n : code.toUpperCase()); } catch { return (cur ? cur + ' · ' : '') + code.toUpperCase(); }
}
const regionCache = {};
function regionName(code, lang) { try { regionCache[lang] ??= new Intl.DisplayNames([lang], { type: 'region' }); const n = regionCache[lang].of(code.toUpperCase()); return n && n !== code.toUpperCase() ? n : ''; } catch { return ''; } }
function iconSearchText(code) { const cur = Object.entries(FLAG).filter(([, f]) => f === code).map(([c]) => c).join(' '); return [code, ASSET_NAMES[code] || '', cur, /^[a-z]{2}$/.test(code) ? regionName(code, 'th') + ' ' + regionName(code, 'en') : ''].join(' ').toLowerCase(); }
function iconCat(code) { return code.startsWith('crypto-') ? 'crypto' : code.startsWith('cfd-') ? 'cfd' : code.startsWith('stock-') ? 'stock' : 'flags'; }
function defaultSlot(src = '') { return { src, bg: '', aspect: '1:1', zoom: 1, x: 50, y: 50, color: '' }; }
/* resolve the effective icon config (custom or automatic) for any instrument */
function iconConfigOf(ins) {
  const c = ins?.iconConfig;
  if (c && c.mode && c.mode !== 'Auto') return { mode: c.mode === 'Pair' ? 'Pair' : 'Single', first: { ...defaultSlot(), ...(c.first || {}) }, second: { ...defaultSlot(), ...(c.second || {}) } };
  if (!c && (ins?.iconMode === 'Single' || ins?.iconMode === 'Pair')) return { mode: ins.iconMode, first: defaultSlot(ins.iconMode === 'Single' ? ins.iconSingle : ins.iconLeft), second: defaultSlot(ins.iconRight || '') };
  return null;
}
function autoSlots(ins) {
  const sym = String(ins.symbol || '').toUpperCase(), base = String(ins.baseCurrency || '').toUpperCase(), quote = String(ins.quoteCurrency || '').toUpperCase();
  let a = '', b = '';
  if (ins.assetClass === 'Forex') { a = FLAG[base]; b = FLAG[quote]; }
  else if (ins.assetClass === 'Cryptocurrencies') { a = ASSET_LIB[base || sym.replace(/(USDT|USDC|USD)$/, '')]; b = FLAG[quote] || ASSET_LIB[quote]; }
  else if (ASSET_LIB[base] || ASSET_LIB[sym.slice(0, 3)]) { a = ASSET_LIB[base] || ASSET_LIB[sym.slice(0, 3)]; b = FLAG[quote]; }
  else if (/OIL|WTI|BRENT/.test(sym)) { a = 'cfd-cl'; b = 'us'; }
  else if (ins.assetClass === 'Indices') a = INDEX_FLAG[sym] || FLAG[quote];
  else if (ins.assetClass === 'Stocks') a = ASSET_LIB[sym];
  return { mode: b ? 'Pair' : 'Single', first: defaultSlot(a ? 'lib:' + a : (sym ? 'text:' + sym.slice(0, 2) : '')), second: defaultSlot(b ? 'lib:' + b : '') };
}
function slotHTML(slot) {
  const s = String(slot?.src || ''), z = Number(slot?.zoom || 1), x = Number(slot?.x ?? 50), y = Number(slot?.y ?? 50);
  const st = `object-position:${x}% ${y}%;transform:scale(${z});transform-origin:${x}% ${y}%`;
  if (s.startsWith('lib:')) { const uri = typeof ICON_LIBRARY !== 'undefined' && ICON_LIBRARY[s.slice(4)]; if (uri) return `<img src="${uri}" alt="" style="${st}">`; }
  if (s.startsWith('data:image/')) return `<img src="${s}" alt="" style="${st}">`;
  const txt = s.startsWith('text:') ? s.slice(5) : s;
  if (!txt) return icon('circle-dashed');
  return `<b style="${slot?.color ? 'color:' + esc(slot.color) + ';' : ''}font-size:${Math.round(9.5 * z)}px">${esc(txt)}</b>`;
}

/* ---------- editor ---------- */
let iconDraft = null;
function openIconEditor(insId) {
  const fromEditor = editor?.kind === 'instruments' && editor.record.id === insId, ins = fromEditor ? readInsDraft() : get('instruments', insId); if (!ins) return;
  const custom = iconConfigOf(ins), base = custom || autoSlots(ins);
  iconDraft = { insId, fromEditor, symbol: ins.symbol, ins: clone(ins), mode: custom ? base.mode : 'Auto', first: { ...base.first }, second: { ...base.second }, active: 'first', cat: 'flags', q: '' };
  const firstSrc = String(iconDraft.first.src); if (firstSrc.startsWith('lib:')) iconDraft.cat = iconCat(firstSrc.slice(4));
  openModal({ guard: true, title: icon('image') + L(' แก้ไขไอคอน · ', ' Edit icon · ') + esc(ins.symbol || ''), size: 'lg', cls: 'icon-editor', body: `<div id="ic-root"></div>`, foot: `${btn(icon('refresh') + L(' กลับเป็นอัตโนมัติ', ' Reset to automatic'), 'ic-auto', {}, 'ghost')}<div class="grow"></div>${btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost')}${btn(icon('save') + L(' ใช้ไอคอนนี้', ' Use this icon'), 'ic-save', {}, 'primary')}`, onClose: () => { iconDraft = null; } });
  drawIconEditor();
}
function readInsDraft() { const f = $('#ins-form'); const r = { ...editor.record }; if (!f) return r; const d = formData(f); return { ...r, symbol: String(d.symbol || r.symbol || '').toUpperCase(), assetClass: d.assetClass || r.assetClass, baseCurrency: String(d.baseCurrency || '').toUpperCase(), quoteCurrency: String(d.quoteCurrency || '').toUpperCase() }; }
function draftCfg() { return iconDraft.mode === 'Auto' ? autoSlots(iconDraft.ins) : { mode: iconDraft.mode, first: iconDraft.first, second: iconDraft.second }; }
function previewIcon(size) { return insIcon({ ...iconDraft.ins, iconConfig: { ...draftCfg(), mode: iconDraft.mode === 'Auto' ? draftCfg().mode : iconDraft.mode } }, size); }
function drawIconPreview() {
  const el = $('#ic-preview'); if (!el) return;
  el.innerHTML = `<div class="ic-stage">${previewIcon('xl')}</div>${iconDraft.mode === 'Pair' ? `<div class="ic-hint">${L('คลิกที่ไอคอนในภาพเพื่อเลือกตัวที่จะแก้ไข', 'Click an icon in the preview to edit it')}</div>` : ''}<div class="ic-samples"><span class="sym">${previewIcon('')}<span><strong>${esc(iconDraft.symbol)}</strong><small>${L('ในตาราง', 'In tables')}</small></span></span><span class="sym">${previewIcon('lg')}<span><strong>${esc(iconDraft.symbol)}</strong><small>${L('หัวรายละเอียด', 'Detail header')}</small></span></span></div>`;
  if (iconDraft.mode === 'Pair') el.querySelectorAll('.ic-stage .ins-ic.pair > .disc').forEach((d, i) => { const k = i ? 'second' : 'first'; d.dataset.action = 'ic-slot'; d.dataset.value = k; d.classList.toggle('on', iconDraft.active === k); d.title = i ? L('แก้ไขไอคอนรอง', 'Edit the secondary icon') : L('แก้ไขไอคอนหลัก', 'Edit the main icon'); });
}
function slotThumb(slot) { return `<span class="ins-ic lg"><span class="disc" style="${slot?.bg ? `background:${esc(slot.bg)}` : ''}">${slotHTML(slot || defaultSlot(''))}</span></span>`; }
function drawIconLibrary() {
  const el = $('#ic-lib'); if (!el) return; const q = iconDraft.q.toLowerCase().trim(), cat = iconDraft.cat;
  let items;
  if (cat === 'custom') { const seen = new Set(); items = state.instruments.flatMap(i => { const c = i.iconConfig; return c ? [c.first?.src, c.second?.src] : []; }).filter(s => String(s || '').startsWith('data:image/') && !seen.has(s) && seen.add(s)).map(s => ({ src: s, label: L('รูปที่อัปโหลด', 'Uploaded') })); }
  else items = Object.keys(typeof ICON_LIBRARY !== 'undefined' ? ICON_LIBRARY : {}).filter(k => iconCat(k) === cat).map(k => ({ src: 'lib:' + k, label: iconLabel(k), code: k })).filter(x => !q || iconSearchText(x.code).includes(q));
  const cur = iconDraft[iconDraft.active]?.src;
  el.innerHTML = items.length ? items.slice(0, 400).map(x => `<button type="button" class="ic-item ${x.src === cur ? 'on' : ''}" data-action="ic-pick" data-src="${esc(x.src)}" title="${esc(x.label)}"><img src="${x.src.startsWith('lib:') ? ICON_LIBRARY[x.src.slice(4)] : x.src}" alt="" loading="lazy"><span>${esc(x.label.split(' · ')[0])}</span></button>`).join('') : `<p class="dim small" style="padding:10px;grid-column:1/-1">${cat === 'custom' ? L('ยังไม่มีรูปที่อัปโหลด', 'No uploads yet') : L('ไม่พบไอคอน', 'No icons found')}</p>`;
}
function drawIconEditor() {
  const d = iconDraft, slot = d[d.active], auto = d.mode === 'Auto', src = String(slot.src || ''), isText = !src || src.startsWith('text:');
  $('#ic-root').innerHTML = `<div class="ic-grid"><div>
    <div id="ic-preview" class="ic-preview"></div>
    <div class="field mt16"><label>${L('รูปแบบ', 'Layout')}</label>${seg([['Auto', L('อัตโนมัติ', 'Automatic')], ['Single', L('ไอคอนเดียว', 'Single')], ['Pair', L('สองไอคอน', 'Pair')]], d.mode, 'ic-mode')}<small class="help">${auto ? L('ระบบเลือกไอคอนให้จากสัญลักษณ์และสกุลเงิน — เลือก "ไอคอนเดียว" หรือ "สองไอคอน" เพื่อกำหนดเอง', 'Picked from the symbol and currencies — choose Single or Pair to customise') : ''}</small></div>
    ${auto ? '' : `
    <div class="sec mt16">${L('แหล่งภาพ', 'Source')}</div>
    <div class="row wrap gap8">${btn(icon('upload') + L(' อัปโหลดรูป', ' Upload image'), 'ic-upload', {}, 'sm')}<div class="row gap4" style="flex:1;min-width:150px"><input id="ic-text" data-ic-field="text" maxlength="4" placeholder="${L('หรือพิมพ์ตัวอักษร', 'or type letters')}" value="${esc(isText ? src.replace(/^text:/, '') : '')}" style="height:30px"></div></div>
    <div class="formgrid mt16"><div class="field"><label>${L('สีพื้นหลัง', 'Background')}</label><div class="row gap8"><input type="color" data-ic-field="bg" value="${esc(slot.bg || '#1f2530')}" style="width:44px;height:32px;border:0;background:none;padding:0">${btn(L('ไม่มีสี', 'None'), 'ic-bg-clear', {}, 'ghost sm')}</div></div>${isText ? `<div class="field"><label>${L('สีตัวอักษร', 'Text color')}</label><input type="color" data-ic-field="color" value="${esc(slot.color || '#e7eaf0')}" style="width:44px;height:32px;border:0;background:none;padding:0"></div>` : '<div></div>'}
    <div class="field span2"><label>${L('ซูม', 'Zoom')} · <span id="ic-zv">${fmt(+slot.zoom || 1, 2)}×</span></label><input type="range" min="0.5" max="3" step="0.05" value="${+slot.zoom || 1}" data-ic-field="zoom"></div>
    <div class="field"><label>${L('ตำแหน่ง X', 'Position X')}</label><input type="range" min="0" max="100" step="1" value="${slot.x ?? 50}" data-ic-field="x"></div><div class="field"><label>${L('ตำแหน่ง Y', 'Position Y')}</label><input type="range" min="0" max="100" step="1" value="${slot.y ?? 50}" data-ic-field="y"></div></div>
    <div class="row mt8">${btn(L('รีเซ็ตซูม/ตำแหน่ง', 'Reset crop'), 'ic-crop-reset', {}, 'ghost sm')}${d.mode === 'Pair' ? btn(icon('refresh') + L(' สลับซ้าย/ขวา', ' Swap'), 'ic-swap', {}, 'ghost sm') : ''}</div>`}
  </div><div>${auto ? `<div class="notice info">${icon('info')}<span>${L('โหมดอัตโนมัติใช้ธงของสกุลเงินฐาน/อ้างอิง หรือโลโก้สินทรัพย์ที่ตรงกับสัญลักษณ์', 'Automatic mode uses currency flags or the matching asset logo')}</span></div>` : `<div class="field"><label>${L('คลังไอคอน', 'Icon library')} → ${d.active === 'first' ? L('ไอคอนหลัก', 'main') : L('ไอคอนรอง', 'secondary')}</label>${seg(ICON_CATS(), d.cat, 'ic-cat')}</div><div class="searchbox mt8" style="max-width:none">${icon('search')}<input data-ic-q value="${esc(d.q)}" placeholder="${L('ค้นหา เช่น Japan, ญี่ปุ่น, BTC, gold', 'Search e.g. Japan, BTC, gold')}"></div><div class="ic-lib mt8" id="ic-lib"></div>`}</div></div>`;
  drawIconPreview(); drawIconLibrary();
}
function iconUpload(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => { const img = new Image(); img.onload = () => { const S = 160, c = document.createElement('canvas'); c.width = c.height = S; const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k; c.getContext('2d').drawImage(img, (S - w) / 2, (S - h) / 2, w, h); res(c.toDataURL('image/png')); }; img.onerror = rej; img.src = fr.result; }; fr.onerror = rej; fr.readAsDataURL(file); });
}
async function saveIcon() {
  const d = iconDraft; let cfg;
  if (d.mode === 'Auto') cfg = null;
  else { const clean = s => ({ src: s.src || '', bg: s.bg || '', aspect: '1:1', zoom: +s.zoom || 1, x: +(s.x ?? 50), y: +(s.y ?? 50), color: s.color || '' }); cfg = { mode: d.mode, first: clean(d.first), second: d.mode === 'Pair' ? clean(d.second) : defaultSlot('') }; }
  const apply = r => { if (cfg) { r.iconConfig = cfg; r.iconMode = cfg.mode; } else { r.iconConfig = null; r.iconMode = 'Auto'; } };
  closeModal();
  if (d.fromEditor && editor?.kind === 'instruments') { apply(editor.record); const el = $('#ins-icon-preview'); if (el) el.innerHTML = insIcon(readInsDraftWithIcon(), 'lg'); toast(L('อัปเดตไอคอนแล้ว — กดบันทึกเพื่อยืนยัน', 'Icon updated — save the instrument to keep it')); return; }
  const ins = get('instruments', d.insId); if (!ins) return; apply(ins); ins.updatedAt = now(); await changed(L('บันทึกไอคอนแล้ว', 'Icon saved'));
}
function readInsDraftWithIcon() { return { ...readInsDraft(), iconConfig: editor.record.iconConfig, iconMode: editor.record.iconMode }; }
const ICON_ACTIONS = {
  'ic-open': el => openIconEditor(el.dataset.id),
  'ic-mode': el => { const m = el.dataset.value; if (m !== 'Auto' && iconDraft.mode === 'Auto') { const a = autoSlots(iconDraft.ins); iconDraft.first = { ...a.first }; iconDraft.second = { ...a.second }; } iconDraft.mode = m; if (m === 'Single') iconDraft.active = 'first'; drawIconEditor(); },
  'ic-slot': el => { iconDraft.active = el.dataset.value; const s = String(iconDraft[iconDraft.active].src); if (s.startsWith('lib:')) iconDraft.cat = iconCat(s.slice(4)); drawIconEditor(); },
  'ic-cat': el => { iconDraft.cat = el.dataset.value; iconDraft.q = ''; drawIconEditor(); },
  'ic-pick': el => { Object.assign(iconDraft[iconDraft.active], { src: el.dataset.src, zoom: 1, x: 50, y: 50 }); drawIconEditor(); },
  'ic-upload': () => pickFile('image/*', async f => { try { const data = await iconUpload(f); Object.assign(iconDraft[iconDraft.active], { src: data, zoom: 1, x: 50, y: 50 }); drawIconEditor(); } catch { toast(L('อ่านรูปไม่ได้', 'Could not read image'), 'bad'); } }),
  'ic-bg-clear': () => { iconDraft[iconDraft.active].bg = ''; drawIconEditor(); },
  'ic-crop-reset': () => { Object.assign(iconDraft[iconDraft.active], { zoom: 1, x: 50, y: 50 }); drawIconEditor(); },
  'ic-swap': () => { [iconDraft.first, iconDraft.second] = [iconDraft.second, iconDraft.first]; drawIconEditor(); },
  'ic-auto': () => { iconDraft.mode = 'Auto'; drawIconEditor(); },
  'ic-save': saveIcon
};
function iconFieldInput(t) {
  if (!iconDraft) return false;
  if (t.matches('[data-ic-q]')) { iconDraft.q = t.value; drawIconLibrary(); return true; }
  const f = t.dataset.icField; if (!f) return false; const s = iconDraft[iconDraft.active];
  if (f === 'text') s.src = t.value.trim() ? 'text:' + t.value.trim().toUpperCase() : '';
  else if (['zoom', 'x', 'y'].includes(f)) { s[f] = +t.value; if (f === 'zoom') $('#ic-zv').textContent = fmt(+t.value, 2) + '×'; }
  else s[f] = t.value;
  drawIconPreview(); const tb = document.querySelector(`.ic-slot-btn[data-value="${iconDraft.active}"] .ins-ic`); if (tb) tb.outerHTML = slotThumb(s); return true;
}

/* ---------- rich-text toolbar (shared by notes and strategy notes) ---------- */
function rteToolbar(target) {
  const tools = [['undo', 'undo', L('ย้อนกลับ (Ctrl+Z)', 'Undo (Ctrl+Z)')], ['redo', 'redo', L('ทำซ้ำ (Ctrl+Y)', 'Redo (Ctrl+Y)')], '|', ['bold', 'bold', L('ตัวหนา', 'Bold')], ['italic', 'italic', L('ตัวเอียง', 'Italic')], ['underline', 'underline', L('ขีดเส้นใต้', 'Underline')], ['strikeThrough', 'strike', L('ขีดฆ่า', 'Strike')], '|', ['h2', 'h2', L('หัวข้อ', 'Heading')], ['h3', 'h3', L('หัวข้อย่อย', 'Subheading')], ['blockquote', 'quote', L('อ้างอิง', 'Quote')], '|', ['insertUnorderedList', 'list', L('รายการ', 'Bullets')], ['insertOrderedList', 'list-ordered', L('ลำดับเลข', 'Numbers')], ['checklist', 'list-checks', L('เช็คลิสต์', 'Checklist')], '|', ['table', 'table', L('ตาราง', 'Table')], ['link', 'link', L('ลิงก์', 'Link')], ['image', 'image', L('รูปภาพ', 'Image')], ['hr', 'minus', L('เส้นคั่น', 'Divider')], '|', ['removeFormat', 'remove-format', L('ล้างรูปแบบ', 'Clear')]];
  return `<div class="rtb">${tools.map(t => t === '|' ? '<span class="sep"></span>' : `<button type="button" data-action="rte" data-cmd="${t[0]}" data-target="${target}" title="${esc(t[2])}" aria-label="${esc(t[2])}">${icon(t[1])}</button>`).join('')}</div>`;
}
