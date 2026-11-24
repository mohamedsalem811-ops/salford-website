import type { Child } from 'hono/jsx'
import type { Lang } from '../lib/i18n'
import { t } from '../lib/i18n'
import type { Brand, ProductWithMedia } from '../lib/db'
import { fmtLyd, pName } from '../lib/db'
import { firstImage, mediaUrl, srcset } from '../lib/media'

declare const __BUILD__: string
export const V = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'

export type PageMeta = {
  lang: Lang
  title?: string
  desc?: string
  image?: string
  path: string // path without the /ar or /en prefix, e.g. "/p/12"
  origin: string
  noindex?: boolean
  active?: 'home' | 'shop' | 'brands' | 'cart'
}

const I = {
  search: <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.6-4.6" /></svg>,
  bag: <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8.5h13l-1 11.5h-11z" /><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" /></svg>,
  home: <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-5H9v5H4z" /></svg>,
  grid: <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>,
  gem: <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12l3 5-9 11L3 9z" /><path d="M3 9h18M9 4l3 16M15 4l-3 16" /></svg>,
}
export const Icons = I

export function Layout(props: PageMeta & { brands: Brand[]; settings: Record<string, string>; children: Child }) {
  const { lang, path, origin } = props
  const tr = t(lang)
  const other: Lang = lang === 'ar' ? 'en' : 'ar'
  const title = props.title ? `${props.title} | ${tr.siteName}` : `${tr.siteName} · ${tr.tagline}`
  const desc = props.desc ?? tr.tagline
  const url = `${origin}/${lang}${path}`
  const ig = props.settings.instagram
  const fb = props.settings.facebook
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{title}</title>
        <meta name="description" content={desc} />
        {props.noindex ? <meta name="robots" content="noindex, nofollow" /> : null}
        <link rel="canonical" href={url} />
        <link rel="alternate" hreflang="ar" href={`${origin}/ar${path}`} />
        <link rel="alternate" hreflang="en" href={`${origin}/en${path}`} />
        <link rel="alternate" hreflang="x-default" href={`${origin}/ar${path}`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={tr.siteName} />
        <meta property="og:title" content={props.title ?? tr.siteName} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={props.image ?? `${origin}/static/brand/og.jpg`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#FDF6F7" />
        <link rel="icon" type="image/png" sizes="48x48" href="/static/brand/favicon-48.png" />
        <link rel="apple-touch-icon" href="/static/brand/apple-touch-icon.png" />
        <link rel="manifest" href="/static/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-title" content="Salford" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alexandria:wght@500;600&family=Cormorant+Garamond:wght@600&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" />
        <link rel="stylesheet" href={`/static/site.css?v=${V}`} />
      </head>
      <body data-lang={lang}>
        <a class="skip" href="#main">{lang === 'ar' ? 'تخطَّ إلى المحتوى' : 'Skip to content'}</a>
        <header class="top">
          <div class="top-in">
            <a class="logo" href={`/${lang}/`} aria-label={tr.siteName}>
              <img src="/static/brand/word-mauve.webp" alt={tr.siteName} width="480" height="127" />
            </a>
            <nav class="brandnav" aria-label={tr.brands}>
              {props.brands.map((b) => <a href={`/${lang}/brand/${b.id}`} class="bd">{b.name}</a>)}
            </nav>
            <div class="top-actions">
              <form class="top-search" action={`/${lang}/shop`} method="get" role="search">
                <input type="search" name="q" placeholder={tr.search} aria-label={tr.search} />
                <button type="submit" aria-label={tr.searchBtn}>{I.search}</button>
              </form>
              <a class="iconbtn only-wide" href={`/${lang}/cart`} aria-label={tr.cart}>{I.bag}<span class="badge" data-cart-count hidden>0</span></a>
              <a class="chip lang-switch" href={`/${other}${path}`} hreflang={other} lang={other}>{tr.langSwitch}</a>
            </div>
          </div>
        </header>
        <main id="main">{props.children}</main>
        <footer class="foot">
          <div class="foot-in">
            <div>
              <img class="foot-logo" src="/static/brand/logo-mauve.webp" alt={tr.siteName} width="600" height="387" loading="lazy" />
              <p class="muted">{tr.tagline}</p>
            </div>
            <nav aria-label={tr.shop}>
              <a href={`/${lang}/shop`}>{tr.shop}</a>
              {props.brands.map((b) => <a href={`/${lang}/brand/${b.id}`}>{b.name}</a>)}
            </nav>
            <nav aria-label={tr.contact}>
              <a href={`/${lang}/page/about`}>{tr.about}</a>
              <a href={`/${lang}/page/delivery`}>{tr.deliveryReturns}</a>
              <a href={`/${lang}/page/contact`}>{tr.contact}</a>
              {props.settings.whatsapp ? <a href={`https://wa.me/${props.settings.whatsapp.replace(/\D/g, '')}`} rel="noopener" target="_blank">WhatsApp</a> : null}
              {ig ? <a href={ig} rel="noopener" target="_blank">Instagram</a> : null}
              {fb ? <a href={fb} rel="noopener" target="_blank">Facebook</a> : null}
            </nav>
          </div>
          <p class="copy">© {new Date().getFullYear()} {tr.siteName} · {tr.rights}</p>
        </footer>
        <nav class="tabs" aria-label="Main">
          <a href={`/${lang}/`} class={props.active === 'home' ? 'on' : ''}>{I.home}<span>{tr.home}</span></a>
          <a href={`/${lang}/shop`} class={props.active === 'shop' ? 'on' : ''}>{I.grid}<span>{tr.shop}</span></a>
          <a href={`/${lang}/brands`} class={props.active === 'brands' ? 'on' : ''}>{I.gem}<span>{tr.brands}</span></a>
          <a href={`/${lang}/cart`} class={props.active === 'cart' ? 'on' : ''}>{I.bag}<span>{tr.cart}</span><span class="badge" data-cart-count hidden>0</span></a>
        </nav>
        <div class="toast" role="status" aria-live="polite" hidden></div>
        <script src={`/static/site.js?v=${V}`} defer></script>
      </body>
    </html>
  )
}

export const Price = ({ value, compare, lang }: { value: number; compare?: number | null; lang: Lang }) => (
  <span class="price">
    {fmtLyd(value)} {t(lang).currency}
    {compare && compare > value ? <s>{fmtLyd(compare)}</s> : null}
  </span>
)

export function Pic({ p, lang, w = 400, eager = false }: { p: ProductWithMedia; lang: Lang; w?: number; eager?: boolean }) {
  const m = firstImage(p.media)
  if (!m) return <span class="pic-empty" aria-hidden="true"></span>
  return (
    <img
      class="pimg"
      src={mediaUrl(m, w)}
      srcset={srcset(m)}
      sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 46vw"
      alt={pName(p, lang)}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      width="400"
      height="500"
    />
  )
}

export function Card({ p, lang, brands, eager }: { p: ProductWithMedia; lang: Lang; brands: Brand[]; eager?: boolean }) {
  const tr = t(lang)
  const brand = brands.find((b) => b.id === p.brand_id)
  return (
    <a class={`card${p.in_stock ? '' : ' out'}`} href={`/${lang}/p/${p.id}`}>
      <span class={`ph t-${brand?.tint ?? 'swa'}`}><Pic p={p} lang={lang} eager={eager} /></span>
      <span class="bd">{brand?.name}</span>
      <span class="nm">{pName(p, lang)}</span>
      {p.in_stock ? <Price value={p.price} compare={p.compare_price} lang={lang} /> : <span class="soldout">{tr.outOfStock}</span>}
    </a>
  )
}

export const Grid = ({ items, lang, brands, eagerFirst }: { items: ProductWithMedia[]; lang: Lang; brands: Brand[]; eagerFirst?: number }) => (
  <div class="grid">{items.map((p, i) => <Card p={p} lang={lang} brands={brands} eager={i < (eagerFirst ?? 0)} />)}</div>
)
