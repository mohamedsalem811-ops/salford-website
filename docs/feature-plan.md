# Feature plan: offers, codes, delivery, tracking, customers, waiting list, reviews, trust

Status: plan final. Waiting for (1) the owner's template picks from the gallery and (2) the owner's "go" for Step 0.
Nothing is built yet.

Template gallery (owner picks one look per occasion): https://claude.ai/artifact/Rciu5G7YLovbgdYTZAhMuV

## Owner decisions (final)
- **Test database: YES.** Create `salford-site-db-test` and point the preview site at it (Step 0).
- **Offers:** one offer at a time. Price rounded DOWN to the nearest 5 LYD. Products that already have their own crossed-out
  price are skipped. Countdown on the banner. All 11 extras wanted. No store-birthday template.
- **Codes:** % or fixed amount. One use per phone per code. Never combined with another discount (the best one wins).
  **Commission: the owner sets the % per code** (e.g. an influencer's code). The report shows commission owed on DELIVERED
  orders only, worked out from the products total after the discount. Delivery is never counted. Cancelled orders are not counted.
- **Waiting list:** one-tap WhatsApp message per person (wa.me with the text filled in). Entries are deleted after 90 days.
  Built so Meta's paid automatic sending can be added later.
- **Trust page facts:** authentic boxes, original gift receipts, exchange/return only at delivery, after the customer inspects.
- **Reviews:** customers submit and the admin approves. Anyone may submit. "Verified buyer" shows when the phone matches a
  delivered order. The optional photo stays hidden until approved. Reviews also show on product pages. There is an
  "Ask for review" button on delivered orders.
- **Delivery:**
  - Prices are set per AREA: city → areas, each area with its own price.
  - Tajoura, Janzour, Qasr bin Ghashir, etc. are areas of Tripoli.
  - **City or area not in the list → delivery is agreed in chat.**
  - **Delivery time is set per area, with an "apply to whole city" button** (the button also works for price, as a shortcut).
  - Delivery is free when the products total AFTER discount is 1000 LYD or more.
  - Discounts never apply to delivery.
  - The delivery fee is ALWAYS paid in cash to the driver, whatever the payment method.
  - The customer pays delivery even if they return the item at the door.
- **Order status (what the customer sees):** new → confirmed → out for delivery (new) → delivered; or cancelled.
  "Paid" is visible to the team only. The tracking link is valid for 60 days and is included in the WhatsApp order message.
- **Customers:** same phone = same customer. Loyalty is 5% on every order after the first delivered one, never combined
  with another discount.
- **Price rules R1–R7 below: CONFIRMED by the owner.**
- **Templates:** the owner chooses one look per occasion from the gallery (3 looks each).
  - All 9 looks ship in Release 1, because a look is only colours, wording and ornaments, and Ramadan starts about 8 Feb 2027.
  - The advanced offer mechanics (spend-more tiers, free gift, flash prices, teaser, early access) stay in Release 4.
- **Release in parts.** Every item the owner did not answer uses the suggestion recorded here.

## Occasion templates
| Occasion | Date | Preview % | Look chosen |
|---|---|---|---|
| Independence Day (عيد الاستقلال) | 24 Dec 2026 | 24% | waiting |
| New Year (رأس السنة) | 1 Jan 2027 | 20% | waiting |
| Ramadan (رمضان) | about 8 Feb 2027 (moon) | 15% | waiting |
| Eid al-Fitr (عيد الفطر) | about 9 Mar 2027 (moon) | 20% | waiting |
| Mother's Day (عيد الأم) | 21 Mar 2027 | 15% | waiting |
| Eid al-Adha (عيد الأضحى) | about 16 May 2027 (moon) | 15% | waiting |
| White Friday (الجمعة البيضاء) | 26 Nov 2027 | 25% | waiting |
| Black Friday (بلاك فرايدي) | 26 Nov 2027 | 30% | waiting |
| 24-hour flash sale (عرض 24 ساعة) | any day | 30% | waiting |

- A template sets only the look: colours, strip, banner layout, ornaments, title lettering and badge style.
  The words, %, dates and products are all editable per offer.
- Looks that use Reem Kufi or Aref Ruqaa load that font only while that offer is live.
  The font comes from Google Fonts, which the current security policy already allows.
- Each look is a CSS theme plus default Arabic/English wording, stored in code. The owner picks the template in the Offers tab,
  and the banner, strip, badge and countdown follow it.

## Safety / orchestration
- **Step 0 (approved, starts on "go"):**
  1. Back up live: `wrangler d1 export salford-site-db --remote`.
  2. Create D1 `salford-site-db-test` and load that copy into it.
  3. Add `env.preview` to `wrangler.jsonc`:
     - `DB` → `salford-site-db-test`.
     - `MEDIA` → `salford-media`, shared because product photos live there. Test uploads are deleted after testing.
     - `AI`.
     - Pages does not inherit bindings into an env, so all three must be declared.
  4. Deploy preview and prove the separation: a marker setting written on the test database appears on preview, and NOT on live.
- Migrations are additive only (new tables/columns with defaults). Old code keeps working, so rollback = redeploy the previous build.
- Before each live release: `wrangler d1 export` backup, and note the D1 Time Travel timestamp.
- Features that need the owner's data ship switched OFF (delivery prices, offers, codes). The owner fills them in the LIVE admin,
  then switches them on.
- Live smoke-test order: delete only that order, by its number. Reset sqlite_sequence only if no newer order exists.

## Price rules (confirmed)
- **R1 Offer %:**
  - Applies to products in scope.
  - Never to products ticked "never discount", and never to products with their own compare_price.
  - Rounded down to 5 LYD; never below 0.
  - An offer uses EITHER % OR spend-more tiers, not both.
- **R2 Flash price:** a flash deal price replaces any other discount on that product.
- **R3 One order-level saving:** only ONE of offer (or tiers), code or loyalty applies, whichever gives the lowest products total.
- **R4 Free gift:** one per order when the products total after discount ≥ threshold. Price 0. Only if the gift is in stock.
- **R5 Delivery:**
  - The area price applies.
  - Free if the products total after discount ≥ 1000 or the offer has free delivery.
  - Unknown area → agreed in chat.
- **R6 Delivery payment:** discounts never apply to delivery, and delivery is always cash.
- **R7 Server recalculates at order time.** One module, src/lib/pricing.ts, is used by pages, /api/cart, /api/quote,
  /api/orders and the message.

## Schema (migration 0003+, additive)
- products.no_discount INTEGER DEFAULT 0
- offers(id, template, name_ar, name_en, theme, starts_at, ends_at, enabled, kind[percent|tiers|none], percent, scope JSON,
  tiers JSON, gift_product_id, gift_min, free_delivery, teaser_days, early_hours, early_token, banner_ar/en, badge_ar/en,
  caption_ar/en, created_at)
- offer_flash(id, offer_id, product_id, price|percent, starts_at, ends_at, max_orders)
- codes(id, code UNIQUE, owner, kind[percent|amount], value, min_total, starts_at, ends_at, max_uses, per_phone, enabled,
  commission_pct REAL DEFAULT 0, created_at)
- delivery_cities(id, name_ar, name_en, sort, enabled)
- delivery_areas(id, city_id, name_ar, name_en, price NULL=chat, time_ar, time_en, enabled, sort)
- orders += subtotal, discount_total, discount_kind, offer_id, offer_name, code, loyalty, area, area_id, delivery_fee, delivery_free,
  delivery_chat, delivery_time, gift
- order_items += orig_price, is_gift
- order_events(order_id, status, at, admin_id)
- waitlist(id, product_id NULL, offer_id NULL, name, phone, created_at, notified_at, ip_hash)
- reviews(id, product_id NULL, name, city, rating, text, photo_key, phone, verified, status[pending|approved|rejected], created_at, ip_hash)
- attempts(kind, ip_hash, at): rate limits for code checks, waitlist and reviews
- settings: trust page text/gallery JSON, delivery_on switch, review/waitlist switches

## Releases
1. **Prices & delivery.**
   - Pricing engine + tests.
   - Offers tab: percent, scope, schedule, rounding, banner, badge, countdown, "never discount" tick.
     **All 9 template looks** are included.
   - Codes tab + ?code= link + report with commission owed.
   - Delivery tab: cities/areas prefilled, prices empty, time per area, "apply to whole city".
   - Checkout: city → area picker + cash-delivery lines.
   - Order breakdown stored + shown in the message, the order page and admin.
   - Google offer data.
   - Aim: live before 24 Dec so the Independence Day offer can run.
2. **After the order.**
   - Statuses + events + tracker page + 60-day link + link in the message + "Send update" buttons.
   - Customers tab, returning badge, CSV export (UTF-8 BOM), loyalty 5%.
3. **Waiting list, reviews, trust.**
   - Waiting list (back in stock) + admin tab + one-tap messages.
   - Reviews: form, moderation, private photos, verified badge, product pages, ask-for-review.
   - Trust page + gallery + product-page trust line.
   - Delivery page: table + rules.
4. **Full offers.**
   - Tiers, gift, flash deals + counter, free delivery, teaser + remind-me, early access link.
   - Story/post image maker (admin canvas).
   - Admin preview mode, report, occasions calendar.

## Per-release checklist
typecheck + unit tests → deploy preview (test DB) → browser tests (iPhone/iPad/desktop, ar/en) incl. tamper tests →
owner test checklist → owner "go" → backup → migrate live → deploy → live smoke test → cleanup → report.
