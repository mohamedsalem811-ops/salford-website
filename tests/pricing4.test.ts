// Release 4 price rules: spend-more levels, flash deals (R2), free gift (R4), extras-only offers, early access, teaser.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quote, liveOffer, teaserOffer, shopPrice, parseTiers, shiftUtc, isEarlyNow, hasEffect, type Offer, type Code, type Area, type Flash } from '../src/lib/pricing'
import { offerWords } from '../src/lib/looks'

const LYD = 1000
const P = (id: number, lyd: number, more: Record<string, unknown> = {}) => ({ id, price: lyd * LYD, compare_price: null as number | null, brand_id: 'swarovski', category_id: 'necklaces', no_discount: 0, in_stock: 1, ...more })
const offer = (more: Partial<Offer> = {}): Offer => ({
  id: 1, template: 'ind', name_ar: '', name_en: 'Test', theme: '', starts_at: '', ends_at: '', enabled: 1, kind: 'percent',
  percent: 20, scope: '{"all":true}', free_delivery: 0, banner_ar: '', banner_en: '', sub_ar: '', sub_en: '', kicker_ar: '', kicker_en: '',
  caption_ar: '', caption_en: '', badge_ar: '', badge_en: '', show_countdown: 1, show_banner: 1, show_strip: 1, photo_product_id: null, created_at: '', ...more,
})
const flash = (product_id: number, lyd: number, max_qty = 0, sold = 0, id = 9): Flash => ({ id, offer_id: 1, product_id, price: lyd * LYD, max_qty, sold })
const code = (more: Partial<Code> = {}): Code => ({ id: 1, code: 'SARA10', owner: 'Sara', kind: 'percent', value: 10, min_total: 0, starts_at: '', ends_at: '', max_uses: 0, per_phone: 1, enabled: 1, commission_pct: 5, ...more })
const area = (price: number | null): Area => ({ id: 7, city_id: 1, name_ar: 'تاجوراء', name_en: 'Tajoura', price: price === null ? null : price * LYD, time_ar: '', time_en: '', enabled: 1, sort: 1 })
const base = { deliveryOn: true, freeMin: 1000 * LYD, area: area(20) }
const tiers = JSON.stringify([{ min: 1000 * LYD, pct: 15 }, { min: 500 * LYD, pct: 10 }])

test('spend-more levels: parsed lowest first, bad levels dropped, each level must give more', () => {
  assert.deepEqual(parseTiers(tiers), [{ min: 500 * LYD, pct: 10 }, { min: 1000 * LYD, pct: 15 }])
  assert.deepEqual(parseTiers('[{"min":0,"pct":10},{"min":5,"pct":95},{"min":7,"pct":"x"}]'), [])
  assert.deepEqual(parseTiers('[{"min":100,"pct":20},{"min":200,"pct":10}]'), [{ min: 100, pct: 20 }], 'a higher level with a lower % is dropped')
  assert.deepEqual(parseTiers('not json'), [])
  assert.equal(parseTiers(JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ min: (i + 1) * 100, pct: i + 1 })))).length, 5)
})

test('spend-more levels: the level reached applies to the products in the offer, with what is left to the next level', () => {
  const o = offer({ kind: 'tiers', percent: 15, tiers })
  const below = quote({ ...base, offer: o, lines: [{ p: P(1, 400), qty: 1 }] })
  assert.equal(below.discount, 0)
  assert.deepEqual(below.tier, { pct: 0, base: 400 * LYD, next: { min: 500 * LYD, pct: 10, need: 100 * LYD } })
  const mid = quote({ ...base, offer: o, lines: [{ p: P(1, 400), qty: 1 }, { p: P(2, 200), qty: 1 }] })
  assert.equal(mid.kind, 'offer')
  assert.equal(mid.items, 360 * LYD + 180 * LYD)
  assert.deepEqual(mid.tier?.next, { min: 1000 * LYD, pct: 15, need: 400 * LYD })
  const top = quote({ ...base, offer: o, lines: [{ p: P(1, 600), qty: 2 }] })
  assert.equal(top.items, 1020 * LYD) // 600 − 15% = 510 each
  assert.equal(top.tier?.pct, 15)
  assert.equal(top.tier?.next, null)
  // a product with its own crossed-out price neither counts toward the level nor gets the %
  const skip = quote({ ...base, offer: o, lines: [{ p: P(1, 400), qty: 1 }, { p: P(2, 300, { compare_price: 400 * LYD }), qty: 1 }] })
  assert.equal(skip.discount, 0)
  assert.equal(skip.tier?.base, 400 * LYD)
  // no per-product sale price on cards for a spend-more offer
  assert.deepEqual(shopPrice(P(1, 600), o), { price: 600 * LYD, was: null, pct: 0 })
})

test('R3 with spend-more levels: the bigger saving wins against a code', () => {
  const o = offer({ kind: 'tiers', percent: 15, tiers })
  const c = { entered: 'SARA10', row: code({ value: 20 }), uses: 0, phoneUses: 0 }
  const q = quote({ ...base, offer: o, code: c, lines: [{ p: P(1, 600), qty: 1 }] })
  assert.equal(q.kind, 'code')
  assert.equal(q.items, 480 * LYD)
  const q2 = quote({ ...base, offer: o, code: { ...c, row: code({ value: 5 }) }, lines: [{ p: P(1, 600), qty: 1 }] })
  assert.equal(q2.kind, 'offer')
  assert.equal(q2.code?.status, 'not_better')
})

test('R2 flash deals: the flash price replaces any other discount on that product; the rest of the cart can still save', () => {
  const o = offer({ percent: 20, flash: [flash(1, 300)] })
  assert.deepEqual(shopPrice(P(1, 500), o), { price: 300 * LYD, was: 500 * LYD, pct: 40, flash: { left: null } })
  const q = quote({ ...base, offer: o, lines: [{ p: P(1, 500), qty: 1 }, { p: P(2, 500), qty: 1 }] })
  assert.equal(q.flashSaving, 200 * LYD)
  assert.equal(q.offerSaving, 100 * LYD)
  assert.equal(q.discount, 300 * LYD)
  assert.deepEqual(q.lines.map((l) => [l.price, l.flash]), [[300 * LYD, 9], [400 * LYD, undefined]])
  // a code never touches the flash product
  const c = { entered: 'SARA10', row: code({ value: 50 }), uses: 0, phoneUses: 0 }
  const q2 = quote({ ...base, offer: o, code: c, lines: [{ p: P(1, 500), qty: 1 }, { p: P(2, 500), qty: 1 }] })
  assert.equal(q2.kind, 'code')
  assert.deepEqual(q2.lines.map((l) => l.price), [300 * LYD, 250 * LYD])
  // a flash deal also works in an offer with no percent of its own
  const only = offer({ kind: 'none', percent: 0, flash: [flash(1, 300)] })
  assert.ok(hasEffect(only))
  const q3 = quote({ ...base, offer: only, lines: [{ p: P(1, 500), qty: 1 }, { p: P(2, 500), qty: 1 }] })
  assert.equal(q3.kind, 'offer')
  assert.equal(q3.discount, 200 * LYD)
  // "never discount" wins over a flash deal; a flash price above the price is ignored
  assert.equal(shopPrice(P(1, 500, { no_discount: 1 }), o).flash, undefined)
  assert.equal(shopPrice(P(1, 200), o).flash, undefined)
})

test('R2 flash deals: "X left" counter; sold out at the flash price → normal price; more in the cart than left → normal price', () => {
  const o = offer({ kind: 'none', percent: 0, flash: [flash(1, 300, 5, 3)] })
  assert.deepEqual(shopPrice(P(1, 500), o).flash, { left: 2 })
  const ok = quote({ ...base, offer: o, lines: [{ p: P(1, 500), qty: 2 }] })
  assert.equal(ok.items, 600 * LYD)
  const over = quote({ ...base, offer: o, lines: [{ p: P(1, 500), qty: 3 }] })
  assert.equal(over.items, 1500 * LYD)
  assert.deepEqual(over.flashShort, [{ id: 1, left: 2 }])
  const gone = offer({ kind: 'none', percent: 0, flash: [flash(1, 300, 5, 5)] })
  assert.deepEqual(shopPrice(P(1, 500), gone), { price: 500 * LYD, was: null, pct: 0 })
})

test('R4 free gift: one per order once the products total after discount reaches the amount, only while it is in stock', () => {
  const o = offer({ percent: 10, gift_product_id: 50, gift_min: 900 * LYD })
  const gift = P(50, 120)
  const near = quote({ ...base, offer: o, gift, lines: [{ p: P(1, 800), qty: 1 }] })
  assert.equal(near.gift, null)
  assert.equal(near.giftNeed, 180 * LYD) // 720 after 10%
  const got = quote({ ...base, offer: o, gift, lines: [{ p: P(1, 1000), qty: 1 }] })
  assert.deepEqual(got.gift, { id: 50, orig: 120 * LYD })
  assert.equal(got.total, 900 * LYD + 20 * LYD, 'the gift costs nothing')
  assert.equal(quote({ ...base, offer: o, gift: { ...gift, in_stock: 0 }, lines: [{ p: P(1, 1000), qty: 1 }] }).gift, null)
  assert.equal(quote({ ...base, offer: o, gift: P(51, 120), lines: [{ p: P(1, 1000), qty: 1 }] }).gift, null, 'only the offer’s own gift')
  assert.equal(quote({ ...base, offer: null, gift, lines: [{ p: P(1, 1000), qty: 1 }] }).gift, null)
})

test('free delivery during an offer, also in an extras-only offer', () => {
  const o = offer({ kind: 'none', percent: 0, free_delivery: 1 })
  assert.ok(liveOffer([o]))
  const q = quote({ ...base, offer: o, lines: [{ p: P(1, 100), qty: 1 }] })
  assert.equal(q.delivery.mode, 'free')
  assert.equal(q.total, 100 * LYD)
})

test('early access: the link opens the offer early_hours before its start, only with the right token', () => {
  const now = '2026-12-23 10:00:00'
  const o = offer({ starts_at: '2026-12-24 00:00:00', ends_at: '2026-12-27 00:00:00', early_hours: 24, early_token: 'tok123' })
  assert.equal(liveOffer([o], now), null)
  assert.equal(liveOffer([o], now, 'wrong'), null)
  assert.equal(liveOffer([o], now, 'tok123')?.id, 1)
  assert.ok(isEarlyNow(o, now))
  assert.equal(liveOffer([o], '2026-12-22 23:00:00', 'tok123'), null, 'not more than early_hours before')
  assert.equal(liveOffer([{ ...o, early_hours: 0 }], now, 'tok123'), null)
  assert.equal(liveOffer([{ ...o, early_token: '' }], now, ''), null, 'an empty token never matches')
  assert.equal(shiftUtc('2026-12-24 00:00:00', -24), '2026-12-23 00:00:00')
})

test('teaser: "coming soon" within teaser days before the start, never once it runs', () => {
  const o = offer({ starts_at: '2026-12-24 00:00:00', ends_at: '2026-12-27 00:00:00', teaser_days: 3 })
  assert.equal(teaserOffer([o], '2026-12-20 12:00:00'), null)
  assert.equal(teaserOffer([o], '2026-12-21 12:00:00')?.id, 1)
  assert.equal(teaserOffer([o], '2026-12-24 00:00:00'), null)
  assert.equal(teaserOffer([{ ...o, teaser_days: 0 }], '2026-12-23 00:00:00'), null)
  assert.equal(teaserOffer([{ ...o, enabled: 0 }], '2026-12-23 00:00:00'), null)
})

test('extras-only offers: no "0%" in the default words or the badge', () => {
  const w = offerWords(offer({ kind: 'none', percent: 0, template: 'flash' }), 'en')
  assert.ok(!/0%/.test(w.ttl + w.sub + w.strip + w.kick + w.badge), JSON.stringify(w))
  assert.equal(offerWords(offer({ percent: 24 }), 'en').badge, '−24%')
})
