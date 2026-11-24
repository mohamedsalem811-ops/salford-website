import { Hono } from 'hono'
import type { Env, Product } from '../lib/db'
import { attachMedia, getBrands, getSettings, fmtLyd, pName } from '../lib/db'
import { firstImage, mediaUrl } from '../lib/media'
import { isLang, type Lang } from '../lib/i18n'

export const api = new Hono<{ Bindings: Env }>()

/** Product summaries for the cart (prices always come from the database). */
api.get('/cart', async (c) => {
  const lang: Lang = isLang(c.req.query('lang')) ? (c.req.query('lang') as Lang) : 'ar'
  const ids = (c.req.query('ids') || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50)
  if (!ids.length) return c.json({ items: [] })
  const ph = ids.map(() => '?').join(',')
  const { results } = await c.env.DB.prepare(`SELECT * FROM products WHERE id IN (${ph}) AND status = 'live' AND deleted_at IS NULL`).bind(...ids).all<Product>()
  const [withMedia, brands] = await Promise.all([attachMedia(c.env.DB, results, true), getBrands(c.env.DB, true)])
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

export const normalizePhone = (raw: string) => {
  let d = String(raw || '').replace(/[^\d+]/g, '')
  d = d.replace(/^(\+|00)?218/, '0').replace(/^\+/, '')
  if (/^9\d{8}$/.test(d)) d = '0' + d
  return /^0(9[1-6]|2\d|6\d|5\d|7\d)\d{7}$/.test(d) ? d : null
}

const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)

const PAY: Record<string, { ar: string; en: string }> = {
  cod_cash: { ar: 'نقداً عند الاستلام', en: 'Cash on delivery' },
  cod_card: { ar: 'بطاقة مصرفية عند الاستلام', en: 'Card on delivery' },
  lypay: { ar: 'LyPay', en: 'LyPay' },
}

export function buildMessage(lang: Lang, number: string, lines: { brand: string; name: string; code: string; price: number; qty: number }[], total: number, name: string, city: string, payment: string) {
  const cur = lang === 'ar' ? 'د.ل' : 'LYD'
  const items = lines.map((l, i) => `${i + 1}) ${l.brand} · ${l.name} · ${l.code}${l.qty > 1 ? ` × ${l.qty}` : ''} · ${fmtLyd(l.price * l.qty)} ${cur}`)
  if (lang === 'ar') {
    return ['مرحبتين سالفورد، أريد تأكيد طلبيتي', `رقم الطلبية: ${number}`, ...items, `المجموع: ${fmtLyd(total)} ${cur}`, `الاسم: ${name} · المدينة: ${city}`, `الدفع: ${PAY[payment].ar}`].join('\n')
  }
  return ['Hello Salford, I’d like to confirm my order', `Order number: ${number}`, ...items, `Total: ${fmtLyd(total)} ${cur}`, `Name: ${name} · City: ${city}`, `Payment: ${PAY[payment].en}`].join('\n')
}

/** Facebook page handle for m.me: facebook.com/Name, /profile.php?id=123, /people/Name/123, or a bare handle. */
export function fbPage(raw: string) {
  const v = raw.trim()
  if (!v) return ''
  let u: URL
  try { u = new URL(/^https?:\/\//i.test(v) ? v : `https://facebook.com/${v.replace(/^@/, '')}`) } catch { return '' }
  const id = u.searchParams.get('id')
  if (id && /^\d+$/.test(id)) return id
  const parts = u.pathname.split('/').filter(Boolean)
  if (parts[0] === 'people' && parts[2] && /^\d+$/.test(parts[2])) return parts[2]
  if (parts[0] === 'pages' && parts.length >= 2) return /^\d+$/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : parts[1]
  const h = parts[0] || ''
  return /^[\w.-]+$/.test(h) && !/\.php$/i.test(h) ? h : ''
}

export function channelLinks(s: Record<string, string>, message: string) {
  const enc = encodeURIComponent(message)
  const wa = s.whatsapp ? `https://wa.me/${s.whatsapp.replace(/\D/g, '')}?text=${enc}` : ''
  const page = fbPage(s.facebook || '')
  const ms = page ? `https://m.me/${page}?text=${enc}` : ''
  const igUser = (s.instagram || '').replace(/\/+$/, '').split(/[/?#]/).filter(Boolean).pop() || ''
  const ig = igUser && !/instagram\.com$/i.test(igUser) ? `https://ig.me/m/${igUser.replace(/^@/, '')}` : ''
  return { whatsapp: wa, messenger: ms, instagram: ig }
}

api.post('/orders', async (c) => {
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'bad_request' }, 400) }
  const lang: Lang = isLang(String(body.lang)) ? (body.lang as Lang) : 'ar'
  const name = clean(body.name, 80)
  const phone = normalizePhone(String(body.phone ?? ''))
  const city = clean(body.city, 60)
  const address = clean(body.address, 200)
  const note = clean(body.note, 200)
  const payment = String(body.payment ?? '')
  const channel = String(body.channel ?? '')
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

  const recent = await c.env.DB.prepare("SELECT count(*) AS n FROM orders WHERE phone = ? AND created_at > datetime('now', '-1 hour')").bind(phone).first<{ n: number }>()
  if ((recent?.n ?? 0) >= 5) return c.json({ error: 'too_many' }, 429)

  const ids = [...want.keys()]
  const { results } = await c.env.DB.prepare(`SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')}) AND status = 'live' AND deleted_at IS NULL AND in_stock = 1`).bind(...ids).all<Product>()
  if (!results.length) return c.json({ error: 'unavailable' }, 409)
  const brands = await getBrands(c.env.DB, true)
  const lines = results.map((p) => ({ product_id: p.id, code: p.code, brand: brands.find((b) => b.id === p.brand_id)?.name ?? '', name: pName(p, lang), price: p.price, qty: want.get(p.id) ?? 1 }))
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const unavailable = ids.filter((id) => !results.find((p) => p.id === id))

  const ins = await c.env.DB.prepare('INSERT INTO orders (name, phone, city, address, note, payment, channel, lang, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(name, phone, city, address, note, payment, channel, lang, total)
    .first<{ id: number }>()
  const id = ins!.id
  const number = `SL-${1000 + id}`
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE orders SET number = ? WHERE id = ?').bind(number, id),
    ...lines.map((l) => c.env.DB.prepare('INSERT INTO order_items (order_id, product_id, code, brand, name, price, qty) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, l.product_id, l.code, l.brand, l.name, l.price, l.qty)),
  ])
  const message = buildMessage(lang, number, lines, total, name, city, payment)
  return c.json({ number, message, links: channelLinks(settings, message), channel, unavailable, total: fmtLyd(total) })
})
