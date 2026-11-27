/**
 * Loads what pricing needs and runs quote(): from the in-memory catalog for /api/quote (what the shop shows),
 * and fresh from the database for /api/orders (what the customer is charged). Prices sent by the browser are never used.
 */
import type { Product } from './db'
import type { Catalog } from './catalog'
import { offerNow } from './catalog'
import type { Area, City, Code, CodeCheck, Offer, Quote } from './pricing'
import { liveOffer, normalizeCode, quote } from './pricing'

export type AreaFull = Area & { city: City }
export type Want = Map<number, number> // product id → qty

export type Loaded = { products: Product[]; offer: Offer | null; deliveryOn: boolean; freeMin: number; area: AreaFull | null; code: CodeCheck | null }

/** Up to 30 different products, 1–10 of each (same limits the order form always had). */
export function parseItems(raw: unknown): Want {
  const want: Want = new Map()
  const list = Array.isArray(raw) ? raw.slice(0, 30) : []
  for (const it of list as { id: unknown; qty: unknown }[]) {
    const id = Number(it?.id), qty = Math.min(Math.max(Math.floor(Number(it?.qty) || 1), 1), 10)
    if (Number.isInteger(id) && id > 0) want.set(id, Math.min((want.get(id) ?? 0) + qty, 10))
  }
  return want
}

const freeMinOf = (s: Record<string, string>) => {
  const n = Number(s.free_delivery_min ?? '1000000')
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

async function codeCheck(db: D1Database, entered: string, phone: string): Promise<CodeCheck> {
  const [row, uses] = await db.batch([
    db.prepare('SELECT * FROM codes WHERE code = ?').bind(entered),
    db.prepare("SELECT count(*) AS n, coalesce(sum(phone = ?), 0) AS p FROM orders WHERE code = ? AND status != 'cancelled'").bind(phone, entered),
  ])
  const u = (uses.results[0] ?? { n: 0, p: 0 }) as { n: number; p: number }
  return { entered, row: (row.results[0] as Code | undefined) ?? null, uses: u.n, phoneUses: u.p }
}

/** For /api/quote: products, offer and areas from the catalog; the code is always looked up fresh. */
export async function loadFromCatalog(db: D1Database, cat: Catalog, want: Want, codeRaw: unknown, phone: string, areaId: number, lookupCode = true): Promise<Loaded> {
  const products = [...want.keys()].map((id) => cat.byId.get(id)).filter((p): p is Product => !!p)
  const a = areaId ? cat.areas.find((x) => x.id === areaId) : undefined
  const city = a ? cat.cities.find((x) => x.id === a.city_id) : undefined
  const entered = normalizeCode(codeRaw)
  return {
    products,
    offer: offerNow(cat),
    deliveryOn: cat.settings.delivery_on === '1',
    freeMin: freeMinOf(cat.settings),
    area: a && city ? { ...a, city } : null,
    code: entered && lookupCode ? await codeCheck(db, entered, phone) : entered ? { entered, row: null, uses: 0, phoneUses: 0 } : null,
  }
}

/** For /api/orders: everything read fresh in one round trip. Only live, in-stock products can be ordered. */
export async function loadFresh(db: D1Database, want: Want, codeRaw: unknown, phone: string, areaId: number): Promise<Loaded> {
  const ids = [...want.keys()]
  const entered = normalizeCode(codeRaw)
  const res = await db.batch([
    db.prepare(`SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')}) AND status = 'live' AND deleted_at IS NULL AND in_stock = 1`).bind(...ids),
    db.prepare('SELECT * FROM offers WHERE enabled = 1'),
    db.prepare("SELECT key, value FROM settings WHERE key IN ('delivery_on', 'free_delivery_min')"),
    db.prepare(
      'SELECT a.*, c.name_ar AS c_ar, c.name_en AS c_en, c.sort AS c_sort FROM delivery_areas a JOIN delivery_cities c ON c.id = a.city_id WHERE a.id = ? AND a.enabled = 1 AND c.enabled = 1',
    ).bind(areaId || 0),
  ])
  const s = Object.fromEntries((res[2].results as { key: string; value: string }[]).map((r) => [r.key, r.value]))
  const ar = res[3].results[0] as (Area & { c_ar: string; c_en: string; c_sort: number }) | undefined
  return {
    products: res[0].results as Product[],
    offer: liveOffer(res[1].results as Offer[]),
    deliveryOn: s.delivery_on === '1',
    freeMin: freeMinOf(s),
    area: ar ? { ...ar, city: { id: ar.city_id, name_ar: ar.c_ar, name_en: ar.c_en, sort: ar.c_sort, enabled: 1 } } : null,
    code: entered ? await codeCheck(db, entered, phone) : null,
  }
}

export function runQuote(l: Loaded, want: Want, phoneKnown: boolean): Quote {
  return quote({
    lines: l.products.filter((p) => p.in_stock).map((p) => ({ p, qty: want.get(p.id) ?? 1 })),
    offer: l.offer,
    code: l.code,
    phoneKnown,
    deliveryOn: l.deliveryOn,
    area: l.area,
    freeMin: l.freeMin,
  })
}

/** "Tajoura, Tripoli" in the order's language. */
export const placeName = (a: AreaFull, lang: 'ar' | 'en') => {
  const n = (x: { name_ar: string; name_en: string }) => (lang === 'ar' ? x.name_ar || x.name_en : x.name_en || x.name_ar)
  // a city with one "All areas" entry is just the city
  return { city: n(a.city), area: a.name_en === 'All areas' ? '' : n(a) }
}
