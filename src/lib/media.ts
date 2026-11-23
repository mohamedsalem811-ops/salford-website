import type { Media } from './db'

const sizesOf = (m: Media): number[] => {
  try {
    const v = JSON.parse(m.sizes || '[]')
    return Array.isArray(v) ? v.filter((n) => typeof n === 'number').sort((a, b) => a - b) : []
  } catch {
    return []
  }
}

/** Best URL for a media item at a target width. Uploads have sized variants; links use the safe copy if one exists. */
export function mediaUrl(m: Media, width = 900): string {
  if (m.r2_key) {
    const sizes = sizesOf(m)
    if (sizes.length) {
      const pick = sizes.find((s) => s >= width) ?? sizes[sizes.length - 1]
      return `/m/${m.r2_key}-${pick}`
    }
    return `/m/${m.r2_key}`
  }
  return m.url
}

export function srcset(m: Media): string | undefined {
  const sizes = sizesOf(m)
  if (!m.r2_key || !sizes.length) return undefined
  return sizes.map((s) => `/m/${m.r2_key}-${s} ${s}w`).join(', ')
}

export const firstImage = (media: Media[]) => media.find((m) => m.kind === 'image')

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/)
  return m ? m[1] : null
}

/** Absolute URL for share previews. */
export const absUrl = (origin: string, u: string) => (u.startsWith('http') ? u : origin + u)
