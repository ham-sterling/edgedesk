/* ============================================================
   REPORTS · BREAKDOWN · COMPARE · PSYCHOLOGY · RISK LAB
   ============================================================ */
const REPORT_TABS = () => [['overview', L('ภาพรวม', 'Overview')], ['stats', L('รายงาน', 'Reports')], ['insights', L('วิเคราะห์เชิงลึก', 'Insights')], ['compare', L('เปรียบเทียบ', 'Compare')], ['psychology', L('จิตวิทยา', 'Psychology')], ['calendar', L('ปฏิทิน', 'Calendar')], ['simulation', L('จำลองผล', 'Simulation')]];
/* v3.65 — underline text tabs on top, the scope bar right under them */
function reportTabs(sub) { return `<nav class="utabs" role="tablist">${REPORT_TABS().map(([v, l]) => `<button type="button" role="tab" class="utab ${v === sub ? 'on' : ''}" data-action="report-tab" data-value="${v}" aria-selected="${v === sub}"><span>${esc(l)}</span></button>`).join('')}</nav>`; }
function reportsView(sub, sub2) {
  const rows = filtered();
  if (sub === 'breakdown' || sub === 'cross') sub = 'insights'; if (sub === 'risk') sub = 'simulation'; if (sub === 'reports' || sub === 'statistics') sub = 'stats';
  if (sub === 'drill') { sub = 'insights'; sub2 = insTabOf(ui.dimension); }
  if (!REPORT_TABS().some(t => t[0] === sub)) sub = 'overview';
  let body = '';
  switch (sub) { case 'calendar': body = yearCalendar(rows); break; case 'insights': body = insightsView(rows, sub2); break; case 'compare': body = compareView(); break; case 'psychology': body = psychologyView(rows); break; case 'simulation': body = riskLabView(rows); break; case 'stats': body = fullReport(rows); break; default: body = overviewReport(rows); }
  pageHead._done = true;
  const act = `<div class="rep-act">${ibtn('download', 'export-report', L('ส่งออกรายงาน', 'Export report'))}${ibtn('external', 'print', L('พิมพ์ / PDF', 'Print / PDF'))}</div>`;
  return `<h1 class="sr-only">${esc(REPORT_TABS().find(t => t[0] === sub)?.[1] || '')}</h1><div class="rep-nav">${reportTabs(sub)}${act}</div>` + scopeBar() + (sub === 'compare' ? '' : scopeLine(rows)) + body;
}
/* v3.75 — Reports: always 3 equal columns; a group marked 'stack' sits under the previous one in the same column */
const RP_STACK = () => [L('D. คุมความเสี่ยงรายวัน', 'D. Daily Risk Control'), L('B. ทิศทางการเทรด', 'B. Trade Direction'), L('D. การอยู่ในตลาด', 'D. Market Exposure')];
function rpStack(groups) { const st = RP_STACK(), cols = []; groups.forEach(g => { if (cols.length && (g[2] === 'stack' || st.includes(g[0]))) cols.at(-1).push(g); else cols.push([g]); }); return cols; }
/* v3.75 — chart descriptions (e.g. "Horizontal bar · highest first") show on hover over the title instead of under it */
function chartPanel(title, body, tools, cls, desc) { return panel(desc ? `<span class="ul-tip" data-tip="${esc(desc)}">${title}</span>` : title, body, tools, cls); }
function statRows(items) { return items.map(([l, v, cls = '', tip = '']) => { const g = glossKeyOf(l); if (g) tip = ''; return `<div class="srow"><span ${tip ? `class="ul-tip" data-tip="${esc(tip)}"` : ''}>${g ? gl(l, g) : l}</span><strong class="${cls}">${v}</strong></div>`; }).join(''); }
/* ---------- v3.65 — Overview: KPI row + charts only ---------- */
function overviewReport(rows) {
  const s = stats(rows);
  const kp = miniRow([
    miniCard(L('กำไรสุทธิ', 'Net P&L'), `<span class="${tone(s.total)}">${unitFmt(s.total)}</span>`, `${L('ผลตอบแทน', 'Return')} <span class="${tone(s.ret)}">${finite(s.ret) ? fmt(s.ret, 2, true) + '%' : '—'}</span>`, sparkline(cumVals(rows))),
    miniCard(gl(L('อัตราชนะ %', 'Win rate %'), 'winRate'), finite(s.wr) ? fmt(s.wr, 1) + '%' : '—', `${s.n} ${L('เทรด', 'trades')}`, wlGauge(s.wins, s.be, s.losses)),
    miniCard(gl('Profit factor', 'profitFactor'), fmt(s.pfU, 2), pfWord(s) || L('กำไรรวม ÷ ขาดทุนรวม', 'Gross profit ÷ gross loss'), pfViz(s)),
    miniCard(gl(L('ค่าคาดหวัง', 'Expectancy'), 'expectancy'), `<span class="${tone(s.expectancy)}">${unitFmt(s.expectancy)}</span>`, finite(s.avgR) ? fmt(s.avgR, 2, true) + 'R' : '—', expViz(s)),
    miniCard(gl('Payoff ratio', 'payoff'), fmt(s.payU, 2), `<span class="pos">${unitFmt(s.avgWinU, ui.unit, false)}</span> / <span class="neg">${unitFmt(s.avgLossU)}</span>`, ratioViz(s.avgWinU, s.avgLossU, '', '')),
  ]);
  const H = Math.max(340, Math.round(((typeof innerHeight === 'number' ? innerHeight : 900) - 460) / .88)); // v3.70: charts fill the screen (≈620px plot on 1080p)
  const equity = eqPanel(rows, H + 56, 'mb16 ov-c', s, 'ov-eq'), H2 = 360; // v3.92: equity curve a bit taller, the other Overview charts shorter
  const dcum = U('ov-dcum', u => { let a = 0; const d = dailySeries(rows).map(p => ({ x: p.x, y: (a += p.y) })); return panel(L('กำไรสุทธิสะสมรายวัน', 'Daily net cumulative P&L'), chartBox({ type: 'line', series: [{ name: L('สะสม', 'Cumulative'), data: d, area: true }], signed: true, unit: u }, H2), '', 'ov-c', L(`${d.length} วันเทรด`, `${d.length} trading days`)); });
  const daily = U('ov-daily', u => { const d = dailySeries(rows); return panel(L('กำไรสุทธิรายวัน', 'Net daily P&L'), chartBox({ type: 'bar', data: d, unit: u }, H2), '', 'ov-c', `${L('วันกำไร', 'Winning days')} <span class="pos">${d.filter(x => x.y > EPS).length}</span> · ${L('วันขาดทุน', 'Losing days')} <span class="neg">${d.filter(x => x.y < -EPS).length}</span>`); });
  const month = U('ov-month', u => { const mb = group(rows, 'month').map(g => ({ x: g.key, label: dimKeyLabel('month', g.key), y: g.s.total ?? 0, sub: `${g.s.n} ${L('เทรด', 'trades')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(g.s.wr, 0)}%` })); return panel(L('ผลงานรายเดือน', 'Monthly performance'), chartBox({ type: 'bar', data: mb, unit: u, categorical: true, valueLabels: mb.length <= 18, valueFmt: v => compactUnit(v) }, H2), '', 'ov-c', L(`${mb.length} เดือน · กำไร ${mb.filter(x => x.y > EPS).length} · ขาดทุน ${mb.filter(x => x.y < -EPS).length}`, `${mb.length} months · ${mb.filter(x => x.y > EPS).length} up · ${mb.filter(x => x.y < -EPS).length} down`)); });
  /* v3.75 — Weekly performance next to Monthly (last 26 weeks) */
  const week = U('ov-week', u => { const wb = group(rows, 'week').sort((a, b) => String(a.key).localeCompare(String(b.key))).slice(-26).map(g => ({ x: g.key, label: fmtDate(g.key, { year: false }), tip: dimKeyLabel('week', g.key), y: g.s.total ?? 0, sub: `${g.s.n} ${L('เทรด', 'trades')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(g.s.wr, 0)}%` })); return panel(L('ผลงานรายสัปดาห์', 'Weekly performance'), chartBox({ type: 'bar', data: wb, unit: u, categorical: true, valueLabels: wb.length <= 14, valueFmt: v => compactUnit(v) }, H2), '', 'ov-c', L(`${wb.length} สัปดาห์ · กำไร ${wb.filter(x => x.y > EPS).length} · ขาดทุน ${wb.filter(x => x.y < -EPS).length}`, `${wb.length} weeks · ${wb.filter(x => x.y > EPS).length} up · ${wb.filter(x => x.y < -EPS).length} down`)); });
  return kp + equity + `<div class="grid g2 mb16 ov-pair">${dcum}${daily}</div>` + `<div class="grid g2 ov-pair">${month}${week}</div>` + `<div class="mt16">${monthlyMatrix(rows)}</div>`; // v3.71: Monthly returns on Overview
}
/* ---------- v3.65 — Reports: every statistic, in five sections ---------- */
function reportCalc(rows) {
  const closed = closedSorted(rows), cs = closed.map(calc), nets = closed.map(repNet), s = stats(rows, 'P&L');
  const ok = monetaryAllowed(rows), MS = 60000, DAY = 864e5;
  const ts = v => v ? +new Date(v) : NaN;
  const okN = nets.filter(finite), rs = cs.map(c => c.r).filter(finite);
  // periods
  const byKey = f => { const m = new Map(); closed.forEach((t, i) => { if (!finite(nets[i])) return; const k = f(tradeDay(t)); m.set(k, (m.get(k) || 0) + nets[i]); }); return m; };
  const wk = d => { const x = new Date(d + 'T00:00:00Z'), off = (x.getUTCDay() - (state.settings.weekStart ?? 1) + 7) % 7; x.setUTCDate(x.getUTCDate() - off); return x.toISOString().slice(0, 10); };
  const days = byKey(d => d), weeks = byKey(wk), months = byKey(d => d.slice(0, 7));
  const pos = m => [...m.values()].filter(v => v > EPS).length, neg = m => [...m.values()].filter(v => v < -EPS).length;
  const ext = (m, hi) => { let k = null, v = null; for (const [a, b] of m) if (v == null || (hi ? b > v : b < v)) { k = a; v = b; } return { k, v }; };
  // runs (streaks with amounts)
  const runs = []; let cur = null; for (const v of okN) { const sg = v > EPS ? 1 : v < -EPS ? -1 : 0; if (!sg) { cur = null; continue; } if (cur && cur.sg === sg) { cur.n++; cur.sum += v; } else { cur = { sg, n: 1, sum: v }; runs.push(cur); } }
  const wr_ = runs.filter(r => r.sg > 0), lr_ = runs.filter(r => r.sg < 0), last = okN.length && Math.abs(okN.at(-1)) > EPS ? runs.at(-1) : null;
  // exposure
  const iv = closed.map((t, i) => ({ a: ts(t.entryDateTime), b: ts(t.exitDateTime), t, risk: finite(cs[i].risk) ? cs[i].risk / repDiv(t.accountId) : 0 })).filter(x => finite(x.a) && finite(x.b) && x.b >= x.a).sort((p, q) => p.a - q.a);
  let union = 0, blocks = [], bA = null, bB = null; for (const x of iv) { if (bA == null || x.a > bB) { if (bA != null) blocks.push(bB - bA); bA = x.a; bB = x.b; } else bB = Math.max(bB, x.b); } if (bA != null) blocks.push(bB - bA); union = sum(blocks);
  const span = iv.length ? Math.max(...iv.map(x => x.b)) - iv[0].a : 0, totalDur = sum(iv.map(x => x.b - x.a));
  const sweep = []; iv.forEach(x => { sweep.push([x.a, 1, x.risk]); sweep.push([x.b, -1, -x.risk]); }); sweep.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  let open = 0, maxOpen = 0, oRisk = 0, maxRisk = 0; for (const [, d, r] of sweep) { open += d; oRisk += r; maxOpen = Math.max(maxOpen, open); maxRisk = Math.max(maxRisk, oRisk); }
  // balance timeline of the accounts in scope (deposits, withdrawals, trades)
  const accs = currentAccounts(), from = ui.from ? +new Date(ui.from + 'T00:00:00') : -Infinity, to = ui.to ? +new Date(ui.to + 'T23:59:59') : Infinity;
  const balOk = new Set(accs.map(a => centParent(a.currency))).size <= 1 && accs.length;
  let bal = null; if (balOk) {
    const b = Object.fromEntries(accs.map(a => [a.id, (a.startingCapital || 0) / repDiv(a.id)])), evs = accs.flatMap(a => accountEvents(a.id).map(e => ({ ...e, acc: a.id, v: (e.v || 0) / repDiv(a.id) }))).sort((p, q) => p.ts - q.ts);
    let start = null, hi = -Infinity, lo = Infinity; const tot = () => sum(Object.values(b));
    for (const e of evs) { if (e.ts > to) break; if (e.ts >= from && start == null) { start = tot(); hi = Math.max(hi, start); lo = Math.min(lo, start); } b[e.acc] = e.reset ? e.v : b[e.acc] + e.v; if (e.ts >= from) { const v = tot(); hi = Math.max(hi, v); lo = Math.min(lo, v); } }
    const end = tot(); if (start == null) start = end; hi = Math.max(hi, start, end); lo = Math.min(lo, start, end);
    bal = { start, end, hi, lo };
  }
  const txns = state.transactions.filter(x => accs.some(a => a.id === x.accountId) && +new Date(x.dateTime) >= from && +new Date(x.dateTime) <= to), tsum = ty => sum(txns.filter(x => ty.includes(x.type)).map(x => Math.abs(x.amount || 0) / repDiv(x.accountId)));
  // balance at entry → initial risk %
  const riskPct = closed.map((t, i) => { const r = cs[i].risk, b0 = accountBalance(t.accountId, ts(t.entryDateTime)); return finite(r) && b0 > 0 ? r / b0 * 100 : null; }).filter(finite);
  const risks = closed.map((t, i) => finite(cs[i].risk) ? cs[i].risk / repDiv(t.accountId) : null).filter(finite);
  const dayRisk = new Map(); closed.forEach((t, i) => { if (!finite(cs[i].risk)) return; const d = dateKey(t.entryDateTime, tradeZone(t)); dayRisk.set(d, (dayRisk.get(d) || 0) + cs[i].risk / repDiv(t.accountId)); });
  // balance & equity drawdown over the closed-trade curve (equity dips by each trade's MAE when it is recorded)
  const start0 = s.start || 0; let b = start0, peak = start0, eq = [], peakT = null, episodes = [], ep = null, ecur = null; const bpts = [];
  closed.forEach((t, i) => { const n = nets[i]; if (!finite(n)) return; const c = cs[i], mae = finite(c.maeR) && finite(c.risk) ? c.maeR * c.risk / repDiv(t.accountId) : null; if (finite(mae) && mae < 0) eq.push({ v: b + mae, pk: peak }); b += n; const tt = ts(t.exitDateTime || t.entryDateTime);
    if (b >= peak - EPS) { if (ep) { ep.end = tt; episodes.push(ep); ep = null; } peak = Math.max(peak, b); peakT = tt; } else { if (!ep) ep = { a: peakT ?? tt, min: 0 }; ep.min = Math.min(ep.min, b - peak); }
    eq.push({ v: b, pk: peak }); bpts.push({ v: b, pk: peak }); });
  if (ep) episodes.push(ep);
  const ddOf = pts => { const d = pts.map(p => p.v - p.pk), pc = pts.map(p => p.pk > 0 ? (p.v - p.pk) / p.pk * 100 : null), neg = d.filter(x => x < -EPS), negP = pc.filter(x => finite(x) && x < -EPS); return { max: d.length ? Math.min(0, ...d) : null, maxPct: negP.length ? Math.min(...negP) : d.length ? 0 : null, avg: mean(neg) ?? (d.length ? 0 : null), avgPct: mean(negP) ?? (d.length ? 0 : null), pc }; };
  const bdd = ddOf(bpts), edd = ddOf(eq.map(p => ({ v: p.v, pk: p.pk })));
  const rec = episodes.filter(e => e.end).map(e => (e.end - e.a) / MS), recMax = rec.length ? Math.max(...rec) : null;
  // daily returns
  let eqv = start0; const dret = []; [...days.keys()].sort().forEach(d => { const v = days.get(d); if (eqv > 0) dret.push(v / eqv * 100); eqv += v; });
  const mR = mean(dret), sdR = sd(dret), down = dret.filter(x => x < 0), dDev = dret.length ? Math.sqrt(sum(down.map(x => x * x)) / dret.length) : null;
  const yrs = days.size ? Math.max(1 / 365, ((+new Date([...days.keys()].sort().at(-1)) - +new Date([...days.keys()].sort()[0])) / DAY + 1) / 365) : null, annRet = finite(s.ret) && yrs ? (Math.pow(Math.max(1e-9, 1 + s.ret / 100), 1 / yrs) - 1) * 100 : null;
  const sdRr = sd(rs), sqn = rs.length >= 2 && sdRr > EPS ? Math.sqrt(Math.min(rs.length, 100)) * mean(rs) / sdRr : null;
  const ulcer = bdd.pc.length ? Math.sqrt(mean(bdd.pc.map(x => (finite(x) ? x : 0) ** 2))) : null;
  const p = s.wr != null ? s.wr / 100 : null, edge = p != null && finite(s.pay) ? p * s.pay - (1 - p) : null, units = mean(riskPct) > 0 ? 100 / mean(riskPct) : null;
  const ruin = edge == null || units == null ? null : edge <= 0 ? 100 : Math.pow((1 - edge) / (1 + edge), units) * 100;
  // intraday drawdown per day
  const dayRows = new Map(); closed.forEach((t, i) => { if (!finite(nets[i])) return; const d = tradeDay(t); (dayRows.get(d) || dayRows.set(d, []).get(d)).push(nets[i]); });
  const ddays = [...dayRows].map(([d, vs]) => { let r = 0, pk = 0, mn = 0; for (const v of vs) { r += v; pk = Math.max(pk, r); mn = Math.min(mn, r - pk); } const b0 = sum(accs.map(a => accountBalance(a.id, +new Date(d + 'T00:00:00')) / repDiv(a.id))); return { d, dd: mn, pct: b0 > 0 ? mn / b0 * 100 : null, net: sum(vs), b0 }; });
  const worstD = ddays.length ? ddays.reduce((a, x) => x.net < a.net ? x : a) : null;
  // participation
  const wd = new Map(), hr = new Map(); closed.forEach(t => { const pp = dateParts(t.entryDateTime, tradeZone(t)); if (!pp) return; const w = dayOfWeekKey(t); wd.set(w, (wd.get(w) || 0) + 1); const h = pp.hour + ':00'; hr.set(h, (hr.get(h) || 0) + 1); });
  const top = m => { let k = null, v = 0; for (const [a, b] of m) if (b > v) { k = a; v = b; } return { k, v }; };
  const winD = [...dayRows].filter(([, vs]) => sum(vs) > EPS), lossD = [...dayRows].filter(([, vs]) => sum(vs) < -EPS);
  const durs = cs.map(c => c.duration).filter(finite);
  const sess = group(closed, 'session').filter(g => g.key !== 'Unknown' || g.s.n);
  // costs
  const comm = s.commission || 0, swap = s.swap || 0, fees = tsum(['Fee']), slipList = closed.map(t => finite(t.slippage) ? t.slippage / repDiv(t.accountId) : null).filter(finite), slip = slipList.length ? sum(slipList) : null;
  const costs = comm + Math.max(0, -swap) + fees + (slip || 0), lots = sum(closed.map(t => t.quantity || 0));
  return { s, ok, closed, cs, nets, okN, rs, days, weeks, months, pos, neg, ext, runs, wr_, lr_, last, union, blocks, span, totalDur, maxOpen, maxRisk, bal, txns, tsum, riskPct, risks, dayRisk, bdd, edd, rec, recMax, dret, mR, sdR, dDev, annRet, sqn, ulcer, ruin, ddays, worstD, wd, hr, top, winD, lossD, durs, sess, comm, swap, fees, slip, slipList, costs, lots, MS };
}
const stripTags = h => String(h).replace(/<[^>]*>/g, '').trim();
/* glossary keys for the report labels (both languages) */
const RP_GLOSS = new Proxy({}, { get: (_, k) => ({ 'Net Profit': 'netProfit', 'กำไรสุทธิ': 'netProfit', 'Return %': 'ret', 'ผลตอบแทน %': 'ret', 'Win Rate': 'winRate', 'อัตราชนะ': 'winRate', 'Profit Factor': 'profitFactor', 'Expectancy': 'expectancy', 'ค่าคาดหวัง': 'expectancy', 'Payoff Ratio': 'payoff', 'Total R-Multiple': 'rMultiple', 'R-Multiple รวม': 'rMultiple', 'Sharpe Ratio': 'sharpe', 'System Quality Number (SQN)': 'sqn', 'Recovery Factor': 'recovery', 'Maximum Balance Drawdown': 'maxDD', 'Balance Drawdown สูงสุด': 'maxDD', 'Maximum Balance Drawdown %': 'maxDDPct', 'Balance Drawdown สูงสุด %': 'maxDDPct', 'Average Balance Drawdown': 'avgDD', 'Balance Drawdown เฉลี่ย': 'avgDD', 'Risk of Ruin': 'ruin', 'โอกาสล้างพอร์ต': 'ruin', 'Total Commissions': 'commission', 'ค่าคอมมิชชันรวม': 'commission', 'Total Swap': 'swap', 'ค่าสวอปรวม': 'swap', 'Daily Win Rate': 'dayWinRate', 'อัตราชนะรายวัน': 'dayWinRate', 'Average Trades per Day': 'tradesPerDay', 'เทรดเฉลี่ยต่อวัน': 'tradesPerDay', 'Average Duration': 'holding', 'ระยะเวลาถือเฉลี่ย': 'holding', 'Max Consecutive Wins': 'streak', 'ชนะติดกันสูงสุด': 'streak' })[k] });
function dayOfWeekKey(t) { const k = dateKey(t.entryDateTime, tradeZone(t)); return k ? new Date(k + 'T12:00:00Z').getUTCDay() : null; }
function fullReport(rows) {
  const R = reportCalc(rows), s = R.s, cur = baseCurrency(), ok = R.ok;
  const M = (v, sg = true) => ok && finite(v) ? money(v, cur, sg) : '—', Mu = v => ok && finite(v) ? money(v, cur, false) : '—';
  const P = (v, d = 1, sg = false) => finite(v) ? fmt(v, d, sg) + '%' : '—', N = (v, d = 0) => finite(v) ? fmt(v, d) : '—', Rr = v => finite(v) ? fmt(v, 2, true) + 'R' : '—', X = (v, d = 2) => finite(v) ? fmt(v, d) : '—';
  const cnt = (a, b) => b ? fmt(a / b * 100, 1) + '%' : '—', D = v => finite(v) ? duration(v) : '—';
  const dayL = k => k ? fmtDate(k) : '', monL = k => k ? dimKeyLabel('month', k) : '';
  const bd = R.ext(R.days, true), wdy = R.ext(R.days, false), bm = R.ext(R.months, true), wm = R.ext(R.months, false);
  const WD = [L('อา.', 'Sun'), L('จ.', 'Mon'), L('อ.', 'Tue'), L('พ.', 'Wed'), L('พฤ.', 'Thu'), L('ศ.', 'Fri'), L('ส.', 'Sat')];
  const topWd = R.top(R.wd), topHr = R.top(R.hr);
  const sessBest = R.sess.length ? R.sess.slice().sort((a, b) => (b.s.net ?? 0) - (a.s.net ?? 0)) : [];
  const sList = f => R.sess.length ? `<span class="rp-list">${R.sess.map(g => `<span><i>${esc(g.label)}</i> ${f(g)}</span>`).join('')}</span>` : '—';
  const realize = mean(R.cs.filter(c => finite(c.r) && c.r > EPS && c.planned > EPS).map(c => c.r / c.planned * 100));
  const mfeTot = sum(R.cs.filter(c => finite(c.mfeR) && finite(c.r)).map(c => c.mfeR)), capTot = sum(R.cs.filter(c => finite(c.mfeR) && finite(c.r)).map(c => c.r));
  const lastRun = R.last, curW = lastRun?.sg > 0 ? lastRun.n : 0, curL = lastRun?.sg < 0 ? lastRun.n : 0;
  const nWeeks = R.weeks.size, nTradeDays = R.days.size;
  const row = (l, v, cls = '', tip = '') => [l, v, cls, tip];
  const sec = (num, title, desc, cols, groups) => `<section class="rp-sec"><header class="rp-h"><h2>${title}</h2><p>${desc}</p></header><div class="rp-cols c3">${rpStack(groups).map(col => `<div class="rp-col">${col.map(([t, rs]) => `<div class="rp-grp"><h4>${String(t).replace(/^[A-Z]\.\s*/, '')}</h4>${rs.map(([l, v, cls, tip]) => { const gk = RP_GLOSS[stripTags(l)], t = tip || rpDesc(l); return `<div class="rp-kv"><span class="rp-l">${gk ? gl(l, gk) : t ? `<span class="ul-tip" data-tip="${esc(t)}">${l}</span>` : l}</span><i class="rp-lead"></i><b class="rp-v ${cls}">${v}</b></div>`; }).join('')}</div>`).join('')}</div>`).join('')}</div></section>`; // v3.68: one card per section, columns inside, no numbering
  const tn = v => tone(v);
  const out = [];
  out.push(sec(1, L('กำไรและยอดเงิน', 'Profit & Balance'), L('ผลกำไร ยอดเงินในบัญชี และเงินเข้า-ออก', 'Profit, account balance and money in / out'), 3, [
    [L('A. กำไรและผลตอบแทน', 'A. Profit & Return'), [
      row(L('กำไรสุทธิ', 'Net Profit'), M(s.net), tn(s.net)), row(L('ผลตอบแทน %', 'Return %'), P(s.ret, 2, true), tn(s.ret), L('กำไรสุทธิ ÷ ทุนเริ่มต้น', 'Net profit ÷ starting capital')),
      row(L('กำไรขั้นต้น', 'Gross Profit'), M(s.gp), 'pos'), row(L('ขาดทุนขั้นต้น', 'Gross Loss'), M(s.gl), 'neg'),
      row(L('กำไร/ขาดทุนเฉลี่ยต่อเทรด', 'Average Trade P&L'), M(s.avg), tn(s.avg)), row(L('กำไร/ขาดทุนเฉลี่ยต่อวัน', 'Average Daily P&L'), M(s.avgDay), tn(s.avgDay)),
      row(L('กำไร/ขาดทุนเฉลี่ยต่อเดือน', 'Average Monthly P&L'), M(mean([...R.months.values()])), tn(mean([...R.months.values()]))),
      row(L('กำไรต่อชั่วโมงที่ถือสถานะ', 'Profit per Trading Hour'), M(R.union > 0 ? s.net / (R.union / 36e5) : null), tn(s.net), L('กำไรสุทธิ ÷ ชั่วโมงที่มีสถานะเปิด (ไม่นับซ้ำ)', 'Net profit ÷ hours with a position open (not double counted)')),
      row(L('วันเทรดที่ดีที่สุด', 'Best Trading Day'), bd.k ? `${M(bd.v)} <small>${dayL(bd.k)}</small>` : '—', tn(bd.v)), row(L('วันเทรดที่แย่ที่สุด', 'Worst Trading Day'), wdy.k ? `${M(wdy.v)} <small>${dayL(wdy.k)}</small>` : '—', tn(wdy.v)),
      row(L('เดือนที่ดีที่สุด', 'Best Month'), bm.k ? `${M(bm.v)} <small>${monL(bm.k)}</small>` : '—', tn(bm.v)), row(L('เดือนที่แย่ที่สุด', 'Worst Month'), wm.k ? `${M(wm.v)} <small>${monL(wm.k)}</small>` : '—', tn(wm.v))]],
    [L('B. ยอดเงินในบัญชี', 'B. Account Balance'), [
      row(L('ยอดเงินเริ่มต้น', 'Starting Balance'), R.bal ? money(R.bal.start, cur) : '—', '', L('ยอดเงินของบัญชีในขอบเขต ณ ต้นช่วงเวลาที่เลือก', 'Balance of the accounts in scope at the start of the range')), row(L('ยอดเงินสิ้นสุด', 'Ending Balance'), R.bal ? money(R.bal.end, cur) : '—'),
      row(L('ยอดเงินสูงสุด', 'Highest Balance'), R.bal ? money(R.bal.hi, cur) : '—', 'pos'), row(L('ยอดเงินต่ำสุด', 'Lowest Balance'), R.bal ? money(R.bal.lo, cur) : '—', 'neg')]],
    [L('C. กระแสเงินสด', 'C. Cash Flow'), [
      row(L('ฝากรวม', 'Total Deposits'), Mu(R.tsum(['Deposit'])), 'pos'), row(L('ถอนรวม', 'Total Withdrawals'), Mu(R.tsum(['Withdrawal'])), 'neg'),
      row(L('กระแสเงินสดสุทธิ', 'Net Cash Flow'), M(R.tsum(['Deposit', 'Dividend', 'Credit']) - R.tsum(['Withdrawal'])), tn(R.tsum(['Deposit', 'Dividend', 'Credit']) - R.tsum(['Withdrawal'])), L('ฝาก + ปันผล + เครดิต − ถอน', 'Deposits + dividends + credits − withdrawals')),
      row(L('เงินปันผลรวม', 'Total Dividends'), Mu(R.tsum(['Dividend'])), '', L('บันทึกได้ในบัญชี › รายการเงิน (ประเภท ปันผล)', 'Add under Accounts › Transactions (type Dividend)')), row(L('เครดิต / เงินคืนรวม', 'Total Credits / Rebates'), Mu(R.tsum(['Credit'])), '', L('บันทึกได้ในบัญชี › รายการเงิน (ประเภท เครดิต / เงินคืน)', 'Add under Accounts › Transactions (type Credit / Rebate)'))]],
  ]));
  out.push(sec(2, L('ประสิทธิภาพ', 'Performance'), L('วิเคราะห์ประสิทธิภาพของระบบเทรดและผลลัพธ์ของแต่ละเทรด', 'How the system performs and how each trade turns out'), 3, [
    [L('A. ผลลัพธ์ของเทรด', 'A. Trade Outcomes'), [
      row(L('เทรดทั้งหมด', 'Total Trades'), N(s.n)), row(L('เทรดที่ชนะ', 'Winning Trades'), N(s.wins), 'pos'), row(L('เทรดที่แพ้', 'Losing Trades'), N(s.losses), 'neg'), row(L('เทรดเสมอ', 'Breakeven Trades'), N(s.be)),
      row(L('อัตราชนะ', 'Win Rate'), cnt(s.wins, s.n)), row(L('อัตราแพ้', 'Loss Rate'), cnt(s.losses, s.n)), row(L('อัตราเสมอ', 'Breakeven Rate'), cnt(s.be, s.n)),
      row(L('อัตราชนะฝั่ง Long', 'Long Win Rate'), P(s.longWr)), row(L('อัตราชนะฝั่ง Short', 'Short Win Rate'), P(s.shortWr))]],
    [L('B. ตัวชี้วัดประสิทธิภาพ', 'B. Performance Metrics'), [
      row('Profit Factor', X(s.pf)), row(L('ค่าคาดหวัง', 'Expectancy'), M(s.avg), tn(s.avg)), row(L('ค่าคาดหวัง (R)', 'Expectancy (R)'), Rr(s.avgR), tn(s.avgR)), row('Payoff Ratio', X(s.pay)),
      row(L('R-Multiple รวม', 'Total R-Multiple'), Rr(s.r), tn(s.r)), row(L('R:R ที่วางแผนเฉลี่ย', 'Average Planned R:R'), finite(s.planned) ? '1 : ' + fmt(s.planned, 2) : '—', '', L('จาก T/P และ S/L ที่ตั้งไว้', 'From the T/P and S/L you set')),
      row(L('การทำได้ตาม R:R', 'Risk-to-Reward Realization'), P(realize, 0), '', L('ไม้ที่ชนะ: R ที่ได้จริง ÷ R:R ที่วางแผน (เฉลี่ย)', 'Winners: realised R ÷ planned R:R (average)')),
      row(L('กำไรเฉลี่ย / ขาดทุนเฉลี่ย', 'Average Win / Average Loss'), ok && finite(s.aw) ? `<span class="pos">${money(s.aw, cur)}</span> / <span class="neg">${M(s.al)}</span>` : '—')]],
    [L('C. ผลของแต่ละเทรด', 'C. Trade Results'), [
      row(L('กำไรเฉลี่ยของไม้ที่ชนะ', 'Average Winning Trade'), M(s.aw), 'pos'), row(L('ขาดทุนเฉลี่ยของไม้ที่แพ้', 'Average Losing Trade'), M(s.al), 'neg'),
      row(L('ไม้ที่กำไรมากที่สุด', 'Largest Winning Trade'), M(s.best), 'pos'), row(L('ไม้ที่ขาดทุนมากที่สุด', 'Largest Losing Trade'), M(s.worst), 'neg'),
      row(L('มัธยฐานกำไร/ขาดทุนต่อเทรด', 'Median Trade P&L'), M(median(R.okN)), tn(median(R.okN))),
      row(L('R-Multiple ดีที่สุด', 'Best Trade R-Multiple'), Rr(R.rs.length ? Math.max(...R.rs) : null), 'pos'), row(L('R-Multiple แย่ที่สุด', 'Worst Trade R-Multiple'), Rr(R.rs.length ? Math.min(...R.rs) : null), 'neg')]],
    [L('D. สถิติต่อเนื่อง', 'D. Streaks'), [
      row(L('ชนะติดกันสูงสุด', 'Max Consecutive Wins'), N(s.cw), 'pos'), row(L('แพ้ติดกันสูงสุด', 'Max Consecutive Losses'), N(s.cl), 'neg'),
      row(L('ชนะติดกันตอนนี้', 'Current Winning Streak'), N(curW), curW ? 'pos' : ''), row(L('แพ้ติดกันตอนนี้', 'Current Losing Streak'), N(curL), curL ? 'neg' : ''),
      row(L('ชนะติดกันเฉลี่ย', 'Average Winning Streak'), X(mean(R.wr_.map(r => r.n)), 1)), row(L('แพ้ติดกันเฉลี่ย', 'Average Losing Streak'), X(mean(R.lr_.map(r => r.n)), 1)),
      row(L('กำไรติดกันสูงสุด', 'Max Consecutive Profit'), M(R.wr_.length ? Math.max(...R.wr_.map(r => r.sum)) : null), 'pos', L('ผลรวมของไม้ที่ชนะติดกันชุดที่มากที่สุด', 'Largest sum of a winning run')),
      row(L('ขาดทุนติดกันสูงสุด', 'Max Consecutive Loss Amount'), M(R.lr_.length ? Math.min(...R.lr_.map(r => r.sum)) : null), 'neg', L('ผลรวมของไม้ที่แพ้ติดกันชุดที่มากที่สุด', 'Largest sum of a losing run'))]],
    [L('E. ความสม่ำเสมอรายวันและรายช่วง', 'E. Daily & Period Consistency'), [
      row(L('วันกำไร', 'Profitable Days'), N(s.winDays), 'pos'), row(L('วันขาดทุน', 'Losing Days'), N(s.lossDays), 'neg'), row(L('วันเสมอ', 'Breakeven Days'), N(s.days - s.winDays - s.lossDays)),
      row(L('อัตราชนะรายวัน', 'Daily Win Rate'), P(s.dayWr)), row(L('สัปดาห์กำไร', 'Winning Weeks'), N(R.pos(R.weeks)), 'pos'), row(L('สัปดาห์ขาดทุน', 'Losing Weeks'), N(R.neg(R.weeks)), 'neg'),
      row(L('เดือนกำไร', 'Winning Months'), N(R.pos(R.months)), 'pos'), row(L('เดือนขาดทุน', 'Losing Months'), N(R.neg(R.months)), 'neg'),
      row(L('สัดส่วนช่วงที่กำไร', 'Profitable Period %'), cnt(R.pos(R.months), R.months.size), '', L('เดือนที่กำไร ÷ เดือนที่มีเทรด', 'Profitable months ÷ months traded'))]],
    [L('F. ประสิทธิภาพของเทรด', 'F. Trade Efficiency'), [
      row(gl(L('MFE เฉลี่ย', 'Average MFE'), 'mfe'), Rr(s.mfeR), 'pos', L('ใช้เทรดที่บันทึก MFE ไว้', 'Uses trades with MFE recorded')), row(gl(L('MAE เฉลี่ย', 'Average MAE'), 'mae'), Rr(s.maeR), 'neg', L('ใช้เทรดที่บันทึก MAE ไว้', 'Uses trades with MAE recorded')),
      row(L('สัดส่วนกำไรที่เก็บได้', 'Profit Capture Ratio'), mfeTot > EPS ? P(capTot / mfeTot * 100, 0) : '—', '', L('R ที่ได้จริงรวม ÷ MFE รวม (R)', 'Total realised R ÷ total MFE (R)')),
      row(L('ประสิทธิภาพการออกเฉลี่ย', 'Average Exit Efficiency'), P(s.efficiency, 0), '', L('ไม้ที่ชนะ: R ที่ได้ ÷ MFE (เฉลี่ยต่อเทรด)', 'Winners: realised R ÷ MFE (per-trade average)'))]],
  ]));
  out.push(sec(3, L('การบริหารความเสี่ยง', 'Risk Management'), L('วิเคราะห์ Drawdown การควบคุมความเสี่ยง และผลตอบแทนต่อความเสี่ยง', 'Drawdown, risk control and risk-adjusted return'), 3, [
    [L('A. Drawdown ของยอดเงินและ Equity', 'A. Balance & Equity Drawdown'), [
      row(L('Balance Drawdown สูงสุด', 'Maximum Balance Drawdown'), M(R.bdd.max), 'neg'), row(L('Balance Drawdown สูงสุด %', 'Maximum Balance Drawdown %'), P(R.bdd.maxPct, 2), 'neg'),
      row(L('Balance Drawdown เฉลี่ย', 'Average Balance Drawdown'), M(R.bdd.avg), 'neg'), row(L('Balance Drawdown เฉลี่ย %', 'Average Balance Drawdown %'), P(R.bdd.avgPct, 2), 'neg'),
      row(L('Equity Drawdown สูงสุด', 'Maximum Equity Drawdown'), M(R.edd.max), 'neg', L('รวมการติดลบระหว่างถือ (MAE) ของเทรดที่บันทึกไว้', 'Includes the open-trade dip (MAE) where recorded')), row(L('Equity Drawdown สูงสุด %', 'Maximum Equity Drawdown %'), P(R.edd.maxPct, 2), 'neg'),
      row(L('Equity Drawdown เฉลี่ย', 'Average Equity Drawdown'), M(R.edd.avg), 'neg'), row(L('Equity Drawdown เฉลี่ย %', 'Average Equity Drawdown %'), P(R.edd.avgPct, 2), 'neg')]],
    [L('B. ความเสี่ยงต่อเทรด', 'B. Trade Risk'), [
      row(L('ความเสี่ยงเริ่มต้นเฉลี่ย', 'Average Initial Risk'), Mu(mean(R.risks)), '', L('ระยะ S/L × มูลค่าต่อหน่วย × ล็อต', 'S/L distance × value per unit × lots')), row(L('ความเสี่ยงเริ่มต้นเฉลี่ย %', 'Average Initial Risk %'), P(mean(R.riskPct), 2), '', L('เทียบยอดเงิน ณ เวลาเข้า', 'Of the balance at entry')),
      row(L('ความเสี่ยงเริ่มต้นสูงสุด', 'Maximum Initial Risk'), Mu(R.risks.length ? Math.max(...R.risks) : null)), row(L('ความเสี่ยงเริ่มต้นสูงสุด %', 'Maximum Initial Risk %'), P(R.riskPct.length ? Math.max(...R.riskPct) : null, 2)),
      row(L('ความเสี่ยงเฉลี่ยต่อวัน', 'Average Daily Risk'), Mu(mean([...R.dayRisk.values()]))), row(L('ความเสี่ยงสูงสุดต่อวัน', 'Maximum Daily Risk'), Mu(R.dayRisk.size ? Math.max(...R.dayRisk.values()) : null)),
      row(L('ความเสี่ยงที่เปิดพร้อมกันสูงสุด', 'Maximum Open Risk'), Mu(R.maxRisk || null), '', L('ผลรวมความเสี่ยงของสถานะที่เปิดพร้อมกัน', 'Sum of risk across positions open at once')),
      row(L('การใช้ความเสี่ยงตามแผน', 'Risk Utilization'), state.settings.preferredRisk > 0 && R.riskPct.length ? P(mean(R.riskPct) / state.settings.preferredRisk * 100, 0) : '—', '', L(`ความเสี่ยงเฉลี่ย % ÷ ความเสี่ยงที่ตั้งไว้ (${fmt(state.settings.preferredRisk || 0, 2)}%)`, `Average risk % ÷ your preferred risk (${fmt(state.settings.preferredRisk || 0, 2)}%)`)),
      row('Recovery Factor', X(s.recovery), '', L('กำไรสุทธิ ÷ Drawdown สูงสุด', 'Net profit ÷ max drawdown')),
      row(L('เวลาฟื้นตัวนานสุด', 'Recovery Time'), D(R.recMax), '', L('จากจุดสูงสุดเดิมจนทำจุดสูงสุดใหม่ (ช่วงที่นานที่สุด)', 'From a peak to a new high (longest)')), row(L('เวลาฟื้นตัวเฉลี่ย', 'Average Recovery Time'), D(mean(R.rec)))]],
    [L('C. ผลตอบแทนเทียบความเสี่ยง', 'C. Risk-adjusted Performance'), [
      row('Sharpe Ratio', X(R.sdR > EPS ? R.mR / R.sdR * Math.sqrt(252) : null), '', L('ผลตอบแทนรายวัน · ปรับเป็นรายปี (√252)', 'Daily returns · annualised (√252)')), row('Sortino Ratio', X(R.dDev > EPS ? R.mR / R.dDev * Math.sqrt(252) : null), '', L('นับเฉพาะความผันผวนขาลง', 'Downside deviation only')),
      row('Calmar Ratio', X(finite(R.annRet) && R.bdd.maxPct < -EPS ? R.annRet / Math.abs(R.bdd.maxPct) : null), '', L('ผลตอบแทนต่อปี ÷ Drawdown สูงสุด %', 'Annualised return ÷ max drawdown %')),
      row(L('ส่วนเบี่ยงเบนผลตอบแทนรายวัน', 'Daily Return Standard Deviation'), P(R.sdR, 2)), row('System Quality Number (SQN)', X(R.sqn), '', L('√N × R เฉลี่ย ÷ SD ของ R (N ≤ 100)', '√N × mean R ÷ SD of R (N ≤ 100)')),
      row('Ulcer Index', X(R.ulcer)), row(L('โอกาสล้างพอร์ต', 'Risk of Ruin'), finite(R.ruin) ? (R.ruin < 0.01 ? '< 0.01%' : P(R.ruin, 2)) : '—', R.ruin > 5 ? 'neg' : '', L('((1 − edge) ÷ (1 + edge)) ^ (100 ÷ ความเสี่ยงเฉลี่ย %)', '((1 − edge) ÷ (1 + edge)) ^ (100 ÷ average risk %)'))]],
    [L('D. คุมความเสี่ยงรายวัน', 'D. Daily Risk Control'), [
      row(L('Drawdown รายวันสูงสุด', 'Maximum Daily Drawdown'), M(R.ddays.length ? Math.min(...R.ddays.map(x => x.dd)) : null), 'neg', L('ลดลงจากจุดสูงสุดภายในวัน', 'Fall from the intraday high')), row(L('Drawdown รายวันสูงสุด %', 'Maximum Daily Drawdown %'), P(R.ddays.length ? Math.min(...R.ddays.map(x => x.pct).filter(finite), 0) : null, 2), 'neg'),
      row(L('Drawdown รายวันเฉลี่ย', 'Average Daily Drawdown'), M(mean(R.ddays.map(x => x.dd)))), row(L('Drawdown รายวันเฉลี่ย %', 'Average Daily Drawdown %'), P(mean(R.ddays.map(x => x.pct).filter(finite)), 2)),
      row(L('ขาดทุนรายวันมากที่สุด', 'Largest Daily Loss'), R.worstD && R.worstD.net < 0 ? `${M(R.worstD.net)} <small>${dayL(R.worstD.d)}</small>` : '—', 'neg'), row(L('ขาดทุนรายวันมากที่สุด %', 'Largest Daily Loss %'), R.worstD && R.worstD.net < 0 && R.worstD.b0 > 0 ? P(R.worstD.net / R.worstD.b0 * 100, 2) : '—', 'neg')]],
  ]));
  out.push(sec(4, L('การเข้าร่วมตลาด', 'Participation'), L('วิเคราะห์ความถี่ ช่วงเวลา ทิศทาง และระยะเวลาการเทรด', 'Frequency, timing, direction and duration of your trades'), 2, [
    [L('A. ความถี่การเทรด', 'A. Trading Frequency'), [
      row(L('วันเทรด', 'Trading Days'), N(nTradeDays)), row(L('เทรดเฉลี่ยต่อวัน', 'Average Trades per Day'), X(s.tradesPerDay, 1)), row(L('เทรดเฉลี่ยต่อสัปดาห์', 'Average Trades per Week'), X(nWeeks ? s.n / nWeeks : null, 1)),
      row(L('เทรดเฉลี่ยในวันกำไร', 'Average Trades per Winning Day'), X(R.winD.length ? sum(R.winD.map(([, v]) => v.length)) / R.winD.length : null, 1)), row(L('เทรดเฉลี่ยในวันขาดทุน', 'Average Trades per Losing Day'), X(R.lossD.length ? sum(R.lossD.map(([, v]) => v.length)) / R.lossD.length : null, 1)),
      row(L('วันที่เทรดบ่อยที่สุด', 'Most Active Trading Day'), topWd.k != null ? `${WD[topWd.k]} <small>${topWd.v} ${L('เทรด', 'trades')}</small>` : '—'), row(L('ชั่วโมงที่เทรดบ่อยที่สุด', 'Most Active Trading Hour'), topHr.k ? `${topHr.k} <small>${topHr.v} ${L('เทรด', 'trades')}</small>` : '—')]],
    [L('B. ทิศทางการเทรด', 'B. Trade Direction'), [
      row(L('เทรด Long', 'Long Trades'), N(s.longN)), row(L('เทรด Long %', 'Long Trades %'), cnt(s.longN, s.n)), row(L('เทรด Short', 'Short Trades'), N(s.shortN)), row(L('เทรด Short %', 'Short Trades %'), cnt(s.shortN, s.n))]],
    [L('C. ระยะเวลาถือ', 'C. Trade Duration'), [
      row(L('ระยะเวลาถือเฉลี่ย', 'Average Duration'), D(s.duration)), row(L('มัธยฐานระยะเวลาถือ', 'Median Duration'), D(median(R.durs))),
      row(L('ระยะเวลาถือเฉลี่ย (ไม้ชนะ)', 'Average Winning Duration'), D(s.winDuration)), row(L('ระยะเวลาถือเฉลี่ย (ไม้แพ้)', 'Average Losing Duration'), D(s.lossDuration)),
      row(L('ถือนานที่สุด', 'Longest Trade Duration'), D(s.maxDuration)), row(L('ถือสั้นที่สุด', 'Shortest Trade Duration'), D(s.minDuration))]],
    [L('D. การอยู่ในตลาด', 'D. Market Exposure'), [
      row(L('เวลาที่มีสถานะ', 'Exposure Time'), D(R.union / R.MS), '', L('เวลาที่มีอย่างน้อย 1 สถานะเปิดอยู่ (ไม่นับซ้ำ)', 'Time with at least one position open (not double counted)')), row(L('เวลาที่มีสถานะ %', 'Exposure Time %'), R.span > 0 ? P(R.union / R.span * 100, 1) : '—', '', L('เทียบช่วงตั้งแต่เทรดแรกถึงเทรดสุดท้าย', 'Of the time from first entry to last exit')),
      row(L('เวลาที่มีสถานะเฉลี่ยต่อวันเทรด', 'Average Exposure Time'), D(nTradeDays ? R.union / R.MS / nTradeDays : null)), row(L('ช่วงมีสถานะต่อเนื่องนานสุด', 'Maximum Exposure Time'), D(R.blocks.length ? Math.max(...R.blocks) / R.MS : null)),
      row(L('สถานะพร้อมกันเฉลี่ย', 'Average Concurrent Positions'), X(R.union > 0 ? R.totalDur / R.union : null, 2), '', L('ถ่วงตามเวลาที่มีสถานะ', 'Time-weighted while exposed')), row(L('สถานะพร้อมกันสูงสุด', 'Maximum Concurrent Positions'), N(R.maxOpen || null))]],
    [L('E. เซสชันการเทรด', 'E. Trading Session'), [
      row(L('เทรดต่อเซสชัน', 'Trades per Session'), sList(g => fmt(g.s.n, 0))),
      row(L('เซสชันที่กำไรมากที่สุด', 'Most Profitable Session'), sessBest[0] ? `${esc(sessBest[0].label)} <small class="${tn(sessBest[0].s.net)}">${M(sessBest[0].s.net)}</small>` : '—'),
      row(L('เซสชันที่กำไรน้อยที่สุด', 'Least Profitable Session'), sessBest.length ? `${esc(sessBest.at(-1).label)} <small class="${tn(sessBest.at(-1).s.net)}">${M(sessBest.at(-1).s.net)}</small>` : '—'),
      row(L('อัตราชนะแต่ละเซสชัน', 'Session Win Rate'), sList(g => P(g.s.wr, 0))),
      row(L('สัดส่วนเซสชันที่กำไร', 'Session Profitability %'), cnt(R.sess.filter(g => g.s.net > EPS).length, R.sess.length), '', L('เซสชันที่มีกำไรสุทธิ ÷ เซสชันที่มีเทรด', 'Sessions with a net profit ÷ sessions traded'))]],
  ]));
  out.push(sec(5, L('ต้นทุนการเทรด', 'Trading Costs'), L('วิเคราะห์ต้นทุนการเทรดและผลกระทบต่อกำไร', 'What trading costs you, and how much of your profit it takes'), 2, [
    [L('A. ต้นทุนรวม', 'A. Total Costs'), [
      row(L('ต้นทุนการเทรดรวม', 'Total Trading Costs'), Mu(R.costs), 'neg', L('ค่าคอมมิชชัน + สวอปที่จ่าย + ค่าธรรมเนียม + Slippage', 'Commission + swap paid + fees + slippage')), row(L('ค่าคอมมิชชันรวม', 'Total Commissions'), Mu(R.comm), 'neg'),
      row(L('ค่าสวอปรวม', 'Total Swap'), M(R.swap), tn(R.swap)), row(L('ค่าธรรมเนียมบริหารรวม', 'Total Administration Fees'), Mu(R.fees), 'neg', L('รายการเงินประเภท ค่าธรรมเนียม', 'Transactions of type Fee')),
      row(L('ต้นทุน Slippage รวม', 'Total Slippage Cost'), R.slip != null ? Mu(R.slip) : '—', 'neg', L('ใช้ค่า slippage ที่บันทึกในเทรด (ถ้ามี)', 'Uses slippage recorded on trades, if any'))]],
    [L('B. วิเคราะห์ต้นทุน', 'B. Cost Analysis'), [
      row(L('ต้นทุนเฉลี่ยต่อเทรด', 'Average Cost per Trade'), Mu(s.n ? R.costs / s.n : null)), row(L('ค่าคอมมิชชันเฉลี่ยต่อเทรด', 'Average Commission per Trade'), Mu(s.n ? R.comm / s.n : null)),
      row(L('ค่าสวอปเฉลี่ยต่อเทรด', 'Average Swap per Trade'), M(s.n ? R.swap / s.n : null), tn(R.swap)), row(L('ต้นทุน Slippage เฉลี่ย', 'Average Slippage Cost'), R.slipList.length ? Mu(mean(R.slipList)) : '—'),
    ]], [L('C. ประสิทธิภาพต้นทุน', 'C. Cost Efficiency'), [
      row(L('ต้นทุนต่อล็อต', 'Cost per Lot'), Mu(R.lots > 0 ? R.costs / R.lots : null)),
      row(L('ต้นทุน % ของกำไรขั้นต้น', 'Trading Costs % of Gross Profit'), s.gp > 0 ? P(R.costs / s.gp * 100, 1) : '—'), row(L('ต้นทุน % ของกำไรสุทธิ', 'Trading Costs % of Net Profit'), s.net > 0 ? P(R.costs / s.net * 100, 1) : '—', '', L('ถ้ากำไรสุทธิติดลบจะไม่แสดง', 'Not shown when the net is negative'))]],
  ]));
  const note = !ok ? `<div class="notice warn mb16">${icon('alert')}<span>${L('บัญชีในขอบเขตใช้หลายสกุลเงิน — เลือกบัญชีเดียวเพื่อดูตัวเลขเงิน', 'Accounts in scope use several currencies — pick one account to see money figures')}</span></div>` : '';
  return note + `<p class="rp-note small dim">${L(`ตัวเลขเงินเป็น ${cur} · ผลสุทธิหลังค่าคอมมิชชันและสวอป · ใช้ช่วงเวลา บัญชี และตัวกรองด้านบน`, `Money in ${cur} · net of commission and swap · follows the range, account and filters above`)}</p>` + out.join('');
}
/* v3.69 — Element heatmap scale: neutral mid → full red / green; returns [background, strong?] */
function heatFill(v, max, mid = 0, accent = false) { if (!finite(v)) return ['var(--heat-mid)', false]; const d = v - mid, p = Math.min(1, Math.abs(d) / (max || 1)), pct = Math.round(18 + Math.sqrt(p) * 82); return [`color-mix(in srgb,${accent ? 'var(--accent)' : d >= 0 ? 'var(--pos)' : 'var(--neg)'} ${pct}%,var(--heat-mid))`, pct >= 55]; }
function monthlyMatrix(rows) {
  const by = new Map(); closedSorted(rows).forEach(t => { const k = tradeDay(t).slice(0, 7); const v = value(t); if (finite(v)) by.set(k, (by.get(k) || 0) + v); });
  const years = [...new Set([...by.keys()].map(k => k.slice(0, 4)))].sort().reverse(); if (!years.length) return '';
  const max = Math.max(EPS, ...[...by.values()].map(Math.abs));
  const cell = v => { if (v == null) return '<td class="dim">—</td>'; const [bg, hi] = heatFill(v, max); return `<td class="${hi ? 'hc-hi' : ''}" style="background:${bg}" data-tip="${esc(unitFmt(v))}">${compactUnit(v)}</td>`; };
  return panel(L('ตารางผลรายเดือน', 'Monthly returns'), `<div class="tablewrap"><table class="heat"><thead><tr><th>${L('ปี', 'Year')}</th>${Array.from({ length: 12 }, (_, i) => `<th>${monthName(i)}</th>`).join('')}<th>${L('รวม', 'Total')}</th></tr></thead><tbody>${years.map(y => { const vals = Array.from({ length: 12 }, (_, i) => by.get(`${y}-${String(i + 1).padStart(2, '0')}`) ?? null); const tot = sum(vals.filter(v => v != null)); return `<tr><th>${y}</th>${vals.map(cell).join('')}<td><strong class="${tone(tot)}">${unitFmt(tot)}</strong></td></tr>`; }).join('')}</tbody></table></div>`);
}
function yearCalendar(rows) {
  const ys = [...new Set(closedSorted(rows).map(t => +tradeDay(t).slice(0, 4)))].sort(); const y = ui.calYear || ys[ys.length - 1] || new Date().getFullYear();
  const yr = rows.filter(t => tradeDay(t).startsWith(String(y))), s = stats(yr);
  return `<div class="row mb16">${ibtn('chev-left', 'cal-year', L('ปีก่อน', 'Previous'), { 'data-dir': -1, 'data-y': y })}<h2 style="margin:0;font-size:18px;min-width:80px;text-align:center">${y}</h2>${ibtn('chev-right', 'cal-year', L('ปีถัดไป', 'Next'), { 'data-dir': 1, 'data-y': y })}<div class="grow"></div><span class="small muted">${L('ผลทั้งปี', 'Year total')} <strong class="${tone(s.total)}">${unitFmt(s.total)}</strong> · ${s.days} ${L('วันเทรด', 'days')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(s.dayWr, 0)}% ${L('รายวัน', 'daily')}</span></div>`
    + `<div class="grid g3">${Array.from({ length: 12 }, (_, m) => { const ms = stats(yr.filter(t => +tradeDay(t).slice(5, 7) === m + 1)); return panel(monthName(m, true), calendarHTML(rows, y, m, true), `<strong class="small ${tone(ms.total)}">${ms.n ? unitFmt(ms.total) : ''}</strong>`); }).join('')}</div>`;
}
const METRICS = () => [['expectancy', L('ค่าคาดหวัง', 'Expectancy')], ['total', L('ผลรวม', 'Total')], ['wr', L('อัตราชนะ %', 'Win rate %')], ['n', L('เทรด', 'Trades')]];
function metricVal(s, k) { return s[k]; }
function metricFmt(k, v) { if (k === 'wr') return finite(v) ? fmt(v, 1) + '%' : '—'; if (k === 'pfU') return fmt(v, 2); if (k === 'n') return fmt(v, 0); if (k === 'avgR') return finite(v) ? fmt(v, 2, true) + 'R' : '—'; return unitFmt(v); }
const ORDERED_DIMS = ['weekday', 'duration', 'session', 'hour'];
/* ---------- Insights (v3.21): chart gallery + single-dimension drill-down ---------- */
function rHistogram(rows, u) {
  const closed = closedSorted(rows).filter(t => finite(calc(t).r)), by = new Map(group(rows, 'rbin').map(g => [g.key, g]));
  const short = i => i === 0 ? `<${String(RB_LO).replace('-', '−')}` : i === RB_N - 1 ? `≥${RB_HI}` : String(RB_LO + i - 1).replace('-', '−');
  const data = Array.from({ length: RB_N }, (_, i) => { const g = by.get(String(i)); return { x: String(i), label: short(i), tip: rbinLabel(i), y: g?.s.n || 0, total: g?.s.total ?? 0, color: RB_LO + i - 1 < 0 ? 'var(--neg)' : 'var(--pos)', sub: g ? `${L('ผลรวม', 'Total')} ${unitFmt(g.s.total, u)}` : '' }; });
  return { data, n: closed.length };
}
function sessionLanes() {
  const now = Date.now(), wins = sessionWindows(now, now + 7 * 864e5), seen = new Set(), lanes = [], col = { Asia: 'var(--warn)', London: 'var(--accent)', 'New York': 'var(--pos)' };
  const hr = ms => { const p = dateParts(new Date(ms).toISOString()); return +p.hour + p.minute / 60; };
  for (const w of wins) { if (seen.has(w.k)) continue; seen.add(w.k); const a = hr(w.a), b = hr(w.b), segs = b > a ? [[a, b]] : [[a, 24], [0, b]]; lanes.push({ label: sessionLabel(w.k), color: col[w.k] || 'var(--dim)', segs }); }
  return lanes;
}
const DUR_TICKS = [[1, '1m'], [5, '5m'], [15, '15m'], [60, '1h'], [240, '4h'], [1440, '1d'], [4320, '3d'], [10080, '1w'], [43200, '1mo']];
/* ---------- Insights (v3.23): one sub-tab per dimension ---------- */
const INS_TABS = () => [['playbook', L('กลยุทธ์', 'Strategy')], ['instrument', L('สินทรัพย์', 'Instruments')], ['weekday', L('วันในสัปดาห์', 'Weekday')], ['session', L('เซสชันการเทรด', 'Trading session')], ['duration', L('ระยะเวลาถือ', 'Duration')], ['r', 'R-Multiple'], ['tags', L('กำหนดเอง', 'Customs')]];
const insTabOf = dim => dim === 'timeframe' || dim === 'tag' || dim === 'mistake' || dim === 'context' || dim === 'setup' || String(dim).startsWith('tagcat:') ? 'tags' : dim === 'hour' ? 'session' : INS_TABS().some(t => t[0] === dim) ? dim : 'playbook';
const ptName = p => `${nameOf('instruments', p.t.instrumentId, 'symbol')} · ${fmtDate(p.t.entryDateTime, { time: true })}`;
const closedPts = rows => closedSorted(rows).map(t => ({ t, c: calc(t), v: value(t) })).filter(p => finite(p.v));
function durationScatter(rows) {
  const pts = closedPts(rows).filter(p => p.c.duration > 0).map(p => ({ x: Math.max(1, p.c.duration), y: p.v, label: ptName(p), xTip: duration(p.c.duration) }));
  const dmin = Math.max(1, Math.min(...pts.map(p => p.x), 1e9)), dmax = Math.max(...pts.map(p => p.x), 2), ticks = DUR_TICKS.filter(([m]) => m >= dmin / 1.5 && m <= dmax * 1.5);
  return chartBox({ type: 'scatter', data: pts, unit: ui.unit, xLog: true, xMin: Math.min(dmin, ticks[0]?.[0] ?? dmin), xMax: Math.max(dmax, ticks.at(-1)?.[0] ?? dmax), xTicks: ticks.map(x => x[0]), xFmt: v => DUR_TICKS.find(x => x[0] === v)?.[1] ?? duration(v), empty: L('ยังไม่มีเทรดที่ปิดแล้ว', 'No closed trades yet') }, 300);
}
function sessionScatter(rows) {
  const hourOf = t => { const p = dateParts(t.entryDateTime); return p ? +p.hour + p.minute / 60 : null; };
  const pts = closedPts(rows).map(p => ({ x: hourOf(p.t), y: p.v, label: ptName(p), xTip: `${L('เข้า', 'Entry')} ${fmtDate(p.t.entryDateTime, { time: true }).split(' ').pop()} · ${sessionLabel(sessionOf(p.t))}` })).filter(p => finite(p.x));
  return chartBox({ type: 'scatter', data: pts, unit: ui.unit, xMin: 0, xMax: 24, xTicks: [0, 3, 6, 9, 12, 15, 18, 21, 24], xFmt: v => String(v % 24).padStart(2, '0') + ':00', lanes: sessionLanes(), empty: L('ยังไม่มีเทรดที่ปิดแล้ว', 'No closed trades yet') }, 340);
}
/* R-Multiple tab: distribution −3.0R … +3.0R, cumulative R and money per R range */
function rMultipleView(rows) {
  const u = ui.unit, closed = closedSorted(rows).filter(t => finite(calc(t).r)), rs = closed.map(t => calc(t).r), n = rs.length, rh = rHistogram(rows, u);
  if (!n) return empty(L('ยังไม่มีเทรดที่มี S/L', 'No trades with an S/L yet'), L('ใส่ S/L ในเทรดเพื่อวัดผลเป็น R', 'Add an S/L to trades to measure R'));
  const share = f => fmt(rs.filter(f).length / n * 100, 0) + '%', sorted = rs.slice().sort((a, b) => a - b), med = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const pctOf = f => rs.filter(f).length / n * 100, closedN = closedSorted(rows).length;
  const kp = miniRow([
    miniCard(L('เทรดที่มี S/L', 'Trades with S/L'), fmt(n, 0), closedN ? L(`${fmt(n / closedN * 100, 0)}% ของเทรดที่ปิด`, `${fmt(n / closedN * 100, 0)}% of closed trades`) : '', pctViz(closedN ? n / closedN * 100 : 0)),
    miniCard(L('R เฉลี่ย', 'Average R'), `<span class="${tone(mean(rs))}">${fmt(mean(rs), 2, true)}R</span>`, L('มัธยฐาน ', 'Median ') + fmt(med, 2, true) + 'R', sparkline(cumVals(rows, 'R'))),
    miniCard(L('ได้ ≥ +2R', 'Reached ≥ +2R'), share(r => r >= 2), `${rs.filter(r => r >= 2).length} ${L('เทรด', 'trades')}`, pctViz(pctOf(r => r >= 2), 'pos')),
    miniCard(L('เสียเกิน −1R', 'Lost more than −1R'), `<span class="${rs.some(r => r < -1.05) ? 'neg' : ''}">${share(r => r < -1.05)}</span>`, L('ขาดทุนเกินแผน (เผื่อ 0.05R)', 'Loss beyond plan (0.05R slack)'), pctViz(pctOf(r => r < -1.05), 'neg')),
    miniCard(L('ดีที่สุด / แย่ที่สุด', 'Best / worst'), `<span class="pos">${fmt(sorted.at(-1), 2, true)}R</span>`, `${L('แย่ที่สุด', 'Worst')} <span class="neg">${fmt(sorted[0], 2, true)}R</span>`, ratioViz(sorted.at(-1), sorted[0], fmt(sorted.at(-1), 1, true) + 'R', fmt(sorted[0], 1, true) + 'R')),
  ]);
  const bins = group(rows, 'rbin').filter(g => g.key !== '—');
  const hist = chartPanel(L('การกระจายของ R-Multiple', 'R-Multiple distribution'), chartBox({ type: 'bar', categorical: true, signed: false, valueLabels: true, data: rh.data, unit: 'count', tipFmt: v => fmt(v, 0) + L(' เทรด', ' trades'), valueFmt: v => fmt(v, 0) }, INS_CH), '', 'ins-c1', L('Histogram · ช่วงละ 1R ตั้งแต่ < −10R ถึง ≥ +10R', 'Histogram · 1R buckets from < −10R to ≥ +10R'));
  const short = new Map(rh.data.map(d => [d.x, d.label]));
  return kp + `<div class="ins-charts mb16">${hist}${metricBarCard(bins.map(g => ({ ...g, label: short.get(g.key) || g.label })), 'rbin', true)}</div>` + panel(L('ตารางสรุป · ', 'Summary · ') + 'R-Multiple', breakdownTable(bins, 'rbin'), '', 'flush', L('แถว = ช่วง R ของผลลัพธ์จริง', 'Rows = actual R range'));
}
/* ---------- v3.54 — Long / Short distribution card (right of the Insight chart), like the MT5 report ---------- */
const LS_DIMS = ['playbook', 'instrument', 'weekday', 'session', 'hour', 'duration', 'rbin'];
function sideDistCard(gs, dim) {
  const rows = gs.filter(g => g.rows?.length).map(g => { const lo = g.rows.filter(t => t.side !== 'Sell'), sh = g.rows.filter(t => t.side === 'Sell'); return { g, n: g.rows.length, lo, sh }; });
  const title = L('การกระจาย Long / Short', 'Long / Short distribution');
  if (!rows.length) return panel(title, emptyChart(L('ยังไม่มีเทรดที่ปิดแล้ว', 'No closed trades yet')), '', 'ls-card');
  const maxN = Math.max(1, ...rows.map(r => r.n));
  const lab = g => { const ins = dim === 'instrument' && state.instruments.find(x => x.symbol === g.key); return ins ? `${insIcon(ins)}<span>${esc(g.label)}</span>` : `<span>${esc(g.label)}</span>`; };
  const part = (rs, name) => { if (!rs.length) return `${name} 0`; const st = stats(rs); return `${name} ${rs.length} · ${L('อัตราชนะ', 'Win rate')} ${fmt(st.wr, 0)}% · ${unitFmt(st.total)}`; };
  const body = `<div class="mcard lsd">${`<div class="mc-row mc-h"><span class="mc-hl">${esc(dimLabel(dim))}</span><span class="mc-hl">${L('เทรด', 'Trades')}</span><span class="mc-hl lsd-hs"><span>Short</span><span>Long</span></span></div>`}${rows.map(({ g, n, lo, sh }) => {
    const ps = sh.length / n * 100, pl = 100 - ps;
    return `<div class="mc-row" data-tip="${esc(`${g.label}\n${part(lo, 'Long')}\n${part(sh, 'Short')}`)}"><span class="mc-l">${lab(g)}</span><span class="mc-c"><span class="mc-v"><em>${n}</em></span><span class="mx-t"><i class="acc" style="left:0;width:${(n / maxN * 100).toFixed(1)}%"></i></span></span><span class="mc-c"><span class="mc-v"><em class="neg">${sh.length} · ${fmt(ps, 0)}%</em><em class="pos">${fmt(pl, 0)}% · ${lo.length}</em></span><span class="mx-split"><i class="neg" style="width:${ps.toFixed(1)}%"></i><i class="pos" style="width:${pl.toFixed(1)}%"></i></span></span></div>`; }).join('')}</div>`;
  const tl = sum(rows.map(r => r.lo.length)), ts = sum(rows.map(r => r.sh.length));
  return panel(title, body, '', 'ls-card', `Long ${tl} · Short ${ts}`);
}
/* ---------- one dimension, every group, several views ---------- */
/* v3.24 — every Insights sub-tab shows exactly one chart (+ the summary table) */
function insightsView(rows, tab) {
  const valid = t => INS_TABS().some(x => x[0] === t);
  if (valid(tab) && tab !== ui.insTab) { ui.insTab = tab; savePrefs(); }
  tab = valid(tab) ? tab : valid(ui.insTab) ? ui.insTab : 'playbook';
  const nav = `<div class="subtabs mb16">${seg(INS_TABS(), tab, 'ins-tab')}</div>`;
  if (tab === 'r') return nav + rMultipleView(rows) + crossSection(rows, 'rbin', 'r');
  if (tab === 'tags') {
    const cats = state.tagCategories.filter(c => state.tags.some(t => t.categoryId === c.id));
    if (ui.insTagCat !== 'timeframe' && !cats.some(c => c.id === ui.insTagCat)) ui.insTagCat = '';
    const sub = `<div class="subtabs sub2 mb16">${seg([['', L('ทั้งหมด', 'All')], ...cats.map(c => [c.id, esc(catName(c))]), ['timeframe', L('ไทม์เฟรม', 'Timeframe')]], ui.insTagCat || '', 'ins-tagcat')}</div>`;
    const d = ui.insTagCat === 'timeframe' ? 'timeframe' : ui.insTagCat ? 'tagcat:' + ui.insTagCat : 'tag';
    return nav + sub + oneChartView(rows, d) + crossSection(rows, d, 'tags:' + d);
  }
  if (tab === 'session') { const by = ui.insSessBy === 'hour' ? 'hour' : 'session'; return nav + oneChartView(rows, by) + crossSection(rows, by, 'session:' + by); }
  return nav + oneChartView(rows, tab) + crossSection(rows, tab, tab);
}
const DRILL_COLORS = ['#334BFF', '#00C389', '#FFDE66', '#EA2E6C', '#3BBAFF', '#FF9666', '#9064CD', '#198C8C']; // Halo data-viz palette
/* horizontal bars as HTML rows, so instruments can carry their icon */
function iconBars(gs, mk) {
  const vals = gs.map(g => metricVal(g.s, mk) ?? 0), max = Math.max(EPS, ...vals.map(Math.abs)), signed = !['wr', 'n'].includes(mk), hasNeg = signed && vals.some(v => v < 0);
  if (!gs.length) return emptyChart(L('ไม่มีกลุ่มที่มีเทรดเพียงพอ', 'No group has enough trades'));
  return `<div class="ibars ${hasNeg ? 'neg-axis' : ''}">${gs.map((g, i) => { const v = vals[i], w = Math.abs(v) / max * (hasNeg ? 50 : 100), cls = !signed ? 'acc' : v >= 0 ? 'pos' : 'neg', insId = state.instruments.find(x => x.symbol === g.key)?.id;
    return `<div class="ibar" data-action="drill" data-dim="instrument" data-key="${esc(g.key)}" data-tip="${esc(`${g.label}\n${g.s.n} ${L('เทรด', 'trades')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(g.s.wr, 0)}% · ${unitFmt(g.s.total)}`)}"><span class="ib-l">${insId ? insIcon(get('instruments', insId)) : ''}<b>${esc(g.label)}</b></span><span class="ib-t"><i class="${cls}" style="width:${w.toFixed(1)}%;${hasNeg ? (v >= 0 ? 'left:50%' : `left:${(50 - w).toFixed(1)}%`) : 'left:0'}"></i></span><span class="ib-v ${signed ? tone(v) : ''}">${metricFmt(mk, v)}</span></div>`; }).join('')}</div>`;
}
const metricPick = mk => `<select class="tsel sm metric-pick" data-ui="breakdownMetric" aria-label="${L('ตัวชี้วัด', 'Metric')}">${METRICS().map(([k, l]) => opt(k, l, mk)).join('')}</select>`;
/* best / lowest expectancy, most profitable / lowest total — only groups with a meaningful sample */
function groupTiles(all, MIN = 5, dim = '') {
  let valid = all.filter(g => g.s.n >= 10); if (valid.length < 2) valid = all.filter(g => g.s.n >= MIN);
  if (valid.length < 2) return `<div class="notice info mb16">${icon('info')}<span>${L(`ต้องมีอย่างน้อย 2 กลุ่มที่มีตั้งแต่ ${MIN} เทรด จึงจะสรุปกลุ่มที่ดี/แย่ที่สุดได้`, `Need 2+ groups with ${MIN}+ trades to rank groups`)}</span></div>`;
  const by = k => valid.slice().sort((a, b) => (b.s[k] ?? -1e9) - (a.s[k] ?? -1e9)), lowE = by('expectancy').at(-1), lowT = by('total').at(-1);
  const tiles = [[L('คาดหวังดีที่สุด', 'Best expectancy'), by('expectancy')[0], 'expectancy'], [(lowE.s.expectancy ?? 0) < 0 ? L('คาดหวังติดลบมากที่สุด', 'Most negative expectancy') : L('คาดหวังต่ำสุด', 'Lowest expectancy'), lowE, 'expectancy'], [L('ทำเงินมากที่สุด', 'Most profitable'), by('total')[0], 'total'], [(lowT.s.total ?? 0) < 0 ? L('ขาดทุนมากที่สุด', 'Biggest loss') : L('ผลรวมต่ำสุด', 'Lowest total'), lowT, 'total']];
  const lab = g => { const ins = dim === 'instrument' && state.instruments.find(x => x.symbol === g.key); return ins ? `<span class="mc-ins">${insIcon(ins)}<span>${esc(g.label)}</span></span>` : esc(g.label); };
  return miniRow(tiles.map(([l, g, k]) => miniCard(l, lab(g), `<span class="${tone(g.s[k])}">${metricFmt(k, g.s[k])}</span> · ${g.s.n} ${L('เทรด', 'trades')}`, sparkline(cumVals(g.rows)))));
}
function oneChartView(rows, dim) { return U('rep-break', () => oneChartViewU(rows, dim)).replace('data-chart-unit="rep-break"', 'data-chart-unit="rep-break"'); }
function oneChartViewU(rows, dim) {
  const mk = ui.breakdownMetric || 'expectancy', all = group(rows, dim), MIN = 5;
  const shown = all; // v3.79: the "Hide groups under 5 trades" switch is gone — every group shows
  const ordered = ORDERED_DIMS.includes(dim) || dim === 'timeframe', gs = ordered ? shown : shown.slice().sort((a, b) => (b.s[mk] ?? -1e9) - (a.s[mk] ?? -1e9));
  const sessBy = dim === 'session' || dim === 'hour' ? `<div class="row gap8 small"><span class="dim">${L('จัดกลุ่มตาม', 'Group by')}</span>${seg([['session', L('เซสชัน', 'Session')], ['hour', L('ชั่วโมงที่เข้า', 'Entry hour')]], dim, 'ins-sess-by')}</div>` : '';
  const ctrl = `<div class="filterbar ins-bar">${sessBy}</div>`;
  return ctrl + groupTiles(all, MIN, dim) + `<div class="ins-charts mb16">${chartOne(rows, gs, dim)}${metricBarCard(shown, dim, ordered)}</div>` + panel(L('ตารางสรุป · ', 'Summary · ') + dimLabel(dim), breakdownTable(gs, dim), '', 'flush');
}
/* ---------- v3.64 — Insight chart pair: Chart 1 (left) | Chart 2 (right), sized to fit a 1080p screen ----------
   Chart 1 — Donut (Strategy · Instrument · Custom) · Bar of trade count (Weekday · Sessions) · Scatter (Trade hour · Duration) · Histogram (R-Multiple)
   Chart 2 — Bar of the selected metric for every group */
const INS_CH = 360;
const DONUT_DIMS = d => ['playbook', 'instrument', 'tag', 'timeframe', 'mistake', 'context', 'setup'].includes(d) || String(d).startsWith('tagcat:');
const noUnitTools = html => html.replace('<div class="panel-tools">', '<div class="panel-tools" data-nounit>');
const insLab = (dim, g) => { const ins = dim === 'instrument' && state.instruments.find(x => x.symbol === g.key); return ins ? `${insIcon(ins)}<span>${esc(g.label)}</span>` : `<span>${esc(g.label)}</span>`; };
function chartOne(rows, gs, dim) {
  if (dim === 'hour' || dim === 'session') return chartPanel(L('เวลาเข้า × ผลลัพธ์', 'Entry time × result'), sessionScatter(rows), '', 'ins-c1', L(`Scatter · แต่ละจุด = 1 เทรด ตามเวลาเข้า (${tz()}) · แถบด้านบนคือช่วงเวลาของแต่ละเซสชัน`, `Scatter · each dot = one trade by entry time (${tz()}) · bars on top show each session`));
  if (dim === 'duration') return chartPanel(L('ระยะเวลาถือ × ผลลัพธ์', 'Duration × result'), durationScatter(rows), '', 'ins-c1', L('Scatter · แต่ละจุด = 1 เทรด · แกนนอนแบบลอการิทึม', 'Scatter · each dot = one trade · log time axis'));
  const tot = sum(gs.map(g => g.s.n)), title = L('สัดส่วนจำนวนเทรด', 'Share of trades') + ' · ' + dimLabel(dim);
  if (!DONUT_DIMS(dim)) {
    const data = gs.map(g => ({ x: g.key, label: g.label, tip: g.label, y: g.s.n, sub: tot ? fmt(g.s.n / tot * 100, 0) + '%' : '' }));
    return noUnitTools(chartPanel(L('จำนวนเทรด', 'Trades') + ' · ' + dimLabel(dim), chartBox({ type: 'bar', categorical: true, signed: false, valueLabels: true, data, unit: 'count', tipFmt: v => fmt(v, 0) + L(' เทรด', ' trades'), valueFmt: v => fmt(v, 0), empty: L('ยังไม่มีเทรดที่ปิดแล้ว', 'No closed trades yet') }, INS_CH), '', 'ins-c1', L('Bar · จำนวนเทรดในแต่ละกลุ่ม', 'Bar · trades in each group')));
  }
  if (!tot) return noUnitTools(panel(title, emptyChart(L('ยังไม่มีเทรดที่ปิดแล้ว', 'No closed trades yet')), '', 'ins-c1'));
  const by = gs.slice().sort((a, b) => b.s.n - a.s.n), MAXP = 8, top = by.length > MAXP ? by.slice(0, MAXP - 1) : by, rest = by.slice(top.length);
  const parts = top.map((g, i) => ({ g, i, name: g.label, v: g.s.n, color: DRILL_COLORS[i % DRILL_COLORS.length], label: `${g.label} · ${g.s.n} (${fmt(g.s.n / tot * 100, 0)}%)` }));
  if (rest.length) { const n = sum(rest.map(g => g.s.n)); parts.push({ g: null, i: parts.length, name: L('อื่น ๆ', 'Other'), v: n, color: 'var(--dim)', label: `${L('อื่น ๆ', 'Other')} (${rest.length}) · ${n} (${fmt(n / tot * 100, 0)}%)` }); }
  const leg = parts.map(p => `<div class="dn-row" data-dn="${p.i}" ${p.g ? `data-action="drill" data-dim="${esc(dim)}" data-key="${esc(p.g.key)}"` : ''} data-tip="${esc(p.g ? `${p.g.label}\n${p.g.s.n} ${L('เทรด', 'trades')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(p.g.s.wr, 0)}% · ${unitFmt(p.g.s.total)}` : p.label)}"><i style="background:${p.color}"></i><span class="dn-l">${p.g ? insLab(dim, p.g) : `<span>${L('อื่น ๆ', 'Other')} (${rest.length})</span>`}</span><b>${fmt(p.v, 0)}</b><em>${fmt(p.v / tot * 100, 0)}%</em></div>`).join('');
  const body = `<div class="ins-donut"><div class="dn-fig">${donut(parts, 236, 30)}<div class="dn-c" data-tot="${fmt(tot, 0)}" data-unit="${L('เทรด', 'trades')}"><b>${fmt(tot, 0)}</b><span>${L('เทรด', 'trades')}</span></div></div><div class="dn-leg">${leg}</div></div>`;
  return noUnitTools(chartPanel(title, body, '', 'ins-c1', L('Donut · คลิกรายการเพื่อดูเทรดในกลุ่มนั้น', 'Donut · click an item to see its trades')));
}
const HBAR_DIMS = d => ['playbook', 'duration', 'tag', 'timeframe', 'mistake', 'context', 'setup'].includes(d) || String(d).startsWith('tagcat:');
/* Chart 2 has its own metric (P&L by default) */
const barMetric = () => METRICS().some(m => m[0] === ui.insBarMetric) ? ui.insBarMetric : 'total';
function metricBarCard(groups, dim, ordered = false) {
  const mk = barMetric(), signed = mk === 'total' || mk === 'expectancy', ml = mk === 'total' ? (ui.unit === 'P&L' ? 'P&L' : `${L('ผลรวม', 'Total')} (${ui.unit})`) : METRICS().find(m => m[0] === mk)?.[1] || mk, hb = HBAR_DIMS(dim);
  let gs = groups.filter(g => finite(metricVal(g.s, mk))); if (!ordered) gs = gs.slice().sort((a, b) => metricVal(b.s, mk) - metricVal(a.s, mk));
  const data = gs.map(g => { const ins = dim === 'instrument' && state.instruments.find(x => x.symbol === g.key); return { x: g.key, label: g.label, tip: g.label, y: metricVal(g.s, mk), sub: `${g.s.n} ${L('เทรด', 'trades')}`, ...(ins && !hb ? { icon: insIcon(ins) } : {}) }; });
  const vf = v => signed ? compactUnit(v) : mk === 'wr' ? fmt(v, 0) + '%' : fmt(v, 0);
  const spec = { type: hb ? 'hbar' : 'bar', categorical: true, signed, valueLabels: true, data, unit: signed ? ui.unit : mk === 'wr' ? '%' : 'count', tipFmt: v => metricFmt(mk, v), valueFmt: vf, empty: L('ไม่มีกลุ่มที่มีเทรดเพียงพอ', 'No group has enough trades') };
  const pick = `<select class="tsel sm metric-pick bar-pick" data-ui="insBarMetric" aria-label="${L('ตัวชี้วัดของกราฟ', 'Chart metric')}">${[['total', L('ผลรวม', 'Total')], ...METRICS().filter(m => m[0] !== 'total')].map(([k, l]) => opt(k, l, mk)).join('')}</select>`;
  return chartPanel(ml + ' · ' + dimLabel(dim), chartBox(spec, INS_CH), pick, 'ins-c2', (hb ? L('แท่งแนวนอน', 'Horizontal bar') : 'Bar') + ' · ' + (ordered ? L('เรียงตามลำดับของกลุ่ม', 'in natural order') : L('เรียงจากมากไปน้อย', 'highest first')));
}
/* v3.55 — one card, four bar columns per group (Total · Win rate % · Expectancy · Trades), rows aligned; click a header to sort */
const MC_COLS = () => [['total', L('ผลรวม', 'Total')], ['wr', L('อัตราชนะ %', 'Win rate %')], ['expectancy', L('ค่าคาดหวัง', 'Expectancy')], ['n', L('เทรด', 'Trades')]];
function metricsCard(gs, dim, mk, ordered = false) {
  const title = dimLabel(dim);
  if (!gs.length) return panel(title, emptyChart(L('ไม่มีกลุ่มที่มีเทรดเพียงพอ', 'No group has enough trades')), '', 'mc-card');
  const cols = MC_COLS().map(([k, l]) => { const v = gs.map(g => metricVal(g.s, k)), f = v.filter(finite), signed = k === 'total' || k === 'expectancy';
    const hiP = Math.max(0, ...f), loN = Math.max(0, ...f.map(x => -x)), span = k === 'wr' ? 100 : signed ? (hiP + loN) || 1 : Math.max(EPS, ...f), zero = signed ? loN / span * 100 : 0;
    return { k, l, v, signed, span, zero }; });
  const lab = g => { const ins = dim === 'instrument' && state.instruments.find(x => x.symbol === g.key); return ins ? `${insIcon(ins)}<span>${esc(g.label)}</span>` : `<span>${esc(g.label)}</span>`; };
  const fmtV = (k, v) => k === 'total' || k === 'expectancy' ? compactUnit(v) : metricFmt(k, v);
  const cell = (c, v) => { if (!finite(v)) return `<span class="mc-c"><span class="mc-v"><em class="dim">—</em></span><span class="mx-t"></span></span>`;
    if (c.k === 'wr') { const w = clamp(v, 0, 100); return `<span class="mc-c"><span class="mc-v"><em class="neg">${fmt(100 - w, 0)}%</em><em class="pos">${fmt(w, 0)}%</em></span><span class="mx-split"><i class="neg" style="width:${(100 - w).toFixed(1)}%"></i><i class="pos" style="width:${w.toFixed(1)}%"></i></span></span>`; }
    const w = Math.abs(v) / c.span * 100, cls = c.k === 'n' ? 'acc' : v >= 0 ? 'pos' : 'neg', left = c.signed ? (v >= 0 ? c.zero : c.zero - w) : 0;
    return `<span class="mc-c"><span class="mc-v"><em class="${c.k === 'n' ? '' : tone(v)}">${fmtV(c.k, v)}</em></span><span class="mx-t">${c.signed && c.zero > 0 ? `<b class="mc-z" style="left:${c.zero.toFixed(1)}%"></b>` : ''}<i class="${cls}" style="left:${left.toFixed(1)}%;width:${Math.max(.8, w).toFixed(1)}%"></i></span></span>`; };
  const head = `<div class="mc-row mc-h"><span class="mc-hl">${esc(title)}</span>${cols.map(c => `<button type="button" class="mc-hb ${!ordered && c.k === mk ? 'on' : ''}" data-action="bd-sort" data-k="${c.k}" ${ordered ? 'disabled' : ''}>${esc(c.l)}${!ordered && c.k === mk ? icon('chev-down', 'tiny') : ''}</button>`).join('')}</div>`;
  const body = `<div class="mcard">${head}${gs.map((g, i) => `<div class="mc-row" data-action="drill" data-dim="${esc(dim)}" data-key="${esc(g.key)}" data-tip="${esc(`${g.label}\n${g.s.n} ${L('เทรด', 'trades')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(g.s.wr, 0)}% · ${unitFmt(g.s.total)}`)}"><span class="mc-l">${lab(g)}</span>${cols.map(c => cell(c, c.v[i])).join('')}</div>`).join('')}</div>`;
  return panel(title, body, '', 'mc-card', ordered ? L('เรียงตามลำดับของกลุ่ม', 'In natural order') : `${L('เรียงตาม', 'Sorted by')} ${esc(MC_COLS().find(c => c[0] === mk)?.[1] || '')} · ${L('คลิกหัวคอลัมน์เพื่อเรียง', 'click a header to sort')}`);
}
function breakdownTable(gs, dim) {
  return `<div class="tablewrap"><table><thead><tr><th>${dimLabel(dim)}</th><th class="num">${gl(L('เทรด', 'Trades'))}</th><th class="num">${gl(L('อัตราชนะ %', 'Win rate %'))}</th><th class="num">${gl(L('ค่าคาดหวัง', 'Expectancy'))}</th><th class="num">${gl(L('ผลรวม', 'Total'))}</th><th class="num">${gl('Profit factor')}</th><th class="num">${gl(L('กำไรเฉลี่ย', 'Average profit'))}</th><th class="num">${gl(L('ขาดทุนเฉลี่ย', 'Average loss'))}</th><th class="num">${gl(L('R-Multiple เฉลี่ย', 'Average R-Multiple'))}</th><th class="num">${gl(L('ระยะเวลาถือเฉลี่ย', 'Average duration'))}</th></tr></thead><tbody>${gs.map(g => `<tr class="click" data-action="drill" data-dim="${dim}" data-key="${esc(g.key)}"><td>${dim === 'instrument' ? symbolCell(state.instruments.find(i => i.symbol === g.key)?.id) : esc(g.label)}${g.s.n < 5 ? ` <span class="badge" title="${L('ตัวอย่างน้อย', 'low sample')}">n&lt;5</span>` : ''}</td><td class="num">${g.s.n}</td><td class="num">${fmt(g.s.wr, 1)}%</td><td class="num"><strong class="${tone(g.s.expectancy)}">${unitFmt(g.s.expectancy)}</strong></td><td class="num ${tone(g.s.total)}">${unitFmt(g.s.total)}</td><td class="num">${fmt(g.s.pfU, 2)}</td><td class="num pos">${unitFmt(g.s.avgWinU, ui.unit, false)}</td><td class="num neg">${unitFmt(g.s.avgLossU)}</td><td class="num">${finite(g.s.avgR) ? fmt(g.s.avgR, 2, true) + 'R' : '—'}</td><td class="num">${duration(g.s.duration)}</td></tr>`).join('') || `<tr><td colspan="10">${empty(L('ไม่มีกลุ่มที่มีเทรดเพียงพอ', 'No group has enough trades'), L('ปิดสวิตช์ "ซ่อนกลุ่มที่มีน้อยกว่า 5 เทรด" เพื่อดูทั้งหมด', 'Turn off the small-group filter to see all'))}</td></tr>`}</tbody></table></div>`;
}
function crossMatrix(rows, x, y, mk, minN = 0) {
  let xg = group(rows, x), yg = group(rows, y); if (minN) { xg = xg.filter(g => g.s.n >= minN); yg = yg.filter(g => g.s.n >= minN); }
  if (!xg.length || !yg.length) return empty(L('ไม่มีข้อมูลเพียงพอ', 'Not enough data'));
  const cells = xg.map(a => { const ids = new Set(a.rows.map(t => t.id)); return yg.map(b => { const rs = b.rows.filter(t => ids.has(t.id)); return rs.length ? { s: stats(rs), n: rs.length } : null; }); });
  const vals = cells.flat().filter(Boolean).map(c => c.s[mk]).filter(finite), max = Math.max(EPS, ...vals.map(Math.abs)), mid = mk === 'wr' ? 50 : 0;
  const fill = v => mk === 'n' ? heatFill(v, max, 0, true) : heatFill(v, mk === 'wr' ? 50 : max, mid), color = v => fill(v)[0];
  const lab = (dim, g, col) => { if (dim !== 'instrument') return esc(g.label); const ins = state.instruments.find(i => i.symbol === g.key); return ins ? `<span class="xlab ${col ? 'col' : ''}">${insIcon(ins)}<span>${esc(g.label)}</span></span>` : esc(g.label); };
  return `<div class="tablewrap"><table class="heat"><thead><tr><th></th>${yg.map(b => `<th>${lab(y, b, true)}</th>`).join('')}</tr></thead><tbody>${xg.map((a, i) => `<tr><th>${lab(x, a)}</th>${cells[i].map((c, j) => c ? `<td class="${fill(c.s[mk])[1] ? 'hc-hi' : ''}" style="background:${color(c.s[mk])};${c.n < 5 ? 'opacity:.55' : ''}" data-tip="${esc(`${a.label} × ${yg[j].label}\n${c.n} ${L('เทรด', 'trades')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(c.s.wr, 0)}% · ${unitFmt(c.s.total)}${c.n < 5 ? ' · ' + L('ตัวอย่างน้อย', 'low sample') : ''}`)}">${metricFmt(mk, c.s[mk])}<small style="display:block;font-weight:500;color:var(--dim);font-size:10px">${c.n}</small></td>` : '<td class="dim">·</td>').join('')}</tr>`).join('')}</tbody></table></div>`;
}
/* Cross Analysis (moved from Insights in v3.21) — two dimensions on the globally filtered trades */
function crossSection(rows, rowDim = '', tabKey = '') {
  const dims = breakdownDims(rows), mk = ui.crossMetric || 'expectancy', MIN = 5;
  if (rowDim && !dims.some(d => d[0] === rowDim)) dims.unshift([rowDim, dimLabel(rowDim)]);
  const keys = dims.map(d => d[0]);
  // v3.54: shown under every Insights tab — Rows start as that tab's breakdown, a change sticks while you stay on the tab
  if (tabKey && ui.crossXFor !== tabKey) { ui.crossX = keys.includes(rowDim) ? rowDim : ui.crossX; ui.crossXFor = tabKey; }
  if (!keys.includes(ui.crossX)) ui.crossX = keys.includes('playbook') ? 'playbook' : keys[0];
  if (!keys.includes(ui.crossY) || ui.crossY === ui.crossX) ui.crossY = keys.find(k => k !== ui.crossX && k === 'weekday') || keys.find(k => k !== ui.crossX);
  const ctrl = `<div class="filterbar"><label class="small muted">${L('แถว', 'Rows')}</label><select class="tsel" data-ui="crossX" style="max-width:200px">${dims.map(([k, l]) => opt(k, l, ui.crossX)).join('')}</select><label class="small muted">× ${L('คอลัมน์', 'Columns')}</label><select class="tsel" data-ui="crossY" style="max-width:200px">${dims.filter(d => d[0] !== ui.crossX).map(([k, l]) => opt(k, l, ui.crossY)).join('')}</select><label class="small muted">${L('ตัวชี้วัด', 'Metric')}</label>${seg(METRICS(), mk, 'cross-metric')}</div>`;
  return `<div class="sec mt24 mb8" id="cross"><span class="ul-tip" data-tip="${esc(L('ดูผลแบบไขว้ 2 มิติ จากเทรดทั้งหมดตามตัวกรองด้านบนของแอป (ไม่ใช่กลุ่ม A/B)', 'Two dimensions at once, using all trades in the app-wide filter (not groups A/B)'))}">${L('วิเคราะห์ไขว้', 'Cross Analysis')}</span></div>` + ctrl
    + chartPanel(`${dimLabel(ui.crossX)} × ${dimLabel(ui.crossY)}`, crossMatrix(rows, ui.crossX, ui.crossY, mk, 0), '', 'flush', L('ตัวเลขเล็ก = จำนวนเทรดในช่อง · ช่องที่มีน้อยกว่า 5 เทรดแสดงจาง ๆ', 'Small number = trades in the cell · cells under 5 trades are faded'));
}
function compareFilterForm(key) {
  const f = ui[key] || {};
  const sel = (k, list, l) => `<div class="field"><label>${l}</label><select data-cmp="${key}" data-k="${k}">${list}</select></div>`;
  return `<div class="formgrid">${sel('playbookId', entityOptions('playbooks', f.playbookId, L('ทั้งหมด', 'All')), L('กลยุทธ์', 'Strategy'))}${sel('instrumentId', entityOptions('instruments', f.instrumentId, L('ทั้งหมด', 'All'), i => state.trades.some(t => t.instrumentId === i.id)), L('สินทรัพย์', 'Instrument'))}${sel('side', options([['Buy', 'Long'], ['Sell', 'Short']], f.side, L('ทั้งหมด', 'All')), L('ทิศทาง', 'Side'))}${sel('session', options(['Asia', 'London', 'London–NY', 'New York', 'After hours'].map(s => [s, sessionLabel(s)]), f.session, L('ทั้งหมด', 'All')), L('เซสชัน', 'Session'))}${sel('weekday', options([1, 2, 3, 4, 5, 6, 0].map(d => [d, dayName(d, true)]), f.weekday, L('ทั้งหมด', 'All')), L('วัน', 'Weekday'))}${sel('mistakes', options([['none', L('ไม่มีความผิดพลาด', 'No mistakes')], ['any', L('มีความผิดพลาด', 'With mistakes')]], f.mistakes, L('ทั้งหมด', 'All')), L('ความผิดพลาด', 'Mistakes'))}${sel('accountId', entityOptions('accounts', f.account, L('ทั้งหมด', 'All')), L('บัญชี', 'Account')).replace('data-k="accountId"', 'data-k="account"')}<div class="field"><label>${L('ช่วงวันที่', 'Dates')}</label><div class="row gap4"><input type="date" data-cmp="${key}" data-k="from" value="${esc(f.from || '')}"><input type="date" data-cmp="${key}" data-k="to" value="${esc(f.to || '')}"></div></div></div>`;
}
function compareView() {
  const a = filterTrades(state.trades, ui.compareA || {}), b = filterTrades(state.trades, ui.compareB || {}), sa = stats(a), sb = stats(b), u = ui.unit;
  const row = (l, k, f = v => unitFmt(v), better = 'high') => { const va = sa[k], vb = sb[k], d = finite(va) && finite(vb) ? va - vb : null, win = d == null || Math.abs(d) < EPS ? '' : (better === 'high' ? d > 0 : d < 0) ? 'a' : 'b'; return `<tr><td>${gl(l)}</td><td class="num ${win === 'a' ? 'b pos' : ''}">${f(va)}</td><td class="num ${win === 'b' ? 'b pos' : ''}">${f(vb)}</td><td class="num dim">${d == null ? '—' : f(d).replace(/^([^−+-])/, d > 0 ? '+$1' : '$1')}</td></tr>`; };
  const pct = v => finite(v) ? fmt(v, 1) + '%' : '—', n2 = v => fmt(v, 2), n0 = v => fmt(v, 0), r = v => finite(v) ? fmt(v, 2, true) + 'R' : '—';
  const ca = cumulativeSeries(a).map((p, i) => ({ x: i + 1, y: p.y, tip: L('เทรดที่ ', 'Trade ') + (i + 1) })), cb = cumulativeSeries(b).map((p, i) => ({ x: i + 1, y: p.y, tip: L('เทรดที่ ', 'Trade ') + (i + 1) }));
  const n = Math.max(ca.length, cb.length), pad = arr => arr.concat(Array.from({ length: n - arr.length }, () => null)).map((p, i) => p || null);
  return `<div class="grid g2 mb16">${panel(`<span class="badge" style="background:var(--accent);color:#fff;border:0">A</span> ${L('กลุ่ม A', 'Group A')}`, compareFilterForm('compareA'), `<span class="small dim">${a.length} ${L('เทรด', 'trades')}</span>`)}${panel(`<span class="badge" style="background:var(--warn);color:#111;border:0">B</span> ${L('กลุ่ม B', 'Group B')}`, compareFilterForm('compareB'), `<span class="small dim">${b.length} ${L('เทรด', 'trades')}</span>`)}</div>`
    + `<div class="grid g2 cmp-grid">${panel(L('ตัวชี้วัด', 'Metrics'), `<div class="tablewrap"><table><thead><tr><th></th><th class="num">A</th><th class="num">B</th><th class="num">A − B</th></tr></thead><tbody>${row(L('ผลรวม', 'Total'), 'total')}${row(L('เทรด', 'Trades'), 'n', n0)}${row(L('อัตราชนะ', 'Win rate'), 'wr', pct)}${row('Profit factor', 'pfU', n2)}${row(L('ค่าคาดหวัง', 'Expectancy'), 'expectancy')}${row(L('R-Multiple เฉลี่ย', 'Average R-Multiple'), 'avgR', r)}${row(L('กำไรเฉลี่ย', 'Average profit'), 'avgWinU')}${row(L('ขาดทุนเฉลี่ย', 'Average loss'), 'avgLossU')}${row('Payoff ratio', 'payU', n2)}${row(L('Drawdown สูงสุด', 'Max drawdown'), 'ddU', v => unitFmt(v), 'high')}${row(L('ระยะเวลาถือเฉลี่ย (นาที)', 'Average duration (min)'), 'duration', n0, 'low')}</tbody></table></div>`, '', 'flush')}${compareChart(a, b, u)}</div>`; // v3.54: Cross Analysis now lives under each Insights tab
}
/* v3.75 — Compare chart: fills the card, metric picker (running value by trade #) */
const CMP_METRICS = () => [['cum', L('ผลสะสม', 'Cumulative P&L')], ['r', L('R สะสม', 'Cumulative R')], ['wr', L('อัตราชนะ', 'Win rate')], ['exp', L('ค่าคาดหวัง', 'Expectancy')], ['pf', 'Profit factor'], ['dd', 'Drawdown']];
function compareSeries(rows, m, u) {
  const cs = closedSorted(rows).filter(t => finite(value(t, u))); let cum = 0, cumR = 0, w = 0, gw = 0, gl2 = 0, peak = 0; const out = [];
  cs.forEach((t, i) => { const v = value(t, u), r = calc(t).r; cum += v; if (finite(r)) cumR += r; if (v > EPS) { w++; gw += v; } else if (v < -EPS) gl2 -= v; peak = Math.max(peak, cum);
    const y = m === 'r' ? cumR : m === 'wr' ? w / (i + 1) * 100 : m === 'exp' ? cum / (i + 1) : m === 'pf' ? (gl2 > EPS ? gw / gl2 : null) : m === 'dd' ? cum - peak : cum;
    if (finite(y)) out.push({ x: i + 1, y, tip: L('เทรดที่ ', 'Trade ') + (i + 1) }); });
  return out;
}
function compareChart(a, b, u) {
  const m = CMP_METRICS().some(x => x[0] === ui.cmpMetric) ? ui.cmpMetric : 'cum', unit = m === 'r' ? 'R' : m === 'wr' ? 'pct' : m === 'pf' ? 'x' : u;
  const fmtV = v => m === 'wr' ? fmt(v, 1) + '%' : m === 'pf' ? fmt(v, 2) : m === 'r' ? fmt(v, 2, true) + 'R' : unitFmt(v, u);
  const series = [{ name: 'A', data: compareSeries(a, m, u), color: 'var(--accent)' }, { name: 'B', data: compareSeries(b, m, u), color: 'var(--warn)' }].filter(s => s.data.length);
  const pick = `<select class="tsel cmp-metric" data-ui="cmpMetric" aria-label="${L('ตัวชี้วัด', 'Metric')}">${CMP_METRICS().map(([k, l]) => opt(k, l, m)).join('')}</select>`;
  return panel(L('เทียบตามลำดับเทรด', 'By trade #'), chartBox({ type: 'line', series, unit, tipFmt: fmtV, yTitle: m === 'wr' ? L('อัตราชนะ %', 'Win rate %') : m === 'pf' ? 'Profit factor' : undefined }, 540), pick, 'cmp-chart');
}
function psychologyView(rows) {
  const u = ui.unit, closed = closedSorted(rows), s = stats(rows);
  const emo = group(rows, 'emotion').filter(g => g.key !== '—'), mist = group(rows, 'mistake'), rat = group(rows, 'rating').filter(g => g.key !== '—');
  const mistOnly = mist.filter(g => g.key !== L('ไม่มีความผิดพลาด', 'No mistake')), clean = closed.filter(t => !(t.tags || []).some(isMistakeTag)), dirty = closed.filter(t => (t.tags || []).some(isMistakeTag)), cs = stats(clean), ds = stats(dirty);
  // after-loss behaviour (tilt)
  const after = { win: [], loss: [] }; for (let i = 1; i < closed.length; i++) { const p = calc(closed[i - 1]).net, same = tradeDay(closed[i - 1]) === tradeDay(closed[i]); if (!same) continue; (p > EPS ? after.win : p < -EPS ? after.loss : []).push(closed[i]); }
  const aw = stats(after.win), al = stats(after.loss);
  const quick = closed.filter((t, i) => { if (!i) return false; const prev = closed[i - 1]; return calc(prev).net < -EPS && (new Date(t.entryDateTime) - new Date(prev.exitDateTime)) / 60000 < 15 && new Date(t.entryDateTime) >= new Date(prev.exitDateTime); });
  const qs = stats(quick);
  const days = [...new Set(closed.map(t => tradeDay(t)))].sort().slice(-60), disc = days.map(d => ({ d, x: dayDiscipline(d) }));
  const cleanDays = disc.filter(x => !x.x.issues.length).length;
  const jr = journalNotes().filter(j => j.mood > 0 && (!ui.from || j.date >= ui.from) && (!ui.to || j.date <= ui.to));
  const moodG = [1, 2, 3, 4, 5].map(m => { const ds2 = new Set(jr.filter(j => j.mood === m).map(j => j.date)); const rs = closed.filter(t => ds2.has(tradeDay(t))); return { label: MOOD_EMOJI[m - 1] + ' ' + MOOD_LABELS()[m - 1], y: stats(rs).expectancy ?? 0, n: rs.length }; }).filter(x => x.n);
  return miniRow([
    miniCard(L('ผลรวมของเทรดที่มีความผิดพลาด', 'Result of trades with mistakes'), `<span class="${tone(ds.total)}">${unitFmt(ds.total)}</span>`, `${dirty.length} ${L('เทรด', 'trades')} (${fmt(dirty.length / Math.max(1, s.n) * 100, 0)}%)`, sparkline(cumVals(dirty))),
    miniCard(L('ถ้าไม่มีความผิดพลาด', 'Without mistakes'), `<span class="${tone(cs.total)}">${unitFmt(cs.total)}</span>`, `${L('อัตราชนะ', 'Win rate')} ${fmt(cs.wr, 0)}% · PF ${fmt(cs.pfU, 2)}`, sparkline(cumVals(clean))),
    miniCard(L('วันที่ไม่ผิดกฎ', 'Clean days'), `${cleanDays}/${disc.length}`, L('60 วันเทรดล่าสุด', 'last 60 trading days'), pctViz(disc.length ? cleanDays / disc.length * 100 : 0, 'pos')),
    miniCard(L('เทรดหลังแพ้ภายใน 15 นาที', 'Re-entry < 15m after loss'), quick.length, quick.length ? `${L('อัตราชนะ', 'Win rate')} ${fmt(qs.wr, 0)}% · ${unitFmt(qs.total)}` : '', wlGauge(qs.wins || 0, qs.be || 0, qs.losses || 0)),
    miniCard(L('ผลหลังไม้ที่แพ้ (วันเดียวกัน)', 'After a loss (same day)'), `<span class="${tone(al.expectancy)}">${unitFmt(al.expectancy)}</span>`, `${L('หลังไม้ชนะ', 'after win')} ${unitFmt(aw.expectancy)}`, miniBars([aw.expectancy, al.expectancy])),
  ])
    + `<div class="grid g2 mb16">${U('psy-emo', u => { const emo = group(rows, 'emotion').filter(g => g.key !== '—'); return panel(L('ผลลัพธ์ตามอารมณ์', 'Results by emotion'), chartBox({ type: 'hbar', data: emo.map(g => ({ label: `${emoRow(g.key)?.[2] ? emoRow(g.key)[2] + ' ' : ''}${g.label}`, y: g.s.expectancy ?? 0, sub: `${g.s.n} ${L('เทรด', 'trades')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(g.s.wr, 0)}% · ${L('รวม', 'total')} ${unitFmt(g.s.total)}` })), labelAlign: 'left', valueFmt: v => unitFmt(v, u), empty: L('บันทึกอารมณ์ในแต่ละเทรดเพื่อดูผล', 'Record emotions on trades to see this') }, Math.max(180, emo.length * 32)), '', '', L('ค่าคาดหวังต่อเทรด', 'Expectancy per trade')); })}${panel(L('ต้นทุนแยกตามความผิดพลาด', 'Cost by mistake'), mistOnly.length ? `<div class="tablewrap"><table><thead><tr><th>${L('ความผิดพลาด', 'Mistake')}</th><th class="num">${L('ครั้ง', 'Count')}</th><th class="num">${L('ผลรวม', 'Impact')}</th><th class="num">${L('เฉลี่ย', 'Average')}</th><th style="width:30%"></th></tr></thead><tbody>${mistOnly.sort((a, b) => (a.s.total ?? 0) - (b.s.total ?? 0)).map(g => { const mx = Math.max(EPS, ...mistOnly.map(x => Math.abs(x.s.total || 0))); return `<tr class="click" data-action="drill" data-dim="mistake" data-key="${esc(g.key)}"><td>${esc(g.label)}</td><td class="num">${g.s.n}</td><td class="num"><strong class="${tone(g.s.total)}">${unitFmt(g.s.total)}</strong></td><td class="num">${unitFmt(g.s.expectancy)}</td><td>${progress(Math.abs(g.s.total || 0) / mx * 100, (g.s.total || 0) < 0 ? 'neg' : 'pos')}</td></tr>`; }).join('')}</tbody></table></div>` : empty(L('ยังไม่มีแท็กความผิดพลาด', 'No mistake tags yet'), L('ติดแท็กหมวด "ความผิดพลาด" เพื่อวัดต้นทุนของแต่ละพฤติกรรม', 'Tag mistakes to measure their cost')), '', 'psy-cost')}</div>`
    + `<div class="grid g2 mb16">${U('psy-rating', u => { const rat = group(rows, 'rating').filter(g => g.key !== '—'); return panel(L('คะแนนการเทรดเทียบกับผลลัพธ์', 'Rating vs result'), chartBox({ type: 'bar', categorical: true, data: rat.map(g => ({ x: g.key, label: g.key + '/5', y: g.s.expectancy ?? 0, sub: `${g.s.n} ${L('เทรด', 'trades')}` })), unit: u, valueLabels: true, valueFmt: v => compactUnit(v) }, 220), '', '', L('ค่าคาดหวังตามคะแนนที่ให้ตัวเอง', 'Expectancy by self-rating')); })}${U('psy-mood', u => { const moodG = [1, 2, 3, 4, 5].map(m => { const ds2 = new Set(jr.filter(j => j.mood === m).map(j => j.date)); const rs = closed.filter(t => ds2.has(tradeDay(t))); return { label: MOOD_EMOJI[m - 1] + ' ' + MOOD_LABELS()[m - 1], y: stats(rs).expectancy ?? 0, n: rs.length }; }).filter(x => x.n); return panel(L('อารมณ์ในบันทึกประจำวันเทียบกับผลลัพธ์', 'Journal mood vs result'), chartBox({ type: 'bar', categorical: true, data: moodG.map(g => ({ x: g.label, label: g.label, y: g.y, sub: g.n + L(' เทรด', ' trades') })), unit: u, valueLabels: true, valueFmt: v => compactUnit(v), empty: L('ให้คะแนนอารมณ์ใน บันทึกประจำวัน', 'Rate your mood in the daily journal') }, 220)); })}</div>`
    + panel(L('ไทม์ไลน์วินัย (60 วันเทรดล่าสุด)', 'Discipline timeline (last 60 trading days)'), `<div class="row wrap gap4">${disc.map(({ d, x }) => `<span data-action="open-day" data-day="${d}" data-tip="${esc(fmtDate(d) + '\n' + (x.issues.length ? x.issues.join(' · ') : L('ไม่ผิดกฎ', 'Clean')))}" style="width:18px;height:28px;cursor:pointer;background:${x.issues.length ? (x.issues.length > 1 ? 'var(--neg)' : 'var(--warn)') : 'var(--pos)'};opacity:${x.issues.length ? 1 : .75}"></span>`).join('') || '<span class="dim">—</span>'}</div><div class="legend mt16"><span><i style="background:var(--pos)"></i>${L('ไม่ผิดกฎ', 'Clean')}</span><span><i style="background:var(--warn)"></i>${L('ผิด 1 ข้อ', '1 issue')}</span><span><i style="background:var(--neg)"></i>${L('ผิดหลายข้อ', '2+ issues')}</span></div>`, btn(icon('settings') + L(' ตั้งกฎ', ' Rules'), 'nav', { 'data-route': 'settings/rules' }, 'sm'))
    + missedPanel();
}
function missedPanel() {
  const all = filterTrades(state.trades, { ...ui.filters, includeMissed: true }, true), missed = all.filter(t => t.status === 'Missed'), taken = all.filter(t => t.status === 'Closed' || t.status === 'Open');
  const title = L('จังหวะที่พลาด (ไม่ได้เข้า)', 'Missed setups');
  if (!missed.length) return `<div class="mt16">${panel(title, `<p class="small muted" style="margin:0">${L('บันทึกจังหวะที่เห็นแต่ไม่ได้เข้า ด้วยสถานะ "พลาด" ในหน้าต่างเทรด เพื่อวัด Fill rate และ R ที่พลาดไป — ไม่นับใน P&L', 'Log setups you saw but did not take with the "Missed" status to measure fill rate and missed R — excluded from P&L')}</p>`)}</div>`;
  const rs = missed.map(missedR).filter(finite), fill = taken.length / (taken.length + missed.length) * 100, win = rs.filter(r => r > EPS), loss = rs.filter(r => r < -EPS);
  const ids = [...new Set([...missed, ...taken].map(t => t.playbookId || ''))];
  const byPb = ids.map(id => { const m = missed.filter(t => (t.playbookId || '') === id), k = taken.filter(t => (t.playbookId || '') === id), r = m.map(missedR).filter(finite); return { id, name: id ? nameOf('playbooks', id) : L('ไม่ระบุกลยุทธ์', 'No strategy'), m: m.length, k: k.length, fill: k.length / Math.max(1, k.length + m.length) * 100, r: sum(r), rn: r.length }; }).filter(x => x.m).sort((a, b) => b.m - a.m);
  const emo = Object.entries(missed.reduce((o, t) => { if (t.emotion) o[t.emotion] = (o[t.emotion] || 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
  let cr = 0; const cumMissed = rs.map(r => (cr += r));
  const body = miniRow([
    miniCard(L('จังหวะที่พลาด', 'Missed setups'), missed.length, `${L('เทียบกับเทรดที่เข้า', 'vs taken')} ${taken.length}`, pctViz(missed.length / Math.max(1, missed.length + taken.length) * 100, 'neg')),
    miniCard(L('อัตราการเข้าเทรด', 'Fill rate'), fmt(fill, 0) + '%', frac(L('เทรดที่เข้า', 'Taken'), L('จังหวะทั้งหมด', 'All setups')), pctViz(fill, 'accent'), `data-tip="${esc(L('สัดส่วน จังหวะที่ได้เข้าจริง — ต่ำ = ลังเลหรือตั้งคำสั่งรอแล้วไม่ได้ไม้บ่อย', 'Share of setups actually taken'))}"`),
    miniCard(L('R ที่พลาด (สุทธิ)', 'Missed R (net)'), `<span class="${tone(sum(rs))}">${rs.length ? fmt(sum(rs), 2, true) + 'R' : '—'}</span>`, `${rs.length}/${missed.length} ${L('ไม้มีราคาที่ไปถึง', 'with outcome price')}`, sparkline(cumMissed)),
    miniCard(L('จะได้กำไร / จะขาดทุน', 'Would win / lose'), `<span class="pos">${win.length}</span> / <span class="neg">${loss.length}</span>`, loss.length ? L(`หลีกเลี่ยงขาดทุนได้ ${fmt(-sum(loss), 1)}R`, `Avoided ${fmt(-sum(loss), 1)}R of losses`) : '', wlGauge(win.length, rs.length - win.length - loss.length, loss.length)),
  ])
    + `<div class="grid g-21"><div class="tablewrap"><table><thead><tr><th>${L('กลยุทธ์', 'Strategy')}</th><th class="num">${L('เข้า', 'Taken')}</th><th class="num">${L('พลาด', 'Missed')}</th><th class="num">${gl(L('อัตราการเข้าเทรด', 'Fill rate'))}</th><th class="num">${L('R ที่พลาด', 'Missed R')}</th></tr></thead><tbody>${byPb.map(x => `<tr><td>${esc(x.name)}</td><td class="num">${x.k}</td><td class="num">${x.m}</td><td class="num">${fmt(x.fill, 0)}%</td><td class="num ${tone(x.r)}">${x.rn ? fmt(x.r, 2, true) + 'R' : '—'}</td></tr>`).join('')}</tbody></table></div>`
    + `<div><div class="small muted mb8">${L('อารมณ์ตอนที่พลาด', 'Emotion when missed')}</div>${emo.length ? emo.map(([e, n]) => `<div class="srow"><span>${emotionHTML(e)}</span><strong>${n}</strong></div>`).join('') : `<span class="small dim">—</span>`}<div class="mt16">${btn(icon('trades') + L(' ดูรายการที่พลาด', ' View missed setups'), 'missed-view', {}, 'sm')}</div></div></div>`;
  return `<div class="mt16">${panel(title, body, '', '', L('ไม่นับใน P&L และสถิติ — ใช้วัดวินัยการเข้าเทรด', 'Not counted in P&L or stats — measures entry discipline'))}</div>`;
}
function riskLabView(rows) {
  const mc = ui.mc, closed = closedSorted(rows), rs = closed.map(t => calc(t).r).filter(finite), nets = closed.map(t => calc(t).net).filter(finite);
  const samples = mc.basis === 'R' ? rs : nets, start = mc.start || (sum(currentAccounts().map(a => accountBalance(a.id))) || 10000);
  const res = monteCarlo(samples, { runs: mc.runs, trades: mc.trades, riskPct: mc.riskPct, start, ruin: mc.ruin, basis: mc.basis });
  const ctrl = `<form id="mc-form" class="formgrid c3" onsubmit="return false">${field('basis', L('ใช้ข้อมูล', 'Sample'), mc.basis, 'select', { options: [['R', L('R-Multiple (ปรับตาม % เสี่ยง)', 'R-multiples (scaled by risk %)')], ['P&L', L('P&L จริง ($)', 'Actual P&L ($)')]] })}${field('riskPct', L('ความเสี่ยงต่อเทรด', 'Risk per trade'), mc.riskPct, 'number', { suffix: '%', attrs: mc.basis !== 'R' ? 'disabled' : '' })}${field('start', L('เงินทุนเริ่มต้น', 'Starting balance'), Math.round(start), 'number')}${field('trades', L('จำนวนเทรดในอนาคต', 'Trades to simulate'), mc.trades, 'number')}${field('runs', L('จำนวนรอบจำลอง', 'Simulations'), mc.runs, 'select', { options: [200, 500, 1000, 2000] })}${field('ruin', L('เกณฑ์ "ล้างพอร์ต" (DD %)', 'Ruin threshold (DD %)'), mc.ruin, 'number', { suffix: '%' })}</form>`;
  const out = res ? `<div class="mc-stats mt16">${kpi(L('มูลค่าพอร์ตค่ากลาง', 'Median final'), money(res.medianFinal), `${fmt((res.medianFinal / start - 1) * 100, 1, true)}%`)}${kpi(L('กรณีแย่ (P5)', 'Bad case (P5)'), `<span class="${tone(res.p5Final - start)}">${money(res.p5Final)}</span>`)}${kpi(L('กรณีดี (P95)', 'Good case (P95)'), `<span class="pos">${money(res.p95Final)}</span>`)}${kpi(L('โอกาสมีกำไร', 'Probability of profit'), fmt(res.profitPct, 1) + '%')}${kpi(L('Drawdown สูงสุด (ค่ากลาง)', 'Median max drawdown'), `<span class="neg">${fmt(res.medianDD, 1)}%</span>`, `P95 ${fmt(res.p95DD, 1)}%`)}${kpi(L('ความเสี่ยงล้างพอร์ต', 'Risk of ruin'), `<span class="${res.ruinPct > 5 ? 'neg' : res.ruinPct > 1 ? 'warn' : 'pos'}">${fmt(res.ruinPct, 1)}%</span>`, L(`DD ≥ ${mc.ruin}%`, `DD ≥ ${mc.ruin}%`))}</div><div class="mt16">${chartBox({ type: 'band', bands: res.bands, sample: res.sample, start }, 320)}</div>` : `<div class="mt16">${empty(L('ต้องมีอย่างน้อย 5 เทรดที่มีค่า ' + (mc.basis === 'R' ? 'R (มีระดับ S/L)' : 'P&L'), 'Need at least 5 trades with ' + mc.basis), '', '', 'dice')}</div>`;
  // what-if
  const wi = ui.whatIf || {}, base = closed;
  let alt = base.slice();
  if (wi.noMistakes) alt = alt.filter(t => !(t.tags || []).some(isMistakeTag));
  if (wi.bestPb) { const g = group(base, 'playbook').filter(x => x.s.n >= 5).sort((a, b) => (b.s.expectancy ?? -1e9) - (a.s.expectancy ?? -1e9))[0]; if (g) { const ids = new Set(g.rows.map(t => t.id)); alt = alt.filter(t => ids.has(t.id)); } }
  if (wi.dropWorstSession) { const g = group(base, 'session').filter(x => x.s.n >= 5).sort((a, b) => (a.s.total ?? 0) - (b.s.total ?? 0))[0]; if (g && g.s.total < 0) alt = alt.filter(t => sessionOf(t) !== g.key); }
  if (wi.dropWorstDay) { const g = group(base, 'weekday').filter(x => x.s.n >= 5).sort((a, b) => (a.s.total ?? 0) - (b.s.total ?? 0))[0]; if (g && g.s.total < 0) alt = alt.filter(t => String(weekdayOfKey(entryDay(t))) !== g.key); }
  if (wi.maxTrades) { const per = new Map(); alt = alt.filter(t => { const d = tradeDay(t), n = (per.get(d) || 0) + 1; per.set(d, n); return n <= (state.settings.rules?.maxTradesPerDay || 3); }); }
  const altVal = t => { let v = value(t); const c = calc(t); if (wi.capLoss && finite(c.r) && c.r < -1 && finite(v)) v = v / Math.abs(c.r); return v; };
  const seriesOf = (arr, fnv) => { let acc = 0; return arr.filter(t => finite(fnv(t))).map(t => { acc += fnv(t); return { x: tradeDay(t), y: acc }; }); };
  const bs = seriesOf(base, t => value(t)), as = seriesOf(alt, altVal);
  // align on base x axis
  const asMap = new Map(); as.forEach(p => asMap.set(p.x, p.y)); let last = 0; const asAligned = bs.map(p => { if (asMap.has(p.x)) last = asMap.get(p.x); return { x: p.x, y: last }; });
  const bTot = bs.at(-1)?.y ?? 0, aTot = as.at(-1)?.y ?? 0, bst = stats(base), ast = (() => { const st = stats(alt); return st; })();
  const toggles = [['noMistakes', L('ตัดเทรดที่มีความผิดพลาดออก', 'Remove trades tagged as mistakes'), L('ถ้าคุณมีวินัย 100%', 'If you were 100% disciplined')], ['capLoss', L('จำกัดขาดทุนไม่เกิน −1R', 'Cap every loss at −1R'), L('ถ้าไม่เคยเลื่อน S/L หรือปล่อยให้ขาดทุนเกินแผน', 'If you never let a loss exceed plan')], ['bestPb', L('เทรดเฉพาะกลยุทธ์ที่ดีที่สุด', 'Trade only your best strategy'), L('โฟกัสกับความได้เปรียบที่แข็งแรงที่สุด', 'Focus on your strongest edge')], ['dropWorstSession', L('ไม่เทรดในเซสชันที่แย่ที่สุด', 'Skip your worst session'), L('ตัดเซสชันที่ขาดทุนสุทธิ', 'If it is net negative')], ['dropWorstDay', L('ไม่เทรดในวันที่แย่ที่สุดของสัปดาห์', 'Skip your worst weekday'), ''], ['maxTrades', L(`จำกัดไม่เกิน ${state.settings.rules?.maxTradesPerDay || 3} เทรด/วัน`, `Max ${state.settings.rules?.maxTradesPerDay || 3} trades/day`), L('ตัดเทรดส่วนเกินของแต่ละวัน', 'Drop overtrading')]];
  const whatIf = `<div class="grid g-12"><div class="toggles">${toggles.map(([k, l, d]) => `<div class="toggle-row"><div><strong>${l}</strong>${d ? `<small>${d}</small>` : ''}</div>${toggle('wi_' + k, !!wi[k], 'what-if', `data-k="${k}"`)}</div>`).join('')}</div><div><div class="kpis mb16">${kpi(L('ผลจริง', 'Actual'), `<span class="${tone(bTot)}">${unitFmt(bTot)}</span>`, `${bst.n} ${L('เทรด', 'trades')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(bst.wr, 0)}%`)}${kpi(L('ผลจำลอง', 'What-if'), `<span class="${tone(aTot)}">${unitFmt(aTot)}</span>`, `${alt.length} ${L('เทรด', 'trades')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(ast.wr, 0)}%`)}${kpi(L('ส่วนต่าง', 'Difference'), `<span class="${tone(aTot - bTot)}">${unitFmt(aTot - bTot)}</span>`, finite(bTot) && Math.abs(bTot) > EPS ? fmt((aTot - bTot) / Math.abs(bTot) * 100, 0, true) + '%' : '')}</div>${chartBox({ type: 'line', series: [{ name: L('ผลจริง', 'Actual'), data: bs, color: 'var(--dim)' }, { name: L('ผลจำลอง', 'What-if'), data: asAligned, color: 'var(--accent)' }], unit: ui.unit }, 260)}</div></div>`;
  // risk of ruin table by risk %
  const ruinRows = rs.length >= 5 ? [.25, .5, 1, 1.5, 2, 3].map(rp => { const r2 = monteCarlo(rs, { runs: 300, trades: mc.trades, riskPct: rp, start: 10000, ruin: mc.ruin, basis: 'R', seed: 11 }); return `<tr class="${Math.abs(rp - mc.riskPct) < EPS ? 'sel' : ''}"><td>${fmt(rp, 2)}%</td><td class="num">${fmt((r2.medianFinal / 10000 - 1) * 100, 1, true)}%</td><td class="num">${fmt((r2.p5Final / 10000 - 1) * 100, 1, true)}%</td><td class="num neg">${fmt(r2.medianDD, 1)}%</td><td class="num neg">${fmt(r2.p95DD, 1)}%</td><td class="num"><strong class="${r2.ruinPct > 5 ? 'neg' : r2.ruinPct > 1 ? 'warn' : 'pos'}">${fmt(r2.ruinPct, 1)}%</strong></td></tr>`; }).join('') : '';
  return panel(icon('dice') + ' ' + gl('Monte Carlo'), ctrl + out, btn(icon('refresh') + L(' จำลองใหม่', ' Re-run'), 'mc-run', {}, 'sm'), 'mb16', L('สุ่มเรียงลำดับผลเทรดในอดีตใหม่หลายร้อยครั้ง เพื่อดูช่วงผลลัพธ์ที่เป็นไปได้ — ไม่ใช่การพยากรณ์', 'Resamples your past results to show a range of plausible outcomes — not a forecast'))
    + panel(icon('sparkles') + L(' สถานการณ์สมมติ (What-if)', ' What-if'), whatIf, '', 'mb16', L('ถ้าเปลี่ยนพฤติกรรมบางอย่าง ผลลัพธ์ในอดีตจะเป็นอย่างไร', 'How would past results change with different behaviour'))
    + (ruinRows ? panel(L('ความเสี่ยงต่อเทรดเทียบกับความเสี่ยงล้างพอร์ต', 'Risk per trade vs risk of ruin'), `<div class="tablewrap"><table><thead><tr><th>${L('เสี่ยง/เทรด', 'Risk/trade')}</th><th class="num">${L('ผลตอบแทนค่ากลาง', 'Median return')}</th><th class="num">${L('กรณีแย่ (P5)', 'P5 return')}</th><th class="num">${L('Drawdown สูงสุด (ค่ากลาง)', 'Median max drawdown')}</th><th class="num">${L('Drawdown สูงสุด P95', 'Max drawdown P95')}</th><th class="num">${L('ล้างพอร์ต', 'Ruin')} (DD≥${mc.ruin}%)</th></tr></thead><tbody>${ruinRows}</tbody></table></div>`, '', 'flush', L(`จำลอง ${mc.trades} เทรด × 300 รอบ จาก R-Multiple ของคุณ`, `${mc.trades} trades × 300 runs from your R-multiples`)) : '');
}
/* v3.75 — hover explanations for every Reports metric that has no glossary entry.
   key = English label · [Thai label, Thai description, English description] */
const RP_DESC_RAW = {
  'Gross Profit': ['กำไรขั้นต้น', 'ผลรวมของเทรดที่ได้กำไรทั้งหมด ก่อนหักเทรดที่ขาดทุน', 'Sum of all winning trades, before subtracting the losers'],
  'Gross Loss': ['ขาดทุนขั้นต้น', 'ผลรวมของเทรดที่ขาดทุนทั้งหมด', 'Sum of all losing trades'],
  'Average Trade P&L': ['กำไร/ขาดทุนเฉลี่ยต่อเทรด', 'กำไรสุทธิ ÷ จำนวนเทรดที่ปิดแล้ว', 'Net profit ÷ closed trades'],
  'Average Daily P&L': ['กำไร/ขาดทุนเฉลี่ยต่อวัน', 'กำไรสุทธิ ÷ จำนวนวันที่มีการเทรด', 'Net profit ÷ days with trades'],
  'Average Monthly P&L': ['กำไร/ขาดทุนเฉลี่ยต่อเดือน', 'กำไรสุทธิ ÷ จำนวนเดือนที่มีการเทรด', 'Net profit ÷ months with trades'],
  'Best Trading Day': ['วันเทรดที่ดีที่สุด', 'วันที่กำไรสุทธิรวมสูงที่สุด', 'The day with the highest net result'],
  'Worst Trading Day': ['วันเทรดที่แย่ที่สุด', 'วันที่กำไรสุทธิรวมต่ำที่สุด', 'The day with the lowest net result'],
  'Best Month': ['เดือนที่ดีที่สุด', 'เดือนที่กำไรสุทธิรวมสูงที่สุด', 'The month with the highest net result'],
  'Worst Month': ['เดือนที่แย่ที่สุด', 'เดือนที่กำไรสุทธิรวมต่ำที่สุด', 'The month with the lowest net result'],
  'Ending Balance': ['ยอดเงินสิ้นสุด', 'ทุนเริ่มต้น + กำไรสุทธิ + เงินฝาก − เงินถอน ณ วันสุดท้ายของช่วง', 'Starting balance + net profit + deposits − withdrawals at the end of the range'],
  'Highest Balance': ['ยอดเงินสูงสุด', 'ยอดเงินสูงที่สุดที่บัญชีเคยไปถึงในช่วงนี้', 'The highest balance reached in the range'],
  'Lowest Balance': ['ยอดเงินต่ำสุด', 'ยอดเงินต่ำที่สุดในช่วงนี้', 'The lowest balance in the range'],
  'Total Deposits': ['ฝากรวม', 'เงินที่ฝากเข้าบัญชีทั้งหมดในช่วงนี้', 'All money deposited in the range'],
  'Total Withdrawals': ['ถอนรวม', 'เงินที่ถอนออกจากบัญชีทั้งหมดในช่วงนี้', 'All money withdrawn in the range'],
  'Total Trades': ['เทรดทั้งหมด', 'จำนวนเทรดที่ปิดแล้ว (ไม่นับจังหวะที่ไม่ได้เข้า)', 'Closed trades (missed setups not counted)'],
  'Winning Trades': ['เทรดที่ชนะ', 'จำนวนเทรดที่ปิดแล้วได้กำไรสุทธิ', 'Closed trades with a net profit'],
  'Losing Trades': ['เทรดที่แพ้', 'จำนวนเทรดที่ปิดแล้วขาดทุนสุทธิ', 'Closed trades with a net loss'],
  'Breakeven Trades': ['เทรดเสมอ', 'เทรดที่ผลสุทธิเป็นศูนย์', 'Closed trades that ended flat'],
  'Loss Rate': ['อัตราแพ้', 'เทรดที่แพ้ ÷ เทรดทั้งหมด', 'Losing trades ÷ all trades'],
  'Breakeven Rate': ['อัตราเสมอ', 'เทรดเสมอ ÷ เทรดทั้งหมด', 'Breakeven trades ÷ all trades'],
  'Long Win Rate': ['อัตราชนะฝั่ง Long', 'อัตราชนะเฉพาะเทรดฝั่งซื้อ', 'Win rate of buy trades only'],
  'Short Win Rate': ['อัตราชนะฝั่ง Short', 'อัตราชนะเฉพาะเทรดฝั่งขาย', 'Win rate of sell trades only'],
  'Expectancy (R)': ['ค่าคาดหวัง (R)', 'ผลเฉลี่ยต่อเทรดในหน่วย R (เทียบกับความเสี่ยงที่ตั้งไว้)', 'Average result per trade in R (relative to the risk taken)'],
  'Average Win / Average Loss': ['กำไรเฉลี่ย / ขาดทุนเฉลี่ย', 'กำไรเฉลี่ยของไม้ชนะ เทียบกับขาดทุนเฉลี่ยของไม้แพ้', 'Average winning trade next to the average losing trade'],
  'Average Winning Trade': ['กำไรเฉลี่ยของไม้ที่ชนะ', 'กำไรขั้นต้น ÷ จำนวนเทรดที่ชนะ', 'Gross profit ÷ winning trades'],
  'Average Losing Trade': ['ขาดทุนเฉลี่ยของไม้ที่แพ้', 'ขาดทุนขั้นต้น ÷ จำนวนเทรดที่แพ้', 'Gross loss ÷ losing trades'],
  'Largest Winning Trade': ['ไม้ที่กำไรมากที่สุด', 'เทรดเดียวที่ได้กำไรมากที่สุด', 'The single biggest winner'],
  'Largest Losing Trade': ['ไม้ที่ขาดทุนมากที่สุด', 'เทรดเดียวที่ขาดทุนมากที่สุด', 'The single biggest loser'],
  'Median Trade P&L': ['มัธยฐานกำไร/ขาดทุนต่อเทรด', 'ผลของเทรดที่อยู่ตรงกลางเมื่อเรียงทุกเทรด ไม่ถูกดึงด้วยไม้ใหญ่ไม่กี่ไม้', 'The middle trade result — not pulled by a few outliers'],
  'Best Trade R-Multiple': ['R-Multiple ดีที่สุด', 'เทรดที่ได้ผลเทียบความเสี่ยงสูงที่สุด', 'The highest result relative to risk'],
  'Worst Trade R-Multiple': ['R-Multiple แย่ที่สุด', 'เทรดที่เสียเทียบความเสี่ยงมากที่สุด', 'The worst result relative to risk'],
  'Max Consecutive Losses': ['แพ้ติดกันสูงสุด', 'จำนวนเทรดที่แพ้ต่อเนื่องกันมากที่สุด', 'Longest run of losing trades in a row'],
  'Current Winning Streak': ['ชนะติดกันตอนนี้', 'จำนวนเทรดล่าสุดที่ชนะต่อเนื่อง', 'Wins in a row up to the latest trade'],
  'Current Losing Streak': ['แพ้ติดกันตอนนี้', 'จำนวนเทรดล่าสุดที่แพ้ต่อเนื่อง', 'Losses in a row up to the latest trade'],
  'Average Winning Streak': ['ชนะติดกันเฉลี่ย', 'ความยาวเฉลี่ยของช่วงที่ชนะต่อเนื่อง', 'Average length of a run of wins'],
  'Average Losing Streak': ['แพ้ติดกันเฉลี่ย', 'ความยาวเฉลี่ยของช่วงที่แพ้ต่อเนื่อง', 'Average length of a run of losses'],
  'Profitable Days': ['วันกำไร', 'วันเทรดที่ผลรวมของวันเป็นบวก', 'Trading days that ended positive'],
  'Losing Days': ['วันขาดทุน', 'วันเทรดที่ผลรวมของวันเป็นลบ', 'Trading days that ended negative'],
  'Breakeven Days': ['วันเสมอ', 'วันเทรดที่ผลรวมเป็นศูนย์', 'Trading days that ended flat'],
  'Winning Weeks': ['สัปดาห์กำไร', 'สัปดาห์ที่ผลรวมเป็นบวก', 'Weeks that ended positive'],
  'Losing Weeks': ['สัปดาห์ขาดทุน', 'สัปดาห์ที่ผลรวมเป็นลบ', 'Weeks that ended negative'],
  'Winning Months': ['เดือนกำไร', 'เดือนที่ผลรวมเป็นบวก', 'Months that ended positive'],
  'Losing Months': ['เดือนขาดทุน', 'เดือนที่ผลรวมเป็นลบ', 'Months that ended negative'],
  'Average Balance Drawdown %': ['Balance Drawdown เฉลี่ย %', 'ระยะที่ยอดเงินอยู่ต่ำกว่าจุดสูงสุดเดิมโดยเฉลี่ย เทียบเป็น %', 'How far below its previous peak the balance sat on average, in %'],
  'Maximum Equity Drawdown %': ['Equity Drawdown สูงสุด %', 'การลดลงจากจุดสูงสุดมากที่สุด รวมผลที่ยังไม่ปิด (ใช้ MAE) เป็น %', 'Largest fall from a peak including open trade swings (MAE), in %'],
  'Average Equity Drawdown': ['Equity Drawdown เฉลี่ย', 'การลดลงจากจุดสูงสุดโดยเฉลี่ย รวมผลที่ยังไม่ปิด', 'Average fall from a peak including open trade swings'],
  'Average Equity Drawdown %': ['Equity Drawdown เฉลี่ย %', 'Equity Drawdown เฉลี่ย เทียบเป็น %', 'Average equity drawdown in %'],
  'Maximum Initial Risk': ['ความเสี่ยงเริ่มต้นสูงสุด', 'เงินที่จะเสียถ้าโดน S/L มากที่สุดในเทรดเดียว', 'The most money at risk to the S/L in a single trade'],
  'Maximum Initial Risk %': ['ความเสี่ยงเริ่มต้นสูงสุด %', 'ความเสี่ยงเริ่มต้นสูงสุด เทียบกับยอดเงิน', 'Largest initial risk as % of the balance'],
  'Average Daily Risk': ['ความเสี่ยงเฉลี่ยต่อวัน', 'ผลรวมความเสี่ยงเริ่มต้นของเทรดในแต่ละวัน โดยเฉลี่ย', 'Sum of initial risk per trading day, on average'],
  'Maximum Daily Risk': ['ความเสี่ยงสูงสุดต่อวัน', 'วันที่รวมความเสี่ยงเริ่มต้นไว้มากที่สุด', 'The day with the most initial risk taken'],
  'Average Recovery Time': ['เวลาฟื้นตัวเฉลี่ย', 'เวลาเฉลี่ยที่ใช้กลับไปถึงจุดสูงสุดเดิมหลัง Drawdown', 'Average time to get back to the previous peak after a drawdown'],
  'Daily Return Standard Deviation': ['ส่วนเบี่ยงเบนผลตอบแทนรายวัน', 'ผลตอบแทนรายวันแกว่งมากแค่ไหน ยิ่งต่ำยิ่งสม่ำเสมอ', 'How much daily returns swing — lower is steadier'],
  'Ulcer Index': ['Ulcer Index', 'วัดทั้งความลึกและความนานของ Drawdown ยิ่งต่ำยิ่งดี', 'Measures how deep and how long drawdowns last — lower is better'],
  'Maximum Daily Drawdown %': ['Drawdown รายวันสูงสุด %', 'การลดลงภายในวันมากที่สุด เทียบกับยอดเงินต้นวัน', 'Largest intraday fall vs the start-of-day balance'],
  'Average Daily Drawdown': ['Drawdown รายวันเฉลี่ย', 'การลดลงภายในวันโดยเฉลี่ย', 'Average intraday fall'],
  'Average Daily Drawdown %': ['Drawdown รายวันเฉลี่ย %', 'การลดลงภายในวันโดยเฉลี่ย เป็น %', 'Average intraday fall in %'],
  'Largest Daily Loss': ['ขาดทุนรายวันมากที่สุด', 'วันที่ปิดขาดทุนรวมมากที่สุด', 'The day that closed with the biggest loss'],
  'Largest Daily Loss %': ['ขาดทุนรายวันมากที่สุด %', 'ขาดทุนรายวันมากที่สุด เทียบกับยอดเงินต้นวัน', 'Biggest daily loss vs the start-of-day balance'],
  'Trading Days': ['วันเทรด', 'จำนวนวันที่มีอย่างน้อยหนึ่งเทรด', 'Days with at least one trade'],
  'Average Trades per Week': ['เทรดเฉลี่ยต่อสัปดาห์', 'จำนวนเทรด ÷ จำนวนสัปดาห์ที่มีการเทรด', 'Trades ÷ weeks with trades'],
  'Average Trades per Winning Day': ['เทรดเฉลี่ยในวันกำไร', 'จำนวนเทรดเฉลี่ยในวันที่ปิดบวก', 'Average trades on days that ended positive'],
  'Average Trades per Losing Day': ['เทรดเฉลี่ยในวันขาดทุน', 'จำนวนเทรดเฉลี่ยในวันที่ปิดลบ — สูงกว่าวันกำไรอาจเป็นสัญญาณ Overtrade', 'Average trades on losing days — higher than winning days can mean overtrading'],
  'Most Active Trading Day': ['วันที่เทรดบ่อยที่สุด', 'วันในสัปดาห์ที่มีเทรดมากที่สุด', 'The weekday with the most trades'],
  'Most Active Trading Hour': ['ชั่วโมงที่เทรดบ่อยที่สุด', 'ชั่วโมงที่เข้าเทรดบ่อยที่สุด', 'The hour you enter most often'],
  'Long Trades': ['เทรด Long', 'จำนวนเทรดฝั่งซื้อ', 'Number of buy trades'],
  'Long Trades %': ['เทรด Long %', 'สัดส่วนเทรดฝั่งซื้อ', 'Share of buy trades'],
  'Short Trades': ['เทรด Short', 'จำนวนเทรดฝั่งขาย', 'Number of sell trades'],
  'Short Trades %': ['เทรด Short %', 'สัดส่วนเทรดฝั่งขาย', 'Share of sell trades'],
  'Median Duration': ['มัธยฐานระยะเวลาถือ', 'ระยะเวลาถือของเทรดที่อยู่ตรงกลาง', 'Holding time of the middle trade'],
  'Average Winning Duration': ['ระยะเวลาถือเฉลี่ย (ไม้ชนะ)', 'ระยะเวลาถือเฉลี่ยของเทรดที่ชนะ', 'Average holding time of winners'],
  'Average Losing Duration': ['ระยะเวลาถือเฉลี่ย (ไม้แพ้)', 'ระยะเวลาถือเฉลี่ยของเทรดที่แพ้ — นานกว่าไม้ชนะอาจหมายถึงปล่อยขาดทุนนานเกินไป', 'Average holding time of losers — longer than winners can mean holding losses too long'],
  'Longest Trade Duration': ['ถือนานที่สุด', 'เทรดที่ถือนานที่สุด', 'The longest-held trade'],
  'Shortest Trade Duration': ['ถือสั้นที่สุด', 'เทรดที่ถือสั้นที่สุด', 'The shortest-held trade'],
  'Average Exposure Time': ['เวลาที่มีสถานะเฉลี่ยต่อวันเทรด', 'เวลาที่มีออร์เดอร์เปิดอยู่โดยเฉลี่ยในแต่ละวันเทรด', 'Time with a position open per trading day, on average'],
  'Maximum Exposure Time': ['ช่วงมีสถานะต่อเนื่องนานสุด', 'ช่วงเวลาที่มีสถานะเปิดต่อเนื่องนานที่สุด', 'Longest stretch with a position open'],
  'Maximum Concurrent Positions': ['สถานะพร้อมกันสูงสุด', 'จำนวนเทรดที่เปิดอยู่พร้อมกันมากที่สุด', 'Most trades open at the same time'],
  'Trades per Session': ['เทรดต่อเซสชัน', 'จำนวนเทรดที่เข้าในแต่ละเซสชันตลาด', 'Trades entered in each market session'],
  'Most Profitable Session': ['เซสชันที่กำไรมากที่สุด', 'เซสชันที่ผลรวมสูงที่สุด', 'The session with the best total'],
  'Least Profitable Session': ['เซสชันที่กำไรน้อยที่สุด', 'เซสชันที่ผลรวมต่ำที่สุด', 'The session with the worst total'],
  'Session Win Rate': ['อัตราชนะแต่ละเซสชัน', 'อัตราชนะของเทรดในแต่ละเซสชัน', 'Win rate of the trades in each session'],
  'Average Cost per Trade': ['ต้นทุนเฉลี่ยต่อเทรด', '(ค่าคอมมิชชัน + ค่าสวอป + ค่าธรรมเนียม) ÷ จำนวนเทรด', '(Commission + swap + fees) ÷ trades'],
  'Average Commission per Trade': ['ค่าคอมมิชชันเฉลี่ยต่อเทรด', 'ค่าคอมมิชชันรวม ÷ จำนวนเทรด', 'Total commission ÷ trades'],
  'Average Swap per Trade': ['ค่าสวอปเฉลี่ยต่อเทรด', 'ค่าสวอป (ดอกเบี้ยข้ามคืน) รวม ÷ จำนวนเทรด', 'Total swap (overnight interest) ÷ trades'],
  'Average Slippage Cost': ['ต้นทุน Slippage เฉลี่ย', 'ส่วนต่างระหว่างราคาที่ตั้งใจกับราคาที่ได้จริง โดยเฉลี่ย', 'Average gap between the intended and the filled price'],
  'Cost per Lot': ['ต้นทุนต่อล็อต', 'ต้นทุนการเทรดรวม ÷ จำนวนล็อตที่เทรด', 'Total trading costs ÷ lots traded'],
  'Trading Costs % of Gross Profit': ['ต้นทุน % ของกำไรขั้นต้น', 'ต้นทุนการเทรดคิดเป็นกี่ % ของกำไรขั้นต้น', 'Trading costs as a share of gross profit'],
};
const RP_DESC = (() => { const m = new Map(); for (const [en, [th, dth, den]] of Object.entries(RP_DESC_RAW)) { m.set(en, [dth, den]); m.set(th, [dth, den]); } return m; })();
function rpDesc(label) { const d = RP_DESC.get(String(label).replace(/<[^>]+>/g, '').trim()); return d ? L(d[0], d[1]) : ''; }
