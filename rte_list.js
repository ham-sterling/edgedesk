/* ============================================================
   CHECKLISTS in the rich editors (v3.42) — behave like bulleted /
   numbered lists:
   · Enter on a checklist line → new unticked item below (text after
     the caret moves with it)
   · Enter on an empty item → leaves the checklist (plain line)
   · Backspace right after the box → removes the box, keeps the text
   · the toolbar button turns the current line into an item (or back)
   · ticking a box is saved (the checked state is written to the HTML)
   A checklist line = a DIV/P whose first content is a checkbox.
   ============================================================ */
const CHK_BLOCK = /^(DIV|P)$/;
function chkBox(block) {
  for (const c of block.childNodes) {
    if (c.nodeType === 3 && !c.textContent.replace(/[\s​]/g, '')) continue;
    if (c.nodeType === 1 && c.matches('input[type=checkbox]')) return c;
    if (c.nodeType === 1 && c.tagName === 'LABEL' && c.firstElementChild?.matches('input[type=checkbox]')) return c.firstElementChild;
    return null;
  }
  return null;
}
function rteOf(node) { const el = node?.nodeType === 1 ? node : node?.parentElement; return el?.closest('.rich[contenteditable="true"]') || null; }
/* the line (block) holding the caret, directly inside the editor or a nested div */
function lineOf(node, ed) {
  let n = node?.nodeType === 1 ? node : node?.parentElement;
  while (n && n !== ed) { if (CHK_BLOCK.test(n.tagName) && !n.closest('td,th,li')) return n; n = n.parentElement; }
  return null;
}
function chkLineOf(node, ed) { const b = lineOf(node, ed); return b && chkBox(b) ? b : null; }
const chkText = b => b.textContent.replace(/[\s ​]/g, '');
function caretAt(node, off) { const r = document.createRange(), s = window.getSelection(); r.setStart(node, off); r.collapse(true); s.removeAllRanges(); s.addRange(r); }
function newChkLine(after) {
  const d = document.createElement('div'), box = document.createElement('input'), sp = document.createTextNode(' ');
  box.type = 'checkbox'; d.append(box, sp); after.after(d); return { d, sp };
}
function rteChanged(ed) { ed.dispatchEvent(new Event('input', { bubbles: true })); if (ed.id === 'note-rich' && typeof saveNote === 'function') saveNote(); }

document.addEventListener('keydown', e => {
  if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key !== 'Enter' && e.key !== 'Backspace') return;
  const s = window.getSelection(); if (!s?.rangeCount) return;
  const ed = rteOf(s.anchorNode); if (!ed) return;
  const line = chkLineOf(s.anchorNode, ed); if (!line) return;
  const box = chkBox(line);
  if (e.key === 'Enter') {
    if (e.shiftKey) return; // soft line break inside the item
    e.preventDefault();
    if (!chkText(line)) { // empty item → leave the checklist
      box.remove(); line.innerHTML = '<br>'; caretAt(line, 0); rteChanged(ed); return;
    }
    const r = s.getRangeAt(0); if (!r.collapsed) r.deleteContents();
    const tail = document.createRange(); tail.setStart(r.startContainer, r.startOffset); tail.setEndAfter(line.lastChild);
    const frag = tail.extractContents();
    // the extracted fragment may carry a copy of the line's wrapper — unwrap it
    const moved = frag.firstChild && frag.childNodes.length === 1 && frag.firstChild.nodeType === 1 && CHK_BLOCK.test(frag.firstChild.tagName) ? [...frag.firstChild.childNodes] : [...frag.childNodes];
    if (!line.textContent.length && !line.querySelector('img')) line.append(document.createTextNode(' '));
    const { d, sp } = newChkLine(line);
    moved.forEach(n => { if (!(n.nodeType === 1 && n.matches('input[type=checkbox]'))) d.append(n); });
    // drop a leading space so "item| text" doesn't become "  text"
    if (sp.nextSibling?.nodeType === 3) sp.nextSibling.textContent = sp.nextSibling.textContent.replace(/^[  ]+/, '');
    caretAt(sp, 1); d.scrollIntoView?.({ block: 'nearest' }); rteChanged(ed);
    return;
  }
  // Backspace just after the box → remove the box, keep the line
  const r = s.getRangeAt(0); if (!r.collapsed) return;
  const before = document.createRange(); before.setStartBefore(box); before.setEnd(r.startContainer, r.startOffset);
  if (before.toString().replace(/[\s ​]/g, '')) return;
  if (before.cloneContents().querySelectorAll('input,img').length > 1) return;
  e.preventDefault();
  const nx = box.nextSibling; box.remove();
  if (nx?.nodeType === 3) { nx.textContent = nx.textContent.replace(/^[  ]/, ''); if (nx.textContent) caretAt(nx, 0); else { if (!line.textContent) line.innerHTML = '<br>'; caretAt(line, 0); } }
  else { if (!line.textContent && !line.querySelector('img')) line.innerHTML = '<br>'; caretAt(line, 0); }
  rteChanged(ed);
}, true);

/* toolbar: turn the current line into a checklist item, or back into a plain line */
function rteChecklist(ed) {
  const s = window.getSelection(); if (!s?.rangeCount || !ed.contains(s.anchorNode)) { ed.focus(); }
  const sel = window.getSelection(); let line = sel?.rangeCount ? lineOf(sel.anchorNode, ed) : null;
  if (line && chkBox(line)) { chkBox(line).remove(); const f = line.firstChild; if (f?.nodeType === 3) f.textContent = f.textContent.replace(/^[  ]/, ''); caretAt(line, 0); rteChanged(ed); return; }
  if (!line) { // bare text directly in the editor (or empty editor) → wrap it in a line
    const r = sel?.rangeCount ? sel.getRangeAt(0) : null, d = document.createElement('div');
    let n = r ? r.startContainer : null; while (n && n.parentNode !== ed) n = n.parentNode;
    if (n && n !== ed) { n.before(d); d.append(n); } else { ed.append(d); }
    line = d;
  }
  const box = document.createElement('input'); box.type = 'checkbox';
  const sp = document.createTextNode(' '); line.prepend(box, sp);
  if (line.lastChild?.nodeName === 'BR' && line.childNodes.length > 2 && chkText(line)) line.lastChild.remove();
  // caret at the end of the line's text
  const last = [...line.childNodes].reverse().find(n => n.nodeType === 3); if (last) caretAt(last, last.textContent.length); else caretAt(sp, 1);
  rteChanged(ed);
}

/* ticking a box: store it in the HTML so it survives saving */
document.addEventListener('change', e => {
  const t = e.target; if (!t.matches?.('input[type=checkbox]')) return; const ed = rteOf(t); if (!ed) return;
  t.toggleAttribute('checked', t.checked); rteChanged(ed);
});
