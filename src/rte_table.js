/* ============================================================
   RICH-TEXT TABLES — insert / delete rows and columns, merge and
   split cells, header row, Tab navigation and drag-to-select.
   Every change replaces the table through execCommand so it stays
   on the editor's Undo / Redo stack.
   ============================================================ */
let tblCtx = null;          // { table, cell } where the caret is
let tblDrag = null;         // drag-select in progress
const tblSelected = () => tblCtx?.table ? [...tblCtx.table.querySelectorAll('.tsel')] : [];

function rteCellOf(node) {
  const el = node?.nodeType === 1 ? node : node?.parentElement, c = el?.closest?.('td,th');
  return c && c.closest('.rich[contenteditable="true"]') ? c : null;
}
/* map every grid slot to the cell covering it (colspan / rowspan aware) */
function tableGrid(table) {
  const grid = [], pos = new Map();
  [...table.rows].forEach((tr, r) => {
    grid[r] ||= []; let c = 0;
    for (const cell of tr.cells) {
      while (grid[r][c]) c++;
      const rs = Math.max(1, cell.rowSpan || 1), cs = Math.max(1, cell.colSpan || 1);
      pos.set(cell, { r, c, rs, cs });
      for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) (grid[r + i] ||= [])[c + j] = cell;
      c += cs;
    }
  });
  return { grid, pos, rows: table.rows.length, cols: Math.max(0, ...grid.slice(0, table.rows.length).map(g => g.length)) };
}
function newCell(tag = 'td') { const c = document.createElement(tag); c.innerHTML = '<br>'; return c; }
/* DOM position for a new cell that starts at column `col` in row `r` */
function insertCellAt(table, pos, r, col, cell) {
  const tr = table.rows[r], ref = [...tr.cells].find(x => pos.get(x) && pos.get(x).c >= col);
  ref ? tr.insertBefore(cell, ref) : tr.appendChild(cell);
}
const cellPath = cell => [cell.parentElement.rowIndex, cell.cellIndex];
const cellAtPath = (table, [r, i]) => { const tr = table.rows[Math.min(r, table.rows.length - 1)]; return tr ? tr.cells[Math.min(i, tr.cells.length - 1)] : null; };

/* ---------------- operations (run on a clone) ---------------- */
const TBL_OPS = {
  rowAbove: (t, cell) => tblInsertRow(t, cell, false),
  rowBelow: (t, cell) => tblInsertRow(t, cell, true),
  colLeft: (t, cell) => tblInsertCol(t, cell, false),
  colRight: (t, cell) => tblInsertCol(t, cell, true),
  delRow: (t, cell) => {
    const { grid, pos, cols } = tableGrid(t), r = pos.get(cell).r, tr = t.rows[r];
    for (let c = 0; c < cols;) {
      const x = grid[r]?.[c]; if (!x) { c++; continue; } const p = pos.get(x);
      if (p.r < r) { if (p.c === c) x.rowSpan = p.rs - 1; }
      else if (p.rs > 1) { x.rowSpan = p.rs - 1; x.remove(); insertCellAt(t, pos, r + 1, p.c, x); }
      c += p.cs;
    }
    tr.remove(); return t.rows.length ? [Math.min(r, t.rows.length - 1), 0] : null;
  },
  delCol: (t, cell) => {
    const { grid, pos, rows } = tableGrid(t), c = pos.get(cell).c, [r0, i0] = cellPath(cell);
    for (let r = 0; r < rows; r++) { const x = grid[r]?.[c]; if (!x) continue; const p = pos.get(x); if (p.r !== r) continue; if (p.cs > 1) x.colSpan = p.cs - 1; else x.remove(); }
    [...t.rows].forEach(tr => { if (!tr.cells.length) tr.remove(); });
    return t.rows.length ? [r0, Math.max(0, i0 - 1)] : null;
  },
  merge: (t, cell, sel) => {
    if (sel.length < 2) { toast(L('ลากเมาส์ หรือ Shift+คลิก เพื่อเลือกหลายเซลล์ก่อนผสาน', 'Drag or Shift+click to select cells to merge'), 'bad'); return false; }
    const { grid, pos } = tableGrid(t); let r1 = 1e9, c1 = 1e9, r2 = -1, c2 = -1;
    for (const x of sel) { const p = pos.get(x); r1 = Math.min(r1, p.r); c1 = Math.min(c1, p.c); r2 = Math.max(r2, p.r + p.rs - 1); c2 = Math.max(c2, p.c + p.cs - 1); }
    const inRect = new Set();
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { const x = grid[r]?.[c]; if (!x) continue; const p = pos.get(x); if (p.r < r1 || p.c < c1 || p.r + p.rs - 1 > r2 || p.c + p.cs - 1 > c2) { toast(L('เลือกเซลล์ให้เป็นรูปสี่เหลี่ยมก่อนผสาน', 'Select a rectangular block of cells to merge'), 'bad'); return false; } inRect.add(x); }
    const keep = grid[r1][c1], parts = [];
    for (const x of [...inRect].sort((a, b) => (pos.get(a).r - pos.get(b).r) || (pos.get(a).c - pos.get(b).c))) { const h = x.innerHTML.replace(/^(\s|<br\s*\/?>)+|(\s|<br\s*\/?>)+$/gi, ''); if (h) parts.push(h); if (x !== keep) x.remove(); }
    keep.innerHTML = parts.join('<br>') || '<br>'; keep.colSpan = c2 - c1 + 1; keep.rowSpan = r2 - r1 + 1;
    if (keep.colSpan === 1) keep.removeAttribute('colspan'); if (keep.rowSpan === 1) keep.removeAttribute('rowspan');
    [...t.rows].forEach(tr => { if (!tr.cells.length) tr.remove(); });
    return cellPath(keep);
  },
  split: (t, cell) => {
    const { pos } = tableGrid(t), p = pos.get(cell);
    if (p.rs === 1 && p.cs === 1) { toast(L('เซลล์นี้ไม่ได้ผสานไว้', 'This cell is not merged'), 'bad'); return false; }
    cell.removeAttribute('colspan'); cell.removeAttribute('rowspan');
    for (let r = p.r; r < p.r + p.rs; r++) for (let c = p.c; c < p.c + p.cs; c++) { if (r === p.r && c === p.c) continue; insertCellAt(t, pos, r, c, newCell(cell.tagName.toLowerCase())); }
    return cellPath(cell);
  },
  header: (t, cell) => {
    const first = t.rows[0], pth = cellPath(cell); if (!first) return false; const toTh = [...first.cells].some(c => c.tagName === 'TD');
    [...first.cells].forEach(c => { const n = document.createElement(toTh ? 'th' : 'td'); for (const a of c.attributes) n.setAttribute(a.name, a.value); n.innerHTML = c.innerHTML; c.replaceWith(n); });
    return pth;
  },
  delTable: () => null,
};
function tblInsertRow(t, cell, after) {
  const { grid, pos, cols } = tableGrid(t), p = pos.get(cell), at = after ? p.r + p.rs : p.r, tr = document.createElement('tr');
  for (let c = 0; c < cols;) {
    const a = at > 0 ? grid[at - 1]?.[c] : null, b = grid[at]?.[c];
    if (a && a === b) { const pa = pos.get(a); a.rowSpan = pa.rs + 1; c += pa.cs; }
    else { tr.appendChild(newCell('td')); c++; }
  }
  const ref = t.rows[at]; ref ? ref.parentNode.insertBefore(tr, ref) : t.rows[t.rows.length - 1].parentNode.appendChild(tr);
  return [tr.rowIndex, after ? 0 : Math.min(cell.cellIndex, tr.cells.length - 1)];
}
function tblInsertCol(t, cell, after) {
  const { grid, pos, rows } = tableGrid(t), p = pos.get(cell), at = after ? p.c + p.cs : p.c;
  for (let r = 0; r < rows; r++) {
    const a = at > 0 ? grid[r]?.[at - 1] : null, b = grid[r]?.[at];
    if (a && a === b) { const pa = pos.get(a); if (pa.r === r) a.colSpan = pa.cs + 1; continue; }
    insertCellAt(t, pos, r, at, newCell(r === 0 && t.rows[0].cells[0]?.tagName === 'TH' ? 'th' : 'td'));
  }
  const [r] = cellPath(cell); return [r, Math.max(0, [...t.rows[r].cells].findIndex(x => !pos.has(x)))];
}

/* replace the live table with the edited clone so Undo works */
function runTableOp(op) {
  const ctx = tblCtx; if (!ctx?.table?.isConnected) return;
  const ed = ctx.table.closest('.rich'), tables = [...ed.querySelectorAll('table')], ti = tables.indexOf(ctx.table);
  const selPaths = tblSelected().map(cellPath), path = cellPath(ctx.cell);
  const clone = ctx.table.cloneNode(true); clone.querySelectorAll('.tsel').forEach(x => x.classList.remove('tsel')); clone.querySelectorAll('[class=""]').forEach(x => x.removeAttribute('class'));
  const cCell = cellAtPath(clone, path), cSel = selPaths.map(pth => cellAtPath(clone, pth)).filter(Boolean);
  const focus = TBL_OPS[op](clone, cCell, cSel); if (focus === false) return;
  ed.focus();
  const sel = window.getSelection(), rg = document.createRange(); rg.selectNode(ctx.table); sel.removeAllRanges(); sel.addRange(rg);
  const html = focus === null || !clone.rows.length ? '<p><br></p>' : clone.outerHTML;
  if (!document.execCommand('insertHTML', false, html)) { if (focus === null) ctx.table.remove(); else ctx.table.replaceWith(clone); }
  const nt = focus ? ed.querySelectorAll('table')[ti] : null;
  if (nt && focus) { const c = cellAtPath(nt, focus); if (c) placeCaret(c); }
  tblCtx = null; hideTableTools(); ed.dispatchEvent(new Event('input', { bubbles: true }));
  if (nt) setTimeout(updateTableTools, 0);
}
function placeCaret(cell, atEnd = false) { const rg = document.createRange(); rg.selectNodeContents(cell); rg.collapse(!atEnd); const s = window.getSelection(); s.removeAllRanges(); s.addRange(rg); }

/* ---------------- floating toolbar ---------------- */
const TBL_TOOLS = () => [['rowAbove', 'tr-above', L('แทรกแถวด้านบน', 'Insert row above')], ['rowBelow', 'tr-below', L('แทรกแถวด้านล่าง', 'Insert row below')], ['colLeft', 'tc-before', L('แทรกคอลัมน์ซ้าย', 'Insert column left')], ['colRight', 'tc-after', L('แทรกคอลัมน์ขวา', 'Insert column right')], '|', ['delRow', 'tr-del', L('ลบแถว', 'Delete row')], ['delCol', 'tc-del', L('ลบคอลัมน์', 'Delete column')], '|', ['merge', 'tcell-merge', L('ผสานเซลล์ที่เลือก', 'Merge selected cells')], ['split', 'tcell-split', L('แยกเซลล์', 'Split cell')], ['header', 'tcell-header', L('สลับแถวหัวตาราง', 'Toggle header row')], '|', ['delTable', 'table-del', L('ลบตาราง', 'Delete table')]];
function tableToolsEl() {
  let el = document.getElementById('tbl-tools'); if (el) return el;
  el = document.createElement('div'); el.id = 'tbl-tools'; el.className = 'tbl-tools'; el.hidden = true; el.setAttribute('role', 'toolbar');
  el.addEventListener('mousedown', e => e.preventDefault()); // keep the caret in the cell
  document.body.appendChild(el); return el;
}
function hideTableTools() { const el = document.getElementById('tbl-tools'); if (el) el.hidden = true; }
function updateTableTools() {
  const s = window.getSelection(), cell = s?.rangeCount ? rteCellOf(s.anchorNode) : null;
  if (!cell) { if (!tblDrag && !(tblCtx && tblSelected().length > 1)) { tblCtx = null; hideTableTools(); } else positionTableTools(); return; }
  const table = cell.closest('table'); if (tblCtx?.table !== table) table.closest('.rich').querySelectorAll('.tsel').forEach(x => x.classList.remove('tsel'));
  tblCtx = { table, cell };
  const el = tableToolsEl(), merged = (cell.rowSpan || 1) > 1 || (cell.colSpan || 1) > 1, n = tblSelected().length;
  el.innerHTML = TBL_TOOLS().map(t => t === '|' ? '<span class="sep"></span>' : `<button type="button" data-action="tbl-op" data-op="${t[0]}" title="${esc(t[2])}" aria-label="${esc(t[2])}" ${(t[0] === 'merge' && n < 2) || (t[0] === 'split' && !merged) ? 'disabled' : ''} class="${t[0] === 'delTable' || t[0].startsWith('del') ? 'danger' : ''}">${icon(t[1])}</button>`).join('') + (n > 1 ? `<span class="tbl-n">${n} ${L('เซลล์', 'cells')}</span>` : '');
  el.hidden = false; positionTableTools();
}
function positionTableTools() {
  const el = document.getElementById('tbl-tools'); if (!el || el.hidden) return;
  const t = tblCtx?.table; if (!t?.isConnected) { hideTableTools(); return; }
  const r = t.getBoundingClientRect(), h = el.offsetHeight || 34, w = el.offsetWidth || 300;
  const bar = t.closest('.rich')?.parentElement?.querySelector('.rtb')?.getBoundingClientRect(), above = r.top - h - 6;
  const top = above < 56 || (bar && above < bar.bottom + 2) ? r.bottom + 6 : above;
  el.style.top = Math.max(4, top) + 'px'; el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
}
document.addEventListener('selectionchange', () => { if (!tblDrag) updateTableTools(); });
window.addEventListener('scroll', positionTableTools, true);
window.addEventListener('resize', positionTableTools);

/* ---------------- drag / Shift+click selection ---------------- */
function selectCellRect(a, b) {
  const t = a.closest('table'); if (b.closest('table') !== t) return;
  const { grid, pos } = tableGrid(t), pa = pos.get(a), pb = pos.get(b);
  let r1 = Math.min(pa.r, pb.r), c1 = Math.min(pa.c, pb.c), r2 = Math.max(pa.r + pa.rs - 1, pb.r + pb.rs - 1), c2 = Math.max(pa.c + pa.cs - 1, pb.c + pb.cs - 1), grew = true;
  while (grew) { grew = false; for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { const x = grid[r]?.[c]; if (!x) continue; const p = pos.get(x); if (p.r < r1) { r1 = p.r; grew = true; } if (p.c < c1) { c1 = p.c; grew = true; } if (p.r + p.rs - 1 > r2) { r2 = p.r + p.rs - 1; grew = true; } if (p.c + p.cs - 1 > c2) { c2 = p.c + p.cs - 1; grew = true; } } }
  t.querySelectorAll('.tsel').forEach(x => x.classList.remove('tsel'));
  if (a === b) return;
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) grid[r]?.[c]?.classList.add('tsel');
}
document.addEventListener('mousedown', e => {
  if (e.button !== 0) return; const cell = rteCellOf(e.target);
  if (!cell) { if (!e.target.closest?.('#tbl-tools')) document.querySelectorAll('.rich .tsel').forEach(x => x.classList.remove('tsel')); return; }
  if (e.shiftKey && tblCtx?.cell && tblCtx.table === cell.closest('table')) { e.preventDefault(); selectCellRect(tblCtx.cell, cell); updateTableTools(); return; }
  cell.closest('table').querySelectorAll('.tsel').forEach(x => x.classList.remove('tsel'));
  tblDrag = { start: cell };
});
document.addEventListener('mouseover', e => {
  if (!tblDrag) return; const cell = rteCellOf(e.target); if (!cell || cell.closest('table') !== tblDrag.start.closest('table')) return;
  if (cell !== tblDrag.start) { selectCellRect(tblDrag.start, cell); window.getSelection().collapse(tblDrag.start, 0); }
});
document.addEventListener('mouseup', () => { if (!tblDrag) return; const start = tblDrag.start; tblDrag = null; if (!tblCtx || tblCtx.table !== start.closest('table')) tblCtx = { table: start.closest('table'), cell: start }; updateTableTools(); });

/* ---------------- Tab / Shift+Tab between cells ---------------- */
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return;
  const s = window.getSelection(), cell = s?.rangeCount ? rteCellOf(s.anchorNode) : null; if (!cell) return;
  e.preventDefault(); e.stopPropagation();
  const cells = [...cell.closest('table').querySelectorAll('td,th')].filter(c => c.closest('table') === cell.closest('table')), i = cells.indexOf(cell);
  const next = cells[i + (e.shiftKey ? -1 : 1)];
  if (next) { placeCaret(next); return; }
  if (!e.shiftKey) { tblCtx = { table: cell.closest('table'), cell }; runTableOp('rowBelow'); }
}, true);

const TBL_ACTIONS = { 'tbl-op': el => runTableOp(el.dataset.op) };
