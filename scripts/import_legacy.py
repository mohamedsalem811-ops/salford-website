#!/usr/bin/env python3
"""Convert the old site's D1 export (products + settings) into SQL for the new schema.

Usage: python3 scripts/import_legacy.py export/products-raw.json export/settings-raw.json > export/import.sql

Idempotent: products are upserted by legacy_id. Photo and video links are only
added when the product doesn't have that link yet, so safe copies, photo order and
uploads made in the new admin are kept. Arabic texts are kept unless the English
text changed on the old site (then they are cleared, and "Translate missing" in
the admin fills them again).
"""
import json
import re
import sys

ARABIC = re.compile(r'[\u0600-\u06FF]')


def split_ar(text):
    """Old descriptions sometimes hold an Arabic block and an English block. Returns (en, ar)."""
    lines = (text or '').replace('**', '').split('\n')
    idx = [i for i, l in enumerate(lines) if ARABIC.search(l)]
    if not idx:
        return (text or '').replace('**', '').strip(), ''
    a, b = idx[0], idx[-1]
    ar = '\n'.join(lines[a:b + 1]).strip()
    en = '\n'.join(lines[:a] + lines[b + 1:]).strip()
    return re.sub(r'\n{3,}', '\n\n', en), re.sub(r'\n{3,}', '\n\n', ar)

VIDEO_EXT = ('.mp4', '.webm', '.mov', '.m4v')
BRANDS = {'swarovski', 'tiffany', 'apm', 'pandora'}
CATS = {'necklaces', 'earrings', 'bracelets', 'rings', 'sets'}


def q(v):
    if v is None:
        return 'NULL'
    if isinstance(v, (int, float)):
        return str(int(v))
    return "'" + str(v).replace("'", "''") + "'"


def rows_of(path):
    data = json.load(open(path, encoding='utf-8'))
    return data['result'][0]['results'] if isinstance(data, dict) else data


def jlist(s):
    if not s or s == 'None':
        return []
    try:
        v = json.loads(s)
        return v if isinstance(v, list) else []
    except ValueError:
        return []


def media_of(r):
    items = []
    for m in jlist(r.get('media_items')):
        if isinstance(m, dict) and m.get('data'):
            items.append((m.get('type') or 'image', m['data']))
    if not items:
        imgs = jlist(r.get('images')) or ([r['image']] if r.get('image') else [])
        items = [('image', u) for u in imgs if u]
    seen, out = set(), []
    for kind, url in items:
        url = url.strip()
        if not url or url in seen:
            continue
        seen.add(url)
        if url.lower().split('?')[0].endswith(VIDEO_EXT):
            kind = 'video'
        out.append((kind if kind in ('image', 'video') else 'image', url))
    return out


def main():
    products = rows_of(sys.argv[1])
    settings = {r['key']: r['value'] for r in rows_of(sys.argv[2])} if len(sys.argv) > 2 else {}
    out = ['PRAGMA defer_foreign_keys = ON;']
    for i, r in enumerate(products):
        brand = (r.get('brand') or 'swarovski').lower()
        brand = brand if brand in BRANDS else 'swarovski'
        is_set = str(r.get('is_set')) == '1' or r.get('category') == 'sets'
        cat = 'sets' if is_set else (r.get('category') if r.get('category') in CATS else 'necklaces')
        media = media_of(r)
        price = int(round(float(r.get('price') or 0) * 1000))
        orig = r.get('original_price')
        compare = int(round(float(orig) * 1000)) if orig not in (None, 'None', '', 0) else None
        legacy = str(r['id'])
        desc_en, desc_ar = split_ar(r.get('description') or '')
        short_en = (r.get('short_desc') or '').strip()
        out.append(
            'INSERT INTO products (legacy_id, code, brand_id, category_id, name_en, short_en, desc_en, desc_ar, price, compare_price,'
            ' is_set, set_codes, in_stock, is_new, status, sort) VALUES ('
            + ', '.join([
                q(legacy), q(r.get('code') or ''), q(brand), q(cat), q(r.get('name') or ''),
                q(short_en), q(desc_en), q(desc_ar), q(price), q(compare),
                q(1 if is_set else 0), q(json.dumps(jlist(r.get('set_codes')))),
                q(1 if str(r.get('in_stock')) == '1' else 0), q(1 if str(r.get('featured')) == '1' else 0),
                q('live' if media else 'hidden'), q(i),
            ])
            + ') ON CONFLICT(legacy_id) DO UPDATE SET code=excluded.code, brand_id=excluded.brand_id,'
            ' category_id=excluded.category_id, name_en=excluded.name_en,'
            " short_ar=CASE WHEN products.short_en=excluded.short_en THEN products.short_ar ELSE '' END,"
            " desc_ar=CASE WHEN excluded.desc_ar<>'' THEN excluded.desc_ar WHEN products.desc_en=excluded.desc_en THEN products.desc_ar ELSE '' END,"
            ' short_en=excluded.short_en, desc_en=excluded.desc_en, price=excluded.price, compare_price=excluded.compare_price,'
            " is_set=excluded.is_set, set_codes=excluded.set_codes, in_stock=excluded.in_stock,"
            " updated_at=datetime('now');"
        )
        for s, (kind, url) in enumerate(media):
            out.append(
                f"INSERT INTO media (product_id, kind, source, url, sort) SELECT p.id, {q(kind)}, 'link', {q(url)},"
                f" (SELECT coalesce(max(sort) + 1, 0) FROM media WHERE product_id = p.id)"
                f" FROM products p WHERE p.legacy_id={q(legacy)}"
                f" AND NOT EXISTS (SELECT 1 FROM media m WHERE m.product_id = p.id AND m.url = {q(url)});"
            )
    for old, new in (('facebookUrl', 'facebook'), ('instagramUrl', 'instagram'), ('whatsappNumber', 'whatsapp')):
        if settings.get(old):
            out.append(f"UPDATE settings SET value={q(settings[old])} WHERE key={q(new)} AND value='';")
    # the shop keeps its catalog in memory; a new version makes it reload
    out.append("INSERT INTO settings (key, value) VALUES ('catalog_v', lower(hex(randomblob(6)))) ON CONFLICT(key) DO UPDATE SET value = excluded.value;")
    print('\n'.join(out))


if __name__ == '__main__':
    main()
