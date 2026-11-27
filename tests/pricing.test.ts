// Price rules R1, R3, R5, R6 (docs/feature-plan.md). Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { percentOff, offerPrice, shopPrice, quote, liveOffer, inScope, parseScope, normalizeCode, type Offer, type Code, type Area } from '../src/lib/pricing'

const LYD = 1000
const P = (id: number, lyd: number, more: Record<string, unknown> = {}) => ({ id, price: lyd * LYD, compare_price: null as number | null, brand_id: 'swarovski', category_id: 'necklaces', no_discount: 0, ...more })
const offer = (more: Partial<Offer> = {}): Offer => ({
  id: 1, template: 'ind', name_ar: 'عيد الاستقلال', name_en: 'Independence Day', theme: '', starts_at: '', ends_at: '', enabled: 1, kind: 'percent',
  percent: 24, scope: '{"all":true}', free_delivery: 0, banner_ar: '', banner_en: '', sub_ar: '', sub_en: '', kicker_ar: '', kicker_en: '',
  caption_ar: '', caption_en: '', badge_ar: '', badge_en: '', show_countdown: 1, show_banner: 1, show_strip: 1, photo_product_id: null, created_at: '', ...more,
})
const code = (more: Partial<Code> = {}): Code => ({ id: 1, code: 'SARA10', owner: 'Sara', kind: 'percent', value: 10, min_total: 0, starts_at: '', ends_at: '', max_uses: 0, per_phone: 1, enabled: 1, commission_pct: 5, ...more })
const area = (price: number | null): Area => ({ id: 7, city_id: 1, name_ar: 'تاجوراء', name_en: 'Tajoura', price: price === null ? null : price * LYD, time_ar: '', time_en: '', enabled: 1, sort: 1 })
const base = { deliveryOn: true, freeMin: 1000 * LYD }

test('R1: percent off, rounded down to 5 LYD, never below 0', () => {
  assert.equal(percentOff(590 * LYD, 24), 445 * LYD) // 448.40 → 445
  assert.equal(percentOff(900 * LYD, 24), 680 * LYD) // 684 → 680
  assert.equal(percentOff(100 * LYD, 25), 75 * LYD)
  assert.equal(percentOff(4 * LYD, 10), 0)
  assert.equal(percentOff(100 * LYD, 100), 0)
  assert.equal(percentOff(250 * LYD, 0), 250 * LYD)
})

test('R1: skips products with their own crossed-out price, "never discount" ticks, and products out of scope', () => {
  const o = offer()
  assert.equal(offerPrice(P(1, 590), o), 445 * LYD)
  assert.equal(offerPrice(P(1, 590, { compare_price: 700 * LYD }), o), null)
  assert.equal(offerPrice(P(1, 590, { compare_price: 500 * LYD }), o), 445 * LYD, 'a compare price below the price is not a crossed-out price')
  assert.equal(offerPrice(P(1, 590, { no_discount: 1 }), o), null)
  const onlyTiffany = offer({ scope: JSON.stringify({ brands: ['tiffany'] }) })
  assert.equal(offerPrice(P(1, 590), onlyTiffany), null)
  assert.equal(offerPrice(P(1, 590, { brand_id: 'tiffany' }), onlyTiffany), 445 * LYD)
  assert.equal(offerPrice(P(1, 590), offer({ enabled: 1, percent: 0 })), null)
  assert.deepEqual(shopPrice(P(1, 590), o), { price: 445 * LYD, was: 590 * LYD, pct: 24 })
  assert.deepEqual(shopPrice(P(1, 590, { compare_price: 700 * LYD }), o), { price: 590 * LYD, was: 700 * LYD, pct: 0 })
  assert.deepEqual(shopPrice(P(1, 590), null), { price: 590 * LYD, was: null, pct: 0 })
})

test('scope: all, brands × categories, single products', () => {
  const s = parseScope('{"brands":["apm"],"cats":["rings"],"products":[9]}')
  assert.ok(inScope(P(1, 1, { brand_id: 'apm', category_id: 'rings' }), s))
  assert.ok(!inScope(P(1, 1, { brand_id: 'apm', category_id: 'necklaces' }), s))
  assert.ok(inScope(P(9, 1), s))
  assert.ok(!inScope(P(1, 1), parseScope('{}')))
  assert.ok(!inScope(P(1, 1), parseScope('not json')))
  assert.ok(inScope(P(1, 1), parseScope('{"all":true}')))
})

test('one offer at a time: newest enabled one inside its dates', () => {
  const now = '2026-12-24 10:00:00'
  const list = [
    offer({ id: 1, starts_at: '2026-12-20 00:00:00', ends_at: '2026-12-26 00:00:00' }),
    offer({ id: 2, starts_at: '2026-12-24 12:00:00' }),
    offer({ id: 3, enabled: 0 }),
    offer({ id: 4, ends_at: '2026-12-24 10:00:00' }),
  ]
  assert.equal(liveOffer(list, now)?.id, 1)
  assert.equal(liveOffer(list, '2026-12-24 12:00:00')?.id, 2)
  assert.equal(liveOffer([], now), null)
})

test('R3: the code is used only when it beats the offer, never both', () => {
  const lines = [{ p: P(1, 590), qty: 1 }, { p: P(2, 300, { no_discount: 1 }), qty: 1 }]
  const q1 = quote({ ...base, lines, offer: offer(), area: area(15), code: { entered: 'SARA10', row: code(), uses: 0, phoneUses: 0 } })
  assert.equal(q1.kind, 'offer')
  assert.equal(q1.code?.status, 'not_better')
  assert.equal(q1.items, 445 * LYD + 300 * LYD)
  const q2 = quote({ ...base, lines, offer: offer(), area: area(15), code: { entered: 'SARA30', row: code({ value: 30 }), uses: 0, phoneUses: 0 } })
  assert.equal(q2.kind, 'code')
  assert.equal(q2.lines[0].price, 410 * LYD) // 413 → 410, not 445 − 30%
  assert.equal(q2.lines[1].price, 300 * LYD, 'never-discount product stays full price under a code too')
  assert.equal(q2.discount, 180 * LYD)
  const q3 = quote({ ...base, lines, offer: offer(), area: area(15), code: { entered: 'AMT200', row: code({ kind: 'amount', value: 200 * LYD }), uses: 0, phoneUses: 0 } })
  assert.equal(q3.kind, 'code')
  assert.equal(q3.discount, 200 * LYD)
  assert.equal(q3.lines[0].price, 590 * LYD, 'amount codes come off the total, not the line')
  const q4 = quote({ ...base, lines: [{ p: P(1, 100), qty: 1 }], offer: null, area: area(15), code: { entered: 'AMT200', row: code({ kind: 'amount', value: 200 * LYD }), uses: 0, phoneUses: 0 } })
  assert.equal(q4.items, 0, 'an amount code never goes below 0')
})

test('codes: unknown, switched off, outside dates, used up, used by this phone, below the minimum', () => {
  const lines = [{ p: P(1, 500), qty: 1 }]
  const st = (c: Partial<Code> | null, uses = 0, phoneUses = 0, phoneKnown = true) =>
    quote({ ...base, lines, offer: null, area: area(15), phoneKnown, now: '2026-12-24 10:00:00', code: { entered: 'X1', row: c ? code(c) : null, uses, phoneUses } }).code?.status
  assert.equal(st(null), 'invalid')
  assert.equal(st({ enabled: 0 }), 'invalid')
  assert.equal(st({ ends_at: '2026-12-01 00:00:00' }), 'expired')
  assert.equal(st({ starts_at: '2026-12-25 00:00:00' }), 'expired')
  assert.equal(st({ max_uses: 3 }, 3), 'used_up')
  assert.equal(st({}, 1, 1), 'used')
  assert.equal(st({}, 1, 1, false), 'ok', 'without a phone yet (cart page) the per-phone check waits for checkout')
  assert.equal(st({ min_total: 600 * LYD }), 'min')
  assert.equal(st({}), 'ok')
  const onlyCompare = quote({ ...base, lines: [{ p: P(1, 500, { compare_price: 800 * LYD }), qty: 1 }], offer: null, area: area(15), code: { entered: 'X1', row: code(), uses: 0, phoneUses: 0 } })
  assert.equal(onlyCompare.code?.status, 'no_items')
  assert.equal(onlyCompare.discount, 0)
})

test('R5/R6: delivery per area, free from 1000 LYD after discount, unknown area agreed in chat, never discounted', () => {
  const q = (lyd: number, a: Area | null, more = {}) => quote({ ...base, lines: [{ p: P(1, lyd), qty: 1 }], offer: offer(), area: a, ...more })
  const paid = q(590, area(15))
  assert.equal(paid.delivery.mode, 'fee')
  assert.equal(paid.fee, 15 * LYD, 'the 24% offer does not touch the delivery fee')
  assert.equal(paid.total, 445 * LYD + 15 * LYD)
  assert.equal(q(1300, area(15)).delivery.mode, 'fee', '1300 − 24% = 985 after discount: below 1000, so delivery is paid')
  assert.equal(q(1320, area(15)).delivery.mode, 'free', '1320 − 24% = 1003.20 → 1000: free')
  assert.equal(q(1320, area(15)).total, 1000 * LYD)
  assert.equal(q(590, null).delivery.mode, 'chat')
  assert.equal(q(590, null).total, 445 * LYD)
  assert.equal(q(590, area(null)).delivery.mode, 'chat', 'no price yet → agreed in chat')
  assert.equal(q(590, area(15), { deliveryOn: false }).delivery.mode, 'off')
  assert.equal(q(590, area(15), { offer: offer({ free_delivery: 1 }) }).delivery.mode, 'free')
  assert.equal(q(5000, area(15), { freeMin: 0 }).delivery.mode, 'fee', 'freeMin 0 = never free')
})

test('codes are typed loosely', () => {
  assert.equal(normalizeCode(' sara 10 '), 'SARA10')
  assert.equal(normalizeCode('x'), '')
  assert.equal(normalizeCode("a'; drop"), '')
})
