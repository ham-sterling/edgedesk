/* ============================================================
   AUTO BACKUP (v3.18) — writes one JSON backup a day into a
   folder you choose (Chrome / Edge on a computer, via the File
   System Access API) and keeps the newest N files. Browsers ask
   again for permission after a restart; until you click the
   sidebar prompt the backup simply waits.
   ============================================================ */
const AB_SUPPORTED = typeof window.showDirectoryPicker === 'function';
const AB_FILE = /^edgedesk-backup-\d{4}-\d{2}-\d{2}\.json$/;
let abDir = null, abNeedsPermission = false, abBusy = false;
const abCfg = () => (state.settings.autoBackup ??= { enabled: false, keep: 14, folder: '' });

async function abLoadHandle() {
  if (abDir || !AB_SUPPORTED || !abCfg().enabled) return abDir;
  try { abDir = db ? await idbGet('data', 'backupDir') : null; } catch { abDir = null; }
  return abDir;
}
async function abPermission(interactive) {
  if (!abDir) return false;
  try {
    let p = await abDir.queryPermission?.({ mode: 'readwrite' }) ?? 'granted';
    if (p !== 'granted' && interactive) p = await abDir.requestPermission({ mode: 'readwrite' });
    return p === 'granted';
  } catch { return false; }
}
function abDue() {
  const last = Date.parse(state.meta.lastAutoBackup || '') || 0, edited = Date.parse(state.meta.updatedAt || '') || 0;
  return Date.now() - last > 20 * 36e5 && edited > last;
}
/* interactive = started by a click (may ask the browser for permission) */
async function runAutoBackup(interactive = false, force = false) {
  const c = abCfg(); if (!AB_SUPPORTED || !c.enabled || abBusy) return false;
  if (!force && !abDue()) return false;
  await abLoadHandle(); if (!abDir) return false;
  if (!(await abPermission(interactive))) { if (!abNeedsPermission) { abNeedsPermission = true; render(); } return false; }
  abBusy = true;
  try {
    const name = `edgedesk-backup-${todayKey()}.json`, fh = await abDir.getFileHandle(name, { create: true }), w = await fh.createWritable();
    await w.write(await backupJSON()); await w.close();
    const files = []; for await (const [n, h] of abDir.entries()) if (h.kind === 'file' && AB_FILE.test(n)) files.push(n);
    files.sort().reverse().slice(Math.max(1, c.keep || 14)).forEach(n => abDir.removeEntry(n).catch(() => { }));
    state.meta.lastAutoBackup = state.meta.lastBackup = now(); abNeedsPermission = false; persist(); render();
    if (interactive) toast(L(`สำรองลงโฟลเดอร์ ${c.folder || ''} แล้ว`, `Backed up to ${c.folder || 'folder'}`));
    return true;
  } catch (e) { console.warn('auto backup', e); if (interactive) toast(L('สำรองอัตโนมัติไม่สำเร็จ — ลองเลือกโฟลเดอร์ใหม่', 'Auto backup failed — pick the folder again'), 'bad'); return false; }
  finally { abBusy = false; }
}
function startAutoBackup() { if (!AB_SUPPORTED) return; setTimeout(() => runAutoBackup(), 4000); setInterval(() => runAutoBackup(), 30 * 6e4); }

function autoBackupPanel() {
  const c = abCfg(), last = state.meta.lastAutoBackup;
  if (!AB_SUPPORTED) return panel(icon('clock') + L(' สำรองอัตโนมัติ', ' Automatic backup'), `<div class="notice info">${icon('info')}<span>${L('เบราว์เซอร์นี้ไม่รองรับการเขียนไฟล์ลงโฟลเดอร์ — ใช้ Chrome หรือ Edge บนคอมพิวเตอร์ หรือกด "ส่งออกไฟล์สำรอง" เป็นประจำ', 'This browser cannot write to a folder — use Chrome or Edge on a computer, or export a backup regularly')}</span></div>`);
  const status = c.enabled && c.folder
    ? `<div class="ab-status ${abNeedsPermission ? 'warn' : 'ok'}">${icon(abNeedsPermission ? 'alert' : 'check')}<div><strong>${L('เปิดอยู่ · โฟลเดอร์ ', 'On · folder ')}${esc(c.folder)}</strong><small>${abNeedsPermission ? L('เบราว์เซอร์ต้องการให้ยืนยันสิทธิ์อีกครั้ง — กด "สำรองตอนนี้"', 'The browser needs you to confirm access again — click "Back up now"') : last ? L('ล่าสุด ', 'Last ') + fmtDate(last, { time: true }) : L('ยังไม่เคยสำรอง', 'Not run yet')}</small></div></div>`
    : `<p class="muted small" style="margin-top:0">${L('เลือกโฟลเดอร์ (เช่น โฟลเดอร์ที่ซิงก์กับ Google Drive / OneDrive / iCloud) แล้ว EdgeDesk จะสำรองให้วันละครั้งเมื่อมีการแก้ไข', 'Pick a folder (ideally one synced to Google Drive / OneDrive / iCloud) and EdgeDesk writes a backup once a day when something changed')}</p>`;
  return panel(icon('clock') + L(' สำรองอัตโนมัติ', ' Automatic backup'), status + `<div class="row wrap mt12">${btn(icon('folder') + (c.enabled ? L(' เปลี่ยนโฟลเดอร์', ' Change folder') : L(' เลือกโฟลเดอร์และเปิดใช้', ' Choose folder & turn on')), 'ab-pick', {}, c.enabled ? '' : 'primary')}${c.enabled ? btn(icon('save') + L(' สำรองตอนนี้', ' Back up now'), 'ab-now', {}, 'primary') + btn(L('ปิด', 'Turn off'), 'ab-off', {}, 'ghost') : ''}</div>${c.enabled ? `<div class="row gap8 mt12 small"><span class="muted">${L('เก็บไฟล์ล่าสุด', 'Keep the newest')}</span><select class="tsel" data-change="ab-keep">${[7, 14, 30, 60].map(n => opt(n, n + L(' ไฟล์', ' files'), c.keep)).join('')}</select></div>` : ''}<p class="help mt8">${L('ไฟล์ชื่อ edgedesk-backup-ปปปป-ดด-วว.json รวมภาพหน้าจอ · ไฟล์ที่เก่ากว่าจำนวนที่เก็บจะถูกลบเฉพาะในโฟลเดอร์นี้', 'Files are named edgedesk-backup-YYYY-MM-DD.json and include screenshots · only older backup files in this folder are removed')}</p>`, '', 'ab-panel');
}
const AB_ACTIONS = {
  'ab-pick': async () => {
    try {
      const h = await window.showDirectoryPicker({ id: 'edgedesk-backup', mode: 'readwrite' });
      abDir = h; try { if (db) await idbPut('data', 'backupDir', h); } catch { }
      Object.assign(abCfg(), { enabled: true, folder: h.name || '' }); abNeedsPermission = false; persist();
      await runAutoBackup(true, true); render();
    } catch (e) { if (e?.name !== 'AbortError') toast(L('เลือกโฟลเดอร์ไม่สำเร็จ', 'Could not use that folder'), 'bad'); }
  },
  'ab-now': () => runAutoBackup(true, true),
  'ab-off': async () => { Object.assign(abCfg(), { enabled: false }); abDir = null; abNeedsPermission = false; try { if (db) await idbDel('data', 'backupDir'); } catch { } persist(); render(); toast(L('ปิดการสำรองอัตโนมัติแล้ว', 'Automatic backup turned off')); }
};
