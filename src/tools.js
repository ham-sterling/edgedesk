/* ============================================================
   TOOLS — Calculator (popup: position size + ladder preview),
   Session clock and Risk monitor
   ============================================================ */
const calcAccount = (p = {}) => p.accountId || ui.account || state.settings.defaultAccount || state.accounts.find(a => a.active !== false)?.id || state.accounts[0]?.id;

/* FX rate is only asked for when the instrument's value currency differs from the account currency */
function fxField(val = '') { return `<div class="field" data-fx hidden><label for="f_fxRate" data-fx-label>FX rate</label><input id="f_fxRate" name="fxRate" type="number" step="any" inputmode="decimal" value="${esc(val ?? '')}"><small class="help" data-fx-help></small></div>`; }
function syncFx(form, accountId, instrumentId) {
  const w = form?.querySelector('[data-fx]'); if (!w) return false;
  const ins = get('instruments', instrumentId), acc = get('accounts', accountId), vc = ins?.valueCurrency || ins?.quoteCurrency, need = !!(ins && acc && vc && vc !== acc.currency);
  w.hidden = !need;
  if (need) { w.querySelector('[data-fx-label]').textContent = `${L('อัตราแปลงสกุลเงิน', 'FX rate')}: 1 ${vc} = ? ${acc.currency}`; w.querySelector('[data-fx-help]').textContent = L(`เช่น USDJPY 150 → 1 JPY = ${fmt(1 / 150, 5)} USD`, `e.g. USDJPY 150 → 1 JPY = ${fmt(1 / 150, 5)} USD`); }
  return need;
}
/* route form edits (typing, instrument picks) to the right live preview */
function refreshForm(el) {
  if (el.closest('#editor-form')) return updateLive();
  if (el.closest('#calc-form')) return updateCalc();
}

/* ---------------- Position size ---------------- */
function calcFormHTML(prefill = {}) {
  const accId = calcAccount(prefill), cur = get('accounts', accId)?.currency || L('เงิน', 'Money');
  const risk = `<div class="field calc-m1"><label for="f_riskPct">${L('ความเสี่ยง', 'Risk')}</label><div class="risk-in"><input id="f_riskPct" name="riskPct" type="number" step="any" inputmode="decimal" value="${esc(prefill.riskPct ?? (state.settings.preferredRisk || 1))}"><select name="riskMode" aria-label="${L('หน่วยความเสี่ยง', 'Risk unit')}">${opt('pct', '%', prefill.riskMode || 'pct')}${opt('amt', cur, prefill.riskMode || 'pct')}</select></div></div>`;
  return `<form id="calc-form" onsubmit="return false"><div class="calc-split"><div class="calc-in"><div class="formgrid c3">
      <div class="field span4 calc-ins">${instrumentPicker('instrumentId', prefill.instrumentId || lastUsed('instrumentId') || 'ins_XAUUSD').replace(/^<div class="field">|<\/div>$/g, '')}</div>
      ${field('entryPrice', L('ราคาเข้า', 'Entry price'), prefill.entryPrice ?? '', 'number', { attrs: 'autofocus' })}${field('stopLoss', 'S/L', prefill.stopLoss ?? '', 'number')}${field('takeProfit', L('T/P (ไม่บังคับ)', 'T/P (optional)'), prefill.takeProfit ?? '', 'number')}
      <div class="calc-sep span4"></div>
      ${field('accountId', L('บัญชี', 'Account'), accId, 'select', { html: entityOptions('accounts', accId), span: 4 })}
      ${field('balanceOverride', L('ทุน', 'Capital'), prefill.balanceOverride ?? '', 'number', { placeholder: L('ยอดบัญชี', 'Account balance'), cls: 'calc-m1' })}${field('cost', L('ต้นทุนต่อรอบ (หน่วยราคา)', 'Round-trip cost (price units)'), prefill.cost ?? '', 'number', { help: `<span id="calc-cost-help">${L('สเปรด + ค่าคอม', 'Spread + commission')}</span>`, cls: 'calc-m1' })}${risk}
      <div class="span4 calc-fx">${fxField(prefill.fxRate)}</div>
      <div class="calc-acct field span4" id="calc-acct"></div></div></div>
      <div class="calc-out" id="calc-out"></div></div></form>`;
}
function sizeCalculator(prefill = {}) {
  if (!state.accounts.length) { toast(L('สร้างบัญชีก่อนใช้เครื่องคำนวณ', 'Create an account first')); return; }
  if ($('#calc-form')) { setTimeout(() => $('#f_entryPrice')?.focus(), 30); return; }
  openModal({
    title: icon('calculator') + L(' เครื่องคำนวณขนาดสัญญา', ' Position size calculator'), size: 'xl',
    body: calcFormHTML({ ...(ui.calcPrefill || {}), ...prefill }),
    foot: `${btn(icon('refresh') + L(' ล้างค่า', ' Clear'), 'calc-clear', {}, 'ghost')}<div class="grow"></div>${btn(L('ปิด', 'Close'), 'close-modal', {}, 'ghost')}${btn(icon('plus') + L(' สร้างเทรดจากค่านี้', ' Create trade from this'), 'calc-to-trade', {}, 'primary')}`
  });
  updateCalc(); setTimeout(() => $('#f_entryPrice')?.focus(), 30);
}
function calcInput() {
  const f = $('#calc-form'); if (!f) return null; const d = formData(f);
  const entry = num(d.entryPrice), sl = num(d.stopLoss), tp = num(d.takeProfit);
  const side = entry != null && sl != null ? (sl < entry ? 'Buy' : 'Sell') : tp != null && entry != null && tp < entry ? 'Sell' : 'Buy';
  const needFx = syncFx(f, d.accountId, d.instrumentId);
  ui.calcPrefill = { accountId: d.accountId, instrumentId: d.instrumentId, riskPct: d.riskPct, riskMode: d.riskMode, entryPrice: d.entryPrice, stopLoss: d.stopLoss, takeProfit: d.takeProfit, cost: d.cost, balanceOverride: d.balanceOverride, fxRate: d.fxRate };
  const fxRate = needFx ? num(d.fxRate) : 1, auto = autoCost(d.accountId, d.instrumentId, fxRate), manual = num(d.cost);
  return { accountId: d.accountId, instrumentId: d.instrumentId, entryPrice: entry, stopLoss: sl, takeProfit: tp, riskPct: num(d.riskPct), riskMode: d.riskMode === 'amt' ? 'amt' : 'pct', side, fxRate, needFx, cost: Math.max(0, manual != null ? manual : auto.total || 0), costAuto: manual == null, auto, balanceOverride: num(d.balanceOverride) };
}
/* price-unit amount with up to decimals+2 places, trailing zeros trimmed */
const pxFmt = (v, dec = 2) => finite(v) ? String(+(+v).toFixed(Math.min(10, dec + 2))) : '—';
/* round-trip cost from the instrument: spread + commission per lot (set value, else this account's average) in price units */
function autoCost(accountId, instrumentId, fxRate) {
  const ins = get('instruments', instrumentId), spread = ins?.spread > 0 ? ins.spread : 0, tr = tickRate({ accountId, instrumentId, fxRate });
  const ac = ins?.commissionPerLot > 0 ? null : avgCommission(accountId, instrumentId, fxRate), perLot = ins?.commissionPerLot > 0 ? ins.commissionPerLot : ac?.perLot || 0;
  const comm = perLot && tr ? perLot / tr : 0;
  return { spread, comm, perLot, avg: !!ac, total: spread + comm, ok: spread > 0 || comm > 0 };
}
/* average commission per lot on this account + instrument (closed trades), converted to price units */
function avgCommission(accountId, instrumentId, fxRate) {
  const rows = state.trades.filter(t => t.accountId === accountId && t.instrumentId === instrumentId && t.status === 'Closed' && t.quantity > 0 && t.commission > 0);
  if (!rows.length) return null;
  const perLot = sum(rows.map(t => t.commission)) / sum(rows.map(t => t.quantity)), rate = tickRate({ accountId, instrumentId, fxRate });
  return { n: rows.length, perLot, price: rate ? perLot / rate : null };
}
function calcAcctHTML(p, c) {
  const acc = get('accounts', p.accountId); if (!acc) return '';
  const cur = acc.currency || '', ins = get('instruments', p.instrumentId), dec = ins?.decimals ?? 2, ac = avgCommission(p.accountId, p.instrumentId, p.fxRate), ov = p.balanceOverride > 0;
  const capital = `<div class="ca-row"><span class="ca-k">${L('ทุน', 'Capital')}</span><strong>${money(c.bal, cur)}</strong><span class="badge">${esc(cur)}</span><small class="dim">${ov ? L('ค่าที่กำหนดเอง', 'Custom value') : L('ยอดบัญชีปัจจุบัน · ทุนเริ่มต้น + กำไร/ขาดทุนที่ปิดแล้ว + ฝาก/ถอน', 'Current balance · starting capital + closed P&L + deposits / withdrawals')}</small></div>`;
  const risk = `<div class="ca-row"><span class="ca-k">${L('งบความเสี่ยง', 'Risk budget')}</span><strong>${money(c.budget, cur)}</strong><small class="dim">${c.bal > 0 ? fmt(c.budget / c.bal * 100, 2) + '% ' + L('ของทุน', 'of capital') : ''}</small></div>`;
  const au = p.auto || autoCost(p.accountId, p.instrumentId, p.fxRate), pu = L('หน่วยราคา', 'price units'), px = v => pxFmt(v, dec);
  const spread = `<div class="ca-row"><span class="ca-k">${L('สเปรด', 'Spread')}</span>${au.spread > 0 ? `<strong>${px(au.spread)}</strong><small class="dim">${pu}</small>` : `<small class="dim">${L('ยังไม่ได้ตั้ง — ตั้งได้ที่ ตั้งค่า → สินทรัพย์', 'Not set — add it in Settings → Instruments')}</small>`}${btn(icon('edit'), 'edit-instrument', { 'data-id': p.instrumentId, 'data-tip': L('แก้ไขสินทรัพย์', 'Edit instrument') }, 'sm ghost icon-only ca-edit')}</div>`;
  const comm = au.perLot > 0 ? `<div class="ca-row"><span class="ca-k">${au.avg ? L('ค่าคอมเฉลี่ย', 'Average commission') : L('ค่าคอม', 'Commission')}</span><strong>${money(au.perLot, cur)} / ${L('สัญญา', 'lot')}</strong><small class="dim">${au.comm > 0 ? `≈ ${px(au.comm)} ${pu}` : ''}${au.avg && ac ? ` · ${L('เฉลี่ยจาก', 'from')} ${ac.n} ${L('เทรด', 'trades')}` : ''}</small></div>`
    : `<div class="ca-row"><span class="ca-k">${L('ค่าคอม', 'Commission')}</span><small class="dim">${L('ยังไม่ได้ตั้ง และยังไม่มีประวัติในบัญชีนี้', 'Not set and no history on this account yet')}</small></div>`;
  return capital + risk + spread + comm;
}
/* TradingView-style long / short position preview: profit zone, loss zone, entry line, R ticks */
function calcLadderHTML(p, c, cur, dec) {
  const e = p.entryPrice, sl = p.stopLoss, dist = e != null && sl != null ? Math.abs(e - sl) : 0;
  if (!(dist > EPS)) return `<div class="lad-empty">${icon('trades')}<span>${L('ใส่ราคาเข้าและ S/L เพื่อดูภาพระดับราคา', 'Enter the entry price and S/L to preview the levels')}</span></div>`;
  const s = p.side === 'Sell' ? -1 : 1, rate = c.perUnit ? c.perUnit / dist : null, qty = finite(c.qty) && c.qty > 0 ? c.qty : null;
  const tpMove = p.takeProfit != null ? (p.takeProfit - e) * s : null, tpOk = tpMove > EPS, reach = tpOk ? tpMove : 3 * dist, tp = e + s * reach;
  const hi = Math.max(e, sl, tp), lo = Math.min(e, sl, tp), H = 360, P = 52, y = v => P + (hi - v) / (hi - lo) * (H - 2 * P);
  const pct = m => e ? fmt(m / e * 100, 2) + '%' : '', mon = m => rate && qty ? money(m * rate * qty, cur, true) : '';
  const zone = (a, b, cls) => `<div class="lad-z ${cls}" style="top:${Math.min(y(a), y(b)).toFixed(1)}px;height:${Math.abs(y(a) - y(b)).toFixed(1)}px"></div>`;
  const edge = (v, cls, html) => { const top = v === hi; return `<div class="lad-lab ${cls} ${top ? 'up' : 'dn'}" style="${top ? `bottom:${(H - y(v) + 4).toFixed(1)}px` : `top:${(y(v) + 4).toFixed(1)}px`}">${html}</div>`; };
  const netR = (reach - p.cost) / (dist + p.cost);
  const tpHTML = `<div><b>${tpOk ? 'T/P' : L('3R (ยังไม่ตั้ง T/P)', '3R (no T/P set)')}</b> ${fmt(tp, dec)} · ${fmt(reach / dist, 2)}R</div><div>${fmt(reach, dec)} (${pct(reach)})${mon(reach) ? ` · <span class="pos">${mon(reach)}</span>` : ''}</div>`;
  const slHTML = `<div><b>S/L</b> ${fmt(sl, dec)} · −1R</div><div>${fmt(dist, dec)} (${pct(dist)})${mon(-dist) ? ` · <span class="neg">${mon(-dist)}</span>` : ''}</div>`;
  /* right-hand price scale: S/L, entry, T/P tags + R ticks spaced at least 16px apart */
  const pxR = dist / (hi - lo) * (H - 2 * P), stepK = Math.max(1, Math.ceil(16 / pxR)), ticks = [];
  for (let k = stepK; k * dist < reach - dist * 1e-6 && ticks.length < 12; k += stepK) if (Math.abs(k * dist - reach) * pxR / dist >= 14) ticks.push(k);
  const tag = (v, cls, t) => `<div class="lad-tag ${cls}" style="top:${y(v).toFixed(1)}px"><span>${t}</span>${fmt(v, dec)}</div>`;
  const be = p.cost > 0 && p.cost < reach ? `<div class="lad-ln be" style="top:${y(e + s * p.cost).toFixed(1)}px"><span>BE</span></div>` : '';
  return `<div class="lad ${s > 0 ? 'long' : 'short'}" style="height:${H}px"><div class="lad-box">${zone(e, tp, 'pos' + (tpOk ? '' : ' ghost'))}${zone(e, sl, 'neg')}${ticks.map(k => `<div class="lad-ln r" style="top:${y(e + s * k * dist).toFixed(1)}px"></div>`).join('')}${be}
    <div class="lad-ln entry" style="top:${y(e).toFixed(1)}px"><span class="lad-chip ${s > 0 ? 'long' : 'short'}">${s > 0 ? 'LONG' : 'SHORT'}${qty ? ` · ${fmt(qty, 2)}` : ''}${tpOk ? ` · R:R ${fmt(reach / dist, 2)}` : ''}${tpOk && p.cost > 0 && finite(netR) ? ` · ${L('สุทธิ', 'net')} ${fmt(netR, 2)}` : ''}</span></div>
    ${edge(tp, 'pos', tpHTML)}${edge(sl, 'neg', slHTML)}</div>
    <div class="lad-scale">${ticks.map(k => `<div class="lad-tick" style="top:${y(e + s * k * dist).toFixed(1)}px"><span>${k}R</span>${fmt(e + s * k * dist, dec)}</div>`).join('')}${tag(tp, 'pos' + (tpOk ? '' : ' ghost'), tpOk ? 'T/P' : '3R')}${tag(e, 'entry', L('เข้า', 'Entry'))}${tag(sl, 'neg', 'S/L')}</div></div>`;
}
function updateCalc() {
  const p = calcInput(); if (!p) return;
  let c = planCalc(p); const bo = p.balanceOverride, amt = p.riskMode === 'amt';
  if (bo > 0 || amt) { const ins = get('instruments', p.instrumentId), bal = bo > 0 ? bo : c.bal, budget = amt ? Math.max(0, p.riskPct || 0) : bal * (p.riskPct || 0) / 100, step = ins?.quantityStep || .01; const qty = c.perUnit ? Math.floor((budget / c.perUnit + 1e-9) / step) * step : null; c = { ...c, bal, budget, qty, risk: qty * c.perUnit, reward: c.rr && qty ? qty * c.perUnit * c.rr : null }; }
  const cur = nameOf('accounts', p.accountId, 'currency'), dist = p.entryPrice != null && p.stopLoss != null ? Math.abs(p.entryPrice - p.stopLoss) : null;
  const tpOk = p.takeProfit != null && p.entryPrice != null && (p.takeProfit - p.entryPrice) * (p.side === 'Sell' ? -1 : 1) > 0;
  const netR = dist > EPS && tpOk ? (Math.abs(p.takeProfit - p.entryPrice) - p.cost) / (dist + p.cost) : null, be = finite(netR) && netR > 0 ? 100 / (1 + netR) : null;
  const minRR = state.settings.rules?.minRR || 0, insP = get('instruments', p.instrumentId), dec = insP?.decimals ?? 2;
  const warn = [];
  if (p.needFx && !(p.fxRate > 0)) warn.push(L('ใส่อัตราแปลงสกุลเงินเพื่อคำนวณจำนวนและเงิน', 'Enter the FX rate to compute quantity and money'));
  if (p.takeProfit != null && p.entryPrice != null && !tpOk) warn.push(L('T/P อยู่ผิดฝั่งของราคาเข้า', 'T/P is on the wrong side of the entry price'));
  if (finite(netR) && minRR && netR < minRR) warn.push(L(`R สุทธิ 1:${fmt(netR, 2)} ต่ำกว่าขั้นต่ำ 1:${fmt(minRR, 1)} ในกฎของคุณ`, `Net R 1:${fmt(netR, 2)} is below your minimum 1:${fmt(minRR, 1)}`));
  if (finite(c.qty) && insP?.minQuantity && c.qty < insP.minQuantity - EPS) warn.push(L(`จำนวนต่ำกว่าขั้นต่ำของสินทรัพย์ (${insP.minQuantity})`, `Quantity is below the instrument minimum (${insP.minQuantity})`));
  { const o = $('#calc-form [name=riskMode]')?.options[1]; if (o && cur) o.textContent = cur; }
  { const box = $('#calc-acct'), h = calcAcctHTML(p, c); if (box.dataset.h !== h) { box.innerHTML = h; box.dataset.h = h; } }
  { const ch = $('#calc-cost-help'), au = p.auto, f = $('#f_cost'); if (f) f.placeholder = au.ok ? L('อัตโนมัติ ', 'Auto ') + pxFmt(au.total, dec) : L('เช่น 0.32', 'e.g. 0.32');
    if (ch) ch.textContent = !p.costAuto ? L('กำหนดเอง · ลบค่าเพื่อใช้ค่าอัตโนมัติ', 'Custom · clear to use the automatic value') : au.ok ? L(`อัตโนมัติ = สเปรด ${pxFmt(au.spread, dec)} + ค่าคอม ${pxFmt(au.comm, dec)}`, `Auto = spread ${pxFmt(au.spread, dec)} + commission ${pxFmt(au.comm, dec)}`) : L('ตั้งสเปรด/ค่าคอมใน สินทรัพย์ หรือกรอกเอง', 'Set spread / commission on the instrument, or type a value'); }
  const lowNet = finite(netR) && minRR && netR < minRR;
  const stats = `<div class="calc-h">${L('ผลลัพธ์', 'Result')}</div><div class="live calc-kpi"><div class="hero"><label>${L('ขนาดสัญญา', 'Position size')}</label><strong class="accent">${finite(c.qty) ? fmt(c.qty, 2) : '—'}</strong><small class="sub2">${p.entryPrice != null && p.stopLoss != null ? sideBadge(p.side) : ''}</small></div><div><label>${L('ขาดทุนถ้าถึง S/L', 'Loss at S/L')}</label><strong class="neg">${money(finite(c.risk) ? -c.risk : null, cur)}</strong></div><div><label>${L('กำไรถ้าถึง T/P', 'Profit at T/P')}</label><strong class="pos">${money(tpOk ? c.reward : null, cur, true)}</strong></div></div>
    <div class="calc-kv"><div><span>${L('R:R (หลังต้นทุน)', 'R:R (after costs)')}</span><strong>${tpOk && finite(c.rr) ? '1 : ' + fmt(c.rr, 2) : '—'}${finite(netR) ? ` <em class="${lowNet ? 'warn' : ''}">(1 : ${fmt(netR, 2)})</em>` : ''}</strong></div><div><span>${L('Win rate คุ้มทุน', 'Break-even win rate')}</span><strong>${finite(be) ? fmt(be, 1) + '%' : '—'}</strong></div></div>`;
  $('#calc-out').innerHTML = `<div class="calc-res">${stats}${warn.length ? `<div class="notice warn">${icon('alert')}<span>${warn.map(esc).join('<br>')}</span></div>` : ''}<div class="calc-lad">${calcLadderHTML(p, c, cur, dec)}</div><p class="help">${L('ปัดขนาดสัญญาลงตาม step ของสินทรัพย์ เพื่อไม่ให้เสี่ยงเกินงบ · R:R หลังต้นทุน = (ระยะ T/P − ต้นทุน) ÷ (ระยะ S/L + ต้นทุน)', 'Rounded down to the volume step so risk never exceeds budget · R:R after costs = (T/P distance − cost) ÷ (S/L distance + cost)')}</p></div>`;
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
function sessionChipHTML() { return `<details class="menu sclock" id="sclock"><summary class="btn ghost sclock-btn" aria-label="Session clock">${icon('session-clock')}${sessionChipInner()}</summary><div class="menu-pop sclock-pop" id="sclock-pop"></div></details>`; }
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
  return `<div class="sc-head"><strong>Session clock</strong><span class="dim small">${hm(s.t)} · ${esc(tz())}</span></div>${isToday ? '' : `<div class="notice info" style="margin-bottom:8px">${icon('info')}<span>${L(`ตลาดปิดวันนี้ — แสดงเวลาของ${dayName(weekdayOfKey(day), true)} ${fmtDate(day)}`, `Markets are closed today — showing ${dayName(weekdayOfKey(day), true)} ${fmtDate(day)}`)}</span></div>`}
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
setInterval(() => { try { tickSessionClock(); } catch (e) { console.error(e); } }, 20000);

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
  'calc-clear': () => { ['entryPrice', 'stopLoss', 'takeProfit', 'cost', 'balanceOverride'].forEach(k => { const f = $('#f_' + k); if (f) f.value = ''; }); updateCalc(); $('#f_entryPrice')?.focus(); },
  'calc-to-trade': () => {
    const x = window.__calc; if (!x?.p || !(x.p.entryPrice > 0)) { toast(L('ใส่ราคาเข้าก่อน', 'Enter an entry price first'), 'bad'); return; }
    const { p, c } = x; if ($('#calc-form')?.closest('.modal-back')) closeModal();
    openTradeEditor('', { accountId: p.accountId, instrumentId: p.instrumentId, side: p.side, entryPrice: p.entryPrice, stopLoss: p.stopLoss, takeProfit: p.takeProfit, quantity: finite(c.qty) && c.qty > 0 ? +c.qty.toFixed(4) : null, status: 'Open', entryDateTime: now(), ...(p.needFx && p.fxRate > 0 ? { fxRate: p.fxRate } : {}) });
  },
  'missed-view': () => { ui.tradeQuick = 'missed'; ui.page = 1; go('trades'); },
};
