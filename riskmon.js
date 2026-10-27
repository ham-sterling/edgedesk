/* ============================================================
   RISK MONITOR (v3.40) — a live chip in the global header.
   Follows the account filter. Shows today's limits (daily loss,
   trade count, losses in a row), open-trade exposure (risk to
   S/L, worst case if every open trade hits its stop, trades with
   no S/L, stacked currencies) and prop-firm objectives.
   Status: ok (green) · warn (≥ 70% of a limit, or an open-risk
   problem) · stop (a limit reached — stop trading today).
   ============================================================ */
const RM_WARN = 70;
const rmLevel = used => !finite(used) ? 'ok' : used >= 100 - 1e-9 ? 'stop' : used >= RM_WARN ? 'warn' : 'ok';
const RM_RANK = { ok: 0, warn: 1, stop: 2 };
const rmWorst = (...ls) => ls.reduce((a, b) => RM_RANK[b] > RM_RANK[a] ? b : a, 'ok');

function riskMonitorState(accountId = ui.account) {
  const R = state.settings.rules || {}, day = todayKey(), d = dayDiscipline(day, accountId);
  const accs = accountId ? [get('accounts', accountId)].filter(Boolean) : state.accounts.filter(a => a.active !== false);
  const cur = accountId ? get('accounts', accountId)?.currency || baseCurrency() : baseCurrency();
  const st = streaks(d.closed.map(t => calc(t).net)), run = st.current < 0 ? -st.current : 0;
  const meters = [], reasons = [];
  // daily loss
  if (d.lossLimit != null) {
    const used = d.net < 0 ? d.net / d.lossLimit * 100 : 0, room = Math.max(0, d.net - d.lossLimit);
    meters.push({ k: 'loss', label: L('ขาดทุนรายวัน', 'Daily loss'), used, lv: rmLevel(used), val: money(d.net, cur, true), of: money(d.lossLimit, cur), sub: used >= 100 ? L('ถึงเพดานแล้ว — หยุดเทรดวันนี้', 'Limit reached — stop for today') : L(`เหลือขาดทุนได้อีก ${money(room, cur)} (${fmt(R.maxDailyLossPct, 1)}% ของยอดต้นวัน)`, `${money(room, cur)} of room left (${fmt(R.maxDailyLossPct, 1)}% of the day's opening balance)`) });
  }
  // trades today
  if (R.maxTradesPerDay > 0) {
    const used = d.trades / R.maxTradesPerDay * 100, left = R.maxTradesPerDay - d.trades;
    meters.push({ k: 'trades', label: L('จำนวนไม้วันนี้', 'Trades today'), used, lv: rmLevel(used), val: String(d.trades), of: String(R.maxTradesPerDay), sub: left > 0 ? L(`เทรดได้อีก ${left} ไม้`, `${left} more allowed`) : left === 0 ? L('ครบโควตาแล้ว', 'Quota reached') : L(`เกินกฎ ${-left} ไม้`, `${-left} over the limit`) });
  }
  // losses in a row (today, ending with the latest closed trade)
  if (R.maxConsecLosses > 0) {
    const used = run / R.maxConsecLosses * 100;
    meters.push({ k: 'streak', label: L('แพ้ติดกัน', 'Losses in a row'), used, lv: rmLevel(used), val: String(run), of: String(R.maxConsecLosses), sub: run >= R.maxConsecLosses ? L('ถึงกฎแล้ว — พักก่อน', 'Rule reached — take a break') : run ? L(`อีก ${R.maxConsecLosses - run} ไม้จะถึงกฎ`, `${R.maxConsecLosses - run} more to the rule`) : L('ยังไม่มี', 'None') });
  }
  meters.forEach(m => { if (m.lv !== 'ok') reasons.push({ lv: m.lv, t: `${m.label}: ${m.sub}` }); });
  // open exposure
  const ex = openExposure(accountId), bal = sum([...new Set(ex.rows.map(r => r.t.accountId))].map(id => accountBalance(id))); // % of the accounts that hold the open trades
  const known = ex.rows.filter(r => finite(r.risk)), noStop = ex.rows.length - known.length;
  const openRisk = sum(known.map(r => r.risk)), openPct = bal > 0 ? openRisk / bal * 100 : null;
  const worst = d.net - openRisk, worstBreach = d.lossLimit != null && openRisk > 0 && worst < d.lossLimit - EPS, alreadyHit = d.lossLimit != null && d.net <= d.lossLimit + EPS;
  const overRisk = state.settings.riskWarning > 0 ? known.filter(r => finite(r.pct) && r.pct > state.settings.riskWarning + 1e-6) : [];
  let openLv = 'ok';
  if (noStop && R.requireStop !== false) { openLv = 'warn'; reasons.push({ lv: 'warn', t: L(`${noStop} ไม้ที่เปิดอยู่ไม่มี S/L — ความเสี่ยงไม่จำกัด`, `${noStop} open trade${noStop > 1 ? 's have' : ' has'} no S/L — risk is unlimited`) }); }
  if (worstBreach && !alreadyHit) { openLv = 'warn'; reasons.push({ lv: 'warn', t: L(`ถ้าทุกไม้ที่เปิดอยู่โดน S/L ขาดทุนวันนี้จะเป็น ${money(worst, cur)} — เกินเพดาน`, `If every open trade hits its S/L, today ends at ${money(worst, cur)} — past the limit`) }); }
  if (overRisk.length) { openLv = 'warn'; reasons.push({ lv: 'warn', t: L(`${overRisk.length} ไม้เสี่ยงเกิน ${fmt(state.settings.riskWarning, 1)}% ต่อไม้`, `${overRisk.length} trade${overRisk.length > 1 ? 's' : ''} risk more than ${fmt(state.settings.riskWarning, 1)}% each`) }); }
  ex.stacks.forEach(s => reasons.push({ lv: 'info', t: L(`${s.dir > 0 ? 'ซื้อ' : 'ขาย'} ${s.ccy} ซ้อนกัน ${s.syms.length} ไม้ (${s.syms.join(', ')})`, `${s.dir > 0 ? 'Long' : 'Short'} ${s.ccy} stacked across ${s.syms.length} trades (${s.syms.join(', ')})`) }));
  // prop-firm objectives
  const props = accs.map(a => ({ a, o: objectiveStatus(a) })).filter(x => x.o).map(({ a, o }) => {
    const dUsed = o.maxDaily > 0 ? Math.max(0, -o.todayPct) / o.maxDaily * 100 : null, ddUsed = o.maxDd > 0 ? o.ddNowPct / o.maxDd * 100 : null;
    const lv = o.breached ? 'stop' : rmWorst(rmLevel(dUsed), rmLevel(ddUsed));
    if (lv !== 'ok') reasons.push({ lv, t: o.breached ? L(`${a.name}: ผิดเงื่อนไขบัญชีแล้ว`, `${a.name}: objective breached`) : L(`${a.name}: ใกล้ขีดจำกัดของบัญชี`, `${a.name}: close to its limits`) });
    return { a, o, dUsed, ddUsed, lv };
  });
  const level = rmWorst(...meters.map(m => m.lv), openLv, ...props.map(p => p.lv));
  reasons.sort((x, y) => (RM_RANK[y.lv] ?? -1) - (RM_RANK[x.lv] ?? -1));
  return { day, d, cur, meters, ex, known, noStop, openRisk, openPct, worst, worstBreach, props, level, reasons, run, hasRules: meters.length > 0, accs };
}

const RM_WORD = () => ({ ok: L('ปกติ', 'OK'), warn: L('ระวัง', 'Caution'), stop: L('หยุดเทรด', 'Stop') });
function riskChipInner(s) {
  // compact: dot + one figure (share of today's loss limit used) — trade counts live in the popover
  const loss = s.meters.find(m => m.k === 'loss');
  const txt = s.level === 'stop' ? `<b>${L('หยุดเทรด', 'Stop')}</b>` : loss ? `<b>${fmt(Math.min(loss.used, 999), 0)}%</b>` : '';
  return `<i class="rm-dot ${s.level}"></i>${txt ? `<span class="rm-txt">${txt}</span>` : ''}`;
}
function riskChipHTML() {
  let s; try { s = riskMonitorState(); } catch (e) { console.error(e); return ''; }
  const word = RM_WORD()[s.level];
  return `<details class="menu rmon ${s.level}" id="rmon"><summary class="btn ghost rmon-btn" aria-label="${L('ตัวติดตามความเสี่ยง', 'Risk monitor')}: ${esc(word)}">${icon('shield')}${riskChipInner(s)}</summary><div class="menu-pop rmon-pop" id="rmon-pop"></div></details>`;
}
function rmBar(used, lv) { return `<div class="rm-bar ${lv}"><i style="width:${clamp(used || 0, 0, 100)}%"></i></div>`; }
function riskPopHTML() {
  const s = riskMonitorState(), scope = s.accs.length === 1 ? esc(s.accs[0].name) : L('ทุกบัญชี', 'All accounts'), word = RM_WORD()[s.level];
  const head = `<div class="rm-head"><div><strong>${L('ตัวติดตามความเสี่ยง', 'Risk monitor')}</strong><div class="dim small">${scope} · ${L('วันนี้', 'today')} ${fmtDate(s.day, { year: false })}</div></div><span class="rm-badge ${s.level}">${esc(word)}</span></div>`;
  const reasons = s.reasons.length ? `<ul class="rm-reasons">${s.reasons.map(r => `<li class="${r.lv}">${icon(r.lv === 'info' ? 'info' : 'alert', 'tiny')}<span>${esc(r.t)}</span></li>`).join('')}</ul>` : '';
  const limits = s.meters.length
    ? `<div class="rm-sec"><div class="rm-lbl">${L('ขีดจำกัดวันนี้', "Today's limits")}</div>${s.meters.map(m => `<div class="rm-meter ${m.lv}"><div class="rm-mt"><span>${esc(m.label)}</span><span class="num"><b>${esc(m.val)}</b><i> / ${esc(m.of)}</i></span></div>${rmBar(m.used, m.lv)}<div class="rm-sub">${esc(m.sub)}</div></div>`).join('')}</div>`
    : `<div class="rm-sec"><div class="rm-empty">${icon('shield')}<span>${L('ยังไม่ได้ตั้งกฎความเสี่ยงรายวัน — ตั้งเพดานขาดทุน จำนวนไม้ และแพ้ติดกัน เพื่อให้ตัวติดตามเตือนคุณได้', 'No daily risk rules yet — set a loss limit, trade count and losing-streak rule so the monitor can warn you')}</span></div></div>`;
  const ob = s.ex.rows.length
    ? `<div class="rm-kv"><span>${L('ความเสี่ยงรวมถึง S/L', 'Total risk to S/L')}</span><b class="num">${money(s.openRisk, s.cur)}${finite(s.openPct) ? ` <i>(${fmt(s.openPct, 2)}%)</i>` : ''}</b></div>
      <div class="rm-kv"><span data-tip="${L('ผลวันนี้ถ้าทุกไม้ที่เปิดอยู่โดน S/L', "Today's result if every open trade hits its S/L")}">${L('กรณีแย่สุดวันนี้', 'Worst case today')}</span><b class="num ${s.worstBreach ? 'neg' : ''}">${money(s.worst, s.cur, true)}${s.d.lossLimit != null ? ` <i>/ ${money(s.d.lossLimit, s.cur)}</i>` : ''}</b></div>
      <div class="rm-open">${s.ex.rows.map(r => `<button type="button" class="rm-trade menu-item" data-action="view-trade" data-id="${r.t.id}">${insIcon(get('instruments', r.t.instrumentId))}<span class="sym">${esc(nameOf('instruments', r.t.instrumentId, 'symbol'))}</span><span class="side ${r.t.side === 'Buy' ? 'long' : 'short'}">${r.t.side === 'Buy' ? 'LONG' : 'SHORT'}</span><span class="grow"></span>${finite(r.risk) ? `<span class="num">${money(r.risk, get('accounts', r.t.accountId)?.currency)}</span><span class="num dim">${finite(r.pct) ? fmt(r.pct, 2) + '%' : ''}</span>` : `<span class="neg small">${L('ไม่มี S/L', 'No S/L')}</span>`}</button>`).join('')}</div>`
    : `<div class="rm-none dim small">${L('ไม่มีเทรดที่เปิดอยู่', 'No open trades')}</div>`;
  const open = `<div class="rm-sec"><div class="rm-lbl">${L('เทรดที่เปิดอยู่', 'Open trades')}${s.ex.rows.length ? ` · ${s.ex.rows.length}` : ''}</div>${ob}</div>`;
  const props = s.props.length ? `<div class="rm-sec"><div class="rm-lbl">${L('เงื่อนไขบัญชี Prop', 'Prop objectives')}</div>${s.props.map(({ a, o, dUsed, ddUsed, lv }) => `<div class="rm-prop ${lv}"><div class="rm-mt"><span><b>${esc(a.name)}</b></span>${o.breached ? `<span class="rm-badge stop">${L('ผิดเงื่อนไข', 'Breached')}</span>` : o.passed ? `<span class="rm-badge ok">${L('ผ่านแล้ว', 'Passed')}</span>` : ''}</div>
      ${dUsed != null ? `<div class="rm-mt sm"><span>${L('ขาดทุนวันนี้', 'Daily loss')}</span><span class="num">${fmt(Math.max(0, -o.todayPct), 2)}% / ${fmt(o.maxDaily, 1)}%</span></div>${rmBar(dUsed, rmLevel(dUsed))}` : ''}
      ${ddUsed != null ? `<div class="rm-mt sm"><span>${L('Drawdown ตอนนี้', 'Current drawdown')}</span><span class="num">${fmt(o.ddNowPct, 2)}% / ${fmt(o.maxDd, 1)}%</span></div>${rmBar(ddUsed, rmLevel(ddUsed))}${finite(o.room) ? `<div class="rm-sub">${L('ขาดทุนได้อีก', 'Room left')} ${money(Math.max(0, o.room), a.currency)}</div>` : ''}` : ''}</div>`).join('')}</div>` : '';
  const foot = `<div class="rm-foot"><button type="button" class="btn ghost sm menu-item" data-action="nav" data-route="settings/rules">${icon('settings')}${L('แก้ไขกฎ', 'Edit rules')}</button><button type="button" class="btn ghost sm menu-item" data-action="calc-size">${icon('calculator')}${L('คำนวณขนาดไม้', 'Position size')}</button></div>`;
  return head + reasons + limits + open + props + foot;
}
function tickRiskMonitor() { const el = $('#rmon'); if (el?.open) $('#rmon-pop').innerHTML = riskPopHTML(); }
document.addEventListener('toggle', e => { if (e.target?.id === 'rmon' && e.target.open) { try { $('#rmon-pop').innerHTML = riskPopHTML(); } catch (err) { console.error(err); } } }, true);
