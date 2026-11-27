import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { Env } from './lib/db'
import { safeEqual } from './lib/auth'
import { catalog } from './lib/catalog'
import { assetFor } from './lib/assets'
import { V } from './views/layout'
import { setMediaBase } from './lib/media'
import { store, notFound } from './routes/store'
import { api } from './routes/api'
import { media } from './routes/media'
import { admin } from './routes/admin'

const app = new Hono<{ Bindings: Env }>()

const isPreviewHost = (url: string) => new URL(url).hostname.endsWith('.pages.dev')

/** Security headers on every response; test addresses are never indexed by search engines. */
app.use('*', async (c, next) => {
  setMediaBase(c.env.MEDIA_BASE)
  await next()
  const h = c.res.headers
  h.set('x-content-type-options', 'nosniff')
  if (!h.has('referrer-policy')) h.set('referrer-policy', 'strict-origin-when-cross-origin') // private order and review links keep no-referrer
  h.set('x-frame-options', 'SAMEORIGIN')
  h.set('permissions-policy', 'camera=(), microphone=(), geolocation=()')
  if (!h.has('content-security-policy') && (h.get('content-type') || '').includes('text/html')) {
    h.set(
      'content-security-policy',
      "default-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src https://www.youtube-nocookie.com; base-uri 'self'; form-action 'self'",
    )
  }
  if (isPreviewHost(c.req.url)) h.set('x-robots-tag', 'noindex, nofollow')
})

/** The private test address: requires the key once (?key=...), then remembers it in a cookie. */
app.use('*', async (c, next) => {
  if (!isPreviewHost(c.req.url)) return next()
  const key = c.env.PREVIEW_KEY
  if (!key) return c.text('This test address is locked.', 403)
  const given = new URL(c.req.url).searchParams.get('key')
  if (given && safeEqual(given, key)) {
    setCookie(c, 'sl_preview', key, { path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 60 * 86400 })
    const u = new URL(c.req.url)
    u.searchParams.delete('key')
    return c.redirect(u.pathname + u.search)
  }
  const cookie = getCookie(c, 'sl_preview')
  if (cookie && safeEqual(cookie, key)) return next()
  return c.text('This is a private test address. Open it with the link you were given.', 401)
})

app.get('/robots.txt', (c) =>
  c.text(isPreviewHost(c.req.url) ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nDisallow: /admin\nDisallow: /api\nSitemap: ${new URL(c.req.url).origin}/sitemap.xml\n`),
)

app.get('/sitemap.xml', async (c) => {
  const origin = new URL(c.req.url).origin
  const cat = await catalog(c)
  const results = cat.products.filter((p) => cat.media.get(p.id)?.length)
  const brands = cat.shopBrands
  const paths = ['/', '/shop', '/brands', ...brands.map((b) => `/brand/${b.id}`), '/page/about', '/page/delivery', '/page/trust', '/page/contact']
  const urls = [
    ...paths.flatMap((p) => ['ar', 'en'].map((l) => `<url><loc>${origin}/${l}${p}</loc></url>`)),
    ...results.flatMap((p) => ['ar', 'en'].map((l) => `<url><loc>${origin}/${l}/p/${p.id}</loc><lastmod>${p.updated_at.slice(0, 10)}</lastmod></url>`)),
  ]
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`, 200, { 'content-type': 'application/xml' })
})

app.get('/a/:file', (c) => {
  const f = assetFor(c.req.param('file'), V)
  if (!f) return c.notFound()
  return c.body(f.body, 200, { 'content-type': f.type, 'cache-control': f.immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300' })
})

app.route('/m', media)
app.route('/api', api)
app.route('/admin', admin)
app.route('/', store)

app.notFound(async (c) => {
  const lang = c.req.path.startsWith('/en') ? 'en' : 'ar'
  if (c.req.path.startsWith('/api') || c.req.path.startsWith('/admin/api')) return c.json({ error: 'Not found' }, 404)
  return notFound(c, lang)
})

app.onError((err, c) => {
  console.error(err)
  if (c.req.path.startsWith('/api') || c.req.path.startsWith('/admin/api')) return c.json({ error: 'Server error' }, 500)
  return c.text('Something went wrong. Please try again.', 500)
})

export default app
