/* ============================================================
   TOOLS — Calculator (popup: position size + ladder preview),
   Session clock and Risk monitor
   ============================================================ */
const calcAccount = (p = {}) => p.accountId || ui.account || state.settings.defaultAccount || state.accounts.find(a => a.active !== false)?.id || state.accounts[0]?.id;
/* v3.64 — account type (Standard / Standard Cent) + display unit; "no account" works with a capital you type */
const CALC_VIRT = {};
function calcVirtual(id) { const cur = String(id).slice(5); if (!['USD', 'USC'].includes(cur)) return undefined; return CALC_VIRT[cur] ??= { id, name: L('ไม่ผูกบัญชี', 'No account'), currency: cur, startingCapital: 0, active: true, virtual: true }; }
const calcTypeOf = id => isCent(get('accounts', id)?.currency) ? 'cent' : 'std';
function calcAccOptions(type, cur) {
  const list = state.accounts.filter(a => (a.active !== false || a.id === cur) && (isCent(a.currency) === (type === 'cent'))).sort((a, b) => a.name.localeCompare(b.name));
  const v = type === 'cent' ? 'calc:USC' : 'calc:USD';
  return list.map(a => opt(a.id, `${a.name} · ${a.currency}`, cur)).join('') + opt(v, `${L('ไม่ผูกบัญชี', 'No account')} · ${type === 'cent' ? 'USC' : 'USD'}${list.length ? '' : L(' (ยังไม่มีบัญชีประเภทนี้)', ' (no account of this type yet)')}`, cur);
}
/* v3.78 — the account picker is a small button at the top right: every account (Standard and Cent) + "no account" for each type */
function calcAllAccOptions(cur) {
  const list = state.accounts.filter(a => a.active !== false || a.id === cur).sort((a, b) => isCent(a.currency) - isCent(b.currency) || a.name.localeCompare(b.name));
  return list.map(a => opt(a.id, `${a.name} · ${a.currency}`, cur)).join('') + opt('calc:USD', `${L('ไม่ผูกบัญชี', 'No account')} · USD`, cur) + opt('calc:USC', `${L('ไม่ผูกบัญชี', 'No account')} · USC`, cur);
}
const calcTypeOfId = id => String(id).startsWith('calc:') ? (id === 'calc:USC' ? 'cent' : 'std') : calcTypeOf(id);
function calcUnitSeg(accId, sel) { const c = get('accounts', accId)?.currency || (accId === 'calc:USC' ? 'USC' : 'USD'), us = isCent(c) ? [c, centParent(c)] : [c], on = us.includes(sel) ? sel : c; return { html: us.length > 1 ? seg(us.map(u => [u, u]), on, 'calc-unit') : `<span class="calc-unit1">${esc(c)}</span>`, on }; }
function calcUnitOptions(accId, sel) { const c = get('accounts', accId)?.currency || 'USD', us = isCent(c) ? [c, centParent(c)] : [c]; return us.map(u => opt(u, u === c ? `${u} · ${L('สกุลเงินบัญชี', 'account currency')}` : `${u} · ${L('หาร 100', '÷ 100')}`, us.includes(sel) ? sel : c)).join(''); }
function calcTypeSync(f) {
  const acc = f.accountId; if (!acc) return;
  if (f.dataset.acc !== acc.value) { // account changed (or first run): type, unit and capital follow it
    const t = calcTypeOfId(acc.value), first = !f.dataset.acc; f.calcType.value = t;
    $$('#calc-type .seg button').forEach(b => b.classList.toggle('on', b.dataset.value === t));
    const u = calcUnitSeg(acc.value, first ? f.showUnit.value : ''); f.showUnit.value = u.on; const ub = $('#calc-unitbox'); if (ub) ub.innerHTML = u.html;
    { const cu = $('.calc-capu'); if (cu) cu.textContent = affixSym(get('accounts', acc.value)?.currency || (acc.value === 'calc:USC' ? 'USC' : 'USD')); }
    const cap = f.balanceOverride, a = get('accounts', acc.value); if (cap) { const bal = a && !a.virtual ? accountBalance(acc.value) : null, bs = finite(bal) ? String(+bal.toFixed(2)) : ''; if (!first || !cap.value || cap.value === bs) { cap.value = bs; cap.dataset.auto = bs; } }
    f.dataset.acc = acc.value;
  }
}

/* FX rate is only asked for when the instrument's value currency differs from the account currency */
function fxField(val = '') { return `<div class="field" data-fx hidden><label for="f_fxRate" data-fx-label>${L('อัตราแลกเปลี่ยน', 'FX rate')}</label><input id="f_fxRate" name="fxRate" type="number" step="any" inputmode="decimal" value="${esc(val ?? '')}"><small class="help" data-fx-help></small></div>`; }
function syncFx(form, accountId, instrumentId) {
  const w = form?.querySelector('[data-fx]'); if (!w) return false;
  const ins = get('instruments', instrumentId), acc = get('accounts', accountId), vc = ins?.valueCurrency || ins?.quoteCurrency, need = !!(ins && acc && fxNeededFor(vc, acc.currency));
  w.hidden = !need;
  if (need) { const d = defaultFx(vc, centParent(acc.currency)), inp = w.querySelector('input'); if (inp) inp.placeholder = d ? L('ค่าเริ่มต้น ', 'default ') + d : ''; w.querySelector('[data-fx-label]').textContent = `${L('อัตราแลกเปลี่ยน', 'FX rate')}: 1 ${vc} = ? ${centParent(acc.currency)}${isCent(acc.currency) ? L(' (แอปคูณ 100 เป็น ', ' (×100 to ') + acc.currency + ')' : ''}`; w.querySelector('[data-fx-help]').textContent = L(`เช่น USDJPY 150 → 1 JPY = ${fmt(1 / 150, 5)} USD`, `e.g. USDJPY 150 → 1 JPY = ${fmt(1 / 150, 5)} USD`); }
  return need;
}
/* route form edits (typing, instrument picks) to the right live preview */
function refreshForm(el) {
  if (el.closest('#editor-form')) return updateLive();
  if (el.closest('#calc-form')) return updateCalc();
}

/* ---------------- Position size ---------------- */
const calcUnit = () => 'pips'; // v3.47: the calculator shows pips only
/* distance in the chosen unit: pips (instrument pip size) or points (smallest price step) */
function distUnit(insId) {
  const i = get('instruments', insId), pt = i?.pointSize > 0 ? i.pointSize : i?.tickSize > 0 ? i.tickSize : null, pip = i?.pipSize > 0 ? i.pipSize : pt;
  const u = calcUnit(), size = u === 'points' ? pt : pip;
  return { size, label: u === 'points' ? L('จุด', 'points') : L('ปิ๊บ', 'pips'), f: v => finite(v) && size ? fmt(v / size, u === 'points' ? 0 : 1) + ' ' + (u === 'points' ? L('จุด', 'points') : L('ปิ๊บ', 'pips')) : '—' };
}
function calcFormHTML(prefill = {}) {
  const accId = calcAccount(prefill), cur = get('accounts', accId)?.currency || L('เงิน', 'Money');
  if (prefill.cost != null && prefill.cost !== '' && prefill.spread == null && prefill.commission == null) { prefill = { ...prefill, spread: prefill.cost, commission: 0 }; } // older callers passed one combined cost
  const risk = `<div class="field"><label for="f_riskPct">${L('ความเสี่ยง', 'Risk')}</label><div class="risk-in"><input id="f_riskPct" name="riskPct" type="number" step="any" inputmode="decimal" value="${esc(prefill.riskPct ?? (state.settings.preferredRisk || 1))}"><select name="riskMode" aria-label="${L('หน่วยความเสี่ยง', 'Risk unit')}">${opt('pct', '%', prefill.riskMode || 'pct')}${opt('amt', affixSym(get('accounts', accId)?.currency) || cur, prefill.riskMode || 'pct')}</select></div></div>`;
  const insPick = instrumentPicker('instrumentId', prefill.instrumentId || lastUsed('instrumentId') || 'ins_XAUUSD').replace(/^<div class="field">|<\/div>$/g, '');
  const t0 = calcTypeOfId(accId), u0 = calcUnitSeg(accId, prefill.showUnit);
  const top = `<div class="calc-span6 calc-top"><input type="hidden" name="calcType" value="${t0}"><input type="hidden" name="showUnit" value="${esc(u0.on)}"><div class="calc-types"><span id="calc-type">${seg([['std', 'Standard'], ['cent', 'Standard Cent']], t0, 'calc-type')}</span><span class="calc-unitw"><small>${L('หน่วย', 'Unit')}</small><span id="calc-unitbox">${u0.html}</span></span></div><label class="calc-accw" data-tip="${L('บัญชี', 'Account')}">${icon('wallet')}<select id="f_accountId" name="accountId" aria-label="${L('บัญชี', 'Account')}">${calcAllAccOptions(accId)}</select></label></div>`;
  return `<form id="calc-form" onsubmit="return false"><div class="calc-split"><div class="calc-in"><div class="formgrid c6">
      <div class="field calc-span6 calc-ins">${insPick}${ibtn('info', 'calc-ins-edit', L('รายละเอียด / แก้ไขสินทรัพย์', 'Instrument details / edit'), {}, 'sm calc-ins-ed')}</div>
      ${field('entryPrice', L('ราคาเข้า', 'Entry price'), prefill.entryPrice ?? '', 'number', { attrs: 'autofocus', cls: 'calc-span2' })}${field('stopLoss', 'S/L', prefill.stopLoss ?? '', 'number', { cls: 'calc-span2' })}${field('takeProfit', L('T/P (ไม่บังคับ)', 'T/P (optional)'), prefill.takeProfit ?? '', 'number', { cls: 'calc-span2' })}
      <div class="calc-sep"></div>
      ${top}
      ${field('balanceOverride', L('ทุน', 'Capital'), prefill.balanceOverride ?? '', 'number', { placeholder: L('ยอดบัญชี', 'Account balance'), cls: 'calc-span3', suffix: `<b class="calc-capu">${esc(affixSym(get('accounts', accId)?.currency || (accId === 'calc:USC' ? 'USC' : 'USD')))}</b>` })}<div class="calc-span3 calc-risk">${risk}</div>
      ${field('calcSpread', gl(L('สเปรด (หน่วยราคา)', 'Spread (price units)')), prefill.spread ?? '', 'number', { help: '<span id="calc-spread-help"></span>', cls: 'calc-span3' })}${field('calcCommission', gl(L('ค่าคอมมิชชัน / ล็อต (ไปกลับ)', 'Commission / lot (round trip)'), 'commission'), prefill.commission ?? '', 'number', { help: '<span id="calc-comm-help"></span>', cls: 'calc-span3' })}
      <div class="calc-span6 calc-fx">${fxField(prefill.fxRate)}</div></div>
      <div class="calc-foot" id="calc-acct"></div>
      </div>
      <div class="calc-out" id="calc-out"></div></div><div class="calc-actions">${btn(icon('refresh') + L(' ล้างค่า', ' Clear'), 'calc-clear', {}, 'ghost')}${btn(icon('plus') + L(' สร้างเทรดจากค่านี้', ' Create trade from this'), 'calc-to-trade', {}, 'primary')}</div></form>`;
}
/* v3.47 — the calculator is a page (#calculator), not a dialog. Its inputs are kept in ui.calcPrefill. */
function sizeCalculator(prefill = {}) {
  if (!state.accounts.length) { toast(L('สร้างบัญชีก่อนใช้เครื่องคำนวณ', 'Create an account first')); return; }
  if (Object.keys(prefill).length) ui.calcPrefill = { ...(ui.calcPrefill || {}), ...prefill };
  if (ui.route === 'calculator') { if (Object.keys(prefill).length) renderMain(); } else go('calculator');
  setTimeout(() => $('#f_entryPrice')?.focus(), 40);
}
function calculatorView() {
  if (!state.accounts.length) return pageHead(L('เครื่องคำนวณ', 'Calculator')) + empty(L('ยังไม่มีบัญชี', 'No account yet'), L('สร้างบัญชีก่อนใช้เครื่องคำนวณ', 'Create an account first'), btn(icon('plus') + L(' เพิ่มบัญชี', ' Add account'), 'new-account', {}, 'primary'));
  return `<div class="calc-wrap">` + setHead(L('เครื่องคำนวณขนาดสัญญา', 'Position size calculator'), L('คำนวณล็อตจากความเสี่ยง พร้อมกำไร ขาดทุน และมาร์จิ้น', 'Lots from your risk, with profit, loss and margin'))
    + `<section class="panel calc-page"><div class="panel-b">${calcFormHTML(ui.calcPrefill || {})}</div></section></div>`; // v3.72: centered
}
function calcInput() {
  const f = $('#calc-form'); if (!f) return null; calcTypeSync(f); const d = formData(f);
  const entry = num(d.entryPrice), sl = num(d.stopLoss), tp = num(d.takeProfit);
  const side = entry != null && sl != null ? (sl < entry ? 'Buy' : 'Sell') : tp != null && entry != null && tp < entry ? 'Sell' : 'Buy';
  const needFx = syncFx(f, d.accountId, d.instrumentId);
  ui.calcPrefill = { accountId: d.accountId, instrumentId: d.instrumentId, riskPct: d.riskPct, riskMode: d.riskMode, entryPrice: d.entryPrice, stopLoss: d.stopLoss, takeProfit: d.takeProfit, spread: d.calcSpread, commission: d.calcCommission, balanceOverride: d.balanceOverride, fxRate: d.fxRate, showUnit: d.showUnit };
  const fxRate = needFx ? num(d.fxRate) : 1, auto = autoCost(d.accountId, d.instrumentId, fxRate), rate = tickRate({ accountId: d.accountId, instrumentId: d.instrumentId, fxRate });
  const acur = get('accounts', d.accountId)?.currency, showUnit = isCent(acur) && d.showUnit === centParent(acur) ? d.showUnit : acur;
  const sp = num(d.calcSpread), cm = num(d.calcCommission), spread = Math.max(0, sp != null ? sp : auto.spread), perLot = Math.max(0, cm != null ? cm : auto.perLot), comm = perLot && rate ? perLot / rate : 0;
  return { accountId: d.accountId, instrumentId: d.instrumentId, entryPrice: entry, stopLoss: sl, takeProfit: tp, riskPct: num(d.riskPct), riskMode: d.riskMode === 'amt' ? 'amt' : 'pct', side, fxRate, needFx, spread, perLot, comm, cost: spread + comm, spreadAuto: sp == null, commAuto: cm == null, auto, balanceOverride: f.balanceOverride?.dataset.auto != null && d.balanceOverride === f.balanceOverride.dataset.auto ? null : num(d.balanceOverride), showUnit };
}
/* price-unit amount with up to decimals+2 places, trailing zeros trimmed */
const pxFmt = (v, dec = 2) => finite(v) ? String(+(+v).toFixed(Math.min(10, dec + 2))) : '—';
/* defaults from the instrument: spread (price units) + commission per lot (set value, else this account's average) */
function autoCost(accountId, instrumentId, fxRate) {
  const ins = specFor(get('instruments', instrumentId), accountId), spread = ins?.spread > 0 ? ins.spread : 0, tr = tickRate({ accountId, instrumentId, fxRate }), cpl = commissionPerLotFor(get('instruments', instrumentId), accountId);
  const ac = cpl > 0 ? null : avgCommission(accountId, instrumentId, fxRate), perLot = cpl > 0 ? cpl : ac?.perLot || 0;
  const comm = perLot && tr ? perLot / tr : 0;
  return { spread, comm, perLot, avg: !!ac, n: ac?.n || 0, total: spread + comm, ok: spread > 0 || comm > 0 };
}
/* average commission per lot on this account + instrument (closed trades), converted to price units */
function avgCommission(accountId, instrumentId, fxRate) {
  const rows = state.trades.filter(t => t.accountId === accountId && t.instrumentId === instrumentId && t.status === 'Closed' && t.quantity > 0 && t.commission > 0);
  if (!rows.length) return null;
  const perLot = sum(rows.map(t => t.commission)) / sum(rows.map(t => t.quantity)), rate = tickRate({ accountId, instrumentId, fxRate });
  return { n: rows.length, perLot, price: rate ? perLot / rate : null };
}
/* small print under the inputs: capital, risk budget and the round-trip cost used */
function calcAcctHTML(p, c) {
  const acc = get('accounts', p.accountId); if (!acc) return '';
  const cur = acc.currency || '', ins = get('instruments', p.instrumentId), dec = ins?.decimals ?? 2, du = distUnit(p.instrumentId), ov = p.balanceOverride > 0;
  const item = (k, v, sub = '') => `<span><b>${k}</b> ${v}${sub ? ` <i>${sub}</i>` : ''}</span>`;
  const dk = p.showUnit && p.showUnit !== cur ? 1 / centMul(cur) : 1;
  return item(L('ทุนที่ใช้คำนวณ', 'Capital used'), money(finite(c.bal) ? c.bal * dk : c.bal, dk === 1 ? cur : p.showUnit), ov ? L('กำหนดเอง', 'custom') : acc.virtual ? L('ใส่ทุนในช่อง “ทุน”', 'type it in “Capital”') : L('ยอดบัญชีปัจจุบัน', 'current balance'))
    + item(gl(L('ต้นทุนต่อรอบ', 'Round-trip cost')), `${pxFmt(p.cost, dec)} (${du.f(p.cost)})`, `${L('สเปรด', 'spread')} ${pxFmt(p.spread, dec)} + ${L('ค่าคอมมิชชัน', 'commission')} ${pxFmt(p.comm, dec)}`);
}
function calcSpecHTML(p, M) { // v3.78 — only the pip value (per 1 lot, in the display unit)
  const ins = specFor(get('instruments', p.instrumentId), p.accountId), rate = tickRate({ accountId: p.accountId, instrumentId: p.instrumentId, fxRate: p.fxRate }), pv = ins?.pipSize && rate ? ins.pipSize * rate : null;
  return `<div class="cs-row"><span>${gl(L('มูลค่าต่อปิ๊บ', 'Pip value'), 'pip')}</span><b>${finite(pv) ? M(pv) + L(' / ล็อต', ' / lot') : '—'}</b></div>`;
}
function updateCalc() {
  const p = calcInput(); if (!p) return;
  let c = planCalc(p); const bo = p.balanceOverride, amt = p.riskMode === 'amt';
  if (bo > 0 || amt) { const ins = specFor(get('instruments', p.instrumentId), p.accountId), bal = bo > 0 ? bo : c.bal, budget = amt ? Math.max(0, p.riskPct || 0) : bal * (p.riskPct || 0) / 100, step = ins?.quantityStep || .01; const qty = c.perUnit ? Math.floor((budget / c.perUnit + 1e-9) / step) * step : null; c = { ...c, bal, budget, qty, risk: qty * c.perUnit, reward: c.rr && qty ? qty * c.perUnit * c.rr : null }; }
  const cur = get('accounts', p.accountId)?.currency || '', dk = p.showUnit && p.showUnit !== cur ? 1 / centMul(cur) : 1, dcur = dk === 1 ? cur : p.showUnit, M = (v, sg) => money(finite(v) ? v * dk : v, dcur, sg), dist = p.entryPrice != null && p.stopLoss != null ? Math.abs(p.entryPrice - p.stopLoss) : null;
  const tpOk = p.takeProfit != null && p.entryPrice != null && (p.takeProfit - p.entryPrice) * (p.side === 'Sell' ? -1 : 1) > 0, tpDist = tpOk ? Math.abs(p.takeProfit - p.entryPrice) : null;
  const netR = dist > EPS && tpOk ? (tpDist - p.cost) / (dist + p.cost) : null, be = finite(netR) && netR > 0 ? 100 / (1 + netR) : null;
  const minRR = state.settings.rules?.minRR || 0, insP = specFor(get('instruments', p.instrumentId), p.accountId), dec = insP?.decimals ?? 2, du = distUnit(p.instrumentId), au = p.auto;
  const warn = [];
  if (p.needFx && !(p.fxRate > 0) && !tickRate({ accountId: p.accountId, instrumentId: p.instrumentId })) warn.push(L('ใส่อัตราแปลงสกุลเงินเพื่อคำนวณจำนวนและเงิน', 'Enter the FX rate to compute quantity and money'));
  if (p.takeProfit != null && p.entryPrice != null && !tpOk) warn.push(L('T/P อยู่ผิดฝั่งของราคาเข้า', 'T/P is on the wrong side of the entry price'));
  if (finite(netR) && minRR && netR < minRR) warn.push(L(`R สุทธิ 1:${fmt(netR, 2)} ต่ำกว่าขั้นต่ำ 1:${fmt(minRR, 1)} ในกฎของคุณ`, `Net R 1:${fmt(netR, 2)} is below your minimum 1:${fmt(minRR, 1)}`));
  if (finite(c.qty) && insP?.minQuantity && c.qty < insP.minQuantity - EPS) warn.push(L(`จำนวนต่ำกว่าขั้นต่ำของสินทรัพย์ (${insP.minQuantity})`, `Quantity is below the instrument minimum (${insP.minQuantity})`));
  { const o = $('#calc-form [name=riskMode]')?.options[1]; if (o && cur) o.textContent = affixSym(cur); }
  { const bo = $('#f_balanceOverride'); if (bo) bo.placeholder = get('accounts', p.accountId)?.virtual ? L('ใส่ทุนที่ใช้คำนวณ', 'Type the capital') : L('ยอดบัญชี', 'Account balance'); }
  { const box = $('#calc-acct'), h = calcAcctHTML(p, c); if (box && box.dataset.h !== h) { box.innerHTML = h; box.dataset.h = h; } }
  { /* spread / commission: blank = instrument default, shown as placeholder; help shows the conversion */
    const fs = $('#f_calcSpread'), fc = $('#f_calcCommission'), hs = $('#calc-spread-help'), hc = $('#calc-comm-help');
    if (fs) fs.placeholder = au.spread > 0 ? L('อัตโนมัติ ', 'Auto ') + pxFmt(au.spread, dec) : L('ยังไม่ได้ตั้ง', 'Not set');
    if (fc) fc.placeholder = au.perLot > 0 ? L('อัตโนมัติ ', 'Auto ') + fmt(au.perLot, 2) : L('ยังไม่ได้ตั้ง', 'Not set');
    if (hs) hs.textContent = p.spread > 0 ? `${du.f(p.spread)}${p.spreadAuto ? L(' · จากสินทรัพย์', ' · from instrument') : L(' · กำหนดเอง', ' · custom')}` : L('ตั้งค่าเริ่มต้นได้ในรายละเอียดสินทรัพย์', 'Set a default in the instrument details');
    if (hc) hc.textContent = p.perLot > 0 ? `${cur} · ≈ ${pxFmt(p.comm, dec)} ${L('หน่วยราคา', 'price units')}${p.commAuto ? (au.avg ? L(` · เฉลี่ยจาก ${au.n} เทรด`, ` · average of ${au.n} trades`) : L(' · จากสินทรัพย์', ' · from instrument')) : L(' · กำหนดเอง', ' · custom')}` : `${cur} · ${L('ไม่มีค่าคอมมิชชัน', 'no commission')}`; }
  const lowNet = finite(netR) && minRR && netR < minRR;
  const sub = t => t ? `<small>${t}</small>` : '';
  const row = (k, v, cls, t) => `<div class="cr-row"><span>${k}</span><div><strong class="${cls}">${v}</strong>${sub(t)}</div></div>`;
  const pctBud = c.bal > 0 && finite(c.budget) ? fmt(c.budget / c.bal * 100, 2) + '% ' + L('ของทุน', 'of capital') : '';
  const mg = marginOf({ instrumentId: p.instrumentId, accountId: p.accountId, price: p.entryPrice, lots: c.qty, fxRate: p.fxRate });
  const mgSub = finite(mg.v) ? `${esc(mg.mode)}${mg.lev && (mg.mode === 'Forex' || mg.mode === 'Contracts Leverage') ? ' · 1:' + fmt(mg.lev, 0) : ''}${c.bal > 0 ? '<br>' + fmt(mg.v / c.bal * 100, 1) + '% ' + L('ของทุน', 'of capital') : ''}` : '';
  const rrSub = finite(netR) ? `${L('หลังต้นทุน', 'after costs')} <span class="${lowNet ? 'warn' : ''}">1 : ${fmt(netR, 2)}</span>` : '';
  $('#calc-out').innerHTML = `<div class="calc-res">
    <div class="calc-hrow"><div class="calc-h">${L('ผลลัพธ์', 'Result')}</div><span class="calc-unit-chip">${calcTypeOf(p.accountId) === 'cent' ? 'Standard Cent' : 'Standard'} · ${esc(dcur || '')}</span></div>
    <div class="cr-hero"><label>${gl(L('ขนาดสัญญา', 'Position size'))}</label><div class="row gap8"><strong class="accent">${finite(c.qty) ? fmt(c.qty, 2) : '—'}</strong>${p.entryPrice != null && p.stopLoss != null ? sideBadge(p.side) : ''}</div></div>
    <div class="cr-list">
      ${row(gl(L('งบความเสี่ยง', 'Risk budget'), 'riskBudget'), M(c.budget), '', pctBud)}
      ${row(L('กำไรที่อาจได้', 'Potential profit'), M(tpOk ? c.reward : null, true), 'pos', tpOk ? du.f(tpDist) : '')}
      ${row(L('ขาดทุนที่อาจเสีย', 'Potential loss'), M(finite(c.risk) ? -c.risk : null), 'neg', dist > EPS ? du.f(dist) : '')}
      ${row(gl(L('มาร์จิ้นที่ใช้', 'Margin required'), 'margin'), M(mg.v), '', mgSub)}
      ${row(gl(L('อัตราส่วนกำไรต่อความเสี่ยง', 'Risk reward ratio'), 'rrNet'), tpOk && finite(c.rr) ? '1 : ' + fmt(c.rr, 2) : '—', '', rrSub)}
    </div>
    ${warn.length ? `<div class="notice warn">${icon('alert')}<span>${warn.map(esc).join('<br>')}</span></div>` : ''}
    <div class="cr-spec"><div class="cr-spec-t">${calcSpecHTML(p, M)}</div></div>
  </div>`;
  window.__calc = { p, c };
}

/* ============================================================
   SESSION CLOCK — same session definitions as the stats (each
   market judged in its own local time, so DST is automatic)
   ============================================================ */
const SESSION_DEFS = [['Asia', 'Asia/Tokyo', 7, 18], ['London', 'Europe/London', 8, 17], ['New York', 'America/New_York', 8, 17]];
const pad2 = n => String(n).padStart(2, '0');
function sessionWindows(from, to) {
  const out = [];
  for (const [k, zone, o, c] of SESSION_DEFS) {
    const p = dateParts(new Date(from).toISOString(), zone), k0 = shiftKey(`${p.year}-${p.month}-${p.day}`, { days: -1 });
    for (let i = 0; i < 7; i++) { const day = shiftKey(k0, { days: i }), wd = weekdayOfKey(day); if (wd === 0 || wd === 6) continue; const a = +new Date(toISO(`${day}T${pad2(o)}:00`, zone)), b = +new Date(toISO(`${day}T${pad2(c)}:00`, zone)); if (b > from && a < to) out.push({ k, a, b }); }
  }
  return out.sort((x, y) => x.a - y.a);
}
function overlapWindows(wins) { const lon = wins.filter(w => w.k === 'London'), ny = wins.filter(w => w.k === 'New York'), out = []; for (const a of lon) for (const b of ny) { const s = Math.max(a.a, b.a), e = Math.min(a.b, b.b); if (e > s) out.push({ k: 'London–NY', a: s, b: e }); } return out; }
function clockState(t = Date.now()) {
  const wins = sessionWindows(t - 864e5, t + 5 * 864e5), active = wins.filter(w => w.a <= t && t < w.b), has = k => active.find(w => w.k === k);
  let cur = null;
  if (has('London') && has('New York')) cur = { k: 'London–NY', b: Math.min(has('London').b, has('New York').b) };
  else if (has('London')) cur = { k: 'London', b: has('London').b }; else if (has('New York')) cur = { k: 'New York', b: has('New York').b }; else if (has('Asia')) cur = { k: 'Asia', b: has('Asia').b };
  const next = wins.find(w => w.a > t && (!cur || !active.includes(w)));
  return { t, wins, active, cur, next };
}
function countdown(ms) { const m = Math.max(0, Math.round(ms / 6e4)), h = Math.floor(m / 60); return h >= 24 ? `${Math.floor(h / 24)}${L(' วัน ', 'd ')}${h % 24}${L(' ชม.', 'h')}` : `${h}:${pad2(m % 60)}`; }
function sessionChipInner(s = clockState()) {
  return s.cur
    ? `<i class="sc-dot on"></i><span class="sc-txt"><b>${esc(sessionLabel(s.cur.k))}</b> · ${L('ปิดใน', 'closes in')} ${countdown(s.cur.b - s.t)}</span>`
    : `<i class="sc-dot"></i><span class="sc-txt">${s.next ? `<b>${esc(sessionLabel(s.next.k))}</b> · ${L('เปิดใน', 'opens in')} ${countdown(s.next.a - s.t)}` : L('ตลาดปิด', 'Market closed')}</span>`;
}
function sessionChipHTML() { return `<details class="menu sclock" id="sclock"><summary class="btn ghost sclock-btn" aria-label="${L('นาฬิกาเซสชัน', 'Session clock')}">${icon('session-clock')}${sessionChipInner()}</summary><div class="menu-pop sclock-pop" id="sclock-pop"></div></details>`; }
/* one line per broker clock in use, e.g. "Broker server 18:42 (UTC+3)" */
function brokerClocksHTML(t) {
  const zs = new Map(); state.accounts.filter(a => a.active !== false && a.brokerTz).forEach(a => { if (!zs.has(a.brokerTz)) zs.set(a.brokerTz, []); zs.get(a.brokerTz).push(a.name); });
  if (!zs.size) return '';
  const iso = new Date(t).toISOString();
  return `<div class="sc-broker">${[...zs].map(([z, names]) => `<div data-tip="${esc(names.join(', '))}">${icon('clock', 'tiny')}<span>${L('เวลาเซิร์ฟเวอร์', 'Broker server')}${zs.size > 1 ? ' · ' + esc(names[0]) + (names.length > 1 ? ' +' + (names.length - 1) : '') : ''}</span><b>${fmtTime(iso, z)}</b><i>${utcLabel(z, t)} · ${L('วันที่', 'day')} ${fmtDate(dateKey(iso, z), { year: false })}</i></div>`).join('')}</div>`;
}
function zoneOffset(zone, ms) { const p = dateParts(new Date(ms).toISOString(), zone); return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(ms / 6e4) * 6e4) / 6e4); }
function dstNotices(t = Date.now()) {
  const out = [], mine = zoneOffset(tz(), t);
  for (const [k, zone] of [['London', 'Europe/London'], ['New York', 'America/New_York']]) {
    const o0 = zoneOffset(zone, t); for (let d = 1; d <= 30; d++) { const ms = t + d * 864e5; if (zoneOffset(zone, ms) !== o0 || zoneOffset(tz(), ms) !== mine) { out.push(L(`${sessionLabel(k)} เปลี่ยนเวลาออมแสงประมาณ ${fmtDate(dateKey(new Date(ms).toISOString()))} — เวลาเปิด-ปิดตามเวลาของคุณจะเลื่อน 1 ชั่วโมง`, `${k} changes its clocks around ${fmtDate(dateKey(new Date(ms).toISOString()))} — its hours in your time zone shift by 1 hour`)); break; } }
  }
  return out;
}
function sessionClockPopHTML() {
  const s = clockState(), all = [...s.wins, ...overlapWindows(s.wins)];
  // show today, or the next day the market trades (weekends)
  let day = todayKey(), start, end, today = [];
  for (let i = 0; i < 4; i++, day = shiftKey(day, { days: 1 })) { start = +new Date(toISO(day + 'T00:00')); end = +new Date(toISO(shiftKey(day, { days: 1 }) + 'T00:00')); today = all.filter(w => w.b > start && w.a < end); if (today.length) break; }
  const isToday = day === todayKey(), pct = v => clamp((v - start) / (end - start) * 100, 0, 100);
  const hm = ms => fmtTime(new Date(ms).toISOString()), stat = new Map(group(filtered(), 'session').map(g => [g.key, g.s]));
  const bar = k => today.filter(w => w.k === k).map(w => `<i class="sc-seg ${w.a <= s.t && s.t < w.b ? 'on' : ''}" style="left:${pct(w.a)}%;width:${pct(w.b) - pct(w.a)}%"></i>`).join('');
  const lines = ['Asia', 'London', 'London–NY', 'New York'].map(k => {
    const w = today.find(x => x.k === k && x.b > s.t) || today.filter(x => x.k === k).pop(), on = w && w.a <= s.t && s.t < w.b, nx = !on && [...s.wins, ...overlapWindows(s.wins)].find(x => x.k === k && x.a > s.t), st = stat.get(k);
    return `<div class="sc-row ${on ? 'on' : ''}"><i class="sc-dot ${on ? 'on' : ''}"></i><div class="grow"><strong>${esc(sessionLabel(k))}</strong><small class="sub2">${w ? `${hm(w.a)}–${hm(w.b)}` : L('ไม่เปิดวันนี้', 'Closed this day')}${st?.n ? ` · ${L('ผลของคุณ', 'You')}: ${L('อัตราชนะ', 'Win rate')} ${fmt(st.wr, 0)}% · ${unitFmt(st.expectancy)} · ${st.n} ${L('เทรด', 'trades')}` : ''}</small></div><span class="small ${on ? 'pos' : 'dim'}">${on ? L('ปิดใน ', 'closes in ') + countdown(w.b - s.t) : nx ? L('เปิดใน ', 'opens in ') + countdown(nx.a - s.t) : '—'}</span></div>`;
  }).join('');
  const ticks = [0, 6, 12, 18, 24].map(h => `<span style="left:${h / 24 * 100}%">${pad2(h % 24)}:00</span>`).join('');
  const dst = dstNotices(s.t);
  return `<div class="sc-head"><strong>${L('นาฬิกาเซสชัน', 'Session clock')}</strong><span class="dim small">${hm(s.t)} · ${esc(tz())}</span></div>${brokerClocksHTML(s.t)}${isToday ? '' : `<div class="notice info" style="margin-bottom:8px">${icon('info')}<span>${L(`ตลาดปิดวันนี้ — แสดงเวลาของ${dayName(weekdayOfKey(day), true)} ${fmtDate(day)}`, `Markets are closed today — showing ${dayName(weekdayOfKey(day), true)} ${fmtDate(day)}`)}</span></div>`}
    <div class="sc-time">${['Asia', 'London', 'New York'].map(k => `<div class="sc-track"><span>${esc(sessionLabel(k))}</span><div>${bar(k)}${k === 'New York' ? today.filter(w => w.k === 'London–NY').map(w => `<i class="sc-ov" style="left:${pct(w.a)}%;width:${pct(w.b) - pct(w.a)}%"></i>`).join('') : ''}</div></div>`).join('')}<div class="sc-axis">${ticks}</div>${isToday ? `<i class="sc-now" style="left:calc(64px + (100% - 64px) * ${pct(s.t) / 100})"></i>` : ''}</div>
    <div class="sc-list">${lines}</div>
    ${dst.length ? `<div class="notice info mt8">${icon('info')}<span>${dst.map(esc).join('<br>')}</span></div>` : ''}
    <p class="help" style="margin:8px 2px 0">${L('เวลาตามเขตเวลาของคุณ ปรับตามเวลาออมแสงให้อัตโนมัติ · ผลของคุณใช้ตัวกรองปัจจุบัน', 'Times in your time zone, adjusted for daylight saving · your results follow the current filters')}</p>`;
}
function tickSessionClock() {
  if (!state) return; const el = $('#sclock'); if (!el) return;
  const s = el.querySelector('summary'); if (s) s.innerHTML = icon('session-clock') + sessionChipInner();
  if (el.open) $('#sclock-pop').innerHTML = sessionClockPopHTML();
}
document.addEventListener('toggle', e => { if (e.target?.id === 'sclock' && e.target.open) $('#sclock-pop').innerHTML = sessionClockPopHTML(); }, true);
setInterval(() => { try { tickSessionClock(); if (typeof tickRiskMonitor === 'function') tickRiskMonitor(); } catch (e) { console.error(e); } }, 20000);

/* ============================================================
   RISK MONITOR — today's limits + open exposure
   ============================================================ */
function openExposure(accountId = ui.account) {
  const rows = state.trades.filter(t => t.status === 'Open' && (!accountId || t.accountId === accountId)).map(t => { const c = calc(t), bal = accountBalance(t.accountId); return { t, risk: c.risk, pct: finite(c.risk) && bal > 0 ? c.risk / bal * 100 : null }; });
  const ex = {};
  for (const { t, risk } of rows) {
    const i = specOf(t); if (!finite(risk) || !i || !['Forex', 'Metals', 'Cryptocurrencies'].includes(i.assetClass) || !i.baseCurrency || !i.quoteCurrency || i.baseCurrency === i.quoteCurrency) continue;
    const s = t.side === 'Sell' ? -1 : 1;
    for (const [ccy, dir] of [[i.baseCurrency, s], [i.quoteCurrency, -s]]) { const k = ccy + (dir > 0 ? '+' : '-'); (ex[k] ||= { ccy, dir, risk: 0, syms: [] }).risk += risk; ex[k].syms.push(i.symbol); }
  }
  return { rows, total: sum(rows.map(r => r.risk)), unknown: rows.filter(r => !finite(r.risk)).length, stacks: Object.values(ex).filter(x => x.syms.length >= 2) };
}
/* warnings shown in the trade editor before a new trade breaks today's limits */
function dailyLimitWarnings(r, c) {
  if (!r?.entryDateTime || entryDay(r) !== todayKey() || !(editor?.isNew || r.status === 'Open')) return [];
  const R = state.settings.rules || {}, d = dayDiscipline(todayKey(), r.accountId), others = d.rows.filter(t => t.id !== r.id), out = [], cur = get('accounts', r.accountId)?.currency;
  const net = sum(others.filter(t => t.status === 'Closed').map(t => calc(t).net)), st = streaks(others.filter(t => t.status === 'Closed').map(t => calc(t).net)), run = st.current < 0 ? -st.current : 0;
  if (R.maxTradesPerDay > 0 && others.length + 1 > R.maxTradesPerDay) out.push(L(`ไม้นี้จะเป็นไม้ที่ ${others.length + 1} ของวันนี้ — เกินกฎ ${R.maxTradesPerDay} ไม้/วัน`, `This would be trade #${others.length + 1} today — over your ${R.maxTradesPerDay}-trade limit`));
  if (R.maxConsecLosses > 0 && run >= R.maxConsecLosses) out.push(L(`วันนี้แพ้ติดกันแล้ว ${run} ไม้ — กฎของคุณให้หยุดพัก`, `${run} losses in a row today — your rules say stop`));
  if (d.lossLimit != null && finite(c.risk) && net - c.risk < d.lossLimit - EPS) out.push(L(`ถ้าไม้นี้ถึง S/L ขาดทุนวันนี้จะเป็น ${money(net - c.risk, cur)} — เกินเพดาน ${money(d.lossLimit, cur)}`, `If this hits its stop level, today's loss becomes ${money(net - c.risk, cur)} — past your ${money(d.lossLimit, cur)} limit`));
  return out;
}

const TOOL_ACTIONS = {
  'calc-size': (el, e) => { e?.preventDefault?.(); sizeCalculator(); },
  'calc-dist-unit': el => { state.settings.calcDistUnit = el.dataset.value === 'points' ? 'points' : 'pips'; persist(); updateCalc(); },
  'calc-acc-edit': (el, e) => { e?.preventDefault?.(); const id = $('#calc-form [name=accountId]')?.value; if (get('accounts', id)?.virtual) return toast(L('เลือกบัญชีจริงเพื่อใช้เลเวอเรจของบัญชี', 'Pick a real account to use its leverage')); if (id) openAccountEditor(id); },
  'calc-ins-edit': () => { const id = $('#calc-form [name=instrumentId]')?.value; if (id) openInstrumentEditor(id); },
  'calc-type': el => { const f = $('#calc-form'), acc = f?.accountId; if (!acc) return; const t = el.dataset.value; if (calcTypeOfId(acc.value) === t) return; const a = state.accounts.find(x => x.active !== false && isCent(x.currency) === (t === 'cent')); acc.value = a ? a.id : (t === 'cent' ? 'calc:USC' : 'calc:USD'); updateCalc(); },
  'calc-unit': el => { const f = $('#calc-form'); if (!f) return; f.showUnit.value = el.dataset.value; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); updateCalc(); },
  'calc-clear': () => { ['entryPrice', 'stopLoss', 'takeProfit', 'calcSpread', 'calcCommission', 'balanceOverride'].forEach(k => { const f = $('#f_' + k); if (f) f.value = ''; }); const cf = $('#calc-form'); if (cf) cf.dataset.acc = ''; updateCalc(); $('#f_entryPrice')?.focus(); },
  'calc-to-trade': () => {
    const x = window.__calc; if (!x?.p || !(x.p.entryPrice > 0)) { toast(L('ใส่ราคาเข้าก่อน', 'Enter an entry price first'), 'bad'); return; }
    const { p, c } = x; if ($('#calc-form')?.closest('.modal-back')) closeModal();
    openTradeEditor('', { accountId: get('accounts', p.accountId)?.virtual ? undefined : p.accountId, instrumentId: p.instrumentId, side: p.side, entryPrice: p.entryPrice, stopLoss: p.stopLoss, takeProfit: p.takeProfit, quantity: finite(c.qty) && c.qty > 0 ? +c.qty.toFixed(4) : null, status: 'Open', entryDateTime: now(), ...(p.needFx && p.fxRate > 0 ? { fxRate: p.fxRate } : {}) });
  },
  'missed-view': () => { ui.tradeQuick = 'missed'; ui.page = 1; go('trades'); },
};
