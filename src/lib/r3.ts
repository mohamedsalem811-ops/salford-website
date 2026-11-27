/**
 * Release 3 helpers: reviews (photo checks, metadata removal, star summaries), the waiting-list message
 * and the "ask for a review" message. Shared by the shop, the public API and the admin.
 */
import type { Lang } from './i18n'

export type Review = {
  id: number; product_id: number | null; order_id: number | null; name: string; city: string; rating: number; text: string
  photo_key: string; lang: string; verified: number; status: string; created_at: string
}
/** What the shop keeps in memory for approved reviews (never the phone or the connection hash). */
export const REVIEW_PUBLIC_COLS = 'id, product_id, order_id, name, city, rating, text, photo_key, lang, verified, status, created_at'

export const WAITLIST_DAYS = 90
export const MAX_REVIEW_PHOTO = 3 * 1024 * 1024

export const onSwitch = (s: Record<string, string>, key: 'waitlist_on' | 'reviews_on') => s[key] === '1'

/** Average (one decimal) and count. */
export function stars(list: { rating: number }[]) {
  if (!list.length) return { avg: 0, n: 0 }
  const sum = list.reduce((t, r) => t + r.rating, 0)
  return { avg: Math.round((sum / list.length) * 10) / 10, n: list.length }
}

/** 'jpeg' | 'webp' from the first bytes, or '' (anything else is refused). */
export function photoType(b: Uint8Array): 'jpeg' | 'webp' | '' {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'webp'
  return ''
}

/**
 * Removes hidden data (location, camera, comments) from a JPEG or WebP. The shop resizes photos in the browser,
 * which already drops it; this makes sure a photo sent another way cannot carry it onto the site.
 * Returns null when the file is not a well-formed JPEG/WebP.
 */
export function stripMetadata(b: Uint8Array): Uint8Array | null {
  const t = photoType(b)
  if (t === 'jpeg') return stripJpeg(b)
  if (t === 'webp') return stripWebp(b)
  return null
}

function stripJpeg(b: Uint8Array): Uint8Array | null {
  const out: Uint8Array[] = [b.subarray(0, 2)]
  let i = 2
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null
    const m = b[i + 1]
    if (m === 0xff) { i++; continue } // fill byte
    if (m === 0xda) { out.push(b.subarray(i)); break } // start of the picture data: everything after is kept
    if (m === 0xd9) { out.push(b.subarray(i, i + 2)); break }
    if (m >= 0xd0 && m <= 0xd7) { out.push(b.subarray(i, i + 2)); i += 2; continue }
    const len = (b[i + 2] << 8) | b[i + 3]
    if (len < 2 || i + 2 + len > b.length) return null
    // APP1 (EXIF, XMP), APP12/APP13 (Photoshop, IPTC) and comments are dropped; colour (APP2) and the rest are kept
    const drop = m === 0xe1 || m === 0xec || m === 0xed || m === 0xfe
    if (!drop) out.push(b.subarray(i, i + 2 + len))
    i += 2 + len
  }
  if (out.length < 2) return null
  const size = out.reduce((s, x) => s + x.length, 0)
  const res = new Uint8Array(size)
  let o = 0
  for (const x of out) { res.set(x, o); o += x.length }
  return res
}

function stripWebp(b: Uint8Array): Uint8Array | null {
  const chunks: Uint8Array[] = []
  let i = 12
  while (i + 8 <= b.length) {
    const id = String.fromCharCode(...b.subarray(i, i + 4))
    const len = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)
    const end = i + 8 + len + (len & 1)
    if (len < 0 || i + 8 + len > b.length) return null
    if (id !== 'EXIF' && id !== 'XMP ') {
      const ch = b.slice(i, Math.min(end, b.length))
      if (id === 'VP8X' && ch.length > 8) ch[8] &= ~0x0c // no longer says it carries EXIF/XMP
      chunks.push(ch)
    }
    i = end
  }
  if (!chunks.length) return null
  const body = chunks.reduce((s, x) => s + x.length, 0)
  const res = new Uint8Array(12 + body)
  res.set(b.subarray(0, 12))
  const riff = 4 + body
  res[4] = riff & 255; res[5] = (riff >> 8) & 255; res[6] = (riff >> 16) & 255; res[7] = (riff >>> 24) & 255
  let o = 12
  for (const x of chunks) { res.set(x, o); o += x.length }
  return res
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || ''

/** The WhatsApp text for someone on the waiting list, in their language. */
export function backInStockMessage(lang: Lang, o: { name: string; piece: string; code: string; link: string }) {
  const f = firstName(o.name)
  if (lang === 'ar') {
    return [`${f ? `مرحباً ${f}،` : 'مرحباً،'} القطعة اللي طلبت نبلغك عنها رجعت متوفرة في سالفورد ✨`, `${o.piece} · ${o.code}`, o.link, 'الكمية محدودة، اطلبها من الرابط أو رد علينا هنا.'].join('\n')
  }
  return [`${f ? `Hello ${f},` : 'Hello,'} good news: the piece you asked about is back at Salford ✨`, `${o.piece} · ${o.code}`, o.link, 'Stock is limited: order from the link or reply here.'].join('\n')
}

/** The customer's own review page for a delivered order (uses the same private link as the tracker). */
export const reviewUrl = (origin: string, lang: Lang, number: string, token: string) => `${origin}/${lang}/review/${number}?t=${token}`

export function askReviewMessage(lang: Lang, o: { name: string; number: string; link: string }) {
  const f = firstName(o.name)
  if (lang === 'ar') return [`${f ? `مرحباً ${f}،` : 'مرحباً،'} نتمنى إن طلبيتك ${o.number} عجبتك 🤍`, 'يسعدنا تكتب لنا رأيك في سالفورد هنا، ما ياخذ إلا دقيقة:', o.link].join('\n')
  return [`${f ? `Hello ${f},` : 'Hello,'} we hope you love your order ${o.number} 🤍`, 'We would be glad if you wrote a short review of Salford here, it takes a minute:', o.link].join('\n')
}

/** Trust page gallery: up to 24 photos with optional captions. Only the shop's own uploads or https links. */
export type GalleryItem = { url: string; cap_ar: string; cap_en: string }
export function parseGallery(raw: unknown): GalleryItem[] {
  let list: unknown = raw
  if (typeof raw === 'string') { try { list = JSON.parse(raw || '[]') } catch { list = [] } }
  if (!Array.isArray(list)) return []
  const s = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n)
  return list.slice(0, 24).map((x) => ({ url: s((x as GalleryItem)?.url, 300), cap_ar: s((x as GalleryItem)?.cap_ar, 120), cap_en: s((x as GalleryItem)?.cap_en, 120) }))
    .filter((x) => /^\/m\/b\/[0-9a-f]{18}-\d{2,4}$/.test(x.url) || /^https:\/\/[^\s"'<>]+$/.test(x.url))
}
