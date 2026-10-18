/* ============================================================
   CALCULATION ENGINE — P&L, R, stats, grouping, risk, simulations
   tickValue is denominated in the instrument's valueCurrency.
   ============================================================ */
function specOf(t) { return t.instrumentSnapshot?.id === t.instrumentId ? t.instrumentSnapshot : get('instruments', t.instrumentId); }
function pipSizeOf(t) { const h = specOf(t)?.pipSize, c = get('instruments', t.instrumentId)?.pipSize; return h > 0 ? h : c > 0 ? c : null; }
function tickRate(t) {
  const i = specOf(t); if (!i || !(i.tickSize > 0) || !(i.tickValue > 0)) return null;
  const ac = get('accounts', t.accountId)?.currency;
  const fx = (i.valueCurrency || i.quoteCurrency) === ac || !ac ? 1 : t.fxRate;
  if (!(fx > 0)) return null;
  return i.tickValue / i.tickSize * (i.multiplier || 1) * fx;
}
function calc(t) {
  const hit = calcCache.get(t); if (hit) return hit;
  const i = specOf(t), sign = t.side === 'Sell' ? -1 : 1, rate = tickRate(t);
  const distance = t.stopLoss != null && t.entryPrice != null ? Math.abs(t.entryPrice - t.stopLoss) : null;
  const risk = finite(rate) && distance > EPS && t.quantity > 0 ? distance * rate * t.quantity : (finite(t.riskAmount) && t.riskAmount > 0 ? t.riskAmount : null);
  let gross = t.grossPnL;
  if (gross == null && t.exitPrice != null && finite(rate)) gross = (t.exitPrice - t.entryPrice) * sign * rate * t.quantity;
  const closed = t.status === 'Closed';
  const net = closed && finite(gross) ? gross - (t.commission || 0) + (t.swap || 0) : null;
  const move = t.exitPrice != null && t.entryPrice ? (t.exitPrice - t.entryPrice) * sign : null;
  const pip = pipSizeOf(t);
  const dur = t.entryDateTime ? (+(t.exitDateTime ? new Date(t.exitDateTime) : new Date()) - new Date(t.entryDateTime)) / 60000 : null;
  const r = risk && finite(net) ? net / risk : null;
  // MAE / MFE are stored as prices; express as R and capture efficiency
  const maeR = distance > EPS && finite(t.mae) ? -Math.abs(t.entryPrice - t.mae) / distance : null;
  const mfeR = distance > EPS && finite(t.mfe) ? Math.abs(t.mfe - t.entryPrice) / distance : null;
  const out = {
    gross, net, risk, r, closed,
    planned: distance > EPS && t.takeProfit != null ? Math.abs(t.takeProfit - t.entryPrice) / distance : null,
    duration: dur, change: move != null ? move / t.entryPrice * 100 : null,
    pips: move != null && pip > 0 ? move / pip : null,
    points: move != null && i?.pointSize > 0 ? move / i.pointSize : null,
    maeR, mfeR, efficiency: finite(mfeR) && mfeR > EPS && finite(r) && r > EPS ? clamp(r / mfeR, 0, 1) * 100 : null,
    result: !closed || !finite(net) ? null : net > EPS ? 'win' : net < -EPS ? 'loss' : 'be'
  };
  calcCache.set(t, out); return out;
}
function value(t, u = ui.unit) {
  if (t.status !== 'Closed') return null; const c = calc(t);
  switch (u) { case 'P&L': return c.net; case 'R': return c.r; case '%': return c.change; case 'Pips': return c.pips; case 'Points': return c.points; default: return c.net; }
}
const txnValue = t => ['Withdrawal', 'Fee'].includes(t.type) ? -Math.abs(t.amount) : t.type === 'Reset' ? t.amount : Math.abs(t.amount) * (t.type === 'Adjustment' ? Math.sign(t.amount) || 1 : 1);
function accountEvents(id) { return memoize('ev:' + id, () => accountEventsRaw(id)); }
function accountEventsRaw(id) {
  return [...state.transactions.filter(t => t.accountId === id).map(t => ({ date: t.dateTime, v: t.type === 'Adjustment' ? t.amount : txnValue(t), reset: t.type === 'Reset', kind: 'txn', ref: t })),
  ...state.trades.filter(t => t.accountId === id && t.status === 'Closed').map(t => ({ date: t.exitDateTime || t.entryDateTime, day: tradeDay(t), v: calc(t).net, kind: 'trade', ref: t }))]
    .filter(e => e.date).map(e => ({ ...e, ts: +new Date(e.date) })).sort((a, b) => a.ts - b.ts);
}
function accountBalance(id, until = Infinity) {
  const a = get('accounts', id); if (!a) return 0;
  let b = a.startingCapital || 0; for (const e of accountEvents(id)) { if (e.ts > until) break; b = e.reset ? e.v : b + (e.v || 0); } return b;
}
function planCalc(p) {
  const bal = accountBalance(p.accountId), budget = bal * (p.riskPct || 0) / 100, rate = tickRate(p);
  const dist = p.stopLoss != null && p.entryPrice != null ? Math.abs(p.entryPrice - p.stopLoss) : null, ins = get('instruments', p.instrumentId);
  const per = dist > EPS && rate ? dist * rate : null, step = ins?.quantityStep || .01;
  const qty = per ? Math.floor((Math.min(budget / per, ins?.maxQuantity || Infinity) + 1e-9) / step) * step : null;
  const risk = finite(qty) && per ? qty * per : null;
  const reward = qty && p.takeProfit != null ? Math.abs(p.takeProfit - p.entryPrice) * rate * qty : null;
  const pip = pipSizeOf(p);
  return { bal, budget, qty, risk, reward, perUnit: per, stopPips: dist != null && pip ? dist / pip : null, rr: dist && p.takeProfit != null ? Math.abs(p.takeProfit - p.entryPrice) / dist : null };
}
/* R a missed setup would have made: from intended entry to where price went (exit price), risk = entry→SL */
function missedR(t) { if (!(t.entryPrice > 0) || t.stopLoss == null || t.exitPrice == null) return null; const dist = Math.abs(t.entryPrice - t.stopLoss); if (dist < EPS) return null; return (t.exitPrice - t.entryPrice) * (t.side === 'Sell' ? -1 : 1) / dist; }
function currencies(rows) { const ids = new Set(); for (const t of rows) ids.add(t.accountId); return [...new Set([...ids].map(id => get('accounts', id)?.currency).filter(Boolean))]; }
function monetaryAllowed(rows) { return currencies(rows).length <= 1; }

/* ---------- filtering ---------- */
function isMistakeTag(id) { return memoize('mistakeTags', () => new Set(state.tags.filter(t => t.categoryId === 'cat_mistakes').map(t => t.id))).has(id); }
function filterTrades(rows, f = {}, useGlobal = false) {
  const q = String(f.search ?? '').toLowerCase().trim();
  const account = f.account ?? (useGlobal ? ui.account : ''), from = f.from ?? (useGlobal ? ui.from : ''), to = f.to ?? (useGlobal ? ui.to : '');
  return rows.filter(t => {
    if (t.status === 'Void' && !f.includeVoid || t.status === 'Missed' && !f.includeMissed) return false;
    if (account && t.accountId !== account) return false;
    const day = tradeDay(t);
    if (from && day < from || to && day > to) return false;
    for (const k of ['instrumentId', 'playbookId', 'side', 'status']) if (f[k] && t[k] !== f[k]) return false;
    if (f.assetClass && get('instruments', t.instrumentId)?.assetClass !== f.assetClass) return false;
    if (f.weekday != null && f.weekday !== '' && weekdayOfKey(entryDay(t)) !== Number(f.weekday)) return false;
    if (f.session && sessionOf(t) !== f.session) return false;
    if (f.emotion && t.emotion !== f.emotion) return false;
    const tags = f.tags || [];
    if (tags.length && !(f.tagMode === 'all' ? tags.every(x => (t.tags || []).includes(x)) : tags.some(x => (t.tags || []).includes(x)))) return false;
    if (f.excludeTags?.length && f.excludeTags.some(x => (t.tags || []).includes(x))) return false;
    if (f.mistakes === 'none' && (t.tags || []).some(isMistakeTag)) return false;
    if (f.mistakes === 'any' && !(t.tags || []).some(isMistakeTag)) return false;
    if (f.reviewed === 'yes' && !t.reviewed) return false; if (f.reviewed === 'no' && t.reviewed) return false;
    if (f.minR != null && f.minR !== '' && !(calc(t).r >= Number(f.minR))) return false;
    if (f.maxR != null && f.maxR !== '' && !(calc(t).r <= Number(f.maxR))) return false;
    if (q) {
      const hay = [t.displayId, nameOf('instruments', t.instrumentId, 'symbol'), nameOf('playbooks', t.playbookId), t.note, t.side, ...(t.tags || []).map(id => nameOf('tags', id))].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function filtered(extra = {}) { return filterTrades(state.trades, { ...ui.filters, ...extra }, true); }
function activeFilterCount() { const f = ui.filters; return ['instrumentId', 'playbookId', 'side', 'status', 'assetClass', 'session', 'emotion', 'mistakes', 'reviewed'].filter(k => f[k]).length + (f.weekday != null && f.weekday !== '' ? 1 : 0) + (f.tags?.length ? 1 : 0) + (f.minR !== '' && f.minR != null ? 1 : 0) + (f.maxR !== '' && f.maxR != null ? 1 : 0); }

/* ---------- core statistics ---------- */
function drawdown(values, start = 0) {
  let bal = start, peak = start; const dd = [], pct = [], curve = [];
  for (const v of values) { bal += v || 0; peak = Math.max(peak, bal); curve.push(bal); dd.push(bal - peak); pct.push(peak > 0 ? (bal - peak) / peak * 100 : null); }
  const mx = dd.length ? Math.min(...dd) : 0;
  // longest drawdown duration (in trades)
  let longest = 0, cur = 0; for (const d of dd) { cur = d < -EPS ? cur + 1 : 0; longest = Math.max(longest, cur); }
  return { curve, dd, pct, max: mx, maxPct: pct.some(finite) ? Math.min(...pct.filter(finite)) : null, avg: mean(dd.filter(x => x < -EPS)) ?? 0, avgPct: mean(pct.filter(x => finite(x) && x < -EPS)), longest };
}
function streaks(values) { let w = 0, l = 0, cw = 0, cl = 0; for (const x of values) { if (x > EPS) { cw++; cl = 0; } else if (x < -EPS) { cl++; cw = 0; } else { cw = 0; cl = 0; } w = Math.max(w, cw); l = Math.max(l, cl); } let cur = 0; for (let i = values.length - 1; i >= 0; i--) { const s = Math.sign(values[i] > EPS ? 1 : values[i] < -EPS ? -1 : 0); if (!s) break; if (!cur) cur = s; else if (Math.sign(cur) !== s) break; else cur += s; } return { maxWin: w, maxLoss: l, current: cur }; }
const sortedCache = new WeakMap();
function closedSorted(rows) { let r = sortedCache.get(rows); if (r) return r; r = rows.filter(t => t.status === 'Closed').map(t => [tradeTime(t) || '', t]).sort((a, b) => cmpStr(a[0], b[0])).map(x => x[1]); sortedCache.set(rows, r); return r.slice(); }
function startingCapitalOf(rows) { const ids = [...new Set(rows.map(t => t.accountId))]; return sum(ids.map(id => get('accounts', id)?.startingCapital || 0)); }

const statsCache = new WeakMap();
function stats(rows, u = ui.unit) { let m = statsCache.get(rows); if (!m) { m = new Map(); statsCache.set(rows, m); } const k = u + '|' + (state.settings.dayBasis || 'exit'); if (!m.has(k)) m.set(k, statsRaw(rows, u)); return m.get(k); }
function statsRaw(rows, u) {
  const closed = closedSorted(rows), cs = closed.map(calc);
  const nets = cs.map(c => c.net).filter(finite), rs = cs.map(c => c.r).filter(finite);
  const vals = closed.map(t => value(t, u)).filter(finite);
  const wins = nets.filter(n => n > EPS), losses = nets.filter(n => n < -EPS);
  const vw = vals.filter(v => v > EPS), vl = vals.filter(v => v < -EPS);
  const days = {}; closed.forEach(t => { const d = tradeDay(t); (days[d] ??= []).push(calc(t).net); });
  const dk = Object.keys(days).sort(), dv = dk.map(d => sum(days[d]));
  const start = startingCapitalOf(closed), dd = drawdown(nets, start), ddU = drawdown(vals), st = streaks(nets), dst = streaks(dv);
  const wr = nets.length ? wins.length / nets.length : null, aw = mean(wins), al = mean(losses);
  const avgV = mean(vals), sdV = sd(vals), avgWinV = mean(vw), avgLossV = mean(vl), payV = ratio(avgWinV, avgLossV != null ? -avgLossV : null);
  const durations = cs.map(c => c.duration).filter(finite);
  const gp = sum(wins), gl = sum(losses);
  // consistency: share of total profit made by best day (lower is more consistent)
  const bestDay = dv.length ? Math.max(...dv) : null;
  const s = {
    n: closed.length, open: rows.filter(t => t.status === 'Open').length, wins: wins.length, losses: losses.length, be: nets.length - wins.length - losses.length,
    net: sum(nets), gp, gl, wr: wr == null ? null : wr * 100, avg: mean(nets), aw, al,
    best: wins.length ? Math.max(...wins) : null, worst: losses.length ? Math.min(...losses) : null,
    pf: ratio(gp, gl ? -gl : 0), pay: ratio(aw, al != null ? -al : null),
    // unit-based
    total: vals.length ? sum(vals) : null, expectancy: avgV, avgWinU: avgWinV, avgLossU: avgLossV, pfU: ratio(sum(vw), sum(vl) ? -sum(vl) : 0), payU: payV,
    sharpe: sdV > EPS ? avgV / sdV : null, sqn: vals.length >= 2 && sdV > EPS ? avgV / sdV * Math.sqrt(Math.min(vals.length, 100)) : null,
    kelly: wr != null && payV > 0 && finite(payV) ? (wr - (1 - wr) / payV) * 100 : null, ddU: vals.length ? ddU.max : null, validU: vals.length,
    // R
    r: rs.length ? sum(rs) : null, avgR: mean(rs), validR: rs.length, avgWinR: mean(rs.filter(r => r > EPS)), avgLossR: mean(rs.filter(r => r < -EPS)),
    planned: mean(cs.map(c => c.planned).filter(finite)),
    // days
    days: dv.length, winDays: dv.filter(x => x > EPS).length, lossDays: dv.filter(x => x < -EPS).length, dayWr: dv.length ? dv.filter(x => x > EPS).length / dv.length * 100 : null,
    avgDay: mean(dv), avgWinDay: mean(dv.filter(x => x > EPS)), avgLossDay: mean(dv.filter(x => x < -EPS)), bestDay, worstDay: dv.length ? Math.min(...dv) : null,
    bestDayShare: bestDay > 0 && sum(nets) > 0 ? bestDay / sum(nets) * 100 : null,
    // drawdown
    dd: dd.max, ddPct: dd.maxPct, avgDd: dd.avg, avgDdPct: dd.avgPct, ddLongest: dd.longest,
    recovery: dd.max < -EPS ? sum(nets) / Math.abs(dd.max) : null,
    // streaks
    cw: st.maxWin, cl: st.maxLoss, curStreak: st.current, cwd: dst.maxWin, cld: dst.maxLoss,
    // costs, durations
    commission: sum(closed.map(t => t.commission || 0)), swap: sum(closed.map(t => t.swap || 0)),
    duration: mean(durations), winDuration: mean(cs.filter(c => c.net > EPS).map(c => c.duration)), lossDuration: mean(cs.filter(c => c.net < -EPS).map(c => c.duration)),
    maxDuration: durations.length ? Math.max(...durations) : null, minDuration: durations.length ? Math.min(...durations) : null,
    tradesPerDay: dv.length ? closed.length / dv.length : null, start, ret: start > 0 ? sum(nets) / start * 100 : null,
    mistakeTrades: closed.filter(t => (t.tags || []).some(isMistakeTag)).length,
    longN: closed.filter(t => t.side === 'Buy').length, shortN: closed.filter(t => t.side === 'Sell').length,
    longWr: (() => { const x = closed.filter(t => t.side === 'Buy').map(t => calc(t).net).filter(finite); return x.length ? x.filter(v => v > EPS).length / x.length * 100 : null; })(),
    shortWr: (() => { const x = closed.filter(t => t.side === 'Sell').map(t => calc(t).net).filter(finite); return x.length ? x.filter(v => v > EPS).length / x.length * 100 : null; })(),
    efficiency: mean(cs.map(c => c.efficiency).filter(finite)), maeR: mean(cs.map(c => c.maeR).filter(finite)), mfeR: mean(cs.map(c => c.mfeR).filter(finite)),
    dailyKeys: dk, dailyValues: dv
  };
  if (!monetaryAllowed(rows)) for (const k of ['net', 'gp', 'gl', 'avg', 'aw', 'al', 'best', 'worst', 'pf', 'pay', 'avgDay', 'avgWinDay', 'avgLossDay', 'bestDay', 'worstDay', 'dd', 'ddPct', 'avgDd', 'avgDdPct', 'commission', 'swap', 'recovery', 'ret']) s[k] = null;
  return s;
}


/* ---------- sessions & dimensions ---------- */
const sessionCache = new Map();
function sessionOf(t) { const v = t.entryDateTime || ''; let r = sessionCache.get(v); if (r === undefined) { r = sessionRaw(t); if (sessionCache.size > 200000) sessionCache.clear(); sessionCache.set(v, r); } return r; }
function sessionRaw(t) {
  // DST-aware: each session is judged in its own local time
  const v = t.entryDateTime; if (!v || !Number.isFinite(+new Date(v))) return 'Unknown';
  const hl = +dateParts(v, 'Europe/London').hour, hn = +dateParts(v, 'America/New_York').hour, ht = +dateParts(v, 'Asia/Tokyo').hour;
  const lon = hl >= 8 && hl < 17, ny = hn >= 8 && hn < 17;
  return lon && ny ? 'London–NY' : lon ? 'London' : ny ? 'New York' : (ht >= 7 && ht < 18) ? 'Asia' : 'After hours';
}
const SESSION_TH = { 'Asia': 'เอเชีย', 'London': 'ลอนดอน', 'London–NY': 'ลอนดอน–NY', 'New York': 'NY', 'After hours': 'นอกเวลา', 'Unknown': 'ไม่ทราบ' };
const SESSION_EN = { 'New York': 'NY' };
const sessionLabel = s => L(SESSION_TH[s] || s, SESSION_EN[s] || s);
const ALL_DIMS = () => [
  ['instrument', L('สินทรัพย์', 'Instrument')], ['assetClass', L('ประเภทสินทรัพย์', 'Asset class')], ['playbook', 'Strategy'], ['setup', L('Setup (แท็ก)', 'Setup tag')], ['mistake', L('ความผิดพลาด', 'Mistake')], ['context', L('บริบทตลาด', 'Market context')], ['tag', L('แท็กทั้งหมด', 'All tags')],
  ['side', L('ทิศทาง', 'Side')], ['weekday', L('วันในสัปดาห์', 'Weekday')], ['hour', L('ชั่วโมงที่เข้า', 'Entry hour')], ['session', 'Session'], ['timeframe', 'Timeframe'], ['rbin', 'R-Multiple'], ['month', L('เดือน', 'Month')], ['week', L('สัปดาห์', 'Week')],
  ['duration', L('ระยะเวลาถือ', 'Holding time')], ['rrange', L('ช่วง R', 'R range')], ['emotion', L('อารมณ์', 'Emotion')], ['rating', L('คะแนนการเทรด', 'Trade rating')], ['account', L('บัญชี', 'Account')]
];
const dimLabel = k => String(k).startsWith('tagcat:') ? (state.tagCategories.find(c => c.id === k.slice(7))?.name || L('แท็ก', 'Tags')) : (ALL_DIMS().find(d => d[0] === k) || [k, k])[1];
/* Dimensions offered in Breakdown: only the ones that answer a decision.
   Outcome-based (R range, rating), duplicated (mistake, emotion → Psychology; month/week → Statistics)
   and over-fragmented (hour, all tags) dimensions stay available to other pages but are not offered here. */
const CORE_DIMS = ['playbook', 'setup', 'instrument', 'session', 'weekday', 'side', 'duration', 'context'];
function breakdownDims(rows) {
  const closed = closedSorted(rows), out = CORE_DIMS.slice();
  for (const [dim, cat] of [['context', 'cat_context'], ['setup', 'cat_setups']]) if (!closed.some(t => (t.tags || []).some(id => get('tags', id)?.categoryId === cat))) out.splice(out.indexOf(dim), 1);
  if (new Set(closed.map(t => get('instruments', t.instrumentId)?.assetClass)).size >= 2) out.splice(out.indexOf('instrument') + 1, 0, 'assetClass');
  if (new Set(closed.map(t => t.accountId)).size >= 2) out.push('account');
  return out.map(k => [k, dimLabel(k)]);
}
/* R-Multiple buckets (v3.26): 1R wide from −10R to +10R, plus the two tails → 22 bins */
const RB_LO = -10, RB_HI = 10, RB_N = RB_HI - RB_LO + 2;
function rbinOf(r) { if (!finite(r)) return '—'; if (r < RB_LO) return '0'; if (r >= RB_HI) return String(RB_N - 1); return String(1 + Math.floor(r - RB_LO)); }
function rbinLabel(i) { const f = v => fmt(v, 1, true).replace('-', '−'); if (i === 0) return `< ${f(RB_LO)}R`; if (i === RB_N - 1) return `≥ ${f(RB_HI)}R`; const lo = RB_LO + i - 1; return `${f(lo)}R … ${f(lo + 1)}R`; }
function groupKeys(t, dim) {
  const c = calc(t), d = entryDay(t);
  if (String(dim).startsWith('tagcat:')) { const cat = dim.slice(7), k = (t.tags || []).filter(id => get('tags', id)?.categoryId === cat).map(id => nameOf('tags', id)); return k.length ? k : [L('ไม่มีแท็กในหมวดนี้', 'None in this category')]; }
  switch (dim) {
    case 'rbin': return [rbinOf(c.r)];
    case 'instrument': return [nameOf('instruments', t.instrumentId, 'symbol')];
    case 'assetClass': { const a = get('instruments', t.instrumentId)?.assetClass || 'Other'; return [a]; }
    case 'playbook': return [t.playbookId ? nameOf('playbooks', t.playbookId) : L('ไม่มี Strategy', 'No strategy')];
    case 'setup': case 'mistake': case 'context': { const cat = { setup: 'cat_setups', mistake: 'cat_mistakes', context: 'cat_context' }[dim]; const k = (t.tags || []).filter(id => get('tags', id)?.categoryId === cat).map(id => nameOf('tags', id)); return k.length ? k : [dim === 'mistake' ? L('ไม่มีความผิดพลาด', 'No mistake') : L('ไม่ระบุ', 'Untagged')]; }
    case 'tag': { const k = (t.tags || []).map(id => nameOf('tags', id)); return k.length ? k : [L('ไม่มีแท็ก', 'Untagged')]; }
    case 'side': return [t.side === 'Buy' ? 'Long' : 'Short'];
    case 'weekday': return d ? [String(weekdayOfKey(d))] : ['?'];
    case 'hour': { const p = dateParts(t.entryDateTime); return [p ? p.hour + ':00' : '?']; }
    case 'session': return [sessionOf(t)];
    case 'timeframe': return [t.timeframe || '—'];
    case 'month': return [tradeDay(t).slice(0, 7)];
    case 'week': return [weekStartKey(tradeDay(t))];
    case 'duration': { const m = c.duration; if (!finite(m)) return ['—']; return [m < 5 ? '0' : m < 15 ? '1' : m < 30 ? '2' : m < 60 ? '3' : m < 120 ? '4' : m < 240 ? '5' : m < 1440 ? '6' : '7']; }
    case 'rrange': { const r = c.r; if (!finite(r)) return ['—']; return [r <= -2 ? '0' : r <= -1 ? '1' : r < 0 ? '2' : r < 1 ? '3' : r < 2 ? '4' : r < 3 ? '5' : '6']; }
    case 'emotion': return [t.emotion || '—'];
    case 'rating': return [t.rating ? String(t.rating) : '—'];
    case 'account': return [nameOf('accounts', t.accountId)];
    default: return ['—'];
  }
}
const DUR_LABELS = () => [L('< 5 นาที', '< 5m'), L('5–15 นาที', '5–15m'), L('15–30 นาที', '15–30m'), L('30–60 นาที', '30–60m'), L('1–2 ชม.', '1–2h'), L('2–4 ชม.', '2–4h'), L('4–24 ชม.', '4–24h'), L('> 1 วัน', '> 1d')];
const RR_LABELS = ['≤ −2R', '−2R…−1R', '−1R…0', '0…+1R', '+1R…+2R', '+2R…+3R', '≥ +3R'];
function dimKeyLabel(dim, key) {
  if (key === '—' || key === '?') return '—';
  switch (dim) {
    case 'weekday': return dayName(Number(key), true);
    case 'duration': return DUR_LABELS()[Number(key)] ?? key;
    case 'rrange': return RR_LABELS[Number(key)] ?? key;
    case 'rbin': return rbinLabel(Number(key));
    case 'session': return sessionLabel(key);
    case 'month': { const [y, m] = key.split('-'); return monthName(Number(m) - 1) + ' ' + y; }
    case 'week': return L('สัปดาห์ ', 'Wk ') + fmtDate(key, { year: false });
    case 'assetClass': return L(ASSET_TH[key] || key, key);
    case 'emotion': return emotionLabel(key);
    case 'rating': return L(`คะแนน ${key}/5`, `${key}/5`);
    case 'side': return key === 'Long' ? L('Long (ซื้อ)', 'Long') : L('Short (ขาย)', 'Short');
    default: return key;
  }
}
const SESSION_ORDER = ['Asia', 'London', 'London–NY', 'New York', 'After hours', 'Unknown'];
function dimKeySort(dim) { if (dim === 'session') return (a, b) => SESSION_ORDER.indexOf(a.key) - SESSION_ORDER.indexOf(b.key); if (dim === 'timeframe') return (a, b) => (TIMEFRAMES.indexOf(a.key) + 1 || 99) - (TIMEFRAMES.indexOf(b.key) + 1 || 99); return ['weekday', 'duration', 'rrange', 'rating', 'rbin'].includes(dim) ? (a, b) => { const o = k => dim === 'weekday' ? ((Number(k) - (state.settings.weekStart ?? 1) + 7) % 7) : Number(k); return (o(a.key) || 0) - (o(b.key) || 0); } : ['month', 'week', 'hour'].includes(dim) ? (a, b) => a.key.localeCompare(b.key) : null; }
const groupCache = new WeakMap();
function group(rows, dim) { let m = groupCache.get(rows); if (!m) { m = new Map(); groupCache.set(rows, m); } const k = dim + '|' + ui.unit + '|' + LANG + '|' + (state.settings.dayBasis || 'exit'); if (!m.has(k)) m.set(k, groupRaw(rows, dim)); return m.get(k); }
function groupRaw(rows, dim) {
  const map = new Map();
  rows.filter(t => t.status === 'Closed').forEach(t => groupKeys(t, dim).forEach(k => { if (!map.has(k)) map.set(k, []); map.get(k).push(t); }));
  const out = [...map].map(([key, rs]) => ({ key, label: dimKeyLabel(dim, key), rows: rs, s: stats(rs) }));
  const sorter = dimKeySort(dim);
  return sorter ? out.sort(sorter) : out.sort((a, b) => (b.s.total ?? -Infinity) - (a.s.total ?? -Infinity));
}

/* ---------- series ---------- */
function cumulativeSeries(rows, u = ui.unit) {
  let acc = 0; return closedSorted(rows).filter(t => finite(value(t, u))).map(t => { acc += value(t, u); return { x: tradeDay(t), y: acc, id: t.id, label: nameOf('instruments', t.instrumentId, 'symbol') }; });
}
function dailySeries(rows, u = ui.unit) {
  const m = new Map(); closedSorted(rows).forEach(t => { const v = value(t, u); if (!finite(v)) return; const d = tradeDay(t); m.set(d, (m.get(d) || 0) + v); });
  return [...m].sort((a, b) => cmpStr(a[0], b[0])).map(([x, y]) => ({ x, y }));
}
function drawdownSeries(rows, u = ui.unit) {
  const c = closedSorted(rows).filter(t => finite(value(t, u))); const dd = drawdown(c.map(t => value(t, u))).dd;
  return c.map((t, i) => ({ x: tradeDay(t), y: dd[i] }));
}
function balanceSeries(rows) {
  const accounts = currentAccounts(); if (new Set(accounts.map(a => a.currency)).size > 1 || !accounts.length) return [];
  const bal = Object.fromEntries(accounts.map(a => [a.id, a.startingCapital || 0])), ids = new Set(accounts.map(a => a.id)), sel = new Set(rows.map(t => t.id));
  const ev = [...state.trades.filter(t => t.status === 'Closed' && ids.has(t.accountId)).map(t => ({ date: t.exitDateTime, acc: t.accountId, v: calc(t).net, sel: sel.has(t.id) })), ...state.transactions.filter(t => ids.has(t.accountId)).map(t => ({ date: t.dateTime, acc: t.accountId, v: t.type === 'Adjustment' ? t.amount : txnValue(t), reset: t.type === 'Reset', sel: true }))].filter(e => e.date).sort((a, b) => cmpStr(String(a.date), String(b.date)));
  let open = sum(Object.values(bal)); const out = [];
  for (const e of ev) { const d = dateKey(e.date); if (ui.to && d > ui.to) break; bal[e.acc] = e.reset ? e.v : bal[e.acc] + (e.v || 0); if (ui.from && d < ui.from) { open = sum(Object.values(bal)); continue; } if (e.sel) out.push({ x: d, y: sum(Object.values(bal)) }); }
  return [{ x: ui.from || (out[0]?.x ?? ''), y: open }, ...out];
}

/* ---------- discipline & rules ---------- */
function dayDiscipline(dayKey, accountId = ui.account) {
  const R = state.settings.rules || {};
  const byDay = memoize('byDay', () => { const m = new Map(); for (const t of state.trades) { if (t.status === 'Void' || t.status === 'Missed') continue; const d = tradeDay(t); if (!m.has(d)) m.set(d, []); m.get(d).push(t); } for (const arr of m.values()) arr.sort((a, b) => cmpStr(String(tradeTime(a)), String(tradeTime(b)))); return m; });
  const rows = (byDay.get(dayKey) || []).filter(t => !accountId || t.accountId === accountId);
  const closed = rows.filter(t => t.status === 'Closed'), net = sum(closed.map(t => calc(t).net));
  const accs = accountId ? [get('accounts', accountId)].filter(Boolean) : state.accounts.filter(a => a.active !== false);
  const startBal = sum(accs.map(a => accountBalance(a.id, +new Date(toISO(dayKey + 'T00:00')))));
  const lossLimit = R.maxDailyLossPct > 0 && startBal > 0 ? -startBal * R.maxDailyLossPct / 100 : null;
  const st = streaks(closed.map(t => calc(t).net));
  const issues = [];
  if (lossLimit != null && net <= lossLimit) issues.push(L('ขาดทุนเกินขีดจำกัดรายวัน', 'Daily loss limit hit'));
  if (R.maxTradesPerDay > 0 && rows.length > R.maxTradesPerDay) issues.push(L(`เทรดเกิน ${R.maxTradesPerDay} ไม้/วัน`, `More than ${R.maxTradesPerDay} trades`));
  if (R.maxConsecLosses > 0 && st.maxLoss >= R.maxConsecLosses) issues.push(L(`แพ้ติดกัน ${st.maxLoss} ไม้`, `${st.maxLoss} losses in a row`));
  const noStop = rows.filter(t => t.stopLoss == null).length; if (R.requireStop && noStop) issues.push(L(`${noStop} ไม้ไม่มี S/L`, `${noStop} trades without a stop level`));
  const mistakes = rows.filter(t => (t.tags || []).some(isMistakeTag)).length; if (mistakes) issues.push(L(`${mistakes} ไม้มีความผิดพลาด`, `${mistakes} trades with mistakes`));
  return { rows, closed, net, lossLimit, lossUsed: lossLimit ? clamp(net / lossLimit * 100, 0, 999) : null, trades: rows.length, maxTrades: R.maxTradesPerDay, issues, startBal };
}
function ruleBreakers(t) {
  const R = state.settings.rules || {}, out = [], c = calc(t);
  if (R.requireStop && t.stopLoss == null) out.push(L('ไม่มี S/L', 'No S/L'));
  if (R.minRR > 0 && finite(c.planned) && c.planned + EPS < R.minRR) out.push(L(`R:R ที่วางแผน ${fmt(c.planned, 2)} ต่ำกว่า ${fmt(R.minRR, 1)}`, `Planned R:R ${fmt(c.planned, 2)} below ${fmt(R.minRR, 1)}`));
  const acc = get('accounts', t.accountId);
  if (acc && finite(c.risk) && state.settings.riskWarning > 0) { const bal = accountBalance(acc.id, +new Date(t.entryDateTime)); if (bal > 0 && c.risk / bal * 100 > state.settings.riskWarning + 1e-6) out.push(L(`เสี่ยง ${fmt(c.risk / bal * 100, 2)}% เกินเกณฑ์ ${fmt(state.settings.riskWarning, 1)}%`, `Risk ${fmt(c.risk / bal * 100, 2)}% above ${fmt(state.settings.riskWarning, 1)}%`)); }
  return out;
}

/* ---------- prop-firm objectives ---------- */
function objectiveStatus(acc) {
  const o = acc.objective || {}; if (!o.enabled) return null;
  const ev = accountEvents(acc.id), start = acc.startingCapital || 0;
  let bal = start, peak = start, maxDdHit = 0; const daily = new Map();
  for (const e of ev) { if (e.reset) { bal = e.v; peak = bal; continue; } bal += e.v || 0; peak = Math.max(peak, bal); const floor = o.ddMode === 'trailing' ? peak : start; maxDdHit = Math.max(maxDdHit, (floor - bal) / start * 100); if (e.kind === 'trade') { const d = e.day; daily.set(d, (daily.get(d) || 0) + e.v); } }
  const profitPct = start ? (bal - start) / start * 100 : 0, worstDay = daily.size ? Math.min(...daily.values()) : 0, worstDayPct = start ? Math.min(0, worstDay) / start * 100 : 0;
  const today = daily.get(todayKey()) || 0, todayPct = start ? today / start * 100 : 0;
  const ddNowPct = start ? ((o.ddMode === 'trailing' ? peak : start) - bal) / start * 100 : 0;
  const days = daily.size;
  const breached = (o.maxDrawdownPct > 0 && maxDdHit >= o.maxDrawdownPct) || (o.maxDailyLossPct > 0 && -worstDayPct >= o.maxDailyLossPct);
  const passed = !breached && o.profitTargetPct > 0 && profitPct >= o.profitTargetPct && days >= (o.minTradingDays || 0);
  return { profitPct, target: o.profitTargetPct, ddNowPct: Math.max(0, ddNowPct), maxDdHit, maxDd: o.maxDrawdownPct, todayPct, worstDayPct, maxDaily: o.maxDailyLossPct, days, minDays: o.minTradingDays || 0, breached, passed, bal, room: o.maxDrawdownPct > 0 ? start * o.maxDrawdownPct / 100 - Math.max(0, (o.ddMode === 'trailing' ? peak : start) - bal) : null };
}

/* ---------- Monte Carlo ---------- */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); }; }
function monteCarlo(samples, { runs = 500, trades = 100, riskPct = 1, start = 10000, ruin = 30, basis = 'R', seed = 7 } = {}) {
  if (samples.length < 5) return null;
  const rand = rng(seed + samples.length), paths = [], finals = [], dds = []; let ruined = 0;
  for (let i = 0; i < runs; i++) {
    let bal = start, peak = start, mdd = 0, hit = false; const path = [bal];
    for (let k = 0; k < trades; k++) {
      const x = samples[Math.floor(rand() * samples.length)];
      bal += basis === 'R' ? bal * riskPct / 100 * x : x; if (bal < 0) bal = 0;
      peak = Math.max(peak, bal); const dd = peak > 0 ? (peak - bal) / peak * 100 : 100; mdd = Math.max(mdd, dd); if (dd >= ruin) hit = true; path.push(bal);
    }
    if (hit) ruined++; paths.push(path); finals.push(bal); dds.push(mdd);
  }
  const bands = []; for (let k = 0; k <= trades; k++) { const col = paths.map(p => p[k]).sort((a, b) => a - b); bands.push({ x: k, p5: quantile(col, .05), p25: quantile(col, .25), p50: quantile(col, .5), p75: quantile(col, .75), p95: quantile(col, .95) }); }
  const fs = finals.slice().sort((a, b) => a - b), ds = dds.slice().sort((a, b) => a - b);
  return { bands, sample: paths.slice(0, 30), medianFinal: quantile(fs, .5), p5Final: quantile(fs, .05), p95Final: quantile(fs, .95), medianDD: quantile(ds, .5), p95DD: quantile(ds, .95), ruinPct: ruined / runs * 100, profitPct: finals.filter(f => f > start).length / runs * 100, start };
}
