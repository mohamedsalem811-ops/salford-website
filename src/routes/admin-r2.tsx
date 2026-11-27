/**
 * Release 2 admin: Customers (one customer = one phone number), their order history, the CSV export and the loyalty switch.
 * Order statuses, history and "Send update" live on the order page in admin.tsx.
 */
import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { fmtLyd, getSettings } from '../lib/db'
import { STATUS_EN, isStatus, waCustomer } from '../lib/orders'
import { loyaltyPctOf } from '../lib/checkout'
import { Shell, libyaTime } from '../views/admin-shell'

type Vars = { admin: { id: number; email: string } }
export const r2Pages = new Hono<{ Bindings: Env; Variables: Vars }>()
export const r2Api = new Hono<{ Bindings: Env; Variables: Vars }>()

type Customer = { phone: string; name: string; city: string; orders: number; delivered: number; cancelled: number; spent: number; first_at: string; last_at: string }

// "Spent" = totals of delivered orders (what the customer actually paid, delivery included).
const CUSTOMERS_SQL = `
  SELECT g.*,
    (SELECT name FROM orders x WHERE x.phone = g.phone ORDER BY x.id DESC LIMIT 1) AS name,
    (SELECT city FROM orders x WHERE x.phone = g.phone ORDER BY x.id DESC LIMIT 1) AS city
  FROM (
    SELECT phone, count(*) AS orders, coalesce(sum(status = 'delivered'), 0) AS delivered, coalesce(sum(status = 'cancelled'), 0) AS cancelled,
      coalesce(sum(CASE WHEN status = 'delivered' THEN total END), 0) AS spent, min(created_at) AS first_at, max(created_at) AS last_at
    FROM orders WHERE phone != '' GROUP BY phone
  ) g`

const stLabel = (s: unknown) => (isStatus(s) ? STATUS_EN[s] : String(s))
/** Two or more orders that were not cancelled. */
const returning = (k: Customer) => k.orders - k.cancelled >= 2

async function customers(db: D1Database, q: string, show: string) {
  const where: string[] = []
  const args: string[] = []
  if (q) { where.push('(g.phone LIKE ? OR name LIKE ?)'); args.push(`%${q.replace(/[%_]/g, '')}%`, `%${q.replace(/[%_]/g, '')}%`) }
  if (show === 'returning') where.push('g.orders - g.cancelled >= 2')
  if (show === 'loyal') where.push('g.delivered >= 1')
  const { results } = await db.prepare(`SELECT * FROM (${CUSTOMERS_SQL}) g ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY g.last_at DESC LIMIT 1000`).bind(...args).all<Customer>()
  return results
}

r2Pages.get('/customers', async (c) => {
  const q = String(c.req.query('q') ?? '').trim().slice(0, 60)
  const show = ['returning', 'loyal'].includes(c.req.query('show') ?? '') ? String(c.req.query('show')) : ''
  const [list, s, totals] = await Promise.all([
    customers(c.env.DB, q, show),
    getSettings(c.env.DB),
    c.env.DB.prepare(`SELECT count(*) AS n, coalesce(sum(orders - cancelled >= 2), 0) AS ret, coalesce(sum(delivered >= 1), 0) AS loyal FROM (${CUSTOMERS_SQL})`).first<{ n: number; ret: number; loyal: number }>(),
  ])
  const pct = Math.floor(Number(s.loyalty_pct ?? '5')) || 5
  const on = loyaltyPctOf(s) > 0
  return c.html(
    <Shell title="Customers" nav="customers">
      <div class="a-head"><h1>Customers</h1><a class="a-btn" href="/admin/customers/export" download>Download CSV</a></div>
      <div class="a-stats">
        <div><b>{totals?.n ?? 0}</b>customers</div>
        <div><b>{totals?.ret ?? 0}</b>returning (2+ orders)</div>
        <div><b>{totals?.loyal ?? 0}</b>with a delivered order</div>
      </div>
      <form class="a-card" data-loyalty-form>
        <h2>Loyalty discount {on ? <span class="tag ok">On</span> : <span class="tag">Off</span>}</h2>
        <p class="a-muted">
          A returning customer (their phone number already has a <b>delivered</b> order) gets this % off their next orders.
          It is never added to an offer or a code: the customer gets whichever saving is biggest. Products ticked “never discount”
          and products with their own crossed-out price are not discounted. Prices are rounded down to 5 LYD.
        </p>
        <label class="a-check"><input type="checkbox" name="loyalty_on" checked={on} /> Give returning customers the loyalty discount</label>
        <label class="a-f">Discount %<input name="loyalty_pct" type="number" inputmode="numeric" min={1} max={50} step={1} value={String(pct)} required /></label>
        <button class="a-btn p" type="submit">Save loyalty</button>
      </form>
      <form method="get" class="a-filter">
        <input type="search" name="q" value={q} placeholder="Name or phone" aria-label="Search customers" />
        <select name="show" aria-label="Show">
          <option value="">All customers</option>
          <option value="returning" selected={show === 'returning'}>Returning (2+ orders)</option>
          <option value="loyal" selected={show === 'loyal'}>Has a delivered order (gets loyalty)</option>
        </select>
        <button class="a-btn">Show</button>
      </form>
      <div class="a-table-wrap">
        <table class="a-table a-olist">
          <thead><tr><th>Customer</th><th>City</th><th>Orders</th><th>Delivered</th><th>Spent</th><th>Last order</th></tr></thead>
          <tbody>
            {list.map((k) => (
              <tr>
                <td class="c-cust"><a href={`/admin/customers/${k.phone}`}><bdi>{k.name}</bdi></a>{returning(k) ? <span class="tag ret">Returning</span> : null}<br /><span class="a-muted" dir="ltr">{k.phone}</span></td>
                <td class="c-city"><bdi>{k.city}</bdi></td>
                <td class="num">{k.orders}{k.cancelled ? <span class="a-muted"> ({k.cancelled} cancelled)</span> : null}</td>
                <td class="num">{k.delivered}</td>
                <td class="num">{fmtLyd(k.spent)} LYD</td>
                <td class="c-date">{libyaTime(k.last_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length ? null : <p class="a-muted">{q || show ? 'No customers match.' : 'No customers yet.'}</p>}
      </div>
    </Shell>,
  )
})

r2Pages.get('/customers/:phone{0[0-9]{9}}', async (c) => {
  const phone = c.req.param('phone')
  const db = c.env.DB
  const [{ results: orders }, s] = await Promise.all([
    db.prepare('SELECT id, number, created_at, name, city, total, status, paid, discount_kind, loyalty FROM orders WHERE phone = ? ORDER BY id DESC').bind(phone).all<Record<string, string | number>>(),
    getSettings(db),
  ])
  if (!orders.length) return c.redirect('/admin/customers')
  const delivered = orders.filter((o) => o.status === 'delivered')
  const spent = delivered.reduce((t, o) => t + Number(o.total), 0)
  const live = orders.filter((o) => o.status !== 'cancelled').length
  const pct = loyaltyPctOf(s)
  return c.html(
    <Shell title={String(orders[0].name)} nav="customers">
      <div class="a-head"><h1><bdi>{orders[0].name}</bdi>{live >= 2 ? <span class="tag ret">Returning</span> : null}</h1><a class="a-btn" href="/admin/customers">All customers</a></div>
      <div class="a-stats">
        <div><b>{orders.length}</b>orders</div>
        <div><b>{delivered.length}</b>delivered</div>
        <div><b>{fmtLyd(spent)}</b>LYD spent</div>
        <div><b>{libyaTime(String(orders[orders.length - 1].created_at)).slice(0, 11)}</b>first order</div>
      </div>
      <div class="a-card">
        <dl class="a-dl">
          <dt>Phone</dt><dd dir="ltr">{phone} · <a href={waCustomer(phone)} target="_blank" rel="noopener">WhatsApp</a></dd>
          <dt>City</dt><dd dir="auto">{orders[0].city}</dd>
          <dt>Loyalty</dt><dd>{delivered.length ? (pct ? `Gets ${pct}% off their next orders (unless an offer or code saves more)` : 'Qualifies, but the loyalty discount is switched off') : 'Not yet: starts after their first delivered order'}</dd>
        </dl>
      </div>
      <div class="a-table-wrap">
        <table class="a-table a-olist">
          <thead><tr><th>Order</th><th>Date</th><th>Name used</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr>
                <td class="c-no"><a href={`/admin/orders/${o.id}`}><b>{o.number}</b></a>{o.discount_kind === 'loyalty' ? <span class="tag">Loyalty {o.loyalty}%</span> : null}</td>
                <td class="c-date">{libyaTime(o.created_at)}</td>
                <td><bdi>{o.name}</bdi></td>
                <td class="num">{fmtLyd(Number(o.total))} LYD</td>
                <td class="c-st"><span class={`tag st-${o.status}`}>{stLabel(o.status)}</span>{Number(o.paid) ? <span class="tag st-paid">Paid</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>,
  )
})

/** One cell: quoted, and a leading = + - @ made harmless so a spreadsheet never runs it as a formula. */
const cell = (v: unknown) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return `"${s.replace(/"/g, '""')}"`
}

r2Pages.get('/customers/export', async (c) => {
  const list = await customers(c.env.DB, '', '')
  const rows = [
    ['Name', 'Phone', 'City', 'Orders', 'Delivered', 'Cancelled', 'Spent (LYD)', 'First order (Libya time)', 'Last order (Libya time)', 'Returning', 'Gets loyalty'],
    ...list.map((k) => [k.name, k.phone, k.city, k.orders, k.delivered, k.cancelled, fmtLyd(k.spent).replace(/,/g, ''), libyaTime(k.first_at), libyaTime(k.last_at), returning(k) ? 'yes' : 'no', k.delivered ? 'yes' : 'no']),
  ]
  // UTF-8 with a byte-order mark, so Excel and Numbers show Arabic names correctly
  const csv = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
  const day = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="salford-customers-${day}.csv"`,
      'cache-control': 'private, no-store',
    },
  })
})

r2Api.post('/loyalty', async (c) => {
  const b = await c.req.json<{ loyalty_on?: unknown; loyalty_pct?: unknown }>()
  const pct = Math.floor(Number(b.loyalty_pct))
  if (!Number.isFinite(pct) || pct < 1 || pct > 50) return c.json({ error: 'Use a whole % from 1 to 50.' }, 400)
  const on = b.loyalty_on === true || b.loyalty_on === '1' || b.loyalty_on === 'on' ? '1' : '0'
  const up = 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  await c.env.DB.batch([c.env.DB.prepare(up).bind('loyalty_on', on), c.env.DB.prepare(up).bind('loyalty_pct', String(pct))])
  return c.json({ ok: true })
})
