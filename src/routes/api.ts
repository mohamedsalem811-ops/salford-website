import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { getBrands, getSettings, fmtLyd, pName } from '../lib/db'
import { lookOf } from '../lib/looks'
import { catalog, productsByIds, offerNow } from '../lib/catalog'
import { shopPrice } from '../lib/pricing'
import type { Quote } from '../lib/pricing'
import { parseItems, loadFromCatalog, loadFresh, runQuote, placeName } from '../lib/checkout'
import { firstImage, mediaUrl } from '../lib/media'
import { isLang, type Lang } from '../lib/i18n'
import { normalizePhone, channelLinks, buildMessage, sha256hex, randomToken, type OrderSum } from '../lib/orders'

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
  const offer = offerNow(cat)
  return c.json({
    items: withMedia.map((p) => {
      const img = firstImage(p.media)
      const sp = shopPrice(p, offer)
      return {
        id: p.id, code: p.code, name: pName(p, lang), brand: brands.find((b) => b.id === p.brand_id)?.name ?? '',
        price: sp.price, priceText: fmtLyd(sp.price), was: sp.was, inStock: !!p.in_stock, image: img ? mediaUrl(img, 400) : '',
      }
    }),
  })
})

const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
const ipHashOf = async (c: { req: { header: (k: string) => string | undefined } }, salt: string) => (await sha256hex(salt + (c.req.header('cf-connecting-ip') ?? ''))).slice(0, 32)
const areaIdOf = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0 }

/** What the cart and checkout show; the same sums the order will be charged (prices from the shop, never from the browser). */
function quoteJson(q: Quote, lang: Lang) {
  const o = q.offer
  const d = q.delivery
  return {
    subtotal: q.subtotal, discount: q.discount, kind: q.kind, items: q.items, fee: q.fee, total: q.total,
    lines: q.lines.map((l) => ({ id: l.id, qty: l.qty, orig: l.orig, price: l.price })),
    offer: o ? { name: (lang === 'ar' ? o.name_ar || o.name_en : o.name_en || o.name_ar) || lookOf(o.template).occasion[lang], pct: o.percent, ends: o.ends_at } : null,
    code: q.code ? { code: q.code.code, status: q.code.status, saving: q.code.saving, min: q.code.min ?? 0, kind: q.code.row?.kind ?? '', value: q.code.row?.value ?? 0 } : null,
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
  const loaded = await loadFromCatalog(db, cat, want, body.code, phone, areaIdOf(body.area_id), !slow)
  const q = runQuote(loaded, want, !!phone)
  const out = quoteJson(q, lang)
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
  const loaded = await loadFresh(c.env.DB, want, body.code, phone, areaId)
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
    return { product_id: p.id, code: p.code, brand: brands.find((b) => b.id === p.brand_id)?.name ?? '', name: pName(p, lang), price: l.price, orig_price: l.orig, qty: l.qty }
  })
  const unavailable = [...want.keys()].filter((id) => !byId.has(id))
  const o = q.offer
  const offerName = q.kind === 'offer' && o ? (lang === 'ar' ? o.name_ar || o.name_en : o.name_en || o.name_ar) || lookOf(o.template).occasion[lang] : ''
  const d = q.delivery
  const sum: OrderSum = {
    subtotal: q.subtotal, discount: q.discount, kind: q.kind, offerName, code: q.kind === 'code' ? q.code!.code : '',
    area: place?.area ?? '',
    delivery: d.mode === 'fee' && d.fee === 0 ? 'free' : d.mode,
    fee: q.fee,
    time: d.mode !== 'off' && d.area ? (lang === 'ar' ? d.area.time_ar || d.area.time_en : d.area.time_en || d.area.time_ar) : '',
  }

  const token = randomToken()
  const ins = await c.env.DB.prepare(
    `INSERT INTO orders (name, phone, city, address, note, payment, channel, lang, total, view_token, ip_hash,
      subtotal, discount_total, discount_kind, offer_id, offer_name, code, area, area_id, delivery_fee, delivery_free, delivery_chat, delivery_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(name, phone, city, address, note, payment, channel, lang, q.total, token, ipHash,
      q.subtotal, q.discount, q.kind, q.kind === 'offer' && o ? o.id : null, offerName, sum.code, sum.area, area ? area.id : null,
      q.fee, sum.delivery === 'free' ? 1 : 0, sum.delivery === 'chat' ? 1 : 0, sum.time)
    .first<{ id: number }>()
  const id = ins!.id
  const number = `SL-${1000 + id}`
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE orders SET number = ? WHERE id = ?').bind(number, id),
    ...lines.map((l) => c.env.DB.prepare('INSERT INTO order_items (order_id, product_id, code, brand, name, price, qty, orig_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, l.product_id, l.code, l.brand, l.name, l.price, l.qty, l.orig_price)),
  ])
  const message = buildMessage({ lang, number, lines, total: q.total, name, phone, city, address, note, payment, sum })
  const codeNote = q.code && q.code.status !== 'ok' ? q.code.status : ''
  return c.json({ number, token, message, links: channelLinks(settings, message), channel, unavailable, total: fmtLyd(q.total), codeNote })
})
