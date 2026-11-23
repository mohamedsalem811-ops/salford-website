import { Hono } from 'hono'
import type { Env } from '../lib/db'

export const media = new Hono<{ Bindings: Env }>()

/** Serves files from R2. Keys are unique, so files are cached for a year. Supports Range (needed for video on iPhone). */
media.get('/*', async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/m\//, ''))
  if (!key || key.includes('..')) return c.notFound()
  const rangeHeader = c.req.header('range')
  let range: R2Range | undefined
  const m = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/)
  if (m && (m[1] || m[2])) {
    if (m[1]) {
      const offset = Number(m[1])
      range = m[2] ? { offset, length: Number(m[2]) - offset + 1 } : { offset }
    } else {
      range = { suffix: Number(m[2]) }
    }
  }
  const obj = await c.env.MEDIA.get(key, range ? { range } : undefined)
  if (!obj) return c.notFound()
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('cache-control', 'public, max-age=31536000, immutable')
  headers.set('accept-ranges', 'bytes')
  headers.set('x-content-type-options', 'nosniff')
  if (range && 'body' in obj) {
    const start = 'offset' in range && range.offset !== undefined ? range.offset : obj.size - (range as { suffix: number }).suffix
    const len = 'length' in range && range.length !== undefined ? range.length : obj.size - start
    headers.set('content-range', `bytes ${start}-${start + len - 1}/${obj.size}`)
    headers.set('content-length', String(len))
    return new Response((obj as R2ObjectBody).body, { status: 206, headers })
  }
  headers.set('content-length', String(obj.size))
  return new Response((obj as R2ObjectBody).body, { headers })
})
