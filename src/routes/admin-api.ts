import { Hono } from 'hono'
import type { Env, Media } from '../lib/db'
import { toDirham } from '../lib/db'
import { hashPassword, verifyLogin } from '../lib/auth'
import { youtubeId } from '../lib/media'

import { translateProduct } from '../lib/translate'

type Vars = { admin: { id: number; email: string } }

export const adminApi = new Hono<{ Bindings: Env; Variables: Vars }>()

const MAX_PHOTO = 25 * 1024 * 1024
const MAX_VIDEO = 100 * 1024 * 1024
const MAX_VARIANT = 4 * 1024 * 1024
const rand = () => [...crypto.getRandomValues(new Uint8Array(9))].map((b) => b.toString(16).padStart(2, '0')).join('')
const now = "datetime('now')"

/* ---------- link checks ---------- */
export type Probe = { ok: boolean; kind?: 'image' | 'video' | 'youtube'; url: string; type?: string; bytes?: number; reason?: string }

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i

export function normalizeLink(raw: string): string {
  let url = raw.trim()
  try {
    const u = new URL(url)
    if (u.hostname.endsWith('dropbox.com')) { u.searchParams.delete('dl'); u.searchParams.set('raw', '1'); url = u.toString() }
  } catch { /* handled by probe */ }
  return url
}

export async function probe(raw: string): Promise<Probe> {
  const url = normalizeLink(raw)
  let u: URL
  try { u = new URL(url) } catch { return { ok: false, url, reason: 'This is not a valid link.' } }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, url, reason: 'Only http and https links work.' }
  if (PRIVATE_HOST.test(u.hostname)) return { ok: false, url, reason: 'Private or internal addresses are not allowed.' }
  const yt = youtubeId(url)
  if (yt) return { ok: true, kind: 'youtube', url: `https://www.youtube.com/watch?v=${yt}` }
  const h = u.hostname.replace(/^www\./, '')
  if (/^(instagram\.com|facebook\.com|fb\.com|m\.facebook\.com)$/.test(h)) return { ok: false, url, reason: 'Instagram and Facebook post links are pages, not photo files. Upload the photo instead, or paste a direct link to the file.' }
  if (/(fbcdn\.net|cdninstagram\.com)$/.test(h)) return { ok: false, url, reason: 'Instagram and Facebook photo links stop working after a few days. Please upload the photo instead.' }
  if (h === 'drive.google.com' || h === 'docs.google.com') return { ok: false, url, reason: 'Google Drive links are usually not direct photo files. Please upload the photo instead.' }
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-0', 'User-Agent': 'Mozilla/5.0 (compatible; SalfordLinkCheck/1.0)' }, redirect: 'follow' })
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const total = Number((res.headers.get('content-range') || '').split('/')[1]) || Number(res.headers.get('content-length')) || undefined
    try { await res.body?.cancel() } catch { /* ignore */ }
    if (!(res.status === 200 || res.status === 206)) return { ok: false, url, reason: res.status === 403 ? 'That website blocks linking to its files.' : `The link answered with error ${res.status}.` }
    const kind = type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : undefined
    if (!kind) return { ok: false, url, type, reason: 'The link is a web page, not a photo or video file.' }
    if (kind === 'image' && total && total > MAX_PHOTO) return { ok: false, url, kind, type, bytes: total, reason: 'The photo is larger than 25 MB.' }
    if (kind === 'video' && total && total > MAX_VIDEO) return { ok: false, url, kind, type, bytes: total, reason: 'The video is larger than 100 MB.' }
    return { ok: true, url, kind, type, bytes: total }
  } catch {
    return { ok: false, url, reason: 'The link could not be opened.' }
  }
}

/** Downloads a linked file once into R2. Streams when the size is known. */
export async function safeCopy(env: Env, m: Pick<Media, 'id' | 'product_id' | 'url' | 'kind'>): Promise<{ ok: boolean; key?: string; bytes?: number; reason?: string }> {
  if (m.kind === 'youtube') return { ok: false, reason: 'YouTube videos stay on YouTube.' }
  try {
    const res = await fetch(m.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SalfordSafeCopy/1.0)' }, redirect: 'follow' })
    if (!res.ok || !res.body) return { ok: false, reason: `Download failed (${res.status}).` }
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!type.startsWith('image/') && !type.startsWith('video/')) { await res.body.cancel(); return { ok: false, reason: 'Not a photo or video file.' } }
    const max = type.startsWith('video/') ? MAX_VIDEO : MAX_PHOTO
    const len = Number(res.headers.get('content-length')) || 0
    if (len > max) { await res.body.cancel(); return { ok: false, reason: 'File too large.' } }
    const ext = (type.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace('quicktime', 'mov').replace(/[^a-z0-9]/g, '')
    const key = `l/${m.product_id}/${rand()}.${ext}`
    let body: ReadableStream | ArrayBuffer
    let bytes = len
    if (len) {
      const fixed = new FixedLengthStream(len)
      res.body.pipeTo(fixed.writable)
      body = fixed.readable
    } else {
      const buf = await res.arrayBuffer()
      if (buf.byteLength > max) return { ok: false, reason: 'File too large.' }
      body = buf
      bytes = buf.byteLength
    }
    await env.MEDIA.put(key, body, { httpMetadata: { contentType: type } })
    return { ok: true, key, bytes }
  } catch {
    return { ok: false, reason: 'Download failed.' }
  }
}

/* ---------- products ---------- */
adminApi.post('/products/new', async (c) => {
  const r = await c.env.DB.prepare("INSERT INTO products (code, brand_id, category_id, status, sort) VALUES ('', 'swarovski', 'necklaces', 'draft', -1) RETURNING id").first<{ id: number }>()
  return c.redirect(`/admin/p/${r!.id}`)
})

/** Quick import: creates a draft product from a file name like SWAROVSKI-5642976(550). */
adminApi.post('/products/quick', async (c) => {
  const b = await c.req.json<{ brand: string; code: string; price: number }>()
  const brand = ['swarovski', 'tiffany', 'apm', 'pandora'].includes(b.brand) ? b.brand : 'swarovski'
  const code = String(b.code || '').slice(0, 60)
  const isSet = code.includes('+')
  const r = await c.env.DB.prepare(
    "INSERT INTO products (code, brand_id, category_id, name_en, price, is_set, set_codes, status, sort) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', -1) RETURNING id",
  ).bind(code, brand, isSet ? 'sets' : 'necklaces', code, toDirham(b.price), isSet ? 1 : 0, JSON.stringify(isSet ? code.split('+') : [])).first<{ id: number }>()
  return c.json({ id: r!.id })
})

adminApi.put('/products/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const b = await c.req.json<Record<string, unknown>>()
  const s = (k: string, max = 4000) => String(b[k] ?? '').trim().slice(0, max)
  const flag = (k: string) => (b[k] ? 1 : 0)
  const brand = s('brand_id', 20), cat = s('category_id', 20), status = s('status', 10)
  if (!['live', 'draft', 'hidden'].includes(status)) return c.json({ error: 'Bad status' }, 400)
  if (!s('code', 60)) return c.json({ error: 'Product code is required.' }, 400)
  const compare = s('compare_price') ? toDirham(s('compare_price')) : null
  const codes = s('set_codes', 300).split(/[,+\s]+/).filter(Boolean)
  const old = await c.env.DB.prepare('SELECT short_en, short_ar, desc_en, desc_ar FROM products WHERE id=?').bind(id).first<Record<string, string>>()
  if (!old) return c.json({ error: 'Product not found' }, 404)
  // English changed but the Arabic was left as it was: the old Arabic no longer matches, so it is written again.
  const arOf = (f: 'short' | 'desc', max: number) => {
    const ar = s(`${f}_ar`, max), en = s(`${f}_en`, max)
    return ar && en !== old[`${f}_en`] && ar === old[`${f}_ar`] ? '' : ar
  }
  const shortAr = arOf('short', 300), descAr = arOf('desc', 4000)
  await c.env.DB.prepare(
    `UPDATE products SET brand_id=?, category_id=?, code=?, price=?, compare_price=?, name_en=?, short_ar=?, short_en=?, desc_ar=?, desc_en=?,
     set_codes=?, status=?, in_stock=?, is_new=?, best_seller=?, is_set=?, updated_at=${now} WHERE id=?`,
  ).bind(brand, cat, s('code', 60), toDirham(s('price')), compare, s('name_en', 200), shortAr, s('short_en', 300), descAr, s('desc_en'),
    JSON.stringify(codes), status, flag('in_stock'), flag('is_new'), flag('best_seller'), flag('is_set'), id).run()
  const missing = (s('short_en', 300) && !shortAr) || (s('desc_en') && !descAr)
  if (missing && c.env.AI) {
    const r = await translateProduct(c.env, id)
    return c.json({ ok: true, translated: r.ok, short_ar: r.short_ar, desc_ar: r.desc_ar })
  }
  return c.json({ ok: true })
})

adminApi.post('/products/:id{[0-9]+}/translate', async (c) => {
  const r = await translateProduct(c.env, Number(c.req.param('id')), true)
  return r.ok ? c.json(r) : c.json({ error: r.reason }, 502)
})

/* Fills empty Arabic short lines and descriptions, a few products per call (the admin page keeps calling until done). */
adminApi.post('/products/translate-missing', async (c) => {
  if (!c.env.AI) return c.json({ error: 'Automatic translation is not switched on for this site yet.' }, 400)
  const { after = 0 } = await c.req.json<{ after?: number }>().catch(() => ({ after: 0 }))
  const need = "deleted_at IS NULL AND ((short_en <> '' AND short_ar = '') OR (desc_en <> '' AND desc_ar = ''))"
  const rows = (await c.env.DB.prepare(`SELECT id FROM products WHERE ${need} AND id > ? ORDER BY id LIMIT 3`).bind(after).all<{ id: number }>()).results
  const report = []
  for (const r of rows) report.push({ product_id: r.id, ...(await translateProduct(c.env, r.id)) })
  const left = await c.env.DB.prepare(`SELECT count(*) n FROM products WHERE ${need} AND id > ?`).bind(rows.at(-1)?.id ?? after).first<{ n: number }>()
  return c.json({ report, next: rows.at(-1)?.id ?? 0, remaining: left?.n ?? 0 })
})

adminApi.post('/products/:id{[0-9]+}/toggle', async (c) => {
  const { field } = await c.req.json<{ field: string }>()
  if (!['in_stock', 'is_new', 'best_seller'].includes(field)) return c.json({ error: 'Bad field' }, 400)
  const r = await c.env.DB.prepare(`UPDATE products SET ${field} = 1 - ${field}, updated_at=${now} WHERE id = ? RETURNING ${field} AS v`).bind(Number(c.req.param('id'))).first<{ v: number }>()
  return c.json({ value: r?.v })
})

adminApi.delete('/products/:id{[0-9]+}', async (c) => {
  await c.env.DB.prepare(`UPDATE products SET deleted_at=${now} WHERE id=?`).bind(Number(c.req.param('id'))).run()
  return c.json({ ok: true })
})
adminApi.post('/products/:id{[0-9]+}/restore', async (c) => {
  await c.env.DB.prepare('UPDATE products SET deleted_at=NULL WHERE id=?').bind(Number(c.req.param('id'))).run()
  return c.json({ ok: true })
})

/* ---------- media ---------- */
const mediaCount = (db: D1Database, pid: number) => db.prepare('SELECT count(*) AS n, coalesce(max(sort),-1) AS mx FROM media WHERE product_id = ?').bind(pid).first<{ n: number; mx: number }>()

adminApi.post('/media/link', async (c) => {
  const b = await c.req.json<{ product_id: number; url: string; copy: boolean }>()
  const pid = Number(b.product_id)
  const cnt = await mediaCount(c.env.DB, pid)
  if ((cnt?.n ?? 0) >= 9) return c.json({ error: 'A product can have up to 8 photos and 1 video.' }, 400)
  const pr = await probe(String(b.url || ''))
  if (!pr.ok) {
    // An http link or a site that blocks linking can still work through a safe copy.
    return c.json({ error: pr.reason }, 422)
  }
  const row = await c.env.DB.prepare(
    `INSERT INTO media (product_id, kind, source, url, bytes, sort, status, checked_at) VALUES (?, ?, 'link', ?, ?, ?, 'ok', ${now}) RETURNING *`,
  ).bind(pid, pr.kind, pr.url, pr.bytes ?? null, (cnt?.mx ?? -1) + 1).first<Media>()
  let copy: Awaited<ReturnType<typeof safeCopy>> | null = null
  if (b.copy && pr.kind !== 'youtube') {
    copy = await safeCopy(c.env, row!)
    if (copy.ok) await c.env.DB.prepare('UPDATE media SET r2_key=?, bytes=? WHERE id=?').bind(copy.key!, copy.bytes ?? null, row!.id).run()
  }
  const fresh = await c.env.DB.prepare('SELECT * FROM media WHERE id=?').bind(row!.id).first<Media>()
  return c.json({ media: fresh, copy })
})

const MAGIC: [string, (b: Uint8Array) => boolean][] = [
  ['image/webp', (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50],
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
]

/** One resized variant of an uploaded photo (resizing happens in the browser). */
adminApi.put('/upload', async (c) => {
  const pid = c.req.query('product') || 'banner'
  const base = c.req.query('base') || ''
  const w = Number(c.req.query('w'))
  if (!/^[a-f0-9]{18}$/.test(base) || !(w > 0 && w <= 2400) || !/^(\d+|banner)$/.test(pid)) return c.json({ error: 'Bad upload request' }, 400)
  const buf = new Uint8Array(await c.req.arrayBuffer())
  if (buf.byteLength > MAX_VARIANT) return c.json({ error: 'File too large' }, 413)
  const type = MAGIC.find(([, test]) => test(buf))?.[0]
  if (!type) return c.json({ error: 'Not a photo file' }, 415)
  const key = `${pid === 'banner' ? 'b' : `u/${pid}`}/${base}-${w}`
  await c.env.MEDIA.put(key, buf, { httpMetadata: { contentType: type } })
  return c.json({ key, url: `/m/${key}`, bytes: buf.byteLength })
})

adminApi.post('/media', async (c) => {
  const b = await c.req.json<{ product_id: number; kind: string; r2_key: string; sizes: number[]; width?: number; height?: number; bytes?: number }>()
  const pid = Number(b.product_id)
  if (!/^(u|v)\/\d+\/[a-f0-9]{18}(\.[a-z0-9]+)?$/.test(b.r2_key || '') || !b.r2_key.includes(`/${pid}/`)) return c.json({ error: 'Bad key' }, 400)
  const cnt = await mediaCount(c.env.DB, pid)
  if ((cnt?.n ?? 0) >= 9) return c.json({ error: 'A product can have up to 8 photos and 1 video.' }, 400)
  const sizes = Array.isArray(b.sizes) ? b.sizes.filter((n) => Number.isInteger(n)).slice(0, 4) : []
  const row = await c.env.DB.prepare(
    `INSERT INTO media (product_id, kind, source, r2_key, sizes, width, height, bytes, sort, status, checked_at) VALUES (?, ?, 'upload', ?, ?, ?, ?, ?, ?, 'ok', ${now}) RETURNING *`,
  ).bind(pid, b.kind === 'video' ? 'video' : 'image', b.r2_key, JSON.stringify(sizes), b.width ?? null, b.height ?? null, b.bytes ?? null, (cnt?.mx ?? -1) + 1).first<Media>()
  return c.json({ media: row })
})

adminApi.put('/media/order', async (c) => {
  const b = await c.req.json<{ product_id: number; ids: number[] }>()
  const pid = Number(b.product_id)
  const ids = (b.ids || []).map(Number).filter(Number.isInteger).slice(0, 20)
  await c.env.DB.batch(ids.map((id, i) => c.env.DB.prepare('UPDATE media SET sort=? WHERE id=? AND product_id=?').bind(i, id, pid)))
  return c.json({ ok: true })
})

async function deleteObjects(env: Env, m: Media) {
  if (!m.r2_key) return
  let sizes: number[] = []
  try { sizes = JSON.parse(m.sizes || '[]') } catch { sizes = [] }
  const keys = sizes.length ? sizes.map((s) => `${m.r2_key}-${s}`) : [m.r2_key]
  await env.MEDIA.delete(keys)
}

adminApi.delete('/media/:id{[0-9]+}', async (c) => {
  const m = await c.env.DB.prepare('SELECT * FROM media WHERE id=?').bind(Number(c.req.param('id'))).first<Media>()
  if (!m) return c.json({ ok: true })
  await deleteObjects(c.env, m)
  await c.env.DB.prepare('DELETE FROM media WHERE id=?').bind(m.id).run()
  return c.json({ ok: true })
})

/* ---------- video upload in 10 MB parts ---------- */
adminApi.post('/video/start', async (c) => {
  const b = await c.req.json<{ product_id: number; type: string; size: number }>()
  const pid = Number(b.product_id)
  if (!(b.size > 0 && b.size <= MAX_VIDEO)) return c.json({ error: 'Videos can be up to 100 MB.' }, 413)
  const type = ['video/mp4', 'video/quicktime', 'video/webm'].includes(b.type) ? b.type : 'video/mp4'
  const existing = await c.env.DB.prepare("SELECT count(*) AS n FROM media WHERE product_id=? AND kind='video'").bind(pid).first<{ n: number }>()
  if ((existing?.n ?? 0) >= 1) return c.json({ error: 'A product can have 1 video. Remove the current one first.' }, 400)
  const ext = type === 'video/quicktime' ? 'mov' : type === 'video/webm' ? 'webm' : 'mp4'
  const key = `v/${pid}/${rand()}.${ext}`
  const up = await c.env.MEDIA.createMultipartUpload(key, { httpMetadata: { contentType: type } })
  return c.json({ key, uploadId: up.uploadId })
})
adminApi.put('/video/part', async (c) => {
  const key = c.req.query('key') || '', uploadId = c.req.query('uploadId') || '', n = Number(c.req.query('n'))
  if (!/^v\/\d+\/[a-f0-9]{18}\.(mp4|mov|webm)$/.test(key) || !(n >= 1 && n <= 20)) return c.json({ error: 'Bad part' }, 400)
  const buf = await c.req.arrayBuffer()
  if (buf.byteLength > 11 * 1024 * 1024) return c.json({ error: 'Part too large' }, 413)
  const up = c.env.MEDIA.resumeMultipartUpload(key, uploadId)
  const part = await up.uploadPart(n, buf)
  return c.json(part)
})
adminApi.post('/video/complete', async (c) => {
  const b = await c.req.json<{ key: string; uploadId: string; parts: R2UploadedPart[]; product_id: number; size: number }>()
  const pid = Number(b.product_id)
  if (!b.key.startsWith(`v/${pid}/`)) return c.json({ error: 'Bad key' }, 400)
  const up = c.env.MEDIA.resumeMultipartUpload(b.key, b.uploadId)
  await up.complete(b.parts)
  const cnt = await mediaCount(c.env.DB, pid)
  const row = await c.env.DB.prepare(
    `INSERT INTO media (product_id, kind, source, r2_key, bytes, sort, status, checked_at) VALUES (?, 'video', 'upload', ?, ?, ?, 'ok', ${now}) RETURNING *`,
  ).bind(pid, b.key, b.size, (cnt?.mx ?? -1) + 1).first<Media>()
  return c.json({ media: row })
})

/* ---------- bulk: check links / safe copies (small batches, driven by the browser) ---------- */
adminApi.post('/media/batch', async (c) => {
  const { op, after } = await c.req.json<{ op: 'check' | 'copy'; after: number }>()
  const where = op === 'copy' ? "source='link' AND r2_key IS NULL AND kind != 'youtube' AND status != 'broken'" : "source='link' AND kind != 'youtube'"
  const { results } = await c.env.DB.prepare(`SELECT * FROM media WHERE ${where} AND id > ? ORDER BY id LIMIT 4`).bind(Number(after) || 0).all<Media>()
  const report: { id: number; product_id: number; ok: boolean; reason?: string }[] = []
  for (const m of results) {
    if (op === 'check') {
      const pr = await probe(m.url)
      // A broken link with a safe copy still shows the copy.
      const status = pr.ok || m.r2_key ? 'ok' : 'broken'
      await c.env.DB.prepare(`UPDATE media SET status=?, checked_at=${now}, bytes=coalesce(bytes, ?) WHERE id=?`).bind(status, pr.bytes ?? null, m.id).run()
      report.push({ id: m.id, product_id: m.product_id, ok: pr.ok, reason: pr.reason })
    } else {
      const r = await safeCopy(c.env, m)
      if (r.ok) await c.env.DB.prepare(`UPDATE media SET r2_key=?, bytes=?, status='ok', checked_at=${now} WHERE id=?`).bind(r.key!, r.bytes ?? null, m.id).run()
      report.push({ id: m.id, product_id: m.product_id, ok: r.ok, reason: r.reason })
    }
  }
  const remaining = await c.env.DB.prepare(`SELECT count(*) AS n FROM media WHERE ${where} AND id > ?`).bind(results.length ? results[results.length - 1].id : Number(after) || 0).first<{ n: number }>()
  return c.json({ report, next: results.length ? results[results.length - 1].id : null, remaining: remaining?.n ?? 0 })
})

/* ---------- orders ---------- */
adminApi.post('/orders/:id{[0-9]+}', async (c) => {
  const b = await c.req.json<{ status: string; admin_note: string }>()
  if (!['new', 'confirmed', 'paid', 'delivered', 'cancelled'].includes(b.status)) return c.json({ error: 'Bad status' }, 400)
  await c.env.DB.prepare('UPDATE orders SET status=?, admin_note=? WHERE id=?').bind(b.status, String(b.admin_note ?? '').slice(0, 1000), Number(c.req.param('id'))).run()
  return c.json({ ok: true })
})

/* ---------- settings ---------- */
const SETTING_KEYS = ['whatsapp', 'facebook', 'instagram', 'pay_cod_cash', 'pay_cod_card', 'pay_lypay',
  'page_about_ar', 'page_about_en', 'page_delivery_ar', 'page_delivery_en', 'page_contact_ar', 'page_contact_en']

adminApi.post('/settings', async (c) => {
  const b = await c.req.json<Record<string, unknown>>()
  const stmts = SETTING_KEYS.map((k) => {
    let v = String(b[k] ?? '').trim().slice(0, 3000)
    if (k.startsWith('pay_')) v = b[k] ? '1' : '0'
    if (k === 'whatsapp') v = v.replace(/\D/g, '').replace(/^00/, '').replace(/^0(9\d{8})$/, '218$1')
    if ((k === 'facebook' || k === 'instagram') && v && !/^https:\/\//.test(v)) v = `https://${v.replace(/^\/+/, '')}`
    return c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, v)
  })
  const banners = [0, 1, 2]
    .map((i) => Object.fromEntries(['image', 'image_mobile', 'eyebrow_ar', 'eyebrow_en', 'title_ar', 'title_en', 'link'].map((f) => [f, String(b[`b${i}_${f}`] ?? '').trim().slice(0, 500)])))
    .filter((bn) => bn.image || bn.image_mobile)
  stmts.push(c.env.DB.prepare("INSERT INTO settings (key, value) VALUES ('banners', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(banners)))
  await c.env.DB.batch(stmts)
  return c.json({ ok: true })
})

adminApi.post('/admins', async (c) => {
  const b = await c.req.json<{ email: string; password: string }>()
  const email = String(b.email ?? '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || String(b.password ?? '').length < 10) return c.json({ error: 'Use a valid email and a password of at least 10 characters.' }, 400)
  const { hash, salt } = await hashPassword(String(b.password))
  try {
    await c.env.DB.prepare('INSERT INTO admins (email, pass_hash, salt) VALUES (?, ?, ?)').bind(email, hash, salt).run()
  } catch {
    return c.json({ error: 'That email already has access.' }, 409)
  }
  return c.json({ ok: true })
})
adminApi.delete('/admins/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const n = await c.env.DB.prepare('SELECT count(*) AS n FROM admins').first<{ n: number }>()
  if ((n?.n ?? 0) <= 1) return c.json({ error: 'At least one admin is needed.' }, 400)
  await c.env.DB.prepare('DELETE FROM admins WHERE id=?').bind(id).run()
  return c.json({ ok: true })
})
adminApi.post('/password', async (c) => {
  const b = await c.req.json<{ current: string; password: string }>()
  const me = c.get('admin')
  if (String(b.password ?? '').length < 10) return c.json({ error: 'The new password needs at least 10 characters.' }, 400)
  if (!(await verifyLogin(c.env.DB, me.email, String(b.current ?? '')))) return c.json({ error: 'Your current password is wrong.' }, 403)
  const { hash, salt } = await hashPassword(String(b.password))
  await c.env.DB.prepare('UPDATE admins SET pass_hash=?, salt=? WHERE id=?').bind(hash, salt, me.id).run()
  return c.json({ ok: true })
})
