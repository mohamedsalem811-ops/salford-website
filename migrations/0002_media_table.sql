-- ─── Media chunk storage for videos uploaded from admin ───────────────────────
CREATE TABLE IF NOT EXISTS media (
  key        TEXT NOT NULL,   -- unique file key e.g. "vid_1715000000000"
  chunk_idx  INTEGER NOT NULL, -- 0-based chunk index
  chunk_data TEXT NOT NULL,   -- base64 string, max ~800 KB per chunk
  mime_type  TEXT NOT NULL DEFAULT 'video/mp4',
  total_chunks INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key, chunk_idx)
);
