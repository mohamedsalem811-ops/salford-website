-- Release 1: offers, discount codes, delivery prices per area, and the price breakdown kept on each order.
-- Additive only: the previous build keeps working on this schema. Money in dirhams (1 LYD = 1000).

-- "Never discount" tick on a product: offers and codes skip it.
ALTER TABLE products ADD COLUMN no_discount INTEGER NOT NULL DEFAULT 0;

-- One offer runs at a time (the newest enabled one whose dates cover now). Times are UTC 'YYYY-MM-DD HH:MM:SS'.
CREATE TABLE offers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  template         TEXT NOT NULL DEFAULT 'flash',   -- occasion look: ind, ny, rm, ef, md, ea, wf, bf, flash
  name_ar          TEXT NOT NULL DEFAULT '',
  name_en          TEXT NOT NULL DEFAULT '',
  theme            TEXT NOT NULL DEFAULT '',        -- reserved: another look's colours
  starts_at        TEXT NOT NULL DEFAULT '',
  ends_at          TEXT NOT NULL DEFAULT '',
  enabled          INTEGER NOT NULL DEFAULT 0,
  kind             TEXT NOT NULL DEFAULT 'percent', -- percent | tiers | none
  percent          INTEGER NOT NULL DEFAULT 0,
  scope            TEXT NOT NULL DEFAULT '{"all":true}', -- {"all":true} or {"brands":[...],"cats":[...],"products":[ids]}
  tiers            TEXT NOT NULL DEFAULT '[]',      -- Release 4
  gift_product_id  INTEGER,                         -- Release 4
  gift_min         INTEGER NOT NULL DEFAULT 0,      -- Release 4
  free_delivery    INTEGER NOT NULL DEFAULT 0,
  teaser_days      INTEGER NOT NULL DEFAULT 0,      -- Release 4
  early_hours      INTEGER NOT NULL DEFAULT 0,      -- Release 4
  early_token      TEXT NOT NULL DEFAULT '',        -- Release 4
  banner_ar        TEXT NOT NULL DEFAULT '',        -- banner title
  banner_en        TEXT NOT NULL DEFAULT '',
  sub_ar           TEXT NOT NULL DEFAULT '',        -- line under the title
  sub_en           TEXT NOT NULL DEFAULT '',
  kicker_ar        TEXT NOT NULL DEFAULT '',        -- small line above the title
  kicker_en        TEXT NOT NULL DEFAULT '',
  caption_ar       TEXT NOT NULL DEFAULT '',        -- thin strip at the top of every page
  caption_en       TEXT NOT NULL DEFAULT '',
  badge_ar         TEXT NOT NULL DEFAULT '',        -- badge on product photos ('' = "−24%")
  badge_en         TEXT NOT NULL DEFAULT '',
  show_countdown   INTEGER NOT NULL DEFAULT 1,
  show_banner      INTEGER NOT NULL DEFAULT 1,
  show_strip       INTEGER NOT NULL DEFAULT 1,
  photo_product_id INTEGER,                         -- photo looks: whose photo to show
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Discount codes. Uses are counted from orders that are not cancelled.
CREATE TABLE codes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL UNIQUE,             -- stored in capitals
  owner           TEXT NOT NULL DEFAULT '',         -- e.g. the influencer's name
  kind            TEXT NOT NULL DEFAULT 'percent',  -- percent | amount
  value           INTEGER NOT NULL DEFAULT 0,       -- whole percent, or dirhams
  min_total       INTEGER NOT NULL DEFAULT 0,       -- dirhams, products total before discount
  starts_at       TEXT NOT NULL DEFAULT '',
  ends_at         TEXT NOT NULL DEFAULT '',
  max_uses        INTEGER NOT NULL DEFAULT 0,       -- 0 = no limit
  per_phone       INTEGER NOT NULL DEFAULT 1,       -- uses per phone number
  enabled         INTEGER NOT NULL DEFAULT 1,
  commission_pct  REAL NOT NULL DEFAULT 0,
  note            TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Delivery: city → areas, each area with its own price. NULL price = agreed in chat.
CREATE TABLE delivery_cities (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar  TEXT NOT NULL,
  name_en  TEXT NOT NULL DEFAULT '',
  sort     INTEGER NOT NULL DEFAULT 0,
  enabled  INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE delivery_areas (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id  INTEGER NOT NULL REFERENCES delivery_cities(id) ON DELETE CASCADE,
  name_ar  TEXT NOT NULL,
  name_en  TEXT NOT NULL DEFAULT '',
  price    INTEGER,                                 -- dirhams; NULL = agreed in chat
  time_ar  TEXT NOT NULL DEFAULT '',
  time_en  TEXT NOT NULL DEFAULT '',
  enabled  INTEGER NOT NULL DEFAULT 1,
  sort     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX delivery_areas_city ON delivery_areas(city_id, sort);

-- The price breakdown, as it was when the order was placed. total = products after discount + known delivery fee.
ALTER TABLE orders ADD COLUMN subtotal INTEGER NOT NULL DEFAULT 0;        -- products before discount
ALTER TABLE orders ADD COLUMN discount_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount_kind TEXT NOT NULL DEFAULT '';     -- offer | code | loyalty | ''
ALTER TABLE orders ADD COLUMN offer_id INTEGER;
ALTER TABLE orders ADD COLUMN offer_name TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN loyalty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN area TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN area_id INTEGER;
ALTER TABLE orders ADD COLUMN delivery_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN delivery_free INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN delivery_chat INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN delivery_time TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN gift TEXT NOT NULL DEFAULT '';
CREATE INDEX orders_code ON orders(code, status);

ALTER TABLE order_items ADD COLUMN orig_price INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN is_gift INTEGER NOT NULL DEFAULT 0;

-- Rate limits for code checks (and later the waiting list and reviews). The address is stored only as a one-way hash.
CREATE TABLE attempts (
  kind     TEXT NOT NULL,
  ip_hash  TEXT NOT NULL,
  at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX attempts_kind ON attempts(kind, ip_hash, at);

-- Switched off until the owner fills in delivery prices. Free delivery from 1000 LYD (products after discount).
INSERT OR IGNORE INTO settings (key, value) VALUES ('delivery_on', '0'), ('free_delivery_min', '1000000');

-- Cities and areas, prices empty (agreed in chat) until the owner fills them in.
INSERT INTO delivery_cities (id, name_ar, name_en, sort) VALUES
 (1, 'طرابلس', 'Tripoli', 1), (2, 'بنغازي', 'Benghazi', 2), (3, 'مصراتة', 'Misrata', 3), (4, 'الزاوية', 'Zawiya', 4),
 (5, 'زليتن', 'Zliten', 5), (6, 'الخمس', 'Al Khums', 6), (7, 'صبراتة', 'Sabratha', 7), (8, 'صرمان', 'Surman', 8),
 (9, 'غريان', 'Gharyan', 9), (10, 'ترهونة', 'Tarhuna', 10), (11, 'سرت', 'Sirte', 11), (12, 'البيضاء', 'Bayda', 12),
 (13, 'درنة', 'Derna', 13), (14, 'طبرق', 'Tobruk', 14), (15, 'المرج', 'Marj', 15), (16, 'أجدابيا', 'Ajdabiya', 16),
 (17, 'سبها', 'Sabha', 17), (18, 'بني وليد', 'Bani Walid', 18), (19, 'الزنتان', 'Zintan', 19), (20, 'يفرن', 'Yafran', 20),
 (21, 'نالوت', 'Nalut', 21), (22, 'زوارة', 'Zuwara', 22), (23, 'شحات', 'Shahat', 23), (24, 'الكفرة', 'Kufra', 24), (25, 'مسلاتة', 'Msallata', 25), (26, 'القره بوللي', 'Garabulli', 26),
 (27, 'العجيلات', 'Al Ajaylat', 27), (28, 'غدامس', 'Ghadames', 28);

INSERT INTO delivery_areas (city_id, name_ar, name_en, sort) VALUES
 (1, 'وسط المدينة', 'City centre', 1), (1, 'حي الأندلس', 'Hay Al Andalus', 2), (1, 'قرقارش', 'Gargaresh', 3),
 (1, 'السراج', 'Al Siraj', 4), (1, 'جنزور', 'Janzour', 5), (1, 'سوق الجمعة', 'Souq Al Juma', 6),
 (1, 'تاجوراء', 'Tajoura', 7), (1, 'عين زارة', 'Ain Zara', 8), (1, 'أبو سليم', 'Abu Salim', 9),
 (1, 'الفرناج', 'Al Fernaj', 10), (1, 'صلاح الدين', 'Salah Al Din', 11), (1, 'الهضبة', 'Al Hadba', 12),
 (1, 'طريق المطار', 'Airport Road', 13), (1, 'النوفليين', 'Al Nofliyen', 14), (1, 'الظهرة', 'Al Dahra', 15),
 (1, 'بن عاشور', 'Ben Ashour', 16), (1, 'زاوية الدهماني', 'Zawiyat Al Dahmani', 17), (1, 'الدريبي', 'Al Dreibi', 18),
 (1, 'قصر بن غشير', 'Qasr bin Ghashir', 19), (1, 'السواني', 'Al Swani', 20), (1, 'الكريمية', 'Al Karimiya', 21),
 (2, 'وسط المدينة', 'City centre', 1), (2, 'الفويهات', 'Al Fuwayhat', 2), (2, 'الحدائق', 'Al Hadaiq', 3),
 (2, 'الكيش', 'Al Keish', 4), (2, 'السلماني', 'Al Salmani', 5), (2, 'الليثي', 'Al Laithi', 6),
 (2, 'بوعطني', 'Bu Atni', 7), (2, 'الهواري', 'Al Hawari', 8), (2, 'قاريونس', 'Garyounis', 9),
 (2, 'سيدي حسين', 'Sidi Hussein', 10), (2, 'القوارشة', 'Al Guwarsha', 11), (2, 'بوهديمة', 'Bu Hdeima', 12),
 (3, 'كل المناطق', 'All areas', 1), (4, 'كل المناطق', 'All areas', 1), (5, 'كل المناطق', 'All areas', 1),
 (6, 'كل المناطق', 'All areas', 1), (7, 'كل المناطق', 'All areas', 1), (8, 'كل المناطق', 'All areas', 1),
 (9, 'كل المناطق', 'All areas', 1), (10, 'كل المناطق', 'All areas', 1), (11, 'كل المناطق', 'All areas', 1),
 (12, 'كل المناطق', 'All areas', 1), (13, 'كل المناطق', 'All areas', 1), (14, 'كل المناطق', 'All areas', 1),
 (15, 'كل المناطق', 'All areas', 1), (16, 'كل المناطق', 'All areas', 1), (17, 'كل المناطق', 'All areas', 1),
 (18, 'كل المناطق', 'All areas', 1), (19, 'كل المناطق', 'All areas', 1), (20, 'كل المناطق', 'All areas', 1),
 (21, 'كل المناطق', 'All areas', 1), (22, 'كل المناطق', 'All areas', 1), (23, 'كل المناطق', 'All areas', 1),
 (24, 'كل المناطق', 'All areas', 1), (25, 'كل المناطق', 'All areas', 1), (26, 'كل المناطق', 'All areas', 1),
 (27, 'كل المناطق', 'All areas', 1), (28, 'كل المناطق', 'All areas', 1);
