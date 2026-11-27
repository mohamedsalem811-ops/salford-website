# Feature plan — offers, codes, delivery, tracking, customers, waiting list, reviews, trust

Status: waiting for owner answers (see chat). Nothing built yet.

## Owner decisions (recorded)
- Sale/offers: one offer at a time; round DOWN to nearest 5 LYD; skip products that have their own crossed-out price;
  countdown on banner; templates incl. Black Friday AND White Friday (الجمعة البيضاء); all 11 extras; no store-birthday template.
- Codes: % and fixed amount; one use per phone per code; never combined with another discount (best one wins).
  Commission: OPEN QUESTION.
- Waiting list: one-tap WhatsApp per person (wa.me with prefilled text); auto-delete after 90 days. Built so Meta Cloud API
  can be plugged in later.
- Trust page facts: authentic boxes, original gift receipts, exchange/return only at delivery after the customer inspects.
- Reviews: customers submit, admin approves; anyone may submit; "Verified buyer" when phone matches a delivered order;
  optional photo (hidden until approved); on product pages too; "Ask for review" button on delivered orders.
- Delivery: price AND area level (city → area, each area its own price); Tajoura/Janzour/Qasr bin Ghashir etc. are
  areas of Tripoli; unknown city → agreed in chat; free delivery when products total AFTER discount ≥ 1000 LYD;
  discounts never apply to delivery; delivery fee ALWAYS cash to the driver (whatever the payment method);
  customer pays delivery even when returning at the door.
- Order status (customer view): new → confirmed → out_for_delivery (new) → delivered; cancelled. "paid" = team only.
  Tracking link valid 60 days (was 30). Tracking link included in the WhatsApp order message.
- Customers: same phone = same customer; loyalty 5% on every order after the first delivered one; never combined.
- Release in parts.

## Safety / orchestration
- Preview and production currently share D1 `salford-site-db`. Plan: create `salford-site-db-test` (copy of live),
  bind preview to it. Tests never touch live data. (Needs owner OK.)
- Migrations additive only (new tables/columns with defaults). Old code keeps working → rollback = redeploy previous build.
- Before each live release: `wrangler d1 export` backup + note D1 Time Travel timestamp.
- Features needing owner data ship switched off (delivery prices, offers, codes); owner fills them in LIVE admin, then switches on.
- Live smoke-test order: delete only that order by number; reset sqlite_sequence only if no newer order exists.

## Price rules (to confirm with owner)
- R1 Offer % applies to products in scope, not "never discount", not with own compare_price; rounded down to 5 LYD; never below 0.
  An offer uses EITHER % OR spend-more tiers, not both.
- R2 Flash deal price replaces any other discount on that product.
- R3 Only ONE order-level saving: offer (or tiers) vs code vs loyalty → whichever gives the lowest products total.
- R4 Free gift: one per order when products total after discount ≥ threshold; price 0; only if gift in stock.
- R5 Delivery: area price; free if products total after discount ≥ 1000 or offer has free delivery; unknown area → chat.
- R6 Discounts never apply to delivery. Delivery always cash.
- R7 Server recalculates at order time (single module src/lib/pricing.ts used by pages, /api/cart, /api/quote, /api/orders, message).

## Schema (migration 0003+, additive)
- products.no_discount INTEGER DEFAULT 0
- offers(id, template, name_ar, name_en, theme, starts_at, ends_at, enabled, kind[percent|tiers|none], percent, scope JSON,
  tiers JSON, gift_product_id, gift_min, free_delivery, teaser_days, early_hours, early_token, banner_ar/en, badge_ar/en,
  caption_ar/en, created_at)
- offer_flash(id, offer_id, product_id, price|percent, starts_at, ends_at, max_orders)
- codes(id, code UNIQUE, owner, kind[percent|amount], value, min_total, starts_at, ends_at, max_uses, per_phone, enabled, commission_pct?, created_at)
- delivery_cities(id, name_ar, name_en, sort, enabled); delivery_areas(id, city_id, name_ar, name_en, price NULL=chat, time_ar, time_en, enabled, sort)
- orders += subtotal, discount_total, discount_kind, offer_id, offer_name, code, loyalty, area, area_id, delivery_fee, delivery_free,
  delivery_chat, delivery_time, gift
- order_items += orig_price, is_gift
- order_events(order_id, status, at, admin_id)
- waitlist(id, product_id NULL, offer_id NULL, name, phone, created_at, notified_at, ip_hash)
- reviews(id, product_id NULL, name, city, rating, text, photo_key, phone, verified, status[pending|approved|rejected], created_at, ip_hash)
- attempts(kind, ip_hash, at) — rate limits for code checks, waitlist, reviews
- settings: trust page text/gallery JSON, delivery_on switch, review/waitlist switches

## Releases
1. Prices & delivery: pricing engine + tests; Offers tab (percent, scope, schedule, rounding, banner, badge, countdown, never-discount
   tick) with first templates; Codes tab + ?code= link + report; Delivery tab (cities/areas prefilled, prices empty) + checkout
   city→area picker + cash-delivery lines; order breakdown stored + message + order page + admin; Google offer data.
2. After the order: statuses + events + tracker page + 60-day link + link in message + "Send update" buttons; Customers tab,
   returning badge, CSV export (UTF-8 BOM), loyalty 5%.
3. Waiting list (back in stock) + admin tab + one-tap messages; reviews (form, moderation, private photos, verified badge,
   product pages, ask-for-review); trust page + gallery + product-page trust line; delivery page table + rules.
4. Full offers: all templates/themes, tiers, gift, flash deals + counter, free delivery, teaser + remind-me, early access link,
   story/post image maker (admin canvas), admin preview mode, report, occasions calendar.

## Per-release checklist
typecheck + unit tests → deploy preview (test DB) → browser tests (iPhone/iPad/desktop, ar/en) incl. tamper tests →
owner test checklist → owner "go" → backup → migrate live → deploy → live smoke test → cleanup → report.
