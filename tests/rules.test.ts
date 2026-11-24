// Small checks for the rules customers and the admin hit most. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhone, waNumber, igHandle, fbPage, buildMessage } from '../src/lib/orders'
import { listFrom, type Catalog } from '../src/lib/catalog'
import type { Product, Media } from '../src/lib/db'

test('Libyan phone numbers', () => {
  assert.equal(normalizePhone('0912345678'), '0912345678')
  assert.equal(normalizePhone('٠٩١٢٣٤٥٦٧٨'), '0912345678') // Arabic keyboard
  assert.equal(normalizePhone('۰۹۲۲۳۴۵۶۷۸'), '0922345678') // Persian digits
  assert.equal(normalizePhone('+218 91 234 5678'), '0912345678')
  assert.equal(normalizePhone('00218-94-1234567'), '0941234567')
  assert.equal(normalizePhone('912345678'), '0912345678')
  assert.equal(normalizePhone('0981234567'), null) // not a Libyan mobile
  assert.equal(normalizePhone('12345'), null)
})

test('WhatsApp number setting', () => {
  assert.equal(waNumber('0912345678'), '218912345678')
  assert.equal(waNumber('912345678'), '218912345678')
  assert.equal(waNumber('+218 91 234 5678'), '218912345678')
  assert.equal(waNumber('00218912345678'), '218912345678')
  assert.equal(waNumber('٠٩١٢٣٤٥٦٧٨'), '218912345678')
})

test('Instagram setting', () => {
  assert.equal(igHandle('https://www.instagram.com/salford.libya?igsh=MXg2dGx1'), 'salford.libya')
  assert.equal(igHandle('instagram.com/salford.libya/'), 'salford.libya')
  assert.equal(igHandle('@salford.libya'), 'salford.libya')
  assert.equal(igHandle('salford.libya'), 'salford.libya')
  assert.equal(igHandle('https://ig.me/m/salford.libya'), 'salford.libya')
  assert.equal(igHandle('https://www.instagram.com/p/C123abc/'), '')
})

test('Facebook page setting', () => {
  assert.equal(fbPage('https://www.facebook.com/SalfordLibya'), 'SalfordLibya')
  assert.equal(fbPage('https://www.facebook.com/profile.php?id=100012345'), '100012345')
  assert.equal(fbPage('https://www.facebook.com/people/Salford/100012345/'), '100012345')
})

test('order message carries everything needed to confirm', () => {
  const msg = buildMessage({
    lang: 'ar', number: 'SL-1001', total: 250000, name: 'سارة', phone: '0912345678', city: 'بنغازي', address: 'الفويهات', note: 'هدية', payment: 'cod_cash',
    lines: [{ brand: 'Swarovski', name: 'Swan Pendant', code: '5732414', price: 250000, qty: 1 }],
  })
  for (const part of ['SL-1001', 'Swan Pendant', '5732414', '250', 'سارة', '0912345678', 'بنغازي', 'الفويهات', 'هدية', 'نقداً']) assert.ok(msg.includes(part), part)
  const en = buildMessage({ lang: 'en', number: 'SL-1002', total: 1000, name: 'A', phone: '0911111111', city: 'Tripoli', address: '', note: '', payment: 'lypay', lines: [] })
  assert.ok(!en.includes('Address:') && !en.includes('Note:'))
})

test('catalog search and filters (in memory)', () => {
  const p = (id: number, o: Partial<Product>): Product => ({
    id, legacy_id: null, code: String(1000 + id), brand_id: 'swarovski', category_id: 'necklaces', name_en: `Item ${id}`, name_ar: '', short_en: '', short_ar: '', desc_en: '', desc_ar: '',
    price: 100000, compare_price: null, is_set: 0, set_codes: '[]', in_stock: 1, is_new: 0, best_seller: 0, status: 'live', sort: 0, created_at: '', updated_at: '', deleted_at: null, ...o,
  })
  const img = (product_id: number) => ({ id: product_id, product_id, kind: 'image', source: 'upload', url: '', r2_key: 'k', sizes: '[]', width: null, height: null, bytes: null, sort: 0, status: 'ok', checked_at: null }) as Media
  const products = [
    p(1, { name_en: 'Iconic Swan Pendant', is_new: 1, price: 300000 }),
    p(2, { name_en: 'Tennis Bracelet', category_id: 'bracelets', price: 200000 }),
    p(3, { name_en: 'Hidden Swan', price: 50000 }), // no photo: never listed
    p(4, { name_en: 'Return to Tiffany', brand_id: 'tiffany', code: 'TF-77' }),
  ]
  const cat = { v: '1', checkedAt: 0, loadedAt: 0, brands: [], allBrands: [], cats: [], shopBrands: [], shopCats: [], settings: {}, products, byId: new Map(products.map((x) => [x.id, x])), media: new Map([1, 2, 4].map((id) => [id, [img(id)]])) } as Catalog
  const ids = (o: Parameters<typeof listFrom>[1]) => listFrom(cat, o).map((x) => x.id)
  assert.deepEqual(ids({}), [1, 2, 4])
  assert.deepEqual(ids({ q: 'swan' }), [1])
  assert.deepEqual(ids({ q: 'سوار' }), [2]) // Arabic word → category
  assert.deepEqual(ids({ q: 'tf-77' }), [4])
  assert.deepEqual(ids({ brand: 'tiffany' }), [4])
  assert.deepEqual(ids({ flag: 'new' }), [1])
  assert.deepEqual(ids({ sort: 'low' }), [4, 2, 1])
  assert.deepEqual(ids({ exclude: 1, limit: 1 }), [2])
})
