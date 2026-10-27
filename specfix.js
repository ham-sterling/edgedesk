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
function insFormInput(t) {
  const f = $('#ins-form'); if (!f || !editor) return;
  if (t.name === 'tickValue') editor.tvTouched = true;
  if (t.name === 'calcMode') editor.cmTouched = true;
  if (t.name === 'assetClass' && !editor.cmTouched) f.calcMode.value = defaultCalcMode(f.assetClass.value, f.symbol.value);
  if (t.name === 'decimals') { const dec = num(f.decimals.value); if (dec != null && dec >= 0 && dec <= 10) f.tickSize.value = +(10 ** -dec).toPrecision(8); }
  if (['contractSize', 'tickSize', 'decimals'].includes(t.name) && f.calcMode.value === 'Futures' && !editor.tvTouched) { const cs = num(f.contractSize.value), ts = num(f.tickSize.value); if (cs > 0 && ts > 0) f.tickValue.value = +(cs * ts).toPrecision(10); }
  insModeSync();
}
/* non-futures modes: profit comes from contract size, so tick value is derived (contract size × tick size) and locked */
function insModeSync() {
  const f = $('#ins-form'); if (!f) return; const mode = f.calcMode?.value || 'Contracts', fut = mode === 'Futures';
  const cs = num(f.contractSize.value), ts = num(f.tickSize.value), tv = f.tickValue;
  if (!fut && cs > 0 && ts > 0) tv.value = +(cs * ts).toPrecision(10);
  tv.readOnly = !fut; tv.classList.toggle('locked', !fut); tv.tabIndex = fut ? 0 : -1;
  const h = $('#ins-tv-help'); if (h) h.textContent = fut ? L('กรอกตาม Specification (ใช้คิดกำไร)', 'From the specification (drives profit)') : L('ขนาดสัญญา × ขนาดติ๊ก (คำนวณให้)', 'Contract size × tick size (calculated)');
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
