/* ============================================================
   EDITOR GUARD — editors never close by clicking outside.
   Close button / Cancel / Esc → if there are unsaved edits ask:
   keep editing · discard · save draft (where supported) · save.
   ============================================================ */
let DRAFTS = {};
const DRAFT_LS = 'edgedesk-drafts';
async function loadDrafts() {
  try { const v = db ? await idbGet('data', 'drafts') : JSON.parse(localStorage.getItem(DRAFT_LS) || '{}'); DRAFTS = v && typeof v === 'object' ? v : {}; } catch { DRAFTS = {}; }
}
function storeDrafts() {
  try { if (db) idbPut('data', 'drafts', clone(DRAFTS)).catch(() => toast(L('เก็บร่างไม่สำเร็จ', 'Could not store draft'), 'bad')); else localStorage.setItem(DRAFT_LS, JSON.stringify(DRAFTS)); }
  catch { toast(L('เก็บร่างไม่สำเร็จ (พื้นที่ไม่พอ)', 'Could not store draft (storage full)'), 'bad'); }
}
const getDraft = key => key ? DRAFTS[key] : null;
function putDraft(key, title, data) { DRAFTS[key] = { at: now(), title: title || '', data: clone(data) }; storeDrafts(); }
function dropDraft(key) { if (key && DRAFTS[key]) { delete DRAFTS[key]; storeDrafts(); } }

/* a modal is "form-like" when the user can type or pick something in it */
function isFormModal(el) { return !!el?.querySelector('.modal-b form, .modal-b [contenteditable="true"], .modal-b input:not([type=hidden]):not([type=file]), .modal-b select, .modal-b textarea'); }
function modalFormState(el) {
  if (!el) return '';
  const parts = [];
  el.querySelectorAll('.modal-b input, .modal-b select, .modal-b textarea').forEach(i => { if (i.type === 'file' || i.closest('.draft-bar')) return; parts.push((i.name || i.id || '') + '=' + (i.type === 'checkbox' || i.type === 'radio' ? i.checked : i.value)); });
  el.querySelectorAll('.modal-b [contenteditable="true"]').forEach(c => parts.push('#' + c.id + '=' + c.innerHTML));
  if (typeof editor !== 'undefined' && editor) { try { const { record, ...rest } = editor; parts.push(JSON.stringify(rest)); } catch { } }
  return parts.join('\u0001');
}
const topEntry = () => modalStack[modalStack.length - 1];
function modalDirty(m = topEntry(), el = topModal()) { return !!(m?.guard && m.snap != null && modalFormState(el) !== m.snap); }

/* status chip in the footer: unsaved / draft / saved */
function updateEdState(m = topEntry(), el = topModal()) {
  const chip = el?.querySelector('.ed-state'); if (!chip || !m?.guard) return;
  const dirty = modalDirty(m, el);
  if (dirty) { chip.className = 'ed-state warn'; chip.innerHTML = `<i></i>${L('ยังไม่บันทึก', 'Unsaved changes')}`; }
  else if (m.fromDraft) { chip.className = 'ed-state draft'; chip.innerHTML = `${icon('clipboard')}${L('ร่าง · เก็บไว้ ', 'Draft · stored ')}${fmtDate(m.fromDraft, { time: true })}`; }
  else if (m.saved) { chip.className = 'ed-state ok'; chip.innerHTML = `${icon('check')}${L('บันทึกแล้ว', 'Saved')}`; }
  else { chip.className = 'ed-state'; chip.innerHTML = ''; }
}
const edStateSoon = debounce(() => updateEdState(), 120);
function armGuard(entry, el) {
  if (!entry.guard) return;
  if (!isFormModal(el)) { entry.guard = false; return; }
  setTimeout(() => { if (modalStack.includes(entry)) { entry.snap = modalFormState(el); updateEdState(entry, el); } }, 90);
  ['input', 'change'].forEach(ev => el.addEventListener(ev, edStateSoon));
  el.addEventListener('click', () => setTimeout(edStateSoon, 0));
}

/* user asked to close the top modal (X, Cancel, Esc) */
function requestCloseModal() {
  const m = topEntry(); if (!m) return false;
  const el = topModal();
  if (!modalDirty(m, el)) { closeModal(); return true; }
  unsavedDialog(m, el); return true;
}
function unsavedDialog(m, el) {
  const canDraft = !!m.draft, hasSave = !!el.querySelector('.modal-f .btn.primary');
  window.__guard = { m, el };
  openModal({
    title: icon('alert') + L(' ยังไม่ได้บันทึกการแก้ไข', ' Unsaved changes'), size: 'sm', guard: false, cls: 'guard-dlg',
    body: `<p class="muted" style="margin-top:0">${L('ต้องการทำอะไรกับสิ่งที่แก้ไขไว้ในหน้าต่างนี้?', 'What should happen to your edits in this window?')}</p>
      <div class="guard-opts">
        ${hasSave ? `<button type="button" class="gopt primary" data-action="guard-save">${icon('save')}<span><strong>${L('บันทึก', 'Save')}</strong><small>${L('บันทึกการแก้ไขแล้วปิดหน้าต่าง', 'Save the changes and close')}</small></span></button>` : ''}
        ${canDraft ? `<button type="button" class="gopt" data-action="guard-draft">${icon('clipboard')}<span><strong>${L('เก็บเป็นร่าง', 'Save as draft')}</strong><small>${L('ปิดไว้ก่อน เปิดหน้าต่างนี้อีกครั้งเพื่อทำต่อ', 'Close now and continue later from here')}</small></span></button>` : ''}
        <button type="button" class="gopt danger" data-action="guard-discard">${icon('trash')}<span><strong>${L('ทิ้งการแก้ไข', 'Discard')}</strong><small>${L('ปิดโดยไม่บันทึก — ย้อนกลับไม่ได้', 'Close without saving — cannot be undone')}</small></span></button>
      </div>`,
    foot: `<div class="grow"></div>${btn(L('แก้ไขต่อ', 'Keep editing'), 'close-modal', { autofocus: true }, 'ghost')}`
  });
}
const GUARD_ACTIONS = {
  'guard-save': () => { const g = window.__guard; closeModal(); g?.el.querySelector('.modal-f .btn.primary')?.click(); },
  'guard-draft': () => { const g = window.__guard; if (!g?.m.draft) return; try { const d = g.m.draft.save(); putDraft(g.m.draft.key, d.title, d.data); } catch (e) { console.error(e); toast(L('เก็บร่างไม่สำเร็จ', 'Could not store draft'), 'bad'); return; } closeModal(); closeModal(); toast(L('เก็บเป็นร่างแล้ว — เปิดหน้าต่างนี้อีกครั้งเพื่อทำต่อ', 'Draft saved — reopen this window to continue')); },
  'guard-discard': () => { const g = window.__guard; closeModal(); if (g?.m.draft?.key && g.m.fromDraft) dropDraft(g.m.draft.key); closeModal(); toast(L('ทิ้งการแก้ไขแล้ว', 'Changes discarded')); },
  'draft-restore': () => { const m = topEntry(); const d = getDraft(m?.draft?.key); if (!d) return; const restore = m.draft.restore; closeModal(); restore(d.data, d.at); },
  'draft-drop': () => { const m = topEntry(); if (!m?.draft) return; dropDraft(m.draft.key); topModal()?.querySelector('.draft-bar')?.remove(); m.snap = modalFormState(topModal()); updateEdState(); toast(L('ทิ้งร่างแล้ว', 'Draft discarded')); },
};
/* banner shown at the top of an editor when a stored draft exists */
function draftBar(key, fromDraft) {
  const d = getDraft(key); if (!d || fromDraft) return '';
  return `<div class="notice info mb16 draft-bar">${icon('clipboard')}<div class="grow">${L('มีร่างที่ยังไม่ได้บันทึก', 'You have an unsaved draft')} · <span class="dim">${fmtDate(d.at, { time: true })}</span></div>${btn(L('กู้คืนร่าง', 'Restore draft'), 'draft-restore', {}, 'sm primary')}${btn(L('ทิ้งร่าง', 'Discard draft'), 'draft-drop', {}, 'sm ghost')}</div>`;
}
