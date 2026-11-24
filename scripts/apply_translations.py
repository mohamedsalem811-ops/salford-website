#!/usr/bin/env python3
"""SQL that fills the Arabic short line and description from scripts/translations_ar.json.

Usage: python3 scripts/apply_translations.py texts.json > export/translations.sql
texts.json is `wrangler d1 execute salford-site-db --remote --json --command
"SELECT id, desc_en FROM products"`. Entries marked "split" take the Arabic block
that is already inside the English description and keep only the English part there.
Only fills Arabic fields that are still empty, so edits made in the admin are kept.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from import_legacy import q, split_ar  # noqa: E402

tr = json.load(open(os.path.join(os.path.dirname(__file__), 'translations_ar.json')))
rows = {str(r['id']): r for r in json.load(open(sys.argv[1]))[0]['results']}
out = []
for pid, t in tr.items():
    if pid not in rows:
        continue
    out.append(f"UPDATE products SET short_ar={q(t['short_ar'])} WHERE id={pid} AND short_ar='';")
    if t.get('split'):
        en, ar = split_ar(rows[pid]['desc_en'])
        out.append(f"UPDATE products SET desc_en={q(en)}, desc_ar={q(ar)} WHERE id={pid} AND desc_ar='';")
    elif t.get('desc_ar'):
        out.append(f"UPDATE products SET desc_ar={q(t['desc_ar'])} WHERE id={pid} AND desc_ar='';")
print('\n'.join(out))
