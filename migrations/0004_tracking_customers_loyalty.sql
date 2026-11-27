-- Release 2: order tracking, customers and loyalty. Additive only: the previous build keeps working on this schema.

-- "Paid" becomes a team-only tick, separate from the status the customer sees:
-- new → confirmed → out (out for delivery) → delivered, or cancelled.
ALTER TABLE orders ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;
UPDATE orders SET paid = 1, status = 'confirmed' WHERE status = 'paid';

-- Every status change, for the tracker page and the order history in the admin. admin_id is NULL for the customer's own order.
CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  admin_id INTEGER
);
CREATE INDEX order_events_order ON order_events(order_id, id);

-- Orders placed before this release: "placed" at their creation time, and their current status (time unknown, so the same).
INSERT INTO order_events (order_id, status, at) SELECT id, 'new', created_at FROM orders;
INSERT INTO order_events (order_id, status, at) SELECT id, status, created_at FROM orders WHERE status != 'new';

-- Customers are grouped by phone; loyalty looks up delivered orders by phone.
CREATE INDEX orders_phone_status ON orders(phone, status);

-- Loyalty discount: off until the owner switches it on in Admin → Customers.
INSERT OR IGNORE INTO settings (key, value) VALUES ('loyalty_on', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('loyalty_pct', '5');
