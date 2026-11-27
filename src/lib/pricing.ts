/**
 * Prices, discounts and delivery: the one place they are worked out (price rules R1, R3, R5, R6, R7 in docs/feature-plan.md).
 * Product pages, the cart, the checkout, /api/quote, /api/orders and the order message all use these functions,
 * and the server always recalculates at order time from fresh database rows. Money is in dirhams (1 LYD = 1000).
 */
import type { Product } from './db'

export type Offer = {
  id: number; template: string; name_ar: string; name_en: string; theme: string
  starts_at: string; ends_at: string; enabled: number; kind: string; percent: number; scope: string
  free_delivery: number; banner_ar: string; banner_en: string; sub_ar: string; sub_en: string
  kicker_ar: string; kicker_en: string; caption_ar: string; caption_en: string; badge_ar: string; badge_en: string
  show_countdown: number; show_banner: number; show_strip: number; photo_product_id: number | null; created_at: string
}
export type Code = {
  id: number; code: string; owner: string; kind: string; value: number; min_total: number
  starts_at: string; ends_at: string; max_uses: number; per_phone: number; enabled: number; commission_pct: number
}
export type City = { id: number; name_ar: string; name_en: string; sort: number; enabled: number }
export type Area = { id: number; city_id: number; name_ar: string; name_en: string; price: number | null; time_ar: string; time_en: string; enabled: number; sort: number }

type Priced = Pick<Product, 'id' | 'price' | 'compare_price' | 'brand_id' | 'category_id'> & { no_discount?: number }

/** UTC in the same text form D1 uses ('2026-12-24 08:00:00'), so times compare as text. */
export const utcNow = (d = new Date()) => d.toISOString().slice(0, 19).replace('T', ' ')

export const isLive = (o: { enabled: number; starts_at: string; ends_at: string }, now = utcNow()) =>
  !!o.enabled && (!o.starts_at || o.starts_at <= now) && (!o.ends_at || now < o.ends_at)

/** The offer running now: one at a time, the newest enabled one whose dates cover now. */
export function liveOffer(offers: Offer[], now = utcNow()): Offer | null {
  let best: Offer | null = null
  for (const o of offers) if (isLive(o, now) && o.kind === 'percent' && o.percent > 0 && (!best || o.id > best.id)) best = o
  return best
}

/** Down to a whole 5 LYD, never below 0. */
export const roundDown5 = (dirham: number) => Math.max(0, Math.floor(dirham / 5000) * 5000)

/** `percent` off, then rounded down to 5 LYD (integer maths, so 590 − 24% is exactly 448.40 → 445). */
export const percentOff = (price: number, pct: number) => roundDown5(Math.floor((price * (100 - pct)) / 100))

/** Products with their own crossed-out price, or ticked "never discount", are never discounted again. */
export const discountable = (p: Priced) => !p.no_discount && !(p.compare_price && p.compare_price > p.price)

export type Scope = { all?: boolean; brands?: string[]; cats?: string[]; products?: number[] }
export function parseScope(raw: string): Scope {
  try {
    const s = JSON.parse(raw || '{}') as Scope
    return {
      all: !!s.all,
      brands: Array.isArray(s.brands) ? s.brands.map(String) : [],
      cats: Array.isArray(s.cats) ? s.cats.map(String) : [],
      products: Array.isArray(s.products) ? s.products.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [],
    }
  } catch {
    return { all: false, brands: [], cats: [], products: [] }
  }
}
/** In scope: everything, or a listed product, or (when brands/categories are chosen) a product matching both lists. */
export function inScope(p: Priced, s: Scope) {
  if (s.all) return true
  if (s.products?.includes(p.id)) return true
  const b = s.brands ?? [], c = s.cats ?? []
  if (!b.length && !c.length) return false
  return (!b.length || b.includes(p.brand_id)) && (!c.length || c.includes(p.category_id))
}

const scopeCache = new WeakMap<Offer, Scope>()
const scopeOf = (o: Offer) => {
  let s = scopeCache.get(o)
  if (!s) scopeCache.set(o, (s = parseScope(o.scope)))
  return s
}

/** R1: the offer price of one product, or null when the offer does not lower it. */
export function offerPrice(p: Priced, offer: Offer | null): number | null {
  if (!offer || offer.kind !== 'percent' || !(offer.percent > 0) || !discountable(p) || !inScope(p, scopeOf(offer))) return null
  const np = percentOff(p.price, offer.percent)
  return np < p.price ? np : null
}

/** What a product card or page shows: the price, the crossed-out price, and the offer % when the offer applies. */
export function shopPrice(p: Priced, offer: Offer | null): { price: number; was: number | null; pct: number } {
  const op = offerPrice(p, offer)
  if (op !== null) return { price: op, was: p.price, pct: offer!.percent }
  return { price: p.price, was: p.compare_price && p.compare_price > p.price ? p.compare_price : null, pct: 0 }
}

export const normalizeCode = (raw: unknown) => {
  const v = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '')
  return /^[A-Z0-9_-]{2,30}$/.test(v) ? v : ''
}

export type CodeStatus = 'ok' | 'invalid' | 'expired' | 'used_up' | 'used' | 'min' | 'no_items' | 'not_better'
/** A code as looked up for this order: its row (or null), how many orders already used it, and how many by this phone. */
export type CodeCheck = { entered: string; row: Code | null; uses: number; phoneUses: number }

export type QuoteLine = { id: number; qty: number; orig: number; price: number }
export type Delivery =
  | { mode: 'off' } // delivery prices switched off: agreed in chat, as before Release 1
  | { mode: 'chat'; area: Area | null } // city or area not listed, or no price yet
  | { mode: 'free'; area: Area; fee: 0 }
  | { mode: 'fee'; area: Area; fee: number }
export type Quote = {
  lines: QuoteLine[]
  subtotal: number // products before any discount
  discount: number // the one saving applied (R3)
  kind: '' | 'offer' | 'code'
  items: number // products after discount: what commission and free delivery are worked out from
  offer: Offer | null // the live offer (even when the code won)
  offerSaving: number
  code: { code: string; status: CodeStatus; saving: number; min?: number; row?: Code } | null
  delivery: Delivery
  fee: number // delivery fee to pay in cash (0 when free, agreed in chat, or off)
  total: number // items + fee
}

export type QuoteIn = {
  lines: { p: Priced; qty: number }[]
  offer: Offer | null
  code?: CodeCheck | null
  phoneKnown?: boolean
  deliveryOn: boolean
  area: Area | null // the chosen, listed, enabled area; null = not in the list
  freeMin: number // dirhams; free delivery when items >= freeMin (0 = never)
  now?: string
}

function codeResult(i: QuoteIn, subtotal: number): { status: CodeStatus; saving: number; prices?: Map<number, number>; extra?: number; min?: number; row?: Code } {
  const c = i.code!
  const row = c.row
  if (!row || !row.enabled) return { status: 'invalid', saving: 0 }
  if (!isLive({ enabled: 1, starts_at: row.starts_at, ends_at: row.ends_at }, i.now)) return { status: 'expired', saving: 0 }
  if (row.max_uses > 0 && c.uses >= row.max_uses) return { status: 'used_up', saving: 0 }
  if (i.phoneKnown && row.per_phone > 0 && c.phoneUses >= row.per_phone) return { status: 'used', saving: 0 }
  if (subtotal < row.min_total) return { status: 'min', saving: 0, min: row.min_total }
  const eligible = i.lines.filter((l) => discountable(l.p))
  const base = eligible.reduce((s, l) => s + l.p.price * l.qty, 0)
  if (!base || !(row.value > 0)) return { status: 'no_items', saving: 0 }
  if (row.kind === 'amount') {
    const extra = Math.min(row.value, base)
    return { status: 'ok', saving: extra, extra, row }
  }
  const pct = Math.min(Math.max(Math.floor(row.value), 0), 100)
  const prices = new Map<number, number>()
  let saving = 0
  for (const l of eligible) {
    const np = percentOff(l.p.price, pct)
    if (np < l.p.price) { prices.set(l.p.id, np); saving += (l.p.price - np) * l.qty }
  }
  return saving > 0 ? { status: 'ok', saving, prices, row } : { status: 'no_items', saving: 0 }
}

/** R3, R5, R6: one saving per order (offer or code, whichever leaves the lower products total), then delivery. */
export function quote(i: QuoteIn): Quote {
  const subtotal = i.lines.reduce((s, l) => s + l.p.price * l.qty, 0)
  const offerPrices = new Map<number, number>()
  let offerSaving = 0
  for (const l of i.lines) {
    const op = offerPrice(l.p, i.offer)
    if (op !== null) { offerPrices.set(l.p.id, op); offerSaving += (l.p.price - op) * l.qty }
  }
  let kind: Quote['kind'] = offerSaving > 0 ? 'offer' : ''
  let discount = offerSaving
  let code: Quote['code'] = null
  let lines: QuoteLine[] = i.lines.map((l) => ({ id: l.p.id, qty: l.qty, orig: l.p.price, price: offerPrices.get(l.p.id) ?? l.p.price }))
  if (i.code?.entered) {
    const r = codeResult(i, subtotal)
    code = { code: i.code.entered, status: r.status, saving: r.saving, ...(r.min ? { min: r.min } : {}), ...(r.row ? { row: r.row } : {}) }
    if (r.status === 'ok') {
      if (r.saving > offerSaving) {
        kind = 'code'
        discount = r.saving
        lines = i.lines.map((l) => ({ id: l.p.id, qty: l.qty, orig: l.p.price, price: r.prices?.get(l.p.id) ?? l.p.price }))
      } else {
        code.status = 'not_better'
      }
    }
  }
  const items = subtotal - discount
  let delivery: Delivery
  if (!i.deliveryOn) delivery = { mode: 'off' }
  else if (!i.area) delivery = { mode: 'chat', area: null }
  else if ((i.freeMin > 0 && items >= i.freeMin) || (i.offer && i.offer.free_delivery)) delivery = { mode: 'free', area: i.area, fee: 0 }
  else if (i.area.price === null || i.area.price === undefined) delivery = { mode: 'chat', area: i.area }
  else delivery = { mode: 'fee', area: i.area, fee: Math.max(0, i.area.price) }
  const fee = delivery.mode === 'fee' ? delivery.fee : 0
  return { lines, subtotal, discount, kind, items, offer: i.offer, offerSaving, code, delivery, fee, total: items + fee }
}
