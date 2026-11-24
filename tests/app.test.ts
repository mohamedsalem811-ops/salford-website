// The whole app against the real database schema: shop pages, a full order, the order link, the admin.
// Run: npm test
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import app from '../src/index'
import { makeD1 } from './d1'

const DB = makeD1()
const env = { DB, PREVIEW_KEY: 'k' } as never
const ORIGIN = 'https://shop.test'
const get = (path: string, headers: Record<string, string> = {}) => app.request(ORIGIN + path, { headers }, env)
const send = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(ORIGIN + path, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) }, env)

DB.sqlite.exec(`
  UPDATE settings SET value = '218912345678' WHERE key = 'whatsapp';
  INSERT INTO products (id, code, brand_id, category_id, name_en, short_en, short_ar, price) VALUES
    (1, '5732414', 'swarovski', 'necklaces', 'Swan Pendant', 'Blue crystal swan', 'بجعة كريستال زرقاء', 250000),
    (2, '5600001', 'swarovski', 'bracelets', 'Tennis Bracelet', '', '', 400000),
    (3, '5600002', 'swarovski', 'rings', 'Draft Ring', '', '', 100000);
  UPDATE products SET status = 'draft' WHERE id = 3;
  INSERT INTO media (product_id, kind, source, r2_key, sizes, status) VALUES
    (1, 'image', 'upload', 'p/1/a', '[400,900]', 'ok'), (2, 'image', 'upload', 'p/2/a', '[400,900]', 'ok'), (3, 'image', 'upload', 'p/3/a', '[400]', 'ok');
  INSERT INTO admins (id, email, pass_hash, salt) VALUES (1, 'owner@shop.test', 'x', 'x');
`)
const adminToken = 'a'.repeat(64)
DB.sqlite.prepare("INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, 1, datetime('now', '+1 hour'))").run(createHash('sha256').update(adminToken).digest('hex'))
const asAdmin = { cookie: `sl_admin=${adminToken}` }

test('shop pages open', async () => {
  for (const p of ['/ar/', '/en/', '/en/shop', '/ar/brands', '/en/brand/swarovski', '/en/p/1', '/ar/p/1', '/en/cart', '/en/checkout', '/sitemap.xml']) {
    const r = await get(p)
    assert.equal(r.status, 200, p)
  }
  const shop = await (await get('/en/shop')).text()
  assert.ok(shop.includes('Swan Pendant') && shop.includes('Tennis Bracelet'))
  assert.ok(!shop.includes('Draft Ring'), 'drafts stay hidden')
  assert.equal((await get('/en/p/3')).status, 404)
  const r = await get('/en/products?brand=swarovski&cat=necklaces')
  assert.equal(r.status, 301)
  assert.equal(r.headers.get('location'), '/en/brand/swarovski?cat=necklaces')
})

test('cart prices come from the shop', async () => {
  const r = await get('/api/cart?lang=en&ids=1,2,3')
  const d = (await r.json()) as { items: { id: number }[] }
  assert.deepEqual(d.items.map((x) => x.id).sort(), [1, 2])
})

test('a full order: checkout → order link → admin', async () => {
  const bad = await send('/api/orders', { lang: 'en', name: 'Sara', phone: '0981234567', city: 'Benghazi', payment: 'cod_cash', channel: 'whatsapp', items: [{ id: 1, qty: 1 }] })
  assert.equal(bad.status, 422)
  assert.deepEqual(((await bad.json()) as { fields: string[] }).fields, ['phone'])
  const robot = await send('/api/orders', { lang: 'en', name: 'Bot', phone: '0912345678', city: 'X', payment: 'cod_cash', channel: 'whatsapp', website: 'spam', items: [{ id: 1 }] })
  assert.equal(robot.status, 400)

  const r = await send('/api/orders', {
    lang: 'en', name: 'Sara', phone: '٠٩١٢٣٤٥٦٧٨', city: 'Benghazi', address: 'Fwayhat', note: 'gift', payment: 'lypay', channel: 'whatsapp',
    items: [{ id: 1, qty: 2 }, { id: 2, qty: 1 }, { id: 3, qty: 1 }],
  })
  assert.equal(r.status, 200)
  const d = (await r.json()) as { number: string; token: string; message: string; unavailable: unknown[] }
  assert.match(d.number, /^SL-\d+$/)
  assert.match(d.token, /^[0-9a-f]{32}$/)
  assert.ok(d.message.includes('0912345678') && d.message.includes('Swan Pendant') && d.message.includes('900'))
  assert.ok(!d.message.includes('Draft Ring'))

  // the order link works in any browser, and only with its token
  const page = await get(`/en/order/${d.number}?t=${d.token}`)
  assert.equal(page.status, 200)
  const html = await page.text()
  for (const part of ['data-order-page', 'data-open', 'data-msg', 'https://wa.me/218912345678', 'Swan Pendant', 'Tennis Bracelet', '900']) assert.ok(html.includes(part), part)
  assert.equal((await get(`/en/order/${d.number}`)).status, 404)
  assert.equal((await get(`/en/order/${d.number}?t=${'0'.repeat(32)}`)).status, 404)

  // the admin sees it, in Libya time, with its lines
  const list = await get('/admin/orders', asAdmin)
  assert.equal(list.status, 200)
  assert.ok((await list.text()).includes(d.number))
  const id = Number(d.number.slice(3)) - 1000
  const detail = await get(`/admin/orders/${id}`, asAdmin)
  assert.equal(detail.status, 200)
  const dh = await detail.text()
  assert.ok(dh.includes('Swan Pendant') && dh.includes('Tennis Bracelet') && dh.includes('Libya time'))
  const upd = await send(`/admin/api/orders/${id}`, { status: 'confirmed', admin_note: 'called' }, asAdmin)
  assert.equal(upd.status, 200)
  assert.notEqual((await get('/admin/orders')).status, 200, 'admin needs a login')
})

test('admin changes show in the shop at once; other copies within seconds', async () => {
  assert.ok(!(await (await get('/en/p/2')).text()).includes('Out of stock'))
  const t = await send('/admin/api/products/2/toggle', { field: 'in_stock' }, asAdmin)
  assert.equal(t.status, 200)
  assert.ok((await (await get('/en/p/2')).text()).includes('Out of stock'), 'same copy is refreshed straight away')

  // a change saved through another server copy: visitors here see it after the re-check interval
  mock.timers.enable({ apis: ['Date'], now: Date.now() })
  try {
    await get('/en/p/1') // warm
    DB.sqlite.exec("UPDATE products SET name_en = 'Swan Pendant Renamed' WHERE id = 1; UPDATE settings SET value = 'other' WHERE key = 'catalog_v'")
    assert.ok(!(await (await get('/en/p/1')).text()).includes('Renamed'))
    mock.timers.tick(16_000)
    assert.ok((await (await get('/en/p/1')).text()).includes('Renamed'))
  } finally {
    mock.timers.reset()
  }
})

test('settings: pasted WhatsApp and Instagram links are cleaned', async () => {
  const r = await send('/admin/api/settings', { whatsapp: '091 234 5678', instagram: 'https://www.instagram.com/salford.libya?igsh=abc', facebook: 'facebook.com/SalfordLibya', pay_cod_cash: true, pay_lypay: true }, asAdmin)
  assert.equal(r.status, 200)
  const s = Object.fromEntries(DB.sqlite.prepare('SELECT key, value FROM settings').all().map((x) => [(x as { key: string }).key, (x as { value: string }).value]))
  assert.equal(s.whatsapp, '218912345678')
  assert.equal(s.instagram, 'https://www.instagram.com/salford.libya/')
  assert.equal(s.facebook, 'https://facebook.com/SalfordLibya')
  assert.equal(s.pay_cod_card, '0')
})
