-- Release 4: full offers. Spend-more levels, free gift, flash deals with an "X left" counter, "coming soon" teaser with
-- "Remind me", early access link, offer report, occasions calendar. Additive only: the previous build keeps working on this schema.
-- The columns offers.tiers, gift_product_id, gift_min, teaser_days, early_hours and early_token already exist (migration 0003).

-- Flash deals: a special price for one product while its offer runs. It replaces any other discount on that product.
-- max_qty = how many pieces are sold at the flash price (0 = no limit); sold pieces are counted from orders that were not cancelled.
CREATE TABLE offer_flash (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id    INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price       INTEGER NOT NULL,                     -- dirhams
  max_qty     INTEGER NOT NULL DEFAULT 0,
  sort        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (offer_id, product_id)
);
ALTER TABLE order_items ADD COLUMN flash_id INTEGER;
CREATE INDEX order_items_flash ON order_items(flash_id);

-- "Remind me when it starts" on the coming-soon page. One entry per phone per offer; deleted after 90 days.
CREATE TABLE offer_reminders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id    INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  lang        TEXT NOT NULL DEFAULT 'ar',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  notified_at TEXT,
  ip_hash     TEXT NOT NULL DEFAULT '',
  UNIQUE (offer_id, phone)
);
CREATE INDEX offer_reminders_created ON offer_reminders(created_at);

-- Early access messages the team marked as sent (one per customer phone per offer).
CREATE TABLE offer_early_sent (
  offer_id  INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  phone     TEXT NOT NULL,
  sent_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (offer_id, phone)
);

-- Orders placed with the early access link (before the offer opened to everyone).
ALTER TABLE orders ADD COLUMN early INTEGER NOT NULL DEFAULT 0;

-- Occasions calendar: the admin home shows a reminder `remind_days` before each date. Dates are Libya dates (YYYY-MM-DD).
-- Moon dates are approximate; the owner corrects them in Admin → Calendar.
CREATE TABLE occasions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL DEFAULT '',
  day         TEXT NOT NULL,
  template    TEXT NOT NULL DEFAULT 'flash',
  pct         INTEGER NOT NULL DEFAULT 0,
  moon        INTEGER NOT NULL DEFAULT 0,
  remind_days INTEGER NOT NULL DEFAULT 14,
  note        TEXT NOT NULL DEFAULT ''
);
INSERT INTO occasions (name_ar, name_en, day, template, pct, moon) VALUES
 ('عيد الاستقلال', 'Independence Day', '2026-12-24', 'ind', 24, 0),
 ('رأس السنة', 'New Year', '2027-01-01', 'ny', 20, 0),
 ('رمضان', 'Ramadan', '2027-02-08', 'rm', 15, 1),
 ('عيد الفطر', 'Eid al-Fitr', '2027-03-09', 'ef', 20, 1),
 ('عيد الأم', 'Mother''s Day', '2027-03-21', 'md', 15, 0),
 ('عيد الأضحى', 'Eid al-Adha', '2027-05-16', 'ea', 15, 1),
 ('الجمعة البيضاء', 'White Friday', '2027-11-26', 'wf', 25, 0),
 ('بلاك فرايدي', 'Black Friday', '2027-11-26', 'bf', 30, 0);
