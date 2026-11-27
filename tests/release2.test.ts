// Release 2 end to end: statuses and their history, the tracker page and its 60-day link, "Send update" messages,
// customers (one phone = one customer), the CSV export and the loyalty discount, through the real routes and schema.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import app from '../src/index'
import { makeD1 } from './d1'
import { updateMessage, buildMessage } from '../src/lib/orders'

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

type Q = { discount: number; kind: string; total: number; lines: { id: number; price: number }[]; code: { status: string } | null; loyalty: { pct: number; saving: number } | null }
type O = { number: string; token: string; message: string }
const quote = async (b: Record<string, unknown>) => (await (await send('/api/quote', { lang: 'en', ...b })).json()) as Q
const order = async (b: Record<string, unknown>) => {
  const r = await send('/api/orders', { lang: 'en', name: 'Sara Ali', phone: '0912000001', city: 'Benghazi', payment: 'cod_cash', channel: 'whatsapp', items: [{ id: 1, qty: 1 }], ...b })
  assert.equal(r.status, 200, await r.clone().text())
  return (await r.json()) as O
}
const row = (n: string) => DB.sqlite.prepare('SELECT * FROM orders WHERE number = ?').get(n) as Record<string, unknown>
const events = (id: unknown) => (DB.sqlite.prepare('SELECT status, admin_id FROM order_events WHERE order_id = ? ORDER BY id').all(id as number) as { status: string; admin_id: number | null }[]).map((e) => ({ status: e.status, admin_id: e.admin_id }))
const setStatus = (id: unknown, status: string, extra: Record<string, unknown> = {}) => send(`/admin/api/orders/${id}`, { status, admin_note: '', paid: false, ...extra }, asAdmin)
const both = [{ id: 1, qty: 1 }, { id: 2, qty: 1 }]

test('migration 0004 turns the old "paid" status into confirmed + the Paid tick', () => {
  const db = new DatabaseSync(':memory:')
  const m = (f: string) => db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'))
  ;['0001_init.sql', '0002_order_view.sql', '0003_offers_codes_delivery.sql'].forEach(m)
  db.exec(`INSERT INTO orders (number, name, phone, city, payment, channel, lang, total, status, created_at) VALUES
    ('SL-1001', 'A', '0912000009', 'Tripoli', 'cod_cash', 'whatsapp', 'ar', 1000, 'paid', '2026-11-01 10:00:00'),
    ('SL-1002', 'B', '0912000008', 'Tripoli', 'cod_cash', 'whatsapp', 'ar', 1000, 'new', '2026-11-02 10:00:00')`)
  m('0004_tracking_customers_loyalty.sql')
  const r = db.prepare('SELECT number, status, paid FROM orders ORDER BY id').all() as { number: string; status: string; paid: number }[]
  assert.deepEqual(r.map((x) => [x.number, x.status, x.paid]), [['SL-1001', 'confirmed', 1], ['SL-1002', 'new', 0]])
  const ev = db.prepare('SELECT order_id, status, at FROM order_events ORDER BY id').all() as { order_id: number; status: string; at: string }[]
  assert.deepEqual(ev.map((e) => [e.order_id, e.status, e.at]), [[1, 'new', '2026-11-01 10:00:00'], [2, 'new', '2026-11-02 10:00:00'], [1, 'confirmed', '2026-11-01 10:00:00']])
  assert.equal((db.prepare("SELECT value FROM settings WHERE key = 'loyalty_on'").get() as { value: string }).value, '0')
})

test('the order message ends with the private tracking link; the order page shows the tracker', async () => {
  const d = await order({ items: both })
  const lines = d.message.split('\n')
  assert.equal(lines.at(-1), `Track your order: ${ORIGIN}/en/order/${d.number}?t=${d.token}`)
  assert.ok(lines.includes('Total: 650 LYD'))
  const ar = await order({ lang: 'ar', phone: '0912000002' })
  assert.match(ar.message.split('\n').at(-1)!, new RegExp(`^تتبّع طلبيتك: ${ORIGIN}/ar/order/${ar.number}\\?t=[0-9a-f]{32}$`))
  // an order with no tracking link (older code paths) has no tracking line at all
  assert.ok(!buildMessage({ lang: 'en', number: 'SL-1', lines: [], total: 0, name: 'x', phone: '', city: '', address: '', note: '', payment: '' }).includes('Track'))

  const id = row(d.number).id
  assert.deepEqual(events(id), [{ status: 'new', admin_id: null }])
  const page = await (await get(`/en/order/${d.number}?t=${d.token}`)).text()
  assert.ok(page.includes('data-msg') && page.includes('Your order is ready!'), 'still asks the customer to send the message')
  assert.ok(page.includes('class="track"') && page.includes('Order received') && page.includes('Out for delivery'))
  assert.ok(page.includes(`Track your order: ${ORIGIN}/en/order/${d.number}`), 'the message on the page has the link too')
})

test('statuses: history with who changed it, Paid tick, tracker updates, bad statuses refused', async () => {
  const d = await order({ phone: '0912000003' })
  const id = row(d.number).id
  const r = await setStatus(id, 'confirmed')
  assert.equal(r.status, 200)
  assert.equal(((await r.json()) as { changed: boolean }).changed, true)
  // saving again with the same status (just the note or Paid) adds no history line
  const again = await setStatus(id, 'confirmed', { paid: true, admin_note: 'paid by LyPay' })
  assert.equal(((await again.json()) as { changed: boolean }).changed, false)
  assert.equal(row(d.number).paid, 1)
  assert.equal(row(d.number).admin_note, 'paid by LyPay')
  assert.deepEqual(events(id), [{ status: 'new', admin_id: null }, { status: 'confirmed', admin_id: 1 }])

  for (const bad of ['paid', 'shipped', '', 'delivered; DROP TABLE orders']) assert.equal((await setStatus(id, bad)).status, 400, bad)
  assert.equal((await setStatus(99999, 'confirmed')).status, 404)
  assert.equal((await send(`/admin/api/orders/${id}`, { status: 'delivered' })).status, 401, 'customers cannot change a status')
  assert.equal((await send(`/admin/api/orders/${id}`, { status: 'delivered' }, { ...asAdmin, origin: 'https://evil.test' })).status, 403)

  let page = await (await get(`/en/order/${d.number}?t=${d.token}`)).text()
  assert.ok(page.includes('Your order is confirmed') && !page.includes('data-msg'))
  assert.ok(!/paid/i.test(page.replace(/payment|Payment/g, '')), 'the customer never sees Paid')
  await setStatus(id, 'out', { paid: true })
  page = await (await get(`/en/order/${d.number}?t=${d.token}`)).text()
  assert.ok(page.includes('Your order is on its way'))
  assert.match(page, /<li class="t-done"[^>]*>.*?Order confirmed/s)
  assert.match(page, /<li class="t-now" aria-current="step">.*?Out for delivery/s)
  await setStatus(id, 'delivered', { paid: true })
  page = await (await get(`/en/order/${d.number}?t=${d.token}`)).text()
  assert.ok(page.includes('Delivered. Thank you!'))
  assert.deepEqual(events(id).map((e) => e.status), ['new', 'confirmed', 'out', 'delivered'])

  const c = await order({ phone: '0912000004' })
  await setStatus(row(c.number).id, 'cancelled')
  page = await (await get(`/en/order/${c.number}?t=${c.token}`)).text()
  assert.ok(page.includes('This order was cancelled') && page.includes('Order cancelled') && !page.includes('Out for delivery'))

  const adm = await (await get(`/admin/orders/${id}`, asAdmin)).text()
  assert.ok(adm.includes('owner@shop.test') && adm.includes('placed by the customer'))
  assert.ok(adm.includes('data-send-update="out"') && adm.includes('https://wa.me/218912000003?text='))
  assert.ok(adm.includes(encodeURIComponent(`${ORIGIN}/en/order/${d.number}?t=${d.token}`)), 'send-update text carries the tracking link')
  const list = await (await get('/admin/orders?status=out', asAdmin)).text()
  assert.ok(!list.includes(d.number), 'filter by status')
  assert.ok((await (await get('/admin/orders?status=delivered', asAdmin)).text()).includes(d.number))
})

test('"Send update" messages in the order’s language', () => {
  const o = { number: 'SL-1050', name: 'Sara Ali', total: 650000, fee: 20000, track: 'https://salfordlibya.com/ar/order/SL-1050?t=x' }
  const out = updateMessage('out', { ...o, lang: 'ar' })
  assert.ok(out.startsWith('مرحباً Sara،') && out.includes('SL-1050') && out.includes('20 د.ل') && out.endsWith(o.track))
  const en = updateMessage('confirmed', { ...o, lang: 'en' })
  assert.equal(en, `Hello Sara, your Salford order SL-1050 is confirmed ✅\nTotal: 650 LYD\nTrack your order: ${o.track}`)
  assert.ok(!updateMessage('cancelled', { ...o, lang: 'en' }).includes('Track'), 'no tracking link on a cancelled order')
  assert.ok(!updateMessage('out', { ...o, fee: 0, lang: 'en' }).includes('fee'))
})

test('the private link: right token only, and for 60 days', async () => {
  const d = await order({ phone: '0912000005' })
  assert.equal((await get(`/en/order/${d.number}?t=${'0'.repeat(32)}`)).status, 404)
  assert.equal((await get(`/en/order/${d.number}`)).status, 404)
  DB.sqlite.prepare("UPDATE orders SET created_at = datetime('now', '-59 days') WHERE number = ?").run(d.number)
  assert.equal((await get(`/en/order/${d.number}?t=${d.token}`)).status, 200)
  DB.sqlite.prepare("UPDATE orders SET created_at = datetime('now', '-61 days') WHERE number = ?").run(d.number)
  assert.equal((await get(`/en/order/${d.number}?t=${d.token}`)).status, 404)
  const res = await get(`/en/order/${d.number}?t=${d.token}`)
  assert.equal(res.headers.get('cache-control'), 'private, no-store')
})

test('loyalty: off by default; once on, 5% from the second order after a delivered one, best saving wins', async () => {
  const loyal = '0912000003' // has a delivered order (test above)
  const fresh = '0912000006'
  // switched off: nothing changes
  let q = await quote({ items: both, phone: loyal })
  assert.equal(q.kind, '')
  assert.equal(q.loyalty, null)

  assert.equal((await send('/admin/api/loyalty', { loyalty_on: true, loyalty_pct: 0 }, asAdmin)).status, 400)
  assert.equal((await send('/admin/api/loyalty', { loyalty_on: true, loyalty_pct: 90 }, asAdmin)).status, 400)
  assert.equal((await send('/admin/api/loyalty', { loyalty_on: true, loyalty_pct: 5 })).status, 401)
  assert.equal((await send('/admin/api/loyalty', { loyalty_on: true, loyalty_pct: 5 }, asAdmin)).status, 200)

  // 250 − 5% = 237.5 → 235; 400 − 5% = 380; the item with its own sale price and the "never discount" item stay
  q = await quote({ items: [...both, { id: 3, qty: 1 }, { id: 4, qty: 1 }], phone: loyal })
  assert.equal(q.kind, 'loyalty')
  assert.deepEqual(q.loyalty, { pct: 5, saving: 35000 })
  assert.deepEqual(q.lines.map((l) => l.price), [235000, 380000, 200000, 500000])
  // a new customer, a customer with only cancelled/undelivered orders, or no phone: no loyalty
  assert.equal((await quote({ items: both, phone: fresh })).loyalty, null)
  assert.equal((await quote({ items: both, phone: '0912000004' })).loyalty, null, 'cancelled order does not count')
  assert.equal((await quote({ items: both })).loyalty, null)

  const d = await order({ items: both, phone: loyal })
  const r = row(d.number)
  assert.equal(r.discount_kind, 'loyalty')
  assert.equal(r.loyalty, 5)
  assert.equal(r.total, 615000)
  assert.ok(d.message.includes('Discount (loyalty 5%): −35 LYD'), d.message)
  assert.ok((await (await get(`/en/order/${d.number}?t=${d.token}`)).text()).includes('Discount (loyalty 5%)'))
  // a made-up phone in the quote cannot give loyalty to the real order: the order uses its own phone
  const other = await order({ items: both, phone: fresh, loyalty: 50, discount_kind: 'loyalty' })
  assert.equal(row(other.number).discount_kind, '')
  assert.equal(row(other.number).total, 650000)

  // a code that saves more wins; a smaller code loses to loyalty
  assert.equal((await send('/admin/api/codes', { code: 'BIG20', kind: 'percent', value: 20, enabled: true }, asAdmin)).status, 200)
  assert.equal((await send('/admin/api/codes', { code: 'TINY2', kind: 'percent', value: 2, enabled: true }, asAdmin)).status, 200)
  q = await quote({ items: both, phone: loyal, code: 'BIG20' })
  assert.equal(q.kind, 'code')
  assert.equal(q.loyalty!.saving, 35000, 'loyalty is still reported, just not applied')
  q = await quote({ items: both, phone: loyal, code: 'TINY2' })
  assert.equal(q.kind, 'loyalty')
  assert.equal(q.code!.status, 'not_better')
  // an offer that saves more wins
  assert.equal((await send('/admin/api/offers', { template: 'bf', percent: 15, scope_mode: 'all', ends_at: '2099-01-01T00:00', enabled: true, show_banner: true, show_strip: true, show_countdown: true }, asAdmin)).status, 200)
  q = await quote({ items: both, phone: loyal })
  assert.equal(q.kind, 'offer')
  // switching loyalty off again
  assert.equal((await send('/admin/api/loyalty', { loyalty_on: false, loyalty_pct: 5 }, asAdmin)).status, 200)
  assert.equal((await quote({ items: both, phone: loyal })).loyalty, null)
})

test('customers: one phone = one customer, returning badge, history page, CSV with BOM', async () => {
  // a name that a spreadsheet would run as a formula
  const evil = await order({ phone: '0912000007', name: '=HYPERLINK("http://x","y")' })
  const page = await (await get('/admin/customers', asAdmin)).text()
  assert.ok(page.includes('0912000003') && page.includes('Loyalty discount'))
  assert.match(page, /0912000003[\s\S]*?<\/tr>/)
  const ret = await (await get('/admin/customers?show=returning', asAdmin)).text()
  assert.ok(ret.includes('0912000003') && !ret.includes('0912000007'))
  const search = await (await get('/admin/customers?q=0912000007', asAdmin)).text()
  assert.ok(search.includes('0912000007') && !search.includes('0912000003'))
  const one = await (await get('/admin/customers/0912000003', asAdmin)).text()
  assert.ok(one.includes('Returning') && one.includes('Loyalty 5%'))
  const orders = await (await get('/admin/orders', asAdmin)).text()
  assert.ok(orders.includes('tag ret'), 'returning badge in the order list')

  const csv = await get('/admin/customers/export', asAdmin)
  assert.equal(csv.status, 200)
  assert.match(csv.headers.get('content-type') ?? '', /text\/csv/)
  assert.match(csv.headers.get('content-disposition') ?? '', /attachment; filename="salford-customers-\d{4}-\d{2}-\d{2}\.csv"/)
  const buf = new Uint8Array(await csv.arrayBuffer())
  assert.deepEqual([...buf.slice(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 byte-order mark')
  const text = new TextDecoder().decode(buf.slice(3))
  assert.ok(text.startsWith('"Name","Phone","City","Orders","Delivered"'))
  assert.ok(text.includes(`"'=HYPERLINK(""http://x"",""y"")"`), 'formula made harmless')
  assert.ok(!text.includes(',"=HYPERLINK'))
  assert.ok(row(evil.number))

  for (const p of ['/admin/customers', '/admin/customers/export', '/admin/customers/0912000003']) {
    const r = await get(p)
    assert.ok(r.status === 302 || r.status === 401, `${p} needs a login (${r.status})`)
  }
})
