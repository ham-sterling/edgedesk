/* ============================================================
   SHELL · DASHBOARD · TRADES · TRADE DETAIL · TRADE EDITOR
   ============================================================ */
const NAV = () => [
  [L('พื้นที่ทำงาน', 'Workspace'), [['dashboard', L('ภาพรวม', 'Dashboard'), 'dashboard'], ['trades', L('รายการเทรด', 'Trades'), 'trades', 'trades'], ['playbooks', L('กลยุทธ์', 'Strategies'), 'playbooks'], ['notes', L('สมุดโน้ต', 'Notebook'), 'notebook'], ['reports', L('วิเคราะห์', 'Analytics'), 'reports'], ['accounts', L('บัญชี', 'Accounts'), 'accounts'], ['calculator', L('เครื่องคำนวณ', 'Calculator'), 'calculator']]],
  [L('ระบบ', 'System'), [['settings', L('ตั้งค่า', 'Settings'), 'settings'], ['help', L('คู่มือ', 'Guide'), 'help']]]
];
function routeRoot() { return ui.route.split('/')[0]; }
function navActive(r) { const cur = ui.route; if (r === 'reports') return cur === 'reports' || cur.startsWith('reports/'); if (r.includes('/')) return cur.startsWith(r); return cur === r || cur.startsWith(r + '/') && !NAV().flatMap(g => g[1]).some(x => x[0] !== r && x[0].startsWith(r + '/') && cur.startsWith(x[0])); }
function shell() {
  const th = state.settings.theme;
  const counts = { trades: state.trades.filter(t => t.status === 'Open').length };
  const lb = Date.parse(state.meta.lastBackup || '') || 0, days = Math.floor((Date.now() - lb) / 864e5), needBackup = state.trades.length >= 10 && days >= 7;
  const saveTxt = CLOUD ? (cloud.offline ? L('ออฟไลน์ — รอซิงก์', 'Offline — waiting to sync') : cloud.lastSync ? L('ซิงก์ขึ้นคลาวด์แล้ว · ', 'Synced · ') + new Date(cloud.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : L('ข้อมูลอยู่บนคลาวด์', 'Stored in the cloud')) : state.meta.updatedAt ? L('บันทึกในเครื่องแล้ว', 'Saved on this device') : L('พื้นที่ทำงานส่วนตัว', 'Private workspace');
  /* v3.57 — app frame: full-width top bar, icon rail on the left, the page in one rounded body card */
  return `<a class="skip" href="#main">${L('ข้ามไปเนื้อหา', 'Skip to content')}</a><div class="shell p5" id="shell">
  <header class="topbar">
    <button type="button" class="btn ghost icon-only tb-menu" data-action="menu-toggle" aria-label="${L('เมนู', 'Menu')}" aria-controls="slide-menu">${icon('menu')}</button>
    <a class="brand" href="#dashboard" title="${APP_NAME} v${APP_VERSION}"><span>Tickmeta<span class="accent">.</span></span></a>
    <button class="searchbtn" data-action="palette">${icon('search')}<span>${L('ค้นหาเทรด โน้ต กลยุทธ์…', 'Search trades, notes, strategies…')}</span></button>
    <div class="grow"></div>
    ${sessionChipHTML()}
    ${riskChipHTML()}
    ${topStatsHTML()}
    <button class="btn primary tb-new" data-action="new-trade">${icon('plus')}<span class="desk-only">${L('เทรดใหม่', 'New trade')}</span></button>
    <button type="button" class="tb-av" data-action="profile-open" aria-label="${L('โปรไฟล์', 'Profile')}" data-tip="${esc(profileName())}">${avatarHTML('tb-avc')}</button>
  </header>
  <aside class="sidebar rail">
  <nav aria-label="${L('เมนูหลัก', 'Main')}">${NAV().flatMap(([, items]) => items).filter(([r]) => !['settings', 'help', 'accounts'].includes(r)).map(([r, l, ic, c]) => `<a class="navlink ${navActive(r) ? 'on' : ''}" href="#${r}" title="${esc(l)}"><span class="rl-ic">${icon(ic)}${c && counts[c] ? `<em class="count">${counts[c]}</em>` : ''}</span><span class="rl-t">${l}</span></a>`).join('')}</nav>
  <div class="side-foot">
    ${abNeedsPermission ? `<a class="navlink warn" href="#" data-action="ab-now" title="${L('ยืนยันสิทธิ์โฟลเดอร์สำรอง', 'Confirm backup folder access')}"><span class="rl-ic">${icon('save')}</span><span class="rl-t">${L('สำรอง', 'Backup')}</span></a>` : ''}
    ${needBackup ? `<a class="navlink warn" href="#" data-action="backup" title="${lb ? L(`สำรองล่าสุด ${days} วันก่อน`, `Last backup ${days}d ago`) : L('ยังไม่เคยสำรองข้อมูล', 'Never backed up')}"><span class="rl-ic">${icon('alert')}</span><span class="rl-t">${L('สำรอง', 'Back up')}</span></a>` : ''}
    <div class="rail-pill">${ibtn(th === 'dark' ? 'moon' : 'sun', 'theme', L('สลับธีม', 'Toggle theme'))}<button class="btn ghost icon-only" data-action="lang" aria-label="Language" data-tip="${LANG === 'th' ? 'English' : 'ภาษาไทย'}"><span class="b small">${LANG === 'th' ? 'TH' : 'EN'}</span></button></div>
    <div class="store" title="${esc(storageType)}" data-tip="${esc(saveTxt)}">${icon('lock')}<span class="txt" id="save-state">${saveTxt}</span></div>
  </div></aside>
  <div class="workspace"><div class="wbody"><main class="content" id="main">${view()}</main></div></div>
  ${slideMenuHTML(saveTxt, needBackup)}
  <div class="frame-fx" aria-hidden="true"><i class="fx-tl"></i><i class="fx-tr"></i><i class="fx-r"></i><i class="fx-b"></i></div></div>`;
}
/* v3.58 — slide-out menu from the ☰ button: workspace header + Settings / Guide / Data accordions */
function slideMenuHTML(saveTxt, needBackup) {
  const sub = ui.route.startsWith('settings') ? ui.route.split('/')[1] || 'general' : '';
  const link = (href, ic, l, on) => `<a class="sm-link ${on ? 'on' : ''}" href="#${href}">${icon(ic)}<span>${l}</span></a>`;
  const acc = (id, ic, l, body, open) => `<details class="sm-acc" ${open ? 'open' : ''} data-acc="${id}"><summary>${icon(ic)}<span>${l}</span>${icon('chev-down')}</summary><div class="sm-body">${body}</div></details>`;
  const act = (a, ic, l) => `<button type="button" class="sm-item" data-action="${a}">${icon(ic)}<span>${l}</span></button>`;
  return `<div class="sm-back" data-action="menu-close"></div><aside class="slide-menu" id="slide-menu" aria-label="${L('เมนู', 'Menu')}">
    <div class="sm-head"><button type="button" class="sm-prof" data-action="profile-open" aria-label="${L('แก้ไขโปรไฟล์', 'Edit profile')}">${avatarHTML('sm-av')}<div class="sm-who"><b>${esc(profileName())}</b><small>${esc(state.settings.profile?.tagline || saveTxt)}</small><small class="sm-ver">${state.settings.profile?.tagline ? esc(saveTxt) + ' · ' : ''}v${APP_VERSION}</small></div>${icon('chev-right')}</button><button type="button" class="btn ghost icon-only sm-x" data-action="menu-close" aria-label="${L('ปิด', 'Close')}">${icon('x')}</button></div>
    <nav class="sm-list">
      ${acc('accounts', 'accounts', L('บัญชี', 'Accounts'), link('accounts', 'wallet', L('บัญชีทั้งหมด', 'All accounts'), ui.route === 'accounts') + link('accounts/transactions', 'coins', L('รายการเงินเข้า-ออก', 'Transactions'), ui.route === 'accounts/transactions') + `<button type="button" class="sm-link" data-action="new-account">${icon('plus')}<span>${L('เพิ่มบัญชี', 'New account')}</span></button>`, routeRoot() === 'accounts')}
      ${acc('settings', 'settings', L('ตั้งค่า', 'Settings'), [['general', 'settings', L('ทั่วไป', 'General')], ['rules', 'shield', L('กฎความเสี่ยง', 'Risk rules')], ['fx', 'currency-exchange', L('อัตราแลกเปลี่ยน (US$)', 'Exchange rates (US$)')], ['instruments', 'candlestick', L('สินทรัพย์', 'Instruments')], ['tags', 'tag', L('แท็ก', 'Tags')], ['data', 'database', L('ข้อมูล & สำรอง', 'Data & backup')]].map(([k, ic, l]) => link('settings/' + k, ic, l, sub === k)).join(''), !!sub)}
      ${acc('help', 'help', L('คู่มือ', 'Guide'), link('help', 'book', L('คู่มือการใช้งาน', 'User guide'), ui.route === 'help') + `<button type="button" class="sm-link" data-action="palette">${icon('keyboard')}<span>${L('ค้นหา / คำสั่ง', 'Search & commands')} <kbd>${MOD_KEY} K</kbd></span></button>`, ui.route === 'help')}
      ${acc('data', 'database', L('ข้อมูล', 'Data'), `<button type="button" class="sm-link" data-action="import-csv">${icon('upload')}<span>${L('นำเข้าเทรด (CSV)', 'Import trades (CSV)')}</span></button><button type="button" class="sm-link" data-action="export-csv-all">${icon('download')}<span>${L('ส่งออกเทรดทั้งหมด (CSV)', 'Export all trades (CSV)')}</span></button>`, false)}
      ${act('theme', state.settings.theme === 'dark' ? 'moon' : 'sun', L('สลับธีมมืด / สว่าง', 'Switch dark / light'))}
      ${act('lang', 'globe', LANG === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย')}
    </nav>
    <div class="sm-foot">${needBackup ? `<p>${L('ยังไม่ได้สำรองข้อมูลมาสักพัก', 'It’s been a while since your last backup')}</p>` : `<p>${L('สำรองข้อมูลเป็นประจำเพื่อความปลอดภัย', 'Back up regularly to keep your journal safe')}</p>`}<button type="button" class="btn sm-cta" data-action="backup">${icon('save')}<span>${L('สำรองข้อมูลตอนนี้', 'Back up now')}</span></button></div>
  </aside>`;
}
/* top-right account summary (like a broker's balance strip) — eye button hides the amounts */
function topStatsHTML() {
  const accs = currentAccounts(); if (!accs.length) return '';
  const cur = baseCurrency(), mixed = !cur;
  const bal = mixed ? null : sum(accs.map(a => accountBalance(a.id) / repDiv(a.id)));
  const ids = new Set(accs.map(a => a.id)), today = todayKey();
  const todayNet = mixed ? null : sum(state.trades.filter(t => ids.has(t.accountId) && t.status === 'Closed' && tradeDay(t) === today).map(t => (calc(t).net || 0) / repDiv(t.accountId)));
  const open = state.trades.filter(t => ids.has(t.accountId) && t.status === 'Open').length;
  const s = stats(filtered()), net = mixed ? null : s.net;
  const m = (v, sign) => finite(v) ? money(v, cur, sign) : '—';
  const it = (v, l, cls = '') => `<div class="ts-it"><b class="${cls}">${v}</b><small>${l}</small></div>`;
  return `<div class="topstats ${ui.hideTopStats ? 'masked' : ''}">${it(m(bal), L('ยอดเงิน', 'Balance'))}${it(m(todayNet, true), L('วันนี้', 'Today'), tone(todayNet))}${it(open, L('เปิดอยู่', 'Open'))}${it(m(net, true), L('กำไรสุทธิ', 'Net P&L'), tone(net))}<button type="button" class="ts-eye" data-action="top-eye" aria-label="${L('ซ่อน/แสดงยอดเงิน', 'Hide / show amounts')}" data-tip="${L('ซ่อน/แสดงยอดเงิน', 'Hide / show amounts')}">${icon('eye')}</button></div>`;
}
/* page-level scope row under the title (date range · account · unit · filters) */
const SCOPE_ROOTS = ['dashboard', 'trades', 'reports', 'playbooks'];
function scopeBar() {
  const fc = activeFilterCount();
  const sel = (ui_, ic, html, label) => `<label class="sc-it">${icon(ic)}<select class="sc-sel" data-ui="${ui_}" aria-label="${label}">${html}</select></label>`;
  return `<div class="scopebar">
    <button type="button" class="sc-it dr-btn" data-action="dr-open" aria-haspopup="dialog" aria-label="${L('ช่วงเวลา', 'Date range')}">${icon('calendar')}<span>${esc(rangeLabel())}</span>${icon('chev-down')}</button><i class="sc-sep"></i>
    ${sel('account', 'wallet', entityOptions('accounts', ui.account, L('ทุกบัญชี', 'All accounts')), L('บัญชี', 'Account'))}<i class="sc-sep"></i>
    ${sel('unit', 'activity', [['P&L', 'P&L'], ['R', 'R-Multiple'], ['%', L('% เปลี่ยนแปลง', 'Change %')], ['Pips', L('ปิ๊บ', 'Pips')], ['Points', L('จุด', 'Points')]].map(([v, l]) => opt(v, l, ui.unit)).join(''), L('หน่วยแสดงผล', 'Unit'))}<i class="sc-sep"></i>
    <button type="button" class="sc-it fbtn ${fc ? 'on' : ''}" data-action="filters" aria-label="${L('ตัวกรองทั้งระบบ', 'Global filters')}">${icon('filter')}<span>${L('ตัวกรอง', 'Filters')}</span>${fc ? `<span class="fbadge">${fc}</span>` : ''}</button>
  </div>`;
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
    case 'calculator': return calculatorView();
    default: return dashboardView();
  }
}
function scopeLine(rows) {
  const parts = [], fxb = fxBanner();
  if (ui.preset !== 'all') parts.push(PRESETS().find(p => p[0] === ui.preset)?.[1] + (ui.from ? ` (${fmtDate(ui.from)} – ${fmtDate(ui.to || todayKey())})` : ''));
  if (ui.account) parts.push(nameOf('accounts', ui.account));
  const fc = activeFilterCount(); if (fc) parts.push(L(`ตัวกรอง ${fc} รายการ`, `${fc} filters`));
  const mixed = !monetaryAllowed(rows);
  return fxb + (parts.length ? `<div class="chipbar">${parts.map(p => `<span class="fchip">${esc(p)}</span>`).join('')}${btn(L('ล้างทั้งหมด', 'Clear all'), 'clear-scope', {}, 'ghost sm')}</div>` : '') + (mixed && ui.unit === 'P&L' ? `<div class="notice warn mb16">${icon('alert')}<span>${L('มีหลายสกุลเงินบัญชีในมุมมองนี้ — ตัวเลขเงินรวมจะไม่แสดง เลือกบัญชีเดียวหรือเปลี่ยนหน่วยเป็น R', 'Multiple account currencies — monetary totals hidden. Pick one account or switch to R.')}</span></div>` : '');
}

/* v3.54 — Trades page KPI cards with mini charts (like the dashboard) */
function tradesKpis(rows, s) {
  return miniRow([
    miniCard(L('กำไรสุทธิ', 'Net profit'), `<span class="${tone(s.total)}">${unitFmt(s.total)}</span>`, `${L('ผลตอบแทน', 'Return')} <span class="${tone(s.ret)}">${finite(s.ret) ? fmt(s.ret, 2, true) + '%' : '—'}</span>`, sparkline(cumVals(rows))),
    miniCard(L('อัตราชนะ', 'Win rate'), finite(s.wr) ? fmt(s.wr, 1) + '%' : '—', `${L('เทรดทั้งหมด', 'Total trades')} ${s.n}`, wlGauge(s.wins, s.be, s.losses)),
    miniCard('Profit factor', fmt(s.pfU, 2), pfWord(s), pfViz(s)),
    miniCard(L('ค่าคาดหวัง', 'Expectancy'), `<span class="${tone(s.expectancy)}">${unitFmt(s.expectancy)}</span>`, `${L('เฉลี่ย', 'Average')} ${finite(s.avgR) ? fmt(s.avgR, 2, true) + 'R' : '—'}`, expViz(s)),
    miniCard(L('R-Multiple รวม', 'Total R-Multiple'), `<span class="${tone(s.r)}">${finite(s.r) ? fmt(s.r, 2, true) + 'R' : '—'}</span>`, `${s.validR} ${L('เทรดที่มี S/L', 'with S/L')}`, sparkline(cumVals(rows, 'R')))
  ]); // v3.76.2: Costs card removed
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
    <div class="card"><div><div class="l">${gl(L('กำไร/ขาดทุนสุทธิ', 'Net P&L'), 'netProfit')}</div><div class="v ${tone(s.total)}">${unitFmt(s.total, u)}</div><div class="s"><span class="${tone(s.ret)}">${finite(s.ret) ? fmt(s.ret, 2, true) + '%' : '—'}</span></div></div><div class="viz">${sparkline(cum.map(p => p.y))}</div></div>
    <div class="card"><div><div class="l">${gl(L('อัตราชนะ', 'Win rate'), 'winRate')}</div><div class="v">${finite(s.wr) ? fmt(s.wr, 1) + '%' : '—'}</div><div class="s">${L('เทรดทั้งหมด', 'Total trades')} ${s.n}</div></div><div class="viz">${wlGauge(s.wins, s.be, s.losses)}</div></div>
    <div class="card"><div><div class="l">${gl('Profit factor', 'profitFactor')}</div><div class="v">${fmt(s.pfU, 2)}</div><div class="s">${s.pfU >= 1.5 ? L('แข็งแรง', 'Strong') : s.pfU >= 1 ? L('มีกำไร', 'Profitable') : L('ต้องปรับปรุง', 'Needs work')}</div></div><div class="viz">${arcGauge(pfPct, pfCls)}</div></div>
    <div class="card"><div><div class="l">${gl(L('ค่าคาดหวัง', 'Expectancy'), 'expectancy')}</div><div class="v ${tone(s.expectancy)}">${unitFmt(s.expectancy, u)}</div><div class="s">${L('เฉลี่ย', 'Average')} ${finite(s.avgR) ? fmt(s.avgR, 2, true) + 'R' : '—'}</div></div><div class="viz">${arcGauge(expPct, tone(s.expectancy) === 'muted' ? 'muted' : tone(s.expectancy))}</div></div>
    <div class="card"><div><div class="l">${gl(L('กำไรเฉลี่ย / ขาดทุนเฉลี่ย', 'Average profit / loss'), 'payoff')}</div><div class="v">${fmt(s.payU, 2)}</div><div class="s">${L('Payoff ratio', 'Payoff ratio')}</div></div><div class="viz"><div><div class="ratio-bar"><span style="width:${wp}%;background:var(--pos)"></span><span style="width:${100 - wp}%;background:var(--neg)"></span></div><div class="ratio-vals"><span class="pos">${unitFmt(s.avgWinU, u, false)}</span><span class="neg">${unitFmt(s.avgLossU, u)}</span></div></div></div></div>
  </div>`;
  const eqMode = ui.eqMode === 'balance' ? 'balance' : 'cum';
  const eqSeg = seg([['cum', L('สะสม', 'Cumulative')], ['balance', L('ยอดเงิน', 'Balance')]], eqMode, 'eq-mode');
  const equity = eqMode === 'balance' ? panel(L('กราฟผลตอบแทนสะสม', 'Equity curve'), chartBox({ type: 'line', series: [{ name: L('ยอดเงิน', 'Balance'), data: balanceSeries(rows), area: true }], unit: 'P&L', zero: false, empty: L('เลือกบัญชีสกุลเงินเดียวเพื่อดูยอดเงิน', 'Select one currency to see balance') }, 300), eqSeg)
    : U('dash-eq', u => { const s2 = stats(rows); return panel(L('กราฟผลตอบแทนสะสม', 'Equity curve'), chartBox({ type: 'line', series: [{ name: 'Cumulative', data: cumulativeSeries(rows) }], signed: true, unit: u }, 300), eqSeg, '', `<span class="hv ${tone(s2.total)}">${unitFmt(s2.total, u)}</span>`); });
  const ddP = U('dash-dd', u => { const s2 = stats(rows); return panel('Drawdown', chartBox({ type: 'line', series: [{ name: 'Drawdown', data: drawdownSeries(rows), area: true, color: 'var(--neg)' }], unit: u }, 300), '', '', `${L('Drawdown สูงสุด', 'Max drawdown')} <span class="neg">${unitFmt(s2.ddU, u)}</span>${finite(s2.ddPct) && u === 'P&L' ? ` · ${fmt(s2.ddPct, 2)}%` : ''}`); });
  const dailyP = U('dash-daily', u => { const daily = dailySeries(rows).slice(-45); return panel(L('ผลรายวัน', 'Daily P&L'), chartBox({ type: 'bar', data: daily, unit: u }, 300), '', '', L(`${daily.length} วันล่าสุดที่มีเทรด`, `Last ${daily.length} trading days`)); });
  const recent = closedSorted(rows).slice(-7).reverse(), openT = rows.filter(t => t.status === 'Open');
  const recentP = panel(L('เทรดล่าสุด', 'Recent trades'), `<div class="tl">${[...openT.slice(0, 3), ...recent].slice(0, 8).map(t => { const c = calc(t); return `<div class="tl-row" data-action="view-trade" data-id="${t.id}">${insIcon(get('instruments', t.instrumentId))}<div class="grow"><strong>${esc(nameOf('instruments', t.instrumentId, 'symbol'))}</strong> ${sideBadge(t.side)}<small class="sub2">${fmtDate(t.status === 'Open' ? t.entryDateTime : t.exitDateTime, { time: true, zone: tradeZone(t) })}</small></div>${t.status === 'Open' ? badge(L('เปิดอยู่', 'OPEN'), 'st open') : `<div class="right"><strong class="${tone(c.net)}">${unitFmt(value(t), u)}</strong><small class="sub2">${finite(c.r) ? fmt(c.r, 2, true) + 'R' : ''}</small></div>`}</div>`; }).join('') || empty(L('ยังไม่มีเทรด', 'No trades yet'))}</div>`, `<a class="btn ghost sm" href="#trades">${L('ดูทั้งหมด', 'View all')} ${icon('chev-right')}</a>`);
  const calP = panel(`${monthName(ui.month, true)} ${ui.year}`, calendarHTML(rows, ui.year, ui.month), `${ibtn('chev-left', 'cal-month', L('เดือนก่อน', 'Previous'), { 'data-dir': -1 })}${btn(L('วันนี้', 'Today'), 'cal-today', {}, 'ghost sm')}${ibtn('chev-right', 'cal-month', L('เดือนถัดไป', 'Next'), { 'data-dir': 1 })}`);
  const vals = closedSorted(rows).map(t => calc(t).r).filter(finite), bins = [['<−2', '< −2R', v => v < -2], ['−2', '−2R … −1.5R', v => v >= -2 && v < -1.5], ['−1.5', '−1.5R … −1R', v => v >= -1.5 && v < -1], ['−1', '−1R … −0.5R', v => v >= -1 && v < -.5], ['−.5', '−0.5R … 0R', v => v >= -.5 && v < -EPS], ['BE', L('เสมอทุน', 'Breakeven'), v => Math.abs(v) <= EPS], ['0', '0R … +0.5R', v => v > EPS && v < .5], ['.5', '+0.5R … +1R', v => v >= .5 && v < 1], ['1', '+1R … +1.5R', v => v >= 1 && v < 1.5], ['1.5', '+1.5R … +2R', v => v >= 1.5 && v < 2], ['2', '+2R … +3R', v => v >= 2 && v < 3], ['3+', '≥ +3R', v => v >= 3]];
  const hist = bins.map(([l, tip, f], i) => { const n = vals.filter(f).length; return { x: l, label: l, y: n, color: i < 5 ? 'var(--neg)' : i === 5 ? 'var(--dim)' : 'var(--pos)', tip, sub: n + L(' เทรด', ' trades') }; });
  const tipT = (t, tip) => `<span class="ul-tip" data-tip="${esc(tip)}">${t}</span>`; // v3.77: card notes live in the title tooltip
  const distP = panel(tipT(L('การกระจายของ R-Multiple', 'R-multiple distribution'), L(`${vals.length} เทรดที่มีระดับ S/L`, `${vals.length} trades with a stop`)), chartBox({ type: 'bar', data: hist, unit: 'count', categorical: true, signed: false, valueLabels: true, tipFmt: v => fmt(v, 0) + L(' เทรด', ' trades') }, 300));
  const insP = U('dash-ins', () => panel(L('ผลตามสินทรัพย์', 'By instrument'), iconBars(group(rows, 'instrument').slice(0, 7), 'total'), `<a class="btn ghost sm" href="#reports/drill" data-action="go-dim" data-dim="instrument">${icon('layers')}</a>`));
  const sessP = U('dash-sess', u => { const bySess = group(rows, 'session').sort(dimKeySort('session')).map(g => ({ x: g.key, label: g.label, tip: g.label, y: g.s.total ?? 0, sub: `${g.s.n} ${L('เทรด', 'trades')} · ${L('อัตราชนะ', 'Win rate')} ${fmt(g.s.wr, 0)}%` })); return panel(tipT(L('ผลตามเซสชัน', 'By session'), L('อ้างอิงเวลาเข้า ตามเวลาท้องถิ่นของแต่ละตลาด', 'Based on entry time in each market’s local time')), chartBox({ type: 'bar', categorical: true, data: bySess, unit: u, valueLabels: true, valueFmt: v => compactUnit(v) }, 300)); }); // v3.77: vertical bars like Insights
  return pageHead(`<span class="row gap8"><span class="hello-ic">${icon(helloIc)}</span>${hello}${state.settings.profile?.name ? `, ${esc(state.settings.profile.name.split(/\s+/)[0])}` : ''}</span>`, `${fmtDate(todayKey())} · ${L('สรุปผลการเทรดของคุณ', 'Your trading at a glance')}`, `${ibtn('upload', 'import-csv', L('นำเข้า', 'Import'), {}, 'hd-ib')}${btn(icon('calendar') + L(' จดบันทึกวันนี้', ' Journal today'), 'journal-today', {}, '')}`)
    + scopeLine(rows) + hero
    + `<div class="grid g3 mb16 dash-top">${equity}${ddP}${dailyP}</div>`
    + `<div class="grid g-12 mb16 dash-mid">${recentP}${calP}</div>`
    + `<div class="grid g3">${distP}${insP}${sessP}</div>`;
}
function welcomeView() {
  return `<div style="max-width:880px;margin:6vh auto 0">${pageHead(L('ยินดีต้อนรับสู่ Tickmeta', 'Welcome to Tickmeta'), (CLOUD ? L('สมุดบันทึกการเทรด ข้อมูลเก็บใน Cloudflare ของคุณเองและใช้ได้ทุกอุปกรณ์', 'A trading journal stored in your own Cloudflare, on every device') : L('สมุดบันทึกการเทรดแบบออฟไลน์ ข้อมูลทั้งหมดอยู่ในเครื่องของคุณ', 'An offline trading journal. Your data never leaves this device.')))}
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
      html += `<div class="day ${inM ? '' : 'out'} ${cls} ${k === tk ? 'today' : ''}" style="--i:${o ? (.25 + .75 * Math.abs(o.v) / maxAbs).toFixed(2) : 0}" data-action="open-day" data-day="${k}" title="${fmtDate(k)}${o ? ' · ' + unitFmt(o.v, ui.unit) + ' · ' + o.n + L(' เทรด', ' trades') : ''}"><span class="dn">${+k.slice(8)}</span>${!mini && jset.has(k) ? `<i class="jdot" title="${L('มีบันทึกประจำวัน', 'Journal')}"></i>` : ''}${o ? `${mini === 'color' ? '' : `<span class="pl ${tone(o.v)}">${mini ? compactUnit(o.v) : unitFmt(o.v, ui.unit)}</span>${mini ? '' : `<span class="tc">${o.n} ${L('เทรด', 'tr')} · ${fmt(o.w / o.n * 100, 0)}%</span>`}`}` : ''}</div>`;
    }
    if (!mini) html += `<div class="wk"><span>${L('สัปดาห์', 'Week')} ${w + 1}</span><strong class="${tone(wv)}">${wn ? unitFmt(wv, ui.unit) : '—'}</strong><span>${wn ? wn + L(' เทรด', ' trades') : ''}</span></div>`;
    if (w >= 3 && !any) break;
    if (+shiftKey(start, { days: w * 7 + 7 }).slice(5, 7) !== month + 1 && w >= 3) break;
  }
  return `<div class="cal ${mini ? 'mini' : ''} ${mini === 'color' ? 'color-only' : ''}">${html}</div>`;
}
function compactUnit(v) { if (ui.unit === 'P&L') { const a = Math.abs(v); return (v < 0 ? '−' : '+') + (a >= 1000 ? fmt(a / 1000, a >= 10000 ? 0 : 1) + 'K' : fmt(a, 0)); } return fmt(v, 1, true); }

/* ---------------- TRADES ---------------- */
const COLS = () => ({ entryDateTime: L('เข้า', 'Entry'), exitDateTime: L('ออก', 'Exit'), instrumentId: L('สินทรัพย์', 'Instrument'), side: L('ทิศทาง', 'Side'), playbookId: L('กลยุทธ์', 'Strategy'), accountId: L('บัญชี', 'Account'), status: L('สถานะ', 'Status'), quantity: L('จำนวน', 'Quantity'), entryPrice: L('ราคาเข้า', 'Entry price'), stopLoss: 'S/L', takeProfit: 'T/P', exitPrice: L('ราคาออก', 'Exit price'), net: L('กำไร/ขาดทุนสุทธิ', 'Net P&L'), r: 'R-Multiple', pips: L('ปิ๊บ', 'Pips'), change: L('% เปลี่ยนแปลง', 'Change %'), duration: L('ระยะเวลาถือ', 'Duration'), risk: L('ความเสี่ยง', 'Risk'), tags: L('แท็ก', 'Tags'), emotion: L('อารมณ์', 'Emotion'), rating: L('คะแนน', 'Rating'), session: L('เซสชัน', 'Session'), timeframe: L('ไทม์เฟรม', 'Timeframe'), commission: L('ค่าคอมมิชชัน', 'Commission'), swap: L('ค่าสวอป', 'Swap'), note: L('โน้ต', 'Note'), reviewed: L('รีวิว', 'Reviewed') });
const NUM_COLS = ['quantity', 'entryPrice', 'stopLoss', 'takeProfit', 'exitPrice', 'net', 'r', 'pips', 'change', 'duration', 'risk', 'commission', 'swap'];
/* v3.19 — phones get a card list instead of the wide table */
function tradeCardHTML(t) {
  const c = calc(t), ins = get('instruments', t.instrumentId), pb = t.playbookId ? nameOf('playbooks', t.playbookId) : '';
  const right = t.status === 'Closed' ? `<strong class="${tone(c.net)}">${unitFmt(value(t))}</strong><small>${finite(c.r) && ui.unit !== 'R' ? fmt(c.r, 2, true) + 'R' : ''}</small>` : statusBadge(t.status);
  return `<div class="tcard" data-action="view-trade" data-id="${t.id}">${insIcon(ins)}<div class="grow" style="min-width:0"><div class="row gap6"><strong>${esc(ins?.symbol || t.symbol || '—')}</strong>${sideBadge(t.side)}${t.timeframe ? `<span class="badge">${esc(t.timeframe)}</span>` : ''}</div><small class="dim ell">${fmtDate(t.entryDateTime, { time: true, zone: tradeZone(t) })}${pb ? ' · ' + esc(pb) : ''}</small></div><div class="tc-r">${right}</div></div>`;
}
function tradeSortVal(t, k) { const c = calc(t); switch (k) { case 'entryDateTime': case 'exitDateTime': return t[k] ? +new Date(t[k]) : null; case 'instrumentId': return nameOf('instruments', t.instrumentId, 'symbol'); case 'playbookId': return nameOf('playbooks', t.playbookId); case 'accountId': return nameOf('accounts', t.accountId); case 'net': return value(t, ui.unit === 'P&L' ? 'P&L' : ui.unit) ?? c.net; case 'r': return c.r; case 'pips': return c.pips; case 'change': return c.change; case 'duration': return c.duration; case 'risk': return c.risk; case 'session': return sessionOf(t); case 'timeframe': return TIMEFRAMES.indexOf(t.timeframe); case 'tags': return (t.tags || []).map(id => nameOf('tags', id)).join(','); default: return t[k] ?? null; } }
function sortTrades(rows) { const k = ui.sortKey, d = ui.sortDir === 'asc' ? 1 : -1; return rows.slice().sort((a, b) => { const x = tradeSortVal(a, k), y = tradeSortVal(b, k); if (x == null || x === '') return 1; if (y == null || y === '') return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * d; }); }
function tradeCell(t, k) {
  const c = calc(t), ins = get('instruments', t.instrumentId), dec = ins?.decimals ?? 2, cur = accountCurrency(t);
  switch (k) {
    case 'entryDateTime': case 'exitDateTime': return t[k] ? `${fmtDate(t[k], { short: true })}<small>${fmtTime(t[k])}</small>` : '—';
    case 'instrumentId': return symbolCell(t.instrumentId); // v3.77: no trade ID under the symbol
    case 'side': return sideBadge(t.side);
    case 'playbookId': return t.playbookId ? `<span class="row gap4"><i class="colorbar" style="background:${esc(get('playbooks', t.playbookId)?.color || 'var(--accent)')};height:14px"></i>${esc(nameOf('playbooks', t.playbookId))}</span>` : '<span class="dim">—</span>';
    case 'accountId': return esc(nameOf('accounts', t.accountId));
    case 'status': return statusBadge(t.status);
    case 'quantity': return fmt(t.quantity, specFor(ins, t.accountId)?.quantityStep < 1 ? 2 : 0);
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
  const quick = ui.tradeQuick === 'review' ? 'all' : (ui.tradeQuick || 'all'); // v3.77: "To review" filter removed
  let rows = filtered({ search: ui.search });
  if (quick === 'win') rows = rows.filter(t => calc(t).result === 'win'); else if (quick === 'loss') rows = rows.filter(t => calc(t).result === 'loss'); else if (quick === 'open') rows = rows.filter(t => t.status === 'Open'); else if (quick === 'review') rows = rows.filter(t => t.status === 'Closed' && !t.reviewed); else if (quick === 'mistake') rows = rows.filter(t => (t.tags || []).some(isMistakeTag)); else if (quick === 'missed') rows = filtered({ search: ui.search, includeMissed: true }).filter(t => t.status === 'Missed');
  const all = sortTrades(rows), size = ui.pageSize || all.length || 1, pages = Math.max(1, Math.ceil(all.length / size)); ui.page = clamp(ui.page, 1, pages);
  const page = all.slice((ui.page - 1) * size, ui.page * size), s = stats(rows), cols = ui.columns.filter(c => COLS()[c]);
  const counts = { all: filtered({ search: ui.search }).length };
  const sel = ui.selected.size;
  const head = `<tr><th style="width:34px"><input type="checkbox" class="cb" data-action="sel-page" ${page.length && page.every(t => ui.selected.has(t.id)) ? 'checked' : ''} aria-label="${L('เลือกทั้งหน้า', 'select page')}"></th>${cols.map(k => `<th class="${NUM_COLS.includes(k) ? 'num' : ''}"><button class="sort ${ui.sortKey === k ? 'on' : ''}" data-action="sort" data-key="${k}">${esc(COLS()[k])}${ui.sortKey === k ? icon(ui.sortDir === 'asc' ? 'chev-up' : 'chev-down', 'tiny') : ''}</button></th>`).join('')}<th style="width:40px"></th></tr>`;
  const body = page.map(t => `<tr class="click ${ui.selected.has(t.id) ? 'sel' : ''}" data-row="${t.id}"><td><input type="checkbox" class="cb" data-action="sel-row" data-id="${t.id}" ${ui.selected.has(t.id) ? 'checked' : ''} aria-label="${L('เลือก', 'select')}"></td>${cols.map(k => `<td class="${NUM_COLS.includes(k) ? 'num' : ''}">${tradeCell(t, k)}</td>`).join('')}<td>${menu([menuItem(L('ดูรายละเอียด', 'View'), 'view-trade', { 'data-id': t.id }, 'eye'), menuItem(L('แก้ไข', 'Edit'), 'edit-trade', { 'data-id': t.id }, 'edit'), menuItem(L('ทำสำเนา', 'Duplicate'), 'dup-trade', { 'data-id': t.id }, 'copy'), menuItem(L('ลบ', 'Delete'), 'del-trade', { 'data-id': t.id }, 'trash', 'danger')])}</td></tr>`).join('');
  return pageHead(L('รายการเทรด', 'Trades'), L(`${counts.all} รายการในมุมมองนี้`, `${counts.all} trades in view`), `${timeViewSeg()}${ibtn('upload', 'import-csv', L('นำเข้า', 'Import'), {}, 'hd-ib')}${ibtn('download', 'export-csv', L('ส่งออก CSV', 'Export CSV'), {}, 'hd-ib')}${btn(icon('plus') + L(' เทรดใหม่', ' New trade'), 'new-trade', {}, 'primary')}`)
    + scopeLine(rows)
    + tradesKpis(rows, s)
    + `<div class="filterbar"><div class="searchbox">${icon('search')}<input data-ui="search" value="${esc(ui.search)}" placeholder="${L('ค้นหาสัญลักษณ์ แท็ก โน้ต หรือรหัส…', 'Search symbol, tag, note, ID…')}" aria-label="search"></div>${seg([['all', L('ทั้งหมด', 'All')], ['win', L('กำไร', 'Profit')], ['loss', L('ขาดทุน', 'Loss')], ['open', L('เปิดอยู่', 'Open')], ['mistake', L('มีความผิดพลาด', 'Mistakes')], ['missed', L('พลาด', 'Missed')]], quick, 'trade-quick')}<div class="grow"></div>${ibtn('columns', 'columns', L('คอลัมน์ตาราง', 'Table columns'), {}, 'hd-ib')}</div>`
    + (sel ? `<div class="bulk"><strong>${sel} ${L('รายการที่เลือก', 'selected')}</strong><div class="grow"></div>${btn(icon('tag') + L(' เพิ่มแท็ก', ' Add tag'), 'bulk', { 'data-op': 'tag' }, 'sm')}${btn(icon('playbooks') + ' Strategy', 'bulk', { 'data-op': 'playbook' }, 'sm')}${btn(icon('check') + L(' รีวิวแล้ว', ' Reviewed'), 'bulk', { 'data-op': 'reviewed' }, 'sm')}${ibtn('download', 'bulk', L('ส่งออก CSV', 'Export CSV'), { 'data-op': 'export' }, 'sm')}${btn(icon('trash') + L(' ลบ', ' Delete'), 'bulk', { 'data-op': 'delete' }, 'sm danger')}${btn(L('ยกเลิก', 'Clear'), 'sel-clear', {}, 'ghost sm')}</div>` : '')
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
  const missed = t.status === 'Missed', mR = missed ? missedR(t) : null, hasBroker = !!get('accounts', t.accountId)?.brokerTz, tdView = hasBroker ? (ui.tdTime || timeView()) : 'local', zone = tdView === 'broker' ? accZone(t.accountId) : tz();
  const head = `<div class="grow row gap8" style="min-width:0"><strong class="td-title">${L('รายละเอียดเทรด', 'Trade details')}</strong><span class="small dim ell td-did">${esc(t.displayId || '')}</span>${missed ? statusBadge('Missed') : ''}</div><a href="#notes/journal/${tradeDay(t)}" class="jlink small" data-action="close-drawer">${icon('journal-day', 'tiny')} <span class="td-jl">${L('บันทึกของวันนี้', 'Day journal')}</span></a>${ibtn('chev-up', 'view-trade', L('ก่อนหน้า', 'Previous'), { 'data-id': prev?.id || '', disabled: !prev })}${ibtn('chev-down', 'view-trade', L('ถัดไป', 'Next'), { 'data-id': next?.id || '', disabled: !next })}${btn(icon('edit') + L(' แก้ไข', ' Edit'), 'edit-trade', { 'data-id': id }, 'sm')}${menu([menuItem(L('ทำสำเนา', 'Duplicate'), 'dup-trade', { 'data-id': id }, 'copy'), menuItem(L('ปิดเทรดนี้', 'Close trade'), 'edit-trade', { 'data-id': id, 'data-close': 1 }, 'check'), menuItem(L('ลบ', 'Delete'), 'del-trade', { 'data-id': id }, 'trash', 'danger')])}${ibtn('x', 'close-drawer', L('ปิด', 'Close'))}`;
  const px = v => v != null ? fmt(v, dec) : '—', when = v => v ? fmtDate(v, { time: true, zone }) : '—', costs = (t.commission || 0) - (t.swap || 0);
  const tzTag = `<span class="td-tz">${hasBroker ? seg([['local', L('เวลาเครื่อง', 'Local')], ['broker', L('เวลาโบรกเกอร์', 'Broker')]], tdView, 'td-time', `data-id="${id}"`).replace('class="seg"', 'class="seg xs"') : ''}<span class="tz-tag" data-tip="${esc(zoneName(zone))}">${hasBroker ? '' : L('เวลาเครื่อง', 'local') + ' '}${utcLabel(zone, Date.parse(t.entryDateTime))}</span>${btn(icon('edit'), 'edit-trade-time', { 'data-id': id, 'aria-label': L('แก้ไขเวลา', 'Edit times'), 'data-tip': L('แก้ไขเวลาเข้า/ออก', 'Edit entry/exit times') }, 'ghost sm icon-only')}</span>`;
  const group = rows => `<div class="td-kv">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  const big = (label, val, cls, sub) => `<div class="td-stat"><div class="small muted">${label}</div><div class="td-big ${cls}">${val}</div><div class="small dim">${sub}</div></div>`;
  const chips = `${pb ? `<a class="td-chip" href="#playbooks/${pb.id}" data-action="close-drawer" data-tip="${L('กลยุทธ์', 'Strategy')}"><i class="colorbar" style="background:${esc(pb.color)};height:12px"></i><b>${esc(pb.name)}</b></a>` : `<span class="td-chip"><span>${L('ไม่มีกลยุทธ์', 'No strategy')}</span></span>`}${t.timeframe ? `<span class="td-chip" data-tip="${L('ไทม์เฟรม', 'Timeframe')}"><b>${esc(t.timeframe)}</b></span>` : ''}`;
  // v3.53 — one narrow column (sidebar): identity · net profit | R-Multiple · DETAILED · REVIEW
  const stat = (label, val, cls, sub, subCls = '') => `<div class="tds-stat"><div class="tds-l">${label}</div><div class="tds-v ${cls}">${val}</div><div class="tds-s ${subCls}">${sub}</div></div>`;
  const kv = rows => `<div class="td-kv">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  const tdTab = ui.tdTab === 'review' ? 'review' : 'info';
  const dm = finite(c.duration) && t.exitDateTime ? Math.round(c.duration) : null, dpart = (v, l) => `<div><b>${dm == null ? '—' : v}</b><small>${l}</small></div>`;
  const body = `<div class="tds">
    <div class="ed-tabs td-tabs" role="tablist"><button type="button" role="tab" class="${tdTab === 'info' ? 'on' : ''}" data-action="td-tab" data-value="info">${L('ข้อมูล', 'Info')}</button><button type="button" role="tab" class="${tdTab === 'review' ? 'on' : ''}" data-action="td-tab" data-value="review">${L('รีวิว', 'Review')}</button></div>
    <div class="td-pane" data-tdp="info" ${tdTab === 'info' ? '' : 'hidden'}>
    <div class="td-id"><span class="td-ic">${insIcon(ins, 'lg')}</span><div class="grow" style="min-width:0"><h2>${esc(ins?.symbol || '—')}</h2><div class="row gap6 wrap td-sub"><span class="td-side ${t.side === 'Sell' ? 'neg' : 'pos'}">${t.side === 'Sell' ? 'SHORT' : 'LONG'}</span>${t.status !== 'Closed' ? statusBadge(t.status) : ''}</div></div><span class="td-acc" data-tip="${L('บัญชี', 'Account')}"><span>${esc(nameOf('accounts', t.accountId))}</span>${centBadge(cur)}</span></div>
    ${pb || t.timeframe ? `<a class="td-pbchip" ${pb ? `href="#playbooks/${pb.id}" data-action="close-drawer"` : ''} data-tip="${L('กลยุทธ์ · ไทม์เฟรม', 'Strategy · timeframe')}">${t.timeframe ? `<b class="td-tf">${esc(t.timeframe)}</b>` : ''}<span>${pb ? esc(pb.name) : L('ไม่มีกลยุทธ์', 'No strategy')}</span></a>` : `<span class="td-pbchip none"><span>${L('ไม่มีกลยุทธ์', 'No strategy')}</span></span>`}
    ${t.status === 'Open' ? `<div class="td-banner">${icon('clock')}<div><b>${L('ออร์เดอร์ยังเปิดอยู่', 'Position is open')}</b><small>${L('เปิดเมื่อ', 'Opened')} ${when(t.entryDateTime)}</small></div></div>` : missed ? `<div class="td-banner warn">${icon('info')}<div><b>${L('จังหวะที่ไม่ได้เข้า', 'Missed setup')}</b><small>${L('ไม่นับใน P&L และสถิติ', 'Not counted in P&L or stats')}</small></div></div>` : ''}
    <div class="tds-stats">${stat(gl(L('กำไรสุทธิ', 'Net profit'), 'netProfit'), t.status === 'Closed' ? money(c.net, cur, true) : missed ? L('ไม่ได้เข้า', 'Not taken') : L('เปิดอยู่', 'Open'), tone(c.net), finite(c.change) ? fmt(c.change, 2, true) + '%' : '—', tone(c.change))}<i class="tds-sep"></i>${stat(gl(missed ? L('R ที่พลาด', 'Missed R') : 'R-Multiple', missed ? 'missedR' : 'rMultiple'), missed ? (finite(mR) ? fmt(mR, 2, true) + 'R' : '—') : finite(c.r) ? fmt(c.r, 2, true) + 'R' : '—', tone(missed ? mR : c.r), `${L('ที่วางแผน', 'Planned')} ${finite(c.planned) ? fmt(c.planned, 2) + 'R' : '—'}`)}</div>
    ${(() => { const pi = partialInfo(t); return pi ? `<div class="notice info mb12">${icon('layers')}<span>${L('ปิดไปแล้ว', 'Closed')} <b>${fmt(pi.qOut, 2)}/${fmt(pi.qIn, 2)}</b> · ${L('กำไรที่ปิดไปแล้ว', 'realized')} <b class="${tone(pi.realized)}">${money(pi.realized, cur, true)}</b></span></div>` : ''; })()}
    <div class="td-box tds-box"><div class="td-sec"><span class="td-st">${L('รายละเอียด', 'Details')}</span><button type="button" class="td-col" data-action="td-col" aria-label="${L('ย่อ/ขยาย', 'Collapse')}">${icon('chev-up')}</button></div>
      ${kv([[L('ราคาเข้า', 'Entry price'), px(t.entryPrice)], [L('ราคาออก', 'Exit price'), px(t.exitPrice)], ['S/L', px(t.stopLoss)], ['T/P', px(t.takeProfit)], [L('จำนวน', 'Quantity'), t.quantity > 0 ? fmt(t.quantity, ins?.quantityStep < 1 ? 2 : 0) : '—']])}<div class="td-hr"></div>${kv([[L('กำไรขั้นต้น', 'Gross profit'), `<span class="${tone(c.gross)}">${money(c.gross, cur, true)}</span>`], [L('ค่าธรรมเนียม', 'Charges'), `<span data-tip="${esc(L('ค่าคอมมิชชัน ', 'Commission ') + money(t.commission || 0, cur) + ' · ' + L('ค่าสวอป', 'Swap') + ' ' + money(t.swap || 0, cur, true))}">${money(costs, cur)}</span>`]])}
      ${execDetailHTML(t)}</div>
    <div class="td-box tds-box mt12 td-timebox"><div class="td-sec"><span class="td-st">${L('เวลาเทรด', 'Trade time')}</span> ${tzTag}<button type="button" class="td-col" data-action="td-col" aria-label="${L('ย่อ/ขยาย', 'Collapse')}">${icon('chev-up')}</button></div>
      ${kv([[L('เวลาเข้า', 'Entry time'), when(t.entryDateTime)], [L('เวลาออก', 'Exit time'), when(t.exitDateTime)]])}
      <div class="td-dur" data-tip="${esc(duration(c.duration))}"><span class="td-dur-l">${L('ระยะเวลาถือ', 'Duration')}</span><div class="td-dur-g">${dpart(Math.floor(dm / 1440), L('วัน', 'days'))}${dpart(Math.floor(dm % 1440 / 60), L('ชั่วโมง', 'hours'))}${dpart(dm % 60, L('นาที', 'min'))}</div></div>
      <div class="td-sess"><span>${L('เซสชันการเทรด', 'Trading session')}: <b>${esc(sessionLabel(sessionOf(t)))}</b></span></div></div>
    ${breaks.length ? `<div class="notice warn mt12">${icon('alert')}<div><b>${L('ข้อควรระวังตามกฎ', 'Rule flags')}</b><br>${breaks.map(esc).join(' · ')}</div></div>` : ''}
    </div>
    <div class="td-pane" data-tdp="review" ${tdTab === 'review' ? '' : 'hidden'}>
    <div class="td-review td-box tds-box"><div class="td-sec tds-rh"><span class="td-st">${L('รีวิว', 'Review')}</span>${stars(t.rating, 'quick-rating').replace('class="stars input"', `class="stars input" data-id="${id}"`)}<button type="button" class="td-col" data-action="td-col" aria-label="${L('ย่อ/ขยาย', 'Collapse')}">${icon('chev-up')}</button></div>
      <div class="td-lbl">${L('อารมณ์', 'Emotion')}</div>${emotionPicker(t.emotion, 'quick-emotion').replace('<div class="emo', `<div data-id="${id}" class="one-row emo`)}
      <div class="td-lbl">${L('แท็ก', 'Tags')}</div>${t.tags?.length ? `<div class="chips">${t.tags.map(x => tagChip(x)).join('')}</div>` : `<span class="dim small">—</span>`}
      <div class="td-lbl row" style="justify-content:space-between"><span>${L('บันทึก', 'Notes')}</span>${btn(icon('clipboard-pen') + L(' แก้ไขรีวิว', ' Edit review'), 'edit-trade', { 'data-id': id, 'data-tab': 'review' }, 'sm ghost')}</div>${t.note ? `<div class="notetext">${esc(plain(t.note) === t.note ? t.note : plain(t.note))}</div>` : `<p class="dim small" style="margin:0">${L('ยังไม่มีบันทึก — เพิ่มเหตุผลการเข้าและสิ่งที่ได้เรียนรู้', 'No notes yet')}</p>`}
      <div class="td-lbl row" style="justify-content:space-between"><span>${L('ภาพหน้าจอ', 'Screenshots')}</span>${t.chartUrl ? `<a class="btn sm ghost" href="${esc(t.chartUrl)}" target="_blank" rel="noopener noreferrer">${icon('external')}${L(' เปิดกราฟ', ' Open chart')}</a>` : ''}</div>${shotsHTML(t.images || [], 'trades', id)}
      <div class="tds-rev-end"><label class="row gap8 small tds-rev">${toggle('reviewed', t.reviewed, 'quick-reviewed', `data-id="${id}"`)}<span>${L('รีวิวแล้ว', 'Reviewed')}</span></label></div>
    </div>
    </div></div>`;
  openDrawer({ kind: 'trade', id, title: head, body, cls: 'td-drawer' });
  hydrateShots();
}
/* v3.77 — a chart link (e.g. TradingView snapshot) is added from the Screenshots box ("From link") */
function chartLinkChip(u) { u = safeUrl(u); if (!u) return ''; let host = u; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch { } return `<div class="chartlink"><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${icon('link')}<span>${esc(host)}</span><small>${esc(u)}</small></a>${ibtn('x', 'chartlink-del', L('เอาลิงก์ออก', 'Remove link'), {}, 'sm')}</div>`; }
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
  const ins = get('instruments', r.instrumentId), acc = get('accounts', r.accountId), fxNeeded = ins && acc && fxNeededFor(ins.valueCurrency || ins.quoteCurrency, acc.currency);
  const body = `${draftBar(draftKey, !!draft)}<form id="editor-form" autocomplete="off" onsubmit="return false">
  ${edTabsHTML([['main', L('รายละเอียด', 'Details'), 'trades'], ['review', L('รีวิว', 'Review'), 'clipboard-pen']], tab)}
  <div class="ed-pane" data-pane="main" ${tab === 'main' ? '' : 'hidden'}>
  <div class="ed-head"><div class="ed-insw">${instrumentPicker('instrumentId', r.instrumentId).replace('<div class="field">', '<div class="field ed-ins">')}<button type="button" class="ed-chev" data-action="ed-pick-ins" aria-label="${L('เลือกสินทรัพย์', 'Choose instrument')}">${icon('chev-down')}</button></div>${field('accountId', `${L('บัญชี', 'Account')} <span class="acc-cent-flag"></span>`, r.accountId, 'select', { html: entityOptions('accounts', r.accountId), required: true, cls: 'ed-acc', attrs: 'autofocus' })}<small class="ed-ins-desc" id="ed-ins-desc">${esc(ins ? insName(ins) : '')}</small></div>
  <div class="ed-dirw"><div class="dir" role="group" aria-label="${L('ทิศทาง', 'Side')}"><button type="button" class="long ${editor.side === 'Buy' ? 'on' : ''}" data-action="ed-side" data-value="Buy">LONG</button><button type="button" class="short ${editor.side === 'Sell' ? 'on' : ''}" data-action="ed-side" data-value="Sell">SHORT</button></div></div>
  <div class="ed-card" data-col="strategy"><div class="sec">${L('กลยุทธ์', 'Strategy')}${edColBtn()}</div><div class="ed-cb">
  <label class="ed-pb" for="f_playbookId"><a class="ed-pb-ic" id="ed-pb-open" href="${r.playbookId ? '#playbooks/' + esc(r.playbookId) : '#playbooks'}" target="_blank" rel="noopener" data-tip="${L('เปิดดูกลยุทธ์ (แท็บใหม่)', 'Open the strategy (new tab)')}" aria-label="${L('เปิดดูกลยุทธ์', 'Open the strategy')}" ${r.playbookId ? '' : 'hidden'}>${icon('external')}</a><span class="ed-pb-t"><b id="ed-pb-name">${esc(get('playbooks', r.playbookId)?.name || L('— ไม่ระบุกลยุทธ์ —', '— No strategy —'))}</b></span>${icon('chev-down')}<select id="f_playbookId" name="playbookId" aria-label="${L('กลยุทธ์', 'Strategy')}">${entityOptions('playbooks', r.playbookId, L('— ไม่ระบุ —', '— None —'))}</select></label>
  <input type="hidden" name="timeframe" value="${esc(r.timeframe || '')}"><div class="tf-pills tf-seg" role="group" aria-label="${L('ไทม์เฟรม', 'Timeframe')}">${TIMEFRAMES.map(x => `<button type="button" class="${r.timeframe === x ? 'on' : ''}" data-action="ed-tf" data-value="${x}">${x}</button>`).join('')}</div></div></div>
  <div class="ed-card" data-col="entry"><div class="sec">${L('เปิดสถานะ', 'Open position')}${edColBtn()}</div><div class="ed-cb"><div class="formgrid c2 ed-grid">
  ${field('entryDateTime', `${L('เวลาเข้า', 'Entry time')} <span class="ed-tzl" data-ed-tz>${edTzLabel(r.accountId, r.entryDateTime)}</span>`, localInput(r.entryDateTime, inputZone(r.accountId)), 'datetime-local', { required: true, cls: 'span2', help: `<span data-ed-tzx>${edTzExtra(r.accountId, r.entryDateTime)}</span>` })}
  ${field('entryPrice', L('ราคาเข้า', 'Entry price'), r.entryPrice, 'number', { required: true })}<div class="field ed-qty"><div class="lab-row"><label for="f_quantity">${L('จำนวน', 'Quantity')} <i class="req">*</i></label>${btn(icon('calculator'), 'ed-size', { 'aria-label': L('คำนวณจาก % ความเสี่ยง', 'Quantity from risk %'), 'data-tip': L('คำนวณจำนวนจาก % ความเสี่ยง', 'Quantity from risk %') }, 'icon-only qty-size xs')}</div><input id="f_quantity" name="quantity" type="number" step="any" value="${esc(r.quantity ?? '')}" required></div>
  ${field('stopLoss', 'S/L', r.stopLoss, 'number', { tip: L('จำเป็นสำหรับการคำนวณ R-Multiple', 'Needed for R-Multiple') })}${field('takeProfit', 'T/P', r.takeProfit, 'number')}
  ${fxNeeded || r.fxRate && r.fxRate !== 1 ? field('fxRate', L('อัตราแลกเปลี่ยน', 'FX rate'), r.fxRate ?? '', 'number', { placeholder: (() => { const d = defaultFx(ins?.valueCurrency || ins?.quoteCurrency, centParent(acc?.currency || '')); return d ? L('ค่าเริ่มต้น ', 'default ') + d : ''; })(), tip: `1 ${ins?.valueCurrency || ''} → ${centParent(acc?.currency || '')}${isCent(acc?.currency) ? L(' (แอปคูณ 100 เป็น ', ' (×100 to ') + acc.currency + ')' : ''}`, tipId: 'fx-tip', cls: 'span2' }) : `<input type="hidden" name="fxRate" value="${esc(r.fxRate ?? '')}">`}</div></div></div>
  <div class="ed-card" data-col="exit"><div class="sec">${L('ปิดสถานะ', 'Close position')}<span class="ed-sec-r"><button type="button" class="ed-execb ${editor.execMode ? 'on' : ''}" data-action="exec-toggle" aria-pressed="${editor.execMode}" aria-label="${L('ทยอยเข้า / ทยอยปิด (หลายรายการ)', 'Scale in / out (multiple fills)')}" data-tip="${L('ทยอยเข้า / ทยอยปิด (หลายรายการ)', 'Scale in / out (multiple fills)')}">${icon('split-scene')}</button>${edColBtn()}</span></div><div class="ed-cb">
  <div class="ed-strow"><span id="status-seg">${seg([['Closed', L('ปิดแล้ว', 'Closed')], ['Open', L('ยังเปิดอยู่', 'Open')], ['Missed', L('พลาด (ไม่ได้เข้า)', 'Missed')], ['Void', L('ยกเลิก', 'Void')]], editor.status, 'ed-status')}</span></div>
  <div id="missed-note" class="notice info mb16" ${editor.status === 'Missed' ? '' : 'hidden'}>${icon('info')}<span>${L('จังหวะที่เห็นแต่ไม่ได้เข้า — ใส่ราคาเข้า S/L และ T/P ที่ตั้งใจไว้ และใส่ "ราคาออก" เป็นราคาที่ราคาไปถึง เพื่อวัด R ที่พลาด · ไม่นับใน P&L และสถิติ', 'A setup you saw but did not take — enter the intended entry price, S/L and T/P, and use "Exit price" for where price went to measure the missed R · excluded from P&L and stats')}</span></div>
  <div id="exec-box" class="exec-box mb16" ${editor.execMode ? '' : 'hidden'}>${editor.execMode ? execBoxHTML() : ''}</div>
  <div class="formgrid c2 ed-grid" id="exit-fields" ${editor.status !== 'Closed' ? 'style="opacity:.45"' : ''}>${field('exitDateTime', `${L('เวลาออก', 'Exit time')} <span class="ed-tzl" data-ed-tz2>${edTzLabel(r.accountId, r.exitDateTime)}</span>`, localInput(r.exitDateTime, inputZone(r.accountId)), 'datetime-local', { cls: 'span2', help: `<span data-ed-tzx2>${edTzExtra(r.accountId, r.exitDateTime, false)}</span>` })}
  ${field('exitPrice', L('ราคาออก', 'Exit price'), r.exitPrice, 'number')}${field('grossPnL', L('กำไรขั้นต้น', 'Gross profit'), r.grossPnL ?? '', 'number', { tip: L('เว้นว่างเพื่อให้คำนวณอัตโนมัติ', 'Leave blank to calculate') })}
  ${field('commission', L('ค่าคอมมิชชัน', 'Commission'), r.commission ?? 0, 'number', { suffix: '<b class="cur-unit"></b>', tip: L('ใส่เป็นค่าบวก', 'Enter as a positive cost'), tipId: 'comm-tip' })}${field('swap', L('ค่าสวอป', 'Swap'), r.swap ?? 0, 'number', { suffix: '<b class="cur-unit"></b>', tip: L('+ ได้รับ / − จ่าย', '+ credit / − debit') })}</div>
  <details class="opt-sec mt12" id="mae-mfe" ${finite(r.mae) || finite(r.mfe) ? 'open' : ''}><summary>${icon('chev-right')}<span class="mae-t">MAE / MFE</span><span class="info-tip" data-tip="${L('ราคาที่ติดลบสุด / ดีที่สุดระหว่างถือ', 'Worst / best price while in the trade')}">${icon('info', 'tiny')}</span><span class="badge">${L('ไม่บังคับ', 'Optional')}</span></summary><div class="formgrid c4 mt12">${field('mae', L('MAE (ราคาที่ติดลบสุด)', 'MAE price'), r.mae ?? '', 'number', { tip: L('ใช้วัดคุณภาพจุดเข้า', 'Worst price against you') })}${field('mfe', L('MFE (ราคาที่ดีที่สุด)', 'MFE price'), r.mfe ?? '', 'number', { tip: L('ใช้วัดประสิทธิภาพการออก', 'Best price in your favour') })}</div></details></div></div>
  <div class="ed-card ed-rescard" data-col="result"><div class="sec">${L('ผลลัพธ์', 'Result')}${edColBtn()}</div><div class="ed-cb"><div id="livecalc" class="ed-livebox"></div></div></div>
  </div>
  <div class="ed-pane" data-pane="review" ${tab === 'review' ? '' : 'hidden'}><div class="ed-card">
  <div class="ed-rate"><div id="ed-rating" aria-label="${L('คะแนน', 'Rating')}">${stars(editor.rating, 'ed-rating')}</div></div>
  <div class="field mt16"><label>${L('อารมณ์', 'Emotion')}</label><div id="ed-emotion">${emotionPicker(editor.emotion, 'ed-emotion').replace('<div class="emo', '<div class="one-row emo')}</div></div>
  <div class="field mt16"><label>${L('แท็ก', 'Tags')}</label><div id="ed-tags">${tagPicker(editor.tags, get('playbooks', r.playbookId)?.relevantTagIds || [])}</div></div>
  <div class="mt16">${field('note', L('โน้ต', 'Note'), plain(r.note) === r.note ? (r.note || '') : plain(r.note), 'textarea', { rows: 4, placeholder: L('ทำไมถึงเข้า? เป็นไปตามแผนไหม? ได้เรียนรู้อะไร?', 'Why did you enter? Did you follow the plan?') })}</div>
  <div class="field mt16"><div class="lab-row"><label>${L('ภาพหน้าจอ', 'Screenshots')}</label><span class="shot-src">${btn(icon('upload') + L(' จากเครื่อง', ' From device'), 'shot-pick', {}, 'ghost sm')}${btn(icon('link') + L(' จากลิงก์', ' From link'), 'shot-link', {}, 'ghost sm')}</span></div><input type="hidden" name="chartUrl" value="${esc(r.chartUrl || '')}"><div id="ed-chartlink">${chartLinkChip(r.chartUrl)}</div><div id="editor-shots">${shotsHTML(editor.images, 'editor', 'x')}</div></div>
  </div></div>
  </form>`;
  openModal({ title: (editor.isNew ? L('บันทึกเทรดใหม่', 'New trade') : L('แก้ไขเทรด', 'Edit trade') + ` <span class="dim small">${esc(r.displayId || '')}</span>`), size: 'xl', cls: 'ed-sheet', body, saved: !!ex, fromDraft: draft?.at || null, draft: { key: draftKey, save: () => { const x = readTradeForm(); return { title: `${x.symbol || ''} ${x.side || ''}`.trim(), data: x }; }, restore: (data, at) => openTradeEditor(id, {}, false, 'main', { data, at }) }, foot: `${editor.isNew ? '' : btn(icon('trash') + L(' ลบ', ' Delete'), 'del-trade', { 'data-id': r.id }, 'ghost danger')}<div class="grow"></div>${btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost')}${editor.isNew ? btn(L('บันทึก & เพิ่มอีก', 'Save & add another'), 'save-trade', { 'data-again': 1 }) : ''}${btn(icon('save') + L(' บันทึก', ' Save'), 'save-trade', {}, 'primary')}`, onClose: () => { editor = null; } });
  hydrateShots($('#editor-shots')); fitSelect($('.ed-head .ed-acc select')); if (editor.execMode) setExecMode(true); else updateLive();
}
const edColBtn = () => `<button type="button" class="ed-colb" data-action="ed-col" aria-label="${L('ย่อ/ขยาย', 'Collapse')}">${icon('chev-up')}</button>`;
function lastUsed(k) { const t = state.trades.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0]; return t?.[k]; }
function readTradeForm() {
  const f = $('#editor-form'); if (!f) return editor.record; const d = formData(f), r = { ...editor.record };
  for (const k of ['quantity', 'entryPrice', 'stopLoss', 'takeProfit', 'exitPrice', 'commission', 'swap', 'grossPnL', 'fxRate', 'mae', 'mfe']) if (k in d) r[k] = num(d[k]);
  if ('timeframe' in d) r.timeframe = d.timeframe || ''; if ('chartUrl' in d) r.chartUrl = safeUrl(d.chartUrl);
  r.accountId = d.accountId; r.instrumentId = d.instrumentId; r.playbookId = d.playbookId || ''; 
  r.entryDateTime = toISO(d.entryDateTime, inputZone(d.accountId)); r.exitDateTime = toISO(d.exitDateTime, inputZone(d.accountId)); r.note = d.note || ''; if ('reviewed' in d) r.reviewed = !!d.reviewed; // v3.74: the editor no longer has the box — keep the stored value
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
  const ins = get('instruments', f.querySelector('[name=instrumentId]')?.value), q = num(f.querySelector('[name=quantity]')?.value), rate = ins ? commissionPerLotFor(ins, f.querySelector('[name=accountId]')?.value) ?? ins.commissionPerLot : undefined, help = $('#comm-tip'); // per-lot rate is in the normal currency; cent accounts ×100
  if (rate > 0 && q > 0) { el.value = +(q * rate).toFixed(2); if (help) help.dataset.tip = L(`ใส่เป็นค่าบวก · อัตโนมัติ: ${fmt(q, 2)} ล็อต × ${fmt(rate, 2)}`, `Enter as a positive cost · Auto: ${fmt(q, 2)} lot × ${fmt(rate, 2)}`); }
  else if (help) help.dataset.tip = L('ใส่เป็นค่าบวก', 'Enter as a positive cost');
}
/* which clock the trade editor's time fields use: the account's broker clock in Broker view */
function edZone() { return inputZone($('#editor-form [name=accountId]')?.value || editor?.record?.accountId); }
/* under a time field: what the typed time is in the other clock */
function edTzPreview(accountId, iso) {
  if (!iso || !get('accounts', accountId)?.brokerTz) return '';
  const z = inputZone(accountId), other = z === tz() ? accZone(accountId) : tz();
  return `= ${fmtDate(iso, { time: true, zone: other })} ${other === tz() ? L('เวลาเครื่อง', 'local time') : L('เวลาโบรกเกอร์', 'broker time')}`;
}
/* move the typed times (entry, exit, executions) from one clock to another without changing the instant */
function convertEdTimes(fromZ, toZ) {
  if (!fromZ || fromZ === toZ) return;
  [...$$('#editor-form [name=entryDateTime], #editor-form [name=exitDateTime]'), ...$$('[data-exec-row] [data-ex=time]')].forEach(i => { if (i.value) i.value = localInput(toISO(i.value, fromZ), toZ); });
}
/* v3.54: the clock goes in brackets after "Entry time" / "Exit time"; the conversion preview and the switch sit under the box */
function edTzLabel(accountId, iso) { const z = inputZone(accountId), b = !!get('accounts', accountId)?.brokerTz && z !== tz(), at = Date.parse(iso || '') || Date.now(); return `<span data-tip="${esc(zoneName(z))}">(${b ? L('เวลาโบรกเกอร์', 'Broker time') : L('เวลาเครื่อง', 'Local time')} ${utcLabel(z, at)})</span>`; }
function edTzExtra(accountId, iso, withSwitch = true) { const has = !!get('accounts', accountId)?.brokerTz, b = has && inputZone(accountId) !== tz(), pv = edTzPreview(accountId, iso); return [pv, has && withSwitch ? `<button type="button" class="linkbtn" data-action="ed-input-clock">${b ? L('กรอกเป็นเวลาเครื่องแทน', 'Type local time instead') : L('กรอกเป็นเวลาโบรกเกอร์', 'Type broker time')}</button>` : ''].filter(Boolean).join(' · '); }
function edTzHint(accountId, iso, withSwitch = true) { const z = inputZone(accountId), has = !!get('accounts', accountId)?.brokerTz, b = has && z !== tz(), at = Date.parse(iso || '') || Date.now(), pv = edTzPreview(accountId, iso); return `<span data-tip="${esc(zoneName(z))}">${b ? L('เวลาโบรกเกอร์', 'Broker time') : L('เวลาเครื่อง', 'Local time')} (${utcLabel(z, at)})</span>${pv ? ` ${pv}` : ''}${has && withSwitch ? ` · <button type="button" class="linkbtn" data-action="ed-input-clock">${b ? L('กรอกเป็นเวลาเครื่องแทน', 'Type local time instead') : L('กรอกเป็นเวลาโบรกเกอร์', 'Type broker time')}</button>` : ''}`; }
function updateLive() {
  if (!editor || editor.kind !== 'trades' || !$('#livecalc')) return;
  { const h = $('[data-ed-tz]'), acc = $('#editor-form [name=accountId]')?.value, nz = inputZone(acc); if (h && h.dataset.acc !== acc) { const prevZ = h.dataset.zone; convertEdTimes(prevZ, nz); h.dataset.acc = acc; h.dataset.zone = nz; }
    const ev = $('#editor-form [name=entryDateTime]')?.value, iso = ev ? toISO(ev, nz) : '', key = acc + '|' + nz + '|' + iso; if (h && h.dataset.key !== key) { h.innerHTML = edTzLabel(acc, iso); const x = $('[data-ed-tzx]'); if (x) x.innerHTML = edTzExtra(acc, iso); h.dataset.key = key; }
    const h2 = $('[data-ed-tz2]'), xv = $('#editor-form [name=exitDateTime]')?.value, xiso = xv ? toISO(xv, nz) : '', k2 = acc + '|' + nz + '|' + xiso; if (h2 && h2.dataset.key !== k2) { h2.innerHTML = edTzLabel(acc, xiso); const x = $('[data-ed-tzx2]'); if (x) x.innerHTML = edTzExtra(acc, xiso, false); h2.dataset.key = k2; } }
  { const di = $('#ed-ins-desc'), ii = get('instruments', $('#editor-form [name=instrumentId]')?.value); if (di) di.textContent = ii ? insName(ii) : ''; }
  { const pb = get('playbooks', $('#editor-form [name=playbookId]')?.value), n = $('#ed-pb-name'), d = $('#ed-pb-desc'); if (n) n.textContent = pb?.name || L('— ไม่ระบุกลยุทธ์ —', '— No strategy —'); { const o = $('#ed-pb-open'), o0 = $('.ed-pb-ic0'); if (o) { o.hidden = !pb; if (pb) o.href = '#playbooks/' + pb.id; } if (o0) o0.hidden = !!pb; } if (d) d.textContent = pb ? (plain(pb.description || '') || L('ไม่มีคำอธิบาย', 'No description')) : L('แตะเพื่อเลือกกลยุทธ์', 'Tap to pick a strategy'); }
  autoCommission();
  const r = readTradeForm(); calcCache.delete(r); const c = calc(r), cur = get('accounts', r.accountId)?.currency || 'USD', w = priceWarnings(r);
  if (!tickRate(r)) w.push(L('ต้องระบุอัตราแปลงสกุลเงินเพื่อคำนวณเงิน', 'Set an FX rate to compute money'));
  const bal = r.accountId ? accountBalance(r.accountId) : 0, riskPct = finite(c.risk) && bal > 0 ? c.risk / bal * 100 : null;
  w.push(...dailyLimitWarnings(r, c));
  if (finite(riskPct) && riskPct > (state.settings.riskWarning || 99)) w.push(L(`ความเสี่ยง ${fmt(riskPct, 2)}% ของบัญชี — เกินเกณฑ์ ${fmt(state.settings.riskWarning, 1)}%`, `Risk ${fmt(riskPct, 2)}% exceeds ${fmt(state.settings.riskWarning, 1)}%`));
  // v3.66: result card — Net profit · R · Pips tiles, then a few derived values
  const closedR = r.status === 'Closed', rate = tickRate(r), pipS = pipSizeOf(r), pipVal = finite(rate) && pipS > 0 && r.quantity > 0 ? rate * pipS * r.quantity : null;
  const tile = (v, cls, sub, lab) => `<div class="tds-stat"><div class="tds-v ${cls}">${v}</div><div class="tds-s">${sub}</div><div class="tds-l">${lab}</div></div>`;
  const kvr = (k, v, id = '') => `<div class="ed-kv"><span>${k}</span><i></i><b ${id ? `id="${id}"` : ''}>${v}</b></div>`;
  $('#livecalc').innerHTML = `<div class="tds-stats ed-res ed-tiles">${tile(closedR ? money(c.net, cur, true) : r.status === 'Missed' ? L('ไม่ได้เข้า', 'Not taken') : '—', closedR ? tone(c.net) : '', closedR && finite(c.change) ? fmt(c.change, 2, true) + '%' : '&nbsp;', gl(L('กำไรสุทธิ', 'Net profit'), 'netProfit'))}${tile(finite(c.r) ? fmt(c.r, 2, true) + 'R' : '—', tone(c.r), finite(c.planned) ? '1 : ' + fmt(c.planned, 2) : '&nbsp;', gl('R:R', 'rMultiple'))}${tile(finite(c.pips) ? fmt(c.pips, 1, true) : '—', tone(c.pips), '&nbsp;', L('ปิ๊บ', 'Pips'))}</div>`
    + `<div class="ed-kvs">${kvr(L('มูลค่าปิ๊บ', 'Pip value'), finite(pipVal) ? money(pipVal, cur) : '—')}${kvr(L('กำไรขั้นต้น', 'Gross profit'), closedR && finite(c.gross) ? `<span class="${tone(c.gross)}">${money(c.gross, cur, true)}</span>` : '—')}${kvr(L('ความเสี่ยง', 'Risk'), finite(c.risk) ? `${money(c.risk, cur)}${finite(riskPct) ? ` <small>${fmt(riskPct, 2)}%</small>` : ''}` : '—')}</div>` + (() => { const dm = r.status === 'Closed' && finite(c.duration) ? Math.round(c.duration) : null, dp = (v, l) => `<div><b>${dm == null ? '—' : v}</b><small>${l}</small></div>`; let ses = ''; try { ses = r.entryDateTime ? sessionLabel(sessionOf(r)) : ''; } catch { } return `<div class="td-dur ed-dur" data-tip="${esc(dm == null ? '' : duration(c.duration))}"><span class="td-dur-l">${gl(L('ระยะเวลาถือ', 'Duration'), 'holding')}</span><div class="td-dur-g">${dp(Math.floor((dm || 0) / 1440), L('วัน', 'days'))}${dp(Math.floor((dm || 0) % 1440 / 60), L('ชั่วโมง', 'hours'))}${dp((dm || 0) % 60, L('นาที', 'min'))}</div>${ses ? `<div class="td-sess"><span>${L('เซสชันการเทรด', 'Trading session')}: <b>${esc(ses)}</b></span></div>` : ''}</div>`; })()
    + `${w.length ? `<div class="notice warn mt8">${icon('alert')}<span>${w.map(esc).join('<br>')}</span></div>` : ''}`;
  { const hd = $('#ed-hold'); if (hd) hd.textContent = r.status === 'Closed' && finite(c.duration) ? duration(c.duration) : '—'; }
  $('#exit-fields') && ($('#exit-fields').style.opacity = ['Closed', 'Missed'].includes(editor.status) || editor.execMode ? 1 : .45); const mn = $('#missed-note'); if (mn) mn.hidden = editor.status !== 'Missed';
  if (editor.execMode) { const dec = (get('instruments', r.instrumentId)?.decimals ?? 2) + 2, set = (n, v) => { const i = $(`#editor-form [name=${n}]`); if (i && document.activeElement !== i) i.value = v ?? ''; }; set('entryPrice', finite(r.entryPrice) ? +r.entryPrice.toFixed(dec) : ''); set('quantity', r.quantity); set('entryDateTime', localInput(r.entryDateTime, edZone())); set('exitPrice', finite(r.exitPrice) ? +r.exitPrice.toFixed(dec) : ''); set('exitDateTime', localInput(r.exitDateTime, edZone())); drawExecSummary(r); }
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

