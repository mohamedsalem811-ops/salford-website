import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Env, Brand, Category, Media, Product, ProductWithMedia, ListOpts } from './db'
import { SYNONYMS } from './db'
import type { Offer, City, Area } from './pricing'
import { liveOffer } from './pricing'

/**
 * The shop catalog kept in memory, so a page view costs about one database row instead of thousands.
 *
 * Every change made in the admin (and every import) writes a new `catalog_v` value. Visitors re-check that
 * value at most every RECHECK_MS; anyone signed in to the admin re-checks on every page, so they always see
 * their own changes straight away. Orders never use this copy: prices and stock are read fresh when ordering.
 */
export type Catalog = {
  v: string
  checkedAt: number
  loadedAt: number
  brands: Brand[] // visible, in order
  allBrands: Brand[]
  cats: Category[]
  shopBrands: Brand[] // visible brands that have at least one piece to show
  shopCats: Category[] // categories that have at least one piece to show
  settings: Record<string, string>
  products: Product[] // live and not deleted, in the shop's default order
  byId: Map<number, Product>
  media: Map<number, Media[]> // working media only, in order
  offers: Offer[] // enabled offers; the one running is picked per request (liveOffer), so start and end times need no reload
  cities: City[] // enabled, in order
  areas: Area[] // enabled, in order
  hasCodes: boolean // any discount code switched on: the checkout shows the code box only then
}

/** The offer running right now, if any. */
export const offerNow = (cat: Catalog) => liveOffer(cat.offers)

const RECHECK_MS = 15_000
let snap: Catalog | null = null

async function load(db: D1Database, v: string): Promise<Catalog> {
  const startedAt = Date.now()
  // Plain table reads, sorted here: D1 counts every row it touches, and ORDER BY / JOIN touch each row twice.
  const [p, m, b, c, s, o, dc, da, cc] = await db.batch([
    db.prepare("SELECT * FROM products WHERE status = 'live' AND deleted_at IS NULL"),
    db.prepare("SELECT * FROM media WHERE status != 'broken'"),
    db.prepare('SELECT * FROM brands'),
    db.prepare('SELECT * FROM categories'),
    db.prepare('SELECT key, value FROM settings'),
    db.prepare('SELECT * FROM offers WHERE enabled = 1'),
    db.prepare('SELECT * FROM delivery_cities WHERE enabled = 1'),
    db.prepare('SELECT * FROM delivery_areas WHERE enabled = 1'),
    db.prepare('SELECT count(*) AS n FROM codes WHERE enabled = 1'),
  ])
  const products = (p.results as Product[]).sort((x, y) => y.in_stock - x.in_stock || x.sort - y.sort || y.id - x.id)
  const live = new Set(products.map((x) => x.id))
  const media = new Map<number, Media[]>()
  for (const row of m.results as Media[]) {
    if (!live.has(row.product_id)) continue
    const list = media.get(row.product_id)
    if (list) list.push(row)
    else media.set(row.product_id, [row])
  }
  for (const list of media.values()) list.sort((x, y) => x.sort - y.sort || x.id - y.id)
  const bySort = <T extends { sort: number }>(rows: T[]) => rows.sort((x, y) => x.sort - y.sort)
  const allBrands = bySort(b.results as Brand[])
  const brands = allBrands.filter((x) => x.visible)
  const cats = bySort(c.results as Category[])
  const shown = products.filter((x) => media.get(x.id)?.length)
  const brandIds = new Set(shown.map((x) => x.brand_id))
  const catIds = new Set(shown.map((x) => x.category_id))
  return {
    v, checkedAt: startedAt, loadedAt: startedAt,
    brands,
    allBrands,
    cats,
    shopBrands: brands.filter((x) => brandIds.has(x.id)),
    shopCats: cats.filter((x) => catIds.has(x.id)),
    settings: Object.fromEntries((s.results as { key: string; value: string }[]).map((r) => [r.key, r.value])),
    products,
    byId: new Map(products.map((x) => [x.id, x])),
    media,
    offers: o.results as Offer[],
    cities: bySort(dc.results as City[]),
    areas: (da.results as Area[]).sort((x, y) => x.city_id - y.city_id || x.sort - y.sort || x.id - y.id),
    hasCodes: ((cc.results[0] as { n: number } | undefined)?.n ?? 0) > 0,
  }
}

export async function catalog(c: Context<{ Bindings: Env }>): Promise<Catalog> {
  const now = Date.now()
  const editor = !!getCookie(c, 'sl_admin')
  if (snap && !editor && now - snap.checkedAt < RECHECK_MS) return snap
  const db = c.env.DB
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'catalog_v'").first<{ value: string }>()
  const v = row?.value ?? '0'
  if (snap && snap.v === v) {
    snap.checkedAt = Date.now()
    return snap
  }
  const next = await load(db, v)
  // two requests may load at once; keep the newer copy
  if (!snap || next.loadedAt >= snap.loadedAt) snap = next
  return next
}

/** Call after any change the shop shows (products, photos, brands, settings). */
export async function bumpCatalog(db: D1Database) {
  const v = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  await db.prepare("INSERT INTO settings (key, value) VALUES ('catalog_v', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(v).run()
  snap = null
}

const withMedia = (cat: Catalog, p: Product, onlyFirst: boolean): ProductWithMedia => {
  const list = cat.media.get(p.id) ?? []
  return { ...p, media: onlyFirst ? list.slice(0, 2) : list }
}

const has = (s: string | null | undefined, w: string) => (s ?? '').toLowerCase().includes(w)

/** Public product list: live, not deleted, with at least one working photo or video. Same rules as the old SQL. */
export function listFrom(cat: Catalog, o: ListOpts = {}): ProductWithMedia[] {
  const words = o.q ? o.q.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5) : []
  let out = cat.products.filter((p) => {
    if (!cat.media.get(p.id)?.length) return false
    if (o.brand && p.brand_id !== o.brand) return false
    if (o.cat && p.category_id !== o.cat) return false
    if (o.flag === 'new' && !p.is_new) return false
    if (o.flag === 'best' && !p.best_seller) return false
    if (o.exclude && p.id === o.exclude) return false
    for (const w of words) {
      const syn = SYNONYMS[w]
      if (!(has(p.name_en, w) || has(p.name_ar, w) || has(p.code, w) || has(p.short_en, w) || has(p.short_ar, w) || has(p.brand_id, w) || (syn && p.category_id === syn))) return false
    }
    return true
  })
  if (o.sort === 'low') out = [...out].sort((a, b) => a.price - b.price || b.id - a.id)
  else if (o.sort === 'high') out = [...out].sort((a, b) => b.price - a.price || b.id - a.id)
  return out.slice(0, Math.min(o.limit ?? 200, 500)).map((p) => withMedia(cat, p, true))
}

export function productFrom(cat: Catalog, id: number): ProductWithMedia | null {
  const p = cat.byId.get(id)
  return p ? withMedia(cat, p, false) : null
}

export function productsByIds(cat: Catalog, ids: number[]): ProductWithMedia[] {
  return ids.map((id) => cat.byId.get(id)).filter((p): p is Product => !!p).map((p) => withMedia(cat, p, true))
}
