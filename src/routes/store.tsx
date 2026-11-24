import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Env, Brand, ProductWithMedia } from '../lib/db'
import { pName, pShort, pDesc, fmtLyd } from '../lib/db'
import { catalog, listFrom, productFrom, type Catalog } from '../lib/catalog'
import { t, isLang, CITIES_AR, type Lang } from '../lib/i18n'
import { Layout, Grid, Price, Pic, type PageMeta } from '../views/layout'
import { mediaUrl, srcset, youtubeId, firstImage, absUrl } from '../lib/media'
import { loadOrderForCustomer, channelLinks, waNumber, igHandle } from '../lib/orders'

type C = Context<{ Bindings: Env }>
export const store = new Hono<{ Bindings: Env }>()

const origin = (c: C) => new URL(c.req.url).origin
const noindex = (c: C) => new URL(c.req.url).hostname.endsWith('.pages.dev')

async function base(c: C, _lang: Lang): Promise<{ brands: Brand[]; settings: Record<string, string>; cat: Catalog }> {
  const cat = await catalog(c)
  return { brands: cat.brands, settings: cat.settings, cat }
}

function render(c: C, meta: Omit<PageMeta, 'origin'>, b: { brands: Brand[]; settings: Record<string, string> }, body: unknown, status = 200) {
  return c.html(
    <Layout {...meta} origin={origin(c)} noindex={meta.noindex || noindex(c)} brands={b.brands} settings={b.settings}>
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
type Banner = { image?: string; image_mobile?: string; eyebrow_ar?: string; eyebrow_en?: string; title_ar?: string; title_en?: string; link?: string }

store.get('/:lang{(?:ar|en)}/', async (c) => {
  const lang = c.req.param('lang') as Lang
  const tr = t(lang)
  const b = await base(c, lang)
  const cats = b.cat.cats
  const fresh = listFrom(b.cat, { flag: 'new', limit: 8 })
  const best = listFrom(b.cat, { flag: 'best', limit: 8 })
  const newest = fresh.length ? fresh : listFrom(b.cat, { limit: 8 })
  const brandPics = b.brands.map((br) => listFrom(b.cat, { brand: br.id, limit: 1 }))
  const catPics = cats.map((ct) => listFrom(b.cat, { cat: ct.id, limit: 1 }))
  let banners: Banner[] = []
  try { banners = JSON.parse(b.settings.banners || '[]') } catch { banners = [] }

  return render(c, { lang, path: '/', active: 'home', image: absUrl(origin(c), '/static/brand/og.jpg') }, b, (
    <>
      <section class="wrap">
        <div class="hero">
          <picture class="hero-pic">
            <source media="(max-width: 639px)" type="image/webp" srcset="/static/brand/hero-m-480.webp 480w, /static/brand/hero-m-864.webp 864w" sizes="100vw" />
            <img src="/static/brand/hero-1210.webp" srcset="/static/brand/hero-700.webp 700w, /static/brand/hero-1210.webp 1210w" sizes="(min-width: 1240px) 700px, 58vw" alt="" width="1210" height="1080" fetchpriority="high" />
          </picture>
          <div class="hero-txt" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <span class="hero-glow" aria-hidden="true" />
            <h1 class="hero-logo"><img src="/static/brand/logo-white.webp" alt={tr.siteName} width="600" height="387" /></h1>
            <p class="hero-line">{tr.tagline}</p>
            <p class="hero-brands bd">Swarovski · Tiffany &amp; Co. · APM Monaco · Pandora</p>
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
              <a class="banner has-img" href={bn.link || `/${lang}/shop`}>
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
          {b.brands.map((br, i) => (
            <a class={`bt t-${br.tint}`} href={`/${lang}/brand/${br.id}`}>
              <span class="bd">{br.name}</span>
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
        <Grid items={newest} lang={lang} brands={b.brands} eagerFirst={2} />
      </section>

      {best.length ? (
        <section class="wrap sec">
          <div class="sec-h"><h2 class="h">{tr.bestSellers}</h2><a href={`/${lang}/shop`}>{tr.viewAll}</a></div>
          <Grid items={best} lang={lang} brands={b.brands} />
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
  const pics = b.brands.map((br) => listFrom(b.cat, { brand: br.id, limit: 1 }))
  return render(c, { lang, path: '/brands', title: tr.brands, active: 'brands' }, b, (
    <section class="wrap sec">
      <h1 class="h1">{tr.brands}</h1>
      <div class="brands-big">
        {b.brands.map((br, i) => (
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
  const cats = b.cat.cats
  const items = listFrom(b.cat, { brand: brand?.id, cat, q, sort })
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
      <section class="wrap">
        <form class="shop-search" action={`/${lang}${basePath}`} method="get" role="search">
          <input type="search" name="q" value={q ?? ''} placeholder={tr.search} aria-label={tr.search} />
          {cat ? <input type="hidden" name="cat" value={cat} /> : null}
          <button class="btn sm" type="submit">{tr.searchBtn}</button>
        </form>
        {!brandId ? (
          <div class="chips" aria-label={tr.brands}>
            <a class={`chip${!brand ? ' on' : ''}`} href={qs({ brand: undefined })}>{tr.all}</a>
            {b.brands.map((br) => <a class={`chip bdchip${brand?.id === br.id ? ' on' : ''}`} href={qs({ brand: br.id })}>{br.name}</a>)}
          </div>
        ) : null}
        <div class="chips" aria-label={tr.categories}>
          <a class={`chip${!cat ? ' on' : ''}`} href={qs({ cat: undefined })}>{tr.all}</a>
          {cats.map((ct) => <a class={`chip${cat === ct.id ? ' on' : ''}`} href={qs({ cat: ct.id })}>{lang === 'ar' ? ct.name_ar : ct.name_en}</a>)}
        </div>
        <div class="fbar">
          <span class="muted">{items.length} {tr.products}</span>
          <label class="sortsel">
            <span class="vh">{tr.sort}</span>
            <select data-nav aria-label={tr.sort}>
              <option value={qs({ sort: undefined })} selected={sort === 'new'}>{tr.sortNew}</option>
              <option value={qs({ sort: 'low' })} selected={sort === 'low'}>{tr.sortLow}</option>
              <option value={qs({ sort: 'high' })} selected={sort === 'high'}>{tr.sortHigh}</option>
            </select>
          </label>
        </div>
        {items.length ? <Grid items={items} lang={lang} brands={b.brands} eagerFirst={4} /> : <p class="empty">{tr.noResults}</p>}
      </section>
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

store.get('/:lang{(?:ar|en)}/p/:id{[0-9]+}', async (c) => {
  const lang = c.req.param('lang') as Lang
  const tr = t(lang)
  const b = await base(c, lang)
  const p = productFrom(b.cat, Number(c.req.param('id')))
  if (!p || !p.media.length) return notFound(c, lang)
  const brand = b.brands.find((x) => x.id === p.brand_id)
  const name = pName(p, lang)
  const img = firstImage(p.media)
  let similar = listFrom(b.cat, { brand: p.brand_id, cat: p.category_id, exclude: p.id, limit: 8 })
  if (similar.length < 4) similar = similar.concat(listFrom(b.cat, { cat: p.category_id, exclude: p.id, limit: 8 })).filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).slice(0, 8)
  let setParts: { id: number; code: string; name_en: string; name_ar: string }[] = []
  const codes: string[] = (() => { try { return JSON.parse(p.set_codes || '[]') } catch { return [] } })()
  if (p.is_set && codes.length) {
    setParts = b.cat.products.filter((x) => !x.is_set && codes.includes(x.code)).map((x) => ({ id: x.id, code: x.code, name_en: x.name_en, name_ar: x.name_ar }))
  }
  const desc = pDesc(p, lang)
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name, sku: p.code,
    brand: { '@type': 'Brand', name: brand?.name },
    image: img ? absUrl(origin(c), mediaUrl(img, 900)) : undefined,
    description: pShort(p, lang) || desc.slice(0, 200),
    offers: { '@type': 'Offer', priceCurrency: 'LYD', price: (p.price / 1000).toString(), availability: p.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
  }
  return render(c, { lang, path: `/p/${p.id}`, title: `${name} · ${brand?.name ?? ''}`, desc: `${brand?.name ?? ''} · ${fmtLyd(p.price)} ${tr.currency} · ${pShort(p, lang)}`, image: ld.image }, b, (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <article class="wrap product">
        <Gallery p={p} lang={lang} />
        <div class="pinfo">
          <a class="bd" href={`/${lang}/brand/${p.brand_id}`}>{brand?.name}</a>
          <h1 class="pname">{name}</h1>
          <div class="prow">
            <Price value={p.price} compare={p.compare_price} lang={lang} />
            <span class={p.in_stock ? 'instock' : 'nostock'}>{p.in_stock ? tr.inStock : tr.outOfStock}</span>
          </div>
          <p class="code">{tr.code} <bdi>{p.code}</bdi></p>
          <div class="info-row">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></svg>
            <span><b>{tr.boxTitle(brand?.name ?? '')}</b>{tr.boxSub}</span>
          </div>
          <div class="info-row">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></svg>
            <span><b>{tr.delTitle}</b>{tr.delSub}</span>
          </div>
          {setParts.length ? (
            <div class="setbox"><b>{tr.setIncludes}</b><ul>{setParts.map((s) => <li><a href={`/${lang}/p/${s.id}`}>{s.name_en || s.name_ar}</a> <bdi class="muted">{s.code}</bdi></li>)}</ul></div>
          ) : null}
          {pShort(p, lang) ? <p class="short" dir="auto">{pShort(p, lang)}</p> : null}
          {desc ? <div class="desc" dir="auto">{desc.split('\n').map((l) => (l.trim() ? <p>{l}</p> : null))}</div> : null}
          <div class="buybar">
            {p.in_stock ? (
              <button class="btn wide" type="button" data-add={p.id}>
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8.5h13l-1 11.5h-11z" /><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" /></svg>
                {tr.addToCart}
              </button>
            ) : <button class="btn wide" type="button" disabled>{tr.soldOut}</button>}
          </div>
          {b.settings.whatsapp ? (
            <a class="askwa" href={`https://wa.me/${b.settings.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(tr.askMsg(`${brand?.name ?? ''} ${name}`.trim(), p.code, `${origin(c)}/${lang}/p/${p.id}`))}`} target="_blank" rel="noopener">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-.9.8a4 4 0 0 1-2.2-2.2l.8-.9-1-2z" /></svg>
              {tr.askWa}
            </a>
          ) : null}
        </div>
      </article>
      {similar.length ? (
        <section class="wrap sec">
          <h2 class="h">{tr.similar}</h2>
          <Grid items={similar.slice(0, 8)} lang={lang} brands={b.brands} />
        </section>
      ) : null}
    </>
  ))
})

/* ---------- cart / checkout / order ---------- */
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
  const channels = [
    s.whatsapp ? { v: 'whatsapp', l: tr.whatsapp, n: tr.ready } : null,
    s.facebook ? { v: 'messenger', l: tr.messenger, n: tr.ready } : null,
    s.instagram ? { v: 'instagram', l: tr.instagram, n: tr.igHint } : null,
  ].filter(Boolean) as { v: string; l: string; n: string }[]
  return render(c, { lang, path: '/checkout', title: tr.checkout, active: 'cart' }, b, (
    <section class="wrap narrow">
      <h1 class="h1">{tr.checkout}</h1>
      <form id="checkout" class="form" novalidate data-checkout>
        <div id="co-summary" class="sum" aria-live="polite"></div>
        <label class="field"><span>{tr.name}</span><input name="name" required autocomplete="name" maxlength={80} /></label>
        <label class="field"><span>{tr.phone}</span><input name="phone" required type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="09X XXX XXXX" maxlength={20} /></label>
        <label class="field"><span>{tr.city}</span><input name="city" required list="cities" placeholder={tr.cityPh} autocomplete="address-level2" maxlength={60} /></label>
        <datalist id="cities">{CITIES_AR.map((x) => <option value={x} />)}</datalist>
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
  const [b, v] = await Promise.all([base(c, lang), loadOrderForCustomer(c.env.DB, num, c.req.query('t') ?? '')])
  c.header('cache-control', 'private, no-store')
  const meta = { lang, path: '/cart', title: tr.orderReady, noindex: true, active: 'cart' as const }
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
  return render(c, meta, b, (
    <section class="wrap narrow done" data-order-page={num} data-copy-first={copyFirst ? '1' : undefined}>
      <span class="ok-ico" aria-hidden="true">✓</span>
      <h1 class="h1">{tr.orderReady}</h1>
      <p class="onum"><span class="muted">{tr.orderNumber}</span> <bdi>{num}</bdi></p>
      <p class="muted" data-order-hint data-opened-hint={ch === 'whatsapp' ? tr.hintWa : undefined}>{hint}</p>
      <div class="sends">
        <a class={`send ${ch}`} href={links[ch]} target="_blank" rel="noopener" data-open data-opened-label={ch === 'whatsapp' ? tr.openWa : undefined}><span>{label}</span></a>
        <button class="btn ghost wide" type="button" data-copy>{tr.copyMsg}</button>
        <textarea class="vh" readonly aria-hidden="true" tabindex={-1} data-msg>{v.message}</textarea>
      </div>
      <h2 class="h">{tr.yourOrder}</h2>
      <div class="sum">
        {v.info.lines.map((l) => (
          <div><span><bdi>{l.brand} · {l.name}</bdi>{l.qty > 1 ? ` × ${l.qty}` : ''}</span><span>{fmtLyd(l.price * l.qty)} {cur}</span></div>
        ))}
        <div class="tot"><span>{tr.total}</span><span>{fmtLyd(v.info.total)} {cur}</span></div>
      </div>
      <h2 class="h">{tr.nextSteps}</h2>
      <ol class="steps"><li>{tr.step1}</li><li>{tr.step2}</li><li>{tr.step3}</li></ol>
      <a class="btn ghost wide" href={`/${lang}/`}>{tr.keepShopping}</a>
    </section>
  ))
})

/* ---------- info pages ---------- */
const PAGES: Record<string, { ar: [string, string]; en: [string, string] }> = {
  about: {
    ar: ['من نحن', 'سالفورد ليبيا متجر مجوهرات أصلية من Swarovski وTiffany & Co. وAPM Monaco وPandora. كل قطعة تصلك في علبة العلامة الأصلية مع أوراقها.'],
    en: ['About us', 'Salford Libya sells authentic jewelry from Swarovski, Tiffany & Co., APM Monaco and Pandora. Every piece arrives in the brand’s original box with its papers.'],
  },
  delivery: {
    ar: ['التوصيل والإرجاع', 'نوصل لكل المدن والمناطق في ليبيا. موعد التوصيل ورسومه نتفق عليها معك في المحادثة بعد تأكيد الطلبية. الدفع نقداً أو ببطاقة مصرفية عند الاستلام، أو عبر LyPay. لأي استفسار عن الإرجاع أو الاستبدال تواصل معنا قبل الاستلام.'],
    en: ['Delivery & returns', 'We deliver to every city and area in Libya. Delivery time and cost are agreed with you in the chat after your order is confirmed. Pay cash or by card on delivery, or with LyPay. For returns or exchanges, please contact us before delivery.'],
  },
  contact: {
    ar: ['تواصل معنا', 'راسلنا على واتساب أو إنستغرام أو فيسبوك، ونرد عليك في أقرب وقت.'],
    en: ['Contact us', 'Message us on WhatsApp, Instagram or Facebook and we will reply as soon as we can.'],
  },
}
store.get('/:lang{(?:ar|en)}/page/:slug', async (c) => {
  const lang = c.req.param('lang') as Lang
  const slug = c.req.param('slug')
  const page = PAGES[slug]
  if (!page) return notFound(c, lang)
  const b = await base(c, lang)
  const [title, defText] = page[lang]
  const text = b.settings[`page_${slug}_${lang}`] || defText
  const s = b.settings
  const wa = s.whatsapp ? `https://wa.me/${s.whatsapp.replace(/\D/g, '')}` : ''
  return render(c, { lang, path: `/page/${slug}`, title }, b, (
    <section class="wrap narrow sec">
      <h1 class="h1">{title}</h1>
      {text.split('\n').map((l) => <p class="para">{l}</p>)}
      {slug === 'contact' ? (
        <div class="sends">
          {wa ? <a class="send whatsapp" href={wa} rel="noopener"><span>WhatsApp</span></a> : null}
          {s.instagram ? <a class="send instagram" href={s.instagram} rel="noopener"><span>Instagram</span></a> : null}
          {s.facebook ? <a class="send messenger" href={s.facebook} rel="noopener"><span>Facebook</span></a> : null}
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
