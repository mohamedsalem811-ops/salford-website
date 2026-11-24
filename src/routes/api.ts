import { Hono } from 'hono'
import type { Env, Product } from '../lib/db'
import { getBrands, getSettings, fmtLyd, pName } from '../lib/db'
import { catalog, productsByIds } from '../lib/catalog'
import { firstImage, mediaUrl } from '../lib/media'
import { isLang, type Lang } from '../lib/i18n'
import { normalizePhone, channelLinks, buildMessage, sha256hex, randomToken } from '../lib/orders'

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
  return c.json({
    items: withMedia.map((p) => {
      const img = firstImage(p.media)
      return {
        id: p.id, code: p.code, name: pName(p, lang), brand: brands.find((b) => b.id === p.brand_id)?.name ?? '',
        price: p.price, priceText: fmtLyd(p.price), inStock: !!p.in_stock, image: img ? mediaUrl(img, 400) : '',
      }
    }),
  })
})

const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)

api.post('/orders', async (c) => {
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'bad_request' }, 400) }
  const lang: Lang = isLang(String(body.lang)) ? (body.lang as Lang) : 'ar'
  const name = clean(body.name, 80)
  const phone = normalizePhone(String(body.phone ?? '')) ?? ''
  const city = clean(body.city, 60)
  const address = clean(body.address, 200)
  const note = clean(body.note, 200)
  const payment = String(body.payment ?? '')
  const channel = String(body.channel ?? '')
  if (String(body.website ?? '')) return c.json({ error: 'bad_request' }, 400) // hidden field only robots fill in
  const errors: string[] = []
  if (!name) errors.push('name')
  if (!phone) errors.push('phone')
  if (!city) errors.push('city')
  const settings = await getSettings(c.env.DB)
  const payOn = { cod_cash: settings.pay_cod_cash !== '0', cod_card: settings.pay_cod_card !== '0', lypay: settings.pay_lypay !== '0' } as Record<string, boolean>
  if (!payOn[payment]) errors.push('payment')
  const links = channelLinks(settings, '')
  if (!['whatsapp', 'messenger', 'instagram'].includes(channel) || !links[channel as keyof typeof links]) errors.push('channel')
  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 30) : []
  const want = new Map<number, number>()
  for (const it of rawItems as { id: unknown; qty: unknown }[]) {
    const id = Number(it?.id), qty = Math.min(Math.max(Math.floor(Number(it?.qty) || 1), 1), 10)
    if (Number.isInteger(id) && id > 0) want.set(id, (want.get(id) ?? 0) + qty)
  }
  if (!want.size) errors.push('items')
  if (errors.length) return c.json({ error: 'invalid', fields: errors }, 422)

  const ipHash = (await sha256hex('sl-order:' + (c.req.header('cf-connecting-ip') ?? ''))).slice(0, 32)
  const recent = await c.env.DB.prepare(
    "SELECT (SELECT count(*) FROM orders WHERE phone = ? AND created_at > datetime('now', '-1 hour')) AS byPhone, (SELECT count(*) FROM orders WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')) AS byIp",
  ).bind(phone, ipHash).first<{ byPhone: number; byIp: number }>()
  // 5 per phone, 15 per connection (mobile networks share addresses, so this stays generous)
  if ((recent?.byPhone ?? 0) >= 5 || (recent?.byIp ?? 0) >= 15) return c.json({ error: 'too_many' }, 429)

  const ids = [...want.keys()]
  const { results } = await c.env.DB.prepare(`SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')}) AND status = 'live' AND deleted_at IS NULL AND in_stock = 1`).bind(...ids).all<Product>()
  if (!results.length) return c.json({ error: 'unavailable' }, 409)
  const brands = await getBrands(c.env.DB, true)
  const lines = results.map((p) => ({ product_id: p.id, code: p.code, brand: brands.find((b) => b.id === p.brand_id)?.name ?? '', name: pName(p, lang), price: p.price, qty: want.get(p.id) ?? 1 }))
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const unavailable = ids.filter((id) => !results.find((p) => p.id === id))

  const token = randomToken()
  const ins = await c.env.DB.prepare('INSERT INTO orders (name, phone, city, address, note, payment, channel, lang, total, view_token, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(name, phone, city, address, note, payment, channel, lang, total, token, ipHash)
    .first<{ id: number }>()
  const id = ins!.id
  const number = `SL-${1000 + id}`
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE orders SET number = ? WHERE id = ?').bind(number, id),
    ...lines.map((l) => c.env.DB.prepare('INSERT INTO order_items (order_id, product_id, code, brand, name, price, qty) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, l.product_id, l.code, l.brand, l.name, l.price, l.qty)),
  ])
  const message = buildMessage({ lang, number, lines, total, name, phone, city, address, note, payment })
  return c.json({ number, token, message, links: channelLinks(settings, message), channel, unavailable, total: fmtLyd(total) })
})
