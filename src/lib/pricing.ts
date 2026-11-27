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
  // Release 4 (columns from migration 0003; flash rows from offer_flash, attached when the offers are loaded)
  tiers?: string; gift_product_id?: number | null; gift_min?: number; teaser_days?: number; early_hours?: number; early_token?: string
  flash?: Flash[]
}
/** A flash deal: one product at a fixed price while its offer runs. `sold` = pieces already ordered at that price (not cancelled). */
export type Flash = { id: number; offer_id: number; product_id: number; price: number; max_qty: number; sold: number }
/** A spend-more level: products total (dirhams, before discount, of the products in the offer) → percent off them. */
export type Tier = { min: number; pct: number }
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

/** A UTC text time moved by some hours (same text form). */
export const shiftUtc = (s: string, hours: number) => utcNow(new Date(Date.parse(s.replace(' ', 'T') + 'Z') + hours * 3_600_000))

/** Up to 5 spend-more levels, lowest first: whole percents 1–90 and amounts above 0, each level higher than the last. */
export function parseTiers(raw: string | undefined): Tier[] {
  let v: unknown
  try { v = JSON.parse(raw || '[]') } catch { return [] }
  if (!Array.isArray(v)) return []
  const out: Tier[] = []
  for (const t of v.slice(0, 5) as { min: unknown; pct: unknown }[]) {
    const min = Math.floor(Number(t?.min)), pct = Math.floor(Number(t?.pct))
    if (min > 0 && pct >= 1 && pct <= 90) out.push({ min, pct })
  }
  out.sort((a, b) => a.min - b.min)
  return out.filter((t, i) => i === 0 || (t.min > out[i - 1].min && t.pct > out[i - 1].pct))
}

/** An offer does something: a percent, spend-more levels, or "extras only" (flash deals, free gift, free delivery, words). */
export const hasEffect = (o: Offer) =>
  (o.kind === 'percent' && o.percent > 0) || (o.kind === 'tiers' && parseTiers(o.tiers).length > 0) || o.kind === 'none'

/** The early access link opens the offer `early_hours` before its start, for whoever holds the link's token. */
const earlyOk = (o: Offer, early: string) => !!early && !!o.early_token && early === o.early_token && (o.early_hours ?? 0) > 0 && !!o.starts_at

/** The offer running now: one at a time, the newest enabled one whose dates cover now (earlier with the early access link). */
export function liveOffer(offers: Offer[], now = utcNow(), early = ''): Offer | null {
  let best: Offer | null = null
  for (const o of offers) {
    if (!hasEffect(o) || (best && o.id < best.id)) continue
    const open = isLive(o, now) || (earlyOk(o, early) && isLive({ ...o, starts_at: shiftUtc(o.starts_at, -(o.early_hours ?? 0)) }, now))
    if (open) best = o
  }
  return best
}

/** True while this offer is open only to early access holders. */
export const isEarlyNow = (o: Offer | null, now = utcNow()) => !!o && !!o.starts_at && now < o.starts_at

/** "Coming soon": an offer that starts within its teaser days (and nothing else is running). */
export function teaserOffer(offers: Offer[], now = utcNow()): Offer | null {
  let best: Offer | null = null
  for (const o of offers) {
    const days = o.teaser_days ?? 0
    if (!o.enabled || !hasEffect(o) || !(days > 0) || !o.starts_at || !(now < o.starts_at)) continue
    if (now >= shiftUtc(o.starts_at, -days * 24) && (!best || o.starts_at < best.starts_at)) best = o
  }
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

const flashCache = new WeakMap<Offer, Map<number, Flash>>()
const flashMap = (o: Offer) => {
  let m = flashCache.get(o)
  if (!m) flashCache.set(o, (m = new Map((o.flash ?? []).map((f) => [f.product_id, f]))))
  return m
}

/** R2: the flash deal on this product, while pieces are left at the flash price. `left` = null when there is no limit. */
export function flashOf(p: Priced, offer: Offer | null): { flash: Flash; price: number; left: number | null } | null {
  if (!offer || p.no_discount) return null
  const f = flashMap(offer).get(p.id)
  if (!f || !(f.price >= 0) || f.price >= p.price) return null
  const left = f.max_qty > 0 ? Math.max(0, f.max_qty - (f.sold || 0)) : null
  return left === 0 ? null : { flash: f, price: f.price, left }
}

/** R1: the offer's percent price of one product (not flash deals), or null when the offer does not lower it. */
function percentPrice(p: Priced, offer: Offer | null): number | null {
  if (!offer || offer.kind !== 'percent' || !(offer.percent > 0) || !discountable(p) || !inScope(p, scopeOf(offer))) return null
  const np = percentOff(p.price, offer.percent)
  return np < p.price ? np : null
}

/** The price a product card shows under the offer: its flash price, else its percent price; null when the offer does not lower it. */
export function offerPrice(p: Priced, offer: Offer | null): number | null {
  const f = flashOf(p, offer)
  return f ? f.price : percentPrice(p, offer)
}

const pctOf = (was: number, now: number) => Math.max(1, Math.round(((was - now) * 100) / was))

/** What a product card or page shows: the price, the crossed-out price, the % off, and the flash deal (with pieces left). */
export function shopPrice(p: Priced, offer: Offer | null): { price: number; was: number | null; pct: number; flash?: { left: number | null } } {
  const f = flashOf(p, offer)
  if (f) return { price: f.price, was: p.price, pct: pctOf(p.price, f.price), flash: { left: f.left } }
  const op = percentPrice(p, offer)
  if (op !== null) return { price: op, was: p.price, pct: offer!.percent }
  return { price: p.price, was: p.compare_price && p.compare_price > p.price ? p.compare_price : null, pct: 0 }
}

/** Spend-more levels of an offer that uses them (empty otherwise). */
export const tiersOf = (o: Offer | null) => (o && o.kind === 'tiers' ? parseTiers(o.tiers) : [])
/** A product counts toward the spend-more levels. */
export const inTiers = (p: Priced, o: Offer | null) => !!o && o.kind === 'tiers' && discountable(p) && inScope(p, scopeOf(o))

export const normalizeCode = (raw: unknown) => {
  const v = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '')
  return /^[A-Z0-9_-]{2,30}$/.test(v) ? v : ''
}

export type CodeStatus = 'ok' | 'invalid' | 'expired' | 'used_up' | 'used' | 'min' | 'no_items' | 'not_better'
/** A code as looked up for this order: its row (or null), how many orders already used it, and how many by this phone. */
export type CodeCheck = { entered: string; row: Code | null; uses: number; phoneUses: number }

export type QuoteLine = { id: number; qty: number; orig: number; price: number; flash?: number }
export type Delivery =
  | { mode: 'off' } // delivery prices switched off: agreed in chat, as before Release 1
  | { mode: 'chat'; area: Area | null } // city or area not listed, or no price yet
  | { mode: 'free'; area: Area; fee: 0 }
  | { mode: 'fee'; area: Area; fee: number }
export type Quote = {
  lines: QuoteLine[]
  subtotal: number // products before any discount
  discount: number // flash deals + the one other saving applied (R2, R3)
  kind: '' | 'offer' | 'code' | 'loyalty'
  items: number // products after discount: what commission, the free gift and free delivery are worked out from
  offer: Offer | null // the live offer (even when the code won)
  offerSaving: number // the offer's percent or spend-more saving (not flash deals)
  flashSaving: number
  flashShort: { id: number; left: number }[] // more pieces in the cart than are left at the flash price: normal price
  tier: { pct: number; base: number; next: { min: number; pct: number; need: number } | null } | null // spend-more offers only
  gift: { id: number; orig: number } | null // R4: the free gift added to this order
  giftNeed: number // how much more (products after discount) until the free gift; 0 = none to reach
  code: { code: string; status: CodeStatus; saving: number; min?: number; row?: Code } | null
  loyalty: { pct: number; saving: number } | null // the returning customer's discount, when they qualify (applied only if it is the best saving)
  delivery: Delivery
  fee: number // delivery fee to pay in cash (0 when free, agreed in chat, or off)
  total: number // items + fee
}

type Line = { p: Priced; qty: number }
export type QuoteIn = {
  lines: Line[]
  offer: Offer | null
  code?: CodeCheck | null
  phoneKnown?: boolean
  loyaltyPct?: number // > 0 only when loyalty is switched on and this phone has a delivered order
  deliveryOn: boolean
  area: Area | null // the chosen, listed, enabled area; null = not in the list
  freeMin: number // dirhams; free delivery when items >= freeMin (0 = never)
  gift?: (Priced & { in_stock: number }) | null // the offer's gift product, read fresh (live, not deleted)
  now?: string
}

type Saving = { saving: number; prices: Map<number, number> }

/** Percent off every line that may be discounted (and matches `ok`), rounded down to 5 LYD. */
function percentAll(lines: Line[], pct: number, ok: (p: Priced) => boolean = discountable): Saving {
  const prices = new Map<number, number>()
  let saving = 0
  if (pct > 0) for (const l of lines) {
    if (!ok(l.p)) continue
    const np = percentOff(l.p.price, pct)
    if (np < l.p.price) { prices.set(l.p.id, np); saving += (l.p.price - np) * l.qty }
  }
  return { saving, prices }
}

function codeResult(i: QuoteIn, lines: Line[], subtotal: number): { status: CodeStatus; saving: number; prices?: Map<number, number>; min?: number; row?: Code } {
  const c = i.code!
  const row = c.row
  if (!row || !row.enabled) return { status: 'invalid', saving: 0 }
  if (!isLive({ enabled: 1, starts_at: row.starts_at, ends_at: row.ends_at }, i.now)) return { status: 'expired', saving: 0 }
  if (row.max_uses > 0 && c.uses >= row.max_uses) return { status: 'used_up', saving: 0 }
  if (i.phoneKnown && row.per_phone > 0 && c.phoneUses >= row.per_phone) return { status: 'used', saving: 0 }
  if (subtotal < row.min_total) return { status: 'min', saving: 0, min: row.min_total }
  const eligible = lines.filter((l) => discountable(l.p))
  const base = eligible.reduce((s, l) => s + l.p.price * l.qty, 0)
  if (!base || !(row.value > 0)) return { status: 'no_items', saving: 0 }
  if (row.kind === 'amount') return { status: 'ok', saving: Math.min(row.value, base), row }
  const r = percentAll(eligible, Math.min(Math.max(Math.floor(row.value), 0), 100))
  return r.saving > 0 ? { status: 'ok', saving: r.saving, prices: r.prices, row } : { status: 'no_items', saving: 0 }
}

/** The offer's own saving on the lines without a flash deal: its percent, or the spend-more level reached. */
function offerResult(o: Offer | null, lines: Line[]): Saving & { tier: Quote['tier'] } {
  if (!o) return { saving: 0, prices: new Map(), tier: null }
  if (o.kind === 'tiers') {
    const tiers = parseTiers(o.tiers)
    const base = lines.filter((l) => inTiers(l.p, o)).reduce((s, l) => s + l.p.price * l.qty, 0)
    let reached: Tier | null = null
    for (const t of tiers) if (base >= t.min) reached = t
    const nx = tiers.find((t) => t.min > base)
    const tier = { pct: reached?.pct ?? 0, base, next: nx ? { min: nx.min, pct: nx.pct, need: nx.min - base } : null }
    return reached ? { ...percentAll(lines, reached.pct, (p) => inTiers(p, o)), tier } : { saving: 0, prices: new Map(), tier }
  }
  const prices = new Map<number, number>()
  let saving = 0
  for (const l of lines) {
    const np = percentPrice(l.p, o)
    if (np !== null) { prices.set(l.p.id, np); saving += (l.p.price - np) * l.qty }
  }
  return { saving, prices, tier: null }
}

/** R2–R6: flash deals first, then one saving (offer, code or loyalty: whichever saves most), the free gift, then delivery. */
export function quote(i: QuoteIn): Quote {
  const subtotal = i.lines.reduce((s, l) => s + l.p.price * l.qty, 0)
  // R2: a flash price replaces any other discount on that product
  const flashP = new Map<number, { price: number; id: number }>()
  const flashShort: Quote['flashShort'] = []
  let flashSaving = 0
  for (const l of i.lines) {
    const f = flashOf(l.p, i.offer)
    if (!f) continue
    if (f.left !== null && l.qty > f.left) { flashShort.push({ id: l.p.id, left: f.left }); continue }
    flashP.set(l.p.id, { price: f.price, id: f.flash.id })
    flashSaving += (l.p.price - f.price) * l.qty
  }
  const rest = i.lines.filter((l) => !flashP.has(l.p.id))

  const off = offerResult(i.offer, rest)
  let kind: Quote['kind'] = off.saving > 0 ? 'offer' : ''
  let best = off.saving
  let prices = off.prices
  let code: Quote['code'] = null
  if (i.code?.entered) {
    const r = codeResult(i, rest, subtotal)
    code = { code: i.code.entered, status: r.status, saving: r.saving, ...(r.min ? { min: r.min } : {}), ...(r.row ? { row: r.row } : {}) }
    if (r.status === 'ok') {
      if (r.saving > best) { kind = 'code'; best = r.saving; prices = r.prices ?? new Map() }
      else code.status = 'not_better'
    }
  }
  let loyalty: Quote['loyalty'] = null
  if (i.loyaltyPct && i.loyaltyPct > 0) {
    const r = percentAll(rest, Math.min(Math.max(Math.floor(i.loyaltyPct), 0), 50))
    if (r.saving > 0) {
      loyalty = { pct: Math.floor(i.loyaltyPct), saving: r.saving }
      if (r.saving > best) {
        if (code && code.status === 'ok') code.status = 'not_better'
        kind = 'loyalty'; best = r.saving; prices = r.prices
      }
    }
  }
  if (!kind && flashSaving > 0) kind = 'offer'
  const discount = flashSaving + best
  const lines: QuoteLine[] = i.lines.map((l) => {
    const f = flashP.get(l.p.id)
    return f ? { id: l.p.id, qty: l.qty, orig: l.p.price, price: f.price, flash: f.id } : { id: l.p.id, qty: l.qty, orig: l.p.price, price: prices.get(l.p.id) ?? l.p.price }
  })
  const items = subtotal - discount

  // R4: one free gift when the products total after discount reaches the offer's amount, only while the gift is in stock
  let gift: Quote['gift'] = null
  let giftNeed = 0
  const o = i.offer
  if (o && o.gift_product_id && (o.gift_min ?? 0) > 0 && i.gift && i.gift.id === o.gift_product_id && i.gift.in_stock && i.lines.length) {
    if (items >= o.gift_min!) gift = { id: i.gift.id, orig: i.gift.price }
    else giftNeed = o.gift_min! - items
  }

  let delivery: Delivery
  if (!i.deliveryOn) delivery = { mode: 'off' }
  else if (!i.area) delivery = { mode: 'chat', area: null }
  else if ((i.freeMin > 0 && items >= i.freeMin) || (o && o.free_delivery)) delivery = { mode: 'free', area: i.area, fee: 0 }
  else if (i.area.price === null || i.area.price === undefined) delivery = { mode: 'chat', area: i.area }
  else delivery = { mode: 'fee', area: i.area, fee: Math.max(0, i.area.price) }
  const fee = delivery.mode === 'fee' ? delivery.fee : 0
  return {
    lines, subtotal, discount, kind, items, offer: o, offerSaving: off.saving, flashSaving, flashShort, tier: off.tier, gift, giftNeed,
    code, loyalty, delivery, fee, total: items + fee,
  }
}
