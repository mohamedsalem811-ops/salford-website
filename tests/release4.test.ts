// Release 4 end to end: spend-more levels, flash deals, free gift, extras-only offers, "coming soon" + Remind me,
// the early access link, the offer report, the occasions calendar and the image maker, through the real routes and schema.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import app from '../src/index'
import { makeD1 } from './d1'
import { earlyMessage, startedMessage } from '../src/routes/admin-r4'

const DB = makeD1()
const env = { DB, PREVIEW_KEY: 'k' } as never
const ORIGIN = 'https://shop.test'
const get = (path: string, headers: Record<string, string> = {}) => app.request(ORIGIN + path, { headers }, env)
const call = (method: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(ORIGIN + path, { method, headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, env)
const send = (path: string, body: unknown, headers: Record<string, string> = {}) => call('POST', path, body, headers)

DB.sqlite.exec(`
  UPDATE settings SET value = '218912345678' WHERE key = 'whatsapp';
  INSERT INTO products (id, code, brand_id, category_id, name_en, price, compare_price, in_stock) VALUES
    (1, '5732414', 'swarovski', 'necklaces', 'Swan Pendant', 250000, NULL, 1),
    (2, '5600001', 'swarovski', 'bracelets', 'Tennis Bracelet', 400000, NULL, 1),
    (3, '5600003', 'swarovski', 'rings', 'Sale Ring', 200000, 300000, 1),
    (4, '5600004', 'tiffany', 'rings', 'Never Ring', 500000, NULL, 1),
    (5, 'GIFT-1', 'swarovski', 'rings', 'Gift Pouch', 60000, NULL, 1);
  UPDATE products SET no_discount = 1 WHERE id = 4;
  INSERT INTO media (product_id, kind, source, r2_key, sizes, status) VALUES
    (1, 'image', 'upload', 'p/1/a', '[400,900]', 'ok'), (2, 'image', 'upload', 'p/2/a', '[400,900]', 'ok'),
    (3, 'image', 'upload', 'p/3/a', '[400,900]', 'ok'), (4, 'image', 'upload', 'p/4/a', '[400,900]', 'ok'), (5, 'image', 'upload', 'p/5/a', '[400,900]', 'ok');
  INSERT INTO admins (id, email, pass_hash, salt) VALUES (1, 'owner@shop.test', 'x', 'x');
`)
const adminToken = 'd'.repeat(64)
DB.sqlite.prepare("INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, 1, datetime('now', '+1 hour'))").run(createHash('sha256').update(adminToken).digest('hex'))
const asAdmin = { cookie: `sl_admin=${adminToken}` }
// shop pages with the admin cookie re-read the catalog every time (otherwise the cache keeps it for 15 seconds)
const fresh = asAdmin

type Line = { id: number; qty: number; price: number; orig: number; flash?: boolean }
type Q = { subtotal: number; discount: number; kind: string; items: number; total: number; lines: Line[]; offer: { kind: string; tiers: unknown[] } | null
  tier: { pct: number; next: { need: number; pct: number } | null } | null; gift: { name: string; orig: number } | null; giftNeed: number; giftName: string; flashShort: { id: number; left: number }[]; delivery: { mode: string } }
const quote = async (items: { id: number; qty: number }[], h: Record<string, string> = fresh) => (await (await send('/api/quote', { lang: 'en', items }, h)).json()) as Q
let phoneN = 10
const order = async (items: { id: number; qty: number }[], h: Record<string, string> = {}) => {
  const r = await send('/api/orders', { lang: 'en', name: 'Sara', phone: `09123456${phoneN++}`, city: 'Benghazi', payment: 'cod_cash', channel: 'whatsapp', items }, h)
  assert.equal(r.status, 200, await r.clone().text())
  const d = (await r.json()) as { number: string; token: string; message: string }
  return { ...d, row: DB.sqlite.prepare('SELECT * FROM orders WHERE number = ?').get(d.number) as Record<string, unknown> }
}
const items = (n: string) => DB.sqlite.prepare('SELECT i.* FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.number = ? ORDER BY i.rowid').all(n) as Record<string, unknown>[]
const setting = (k: string) => (DB.sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(k) as { value: string } | undefined)?.value
const offerForm = (more: Record<string, unknown>) => ({ template: 'flash', kind: 'percent', percent: 20, scope_mode: 'all', starts_at: '', ends_at: '2099-01-01T00:00', enabled: true, show_banner: true, show_strip: true, show_countdown: true, ...more })
const save = async (more: Record<string, unknown>, id = 0) => {
  const r = await call(id ? 'PUT' : 'POST', `/admin/api/offers${id ? `/${id}` : ''}`, offerForm(more), asAdmin)
  return { status: r.status, d: (await r.json()) as { id: number; error?: string } }
}
const offerRow = (id: number) => DB.sqlite.prepare('SELECT * FROM offers WHERE id = ?').get(id) as Record<string, unknown>
// direct changes in the database: write a new catalog_v so the shop re-reads (the admin API does this itself)
let bumps = 0
const touch = () => DB.sqlite.prepare("UPDATE settings SET value = ? WHERE key = 'catalog_v'").run(`t${++bumps}`)
const sql = (q: string, ...a: unknown[]) => { DB.sqlite.prepare(q).run(...(a as never[])); touch() }
const off = (id: number) => sql('UPDATE offers SET enabled = 0 WHERE id = ?', id)

test('offer form: spend-more levels are checked and stored lowest first', async () => {
  assert.equal((await save({ kind: 'tiers' })).status, 400, 'at least one level')
  assert.match((await save({ kind: 'tiers', tier_min_0: '1000', tier_pct_0: '10', tier_min_1: '500', tier_pct_1: '15' })).d.error!, /bigger amount and give a bigger %/)
  assert.equal((await save({ kind: 'tiers', tier_min_0: '500', tier_pct_0: '95' })).status, 400)
  const { status, d } = await save({ template: 'bf', kind: 'tiers', tier_min_0: '500', tier_pct_0: '10', tier_min_1: '1000', tier_pct_1: '15', percent: 70 })
  assert.equal(status, 200)
  const o = offerRow(d.id)
  assert.equal(o.kind, 'tiers')
  assert.equal(o.percent, 15, 'the top level')
  assert.deepEqual(JSON.parse(String(o.tiers)), [{ min: 500000, pct: 10 }, { min: 1000000, pct: 15 }])
  assert.match(String(o.early_token), /^[0-9a-f]{32}$/, 'every offer gets a private early access token')

  // the cart: below the first level → no discount, with what is missing; above → the level's %
  const low = await quote([{ id: 1, qty: 1 }])
  assert.equal(low.discount, 0)
  assert.equal(low.offer?.kind, 'tiers')
  assert.deepEqual(low.tier?.next, { min: 500000, pct: 10, need: 250000 })
  const mid = await quote([{ id: 1, qty: 1 }, { id: 2, qty: 1 }])
  assert.equal(mid.items, 225000 + 360000)
  const page = await (await get('/en/p/1', fresh)).text()
  assert.ok(page.includes('Spend more, save more'), 'product page shows the levels')
  const home = await (await get('/en/', fresh)).text()
  assert.ok(/up to 15% off/i.test(home), 'default words say "up to"')
  off(d.id)
})

test('offer form: flash deals, the free gift and extras-only offers', async () => {
  assert.match((await save({ flash: 'NOPE-1, 100' })).d.error!, /not found/)
  assert.match((await save({ flash: '5732414, 300' })).d.error!, /less than the normal price/)
  assert.match((await save({ flash: '5600004, 100' })).d.error!, /Never discount/)
  assert.match((await save({ flash: '5732414, 100\n5732414, 90' })).d.error!, /listed twice/)
  assert.match((await save({ flash: '5732414, 100, x' })).d.error!, /whole number/)
  assert.match((await save({ gift_code: 'GIFT-1' })).d.error!, /order amount/)
  assert.match((await save({ kind: 'none' })).d.error!, /at least one extra/)
  assert.match((await save({ teaser_days: 3 })).d.error!, /need a start time/)

  const { status, d } = await save({ kind: 'none', flash: '5732414, 150, 2\n5600001, 25%', gift_code: 'gift-1', gift_min: '300' })
  assert.equal(status, 200, d.error)
  const o = offerRow(d.id)
  assert.equal(o.percent, 0)
  assert.equal(o.gift_product_id, 5)
  assert.equal(o.gift_min, 300000)
  const flash = DB.sqlite.prepare('SELECT product_id, price, max_qty FROM offer_flash WHERE offer_id = ? ORDER BY sort').all(d.id) as Record<string, number>[]
  assert.deepEqual(flash.map((f) => [f.product_id, f.price, f.max_qty]), [[1, 150000, 2], [2, 300000, 0]], '400 − 25% = 300')

  // shop: flash price and "only 2 left"; other products keep their price (no % in this offer)
  const card = await (await get('/en/p/1', fresh)).text()
  assert.ok(card.includes('150') && card.includes('<s>250'), 'flash price with the old one crossed out')
  assert.ok(/2 left/i.test(card), '"X left" counter')
  const q = await quote([{ id: 1, qty: 1 }, { id: 3, qty: 1 }])
  assert.equal(q.lines.find((l) => l.id === 1)!.flash, true)
  assert.equal(q.lines.find((l) => l.id === 3)!.price, 200000)
  assert.equal(q.gift?.orig, 60000, '150 + 200 = 350 ≥ 300 → the gift')
  const near = await quote([{ id: 1, qty: 1 }])
  assert.equal(near.gift, null)
  assert.equal(near.giftNeed, 150000)
  assert.equal(near.giftName, 'Gift Pouch')

  // order: the gift line costs 0, the flash line keeps its deal id, and the counter goes down
  const v = setting('catalog_v')
  const r = await order([{ id: 1, qty: 2 }])
  assert.equal(r.row.offer_id, d.id)
  assert.equal(r.row.total, 300000, 'two at the flash price, the gift free')
  const li = items(r.number)
  assert.equal(li.length, 2)
  assert.equal(li[0].flash_id, (DB.sqlite.prepare('SELECT id FROM offer_flash WHERE offer_id = ? AND product_id = 1').get(d.id) as { id: number }).id)
  assert.deepEqual([li[1].product_id, li[1].price, li[1].orig_price, li[1].is_gift], [5, 0, 60000, 1])
  assert.ok(r.message.includes('🎁') && r.message.includes('Free gift'), r.message)
  assert.notEqual(setting('catalog_v'), v, 'a flash sale refreshes the counter in the shop')
  // all pieces sold at the flash price → back to the normal price
  const after = await quote([{ id: 1, qty: 1 }])
  assert.equal(after.lines[0].price, 250000)
  assert.equal(after.lines[0].flash, undefined)
  // a gift that is sold out is not given
  sql('UPDATE products SET in_stock = 0 WHERE id = 5')
  assert.equal((await quote([{ id: 2, qty: 1 }])).gift, null)
  sql('UPDATE products SET in_stock = 1 WHERE id = 5')

  // admin: the offer form lists sold/left; saving the same lines keeps the deal ids (so the sold count stays)
  const ids = DB.sqlite.prepare('SELECT id FROM offer_flash WHERE offer_id = ? ORDER BY id').all(d.id)
  assert.equal((await save({ kind: 'none', flash: '5732414, 150, 3\n5600001, 300', gift_code: 'GIFT-1', gift_min: '300' }, d.id)).status, 200)
  assert.deepEqual(DB.sqlite.prepare('SELECT id FROM offer_flash WHERE offer_id = ? ORDER BY id').all(d.id), ids)
  const form = await (await get(`/admin/offers/${d.id}`, asAdmin)).text()
  assert.ok(form.includes('5732414, 150, 3') && form.includes('No % off'))
  // the report counts this offer's orders, gift orders and flash sales (while the gift is still part of it)
  const rep = await (await get(`/admin/offers/${d.id}/report`, asAdmin)).text()
  assert.ok(rep.includes('Orders with the free gift: <b>1</b>'), 'gift orders')
  assert.ok(rep.includes('Top products') && rep.includes('Swan Pendant'))
  assert.equal((await save({ kind: 'none', flash: '5600001, 300' }, d.id)).status, 200)
  assert.equal((DB.sqlite.prepare('SELECT count(*) AS n FROM offer_flash WHERE offer_id = ?').get(d.id) as { n: number }).n, 1, 'lines taken out are dropped')

  // image maker
  const img = await (await get(`/admin/offers/${d.id}/image`, asAdmin)).text()
  assert.ok(img.includes('id="img-data"') && img.includes('/m/p/'), 'same-origin photos for the canvas')
  off(d.id)
})

test('free delivery in an extras-only offer', async () => {
  DB.sqlite.exec("UPDATE settings SET value = '1' WHERE key = 'delivery_on'; UPDATE delivery_areas SET price = 20000 WHERE id = 1")
  touch()
  const { d } = await save({ kind: 'none', free_delivery: true })
  const q = (await (await send('/api/quote', { lang: 'en', items: [{ id: 1, qty: 1 }], area_id: 1 }, fresh)).json()) as Q
  assert.equal(q.delivery.mode, 'free')
  off(d.id)
  sql("UPDATE settings SET value = '0' WHERE key = 'delivery_on'")
})

test('coming soon page with Remind me, then early access with the private link', async () => {
  const { status, d } = await save({ percent: 30, starts_at: '2099-01-01T00:00', ends_at: '2099-01-05T00:00', teaser_days: 3, early_hours: 24 })
  assert.equal(status, 200, d.error)
  // not yet in the teaser window → no coming soon
  assert.equal((await get('/en/offer', fresh)).status, 302)
  // move it to start in 10 hours
  sql("UPDATE offers SET starts_at = datetime('now', '+10 hours'), ends_at = datetime('now', '+3 days') WHERE id = ?", d.id)
  const home = await (await get('/en/', fresh)).text()
  assert.ok(home.includes('tstrip') && /coming soon/i.test(home), 'strip and banner say coming soon')
  const page = await (await get('/en/offer', fresh)).text()
  assert.ok(page.includes(`data-remind="${d.id}"`) && page.includes('noindex'))
  assert.equal((await quote([{ id: 1, qty: 1 }])).discount, 0, 'no discount before it starts')

  // Remind me: checked, one per phone, honeypot, and it does not refresh the shop
  const v = setting('catalog_v')
  const rm = (b: Record<string, unknown>, ip = '10.1.0.1') => send('/api/remind', { offer_id: d.id, lang: 'ar', name: 'Huda', phone: '0921234567', website: '', ...b }, { 'cf-connecting-ip': ip })
  assert.equal((await rm({ phone: '12' })).status, 422)
  assert.equal((await rm({ website: 'x' })).status, 400)
  assert.equal((await rm({})).status, 200)
  assert.equal((await rm({ name: 'Huda A' })).status, 200)
  assert.equal((await rm({ offer_id: 999 })).status, 409)
  const rows = DB.sqlite.prepare('SELECT name, lang FROM offer_reminders WHERE offer_id = ?').all(d.id) as Record<string, string>[]
  assert.deepEqual(rows.map((r) => r.name), ['Huda A'], 'one entry per phone')
  assert.equal(setting('catalog_v'), v)

  // early access: the link sets a cookie; with it the offer is open now, without it not
  const o = offerRow(d.id)
  const wrong = await get('/en/?early=' + 'f'.repeat(32))
  assert.ok(!(wrong.headers.get('set-cookie') ?? '').includes('sl_early'), 'a wrong token sets nothing')
  const r = await get(`/en/?early=${o.early_token}`)
  const ck = r.headers.get('set-cookie') ?? ''
  assert.ok(ck.includes(`sl_early=${o.early_token}`) && /HttpOnly/i.test(ck))
  const early = { cookie: `sl_early=${o.early_token}; ${asAdmin.cookie}` }
  const eh = await (await get('/en/', early)).text()
  assert.ok(eh.includes('Early access'), 'strip says early access')
  const eq = await quote([{ id: 1, qty: 1 }], early)
  assert.equal(eq.items, 175000, '250 − 30%')
  const eo = await order([{ id: 1, qty: 1 }], { cookie: `sl_early=${o.early_token}` })
  assert.equal(eo.row.early, 1)
  assert.equal(eo.row.total, 175000)
  // more than early_hours before the start: the link does not open it yet
  sql("UPDATE offers SET starts_at = datetime('now', '+30 hours') WHERE id = ?", d.id)
  assert.equal((await quote([{ id: 1, qty: 1 }], early)).discount, 0)
  sql("UPDATE offers SET starts_at = datetime('now', '+10 hours') WHERE id = ?", d.id)

  // admin people page: returning customers (a delivered order) and the reminders; sending marks them, without refreshing the shop
  sql("UPDATE orders SET status = 'delivered' WHERE number = ?", eo.number)
  const pp = await (await get(`/admin/offers/${d.id}/people`, asAdmin)).text()
  assert.ok(pp.includes(`?early=${o.early_token}`) && pp.includes('data-early-sent') && pp.includes('Huda A'))
  assert.ok(pp.includes('Send when it starts'), 'reminders wait for the start')
  const v2 = setting('catalog_v')
  assert.equal((await send(`/admin/api/offers/${d.id}/early-sent`, { phone: String(eo.row.phone) }, asAdmin)).status, 200)
  assert.equal((await send(`/admin/api/offers/${d.id}/early-sent`, { phone: 'x' }, asAdmin)).status, 400)
  const rid = (DB.sqlite.prepare('SELECT id FROM offer_reminders WHERE offer_id = ?').get(d.id) as { id: number }).id
  assert.equal((await send(`/admin/api/reminders/${rid}/sent`, {}, asAdmin)).status, 200)
  assert.equal(setting('catalog_v'), v2, 'messages sent do not refresh the shop')
  assert.ok(DB.sqlite.prepare('SELECT notified_at FROM offer_reminders WHERE id = ?').get(rid))
  // the API needs the admin
  assert.equal((await send(`/admin/api/reminders/${rid}/sent`, {})).status, 401)

  // once it runs: coming soon page goes to the shop, Remind me says it's gone
  sql("UPDATE offers SET starts_at = datetime('now', '-1 hour') WHERE id = ?", d.id)
  assert.equal((await get('/en/offer', fresh)).status, 302)
  assert.equal((await rm({ phone: '0921234568' }, '10.1.0.2')).status, 409)
  // admin previews of a coming soon page while another offer runs
  const pv = await (await get(`/ar/?teaser_preview=${d.id}`, asAdmin)).text()
  assert.ok(pv.includes('tstrip') || pv.includes('obanner'))
  off(d.id)
})

test('messages: early access and "it started" in both languages', () => {
  const e = earlyMessage('ar', { name: 'سارة', offer: 'رأس السنة', starts: '1 يناير، 00:00', hours: 24, link: 'https://salfordlibya.com/ar/?early=x' })
  assert.ok(e.includes('سارة') && e.includes('24') && e.includes('?early=x'))
  assert.ok(earlyMessage('en', { name: 'Sara', offer: 'New Year', starts: '1 January', hours: 12, link: 'L' }).includes('12 hours before everyone else'))
  assert.ok(startedMessage('en', { name: 'Sara', offer: 'New Year', link: 'L' }).includes('has started'))
})

test('occasions calendar and the reminder on the admin home', async () => {
  const cal = await (await get('/admin/calendar', asAdmin)).text()
  assert.ok(cal.includes('Independence Day') && cal.includes('Ramadan'), 'seeded occasions')
  const v = setting('catalog_v')
  const day = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  assert.equal((await send('/admin/api/occasions', { name_ar: 'اختبار', name_en: 'Test Day', day: 'bad', template: 'flash', pct: 10, remind_days: 7 }, asAdmin)).status, 400)
  const r = await send('/admin/api/occasions', { name_ar: 'اختبار', name_en: 'Test Day', day, template: 'flash', pct: 10, remind_days: 7 }, asAdmin)
  assert.equal(r.status, 200)
  const id = ((await r.json()) as { id: number }).id
  assert.equal(setting('catalog_v'), v, 'the calendar does not refresh the shop')
  const home = await (await get('/admin', asAdmin)).text()
  assert.ok(home.includes('Test Day') && home.includes(`/admin/offers/new?look=flash&amp;pct=10&amp;start=${day}`), 'admin home reminds, with a ready offer link')
  // the new offer form comes filled in from the calendar
  const nf = await (await get(`/admin/offers/new?look=flash&pct=10&start=${day}`, asAdmin)).text()
  assert.ok(nf.includes(`value="${day}T00:00"`) && nf.includes('value="10"'))
  // once an offer covers it, the reminder goes away
  const { d } = await save({ starts_at: `${day}T00:00`, ends_at: `${day}T23:00` })
  assert.ok(!(await (await get('/admin', asAdmin)).text()).includes('Test Day'))
  off(d.id)
  assert.equal((await call('PUT', `/admin/api/occasions/${id}`, { name_ar: 'اختبار', day: '2030-01-01', template: 'ny', pct: 20, remind_days: 10 }, asAdmin)).status, 200)
  assert.equal((await call('DELETE', `/admin/api/occasions/${id}`, undefined, asAdmin)).status, 200)
  assert.equal(DB.sqlite.prepare('SELECT id FROM occasions WHERE id = ?').get(id), undefined)
})
