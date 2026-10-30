'use strict';
/* ============================================================
   EdgeDesk 3 — Offline Trading Journal
   CORE: utilities · i18n · time · state · storage · migration
   ============================================================ */
const APP_NAME = 'EdgeDesk', APP_VERSION = '3.61.0', SCHEMA_VERSION = 3;
const DB_NAME = 'edgedesk-v3', UI_KEY = 'edgedesk-v3-ui', EPS = 1e-8;

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const uid = p => p + '_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 20) : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const now = () => new Date().toISOString();
const num = v => v === '' || v == null ? null : (Number.isFinite(Number(String(v).replace(/,/g, ''))) ? Number(String(v).replace(/,/g, '')) : null);
const finite = v => typeof v === 'number' && Number.isFinite(v);
const sum = a => { let s = 0; for (let i = 0; i < a.length; i++) { const x = a[i]; if (typeof x === 'number' && x - x === 0) s += x; } return s; };
const mean = a => { let s = 0, n = 0; for (let i = 0; i < a.length; i++) { const x = a[i]; if (typeof x === 'number' && x - x === 0) { s += x; n++; } } return n ? s / n : null; };
const median = a => { const f = a.filter(finite).sort((x, y) => x - y); if (!f.length) return null; const m = f.length >> 1; return f.length % 2 ? f[m] : (f[m - 1] + f[m]) / 2; };
const sd = a => { const f = a.filter(finite); if (f.length < 2) return null; const m = mean(f); return Math.sqrt(sum(f.map(x => (x - m) ** 2)) / (f.length - 1)); };
const ratio = (a, b) => !finite(a) ? null : b ? a / b : a > 0 ? Infinity : null;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const quantile = (sorted, q) => { if (!sorted.length) return null; const p = (sorted.length - 1) * q, b = Math.floor(p), r = p - b; return sorted[b + 1] !== undefined ? sorted[b] + r * (sorted[b + 1] - sorted[b]) : sorted[b]; };
const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const cmpStr = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const tone = v => !finite(v) ? 'muted' : v > EPS ? 'pos' : v < -EPS ? 'neg' : 'muted';

/* ---------- i18n: Thai first, English optional ---------- */
let LANG = 'th';
const L = (th, en) => LANG === 'en' ? (en ?? th) : th;

/* ---------- state ---------- */
let state = null, db = null, storageType = L('หน่วยความจำ', 'Memory'), saveQueue = Promise.resolve(), initProblem = '', recoveryRaw = null;
let calcCache = new WeakMap();
const memo = new Map();
function memoize(key, fn) { if (memo.has(key)) return memo.get(key); const v = fn(); memo.set(key, v); return v; }
let dayCache = new WeakMap();
function invalidate() { calcCache = new WeakMap(); dayCache = new WeakMap(); entryDayCache = new WeakMap(); memo.clear(); reindex(); }
/* the single rule that decides which calendar day a trade belongs to */
function tradeTime(t) { return (state?.settings?.dayBasis === 'entry' || t.status !== 'Closed' || !t.exitDateTime) ? t.entryDateTime : t.exitDateTime; }
let entryDayCache = new WeakMap();
function entryDay(t) { let d = entryDayCache.get(t); if (d === undefined) { d = dateKey(t.entryDateTime, tradeZone(t)); entryDayCache.set(t, d); } return d; }
function tradeDay(t) { let d = dayCache.get(t); if (d === undefined) { d = dateKey(tradeTime(t), tradeZone(t)); dayCache.set(t, d); } return d; }
const imageCache = new Map();
let ui = {
  route: 'dashboard', account: '', unit: 'P&L', preset: 'all', from: '', to: '', filters: {}, search: '',
  sortKey: 'entryDateTime', sortDir: 'desc', page: 1, pageSize: 50, selected: new Set(), columns: null,
  month: new Date().getMonth(), year: new Date().getFullYear(), dimension: 'playbook', breakdownMetric: 'expectancy', bdHideSmall: true, crossHideSmall: false,
  compareA: { side: 'Buy' }, compareB: { side: 'Sell' }, compareDim: 'playbook',
  mc: { runs: 500, trades: 100, riskPct: 1, basis: 'R', ruin: 30 }, whatIf: {}, notebookFolder: '', notebookId: '',
  playbookView: 'cards', planView: 'cards', tradeQuick: 'all', journalDate: '', tradeView: 'table', sidebarCollapsed: false
};
const defaultCols = ['entryDateTime', 'instrumentId', 'side', 'playbookId', 'timeframe', 'quantity', 'entryPrice', 'exitPrice', 'net', 'r', 'duration', 'tags'];

/* ---------- time helpers (timezone aware) ---------- */
const fmtCache = new Map(), partCache = new Map();
function tz() { return state?.settings?.timezone || 'Asia/Bangkok'; }
/* ---------- broker server time (v3.33) ----------
   'NY+7' = New York time + 7 h: UTC+2 in winter, UTC+3 when the US is on
   daylight time — the usual MT4/MT5 server clock (the daily candle closes
   at 17:00 New York). Other values are IANA zones (incl. Etc/GMT±N). */
const NY7 = 'NY+7';
const timeView = () => state?.settings?.timeView === 'broker' ? 'broker' : 'local';
const accZone = id => get('accounts', id)?.brokerTz || tz();
const viewZone = accountId => timeView() === 'broker' ? accZone(accountId) : tz();
const tradeZone = t => viewZone(t?.accountId);
/* the clock used to TYPE trade times: the account's broker clock (as shown in MT4/MT5) unless switched to local */
const inputZone = accountId => state?.settings?.inputClock === 'local' ? tz() : accZone(accountId);
function zoneOffsetMin(zone, at = Date.now()) { const p = dateParts(new Date(at).toISOString(), zone); if (!p) return 0; return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(at / 60000) * 60000) / 60000); }
function utcLabel(zone, at) { const m = zoneOffsetMin(zone, at), s = m < 0 ? '−' : '+', a = Math.abs(m); return `UTC${s}${Math.floor(a / 60)}${a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''}`; }
function zoneName(zone) {
  if (zone === NY7) return L('เวลาเซิร์ฟเวอร์ MT (NY+7)', 'MT server time (NY+7)');
  const m = /^Etc\/GMT([+-]\d+)$/.exec(zone || ''); if (m) return 'UTC' + (m[1][0] === '-' ? '+' : '−') + m[1].slice(1);
  return zone === 'UTC' ? 'UTC' : String(zone || '').replace(/_/g, ' ');
}
function brokerTzOptions(cur = '') {
  const fixed = []; for (let h = -12; h <= 14; h++) if (h) fixed.push([`Etc/GMT${h > 0 ? '-' : '+'}${Math.abs(h)}`, `UTC${h > 0 ? '+' : '−'}${Math.abs(h)} ${L('(คงที่)', '(fixed)')}`]);
  const named = [['Europe/London', L('ลอนดอน (UTC+0/+1)', 'London (UTC+0/+1)')], ['Europe/Athens', L('ยุโรปตะวันออก EET (UTC+2/+3 ตามยุโรป)', 'Eastern Europe EET (UTC+2/+3, EU DST)')], ['America/New_York', L('นิวยอร์ก (UTC−5/−4)', 'New York (UTC−5/−4)')], ['Asia/Bangkok', L('กรุงเทพ (UTC+7)', 'Bangkok (UTC+7)')], ['Asia/Tokyo', L('โตเกียว (UTC+9)', 'Tokyo (UTC+9)')], ['Australia/Sydney', L('ซิดนีย์ (UTC+10/+11)', 'Sydney (UTC+10/+11)')]];
  const all = [['', L('ไม่ระบุ — ใช้เขตเวลาของแอป', 'Not set — use the app timezone')], [NY7, L('UTC+2/+3 ตามเวลาออมแสงสหรัฐ — มาตรฐาน MT4/MT5', 'UTC+2/+3 with US DST — standard MT4/MT5')], ['UTC', 'UTC+0 (GMT)'], ...named, ...fixed];
  if (cur && !all.some(o => o[0] === cur)) all.splice(1, 0, [cur, zoneName(cur)]);
  return all.map(([v, l]) => opt(v, l + (v ? ` · ${L('ตอนนี้', 'now')} ${utcLabel(v)}` : ''), cur)).join('');
}
function dateParts(v, zone = tz()) {
  if (!v) return null; const d = new Date(v); if (!Number.isFinite(+d)) return null;
  if (zone === NY7) return dateParts(new Date(+d + 7 * 3600000).toISOString(), 'America/New_York');
  const key = zone + '|' + v; if (partCache.has(key)) return partCache.get(key);
  let f = fmtCache.get(zone);
  if (!f) { try { f = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' }); } catch { f = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' }); } fmtCache.set(zone, f); }
  const r = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  if (partCache.size > 150000) partCache.clear(); partCache.set(key, r); return r;
}
function dateKey(v, zone) { const p = dateParts(v, zone); return p ? `${p.year}-${p.month}-${p.day}` : ''; }
function localInput(v, zone) { const p = dateParts(v, zone); return p ? `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` : ''; }
function toISO(v, zone = tz()) {
  if (!v) return '';
  if (zone === NY7) { const r = toISO(v, 'America/New_York'); return r && !/Z$|[+-]\d\d:\d\d$/.test(v) ? new Date(+new Date(r) - 7 * 3600000).toISOString() : r; }
  if (/Z$|[+-]\d\d:\d\d$/.test(v)) { const n = new Date(v); return Number.isFinite(+n) ? n.toISOString() : ''; }
  const m = String(v).trim().replace(/\./g, '-').replace(' ', 'T').match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return '';
  const [, y, mo, d, h = '0', mi = '0', se = '0'] = m, desired = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  let guess = desired;
  for (let i = 0; i < 4; i++) { const p = dateParts(new Date(guess).toISOString(), zone); if (!p) return ''; const actual = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second); const diff = desired - actual; guess += diff; if (!diff) break; }
  return new Date(guess).toISOString();
}
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TH_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'], EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TH_DAYS_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const monthName = (m, full = false) => LANG === 'en' ? (full ? EN_MONTHS_FULL : EN_MONTHS)[m] : (full ? TH_MONTHS_FULL : TH_MONTHS)[m];
const dayName = (d, full = false) => LANG === 'en' ? EN_DAYS[d] : (full ? TH_DAYS_FULL : TH_DAYS)[d];
function fmtDate(v, opts = {}) {
  if (!v) return '—';
  const key = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : dateKey(v, opts.zone); if (!key) return '—';
  const [y, m, d] = key.split('-').map(Number);
  const base = `${d} ${monthName(m - 1)}${opts.year === false ? '' : ' ' + (opts.short ? String(y).slice(2) : y)}`;
  if (opts.time && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) { const p = dateParts(v, opts.zone); return base + ' · ' + p.hour + ':' + p.minute; }
  return base;
}
function fmtTime(v, zone) { const p = dateParts(v, zone); return p ? p.hour + ':' + p.minute : '—'; }
/* "today" follows the display clock: in Broker view it is the broker's trading day */
function todayKey() { return dateKey(now(), timeView() === 'broker' ? accZone(ui?.account || state?.settings?.defaultAccount || state?.accounts?.[0]?.id) : undefined); }
function shiftKey(key, { days = 0, months = 0, years = 0 } = {}) { const d = new Date(key + 'T12:00:00Z'); if (years) d.setUTCFullYear(d.getUTCFullYear() + years); if (months) d.setUTCMonth(d.getUTCMonth() + months); if (days) d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function weekdayOfKey(key) { return new Date(key + 'T12:00:00Z').getUTCDay(); }
function weekStartKey(key) { const wd = weekdayOfKey(key), ws = state?.settings?.weekStart ?? 1; return shiftKey(key, { days: -((wd - ws + 7) % 7) }); }
function duration(min) { if (!finite(min)) return '—'; const m = Math.max(0, Math.round(min)); if (m >= 1440) return `${Math.floor(m / 1440)}${L('ว', 'd')} ${Math.floor(m % 1440 / 60)}${L('ชม', 'h')}`; if (m >= 60) return `${Math.floor(m / 60)}${L('ชม', 'h')} ${m % 60}${L('น', 'm')}`; return m + L(' นาที', 'm'); }

/* ---------- number formatting ---------- */
function fmt(v, d = 2, signed = false) {
  if (v === Infinity) return '∞'; if (v === -Infinity) return '−∞'; if (!finite(v)) return '—';
  if (Math.abs(v) < EPS || Number(v.toFixed(d)) === 0) v = 0;
  return (signed && v > 0 ? '+' : '') + v.toLocaleString(state?.settings?.numberLocale || 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function compact(v) { if (!finite(v)) return '—'; const a = Math.abs(v); if (a >= 1e9) return fmt(v / 1e9, 1) + 'B'; if (a >= 1e6) return fmt(v / 1e6, 1) + 'M'; if (a >= 1e4) return fmt(v / 1e3, 1) + 'K'; return fmt(v, a < 10 ? 2 : 0); }
function currencySymbol(c) { if (!c) return '$'; if (isCent(String(c).toUpperCase())) return String(c).toUpperCase() + ' '; try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(c).toUpperCase(), currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(x => x.type === 'currency')?.value || c + ' '; } catch { return c + ' '; } }
function money(v, cur = '', signed = false) {
  if (!finite(v)) return '—';
  const s = Math.abs(v) < EPS || Number(Math.abs(v).toFixed(state?.settings?.currencyDecimals ?? 2)) === 0 ? '' : v < 0 ? '−' : signed ? '+' : '';
  const c = String(cur || baseCurrency()).toUpperCase(), n = fmt(Math.abs(v), state?.settings?.currencyDecimals ?? 2);
  return isCent(c) ? `${s}${n} ${c}` : s + currencySymbol(c) + n; // cent: "1,234.50 USC"
}
function unitFmt(v, u = ui.unit, signed = true, cur = '') {
  if (!finite(v)) return '—';
  if (u === 'P&L') return money(v, cur, signed);
  if (u === 'R') return fmt(v, 2, signed) + 'R';
  if (u === '%') return fmt(v, 2, signed) + '%';
  if (u === 'Pips') return fmt(v, 1, signed) + L(' ปิ๊บ', ' pips');
  if (u === 'Points') return fmt(v, 1, signed) + ' pts';
  return fmt(v, 2, signed);
}
function baseCurrency() { const acc = currentAccounts(); const set = [...new Set(acc.map(a => a.currency))]; if (set.length > 1 && new Set(set.map(centParent)).size === 1) return centParent(set[0]); return set.length === 1 ? set[0] : (state?.accounts?.[0]?.currency || 'USD'); }

/* ---------- storage ---------- */
function idbOpen(name, stores) {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => stores.forEach(s => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); });
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); r.onblocked = () => reject(Error('blocked'));
  });
}
function idbGet(store, key) { return new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function idbPut(store, key, val) { return new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(val, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); }
function idbDel(store, key) { return new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
function idbAll(store) { return new Promise((res, rej) => { const out = {}; const r = db.transaction(store).objectStore(store).openCursor(); r.onsuccess = () => { const c = r.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); }; r.onerror = () => rej(r.error); }); }

async function loadState() {
  if (CLOUD) return cloudLoadState();
  try {
    db = await idbOpen(DB_NAME, ['data', 'images']);
    storageType = 'IndexedDB';
    const stored = await idbGet('data', 'state'); localRev = (await readRev())?.n || 0;
    let fallback = null; try { fallback = JSON.parse(localStorage.getItem(DB_NAME) || 'null'); } catch { }
    const stamp = x => Date.parse(x?.meta?.updatedAt || '') || 0;
    const latest = stored && fallback ? (stamp(stored) >= stamp(fallback) ? stored : fallback) : stored || fallback;
    if (latest) { try { return migrate(latest); } catch (e) { recoveryRaw = latest; initProblem = e.message; return seed(); } }
    return seed();
  } catch (e) {
    try { const raw = localStorage.getItem(DB_NAME); storageType = 'localStorage'; if (raw) return migrate(JSON.parse(raw)); } catch { storageType = L('หน่วยความจำ', 'Memory'); }
    return seed();
  }
}
/* Saving: changes are coalesced into one write; each write bumps a revision
   stored next to the data, so a second tab can never silently overwrite newer data. */
const TAB_ID = uid('tab'); let localRev = 0, saveTimer = null, savePending = null, dirty = false, conflictOpen = false, bc = null;
function persist() {
  dirty = true; savePrefs(); setSaveLabel(L('กำลังบันทึก…', 'Saving…'));
  if (!savePending) savePending = new Promise(res => { saveTimer = setTimeout(async () => { saveTimer = null; const r = await flushSave(); savePending = null; res(r); }, 150); });
  return savePending;
}
async function flushNow() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; const r = await flushSave(); savePending = null; return r; } return true; }
function flushSave(force = false) {
  if (!dirty) return Promise.resolve(true); dirty = false; state.meta.updatedAt = now();
  saveQueue = saveQueue.catch(() => { }).then(() => new Promise(resolve => {
    const ok = () => { setSaveLabel(L('บันทึกแล้ว · ', 'Saved · ') + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); resolve(true); if (CLOUD) cloudPush(); };
    const fallback = () => { try { localStorage.setItem(DB_NAME, JSON.stringify(state)); storageType = 'localStorage'; ok(); } catch { setSaveLabel(L('ยังไม่ได้บันทึก — โปรดสำรองข้อมูล', 'Not saved — export a backup'), true); resolve(false); } };
    if (!db) return fallback();
    try {
      const tx = db.transaction('data', 'readwrite'), st = tx.objectStore('data'); let next = null, blocked = null;
      const g = st.get('rev');
      g.onsuccess = () => { const rev = g.result; if (!force && rev && rev.n > localRev && rev.tab !== TAB_ID) { blocked = rev; tx.abort(); return; } next = { n: Math.max(rev?.n || 0, localRev) + 1, tab: TAB_ID, at: now() }; st.put(state, 'state'); st.put(next, 'rev'); };
      tx.oncomplete = () => { localRev = next.n; storageType = 'IndexedDB'; try { localStorage.removeItem(DB_NAME); } catch { } try { bc?.postMessage({ type: 'saved', n: localRev, tab: TAB_ID }); } catch { } ok(); };
      tx.onabort = tx.onerror = () => { if (blocked) { dirty = true; onSaveConflict(blocked); resolve(false); } else fallback(); };
    } catch { fallback(); }
  }));
  return saveQueue;
}
async function readRev() { try { return db ? await idbGet('data', 'rev') : null; } catch { return null; } }
async function reloadFromDB(msg) {
  const stored = await idbGet('data', 'state'), rev = await readRev(); if (!stored) return;
  state = migrate(stored); localRev = rev?.n || 0; dirty = false; invalidate(); LANG = state.settings.language || 'th'; closeModal(true); render(); if (msg) toast(msg);
}
function onSaveConflict(rev) {
  if (conflictOpen) return; conflictOpen = true;
  openModal({ title: icon('alert') + L(' ข้อมูลถูกแก้ไขจากแท็บอื่น', ' Changed in another tab'), size: 'sm', dismiss: false, onClose: () => { conflictOpen = false; }, body: `<p class="muted">${L(`มีอีกแท็บหรือหน้าต่างบันทึกข้อมูลที่ใหม่กว่า (เวลา ${fmtTime(rev.at)}) — เพื่อป้องกันข้อมูลหาย ระบบจึงยังไม่บันทึกการแก้ไขล่าสุดของแท็บนี้`, `Another tab saved newer data at ${fmtTime(rev.at)}. To avoid losing it, this tab's latest change was not saved.`)}</p><div class="notice info">${icon('info')}<span>${L('แนะนำให้โหลดข้อมูลล่าสุด แล้วทำรายการเดิมอีกครั้ง และเปิดแอปเพียงแท็บเดียว', 'Load the latest data and redo your change. Keep the app open in one tab.')}</span></div>`, foot: `${btn(L('บันทึกทับด้วยข้อมูลแท็บนี้', 'Overwrite with this tab'), 'conflict-overwrite', {}, 'ghost danger')}${btn(icon('refresh') + L(' โหลดข้อมูลล่าสุด', ' Load latest'), 'conflict-reload', {}, 'primary')}` });
}
function setupSync() {
  try { bc = new BroadcastChannel(DB_NAME); bc.onmessage = e => { const m = e.data || {}; if (m.type !== 'saved' || m.tab === TAB_ID || m.n <= localRev) return; if (!dirty && !modalStack.length && !editor) reloadFromDB(L('อัปเดตข้อมูลจากแท็บอื่นแล้ว', 'Updated from another tab')); else toast(L('มีการแก้ไขจากแท็บอื่น — บันทึกของคุณจะถูกตรวจสอบก่อนเขียน', 'Another tab changed data — your next save will be checked')); }; } catch { }
  const flushIfHidden = () => { if (document.visibilityState === 'hidden') flushNow(); };
  document.addEventListener('visibilitychange', flushIfHidden); window.addEventListener('pagehide', () => flushNow());
}
function setSaveLabel(t, bad = false) { const el = $('#save-state'); if (el) { el.textContent = t; el.classList.toggle('neg', bad); } }
function savePrefs() {
  try { localStorage.setItem(UI_KEY, JSON.stringify({ account: ui.account, unit: ui.unit, preset: ui.preset, from: ui.from, to: ui.to, pageSize: ui.pageSize, columns: ui.columns, sortKey: ui.sortKey, sortDir: ui.sortDir, dimension: ui.dimension, breakdownMetric: ui.breakdownMetric, chartUnits: ui.chartUnits, insTab: ui.insTab, insTagCat: ui.insTagCat, crossX: ui.crossX, crossY: ui.crossY, crossMetric: ui.crossMetric, crossHideSmall: ui.crossHideSmall, bdHideSmall: ui.bdHideSmall, playbookView: ui.playbookView, planView: ui.planView, notebookFolder: ui.notebookFolder, notebookId: ui.notebookId, mc: ui.mc, sidebarCollapsed: ui.sidebarCollapsed, hideTopStats: !!ui.hideTopStats })); } catch { }
}
function loadPrefs() {
  try { Object.assign(ui, JSON.parse(localStorage.getItem(UI_KEY) || '{}')); } catch { }
  if (!['P&L', 'R', '%', 'Pips', 'Points'].includes(ui.unit)) ui.unit = 'P&L';
  if (!['expectancy', 'total', 'wr', 'n'].includes(ui.breakdownMetric)) ui.breakdownMetric = 'expectancy';
  if (typeof ui.bdHideSmall !== 'boolean') ui.bdHideSmall = true;
  if (!Array.isArray(ui.columns) || !ui.columns.length) ui.columns = defaultCols.slice();
  if (ui.account && !state.accounts.some(a => a.id === ui.account)) ui.account = '';
  ui.selected = new Set(); ui.filters = ui.filters || {};
  ui.mc = { runs: 500, trades: 100, riskPct: 1, basis: 'R', ruin: 30, ...(ui.mc || {}) };
  if (ui.preset && ui.preset !== 'custom') { const [f, t] = presetRange(ui.preset); ui.from = f; ui.to = t; }
}

/* images (screenshots) live in their own store so the journal stays fast */
async function saveImage(dataUrl, meta = {}) {
  const id = uid('img'), rec = { id, data: dataUrl, ...meta, createdAt: now() };
  imageCache.set(id, rec);
  try { if (db) await idbPut('images', id, rec); else throw 0; } catch { if (!CLOUD) (state.inlineImages ??= {})[id] = rec; }
  if (CLOUD) cloudImgPut(rec);
  return id;
}
async function getImage(id) {
  if (imageCache.has(id)) return imageCache.get(id);
  let rec = null; try { if (db) rec = await idbGet('images', id); } catch { }
  rec ||= state.inlineImages?.[id] || null; if (!rec && CLOUD) rec = await cloudImgGet(id); if (rec) imageCache.set(id, rec); return rec;
}
async function deleteImage(id) { imageCache.delete(id); if (CLOUD) cloudImgDel(id); try { if (db) await idbDel('images', id); } catch { } if (state.inlineImages) delete state.inlineImages[id]; }
async function allImages() { let out = {}; try { if (db) out = await idbAll('images'); } catch { } out = { ...(state.inlineImages || {}), ...out }; return CLOUD ? cloudImgPullAll(out) : out; }
function compressImage(file, maxW = 1800, q = .86) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, maxW / img.width), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); resolve({ data: c.toDataURL('image/jpeg', q), w: c.width, h: c.height }); }; img.onerror = reject; img.src = fr.result; };
    fr.onerror = reject; fr.readAsDataURL(file);
  });
}


/* ---------- defaults ---------- */
const CURRENCY_NAMES = { AUD: 'Australian Dollar', CAD: 'Canadian Dollar', CHF: 'Swiss Franc', EUR: 'Euro', GBP: 'British Pound', HKD: 'Hong Kong Dollar', JPY: 'Japanese Yen', NZD: 'New Zealand Dollar', USD: 'US Dollar', THB: 'Thai Baht', SGD: 'Singapore Dollar', CNY: 'Chinese Yuan' };
/* currencies offered in pickers: [code, Thai, English, group] */
const CURRENCIES = [
  ['USD', 'ดอลลาร์สหรัฐ', 'US Dollar', 'major'], ['EUR', 'ยูโร', 'Euro', 'major'], ['GBP', 'ปอนด์สเตอร์ลิง', 'British Pound', 'major'], ['JPY', 'เยนญี่ปุ่น', 'Japanese Yen', 'major'], ['AUD', 'ดอลลาร์ออสเตรเลีย', 'Australian Dollar', 'major'], ['NZD', 'ดอลลาร์นิวซีแลนด์', 'New Zealand Dollar', 'major'], ['CAD', 'ดอลลาร์แคนาดา', 'Canadian Dollar', 'major'], ['CHF', 'ฟรังก์สวิส', 'Swiss Franc', 'major'],
  ['THB', 'บาท', 'Thai Baht', 'asia'], ['USC', 'เซ็นต์สหรัฐ (บัญชีเซ็นต์)', 'US Cent (cent account)', 'asia'], ['SGD', 'ดอลลาร์สิงคโปร์', 'Singapore Dollar', 'asia'], ['HKD', 'ดอลลาร์ฮ่องกง', 'Hong Kong Dollar', 'asia'], ['CNY', 'หยวนจีน', 'Chinese Yuan', 'asia'], ['CNH', 'หยวนจีน (ต่างประเทศ)', 'Chinese Yuan (offshore)', 'asia'], ['MYR', 'ริงกิตมาเลเซีย', 'Malaysian Ringgit', 'asia'], ['IDR', 'รูเปียห์อินโดนีเซีย', 'Indonesian Rupiah', 'asia'], ['PHP', 'เปโซฟิลิปปินส์', 'Philippine Peso', 'asia'], ['VND', 'ดองเวียดนาม', 'Vietnamese Dong', 'asia'], ['INR', 'รูปีอินเดีย', 'Indian Rupee', 'asia'], ['KRW', 'วอนเกาหลีใต้', 'South Korean Won', 'asia'], ['TWD', 'ดอลลาร์ไต้หวัน', 'Taiwan Dollar', 'asia'],
  ['SEK', 'โครนาสวีเดน', 'Swedish Krona', 'other'], ['NOK', 'โครนนอร์เวย์', 'Norwegian Krone', 'other'], ['DKK', 'โครนเดนมาร์ก', 'Danish Krone', 'other'], ['PLN', 'ซลอตีโปแลนด์', 'Polish Zloty', 'other'], ['CZK', 'โครูนาเช็ก', 'Czech Koruna', 'other'], ['HUF', 'โฟรินต์ฮังการี', 'Hungarian Forint', 'other'], ['TRY', 'ลีราตุรกี', 'Turkish Lira', 'other'], ['ZAR', 'แรนด์แอฟริกาใต้', 'South African Rand', 'other'], ['MXN', 'เปโซเม็กซิโก', 'Mexican Peso', 'other'], ['BRL', 'เรียลบราซิล', 'Brazilian Real', 'other'], ['AED', 'ดีแรห์มยูเออี', 'UAE Dirham', 'other'], ['SAR', 'ริยาลซาอุดีอาระเบีย', 'Saudi Riyal', 'other'], ['ILS', 'เชเกลอิสราเอล', 'Israeli Shekel', 'other'], ['RUB', 'รูเบิลรัสเซีย', 'Russian Ruble', 'other'],
  ['BTC', 'บิตคอยน์', 'Bitcoin', 'crypto'], ['ETH', 'อีเธอเรียม', 'Ethereum', 'crypto'], ['SOL', 'โซลานา', 'Solana', 'crypto'], ['XRP', 'XRP', 'XRP', 'crypto'], ['BNB', 'BNB', 'BNB', 'crypto'], ['ADA', 'คาร์ดาโน', 'Cardano', 'crypto'], ['DOGE', 'โดจคอยน์', 'Dogecoin', 'crypto'], ['LTC', 'ไลท์คอยน์', 'Litecoin', 'crypto'], ['USDT', 'เทเธอร์', 'Tether', 'crypto'], ['USDC', 'USD Coin', 'USD Coin', 'crypto'],
  ['XAU', 'ทองคำ', 'Gold', 'metal'], ['XAG', 'เงิน (โลหะ)', 'Silver', 'metal'], ['XPT', 'แพลทินัม', 'Platinum', 'metal'], ['XPD', 'แพลเลเดียม', 'Palladium', 'metal']];
const curName = code => { const c = CURRENCIES.find(x => x[0] === code); return c ? L(c[1], c[2]) : code; };
/* Thai display names for the built-in catalogue (shown only while the name is still the generated English one) */
const INSTRUMENT_NAMES_TH = { XAUUSD: 'ทองคำ / ดอลลาร์สหรัฐ', XAGUSD: 'เงิน / ดอลลาร์สหรัฐ', USOIL: 'น้ำมันดิบ WTI', UKOIL: 'น้ำมันดิบเบรนท์', BTCUSD: 'บิตคอยน์ / ดอลลาร์สหรัฐ', ETHUSD: 'อีเธอเรียม / ดอลลาร์สหรัฐ', SOLUSD: 'โซลานา / ดอลลาร์สหรัฐ', XRPUSD: 'XRP / ดอลลาร์สหรัฐ', AU200: 'ดัชนีออสเตรเลีย 200', DE40: 'ดัชนีเยอรมนี 40', DE50: 'ดัชนีเยอรมนี 50', EU50: 'ดัชนียูโรสต็อกซ์ 50', FR40: 'ดัชนีฝรั่งเศส 40', IT40: 'ดัชนีอิตาลี 40', JP225: 'ดัชนีญี่ปุ่น 225', HK50: 'ดัชนีฮ่องกง 50', UK100: 'ดัชนีอังกฤษ 100', US30: 'ดัชนีสหรัฐ 30 (ดาวโจนส์)', US500: 'ดัชนีสหรัฐ 500 (S&P 500)', US2000: 'ดัชนีสหรัฐ 2000 (รัสเซลล์)', USTECH: 'ดัชนีเทคโนโลยีสหรัฐ 100 (แนสแด็ก)' };
function insName(i) {
  if (!i) return ''; const n = i.name || '';
  if (LANG !== 'th' || n !== instrumentName(i.symbol, i.assetClass, i.baseCurrency, i.quoteCurrency)) return n;
  if (INSTRUMENT_NAMES_TH[i.symbol]) return INSTRUMENT_NAMES_TH[i.symbol];
  const th = c => CURRENCIES.find(x => x[0] === c)?.[1];
  return i.assetClass === 'Forex' && th(i.baseCurrency) && th(i.quoteCurrency) ? `${th(i.baseCurrency)} / ${th(i.quoteCurrency)}` : n;
}
const INSTRUMENT_NAMES = { XAUUSD: 'Gold vs US Dollar', XAGUSD: 'Silver vs US Dollar', USOIL: 'WTI Crude Oil', UKOIL: 'Brent Crude Oil', BTCUSD: 'Bitcoin vs US Dollar', ETHUSD: 'Ethereum vs US Dollar', SOLUSD: 'Solana vs US Dollar', XRPUSD: 'XRP vs US Dollar', AU200: 'Australia 200', DE40: 'Germany 40', DE50: 'Germany 50', EU50: 'Euro Stoxx 50', FR40: 'France 40', IT40: 'Italy 40', JP225: 'Japan 225', HK50: 'Hong Kong 50', UK100: 'UK 100', US30: 'US 30', US500: 'US 500', US2000: 'US 2000', USTECH: 'US Tech 100', AMD: 'Advanced Micro Devices', AMZN: 'Amazon', APPL: 'Apple', NDVA: 'NVIDIA', GOOGL: 'Alphabet Class A', MSFT: 'Microsoft', META: 'Meta Platforms', TSLA: 'Tesla', BABA: 'Alibaba' };
const TIMEFRAMES = ['M1', 'M3', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'];
const normTF = v => { const s = String(v || '').trim().toUpperCase().replace(/^(\d+)M$/, 'M$1').replace(/^(\d+)MIN$/, 'M$1').replace(/^(\d+)H$/, 'H$1').replace(/^1D$|^D$|^DAILY$/, 'D1').replace(/^1W$|^W$|^WEEKLY$/, 'W1').replace(/^1MN$|^MONTHLY$/, 'MN'); return TIMEFRAMES.includes(s) ? s : ''; };
const ASSET_CLASSES = ['Forex', 'Metals', 'Energies', 'Cryptocurrencies', 'Indices', 'Stocks', 'Futures', 'Other'];
const ASSET_TH = { Forex: 'ฟอเร็กซ์', Metals: 'โลหะ', Energies: 'พลังงาน', Cryptocurrencies: 'คริปโต', Indices: 'ดัชนี', Stocks: 'หุ้น', Futures: 'ฟิวเจอร์ส', Other: 'อื่น ๆ' };
/* [key, Thai label, emoji] — v3.15: emoji set; legacy keys (Focused / Revenge / Tired) still display on old trades */
const EMOTIONS = [['Calm', 'สงบ', '🙂'], ['Confident', 'มั่นใจ', '😀'], ['Neutral', 'ปกติ', '😐'], ['Hesitant', 'ลังเล', '🙄'], ['Fear', 'กลัว', '😰'], ['FOMO', 'FOMO', '😡'], ['Bored', 'เบื่อ', '🥱'], ['Greed', 'โลภ', '🤑']];
const EMOTIONS_LEGACY = [['Focused', 'มีสมาธิ', '🎯'], ['Revenge', 'เอาคืน', '😤'], ['Tired', 'เหนื่อย', '😪']];
const emoRow = e => EMOTIONS.find(r => r[0] === e) || EMOTIONS_LEGACY.find(r => r[0] === e);
const emoji = e => `<span class="emoji" aria-hidden="true">${emoRow(e)?.[2] || ''}</span>`;
const emotionLabel = e => { const x = emoRow(e); return x ? L(x[1], x[0]) : (e || '—'); };
const emotionHTML = e => { const x = emoRow(e); return x ? `<span class="emo-tag">${emoji(e)}${esc(L(x[1], x[0]))}</span>` : (e ? esc(e) : '—'); };
const MOODS = ['angry', 'frown', 'meh', 'smile', 'laugh'];
const MOOD_EMOJI = ['😡', '😟', '😐', '🙂', '😄'];
const MOOD_LABELS = () => [L('แย่มาก', 'Awful'), L('แย่', 'Bad'), L('ปกติ', 'Okay'), L('ดี', 'Good'), L('ดีมาก', 'Great')];
function instrumentName(symbol, assetClass = '', base = '', quote = '') {
  symbol = String(symbol || '').toUpperCase(); base = String(base || symbol.slice(0, 3)).toUpperCase(); quote = String(quote || symbol.slice(3, 6)).toUpperCase();
  if (assetClass === 'Forex' || (!assetClass && symbol.length === 6 && base !== quote && CURRENCY_NAMES[base] && CURRENCY_NAMES[quote])) return `${CURRENCY_NAMES[base] || base} vs ${CURRENCY_NAMES[quote] || quote}`;
  return INSTRUMENT_NAMES[symbol] || symbol;
}
const INDEX_CONTRACT = 1; // v3.49: back to the broker spec — 1 lot = 1 per index point (v3.45–3.48 used 100 by mistake)
/* MT5 Specification › Calculation */
const CALC_MODES = ['Forex', 'Forex No Leverage', 'Contracts', 'Contracts Leverage', 'Futures'];
const CALC_MODE_INFO = () => ({
  'Forex': L('กำไร = ส่วนต่างราคา × ขนาดสัญญา × ล็อต · มาร์จิ้น = ล็อต × ขนาดสัญญา ÷ เลเวอเรจ × Margin rate (สกุลเงินฐาน)', 'Profit = price change × contract size × lots · Margin = lots × contract size ÷ leverage × margin rate (base currency)'),
  'Forex No Leverage': L('กำไร = ส่วนต่างราคา × ขนาดสัญญา × ล็อต · มาร์จิ้น = ล็อต × ขนาดสัญญา × Margin rate (ไม่ใช้เลเวอเรจ)', 'Profit = price change × contract size × lots · Margin = lots × contract size × margin rate (no leverage)'),
  'Contracts': L('กำไร = ส่วนต่างราคา × ขนาดสัญญา × ล็อต · มาร์จิ้น = ล็อต × ขนาดสัญญา × ราคา × Margin rate (ไม่ใช้เลเวอเรจ)', 'Profit = price change × contract size × lots · Margin = lots × contract size × price × margin rate (no leverage)'),
  'Contracts Leverage': L('กำไร = ส่วนต่างราคา × ขนาดสัญญา × ล็อต · มาร์จิ้น = ล็อต × ขนาดสัญญา × ราคา ÷ เลเวอเรจ × Margin rate', 'Profit = price change × contract size × lots · Margin = lots × contract size × price ÷ leverage × margin rate'),
  'Futures': L('กำไร = ส่วนต่างราคา × มูลค่าติ๊ก ÷ ขนาดติ๊ก × ล็อต · มาร์จิ้น = ล็อต × Initial margin × Margin rate', 'Profit = price change × tick value ÷ tick size × lots · Margin = lots × initial margin × margin rate'),
});
function defaultCalcMode(assetClass, symbol = '') {
  if (assetClass === 'Forex') return 'Forex';
  if (assetClass === 'Cryptocurrencies') return 'Forex No Leverage';
  if (assetClass === 'Metals' && /^XAU/i.test(symbol)) return 'Contracts Leverage';
  if (assetClass === 'Futures') return 'Futures';
  return 'Contracts';
}
const defaultMarginRate = mode => mode === 'Forex' || mode === 'Contracts Leverage' ? 1 : null;
function instrumentDefaults() {
  const rows = [];
  'AUDUSD EURUSD GBPUSD NZDUSD USDCAD USDCHF USDJPY AUDCAD AUDCHF AUDJPY AUDNZD CADCHF CADJPY CHFJPY EURAUD EURCAD EURCHF EURGBP EURJPY EURNZD GBPAUD GBPCAD GBPCHF GBPJPY GBPNZD NZDCAD NZDCHF NZDJPY'.split(' ').forEach(s => rows.push({ symbol: s, assetClass: 'Forex', decimals: s.endsWith('JPY') ? 3 : 5, contractSize: 100000, baseCurrency: s.slice(0, 3), quoteCurrency: s.slice(3), minQuantity: .01, maxQuantity: 100, quantityStep: .01, pipSize: s.endsWith('JPY') ? .01 : .0001 }));
  const add = (symbol, assetClass, decimals, contractSize, baseCurrency, quoteCurrency, minQuantity, maxQuantity, quantityStep, pipSize) => rows.push({ symbol, assetClass, decimals, contractSize, baseCurrency, quoteCurrency, minQuantity, maxQuantity, quantityStep, pipSize });
  add('XAUUSD', 'Metals', 2, 100, 'XAU', 'USD', .01, 100, .01, .1); add('XAGUSD', 'Metals', 3, 5000, 'XAG', 'USD', .01, 100, .01, .01);
  add('USOIL', 'Energies', 3, 1000, 'USD', 'USD', .01, 20, .01, .01); add('UKOIL', 'Energies', 3, 1000, 'USD', 'USD', .01, 20, .01, .01);
  [['BTCUSD', 2, 1, 'BTC'], ['ETHUSD', 2, 1, 'ETH'], ['SOLUSD', 2, 10, 'SOL'], ['XRPUSD', 4, 10000, 'XRP']].forEach(([s, d, c, b]) => add(s, 'Cryptocurrencies', d, c, b, 'USD', .01, 100, .01, 10 ** -d));
  [['AU200', 'AUD'], ['DE40', 'EUR'], ['EU50', 'EUR'], ['FR40', 'EUR'], ['JP225', 'JPY'], ['HK50', 'HKD'], ['UK100', 'GBP'], ['US30', 'USD'], ['US500', 'USD'], ['US2000', 'USD'], ['USTECH', 'USD']].forEach(([s, c]) => add(s, 'Indices', 2, INDEX_CONTRACT, c, c, s === 'JP225' ? 1 : .1, s === 'JP225' ? 20000 : 500, s === 'JP225' ? 1 : .1, 1));
  ['AMD', 'AMZN', 'APPL', 'NDVA', 'GOOGL', 'MSFT', 'META', 'TSLA'].forEach(s => add(s, 'Stocks', 2, 1, 'USD', 'USD', .1, 1500, .1, .01));
  return rows.map(r => ({ ...r, calcMode: defaultCalcMode(r.assetClass, r.symbol), marginRate: defaultMarginRate(defaultCalcMode(r.assetClass, r.symbol)), id: 'ins_' + r.symbol, name: instrumentName(r.symbol, r.assetClass, r.baseCurrency, r.quoteCurrency), tickSize: 10 ** -r.decimals, tickValue: +(r.contractSize * 10 ** -r.decimals).toPrecision(12), pointSize: 10 ** -r.decimals, valueCurrency: r.quoteCurrency, multiplier: 1, iconMode: 'Auto', active: true, createdAt: now(), defaultCatalogVersion: 3 }));
}
function defaultSettings() {
  return { language: 'th', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok', theme: 'dark', accent: 'indigo', density: 'comfortable', numberLocale: 'en-US', currencyDecimals: 2, defaultAccount: '', defaultUnit: 'P&L', dayBasis: 'exit', preferredRisk: 1, riskWarning: 2, weekStart: 1, journalTemplate: 'tpl_journal', rules: { maxDailyLossPct: 3, maxTradesPerDay: 5, maxConsecLosses: 3, minRR: 1.5, requireStop: true } };
}
function seed() {
  const t = now();
  const s = { meta: { schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, createdAt: t, updatedAt: t, onboarded: false }, settings: defaultSettings(), accounts: [], transactions: [], instruments: instrumentDefaults(), tagCategories: [{ id: 'cat_mistakes', name: 'Mistakes', core: true, color: '#ff5d6c' }, { id: 'cat_context', name: 'Market Context', core: false, color: '#f2b33d' }], tags: [], playbooks: [], trades: [], notebookFolders: [{ id: 'nbf_general', name: 'ทั่วไป', createdAt: t }], notebooks: [], importProfiles: [], importBatches: [] };
  const mistakes = ['Early Entry', 'Late Entry', 'Early Exit', 'Moved Stop', 'Oversized', 'FOMO', 'Revenge Trade', 'Broke Rules'];
  const ctx = ['Trending', 'Ranging', 'High Volatility', 'News Day'];
  mistakes.forEach((n, i) => s.tags.push({ id: 'tag_m' + i, name: n, categoryId: 'cat_mistakes', active: true }));
  ctx.forEach((n, i) => s.tags.push({ id: 'tag_c' + i, name: n, categoryId: 'cat_context', active: true }));
  s.playbooks = []; addPaStrategies(s, t);
  s.noteTemplates = defaultNoteTemplates(); s.meta.smcCleanup = true; s.meta.v36 = true; s.meta.v331 = true;
  return s;
}

/* ---------- migration: v1/v2 (EdgeDesk 2.x) → v3 ---------- */
const COLLECTIONS = ['accounts', 'transactions', 'instruments', 'tagCategories', 'tags', 'playbooks', 'trades', 'notebookFolders', 'notebooks', 'noteTemplates', 'importProfiles', 'importBatches'];
function migrate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error(L('ไฟล์สำรองต้องเป็นออบเจ็กต์ JSON', 'Backup must contain an object.'));
  const looks = !!raw.settings && ['accounts', 'trades', 'instruments', 'tags', 'playbooks'].some(k => Array.isArray(raw[k]));
  if (!looks) throw Error(L('ไม่พบข้อมูลพื้นที่ทำงานที่รองรับในไฟล์นี้', 'This file does not contain a supported workspace.'));
  const d = clone(raw), from = Number(d.meta?.schemaVersion ?? d.schemaVersion ?? 2);
  d.meta ??= {}; d.settings = { ...defaultSettings(), ...(d.settings || {}) };
  d.settings.rules = { ...defaultSettings().rules, ...(raw.settings?.rules || {}) };
  const hadTpl = Array.isArray(raw.noteTemplates);
  for (const k of COLLECTIONS) if (!Array.isArray(d[k])) d[k] = [];
  const LEGACY = ['plans', 'journals', 'reviews']; for (const k of LEGACY) if (!Array.isArray(d[k])) d[k] = []; // only read by the migrations below (old v2 / pre-3.6 files)
  if (!hadTpl) d.noteTemplates = defaultNoteTemplates();
  if (!d.instruments.length) d.instruments = instrumentDefaults();
  for (const i of d.instruments) { i.maxQuantity ??= null; i.pointSize ??= i.tickSize; i.multiplier ??= 1; i.valueCurrency ??= i.quoteCurrency; i.active ??= true; i.name ||= instrumentName(i.symbol, i.assetClass, i.baseCurrency, i.quoteCurrency); }
  if (!d.tagCategories.length) d.tagCategories = seed().tagCategories;
  for (const c of d.tagCategories) c.color ??= c.id === 'cat_mistakes' ? '#ff5d6c' : c.id === 'cat_setups' ? '#6d7cff' : '#f2b33d';
  for (const a of d.accounts) { a.objective ??= { enabled: false, profitTargetPct: 10, maxDailyLossPct: 5, maxDrawdownPct: 10, ddMode: 'static', minTradingDays: 0 }; a.active ??= true; }
  for (const t of d.trades) { t.tags ??= []; t.images ??= []; t.status ??= t.exitDateTime ? 'Closed' : 'Open'; }
  for (const p of d.plans) { p.tags ??= []; p.images ??= []; }
  for (const pb of d.playbooks) { pb.ruleGroups ??= []; pb.notes ??= []; pb.relevantTagIds ??= []; pb.color ??= '#6d7cff'; pb.status = pb.status === 'Inactive' ? 'Inactive' : (pb.status || 'Active'); }
  if (!d.notebookFolders.length) d.notebookFolders = [{ id: 'nbf_general', name: 'ทั่วไป', createdAt: now() }];
  const bt = (d.backtestProjects?.length || 0) + (d.backtestTrades?.length || 0);
  if (bt) d.meta.droppedBacktest = { projects: d.backtestProjects?.length || 0, trades: d.backtestTrades?.length || 0 };
  delete d.backtestProjects; delete d.backtestTrades;
  // v3.16: Backtest module removed — drop stored sessions
  if (d.backtests?.length) d.meta.droppedBacktest = { ...(d.meta.droppedBacktest || {}), sessions: d.backtests.length };
  delete d.backtests;
  // v3.4: the SMC sample strategy is no longer shipped — drop it when nothing uses it
  if (!d.meta.smcCleanup) { const used = id => d.trades.some(t => t.playbookId === id) || d.plans.some(p => p.playbookId === id); d.playbooks = d.playbooks.filter(pb => !(pb.id === 'pb_smc' && !used(pb.id))); d.meta.smcCleanup = true; }
  for (const k of ['trades', 'plans']) d[k] = d[k].filter(r => !r.projectId);
  if (from < 3) { d.meta.migratedFrom = 'EdgeDesk v' + (raw.meta?.appVersion || from); d.meta.migratedAt = now(); }
  for (const t of d.trades) if (t.missed && t.status === 'Void') { t.status = 'Missed'; delete t.missed; }
  for (const n of d.notebooks) { n.strategyIds ??= []; if (n.kind !== 'journal') n.folderId ||= d.notebookFolders[0]?.id; }
  if (!d.meta.v36) migrateV36(d);
  d.settings.journalTemplate ||= 'tpl_journal';
  for (const t of d.noteTemplates || []) if (t.id === 'tpl_journal' && t.icon === 'calendar-days') t.icon = 'journal-day';
  d.meta.schemaVersion = SCHEMA_VERSION; d.meta.appVersion = APP_VERSION;
  if (d.meta.onboarded == null) d.meta.onboarded = d.accounts.length > 0;
  for (const k of LEGACY) delete d[k]; // v3.18: converted into notes / trades in v3.6 — no longer kept
  // v3.20: per-trade rule checklists retired — rules live on the strategy only
  for (const t of d.trades) delete t.checklist; delete d.settings.planChecklist;
  if (!d.meta.v331) migrateV331(d);
  if (!d.meta.v345) migrateV345(d);
  if (!d.meta.v346) migrateV346(d);
  if (!d.meta.v349) migrateV349(d);
  if (!d.meta.v347) { d.meta.v347 = true; for (const pb of d.playbooks || []) if (pb.status !== 'Inactive') pb.status = 'Active'; } // v3.47: Active / Inactive only
  return d;
}

/* ---------- v3.45: index CFDs — 1 lot = 100 per point (was 1). Only instruments still on the untouched old
   default are changed; their existing trades are pinned to the old spec so no money changes until the user chooses. */
function migrateV345(d) { d.meta.v345 = true; } // v3.49: the 100-per-point change is withdrawn — nothing to do for stores that never had it
/* ---------- v3.46: MT5 calculation modes. Contract size becomes the source of profit for non-futures modes, so
   where tick value ÷ tick size and contract size disagreed, contract size is set to the ratio that was in use —
   no amount changes. */
function migrateV346(d) {
  d.meta.v346 = true;
  for (const i of d.instruments) {
    i.calcMode ||= CALC_MODES.includes(i.calculation) ? i.calculation : defaultCalcMode(i.assetClass, i.symbol); delete i.calculation;
    if (i.calcMode !== 'Futures' && i.tickSize > 0 && i.tickValue > 0) { const r = i.tickValue / i.tickSize; if (Math.abs(r - (i.contractSize || 0)) > 1e-9 * Math.max(1, r)) i.contractSize = +r.toPrecision(12); }
    if (i.marginRate === undefined) i.marginRate = defaultMarginRate(i.calcMode);
  }
  for (const a of d.accounts) if (a.leverage === undefined) a.leverage = null;
}
/* ---------- v3.49: undo the v3.45 index change (100 per point) — broker spec is contract size 1, lots 0.1 / step 0.1.
   Trades are pinned to the spec they currently show, so no amount changes on update; the recalc tool then lets the
   user preview and recompute. Only instruments still exactly on the v3.45 values are touched. */
function migrateV349(d) {
  d.meta.v349 = true; let stale = false;
  const rate = i => i && i.calcMode && i.calcMode !== 'Futures' ? (i.contractSize || 0) * (i.multiplier || 1) : i && i.tickSize > 0 ? i.tickValue / i.tickSize * (i.multiplier || 1) : 0;
  for (const i of d.instruments) {
    if (i.assetClass !== 'Indices' || i.contractSize !== 100 || i.tickSize !== .01 || i.tickValue !== 1 || (i.multiplier ?? 1) !== 1) continue;
    const old = clone(i);
    Object.assign(i, { contractSize: 1, tickValue: .01, updatedAt: now() });
    if (i.minQuantity === .01) i.minQuantity = i.symbol === 'JP225' ? 1 : .1;
    if (i.quantityStep === .01) i.quantityStep = i.symbol === 'JP225' ? 1 : .1;
    for (const t of d.trades) {
      if (t.instrumentId !== i.id) continue;
      if (!t.instrumentSnapshot) { t.instrumentSnapshot = old; stale = true; }               // computed at 100 → keep that until the user chooses
      else if (Math.abs(rate(t.instrumentSnapshot) - 1) < 1e-9) delete t.instrumentSnapshot;  // still on the original 1 → matches again
      else stale = true;
    }
  }
  if (stale) d.meta.recalcPrompt = true;
  delete d.meta.specReview;
  // names like "US Dollar vs US Dollar" given to 6-letter non-forex symbols (e.g. USTECH)
  for (const i of d.instruments) if (i.assetClass !== 'Forex' && / vs /.test(i.name || '') && i.name === `${CURRENCY_NAMES[i.baseCurrency] || i.baseCurrency} vs ${CURRENCY_NAMES[i.quoteCurrency] || i.quoteCurrency}`) i.name = instrumentName(i.symbol, i.assetClass, i.baseCurrency, i.quoteCurrency);
}
/* ---------- v3.31: Thai wording for app-generated names (only where still the original text) ---------- */
function migrateV331(d) {
  for (const t of d.tags) if (t.name === 'No Setup / FOMO') { t.name = 'FOMO'; t.updatedAt = now(); }
  for (const f of d.notebookFolders) if (f.name === 'คู่มือ Strategy') { f.name = 'คู่มือกลยุทธ์'; f.updatedAt = now(); }
  for (const n of d.notebooks) if (/ — คู่มือ Strategy$/.test(n.title || '')) { n.title = n.title.replace(/คู่มือ Strategy$/, 'คู่มือกลยุทธ์'); n.updatedAt = now(); }
  for (const t of d.noteTemplates || []) if (t.title === 'Strategy spec · คู่มือ Strategy') { t.title = 'Strategy spec · คู่มือกลยุทธ์'; t.updatedAt = now(); }
  d.meta.v331 = true;
}
/* ---------- v3.6: journal + strategy notes live in Notes; plans retired ---------- */
const escText = v => esc(String(v || '')).replace(/\n/g, '<br>');
function journalToNote(j) {
  const sec = (h, v) => v && String(v).trim() ? `<h2>${h}</h2><p>${escText(v)}</p>` : '';
  const fp = j.followedPlan === true ? L('ทำตามแผน', 'Yes') : j.followedPlan === false ? L('ไม่ได้ทำตาม', 'No') : j.followedPlan === 'partial' ? L('บางส่วน', 'Partly') : '';
  const extra = [j.focus ? L('ความพร้อม ', 'Readiness ') + j.focus + '/5' : '', fp ? L('ทำตามแผน: ', 'Followed plan: ') + fp : ''].filter(Boolean).join(' · ');
  const html = sec(L('แผนก่อนตลาดเปิด', 'Pre-market plan'), j.premarket) + sec(L('รีวิวหลังตลาดปิด', 'Post-session review'), j.review) + sec(L('บทเรียน', 'Lessons'), j.lessons) + (extra ? `<p><i>${esc(extra)}</i></p>` : '');
  return { id: uid('note'), kind: 'journal', date: j.date, folderId: '', title: '', html: html || '<p><br></p>', mood: j.mood || 0, images: [...(j.images || [])], strategyIds: [], createdAt: j.createdAt || now(), updatedAt: j.updatedAt || j.createdAt || now() };
}
function migrateV36(d) {
  const has = new Set(d.notebooks.filter(n => n.kind === 'journal').map(n => n.date));
  for (const j of d.journals || []) { if (!j?.date || has.has(j.date)) continue; if (!(j.premarket || j.review || j.lessons || j.mood || j.images?.length)) continue; d.notebooks.push(journalToNote(j)); has.add(j.date); }
  const general = d.notebookFolders[0]?.id;
  for (const pb of d.playbooks) { for (const n of pb.notes || []) d.notebooks.push({ id: uid('note'), folderId: general, title: n.title || pb.name, html: n.html || '<p><br></p>', strategyIds: [pb.id], createdAt: n.createdAt || now(), updatedAt: n.updatedAt || now() }); pb.notes = []; }
  const linked = new Set(d.trades.map(t => t.planId).filter(Boolean));
  let plansFolder = null;
  for (const p of d.plans || []) {
    if (p.status === 'Converted' || linked.has(p.id)) continue;
    const sym = (d.instruments.find(i => i.id === p.instrumentId) || {}).symbol || p.symbol || '';
    const text = [p.notes && plain(p.notes), p.invalidation && L('เงื่อนไขยกเลิก: ', 'Invalidation: ') + plain(p.invalidation), p.review && plain(p.review)].filter(Boolean).join('\n');
    if (p.status === 'Missed' || p.status === 'Cancelled') {
      const t = { id: uid('trd'), accountId: p.accountId, instrumentId: p.instrumentId, symbol: sym, playbookId: p.playbookId || '', side: p.side || 'Buy', status: 'Missed', entryDateTime: p.date || now(), exitDateTime: '', entryPrice: p.entryPrice ?? null, stopLoss: p.stopLoss ?? null, takeProfit: p.takeProfit ?? null, exitPrice: null, quantity: null, commission: 0, swap: 0, fxRate: p.fxRate, tags: [...(p.tags || [])], emotion: p.emotion || '', note: text, images: [...(p.images || [])], fromPlan: p.id, createdAt: p.createdAt || now() };
      t.displayId = displayId(d.trades, t.entryDateTime); d.trades.push(t); continue;
    }
    if (!plansFolder) { plansFolder = d.notebookFolders.find(f => f.id === 'nbf_plans') || { id: 'nbf_plans', name: L('แผนเดิม', 'Old plans'), createdAt: now() }; if (!d.notebookFolders.includes(plansFolder)) d.notebookFolders.push(plansFolder); }
    const rows = [[L('ทิศทาง', 'Side'), p.side === 'Sell' ? 'Short' : 'Long'], [L('ราคาเข้า', 'Entry price'), p.entryPrice], [L('ระดับ S/L', 'Stop level'), p.stopLoss], [L('ระดับเป้าหมาย', 'Target level'), p.takeProfit], [L('ความเสี่ยง %', 'Risk %'), p.riskPct]].filter(r => r[1] != null && r[1] !== '');
    const cl = (p.playbookChecklist || []).map(r => `<div><input type="checkbox"${r.checked ? ' checked' : ''}> <span>${esc(r.label)}</span></div>`).join('');
    const html = `<table><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(String(r[1]))}</td></tr>`).join('')}</tbody></table>${p.notes ? `<h3>${L('เหตุผล', 'Thesis')}</h3><p>${escText(plain(p.notes))}</p>` : ''}${p.invalidation ? `<h3>${L('เงื่อนไขยกเลิก', 'Invalidation')}</h3><p>${escText(plain(p.invalidation))}</p>` : ''}${cl ? `<h3>${L('เช็คลิสต์', 'Checklist')}</h3>${cl}` : ''}${p.review ? `<h3>Review</h3><p>${escText(plain(p.review))}</p>` : ''}`;
    d.notebooks.push({ id: uid('note'), folderId: plansFolder.id, title: `${sym} ${p.side === 'Sell' ? 'Short' : 'Long'} · ${fmtDate(p.date || now())}`, html, strategyIds: p.playbookId ? [p.playbookId] : [], fromPlan: p.id, createdAt: p.createdAt || now(), updatedAt: p.updatedAt || now() });
  }
  if (Array.isArray(d.noteTemplates)) for (const id of ['strategy', 'journal']) if (!d.noteTemplates.some(t => t.id === 'tpl_' + id)) { const x = NOTE_TEMPLATES.find(t => t.id === id); if (x) d.noteTemplates.unshift({ id: 'tpl_' + id, title: x.title, desc: x.desc, icon: x.icon, html: x.html, builtin: true, createdAt: now(), updatedAt: now() }); }
  d.meta.v36 = true;
}

/* ---------- lookups ---------- */
const byId = new Map();
function reindex() { byId.clear(); for (const k of COLLECTIONS) for (const r of state[k] || []) byId.set(k + ':' + r.id, r); }
const get = (kind, id) => id ? (byId.get(kind + ':' + id) || state[kind]?.find(x => x.id === id)) : undefined;
const nameOf = (kind, id, f = 'name') => { const r = get(kind, id); if (r && f === 'name' && kind === 'tags') return tagName(r); if (r && f === 'name' && kind === 'tagCategories') return catName(r); return r?.[f] || '—'; };
function currentAccounts() { return (state?.accounts || []).filter(a => !ui.account || a.id === ui.account); }
function accountCurrency(t) { return get('accounts', t?.accountId)?.currency || 'USD'; }
function displayId(records, date) {
  const d = (dateKey(date) || todayKey()).replace(/-/g, ''); let n = 0;
  for (const r of records) if (r.displayId?.startsWith(d + '-')) n = Math.max(n, Number(r.displayId.slice(d.length + 1)) || 0);
  return d + '-' + String(n + 1).padStart(2, '0');
}
const RULE_GROUPS = ['Entry', 'Filters', 'Risk', 'Exit'];
function defaultRuleGroups() { return RULE_GROUPS.map(name => ({ id: uid('rg'), name, items: [{ id: uid('r'), label: '' }] })); }
function ruleHint(group) { return ({ entry: L('เช่น แท่งยืนยันปิดเหนือโซน', 'e.g. confirmation candle closes beyond the zone'), filters: L('เช่น ไม่เทรดก่อนข่าวแรง 15 นาที', 'e.g. no trades 15 min before high-impact news'), risk: L('เช่น เสี่ยงไม่เกิน 1% ต่อไม้', 'e.g. risk no more than 1% per trade'), exit: L('เช่น ปิดครึ่งหนึ่งที่ 1R แล้วบังทุน', 'e.g. close half at 1R, then move the stop to break-even'), 'position policy': L('เช่น ถือได้ครั้งละ 1 ออเดอร์', 'e.g. one position at a time') })[String(group || '').trim().toLowerCase()] || L('กฎข้อนี้…', 'Rule…'); }
function presetRange(p) {
  const t = todayKey(), y = +t.slice(0, 4), m = +t.slice(5, 7);
  const ym = (yy, mm) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  switch (p) {
    case 'today': return [t, t];
    case 'yesterday': { const k = shiftKey(t, { days: -1 }); return [k, k]; }
    case 'week': return [weekStartKey(t), t];
    case '7d': return [shiftKey(t, { days: -6 }), t];
    case '30d': return [shiftKey(t, { days: -29 }), t];
    case 'month': return [ym(y, m), t];
    case 'lastmonth': { const f = shiftKey(ym(y, m), { months: -1 }); return [f, shiftKey(ym(y, m), { days: -1 })]; }
    case '90d': return [shiftKey(t, { days: -89 }), t];
    case 'ytd': return [`${y}-01-01`, t];
    case 'lastyear': return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case 'custom': return [ui.from, ui.to];
    default: return ['', ''];
  }
}
const PRESETS = () => [['all', L('ทั้งหมด', 'All time')], ['today', L('วันนี้', 'Today')], ['yesterday', L('เมื่อวาน', 'Yesterday')], ['week', L('สัปดาห์นี้', 'This week')], ['7d', L('7 วันล่าสุด', 'Last 7 days')], ['30d', L('30 วันล่าสุด', 'Last 30 days')], ['month', L('เดือนนี้', 'This month')], ['lastmonth', L('เดือนที่แล้ว', 'Last month')], ['90d', L('90 วันล่าสุด', 'Last 90 days')], ['ytd', L('ปีนี้', 'Year to date')], ['lastyear', L('ปีที่แล้ว', 'Last year')], ['custom', L('กำหนดเอง…', 'Custom…')]];
