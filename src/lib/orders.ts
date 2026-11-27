import { fmtLyd } from './db'
import type { Lang } from './i18n'

/** ٠١٢… and ۰۱۲… (Arabic keyboards) → 012… */
export const westernDigits = (s: string) => s.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf))

/** Libyan phone → 0XXXXXXXXX, or null. Accepts +218 / 00218 / 218, spaces, dashes and Arabic digits. */
export const normalizePhone = (raw: string) => {
  let d = westernDigits(String(raw || '')).replace(/[^\d+]/g, '')
  d = d.replace(/^(\+|00)?218/, '0').replace(/^\+/, '')
  if (/^9\d{8}$/.test(d)) d = '0' + d
  return /^0(9[1-6]|2\d|6\d|5\d|7\d)\d{7}$/.test(d) ? d : null
}

/** WhatsApp setting → 2189XXXXXXXX (digits only, country code first). */
export const waNumber = (raw: string) => {
  let d = westernDigits(String(raw || '')).replace(/\D/g, '').replace(/^00/, '')
  if (/^0\d{9}$/.test(d)) d = '218' + d.slice(1)
  else if (/^9\d{8}$/.test(d)) d = '218' + d
  return d
}

/** Instagram setting (link, share link with ?igsh=…, @handle or handle) → handle, or ''. */
export const igHandle = (raw: string) => {
  const v = String(raw || '').trim()
  if (!v) return ''
  if (!/instagram\.com|ig\.me|\//i.test(v)) return /^@?[\w.]{1,30}$/.test(v) ? v.replace(/^@/, '') : ''
  let u: URL
  try { u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`) } catch { return '' }
  const parts = u.pathname.split('/').filter(Boolean)
  const h = (parts[0] === 'm' && u.hostname.endsWith('ig.me') ? parts[1] : parts[0]) || ''
  return /^[\w.]{1,30}$/.test(h) && !['p', 'reel', 'reels', 'stories', 'explore', 'accounts'].includes(h.toLowerCase()) ? h : ''
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
  const num = waNumber(s.whatsapp || '')
  const page = fbPage(s.facebook || '')
  const ig = igHandle(s.instagram || '')
  return {
    whatsapp: num ? `https://wa.me/${num}?text=${enc}` : '',
    messenger: page ? `https://m.me/${page}?text=${enc}` : '',
    instagram: ig ? `https://ig.me/m/${ig}` : '',
  }
}

export const PAY: Record<string, { ar: string; en: string }> = {
  cod_cash: { ar: 'نقداً عند الاستلام', en: 'Cash on delivery' },
  cod_card: { ar: 'بطاقة مصرفية عند الاستلام', en: 'Card on delivery' },
  lypay: { ar: 'LyPay', en: 'LyPay' },
}

export type OrderLine = { brand: string; name: string; code: string; price: number; qty: number; orig_price?: number }
/** The price breakdown stored with each order (Release 1). Older orders have none of it, and their message is unchanged. */
export type OrderSum = {
  subtotal: number; discount: number; kind: string; offerName: string; code: string
  area: string; delivery: 'off' | 'chat' | 'free' | 'fee'; fee: number; time: string
}
export type OrderInfo = { lang: Lang; number: string; lines: OrderLine[]; total: number; name: string; phone: string; city: string; address: string; note: string; payment: string; sum?: OrderSum }

const W = {
  ar: { items: 'المنتجات', disc: 'الخصم', code: 'كود', del: 'التوصيل', cash: 'نقداً للمندوب', free: 'مجاني', chat: 'نتفق عليه في المحادثة', time: 'مدة التوصيل', total: 'المجموع' },
  en: { items: 'Items', disc: 'Discount', code: 'code', del: 'Delivery', cash: 'cash to the driver', free: 'Free', chat: 'agreed in the chat', time: 'Delivery time', total: 'Total' },
}

/** The breakdown lines shared by the message, the order page and the admin: [label, value] pairs. */
export function sumRows(o: { lang: Lang; total: number; sum?: OrderSum }): { label: string; value: string; kind: 'items' | 'disc' | 'del' | 'time' }[] {
  const s = o.sum
  if (!s) return []
  const w = W[o.lang], cur = o.lang === 'ar' ? 'د.ل' : 'LYD'
  const rows: { label: string; value: string; kind: 'items' | 'disc' | 'del' | 'time' }[] = []
  if (s.discount > 0) {
    rows.push({ label: w.items, value: `${fmtLyd(s.subtotal)} ${cur}`, kind: 'items' })
    const why = s.kind === 'code' ? `${w.code} ${s.code}` : s.offerName
    rows.push({ label: why ? `${w.disc} (${why})` : w.disc, value: `−${fmtLyd(s.discount)} ${cur}`, kind: 'disc' })
  }
  if (s.delivery === 'fee') rows.push({ label: w.del, value: `${fmtLyd(s.fee)} ${cur} (${w.cash})`, kind: 'del' })
  else if (s.delivery === 'free') rows.push({ label: w.del, value: w.free, kind: 'del' })
  else if (s.delivery === 'chat') rows.push({ label: w.del, value: w.chat, kind: 'del' })
  if (s.delivery !== 'off' && s.time) rows.push({ label: w.time, value: s.time, kind: 'time' })
  return rows
}

/** The chat message the customer sends us: everything needed to confirm the order without opening the admin. */
export function buildMessage(o: OrderInfo) {
  const ar = o.lang === 'ar'
  const cur = ar ? 'د.ل' : 'LYD'
  const lineTotal = (l: OrderLine) => (o.sum && l.orig_price ? l.orig_price : l.price) * l.qty
  const items = o.lines.map((l, i) => `${i + 1}) ${l.brand} · ${l.name} · ${l.code}${l.qty > 1 ? ` × ${l.qty}` : ''} · ${fmtLyd(lineTotal(l))} ${cur}`)
  const pay = PAY[o.payment]?.[o.lang] ?? o.payment
  const sums = sumRows(o).map((r) => `${r.label}: ${r.value}`)
  const place = o.sum?.area ? `${o.city} · ${o.sum.area}` : o.city
  if (ar) {
    return [
      'مرحبتين سالفورد، أريد تأكيد طلبيتي', `رقم الطلبية: ${o.number}`, ...items, ...sums, `المجموع: ${fmtLyd(o.total)} ${cur}`,
      `الاسم: ${o.name}`, `الهاتف: ${o.phone}`, `المدينة: ${place}`, o.address ? `العنوان: ${o.address}` : '', o.note ? `ملاحظة: ${o.note}` : '', `الدفع: ${pay}`,
    ].filter(Boolean).join('\n')
  }
  return [
    'Hello Salford, I’d like to confirm my order', `Order number: ${o.number}`, ...items, ...sums, `Total: ${fmtLyd(o.total)} ${cur}`,
    `Name: ${o.name}`, `Phone: ${o.phone}`, `City: ${place}`, o.address ? `Address: ${o.address}` : '', o.note ? `Note: ${o.note}` : '', `Payment: ${pay}`,
  ].filter(Boolean).join('\n')
}

/** Reads the stored breakdown back from an order row (null for orders placed before Release 1). */
export function sumFromRow(o: Record<string, unknown>): OrderSum | undefined {
  const n = (k: string) => Number(o[k] ?? 0) || 0
  const t = (k: string) => String(o[k] ?? '')
  if (!n('subtotal')) return undefined
  const delivery = n('delivery_free') ? 'free' : n('delivery_fee') > 0 ? 'fee' : n('delivery_chat') ? 'chat' : 'off'
  return { subtotal: n('subtotal'), discount: n('discount_total'), kind: t('discount_kind'), offerName: t('offer_name'), code: t('code'), area: t('area'), delivery, fee: n('delivery_fee'), time: t('delivery_time') }
}

const enc = new TextEncoder()
export const sha256hex = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('')
export const randomToken = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')

type OrderRow = { id: number; number: string; created_at: string; name: string; phone: string; city: string; address: string; note: string; payment: string; channel: string; lang: string; total: number; view_token: string } & Record<string, unknown>

/** The order as its customer may see it: needs the private link token, and only for 30 days. */
export async function loadOrderForCustomer(db: D1Database, number: string, token: string) {
  if (!/^SL-\d{1,9}$/.test(number) || !/^[0-9a-f]{32}$/.test(token)) return null
  const o = await db
    .prepare("SELECT * FROM orders WHERE number = ? AND created_at > datetime('now', '-30 days')")
    .bind(number)
    .first<OrderRow>()
  if (!o || !o.view_token || o.view_token.length !== token.length) return null
  let diff = 0
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ o.view_token.charCodeAt(i)
  if (diff) return null
  const { results } = await db.prepare('SELECT brand, name, code, price, qty, orig_price FROM order_items WHERE order_id = ? ORDER BY rowid').bind(o.id).all<OrderLine>()
  const info: OrderInfo = {
    lang: o.lang === 'en' ? 'en' : 'ar', number: o.number, lines: results, total: o.total,
    name: o.name, phone: o.phone, city: o.city, address: o.address, note: o.note, payment: o.payment, sum: sumFromRow(o),
  }
  return { order: o, info, message: buildMessage(info) }
}
