-- OpenRails D1 Database SQL Schema
-- Initialize using: npx wrangler d1 execute openrails_stream_db --local --file=schema.sql
-- For production: npx wrangler d1 execute openrails_stream_db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_event_id TEXT,
  paycard_id TEXT NOT NULL,
  artist_mbid TEXT NOT NULL,
  artist_wallet TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  settled INTEGER DEFAULT 0, -- 0 = Pending, 1 = Settled successfully, 2 = Skipped/failed, 3 = In progress
  settlement_attempts INTEGER DEFAULT 0,
  last_error TEXT,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_plays_settled ON plays(settled);
CREATE INDEX IF NOT EXISTS idx_plays_paycard_id ON plays(paycard_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plays_source_event_id ON plays(source_event_id) WHERE source_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plays_pending_attempts ON plays(settled, settlement_attempts);
