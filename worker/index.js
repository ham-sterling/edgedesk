/* ============================================================
   EdgeDesk — Cloudflare Worker
   • Serves the app (public/index.html) through the static-assets binding
   • /api/*  : password login (HttpOnly cookie) + data API on D1
   Tables are created automatically on first use — no SQL to run by hand.
   Required secret : APP_PASSWORD        (Settings → Variables and Secrets)
   Optional secret : SESSION_SECRET      (defaults to APP_PASSWORD; change it to sign everyone out)
   Binding         : DB  → a D1 database (see wrangler.jsonc)
   ============================================================ */
const COOKIE = 'ed_session', MAX_AGE = 60 * 60 * 24 * 30, SEP = '\u001f', IMG_PART = 1_800_000;
const enc = new TextEncoder();

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const fail = (status, error) => json({ error }, status);

/* ---------- sessions: exp.signature, HMAC-SHA256 ---------- */
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function safeEqual(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const secretOf = env => env.SESSION_SECRET || env.APP_PASSWORD || '';
async function makeCookie(env) {
  const exp = Date.now() + MAX_AGE * 1000, tok = `${exp}.${await hmac(secretOf(env), 'edgedesk:' + exp)}`;
  return `${COOKIE}=${tok}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
}
async function authed(req, env) {
  if (!env.APP_PASSWORD) return false;
  const m = (req.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`)); if (!m) return false;
  const [exp, sig] = m[1].split('.'); if (!exp || !sig || +exp < Date.now()) return false;
  return safeEqual(sig, await hmac(secretOf(env), 'edgedesk:' + exp));
}
/* slow down password guessing: per-IP counter kept in D1 */
async function tooManyAttempts(env, ip) {
  const row = await env.DB.prepare('SELECT v, t FROM throttle WHERE ip = ?1').bind(ip).first();
  return row && row.v >= 8 && Date.now() - row.t < 15 * 60 * 1000;
}
async function noteFailure(env, ip) {
  await env.DB.prepare('INSERT INTO throttle (ip, v, t) VALUES (?1, 1, ?2) ON CONFLICT(ip) DO UPDATE SET v = CASE WHEN ?2 - t > 900000 THEN 1 ELSE v + 1 END, t = ?2').bind(ip, Date.now()).run();
}

/* ---------- schema (idempotent) ---------- */
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS records (coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (coll, id))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS docs (key TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS images (id TEXT NOT NULL, part INTEGER NOT NULL, parts INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (id, part))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS throttle (ip TEXT PRIMARY KEY, v INTEGER NOT NULL, t INTEGER NOT NULL)'),
    env.DB.prepare("INSERT OR IGNORE INTO kv (k, v) VALUES ('rev', 0)")
  ]);
  schemaReady = true;
}
const getRev = async env => (await env.DB.prepare("SELECT v FROM kv WHERE k = 'rev'").first())?.v || 0;

/* ---------- data API ---------- */
async function getState(env) {
  const [rev, docs, recs] = await Promise.all([getRev(env), env.DB.prepare('SELECT key, data FROM docs').all(), env.DB.prepare('SELECT coll, data FROM records ORDER BY coll, rowid').all()]);
  /* stitch the stored JSON together instead of parsing + re-serialising every record */
  const d = docs.results.map(r => `${JSON.stringify(r.key)}:${r.data}`).join(',');
  const rs = recs.results.map(r => `[${JSON.stringify(r.coll)},${r.data}]`).join(',');
  return new Response(`{"rev":${rev},"docs":{${d}},"records":[${rs}]}`, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
const COLL_RE = /^[A-Za-z][A-Za-z0-9]{0,40}$/, ID_RE = /^[^\u0000-\u001f]{1,120}$/;
async function sync(req, env) {
  let body; try { body = await req.json(); } catch { return fail(400, 'Invalid JSON'); }
  const ups = Array.isArray(body.upserts) ? body.upserts : [], dels = Array.isArray(body.deletes) ? body.deletes : [], docs = body.docs && typeof body.docs === 'object' ? body.docs : {};
  for (const u of ups) if (!COLL_RE.test(u?.c) || !ID_RE.test(u?.id) || typeof u?.d !== 'string' || u.d.length > 1_900_000) return fail(400, 'Bad record ' + (u?.c || '') + '/' + (u?.id || ''));
  for (const x of dels) if (!COLL_RE.test(x?.c) || !ID_RE.test(x?.id)) return fail(400, 'Bad delete');
  for (const [k, v] of Object.entries(docs)) if (!['settings', 'meta'].includes(k) || typeof v !== 'string') return fail(400, 'Bad doc ' + k);
  for (const u of ups) try { JSON.parse(u.d); } catch { return fail(400, 'Record is not JSON: ' + u.id); }
  for (const v of Object.values(docs)) try { JSON.parse(v); } catch { return fail(400, 'Doc is not JSON'); }
  const t = Date.now(), prev = await getRev(env), stmts = [];
  /* one statement per ~25 rows keeps each statement small and bound parameters ≤ 100 */
  for (let i = 0; i < ups.length; i += 25) {
    const part = ups.slice(i, i + 25), vals = part.map((_, j) => `(?${j * 3 + 1}, ?${j * 3 + 2}, ?${j * 3 + 3}, ${t})`).join(',');
    stmts.push(env.DB.prepare(`INSERT INTO records (coll, id, data, updated_at) VALUES ${vals} ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).bind(...part.flatMap(u => [u.c, u.id, u.d])));
  }
  if (dels.length) stmts.push(env.DB.prepare('DELETE FROM records WHERE coll || char(31) || id IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(dels.map(x => x.c + SEP + x.id))));
  for (const [k, v] of Object.entries(docs)) stmts.push(env.DB.prepare('INSERT INTO docs (key, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').bind(k, v, t));
  stmts.push(env.DB.prepare("UPDATE kv SET v = v + 1 WHERE k = 'rev' RETURNING v"));
  if (stmts.length > 45) return fail(413, 'Too many records in one request');
  const res = await env.DB.batch(stmts);
  return json({ ok: true, prev, rev: res.at(-1).results[0].v });
}
async function imageGet(env, id) {
  const rows = (await env.DB.prepare('SELECT part, parts, data FROM images WHERE id = ?1 ORDER BY part').bind(id).all()).results;
  if (!rows.length || rows.length !== rows[0].parts) return fail(404, 'Not found');
  return new Response(rows.map(r => r.data).join(''), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, max-age=31536000, immutable' } });
}
async function imagePut(req, env, id) {
  const text = await req.text(); if (text.length > 30_000_000) return fail(413, 'Image too large');
  try { const r = JSON.parse(text); if (typeof r.data !== 'string' || !r.data.startsWith('data:image/')) throw 0; } catch { return fail(400, 'Not an image record'); }
  const parts = Math.ceil(text.length / IMG_PART), t = Date.now(), stmts = [env.DB.prepare('DELETE FROM images WHERE id = ?1').bind(id)];
  for (let i = 0; i < parts; i++) stmts.push(env.DB.prepare('INSERT INTO images (id, part, parts, data, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(id, i, parts, text.slice(i * IMG_PART, (i + 1) * IMG_PART), t));
  await env.DB.batch(stmts);
  return json({ ok: true, parts });
}

/* ---------- router ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (!env.DB) return fail(500, 'D1 binding "DB" is missing — check wrangler.jsonc');
    try {
      await ensureSchema(env);
      const m = req.method, isAuthed = await authed(req, env);
      if (p === '/api/me') return json({ authed: isAuthed, configured: !!env.APP_PASSWORD });
      /* simple CSRF guard: every write must carry our custom header (forms on other sites cannot add it) */
      if (m !== 'GET' && req.headers.get('X-EdgeDesk') !== '1') return fail(403, 'Missing header');
      if (p === '/api/login' && m === 'POST') {
        if (!env.APP_PASSWORD) return fail(403, 'APP_PASSWORD is not set');
        const ip = req.headers.get('CF-Connecting-IP') || 'local';
        if (await tooManyAttempts(env, ip)) return fail(429, 'Too many attempts');
        let pw = ''; try { pw = String((await req.json()).password || ''); } catch { }
        if (!safeEqual(await hmac('pw', pw), await hmac('pw', env.APP_PASSWORD))) { await noteFailure(env, ip); await new Promise(r => setTimeout(r, 600)); return fail(401, 'Wrong password'); }
        await env.DB.prepare('DELETE FROM throttle WHERE ip = ?1').bind(ip).run();
        return json({ ok: true }, 200, { 'Set-Cookie': await makeCookie(env) });
      }
      if (p === '/api/logout') return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });
      if (!isAuthed) return fail(401, 'Sign in first');

      if (p === '/api/rev' && m === 'GET') return json({ rev: await getRev(env) });
      if (p === '/api/state' && m === 'GET') return getState(env);
      if (p === '/api/sync' && m === 'POST') return sync(req, env);
      if (p === '/api/images' && m === 'GET') return json({ ids: (await env.DB.prepare('SELECT DISTINCT id FROM images').all()).results.map(r => r.id) });
      const im = p.match(/^\/api\/images\/([^/]{1,120})$/);
      if (im) {
        const id = decodeURIComponent(im[1]);
        if (m === 'GET') return imageGet(env, id);
        if (m === 'PUT') return imagePut(req, env, id);
        if (m === 'DELETE') { await env.DB.prepare('DELETE FROM images WHERE id = ?1').bind(id).run(); return json({ ok: true }); }
      }
      return fail(404, 'Unknown endpoint');
    } catch (e) {
      return fail(500, String(e?.message || e));
    }
  }
};
