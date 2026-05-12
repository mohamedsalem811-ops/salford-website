-- ─── Salford Libya — D1 Database Schema ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  is_set      INTEGER NOT NULL DEFAULT 0,
  set_codes   TEXT,              -- JSON array string e.g. '["5416604","5512850"]'
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  price       REAL NOT NULL DEFAULT 0,
  original_price REAL,
  image       TEXT NOT NULL DEFAULT '',
  images      TEXT NOT NULL DEFAULT '[]',   -- JSON array string
  description TEXT NOT NULL DEFAULT '',
  short_desc  TEXT NOT NULL DEFAULT '',
  in_stock    INTEGER NOT NULL DEFAULT 1,
  quantity    INTEGER NOT NULL DEFAULT 0,
  featured    INTEGER NOT NULL DEFAULT 0,
  set_items   TEXT,              -- JSON array string
  media_items TEXT               -- JSON array string [{type,data,name}]
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('storeName',      'Salford Libya'),
  ('facebookUrl',    'https://www.facebook.com/salfordlibya'),
  ('instagramUrl',   'https://www.instagram.com/salford.libya/'),
  ('whatsappNumber', ''),
  ('heroTitleAr',    'مجوهرات فاخرة أصلية'),
  ('heroTitleEn',    'Authentic Luxury Jewelry'),
  ('heroSubtitleAr', 'مجوهرات أصلية من سواروفسكي وبندورا وتيفاني آند كو — جودة مضمونة في كل قطعة'),
  ('heroSubtitleEn', 'Authentic jewelry from Swarovski, Pandora & Tiffany & Co — guaranteed quality in every piece'),
  ('adminUser',      'admin'),
  ('adminPass',      'salford2024'),
  ('currency',       'LYD');
