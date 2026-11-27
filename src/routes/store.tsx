import { Hono } from 'hono'
import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { currentAdmin } from '../lib/auth'
import type { Env, Brand, ProductWithMedia } from '../lib/db'
import { pName, pShort, pDesc, fmtLyd } from '../lib/db'
import { catalog, listFrom, productFrom, offerNow, teaserNow, earlyOf, attachFlash, FLASH_SQL, EARLY_COOKIE, type Catalog } from '../lib/catalog'
import type { Offer, Flash } from '../lib/pricing'
import { shopPrice, inScope, parseScope, discountable, isEarlyNow, tiersOf } from '../lib/pricing'
import { OfferBanner, TeaserBanner, isoUtc } from '../views/offer'
import { t, isLang, CITIES_AR, type Lang } from '../lib/i18n'
import { Layout, Grid, Price, Pic, Icons, bname, type PageMeta } from '../views/layout'
import { mediaUrl, srcset, youtubeId, firstImage, absUrl } from '../lib/media'
import { loadOrderForCustomer, channelLinks, waNumber, igHandle, sumRows, lineValue, isStatus, STATUS_WORDS, type Status, type OrderEvent } from '../lib/orders'
import { onSwitch, stars, parseGallery, type Review } from '../lib/r3'
import { freeMinOf } from '../lib/checkout'

type C = Context<{ Bindings: Env }>
export const store = new Hono<{ Bindings: Env }>()

const origin = (c: C) => new URL(c.req.url).origin
const noindex = (c: C) => new URL(c.req.url).hostname.endsWith('.pages.dev')

type Base = { brands: Brand[]; settings: Record<string, string>; cat: Catalog; offer: Offer | null; teaser: Offer | null; early: boolean }
async function base(c: C, _lang: Lang): Promise<Base> {
  const cat = await catalog(c)
  // Release 4 early access: the offer's private link (/ar/?early=…) opens it early_hours before everyone else, in this browser only
  let early = earlyOf(c)
  const q = c.req.query('early') ?? ''
  if (/^[0-9a-f]{32}$/.test(q) && cat.offers.some((o) => o.early_token === q)) {
    early = q
    setCookie(c, EARLY_COOKIE, q, { path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 14 * 86400 })
  }
  let offer = offerNow(cat, early)
  let teaser = offer ? null : teaserNow(cat)
  // Admin → Offers → "Preview": shows that offer (even before it starts, or switched off) to a logged-in team member only.
  // ?offer_preview=id shows it running; ?teaser_preview=id shows its "coming soon" look.
  const pv = Number(c.req.query('offer_preview')) || Number(c.req.query('teaser_preview'))
  if (pv && getCookie(c, 'sl_admin') && (await currentAdmin(c))) {
    const db = c.env.DB
    const [o, f] = await db.batch([db.prepare('SELECT * FROM offers WHERE id = ?').bind(pv), db.prepare(`${FLASH_SQL} WHERE f.offer_id = ?`).bind(pv)])
    const row = o.results[0] as Offer | undefined
    if (row) {
      const full = attachFlash([row], f.results as Flash[])[0]
      if (c.req.query('teaser_preview')) { offer = null; teaser = full } else { offer = full; teaser = null }
    }
  }
  return { brands: cat.brands, settings: cat.settings, cat, offer, teaser, early: !!offer && isEarlyNow(offer) }
}

function render(c: C, meta: Omit<PageMeta, 'origin'>, b: Base, body: unknown, status = 200) {
  // header and footer list only brands that have pieces to show
  return c.html(
    <Layout {...meta} origin={origin(c)} noindex={meta.noindex || noindex(c)} brands={b.cat.shopBrands} settings={b.settings} offer={b.offer} teaser={b.teaser} early={b.early}>
      {body as never}
    </Layout>,
    status as 200,
  )
}

/* ---------- language entry ---------- */
store.get('/', (c) => {
  const al = (c.req.header('accept-language') || '').toLowerCase()
  const lang = /^en|,\s*en/.test(al) && !/\bar\b/.test(al.split(',')[0]) ? 'en' : 'ar'
  return c.redirect(`/${lang}/`, 302)
})
store.get('/:lang{(?:ar|en)}', (c) => c.redirect(`/${c.req.param('lang')}/`, 301))

/* ---------- old site links ---------- */
store.get('/:lang{(?:ar|en)}/product/:legacy', async (c) => {
  const legacy = c.req.param('legacy')
  const row = (await catalog(c)).products.find((p) => p.legacy_id === legacy)
  return c.redirect(row ? `/${c.req.param('lang')}/p/${row.id}` : `/${c.req.param('lang')}/shop`, 301)
})
store.get('/:lang{(?:ar|en)}/products', async (c) => {
  const lang = c.req.param('lang')
  const cat = c.req.query('cat')
  const qs = cat ? `?cat=${encodeURIComponent(cat)}` : ''
  // old links like /ar/products?brand=swarovski&cat=rings keep the brand
  const raw = (c.req.query('brand') || '').toLowerCase().trim()
  const brand = ({ 'apm-monaco': 'apm', apmmonaco: 'apm', 'tiffany-co': 'tiffany' } as Record<string, string>)[raw] ?? raw
  if (brand && /^[a-z0-9-]{1,40}$/.test(brand)) {
    const ok = (await catalog(c)).brands.some((x) => x.id === brand)
    if (ok) return c.redirect(`/${lang}/brand/${brand}${qs}`, 301)
  }
  return c.redirect(`/${lang}/shop${qs}`, 301)
})
store.get('/:lang{(?:ar|en)}/sets', (c) => c.redirect(`/${c.req.param('lang')}/shop?cat=sets`, 301))

/* ---------- home ---------- */
/** The photo for a photo-layout offer banner: the chosen product, or the first product the offer covers. */
function photoFor(cat: Catalog, o: Offer) {
  const pick = (id: number) => { const m = cat.media.get(id)?.find((x) => x.kind === 'image'); return m ? mediaUrl(m, 900) : '' }
  if (o.photo_product_id && cat.byId.has(o.photo_product_id)) { const u = pick(o.photo_product_id); if (u) return u }
  const sc = parseScope(o.scope)
  for (const p of cat.products) if (p.in_stock && discountable(p) && inScope(p, sc)) { const u = pick(p.id); if (u) return u }
  return ''
}

type Banner = { image?: string; image_mobile?: string; eyebrow_ar?: string; eyebrow_en?: string; title_ar?: string; title_en?: string; link?: string }

store.get('/:lang{(?:ar|en)}/', async (c) => {
  const lang = c.req.param('lang') as Lang
  const tr = t(lang)
  const b = await base(c, lang)
  const cats = b.cat.shopCats
  const shopBrands = b.cat.shopBrands
  // 10 pieces: the grid shows 8, 9 or 10 of them so every row ends full (2, 3, 4 or 5 per row)
  const fresh = listFrom(b.cat, { flag: 'new', limit: 10 })
  const best = listFrom(b.cat, { flag: 'best', limit: 10 })
  const newest = fresh.length ? fresh : listFrom(b.cat, { limit: 10 })
  const brandPics = shopBrands.map((br) => listFrom(b.cat, { brand: br.id, limit: 1 }))
  const catPics = cats.map((ct) => listFrom(b.cat, { cat: ct.id, limit: 1 }))
  let banners: Banner[] = []
  try { banners = JSON.parse(b.settings.banners || '[]') } catch { banners = [] }
  const offerPhoto = b.offer ? photoFor(b.cat, b.offer) : ''

  return render(c, { lang, path: '/', active: 'home', image: absUrl(origin(c), '/static/brand/og.jpg') }, b, (
    <>
      <section class="wrap">
        <OfferBanner offer={b.offer} lang={lang} photo={offerPhoto} />
        {b.offer ? null : <TeaserBanner offer={b.teaser} lang={lang} />}
        <div class="hero">
          <picture class="hero-pic">
            <source media="(max-width: 639px)" type="image/webp" srcset="/static/brand/hero-m-480.webp 480w, /static/brand/hero-m-864.webp 864w" sizes="100vw" />
            <img src="/static/brand/hero-1210.webp" srcset="/static/brand/hero-700.webp 700w, /static/brand/hero-1210.webp 1210w" sizes="(min-width: 1240px) 700px, 58vw" alt="" width="1210" height="1080" fetchpriority="high" />
          </picture>
          <div class="hero-txt" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <span class="hero-glow" aria-hidden="true" />
            <h1 class="hero-logo"><img src="/static/brand/logo-white.webp" alt={tr.siteName} width="600" height="387" /></h1>
            <p class="hero-line">{tr.tagline}</p>
            <p class="hero-brands bd" data-seps>{shopBrands.map((br, i) => <>{i ? <i class="sep" aria-hidden="true">{'\u00a0· '}</i> : ''}<span>{br.name}</span></>)}</p>
            <div class="hero-btns">
              <a class="btn blush" href={`/${lang}/shop`}>{tr.shopNow}</a>
              <a class="btn halo" href={`/${lang}/brands`}>{tr.brands}</a>
            </div>
            <i class="tw tw1" aria-hidden="true" /><i class="tw tw2" aria-hidden="true" /><i class="tw tw3" aria-hidden="true" />
          </div>
        </div>
        {banners.length ? (
          <div class="banners" data-carousel>
            {banners.map((bn) => (
              <a class="banner has-img" href={/^(\/(?!\/)|https:\/\/)/.test(bn.link || '') ? bn.link : `/${lang}/shop`}>
                <picture>
                  {bn.image_mobile ? <source media="(max-width: 639px)" srcset={bn.image_mobile} /> : null}
                  <img src={bn.image || bn.image_mobile} alt="" loading="lazy" />
                </picture>
                <span class="banner-txt">
                  <span class="bd">{lang === 'ar' ? bn.eyebrow_ar : bn.eyebrow_en}</span>
                  <span class="banner-h">{lang === 'ar' ? bn.title_ar : bn.title_en}</span>
                  <span class="btn sm">{tr.shopNow}</span>
                </span>
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <section class="wrap sec">
        <h2 class="h">{tr.brands}</h2>
        <div class="brands4">
          {shopBrands.map((br, i) => (
            <a class={`bt t-${br.tint}`} href={`/${lang}/brand/${br.id}`}>
              <span class="bd">{bname(br.name)}</span>
              {brandPics[i][0] ? <span class="bt-pic"><Pic p={brandPics[i][0]} lang={lang} /></span> : null}
            </a>
          ))}
        </div>
      </section>

      <section class="wrap sec">
        <h2 class="h">{tr.categories}</h2>
        <div class="cats">
          {cats.map((ct, i) => (
            <a class="cat" href={`/${lang}/shop?cat=${ct.id}`}>
              <span class="cat-pic">{catPics[i][0] ? <Pic p={catPics[i][0]} lang={lang} /> : null}</span>
              <span>{lang === 'ar' ? ct.name_ar : ct.name_en}</span>
            </a>
          ))}
        </div>
      </section>

      <section class="wrap sec">
        <div class="sec-h"><h2 class="h">{tr.newArrivals}</h2><a href={`/${lang}/shop`}>{tr.viewAll}</a></div>
        <Grid items={newest} lang={lang} brands={b.brands} eagerFirst={2} fit offer={b.offer} />
      </section>

      {best.length ? (
        <section class="wrap sec">
          <div class="sec-h"><h2 class="h">{tr.bestSellers}</h2><a href={`/${lang}/shop`}>{tr.viewAll}</a></div>
          <Grid items={best} lang={lang} brands={b.brands} fit offer={b.offer} />
        </section>
      ) : null}

      <section class="wrap sec">
        <div class="trust">
          <div><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.5-3 7.6-7 9.5-4-1.9-7-5-7-9.5V6z" /><path d="M9 12l2 2 4-4" /></svg>{tr.trustOriginal}</div>
          <div><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></svg>{tr.trustBox}</div>
          <div><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></svg>{tr.trustDelivery}</div>
        </div>
      </section>
    </>
  ))
})

/* ---------- brands index ---------- */
store.get('/:lang{(?:ar|en)}/brands', async (c) => {
  const lang = c.req.param('lang') as Lang
  const tr = t(lang)
  const b = await base(c, lang)
  const list = b.cat.shopBrands
  const pics = list.map((br) => listFrom(b.cat, { brand: br.id, limit: 1 }))
  return render(c, { lang, path: '/brands', title: tr.brands, active: 'brands' }, b, (
    <section class="wrap sec">
      <h1 class="h1">{tr.brands}</h1>
      <div class="brands-big">
        {list.map((br, i) => (
          <a class={`bbig t-${br.tint}`} href={`/${lang}/brand/${br.id}`}>
            <span class="bd">{br.name}</span>
            <span class="muted">{lang === 'ar' ? br.story_ar : br.story_en}</span>
            {pics[i][0] ? <span class="bt-pic"><Pic p={pics[i][0]} lang={lang} /></span> : null}
          </a>
        ))}
      </div>
    </section>
  ))
})

/* ---------- listing (shop + brand) ---------- */
async function listing(c: C, lang: Lang, brandId?: string) {
  const tr = t(lang)
  const b = await base(c, lang)
  const u = new URL(c.req.url)
  const cat = u.searchParams.get('cat') || undefined
  const q = (u.searchParams.get('q') || '').slice(0, 60) || undefined
  const sort = u.searchParams.get('sort') || 'new'
  const brandQ = brandId ?? (u.searchParams.get('brand') || undefined)
  const brand = brandQ ? b.brands.find((x) => x.id === brandQ) : undefined
  if (brandId && !brand) return notFound(c, lang)
  // only categories with pieces, plus the one asked for (so an old link still shows which is picked)
  const cats = b.cat.cats.filter((x) => x.id === cat || b.cat.shopCats.some((y) => y.id === x.id))
  const items = listFrom(b.cat, { brand: brand?.id, cat, q, sort })
  const soon = !!brand && !b.cat.shopBrands.some((x) => x.id === brand.id)
  const wa = waNumber(b.settings.whatsapp || '')
  const ig = igHandle(b.settings.instagram || '')
  const basePath = brandId ? `/brand/${brandId}` : '/shop'
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { brand: brandId ? undefined : brand?.id, cat, q, sort: sort === 'new' ? undefined : sort, ...over }
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v)
    const s = p.toString()
    return `/${lang}${basePath}${s ? `?${s}` : ''}`
  }
  const title = q ? `“${q}”` : brand ? brand.name : cat ? (lang === 'ar' ? cats.find((x) => x.id === cat)?.name_ar : cats.find((x) => x.id === cat)?.name_en) ?? tr.shop : tr.shop
  return render(c, { lang, path: basePath, title, active: brandId ? 'brands' : 'shop', desc: brand ? (lang === 'ar' ? brand.story_ar : brand.story_en) : undefined }, b, (
    <>
      {brand ? (
        <section class={`brand-head t-${brand.tint}`}>
          <div class="wrap"><h1 class="bd big">{brand.name}</h1><p>{lang === 'ar' ? brand.story_ar : brand.story_en}</p></div>
        </section>
      ) : (
        <section class="wrap"><h1 class="h1">{title}</h1></section>
      )}
      {soon ? (
        <section class="wrap narrow sec soon">
          <span class="soon-ico" aria-hidden="true">{Icons.gem}</span>
          <h2 class="h">{tr.comingSoon}</h2>
          <p class="muted">{tr.comingSoonSub}</p>
          <div class="soon-btns">
            {wa ? <a class="btn" href={`https://wa.me/${wa}`} rel="noopener" target="_blank">{Icons.wa}{tr.whatsapp}</a> : null}
            {ig ? <a class="btn ghost" href={`https://www.instagram.com/${ig}/`} rel="noopener" target="_blank">{Icons.ig}{tr.instagram}</a> : null}
          </div>
          <a class="btn ghost" href={`/${lang}/shop`}>{tr.footAll}</a>
        </section>
      ) : (
      <section class="wrap">
        <form class="shop-search" action={`/${lang}${basePath}`} method="get" role="search">
          <input type="search" name="q" value={q ?? ''} placeholder={tr.search} aria-label={tr.search} />
          {cat ? <input type="hidden" name="cat" value={cat} /> : null}
          <button class="btn sm" type="submit">{tr.searchBtn}</button>
        </form>
        {!brandId ? (
          <div class="chips" aria-label={tr.brands}>
            <a class={`chip${!brand ? ' on' : ''}`} href={qs({ brand: undefined })}>{tr.all}</a>
            {b.cat.shopBrands.map((br) => <a class={`chip bdchip${brand?.id === br.id ? ' on' : ''}`} href={qs({ brand: br.id })}>{br.name}</a>)}
          </div>
        ) : null}
        <div class="chips" aria-label={tr.categories}>
          <a class={`chip${!cat ? ' on' : ''}`} href={qs({ cat: undefined })}>{tr.all}</a>
          {cats.map((ct) => <a class={`chip${cat === ct.id ? ' on' : ''}`} href={qs({ cat: ct.id })}>{lang === 'ar' ? ct.name_ar : ct.name_en}</a>)}
        </div>
        <div class="fbar">
          <span class="muted">{tr.nProducts(items.length)}</span>
          <label class="sortsel">
            <span class="vh">{tr.sort}</span>
            <select data-nav aria-label={tr.sort}>
              <option value={qs({ sort: undefined })} selected={sort === 'new'}>{tr.sortNew}</option>
              <option value={qs({ sort: 'low' })} selected={sort === 'low'}>{tr.sortLow}</option>
              <option value={qs({ sort: 'high' })} selected={sort === 'high'}>{tr.sortHigh}</option>
            </select>
          </label>
        </div>
        {items.length ? <Grid items={items} lang={lang} brands={b.brands} eagerFirst={4} offer={b.offer} /> : <p class="empty">{tr.noResults}</p>}
      </section>
      )}
    </>
  ))
}

store.get('/:lang{(?:ar|en)}/shop', (c) => listing(c, c.req.param('lang') as Lang))
store.get('/:lang{(?:ar|en)}/brand/:id', (c) => listing(c, c.req.param('lang') as Lang, c.req.param('id')))

/* ---------- product ---------- */
function Gallery({ p, lang }: { p: ProductWithMedia; lang: Lang }) {
  const tr = t(lang)
  const name = pName(p, lang)
  const media = p.media
  return (
    <div class="gallery">
      <div class="g-track" data-gallery tabindex={0} aria-label={name}>
        {media.map((m, i) => {
          if (m.kind === 'video') {
            return (
              <div class="g-item">
                <video src={mediaUrl(m)} muted playsinline loop preload="metadata" controls data-autoplay aria-label={`${tr.video} ${i + 1}`}></video>
              </div>
            )
          }
          if (m.kind === 'youtube') {
            const id = youtubeId(m.url)
            return id ? (
              <div class="g-item">
                <button class="yt" type="button" data-yt={id} aria-label={`${tr.video} YouTube`}>
                  <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
                  <span class="play" aria-hidden="true">▶</span>
                </button>
              </div>
            ) : null
          }
          return (
            <div class="g-item">
              <img class="pimg" src={mediaUrl(m, 900)} srcset={srcset(m)} sizes="(min-width: 900px) 50vw, 100vw" alt={`${name} ${i + 1}`} loading={i ? 'lazy' : 'eager'} decoding="async" data-zoom={mediaUrl(m, 1800)} width="800" height="1000" />
            </div>
          )
        })}
      </div>
      {media.length > 1 ? (
        <div class="g-thumbs" role="tablist">
          {media.map((m, i) => (
            <button type="button" class={`g-thumb${i ? '' : ' on'}`} data-goto={i} aria-label={`${i + 1} ${tr.of} ${media.length}`}>
              {m.kind === 'image' ? <img src={mediaUrl(m, 400)} alt="" loading="lazy" /> : <span>▶</span>}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ---------- Release 3: waiting list, reviews, delivery line ---------- */
const rvDate = { ar: new Intl.DateTimeFormat('ar-LY-u-nu-latn', { month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }), en: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }) }
const monthOf = (utc: string, lang: Lang) => { const d = new Date(utc.replace(' ', 'T') + 'Z'); return Number.isNaN(d.getTime()) ? '' : rvDate[lang].format(d) }

/** The product page's delivery line: prices by area (and free from an amount) when delivery prices are on. */
function delLine(b: Base, lang: Lang) {
  const tr = t(lang)
  if (b.settings.delivery_on !== '1') return tr.delSub
  const min = freeMinOf(b.settings)
  return tr.delSubOn(min ? fmtLyd(min) : '')
}

function Stars({ n, lang }: { n: number; lang: Lang }) {
  const full = Math.round(n)
  return <span class="stars" role="img" aria-label={t(lang).rvStar(full)}>{[1, 2, 3, 4, 5].map((i) => <span class={i <= full ? 'on' : ''}>★</span>)}</span>
}

function ReviewList({ list, lang, products }: { list: Review[]; lang: Lang; products?: Catalog }) {
  const tr = t(lang)
  if (!list.length) return null
  return (
    <ul class="rv-list">
      {list.map((r) => {
        const p = products && r.product_id ? products.byId.get(r.product_id) : undefined
        return (
          <li class="rv">
            <div class="rv-top"><Stars n={r.rating} lang={lang} />{r.verified ? <span class="rv-ver">✓ {tr.rvVerified}</span> : null}</div>
            {r.text ? <p class="rv-text" dir="auto">{r.text}</p> : null}
            {r.photo_key ? <a class="rv-ph" href={`/api/review-photo/${r.id}`} target="_blank" rel="noopener"><img src={`/api/review-photo/${r.id}`} alt="" loading="lazy" /></a> : null}
            <p class="rv-by"><bdi>{r.name}</bdi>{r.city ? <> · <bdi>{r.city}</bdi></> : null} · <span>{monthOf(r.created_at, lang)}</span>{p ? <> · <a href={`/${lang}/p/${p.id}`}>{pName(p, lang)}</a></> : null}</p>
          </li>
        )
      })}
    </ul>
  )
}

/** The review form; `order` = the customer's own order link (verified, pick the piece). */
function ReviewForm({ lang, productId, order }: { lang: Lang; productId?: number; order?: { number: string; token: string; name: string; city: string; items: { id: number; name: string }[]; shopOk: boolean } }) {
  const tr = t(lang)
  return (
    <form class="form rv-form" data-review-form novalidate>
      {productId ? <input type="hidden" name="product_id" value={String(productId)} /> : null}
      {order ? <><input type="hidden" name="number" value={order.number} /><input type="hidden" name="token" value={order.token} /></> : null}
      <input type="hidden" name="lang" value={lang} />
      {order ? (
        <label class="field"><span>{tr.rvPiece}</span>
          <select name="product_id">
            {order.items.map((i) => <option value={String(i.id)}>{i.name}</option>)}
            {order.shopOk ? <option value="">{tr.rvShop}</option> : null}
          </select>
        </label>
      ) : null}
      <fieldset class="field rv-rate" data-field="rating">
        <legend>{tr.rvRating}</legend>
        <span class="rate-in" dir="ltr">
          {[5, 4, 3, 2, 1].map((n) => <><input type="radio" name="rating" value={String(n)} id={`rt${n}`} /><label for={`rt${n}`} title={tr.rvStar(n)}><span class="vh">{tr.rvStar(n)}</span>★</label></>)}
        </span>
        
      </fieldset>
      <label class="field" data-field="name"><span>{tr.rvName}</span><input name="name" maxlength={60} autocomplete="name" value={order?.name ?? ''} required /></label>
      <label class="field"><span>{tr.rvCity}</span><input name="city" maxlength={60} value={order?.city ?? ''} /></label>
      <label class="field"><span>{tr.rvText}</span><textarea name="text" rows={4} maxlength={800} dir="auto"></textarea></label>
      <label class="field" data-field="photo"><span>{tr.rvPhoto}</span><input type="file" name="photo" accept="image/*" /><small class="muted">{tr.rvPhotoNote}</small></label>
      {order ? null : <label class="field"><span>{tr.rvPhone}</span><input name="phone" type="tel" inputmode="tel" maxlength={20} autocomplete="tel" dir="ltr" /><small class="muted">{tr.rvPhoneNote}</small></label>}
      <input class="vh" name="website" tabindex={-1} autocomplete="off" aria-hidden="true" />
      <p class="form-err" data-form-err hidden></p>
      <button class="btn" type="submit">{tr.rvSend}</button>
      <p class="rv-ok" data-ok hidden>{tr.rvOk}</p>
    </form>
  )
}

/** Release 4 notes on the product page: spend-more levels and the free gift of the live offer. */
function OfferExtras({ b, lang, p, flash }: { b: Base; lang: Lang; p: ProductWithMedia; flash: boolean }) {
  const o = b.offer
  if (!o || !p.in_stock) return null
  const tr = t(lang)
  const tiers = o.kind === 'tiers' && !flash && discountable(p) && inScope(p, parseScope(o.scope)) ? tiersOf(o) : []
  const gift = o.gift_product_id && o.gift_min ? b.cat.byId.get(o.gift_product_id) : undefined
  if (!tiers.length && !(gift && gift.in_stock)) return null
  return (
    <div class="oextras">
      {tiers.length ? <p class="freehint">{tr.tierNote(tiers.map((x) => tr.tierLevel(x.pct, fmtLyd(x.min))).join(' · '))}</p> : null}
      {gift && gift.in_stock ? <p class="freehint">🎁 {tr.giftNote(pName(gift, lang), fmtLyd(o.gift_min!))}</p> : null}
    </div>
  )
}

function WaitForm({ lang, id }: { lang: Lang; id: number }) {
  const tr = t(lang)
  return (
    <form class="form wl" data-waitlist={String(id)} novalidate>
      <p class="wl-h"><b>{tr.wlT}</b><span>{tr.wlS}</span></p>
      <div class="wl-row">
        <label class="field" data-field="name"><span>{tr.wlName}</span><input name="name" maxlength={60} autocomplete="name" required /></label>
        <label class="field" data-field="phone"><span>{tr.wlPhone}</span><input name="phone" type="tel" inputmode="tel" maxlength={20} autocomplete="tel" dir="ltr" placeholder="09XXXXXXXX" required /></label>
      </div>
      <input class="vh" name="website" tabindex={-1} autocomplete="off" aria-hidden="true" />
      <p class="form-err" data-form-err hidden></p>
      <button class="btn ghost wide" type="submit">{tr.wlBtn}</button>
      <small class="muted">{tr.wlNote}</small>
      <p class="rv-ok" data-ok hidden>{tr.wlOk}</p>
    </form>
  )
}

store.get('/:lang{(?:ar|en)}/p/:id{[0-9]+}', async (c) => {
  const lang = c.req.param('lang') as Lang
  const tr = t(lang)
  const b = await base(c, lang)
  const p = productFrom(b.cat, Number(c.req.param('id')))
  if (!p || !p.media.length) return notFound(c, lang)
  const brand = b.brands.find((x) => x.id === p.brand_id)
  const name = pName(p, lang)
  const img = firstImage(p.media)
  let similar = listFrom(b.cat, { brand: p.brand_id, cat: p.category_id, exclude: p.id, limit: 10 })
  if (similar.length < 4) similar = similar.concat(listFrom(b.cat, { cat: p.category_id, exclude: p.id, limit: 10 })).filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).slice(0, 10)
  let setParts: { id: number; code: string; name_en: string; name_ar: string }[] = []
  const codes: string[] = (() => { try { return JSON.parse(p.set_codes || '[]') } catch { return [] } })()
  if (p.is_set && codes.length) {
    setParts = b.cat.products.filter((x) => !x.is_set && codes.includes(x.code)).map((x) => ({ id: x.id, code: x.code, name_en: x.name_en, name_ar: x.name_ar }))
  }
  const desc = pDesc(p, lang)
  const sp = shopPrice(p, b.offer)
  const rvOn = onSwitch(b.settings, 'reviews_on')
  const rv = rvOn ? (b.cat.reviewsBy.get(p.id) ?? []) : []
  const st = stars(rv)
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name, sku: p.code,
    ...(st.n ? {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: st.avg, reviewCount: st.n, bestRating: 5, worstRating: 1 },
      review: rv.slice(0, 5).map((r) => ({ '@type': 'Review', author: { '@type': 'Person', name: r.name }, datePublished: r.created_at.slice(0, 10), reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 }, ...(r.text ? { reviewBody: r.text } : {}) })),
    } : {}),
    brand: { '@type': 'Brand', name: brand?.name },
    image: img ? absUrl(origin(c), mediaUrl(img, 900)) : undefined,
    description: pShort(p, lang) || desc.slice(0, 200),
    offers: {
      '@type': 'Offer', priceCurrency: 'LYD', price: (sp.price / 1000).toString(),
      ...(sp.pct && b.offer?.ends_at ? { priceValidUntil: isoUtc(b.offer.ends_at).slice(0, 10) } : {}),
      availability: p.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  }
  return render(c, { lang, path: `/p/${p.id}`, title: `${name} · ${brand?.name ?? ''}`, desc: `${brand?.name ?? ''} · ${fmtLyd(sp.price)} ${tr.currency} · ${pShort(p, lang)}`, image: ld.image }, b, (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <article class="wrap product">
        <Gallery p={p} lang={lang} />
        <div class="pinfo">
          <a class="bd" href={`/${lang}/brand/${p.brand_id}`}>{brand?.name}</a>
          <h1 class="pname">{name}</h1>
          <div class="prow">
            <Price value={sp.price} compare={sp.was} lang={lang} sale={!!sp.pct} />
            {sp.pct && p.in_stock ? <span class="ochip" dir="ltr">{sp.flash ? `${tr.flashTag} −${sp.pct}%` : `−${sp.pct}%`}</span> : null}
            <span class={p.in_stock ? 'instock' : 'nostock'}>{p.in_stock ? tr.inStock : tr.outOfStock}</span>
          </div>
          {p.in_stock && sp.flash && sp.flash.left !== null ? <p class="fleft big">{tr.flashLeft(sp.flash.left)}</p> : null}
          <OfferExtras b={b} lang={lang} p={p} flash={!!sp.flash} />
          <div class="buybar" data-buybar>
            {p.in_stock ? (
              <button class="btn wide" type="button" data-add={p.id}>{Icons.bag}{tr.addToCart}</button>
            ) : <button class="btn wide" type="button" disabled>{tr.soldOut}</button>}
          </div>
          {!p.in_stock && onSwitch(b.settings, 'waitlist_on') ? <WaitForm lang={lang} id={p.id} /> : null}
          <p class="code">{tr.code} <bdi>{p.code}</bdi></p>
          <div class="info-row">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></svg>
            <span><b>{tr.boxTitle(`\u2068${brand?.name ?? ''}\u2069`)}</b>{tr.boxSub}</span>
          </div>
          <div class="info-row">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></svg>
            <span><b>{tr.delTitle}</b>{delLine(b, lang)} <a href={`/${lang}/page/delivery`}>{tr.delPrices}</a></span>
          </div>
          <div class="info-row">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
            <span><b>{tr.trustLineT}</b>{tr.trustLineS} <a href={`/${lang}/page/trust`}>{tr.trustMore}</a></span>
          </div>
          {setParts.length ? (
            <div class="setbox"><b>{tr.setIncludes}</b><ul>{setParts.map((s) => <li><a href={`/${lang}/p/${s.id}`}>{s.name_en || s.name_ar}</a> <bdi class="muted">{s.code}</bdi></li>)}</ul></div>
          ) : null}
          {pShort(p, lang) ? <p class="short" dir="auto">{pShort(p, lang)}</p> : null}
          {desc ? <div class="desc" dir="auto">{desc.split('\n').map((l) => (l.trim() ? <p>{l}</p> : null))}</div> : null}
          {waNumber(b.settings.whatsapp || '') ? (
            <a class="askwa" href={`https://wa.me/${waNumber(b.settings.whatsapp || '')}?text=${encodeURIComponent(tr.askMsg(`${brand?.name ?? ''} ${name}`.trim(), p.code, `${origin(c)}/${lang}/p/${p.id}`))}`} target="_blank" rel="noopener">
              {Icons.wa}
              {tr.askWa}
            </a>
          ) : null}
        </div>
      </article>
      {p.in_stock ? (
        /* phones and iPads: a small bar that comes up once the main button has scrolled away */
        <div class="fbuy" data-fbuy aria-hidden="true">
          <span class="fbuy-txt"><span class="fbuy-nm">{name}</span><Price value={sp.price} compare={sp.was} lang={lang} sale={!!sp.pct} /></span>
          <button class="btn" type="button" data-add={p.id} tabindex={-1}>{Icons.bag}{tr.addToCart}</button>
        </div>
      ) : null}
      {rvOn ? (
        <section class="wrap sec reviews" id="reviews">
          <h2 class="h">{tr.rvH}</h2>
          {rv.length ? <p class="rv-sum"><Stars n={st.avg} lang={lang} /> <b dir="ltr">{st.avg.toFixed(1)}</b> <span class="muted">· {tr.rvCount(st.n)}</span></p> : <p class="muted">{tr.rvNone}</p>}
          <ReviewList list={rv.slice(0, 20)} lang={lang} />
          <details class="rv-write">
            <summary class="btn ghost">{tr.rvWrite}</summary>
            <ReviewForm lang={lang} productId={p.id} />
          </details>
        </section>
      ) : null}
      {similar.length ? (
        <section class="wrap sec">
          <h2 class="h">{tr.similar}</h2>
          <Grid items={similar} lang={lang} brands={b.brands} fit offer={b.offer} />
        </section>
      ) : null}
    </>
  ))
})

/* ---------- cart / checkout / order ---------- */
/* ---------- Release 4: "coming soon" page with Remind me ---------- */
store.get('/:lang{(?:ar|en)}/offer', async (c) => {
  const lang = c.req.param('lang') as Lang
  const tr = t(lang)
  const b = await base(c, lang)
  if (b.offer) return c.redirect(`/${lang}/shop`, 302)
  const o = b.teaser
  if (!o) return c.redirect(`/${lang}/`, 302)
  return render(c, { lang, path: '/offer', title: `${tr.soon} · ${tr.siteName}`, noindex: true }, b, (
    <section class="wrap tpage">
      <TeaserBanner offer={o} lang={lang} page />
      <form class="form tform" data-remind={String(o.id)} novalidate>
        <p class="wl-h"><b>{tr.remindT}</b><span>{tr.remindS}</span></p>
        <div class="wl-row">
          <label class="field" data-field="name"><span>{tr.wlName}</span><input name="name" maxlength={60} autocomplete="name" required /></label>
          <label class="field" data-field="phone"><span>{tr.wlPhone}</span><input name="phone" type="tel" inputmode="tel" maxlength={20} autocomplete="tel" dir="ltr" placeholder="09XXXXXXXX" required /></label>
        </div>
        <input class="vh" name="website" tabindex={-1} autocomplete="off" aria-hidden="true" />
        <p class="form-err" data-form-err hidden data-gone={tr.remindGone}></p>
        <button class="btn wide" type="submit">{tr.remindBtn}</button>
        <small class="muted">{tr.remindNote}</small>
        <p class="rv-ok" data-ok hidden>{tr.remindOk}</p>
      </form>
      <a class="btn ghost wide" href={`/${lang}/shop`}>{tr.keepShopping}</a>
    </section>
  ))
})

store.get('/:lang{(?:ar|en)}/cart', async (c) => {
  const lang = c.req.param('lang') as Lang
  const tr = t(lang)
  const b = await base(c, lang)
  return render(c, { lang, path: '/cart', title: tr.cartTitle, active: 'cart' }, b, (
    <section class="wrap narrow">
      <h1 class="h1">{tr.cartTitle}</h1>
      <div id="cart" data-cart-page aria-live="polite"><p class="muted">…</p></div>
    </section>
  ))
})

store.get('/:lang{(?:ar|en)}/checkout', async (c) => {
  const lang = c.req.param('lang') as Lang
  const tr = t(lang)
  const b = await base(c, lang)
  const s = b.settings
  const pays = [
    s.pay_cod_cash !== '0' ? { v: 'cod_cash', l: tr.payCash } : null,
    s.pay_cod_card !== '0' ? { v: 'cod_card', l: tr.payCard } : null,
    s.pay_lypay !== '0' ? { v: 'lypay', l: tr.payLypay, n: tr.payLypayNote } : null,
  ].filter(Boolean) as { v: string; l: string; n?: string }[]
  const ok = channelLinks(s, '')
  const channels = [
    ok.whatsapp ? { v: 'whatsapp', l: tr.whatsapp, n: tr.ready } : null,
    ok.messenger ? { v: 'messenger', l: tr.messenger, n: tr.ready } : null,
    ok.instagram ? { v: 'instagram', l: tr.instagram, n: tr.igHint } : null,
  ].filter(Boolean) as { v: string; l: string; n: string }[]
  const delOn = s.delivery_on === '1'
  const nm = (x: { name_ar: string; name_en: string }) => (lang === 'ar' ? x.name_ar || x.name_en : x.name_en || x.name_ar)
  const areas = b.cat.areas.filter((a) => b.cat.cities.some((x) => x.id === a.city_id))
  const cities = b.cat.cities.filter((x) => areas.some((a) => a.city_id === x.id))
  return render(c, { lang, path: '/checkout', title: tr.checkout, active: 'cart' }, b, (
    <section class="wrap narrow">
      <h1 class="h1">{tr.checkout}</h1>
      <form id="checkout" class="form" novalidate data-checkout>
        <div id="co-summary" class="sum" aria-live="polite"></div>
        {b.cat.hasCodes ? (
          <div class="codebox" data-codebox>
            <label class="field"><span>{tr.codeLabel}</span>
              <span class="coderow"><input name="code" placeholder={tr.codePh} autocomplete="off" autocapitalize="characters" spellcheck={false} maxlength={30} dir="ltr" /><button class="btn sm ghost" type="button" data-code-apply>{tr.codeApply}</button></span>
            </label>
            <p class="code-msg" data-code-msg aria-live="polite" hidden></p>
          </div>
        ) : null}
        <label class="field"><span>{tr.name}</span><input name="name" required autocomplete="name" maxlength={80} /></label>
        <label class="field"><span>{tr.phone}</span><input name="phone" required type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="09X XXX XXXX" maxlength={20} /></label>
        {delOn ? (
          <>
            <label class="field"><span>{tr.pickCity}</span>
              <select name="city_id" required data-city>
                <option value="">{tr.pickCityPh}</option>
                {cities.map((x) => <option value={x.id}>{nm(x)}</option>)}
                <option value="other">{tr.cityNotListed}</option>
              </select>
            </label>
            <label class="field" data-area-wrap hidden><span>{tr.pickArea}</span><select name="area_id" data-area></select></label>
            <label class="field" data-city-other hidden><span>{tr.otherPlace}</span><input name="city" placeholder={tr.cityPh} autocomplete="address-level2" maxlength={60} /><small class="muted">{tr.otherPlaceNote}</small></label>
            <script type="application/json" id="areas-data" dangerouslySetInnerHTML={{ __html: JSON.stringify({ areas: areas.map((a) => ({ id: a.id, c: a.city_id, n: nm(a), one: a.name_en === 'All areas' })), ph: tr.pickAreaPh, other: tr.areaNotListed }).replace(/</g, '\\u003c') }} />
          </>
        ) : (
          <>
            <label class="field"><span>{tr.city}</span><input name="city" required list="cities" placeholder={tr.cityPh} autocomplete="address-level2" maxlength={60} /></label>
            <datalist id="cities">{CITIES_AR.map((x) => <option value={x} />)}</datalist>
          </>
        )}
        <label class="field"><span>{tr.address}</span><input name="address" placeholder={tr.addressPh} autocomplete="street-address" maxlength={200} /></label>
        <label class="field"><span>{tr.note}</span><input name="note" placeholder={tr.notePh} maxlength={200} /></label>
        {/* left empty by people; filled by spam robots */}
        <input class="vh" name="website" tabindex={-1} autocomplete="off" aria-hidden="true" />
        <fieldset class="pay">
          <legend>{tr.payment}</legend>
          {pays.map((p, i) => (
            <label class="payopt"><input type="radio" name="payment" value={p.v} checked={i === 0} /><span>{p.l}</span>{p.n ? <small>{p.n}</small> : null}</label>
          ))}
        </fieldset>
        {delOn ? <p class="muted small delcash">{Icons.truck}<span>{tr.delCash}</span></p> : null}
        <p class="form-err" role="alert" hidden></p>
        <h2 class="h">{tr.sendVia}</h2>
        {channels.length ? (
          <div class="sends">
            {channels.map((ch) => (
              <button class={`send ${ch.v}`} type="submit" name="channel" value={ch.v}>
                <span>{ch.l}</span><small>{ch.n}</small>
              </button>
            ))}
          </div>
        ) : <p class="muted">{tr.noChannels}</p>}
      </form>
    </section>
  ))
})

store.get('/:lang{(?:ar|en)}/order/:num', async (c) => {
  const lang = c.req.param('lang') as Lang
  const tr = t(lang)
  const num = c.req.param('num')
  const [b, v] = await Promise.all([base(c, lang), loadOrderForCustomer(c.env.DB, num, c.req.query('t') ?? '', new URL(c.req.url).origin)])
  c.header('cache-control', 'private, no-store')
  c.header('referrer-policy', 'no-referrer') // the link carries the customer's private token
  const meta = { lang, path: '/cart', title: tr.orderMissing, noindex: true, active: 'cart' as const }
  if (!v) {
    const wa = waNumber(b.settings.whatsapp || '')
    return render(c, meta, b, (
      <section class="wrap narrow done">
        <h1 class="h1">{tr.orderMissing}</h1>
        <p class="muted">{tr.orderMissingHelp}</p>
        <div class="sends">
          {wa ? <a class="send whatsapp" href={`https://wa.me/${wa}`} rel="noopener" target="_blank"><span>{tr.whatsapp}</span></a> : null}
          {igHandle(b.settings.instagram || '') ? <a class="send instagram" href={`https://www.instagram.com/${igHandle(b.settings.instagram || '')}/`} rel="noopener" target="_blank"><span>{tr.instagram}</span></a> : null}
        </div>
        <a class="btn ghost wide" href={`/${lang}/`}>{tr.keepShopping}</a>
      </section>
    ), 404)
  }
  const links = channelLinks(b.settings, v.message)
  const ch = (['whatsapp', 'messenger', 'instagram'] as const).find((x) => x === v.order.channel && links[x]) ?? (links.whatsapp ? 'whatsapp' : links.messenger ? 'messenger' : 'instagram')
  const copyFirst = ch !== 'whatsapp' // Instagram never fills the message in; Messenger not always
  const hint = ch === 'instagram' ? tr.hintIg : ch === 'messenger' ? tr.hintMs : tr.firstWa
  const label = ch === 'instagram' ? tr.openIg : ch === 'messenger' ? tr.openMs : tr.sendWa
  const cur = lang === 'ar' ? 'د.ل' : 'LYD'
  const status = isStatus(v.order.status) ? v.order.status : 'new'
  const wa = waNumber(b.settings.whatsapp || '')
  // the browser tab says what the page says: "ready" only for a new order, then the status
  meta.title = status === 'new' ? tr.orderReady : tr.stTitle[status]
  return render(c, meta, b, (
    <section class="wrap narrow done" data-order-page={num} data-copy-first={copyFirst ? '1' : undefined}>
      {status === 'new' ? (
        <>
          <span class="ok-ico" aria-hidden="true">✓</span>
          <h1 class="h1">{tr.orderReady}</h1>
          <p class="onum"><span class="muted">{tr.orderNumber}</span> <bdi>{num}</bdi></p>
          <p class="muted" data-order-hint data-opened-hint={ch === 'whatsapp' ? tr.hintWa : undefined}>{hint}</p>
          <div class="sends">
            <a class={`send ${ch}`} href={links[ch]} target="_blank" rel="noopener" data-open data-opened-label={ch === 'whatsapp' ? tr.openWa : undefined}><span>{label}</span></a>
            <button class="btn ghost wide" type="button" data-copy>{tr.copyMsg}</button>
            <textarea class="vh" readonly aria-hidden="true" tabindex={-1} data-msg>{v.message}</textarea>
          </div>
        </>
      ) : (
        <>
          <span class={`ok-ico st-${status}`} aria-hidden="true">{status === 'cancelled' ? '×' : status === 'out' ? Icons.truck : '✓'}</span>
          <h1 class="h1">{tr.stTitle[status]}</h1>
          <p class="onum"><span class="muted">{tr.orderNumber}</span> <bdi>{num}</bdi></p>
          <p class="muted">{tr.stHelp[status]}</p>
          {wa ? <div class="sends"><a class="send whatsapp" href={`https://wa.me/${wa}?text=${encodeURIComponent(`${lang === 'ar' ? 'بخصوص طلبيتي' : 'About my order'} ${num}`)}`} target="_blank" rel="noopener"><span>{tr.msgUs}</span></a></div> : null}
        </>
      )}
      <h2 class="h track-h">{tr.trackH}</h2>
      <Tracker lang={lang} status={status} events={v.events} />
      <p class="muted small">{tr.trackKeep}</p>
      <h2 class="h">{tr.yourOrder}</h2>
      <div class="sum">
        {v.info.lines.map((l) => (
          <div class={Number(l.is_gift) ? 'r-gift' : undefined}><span><bdi>{Number(l.is_gift) ? '🎁 ' : ''}{l.brand} · {l.name}</bdi>{l.qty > 1 ? ` × ${l.qty}` : ''}</span><span>{lineValue(l, lang, !!v.info.sum)}</span></div>
        ))}
        {sumRows(v.info).map((r) => <div class={`r-${r.kind}`}><span>{r.label}</span><span>{r.value}</span></div>)}
        <div class="tot"><span>{tr.total}</span><span>{fmtLyd(v.info.total)} {cur}</span></div>
      </div>
      <a class="btn ghost wide" href={`/${lang}/`}>{tr.keepShopping}</a>
    </section>
  ))
})

/** The customer's timeline: received → confirmed → out for delivery → delivered (or received → cancelled), with Libya times. */
function Tracker({ lang, status, events }: { lang: Lang; status: Status; events: OrderEvent[] }) {
  const tr = t(lang)
  const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LY-u-nu-latn' : 'en-GB', { timeZone: 'Africa/Tripoli', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  const at = (st: string) => {
    const e = [...events].reverse().find((x) => x.status === st)
    if (!e) return ''
    const d = new Date(e.at.replace(' ', 'T') + 'Z')
    return Number.isNaN(d.getTime()) ? '' : fmt.format(d)
  }
  const flow: Status[] = status === 'cancelled' ? ['new', 'cancelled'] : ['new', 'confirmed', 'out', 'delivered']
  const now = flow.indexOf(status)
  return (
    <ol class="track" data-status={status}>
      {flow.map((st, i) => {
        const state = i < now ? 'done' : i === now ? (st === 'delivered' || st === 'cancelled' ? 'done' : 'now') : 'todo'
        const when = i <= now ? at(st) : ''
        return (
          <li class={`t-${state}${st === 'cancelled' ? ' t-cancel' : ''}`} aria-current={i === now ? 'step' : undefined}>
            <span class="t-dot" aria-hidden="true">{state === 'done' ? (st === 'cancelled' ? '×' : '✓') : ''}</span>
            <span class="t-txt"><b>{STATUS_WORDS[lang][st]}</b>{when ? <small>{when}</small> : null}{i >= now && tr.trackSub[st] && status !== 'cancelled' && state !== 'done' ? <small>{tr.trackSub[st]}</small> : null}</span>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------- info pages ---------- */
const PAGES: Record<string, { ar: [string, string]; en: [string, string] }> = {
  about: {
    ar: ['من نحن', 'سالفورد ليبيا متجر مجوهرات أصلية من Swarovski وTiffany & Co. وAPM Monaco وPandora. كل قطعة تصلك في علبة العلامة الأصلية مع أوراقها.'],
    en: ['About us', 'Salford Libya sells authentic jewelry from Swarovski, Tiffany & Co., APM Monaco and Pandora. Every piece arrives in the brand’s original box with its papers.'],
  },
  delivery: {
    ar: ['التوصيل والإرجاع', 'نوصل لكل المدن والمناطق في ليبيا، ونتفق معك على موعد التوصيل في المحادثة بعد تأكيد الطلبية.'],
    en: ['Delivery & returns', 'We deliver to every city and area in Libya, and agree the delivery time with you in the chat once your order is confirmed.'],
  },
  trust: {
    ar: ['تسوّق بثقة', ''],
    en: ['Shop with confidence', ''],
  },
  contact: {
    ar: ['تواصل معنا', 'راسلنا على واتساب أو إنستغرام أو فيسبوك، ونرد عليك في أقرب وقت.'],
    en: ['Contact us', 'Message us on WhatsApp, Instagram or Facebook and we will reply as soon as we can.'],
  },
}
/** Delivery page: the price table (when delivery prices are on) and the rules, always from the live settings. */
function DeliveryInfo({ b, lang }: { b: Base; lang: Lang }) {
  const tr = t(lang)
  const on = b.settings.delivery_on === '1'
  const nm = (x: { name_ar: string; name_en: string }) => (lang === 'ar' ? x.name_ar || x.name_en : x.name_en || x.name_ar)
  const min = freeMinOf(b.settings)
  const offerName = b.offer && b.offer.free_delivery ? (lang === 'ar' ? b.offer.name_ar || b.offer.name_en : b.offer.name_en || b.offer.name_ar) : ''
  const cities = b.cat.cities.map((city) => ({ city, areas: b.cat.areas.filter((a) => a.city_id === city.id) })).filter((x) => x.areas.length)
  const fee = (v: number | null) => (v === null || v === undefined ? tr.delAgreed : v === 0 ? tr.freeShort : `${fmtLyd(v)} ${tr.currency}`)
  return (
    <>
      {on && cities.length ? (
        <>
          <h2 class="h">{tr.delTable}</h2>
          {min ? <p class="para del-free">{tr.delFreeFrom(fmtLyd(min))}</p> : null}
          {b.offer && b.offer.free_delivery ? <p class="para del-free">{tr.delFreeOffer(offerName || '')}</p> : null}
          <div class="del-wrap">
            <table class="del-table">
              <thead><tr><th>{tr.delCity}</th><th>{tr.delArea}</th><th>{tr.delPrice}</th><th>{tr.delTime}</th></tr></thead>
              <tbody>
                {cities.flatMap(({ city, areas }) => areas.map((a, i) => (
                  <tr class={i ? '' : 'first'}>
                    <td>{i ? '' : nm(city)}</td>
                    <td>{a.name_en === 'All areas' ? (lang === 'ar' ? 'كل المناطق' : 'All areas') : nm(a)}</td>
                    <td class="num">{fee(a.price)}</td>
                    <td>{(lang === 'ar' ? a.time_ar || a.time_en : a.time_en || a.time_ar) || '—'}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <h2 class="h">{tr.delRules}</h2>
      <ul class="rules">
        <li>{on ? tr.delR1 : tr.delR1Off}</li>
        <li>{tr.delR2}</li>
        <li>{tr.delR3}</li>
        <li>{tr.delR4}</li>
        {on ? <li>{tr.delR5}</li> : null}
      </ul>
      <p><a href={`/${lang}/page/trust`}>{tr.trustMore}</a></p>
    </>
  )
}

/** Trust page: the three facts, the owner's own words and photos, and approved reviews. */
function TrustPage({ b, lang }: { b: Base; lang: Lang }) {
  const tr = t(lang)
  const extra = (b.settings[`trust_text_${lang}`] || '').trim()
  const gallery = parseGallery(b.settings.trust_gallery)
  const rvOn = onSwitch(b.settings, 'reviews_on')
  const rv = rvOn ? b.cat.reviews : []
  const st = stars(rv)
  const facts: [string, string, string][] = [
    [tr.tf1T, tr.tf1S, 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8'],
    [tr.tf2T, tr.tf2S, 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM8 8h8M8 12h8M8 16h5'],
    [tr.tf3T, tr.tf3S, 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6zM9 12l2 2 4-4'],
  ]
  return (
    <section class="wrap narrow sec trustpg">
      <h1 class="h1">{tr.trust}</h1>
      <p class="para lead">{tr.trustIntro}</p>
      <ul class="facts">
        {facts.map(([h, sub, d]) => (
          <li class="info-row"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg><span><b>{h}</b>{sub}</span></li>
        ))}
      </ul>
      {extra ? extra.split('\n').map((l) => (l.trim() ? <p class="para" dir="auto">{l}</p> : null)) : null}
      {gallery.length ? (
        <>
          <h2 class="h">{tr.trustGallery}</h2>
          <ul class="tgal">
            {gallery.map((g) => {
              const cap = lang === 'ar' ? g.cap_ar || g.cap_en : g.cap_en || g.cap_ar
              return <li><figure><img src={g.url} alt={cap} loading="lazy" />{cap ? <figcaption dir="auto">{cap}</figcaption> : null}</figure></li>
            })}
          </ul>
        </>
      ) : null}
      {rv.length ? (
        <>
          <h2 class="h">{tr.trustReviews}</h2>
          <p class="rv-sum"><Stars n={st.avg} lang={lang} /> <b dir="ltr">{st.avg.toFixed(1)}</b> <span class="muted">· {tr.rvCount(st.n)}</span></p>
          <ReviewList list={rv.slice(0, 12)} lang={lang} products={b.cat} />
        </>
      ) : null}
      <p><a class="btn ghost" href={`/${lang}/page/delivery`}>{tr.trustDelLink}</a></p>
    </section>
  )
}

/* ---------- Release 3: the customer's own review page (from the "ask for a review" message) ---------- */
store.get('/:lang{(?:ar|en)}/review/:number{SL-[0-9]+}', async (c) => {
  const lang = c.req.param('lang') as Lang
  const tr = t(lang)
  const b = await base(c, lang)
  const number = c.req.param('number')
  const token = String(c.req.query('t') ?? '')
  const got = await loadOrderForCustomer(c.env.DB, number, token)
  c.header('referrer-policy', 'no-referrer')
  c.header('cache-control', 'private, no-store')
  const page = (body: unknown, status = 200) => render(c, { lang, path: `/review/${number}`, title: tr.rvPage, noindex: true }, b, <section class="wrap narrow sec">{body as never}</section>, status)
  if (!got) return page(<><h1 class="h1">{tr.rvPage}</h1><p class="para">{tr.orderMissing}</p><p class="muted">{tr.orderMissingHelp}</p></>, 404)
  if (!onSwitch(b.settings, 'reviews_on')) return page(<><h1 class="h1">{tr.rvPage}</h1><p class="para">{tr.rvOff}</p></>)
  const o = got.order
  if (o.status !== 'delivered') return page(<><h1 class="h1">{tr.rvPage}</h1><p class="para">{tr.rvNotYet}</p></>)
  const db = c.env.DB
  const [{ results: items }, { results: done }] = await db.batch([
    db.prepare('SELECT DISTINCT product_id AS id, name FROM order_items WHERE order_id = ? AND product_id IS NOT NULL ORDER BY rowid').bind(o.id),
    db.prepare("SELECT product_id FROM reviews WHERE order_id = ? AND status != 'rejected'").bind(o.id),
  ]) as unknown as [{ results: { id: number; name: string }[] }, { results: { product_id: number | null }[] }]
  const reviewed = new Set(done.map((d) => d.product_id ?? 0))
  const left = items.filter((i) => !reviewed.has(i.id))
  if (!left.length && reviewed.has(0)) return page(<><h1 class="h1">{tr.rvPage}</h1><p class="para">{tr.rvDone}</p></>)
  return page(
    <>
      <h1 class="h1">{tr.rvPage}</h1>
      <p class="muted">{tr.rvPageSub(number)}</p>
      <ReviewForm lang={lang} order={{ number, token, name: o.name, city: o.city, items: left, shopOk: !reviewed.has(0) }} />
    </>,
  )
})

store.get('/:lang{(?:ar|en)}/page/:slug', async (c) => {
  const lang = c.req.param('lang') as Lang
  const slug = c.req.param('slug')
  const page = PAGES[slug]
  if (!page) return notFound(c, lang)
  const b = await base(c, lang)
  const tr = t(lang)
  const [title, defText] = page[lang]
  const text = b.settings[`page_${slug}_${lang}`] || defText
  const s = b.settings
  const wa = waNumber(s.whatsapp || '') ? `https://wa.me/${waNumber(s.whatsapp || '')}` : ''
  const ig = igHandle(s.instagram || '') ? `https://www.instagram.com/${igHandle(s.instagram || '')}/` : ''
  if (slug === 'trust') return render(c, { lang, path: '/page/trust', title, desc: tr.trustIntro }, b, <TrustPage b={b} lang={lang} />)
  return render(c, { lang, path: `/page/${slug}`, title }, b, (
    <section class="wrap narrow sec">
      <h1 class="h1">{title}</h1>
      {text.split('\n').map((l) => <p class="para">{l}</p>)}
      {slug === 'delivery' ? <DeliveryInfo b={b} lang={lang} /> : null}
      {slug === 'contact' ? (
        <div class="sends">
          {wa ? <a class="send whatsapp" href={wa} rel="noopener" target="_blank"><span>{Icons.wa}{tr.whatsapp}</span></a> : null}
          {ig ? <a class="send instagram" href={ig} rel="noopener" target="_blank"><span>{Icons.ig}{tr.instagram}</span></a> : null}
          {s.facebook ? <a class="send facebook" href={s.facebook} rel="noopener" target="_blank"><span>{Icons.fb}{tr.facebook}</span></a> : null}
        </div>
      ) : null}
    </section>
  ))
})

/* ---------- 404 ---------- */
export async function notFound(c: C, lang: Lang = 'ar') {
  const tr = t(lang)
  const b = await base(c, lang)
  return render(c, { lang, path: '/', title: tr.notFound }, b, (
    <section class="wrap narrow sec center">
      <h1 class="h1">{tr.notFound}</h1>
      <p class="muted">{tr.notFoundSub}</p>
      <form class="shop-search" action={`/${lang}/shop`} method="get" role="search"><input type="search" name="q" placeholder={tr.search} aria-label={tr.search} /><button class="btn sm">{tr.searchBtn}</button></form>
      <a class="btn" href={`/${lang}/`}>{tr.home}</a>
    </section>
  ), 404)
}

export { isLang }
