-- Order page loads from the server with a private link, so it works on any browser.
ALTER TABLE orders ADD COLUMN view_token TEXT NOT NULL DEFAULT '';
-- Limits how many orders one connection can send per hour (stored as a one-way hash, not the address).
ALTER TABLE orders ADD COLUMN ip_hash TEXT NOT NULL DEFAULT '';
CREATE INDEX orders_ip ON orders(ip_hash, created_at);
