-- OpenRails Indexer Worker D1 schema (dedicated database — NOT shared with the music
-- sidecar's openrails_stream_db `plays` table).
-- Apply: npx wrangler d1 execute openrails_indexer_db --local --file=schema.sql
--        npx wrangler d1 execute openrails_indexer_db --remote --file=schema.sql

-- Every vault this indexer watches: the always-seeded canonical V2 hub, plus every clone
-- discovered via ArcOpenRailsFactoryV1's CorporateVaultDeployed event.
CREATE TABLE IF NOT EXISTS idx_watched_vaults (
  vault_address TEXT PRIMARY KEY,       -- lowercased
  discovery_source TEXT NOT NULL,       -- 'canonical' | 'factory'
  owner_address TEXT,                   -- from CorporateVaultDeployed.owner (NULL for the canonical seed)
  token_address TEXT,                   -- from CorporateVaultDeployed.token (NULL for the canonical seed)
  discovered_at_block INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Chunked-backfill progress, keyed per watched vault address OR 'factory:<factoryAddress>' for
-- the discovery scan itself. Lets the cron resume instead of rescanning from genesis every tick.
CREATE TABLE IF NOT EXISTS idx_scan_cursors (
  scan_key TEXT PRIMARY KEY,
  last_scanned_block INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Durable, append-oriented event log. Dedup key mirrors stream-gateway's
-- PersistentFileStateStore.eventKey (${transactionHash}:${logIndex}) exactly.
CREATE TABLE IF NOT EXISTS idx_stream_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vault_address TEXT NOT NULL,
  paycard_id TEXT NOT NULL,
  event_name TEXT NOT NULL,       -- PaycardProvisioned | SettlementFlushed | ResidualDeltaReclaimed
  metadata_hash TEXT,             -- only set on PaycardProvisioned
  block_number INTEGER NOT NULL,
  block_timestamp INTEGER,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  args_json TEXT NOT NULL,
  recorded_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stream_events_dedup
  ON idx_stream_events(transaction_hash, log_index);
CREATE INDEX IF NOT EXISTS idx_stream_events_paycard
  ON idx_stream_events(vault_address, paycard_id);
CREATE INDEX IF NOT EXISTS idx_stream_events_tx
  ON idx_stream_events(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_stream_events_metadata_hash
  ON idx_stream_events(metadata_hash);

-- Current paycard state projection. Composite primary key is a hard correctness requirement:
-- buildMetadataBoundPaycardId() (sdk/src/metadata.ts) does not bind the vault address, so the
-- same paycardId bytes32 can legitimately exist as unrelated rows on two different vault clones.
CREATE TABLE IF NOT EXISTS idx_paycard_state (
  vault_address TEXT NOT NULL,
  paycard_id TEXT NOT NULL,
  payer TEXT NOT NULL,
  recipient TEXT NOT NULL,
  metadata_hash TEXT NOT NULL,
  total_allocation TEXT NOT NULL,   -- wei string
  available_balance TEXT NOT NULL,  -- wei string
  velocity TEXT NOT NULL,           -- wei/sec string
  genesis INTEGER NOT NULL,
  lifespan INTEGER NOT NULL,
  last_checkpoint INTEGER NOT NULL,
  status TEXT NOT NULL,             -- 'Active' | 'Terminated' (see src/index.ts comment on scope)
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (vault_address, paycard_id)
);
CREATE INDEX IF NOT EXISTS idx_paycard_state_payer ON idx_paycard_state(payer);
CREATE INDEX IF NOT EXISTS idx_paycard_state_recipient ON idx_paycard_state(recipient);
CREATE INDEX IF NOT EXISTS idx_paycard_state_status ON idx_paycard_state(status);
CREATE INDEX IF NOT EXISTS idx_paycard_state_metadata_hash ON idx_paycard_state(metadata_hash);
