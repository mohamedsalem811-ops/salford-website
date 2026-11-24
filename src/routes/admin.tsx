import { Hono } from 'hono'
import type { Child } from 'hono/jsx'
import type { Env, Product, Media } from '../lib/db'
import { getBrands, getCategories, getSettings, fmtLyd } from '../lib/db'
import { requireAdmin, verifyLogin, startSession, endSession, tooManyAttempts, recordAttempt, clientIp, hashPassword } from '../lib/auth'
import { mediaUrl } from '../lib/media'
import { V } from '../views/layout'
import { adminApi } from './admin-api'

/** D1 stores UTC ('2026-11-24 13:05:00'); the team reads Libya time. */
const libyaFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
const libyaTime = (utc: string | number) => {
  const d = new Date(String(utc).replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? String(utc) : libyaFmt.format(d)
}

type Vars = { admin: { id: number; email: string } }
export const admin = new Hono<{ Bindings: Env; Variables: Vars }>()

const Shell = ({ title, children, nav }: { title: string; children: Child; nav?: string }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex, nofollow" />
      <title>{title} · Salford Admin</title>
      <link rel="icon" type="image/png" href="/static/brand/favicon-48.png" />
      <link rel="stylesheet" href={`/static/admin.css?v=${V}`} />
    </head>
    <body>
      {nav !== undefined ? (
        <div class="a-wrap">
          <nav class="a-side" aria-label="Admin">
            <img class="a-logo" src="/static/brand/word-white.webp" alt="Salford" width="480" height="127" />
            <a href="/admin" class={nav === 'products' ? 'on' : ''}>Products</a>
            <a href="/admin/orders" class={nav === 'orders' ? 'on' : ''}>Orders</a>
            <a href="/admin/settings" class={nav === 'settings' ? 'on' : ''}>Settings</a>
            <a href="/ar/" target="_blank" rel="noopener">View site ↗</a>
            <form method="post" action="/admin/logout"><button class="linkbtn" type="submit">Log out</button></form>
          </nav>
          <main class="a-main">{children}</main>
        </div>
      ) : (
        <main class="a-center">{children}</main>
      )}
      <div class="toast" role="status" aria-live="polite" hidden></div>
      <script src={`/static/admin.js?v=${V}`} defer></script>
    </body>
  </html>
)

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
const STATUSES = ['new', 'confirmed', 'paid', 'delivered', 'cancelled']

admin.get('/orders', async (c) => {
  const status = c.req.query('status') ?? ''
  const { results } = await c.env.DB.prepare(
    `SELECT o.*, (SELECT sum(qty) FROM order_items i WHERE i.order_id = o.id) items FROM orders o ${status ? 'WHERE status = ?' : ''} ORDER BY o.id DESC LIMIT 300`,
  ).bind(...(status ? [status] : [])).all<Record<string, string | number>>()
  return c.html(
    <Shell title="Orders" nav="orders">
      <div class="a-head"><h1>Orders</h1>
        <form method="get" class="a-filter"><select name="status" aria-label="Status"><option value="">All</option>{STATUSES.map((s) => <option value={s} selected={status === s}>{s}</option>)}</select><button class="a-btn">Filter</button></form>
      </div>
      <div class="a-table-wrap">
        <table class="a-table a-olist">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>City</th><th>Items</th><th>Total</th><th>Payment</th><th>Sent via</th><th>Status</th></tr></thead>
          <tbody>
            {results.map((o) => (
              <tr>
                <td class="c-no"><a href={`/admin/orders/${o.id}`}><b>{o.number}</b></a></td>
                <td class="c-date">{libyaTime(o.created_at)}</td>
                <td class="c-cust" dir="auto">{o.name}<br /><span class="a-muted" dir="ltr">{o.phone}</span></td>
                <td class="c-city" dir="auto">{o.city}</td>
                <td class="c-items">{o.items}<span class="a-ph"> items</span></td>
                <td class="num c-tot">{fmtLyd(Number(o.total))} LYD</td>
                <td class="c-pay">{PAY[String(o.payment)]}{o.payment === 'cod_card' ? <span class="tag warn">bring card machine</span> : null}</td>
                <td class="c-ch">{o.channel}</td>
                <td class="c-st"><span class={`tag st-${o.status}`}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length ? null : <p class="a-muted">No orders yet.</p>}
      </div>
    </Shell>,
  )
})

admin.get('/orders/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Record<string, string | number>>()
  if (!o) return c.redirect('/admin/orders')
  const { results: items } = await c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid').bind(id).all<Record<string, string | number>>()
  const wa = `https://wa.me/218${String(o.phone).replace(/^0/, '')}`
  return c.html(
    <Shell title={String(o.number)} nav="orders">
      <div class="a-head"><h1>Order {o.number}</h1><a class="a-btn" href="/admin/orders">All orders</a></div>
      <div class="a-cols">
        <div class="a-card">
          <h2>Customer</h2>
          <dl class="a-dl">
            <dt>Name</dt><dd dir="auto">{o.name}</dd>
            <dt>Phone</dt><dd dir="ltr">{o.phone} · <a href={wa} target="_blank" rel="noopener">WhatsApp</a></dd>
            <dt>City</dt><dd dir="auto">{o.city}</dd>
            <dt>Address</dt><dd dir="auto">{o.address || '—'}</dd>
            <dt>Note</dt><dd dir="auto">{o.note || '—'}</dd>
            <dt>Payment</dt><dd>{PAY[String(o.payment)]}{o.payment === 'cod_card' ? ' · bring card machine' : ''}</dd>
            <dt>Sent via</dt><dd>{o.channel} · {o.lang === 'ar' ? 'Arabic' : 'English'}</dd>
            <dt>Created</dt><dd>{libyaTime(o.created_at)} <span class="a-muted">Libya time</span></dd>
          </dl>
        </div>
        <div class="a-card">
          <h2>Items</h2>
          <table class="a-table"><tbody>{items.map((i) => <tr><td>{i.brand}</td><td dir="auto">{i.name}<br /><code>{i.code}</code></td><td>× {i.qty}</td><td class="num">{fmtLyd(Number(i.price) * Number(i.qty))}</td></tr>)}</tbody></table>
          <p class="a-total">Total <b>{fmtLyd(Number(o.total))} LYD</b></p>
          <form class="a-order-form" data-order-form={o.id}>
            <label class="a-f">Status<select name="status">{STATUSES.map((s) => <option value={s} selected={o.status === s}>{s}</option>)}</select></label>
            <label class="a-f">Team note<textarea name="admin_note" rows={3}>{o.admin_note}</textarea></label>
            <button class="a-btn p" type="submit">Save</button>
          </form>
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
