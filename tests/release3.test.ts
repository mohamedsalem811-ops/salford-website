// Release 3 end to end: the waiting list for sold-out pieces, reviews (approval, verified buyers, private photos),
// the trust page and gallery, the delivery page, and the admin side, through the real routes and schema.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import app from '../src/index'
import { makeD1 } from './d1'
import { stripMetadata, parseGallery, stars, backInStockMessage } from '../src/lib/r3'

/** R2 stand-in: enough of put/get/delete for the routes. */
const store = new Map<string, { bytes: Uint8Array; type: string }>()
const MEDIA = {
  async put(key: string, v: Uint8Array, o?: { httpMetadata?: { contentType?: string } }) { store.set(key, { bytes: new Uint8Array(v), type: o?.httpMetadata?.contentType ?? '' }) },
  async get(key: string) { const x = store.get(key); return x ? { body: x.bytes, httpMetadata: { contentType: x.type } } : null },
  async delete(key: string) { store.delete(key) },
}
const DB = makeD1()
const env = { DB, MEDIA, PREVIEW_KEY: 'k' } as never
const ORIGIN = 'https://shop.test'
let ipN = 0
const freshIp = () => `10.0.${Math.floor(++ipN / 250)}.${ipN % 250}`
const get = (path: string, headers: Record<string, string> = {}) => app.request(ORIGIN + path, { headers }, env)
const call = (method: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(ORIGIN + path, { method, headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, env)
const send = (path: string, body: unknown, headers: Record<string, string> = {}) => call('POST', path, body, headers)

DB.sqlite.exec(`
  UPDATE settings SET value = '218912345678' WHERE key = 'whatsapp';
  INSERT INTO products (id, code, brand_id, category_id, name_en, price, in_stock) VALUES
    (1, '5732414', 'swarovski', 'necklaces', 'Swan Pendant', 250000, 1),
    (2, '5600001', 'swarovski', 'bracelets', 'Tennis Bracelet', 400000, 0),
    (3, '5600003', 'swarovski', 'rings', 'Sold Ring', 200000, 0);
  INSERT INTO media (product_id, kind, source, r2_key, sizes, status) VALUES
    (1, 'image', 'upload', 'p/1/a', '[400,900]', 'ok'), (2, 'image', 'upload', 'p/2/a', '[400,900]', 'ok'), (3, 'image', 'upload', 'p/3/a', '[400,900]', 'ok');
  INSERT INTO admins (id, email, pass_hash, salt) VALUES (1, 'owner@shop.test', 'x', 'x');
`)
const adminToken = 'c'.repeat(64)
DB.sqlite.prepare("INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, 1, datetime('now', '+1 hour'))").run(createHash('sha256').update(adminToken).digest('hex'))
const asAdmin = { cookie: `sl_admin=${adminToken}` }
const setting = (k: string) => (DB.sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(k) as { value: string } | undefined)?.value
const html = async (path: string, h: Record<string, string> = {}) => { const r = await get(path, h); assert.equal(r.status, 200, path); return r.text() }
const sw = (key: string, on: boolean) => send('/admin/api/r3-switch', { key, on }, asAdmin)

const order = async (phone: string, items = [{ id: 1, qty: 1 }]) => {
  const r = await send('/api/orders', { lang: 'en', name: 'Sara Ali', phone, city: 'Benghazi', payment: 'cod_cash', channel: 'whatsapp', items })
  assert.equal(r.status, 200, await r.clone().text())
  const d = (await r.json()) as { number: string; token: string }
  const id = (DB.sqlite.prepare('SELECT id FROM orders WHERE number = ?').get(d.number) as { id: number }).id
  return { ...d, id }
}
const deliver = async (id: number) => assert.equal((await send(`/admin/api/orders/${id}`, { status: 'delivered', admin_note: '', paid: false }, asAdmin)).status, 200)
const review = (b: Record<string, unknown>, ip = freshIp()) => send('/api/reviews', { lang: 'en', rating: 5, name: 'Mona', ...b }, { 'cf-connecting-ip': ip })
const lastReview = () => DB.sqlite.prepare('SELECT * FROM reviews ORDER BY id DESC LIMIT 1').get() as Record<string, string | number>

/* tiny files for the photo checks */
const bytes = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...Buffer.from(p, 'latin1')] : p)))
const jpegWithExif = () => bytes(
  [0xff, 0xd8],
  [0xff, 0xe0, 0x00, 0x10], 'JFIF\0', [1, 1, 0, 0, 1, 0, 1, 0, 0],
  [0xff, 0xe1, 0x00, 0x0e], 'Exif\0\0', 'GPS123',
  [0xff, 0xfe, 0x00, 0x07], 'hello',
  [0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0], 'pixels', [0xff, 0xd9],
)
const le32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]
const webpWithExif = () => {
  const body = bytes('VP8X', le32(10), [0x0c | 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'EXIF', le32(5), 'GPS12', [0], 'VP8 ', le32(4), 'data')
  return bytes('RIFF', le32(4 + body.length), 'WEBP', [...body])
}
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s, 'latin1'))

test('migration 0005: both switches start off; trust settings exist', () => {
  const db = new DatabaseSync(':memory:')
  for (const f of ['0001_init.sql', '0002_order_view.sql', '0003_offers_codes_delivery.sql', '0004_tracking_customers_loyalty.sql', '0005_waitlist_reviews_trust.sql']) {
    db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'))
  }
  const s = Object.fromEntries((db.prepare("SELECT key, value FROM settings WHERE key IN ('waitlist_on','reviews_on','trust_text_ar','trust_text_en','trust_gallery')").all() as { key: string; value: string }[]).map((r) => [r.key, r.value]))
  assert.deepEqual(s, { waitlist_on: '0', reviews_on: '0', trust_text_ar: '', trust_text_en: '', trust_gallery: '[]' })
})

test('photo checks remove location data from JPEG and WebP, and refuse anything else', () => {
  const j = stripMetadata(jpegWithExif())!
  assert.ok(j && !has(j, 'Exif') && !has(j, 'GPS') && !has(j, 'hello') && has(j, 'JFIF') && has(j, 'pixels'))
  assert.deepEqual([...j.slice(-2)], [0xff, 0xd9])
  const w = stripMetadata(webpWithExif())!
  assert.ok(w && !has(w, 'EXIF') && !has(w, 'GPS') && has(w, 'VP8 ') && has(w, 'data'))
  assert.equal(w[4] | (w[5] << 8) | (w[6] << 16) | (w[7] << 24), w.length - 8, 'RIFF size fixed')
  assert.equal(w[20] & 0x0c, 0, 'no longer claims EXIF/XMP')
  assert.equal(stripMetadata(bytes([0x89], 'PNG\r\n')), null)
  assert.equal(stripMetadata(bytes([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00])), null, 'segment longer than the file')
  assert.deepEqual(stars([{ rating: 5 }, { rating: 4 }, { rating: 4 }]), { avg: 4.3, n: 3 })
  assert.deepEqual(parseGallery('[{"url":"/m/b/0123456789abcdef01-1080","cap_en":"Box"},{"url":"javascript:alert(1)"},{"url":"/m/u/1/x"}]'), [{ url: '/m/b/0123456789abcdef01-1080', cap_ar: '', cap_en: 'Box' }])
  assert.ok(backInStockMessage('ar', { name: 'سارة علي', piece: 'Swan', code: '1', link: 'L' }).startsWith('مرحباً سارة،'))
})

test('waiting list: off by default; on a sold-out piece only; one entry per phone; spam limit', async () => {
  const off = await send('/api/waitlist', { product_id: 2, name: 'Huda', phone: '0913000001' })
  assert.equal(off.status, 403)
  assert.ok(!(await html('/en/p/2')).includes('data-waitlist'))
  const before = setting('catalog_v')
  assert.equal((await sw('waitlist_on', true)).status, 200)
  assert.notEqual(setting('catalog_v'), before, 'the switch refreshes the shop')
  assert.ok((await html('/en/p/2')).includes('data-waitlist'))
  assert.ok(!(await html('/en/p/1')).includes('data-waitlist'), 'not on a piece that is in stock')

  assert.equal((await send('/api/waitlist', { product_id: 1, name: 'Huda', phone: '0913000001' })).status, 409)
  const bad = await send('/api/waitlist', { product_id: 2, name: '', phone: '12' })
  assert.equal(bad.status, 422)
  assert.deepEqual(((await bad.json()) as { fields: string[] }).fields, ['name', 'phone'])
  assert.equal((await send('/api/waitlist', { product_id: 2, name: 'Bot', phone: '0913000009', website: 'x' })).status, 400)
  assert.equal((await send('/api/waitlist', { product_id: 99, name: 'Huda', phone: '0913000001' })).status, 404)

  const v = setting('catalog_v')
  assert.equal((await send('/api/waitlist', { lang: 'en', product_id: 2, name: 'Huda', phone: '+218 91 300 0001' })).status, 200)
  assert.equal((await send('/api/waitlist', { lang: 'ar', product_id: 2, name: 'هدى', phone: '0913000001' })).status, 200)
  const rows = DB.sqlite.prepare('SELECT name, phone, lang FROM waitlist WHERE product_id = 2').all()
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ name: 'هدى', phone: '0913000001', lang: 'ar' }], 'signing up again updates the same entry')
  assert.equal(setting('catalog_v'), v, 'sign-ups do not refresh the shop')

  for (let i = 0; i < 10; i++) assert.equal((await send('/api/waitlist', { product_id: 3, name: 'S', phone: '0913000002' }, { 'cf-connecting-ip': '9.9.9.9' })).status, 200)
  assert.equal((await send('/api/waitlist', { product_id: 3, name: 'S', phone: '0913000002' }, { 'cf-connecting-ip': '9.9.9.9' })).status, 429)
})

test('admin waiting list: back-in-stock first with one-tap WhatsApp, marks sent, removes, deletes after 90 days', async () => {
  assert.equal((await get('/admin/waitlist')).status, 302, 'needs a login')
  DB.sqlite.exec(`INSERT INTO waitlist (product_id, name, phone, created_at) VALUES (3, 'Old', '0913000077', datetime('now', '-91 days'))`)
  let page = await html('/admin/waitlist', asAdmin)
  assert.ok(!page.includes('0913000077'), 'older than 90 days is deleted')
  assert.equal(DB.sqlite.prepare("SELECT count(*) AS n FROM waitlist WHERE phone = '0913000077'").get()!.n, 0)
  assert.ok(page.includes('Still sold out') && !page.includes('data-wl-sent'))

  DB.sqlite.exec('UPDATE products SET in_stock = 1 WHERE id = 2')
  page = await html('/admin/waitlist', asAdmin)
  assert.ok(page.indexOf('Tennis Bracelet') < page.indexOf('Sold Ring'), 'back-in-stock pieces come first')
  const id = (DB.sqlite.prepare("SELECT id FROM waitlist WHERE product_id = 2").get() as { id: number }).id
  const link = new RegExp(`href="(https://wa\\.me/218913000001\\?text=[^"]+)"[^>]*data-wl-sent="${id}"`).exec(page)
  assert.ok(link, 'Send button with the customer number')
  const text = decodeURIComponent(link[1].split('text=')[1].replace(/&amp;/g, '&'))
  assert.ok(text.startsWith('مرحباً هدى،') && text.includes(`${ORIGIN}/ar/p/2`) && text.includes('5600001'), text)

  const v = setting('catalog_v')
  assert.equal((await send(`/admin/api/waitlist/${id}/sent`, {}, asAdmin)).status, 200)
  assert.ok(DB.sqlite.prepare('SELECT notified_at FROM waitlist WHERE id = ?').get(id)!.notified_at)
  assert.ok((await html('/admin/waitlist', asAdmin)).includes('Send again'))
  assert.equal((await call('DELETE', `/admin/api/waitlist/${id}`, undefined, asAdmin)).status, 200)
  assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM waitlist WHERE id = ?').get(id)!.n, 0)
  assert.equal(setting('catalog_v'), v, 'waiting-list actions do not refresh the shop')
  assert.equal((await send(`/admin/api/waitlist/${id}/sent`, {})).status, 401, 'API needs a login')
  DB.sqlite.exec('UPDATE products SET in_stock = 0 WHERE id = 2')
})

test('reviews: off by default; pending until approved; verified only from a delivered order', async () => {
  assert.equal((await review({ product_id: 1 })).status, 403)
  assert.ok(!(await html('/en/p/1')).includes('id="reviews"'))
  await sw('reviews_on', true)
  assert.ok((await html('/en/p/1')).includes('id="reviews"'))

  const bad = await review({ product_id: 1, rating: 6, name: '' })
  assert.deepEqual(((await bad.json()) as { fields: string[] }).fields, ['rating', 'name'])
  assert.equal((await review({})).status, 422, 'a review from the shop needs a product')
  assert.equal((await review({ product_id: 1, website: 'spam' })).status, 400)

  // someone with no order, claiming to be verified
  assert.equal((await review({ product_id: 1, name: 'Stranger', text: 'Lovely <b>piece</b>', verified: 1, status: 'approved', phone: '0914000001' })).status, 200)
  let r = lastReview()
  assert.deepEqual([r.status, r.verified, r.phone, r.order_id], ['pending', 0, '0914000001', null], 'the form cannot approve or verify itself')
  assert.ok(!(await html('/en/p/1')).includes('Lovely'), 'not shown before approval')
  assert.equal((await review({ product_id: 1, phone: '0914000001' })).status, 409, 'one review per phone per piece')

  // a customer whose order was delivered
  const o = await order('0914000002')
  await deliver(o.id)
  assert.equal((await review({ product_id: 1, name: 'Buyer', text: 'Exactly as shown', phone: '0914000002' })).status, 200)
  r = lastReview()
  assert.equal(r.verified, 1)

  const v = setting('catalog_v')
  assert.equal((await send(`/admin/api/reviews/${r.id}`, { action: 'approve' }, asAdmin)).status, 200)
  assert.notEqual(setting('catalog_v'), v, 'approving refreshes the shop')
  const page = await html('/en/p/1')
  assert.ok(page.includes('Exactly as shown') && page.includes('Verified buyer') && page.includes('Buyer'))
  assert.ok(!page.includes('0914000002'), 'phone is never shown')
  assert.match(page, /"aggregateRating":\{"@type":"AggregateRating","ratingValue":5,"reviewCount":1/)
  assert.ok((await html('/en/page/trust')).includes('Exactly as shown'), 'also on the trust page')

  assert.equal((await send(`/admin/api/reviews/${r.id}`, { action: 'reject' }, asAdmin)).status, 200)
  assert.ok(!(await html('/en/p/1')).includes('Exactly as shown'), 'hidden again')
  assert.equal((await send(`/admin/api/reviews/${r.id}`, { action: 'publish' }, asAdmin)).status, 400)
  assert.equal((await send(`/admin/api/reviews/${r.id}`, { action: 'approve' })).status, 401)

  // rate limit: 5 reviews per connection per hour
  for (let i = 0; i < 5; i++) assert.equal((await review({ product_id: 3, name: `R${i}` }, '8.8.8.8')).status, 200)
  assert.equal((await review({ product_id: 3, name: 'R5' }, '8.8.8.8')).status, 429)
})

test('review from the customer’s own link: only after delivery, verified, once per piece', async () => {
  const o = await order('0915000001')
  assert.equal((await review({ number: o.number, token: o.token, product_id: 1 })).status, 409, 'not delivered yet')
  const early = await html(`/en/review/${o.number}?t=${o.token}`)
  assert.ok(early.includes('once it has been delivered') && !early.includes('rv-form'))
  await deliver(o.id)
  const page = await get(`/en/review/${o.number}?t=${o.token}`)
  assert.equal(page.status, 200)
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(page.headers.get('cache-control'), 'private, no-store')
  const body = await page.text()
  assert.ok(body.includes('rv-form') && body.includes('<meta name="robots" content="noindex, nofollow"/>'))
  assert.equal((await review({ number: o.number, token: 'f'.repeat(32), product_id: 1 })).status, 404, 'wrong link')
  assert.equal((await review({ number: o.number, token: o.token, product_id: 2 })).status, 422, 'piece not in this order')
  assert.equal((await review({ number: o.number, token: o.token, product_id: 1, phone: '0919999999' })).status, 200)
  const r = lastReview()
  assert.deepEqual([r.verified, r.order_id, r.phone, r.status], [1, o.id, '0915000001', 'pending'], 'the phone comes from the order, not the form')
  assert.equal((await review({ number: o.number, token: o.token, product_id: 1 })).status, 409)
  assert.equal((await get(`/en/review/${o.number}?t=${'0'.repeat(32)}`)).status, 404)
})

test('review photos: location removed, private until approved, deleted with the review', async () => {
  const form = (file: Blob | null, extra: Record<string, string> = {}) => {
    const fd = new FormData()
    for (const [k, v] of Object.entries({ lang: 'en', rating: '4', name: 'Photo Person', product_id: '1', ...extra })) fd.append(k, v)
    if (file) fd.append('photo', file, 'p.jpg')
    return app.request(ORIGIN + '/api/reviews', { method: 'POST', headers: { origin: ORIGIN, 'cf-connecting-ip': freshIp() }, body: fd }, env)
  }
  assert.equal((await form(new Blob([bytes([0x89], 'PNG\r\n\x1a\n', 'x'.repeat(50))]))).status, 415)
  assert.equal((await form(new Blob([new Uint8Array(3 * 1024 * 1024 + 10)]))).status, 413)
  assert.equal((await form(new Blob([jpegWithExif()]), { text: 'With photo' })).status, 200)
  const r = lastReview()
  const key = String(r.photo_key)
  assert.match(key, /^rv\/[0-9a-f]{24}$/)
  const saved = store.get(key)!
  assert.ok(!has(saved.bytes, 'Exif') && !has(saved.bytes, 'GPS'), 'stored without location')
  assert.equal(saved.type, 'image/jpeg')

  assert.equal((await get(`/m/${key}`)).status, 404, 'never through the public media path')
  assert.equal((await get(`/api/review-photo/${r.id}`)).status, 404, 'not before approval')
  assert.equal((await get(`/admin/reviews/${r.id}/photo`)).status, 302, 'admin preview needs a login')
  const prev = await get(`/admin/reviews/${r.id}/photo`, asAdmin)
  assert.equal(prev.status, 200)
  assert.equal(prev.headers.get('cache-control'), 'private, no-store')
  const list = await html('/admin/reviews', asAdmin)
  assert.ok(list.includes('With photo') && list.includes(`data-rv="${r.id}:approve_nophoto"`))

  await send(`/admin/api/reviews/${r.id}`, { action: 'approve' }, asAdmin)
  const pub = await get(`/api/review-photo/${r.id}`)
  assert.equal(pub.status, 200)
  assert.ok((await html('/en/p/1')).includes(`/api/review-photo/${r.id}`))

  await send(`/admin/api/reviews/${r.id}`, { action: 'approve_nophoto' }, asAdmin)
  assert.ok(!store.has(key), 'photo deleted')
  assert.equal((await get(`/api/review-photo/${r.id}`)).status, 404)
  assert.ok((await html('/en/p/1')).includes('With photo'), 'review stays, without the photo')

  assert.equal((await form(new Blob([webpWithExif()]), { name: 'Webp Person', product_id: '3' })).status, 200)
  const w = lastReview()
  assert.ok(store.has(String(w.photo_key)))
  assert.equal(store.get(String(w.photo_key))!.type, 'image/webp')
  assert.equal((await call('DELETE', `/admin/api/reviews/${w.id}`, undefined, asAdmin)).status, 200)
  assert.ok(!store.has(String(w.photo_key)), 'deleting the review deletes its photo')
  assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM reviews WHERE id = ?').get(w.id)!.n, 0)
})

test('admin order page: "Ask for a review" only for delivered orders while reviews are on', async () => {
  const o = await order('0916000001')
  let page = await html(`/admin/orders/${o.id}`, asAdmin)
  assert.ok(page.includes('Available once the order is marked Delivered'))
  await deliver(o.id)
  page = await html(`/admin/orders/${o.id}`, asAdmin)
  const m = /href="(https:\/\/wa\.me\/218916000001\?text=[^"]+)"[^>]*>Ask for a review/.exec(page)
  assert.ok(m, 'button present')
  const text = decodeURIComponent(m[1].split('text=')[1].replace(/&amp;/g, '&'))
  assert.ok(text.includes(`${ORIGIN}/en/review/${o.number}?t=${o.token}`) && text.startsWith('Hello Sara,'), text)
  await sw('reviews_on', false)
  assert.ok((await html(`/admin/orders/${o.id}`, asAdmin)).includes('Reviews are switched off'))
  assert.equal((await review({ product_id: 1 })).status, 403)
  await sw('reviews_on', true)
  assert.equal((await send('/admin/api/r3-switch', { key: 'delivery_on', on: true }, asAdmin)).status, 400, 'only the two new switches')
})

test('trust page: facts always, owner text and gallery from the admin; delivery page rules and prices', async () => {
  let en = await html('/en/page/trust')
  assert.ok(en.includes('Authentic, in its original box') && en.includes('/en/page/delivery'))
  assert.ok((await html('/ar/page/trust')).includes('أصلية وفي علبتها الأصلية'))
  const v = setting('catalog_v')
  const r = await send('/admin/api/trust', {
    trust_text_en: 'We have served Libya since 2019.', trust_text_ar: 'نخدمكم منذ 2019',
    gallery: [{ url: '/m/b/0123456789abcdef01-1080', cap_en: 'Original boxes', cap_ar: 'العلب الأصلية' }, { url: 'javascript:alert(1)' }, { url: '/m/rv/abc' }],
  }, asAdmin)
  assert.deepEqual(await r.json(), { ok: true, photos: 1 })
  assert.notEqual(setting('catalog_v'), v)
  en = await html('/en/page/trust')
  assert.ok(en.includes('We have served Libya since 2019.') && en.includes('/m/b/0123456789abcdef01-1080') && en.includes('Original boxes'))
  assert.ok(!en.includes('javascript:'))
  assert.ok((await html('/admin/trust', asAdmin)).includes('Original boxes'))
  assert.ok((await html('/admin/reviews', asAdmin)).includes('Waiting for you'))

  const p = await html('/en/p/1')
  assert.ok(p.includes('href="/en/page/trust"') && p.includes('Original gift receipt'))
  let d = await html('/en/page/delivery')
  assert.ok(d.includes('paid in cash to the driver') && !d.includes('del-table'), 'rules without a price table while delivery fees are off')
  DB.sqlite.exec("UPDATE settings SET value = '1' WHERE key = 'delivery_on'; UPDATE delivery_areas SET price = 15000 WHERE id = 1")
  await sw('reviews_on', true) // any admin change refreshes the shop
  d = await html('/en/page/delivery')
  assert.ok(d.includes('del-table') && d.includes('15 LYD'), 'price table')
  assert.ok((await html('/en/p/1')).includes('/en/page/delivery'))
  assert.ok((await get('/sitemap.xml').then((x) => x.text())).includes('/en/page/trust'))
})

test('the private order page also sends no referrer', async () => {
  const o = await order('0917000001')
  const r = await get(`/en/order/${o.number}?t=${o.token}`)
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer')
  assert.equal((await get('/en/')).headers.get('referrer-policy'), 'strict-origin-when-cross-origin')
})
