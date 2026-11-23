# Salford Libya website

Showcase store for Swarovski, Tiffany & Co., APM Monaco and Pandora, in Arabic and English.
Customers add pieces to a cart and send the order through WhatsApp, Messenger or Instagram;
payment is cash or card on delivery, or LyPay.

## Stack
- Hono (server-rendered JSX) on **Cloudflare Pages**, built with Vite (`npm run build` → `dist/`)
- **D1** database `salford-site-db` (binding `DB`), schema in `migrations/`
- **R2** bucket `salford-media` (binding `MEDIA`) for uploaded photos/videos and safe copies, served at `/m/...`
- Plain JS for the storefront (`public/static/site.js`) and admin (`public/static/admin.js`)

## Develop
```bash
npm install
npm run build
npx wrangler d1 migrations apply salford-site-db --local
npx wrangler pages dev dist
```

## Deploy
Cloudflare Pages project `salford-site` is connected to this GitHub repository.
Pushing to `main` publishes the live site; other configured branches build private test addresses.
Test addresses (`*.pages.dev`) are locked with the `PREVIEW_KEY` secret and are never indexed.

## Photos and videos
- Uploads are resized in the browser to 400 / 900 / 1800 px (WebP, or JPEG where WebP isn't available), turned upright and stripped of hidden data, then stored in R2.
- Links (photo, video or YouTube) are checked when added. "Keep a safe copy" stores the file once in R2.
- Admin → Products has buttons to check all links and to make safe copies in small batches.
- Videos upload in 10 MB parts (max 100 MB).

## Admin
`/admin` — products, orders and settings. The first admin account is created at `/admin/setup`
on the private test address (works only while no admin exists).

## Importing from the old site
`scripts/import_legacy.py` turns an export of the old D1 database into SQL for this schema.
It upserts by the old product id, so it can be re-run for the final copy on switch-over day.
