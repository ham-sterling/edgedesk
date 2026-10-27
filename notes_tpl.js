/* ============================================================
   NOTE TEMPLATES — built-in + user templates, apply to any note
   ============================================================ */
function defaultNoteTemplates() {
  const t = now();
  return NOTE_TEMPLATES.filter(x => x.id !== 'blank').map(x => ({ id: 'tpl_' + x.id, title: x.title, desc: x.desc, icon: x.icon, html: x.html, builtin: true, createdAt: t, updatedAt: t }));
}
function tplName(t) { if (!t) return ''; return t.builtin && String(t.title).includes(' · ') ? t.title.split(' · ')[LANG === 'th' ? 1 : 0] : (t.title || L('ไม่มีชื่อ', 'Untitled')); }
function tplDesc(t) { return t?.desc || ''; }
const noteTemplates = () => state.noteTemplates || (state.noteTemplates = []);
const getTpl = id => noteTemplates().find(x => x.id === id);

function templatesSidebarHTML() {
  const list = noteTemplates();
  return `<div class="row" style="justify-content:space-between;margin:22px 0 6px"><strong class="small">${L('เทมเพลต', 'Templates')}</strong>${ibtn('plus', 'tpl-new', L('เทมเพลตใหม่', 'New template'), {}, 'sm')}</div>`
    + (list.length ? list.map(t => `<div class="row gap4"><button class="folder" data-action="note-template" data-id="${esc(t.id)}" data-tip="${esc(L('สร้างโน้ตใหม่จากเทมเพลตนี้', 'New note from this template'))}">${icon(t.icon || 'template')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(tplName(t))}</span>${state.settings.journalTemplate === t.id ? `<span class="n" data-tip="${esc(L('ค่าเริ่มต้นของบันทึกประจำวัน', 'Daily Journal default'))}">${icon('star', 'tiny')}</span>` : ''}</button>${menu([menuItem(L('สร้างโน้ตจากเทมเพลต', 'New note from it'), 'note-template', { 'data-id': t.id }, 'file-plus'), ...(state.settings.journalTemplate === t.id ? [] : [menuItem(L('ใช้เป็นค่าเริ่มต้นของบันทึกประจำวัน', 'Use as Journal default'), 'tpl-journal-default', { 'data-id': t.id }, 'journal-day')]), menuItem(L('แก้ไขเทมเพลต', 'Edit template'), 'tpl-edit', { 'data-id': t.id }, 'edit'), menuItem(L('ทำสำเนา', 'Duplicate'), 'tpl-dup', { 'data-id': t.id }, 'copy'), menuItem(L('ลบเทมเพลต', 'Delete'), 'tpl-del', { 'data-id': t.id }, 'trash', 'danger')])}</div>`).join('')
      : `<p class="dim small" style="padding:4px 10px">${L('ยังไม่มีเทมเพลต', 'No templates')}</p>`);
}

function newNoteFromTemplate(id) {
  const t = id === 'blank' ? null : getTpl(id);
  newNote(t ? sanitize(t.html) : '<p><br></p>', t ? `${tplName(t)} · ${fmtDate(todayKey())}` : '', t ? { templateId: t.id } : {});
}

function applyTemplateDialog(noteId) {
  const ed = $('#note-rich'); if (!ed) return; const n = get('notebooks', noteId) || {};
  const list = noteTemplates(), cur = sanitize(ed.innerHTML), hasContent = !!plain(cur) && !(ed.dataset.day && cur === journalTplHTML());
  if (!list.length) { toast(L('ยังไม่มีเทมเพลต — สร้างก่อนได้ที่แถบซ้าย', 'No templates yet — create one first')); return; }
  openModal({
    title: icon('template') + L(' ใช้เทมเพลตกับโน้ตนี้', ' Apply a template'), size: 'sm',
    body: `${hasContent ? `<div class="mb16">${field('tplmode', L('วิธีใส่เนื้อหา', 'How to insert'), 'append', 'select', { options: [['append', L('ต่อท้ายเนื้อหาเดิม', 'Append below current content')], ['replace', L('แทนที่เนื้อหาทั้งหมด', 'Replace all content')]] })}</div>` : ''}
      <div class="tpl-pick">${list.map(t => `<button type="button" data-action="tpl-apply" data-id="${esc(t.id)}" data-note="${esc(n.id || '')}">${icon(t.icon || 'template')}<span><strong>${esc(tplName(t))}</strong>${tplDesc(t) ? `<small>${esc(tplDesc(t))}</small>` : ''}</span>${n.templateId === t.id ? `<i class="badge">${L('ใช้อยู่', 'In use')}</i>` : ''}</button>`).join('')}</div>
      <p class="help mt8">${L('กด Undo (Ctrl+Z) ในโน้ตเพื่อย้อนกลับได้', 'Use Undo (Ctrl+Z) in the note to revert')}</p>`,
    foot: `<div class="grow"></div>${btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost')}`
  });
}
function applyTemplate(noteId, tplId) {
  const t = getTpl(tplId); if (!t) return;
  const mode = $('#f_tplmode')?.value || 'replace';
  closeModal();
  const ed = $('#note-rich'); if (!ed) return;
  ed.focus();
  const sel = window.getSelection(), range = document.createRange();
  range.selectNodeContents(ed); if (mode === 'append') range.collapse(false);
  sel.removeAllRanges(); sel.addRange(range);
  // execCommand keeps the change on the editor's undo stack
  document.execCommand('insertHTML', false, sanitize(t.html));
  const n = get('notebooks', noteId) || currentNote(true); if (n) n.templateId = t.id;
  const title = $('#note-title'); if (title && !title.value.trim()) title.value = `${tplName(t)} · ${fmtDate(todayKey())}`;
  saveNote(); toast(L('ใส่เทมเพลตแล้ว', 'Template applied'));
}

function openTemplateEditor(id = '', seedHTML = null, seedTitle = '', draft = null) {
  const t0 = getTpl(id), key = 'tpl:' + (t0 ? id : 'new'), dd = draft?.data;
  const t = dd ? { ...(t0 || {}), title: dd.title, desc: dd.desc, html: dd.html, builtin: false } : t0;
  openModal({
    title: (t0 ? L('แก้ไขเทมเพลต', 'Edit template') : L('เทมเพลตใหม่', 'New template')), size: 'lg', saved: !!t0, fromDraft: draft?.at || null, draft: { key, save: () => ({ title: $('#f_tpl_title')?.value || '', data: { title: $('#f_tpl_title')?.value || '', desc: $('#f_tpl_desc')?.value || '', html: $('#tpl-rich')?.innerHTML || '' } }), restore: (data, at) => openTemplateEditor(id, null, '', { data, at }) },
    body: `${draftBar(key, !!draft)}<div class="formgrid">${field('tpl_title', L('ชื่อเทมเพลต', 'Template name'), t ? tplName(t) : seedTitle, 'text', { required: true, placeholder: L('เช่น รีวิวหลังข่าว NFP', 'e.g. Post-NFP review') })}${field('tpl_desc', L('คำอธิบายสั้น ๆ (ถ้ามี)', 'Short description (optional)'), t?.desc || '')}</div>
      <div class="field mt16"><label>${L('เนื้อหาเทมเพลต', 'Template content')}</label><div class="panel" style="overflow:hidden">${rteToolbar('tpl-rich')}<div class="rich" id="tpl-rich" contenteditable="true" data-ph="${L('วางโครงหัวข้อที่อยากให้มีในทุกโน้ต…', 'Lay out the headings every note should start with…')}" style="min-height:240px">${sanitize(t ? t.html : seedHTML ?? '<h2><br></h2>')}</div></div></div>`,
    foot: `${t0 ? btn(icon('trash') + L(' ลบ', ' Delete'), 'tpl-del', { 'data-id': t0.id }, 'ghost danger') : ''}<div class="grow"></div>${btn(L('ยกเลิก', 'Cancel'), 'close-modal', {}, 'ghost')}${btn(icon('save') + L(' บันทึกเทมเพลต', ' Save template'), 'tpl-save', { 'data-id': t0?.id || '' }, 'primary')}`
  });
  setTimeout(() => $('#f_tpl_title')?.focus(), 30);
}
async function saveTemplate(id) {
  const name = ($('#f_tpl_title')?.value || '').trim(), desc = ($('#f_tpl_desc')?.value || '').trim(), html = sanitize($('#tpl-rich')?.innerHTML || '');
  if (!name) { toast(L('ตั้งชื่อเทมเพลตก่อน', 'Name the template'), 'bad'); $('#f_tpl_title')?.focus(); return; }
  if (!plain(html) && !/<(table|hr|img|input)/i.test(html)) { toast(L('เทมเพลตยังไม่มีเนื้อหา', 'Template is empty'), 'bad'); return; }
  const list = noteTemplates(); let t = getTpl(id);
  if (t) { if (!(t.builtin && name === tplName(t))) { t.title = name; t.builtin = false; } t.desc = desc; t.html = html; t.updatedAt = now(); }
  else { t = { id: uid('tpl'), title: name, desc, icon: 'template', html, createdAt: now(), updatedAt: now() }; list.push(t); }
  dropDraft('tpl:' + (id && getTpl(id) ? id : 'new')); closeModal(); await changed(L('บันทึกเทมเพลตแล้ว', 'Template saved'));
}

const TPL_ACTIONS = {
  'tpl-new': () => openTemplateEditor(),
  'tpl-edit': el => openTemplateEditor(el.dataset.id),
  'tpl-save': el => saveTemplate(el.dataset.id),
  'tpl-dup': async el => { const t = getTpl(el.dataset.id); if (!t) return; noteTemplates().push({ ...clone(t), id: uid('tpl'), title: tplName(t) + L(' (สำเนา)', ' (copy)'), builtin: false, createdAt: now(), updatedAt: now() }); await changed(L('ทำสำเนาแล้ว', 'Duplicated')); },
  'tpl-del': el => { const t = getTpl(el.dataset.id); if (!t) return; confirmDialog(L('ลบเทมเพลตนี้?', 'Delete this template?'), L(`"${tplName(t)}" — โน้ตที่สร้างจากเทมเพลตนี้จะยังอยู่ครบ`, `"${tplName(t)}" — notes created from it are kept`), async () => { state.noteTemplates = noteTemplates().filter(x => x.id !== t.id); if (state.settings.journalTemplate === t.id) state.settings.journalTemplate = ''; closeModal(); await changed(L('ลบเทมเพลตแล้ว', 'Template deleted')); }); },
  'tpl-from-note': el => { const n = get('notebooks', el.dataset.id); if (!n) return; flushNote(); openTemplateEditor('', $('#note-rich')?.innerHTML ?? n.html, isJournal(n) ? L('บันทึกประจำวัน', 'Daily Journal') : n.title || ''); },
  'note-apply-tpl': () => { flushNote(); applyTemplateDialog(currentNote()?.id || ''); },
  'tpl-journal-default': async el => { if (!getTpl(el.dataset.id)) return; state.settings.journalTemplate = el.dataset.id; await changed(L('ตั้งเป็นเทมเพลตเริ่มต้นของ บันทึกประจำวัน แล้ว', 'Set as the Daily Journal default')); },
  'tpl-apply': el => applyTemplate(el.dataset.note, el.dataset.id),
};
