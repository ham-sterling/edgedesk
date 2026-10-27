// EdgeDesk build — concatenates src/*.js in order and inlines the CSS.
//   node build.mjs            → dist/EdgeDesk_v<version>.html  (standalone, data in the browser)
//   node build.mjs --cloud    → public/index.html               (Cloudflare build, data in D1)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url)), src = join(root, 'src');
const cloud = process.argv.includes('--cloud');
const order = ['icons_lucide.js', 'icons.js', 'core.js', 'cloud.js', 'strategies.js', 'calc.js', 'charts.js', 'ui.js', 'glossary.js', 'guard.js', 'demo.js', 'views_main.js', 'views_journal.js', 'views_notes.js', 'views_reports.js', 'views_settings.js', 'autobackup.js', 'icons_editor.js', 'notes_tpl.js', 'rte_table.js', 'rte_list.js', 'tools.js', 'riskmon.js', 'specfix.js', 'executions.js', 'wstabs.js', 'main.js'];
let js = "'use strict';\n" + (cloud ? 'const EDGEDESK_CLOUD = true;\n' : '') + order.map(f => readFileSync(join(src, f), 'utf8').replace("'use strict';", '')).join('\n');
if (js.toLowerCase().includes('</script')) throw new Error('</script inside JS');
/* fonts are inlined as data: URIs so the single file works offline */
const fontCss = readFileSync(join(src, 'fonts.css'), 'utf8').replace(/url\((fonts\/[\w.-]+\.woff2)\)/g, (m, f) => `url(data:font/woff2;base64,${readFileSync(join(src, f)).toString('base64')})`);
const css = fontCss + '\n' + readFileSync(join(src, 'styles.css'), 'utf8');
const version = (js.match(/APP_VERSION = '([\d.]+)'/) || [])[1] || 'dev';
const fav = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23334BFF'/%3E%3Cstop offset='1' stop-color='%236678FF'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='32' height='32' rx='8' fill='url(%23g)'/%3E%3Cpath d='M5 17h5l3-8 6 15 3-7h5' fill='none' stroke='white' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
const desc = cloud ? 'EdgeDesk — trading journal, analytics and risk lab, stored in your own Cloudflare account.' : 'EdgeDesk 3 — offline trading journal, analytics and risk lab. Your data stays on this device.';
const html = `<!doctype html>
<html lang="th" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0D0D0D"><meta name="description" content="${desc}">${cloud ? '<meta name="robots" content="noindex,nofollow">' : ''}<title>EdgeDesk — Trading Journal</title><link rel="icon" href="${fav}"><style>${css}</style></head>
<body><div id="app"></div><div id="drawer-root"></div><div id="modal-root"></div><div id="toasts" aria-live="polite"></div><div id="charttip" role="tooltip"></div><input type="file" id="fileinput" hidden>
<script>${js}</script></body></html>`;
const out = cloud ? join(root, 'public', 'index.html') : join(root, 'dist', `EdgeDesk_v${version}.html`);
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, html);
console.log(out, html.length);
