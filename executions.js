/* ============================================================
   EXECUTIONS — scale in / scale out (partial fills)
   A trade may carry executions[] = {id, kind:'in'|'out', time, price, qty}.
   The trade's entry/exit/quantity fields are derived from them, so every
   report keeps working on the same fields.
   ============================================================ */
function execSummary(ex) {
  const ins = ex.filter(e => e.kind === 'in' && e.qty > 0 && e.price > 0), outs = ex.filter(e => e.kind === 'out' && e.qty > 0 && e.price > 0);
  const qIn = sum(ins.map(e => e.qty)), qOut = sum(outs.map(e => e.qty));
  const vIn = qIn ? sum(ins.map(e => e.price * e.qty)) / qIn : null, vOut = qOut ? sum(outs.map(e => e.price * e.qty)) / qOut : null;
  const times = a => a.map(e => e.time).filter(Boolean).sort();
  return { ins, outs, qIn, qOut, vIn, vOut, firstIn: times(ins)[0] || '', lastOut: times(outs).at(-1) || '', remaining: qIn - qOut, closed: qOut > 0 && qOut >= qIn - 1e-9, over: qOut > qIn + 1e-9 };
}
function applyExecutions(t) {
  if (!t.executions?.length) return t;
  const s = execSummary(t.executions);
  if (s.qIn > 0) { t.quantity = +s.qIn.toFixed(8); t.entryPrice = s.vIn; if (s.firstIn) t.entryDateTime = s.firstIn; }
  if (!['Void', 'Missed'].includes(t.status)) t.status = s.closed ? 'Closed' : 'Open';
  if (s.closed) { t.exitPrice = s.vOut; t.exitDateTime = s.lastOut; } else { t.exitPrice = null; t.exitDateTime = ''; }
  return t;
}
/* realized P&L of the part already closed on a still-open trade (average-cost method) */
function partialInfo(t) {
  if (!t.executions?.length || t.status !== 'Open') return null;
  const s = execSummary(t.executions); if (!(s.qOut > 0)) return null;
  const rate = tickRate(t), sign = t.side === 'Sell' ? -1 : 1;
  return { ...s, realized: finite(rate) ? (s.vOut - s.vIn) * sign * rate * s.qOut : null };
}
function execRowHTML(e, i, dec) {
  return `<div class="exec-row" data-exec-row="${i}"><select data-ex="kind" aria-label="kind"><option value="in" ${e.kind === 'in' ? 'selected' : ''}>${L('เข้า (เพิ่ม)', 'In (add)')}</option><option value="out" ${e.kind === 'out' ? 'selected' : ''}>${L('ออก (ปิด)', 'Out (reduce)')}</option></select><input type="datetime-local" data-ex="time" value="${esc(localInput(e.time, edZone()))}" aria-label="time"><input type="number" step="any" data-ex="price" value="${esc(e.price ?? '')}" placeholder="${L('ราคา', 'Price')}" aria-label="price"><input type="number" step="any" data-ex="qty" value="${esc(e.qty ?? '')}" placeholder="${L('จำนวน', 'Quantity')}" aria-label="size">${ibtn('x', 'exec-del', L('ลบรายการ', 'Remove'), { 'data-i': i }, 'sm')}</div>`;
}
function execBoxHTML() {
  const ex = editor.executions || [], dec = get('instruments', $('[name=instrumentId]')?.value || editor.record.instrumentId)?.decimals ?? 2;
  return `<div class="exec-head small dim"><span>${L('ประเภท', 'Type')}</span><span>${L('วัน-เวลา', 'Time')}</span><span>${L('ราคา', 'Price')}</span><span>${L('จำนวน', 'Quantity')}</span><span></span></div>${ex.map((e, i) => execRowHTML(e, i, dec)).join('')}<div class="row gap8 mt8">${btn(icon('plus') + L(' เพิ่มการเข้า', ' Add entry'), 'exec-add', { 'data-kind': 'in' }, 'sm')}${btn(icon('plus') + L(' เพิ่มการออก (ปิดบางส่วน)', ' Add exit (partial)'), 'exec-add', { 'data-kind': 'out' }, 'sm')}</div><div id="exec-sum" class="mt8"></div>`;
}
function readExecRows() {
  return $$('[data-exec-row]').map((row, i) => ({ id: editor.executions[i]?.id || uid('ex'), kind: row.querySelector('[data-ex=kind]').value, time: toISO(row.querySelector('[data-ex=time]').value, edZone()), price: num(row.querySelector('[data-ex=price]').value), qty: num(row.querySelector('[data-ex=qty]').value) }));
}
function drawExecSummary(r) {
  const el = $('#exec-sum'); if (!el || !editor?.execMode) return; const s = execSummary(r.executions || []), dec = get('instruments', r.instrumentId)?.decimals ?? 2, cur = get('accounts', r.accountId)?.currency;
  const p = r.status === 'Open' ? partialInfo(r) : null;
  el.innerHTML = `<div class="notice ${s.over ? 'bad' : 'info'}">${icon(s.over ? 'alert' : 'layers')}<span>${L('เข้ารวม', 'In')} <b>${fmt(s.qIn, 2)}</b> @ <b>${s.vIn ? fmt(s.vIn, dec + 1) : '—'}</b> · ${L('ออกรวม', 'Out')} <b>${fmt(s.qOut, 2)}</b> @ <b>${s.vOut ? fmt(s.vOut, dec + 1) : '—'}</b> · ${L('คงเหลือ', 'Remaining')} <b>${fmt(Math.max(0, s.remaining), 2)}</b>${s.over ? ' — ' + L('ปิดมากกว่าที่เปิด', 'closed more than opened') : s.closed ? ' · <span class="pos">' + L('ปิดครบแล้ว', 'fully closed') + '</span>' : ''}${p && finite(p.realized) ? ` · ${L('กำไรที่ปิดไปแล้ว', 'Realized')} <b class="${tone(p.realized)}">${money(p.realized, cur, true)}</b>` : ''}</span></div>`;
}
function setExecMode(on) {
  editor.execMode = on; const r = readTradeForm();
  if (on && !editor.executions?.length) {
    editor.executions = [{ id: uid('ex'), kind: 'in', time: r.entryDateTime || now(), price: r.entryPrice, qty: r.quantity }];
    if (r.status === 'Closed' && r.exitPrice) editor.executions.push({ id: uid('ex'), kind: 'out', time: r.exitDateTime || now(), price: r.exitPrice, qty: r.quantity });
  }
  if (!on) editor.executions = [];
  $('#exec-box').innerHTML = on ? execBoxHTML() : ''; $('#exec-box').hidden = !on;
  ['entryDateTime', 'entryPrice', 'quantity', 'exitDateTime', 'exitPrice'].forEach(n => { const i = $(`#editor-form [name=${n}]`); if (i) { i.readOnly = on; i.classList.toggle('derived', on); } });
  $('#status-seg')?.classList.toggle('disabled', on);
  updateLive();
}
const EXEC_ACTIONS = {
  'exec-toggle': el => setExecMode(!editor.execMode),
  'exec-add': el => { editor.executions = readExecRows(); const s = execSummary(editor.executions), last = editor.executions.at(-1); editor.executions.push({ id: uid('ex'), kind: el.dataset.kind, time: now(), price: last?.price ?? null, qty: el.dataset.kind === 'out' ? +(Math.max(0, s.remaining) || 0).toFixed(4) || null : null }); $('#exec-box').innerHTML = execBoxHTML(); updateLive(); },
  'exec-del': el => { editor.executions = readExecRows(); editor.executions.splice(+el.dataset.i, 1); $('#exec-box').innerHTML = execBoxHTML(); updateLive(); }
};
function execDetailHTML(t) {
  if (!t.executions?.length) return '';
  const s = execSummary(t.executions), rate = tickRate(t), sign = t.side === 'Sell' ? -1 : 1, cur = accountCurrency(t), dec = get('instruments', t.instrumentId)?.decimals ?? 2;
  const rows = t.executions.slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));
  return `<div class="sec mt24">${L('รายการซื้อขาย (ทยอยเข้า/ออก)', 'Executions (scale in/out)')}</div><div class="tablewrap" style="border:1px solid var(--border);border-radius:9px"><table><thead><tr><th>${L('ประเภท', 'Type')}</th><th>${L('เวลา', 'Time')}</th><th class="num">${L('ราคา', 'Price')}</th><th class="num">${L('จำนวน', 'Quantity')}</th><th class="num">${L('กำไร (ต้นทุนเฉลี่ย)', 'P&L (avg cost)')}</th></tr></thead><tbody>${rows.map(e => { const pl = e.kind === 'out' && finite(rate) && s.vIn ? (e.price - s.vIn) * sign * rate * e.qty : null; return `<tr><td>${e.kind === 'in' ? badge(L('เข้า', 'IN'), 'st open') : badge(L('ออก', 'OUT'), '')}</td><td>${fmtDate(e.time, { time: true })}</td><td class="num">${fmt(e.price, dec)}</td><td class="num">${fmt(e.qty, 2)}</td><td class="num ${tone(pl)}">${pl != null ? money(pl, cur, true) : ''}</td></tr>`; }).join('')}</tbody></table></div><p class="help mt8">${L('ราคาเข้า/ออกในรายงานเป็นราคาเฉลี่ยถ่วงน้ำหนัก · ความเสี่ยงเริ่มต้นคิดจากขนาดรวม', 'Entry/exit are volume-weighted averages · initial risk uses the full size')} · ${L('เข้า', 'In')} ${fmt(s.qIn, 2)} @ ${fmt(s.vIn, dec + 1)}${s.qOut ? ` · ${L('ออก', 'Out')} ${fmt(s.qOut, 2)} @ ${fmt(s.vOut, dec + 1)}` : ''}</p>`;
}
