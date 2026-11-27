import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { getBrands, getSettings, fmtLyd, pName } from '../lib/db'
import { lookOf } from '../lib/looks'
import { catalog, productsByIds, offerNow, earlyOf, bumpCatalog } from '../lib/catalog'
import { shopPrice, isEarlyNow, tiersOf } from '../lib/pricing'
import type { Quote } from '../lib/pricing'
import { parseItems, loadFromCatalog, loadFresh, runQuote, placeName } from '../lib/checkout'
import { firstImage, mediaUrl } from '../lib/media'
import { isLang, type Lang } from '../lib/i18n'
import { normalizePhone, channelLinks, buildMessage, sha256hex, randomToken, trackUrl, loadOrderForCustomer, type OrderSum } from '../lib/orders'
import { onSwitch, stripMetadata, photoType, MAX_REVIEW_PHOTO, WAITLIST_DAYS } from '../lib/r3'

export { normalizePhone, channelLinks, buildMessage }

export const api = new Hono<{ Bindings: Env }>()

/** Product summaries for the cart (prices always come from the database). */
api.get('/cart', async (c) => {
  const lang: Lang = isLang(c.req.query('lang')) ? (c.req.query('lang') as Lang) : 'ar'
  const ids = (c.req.query('ids') || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50)
  if (!ids.length) return c.json({ items: [] })
  const cat = await catalog(c)
  const withMedia = productsByIds(cat, ids)
  const brands = cat.allBrands
  const offer = offerNow(cat, earlyOf(c))
  return c.json({
    items: withMedia.map((p) => {
      const img = firstImage(p.media)
      const sp = shopPrice(p, offer)
      return {
        id: p.id, code: p.code, name: pName(p, lang), brand: brands.find((b) => b.id === p.brand_id)?.name ?? '',
        price: sp.price, priceText: fmtLyd(sp.price), was: sp.was, flashLeft: sp.flash ? sp.flash.left : undefined, inStock: !!p.in_stock, image: img ? mediaUrl(img, 400) : '',
      }
    }),
  })
})

const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
const ipHashOf = async (c: { req: { header: (k: string) => string | undefined } }, salt: string) => (await sha256hex(salt + (c.req.header('cf-connecting-ip') ?? ''))).slice(0, 32)
const areaIdOf = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0 }

/** What the cart and checkout show; the same sums the order will be charged (prices from the shop, never from the browser). */
function quoteJson(q: Quote, lang: Lang, giftOf?: (id: number) => { name: string; image: string } | null) {
  const o = q.offer
  const d = q.delivery
  const giftInfo = o?.gift_product_id && giftOf ? giftOf(o.gift_product_id) : null
  return {
    subtotal: q.subtotal, discount: q.discount, kind: q.kind, items: q.items, fee: q.fee, total: q.total,
    lines: q.lines.map((l) => ({ id: l.id, qty: l.qty, orig: l.orig, price: l.price, ...(l.flash ? { flash: true } : {}) })),
    offer: o ? {
      name: (lang === 'ar' ? o.name_ar || o.name_en : o.name_en || o.name_ar) || lookOf(o.template).occasion[lang], pct: o.percent, ends: o.ends_at, kind: o.kind,
      tiers: o.kind === 'tiers' ? tiersOf(o) : [],
    } : null,
    flashSaving: q.flashSaving, flashShort: q.flashShort, offerSaving: q.offerSaving,
    tier: q.tier,
    // R4: the free gift added to this order, or how much more until it (only while the gift is in stock)
    gift: q.gift && giftInfo ? { ...giftInfo, orig: q.gift.orig } : null,
    giftNeed: giftInfo ? q.giftNeed : 0,
    giftName: giftInfo && !q.gift && q.giftNeed > 0 ? giftInfo.name : '',
    code: q.code ? { code: q.code.code, status: q.code.status, saving: q.code.saving, min: q.code.min ?? 0, kind: q.code.row?.kind ?? '', value: q.code.row?.value ?? 0 } : null,
    loyalty: q.loyalty ? { pct: q.loyalty.pct, saving: q.loyalty.saving } : null,
    delivery: {
      mode: d.mode,
      fee: d.mode === 'fee' ? d.fee : 0,
      time: d.mode !== 'off' && d.area ? (lang === 'ar' ? d.area.time_ar || d.area.time_en : d.area.time_en || d.area.time_ar) : '',
    },
  }
}

const CODE_TRIES = 20 // wrong codes per connection per hour

api.post('/quote', async (c) => {
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'bad_request' }, 400) }
  const lang: Lang = isLang(String(body.lang)) ? (body.lang as Lang) : 'ar'
  const want = parseItems(body.items)
  const cat = await catalog(c)
  const phone = normalizePhone(String(body.phone ?? '')) ?? ''
  const db = c.env.DB
  let slow = false, ipHash = ''
  if (String(body.code ?? '').trim()) {
    ipHash = await ipHashOf(c, 'sl-code:')
    const r = await db.prepare("SELECT count(*) AS n FROM attempts WHERE kind = 'code' AND ip_hash = ? AND at > datetime('now', '-1 hour')").bind(ipHash).first<{ n: number }>()
    slow = (r?.n ?? 0) >= CODE_TRIES
  }
  const loaded = await loadFromCatalog(db, cat, want, body.code, phone, areaIdOf(body.area_id), !slow, earlyOf(c))
  const q = runQuote(loaded, want, !!phone)
  const out = quoteJson(q, lang, (id) => {
    const g = loaded.gift && loaded.gift.id === id && loaded.gift.in_stock ? productsByIds(cat, [id])[0] : null
    if (!g) return null
    const img = firstImage(g.media)
    return { name: pName(g, lang), image: img ? mediaUrl(img, 400) : '' }
  })
  if (out.code && slow) out.code.status = 'slow' as never
  else if (out.code?.status === 'invalid' && ipHash) {
    await db.batch([
      db.prepare("INSERT INTO attempts (kind, ip_hash) VALUES ('code', ?)").bind(ipHash),
      db.prepare("DELETE FROM attempts WHERE at < datetime('now', '-2 days')"),
    ])
  }
  // every product in the cart, including ones that sold out (shown greyed, not counted)
  const brands = cat.allBrands
  const items = productsByIds(cat, [...want.keys()]).map((p) => {
    const img = firstImage(p.media)
    const l = out.lines.find((x) => x.id === p.id)
    return {
      id: p.id, code: p.code, name: pName(p, lang), brand: brands.find((b) => b.id === p.brand_id)?.name ?? '',
      image: img ? mediaUrl(img, 400) : '', inStock: !!p.in_stock, qty: want.get(p.id) ?? 1,
      orig: p.price, price: l ? l.price : p.price, was: !l && p.compare_price && p.compare_price > p.price ? p.compare_price : null,
    }
  })
  return c.json({ ...out, products: items, deliveryOn: loaded.deliveryOn, freeMin: loaded.freeMin })
})

api.post('/orders', async (c) => {
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'bad_request' }, 400) }
  const lang: Lang = isLang(String(body.lang)) ? (body.lang as Lang) : 'ar'
  const name = clean(body.name, 80)
  const phone = normalizePhone(String(body.phone ?? '')) ?? ''
  const cityText = clean(body.city, 60)
  const areaId = areaIdOf(body.area_id)
  const address = clean(body.address, 200)
  const note = clean(body.note, 200)
  const payment = String(body.payment ?? '')
  const channel = String(body.channel ?? '')
  if (String(body.website ?? '')) return c.json({ error: 'bad_request' }, 400) // hidden field only robots fill in
  const errors: string[] = []
  if (!name) errors.push('name')
  if (!phone) errors.push('phone')
  if (!cityText && !areaId) errors.push('city')
  const settings = await getSettings(c.env.DB)
  const payOn = { cod_cash: settings.pay_cod_cash !== '0', cod_card: settings.pay_cod_card !== '0', lypay: settings.pay_lypay !== '0' } as Record<string, boolean>
  if (!payOn[payment]) errors.push('payment')
  const links = channelLinks(settings, '')
  if (!['whatsapp', 'messenger', 'instagram'].includes(channel) || !links[channel as keyof typeof links]) errors.push('channel')
  const want = parseItems(body.items)
  if (!want.size) errors.push('items')
  if (errors.length) return c.json({ error: 'invalid', fields: errors }, 422)

  const ipHash = await ipHashOf(c, 'sl-order:')
  const recent = await c.env.DB.prepare(
    "SELECT (SELECT count(*) FROM orders WHERE phone = ? AND created_at > datetime('now', '-1 hour')) AS byPhone, (SELECT count(*) FROM orders WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')) AS byIp",
  ).bind(phone, ipHash).first<{ byPhone: number; byIp: number }>()
  // 5 per phone, 15 per connection (mobile networks share addresses, so this stays generous)
  if ((recent?.byPhone ?? 0) >= 5 || (recent?.byIp ?? 0) >= 15) return c.json({ error: 'too_many' }, 429)

  // R7: everything recalculated from fresh rows: products, offer, code (with its use counts) and the delivery area
  const loaded = await loadFresh(c.env.DB, want, body.code, phone, areaId, earlyOf(c))
  if (!loaded.products.length) return c.json({ error: 'unavailable' }, 409)
  const area = loaded.deliveryOn ? loaded.area : null
  const place = area ? placeName(area, lang) : null
  const city = place ? place.city : cityText
  if (!city) return c.json({ error: 'invalid', fields: ['city'] }, 422)
  const q = runQuote({ ...loaded, area }, want, true)
  const brands = await getBrands(c.env.DB, true)
  const byId = new Map(loaded.products.map((p) => [p.id, p]))
  const lines = q.lines.map((l) => {
    const p = byId.get(l.id)!
    return { product_id: p.id, code: p.code, brand: brands.find((b) => b.id === p.brand_id)?.name ?? '', name: pName(p, lang), price: l.price, orig_price: l.orig, qty: l.qty, flash_id: l.flash ?? null, is_gift: 0 }
  })
  // R4: one free gift per order (price 0), added as its own line
  const g = q.gift && loaded.gift && loaded.gift.id === q.gift.id ? loaded.gift : null
  if (g) lines.push({ product_id: g.id, code: g.code, brand: brands.find((b) => b.id === g.brand_id)?.name ?? '', name: pName(g, lang), price: 0, orig_price: q.gift!.orig, qty: 1, flash_id: null, is_gift: 1 })
  const early = isEarlyNow(q.offer) ? 1 : 0
  const unavailable = [...want.keys()].filter((id) => !byId.has(id))
  const o = q.offer
  const offerName = q.kind === 'offer' && o ? (lang === 'ar' ? o.name_ar || o.name_en : o.name_en || o.name_ar) || lookOf(o.template).occasion[lang] : ''
  const d = q.delivery
  const loyalty = q.kind === 'loyalty' && q.loyalty ? q.loyalty.pct : 0
  const sum: OrderSum = {
    subtotal: q.subtotal, discount: q.discount, kind: q.kind, offerName, code: q.kind === 'code' ? q.code!.code : '', ...(loyalty ? { loyalty } : {}),
    area: place?.area ?? '',
    delivery: d.mode === 'fee' && d.fee === 0 ? 'free' : d.mode,
    fee: q.fee,
    time: d.mode !== 'off' && d.area ? (lang === 'ar' ? d.area.time_ar || d.area.time_en : d.area.time_en || d.area.time_ar) : '',
  }

  const token = randomToken()
  const ins = await c.env.DB.prepare(
    `INSERT INTO orders (name, phone, city, address, note, payment, channel, lang, total, view_token, ip_hash,
      subtotal, discount_total, discount_kind, offer_id, offer_name, code, loyalty, area, area_id, delivery_fee, delivery_free, delivery_chat, delivery_time, gift, early)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(name, phone, city, address, note, payment, channel, lang, q.total, token, ipHash,
      q.subtotal, q.discount, q.kind, o && (q.kind === 'offer' || q.flashSaving > 0 || g) ? o.id : null, offerName, sum.code, loyalty, sum.area, area ? area.id : null,
      q.fee, sum.delivery === 'free' ? 1 : 0, sum.delivery === 'chat' ? 1 : 0, sum.time, g ? pName(g, lang) : '', early)
    .first<{ id: number }>()
  const id = ins!.id
  const number = `SL-${1000 + id}`
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE orders SET number = ? WHERE id = ?').bind(number, id),
    c.env.DB.prepare("INSERT INTO order_events (order_id, status) VALUES (?, 'new')").bind(id),
    ...lines.map((l) => c.env.DB.prepare('INSERT INTO order_items (order_id, product_id, code, brand, name, price, qty, orig_price, flash_id, is_gift) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, l.product_id, l.code, l.brand, l.name, l.price, l.qty, l.orig_price, l.flash_id, l.is_gift)),
  ])
  // flash deals: the shop's "X left" counts this order straight away
  if (lines.some((l) => l.flash_id)) await bumpCatalog(c.env.DB)
  const track = trackUrl(new URL(c.req.url).origin, lang, number, token)
  const message = buildMessage({ lang, number, lines, total: q.total, name, phone, city, address, note, payment, sum, track })
  const codeNote = q.code && q.code.status !== 'ok' ? q.code.status : ''
  return c.json({ number, token, message, links: channelLinks(settings, message), channel, unavailable, total: fmtLyd(q.total), codeNote })
})

/* ---------- Release 3: waiting list and reviews ---------- */

/** Counts this connection's tries of one kind in the last hour, and notes one more. True when over the limit. */
async function overLimit(db: D1Database, kind: string, ipHash: string, max: number) {
  const r = await db.prepare("SELECT count(*) AS n FROM attempts WHERE kind = ? AND ip_hash = ? AND at > datetime('now', '-1 hour')").bind(kind, ipHash).first<{ n: number }>()
  if ((r?.n ?? 0) >= max) return true
  await db.batch([
    db.prepare('INSERT INTO attempts (kind, ip_hash) VALUES (?, ?)').bind(kind, ipHash),
    db.prepare("DELETE FROM attempts WHERE at < datetime('now', '-2 days')"),
  ])
  return false
}
const switchOn = async (db: D1Database, key: 'waitlist_on' | 'reviews_on') =>
  onSwitch({ [key]: (await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>())?.value ?? '0' }, key)

const WAIT_TRIES = 10 // sign-ups per connection per hour
const REVIEW_TRIES = 5 // reviews per connection per hour

/** "Tell me when it's back": one entry per phone per sold-out product; signing up again refreshes it. */
api.post('/waitlist', async (c) => {
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'bad_request' }, 400) }
  if (String(body.website ?? '')) return c.json({ error: 'bad_request' }, 400)
  const db = c.env.DB
  if (!(await switchOn(db, 'waitlist_on'))) return c.json({ error: 'off' }, 403)
  const lang: Lang = isLang(String(body.lang)) ? (body.lang as Lang) : 'ar'
  const pid = Number(body.product_id)
  const name = clean(body.name, 60)
  const phone = normalizePhone(String(body.phone ?? '')) ?? ''
  const fields = [...(name ? [] : ['name']), ...(phone ? [] : ['phone'])]
  if (!Number.isInteger(pid) || pid <= 0) fields.push('product')
  if (fields.length) return c.json({ error: 'invalid', fields }, 422)
  const p = await db.prepare("SELECT id, in_stock FROM products WHERE id = ? AND status = 'live' AND deleted_at IS NULL").bind(pid).first<{ id: number; in_stock: number }>()
  if (!p) return c.json({ error: 'unavailable' }, 404)
  if (p.in_stock) return c.json({ error: 'in_stock' }, 409)
  const ipHash = await ipHashOf(c, 'sl-wait:')
  if (await overLimit(db, 'wait', ipHash, WAIT_TRIES)) return c.json({ error: 'too_many' }, 429)
  await db.batch([
    db.prepare(`INSERT INTO waitlist (product_id, name, phone, lang, ip_hash) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(product_id, phone) DO UPDATE SET name = excluded.name, lang = excluded.lang, ip_hash = excluded.ip_hash, created_at = datetime('now'), notified_at = NULL`).bind(pid, name, phone, lang, ipHash),
    db.prepare(`DELETE FROM waitlist WHERE created_at < datetime('now', '-${WAITLIST_DAYS} days')`),
  ])
  return c.json({ ok: true })
})

/** Release 4 "Remind me": one entry per phone per offer, only while the offer has not started. Deleted after 90 days. */
const REMIND_TRIES = 10
api.post('/remind', async (c) => {
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'bad_request' }, 400) }
  if (String(body.website ?? '')) return c.json({ error: 'bad_request' }, 400)
  const db = c.env.DB
  const lang: Lang = isLang(String(body.lang)) ? (body.lang as Lang) : 'ar'
  const oid = Number(body.offer_id)
  const name = clean(body.name, 60)
  const phone = normalizePhone(String(body.phone ?? '')) ?? ''
  const fields = [...(name ? [] : ['name']), ...(phone ? [] : ['phone'])]
  if (!Number.isInteger(oid) || oid <= 0) fields.push('offer')
  if (fields.length) return c.json({ error: 'invalid', fields }, 422)
  const o = await db.prepare("SELECT id FROM offers WHERE id = ? AND enabled = 1 AND teaser_days > 0 AND starts_at > datetime('now')").bind(oid).first()
  if (!o) return c.json({ error: 'gone' }, 409)
  const ipHash = await ipHashOf(c, 'sl-remind:')
  if (await overLimit(db, 'remind', ipHash, REMIND_TRIES)) return c.json({ error: 'too_many' }, 429)
  await db.batch([
    db.prepare(`INSERT INTO offer_reminders (offer_id, name, phone, lang, ip_hash) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(offer_id, phone) DO UPDATE SET name = excluded.name, lang = excluded.lang, ip_hash = excluded.ip_hash, created_at = datetime('now')`).bind(oid, name, phone, lang, ipHash),
    db.prepare("DELETE FROM offer_reminders WHERE created_at < datetime('now', '-90 days')"),
  ])
  return c.json({ ok: true })
})

/**
 * A review: from a product page (anyone), or from the customer's own order link after delivery.
 * It shows only once the team approves it. Sent as a form (with an optional photo) or as JSON.
 */
api.post('/reviews', async (c) => {
  if (Number(c.req.header('content-length') ?? 0) > MAX_REVIEW_PHOTO + 64 * 1024) return c.json({ error: 'too_large' }, 413)
  const f: Record<string, unknown> = {}
  let photo: File | null = null
  try {
    if ((c.req.header('content-type') ?? '').includes('multipart/form-data')) {
      const fd = await c.req.formData()
      for (const [k, v] of fd.entries()) {
        const fv = v as unknown as File | string
        if (k === 'photo') { if (typeof fv !== 'string' && fv.size) photo = fv }
        else f[k] = v
      }
    } else Object.assign(f, await c.req.json())
  } catch { return c.json({ error: 'bad_request' }, 400) }
  if (String(f.website ?? '')) return c.json({ error: 'bad_request' }, 400)
  const db = c.env.DB
  if (!(await switchOn(db, 'reviews_on'))) return c.json({ error: 'off' }, 403)
  const lang: Lang = isLang(String(f.lang)) ? (f.lang as Lang) : 'ar'
  const rating = Number(f.rating)
  const name = clean(f.name, 60)
  const city = clean(f.city, 60)
  const text = String(f.text ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 800)
  const fields: string[] = []
  if (!(Number.isInteger(rating) && rating >= 1 && rating <= 5)) fields.push('rating')
  if (!name) fields.push('name')
  const pidRaw = String(f.product_id ?? '').trim()
  let pid: number | null = pidRaw ? Number(pidRaw) : null
  if (pid !== null && !(Number.isInteger(pid) && pid > 0)) fields.push('product')
  if (fields.length) return c.json({ error: 'invalid', fields }, 422)

  let phone = normalizePhone(String(f.phone ?? '')) ?? ''
  let orderId: number | null = null
  let verified = 0
  if (f.number || f.token) {
    // from the customer's own order link: the order must be delivered, the piece must be in it
    const got = await loadOrderForCustomer(db, String(f.number ?? ''), String(f.token ?? ''))
    if (!got) return c.json({ error: 'order' }, 404)
    if (got.order.status !== 'delivered') return c.json({ error: 'not_delivered' }, 409)
    if (pid !== null) {
      const inOrder = await db.prepare('SELECT 1 AS y FROM order_items WHERE order_id = ? AND product_id = ?').bind(got.order.id, pid).first()
      if (!inOrder) return c.json({ error: 'invalid', fields: ['product'] }, 422)
    }
    const dup = await db.prepare("SELECT 1 AS y FROM reviews WHERE order_id = ? AND product_id IS ? AND status != 'rejected'").bind(got.order.id, pid).first()
    if (dup) return c.json({ error: 'done' }, 409)
    orderId = got.order.id
    phone = got.order.phone
    verified = 1
  } else {
    if (pid === null) return c.json({ error: 'invalid', fields: ['product'] }, 422)
    const p = await db.prepare("SELECT 1 AS y FROM products WHERE id = ? AND status = 'live' AND deleted_at IS NULL").bind(pid).first()
    if (!p) return c.json({ error: 'unavailable' }, 404)
    if (phone) {
      const dup = await db.prepare("SELECT 1 AS y FROM reviews WHERE product_id = ? AND phone = ? AND status != 'rejected'").bind(pid, phone).first()
      if (dup) return c.json({ error: 'done' }, 409)
      verified = (await db.prepare("SELECT 1 AS y FROM orders WHERE phone = ? AND status = 'delivered' LIMIT 1").bind(phone).first()) ? 1 : 0
    }
  }

  let bytes: Uint8Array | null = null
  if (photo) {
    if (photo.size > MAX_REVIEW_PHOTO) return c.json({ error: 'photo' }, 413)
    bytes = stripMetadata(new Uint8Array(await photo.arrayBuffer()))
    if (!bytes) return c.json({ error: 'photo' }, 415)
  }
  const ipHash = await ipHashOf(c, 'sl-review:')
  if (await overLimit(db, 'review', ipHash, REVIEW_TRIES)) return c.json({ error: 'too_many' }, 429)
  let key = ''
  if (bytes) {
    key = `rv/${randomToken().slice(0, 24)}`
    await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: photoType(bytes) === 'webp' ? 'image/webp' : 'image/jpeg' } })
  }
  await db.prepare('INSERT INTO reviews (product_id, order_id, name, city, rating, text, photo_key, phone, lang, verified, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(pid, orderId, name, city, rating, text, key, phone, lang, verified, ipHash).run()
  return c.json({ ok: true })
})

/** A review photo, only while its review is approved (unapproved photos are never public). */
api.get('/review-photo/:id{[0-9]+}', async (c) => {
  const cat = await catalog(c)
  const r = cat.reviews.find((x) => x.id === Number(c.req.param('id')))
  if (!r || !r.photo_key) return c.notFound()
  const obj = await c.env.MEDIA.get(r.photo_key)
  if (!obj) return c.notFound()
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'image/jpeg',
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  })
})
