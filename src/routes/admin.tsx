import { Hono } from 'hono'
import type { Child } from 'hono/jsx'
import type { Env, Product, Media } from '../lib/db'
import { getBrands, getCategories, getSettings, fmtLyd } from '../lib/db'
import { requireAdmin, verifyLogin, startSession, endSession, tooManyAttempts, recordAttempt, clientIp, hashPassword } from '../lib/auth'
import { mediaUrl } from '../lib/media'
import { V } from '../views/layout'
import { assetPath } from '../lib/assets'
import { adminApi } from './admin-api'
import { sumRows, sumFromRow, STATUSES, STATUS_EN, isStatus, trackUrl, updateMessage, waCustomer, LINK_DAYS, type Status } from '../lib/orders'
import { Shell, libyaTime } from '../views/admin-shell'
import { r1Pages } from './admin-r1'
import { r2Pages } from './admin-r2'
import { r3Pages } from './admin-r3'
import { askReviewMessage, onSwitch, reviewUrl } from '../lib/r3'

type Vars = { admin: { id: number; email: string } }
export const admin = new Hono<{ Bindings: Env; Variables: Vars }>()

/* ---------- login / setup ---------- */
admin.get('/login', async (c) => {
  const count = await c.env.DB.prepare('SELECT count(*) AS n FROM admins').first<{ n: number }>()
  if (!count?.n) return c.redirect('/admin/setup')
  const err = c.req.query('e')
  return c.html(
    <Shell title="Log in">
      <form class="a-card login" method="post" action="/admin/login">
        <img src="/static/brand/logo-mauve.webp" alt="Salford" width="140" height="90" style="justify-self:center" /><h1>Salford admin</h1>
        <label class="a-f">Email<input name="email" type="email" required autocomplete="username" /></label>
        <label class="a-f">Password<input name="password" type="password" required autocomplete="current-password" /></label>
        {err ? <p class="a-err" role="alert">{err === 'limit' ? 'Too many attempts. Wait 15 minutes and try again.' : 'Email or password is wrong.'}</p> : null}
        <button class="a-btn p" type="submit">Log in</button>
      </form>
    </Shell>,
  )
})

admin.post('/login', async (c) => {
  const ip = clientIp(c)
  if (await tooManyAttempts(c.env.DB, ip)) return c.redirect('/admin/login?e=limit')
  const f = await c.req.parseBody()
  const id = await verifyLogin(c.env.DB, String(f.email ?? ''), String(f.password ?? ''))
  if (!id) {
    await recordAttempt(c.env.DB, ip)
    return c.redirect('/admin/login?e=1')
  }
  await startSession(c, id)
  return c.redirect('/admin')
})

admin.post('/logout', async (c) => {
  await endSession(c)
  return c.redirect('/admin/login')
})

/** First admin account. Only works while there are no admins, and only behind the private test-address key. */
const setupAllowed = async (c: { env: Env; req: { url: string } }) => {
  const host = new URL(c.req.url).hostname
  if (!c.env.PREVIEW_KEY || !host.endsWith('.pages.dev')) return false
  const n = await c.env.DB.prepare('SELECT count(*) AS n FROM admins').first<{ n: number }>()
  return !n?.n
}
admin.get('/setup', async (c) => {
  if (!(await setupAllowed(c))) return c.redirect('/admin/login')
  return c.html(
    <Shell title="Create admin">
      <form class="a-card login" method="post" action="/admin/setup">
        <h1>Create the first admin</h1>
        <p class="a-muted">This page only works once. Use your own email and a strong password (at least 10 characters).</p>
        <label class="a-f">Email<input name="email" type="email" required autocomplete="username" /></label>
        <label class="a-f">Password<input name="password" type="password" required minlength={10} autocomplete="new-password" /></label>
        <button class="a-btn p" type="submit">Create account</button>
      </form>
    </Shell>,
  )
})
admin.post('/setup', async (c) => {
  if (!(await setupAllowed(c))) return c.redirect('/admin/login')
  const f = await c.req.parseBody()
  const email = String(f.email ?? '').trim().toLowerCase()
  const pw = String(f.password ?? '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || pw.length < 10) return c.redirect('/admin/setup')
  const { hash, salt } = await hashPassword(pw)
  const r = await c.env.DB.prepare('INSERT INTO admins (email, pass_hash, salt) VALUES (?, ?, ?) RETURNING id').bind(email, hash, salt).first<{ id: number }>()
  await startSession(c, r!.id)
  return c.redirect('/admin')
})

/* ---------- everything below needs a login ---------- */
admin.use('/*', async (c, next) => {
  const p = c.req.path
  if (p === '/admin/login' || p === '/admin/setup' || p === '/admin/logout') return next()
  return requireAdmin(c, next)
})
admin.route('/api', adminApi)
admin.route('/', r1Pages)
admin.route('/', r2Pages)
admin.route('/', r3Pages)

/* ---------- products ---------- */
admin.get('/', async (c) => {
  const q = c.req.query('q')?.trim() ?? ''
  const brand = c.req.query('brand') ?? ''
  const show = c.req.query('show') ?? ''
  const where = ['p.deleted_at IS NULL']
  const args: unknown[] = []
  if (q) { where.push('(p.name_en LIKE ? OR p.code LIKE ?)'); args.push(`%${q}%`, `%${q}%`) }
  if (brand) { where.push('p.brand_id = ?'); args.push(brand) }
  if (show === 'noar') where.push("((p.short_en <> '' AND p.short_ar = '') OR (p.desc_en <> '' AND p.desc_ar = ''))")
  if (show === 'nophoto') where.push("NOT EXISTS (SELECT 1 FROM media m WHERE m.product_id = p.id AND m.status != 'broken')")
  if (show === 'broken') where.push("EXISTS (SELECT 1 FROM media m WHERE m.product_id = p.id AND m.status = 'broken')")
  if (show === 'hidden') where.push("p.status != 'live'")
  if (show === 'deleted') where.splice(0, 1, 'p.deleted_at IS NOT NULL')
  const [{ results }, brands, stats] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.*, (SELECT url FROM media m WHERE m.product_id = p.id AND m.kind = 'image' ORDER BY sort, id LIMIT 1) AS thumb,
       (SELECT r2_key FROM media m WHERE m.product_id = p.id AND m.kind = 'image' ORDER BY sort, id LIMIT 1) AS thumb_key,
       (SELECT sizes FROM media m WHERE m.product_id = p.id AND m.kind = 'image' ORDER BY sort, id LIMIT 1) AS thumb_sizes,
       (SELECT count(*) FROM media m WHERE m.product_id = p.id AND m.status = 'broken') AS broken,
       ((p.short_en <> '' AND p.short_ar = '') OR (p.desc_en <> '' AND p.desc_ar = '')) AS noar
       FROM products p WHERE ${where.join(' AND ')} ORDER BY p.sort, p.id DESC LIMIT 500`,
    ).bind(...args).all<Product & { thumb: string | null; thumb_key: string | null; thumb_sizes: string; broken: number; noar: number }>(),
    getBrands(c.env.DB, true),
    c.env.DB.prepare(`SELECT
      (SELECT count(*) FROM products WHERE deleted_at IS NULL) total,
      (SELECT count(*) FROM products WHERE deleted_at IS NULL AND ((short_en <> '' AND short_ar = '') OR (desc_en <> '' AND desc_ar = ''))) noar,
      (SELECT count(*) FROM media WHERE status = 'broken') broken,
      (SELECT count(*) FROM media WHERE status = 'unchecked') unchecked,
      (SELECT count(*) FROM media WHERE source = 'link' AND r2_key IS NULL AND kind != 'youtube') nocopy,
      (SELECT coalesce(sum(bytes),0) FROM media WHERE r2_key IS NOT NULL) stored`).first<Record<string, number>>(),
  ])
  const filters: [string, string][] = [['', 'All'], ['noar', `Missing Arabic text (${stats!.noar})`], ['broken', `Broken photos (${stats!.broken})`], ['nophoto', 'No photos'], ['hidden', 'Hidden / draft'], ['deleted', 'Deleted']]
  return c.html(
    <Shell title="Products" nav="products">
      <div class="a-head">
        <h1>Products <span class="a-muted">({stats!.total})</span></h1>
        <div class="a-btns">
          <label class="a-btn">Quick import photos<input type="file" accept="image/*" multiple hidden data-quick-import /></label>
          <form method="post" action="/admin/api/products/new"><button class="a-btn p" type="submit">New product</button></form>
        </div>
      </div>
      <div class="a-card a-tools">
        <span>Links not yet checked: <b>{stats!.unchecked}</b> · Without safe copy: <b>{stats!.nocopy}</b> · Stored: <b>{(stats!.stored / 1048576).toFixed(1)} MB</b> of 10,240 MB free</span>
        <span class="a-btns">
          <button class="a-btn" type="button" data-batch="check">Check all links</button>
          <button class="a-btn" type="button" data-batch="copy">Make safe copies</button>
          {stats!.noar ? <button class="a-btn" type="button" data-batch="translate">Translate missing ({stats!.noar})</button> : null}
        </span>
        <span class="a-progress" data-batch-status hidden></span>
      </div>
      <form class="a-filter" method="get" action="/admin">
        <input name="q" value={q} placeholder="Search name or code" aria-label="Search" />
        <select name="brand" aria-label="Brand"><option value="">All brands</option>{brands.map((b) => <option value={b.id} selected={brand === b.id}>{b.name}</option>)}</select>
        <select name="show" aria-label="Show">{filters.map(([v, l]) => <option value={v} selected={show === v}>{l}</option>)}</select>
        <button class="a-btn" type="submit">Filter</button>
      </form>
      <div class="a-table-wrap">
        <table class="a-table a-plist">
          <thead><tr><th></th><th>Product</th><th>Code</th><th>Brand</th><th>Price</th><th>In stock</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {results.map((p) => {
              const thumb = p.thumb_key ? mediaUrl({ r2_key: p.thumb_key, sizes: p.thumb_sizes } as Media, 400) : p.thumb
              return (
                <tr>
                  <td class="c-th">{thumb ? <img class="a-thumb" src={thumb} alt="" loading="lazy" /> : <span class="a-thumb empty"></span>}</td>
                  <td class="c-nm"><a href={`/admin/p/${p.id}`}><b>{p.name_en || '(no name)'}</b></a>{p.noar ? <span class="tag warn">no Arabic text</span> : null}{p.broken ? <span class="tag bad">{p.broken} broken</span> : null}</td>
                  <td class="c-code"><code>{p.code}</code></td>
                  <td class="c-brand">{brands.find((b) => b.id === p.brand_id)?.name}</td>
                  <td class="num c-price">{fmtLyd(p.price)}</td>
                  <td class="c-stock"><button type="button" class={`sw${p.in_stock ? ' on' : ''}`} role="switch" aria-checked={p.in_stock ? 'true' : 'false'} aria-label="In stock" data-toggle={`${p.id}:in_stock`}></button></td>
                  <td class="c-st"><span class={`tag ${p.status === 'live' ? 'ok' : 'warn'}`}>{p.deleted_at ? 'deleted' : p.status}</span></td>
                  <td class="c-act">{p.deleted_at ? <button class="a-btn sm" type="button" data-restore={p.id}>Restore</button> : <a class="a-btn sm" href={`/admin/p/${p.id}`}>Edit</a>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Shell>,
  )
})

admin.get('/p/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const p = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<Product>()
  if (!p) return c.redirect('/admin')
  const [{ results: media }, brands, cats] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM media WHERE product_id = ? ORDER BY sort, id').bind(id).all<Media>(),
    getBrands(c.env.DB, true),
    getCategories(c.env.DB),
  ])
  const mediaJson = JSON.stringify(media.map((m) => ({ ...m, preview: mediaUrl(m, 400) }))).replace(/</g, '\\u003c')
  const v = (n: number | null) => (n == null ? '' : String(n / 1000))
  return c.html(
    <Shell title={p.name_en || 'Product'} nav="products">
      <div class="a-head">
        <h1>{p.name_en || 'New product'}</h1>
        <div class="a-btns">
          <a class="a-btn" href={`/ar/p/${p.id}`} target="_blank" rel="noopener">View on site ↗</a>
          <button class="a-btn danger" type="button" data-delete={p.id}>Delete</button>
          <button class="a-btn p" type="submit" form="pform">Save</button>
        </div>
      </div>
      <div class="a-cols">
        <form id="pform" class="a-card" data-product-form={p.id}>
          <h2>Details</h2>
          <div class="a-grid2">
            <label class="a-f">Brand<select name="brand_id">{brands.map((b) => <option value={b.id} selected={p.brand_id === b.id}>{b.name}</option>)}</select></label>
            <label class="a-f">Category<select name="category_id">{cats.map((ct) => <option value={ct.id} selected={p.category_id === ct.id}>{ct.name_en}</option>)}</select></label>
            <label class="a-f">Product code<input name="code" value={p.code} required /></label>
            <label class="a-f">Price (LYD)<input name="price" type="number" min="0" step="0.001" value={v(p.price)} required /></label>
          </div>
          <label class="a-f">Name (shown in English on both languages)<input name="name_en" value={p.name_en} /></label>
          <label class="a-f">Short line (English)<input name="short_en" value={p.short_en} /></label>
          <label class="a-f">Description (English)<textarea name="desc_en" rows={4}>{p.desc_en}</textarea></label>
          <div class="a-ar">
            <div class="a-row"><b>Arabic</b><span class="a-muted">Written automatically when you save. You can correct it here.</span><button class="a-btn sm" type="button" data-translate={p.id}>Translate again</button></div>
            <label class="a-f">Short line (Arabic)<input name="short_ar" dir="rtl" value={p.short_ar} /></label>
            <label class="a-f">Description (Arabic)<textarea name="desc_ar" dir="rtl" rows={4}>{p.desc_ar}</textarea></label>
          </div>
          <div class="a-grid2">
            <label class="a-f">Crossed-out price (optional)<input name="compare_price" type="number" min="0" step="0.001" value={v(p.compare_price)} /></label>
            <label class="a-f">Set item codes (for sets, comma separated)<input name="set_codes" value={(() => { try { return JSON.parse(p.set_codes).join(', ') } catch { return '' } })()} /></label>
            <label class="a-f">Status<select name="status"><option value="live" selected={p.status === 'live'}>Live</option><option value="draft" selected={p.status === 'draft'}>Draft</option><option value="hidden" selected={p.status === 'hidden'}>Hidden</option></select></label>
          </div>
          <div class="a-checks">
            <label><input type="checkbox" name="in_stock" checked={!!p.in_stock} /> In stock</label>
            <label><input type="checkbox" name="is_new" checked={!!p.is_new} /> New arrival</label>
            <label><input type="checkbox" name="best_seller" checked={!!p.best_seller} /> Best seller</label>
            <label><input type="checkbox" name="is_set" checked={!!p.is_set} /> This is a set</label>
            <label title="Offers and discount codes skip this product"><input type="checkbox" name="no_discount" checked={!!p.no_discount} /> Never discount</label>
          </div>
        </form>
        <section class="a-card" data-media-manager={p.id}>
          <h2>Photos &amp; video <span class="a-muted" data-media-count></span></h2>
          <label class="drop" data-drop>
            <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple hidden data-media-file />
            <b>Drop photos or a video here, or tap to choose</b>
            <span>JPG, PNG, WEBP or iPhone photos up to 25 MB · video MP4/MOV up to 100 MB</span>
          </label>
          <div class="linkrow">
            <input type="url" placeholder="Or paste a photo, video or YouTube link" aria-label="Media link" data-link-input />
            <label class="a-inline"><input type="checkbox" checked data-link-copy /> Keep a safe copy</label>
            <button class="a-btn" type="button" data-link-add>Add link</button>
          </div>
          <ul class="mlist" data-media-list></ul>
          <p class="a-muted">Drag to reorder, or use the arrows. The first photo is the main one.</p>
          <script type="application/json" data-media-json dangerouslySetInnerHTML={{ __html: mediaJson }} />
        </section>
      </div>
    </Shell>,
  )
})

/* ---------- orders ---------- */
const PAY: Record<string, string> = { cod_cash: 'Cash on delivery', cod_card: 'Card on delivery', lypay: 'LyPay' }
const stLabel = (s: unknown) => (isStatus(s) ? STATUS_EN[s] : String(s))

admin.get('/orders', async (c) => {
  const q = c.req.query('status') ?? ''
  const status = isStatus(q) ? q : ''
  const unpaid = q === 'unpaid' // delivered but not ticked paid yet
  const where = status ? 'WHERE o.status = ?' : unpaid ? "WHERE o.status = 'delivered' AND o.paid = 0" : ''
  const { results } = await c.env.DB.prepare(
    `SELECT o.*, (SELECT sum(qty) FROM order_items i WHERE i.order_id = o.id) items,
      (SELECT count(*) FROM orders p WHERE p.phone = o.phone AND p.id < o.id AND p.status != 'cancelled') prev
     FROM orders o ${where} ORDER BY o.id DESC LIMIT 300`,
  ).bind(...(status ? [status] : [])).all<Record<string, string | number>>()
  return c.html(
    <Shell title="Orders" nav="orders">
      <div class="a-head"><h1>Orders</h1>
        <form method="get" class="a-filter"><select name="status" aria-label="Status"><option value="">All</option>{STATUSES.map((s) => <option value={s} selected={status === s}>{STATUS_EN[s]}</option>)}<option value="unpaid" selected={unpaid}>Delivered, not paid</option></select><button class="a-btn">Filter</button></form>
      </div>
      <div class="a-table-wrap">
        <table class="a-table a-olist">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>City</th><th>Items</th><th>Total</th><th>Payment</th><th>Sent via</th><th>Status</th></tr></thead>
          <tbody>
            {results.map((o) => (
              <tr>
                <td class="c-no"><a href={`/admin/orders/${o.id}`}><b>{o.number}</b></a></td>
                <td class="c-date">{libyaTime(o.created_at)}</td>
                <td class="c-cust"><bdi>{o.name}</bdi>{Number(o.prev) > 0 ? <span class="tag ret">Returning</span> : null}<br /><a class="a-muted" dir="ltr" href={`/admin/customers/${o.phone}`}>{o.phone}</a></td>
                <td class="c-city"><bdi>{o.city}</bdi></td>
                <td class="c-items">{o.items}<span class="a-ph">{Number(o.items) === 1 ? ' item' : ' items'}</span></td>
                <td class="num c-tot">{fmtLyd(Number(o.total))} LYD</td>
                <td class="c-pay">{PAY[String(o.payment)]}{o.payment === 'cod_card' ? <span class="tag warn">bring card machine</span> : null}</td>
                <td class="c-ch">{o.channel}</td>
                <td class="c-st"><span class={`tag st-${o.status}`}>{stLabel(o.status)}</span>{Number(o.paid) ? <span class="tag st-paid">Paid</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length ? null : <p class="a-muted">{where ? 'No orders match this filter.' : 'No orders yet.'}</p>}
      </div>
    </Shell>,
  )
})

admin.get('/orders/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Record<string, string | number>>()
  if (!o) return c.redirect('/admin/orders')
  const [[itemsRes, evRes, prevRes, rvRes], st] = await Promise.all([c.env.DB.batch([
    c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid').bind(id),
    c.env.DB.prepare('SELECT e.status, e.at, e.admin_id, a.email FROM order_events e LEFT JOIN admins a ON a.id = e.admin_id WHERE e.order_id = ? ORDER BY e.id').bind(id),
    c.env.DB.prepare("SELECT count(*) AS n, coalesce(sum(status = 'delivered'), 0) AS d FROM orders WHERE phone = ? AND id != ? AND status != 'cancelled'").bind(o.phone, id),
    c.env.DB.prepare('SELECT count(*) AS n FROM reviews WHERE order_id = ?').bind(id),
  ]), getSettings(c.env.DB)])
  const items = itemsRes.results as Record<string, string | number>[]
  const events = evRes.results as { status: string; at: string; admin_id: number | null; email: string | null }[]
  const prev = (prevRes.results[0] ?? { n: 0, d: 0 }) as { n: number; d: number }
  const sum = sumFromRow(o)
  const lang = o.lang === 'en' ? 'en' : 'ar'
  const track = o.view_token ? trackUrl(new URL(c.req.url).origin, lang, String(o.number), String(o.view_token)) : ''
  const status = isStatus(o.status) ? o.status : 'new'
  const msgFor = (st: Status) => updateMessage(st, { lang, number: String(o.number), name: String(o.name), total: Number(o.total), fee: sum?.fee ?? 0, track })
  const sends: Status[] = ['confirmed', 'out', 'delivered', 'cancelled']
  const reviewed = Number((rvRes.results[0] as { n: number } | undefined)?.n ?? 0)
  const linkOk = !!o.view_token && Date.parse(String(o.created_at).replace(' ', 'T') + 'Z') > Date.now() - LINK_DAYS * 86400000
  const askMsg = askReviewMessage(lang, { name: String(o.name), number: String(o.number), link: reviewUrl(new URL(c.req.url).origin, lang, String(o.number), String(o.view_token)) })
  return c.html(
    <Shell title={String(o.number)} nav="orders">
      <div class="a-head"><h1>Order {o.number} <span class={`tag st-${o.status}`}>{stLabel(o.status)}</span>{Number(o.paid) ? <span class="tag st-paid">Paid</span> : null}</h1><a class="a-btn" href="/admin/orders">All orders</a></div>
      <div class="a-cols">
        <div class="a-card">
          <h2>Customer {prev.n > 0 ? <span class="tag ret">Returning · {prev.n} other order{prev.n === 1 ? '' : 's'}</span> : <span class="tag">First order</span>}</h2>
          <dl class="a-dl">
            <dt>Name</dt><dd dir="auto">{o.name}</dd>
            <dt>Phone</dt><dd dir="ltr">{o.phone} · <a href={waCustomer(String(o.phone))} target="_blank" rel="noopener">WhatsApp</a> · <a href={`/admin/customers/${o.phone}`}>All their orders</a></dd>
            <dt>City</dt><dd dir="auto">{o.city}</dd>
            <dt>Address</dt><dd dir="auto">{o.address || '—'}</dd>
            <dt>Note</dt><dd dir="auto">{o.note || '—'}</dd>
            <dt>Payment</dt><dd>{PAY[String(o.payment)]}{o.payment === 'cod_card' ? ' · bring card machine' : ''}</dd>
            <dt>Sent via</dt><dd>{o.channel} · {o.lang === 'ar' ? 'Arabic' : 'English'}</dd>
            <dt>Created</dt><dd>{libyaTime(o.created_at)} <span class="a-muted">Libya time</span></dd>
            {track ? <><dt>Tracker</dt><dd><a href={track} target="_blank" rel="noopener">Customer’s order page ↗</a></dd></> : null}
          </dl>
        </div>
        <div class="a-card">
          <h2>Items</h2>
          <table class="a-table"><tbody>{items.map((i) => {
            const was = sum && Number(i.orig_price) > Number(i.price) ? Number(i.orig_price) * Number(i.qty) : 0
            return <tr><td>{i.brand}</td><td dir="auto">{i.name}<br /><code>{i.code}</code></td><td>× {i.qty}</td><td class="num">{fmtLyd(Number(i.price) * Number(i.qty))}{was ? <><br /><s class="a-muted">{fmtLyd(was)}</s></> : null}</td></tr>
          })}</tbody></table>
          {sum ? <dl class="a-dl">{sumRows({ lang: 'en', total: Number(o.total), sum }).map((r) => <><dt>{r.label}</dt><dd>{r.value}</dd></>)}{sum.area ? <><dt>Area</dt><dd dir="auto">{sum.area}</dd></> : null}</dl> : null}
          <p class="a-total">Total <b>{fmtLyd(Number(o.total))} LYD</b>{sum && sum.fee ? <span class="a-muted"> (incl. {fmtLyd(sum.fee)} delivery, cash to the driver)</span> : null}</p>
        </div>
        <div class="a-card">
          <h2>Status</h2>
          <form class="a-order-form" data-order-form={o.id}>
            <label class="a-f">Status the customer sees<select name="status">{STATUSES.map((s) => <option value={s} selected={status === s}>{STATUS_EN[s]}</option>)}</select></label>
            <label class="a-check"><input type="checkbox" name="paid" checked={!!Number(o.paid)} /> Paid <span class="a-muted">(team only, the customer never sees this)</span></label>
            <label class="a-f">Team note<textarea name="admin_note" rows={3}>{o.admin_note}</textarea></label>
            <button class="a-btn p" type="submit">Save</button>
          </form>
          <h2>History</h2>
          <ol class="a-hist">
            {events.map((e) => <li><b>{stLabel(e.status)}</b> <span class="a-muted">{libyaTime(e.at)}{e.admin_id ? ` · ${e.email ?? 'removed admin'}` : e.status === 'new' ? ' · placed by the customer' : ''}</span></li>)}
          </ol>
        </div>
        <div class="a-card">
          <h2>Send update</h2>
          <p class="a-muted">Opens WhatsApp with the message written for the customer{lang === 'en' ? ' (in English, the language they ordered in)' : ' (in Arabic, the language they ordered in)'}, including their tracking link. Change the status first, then send.</p>
          <div class="a-sends">
            {sends.map((st) => <a class={`a-btn${st === status ? ' p' : ''}`} href={waCustomer(String(o.phone), msgFor(st))} target="_blank" rel="noopener" data-send-update={st}>{STATUS_EN[st]}</a>)}
          </div>
          {status !== 'new' ? <details class="a-preview"><summary>Message for “{STATUS_EN[status]}”</summary><pre dir="auto">{msgFor(status)}</pre></details> : null}
        </div>
        <div class="a-card">
          <h2>Ask for a review {reviewed ? <span class="tag ok">{reviewed} received</span> : null}</h2>
          {!onSwitch(st, 'reviews_on') ? <p class="a-muted">Reviews are switched off. Turn them on in <a href="/admin/reviews">Reviews</a> to use this button.</p>
            : status !== 'delivered' ? <p class="a-muted">Available once the order is marked Delivered.</p>
            : !linkOk ? <p class="a-muted">This order is older than {LINK_DAYS} days, so its private link has expired.</p>
            : <>
              <p class="a-muted">Opens WhatsApp with a short message and the customer’s own review link. Reviews sent from it are marked “Verified buyer”, and you approve them in <a href="/admin/reviews">Reviews</a> before they show.</p>
              <div class="a-sends"><a class="a-btn p" href={waCustomer(String(o.phone), askMsg)} target="_blank" rel="noopener">Ask for a review</a></div>
              <details class="a-preview"><summary>Message</summary><pre dir="auto">{askMsg}</pre></details>
            </>}
        </div>
      </div>
    </Shell>,
  )
})

/* ---------- settings ---------- */
admin.get('/settings', async (c) => {
  const s = await getSettings(c.env.DB)
  const { results: admins } = await c.env.DB.prepare('SELECT id, email, created_at FROM admins ORDER BY id').all<{ id: number; email: string; created_at: string }>()
  let banners: Record<string, string>[] = []
  try { banners = JSON.parse(s.banners || '[]') } catch { banners = [] }
  while (banners.length < 3) banners.push({})
  return c.html(
    <Shell title="Settings" nav="settings">
      <div class="a-head"><h1>Settings</h1><button class="a-btn p" type="submit" form="sform">Save settings</button></div>
      <form id="sform" data-settings-form>
        <section class="a-card">
          <h2>Ordering links</h2>
          <p class="a-muted">An order button appears on the site only when its link is filled in.</p>
          <div class="a-grid2">
            <label class="a-f">WhatsApp number (with country code)<input name="whatsapp" value={s.whatsapp} placeholder="218912345678" inputmode="tel" /></label>
            <label class="a-f">WhatsApp username (shown on the site)<input name="wa_username" value={s.wa_username} placeholder="@salford.libya" /></label>
            <label class="a-f">Facebook Page link<input name="facebook" value={s.facebook} placeholder="https://www.facebook.com/salfordlibya" /></label>
            <label class="a-f">Instagram link<input name="instagram" value={s.instagram} placeholder="https://www.instagram.com/salford.libya/" /></label>
          </div>
        </section>
        <section class="a-card">
          <h2>Payment methods shown to customers</h2>
          <div class="a-checks">
            <label><input type="checkbox" name="pay_cod_cash" checked={s.pay_cod_cash !== '0'} /> Cash on delivery</label>
            <label><input type="checkbox" name="pay_cod_card" checked={s.pay_cod_card !== '0'} /> Card on delivery</label>
            <label><input type="checkbox" name="pay_lypay" checked={s.pay_lypay !== '0'} /> LyPay</label>
          </div>
        </section>
        <section class="a-card">
          <h2>Homepage banners</h2>
          <p class="a-muted">Up to 3. Leave the image empty to hide a banner. Phone image 1080 × 1350, computer image 2400 × 1000. Paste a link or upload.</p>
          {banners.slice(0, 3).map((bn, i) => (
            <fieldset class="a-banner" data-banner={i}>
              <legend>Banner {i + 1}</legend>
              <div class="a-grid2">
                <label class="a-f">Computer image<span class="a-row"><input name={`b${i}_image`} value={bn.image ?? ''} /><label class="a-btn sm">Upload<input type="file" accept="image/*" hidden data-banner-upload={`b${i}_image`} /></label></span></label>
                <label class="a-f">Phone image<span class="a-row"><input name={`b${i}_image_mobile`} value={bn.image_mobile ?? ''} /><label class="a-btn sm">Upload<input type="file" accept="image/*" hidden data-banner-upload={`b${i}_image_mobile`} /></label></span></label>
                <label class="a-f">Small line (Arabic)<input name={`b${i}_eyebrow_ar`} dir="rtl" value={bn.eyebrow_ar ?? ''} /></label>
                <label class="a-f">Small line (English)<input name={`b${i}_eyebrow_en`} value={bn.eyebrow_en ?? ''} /></label>
                <label class="a-f">Title (Arabic)<input name={`b${i}_title_ar`} dir="rtl" value={bn.title_ar ?? ''} /></label>
                <label class="a-f">Title (English)<input name={`b${i}_title_en`} value={bn.title_en ?? ''} /></label>
                <label class="a-f">Link when tapped<input name={`b${i}_link`} value={bn.link ?? ''} placeholder="/ar/brand/swarovski" /></label>
              </div>
            </fieldset>
          ))}
        </section>
        <section class="a-card">
          <h2>Info pages</h2>
          <p class="a-muted">Leave empty to use the default text.</p>
          {(['about', 'delivery', 'contact'] as const).map((k) => (
            <div class="a-grid2">
              <label class="a-f">{k} (Arabic)<textarea name={`page_${k}_ar`} dir="rtl" rows={3}>{s[`page_${k}_ar`] ?? ''}</textarea></label>
              <label class="a-f">{k} (English)<textarea name={`page_${k}_en`} rows={3}>{s[`page_${k}_en`] ?? ''}</textarea></label>
            </div>
          ))}
        </section>
      </form>
      <section class="a-card">
        <h2>Team</h2>
        <ul class="a-list">{admins.map((a) => <li>{a.email} <span class="a-muted">since {a.created_at.slice(0, 10)}</span>{admins.length > 1 ? <button class="a-btn sm danger" type="button" data-remove-admin={a.id}>Remove</button> : null}</li>)}</ul>
        <form class="a-row" data-add-admin>
          <input name="email" type="email" placeholder="Email" required aria-label="New team member email" />
          <input name="password" type="password" placeholder="Password (10+ characters)" minlength={10} required aria-label="Password" />
          <button class="a-btn" type="submit">Add team member</button>
        </form>
        <h2>Change my password</h2>
        <form class="a-row" data-change-password>
          <input name="current" type="password" placeholder="Current password" required aria-label="Current password" autocomplete="current-password" />
          <input name="password" type="password" placeholder="New password (10+ characters)" minlength={10} required aria-label="New password" autocomplete="new-password" />
          <button class="a-btn" type="submit">Change password</button>
        </form>
        <p class="a-muted">Changing the password signs you out on every other phone and computer.</p>
        <h2>Logged-in devices</h2>
        <p class="a-muted">Lost a phone, or logged in on someone else’s computer? Sign out everywhere except here.</p>
        <button class="a-btn" type="button" data-end-sessions>Sign out other devices</button>
      </section>
    </Shell>,
  )
})
