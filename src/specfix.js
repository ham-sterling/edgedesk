/* ============================================================
   INSTRUMENT SPEC CHANGES (v3.45)
   · contract size / tick size typed → tick value follows
     (tick value = contract size × tick size) until you type your own
   · multiplier ≠ 1 on top of a contract-sized tick value → warning
   · trades recorded with an older spec (instrumentSnapshot) can be:
       keep     — stay on the old spec (money unchanged, lots unchanged)
       rescale  — move to the new spec, lots scaled so money is unchanged
                  (e.g. 10 lots on a 1/pt spec → 0.1 lot on a 100/pt spec)
       recalc   — move to the new spec, lots unchanged (money recomputed)
   ============================================================ */
const specRate = i => unitRate(i);
const specCcy = i => i?.valueCurrency || i?.quoteCurrency || '';
/* trades whose stored spec values money differently from the instrument's current spec */
function staleSpecTrades(insId) {
  const cur = get('instruments', insId), r = specRate(cur); if (!r) return [];
  return state.trades.filter(t => t.instrumentId === insId && t.instrumentSnapshot?.id === insId && (Math.abs((specRate(t.instrumentSnapshot) || 0) - r) > 1e-9 * r || specCcy(t.instrumentSnapshot) !== specCcy(cur)));
}
const qtyRound = v => +(+v).toPrecision(10);
function applySpecChoice(insId, mode) {
  const cur = get('instruments', insId), rows = staleSpecTrades(insId), r1 = specRate(cur); let n = 0;
  if (mode === 'keep' || !r1) return 0;
  for (const t of rows) {
    const r0 = specRate(t.instrumentSnapshot), f = r0 && specCcy(t.instrumentSnapshot) === specCcy(cur) ? r0 / r1 : null;
    if (mode === 'rescale' && t.grossPnL == null) { // trades with the broker's own profit (imports) already have real lots
      if (!f) continue; // currency changed — can't keep money equal by scaling lots
      if (t.quantity > 0) t.quantity = qtyRound(t.quantity * f);
      if (t.executions?.length) t.executions = t.executions.map(x => ({ ...x, quantity: x.quantity > 0 ? qtyRound(x.quantity * f) : x.quantity }));
    }
    delete t.instrumentSnapshot; t.updatedAt = now(); n++;
  }
  return n;
}
/* one dialog for one or more instruments */
function specReviewDialog(insIds, intro = '') {
  const items = insIds.map(id => ({ ins: get('instruments', id), rows: staleSpecTrades(id) })).filter(x => x.ins && x.rows.length);
  if (!items.length) return false;
  const total = sum(items.map(x => x.rows.length));
  const ex = (() => { // a worked example from the first trade
    const { ins, rows } = items[0], t = rows.find(x => x.quantity > 0) || rows[0], r0 = specRate(t.instrumentSnapshot), r1 = specRate(ins), f = r0 && r1 ? r0 / r1 : null, c0 = calc(t);
    const vc = specCcy(ins), cur = accountCurrency(t), money1 = finite(c0.gross) && f ? c0.gross / f : null;
    const lot = v => fmt(v, v < 1 ? 2 : 2);
    return { ins, t, f, html: `<div class="spec-ex"><div class="dim small">${L('ตัวอย่าง', 'Example')}: ${esc(ins.symbol)} · ${fmtDate(t.entryDateTime, { year: false })}</div>
      <div class="spec-ex-g"><span></span><b>${L('จำนวน', 'Lots')}</b><b>${L('กำไรขั้นต้น', 'Gross')}</b>
      <span>${L('ตอนนี้', 'Now')}</span><span>${lot(t.quantity)}</span><span class="${tone(c0.gross)}">${money(c0.gross, cur, true)}</span>
      <span>${L('แปลงล็อต', 'Convert lots')}</span><span>${f ? lot(qtyRound(t.quantity * f)) : '—'}</span><span class="${tone(c0.gross)}">${money(c0.gross, cur, true)}</span>
      <span>${L('คงล็อต', 'Keep lots')}</span><span>${lot(t.quantity)}</span><span class="${tone(money1)}">${money(money1, cur, true)}</span></div>
      <div class="dim small mt8">${L('สเปกเดิม', 'Old spec')} ${fmt(specRate(t.instrumentSnapshot), 2)} ${esc(vc)} → ${L('ใหม่', 'new')} ${fmt(r1, 2)} ${esc(vc)} ${L('ต่อ 1 จุด ต่อ 1 ล็อต', 'per point per lot')}</div></div>` };
  })();
  window.__specReview = items.map(x => x.ins.id);
  openModal({
    title: icon('scale') + L(' เทรดที่บันทึกด้วยสเปกเดิม', ' Trades recorded with an older spec'), size: 'md',
    body: `${intro ? `<p style="margin-top:0">${intro}</p>` : ''}<p class="muted small" style="margin-top:0">${L(`${total} เทรด ใน ${items.map(x => `${esc(x.ins.symbol)} (${x.rows.length})`).join(', ')} ยังคิดเงินด้วยสเปกเดิม เลือกวิธีจัดการ:`, `${total} trades in ${items.map(x => `${esc(x.ins.symbol)} (${x.rows.length})`).join(', ')} still use the old spec. Choose:`)}</p>${ex.html}
      <div class="spec-opts">
        <label class="spec-opt"><input type="radio" name="specMode" value="rescale" checked><div><b>${L('แปลงจำนวนล็อต — เงินเท่าเดิม', 'Convert lots — money unchanged')}</b><small>${L('เลือกข้อนี้ถ้าเคยกรอกล็อตเยอะกว่าจริงเพื่อให้เงินออกมาถูก (เช่น กรอก 10 แทน 0.1) · เทรดที่นำเข้าพร้อมกำไรจากโบรกเกอร์คงล็อตเดิม', 'Pick this if you typed more lots than you traded to get the right money (e.g. 10 instead of 0.1). Imported trades with broker profit keep their lots')}</small></div></label>
        <label class="spec-opt"><input type="radio" name="specMode" value="recalc"><div><b>${L('คงจำนวนล็อต — คิดเงินใหม่', 'Keep lots — recompute money')}</b><small>${L('เลือกข้อนี้ถ้าล็อตที่กรอกถูกอยู่แล้ว แต่เงินผิดเพราะสเปกเดิม (เทรดที่นำเข้าพร้อมกำไรจากโบรกเกอร์ไม่เปลี่ยน)', 'Pick this if the lots were right but the money was wrong (imported trades with broker profit keep their profit)')}</small></div></label>
        <label class="spec-opt"><input type="radio" name="specMode" value="keep"><div><b>${L('เก็บไว้ตามเดิม', 'Leave as they are')}</b><small>${L('ไม่เปลี่ยนอะไร — ใช้สเปกใหม่กับเทรดใหม่เท่านั้น จัดการทีหลังได้ในหน้าแก้ไขสินทรัพย์', 'Change nothing — the new spec applies to new trades only. You can do this later from the instrument editor')}</small></div></label>
      </div>`,
    foot: `<div class="grow"></div>${btn(L('ทีหลัง', 'Later'), 'spec-later', {}, 'ghost')}${btn(icon('check') + L(' ใช้', ' Apply'), 'spec-apply', {}, 'primary')}`
  });
  return true;
}
function insStaleNotice(insId) {
  const n = staleSpecTrades(insId).length;
  return n ? `<div class="notice info mb16">${icon('info')}<span>${L(`${n} เทรดยังคิดเงินด้วยสเปกเดิมของสินทรัพย์นี้`, `${n} trades still use this instrument's older spec`)}</span><button type="button" class="btn sm" data-action="spec-review" data-id="${insId}">${L('จัดการ', 'Review')}</button></div>` : '';
}
const SPEC_ACTIONS = {
  'spec-apply': async () => {
    const mode = $('input[name=specMode]:checked')?.value || 'keep', ids = window.__specReview || [];
    let n = 0; for (const id of ids) n += applySpecChoice(id, mode);
    delete state.meta.specReview; closeModal();
    await changed(mode === 'keep' ? L('เก็บเทรดเดิมไว้ตามสเปกเดิม', 'Kept on the old spec') : mode === 'rescale' ? L(`แปลงจำนวนล็อตแล้ว ${n} เทรด`, `Converted lots on ${n} trades`) : L(`คิดเงินใหม่แล้ว ${n} เทรด`, `Recomputed ${n} trades`));
  },
  'spec-later': () => { delete state.meta.specReview; persist(); closeModal(); },
  'spec-review': el => { const id = el.dataset.id; closeModal(); setTimeout(() => specReviewDialog([id]), 50); },
};
/* instrument editor: keep tick value in step with contract size × tick size until typed by hand */
/* v3.54 — pip size from the digits: FX / metals / energies = one digit less than the price (5 → 0.0001, 3 → 0.01, 2 → 0.1),
   indices = 1 point, crypto / stocks / others = the smallest price step */
function pipFromDecimals(cls, dec) {
  if (!(dec >= 0)) return '';
  if (cls === 'Indices') return 1;
  if (['Forex', 'Metals', 'Energies'].includes(cls)) return dec >= 1 ? +(10 ** -(dec - 1)).toPrecision(8) : 1;
  return +(10 ** -dec).toPrecision(8);
}
function insFormInput(t) {
  const f = $('#ins-form'); if (!f || !editor) return;
  if (t.name === 'tickValue') editor.tvTouched = true;
  if (t.name === 'calcMode') editor.cmTouched = true;
  if (t.name === 'assetClass' && !editor.cmTouched) f.calcMode.value = defaultCalcMode(f.assetClass.value, f.symbol.value);
  if (t.name === 'decimals' || t.name === 'assetClass') { const dec = num(f.decimals.value); if (dec != null && dec >= 0 && dec <= 10) { if (t.name === 'decimals' || f.calcMode.value !== 'Futures') f.tickSize.value = +(10 ** -dec).toPrecision(8); f.pipSize.value = pipFromDecimals(f.assetClass.value, dec); } }
  if (['contractSize', 'tickSize', 'decimals'].includes(t.name) && f.calcMode.value === 'Futures' && !editor.tvTouched) { const cs = num(f.contractSize.value), ts = num(f.tickSize.value); if (cs > 0 && ts > 0) f.tickValue.value = +(cs * ts).toPrecision(10); }
  insModeSync();
}
/* non-futures modes: profit comes from contract size, so tick value is derived (contract size × tick size) and locked */
function insModeSync() {
  const f = $('#ins-form'); if (!f) return; const mode = f.calcMode?.value || 'Contracts', fut = mode === 'Futures';
  const cs = num(f.contractSize.value), ts = num(f.tickSize.value), tv = f.tickValue;
  if (!fut && cs > 0 && ts > 0) tv.value = +(cs * ts).toPrecision(10);
  tv.readOnly = !fut; tv.classList.toggle('locked', !fut); tv.tabIndex = fut ? 0 : -1;
  const tsI = f.tickSize; tsI.readOnly = !fut; tsI.classList.toggle('kv-ro', !fut); tsI.tabIndex = fut ? 0 : -1; // v3.54: tick size follows the decimals (Futures: from the specification)
  tv.classList.toggle('kv-ro', !fut); const tn = $('#ins-ts-note'); if (tn) tn.textContent = fut ? L('(ตาม Specification)', '(from the specification)') : L('(คำนวณจาก Decimal places)', '(from decimal places)');
  const h = $('#ins-tv-help'); if (h) h.textContent = fut ? L('(ตาม Specification · ใช้คิดกำไร)', '(from the specification · drives profit)') : L('(ขนาดสัญญา × ขนาดติ๊ก)', '(contract size × tick size)');
  const c = $('#ins-cm-tip'); if (c) c.dataset.tip = CALC_MODE_INFO()[mode] || '';
  f.querySelectorAll('.ins-fut').forEach(x => x.hidden = !fut);
  updateInsPreview(); insMultWarn();
}
function insMultWarn() {
  const f = $('#ins-form'); if (!f) return; const cs = num(f.contractSize.value), ts = num(f.tickSize.value), tv = num(f.tickValue.value), m = num(f.multiplier?.value) || 1;
  let w = $('#ins-mult-warn'); const bad = m !== 1 && cs > 0 && ts > 0 && tv > 0 && Math.abs(tv - cs * ts) < 1e-9 * Math.max(1, cs);
  if (!w) { const host = f.querySelector('[name=multiplier]')?.closest('.field'); if (!host) return; host.insertAdjacentHTML('beforeend', '<p class="help warn-t" id="ins-mult-warn" hidden></p>'); w = $('#ins-mult-warn'); }
  w.hidden = !bad; if (bad) w.textContent = L(`มูลค่าติ๊กคิดจากขนาดสัญญา ${fmt(cs, 0)} แล้ว — ตัวคูณ ${m} จะคูณซ้ำเป็น ${fmt(cs * m, 0)} เท่า ปกติควรเป็น 1`, `Tick value already includes the contract size ${fmt(cs, 0)} — multiplier ${m} makes it ${fmt(cs * m, 0)}×. Usually 1`);
}

/* ============================================================
   v3.48 — RECALCULATE OLD TRADES with the current specs (one place for all instruments)
   · preview per instrument: trades, lots and money now → after
   · optional first step: indices still at 1 per point → 100 per point
   · undo keeps the last run (snapshots, lots, executions, instrument specs)
   ============================================================ */
const idxAtOne = () => []; // v3.49: indices use contract size 1 (broker spec) — no longer suggested to change
function staleSummary() {
  return state.instruments.map(ins => ({ ins, rows: staleSpecTrades(ins.id) })).filter(x => x.rows.length);
}
function recalcPreview(rows, ins, mode) {
  const r1 = unitRate(ins); let now = 0, after = 0, lotsNow = 0, lotsAfter = 0;
  for (const t of rows) {
    const c0 = calc(t), n0 = finite(c0.net) ? c0.net : 0, r0 = unitRate(t.instrumentSnapshot), f = r0 && r1 && specCcy(t.instrumentSnapshot) === specCcy(ins) ? r0 / r1 : null;
    now += n0; lotsNow += t.quantity || 0;
    if (mode === 'rescale' && t.grossPnL == null && f) { after += n0; lotsAfter += qtyRound((t.quantity || 0) * f); }
    else { const c1 = calc({ ...t, instrumentSnapshot: undefined }); after += finite(c1.net) ? c1.net : n0; lotsAfter += t.quantity || 0; }
  }
  return { now, after, lotsNow, lotsAfter };
}
function recalcToolHTML() {
  const mode = ui.recalcMode === 'rescale' ? 'rescale' : 'recalc', items = staleSummary(), idx = idxAtOne(), undo = state.meta.specUndo, cur = baseCurrency();
  const idxBox = idx.length ? `<div class="notice warn mb16">${icon('alert')}<div class="grow"><b>${L(`ดัชนี ${idx.length} ตัวยังเป็น 1 ต่อจุดต่อล็อต`, `${idx.length} ${idx.length === 1 ? 'index is' : 'indices are'} still 1 per point per lot`)}</b><div class="small">${idx.map(i => esc(i.symbol)).join(', ')} · ${L('โบรกเกอร์ของคุณ 1 ล็อต = 100 ต่อจุด (0.1 ล็อต = 10 ต่อจุด)', 'your broker: 1 lot = 100 per point (0.1 lot = 10 per point)')}</div></div>${btn(L('ตั้งเป็น 100 ต่อจุด', 'Set to 100 per point'), 'recalc-idx', {}, 'sm')}</div>` : '';
  const modeSeg = `<div class="spec-opts mb16">
    <label class="spec-opt"><input type="radio" name="recalcMode" value="recalc" data-action="recalc-mode" ${mode === 'recalc' ? 'checked' : ''}><div><b>${L('คงจำนวนล็อต — คิดเงินใหม่', 'Keep lots — recompute money')}</b><small>${L('ล็อตที่กรอกไว้ถูกแล้ว (เช่น 0.1) แต่เงินผิดเพราะสเปกเดิม', 'The lots you typed were right (e.g. 0.1) but the money was wrong')}</small></div></label>
    <label class="spec-opt"><input type="radio" name="recalcMode" value="rescale" data-action="recalc-mode" ${mode === 'rescale' ? 'checked' : ''}><div><b>${L('แปลงจำนวนล็อต — เงินเท่าเดิม', 'Convert lots — money unchanged')}</b><small>${L('เคยกรอกล็อตเกินจริงเพื่อให้เงินถูก (เช่น 10 แทน 0.1)', 'You typed extra lots to get the right money (e.g. 10 instead of 0.1)')}</small></div></label></div>`;
  const table = items.length ? `<div class="tablewrap"><table class="recalc-t"><thead><tr><th><input type="checkbox" class="cb" data-action="recalc-all" ${items.every(x => !ui.recalcOff?.[x.ins.id]) ? 'checked' : ''} aria-label="all"></th><th>${L('สินทรัพย์', 'Instrument')}</th><th class="num">${L('เทรด', 'Trades')}</th><th class="num">${L('ล็อตรวม', 'Total lots')}</th><th class="num">${L('เงินตอนนี้', 'Money now')}</th><th class="num">${L('หลังปรับ', 'After')}</th></tr></thead><tbody>${items.map(({ ins, rows }) => { const pv = recalcPreview(rows, ins, mode), on = !ui.recalcOff?.[ins.id]; return `<tr class="${on ? '' : 'dim'}"><td><input type="checkbox" class="cb" data-action="recalc-pick" data-id="${ins.id}" ${on ? 'checked' : ''}></td><td><span class="row gap8">${insIcon(ins)}<b>${esc(ins.symbol)}</b><span class="dim small">${fmt(unitRate(rows[0].instrumentSnapshot), 2)} → ${fmt(unitRate(ins), 2)} ${L('ต่อจุด', '/pt')}</span></span></td><td class="num">${rows.length}</td><td class="num">${fmt(pv.lotsNow, 2)}${Math.abs(pv.lotsAfter - pv.lotsNow) > 1e-9 ? ` → <b>${fmt(pv.lotsAfter, 2)}</b>` : ''}</td><td class="num ${tone(pv.now)}">${money(pv.now, cur, true)}</td><td class="num"><b class="${tone(pv.after)}">${money(pv.after, cur, true)}</b></td></tr>`; }).join('')}</tbody></table></div>`
    : `<div class="notice ok">${icon('check')}<span>${L('ไม่มีเทรดที่ใช้สเปกเดิมแล้ว — ทุกเทรดคิดเงินด้วยสเปกปัจจุบัน', 'No trades on an older spec — every trade uses the current spec')}</span></div>`;
  const undoBox = undo ? `<div class="notice info mt16">${icon('info')}<span class="grow">${L('ปรับล่าสุด', 'Last change')} ${fmtDate(undo.at, { time: true })} · ${undo.items.length} ${L('เทรด', 'trades')}${undo.ins?.length ? ` · ${undo.ins.length} ${L('สินทรัพย์', 'instruments')}` : ''}</span>${btn(icon('undo') + L(' ย้อนกลับ', ' Undo'), 'recalc-undo', {}, 'sm')}</div>` : '';
  return `<p class="muted small" style="margin-top:0">${L('เทรดที่บันทึกก่อนแก้สเปกจะคิดเงินด้วยสเปกเดิมไว้ จนกว่าจะปรับที่นี่ · ตัวเลขเงินรวมเป็นสกุลเงินของแต่ละบัญชี', 'Trades recorded before a spec change keep the old spec until you update them here · totals are in each account’s currency')}</p>${idxBox}${items.length ? modeSeg : ''}${table}${undoBox}`;
}
function openRecalcTool(intro = '') {
  openModal({ title: icon('refresh') + L(' คิดเงินเทรดเก่าใหม่', ' Recalculate old trades'), size: 'lg', body: `${intro ? `<div class="notice info mb16">${icon('info')}<span>${intro}</span></div>` : ''}<div id="recalc-body">${recalcToolHTML()}</div>`, onClose: () => { if (state.meta.recalcPrompt) { delete state.meta.recalcPrompt; persist(); } },
    foot: `<div class="grow"></div>${btn(L('ปิด', 'Close'), 'close-modal', {}, 'ghost')}${btn(icon('check') + L(' ปรับเทรดที่เลือก', ' Update selected trades'), 'recalc-apply', {}, 'primary')}` });
  recalcFoot();
}
function recalcRefresh() { const b = $('#recalc-body'); if (b) b.innerHTML = recalcToolHTML(); recalcFoot(); }
function recalcFoot() { const any = staleSummary().some(x => !ui.recalcOff?.[x.ins.id]), bt = $('.modal-f [data-action=recalc-apply]'); if (bt) bt.disabled = !any; }
Object.assign(SPEC_ACTIONS, {
  'recalc-open': () => openRecalcTool(),
  'recalc-mode': el => { ui.recalcMode = el.value; recalcRefresh(); },
  'recalc-pick': el => { ui.recalcOff = { ...(ui.recalcOff || {}), [el.dataset.id]: !el.checked }; recalcRefresh(); },
  'recalc-all': el => { ui.recalcOff = el.checked ? {} : Object.fromEntries(staleSummary().map(x => [x.ins.id, true])); recalcRefresh(); },
  'recalc-idx': async () => {
    const items = [], ins = [];
    for (const i of idxAtOne()) {
      const old = clone(i); ins.push({ id: i.id, spec: old });
      for (const t of state.trades) if (t.instrumentId === i.id && !t.instrumentSnapshot) { items.push({ id: t.id, snap: null, quantity: t.quantity, executions: clone(t.executions || null) }); t.instrumentSnapshot = old; }
      Object.assign(i, { contractSize: INDEX_CONTRACT, calcMode: i.calcMode || 'Contracts', tickValue: +(INDEX_CONTRACT * i.tickSize).toPrecision(12), updatedAt: now() });
    }
    state.meta.specUndo = { at: now(), items, ins }; invalidate(); await changed(L('ตั้งดัชนีเป็น 100 ต่อจุดแล้ว — เทรดเก่ายังคิดเงินแบบเดิม จนกว่าจะกดปรับ', 'Indices set to 100 per point — old trades keep their money until you update them'));
    recalcRefresh();
  },
  'recalc-apply': async () => {
    const mode = ui.recalcMode === 'rescale' ? 'rescale' : 'recalc', pick = staleSummary().filter(x => !ui.recalcOff?.[x.ins.id]);
    const prev = state.meta.specUndo, keepIns = prev?.ins || [], items = [];
    for (const { rows } of pick) for (const t of rows) items.push({ id: t.id, snap: clone(t.instrumentSnapshot), quantity: t.quantity, executions: clone(t.executions || null) });
    let n = 0; for (const { ins } of pick) n += applySpecChoice(ins.id, mode);
    // one undo step covers "set indices to 100" + this update, when done together
    state.meta.specUndo = { at: now(), items: [...items, ...(prev?.items || []).filter(x => !items.some(y => y.id === x.id))], ins: keepIns };
    delete state.meta.specReview; delete state.meta.recalcPrompt; invalidate();
    await changed(mode === 'rescale' ? L(`แปลงจำนวนล็อตแล้ว ${n} เทรด`, `Converted lots on ${n} trades`) : L(`คิดเงินใหม่แล้ว ${n} เทรด`, `Recomputed ${n} trades`));
    recalcRefresh();
  },
  'recalc-undo': async () => {
    const u = state.meta.specUndo; if (!u) return;
    for (const x of u.items) { const t = get('trades', x.id); if (!t) continue; if (x.snap) t.instrumentSnapshot = x.snap; else delete t.instrumentSnapshot; t.quantity = x.quantity; if (x.executions) t.executions = x.executions; t.updatedAt = now(); }
    for (const x of u.ins || []) { const i = state.instruments.findIndex(y => y.id === x.id); if (i >= 0) state.instruments[i] = x.spec; }
    delete state.meta.specUndo; invalidate(); await changed(L('ย้อนกลับแล้ว', 'Undone')); recalcRefresh();
  },
});
/* banner on Settings › Instruments */
function recalcBanner() {
  const n = sum(staleSummary().map(x => x.rows.length)), k = idxAtOne().length;
  if (!n && !k && !state.meta.specUndo) return '';
  const msg = n || k ? [n ? L(`${n} เทรดยังคิดเงินด้วยสเปกเดิม`, `${n} trades still use an older spec`) : '', k ? L(`ดัชนี ${k} ตัวยังเป็น 1 ต่อจุด`, `${k} ${k === 1 ? 'index' : 'indices'} still at 1 per point`) : ''].filter(Boolean).join(' · ') : L('ปรับเทรดเก่าแล้ว — ย้อนกลับได้', 'Old trades updated — you can undo');
  return `<div class="notice ${n || k ? 'warn' : 'info'} mb16">${icon(n || k ? 'alert' : 'info')}<span class="grow">${msg}</span>${btn(icon('refresh') + L(' คิดเงินเทรดเก่าใหม่', ' Recalculate old trades'), 'recalc-open', {}, 'sm')}</div>`;
}
document.addEventListener('change', e => { const t = e.target, a = t?.dataset?.action; if (a === 'recalc-pick' || a === 'recalc-all') SPEC_ACTIONS[a](t); });

/* ============================================================
   v3.51 — ADJUST AN ACCOUNT AFTER SWITCHING TO A CENT CURRENCY (USD → USC)
   Data typed while the account was "USD" can be off by 100 in one of two ways:
   · lots typed 100× too big so the money matched the cent terminal  → divide lots by 100
   · capital / deposits / commission / swap typed in dollars          → multiply money by 100
   Live preview of the balance for the chosen options; one undo step.
   ============================================================ */
function centSnapshot(accId) {
  const a = get('accounts', accId);
  return { accId, at: now(), start: a.startingCapital, trades: state.trades.filter(t => t.accountId === accId).map(t => ({ id: t.id, quantity: t.quantity, executions: clone(t.executions || null), commission: t.commission, swap: t.swap, grossPnL: t.grossPnL })), txns: state.transactions.filter(t => t.accountId === accId).map(t => ({ id: t.id, amount: t.amount })) };
}
function centRestore(s) {
  const a = get('accounts', s.accId); if (!a) return; a.startingCapital = s.start;
  for (const x of s.trades) { const t = get('trades', x.id); if (!t) continue; Object.assign(t, { quantity: x.quantity, commission: x.commission, swap: x.swap, grossPnL: x.grossPnL }); if (x.executions) t.executions = x.executions; else delete t.executions; }
  for (const x of s.txns) { const t = state.transactions.find(y => y.id === x.id); if (t) t.amount = x.amount; }
  invalidate();
}
function centApply(accId, divLots, mulMoney) {
  const a = get('accounts', accId), m = mulMoney ? 100 : 1; if (!a) return 0; let n = 0;
  if (mulMoney) { a.startingCapital = qtyRound((a.startingCapital || 0) * m); for (const t of state.transactions) if (t.accountId === accId && finite(t.amount)) t.amount = qtyRound(t.amount * m); }
  for (const t of state.trades) {
    if (t.accountId !== accId) continue; let ch = false;
    if (divLots && t.grossPnL == null) { if (t.quantity > 0) { t.quantity = qtyRound(t.quantity / 100); ch = true; } if (t.executions?.length) t.executions = t.executions.map(x => ({ ...x, quantity: x.quantity > 0 ? qtyRound(x.quantity / 100) : x.quantity })); }
    if (mulMoney) { for (const k of ['commission', 'swap', 'grossPnL']) if (finite(t[k]) && t[k]) { t[k] = qtyRound(t[k] * m); ch = true; } }
    if (ch) { t.updatedAt = now(); n++; }
  }
  invalidate(); return n;
}
/* preview = apply, measure, restore (synchronous, nothing is saved or drawn in between) */
function centPreview(accId, divLots, mulMoney) {
  const snap = centSnapshot(accId); centApply(accId, divLots, mulMoney);
  const closed = state.trades.filter(t => t.accountId === accId && t.status === 'Closed'), pnl = sum(closed.map(t => calc(t).net).filter(finite)), out = { bal: accountBalance(accId), pnl, start: get('accounts', accId).startingCapital, lots: sum(closed.map(t => t.quantity || 0)), n: closed.length };
  centRestore(snap); return out;
}
function centToolHTML(accId) {
  const a = get('accounts', accId), cur = a.currency, o = ui.centOpt || { lots: true, money: false }, now0 = centPreview(accId, false, false), after = centPreview(accId, o.lots, o.money), undo = state.meta.centUndo?.accId === accId ? state.meta.centUndo : null;
  const row = (k, v0, v1, f) => `<tr><td>${k}</td><td class="num">${f(v0)}</td><td class="num"><b>${f(v1)}</b></td></tr>`, mf = v => money(v, cur, false), lf = v => fmt(v, 2);
  return `<p class="muted small" style="margin-top:0">${L(`บัญชี <b>${esc(a.name)}</b> ใช้สกุลเงิน <b>${cur}</b> แล้ว ข้อมูลที่กรอกตอนยังเป็น USD อาจคลาดไป 100 เท่า เลือกให้ตรงกับที่กรอกไว้ แล้วเทียบยอดเงินกับ MT5`, `Account <b>${esc(a.name)}</b> now uses <b>${cur}</b>. Data typed while it was USD can be off by 100 — pick what matches how you typed it, then compare the balance with MT5`)}</p>
    <div class="spec-opts mb16">
      <label class="spec-opt"><input type="checkbox" class="cb" data-action="cent-opt" data-k="lots" ${o.lots ? 'checked' : ''}><div><b>${L('หารจำนวนล็อตด้วย 100', 'Divide lots by 100')}</b><small>${L('เคยกรอกล็อตเกินจริงเพื่อให้ตัวเลขตรงกับ MT5 (เช่น กรอก 10 แทน 0.1) · เทรดที่นำเข้าพร้อมกำไรจากโบรกเกอร์ไม่ถูกแตะ', 'You typed lots 100× too big so the money matched MT5 (e.g. 10 instead of 0.1) · imported trades with broker profit are left alone')}</small></div></label>
      <label class="spec-opt"><input type="checkbox" class="cb" data-action="cent-opt" data-k="money" ${o.money ? 'checked' : ''}><div><b>${L('คูณจำนวนเงินด้วย 100', 'Multiply money by 100')}</b><small>${L('ทุนเริ่มต้น ฝาก/ถอน ค่าคอมมิชชัน และสวอป เคยกรอกเป็นดอลลาร์ (เช่น ทุน 63.32 แทน 6,332 USC)', 'Starting capital, deposits/withdrawals, commission and swap were typed in dollars (e.g. 63.32 instead of 6,332 USC)')}</small></div></label>
    </div>
    <div class="tablewrap"><table class="recalc-t"><thead><tr><th></th><th class="num">${L('ตอนนี้', 'Now')}</th><th class="num">${L('หลังปรับ', 'After')}</th></tr></thead><tbody>
      ${row(L('ทุนเริ่มต้น', 'Starting capital'), now0.start, after.start, mf)}${row(L('กำไรจากการเทรด', 'Trading P&L'), now0.pnl, after.pnl, v => money(v, cur, true))}${row(L('ล็อตรวม', 'Total lots'), now0.lots, after.lots, lf)}${row(`<b>${L('ยอดเงินปัจจุบัน', 'Balance')}</b>`, now0.bal, after.bal, mf)}
    </tbody></table></div>
    <p class="help mt8">${L('ยอดเงินหลังปรับควรตรงกับ Balance ใน MT5 บัญชีเซ็นต์', 'The balance after should match the MT5 cent account balance')}</p>
    ${undo ? `<div class="notice info mt16">${icon('info')}<span class="grow">${L('ปรับล่าสุด', 'Last change')} ${fmtDate(undo.at, { time: true })}</span>${btn(icon('undo') + L(' ย้อนกลับ', ' Undo'), 'cent-undo', { 'data-id': accId }, 'sm')}</div>` : ''}`;
}
function openCentTool(accId) {
  ui.centOpt ||= { lots: true, money: false };
  openModal({ title: icon('wallet') + L(' ปรับข้อมูลบัญชีเซ็นต์', ' Adjust cent account data'), size: 'md', body: `<div id="cent-body" data-id="${accId}">${centToolHTML(accId)}</div>`,
    foot: `<div class="grow"></div>${btn(L('ไม่ต้องปรับ', 'Leave as is'), 'close-modal', {}, 'ghost')}${btn(icon('check') + L(' ปรับข้อมูล', ' Apply'), 'cent-apply', { 'data-id': accId }, 'primary')}` });
}
const centRefresh = () => { const b = $('#cent-body'); if (b) b.innerHTML = centToolHTML(b.dataset.id); };
Object.assign(SPEC_ACTIONS, {
  'cent-open': el => openCentTool(el.dataset.id),
  'cent-apply': async el => {
    const id = el.dataset.id, o = ui.centOpt || {}; if (!o.lots && !o.money) { closeModal(); return; }
    state.meta.centUndo = centSnapshot(id); const n = centApply(id, !!o.lots, !!o.money);
    closeModal(); await changed(L(`ปรับข้อมูลบัญชีแล้ว (${n} เทรด) — ย้อนกลับได้จากเมนูบัญชี`, `Account adjusted (${n} trades) — undo from the account menu`));
  },
  'cent-undo': async el => { const u = state.meta.centUndo; if (!u) return; centRestore(u); delete state.meta.centUndo; await changed(L('ย้อนกลับแล้ว', 'Undone')); centRefresh(); },
});
document.addEventListener('change', e => { const t = e.target; if (t?.dataset?.action === 'cent-opt') { ui.centOpt = { ...(ui.centOpt || { lots: true, money: false }), [t.dataset.k]: t.checked }; centRefresh(); } });

/* ============================================================
   v3.51 — DEFAULT FX RATES. An account in another currency (THB, EUR…) needs a rate from the instrument's
   currency (usually USD). A trade's own FX rate wins; otherwise the default rate here is used, so trades no
   longer drop out of the stats silently. Cent accounts use the parent currency (USC → USD).
   ============================================================ */
/* trades that still can't be valued, grouped by the missing pair */
function missingFxPairs() {
  const m = new Map();
  for (const t of state.trades) {
    if (t.status === 'Missed' || t.grossPnL != null) continue;
    const i = specOf(t), ac = get('accounts', t.accountId)?.currency, vc = i?.valueCurrency || i?.quoteCurrency;
    if (!i || !ac || !fxNeededFor(vc, ac) || fxFactor(vc, ac, t.fxRate) != null) continue;
    const k = vc + ':' + centParent(ac); m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}
/* pairs worth offering: missing ones, ones already set, and USD → each non-USD account currency */
function fxPairsToShow() {
  const set = new Set([...missingFxPairs().keys(), ...Object.keys(state.settings.fxRates || {})]);
  for (const a of state.accounts) { const p = centParent(a.currency); if (p && p !== 'USD') set.add('USD:' + p); }
  return [...set].sort();
}
function fxBanner() {
  const m = missingFxPairs(); if (!m.size) return '';
  const n = sum([...m.values()]), pairs = [...m.keys()].map(k => k.replace(':', ' → ')).join(', ');
  return `<div class="notice warn mb16">${icon('alert')}<span class="grow">${L(`${n} เทรดคำนวณเงินไม่ได้ เพราะยังไม่มีอัตราแลกเปลี่ยน ${pairs} — จึงยังไม่ถูกนับในสถิติและกราฟ`, `${n} trades can't be valued — no FX rate for ${pairs} — so they are left out of stats and charts`)}</span>${btn(icon('coins') + L(' ตั้งอัตราแลกเปลี่ยน', ' Set FX rates'), 'fx-open', {}, 'sm')}</div>`;
}
function openFxTool() {
  const m = missingFxPairs(), rates = state.settings.fxRates || {};
  const rows = fxPairsToShow().map(k => { const [f, t] = k.split(':'), n = m.get(k) || 0; return `<div class="fx-row"><label for="fx_${k}">1 ${esc(f)} =</label><input id="fx_${k}" type="number" step="any" inputmode="decimal" min="0" data-fx-pair="${esc(k)}" value="${rates[k] ?? ''}" placeholder="${L('ยังไม่ได้ตั้ง', 'not set')}"><span>${esc(t)}</span>${n ? `<em class="neg small">${L(`${n} เทรดรออยู่`, `${n} trades waiting`)}</em>` : '<em></em>'}</div>`; }).join('');
  openModal({ title: icon('coins') + L(' อัตราแลกเปลี่ยนเริ่มต้น', ' Default FX rates'), size: 'md',
    body: `<p class="muted small" style="margin-top:0">${L('ใช้กับเทรดที่ไม่ได้กรอกอัตราแลกเปลี่ยนเอง · เทรดที่กรอกไว้ใช้ค่าของตัวเอง · บัญชีเซ็นต์ใช้สกุลหลัก (USC → USD) แล้วคูณ 100 ให้', 'Used by trades without their own FX rate · trades with one keep it · cent accounts use the parent currency (USC → USD) and ×100')}</p>${rows ? `<div class="fx-list">${rows}</div>` : `<p class="dim">${L('ไม่มีบัญชีที่ต้องใช้อัตราแลกเปลี่ยน', 'No account needs an FX rate')}</p>`}<p class="help mt8">${L('ค่าเดียวใช้กับทุกวัน — ถ้าต้องการความแม่นยำรายเทรด ให้กรอกอัตราในเทรดนั้น หรือนำเข้าพร้อมกำไรจากโบรกเกอร์', 'One rate for every day — for exact figures, type the rate on the trade or import with the broker’s profit')}</p>`,
    foot: `<div class="grow"></div>${btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost')}${btn(icon('save') + L(' บันทึก', ' Save'), 'fx-save', {}, 'primary')}` });
}
Object.assign(SPEC_ACTIONS, {
  'fx-open': () => openFxTool(),
  'fx-save': async () => {
    const r = { ...(state.settings.fxRates || {}) };
    $$('[data-fx-pair]').forEach(i => { const v = num(i.value); if (v > 0) r[i.dataset.fxPair] = v; else delete r[i.dataset.fxPair]; });
    state.settings.fxRates = r; closeModal(); invalidate(); await changed(L('บันทึกอัตราแลกเปลี่ยนแล้ว', 'FX rates saved'));
    if ($('#calc-form')) updateCalc();
  },
});

/* ============================================================
   v3.52 — CENT ACCOUNT TYPE (UI only — the maths is the same as a USC/EUC account)
   · account editor: "Account units: Standard / Cent" + main currency (USD → USC, EUR → EUC)
   · every money input shows its unit, and on cent accounts a "≈ $" hint
   ============================================================ */
const CENT_OF = Object.fromEntries(Object.entries(CENT).map(([c, p]) => [p, c])); // USD → USC
const centBadge = cur => isCent(cur) ? `<span class="cent-badge" data-tip="${L(`บัญชีเซ็นต์ · 100 ${cur} = 1 ${centParent(cur)}`, `Cent account · 100 ${cur} = 1 ${centParent(cur)}`)}">${L('เซ็นต์', 'Cent')}</span>` : '';
const centHint = (v, cur) => isCent(cur) && finite(v) && v ? `≈ ${money(v / centMul(cur), centParent(cur))}` : '';
/* which currency a form's money fields are in */
function formCurrency(form) {
  if (!form) return '';
  if (form.id === 'acc-form') { const r = form.querySelector('input[name=accUnits]:checked'); return r ? (r.value === 'cent' ? 'USC' : 'USD') : (form.dataset.cur || editor?.record?.currency || 'USD'); }
  const acc = get('accounts', form.querySelector('[name=accountId]')?.value); return acc?.currency || '';
}
function moneyUnits(form) {
  if (!form) return; const cur = formCurrency(form);
  form.querySelectorAll('.cur-unit').forEach(u => { u.textContent = cur; });
  form.querySelectorAll('[data-cur-hint]').forEach(h => { const v = num(form.querySelector(`[name=${h.dataset.curHint}]`)?.value); h.textContent = centHint(v, cur); });
  form.querySelectorAll('.acc-cent-flag').forEach(f => { f.innerHTML = centBadge(cur); });
  form.querySelectorAll('.acc-type-cur').forEach(x => { x.textContent = cur; });
}
const MONEY_FORMS = '#acc-form, #txn-form, #editor-form';
document.addEventListener('input', e => { const f = e.target.closest?.(MONEY_FORMS); if (f) moneyUnits(f); });
document.addEventListener('change', e => { const f = e.target.closest?.(MONEY_FORMS); if (f) moneyUnits(f); });
/* run once a form has been drawn */
new MutationObserver(() => $$(MONEY_FORMS).forEach(f => { if (!f.dataset.unitsInit) { f.dataset.unitsInit = '1'; moneyUnits(f); } })).observe(document.documentElement, { childList: true, subtree: true });
/* field helpers */
const moneyField = (name, label, val, extra = {}) => field(name, label, val, 'number', { ...extra, suffix: '<b class="cur-unit"></b>', help: `${extra.help ? extra.help + ' ' : ''}<span class="cur-hint" data-cur-hint="${name}"></span>` });

/* ============================================================
   v3.53 — ONE CURRENCY PER ACCOUNT TYPE
   · Standard account = USD · Cent account = USC (100 USC = 1 USD) — keeps the money maths simple
   · the type is chosen when the account is created and is locked afterwards
   · switching type later goes through the convert tool, which converts the account's data with it
     (preview before/after, one undo step). Accounts made before v3.53 in another currency keep working
     and can be converted to USD / USC with an exchange rate.
   ============================================================ */
const ACC_CURS = ['USD', 'USC'];
function accTypeField(a, existing) {
  const cur = a.currency || 'USD', cent = isCent(cur), legacy = !ACC_CURS.includes(cur);
  const tip = esc(L('บัญชีปกติใช้ USD · บัญชีเซ็นต์ใช้ USC (100 USC = 1 USD) กรอกทุน ฝาก/ถอน และค่าคอมมิชชันตามที่เห็นใน MT5 · สเปกสินทรัพย์ไม่ต้องแก้', 'Standard accounts use USD · Cent accounts use USC (100 USC = 1 USD) — type capital, deposits and commission as MT5 shows them · instrument specs stay as they are'));
  const lab = `<label>${L('ประเภทบัญชี', 'Account type')} <span class="info-tip" data-tip="${tip}">${icon('info', 'tiny')}</span></label>`;
  if (!existing) return `<div class="field span2">${lab}<div class="seg acc-units" role="radiogroup"><label><input type="radio" name="accUnits" value="std" ${cent ? '' : 'checked'}><span>${L('ปกติ', 'Standard')} · USD</span></label><label><input type="radio" name="accUnits" value="cent" ${cent ? 'checked' : ''}><span>${L('เซ็นต์', 'Cent')} · USC</span></label></div>
    <p class="help">${L('สกุลเงินของบัญชี', 'Account currency')}: <b class="acc-type-cur">${cent ? 'USC' : 'USD'}</b> · ${L('เลือกแล้วเปลี่ยนภายหลังไม่ได้ ยกเว้นใช้เครื่องมือ “แปลงประเภทบัญชี” ซึ่งแปลงข้อมูลไปพร้อมกัน', 'Fixed once created — switching later uses “Convert account”, which converts the data with it')}</p></div>`;
  return `<div class="field span2">${lab}<div class="acc-type-lock"><span class="acc-type-v">${icon('lock', 'tiny')}<b>${cent ? L('เซ็นต์', 'Cent') : legacy ? L('เดิม', 'Legacy') : L('ปกติ', 'Standard')}</b><span class="dim">·</span><span>${esc(cur)}</span>${centBadge(cur)}</span>${btn(icon('refresh') + L(' แปลงประเภทบัญชี…', ' Convert account…'), 'acc-convert', { 'data-id': a.id }, 'sm')}</div>
    <p class="help">${legacy ? L(`บัญชีนี้สร้างไว้ด้วยสกุล ${esc(cur)} ก่อนระบบใหม่ ยังใช้งานได้ตามเดิม · แปลงเป็นบัญชีปกติ (USD) หรือเซ็นต์ (USC) ได้ด้วยอัตราแลกเปลี่ยน`, `Created in ${esc(cur)} before account types — still works · convert it to Standard (USD) or Cent (USC) with an exchange rate`) : L('เปลี่ยนประเภทบัญชีตรงนี้ไม่ได้ — ใช้ “แปลงประเภทบัญชี” เพื่อแปลงยอดเงินและเทรดทั้งหมดไปพร้อมกัน', 'The type can’t be changed here — “Convert account” converts the balance and all trades with it')}</p></div>`;
}
/* snapshot / restore / apply for a whole-account conversion */
const MONEY_KEYS = ['commission', 'swap', 'grossPnL', 'riskAmount'];
function convSnapshot(accId) {
  const a = get('accounts', accId);
  return { accId, at: now(), currency: a.currency, start: a.startingCapital, trades: state.trades.filter(t => t.accountId === accId).map(t => ({ id: t.id, quantity: t.quantity, executions: clone(t.executions || null), fxRate: t.fxRate, ...Object.fromEntries(MONEY_KEYS.map(k => [k, t[k]])) })), txns: state.transactions.filter(t => t.accountId === accId).map(t => ({ id: t.id, amount: t.amount })) };
}
function convRestore(s) {
  const a = get('accounts', s.accId); if (!a) return; a.currency = s.currency; a.startingCapital = s.start;
  for (const x of s.trades) { const t = get('trades', x.id); if (!t) continue; t.quantity = x.quantity; for (const k of [...MONEY_KEYS, 'fxRate']) { if (x[k] === undefined) delete t[k]; else t[k] = x[k]; } if (x.executions) t.executions = x.executions; else delete t.executions; }
  for (const x of s.txns) { const t = state.transactions.find(y => y.id === x.id); if (t) t.amount = x.amount; }
  invalidate();
}
/* money × mMul, lots × qMul (trades with the broker's own profit keep their lots), fx rates re-based by fxDiv */
function convApply(accId, toCur, mMul, qMul, fxDiv) {
  const a = get('accounts', accId); if (!a) return 0; let n = 0;
  const r = v => Math.round(v * 1e8) / 1e8;
  a.currency = toCur;
  if (mMul !== 1) { a.startingCapital = r((a.startingCapital || 0) * mMul); for (const t of state.transactions) if (t.accountId === accId && finite(t.amount)) t.amount = r(t.amount * mMul); }
  for (const t of state.trades) {
    if (t.accountId !== accId) continue; let ch = false;
    if (qMul !== 1 && t.grossPnL == null) { if (t.quantity > 0) { t.quantity = qtyRound(t.quantity * qMul); ch = true; } if (t.executions?.length) t.executions = t.executions.map(x => ({ ...x, quantity: x.quantity > 0 ? qtyRound(x.quantity * qMul) : x.quantity })); }
    if (mMul !== 1) for (const k of MONEY_KEYS) if (finite(t[k]) && t[k]) { t[k] = r(t[k] * mMul); ch = true; }
    if (fxDiv !== 1 && t.fxRate > 0 && t.fxRate !== 1) { t.fxRate = r(t.fxRate / fxDiv); ch = true; }
    if (ch) { t.updatedAt = now(); n++; }
  }
  invalidate(); return n;
}
/* the options in effect → factors */
function convPlan(accId) {
  const a = get('accounts', accId), from = a.currency || 'USD', o = ui.convOpt || {}, legacy = !ACC_CURS.includes(from);
  const to = legacy ? (o.to || 'USD') : isCent(from) ? 'USD' : 'USC';
  const fp = centParent(from), rate = fp === 'USD' ? 1 : num(o.rate) > 0 ? num(o.rate) : null; // 1 USD = rate × parent currency
  const money = o.money !== false, lots = !legacy && !!o.lots;
  const mMul = money && rate ? centMul(to) / centMul(from) / rate : 1;
  const qMul = lots ? (isCent(to) ? 1 / 100 : 100) : 1;
  return { a, from, to, legacy, rate, needRate: fp !== 'USD', money, lots, mMul, qMul, fxDiv: rate || 1 };
}
function convPreview(accId, pl) {
  const measure = () => { const closed = state.trades.filter(t => t.accountId === accId && t.status === 'Closed'); return { bal: accountBalance(accId), pnl: sum(closed.map(t => calc(t).net).filter(finite)), start: get('accounts', accId).startingCapital, lots: sum(closed.map(t => t.quantity || 0)), n: closed.length }; };
  if (!pl) return measure();
  const snap = convSnapshot(accId); convApply(accId, pl.to, pl.mMul, pl.qMul, pl.fxDiv); const out = measure(); convRestore(snap); return out;
}
function convToolHTML(accId) {
  const pl = convPlan(accId), { a, from, to, legacy } = pl, now0 = convPreview(accId), ok = !pl.needRate || pl.rate, after = ok ? convPreview(accId, pl) : null, undo = state.meta.convUndo?.accId === accId ? state.meta.convUndo : null;
  const name = c => isCent(c) ? L('เซ็นต์', 'Cent') + ' (' + c + ')' : c === 'USD' ? L('ปกติ', 'Standard') + ' (USD)' : c;
  const row = (k, f0, f1) => `<tr><td>${k}</td><td class="num">${f0}</td><td class="num"><b>${f1}</b></td></tr>`, dash = '<span class="dim">—</span>';
  const mf = (v, c) => money(v, c, false), pf = (v, c) => money(v, c, true), lf = v => fmt(v, 2);
  return `<div class="conv-flow"><span class="conv-pill">${esc(name(from))}</span>${icon('chev-right')}<span class="conv-pill on">${esc(name(to))}</span></div>
    ${legacy ? `<div class="field mb12"><label>${L('แปลงเป็น', 'Convert to')}</label><div class="seg acc-units" role="radiogroup"><label><input type="radio" name="convTo" value="USD" data-action="conv-opt" data-k="to" ${to === 'USD' ? 'checked' : ''}><span>${L('ปกติ', 'Standard')} · USD</span></label><label><input type="radio" name="convTo" value="USC" data-action="conv-opt" data-k="to" ${to === 'USC' ? 'checked' : ''}><span>${L('เซ็นต์', 'Cent')} · USC</span></label></div></div>` : ''}
    ${pl.needRate ? `<div class="field mb12"><label for="conv-rate">${L('อัตราแลกเปลี่ยน', 'Exchange rate')}</label><div class="fx-row"><label for="conv-rate">1 USD =</label><input id="conv-rate" type="number" step="any" min="0" inputmode="decimal" data-action="conv-opt" data-k="rate" value="${pl.rate ?? ''}" placeholder="${L('เช่น 33.5', 'e.g. 33.5')}"><span>${esc(centParent(from))}</span></div><p class="help">${L('ใช้แปลงยอดเงิน และอัตราแลกเปลี่ยนในเทรดที่กรอกไว้', 'Converts the money and any FX rate typed on trades')}</p></div>` : ''}
    <div class="spec-opts mb16">
      <label class="spec-opt"><input type="checkbox" class="cb" data-action="conv-opt" data-k="money" ${pl.money ? 'checked' : ''}><div><b>${legacy ? L('แปลงจำนวนเงินตามอัตราแลกเปลี่ยน', 'Convert money at the exchange rate') : isCent(to) ? L('คูณจำนวนเงินด้วย 100 (USD → USC)', 'Multiply money by 100 (USD → USC)') : L('หารจำนวนเงินด้วย 100 (USC → USD)', 'Divide money by 100 (USC → USD)')}</b><small>${L('ทุนเริ่มต้น ฝาก/ถอน ค่าคอมมิชชัน สวอป และกำไรที่นำเข้าจากโบรกเกอร์ — มูลค่าเท่าเดิม แค่เปลี่ยนหน่วย · ปิดไว้ถ้าตัวเลขที่กรอกเป็นหน่วยใหม่อยู่แล้ว', 'Starting capital, deposits/withdrawals, commission, swap and imported broker profit — same value, new unit · turn off if the numbers are already in the new unit')}</small></div></label>
      ${legacy ? '' : `<label class="spec-opt"><input type="checkbox" class="cb" data-action="conv-opt" data-k="lots" ${pl.lots ? 'checked' : ''}><div><b>${isCent(to) ? L('หารจำนวนล็อตด้วย 100', 'Divide lots by 100') : L('คูณจำนวนล็อตด้วย 100', 'Multiply lots by 100')}</b><small>${isCent(to) ? L('ใช้เฉพาะเมื่อเคยกรอกล็อตเกินจริงเพื่อให้ตัวเลขตรงกับ MT5 บัญชีเซ็นต์ (เช่น กรอก 10 แทน 0.1)', 'Only if lots were typed 100× too big to match the MT5 cent account (e.g. 10 instead of 0.1)') : L('ใช้เฉพาะเมื่อต้องการให้กำไรเป็นดอลลาร์เท่ากับตัวเลขเซ็นต์เดิม', 'Only if the dollar profit should equal the old cent figures')} · ${L('เทรดที่นำเข้าพร้อมกำไรจากโบรกเกอร์ไม่ถูกแตะ', 'trades imported with broker profit are left alone')}</small></div></label>`}
    </div>
    <div class="tablewrap"><table class="recalc-t"><thead><tr><th></th><th class="num">${L('ตอนนี้', 'Now')} · ${esc(from)}</th><th class="num">${L('หลังแปลง', 'After')} · ${esc(to)}</th></tr></thead><tbody>
      ${row(L('ทุนเริ่มต้น', 'Starting capital'), mf(now0.start, from), after ? mf(after.start, to) : dash)}${row(L('กำไรจากการเทรด', 'Trading P&L'), pf(now0.pnl, from), after ? pf(after.pnl, to) : dash)}${row(L('ล็อตรวม', 'Total lots'), lf(now0.lots), after ? lf(after.lots) : dash)}${row(`<b>${L('ยอดเงินปัจจุบัน', 'Balance')}</b>`, mf(now0.bal, from), after ? mf(after.bal, to) : dash)}
    </tbody></table></div>
    <p class="help mt8">${ok ? L('เทียบยอดเงินหลังแปลงกับ Balance ใน MT5 · ย้อนกลับได้ 1 ขั้น', 'Compare the balance after with MT5 · one undo step') : L('ใส่อัตราแลกเปลี่ยนก่อน', 'Enter the exchange rate first')}</p>
    ${undo ? `<div class="notice info mt16">${icon('info')}<span class="grow">${L('แปลงล่าสุด', 'Last conversion')} ${esc(undo.currency)} → ${esc(a.currency)} · ${fmtDate(undo.at, { time: true })}</span>${btn(icon('undo') + L(' ย้อนกลับ', ' Undo'), 'conv-undo', { 'data-id': accId }, 'sm')}</div>` : ''}`;
}
function openConvertTool(accId) {
  const a = get('accounts', accId); if (!a) return;
  ui.convOpt = { money: true, lots: false, to: 'USD', rate: defaultFx('USD', centParent(a.currency)) || '' };
  openModal({ title: icon('refresh') + L(' แปลงประเภทบัญชี', ' Convert account'), size: 'md', body: `<div id="conv-body" data-id="${accId}">${convToolHTML(accId)}</div>`,
    foot: `<div class="grow"></div>${btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost')}${btn(icon('check') + L(' แปลงบัญชี', ' Convert'), 'conv-apply', { 'data-id': accId }, 'primary')}` });
}
const convRefresh = () => { const b = $('#conv-body'); if (!b) return; const f = document.activeElement?.id; b.innerHTML = convToolHTML(b.dataset.id); if (f === 'conv-rate') { const i = $('#conv-rate'); i?.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch { } } };
Object.assign(SPEC_ACTIONS, {
  'acc-convert': el => { const id = el.dataset.id; if ($('#acc-form')) closeModal(); openConvertTool(id); },
  'conv-apply': async el => {
    const id = el.dataset.id, pl = convPlan(id);
    if (pl.needRate && !pl.rate) { toast(L('ใส่อัตราแลกเปลี่ยนก่อน', 'Enter the exchange rate first'), 'bad'); $('#conv-rate')?.focus(); return; }
    state.meta.convUndo = convSnapshot(id); const n = convApply(id, pl.to, pl.mMul, pl.qMul, pl.fxDiv);
    closeModal(); await changed(L(`แปลงบัญชีเป็น ${pl.to} แล้ว (${n} เทรด) — ย้อนกลับได้จากเมนูบัญชี`, `Account converted to ${pl.to} (${n} trades) — undo from the account menu`));
    if ($('#calc-form')) updateCalc();
  },
  'conv-undo': async () => { const u = state.meta.convUndo; if (!u) return; convRestore(u); delete state.meta.convUndo; await changed(L('ย้อนกลับการแปลงแล้ว', 'Conversion undone')); convRefresh(); },
});
document.addEventListener('change', e => { const t = e.target; if (t?.dataset?.action !== 'conv-opt' || !t.closest('#conv-body')) return; const k = t.dataset.k; ui.convOpt = { ...(ui.convOpt || {}), [k]: t.type === 'checkbox' ? t.checked : t.value }; convRefresh(); });
document.addEventListener('input', e => { const t = e.target; if (t?.id === 'conv-rate') { ui.convOpt = { ...(ui.convOpt || {}), rate: t.value }; clearTimeout(convRefresh.t); convRefresh.t = setTimeout(convRefresh, 250); } });

/* v3.55 — Insights metrics card: click a column header to sort the groups */
Object.assign(SPEC_ACTIONS, { 'bd-sort': el => { ui.breakdownMetric = el.dataset.k; try { savePrefs(); } catch { } renderMain(); } });
/* v3.58 — globe icon for the language switch in the slide-out menu */
ICONS.globe = ICONS.globe || '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>';

/* v3.58 — collapse a section card in the trade sidebar */
Object.assign(SPEC_ACTIONS, { 'td-col': el => el.closest('.tds-box')?.classList.toggle('collapsed') });

/* ============================================================
   v3.58 — DATE RANGE PICKER (popover): preset pills on the left, month calendar with a range band, Reset · Cancel · OK
   ============================================================ */
const DR_PRESETS = () => [['today', L('วันนี้', 'Today')], ['yesterday', L('เมื่อวาน', 'Previous day')], ['7d', L('7 วันล่าสุด', 'Last 7 days')], ['30d', L('30 วันล่าสุด', 'Last 30 days')], ['lastmonth', L('เดือนที่แล้ว', 'Previous month')], ['month', L('เดือนนี้ถึงวันนี้', 'Month to date')], ['ytd', L('ปีนี้ถึงวันนี้', 'Year to date')], ['all', L('ทั้งหมด', 'All time')], ['custom', L('กำหนดเอง', 'Custom range')]];
const drFmt = k => { if (!k) return ''; const [y, m, d] = k.split('-'); return LANG === 'th' ? `${+d}/${+m}/${y}` : `${+m}/${+d}/${y}`; };
function rangeLabel() {
  if (ui.preset === 'custom' && ui.from) return `${drFmt(ui.from)} – ${drFmt(ui.to || ui.from)}`;
  return (PRESETS().find(p => p[0] === ui.preset) || PRESETS()[0])[1];
}
const drKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function drHTML() {
  const S = window.__dr, { y, m } = S.view, first = new Date(Date.UTC(y, m, 1)).getUTCDay(), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), today = todayKey();
  const loc = LANG === 'th' ? 'th-TH-u-ca-gregory' : 'en-US', mon = i => new Intl.DateTimeFormat(loc, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1)));
  const wd = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(loc, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + i))));
  const yrs = (() => { const ks = state.trades.map(t => tradeDay(t)).filter(Boolean).sort(), y0 = +(ks[0] || today).slice(0, 4) - 1, y1 = +today.slice(0, 4) + 1; const out = []; for (let k = Math.min(y0, y); k <= Math.max(y1, y); k++) out.push(k); return out; })();
  const from = S.from, to = S.to || S.from;
  let cells = ''; for (let i = 0; i < first; i++) cells += '<span class="dr-d empty"></span>';
  for (let d = 1; d <= days; d++) { const k = drKey(y, m, d), inR = from && to && k >= from && k <= to, st = k === from, en = k === to;
    cells += `<button type="button" class="dr-d ${inR ? 'in' : ''} ${st ? 'st' : ''} ${en ? 'en' : ''} ${k === today ? 'today' : ''}" data-action="dr-day" data-k="${k}"><span>${d}</span></button>`; }
  return `<div class="dr-top"><span class="dr-field">${from ? `${drFmt(from)} – ${drFmt(to)}` : L('ทั้งหมด', 'All time')}</span>${icon('calendar')}</div>
    <div class="dr-main"><div class="dr-pre">${DR_PRESETS().map(([k, l]) => `<button type="button" class="dr-p ${S.preset === k ? 'on' : ''}" data-action="dr-preset" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="dr-cal"><div class="dr-nav"><button type="button" class="dr-ar" data-action="dr-mon" data-d="-1" aria-label="prev">${icon('chev-left')}</button><select class="dr-sel" data-dr="m">${[...Array(12)].map((_, i) => `<option value="${i}" ${i === m ? 'selected' : ''}>${mon(i)}</option>`).join('')}</select><button type="button" class="dr-ar" data-action="dr-mon" data-d="1" aria-label="next">${icon('chev-right')}</button>
      <button type="button" class="dr-ar" data-action="dr-mon" data-d="-12" aria-label="prev year">${icon('chev-left')}</button><select class="dr-sel" data-dr="y">${yrs.map(v => `<option value="${v}" ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select><button type="button" class="dr-ar" data-action="dr-mon" data-d="12" aria-label="next year">${icon('chev-right')}</button></div>
      <div class="dr-grid">${wd.map(w => `<span class="dr-w">${w}</span>`).join('')}${cells}</div></div></div>
    <div class="dr-foot"><button type="button" class="dr-tb" data-action="dr-reset">${L('รีเซ็ต', 'Reset')}</button><div class="grow"></div><button type="button" class="dr-tb" data-action="dr-close">${L('ยกเลิก', 'Cancel')}</button><button type="button" class="dr-tb ok" data-action="dr-ok">OK</button></div>`;
}
function drRender() { const p = $('#dr-pop'); if (p) p.innerHTML = drHTML(); }
function drPlace(btn) {
  const p = $('#dr-pop'); if (!p || !btn) return; const r = btn.getBoundingClientRect(), w = p.offsetWidth;
  if (innerWidth <= 640) { p.style.left = '8px'; p.style.right = '8px'; p.style.top = Math.min(r.bottom + 8, innerHeight - p.offsetHeight - 8) + 'px'; return; }
  p.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px'; p.style.top = Math.min(r.bottom + 8, Math.max(8, innerHeight - p.offsetHeight - 8)) + 'px';
}
function drOpen(btn) {
  drClose(); const base = (ui.to || ui.from || todayKey());
  window.__dr = { preset: ui.preset || 'all', from: ui.from || '', to: ui.to || '', pick: 0, view: { y: +base.slice(0, 4), m: +base.slice(5, 7) - 1 } };
  document.body.insertAdjacentHTML('beforeend', `<div class="dr-pop" id="dr-pop" role="dialog" aria-label="${L('ช่วงเวลา', 'Date range')}"></div>`);
  drRender(); drPlace(btn); window.__drBtn = btn;
}
function drClose() { $('#dr-pop')?.remove(); window.__dr = null; }
Object.assign(SPEC_ACTIONS, {
  'dr-open': el => { if ($('#dr-pop')) { drClose(); return; } drOpen(el); },
  'dr-close': () => drClose(),
  'dr-preset': el => { const S = window.__dr, k = el.dataset.k; S.preset = k; if (k === 'custom') { S.pick = 0; } else { const [f, t] = presetRange(k); S.from = f || ''; S.to = t || ''; const b = S.to || S.from; if (b) S.view = { y: +b.slice(0, 4), m: +b.slice(5, 7) - 1 }; } drRender(); },
  'dr-day': el => { const S = window.__dr, k = el.dataset.k; S.preset = 'custom'; if (!S.pick) { S.from = k; S.to = ''; S.pick = 1; } else { if (k < S.from) { S.to = S.from; S.from = k; } else S.to = k; S.pick = 0; } drRender(); },
  'dr-mon': el => { const S = window.__dr; let mm = S.view.m + +el.dataset.d, yy = S.view.y; while (mm < 0) { mm += 12; yy--; } while (mm > 11) { mm -= 12; yy++; } S.view = { y: yy, m: mm }; drRender(); },
  'dr-reset': () => { const S = window.__dr; S.preset = 'all'; S.from = ''; S.to = ''; S.pick = 0; drRender(); },
  'dr-ok': () => { const S = window.__dr; if (!S) return; if (S.preset === 'custom' && !S.from) { S.preset = 'all'; }
    ui.preset = S.preset; if (S.preset === 'custom') { ui.from = S.from; ui.to = S.to || S.from; } else { const [f, t] = presetRange(S.preset); ui.from = f; ui.to = t; }
    drClose(); ui.page = 1; ui.selected?.clear?.(); savePrefs(); render(); },
});
document.addEventListener('change', e => { const t = e.target; if (!t.dataset?.dr || !window.__dr) return; const S = window.__dr; if (t.dataset.dr === 'm') S.view.m = +t.value; else S.view.y = +t.value; drRender(); });
document.addEventListener('mousedown', e => { if ($('#dr-pop') && !e.target.closest('#dr-pop, .dr-btn')) drClose(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#dr-pop')) { drClose(); e.stopPropagation(); } }, true);
window.addEventListener('resize', () => { if ($('#dr-pop')) drPlace(window.__drBtn && document.contains(window.__drBtn) ? window.__drBtn : $('.dr-btn')); });
/* v3.61 — row "⋯" menus inside scrolling tables/cards are lifted out (fixed position) so the list is never clipped */
document.addEventListener('toggle', e => {
  const d = e.target; if (!(d instanceof HTMLDetailsElement) || !d.classList.contains('menu')) return;
  const pop = d.querySelector(':scope > .menu-pop'); if (!pop) return;
  if (!d.open) { pop.classList.remove('lifted'); pop.style.cssText = ''; return; }
  if (!d.closest('.tablewrap, .panel-b, .drawer-b, .modal-b, .mcard')) return;
  const r = d.querySelector('summary').getBoundingClientRect();
  pop.classList.add('lifted'); pop.style.position = 'fixed'; pop.style.right = 'auto'; pop.style.top = '0px'; pop.style.left = '0px';
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const top = r.bottom + 4 + h > innerHeight - 8 ? Math.max(8, r.top - 4 - h) : r.bottom + 4;
  pop.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px'; pop.style.top = top + 'px';
}, true);
const closeLifted = () => $$('details.menu[open] > .menu-pop.lifted').forEach(p => p.parentElement.removeAttribute('open'));
window.addEventListener('scroll', closeLifted, true); window.addEventListener('resize', closeLifted);
