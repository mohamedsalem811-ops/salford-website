# Feature plan: offers, codes, delivery, tracking, customers, waiting list, reviews, trust

Status: **Release 4 live (27 Nov 2026). All four releases are done.** Release 1 (offers, codes, delivery), Release 2 (statuses,
tracker, customers, loyalty), Release 3 (waiting list, reviews, trust page, delivery page) and Release 4 (full offers) are live.
Loyalty, the waiting list and reviews ship switched off; the owner turns them on in Admin → Customers / Waiting list / Reviews.
Free delivery from 1,000 LYD has its own on/off switch in Admin → Delivery. The Release 4 extras are used only when an offer
is set up with them (none of the live offers uses them).

Full inspection (27 Nov 2026, after Release 4): every source file read; all 148 sitemap pages plus cart/checkout/offer/404
pages crawled live on iPhone, iPad and desktop (no script errors, no sideways scroll, no broken images or links, SEO tags,
hreflang, Arabic pages free of English); every admin page opened on the preview on iPhone, iPad and desktop; live data audited.
Fixed and released:
- Trust page: its section shared the `.trust` class with the home page's three-icon strip, so it was squeezed into a
  3-column grid on every device since Release 3. It now uses `.trustpg`.
- Content security policy now allows Cloudflare's visitor statistics script (it was blocked on every page).
- `/m/…` range requests: no more server errors on reversed or out-of-file ranges; correct `content-range` when a range runs
  past the end. (Cached files are answered by Cloudflare's cache, which handles ranges itself.)
- Order page: the browser tab shows the real status (it always said "ready").
- Countdown: reloads once when an offer starts or ends instead of sitting at 00:00:00.
- Cancelling an order (or undoing a cancel) with flash-deal pieces refreshes the shop's "only X left".
- Admin: trust form errors in red; photo reorder/remove failures show a message; finishing a video upload re-checks the
  one-video limit; delivery table and code link fields have screen-reader names; reminders table says "Delivered orders".
- Backup before release `live-before-inspection-fixes-20261127-1431.sql` (kept outside the repo); D1 Time Travel bookmark
  `0000034a-00000000-00005130-139af22c6a34411a14e77ff27d1e4806`. Code only, no database change. Live checks were read-only.
Owner content still empty (not bugs): Arabic product names (English shows), About/Contact/Delivery/Trust texts and the
trust gallery; no APM or ring products yet (the About text mentions APM Monaco); no discount codes yet.

Release 4 record:
- Offer kinds: one % off, "spend more, save more" (up to 4 levels by products total after discount; each level needs a bigger
  amount and gives a bigger %; default words say "up to N%"), or "no % off" (extras only, needs at least one extra).
- Flash deals: one line per product `code, price` or `code, N%`, optional piece limit. A flash price replaces every other
  discount on that piece (R2). Shop shows "only X left"; the counter drops with each order (cancelled orders give pieces back);
  a cart asking for more than is left gets the normal price with a note. The cart re-reads the pieces left fresh, so a sold-out
  deal never shows its flash price; orders are always recalculated (R7). Saving the same lines keeps their sold counts.
- Free gift: one product, given once per order when the products total after discount reaches the amount and the gift is in
  stock (R4); a 0 LYD line marked 🎁 in the cart, checkout, message, order page and admin.
- Free delivery counts for extras-only offers too.
- "Coming soon": N days before the start a strip + banner count down; `/<lang>/offer` has "Remind me" (name + phone, one
  entry per phone, honeypot + spam limit, deleted after 90 days). Admin → offer → "Reminders and early access" lists them with
  one-tap WhatsApp messages once the offer starts.
- Early access: each offer has a private link (`/?early=…`, 32-hex token, HttpOnly cookie) that opens it N hours before
  everyone else; the people page lists returning customers (a delivered order) with one-tap messages and a "sent" mark.
  Orders placed that way are marked early.
- After-offer report (orders, sales, discount, average, compared with the same length of time before; gift/flash/early/
  remind-me counts; top products). Admin previews: `?offer_preview=ID` and `?teaser_preview=ID`.
- Occasions calendar (Admin → Calendar), prefilled with 8 occasions (the 9th look, the 24-hour flash sale, has no date); a "Coming up" card on the admin home within each
  occasion's reminder days when no offer covers it, with a ready "Create the offer" link.
- Instagram image maker (Admin → offer → Instagram images): story 1080×1920 or post 1080×1080, Arabic or English, the look's
  colours and words, up to 3 product photos; Share (iPad/iPhone share sheet) or Download PNG.
- Tests: 62 unit/route tests (6 route + pricing tests new for R4). Browser tests on the preview (test DB): 136 checks on
  iPhone/iPad/desktop × ar/en: offer form on iPad, flash counter, levels and gift in cart and checkout, coming soon + Remind me,
  early link, report, image maker (drawn + download), calendar + admin home reminder, and tamper checks (forged gift/price/
  discount fields, Remind me on a running offer, honeypot, admin pages and APIs without a login, made-up early token).
- Before going live: backup `live-20261127-140109.sql` (kept outside the repo); D1 Time Travel bookmark
  `00000343-00000000-00005130-7747b4ea9fc3ee3df1c1a3d0f9cf3b71`.
- Live smoke test: Black Friday unchanged (15%, strip/banner, no coming soon, no flash/levels/gift), admin offers/offer form/
  people/report/image/calendar on iPad, one test occasion added and removed; the temporary admin session was deleted.

Release 3 record:
- Waiting list (sold-out pieces only): name + phone on the product page; one entry per phone per piece (signing up again just
  updates it); entries older than 90 days are deleted. Admin → Waiting list puts pieces that are back in stock first, with a
  one-tap WhatsApp message per person and a "Sent" mark. Built so Meta's paid automatic sending can be added later.
- Reviews: anyone can send one (stars, text, optional JPEG/WebP photo up to 3 MB, stored with EXIF/GPS removed);
  nothing shows until approved. The photo stays private (team only) until approved; "approve without photo" deletes it.
  "Verified buyer" only when the phone matches a delivered order, or the review comes from the order's own link.
  Approved reviews show on the product page (with Google star data) and the trust page.
  Order page: "Ask for a review" button once Delivered (uses the 60-day order link).
- Trust page (`/page/trust`): fixed facts (authentic boxes, original gift receipts, exchange/return only at the door after
  inspecting) + the owner's own text + photo gallery with captions (Admin → Trust page). Trust line on every product page.
- Delivery page (`/page/delivery`): price table by city/area + rules (discounts never apply to delivery; delivery is always
  paid in cash; the customer pays delivery even when returning at the door; unknown area → agreed in chat).
- Private pages (order tracker, review link) send no referrer; other pages send strict-origin-when-cross-origin.
- Tests: 46 unit/route tests (10 new for R3). Browser tests on the preview (test DB): 153 checks on iPhone/iPad/desktop × ar/en,
  incl. tamper checks (private photo URLs, forged "verified"/status, bad ratings, oversize/PNG photos, honeypot, guessed order
  links, waiting list on an in-stock piece, spam limits) and moderation, waiting-list sending, the order-link review flow and
  the trust editor on iPad.
- Before going live: backup `live-20261127T130836Z.sql` (kept outside the repo); D1 Time Travel bookmark
  `00000334-00000000-00005130-df7fe9098caf8de9e2d553c67da22773`.
- Live smoke test: trust/delivery pages ar/en, product trust line, admin Reviews/Waiting list/Trust page, switches Off,
  review/waiting-list sign-up refused while Off, "Ask for a review" card shows the switched-off note; the temporary admin
  session was deleted afterwards and no test rows were left.

Release 2 record:
- Customer-facing statuses: New → Confirmed → Out for delivery → Delivered, or Cancelled. "Paid" is a separate team-only tick
  (old "paid" orders became Confirmed + Paid in migration 0004). Every status change is stored in `order_events` with the admin.
- Tracker on the order page; the link (`/<lang>/order/SL-x?t=…`) works for 60 days and is the last line of the WhatsApp message.
- Admin order page: status + Paid + team note, history, "Send update" buttons (WhatsApp message in the customer's language,
  with the tracking link; none on Cancelled).
- Customers tab: one phone number = one customer; Returning = 2+ orders that were not cancelled; CSV with UTF-8 BOM,
  spreadsheet formulas made harmless.
- Loyalty: % off (default 5, 1–50) once the phone has a delivered order; never added to an offer or code, the biggest saving wins.
- Tests: 36 unit/route tests (7 new). Browser tests on the preview (test DB): orders on iPhone/iPad/desktop × ar/en,
  admin status walk on iPad, cancelled tracker, customers tab + search + filter + CSV download, loyalty on/off through the form
  (5% correctly lost to the 24% test offer; 30% won and showed in checkout and the message), tamper checks
  (fake statuses, unknown order, 90% loyalty, no login, wrong tracking token).
- Before going live: backup `live-20261127T122742Z.sql` (kept outside the repo); D1 Time Travel point 2026-11-27 12:27:42 UTC
  (bookmark `00000329-00000000-00005130-6f660b712d0f056a44ea2f2be9e9b83c`).
- Live smoke test: pages, one order with the tracking link on salfordlibya.com, tracker, admin Orders/Customers, Send update link,
  CSV; the test order (SL-1003) and the temporary admin session were deleted afterwards.

Release 1 record:
- Tests: 29 unit/route tests (pricing, features-off message identical, offers, codes, guessing limit, delivery, tamper, admin).
- Browser tests on the preview (test DB): iPhone, iPad, desktop × ar/en; admin setup done through the real forms on iPad; all 9 looks screenshotted.
- Before going live: backup `live-20261127T113021Z.sql` (kept outside the repo); D1 Time Travel point 2026-11-27 11:30:19 UTC.
- Live smoke test: pages, assets, admin tabs, one order with features off (deleted afterwards).
- Prices under an offer or a percent code are rounded down to a whole 5 LYD (590 − 24% → 445).
- The code-guessing limit (20 wrong codes per hour) counts per connection.

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
| Independence Day (عيد الاستقلال) | 24 Dec 2026 | 24% | C: Salford colours + small flag |
| New Year (رأس السنة) | 1 Jan 2027 | 20% | A: midnight and gold |
| Ramadan (رمضان) | about 8 Feb 2027 (moon) | 15% | C: cream and gold |
| Eid al-Fitr (عيد الفطر) | about 9 Mar 2027 (moon) | 20% | A: cream and gold stars |
| Mother's Day (عيد الأم) | 21 Mar 2027 | 15% | A: blush flowers |
| Eid al-Adha (عيد الأضحى) | about 16 May 2027 (moon) | 15% | C: Salford colours + lanterns |
| White Friday (الجمعة البيضاء) | 26 Nov 2027 | 25% | C: white and mauve with photo |
| Black Friday (بلاك فرايدي) | 26 Nov 2027 | 30% | A: black and gold |
| 24-hour flash sale (عرض 24 ساعة) | any day | 30% | A: pink alert |

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
- **Step 0 result (27 Nov 2026):**
  - Backup of live taken first (kept outside the repo).
  - `salford-site-db-test` (9303f8ba-…) holds a copy of live. Row counts matched table by table.
  - The test copy's one order has a dummy name, phone and address. Its login sessions are cleared, and it has the setting `env_marker = TEST-DB`.
  - The preview deployment reads the test database:
    - Text written only to the test copy showed on preview's About page and not on salfordlibya.com.
    - Live has no marker, and its 1 order is unchanged.
  - Deploy note: the session's credential proxy replaces the upload ticket on `/pages/assets/check-missing`.
    - When no static file changed, a deploy works if that check is skipped.
    - A release that adds new static files needs the upload to work. Otherwise those files must be served by the worker.
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
