/** The live offer on the shop: the thin strip, the home banner, the countdown and the card badge. Looks come from lib/looks.ts. */
import type { Lang } from '../lib/i18n'
import type { Offer } from '../lib/pricing'
import { lookOf, lookCss, lookFontHref, offerWords, flagSvg } from '../lib/looks'

/** D1 UTC text → ISO for the browser ('2026-12-25 00:00:00' → '2026-12-25T00:00:00Z'). */
export const isoUtc = (s: string) => (s ? s.replace(' ', 'T') + 'Z' : '')

const U = {
  ar: { d: 'يوم', h: 'ساعة', m: 'دقيقة', s: 'ثانية', ends: 'ينتهي العرض خلال' },
  en: { d: 'days', h: 'hours', m: 'min', s: 'sec', ends: 'Ends in' },
}
const two = (n: number) => String(Math.max(0, n)).padStart(2, '0')
function parts(endIso: string, now = Date.now()) {
  const left = Math.max(0, Math.floor((Date.parse(endIso) - now) / 1000))
  return { d: Math.floor(left / 86400), h: Math.floor((left % 86400) / 3600), m: Math.floor((left % 3600) / 60), s: left % 60 }
}

/** Boxes with days, hours, minutes, seconds. The page shows the right numbers before any script runs; site.js keeps them ticking. */
export function Countdown({ end, lang, noDays }: { end: string; lang: Lang; noDays?: boolean }) {
  const iso = isoUtc(end)
  const p = parts(iso)
  const u = U[lang]
  const h = noDays ? p.d * 24 + p.h : p.h
  return (
    <span class="ocd" data-cd={iso} data-nodays={noDays ? '1' : undefined} dir="ltr" role="timer" aria-label={u.ends}>
      {noDays ? null : <span class="u"><b data-f="d">{two(p.d)}</b><i>{u.d}</i></span>}
      <span class="u"><b data-f="h">{two(h)}</b><i>{u.h}</i></span>
      <span class="u"><b data-f="m">{two(p.m)}</b><i>{u.m}</i></span>
      <span class="u"><b data-f="s">{two(p.s)}</b><i>{u.s}</i></span>
    </span>
  )
}

/** In <head>: the look's colours, and its special font only while it runs. */
export function OfferHead({ offer }: { offer: Offer | null }) {
  if (!offer) return null
  const look = lookOf(offer.template)
  const href = lookFontHref(look)
  return (
    <>
      {href ? <link rel="stylesheet" href={href} /> : null}
      <style dangerouslySetInnerHTML={{ __html: lookCss(look) }} />
    </>
  )
}

export function OfferStrip({ offer, lang }: { offer: Offer | null; lang: Lang }) {
  if (!offer || !offer.show_strip) return null
  const look = lookOf(offer.template)
  const w = offerWords(offer, lang)
  const p = offer.ends_at ? parts(isoUtc(offer.ends_at)) : null
  return (
    <a class="ostrip" href={`/${lang}/shop`}>
      <span>{w.strip}</span>
      {look.stripCd && p && offer.show_countdown ? (
        <> · <bdi dir="ltr" class="ocd-t" data-cd={isoUtc(offer.ends_at)} data-txt="1">{`${two(p.d * 24 + p.h)}:${two(p.m)}:${two(p.s)}`}</bdi></>
      ) : null}
    </a>
  )
}

export function OfferBanner({ offer, lang, photo }: { offer: Offer | null; lang: Lang; photo?: string }) {
  if (!offer || !offer.show_banner) return null
  const look = lookOf(offer.template)
  const w = offerWords(offer, lang)
  const cd = offer.show_countdown && offer.ends_at ? <Countdown end={offer.ends_at} lang={lang} noDays={look.noDays} /> : null
  const text = (
    <>
      {look.emb === 'flag' ? <span class="oflag" dangerouslySetInnerHTML={{ __html: flagSvg() }} /> : null}
      <span class={`okick${look.kick ? ' ' + look.kick : ''}`}>{w.kick}</span>
      <span class="ottl">{w.ttl}</span>
      {w.sub ? <span class="osub">{w.sub}</span> : null}
      {cd}
      <span class="obtn">{w.btn}</span>
    </>
  )
  const photoLayout = look.layout === 'photo' && photo
  return (
    <a class={`obanner${photoLayout ? ' photo' : ''}${look.dark ? ' dark' : ''}`} href={`/${lang}/shop`} style={look.pt ? `padding-top:${look.pt}px` : undefined} aria-label={`${w.ttl}. ${w.sub}`}>
      {look.orn ? <span class="orn" aria-hidden="true" dangerouslySetInnerHTML={{ __html: look.orn }} /> : null}
      {photoLayout ? (
        <>
          <span class="opic"><img src={photo} alt="" loading="eager" decoding="async" /></span>
          <span class="obody">{text}</span>
        </>
      ) : text}
    </a>
  )
}

/** The small "−24%" on product photos. */
export const OfferBadge = ({ offer, lang, pct }: { offer: Offer; lang: Lang; pct: number }) => {
  const w = offerWords(offer, lang)
  return <span class="obadge" dir="ltr">{w.badge || `−${pct}%`}</span>
}
