-- Salford Libya — new site schema. Money is stored in dirhams (1 LYD = 1000 dirhams).

CREATE TABLE brands (
  id        TEXT PRIMARY KEY,            -- slug: swarovski, tiffany, apm, pandora
  name      TEXT NOT NULL,
  story_ar  TEXT NOT NULL DEFAULT '',
  story_en  TEXT NOT NULL DEFAULT '',
  tint      TEXT NOT NULL DEFAULT 'swa',
  sort      INTEGER NOT NULL DEFAULT 0,
  visible   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE categories (
  id       TEXT PRIMARY KEY,             -- necklaces, earrings, bracelets, rings, sets
  name_ar  TEXT NOT NULL,
  name_en  TEXT NOT NULL,
  sort     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  legacy_id      TEXT UNIQUE,            -- id on the old site, for redirects
  code           TEXT NOT NULL,
  brand_id       TEXT NOT NULL REFERENCES brands(id),
  category_id    TEXT NOT NULL REFERENCES categories(id),
  name_en        TEXT NOT NULL DEFAULT '',
  name_ar        TEXT NOT NULL DEFAULT '',
  short_en       TEXT NOT NULL DEFAULT '',
  short_ar       TEXT NOT NULL DEFAULT '',
  desc_en        TEXT NOT NULL DEFAULT '',
  desc_ar        TEXT NOT NULL DEFAULT '',
  price          INTEGER NOT NULL DEFAULT 0,   -- dirhams
  compare_price  INTEGER,                      -- dirhams, crossed-out price
  is_set         INTEGER NOT NULL DEFAULT 0,
  set_codes      TEXT NOT NULL DEFAULT '[]',   -- JSON array
  in_stock       INTEGER NOT NULL DEFAULT 1,
  is_new         INTEGER NOT NULL DEFAULT 0,
  best_seller    INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'live', -- live | draft | hidden
  sort           INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at     TEXT
);
CREATE INDEX products_brand ON products(brand_id, status);
CREATE INDEX products_cat ON products(category_id, status);
CREATE INDEX products_code ON products(code);

CREATE TABLE media (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'image',  -- image | video | youtube
  source      TEXT NOT NULL DEFAULT 'link',   -- link | upload
  url         TEXT NOT NULL DEFAULT '',       -- original link (source = link)
  r2_key      TEXT,                           -- safe copy or uploaded file (base key)
  sizes       TEXT NOT NULL DEFAULT '[]',     -- JSON array of widths stored for uploads, e.g. [400,900,1800]
  width       INTEGER,
  height      INTEGER,
  bytes       INTEGER,
  sort        INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'unchecked', -- ok | broken | unchecked
  checked_at  TEXT
);
CREATE INDEX media_product ON media(product_id, sort);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  number      TEXT UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  city        TEXT NOT NULL,
  address     TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  payment     TEXT NOT NULL,                 -- cod_cash | cod_card | lypay
  channel     TEXT NOT NULL DEFAULT '',      -- whatsapp | messenger | instagram
  lang        TEXT NOT NULL DEFAULT 'ar',
  total       INTEGER NOT NULL,              -- dirhams
  status      TEXT NOT NULL DEFAULT 'new',   -- new | confirmed | paid | delivered | cancelled
  admin_note  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX orders_phone ON orders(phone, created_at);

CREATE TABLE order_items (
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL,
  code        TEXT NOT NULL,
  brand       TEXT NOT NULL,
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  qty         INTEGER NOT NULL
);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE admins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE,
  pass_hash   TEXT NOT NULL,
  salt        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  admin_id    INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL
);

CREATE TABLE login_attempts (
  ip          TEXT NOT NULL,
  at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX login_attempts_ip ON login_attempts(ip, at);

INSERT INTO brands (id, name, story_ar, story_en, tint, sort) VALUES
 ('swarovski', 'Swarovski', 'كريستال سواروفسكي الأصلي منذ 1895: قلائد، أقراط، أساور وأطقم.', 'Original Swarovski crystal since 1895: necklaces, earrings, bracelets and sets.', 'swa', 1),
 ('tiffany', 'Tiffany & Co.', 'قطع تيفاني الأيقونية، أصلية مع علبتها وأوراقها.', 'Iconic Tiffany pieces, genuine, with their box and papers.', 'tif', 2),
 ('apm', 'APM Monaco', 'تصاميم APM Monaco المرحة بروح الريفييرا.', 'Playful APM Monaco designs with a Riviera spirit.', 'apm', 3),
 ('pandora', 'Pandora', 'أساور وحليات باندورا الأصلية.', 'Genuine Pandora bracelets and charms.', 'pan', 4);

INSERT INTO categories (id, name_ar, name_en, sort) VALUES
 ('necklaces', 'قلائد', 'Necklaces', 1),
 ('earrings', 'أقراط', 'Earrings', 2),
 ('bracelets', 'أساور', 'Bracelets', 3),
 ('rings', 'خواتم', 'Rings', 4),
 ('sets', 'أطقم', 'Sets', 5);

INSERT INTO settings (key, value) VALUES
 ('whatsapp', ''), ('facebook', ''), ('instagram', ''),
 ('pay_cod_cash', '1'), ('pay_cod_card', '1'), ('pay_lypay', '1'),
 ('banners', '[]'), ('next_order', '1001');
