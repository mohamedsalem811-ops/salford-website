import type { Lang } from './i18n'

export type Env = {
  DB: D1Database
  MEDIA: R2Bucket
  PREVIEW_KEY?: string
  /** Optional public address of the photo bucket (e.g. https://media.salfordlibya.com). Unset: photos are served by the site under /m/. */
  MEDIA_BASE?: string
  AI?: Ai
}

export type Brand = { id: string; name: string; story_ar: string; story_en: string; tint: string; sort: number; visible: number }
export type Category = { id: string; name_ar: string; name_en: string; sort: number }
export type Media = {
  id: number; product_id: number; kind: 'image' | 'video' | 'youtube'; source: 'link' | 'upload'
  url: string; r2_key: string | null; sizes: string; width: number | null; height: number | null
  bytes: number | null; sort: number; status: string; checked_at: string | null
}
export type Product = {
  id: number; legacy_id: string | null; code: string; brand_id: string; category_id: string
  name_en: string; name_ar: string; short_en: string; short_ar: string; desc_en: string; desc_ar: string
  price: number; compare_price: number | null; is_set: number; set_codes: string
  in_stock: number; is_new: number; best_seller: number; status: string; sort: number
  created_at: string; updated_at: string; deleted_at: string | null
  no_discount?: number
}
export type ProductWithMedia = Product & { media: Media[] }

/** Money is stored in dirhams. */
export const toDirham = (lyd: number | string) => Math.round(Number(lyd || 0) * 1000)
export const fmtLyd = (dirham: number) => {
  const v = dirham / 1000
  return v.toLocaleString('en-US', { maximumFractionDigits: Number.isInteger(v) ? 0 : 3 })
}

/* Product names stay in English in both languages. */
export const pName = (p: Product, _lang?: Lang) => p.name_en || p.name_ar
export const pShort = (p: Product, lang: Lang) => (lang === 'ar' ? p.short_ar || p.short_en : p.short_en || p.short_ar)
export const pDesc = (p: Product, lang: Lang) => (lang === 'ar' ? p.desc_ar || p.desc_en : p.desc_en || p.desc_ar)

export async function getSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  return Object.fromEntries(results.map((r) => [r.key, r.value]))
}

export async function getBrands(db: D1Database, all = false): Promise<Brand[]> {
  const sql = all ? 'SELECT * FROM brands ORDER BY sort' : 'SELECT * FROM brands WHERE visible = 1 ORDER BY sort'
  return (await db.prepare(sql).all<Brand>()).results
}

export async function getCategories(db: D1Database): Promise<Category[]> {
  return (await db.prepare('SELECT * FROM categories ORDER BY sort').all<Category>()).results
}

export async function attachMedia(db: D1Database, products: Product[], onlyFirst = false): Promise<ProductWithMedia[]> {
  if (!products.length) return []
  const ids = products.map((p) => p.id)
  const ph = ids.map(() => '?').join(',')
  const { results } = await db
    .prepare(`SELECT * FROM media WHERE product_id IN (${ph}) AND status != 'broken' ORDER BY product_id, sort, id`)
    .bind(...ids)
    .all<Media>()
  const by = new Map<number, Media[]>()
  for (const m of results) {
    const list = by.get(m.product_id) ?? []
    if (!onlyFirst || list.length < 2) list.push(m)
    by.set(m.product_id, list)
  }
  return products.map((p) => ({ ...p, media: by.get(p.id) ?? [] }))
}

export const SYNONYMS: Record<string, string> = {
  'قلادة': 'necklaces', 'قلاده': 'necklaces', 'قلائد': 'necklaces', 'سلسلة': 'necklaces', 'سلسله': 'necklaces', 'عقد': 'necklaces', 'تعليقة': 'necklaces',
  'حلق': 'earrings', 'أقراط': 'earrings', 'اقراط': 'earrings', 'قرط': 'earrings', 'تراشي': 'earrings',
  'سوار': 'bracelets', 'أساور': 'bracelets', 'اساور': 'bracelets', 'اسورة': 'bracelets', 'إسورة': 'bracelets', 'بنقري': 'bracelets',
  'خاتم': 'rings', 'خواتم': 'rings', 'محبس': 'rings',
  'طقم': 'sets', 'أطقم': 'sets', 'اطقم': 'sets',
  'necklace': 'necklaces', 'earring': 'earrings', 'bracelet': 'bracelets', 'ring': 'rings', 'set': 'sets',
}

export type ListOpts = { brand?: string; cat?: string; q?: string; sort?: string; flag?: 'new' | 'best'; limit?: number; exclude?: number }

/** Public product list: live, not deleted, with at least one working media item. */
export async function listProducts(db: D1Database, o: ListOpts = {}): Promise<ProductWithMedia[]> {
  const where = ["p.status = 'live'", 'p.deleted_at IS NULL', "EXISTS (SELECT 1 FROM media m WHERE m.product_id = p.id AND m.status != 'broken')"]
  const args: unknown[] = []
  if (o.brand) { where.push('p.brand_id = ?'); args.push(o.brand) }
  if (o.cat) { where.push('p.category_id = ?'); args.push(o.cat) }
  if (o.flag === 'new') where.push('p.is_new = 1')
  if (o.flag === 'best') where.push('p.best_seller = 1')
  if (o.exclude) { where.push('p.id != ?'); args.push(o.exclude) }
  if (o.q) {
    const words = o.q.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5)
    for (const w of words) {
      const syn = SYNONYMS[w]
      const like = `%${w}%`
      where.push(
        `(lower(p.name_en) LIKE ? OR p.name_ar LIKE ? OR p.code LIKE ? OR lower(p.short_en) LIKE ? OR p.short_ar LIKE ? OR lower(p.brand_id) LIKE ?${syn ? ' OR p.category_id = ?' : ''})`,
      )
      args.push(like, like, like, like, like, like)
      if (syn) args.push(syn)
    }
  }
  const order =
    o.sort === 'low' ? 'p.price ASC' : o.sort === 'high' ? 'p.price DESC' : 'p.in_stock DESC, p.sort ASC, p.id DESC'
  const sql = `SELECT p.* FROM products p WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${Math.min(o.limit ?? 200, 500)}`
  const { results } = await db.prepare(sql).bind(...args).all<Product>()
  return attachMedia(db, results, true)
}

export async function getProduct(db: D1Database, id: number, includeHidden = false): Promise<ProductWithMedia | null> {
  const p = await db
    .prepare(`SELECT * FROM products WHERE id = ? AND deleted_at IS NULL${includeHidden ? '' : " AND status = 'live'"}`)
    .bind(id)
    .first<Product>()
  if (!p) return null
  const { results } = await db
    .prepare(`SELECT * FROM media WHERE product_id = ?${includeHidden ? '' : " AND status != 'broken'"} ORDER BY sort, id`)
    .bind(id)
    .all<Media>()
  return { ...p, media: results }
}
