import type { Child } from 'hono/jsx'
import type { Lang } from '../lib/i18n'
import { t } from '../lib/i18n'
import type { Brand, ProductWithMedia } from '../lib/db'
import { fmtLyd, pName } from '../lib/db'
import { firstImage, mediaUrl, srcset } from '../lib/media'
import { waNumber, igHandle } from '../lib/orders'

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
  truck: <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></svg>,
  cash: <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="18" height="11" rx="2" /><circle cx="12" cy="12" r="2.4" /><path d="M6.5 9.5v5M17.5 9.5v5" /></svg>,
  card: <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 9.5h18M6.5 15h4" /></svg>,
  phone: <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2.2" /><path d="M10.5 18h3" /></svg>,
  arrow: <svg class="ico arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>,
  // brand marks, drawn in the current text colour
  wa: <svg class="ico bi" viewBox="0 0 24 24" aria-hidden="true"><path class="bi-o" d="M4 20l1.2-4.1A8.3 8.3 0 1 1 8.1 18.8z" /><path class="bi-f" d="M9.1 7.6c-.2-.4-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3c-.3.3-1 1-1 2.3s1 2.7 1.1 2.9c.1.2 2 3.1 4.9 4.2 2.4.9 2.9.8 3.4.7.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3l-1.9-.9c-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5z" /></svg>,
  ig: <svg class="ico bi" viewBox="0 0 24 24" aria-hidden="true"><rect class="bi-o" x="3.5" y="3.5" width="17" height="17" rx="5" /><circle class="bi-o" cx="12" cy="12" r="4" /><circle class="bi-f" cx="17.1" cy="6.9" r="1.15" /></svg>,
  fb: <svg class="ico bi" viewBox="0 0 24 24" aria-hidden="true"><path class="bi-f" d="M13.4 21v-7.3h2.5l.4-2.9h-2.9V9c0-.8.3-1.4 1.5-1.4h1.5V5.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H8v2.9h2.5V21z" /></svg>,
}
export const Icons = I

/** Brand names may wrap between words, but "& Co." stays together. */
export const bname = (n: string) => n.replace(/ & /g, ' &\u00a0')

/** 2189XXXXXXXX → +218 9X XXX XXXX */
const prettyPhone = (d: string) => (/^218\d{9}$/.test(d) ? `+218 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : `+${d}`)

export function Layout(props: PageMeta & { brands: Brand[]; settings: Record<string, string>; children: Child }) {
  const { lang, path, origin } = props
  const tr = t(lang)
  const other: Lang = lang === 'ar' ? 'en' : 'ar'
  const title = props.title ? `${props.title} | ${tr.siteName}` : `${tr.siteName} · ${tr.tagline}`
  const desc = props.desc ?? tr.tagline
  const url = `${origin}/${lang}${path}`
  const ig = igHandle(props.settings.instagram || '') ? `https://www.instagram.com/${igHandle(props.settings.instagram || '')}/` : ''
  const fb = props.settings.facebook
  const wa = waNumber(props.settings.whatsapp || '')
  const igName = igHandle(props.settings.instagram || '')
  const fbName = (() => { try { const seg = new URL(fb).pathname.split('/').filter(Boolean); return seg.length === 1 && /^[\w.-]{2,50}$/.test(seg[0]) ? seg[0] : '' } catch { return '' } })()
  const st = props.settings
  const pays = [
    st.pay_cod_cash !== '0' ? { i: I.cash, l: tr.payCash } : null,
    st.pay_cod_card !== '0' ? { i: I.card, l: tr.payCard } : null,
    st.pay_lypay !== '0' ? { i: I.phone, l: tr.payLypay } : null,
  ].filter(Boolean) as { i: unknown; l: string }[]
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
              <a href={`/${lang}/shop`} class={`navshop${props.active === 'shop' ? ' on' : ''}`}>{tr.shop}</a>
              {props.brands.map((b) => <a href={`/${lang}/brand/${b.id}`} class="bd">{b.name}</a>)}
            </nav>
            <div class="top-actions">
              <form class="top-search" action={`/${lang}/shop`} method="get" role="search">
                <input type="search" name="q" placeholder={tr.searchShort} aria-label={tr.search} />
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
            <section class="fask" aria-label={tr.contact}>
              <span class="fask-glow" aria-hidden="true" />
              <div class="fask-txt">
                <img class="fask-logo" src="/static/brand/logo-white.webp" alt={tr.siteName} width="600" height="387" loading="lazy" />
                <p class="fask-h">{tr.footAsk}</p>
                <p class="fask-sub">{tr.footAskSub}</p>
              </div>
              <div class="socials">
                {wa ? (
                  <a class="soc wa" href={`https://wa.me/${wa}`} rel="noopener" target="_blank">
                    <span class="soc-i">{I.wa}</span><span class="soc-t"><b>{tr.whatsapp}</b><small dir="ltr">{props.settings.wa_username || prettyPhone(wa)}</small></span>{I.arrow}
                  </a>
                ) : null}
                {ig ? (
                  <a class="soc ig" href={ig} rel="noopener" target="_blank">
                    <span class="soc-i">{I.ig}</span><span class="soc-t"><b>{tr.instagram}</b><small dir="ltr">@{igName}</small></span>{I.arrow}
                  </a>
                ) : null}
                {fb ? (
                  <a class="soc fb" href={fb} rel="noopener" target="_blank">
                    <span class="soc-i">{I.fb}</span><span class="soc-t"><b>{tr.facebook}</b><small dir={fbName ? 'ltr' : undefined}>{fbName || tr.siteName}</small></span>{I.arrow}
                  </a>
                ) : null}
              </div>
            </section>
            <div class="fcols">
              <nav class="fcol" aria-label={tr.shop}>
                <h2>{tr.shop}</h2>
                <a href={`/${lang}/shop`}>{tr.footAll}</a>
                {props.brands.map((b) => <a href={`/${lang}/brand/${b.id}`}><bdi>{b.name}</bdi></a>)}
              </nav>
              <nav class="fcol" aria-label={tr.footHelp}>
                <h2>{tr.footHelp}</h2>
                <a href={`/${lang}/page/about`}>{tr.about}</a>
                <a href={`/${lang}/page/delivery`}>{tr.deliveryReturns}</a>
                <a href={`/${lang}/page/contact`}>{tr.contact}</a>
              </nav>
              <div class="fcol fpay">
                <h2>{tr.footPay}</h2>
                <ul class="paylist">{pays.map((x) => <li>{x.i as never}<span>{x.l}</span></li>)}</ul>
                <p class="fdel">{I.truck}<span>{tr.trustDelivery}</span></p>
              </div>
            </div>
          </div>
          <div class="foot-bot">
            <p class="copy">© {new Date().getFullYear()} {tr.siteName} · {tr.rights}</p>
            <a class="chip" href={`/${other}${path}`} hreflang={other} lang={other}>{tr.langSwitch}</a>
          </div>
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
      <span class={`ph t-${brand?.tint ?? 'swa'}`}><Pic p={p} lang={lang} eager={eager} /><span class={`stk${p.in_stock ? ' on' : ''}`}><i aria-hidden="true" />{p.in_stock ? tr.inStock : tr.outShort}</span></span>
      <span class="bd">{brand?.name}</span>
      <span class="nm">{pName(p, lang)}</span>
      {p.in_stock ? <Price value={p.price} compare={p.compare_price} lang={lang} /> : <span class="soldout">{tr.outOfStock}</span>}
    </a>
  )
}

/** `fit`: hide the extra cards so the last row is full at every width (shows 8 / 9 / 8 / 10 of 10). */
export const Grid = ({ items, lang, brands, eagerFirst, fit }: { items: ProductWithMedia[]; lang: Lang; brands: Brand[]; eagerFirst?: number; fit?: boolean }) => (
  <div class={fit && items.length >= 8 ? 'grid fit' : 'grid'}>{items.map((p, i) => <Card p={p} lang={lang} brands={brands} eager={i < (eagerFirst ?? 0)} />)}</div>
)
