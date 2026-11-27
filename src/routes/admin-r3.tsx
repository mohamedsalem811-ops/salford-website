/**
 * Release 3 admin: the waiting list for sold-out pieces (one-tap WhatsApp messages), reviews (approve before they show)
 * and the trust page (owner's text + photo gallery). The "Ask for a review" button lives on the order page in admin.tsx.
 */
import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { getSettings } from '../lib/db'
import { waCustomer } from '../lib/orders'
import { WAITLIST_DAYS, backInStockMessage, onSwitch, parseGallery } from '../lib/r3'
import { Shell, libyaTime } from '../views/admin-shell'

type Vars = { admin: { id: number; email: string } }
export const r3Pages = new Hono<{ Bindings: Env; Variables: Vars }>()
export const r3Api = new Hono<{ Bindings: Env; Variables: Vars }>()

const purgeOld = (db: D1Database) => db.prepare(`DELETE FROM waitlist WHERE created_at < datetime('now', '-${WAITLIST_DAYS} days')`).run()

const Switch = ({ k, on, label, note }: { k: 'waitlist_on' | 'reviews_on'; on: boolean; label: string; note: string }) => (
  <form class="a-card" data-r3-switch={k}>
    <h2>{label} {on ? <span class="tag ok">On</span> : <span class="tag">Off</span>}</h2>
    <p class="a-muted">{note}</p>
    <label class="a-check"><input type="checkbox" name="on" checked={on} /> Show it on the site</label>
    <button class="a-btn p" type="submit">Save</button>
  </form>
)

/* ---------- waiting list ---------- */
type WaitRow = {
  id: number; product_id: number; name: string; phone: string; lang: string; created_at: string; notified_at: string | null
  code: string; name_en: string; name_ar: string; in_stock: number; status: string; deleted_at: string | null; brand: string | null
}

r3Pages.get('/waitlist', async (c) => {
  const db = c.env.DB
  await purgeOld(db)
  const [{ results }, s] = await Promise.all([
    db.prepare(
      `SELECT w.id, w.product_id, w.name, w.phone, w.lang, w.created_at, w.notified_at,
         p.code, p.name_en, p.name_ar, p.in_stock, p.status, p.deleted_at, b.name AS brand
       FROM waitlist w JOIN products p ON p.id = w.product_id LEFT JOIN brands b ON b.id = p.brand_id
       ORDER BY (p.in_stock = 1 AND p.status = 'live' AND p.deleted_at IS NULL) DESC, w.product_id DESC, w.id`,
    ).all<WaitRow>(),
    getSettings(db),
  ])
  const on = onSwitch(s, 'waitlist_on')
  const origin = new URL(c.req.url).origin
  const groups = new Map<number, WaitRow[]>()
  for (const r of results) groups.set(r.product_id, [...(groups.get(r.product_id) ?? []), r])
  const ready = (r: WaitRow) => r.in_stock === 1 && r.status === 'live' && !r.deleted_at
  const toSend = results.filter((r) => ready(r) && !r.notified_at).length
  return c.html(
    <Shell title="Waiting list" nav="waitlist">
      <div class="a-head"><h1>Waiting list</h1></div>
      <div class="a-stats">
        <div><b>{results.length}</b>people waiting</div>
        <div><b>{groups.size}</b>pieces</div>
        <div><b>{toSend}</b>to message now</div>
      </div>
      <Switch k="waitlist_on" on={on} label="“Tell me when it’s back”"
        note="On a sold-out piece, customers can leave their name and WhatsApp number. When you tick the piece back “In stock”, it moves to the top here with a Send button for each person. Entries are deleted after 90 days." />
      <p class="a-muted">Sending opens WhatsApp with the message ready in the customer’s language. Press send in WhatsApp, then come back: the person is marked “Sent”. Automatic sending (WhatsApp Business, paid per message by Meta) can be added later; the list already keeps each person’s language and the date they were sent.</p>
      {results.length ? null : <p class="a-muted">Nobody is waiting yet.</p>}
      {[...groups.values()].map((rows) => {
        const p = rows[0]
        const link = `${origin}/${p.lang === 'en' ? 'en' : 'ar'}/p/${p.product_id}`
        return (
          <section class="a-card">
            <h2>
              <a href={`/admin/p/${p.product_id}`}>{p.brand ? `${p.brand} · ` : ''}{p.name_en || p.name_ar}</a> <code>{p.code}</code>{' '}
              {ready(p) ? <span class="tag ok">Back in stock</span> : p.deleted_at || p.status !== 'live' ? <span class="tag bad">Not on the site</span> : <span class="tag warn">Still sold out</span>}
            </h2>
            <div class="a-table-wrap">
              <table class="a-table">
                <thead><tr><th>Name</th><th>Phone</th><th>Joined</th><th>Message</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const lang = r.lang === 'en' ? 'en' : 'ar'
                    const msg = backInStockMessage(lang, { name: r.name, piece: `${r.brand ? r.brand + ' ' : ''}${r.name_en || r.name_ar}`, code: r.code, link: `${origin}/${lang}/p/${r.product_id}` })
                    return (
                      <tr>
                        <td><bdi>{r.name}</bdi><br /><span class="a-muted">{lang === 'en' ? 'English' : 'Arabic'}</span></td>
                        <td dir="ltr">{r.phone}</td>
                        <td class="c-date">{libyaTime(r.created_at)}</td>
                        <td>
                          {ready(r)
                            ? <a class={`a-btn${r.notified_at ? '' : ' p'}`} href={waCustomer(r.phone, msg)} target="_blank" rel="noopener" data-wl-sent={r.id}>{r.notified_at ? 'Send again' : 'Send on WhatsApp'}</a>
                            : <span class="a-muted">Send when back in stock</span>}
                          {r.notified_at ? <><br /><span class="tag ok">Sent {libyaTime(r.notified_at)}</span></> : null}
                        </td>
                        <td><button class="a-btn" type="button" data-wl-del={r.id}>Remove</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p class="a-muted">Product link: <a href={link} target="_blank" rel="noopener">{link}</a></p>
          </section>
        )
      })}
    </Shell>,
  )
})

r3Api.post('/waitlist/:id{[0-9]+}/sent', async (c) => {
  await c.env.DB.prepare("UPDATE waitlist SET notified_at = datetime('now') WHERE id = ?").bind(Number(c.req.param('id'))).run()
  return c.json({ ok: true })
})
r3Api.delete('/waitlist/:id{[0-9]+}', async (c) => {
  await c.env.DB.prepare('DELETE FROM waitlist WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ ok: true })
})

/* ---------- reviews ---------- */
type ReviewRow = {
  id: number; product_id: number | null; order_id: number | null; name: string; city: string; rating: number; text: string; photo_key: string
  phone: string; lang: string; verified: number; status: string; created_at: string; decided_at: string | null
  p_name: string | null; p_code: string | null; o_number: string | null
}
const SHOWS = ['pending', 'approved', 'rejected'] as const

r3Pages.get('/reviews', async (c) => {
  const db = c.env.DB
  const show = (SHOWS as readonly string[]).includes(c.req.query('show') ?? '') ? String(c.req.query('show')) : 'pending'
  const [{ results }, counts, s] = await Promise.all([
    db.prepare(
      `SELECT r.*, p.name_en AS p_name, p.code AS p_code, o.number AS o_number FROM reviews r
       LEFT JOIN products p ON p.id = r.product_id LEFT JOIN orders o ON o.id = r.order_id
       WHERE r.status = ? ORDER BY r.id DESC LIMIT 200`,
    ).bind(show).all<ReviewRow>(),
    db.prepare('SELECT status, count(*) AS n FROM reviews GROUP BY status').all<{ status: string; n: number }>(),
    getSettings(db),
  ])
  const n = Object.fromEntries(counts.results.map((r) => [r.status, r.n])) as Record<string, number>
  const on = onSwitch(s, 'reviews_on')
  const label = { pending: 'Waiting for you', approved: 'On the site', rejected: 'Rejected' } as Record<string, string>
  return c.html(
    <Shell title="Reviews" nav="reviews">
      <div class="a-head"><h1>Reviews</h1></div>
      <Switch k="reviews_on" on={on} label="Customer reviews"
        note="Shows approved reviews and the “Write a review” form on product pages and the trust page. Nothing a customer writes appears until you approve it here. “Verified buyer” is added automatically when the phone number has a delivered order." />
      <nav class="a-filter" aria-label="Review lists">
        {SHOWS.map((k) => <a class={`a-btn${k === show ? ' p' : ''}`} href={`/admin/reviews?show=${k}`}>{label[k]} ({n[k] ?? 0})</a>)}
      </nav>
      {results.length ? null : <p class="a-muted">{show === 'pending' ? 'No reviews waiting.' : 'None here.'}</p>}
      {results.map((r) => (
        <article class="a-card" data-review={r.id}>
          <h2>
            <span aria-label={`${r.rating} of 5 stars`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>{' '}
            <bdi>{r.name}</bdi>{r.city ? <span class="a-muted"> · <bdi>{r.city}</bdi></span> : null}{' '}
            {r.verified ? <span class="tag ok">Verified buyer</span> : <span class="tag">Not verified</span>}
          </h2>
          <dl class="a-dl">
            <dt>About</dt><dd>{r.product_id ? <a href={`/admin/p/${r.product_id}`}>{r.p_name ?? 'Product'} <code>{r.p_code}</code></a> : 'The shop'}</dd>
            {r.order_id && r.o_number ? <><dt>Order</dt><dd><a href={`/admin/orders/${r.order_id}`}>{r.o_number}</a></dd></> : null}
            <dt>Phone</dt><dd dir="ltr">{r.phone ? <>{r.phone} · <a href={`/admin/customers/${r.phone}`}>Their orders</a></> : '—'} <span class="a-muted">(team only)</span></dd>
            <dt>Sent</dt><dd>{libyaTime(r.created_at)} · {r.lang === 'en' ? 'English' : 'Arabic'}</dd>
            {r.decided_at ? <><dt>Decided</dt><dd>{libyaTime(r.decided_at)}</dd></> : null}
          </dl>
          {r.text ? <p dir="auto" style="white-space:pre-line">{r.text}</p> : <p class="a-muted">No text, stars only.</p>}
          {r.photo_key ? <p><img src={`/admin/reviews/${r.id}/photo`} alt="Customer photo" loading="lazy" style="max-width:100%;max-height:320px;border-radius:10px" /></p> : null}
          <div class="a-sends">
            {r.status !== 'approved' ? <button class="a-btn p" type="button" data-rv={`${r.id}:approve`}>Approve{r.photo_key ? ' with photo' : ''}</button> : null}
            {r.photo_key ? <button class="a-btn" type="button" data-rv={`${r.id}:approve_nophoto`}>{r.status === 'approved' ? 'Remove the photo' : 'Approve without photo'}</button> : null}
            {r.status !== 'rejected' ? <button class="a-btn" type="button" data-rv={`${r.id}:reject`}>{r.status === 'approved' ? 'Hide from the site' : 'Reject'}</button> : null}
            <button class="a-btn" type="button" data-rv={`${r.id}:delete`}>Delete</button>
          </div>
        </article>
      ))}
    </Shell>,
  )
})

/** The team can see a photo before approving it (the public can't: /m refuses rv/ keys). */
r3Pages.get('/reviews/:id{[0-9]+}/photo', async (c) => {
  const r = await c.env.DB.prepare('SELECT photo_key FROM reviews WHERE id = ?').bind(Number(c.req.param('id'))).first<{ photo_key: string }>()
  if (!r?.photo_key) return c.notFound()
  const obj = await c.env.MEDIA.get(r.photo_key)
  if (!obj) return c.notFound()
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'image/jpeg', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } })
})

r3Api.post('/reviews/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const { action } = await c.req.json<{ action?: string }>()
  const db = c.env.DB
  const r = await db.prepare('SELECT photo_key FROM reviews WHERE id = ?').bind(id).first<{ photo_key: string }>()
  if (!r) return c.json({ error: 'Review not found' }, 404)
  if (action === 'approve') await db.prepare("UPDATE reviews SET status = 'approved', decided_at = datetime('now') WHERE id = ?").bind(id).run()
  else if (action === 'approve_nophoto') {
    if (r.photo_key) await c.env.MEDIA.delete(r.photo_key)
    await db.prepare("UPDATE reviews SET status = 'approved', photo_key = '', decided_at = datetime('now') WHERE id = ?").bind(id).run()
  } else if (action === 'reject') await db.prepare("UPDATE reviews SET status = 'rejected', decided_at = datetime('now') WHERE id = ?").bind(id).run()
  else return c.json({ error: 'Unknown action' }, 400)
  return c.json({ ok: true })
})
r3Api.delete('/reviews/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const r = await c.env.DB.prepare('SELECT photo_key FROM reviews WHERE id = ?').bind(id).first<{ photo_key: string }>()
  if (!r) return c.json({ error: 'Review not found' }, 404)
  if (r.photo_key) await c.env.MEDIA.delete(r.photo_key)
  await c.env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

/* ---------- on/off switches (both change what the shop shows, so the catalog is refreshed) ---------- */
r3Api.post('/r3-switch', async (c) => {
  const b = await c.req.json<{ key?: string; on?: unknown }>()
  if (b.key !== 'waitlist_on' && b.key !== 'reviews_on') return c.json({ error: 'Unknown switch' }, 400)
  const on = b.on === true || b.on === '1' || b.on === 'on' ? '1' : '0'
  await c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(b.key, on).run()
  return c.json({ ok: true, on: on === '1' })
})

/* ---------- trust page ---------- */
r3Pages.get('/trust', async (c) => {
  const s = await getSettings(c.env.DB)
  const gallery = parseGallery(s.trust_gallery)
  return c.html(
    <Shell title="Trust page" nav="trust">
      <div class="a-head"><h1>Trust page</h1><a class="a-btn" href="/ar/page/trust" target="_blank" rel="noopener">View page ↗</a></div>
      <form class="a-card" data-trust-form>
        <p class="a-muted">The page always shows the three facts: authentic boxes, original gift receipts, and exchange or return only at delivery after the customer checks the piece. Below them it shows your own words and photos (optional). Approved reviews appear there too when reviews are on.</p>
        <label class="a-f">Your words (Arabic)<textarea name="trust_text_ar" rows={5} dir="rtl" maxlength={4000}>{s.trust_text_ar ?? ''}</textarea></label>
        <label class="a-f">Your words (English)<textarea name="trust_text_en" rows={5} maxlength={4000}>{s.trust_text_en ?? ''}</textarea></label>
        <h2>Photos <span class="a-muted">(up to 24: boxes, receipts, packing, deliveries)</span></h2>
        <ul class="a-gal" data-gallery>
          {gallery.map((g) => (
            <li data-url={g.url}>
              <img src={g.url} alt="" loading="lazy" />
              <label class="a-f">Caption (Arabic)<input name="cap_ar" value={g.cap_ar} dir="rtl" maxlength={120} /></label>
              <label class="a-f">Caption (English)<input name="cap_en" value={g.cap_en} maxlength={120} /></label>
              <button class="a-btn" type="button" data-gal-del>Remove</button>
            </li>
          ))}
        </ul>
        <label class="a-btn">Add photos<input type="file" accept="image/*" multiple hidden data-gal-add /></label>
        <p class="a-muted">Photos are made smaller on this device and their location data is removed before upload.</p>
        <p class="a-err" data-form-err hidden></p>
        <button class="a-btn p" type="submit">Save trust page</button>
      </form>
    </Shell>,
  )
})

r3Api.post('/trust', async (c) => {
  const b = await c.req.json<{ trust_text_ar?: unknown; trust_text_en?: unknown; gallery?: unknown }>()
  const txt = (v: unknown) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, 4000)
  const gallery = parseGallery(Array.isArray(b.gallery) ? b.gallery : [])
  const up = 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  const db = c.env.DB
  await db.batch([
    db.prepare(up).bind('trust_text_ar', txt(b.trust_text_ar)),
    db.prepare(up).bind('trust_text_en', txt(b.trust_text_en)),
    db.prepare(up).bind('trust_gallery', JSON.stringify(gallery)),
  ])
  return c.json({ ok: true, photos: gallery.length })
})
