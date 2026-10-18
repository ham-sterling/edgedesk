/* ============================================================
   JOURNAL & NOTES — one place for everything you write.
   Notes are one collection; a note can be linked to a day
   (kind: 'journal', one per day), to strategies, or a folder.
   ============================================================ */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isJournal = n => n?.kind === 'journal';
const journalNote = day => state.notebooks.find(n => n.kind === 'journal' && n.date === day);
const journalNotes = () => state.notebooks.filter(isJournal);
function journalDayLabel(day) { return `${dayName(weekdayOfKey(day), true)} ${fmtDate(day)}`; }
function noteTitle(n) { return isJournal(n) ? journalDayLabel(n.date) : (n?.title || L('ไม่มีชื่อ', 'Untitled')); }
function journalTplHTML() { const t = getTpl(state.settings.journalTemplate); return sanitize(t ? t.html : '<p><br></p>'); }
function dayTrades(day) { return state.trades.filter(t => t.status !== 'Void' && t.status !== 'Missed' && (!ui.account || t.accountId === ui.account) && tradeDay(t) === day); }
function notesInView(view) {
  if (view === 'all') return state.notebooks.filter(n => !isJournal(n));
  if (view?.startsWith('f:')) return state.notebooks.filter(n => !isJournal(n) && n.folderId === view.slice(2));
  if (view?.startsWith('s:')) return state.notebooks.filter(n => (n.strategyIds || []).includes(view.slice(2)));
  return [];
}
const sortNotes = arr => arr.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
const noteHay = n => (noteTitle(n) + ' ' + plain(n.html) + ' ' + (n.strategyIds || []).map(id => nameOf('playbooks', id)).join(' ')).toLowerCase();

/* the note behind the open editor; journal notes are created lazily on first edit */
function currentNote(create = false) {
  const ed = $('#note-rich'); if (!ed) return null;
  if (ed.dataset.day) {
    let n = journalNote(ed.dataset.day);
    if (!n && create) { n = { id: uid('note'), kind: 'journal', date: ed.dataset.day, folderId: '', title: '', html: sanitize(ed.innerHTML), mood: 0, images: [], strategyIds: [], templateId: state.settings.journalTemplate, createdAt: now(), updatedAt: now() }; state.notebooks.push(n); reindex(); }
    return n || null;
  }
  return get('notebooks', ed.dataset.note) || null;
}
let noteTimer = null;
function saveNoteNow() {
  noteTimer = null;
  const ed = $('#note-rich'); if (!ed) return; const n = currentNote(true); if (!n) return;
  n.html = sanitize(ed.innerHTML); if (!isJournal(n)) n.title = $('#note-title')?.value || ''; n.updatedAt = now(); persist();
  const s = $('#note-saved'); if (s) s.textContent = (isJournal(n) ? L('แก้ไขล่าสุด ', 'Edited ') : '') + fmtDate(n.updatedAt, { time: true });
  if (isJournal(n)) { const row = $(`.dayitem[data-day="${n.date}"]`); const st = row?.querySelector('.jstate'); if (st && !st.classList.contains('done')) { st.className = 'jstate done'; st.innerHTML = icon('book'); } }
  else { const item = $(`.noteitem[data-id="${n.id}"]`); if (item) { item.querySelector('strong').innerHTML = (n.pinned ? icon('pin', 'pin-ic') : '') + esc(noteTitle(n)); const d = item.querySelector('p.xs'); if (d) d.textContent = fmtDate(n.updatedAt, { time: true }); } }
}
function flushNote() { if (noteTimer) { clearTimeout(noteTimer); saveNoteNow(); } }
const saveNote = () => { clearTimeout(noteTimer); noteTimer = setTimeout(saveNoteNow, 500); };
saveNote.flush = flushNote;

function notesView(sub = '', arg = '') {
  if (sub === 'journal') { ui.noteView = 'journal'; ui.journalDay = DAY_RE.test(arg) ? arg : (ui.journalDay || todayKey()); }
  else if (sub === 'all') ui.noteView = 'all';
  else if (sub === 'f' && get('notebookFolders', arg)) ui.noteView = 'f:' + arg;
  else if (sub === 's' && get('playbooks', arg)) ui.noteView = 's:' + arg;
  else if (sub === 'n') {
    const n = get('notebooks', arg);
    if (isJournal(n)) { ui.noteView = 'journal'; ui.journalDay = n.date; }
    else if (n) { ui.notebookId = n.id; if (!ui.noteView || ui.noteView === 'journal' || !notesInView(ui.noteView).includes(n)) ui.noteView = n.folderId && get('notebookFolders', n.folderId) ? 'f:' + n.folderId : 'all'; }
  }
  if (!ui.noteView || (ui.noteView.startsWith('f:') && !get('notebookFolders', ui.noteView.slice(2))) || (ui.noteView.startsWith('s:') && !get('playbooks', ui.noteView.slice(2)))) ui.noteView = 'journal';
  if (!DAY_RE.test(ui.journalDay || '')) ui.journalDay = todayKey();
  if (ui._jDaySeen !== ui.journalDay) { ui.jMonth = ui.journalDay.slice(0, 7); ui._jDaySeen = ui.journalDay; }
  const v = ui.noteView, q = (ui.noteSearch || '').trim().toLowerCase();

  /* ---- left: sections ---- */
  const fcount = id => state.notebooks.filter(n => !isJournal(n) && n.folderId === id).length;
  const scount = id => state.notebooks.filter(n => (n.strategyIds || []).includes(id)).length;
  const side = `<a class="folder ${v === 'journal' ? 'on' : ''}" href="#notes/journal">${icon('journal-day')}<span>Daily Journal</span><span class="n">${journalNotes().length}</span></a>
    <a class="folder sub ${v === 'journal' && ui.journalDay === todayKey() ? 'on2' : ''}" href="#notes/journal/${todayKey()}">${icon('sun')}<span>${L('วันนี้', 'Today')}</span></a>
    <div class="side-h"><strong class="small">${L('โน้ต', 'Notes')}</strong>${ibtn('folder-plus', 'folder-new', L('โฟลเดอร์ใหม่', 'New folder'), {}, 'sm')}</div>
    <a class="folder ${v === 'all' ? 'on' : ''}" href="#notes/all">${icon('notes')}<span>${L('โน้ตทั้งหมด', 'All notes')}</span><span class="n">${notesInView('all').length}</span></a>
    ${state.notebookFolders.map(f => `<div class="row gap4"><a class="folder ${v === 'f:' + f.id ? 'on' : ''}" href="#notes/f/${f.id}">${icon('folder')}<span class="ell">${esc(f.name)}</span><span class="n">${fcount(f.id)}</span></a>${menu([menuItem(L('เปลี่ยนชื่อ', 'Rename'), 'folder-rename', { 'data-id': f.id }, 'edit'), menuItem(L('ลบโฟลเดอร์', 'Delete'), 'folder-del', { 'data-id': f.id }, 'trash', 'danger')])}</div>`).join('')}
    <div class="side-h"><strong class="small">Strategies</strong></div>
    ${state.playbooks.length ? state.playbooks.map(pb => `<a class="folder ${v === 's:' + pb.id ? 'on' : ''}" href="#notes/s/${pb.id}"><i class="colorbar" style="background:${esc(pb.color || 'var(--accent)')};height:14px"></i><span class="ell">${esc(pb.name)}</span><span class="n">${scount(pb.id)}</span></a>`).join('') : `<p class="dim small" style="padding:4px 10px">—</p>`}
    ${templatesSidebarHTML()}`;

  /* ---- middle: list ---- */
  const search = `<div class="searchbox" style="max-width:none;margin-bottom:8px">${icon('search')}<input data-ui="noteSearch" value="${esc(ui.noteSearch || '')}" placeholder="${L('ค้นหาทุกโน้ตและ Journal…', 'Search notes & journal…')}" aria-label="search notes"></div>`;
  const noteRow = n => `<a class="noteitem ${(isJournal(n) ? v === 'journal' && n.date === ui.journalDay : n.id === ui.notebookId && v !== 'journal') ? 'on' : ''}" data-id="${n.id}" href="#notes/n/${n.id}"><strong>${n.pinned ? icon('pin', 'pin-ic') : ''}${esc(noteTitle(n))}</strong><p class="xs">${isJournal(n) ? '<span class="jtag">Journal</span>' : ''}${fmtDate(n.updatedAt || n.createdAt, { time: true })}</p></a>`;
  let middle;
  if (q) {
    const hits = sortNotes(state.notebooks.filter(n => noteHay(n).includes(q)));
    middle = search + `<div class="small dim" style="padding:2px 4px 8px">${hits.length} ${L('ผลลัพธ์', 'results')}</div>` + (hits.map(noteRow).join('') || `<p class="dim small" style="padding:10px">${L('ไม่พบโน้ตที่ตรงกับคำค้น', 'No matching notes')}</p>`);
  } else if (v === 'journal') middle = search + journalListHTML();
  else {
    const list = sortNotes(notesInView(v));
    if (!list.some(n => n.id === ui.notebookId)) ui.notebookId = list.find(n => !isJournal(n))?.id || list[0]?.id || '';
    const title = v === 'all' ? L('โน้ตทั้งหมด', 'All notes') : v.startsWith('f:') ? esc(nameOf('notebookFolders', v.slice(2))) : esc(nameOf('playbooks', v.slice(2)));
    middle = search + `<div class="row mid-h"><strong class="grow ell">${title}</strong>${btn(icon('plus') + L(' โน้ตใหม่', ' New'), 'note-new', {}, 'sm')}</div>` + (list.map(noteRow).join('') || `<p class="dim small" style="padding:10px">${L('ยังไม่มีโน้ต', 'No notes yet')}</p>`);
  }

  /* ---- right: editor ---- */
  let right;
  if (v === 'journal') right = journalEditorHTML(ui.journalDay);
  else { const n = get('notebooks', ui.notebookId); right = n ? noteEditorHTML(n) : `<div style="display:grid;place-items:center">${empty(L('ยังไม่ได้เลือกโน้ต', 'No note selected'), L('สร้างโน้ตสำหรับงานวิจัย กฎการเทรด หรือคู่มือ Strategy', 'Create notes for research, rules or strategy guides'), btn(icon('plus') + L(' โน้ตใหม่', ' New note'), 'note-new', {}, 'primary'), 'notes')}</div>`; }

  return pageHead(L('สมุดโน้ต', 'Notebook'), L('บันทึกรายวัน งานวิจัย กฎการเทรด และคู่มือ Strategy — รวมไว้ที่เดียว', 'Daily journal, research, rules and strategy guides — in one place'), `${btn(icon('journal-day') + L(' Journal วันนี้', ' Journal today'), 'journal-today')}${btn(icon('plus') + L(' โน้ตใหม่', ' New note'), 'note-new', {}, 'primary')}`)
    + `<div class="notes-layout"><aside>${side}</aside><aside>${middle}</aside>${right}</div>`;
}

function journalListHTML() {
  const [y, m] = ui.jMonth.split('-').map(Number), ym = ui.jMonth, tk = todayKey();
  const rows = filterTrades(state.trades, {}, true);
  const byDay = new Map(); for (const t of rows) { const d = tradeDay(t); if (!d.startsWith(ym)) continue; if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(t); }
  const notes = new Map(journalNotes().filter(n => n.date.startsWith(ym)).map(n => [n.date, n]));
  const days = [...new Set([...byDay.keys(), ...notes.keys(), ...(tk.startsWith(ym) ? [tk] : [])])].sort().reverse();
  const ms = stats(rows.filter(t => tradeDay(t).startsWith(ym))), tradeDays = [...byDay.values()].filter(r => r.some(t => t.status === 'Closed')).length, written = [...byDay.keys()].filter(d => notes.has(d)).length;
  const head = `<div class="row mid-h">${ibtn('chev-left', 'jm-shift', L('เดือนก่อน', 'Previous month'), { 'data-dir': -1 })}<strong class="grow" style="text-align:center">${monthName(m - 1, true)} ${y}</strong>${ibtn('chev-right', 'jm-shift', L('เดือนถัดไป', 'Next month'), { 'data-dir': 1 })}</div>`;
  const sum = `<div class="jm-sum"><span>${L('ผลเดือนนี้', 'Month')} <b class="${tone(ms.total)}">${ms.n ? unitFmt(ms.total) : '—'}</b></span><span>${L('เขียนแล้ว', 'Written')} <b>${written}/${tradeDays}</b></span></div>`;
  const list = days.map(d => {
    const rs = byDay.get(d) || [], s = stats(rs), n = notes.get(d), closedN = rs.filter(t => t.status === 'Closed').length, wd = weekdayOfKey(d);
    const st = n ? `<span class="jstate done" title="${L('เขียนแล้ว', 'Written')}">${icon('book')}</span>` : rs.length ? `<span class="jstate todo">${L('ยังไม่เขียน', 'Not written')}</span>` : '<span class="jstate"></span>';
    return `<a class="dayitem ${d === ui.journalDay ? 'on' : ''} ${d === tk ? 'today' : ''}" href="#notes/journal/${d}" data-day="${d}"><span class="datebox"><span>${dayName(wd)}</span><b>${+d.slice(8)}</b></span><span class="grow" style="min-width:0"><strong class="${tone(s.total)}">${closedN ? unitFmt(s.total) : rs.length ? L('เปิดอยู่', 'Open') : L('ไม่มีเทรด', 'No trades')}</strong><small>${rs.length ? `${rs.length} ${L('เทรด', 'trades')}${closedN ? ' · ' + L('อัตราชนะ ', 'Win rate ') + fmt(s.wr, 0) + '%' : ''}` : (d === tk ? L('วันนี้', 'Today') : '')}</small></span>${n?.mood ? `<span class="mood-ic m${n.mood}" title="${esc(MOOD_LABELS()[n.mood - 1])}">${icon(MOODS[n.mood - 1])}</span>` : ''}${st}</a>`;
  }).join('') || `<p class="dim small" style="padding:10px">${L('ไม่มีวันเทรดในเดือนนี้', 'No trading days this month')}</p>`;
  return head + `<div class="jm-cal">${calendarHTML(rows, y, m - 1, 'color')}</div>` + sum + `<div class="daylist">${list}</div>`;
}

function strategyChips(n) {
  const ids = (n?.strategyIds || []).filter(id => get('playbooks', id)), rest = state.playbooks.filter(pb => !ids.includes(pb.id));
  return `<div class="schips">${ids.map(id => { const pb = get('playbooks', id); return `<span class="schip"><i class="colorbar" style="background:${esc(pb.color || 'var(--accent)')}"></i><a href="#playbooks/${id}">${esc(pb.name)}</a><button type="button" data-action="note-strat-del" data-sid="${id}" aria-label="${L('เอาออก', 'Remove')}">${icon('x')}</button></span>`; }).join('')}${rest.length ? `<select class="schip-add" data-change="note-strat-add" aria-label="${L('ผูกกับ Strategy', 'Link a strategy')}"><option value="">+ Strategy</option>${rest.map(pb => `<option value="${pb.id}">${esc(pb.name)}</option>`).join('')}</select>` : ''}</div>`;
}
function attachmentsHTML(n) {
  if (!n) return `<div class="attach"><span class="small dim">${icon('image')} ${L('เริ่มเขียนก่อนจึงแนบรูปได้ — หรือวางรูป (Ctrl+V) ในเนื้อหาได้เลย', 'Start writing to attach images — or paste images (Ctrl+V) into the text')}</span></div>`;
  return `<div class="attach"><div class="small muted mb8">${L('ไฟล์แนบ', 'Attachments')}</div>${shotsHTML(n.images || [], 'notebooks', n.id)}</div>`;
}
function noteMenu(n) {
  return menu([...(isJournal(n) ? [] : [menuItem(L('ย้ายโฟลเดอร์', 'Move'), 'note-move', { 'data-id': n.id }, 'folder'), menuItem(L('ทำสำเนา', 'Duplicate'), 'note-dup', { 'data-id': n.id }, 'copy')]), menuItem(L('บันทึกเป็นเทมเพลต', 'Save as template'), 'tpl-from-note', { 'data-id': n.id }, 'bookmark-plus'), menuItem(L('ส่งออก HTML', 'Export HTML'), 'note-export', { 'data-id': n.id }, 'download'), menuItem(L('ลบ', 'Delete'), 'note-del', { 'data-id': n.id }, 'trash', 'danger')]);
}
function journalEditorHTML(day) {
  const n = journalNote(day), rows = dayTrades(day), s = stats(rows), d = dayDiscipline(day), prev = shiftKey(day, { days: -1 }), next = shiftKey(day, { days: 1 }), cur = baseCurrency();
  const closed = closedSorted(rows); let acc = 0; const eq = [0, ...closed.map(t => (acc += value(t) || 0))];
  const head = `<div class="jhead"><div class="grow" style="min-width:0"><div class="small dim">Daily Journal · <span id="note-saved">${n ? L('แก้ไขล่าสุด ', 'Edited ') + fmtDate(n.updatedAt, { time: true }) : L('ยังไม่ได้เขียน — เริ่มพิมพ์เพื่อบันทึก', 'Not written yet — start typing to save')}</span></div><h2>${journalDayLabel(day)}</h2></div>
    <div class="row gap4">${ibtn('chev-left', 'nav', L('วันก่อนหน้า', 'Previous day'), { 'data-route': 'notes/journal/' + prev })}${btn(L('วันนี้', 'Today'), 'nav', { 'data-route': 'notes/journal/' + todayKey() }, 'sm ghost')}${ibtn('chev-right', 'nav', L('วันถัดไป', 'Next day'), { 'data-route': 'notes/journal/' + next })}${btn(icon('template') + L(' เทมเพลต', ' Template'), 'note-apply-tpl', { 'data-tip': L('ใส่เนื้อหาจากเทมเพลต', 'Insert a template') }, 'sm ghost')}${n ? noteMenu(n) : ''}</div></div>`;
  const strip = `<div class="jstats"><div><span>${L('กำไรสุทธิ', 'Net profit')}</span><b class="${tone(s.total)}">${s.n ? unitFmt(s.total) : '—'}</b></div><div><span>${L('เทรด', 'Trades')}</span><b>${rows.length}</b><small>${s.n ? `${s.wins}W · ${s.losses}L` : ''}</small></div><div><span>${L('อัตราชนะ', 'Win rate')}</span><b>${finite(s.wr) ? fmt(s.wr, 0) + '%' : '—'}</b></div><div><span>R-Multiple</span><b class="${tone(s.r)}">${finite(s.r) && s.n ? fmt(s.r, 2, true) + 'R' : '—'}</b></div><div><span>${L('ต้นทุน', 'Costs')}</span><b>${s.n && finite(s.commission) ? money(s.commission - s.swap, cur) : '—'}</b></div></div>`;
  const breach = d.issues.length ? `<div class="notice bad jnotice">${icon('shield')}<div><b>${L('การละเมิดกฎของวันนี้', 'Rule breaches')}</b><br>${d.issues.map(esc).join(' · ')}</div></div>` : '';
  const meta = `<div class="jmeta"><div><label>${L('อารมณ์โดยรวม', 'Overall mood')}</label><div class="moods sm">${MOODS.map((m, i) => `<button type="button" class="m${i + 1} ${n?.mood === i + 1 ? 'on' : ''}" data-action="j-mood" data-value="${i + 1}" aria-label="${esc(MOOD_LABELS()[i])}" data-tip="${esc(MOOD_LABELS()[i])}">${icon(m)}</button>`).join('')}</div></div><div class="grow"><label>Strategies</label>${strategyChips(n)}</div></div>`;
  const trades = `<details class="jtrades" ${rows.length ? 'open' : ''}><summary>${icon('chev-right', 'tiny')}<span>${L('เทรดของวันนี้', 'Trades this day')} (${rows.length})</span>${eq.length > 2 ? `<span class="jspark">${sparkline(eq, 120, 24)}</span>` : ''}<span class="grow"></span>${btn(icon('plus') + L(' เพิ่มเทรด', ' Add trade'), 'new-trade', { 'data-date': day }, 'sm ghost')}</summary><div class="jtrade-list">${rows.length ? rows.slice().sort((a, b) => String(a.entryDateTime).localeCompare(String(b.entryDateTime))).map(t => { const c = calc(t); return `<div class="jtrade" data-action="view-trade" data-id="${t.id}">${insIcon(get('instruments', t.instrumentId))}<div class="grow"><strong>${esc(nameOf('instruments', t.instrumentId, 'symbol'))}</strong> ${sideBadge(t.side)} <span class="small dim">${fmtTime(t.entryDateTime)}${t.playbookId ? ' · ' + esc(nameOf('playbooks', t.playbookId)) : ''}</span></div>${t.status === 'Closed' ? `<strong class="${tone(c.net)}">${unitFmt(value(t))}</strong>` : statusBadge(t.status)}</div>`; }).join('') : `<p class="small dim" style="margin:6px 0">${L('ยังไม่มีเทรดในวันนี้', 'No trades on this day')}</p>`}</div></details>`;
  return `<div class="editor jeditor">${head}${strip}${breach}${meta}${trades}${rteToolbar('note-rich')}<div class="rich" id="note-rich" data-day="${day}" ${n ? `data-note="${n.id}"` : ''} contenteditable="true" data-ph="${L('เริ่มเขียน…', 'Start writing…')}">${n ? sanitize(n.html) : journalTplHTML()}</div>${attachmentsHTML(n)}</div>`;
}
function noteEditorHTML(n) {
  const where = isJournal(n) ? 'Daily Journal' : esc(nameOf('notebookFolders', n.folderId));
  return `<div class="editor"><div class="row" style="padding:10px 18px 0;justify-content:space-between;gap:8px"><span class="small dim">${where} · ${L('แก้ไขล่าสุด', 'Edited')} <span id="note-saved">${fmtDate(n.updatedAt, { time: true })}</span></span><div class="row gap4">${btn(icon('template') + L(' เทมเพลต', ' Template'), 'note-apply-tpl', { 'data-tip': L('ใส่เนื้อหาจากเทมเพลต', 'Insert a template') }, 'sm ghost')}${ibtn('pin', 'note-pin', n.pinned ? L('เลิกปักหมุด', 'Unpin') : L('ปักหมุด', 'Pin'), { 'data-id': n.id }, n.pinned ? 'on' : '')}${noteMenu(n)}</div></div>
    <input class="title-in" id="note-title" value="${esc(n.title)}" placeholder="${L('ชื่อโน้ต', 'Title')}"><div class="nmeta">${strategyChips(n)}</div>${rteToolbar('note-rich')}<div class="rich" id="note-rich" data-note="${n.id}" contenteditable="true" data-ph="${L('เริ่มเขียน…', 'Start writing…')}">${sanitize(n.html)}</div>${n.images?.length ? attachmentsHTML(n) : ''}</div>`;
}

function newNote(html = '<p><br></p>', title = '', extra = {}) {
  const v = ui.noteView || '';
  const n = { id: uid('note'), folderId: v.startsWith('f:') ? v.slice(2) : state.notebookFolders[0]?.id, title, html, strategyIds: v.startsWith('s:') ? [v.slice(2)] : [], createdAt: now(), updatedAt: now(), ...extra };
  state.notebooks.push(n); reindex(); persist(); go('notes/n/' + n.id);
  setTimeout(() => (title ? $('#note-rich') : $('#note-title'))?.focus(), 40);
  return n;
}
const NOTE_ACTIONS = {
  'jm-shift': el => { let [y, m] = ui.jMonth.split('-').map(Number); m += +el.dataset.dir; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } ui.jMonth = `${y}-${String(m).padStart(2, '0')}`; renderMain(); },
  'j-mood': el => { flushNote(); const n = currentNote(true); if (!n) return; const v = +el.dataset.value; n.mood = n.mood === v ? 0 : v; n.updatedAt = now(); persist(); renderMain(); },
  'note-strat-del': el => { flushNote(); const n = currentNote(); if (!n) return; n.strategyIds = (n.strategyIds || []).filter(x => x !== el.dataset.sid); n.updatedAt = now(); persist(); renderMain(); },
  'strat-note-new': el => { const pb = get('playbooks', el.dataset.id); if (!pb) return; const first = !state.notebooks.some(n => (n.strategyIds || []).includes(pb.id)); const t = getTpl('tpl_strategy'); ui.noteView = 's:' + pb.id; newNote(first && t ? sanitize(t.html) : '<p><br></p>', first ? `${pb.name} — Strategy spec` : '', { strategyIds: [pb.id] }); },
};
function noteStrategyAdd(sel) { const sid = sel.value; if (!sid) return; flushNote(); const n = currentNote(true); if (!n) return; n.strategyIds = [...new Set([...(n.strategyIds || []), sid])]; n.updatedAt = now(); persist(); renderMain(); }

/* linked notes panel on a strategy page */
function strategyNotesPanel(pb) {
  const notes = sortNotes(state.notebooks.filter(n => (n.strategyIds || []).includes(pb.id)));
  return `<div class="mt16">${panel(icon('notes') + L(' โน้ตของ Strategy', ' Strategy notes'), notes.length ? `<div class="tl">${notes.map(n => `<a class="tl-row" href="#notes/n/${n.id}">${icon(isJournal(n) ? 'journal-day' : 'file-text')}<span class="grow"><strong>${esc(noteTitle(n))}</strong>${isJournal(n) ? ' <span class="jtag">Journal</span>' : ''}<span class="xs dim" style="display:block">${fmtDate(n.updatedAt || n.createdAt, { time: true })}</span></span>${icon('chev-right')}</a>`).join('')}</div>` : `<p class="small dim" style="margin:0">${L('ยังไม่มีโน้ต — เริ่มจากคู่มือ Strategy เพื่อเขียนเงื่อนไขและจุดเข้าออกให้ชัด', 'No notes yet — start with a strategy spec')}</p>`, `${btn(icon('plus') + L(' โน้ตใหม่', ' New note'), 'strat-note-new', { 'data-id': pb.id }, 'sm')}${btn(icon('notes') + L(' เปิดในสมุดโน้ต', ' Open in Notebook'), 'nav', { 'data-route': 'notes/s/' + pb.id }, 'sm ghost')}`)}</div>`;
}
