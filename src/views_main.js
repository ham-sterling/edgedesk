/* ============================================================
   SHELL · DASHBOARD · TRADES · TRADE DETAIL · TRADE EDITOR
   ============================================================ */
const NAV = () => [
  [L('พื้นที่ทำงาน', 'Workspace'), [['dashboard', L('ภาพรวม', 'Dashboard'), 'dashboard'], ['trades', L('รายการเทรด', 'Trades'), 'trades', 'trades'], ['playbooks', 'Strategies', 'playbooks'], ['notes', L('สมุดโน้ต', 'Notebook'), 'notebook'], ['reports', L('วิเคราะห์', 'Analytics'), 'reports'], ['accounts', L('บัญชี', 'Accounts'), 'accounts'], ['calculator', L('เครื่องคำนวณ', 'Calculator'), 'calculator']]],
  [L('ระบบ', 'System'), [['settings', L('ตั้งค่า', 'Settings'), 'settings'], ['help', L('คู่มือ', 'Guide'), 'help']]]
];
function routeRoot() { return ui.route.split('/')[0]; }
function navActive(r) { const cur = ui.route; if (r === 'reports') return cur === 'reports' || cur.startsWith('reports/'); if (r.includes('/')) return cur.startsWith(r); return cur === r || cur.startsWith(r + '/') && !NAV().flatMap(g => g[1]).some(x => x[0] !== r && x[0].startsWith(r + '/') && cur.startsWith(x[0])); }
function shell() {
  const fc = activeFilterCount(), th = state.settings.theme;
  const counts = { trades: state.trades.filter(t => t.status === 'Open').length };
  return `<a class="skip" href="#main">${L('ข้ามไปเนื้อหา', 'Skip to content')}</a><div class="shell ${ui.sidebarCollapsed ? 'collapsed' : ''}" id="shell">
  <aside class="sidebar"><a class="brand" href="#dashboard"><div class="mark">${icon('activity')}</div><span>edgedesk<span class="accent">.</span><small>Trading Journal · v${APP_VERSION}</small></span></a>
  <nav aria-label="${L('เมนูหลัก', 'Main')}">${NAV().map(([g, items]) => `<div class="navgroup">${g ? `<div class="navlabel">${g}</div>` : ''}${items.map(([r, l, ic, c]) => `<a class="navlink ${navActive(r) ? 'on' : ''}" href="#${r === 'calculator' ? '' : r}" ${r === 'calculator' ? 'data-action="calc-size"' : ''} title="${esc(l)}">${icon(ic)}<span>${l}</span>${c && counts[c] ? `<em class="count">${counts[c]}</em>` : ''}</a>`).join('')}</div>`).join('')}</nav>
  <div class="side-foot"><div class="store" title="${esc(storageType)}">${icon('lock')}<span class="txt" id="save-state">${CLOUD ? (cloud.offline ? L('ออฟไลน์ — รอซิงก์', 'Offline — waiting to sync') : cloud.lastSync ? L('ซิงก์ขึ้นคลาวด์แล้ว · ', 'Synced · ') + new Date(cloud.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : L('ข้อมูลอยู่บนคลาวด์', 'Stored in the cloud')) : state.meta.updatedAt ? L('บันทึกในเครื่องแล้ว', 'Saved on this device') : L('พื้นที่ทำงานส่วนตัว', 'Private workspace')}</span></div>
  ${abNeedsPermission ? `<a class="navlink warn" href="#" data-action="ab-now" title="${L('ยืนยันสิทธิ์โฟลเดอร์สำรอง', 'Confirm backup folder access')}">${icon('save')}<span>${L('กดเพื่อสำรองอัตโนมัติ', 'Click to run auto backup')}</span></a>` : ''}
  ${(() => { const lb = Date.parse(state.meta.lastBackup || '') || 0, days = Math.floor((Date.now() - lb) / 864e5); return state.trades.length >= 10 && days >= 7 ? `<a class="navlink warn" href="#" data-action="backup" title="${L('สำรองข้อมูลตอนนี้', 'Back up now')}">${icon('alert')}<span>${lb ? L(`สำรองล่าสุด ${days} วันก่อน`, `Last backup ${days}d ago`) : L('ยังไม่เคยสำรองข้อมูล', 'Never backed up')}</span></a>` : ''; })()}
  <a class="navlink" href="#" data-action="toggle-collapse" title="${L('ย่อ/ขยายเมนู', 'Collapse')}">${icon(ui.sidebarCollapsed ? 'chev-right' : 'chev-left')}<span>${L('ย่อเมนู', 'Collapse')}</span></a></div></aside>
  <div class="workspace"><header class="topbar">
    ${ibtn('menu', 'mobile-nav', L('เมนู', 'Menu'), {}, 'mobile-only')}
    <button class="btn searchbtn" data-action="palette">${icon('search')}<span>${L('ค้นหา', 'Search')}</span><kbd>${MOD_KEY} K</kbd></button>
    <div class="grow"></div>
    ${sessionChipHTML()}
    <button class="btn icon-only fbtn ${fc ? 'on' : ''}" data-action="filters" aria-label="${L('ตัวกรองทั้งระบบ', 'Global filters')}" data-tip="${L('ตัวกรองทั้งระบบ', 'Global filters')}">${icon('filter')}${fc ? `<span class="fbadge">${fc}</span>` : ''}</button>
    <select class="tsel" data-ui="preset" aria-label="${L('ช่วงเวลา', 'Date range')}">${PRESETS().map(([v, l]) => opt(v, v === 'custom' && ui.preset === 'custom' && ui.from ? `${fmtDate(ui.from, { short: true })} – ${fmtDate(ui.to || todayKey(), { short: true })}` : l, ui.preset)).join('')}</select>
    <select class="tsel" data-ui="unit" aria-label="${L('หน่วยแสดงผล', 'Unit')}">${[['P&L', 'P&L'], ['R', 'R-Multiple'], ['%', 'Change %'], ['Pips', 'Pips'], ['Points', 'Points']].map(([v, l]) => opt(v, l, ui.unit)).join('')}</select>
    <select class="tsel desk-only" data-ui="account" aria-label="${L('บัญชี', 'Account')}">${entityOptions('accounts', ui.account, L('ทุกบัญชี', 'All accounts'))}</select>
    <button class="btn primary" data-action="new-trade">${icon('plus')}<span class="desk-only">${L('เทรดใหม่', 'New trade')}</span></button>
    ${ibtn(th === 'dark' ? 'moon' : 'sun', 'theme', L('สลับธีม', 'Toggle theme'))}
    <button class="btn ghost icon-only" data-action="lang" aria-label="Language" data-tip="${LANG === 'th' ? 'English' : 'ภาษาไทย'}"><span class="b small">${LANG === 'th' ? 'TH' : 'EN'}</span></button>
  </header><main class="content" id="main">${view()}</main></div></div>`;
}
function view() {
  const [root, sub, sub2] = ui.route.split('/');
  switch (root) {
    case 'dashboard': return dashboardView();
    case 'trades': return tradesView();
    case 'playbooks': return sub ? playbookDetailView(sub, sub2) : playbooksView();
    case 'notes': return notesView(sub, sub2);
    case 'reports': return reportsView(sub || 'overview', sub2);
    case 'accounts': return sub === 'transactions' ? transactionsView() : accountsView();
    case 'settings': return settingsView(sub || 'general');
    case 'help': return helpView();
    default: return dashboardView();
  }
}
function scopeLine(rows) {
  const parts = [];
  if (ui.preset !== 'all') parts.push(PRESETS().find(p => p[0] === ui.preset)?.[1] + (ui.from ? ` (${fmtDate(ui.from)} – ${fmtDate(ui.to || todayKey())})` : ''));
  if (ui.account) parts.push(nameOf('accounts', ui.account));
  const fc = activeFilterCount(); if (fc) parts.push(L(`ตัวกรอง ${fc} รายการ`, `${fc} filters`));
  const mixed = !monetaryAllowed(rows);
  return (parts.length ? `<div class="chipbar">${parts.map(p => `<span class="fchip">${esc(p)}</span>`).join('')}${btn(L('ล้างทั้งหมด', 'Clear all'), 'clear-scope', {}, 'ghost sm')}</div>` : '') + (mixed && ui.unit === 'P&L' ? `<div class="notice warn mb16">${icon('alert')}<span>${L('มีหลายสกุลเงินบัญชีในมุมมองนี้ — ตัวเลขเงินรวมจะไม่แสดง เลือกบัญชีเดียวหรือเปลี่ยนหน่วยเป็น R', 'Multiple account currencies — monetary totals hidden. Pick one account or switch to R.')}</span></div>` : '');
}

/* ---------------- DASHBOARD ---------------- */
function dashboardView() {
  if (!state.trades.length) return welcomeView();
  const rows = filtered(), s = stats(rows), u = ui.unit, cum = cumulativeSeries(rows);
  const hello = (() => { const h = +(dateParts(now())?.hour || 12); return h < 12 ? L('อรุณสวัสดิ์', 'Good morning') : h < 17 ? L('สวัสดีตอนบ่าย', 'Good afternoon') : L('สวัสดีตอนเย็น', 'Good evening'); })();
  const hh = +(dateParts(now())?.hour || 12), helloIc = hh < 12 ? 'sunrise' : hh < 17 ? 'sun' : hh < 19 ? 'sunset' : 'moon';
  const pfPct = finite(s.pfU) ? clamp(s.pfU / 3 * 100, 0, 100) : 0, pfCls = !finite(s.pfU) ? 'muted' : s.pfU >= 1.5 ? 'pos' : s.pfU >= 1 ? 'accent' : 'neg';
  const expPct = finite(s.expectancy) && finite(s.avgWinU) && finite(s.avgLossU) ? clamp((s.expectancy - s.avgLossU) / ((s.avgWinU - s.avgLossU) || 1) * 100, 0, 100) : 50;
  const wv = Math.abs(s.avgWinU || 0), lv = Math.abs(s.avgLossU || 0), wp = wv + lv ? wv / (wv + lv) * 100 : 50;
  const hero = `<div class="hero">
    <div class="card"><div><div class="l">${L('กำไร/ขาดทุนสุทธิ', 'Net P&L')}</div><div class="v ${tone(s.total)}">${unitFmt(s.total, u)}</div><div class="s">${s.n} ${L('เทรด', 'trades')} · ${s.open} ${L('เปิดอยู่', 'open')}</div></div><div class="viz">${sparkline(cum.map(p => p.y))}</div></div>
    <div class="card"><div><div class="l" data-tip="${L('เทรดชนะ ÷ เทรดที่ปิดแล้ว', 'Winning ÷ closed trades')}">${L('อัตราชนะ', 'Win rate')}</div><div class="v">${finite(s.wr) ? fmt(s.wr, 1) + '%' : '—'}</div><div class="s">${L('วันที่กำไร', 'Day win')} ${finite(s.dayWr) ? fmt(s.dayWr, 0) + '%' : '—'}</div></div><div class="viz">${wlGauge(s.wins, s.be, s.losses)}</div></div>
    <div class="card"><div><div class="l" data-tip="${L('กำไรรวม ÷ ขาดทุนรวม', 'Gross profit ÷ gross loss')}">Profit Factor</div><div class="v">${fmt(s.pfU, 2)}</div><div class="s">${s.pfU >= 1.5 ? L('แข็งแรง', 'Strong') : s.pfU >= 1 ? L('มีกำไร', 'Profitable') : L('ต้องปรับปรุง', 'Needs work')}</div></div><div class="viz">${arcGauge(pfPct, pfCls)}</div></div>
    <div class="card"><div><div class="l" data-tip="${L('ผลลัพธ์เฉลี่ยต่อเทรด', 'Average result per trade')}">${L('ค่าคาดหวัง', 'Expectancy')}</div><div class="v ${tone(s.expectancy)}">${unitFmt(s.expectancy, u)}</div><div class="s">${L('เฉลี่ย', 'Avg')} ${finite(s.avgR) ? fmt(s.avgR, 2, true) + 'R' : '—'}</div></div><div class="viz">${arcGauge(expPct, tone(s.expectancy) === 'muted' ? 'muted' : tone(s.expectancy))}</div></div>
    <div class="card"><div><div class="l">${L('กำไรเฉลี่ย / ขาดทุนเฉลี่ย', 'Average profit / loss')}</div><div class="v">${fmt(s.payU, 2)}</div><div class="s">${L('Payoff ratio', 'Payoff ratio')}</div></div><div class="viz"><div><div class="ratio-bar"><span style="width:${wp}%;background:var(--pos)"></span><span style="width:${100 - wp}%;background:var(--neg)"></span></div><div class="ratio-vals"><span class="pos">${unitFmt(s.avgWinU, u, false)}</span><span class="neg">${unitFmt(s.avgLossU, u)}</span></div></div></div></div>
  </div>`;
  const eqMode = ui.eqMode === 'balance' ? 'balance' : 'cum';
  const eqSpec = eqMode === 'balance' ? { type: 'line', series: [{ name: L('ยอดเงิน', 'Balance'), data: balanceSeries(rows), area: true }], unit: 'P&L', zero: false, empty: L('เลือกบัญชีสกุลเงินเดียวเพื่อดูยอดเงิน', 'Select one currency to see balance') } : { type: 'line', series: [{ name: 'Cumulative', data: cum }], signed: true, unit: u };
  const equity = panel(L('กราฟผลตอบแทนสะสม', 'Equity curve'), chartBox(eqSpec, 230), seg([['cum', L('สะสม', 'Cumulative')], ['balance', L('ยอดเงิน', 'Balance')]], eqMode, 'eq-mode'), '', `<span class="hv ${tone(s.total)}">${unitFmt(s.total, u)}</span>`);
  const ddP = panel('Drawdown', chartBox({ type: 'line', series: [{ name: 'Drawdown', data: drawdownSeries(rows), area: true, color: 'var(--neg)' }], unit: u }, 230), '', '', `Max drawdown <span class="neg">${unitFmt(s.ddU, u)}</span>${finite(s.ddPct) ? ` · ${fmt(s.ddPct, 2)}%` : ''}`);
  const daily = dailySeries(rows).slice(-45);
  const dailyP = panel(L('ผลรายวัน', 'Daily P&L'), chartBox({ type: 'bar', data: daily, unit: u }, 230), '', '', L(`${daily.length} วันล่าสุดที่มีเทรด`, `Last ${daily.length} trading days`));
  const recent = closedSorted(rows).slice(-7).reverse(), openT = rows.filter(t => t.status === 'Open');
  const recentP = panel(L('เทรดล่าสุด', 'Recent trades'), `<div class="tl">${[...openT.slice(0, 3), ...recent].slice(0, 8).map(t => { const c = calc(t); return `<div class="tl-row" data-action="view-trade" data-id="${t.id}">${insIcon(get('instruments', t.instrumentId))}<div class="grow"><strong>${esc(nameOf('instruments', t.instrumentId, 'symbol'))}</strong> ${sideBadge(t.side)}<small class="sub2">${fmtDate(t.status === 'Open' ? t.entryDateTime : t.exitDateTime, { time: true })}</small></div>${t.status === 'Open' ? badge(L('เปิดอยู่', 'OPEN'), 'st open') : `<div class="right"><strong class="${tone(c.net)}">${unitFmt(value(t), u)}</strong><small class="sub2">${finite(c.r) ? fmt(c.r, 2, true) + 'R' : ''}</small></div>`}</div>`; }).join('') || empty(L('ยังไม่มีเทรด', 'No trades yet'))}</div>`, `<a class="btn ghost sm" href="#trades">${L('ดูทั้งหมด', 'View all')} ${icon('chev-right')}</a>`);
  const calP = panel(`${monthName(ui.month, true)} ${ui.year}`, calendarHTML(rows, ui.year, ui.month), `${ibtn('chev-left', 'cal-month', L('เดือนก่อน', 'Previous'), { 'data-dir': -1 })}${btn(L('วันนี้', 'Today'), 'cal-today', {}, 'ghost sm')}${ibtn('chev-right', 'cal-month', L('เดือนถัดไป', 'Next'), { 'data-dir': 1 })}`);
  const vals = closedSorted(rows).map(t => calc(t).r).filter(finite), bins = [['<−2', '< −2R', v => v < -2], ['−2', '−2R … −1.5R', v => v >= -2 && v < -1.5], ['−1.5', '−1.5R … −1R', v => v >= -1.5 && v < -1], ['−1', '−1R … −0.5R', v => v >= -1 && v < -.5], ['−.5', '−0.5R … 0R', v => v >= -.5 && v < -EPS], ['BE', L('เสมอทุน', 'Breakeven'), v => Math.abs(v) <= EPS], ['0', '0R … +0.5R', v => v > EPS && v < .5], ['.5', '+0.5R … +1R', v => v >= .5 && v < 1], ['1', '+1R … +1.5R', v => v >= 1 && v < 1.5], ['1.5', '+1.5R … +2R', v => v >= 1.5 && v < 2], ['2', '+2R … +3R', v => v >= 2 && v < 3], ['3+', '≥ +3R', v => v >= 3]];
  const hist = bins.map(([l, tip, f], i) => { const n = vals.filter(f).length; return { x: l, label: l, y: n, color: i < 5 ? 'var(--neg)' : i === 5 ? 'var(--dim)' : 'var(--pos)', tip, sub: n + L(' เทรด', ' trades') }; });
  const distP = panel(L('การกระจายของ R-Multiple', 'R-multiple distribution'), chartBox({ type: 'bar', data: hist, unit: 'count', categorical: true, signed: false, valueLabels: true, tipFmt: v => fmt(v, 0) + L(' เทรด', ' trades') }, 230), '', '', L(`${vals.length} เทรดที่มีระดับ Stop`, `${vals.length} trades with a stop`));
  const byIns = group(rows, 'instrument').slice(0, 7).map(g => ({ label: g.label, y: g.s.total ?? 0, sub: `${g.s.n} ${L('เทรด', 'trades')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(g.s.wr, 0)}%` }));
  const insP = panel(L('ผลตามสินทรัพย์', 'By instrument'), chartBox({ type: 'hbar', data: byIns, unit: u, valueFmt: v => unitFmt(v, u) }, Math.max(160, byIns.length * 34)), `<a class="btn ghost sm" href="#reports/drill" data-action="go-dim" data-dim="instrument">${icon('layers')}</a>`);
  const bySess = group(rows, 'session').map(g => ({ label: g.label, y: g.s.total ?? 0, sub: `${g.s.n} ${L('เทรด', 'trades')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(g.s.wr, 0)}%` }));
  const sessP = panel(L('ผลตาม Session', 'By session'), chartBox({ type: 'hbar', data: bySess, unit: u, valueFmt: v => unitFmt(v, u) }, Math.max(160, bySess.length * 34)), '', '', L('อ้างอิงเวลาเข้า ตามเวลาท้องถิ่นของแต่ละตลาด', 'Based on entry time in each market’s local time'));
  return pageHead(`<span class="row gap8"><span class="hello-ic">${icon(helloIc)}</span>${hello}</span>`, `${fmtDate(todayKey())} · ${L('สรุปผลการเทรดของคุณ', 'Your trading at a glance')}`, `${btn(icon('upload') + L(' นำเข้า', ' Import'), 'import-csv', {}, '')}${btn(icon('calendar') + L(' จดบันทึกวันนี้', ' Journal today'), 'journal-today', {}, '')}`)
    + scopeLine(rows) + hero
    + `<div class="grid g3 mb16 dash-top">${equity}${ddP}${dailyP}</div>`
    + `<div class="grid g-12 mb16 dash-mid">${recentP}${calP}</div>`
    + `<div class="grid g3">${distP}${insP}${sessP}</div>`;
}
function welcomeView() {
  return `<div style="max-width:880px;margin:6vh auto 0">${pageHead(L('ยินดีต้อนรับสู่ EdgeDesk 3', 'Welcome to EdgeDesk 3'), (CLOUD ? L('สมุดบันทึกการเทรด ข้อมูลเก็บใน Cloudflare ของคุณเองและใช้ได้ทุกอุปกรณ์', 'A trading journal stored in your own Cloudflare, on every device') : L('สมุดบันทึกการเทรดแบบออฟไลน์ ข้อมูลทั้งหมดอยู่ในเครื่องของคุณ', 'An offline trading journal. Your data never leaves this device.')))}
  <div class="grid g3">${[['plus', L('บันทึกเทรดแรก', 'Log your first trade'), L('จดเทรดพร้อม S/L เพื่อวัดผลเป็น R', 'Record a trade with an S/L to measure R'), 'new-trade'], ['upload', L('นำเข้าจาก CSV', 'Import CSV'), L('MT4/MT5 หรือไฟล์ CSV จากโบรกเกอร์', 'MT4/MT5 or broker CSV'), 'import-csv'], ['sparkles', L('ลองข้อมูลตัวอย่าง', 'Try demo data'), L('สำรวจทุกฟีเจอร์ด้วยเทรดตัวอย่าง ~150 ไม้', 'Explore with ~150 sample trades'), 'load-demo']].map(([ic, t, d, a]) => `<button class="card2" data-action="${a}" style="text-align:left;font:inherit;color:inherit"><div class="empty-ic">${icon(ic)}</div><h3>${t}</h3><p class="desc">${d}</p></button>`).join('')}</div>
  <div class="notice info mt16">${icon('info')}<span>${L('มีไฟล์สำรอง JSON อยู่แล้ว? ไปที่ <b>ตั้งค่า → ข้อมูล</b> เพื่อกู้คืน', 'Have a JSON backup? Open <b>Settings → Data</b> to restore it.')}</span>${btn(L('ไปที่ข้อมูล', 'Open data'), 'nav', { 'data-route': 'settings/data' }, 'sm')}</div></div>`;
}
function calendarHTML(rows, year, month, mini = false) {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`, ws = state.settings.weekStart ?? 1, start = shiftKey(first, { days: -((weekdayOfKey(first) - ws + 7) % 7) });
  const by = new Map(); closedSorted(rows).forEach(t => { const d = tradeDay(t), v = value(t); const o = by.get(d) || { v: 0, n: 0, w: 0 }; if (finite(v)) o.v += v; o.n++; if (calc(t).net > EPS) o.w++; by.set(d, o); });
  const maxAbs = Math.max(EPS, ...[...by.values()].map(o => Math.abs(o.v))), jset = new Set(journalNotes().map(j => j.date)), tk = todayKey();
  let html = (mini ? '' : [0, 1, 2, 3, 4, 5, 6].map(i => `<div class="dh">${dayName((i + ws) % 7)}</div>`).join('') + `<div class="dh wkh">${L('สัปดาห์', 'Week')}</div>`);
  if (mini) html = [0, 1, 2, 3, 4, 5, 6].map(i => `<div class="dh">${dayName((i + ws) % 7).slice(0, 2)}</div>`).join('');
  for (let w = 0; w < 6; w++) {
    let wv = 0, wn = 0, any = false;
    for (let i = 0; i < 7; i++) {
      const k = shiftKey(start, { days: w * 7 + i }), o = by.get(k), inM = +k.slice(5, 7) === month + 1; if (inM) any = true;
      if (o && inM) { wv += o.v; wn += o.n; }
      const cls = o ? (o.v > EPS ? 'win' : o.v < -EPS ? 'loss' : '') : '';
      html += `<div class="day ${inM ? '' : 'out'} ${cls} ${k === tk ? 'today' : ''}" style="--i:${o ? (.25 + .75 * Math.abs(o.v) / maxAbs).toFixed(2) : 0}" data-action="open-day" data-day="${k}" title="${fmtDate(k)}${o ? ' · ' + unitFmt(o.v, ui.unit) + ' · ' + o.n + L(' เทรด', ' trades') : ''}"><span class="dn">${+k.slice(8)}</span>${!mini && jset.has(k) ? '<i class="jdot" title="Journal"></i>' : ''}${o ? `${mini === 'color' ? '' : `<span class="pl ${tone(o.v)}">${mini ? compactUnit(o.v) : unitFmt(o.v, ui.unit)}</span>${mini ? '' : `<span class="tc">${o.n} ${L('เทรด', 'tr')} · ${fmt(o.w / o.n * 100, 0)}%</span>`}`}` : ''}</div>`;
    }
    if (!mini) html += `<div class="wk"><span>${L('สัปดาห์', 'Week')} ${w + 1}</span><strong class="${tone(wv)}">${wn ? unitFmt(wv, ui.unit) : '—'}</strong><span>${wn ? wn + L(' เทรด', ' trades') : ''}</span></div>`;
    if (w >= 3 && !any) break;
    if (+shiftKey(start, { days: w * 7 + 7 }).slice(5, 7) !== month + 1 && w >= 3) break;
  }
  return `<div class="cal ${mini ? 'mini' : ''} ${mini === 'color' ? 'color-only' : ''}">${html}</div>`;
}
function compactUnit(v) { if (ui.unit === 'P&L') { const a = Math.abs(v); return (v < 0 ? '−' : '+') + (a >= 1000 ? fmt(a / 1000, a >= 10000 ? 0 : 1) + 'K' : fmt(a, 0)); } return fmt(v, 1, true); }

/* ---------------- TRADES ---------------- */
const COLS = () => ({ entryDateTime: L('เข้า', 'Entry'), exitDateTime: L('ออก', 'Exit'), instrumentId: L('สินทรัพย์', 'Instrument'), side: L('ทิศทาง', 'Side'), playbookId: 'Strategy', accountId: L('บัญชี', 'Account'), status: L('สถานะ', 'Status'), quantity: L('จำนวน', 'Quantity'), entryPrice: L('ราคาเข้า', 'Entry price'), stopLoss: 'S/L', takeProfit: 'T/P', exitPrice: L('ราคาออก', 'Exit price'), net: L('กำไร/ขาดทุนสุทธิ', 'Net P&L'), r: 'R-Multiple', pips: 'Pips', change: 'Change %', duration: L('ระยะเวลาถือ', 'Holding time'), risk: L('ความเสี่ยง', 'Risk'), tags: L('แท็ก', 'Tags'), emotion: L('อารมณ์', 'Emotion'), rating: L('คะแนน', 'Rating'), session: 'Session', timeframe: 'Timeframe', commission: L('ค่าคอมมิชชัน', 'Commission'), swap: 'Swap', note: L('โน้ต', 'Note'), reviewed: L('รีวิว', 'Reviewed') });
const NUM_COLS = ['quantity', 'entryPrice', 'stopLoss', 'takeProfit', 'exitPrice', 'net', 'r', 'pips', 'change', 'duration', 'risk', 'commission', 'swap'];
/* v3.19 — phones get a card list instead of the wide table */
function tradeCardHTML(t) {
  const c = calc(t), ins = get('instruments', t.instrumentId), pb = t.playbookId ? nameOf('playbooks', t.playbookId) : '';
  const right = t.status === 'Closed' ? `<strong class="${tone(c.net)}">${unitFmt(value(t))}</strong><small>${finite(c.r) && ui.unit !== 'R' ? fmt(c.r, 2, true) + 'R' : ''}</small>` : statusBadge(t.status);
  return `<div class="tcard" data-action="view-trade" data-id="${t.id}">${insIcon(ins)}<div class="grow" style="min-width:0"><div class="row gap6"><strong>${esc(ins?.symbol || t.symbol || '—')}</strong>${sideBadge(t.side)}${t.timeframe ? `<span class="badge">${esc(t.timeframe)}</span>` : ''}</div><small class="dim ell">${fmtDate(t.entryDateTime, { time: true })}${pb ? ' · ' + esc(pb) : ''}</small></div><div class="tc-r">${right}</div></div>`;
}
function tradeSortVal(t, k) { const c = calc(t); switch (k) { case 'entryDateTime': case 'exitDateTime': return t[k] ? +new Date(t[k]) : null; case 'instrumentId': return nameOf('instruments', t.instrumentId, 'symbol'); case 'playbookId': return nameOf('playbooks', t.playbookId); case 'accountId': return nameOf('accounts', t.accountId); case 'net': return value(t, ui.unit === 'P&L' ? 'P&L' : ui.unit) ?? c.net; case 'r': return c.r; case 'pips': return c.pips; case 'change': return c.change; case 'duration': return c.duration; case 'risk': return c.risk; case 'session': return sessionOf(t); case 'timeframe': return TIMEFRAMES.indexOf(t.timeframe); case 'tags': return (t.tags || []).map(id => nameOf('tags', id)).join(','); default: return t[k] ?? null; } }
function sortTrades(rows) { const k = ui.sortKey, d = ui.sortDir === 'asc' ? 1 : -1; return rows.slice().sort((a, b) => { const x = tradeSortVal(a, k), y = tradeSortVal(b, k); if (x == null || x === '') return 1; if (y == null || y === '') return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * d; }); }
function tradeCell(t, k) {
  const c = calc(t), ins = get('instruments', t.instrumentId), dec = ins?.decimals ?? 2, cur = accountCurrency(t);
  switch (k) {
    case 'entryDateTime': case 'exitDateTime': return t[k] ? `${fmtDate(t[k], { short: true })}<small>${fmtTime(t[k])}</small>` : '—';
    case 'instrumentId': return symbolCell(t.instrumentId, t.displayId);
    case 'side': return sideBadge(t.side);
    case 'playbookId': return t.playbookId ? `<span class="row gap4"><i class="colorbar" style="background:${esc(get('playbooks', t.playbookId)?.color || 'var(--accent)')};height:14px"></i>${esc(nameOf('playbooks', t.playbookId))}</span>` : '<span class="dim">—</span>';
    case 'accountId': return esc(nameOf('accounts', t.accountId));
    case 'status': return statusBadge(t.status);
    case 'quantity': return fmt(t.quantity, ins?.quantityStep < 1 ? 2 : 0);
    case 'entryPrice': case 'stopLoss': case 'takeProfit': case 'exitPrice': return t[k] != null ? fmt(t[k], dec) : '<span class="dim">—</span>';
    case 'net': if (t.status === 'Missed') { const mr = missedR(t); return statusBadge('Missed') + (finite(mr) ? `<small class="dim">${L('พลาด ', 'missed ')}${fmt(mr, 2, true)}R</small>` : ''); } if (t.status === 'Open') { const pi = partialInfo(t); return badge(L('เปิดอยู่', 'OPEN'), 'st open') + (pi && finite(pi.realized) ? `<small class="${tone(pi.realized)}">${L('ปิดบางส่วน ', 'partial ')}${money(pi.realized, cur, true)}</small>` : ''); } return `<strong class="${tone(c.net)}">${ui.unit === 'P&L' ? money(c.net, cur, true) : unitFmt(value(t), ui.unit)}</strong>`;
    case 'r': if (t.status === 'Missed') { const mr = missedR(t); return `<i class="dim">${finite(mr) ? fmt(mr, 2, true) + 'R' : '—'}</i>`; } return `<span class="${tone(c.r)}">${finite(c.r) ? fmt(c.r, 2, true) + 'R' : '—'}</span>`;
    case 'pips': return `<span class="${tone(c.pips)}">${fmt(c.pips, 1, true)}</span>`;
    case 'change': return `<span class="${tone(c.change)}">${finite(c.change) ? fmt(c.change, 2, true) + '%' : '—'}</span>`;
    case 'duration': return duration(c.duration);
    case 'risk': return money(c.risk, cur);
    case 'tags': return tagsHTML(t.tags, 2);
    case 'emotion': return t.emotion ? emotionHTML(t.emotion) : '<span class="dim">—</span>';
    case 'rating': return t.rating ? stars(t.rating) : '<span class="dim">—</span>';
    case 'session': return esc(sessionLabel(sessionOf(t)));
    case 'timeframe': return t.timeframe ? `<span class="badge">${esc(t.timeframe)}</span>` : '<span class="dim">—</span>';
    case 'commission': return money(t.commission || 0, cur);
    case 'swap': return money(t.swap || 0, cur, true);
    case 'note': return `<span class="note-cell">${esc(plain(t.note).slice(0, 120))}</span>`;
    case 'reviewed': return t.reviewed ? `<span class="pos">${icon('check')}</span>` : '<span class="dim">—</span>';
    default: return esc(t[k] ?? '');
  }
}
function plain(html) { return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); }
function tradesView() {
  const quick = ui.tradeQuick || 'all';
  let rows = filtered({ search: ui.search });
  if (quick === 'win') rows = rows.filter(t => calc(t).result === 'win'); else if (quick === 'loss') rows = rows.filter(t => calc(t).result === 'loss'); else if (quick === 'open') rows = rows.filter(t => t.status === 'Open'); else if (quick === 'review') rows = rows.filter(t => t.status === 'Closed' && !t.reviewed); else if (quick === 'mistake') rows = rows.filter(t => (t.tags || []).some(isMistakeTag)); else if (quick === 'missed') rows = filtered({ search: ui.search, includeMissed: true }).filter(t => t.status === 'Missed');
  const all = sortTrades(rows), size = ui.pageSize || all.length || 1, pages = Math.max(1, Math.ceil(all.length / size)); ui.page = clamp(ui.page, 1, pages);
  const page = all.slice((ui.page - 1) * size, ui.page * size), s = stats(rows), cols = ui.columns.filter(c => COLS()[c]);
  const counts = { all: filtered({ search: ui.search }).length };
  const sel = ui.selected.size;
  const head = `<tr><th style="width:34px"><input type="checkbox" class="cb" data-action="sel-page" ${page.length && page.every(t => ui.selected.has(t.id)) ? 'checked' : ''} aria-label="select page"></th>${cols.map(k => `<th class="${NUM_COLS.includes(k) ? 'num' : ''}"><button class="sort ${ui.sortKey === k ? 'on' : ''}" data-action="sort" data-key="${k}">${esc(COLS()[k])}${ui.sortKey === k ? icon(ui.sortDir === 'asc' ? 'chev-up' : 'chev-down', 'tiny') : ''}</button></th>`).join('')}<th style="width:40px"></th></tr>`;
  const body = page.map(t => `<tr class="click ${ui.selected.has(t.id) ? 'sel' : ''}" data-row="${t.id}"><td><input type="checkbox" class="cb" data-action="sel-row" data-id="${t.id}" ${ui.selected.has(t.id) ? 'checked' : ''} aria-label="select"></td>${cols.map(k => `<td class="${NUM_COLS.includes(k) ? 'num' : ''}">${tradeCell(t, k)}</td>`).join('')}<td>${menu([menuItem(L('ดูรายละเอียด', 'View'), 'view-trade', { 'data-id': t.id }, 'eye'), menuItem(L('แก้ไข', 'Edit'), 'edit-trade', { 'data-id': t.id }, 'edit'), menuItem(L('ทำสำเนา', 'Duplicate'), 'dup-trade', { 'data-id': t.id }, 'copy'), menuItem(L('ลบ', 'Delete'), 'del-trade', { 'data-id': t.id }, 'trash', 'danger')])}</td></tr>`).join('');
  return pageHead(L('รายการเทรด', 'Trades'), L(`${counts.all} รายการในมุมมองนี้`, `${counts.all} trades in view`), `${btn(icon('upload') + L(' นำเข้า', ' Import'), 'import-csv')}${btn(icon('download') + ' CSV', 'export-csv')}${btn(icon('plus') + L(' เทรดใหม่', ' New trade'), 'new-trade', {}, 'primary')}`)
    + scopeLine(rows)
    + `<div class="kpis flat mb16">${kpi(L('กำไรสุทธิ', 'Net profit'), `<span class="${tone(s.total)}">${unitFmt(s.total)}</span>`, `${L('ผลตอบแทน', 'Return')} <span class="${tone(s.ret)}">${finite(s.ret) ? fmt(s.ret, 2, true) + '%' : '—'}</span>`)}${kpi(L('อัตราชนะ', 'Win rate'), finite(s.wr) ? fmt(s.wr, 1) + '%' : '—', `${s.wins}W · ${s.losses}L · ${s.be}BE`)}${kpi('Profit factor', fmt(s.pfU, 2))}${kpi(L('ค่าคาดหวัง', 'Expectancy'), `<span class="${tone(s.expectancy)}">${unitFmt(s.expectancy)}</span>`)}${kpi(L('R-Multiple รวม', 'Total R-Multiple'), `<span class="${tone(s.r)}">${finite(s.r) ? fmt(s.r, 2, true) + 'R' : '—'}</span>`)}${kpi(L('ต้นทุน', 'Costs'), finite(s.commission) ? money(s.commission - s.swap) : '—', finite(s.commission) ? `Swap ${money(s.swap, undefined, true)} · ${L('ค่าคอมมิชชัน', 'Commission')} ${money(s.commission)}` : '')}</div>`
    + `<div class="filterbar"><div class="searchbox">${icon('search')}<input data-ui="search" value="${esc(ui.search)}" placeholder="${L('ค้นหาสัญลักษณ์ แท็ก โน้ต หรือรหัส…', 'Search symbol, tag, note, ID…')}" aria-label="search"></div>${seg([['all', L('ทั้งหมด', 'All')], ['win', 'Win'], ['loss', 'Loss'], ['open', L('เปิดอยู่', 'Open')], ['review', L('รอรีวิว', 'To review')], ['mistake', L('มีความผิดพลาด', 'Mistakes')], ['missed', L('พลาด', 'Missed')]], quick, 'trade-quick')}<div class="grow"></div>${btn(icon('columns') + L(' คอลัมน์', ' Columns'), 'columns', {}, 'sm')}</div>`
    + (sel ? `<div class="bulk"><strong>${sel} ${L('รายการที่เลือก', 'selected')}</strong><div class="grow"></div>${btn(icon('tag') + L(' เพิ่มแท็ก', ' Add tag'), 'bulk', { 'data-op': 'tag' }, 'sm')}${btn(icon('playbooks') + ' Strategy', 'bulk', { 'data-op': 'playbook' }, 'sm')}${btn(icon('check') + L(' รีวิวแล้ว', ' Reviewed'), 'bulk', { 'data-op': 'reviewed' }, 'sm')}${btn(icon('download') + ' CSV', 'bulk', { 'data-op': 'export' }, 'sm')}${btn(icon('trash') + L(' ลบ', ' Delete'), 'bulk', { 'data-op': 'delete' }, 'sm danger')}${btn(L('ยกเลิก', 'Clear'), 'sel-clear', {}, 'ghost sm')}</div>` : '')
    + `<section class="panel flush">${all.length ? `<div class="tablewrap trades-tw"><table><thead>${head}</thead><tbody>${body}</tbody></table></div><div class="tcards">${page.map(tradeCardHTML).join('')}</div>` : empty(L('ไม่พบเทรด', 'No trades found'), L('ลองล้างตัวกรอง หรือบันทึกเทรดใหม่', 'Clear filters or add a trade'), btn(icon('plus') + L(' เทรดใหม่', ' New trade'), 'new-trade', {}, 'primary') + btn(L('ล้างตัวกรอง', 'Clear filters'), 'clear-scope'))}
    <div class="foot"><span>${all.length} ${L('เทรด', 'trades')}</span><div class="grow"></div><span>${L('แถวต่อหน้า', 'Rows')}</span><select class="tsel" data-ui="pageSize" style="height:30px">${[25, 50, 100, 250, 0].map(v => opt(v, v || L('ทั้งหมด', 'All'), ui.pageSize)).join('')}</select>${ibtn('chev-left', 'page', L('ก่อนหน้า', 'Prev'), { 'data-dir': -1, disabled: ui.page <= 1 })}<span>${ui.page} / ${pages}</span>${ibtn('chev-right', 'page', L('ถัดไป', 'Next'), { 'data-dir': 1, disabled: ui.page >= pages })}</div></section>`;
}

/* ---------------- TRADE DETAIL ---------------- */
function tradeLadder(t) {
  const c = calc(t), pts = [['SL', t.stopLoss, 'neg'], ['Entry', t.entryPrice, ''], ['TP', t.takeProfit, 'pos'], ['Exit', t.exitPrice, 'exit'], ['MAE', t.mae, 'dim'], ['MFE', t.mfe, 'dim']].filter(p => finite(p[1]));
  if (pts.length < 2) return '';
  const lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1])), pad = (hi - lo) * .06 || 1, X = v => ((v - lo + pad) / (hi - lo + pad * 2) * 100), dec = get('instruments', t.instrumentId)?.decimals ?? 2;
  const flip = t.side === 'Sell'; const pos = v => flip ? 100 - X(v) : X(v);
  let z = '';
  if (finite(t.stopLoss)) { const a = pos(t.stopLoss), b = pos(t.entryPrice); z += `<div class="zone risk" style="left:${Math.min(a, b)}%;width:${Math.abs(a - b)}%"></div>`; }
  if (finite(t.takeProfit)) { const a = pos(t.entryPrice), b = pos(t.takeProfit); z += `<div class="zone rew" style="left:${Math.min(a, b)}%;width:${Math.abs(a - b)}%"></div>`; }
  const labels = { SL: 'S/L', Entry: L('เข้า', 'Entry'), TP: 'T/P', Exit: L('ออก', 'Exit'), MAE: 'MAE', MFE: 'MFE' };
  const isB = k => ['MAE', 'MFE', 'Exit'].includes(k), level = {};
  for (const grp of [pts.filter(p => !isB(p[0])), pts.filter(p => isB(p[0]))]) { let last = -99, lv = 0; grp.slice().sort((a, b) => pos(a[1]) - pos(b[1])).forEach(p => { const x = pos(p[1]); lv = x - last < 24 ? 1 - lv : 0; level[p[0]] = lv; last = x; }); }
  return `<div class="ladder"><div class="rail"></div>${z}${pts.map(([k, v, cls], i) => `<div class="mk ${cls} ${isB(k) ? 'b' : ''}" style="left:${pos(v)}%;${isB(k) ? `top:50px;--h:${level[k] ? 24 : 8}px` : `top:${level[k] ? 0 : 16}px;--h:${level[k] ? 27 : 11}px`}"><span class="${cls === 'neg' ? 'neg' : cls === 'pos' ? 'pos' : ''}"${pos(v) < 16 ? ' style="display:inline-block;transform:translateX(calc(50% - 6px))"' : pos(v) > 84 ? ' style="display:inline-block;transform:translateX(calc(-50% + 6px))"' : ''}>${labels[k]} ${fmt(v, dec)}</span></div>`).join('')}</div><div class="row small dim" style="justify-content:space-between"><span>${flip ? L('← ราคาสูง', '← higher price') : L('← ราคาต่ำ', '← lower price')}</span><span>${L('วางแผน', 'Planned')} ${finite(c.planned) ? fmt(c.planned, 2) + 'R' : '—'} · MFE ${finite(c.mfeR) ? fmt(c.mfeR, 2) + 'R' : '—'} · MAE ${finite(c.maeR) ? fmt(c.maeR, 2) + 'R' : '—'}</span></div>`;
}
function tradeDetail(id) {
  const t = get('trades', id); if (!t) return;
  const c = calc(t), ins = get('instruments', t.instrumentId), pb = get('playbooks', t.playbookId), cur = accountCurrency(t), dec = ins?.decimals ?? 2;
  const list = sortTrades(filtered({ search: ui.search, includeMissed: t.status === 'Missed' }).filter(x => (x.status === 'Missed') === (t.status === 'Missed'))), idx = list.findIndex(x => x.id === id), prev = list[idx - 1], next = list[idx + 1];
  const breaks = t.status === 'Closed' ? ruleBreakers(t) : [];
  const head = `${insIcon(ins, 'lg')}<div class="grow"><div class="row gap8 wrap"><h2 style="margin:0;font-size:18px">${esc(ins?.symbol || '—')}</h2>${sideBadge(t.side)}<span class="td-chip"><span>${L('จำนวน', 'Quantity')}</span><b>${t.quantity > 0 ? fmt(t.quantity, ins?.quantityStep < 1 ? 2 : 0) : '—'}</b></span><span class="td-chip"><span>Session</span><b>${esc(sessionLabel(sessionOf(t)))}</b></span>${t.timeframe ? `<span class="td-chip"><span>TF</span><b>${esc(t.timeframe)}</b></span>` : ''}${t.status === 'Missed' ? statusBadge('Missed') : ''}</div><div class="small dim">${esc(t.displayId || '')} · ${esc(nameOf('accounts', t.accountId))} · ${fmtDate(t.entryDateTime, { time: true })} · <a href="#notes/journal/${tradeDay(t)}" class="jlink">${icon('journal-day', 'tiny')} ${L('บันทึกของวันนี้', 'Day journal')}</a></div></div>${ibtn('chev-up', 'view-trade', L('ก่อนหน้า', 'Previous'), { 'data-id': prev?.id || '', disabled: !prev })}${ibtn('chev-down', 'view-trade', L('ถัดไป', 'Next'), { 'data-id': next?.id || '', disabled: !next })}${btn(icon('clipboard-pen') + L(' รีวิว', ' Review'), 'edit-trade', { 'data-id': id, 'data-tab': 'review' }, 'sm')}${btn(icon('edit') + L(' แก้ไข', ' Edit'), 'edit-trade', { 'data-id': id }, 'sm')}${menu([menuItem(L('ทำสำเนา', 'Duplicate'), 'dup-trade', { 'data-id': id }, 'copy'), menuItem(L('ปิดเทรดนี้', 'Close trade'), 'edit-trade', { 'data-id': id, 'data-close': 1 }, 'check'), menuItem(L('ลบ', 'Delete'), 'del-trade', { 'data-id': id }, 'trash', 'danger')])}${ibtn('x', 'close-drawer', L('ปิด', 'Close'))}`;
  const px = v => v != null ? fmt(v, dec) : '—', when = v => v ? fmtDate(v, { time: true }) : '—', costs = (t.commission || 0) - (t.swap || 0);
  const kv = [[L('เวลาเข้า', 'Entry time'), when(t.entryDateTime)], [L('เวลาออก', 'Exit time'), when(t.exitDateTime)], [L('ราคาเข้า', 'Entry price'), px(t.entryPrice)], [L('ราคาออก', 'Exit price'), px(t.exitPrice)], ['S/L', px(t.stopLoss)], ['T/P', px(t.takeProfit)], null, [L('กำไรขั้นต้น', 'Gross profit'), `<span class="${tone(c.gross)}">${money(c.gross, cur, true)}</span>`], ['Pips', finite(c.pips) ? `<span class="${tone(c.pips)}">${fmt(c.pips, 1, true)}</span>` : '—'], [L('ต้นทุน', 'Costs'), `<span data-tip="${esc(L('ค่าคอมมิชชัน ', 'Commission ') + money(t.commission || 0, cur) + ' · Swap ' + money(t.swap || 0, cur, true))}">${money(costs, cur)}</span>`], [L('ระยะเวลาถือ', 'Holding time'), duration(c.duration)]];
  const left = `<div class="row" style="align-items:flex-end;gap:22px;flex-wrap:wrap"><div><div class="small muted">${L('กำไร/ขาดทุนสุทธิ', 'Net P&L')}</div><div class="td-big ${tone(c.net)}">${t.status === 'Closed' ? money(c.net, cur, true) : t.status === 'Missed' ? L('ไม่ได้เข้า', 'Not taken') : L('เปิดอยู่', 'Open')}</div></div><div><div class="small muted">${t.status === 'Missed' ? L('R ที่พลาด', 'Missed R') : 'R-Multiple'}</div><div class="hv ${tone(t.status === 'Missed' ? missedR(t) : c.r)}" style="font-size:22px">${t.status === 'Missed' ? (finite(missedR(t)) ? fmt(missedR(t), 2, true) + 'R' : '—') : finite(c.r) ? fmt(c.r, 2, true) + 'R' : '—'}</div></div><div><div class="small muted">${L('เปลี่ยนแปลง', 'Change')}</div><div class="hv ${tone(c.change)}" style="font-size:22px">${finite(c.change) ? fmt(c.change, 2, true) + '%' : '—'}</div></div></div>
    <div class="mt16">${tradeLadder(t)}</div>
    ${(() => { const pi = partialInfo(t); return pi ? `<div class="notice info mt16">${icon('layers')}<span>${L('ปิดไปแล้ว', 'Closed')} <b>${fmt(pi.qOut, 2)}/${fmt(pi.qIn, 2)}</b> · ${L('กำไรที่ปิดไปแล้ว', 'realized')} <b class="${tone(pi.realized)}">${money(pi.realized, cur, true)}</b></span></div>` : ''; })()}
    <div class="kv mt16">${kv.map(x => x ? `<div><span>${x[0]}</span><b>${x[1]}</b></div>` : '<i class="kv-gap"></i>').join('')}</div>${execDetailHTML(t)}
    ${breaks.length ? `<div class="notice warn mt16">${icon('alert')}<div><b>${L('ข้อควรระวังตามกฎ', 'Rule flags')}</b><br>${breaks.map(esc).join(' · ')}</div></div>` : ''}
    <div class="sec mt24 row" style="justify-content:space-between"><span>${L('ภาพหน้าจอ', 'Screenshots')}</span>${t.chartUrl ? `<a class="btn sm ghost" href="${esc(t.chartUrl)}" target="_blank" rel="noopener noreferrer">${icon('external')}${L(' เปิดกราฟ', ' Open chart')}</a>` : ''}</div>${shotsHTML(t.images || [], 'trades', id)}
    <div class="sec mt24">${L('โน้ต', 'Notes')}</div>${t.note ? `<div class="notetext">${esc(plain(t.note) === t.note ? t.note : plain(t.note))}</div>` : `<p class="dim small">${L('ยังไม่มีบันทึก — เพิ่มเหตุผลการเข้าและสิ่งที่ได้เรียนรู้', 'No notes yet')}</p>`}`;
  const right = `<div class="panel" style="padding:14px 16px"><div class="row" style="justify-content:space-between"><strong>${L('รีวิวเทรด', 'Review')}</strong><label class="row gap8 small">${L('รีวิวแล้ว', 'Reviewed')} ${toggle('reviewed', t.reviewed, 'quick-reviewed', `data-id="${id}"`)}</label></div>
    <div class="sec mt16">${L('คะแนน', 'Rating')}</div>${stars(t.rating, 'quick-rating').replace('class="stars input"', `class="stars input" data-id="${id}"`)}
    <div class="sec mt16">${L('อารมณ์', 'Emotion')}</div>${emotionPicker(t.emotion, 'quick-emotion').replace('class="emo"', `class="emo" data-id="${id}"`)}
    <div class="sec mt16">Strategy</div>${pb ? `<div class="row gap8"><i class="colorbar" style="background:${esc(pb.color)};height:18px"></i><a href="#playbooks/${pb.id}" data-action="close-drawer"><strong>${esc(pb.name)}</strong></a><div class="grow"></div>${btn(L('ดูกฎ', 'Rules'), 'nav', { 'data-route': `playbooks/${pb.id}/rules` }, 'sm ghost')}</div>` : `<span class="dim small">${L('ไม่ได้ระบุ', 'None')}</span>`}
    <div class="sec mt16">${L('แท็ก', 'Tags')}</div>${t.tags?.length ? `<div class="chips">${t.tags.map(x => tagChip(x)).join('')}</div>` : `<span class="dim small">—</span>`}
    </div>`;
  openDrawer({ wide: true, kind: 'trade', id, title: head, body: `<div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(280px,1fr);gap:20px" id="td-grid">${`<div>${left}</div><div>${right}</div>`}</div>` });
  hydrateShots();
}
function shotsHTML(ids, kind, id, editable = true) {
  return `<div class="shots" data-shots="${kind}:${id}">${ids.map(im => `<div class="shot" data-action="lightbox" data-img="${im}"><img data-img-src="${im}" alt="screenshot">${editable ? `<button class="btn icon-only sm" data-action="shot-del" data-img="${im}" data-kind="${kind}" data-id="${id}" aria-label="delete">${icon('trash')}</button>` : ''}</div>`).join('')}${editable ? `<label class="dropzone" data-drop="${kind}:${id}">${icon('image')}<span>${L('ลาก/วาง วางจากคลิปบอร์ด (Ctrl+V) หรือคลิกเพื่อเลือกรูป', 'Drop, paste (Ctrl+V) or click to add')}</span><input type="file" accept="image/*" multiple hidden data-upload="${kind}:${id}"></label>` : ''}</div>`;
}
async function hydrateShots(root = document) { for (const img of $$('img[data-img-src]', root)) { if (img.src) continue; const rec = await getImage(img.dataset.imgSrc); if (rec) img.src = rec.data; else img.closest('.shot')?.classList.add('missing'); } }
async function addImages(kind, id, files) {
  const rec = kind === 'editor' ? editor : get(kind, id); if (!rec) return;
  for (const f of files) { if (!f.type?.startsWith('image/')) continue; try { const { data, w, h } = await compressImage(f); const imgId = await saveImage(data, { w, h, owner: kind + ':' + id }); (kind === 'editor' ? (editor.images ??= []) : (rec.images ??= [])).push(imgId); } catch { toast(L('อ่านไฟล์รูปไม่ได้', 'Could not read image'), 'bad'); } }
  if (kind === 'editor') { $('#editor-shots').innerHTML = shotsHTML(editor.images, 'editor', 'x'); hydrateShots($('#editor-shots')); return; }
  rec.updatedAt = now(); persist(); refreshShots(kind, id); toast(L('เพิ่มรูปแล้ว', 'Image added'));
}
function refreshShots(kind, id) { const box = $(`[data-shots="${kind}:${id}"]`); const rec = get(kind, id); if (box && rec) { box.outerHTML = shotsHTML(rec.images || [], kind, id); hydrateShots(); } }

/* ---------------- TRADE EDITOR ---------------- */
let editor = null;
function openTradeEditor(id = '', overrides = {}, closing = false, tab = 'main', draft = null) {
  if (!state.accounts.length) { toast(L('สร้างบัญชีก่อนบันทึกเทรด', 'Create an account first')); openAccountEditor(); return; }
  const ex = get('trades', id), draftKey = 'trade:' + (ex ? id : 'new'), r = draft ? clone(draft.data) : ex ? clone(ex) : { id: uid('trd'), status: 'Closed', side: 'Buy', commission: 0, swap: 0, createdAt: now(), entryDateTime: now(), accountId: ui.account || state.settings.defaultAccount || state.accounts.find(a => a.active !== false)?.id, instrumentId: lastUsed('instrumentId') || 'ins_XAUUSD', playbookId: lastUsed('playbookId') || '', quantity: null, tags: [], images: [], ...overrides };
  if (closing) r.status = 'Closed';
  editor = { kind: 'trades', commTouched: !!ex && (r.commission || 0) !== 0, record: r, isNew: !ex, tags: [...(r.tags || [])], emotion: r.emotion || '', rating: r.rating || 0, images: [...(r.images || [])], side: r.side || 'Buy', status: r.status || 'Closed', execMode: !!r.executions?.length, executions: clone(r.executions || []) , draftKey};
  const ins = get('instruments', r.instrumentId), acc = get('accounts', r.accountId), fxNeeded = ins && acc && (ins.valueCurrency || ins.quoteCurrency) !== acc.currency;
  const body = `${draftBar(draftKey, !!draft)}<form id="editor-form" autocomplete="off" onsubmit="return false">
  ${edTabsHTML([['main', L('รายละเอียด', 'Details'), 'trades'], ['review', 'Review', 'clipboard-pen']], tab)}
  <div class="ed-pane" data-pane="main" ${tab === 'main' ? '' : 'hidden'}>
  <div class="sec">${L('การเข้าออเดอร์', 'Execution')}</div>
  <div class="formgrid c4">${field('accountId', L('บัญชี', 'Account'), r.accountId, 'select', { html: entityOptions('accounts', r.accountId), required: true })}${instrumentPicker('instrumentId', r.instrumentId)}${field('playbookId', 'Strategy', r.playbookId, 'select', { html: entityOptions('playbooks', r.playbookId, L('— ไม่ระบุ —', '— None —')) })}<div class="field"><label>${L('ทิศทาง', 'Side')}</label><div class="dir"><button type="button" class="long ${editor.side === 'Buy' ? 'on' : ''}" data-action="ed-side" data-value="Buy">LONG</button><button type="button" class="short ${editor.side === 'Sell' ? 'on' : ''}" data-action="ed-side" data-value="Sell">SHORT</button></div></div>
  ${field('entryDateTime', L('เวลาเข้า', 'Entry time'), localInput(r.entryDateTime), 'datetime-local', { required: true })}${field('entryPrice', L('ราคาเข้า', 'Entry price'), r.entryPrice, 'number', { required: true })}${field('stopLoss', 'S/L', r.stopLoss, 'number', { help: L('จำเป็นสำหรับการคำนวณ R', 'Needed for R') })}${field('takeProfit', 'T/P', r.takeProfit, 'number')}
  <div class="field"><label for="f_quantity">${L('จำนวน', 'Quantity')} <i class="req">*</i></label><div class="row gap4"><input id="f_quantity" name="quantity" type="number" step="any" value="${esc(r.quantity ?? '')}" required>${btn(icon('calculator'), 'ed-size', { 'aria-label': L('คำนวณจาก % ความเสี่ยง', 'Quantity from risk %'), 'data-tip': L('คำนวณจำนวนจาก % ความเสี่ยง', 'Quantity from risk %') }, 'icon-only')}</div></div>${field('timeframe', 'Timeframe', r.timeframe || '', 'select', { options: [['', '—'], ...TIMEFRAMES.map(x => [x, x])] })}${fxNeeded || r.fxRate && r.fxRate !== 1 ? field('fxRate', L('อัตราแปลงสกุลเงิน', 'FX rate'), r.fxRate ?? '', 'number', { help: `1 ${esc(ins?.valueCurrency || '')} → ${esc(acc?.currency || '')}` }) : `<input type="hidden" name="fxRate" value="${esc(r.fxRate ?? '')}">`}</div>
  <div class="sec">${L('การออก & ต้นทุน', 'Exit & costs')}</div>
  <div class="row wrap mb16"><span id="status-seg">${seg([['Closed', L('ปิดแล้ว', 'Closed')], ['Open', L('ยังเปิดอยู่', 'Open')], ['Missed', L('พลาด (ไม่ได้เข้า)', 'Missed')], ['Void', L('ยกเลิก', 'Void')]], editor.status, 'ed-status')}</span><div class="grow"></div><label class="row gap8 small">${toggle('execMode', editor.execMode, 'exec-toggle')}<span>${L('ทยอยเข้า / ทยอยปิด (หลายรายการ)', 'Scale in / out (multiple fills)')}</span></label></div>
  <div id="missed-note" class="notice info mb16" ${editor.status === 'Missed' ? '' : 'hidden'}>${icon('info')}<span>${L('Setup ที่เห็นแต่ไม่ได้เข้า — ใส่ราคาเข้า S/L และ T/P ที่ตั้งใจไว้ และใส่ "ราคาออก" เป็นราคาที่ราคาไปถึง เพื่อวัด R ที่พลาด · ไม่นับใน P&L และสถิติ', 'A setup you saw but did not take — enter the intended entry price, S/L and T/P, and use "Exit price" for where price went to measure the missed R · excluded from P&L and stats')}</span></div>
  <div id="exec-box" class="exec-box mb16" ${editor.execMode ? '' : 'hidden'}>${editor.execMode ? execBoxHTML() : ''}</div>
  <div class="formgrid c4" id="exit-fields" ${editor.status !== 'Closed' ? 'style="opacity:.45"' : ''}>${field('exitDateTime', L('เวลาออก', 'Exit time'), localInput(r.exitDateTime), 'datetime-local')}${field('exitPrice', L('ราคาออก', 'Exit price'), r.exitPrice, 'number')}${field('commission', L('ค่าคอมมิชชัน', 'Commission'), r.commission ?? 0, 'number', { help: L('ใส่เป็นบวก', 'Positive cost') })}${field('swap', 'Swap', r.swap ?? 0, 'number', { help: L('+ ได้รับ / − จ่าย', '+ credit / − debit') })}${field('grossPnL', L('กำไรขั้นต้น', 'Gross profit'), r.grossPnL ?? '', 'number', { help: L('เว้นว่างเพื่อคำนวณอัตโนมัติ', 'Blank = calculated') })}</div>
  <details class="opt-sec mt12" id="mae-mfe" ${finite(r.mae) || finite(r.mfe) ? 'open' : ''}><summary>${icon('chev-right')}<span>MAE / MFE</span><span class="badge">${L('ไม่บังคับ', 'Optional')}</span><span class="dim small">${L('ราคาที่ติดลบสุด / ดีที่สุดระหว่างถือ', 'Worst / best price while in the trade')}</span></summary><div class="formgrid c4 mt12">${field('mae', L('MAE (ราคาที่ติดลบสุด)', 'MAE price'), r.mae ?? '', 'number', { help: L('ใช้วัดคุณภาพจุดเข้า', 'Worst price against you') })}${field('mfe', L('MFE (ราคาที่ดีที่สุด)', 'MFE price'), r.mfe ?? '', 'number', { help: L('ใช้วัดประสิทธิภาพการออก', 'Best price in your favour') })}</div></details>
  <div class="mt16" id="livecalc"></div>
  </div>
  <div class="ed-pane" data-pane="review" ${tab === 'review' ? '' : 'hidden'}>
  <div class="grid g2"><div class="field"><label>${L('คะแนน', 'Rating')}</label><div id="ed-rating">${stars(editor.rating, 'ed-rating')}</div></div>
  <div class="field"><label>${L('อารมณ์', 'Emotion')}</label><div id="ed-emotion">${emotionPicker(editor.emotion, 'ed-emotion')}</div></div></div>
  <div class="field mt16"><label>${L('แท็ก', 'Tags')}</label><div id="ed-tags">${tagPicker(editor.tags, get('playbooks', r.playbookId)?.relevantTagIds || [])}</div></div>
  <div class="mt16">${field('note', L('บันทึก / เหตุผล / บทเรียน', 'Notes / rationale / lesson'), plain(r.note) === r.note ? (r.note || '') : plain(r.note), 'textarea', { rows: 4, placeholder: L('ทำไมถึงเข้า? เป็นไปตามแผนไหม? ได้เรียนรู้อะไร?', 'Why did you enter? Did you follow the plan?') })}</div>
  <div class="mt16">${field('chartUrl', L('ลิงก์กราฟ (เช่น TradingView snapshot)', 'Chart link (e.g. TradingView snapshot)'), r.chartUrl || '', 'url', { placeholder: 'https://www.tradingview.com/x/…' })}</div>
  <div class="field mt16"><label>${L('ภาพหน้าจอ', 'Screenshots')}</label><div id="editor-shots">${shotsHTML(editor.images, 'editor', 'x')}</div></div>
  <label class="check mt8">${`<input type="checkbox" name="reviewed" ${r.reviewed ? 'checked' : ''}><span class="box"></span><span>${L('ทำเครื่องหมายว่ารีวิวแล้ว', 'Mark as reviewed')}</span>`}</label>
  </div>
  </form>`;
  openModal({ title: (editor.isNew ? L('บันทึกเทรดใหม่', 'New trade') : L('แก้ไขเทรด', 'Edit trade') + ` <span class="dim small">${esc(r.displayId || '')}</span>`), size: 'xl', body, saved: !!ex, fromDraft: draft?.at || null, draft: { key: draftKey, save: () => { const x = readTradeForm(); return { title: `${x.symbol || ''} ${x.side || ''}`.trim(), data: x }; }, restore: (data, at) => openTradeEditor(id, {}, false, 'main', { data, at }) }, foot: `${editor.isNew ? '' : btn(icon('trash') + L(' ลบ', ' Delete'), 'del-trade', { 'data-id': r.id }, 'ghost danger')}<div class="grow"></div>${btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost')}${editor.isNew ? btn(L('บันทึก & เพิ่มอีก', 'Save & add another'), 'save-trade', { 'data-again': 1 }) : ''}${btn(icon('save') + L(' บันทึก', ' Save'), 'save-trade', {}, 'primary')}`, onClose: () => { editor = null; } });
  hydrateShots($('#editor-shots')); if (editor.execMode) setExecMode(true); else updateLive();
}
function lastUsed(k) { const t = state.trades.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0]; return t?.[k]; }
function readTradeForm() {
  const f = $('#editor-form'); if (!f) return editor.record; const d = formData(f), r = { ...editor.record };
  for (const k of ['quantity', 'entryPrice', 'stopLoss', 'takeProfit', 'exitPrice', 'commission', 'swap', 'grossPnL', 'fxRate', 'mae', 'mfe']) if (k in d) r[k] = num(d[k]);
  if ('timeframe' in d) r.timeframe = d.timeframe || ''; if ('chartUrl' in d) r.chartUrl = safeUrl(d.chartUrl);
  r.accountId = d.accountId; r.instrumentId = d.instrumentId; r.playbookId = d.playbookId || ''; 
  r.entryDateTime = toISO(d.entryDateTime); r.exitDateTime = toISO(d.exitDateTime); r.note = d.note || ''; r.reviewed = !!d.reviewed;
  r.side = editor.side; r.status = editor.status; r.tags = editor.tags.slice(); delete r.checklist; r.emotion = editor.emotion || ''; r.rating = editor.rating || null; r.images = editor.images.slice();
  r.symbol = nameOf('instruments', r.instrumentId, 'symbol'); if (r.instrumentId !== editor.record.instrumentId) delete r.instrumentSnapshot;
  if (editor.execMode && $('#exec-box')) { editor.executions = readExecRows(); r.executions = clone(editor.executions); applyExecutions(r); }
  else delete r.executions;
  return r;
}
function validateTrade(t) {
  const e = [];
  if (!get('accounts', t.accountId)) e.push(L('เลือกบัญชี', 'Select an account'));
  if (!get('instruments', t.instrumentId)) e.push(L('เลือกสินทรัพย์ที่มีในรายการ', 'Select a configured instrument'));
  if (!t.entryDateTime) e.push(L('ระบุวัน-เวลาเข้า', 'Entry time is required'));
  if (t.status === 'Missed') { if (!(t.entryPrice > 0)) e.push(L('ราคาเข้าต้องมากกว่า 0', 'Entry price must be > 0')); if (!(t.stopLoss > 0)) e.push(L('Setup ที่พลาดต้องมี S/L เพื่อวัด R', 'Missed setups need an S/L to measure R')); return e; }
  if (!(t.quantity > 0)) e.push(L('จำนวนต้องมากกว่า 0', 'Quantity must be > 0'));
  if (!(t.entryPrice > 0)) e.push(L('ราคาเข้าต้องมากกว่า 0', 'Entry price must be > 0'));
  if (t.status === 'Closed' && (!t.exitDateTime || !(t.exitPrice > 0) && t.grossPnL == null)) e.push(L('เทรดที่ปิดแล้วต้องมีเวลาออกและราคาออก', 'Closed trades need exit time and price'));
  if (t.exitDateTime && t.entryDateTime && new Date(t.exitDateTime) < new Date(t.entryDateTime)) e.push(L('เวลาออกต้องไม่ก่อนเวลาเข้า', 'Exit cannot be before entry'));
  if (t.executions?.length) { const s = execSummary(t.executions); if (!(s.qIn > 0)) e.push(L('ต้องมีรายการเข้าอย่างน้อย 1 รายการที่มีราคาและขนาด', 'Add at least one entry fill')); if (s.over) e.push(L('จำนวนที่ปิดมากกว่าจำนวนที่เปิด', 'Closed quantity exceeds opened quantity')); if (t.executions.some(x => !x.time)) e.push(L('ทุกรายการต้องมีวัน-เวลา', 'Every fill needs a time')); if (s.outs.some(x => x.time && s.firstIn && x.time < s.firstIn)) e.push(L('รายการออกต้องไม่ก่อนการเข้าครั้งแรก', 'An exit is before the first entry')); }
  if (t.status === 'Closed' && !finite(calc({ ...t }).net) && t.exitPrice > 0) e.push(L('ต้องระบุอัตราแปลงสกุลเงิน หรือใส่กำไรขั้นต้นเอง', 'Enter an FX rate or a gross P&L'));
  return e;
}
function priceWarnings(t) { const out = [], s = t.side === 'Sell' ? -1 : 1; if (t.stopLoss != null && t.entryPrice && (t.entryPrice - t.stopLoss) * s <= 0) out.push(L('S/L อยู่ผิดฝั่งของราคาเข้า', 'S/L is on the wrong side of entry')); if (t.takeProfit != null && t.entryPrice && (t.takeProfit - t.entryPrice) * s <= 0) out.push(L('T/P อยู่ผิดฝั่งของราคาเข้า', 'T/P is on the wrong side of entry')); return out; }
const safeUrl = u => { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; };
/* v3.19 — commission fills itself from the instrument's per-lot rate until you type your own */
function autoCommission() {
  const f = $('#editor-form'), el = f?.querySelector('[name=commission]'); if (!el || editor.commTouched || editor.execMode) return;
  const ins = get('instruments', f.querySelector('[name=instrumentId]')?.value), q = num(f.querySelector('[name=quantity]')?.value), rate = ins?.commissionPerLot, help = el.closest('.field')?.querySelector('.help');
  if (rate > 0 && q > 0) { el.value = +(q * rate).toFixed(2); if (help) help.textContent = L(`อัตโนมัติ: ${fmt(q, 2)} lot × ${fmt(rate, 2)}`, `Auto: ${fmt(q, 2)} lot × ${fmt(rate, 2)}`); }
  else if (help) help.textContent = L('ใส่เป็นบวก', 'Positive cost');
}
function updateLive() {
  if (!editor || editor.kind !== 'trades' || !$('#livecalc')) return;
  autoCommission();
  const r = readTradeForm(); calcCache.delete(r); const c = calc(r), cur = get('accounts', r.accountId)?.currency || 'USD', w = priceWarnings(r);
  if (!tickRate(r)) w.push(L('ต้องระบุอัตราแปลงสกุลเงินเพื่อคำนวณเงิน', 'Set an FX rate to compute money'));
  const bal = r.accountId ? accountBalance(r.accountId) : 0, riskPct = finite(c.risk) && bal > 0 ? c.risk / bal * 100 : null;
  w.push(...dailyLimitWarnings(r, c));
  if (finite(riskPct) && riskPct > (state.settings.riskWarning || 99)) w.push(L(`ความเสี่ยง ${fmt(riskPct, 2)}% ของบัญชี — เกินเกณฑ์ ${fmt(state.settings.riskWarning, 1)}%`, `Risk ${fmt(riskPct, 2)}% exceeds ${fmt(state.settings.riskWarning, 1)}%`));
  $('#livecalc').innerHTML = `<div class="live"><div><label>${L('ความเสี่ยง', 'Risk')}</label><strong>${money(c.risk, cur)}</strong><small class="sub2">${finite(riskPct) ? fmt(riskPct, 2) + L('% ของบัญชี', '% of balance') : ''}</small></div><div><label>R:R ${L('ที่วางแผน', 'planned')}</label><strong>${finite(c.planned) ? '1 : ' + fmt(c.planned, 2) : '—'}</strong></div><div><label>${L('กำไรขั้นต้น', 'Gross profit')}</label><strong class="${tone(c.gross)}">${r.status === 'Closed' ? money(c.gross, cur, true) : '—'}</strong></div><div><label>${L('สุทธิ', 'Net')}</label><strong class="${tone(c.net)}">${money(c.net, cur, true)}</strong></div><div><label>R-Multiple</label><strong class="${tone(c.r)}">${finite(c.r) ? fmt(c.r, 2, true) + 'R' : '—'}</strong></div><div><label>Pips</label><strong>${finite(c.pips) ? fmt(c.pips, 1, true) : '—'}</strong></div><div><label>${L('ระยะเวลาถือ', 'Holding time')}</label><strong>${r.status === 'Closed' ? duration(c.duration) : '—'}</strong></div><div><label>Session</label><strong>${r.entryDateTime ? esc(sessionLabel(sessionRaw(r))) : '—'}</strong><small class="sub2">${L('จากเวลาเข้า', 'from entry time')}</small></div></div>${w.length ? `<div class="notice warn mt8">${icon('alert')}<span>${w.map(esc).join('<br>')}</span></div>` : ''}`;
  $('#exit-fields') && ($('#exit-fields').style.opacity = ['Closed', 'Missed'].includes(editor.status) || editor.execMode ? 1 : .45); const mn = $('#missed-note'); if (mn) mn.hidden = editor.status !== 'Missed';
  if (editor.execMode) { const dec = (get('instruments', r.instrumentId)?.decimals ?? 2) + 2, set = (n, v) => { const i = $(`#editor-form [name=${n}]`); if (i && document.activeElement !== i) i.value = v ?? ''; }; set('entryPrice', finite(r.entryPrice) ? +r.entryPrice.toFixed(dec) : ''); set('quantity', r.quantity); set('entryDateTime', localInput(r.entryDateTime)); set('exitPrice', finite(r.exitPrice) ? +r.exitPrice.toFixed(dec) : ''); set('exitDateTime', localInput(r.exitDateTime)); drawExecSummary(r); }
}
async function saveTrade(again = false) {
  const r = readTradeForm(), e = validateTrade(r);
  if (e.length) { edTab('main'); toast(e[0], 'bad'); return; }
  if (editor.isNew) r.displayId = displayId(state.trades, r.entryDateTime);
  r.updatedAt = now(); if (r.status !== 'Closed') { r.grossPnL = null; }
  const i = state.trades.findIndex(t => t.id === r.id); if (i >= 0) state.trades[i] = r; else state.trades.push(r);
  // images removed during editing
  const before = new Set(editor.record.images || []); for (const im of before) if (!r.images.includes(im)) deleteImage(im);
  const wasNew = editor.isNew; dropDraft(editor.draftKey); closeModal(); await changed(wasNew ? L('บันทึกเทรดแล้ว', 'Trade saved') : L('อัปเดตเทรดแล้ว', 'Trade updated'));
  if (again) openTradeEditor('', { accountId: r.accountId, instrumentId: r.instrumentId, playbookId: r.playbookId, entryDateTime: r.entryDateTime });
  else if (drawerState?.kind === 'trade') tradeDetail(r.id);
}

