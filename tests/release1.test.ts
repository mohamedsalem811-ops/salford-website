// Release 1 end to end: offers, discount codes and delivery prices through the real routes and schema,
// including attempts to cheat (prices sent by the browser, made-up areas, guessing codes).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import app from '../src/index'
import { makeD1 } from './d1'
import { libyaToUtc, utcToLibyaInput } from '../src/views/admin-shell'
import { assetPath } from '../src/lib/assets'
import { V } from '../src/views/layout'

const DB = makeD1()
const env = { DB, PREVIEW_KEY: 'k' } as never
const ORIGIN = 'https://shop.test'
const get = (path: string, headers: Record<string, string> = {}) => app.request(ORIGIN + path, { headers }, env)
const call = (method: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(ORIGIN + path, { method, headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) }, env)
const send = (path: string, body: unknown, headers: Record<string, string> = {}) => call('POST', path, body, headers)

DB.sqlite.exec(`
  UPDATE settings SET value = '218912345678' WHERE key = 'whatsapp';
  INSERT INTO products (id, code, brand_id, category_id, name_en, price, compare_price) VALUES
    (1, '5732414', 'swarovski', 'necklaces', 'Swan Pendant', 250000, NULL),
    (2, '5600001', 'swarovski', 'bracelets', 'Tennis Bracelet', 400000, NULL),
    (3, '5600003', 'swarovski', 'rings', 'Sale Ring', 200000, 300000),
    (4, '5600004', 'tiffany', 'rings', 'Never Ring', 500000, NULL);
  UPDATE products SET no_discount = 1 WHERE id = 4;
  INSERT INTO media (product_id, kind, source, r2_key, sizes, status) VALUES
    (1, 'image', 'upload', 'p/1/a', '[400,900]', 'ok'), (2, 'image', 'upload', 'p/2/a', '[400,900]', 'ok'),
    (3, 'image', 'upload', 'p/3/a', '[400,900]', 'ok'), (4, 'image', 'upload', 'p/4/a', '[400,900]', 'ok');
  INSERT INTO admins (id, email, pass_hash, salt) VALUES (1, 'owner@shop.test', 'x', 'x');
`)
const adminToken = 'b'.repeat(64)
DB.sqlite.prepare("INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, 1, datetime('now', '+1 hour'))").run(createHash('sha256').update(adminToken).digest('hex'))
const asAdmin = { cookie: `sl_admin=${adminToken}` }

type Q = { subtotal: number; discount: number; kind: string; items: number; fee: number; total: number; lines: { id: number; price: number }[]; code: { status: string; saving: number } | null; delivery: { mode: string; fee: number; time: string }; deliveryOn: boolean; products: { id: number; price: number; inStock: boolean }[] }
type O = { number: string; token: string; message: string; total: string; codeNote: string }
const quote = async (b: Record<string, unknown>, h: Record<string, string> = {}) => (await (await send('/api/quote', { lang: 'en', ...b }, h)).json()) as Q
let phoneN = 10
const order = async (b: Record<string, unknown>) => {
  const r = await send('/api/orders', { lang: 'en', name: 'Sara', phone: `09123456${phoneN++}`, city: 'Benghazi', payment: 'cod_cash', channel: 'whatsapp', ...b })
  return { status: r.status, d: (await r.json()) as O }
}
const row = (n: string) => DB.sqlite.prepare('SELECT * FROM orders WHERE number = ?').get(n) as Record<string, unknown>
const both = [{ id: 1, qty: 1 }, { id: 2, qty: 1 }]

test('Libya time ↔ UTC (Libya is UTC+2)', () => {
  assert.equal(libyaToUtc('2026-12-24T00:00'), '2026-12-23 22:00:00')
  assert.equal(utcToLibyaInput('2026-12-23 22:00:00'), '2026-12-24T00:00')
  assert.equal(libyaToUtc('nonsense'), null)
})

test('scripts and styles are served by the worker', async () => {
  for (const f of ['site.js', 'site.css', 'admin.js', 'admin.css']) {
    const r = await get(assetPath(f, V))
    assert.equal(r.status, 200, f)
    assert.match(r.headers.get('cache-control') ?? '', /immutable/)
  }
})

test('features off: prices, message and order page are exactly as before', async () => {
  const q = await quote({ items: both })
  assert.equal(q.discount, 0)
  assert.equal(q.total, 650000)
  assert.equal(q.delivery.mode, 'off')
  assert.equal(q.deliveryOn, false)
  const ck = await (await get('/en/checkout')).text()
  assert.ok(!ck.includes('data-codebox'), 'no code box while no code is switched on')
  assert.ok(!ck.includes('data-city'), 'free-text city while delivery prices are off')
  const home = await (await get('/en/')).text()
  assert.ok(!home.includes('obanner') && !home.includes('ostrip'))
  const { status, d } = await order({ items: both })
  assert.equal(status, 200)
  const lines = d.message.split('\n')
  assert.deepEqual(lines.slice(2, 5), ['1) Swarovski · Swan Pendant · 5732414 · 250 LYD', '2) Swarovski · Tennis Bracelet · 5600001 · 400 LYD', 'Total: 650 LYD'])
  assert.ok(!/Items:|Discount|Delivery/.test(d.message))
  assert.ok(lines.includes('City: Benghazi'))
  const page = await (await get(`/en/order/${d.number}?t=${d.token}`)).text()
  assert.ok(!page.includes('r-disc') && !page.includes('r-del'))
})

test('prices sent by the browser are ignored', async () => {
  const q = await quote({ items: [{ id: 1, qty: 1, price: 1 }], subtotal: 1, discount: 999999 })
  assert.equal(q.total, 250000)
  const { d } = await order({ items: [{ id: 1, qty: 1, price: 1, orig_price: 1 }], total: 1, discount: 250000, delivery_fee: -100 })
  assert.equal(row(d.number).total, 250000)
})

test('an offer: shop prices, quote, order and message', async () => {
  const bad = await send('/admin/api/offers', { template: 'ind', percent: 95, ends_at: '2099-01-01T00:00' }, asAdmin)
  assert.equal(bad.status, 400)
  const noEnd = await send('/admin/api/offers', { template: 'ind', percent: 24 }, asAdmin)
  assert.equal(noEnd.status, 400)
  const r = await send('/admin/api/offers', { template: 'ind', percent: 24, scope_mode: 'all', starts_at: '', ends_at: '2099-01-01T00:00', enabled: true, show_banner: true, show_strip: true, show_countdown: true }, asAdmin)
  assert.equal(r.status, 200)
  const oid = ((await r.json()) as { id: number }).id
  assert.equal((DB.sqlite.prepare('SELECT ends_at FROM offers WHERE id = ?').get(oid) as { ends_at: string }).ends_at, '2098-12-31 22:00:00')

  const home = await (await get('/ar/')).text()
  assert.ok(home.includes('class="obanner') && home.includes('class="ostrip') && home.includes('data-cd='), 'banner, strip and countdown')
  assert.ok(home.includes('عيد الاستقلال'))
  const p1 = await (await get('/en/p/1')).text()
  assert.ok(p1.includes('190') && p1.includes('<s>250'), '250 − 24% = 190, old price crossed out')
  assert.ok(p1.includes('"price":"190.000"') || p1.includes('"price":190') || p1.includes('"price":"190"'), 'Google sees the offer price')
  assert.ok(p1.includes('priceValidUntil'))
  // its own crossed-out price, or "never discount": not discounted again
  const q = await quote({ items: [...both, { id: 3, qty: 1 }, { id: 4, qty: 1 }] })
  const price = (id: number) => q.lines.find((l) => l.id === id)!.price
  assert.deepEqual([price(1), price(2), price(3), price(4)], [190000, 300000, 200000, 500000])
  assert.equal(q.kind, 'offer')
  assert.equal(q.discount, 160000)

  const { d } = await order({ items: both })
  assert.equal(row(d.number).total, 490000)
  assert.equal(row(d.number).discount_kind, 'offer')
  assert.ok(d.message.includes('Items: 650 LYD') && d.message.includes('Discount (Independence Day): −160 LYD') && d.message.includes('Total: 490 LYD'), d.message)
  const items = DB.sqlite.prepare('SELECT price, orig_price FROM order_items WHERE order_id = ?').all(row(d.number).id as number) as { price: number; orig_price: number }[]
  assert.deepEqual(items.map((i) => [i.price, i.orig_price]), [[190000, 250000], [300000, 400000]])
  const adm = await (await get(`/admin/orders/${row(d.number).id}`, asAdmin)).text()
  assert.ok(adm.includes('Discount (Independence Day)'))

  // the offer is switched off: prices go back at once
  assert.equal((await call('PUT', `/admin/api/offers/${oid}`, { template: 'ind', percent: 24, scope_mode: 'all', ends_at: '2099-01-01T00:00', enabled: false, show_banner: true, show_strip: true, show_countdown: true }, asAdmin)).status, 200)
  assert.equal((await quote({ items: both })).discount, 0)
  // …and a team member can still preview it on the site; customers can't
  assert.ok((await (await get(`/ar/?offer_preview=${oid}`, asAdmin)).text()).includes('obanner'))
  assert.ok(!(await (await get(`/ar/?offer_preview=${oid}`)).text()).includes('obanner'))
  assert.ok(!(await (await get(`/ar/?offer_preview=${oid}`, { cookie: 'sl_admin=' + 'c'.repeat(64) })).text()).includes('obanner'))
  assert.equal((await call('PUT', `/admin/api/offers/${oid}`, { template: 'ind', percent: 24, scope_mode: 'all', ends_at: '2099-01-01T00:00', enabled: true, show_banner: true, show_strip: true, show_countdown: true }, asAdmin)).status, 200)
})

test('a discount code: best saving wins, per-phone limit, link and report', async () => {
  const r = await send('/admin/api/codes', { code: ' sara30 ', kind: 'percent', value: 30, per_phone: 1, commission_pct: 10, enabled: true }, asAdmin)
  assert.equal(r.status, 200)
  assert.equal((await send('/admin/api/codes', { code: 'SARA30', kind: 'percent', value: 10, enabled: true }, asAdmin)).status, 400, 'no duplicates')
  assert.ok((await (await get('/en/checkout')).text()).includes('data-codebox'), 'code box shows once a code exists')

  // 30% beats the 24% offer
  const q = await quote({ items: both, code: 'sara30' })
  assert.equal(q.kind, 'code')
  assert.equal(q.code!.status, 'ok')
  assert.equal(q.total, 175000 + 280000)
  const phone = '0923456789'
  const first = await send('/api/orders', { lang: 'en', name: 'Mona', phone, city: 'Tripoli', payment: 'cod_cash', channel: 'whatsapp', items: both, code: 'SARA30' })
  const d = (await first.json()) as O
  assert.equal(row(d.number).code, 'SARA30')
  assert.equal(row(d.number).total, 455000)
  assert.ok(d.message.includes('Discount (code SARA30): −195 LYD'), d.message)

  // the same phone again: the code is used, the offer still applies
  const again = await quote({ items: both, code: 'SARA30', phone })
  assert.equal(again.code!.status, 'used')
  assert.equal(again.kind, 'offer')
  const second = (await (await send('/api/orders', { lang: 'en', name: 'Mona', phone, city: 'Tripoli', payment: 'cod_cash', channel: 'whatsapp', items: both, code: 'SARA30' })).json()) as O
  assert.equal(second.codeNote, 'used')
  assert.equal(row(second.number).code, '')
  assert.equal(row(second.number).total, 490000)

  // a weaker code than the offer: the offer is kept
  await send('/admin/api/codes', { code: 'SMALL5', kind: 'percent', value: 5, enabled: true }, asAdmin)
  assert.equal((await quote({ items: both, code: 'SMALL5' })).code!.status, 'not_better')

  // report: delivered orders count for commission
  DB.sqlite.prepare("UPDATE orders SET status = 'delivered' WHERE number = ?").run(d.number)
  const rep = await (await get('/admin/codes', asAdmin)).text()
  assert.ok(rep.includes('SARA30') && rep.includes('455 LYD') && rep.includes('45.5 LYD'), 'sales 455, commission 10% = 45.5')
  // a used code can't be renamed or deleted
  const id = (DB.sqlite.prepare("SELECT id FROM codes WHERE code = 'SARA30'").get() as { id: number }).id
  assert.equal((await call('PUT', `/admin/api/codes/${id}`, { code: 'SARA31', kind: 'percent', value: 30, enabled: true }, asAdmin)).status, 400)
  assert.equal((await call('DELETE', `/admin/api/codes/${id}`, {}, asAdmin)).status, 400)
})

test('guessing codes is slowed down', async () => {
  const ip = { 'cf-connecting-ip': '203.0.113.9' }
  for (let i = 0; i < 20; i++) assert.equal((await quote({ items: both, code: `GUESS${i}` }, ip)).code!.status, 'invalid')
  assert.equal((await quote({ items: both, code: 'SMALL5' }, ip)).code!.status, 'slow', 'even a real code is not checked for a while')
  const { d } = await order({ items: both, code: 'GUESS99' })
  assert.equal(row(d.number).code, '', 'an invalid code is never stored')
  assert.equal((await quote({ items: both, code: 'SMALL5' }, { 'cf-connecting-ip': '198.51.100.1' })).code!.status, 'not_better', 'other customers are not affected')
})

test('delivery prices: area fee, free from a total, made-up areas', async () => {
  const tajoura = DB.sqlite.prepare("SELECT a.id FROM delivery_areas a WHERE a.city_id = 1 ORDER BY a.sort LIMIT 1").get() as { id: number }
  const bengh = DB.sqlite.prepare('SELECT id FROM delivery_areas WHERE city_id = 2 ORDER BY sort LIMIT 1').get() as { id: number }
  const r = await call('PUT', '/admin/api/delivery', { delivery_on: true, free_min: '', [`a${tajoura.id}_name_ar`]: 'تاجوراء', [`a${tajoura.id}_name_en`]: 'Tajoura', [`a${tajoura.id}_price`]: '15', [`a${tajoura.id}_time_ar`]: 'يوم', [`a${tajoura.id}_time_en`]: '1 day', [`a${tajoura.id}_enabled`]: true }, asAdmin)
  assert.equal(r.status, 200)
  assert.equal((await call('PUT', '/admin/api/delivery', { delivery_on: true, [`a${tajoura.id}_name_ar`]: 'x', [`a${tajoura.id}_price`]: '-5' }, asAdmin)).status, 400)
  const ck = await (await get('/en/checkout')).text()
  assert.ok(ck.includes('data-city') && ck.includes('areas-data'))

  const q = await quote({ items: both, area_id: tajoura.id })
  assert.equal(q.delivery.mode, 'fee')
  assert.equal(q.fee, 15000)
  assert.equal(q.total, 490000 + 15000)
  assert.equal((await quote({ items: both, area_id: bengh.id })).delivery.mode, 'chat', 'no price yet = agreed in the chat')
  assert.equal((await quote({ items: both, area_id: 999999 })).delivery.mode, 'chat', 'a made-up area is not charged or trusted')

  const { d } = await order({ items: both, area_id: tajoura.id, city: 'anything' })
  const o = row(d.number)
  assert.equal(o.total, 505000)
  assert.equal(o.delivery_fee, 15000)
  assert.equal(o.city, 'Tripoli')
  assert.ok(d.message.includes('Delivery: 15 LYD (cash to the driver)') && d.message.includes('Delivery time: 1 day') && d.message.includes('Total: 505 LYD'), d.message)
  assert.ok(d.message.includes('City: Tripoli · Tajoura'))

  // free delivery from 400 LYD (products after discount)
  await call('PUT', '/admin/api/delivery', { delivery_on: true, free_on: true, free_min: '400' }, asAdmin)
  const free = await quote({ items: both, area_id: tajoura.id })
  assert.equal(free.delivery.mode, 'free')
  assert.equal(free.total, 490000)
  const f = await order({ items: both, area_id: tajoura.id })
  assert.ok(f.d.message.includes('Delivery: Free'))
  assert.equal(row(f.d.number).delivery_free, 1)

  // the free-delivery switch: off keeps the amount but charges delivery, on again restores it, on needs an amount
  await call('PUT', '/admin/api/delivery', { delivery_on: true, free_on: false, free_min: '400' }, asAdmin)
  assert.equal((await quote({ items: both, area_id: tajoura.id })).delivery.mode, 'fee')
  assert.equal(DB.sqlite.prepare("SELECT value FROM settings WHERE key = 'free_delivery_min'").get()!.value, '400000')
  assert.ok((await (await get('/admin/delivery', asAdmin)).text()).includes('value="400"'))
  assert.equal((await call('PUT', '/admin/api/delivery', { delivery_on: true, free_on: true, free_min: '' }, asAdmin)).status, 400)
  await call('PUT', '/admin/api/delivery', { delivery_on: true, free_on: true, free_min: '400' }, asAdmin)
  assert.equal((await quote({ items: both, area_id: tajoura.id })).delivery.mode, 'free')

  // a city that is switched off is not offered or trusted
  DB.sqlite.prepare('UPDATE delivery_cities SET enabled = 0 WHERE id = 1').run()
  assert.equal((await order({ items: both, area_id: tajoura.id, city: 'Misrata' })).d.message.includes('City: Misrata'), true)
  DB.sqlite.prepare('UPDATE delivery_cities SET enabled = 1 WHERE id = 1').run()

  // switching delivery prices off brings back the old checkout
  await call('PUT', '/admin/api/delivery', { delivery_on: false, free_on: true, free_min: '400' }, asAdmin)
  assert.equal((await quote({ items: both, area_id: tajoura.id })).delivery.mode, 'off')
})

test('admin pages open', async () => {
  for (const p of ['/admin/offers', '/admin/offers/new', '/admin/offers/1', '/admin/codes', '/admin/codes/new', '/admin/codes/1', '/admin/delivery', '/admin/p/4']) {
    const r = await get(p, asAdmin)
    assert.equal(r.status, 200, p)
  }
  assert.ok((await (await get('/admin/p/4', asAdmin)).text()).includes('name="no_discount" checked'))
  for (const p of ['/admin/offers', '/admin/codes', '/admin/delivery']) assert.notEqual((await get(p)).status, 200, `${p} needs a login`)
  assert.equal((await send('/admin/api/codes', { code: 'HACK', kind: 'percent', value: 90 })).status, 401)
  assert.equal((await send('/admin/api/codes', { code: 'HACK', kind: 'percent', value: 90 }, { ...asAdmin, origin: 'https://evil.test' })).status, 403)
})

test('New Year look shows the coming year in December', async () => {
  const { offerWords } = await import('../src/lib/looks')
  const o = { template: 'ny', percent: 20, starts_at: '', ends_at: '2026-12-31 21:59:00', banner_ar: '', banner_en: '', sub_ar: '', sub_en: '', kicker_ar: '', kicker_en: '', caption_ar: '', caption_en: '', badge_ar: '', badge_en: '', name_ar: '', name_en: '' }
  assert.equal(offerWords(o, 'en').kick, '2027')
  assert.equal(offerWords({ ...o, starts_at: '2026-12-28 22:00:00', ends_at: '2027-01-03 21:59:00' }, 'en').sub, 'Start 2027 with 20% off')
  assert.equal(offerWords({ ...o, template: 'ind', starts_at: '2026-12-20 00:00:00' }, 'en').kick.includes('2027'), false)
})
