/* ============================================================
   CLOUD SYNC (v3.27) — only active in the Cloudflare build
   (EDGEDESK_CLOUD = true). The app keeps working exactly as the
   standalone file: everything is saved to IndexedDB first, which
   doubles as an offline cache. After each local save the records
   that changed are pushed to the Worker API (Cloudflare D1);
   screenshots go to /api/images. Other devices notice the new
   revision within ~30 s (or when the tab regains focus) and pull.
   Conflicts are resolved per record: the last save wins.
   ============================================================ */
const CLOUD = typeof EDGEDESK_CLOUD !== 'undefined' && !!EDGEDESK_CLOUD;
const SEP = '\u001f', CLOUD_DIRTY = 'edgedesk-cloud-dirty', CLOUD_IMGQ = 'edgedesk-cloud-imgq';
const cloud = { rev: 0, snap: new Map(), pushing: null, again: false, lastSync: null, offline: false, timer: null, firstUpload: false, error: '' };

async function api(path, opt = {}) {
  const r = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...opt, headers: { 'Content-Type': 'application/json', 'X-EdgeDesk': '1', ...(opt.headers || {}) } });
  if (r.status === 401) { const e = Error('auth'); e.status = 401; if (state) cloudAuthLost(); throw e; }
  if (!r.ok) { let m = ''; try { m = (await r.json()).error || ''; } catch { } const e = Error(m || 'HTTP ' + r.status); e.status = r.status; throw e; }
  return (r.headers.get('content-type') || '').includes('json') ? r.json() : r.text();
}
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { } };

/* one string per record (and per settings/meta document) → cheap change detection */
function snapOf(s) {
  const m = new Map();
  for (const c of COLLECTIONS) for (const r of s[c] || []) if (r?.id) m.set(c + SEP + r.id, JSON.stringify(r));
  m.set('doc' + SEP + 'settings', JSON.stringify(s.settings || {})); m.set('doc' + SEP + 'meta', JSON.stringify(s.meta || {}));
  return m;
}
function remoteToState(res) {
  const s = { meta: res.docs.meta || {}, settings: res.docs.settings || {} };
  for (const c of COLLECTIONS) s[c] = [];
  for (const [c, d] of res.records) (s[c] ||= []).push(d);
  return s;
}
const remoteEmpty = res => !res.records.length && !res.docs.settings;

/* ---------- login ---------- */
async function cloudMe() { try { return await api('/api/me'); } catch (e) { return { authed: false, error: e.message, offline: !e.status }; } }
function cloudLoginView(me = {}) {
  LANG = (navigator.language || '').startsWith('th') ? 'th' : 'en';
  const msg = me.configured === false ? L('ยังไม่ได้ตั้งรหัสผ่าน — เพิ่ม Secret ชื่อ APP_PASSWORD ใน Cloudflare (Worker → Settings → Variables and Secrets) แล้ว Deploy ใหม่', 'No password set yet — add a secret named APP_PASSWORD in Cloudflare (Worker → Settings → Variables and Secrets) and redeploy')
    : me.offline ? L('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบอินเทอร์เน็ต', 'Cannot reach the server — check your connection') : '';
  $('#app').innerHTML = `<div class="login-wrap"><form class="login-card" id="login-form" onsubmit="return false"><div class="login-logo">${icon('activity')}</div><h1>EdgeDesk</h1><p class="muted small">${L('สมุดบันทึกการเทรด · ข้อมูลเก็บบน Cloudflare ของคุณ', 'Trading journal · data stored in your own Cloudflare')}</p>
    ${msg ? `<div class="notice ${me.configured === false ? 'warn' : 'bad'} mt12">${icon('alert')}<span>${esc(msg)}</span></div>` : ''}
    <div class="field mt16"><label for="f_pw">${L('รหัสผ่าน', 'Password')}</label><input id="f_pw" name="password" type="password" autocomplete="current-password" autofocus ${me.configured === false ? 'disabled' : ''}></div>
    <button class="btn primary mt16" style="width:100%;justify-content:center" type="submit" id="login-btn" ${me.configured === false ? 'disabled' : ''}>${L('เข้าสู่ระบบ', 'Sign in')}</button><p class="small neg mt8" id="login-err"></p></form></div>`;
  $('#login-form').addEventListener('submit', async () => {
    const b = $('#login-btn'); b.disabled = true; $('#login-err').textContent = '';
    try { await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('#f_pw').value }) }); location.reload(); }
    catch (e) { b.disabled = false; $('#login-err').textContent = e.status === 401 || e.status === 403 ? L('รหัสผ่านไม่ถูกต้อง', 'Wrong password') : e.status === 429 ? L('ลองผิดหลายครั้งเกินไป รอสักครู่', 'Too many attempts — wait a moment') : L('เชื่อมต่อไม่ได้: ', 'Cannot connect: ') + e.message; $('#f_pw').select(); }
  });
  setTimeout(() => $('#f_pw')?.focus(), 50);
}
let authLostShown = false;
function cloudAuthLost() { if (authLostShown) return; authLostShown = true; clearInterval(cloud.timer); flushNow?.(); cloudLoginView({}); }
async function cloudLogout() { try { await flushNow(); await cloudPush(); await api('/api/logout', { method: 'POST' }); } catch { } location.reload(); }

/* ---------- load ---------- */
async function cloudLoadState() {
  let local = null;
  try { db = await idbOpen(DB_NAME, ['data', 'images']); local = await idbGet('data', 'state'); localRev = (await readRev())?.n || 0; } catch { db = null; }
  storageType = 'Cloudflare D1';
  let res;
  try { res = await api('/api/state'); }
  catch (e) { if (e.status === 401) throw e; cloud.offline = true; cloud.error = e.message; return local ? migrate(local) : seed(); }
  cloud.rev = res.rev;
  if (remoteEmpty(res)) { cloud.snap = new Map(); cloud.firstUpload = true; return local ? migrate(local) : seed(); }
  const raw = remoteToState(res);
  cloud.snap = snapOf(raw);
  let st = migrate(raw);
  /* edits made while offline (saved locally, never pushed): keep the local version of every record that differs */
  if (lsGet(CLOUD_DIRTY) && local) {
    const loc = migrate(local), idx = new Map(); for (const c of COLLECTIONS) for (const r of st[c]) idx.set(c + SEP + r.id, r);
    for (const c of COLLECTIONS) for (const r of loc[c] || []) { const k = c + SEP + r.id, cur = idx.get(k); if (!cur) st[c].push(r); else if (JSON.stringify(cur) !== JSON.stringify(r) && (Date.parse(r.updatedAt || 0) || 0) >= (Date.parse(cur.updatedAt || 0) || 0)) st[c][st[c].indexOf(cur)] = r; }
    st.settings = loc.settings;
  }
  return st;
}

/* ---------- push ---------- */
function cloudLabel(ok, msg) { const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); setSaveLabel(ok ? L('ซิงก์ขึ้นคลาวด์แล้ว · ', 'Synced · ') + t : msg || L('ยังไม่ได้ซิงก์ — จะลองใหม่', 'Not synced yet — retrying'), !ok); }
function cloudPush() {
  if (!CLOUD || !state || authLostShown) return Promise.resolve(false);
  if (cloud.pushing) { cloud.again = true; return cloud.pushing; }
  cloud.pushing = (async () => {
    const now = snapOf(state), ups = [], dels = [], docs = {};
    for (const [k, v] of now) if (cloud.snap.get(k) !== v) { const i = k.indexOf(SEP), c = k.slice(0, i), id = k.slice(i + 1); if (c === 'doc') docs[id] = v; else ups.push({ c, id, d: v }); }
    for (const k of cloud.snap.keys()) if (!now.has(k)) { const i = k.indexOf(SEP), c = k.slice(0, i); if (c !== 'doc') dels.push({ c, id: k.slice(i + 1) }); }
    if (!ups.length && !dels.length && !Object.keys(docs).length) { lsSet(CLOUD_DIRTY, null); return true; }
    lsSet(CLOUD_DIRTY, '1');
    try {
      /* requests stay well under D1's 2 MB value limit */
      const chunks = []; let cur = [], size = 0;
      for (const u of ups) { const n = u.d.length + u.id.length + 40; if (cur.length && (size + n > 900000 || cur.length >= 800)) { chunks.push(cur); cur = []; size = 0; } cur.push(u); size += n; }
      if (cur.length || !chunks.length) chunks.push(cur);
      for (let i = 0; i < chunks.length; i++) {
        const body = { base: cloud.rev, upserts: chunks[i] }; if (i === 0) { body.deletes = dels; body.docs = docs; }
        const r = await api('/api/sync', { method: 'POST', body: JSON.stringify(body) });
        if (r.prev !== cloud.rev) cloud.remoteMoved = true;
        cloud.rev = r.rev;
      }
      cloud.snap = now; cloud.lastSync = Date.now(); cloud.offline = false; cloud.firstUpload = false; lsSet(CLOUD_DIRTY, null); cloudLabel(true);
      if (cloud.remoteMoved) { cloud.remoteMoved = false; setTimeout(() => cloudCheck(true), 300); }
      return true;
    } catch (e) {
      if (e.status === 401) return false;
      cloud.offline = !e.status; cloud.error = e.message; cloudLabel(false, e.status === 413 ? L('ข้อมูลใหญ่เกินไปสำหรับการซิงก์ครั้งเดียว', 'Too much data in one sync') : null);
      clearTimeout(cloud.retry); cloud.retry = setTimeout(cloudPush, 15000); return false;
    }
  })().finally(() => { cloud.pushing = null; if (cloud.again) { cloud.again = false; cloudPush(); } });
  return cloud.pushing;
}

/* ---------- pull (another device saved) ---------- */
async function cloudCheck(force = false) {
  if (!CLOUD || !state || authLostShown || cloud.pushing) return;
  if (!force && document.hidden) return;
  try {
    const { rev } = await api('/api/rev'); cloud.offline = false;
    if (rev === cloud.rev) return;
    if (dirty || saveTimer || modalStack.length || drawerState) { cloud.pendingPull = true; return; } // never yank data from under an open editor
    await cloudPull();
  } catch (e) { if (!e.status) cloud.offline = true; }
}
async function cloudPull() {
  const res = await api('/api/state'), raw = remoteToState(res);
  cloud.rev = res.rev; cloud.snap = snapOf(raw); cloud.pendingPull = false;
  state = migrate(raw); invalidate(); reindex(); LANG = state.settings.language || LANG;
  try { await flushSaveLocal(); } catch { }
  render(); cloudLabel(true); toast(L('อัปเดตข้อมูลจากอุปกรณ์อื่นแล้ว', 'Updated from another device'));
}
/* write the pulled state into the IndexedDB cache without triggering another push */
function flushSaveLocal() { return new Promise(res => { if (!db) return res(); try { const tx = db.transaction('data', 'readwrite'); tx.objectStore('data').put(state, 'state'); tx.oncomplete = res; tx.onerror = tx.onabort = res; } catch { res(); } }); }

/* ---------- screenshots ---------- */
const imgQueue = () => { try { return JSON.parse(lsGet(CLOUD_IMGQ) || '[]'); } catch { return []; } };
const setImgQueue = q => lsSet(CLOUD_IMGQ, q.length ? JSON.stringify([...new Set(q)]) : null);
async function cloudImgPut(rec) {
  try { await api('/api/images/' + encodeURIComponent(rec.id), { method: 'PUT', body: JSON.stringify(rec) }); setImgQueue(imgQueue().filter(x => x !== rec.id)); return true; }
  catch (e) { if (e.status !== 401) setImgQueue([...imgQueue(), rec.id]); return false; }
}
async function cloudImgGet(id) { try { const rec = await api('/api/images/' + encodeURIComponent(id)); if (rec?.data) { try { if (db) await idbPut('images', id, rec); } catch { } return rec; } } catch { } return null; }
function cloudImgDel(id) { setImgQueue(imgQueue().filter(x => x !== id)); api('/api/images/' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => { }); }
async function cloudImgFlushQueue() { for (const id of imgQueue()) { let rec = null; try { rec = db ? await idbGet('images', id) : null; } catch { } if (rec) await cloudImgPut(rec); else setImgQueue(imgQueue().filter(x => x !== id)); } }
/* backups need every screenshot, including ones only uploaded from other devices */
async function cloudImgPullAll(local) {
  try { const { ids } = await api('/api/images'); for (const id of ids) if (!local[id]) { const rec = await cloudImgGet(id); if (rec) local[id] = rec; } } catch { }
  return local;
}

/* ---------- start / status ---------- */
function cloudStart() {
  if (!CLOUD) return;
  if (cloud.offline) cloudLabel(false, L('ออฟไลน์ — ใช้ข้อมูลในเครื่อง จะซิงก์เมื่อออนไลน์', 'Offline — using the local copy; will sync when online'));
  if (cloud.firstUpload || lsGet(CLOUD_DIRTY) || cloud.offline) setTimeout(cloudPush, 500);
  setTimeout(cloudImgFlushQueue, 2000);
  cloud.timer = setInterval(() => { if (cloud.pendingPull && !dirty && !modalStack.length && !drawerState) cloudCheck(true); else cloudCheck(); if (imgQueue().length) cloudImgFlushQueue(); if (lsGet(CLOUD_DIRTY) && !cloud.pushing) cloudPush(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cloudCheck(); });
  window.addEventListener('online', () => { cloudPush(); cloudCheck(true); });
}
function cloudPanel() {
  const st = cloud.offline ? ['warn', 'alert', L('ออฟไลน์ — แก้ไขได้ตามปกติ ระบบจะซิงก์ให้เมื่อกลับมาออนไลน์', 'Offline — keep working; changes sync when you are back online')] : lsGet(CLOUD_DIRTY) ? ['warn', 'refresh', L('มีการแก้ไขที่ยังไม่ได้ซิงก์', 'Changes waiting to sync')] : ['ok', 'check', L('ข้อมูลตรงกับคลาวด์', 'In sync with the cloud')];
  return panel(icon('database') + L(' ซิงก์คลาวด์', ' Cloud sync'), `<div class="ab-status ${st[0]}">${icon(st[1])}<div><strong>${st[2]}</strong><small>Cloudflare D1 · ${L('รุ่นข้อมูล', 'revision')} ${cloud.rev}${cloud.lastSync ? ' · ' + L('ซิงก์ล่าสุด ', 'last sync ') + new Date(cloud.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}${imgQueue().length ? ' · ' + L(`รูปรออัปโหลด ${imgQueue().length}`, `${imgQueue().length} images waiting`) : ''}</small></div></div>
    <div class="row wrap mt12">${btn(icon('refresh') + L(' ซิงก์ตอนนี้', ' Sync now'), 'cloud-sync', {}, 'primary')}${btn(icon('lock') + L(' ออกจากระบบ', ' Sign out'), 'cloud-logout', {}, 'ghost')}</div>
    <p class="help mt8">${L('แก้ไขจากอุปกรณ์ไหนก็ได้ อุปกรณ์อื่นจะเห็นภายในประมาณ 30 วินาที หรือทันทีที่กลับมาที่แท็บ · ถ้าแก้รายการเดียวกันพร้อมกันสองเครื่อง ระบบเก็บการบันทึกครั้งล่าสุด', 'Edit from any device; others see it within ~30 s or when they return to the tab · if two devices edit the same record, the latest save wins')}</p>`, '', 'cloud-panel');
}
const CLOUD_ACTIONS = {
  'cloud-sync': async () => { await flushNow(); const ok = await cloudPush(); await cloudCheck(true); if (ok !== false) toast(L('ซิงก์แล้ว', 'Synced')); renderMain(); },
  'cloud-logout': () => cloudLogout()
};
