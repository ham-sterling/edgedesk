# EdgeDesk — Trading Journal (Cloudflare edition)

A trading journal with analytics, strategy rules, notebook and a position-size calculator.
This edition stores everything in **your own Cloudflare account** (Workers + D1) and syncs across devices.
The same source also builds the single-file **standalone** version that keeps data in the browser.

- **Install guide (Thai):** [`docs/INSTALL.th.md`](docs/INSTALL.th.md) — GitHub → Cloudflare, no terminal needed
- **Stack:** one Cloudflare Worker (static assets + `/api/*`), one D1 database, password login (HttpOnly cookie)
- **Offline:** the app keeps a local copy in IndexedDB and syncs when back online

## Quick start (developers)

```bash
npm install
echo "APP_PASSWORD=dev-password" > .dev.vars
npm run build     # public/index.html (cloud) + dist/EdgeDesk_v*.html (standalone)
npm run dev       # http://localhost:8787 with a local D1
```

Deploy: create a D1 database, put its ID in `wrangler.jsonc`, connect the repo in
**Workers & Pages → Create application → Import a repository** (build command `npm run build`),
then add the secret `APP_PASSWORD` under **Settings → Variables and Secrets**.

## Layout

| Path | Purpose |
|---|---|
| `src/` | App source (shared by both editions) |
| `src/cloud.js` | Cloud sync — active only in the cloud build |
| `build.mjs` | `--cloud` → `public/index.html`; default → `dist/` standalone file |
| `worker/index.js` | Auth, `/api/state`, `/api/sync`, `/api/images`; creates D1 tables on first use |
| `wrangler.jsonc` | Worker, static assets and D1 binding |

Icons: [Lucide](https://lucide.dev) (ISC License).
