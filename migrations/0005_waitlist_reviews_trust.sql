-- Release 3: waiting list for sold-out pieces, customer reviews, trust page. Additive only: the previous build keeps working on this schema.

-- "Tell me when it's back": one entry per phone per product. Entries older than 90 days are deleted.
-- notified_at is set when the team sends the message (today by one-tap WhatsApp; later it can be sent automatically).
CREATE TABLE waitlist (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  offer_id    INTEGER,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  lang        TEXT NOT NULL DEFAULT 'ar',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  notified_at TEXT,
  ip_hash     TEXT NOT NULL DEFAULT '',
  UNIQUE (product_id, phone)
);
CREATE INDEX waitlist_created ON waitlist(created_at);

-- Reviews: anyone may write one, the team approves it before it shows. product_id NULL = a review of the shop.
-- verified = the phone has a delivered order (or it came from the customer's own order link after delivery).
-- The photo is kept privately in R2 under rv/ and is shown only once the review is approved.
CREATE TABLE reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
  order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  city        TEXT NOT NULL DEFAULT '',
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text        TEXT NOT NULL DEFAULT '',
  photo_key   TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  lang        TEXT NOT NULL DEFAULT 'ar',
  verified    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at  TEXT,
  ip_hash     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX reviews_status ON reviews(status, id);
CREATE INDEX reviews_product ON reviews(product_id, status);
CREATE INDEX reviews_order ON reviews(order_id);

-- Both start switched off; the owner turns them on in Admin → Waiting list and Admin → Reviews.
INSERT OR IGNORE INTO settings (key, value) VALUES ('waitlist_on', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('reviews_on', '0');
-- Trust page: optional extra text and photo gallery (JSON list), edited in Admin → Trust page.
INSERT OR IGNORE INTO settings (key, value) VALUES ('trust_text_ar', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('trust_text_en', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('trust_gallery', '[]');
