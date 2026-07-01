# OpenRails Cloudflare Workers Sidecar Setup

This directory contains the serverless event-driven implementation of OpenRails sidecars, consisting of the **Music Scrobble Webhook Worker** and the **Reconciliation Cron Worker**.

---

## 1. Prerequisites

* Cloudflare account and authenticated Wrangler CLI:
  ```bash
  npx wrangler login
  ```

---

## 2. Database & KV Setup

### A. Initialize the Key-Value (KV) Store
This store maps MusicBrainz Artist IDs (MBIDs) to artist EVM wallet addresses.
1. Create the KV namespace:
   ```bash
   npx wrangler kv:namespace create MUSICBRAINZ_REGISTRY
   ```
2. Wrangler will output a binding segment with IDs. Copy these into `workers/music-scrobble-worker/wrangler.toml` under `[[kv_namespaces]]`.

### B. Initialize the D1 SQL Database
This database acts as the off-chain cache database tracking pending play events and royalty balances.
1. Create the D1 database:
   ```bash
   npx wrangler d1 create openrails_stream_db
   ```
2. Copy the returned `database_id` UUID into BOTH `wrangler.toml` files:
   * `workers/music-scrobble-worker/wrangler.toml`
   * `workers/reconciliation-worker/wrangler.toml`
3. Execute the database schema initialization:
   * **For Local Sandbox Dev:**
     ```bash
     npx wrangler d1 execute openrails_stream_db --local --file=schema.sql
     ```
   * **For Production Edge Deploy:**
     ```bash
     npx wrangler d1 execute openrails_stream_db --remote --file=schema.sql
     ```

---

## 3. Deploying the Workers

### A. Deploy Music Scrobble Webhook Worker
1. Navigate to the scrobble worker folder and run deploy:
   ```bash
   cd music-scrobble-worker
   npm install
   npx wrangler deploy
   ```
2. Your worker endpoint will be live at `https://openrails-music-scrobble-worker.<subdomain>.workers.dev/webhook/scrobble`. You can point your Subsonic/Navidrome server webhook settings here.

### B. Deploy the Settler Cron Worker (reconciliation-worker)

A cron keeper that periodically **drip-settles active Paycard Streams** so recipients get paid
without anyone clicking "settle". It **only settles** (`processDripSettle`) — it never opens or
closes a rail; opening and closure (residual flush) stay with the payer/merchant/creator. Settling
is permissionless and non-custodial: funds always flow payer → recipient per on-chain state; the
keeper only pays gas.

- **`SETTLER_MODE = "chain"` (default):** enumerates active streams from chain
  (`PaycardProvisioned` logs → `registry`) — **no D1 required**. Streaming rails settle repeatedly
  once accrued value clears `MIN_ACCRUED_USDC`; one-time (`lifespanSeconds == 0`) rails settle once.
- **`SETTLER_MODE = "d1"`:** legacy — settle only paycards referenced by the music `plays` table
  (needs the D1 setup in §2.B; uncomment `[[d1_databases]]` in the worker `wrangler.toml`).

1. Fund a keeper wallet with Arc testnet gas, then set its key as a secret (never in the repo):
   ```bash
   cd ../reconciliation-worker
   npm install
   npx wrangler secret put RECONCILIATION_SIGNER_KEY
   # paste the funded keeper private key when prompted
   ```
2. (Optional) validate the bundle, then deploy:
   ```bash
   npx wrangler deploy --dry-run   # bundle check, no deploy
   npx wrangler deploy
   ```
3. Runs every 10 minutes (`crons = ["*/10 * * * *"]`); tune interval, `MIN_ACCRUED_USDC`,
   `RECONCILIATION_BATCH_LIMIT`, and `SETTLER_WINDOW_BLOCKS` in `wrangler.toml`. Trigger manually
   with an authenticated `POST /reconcile` when `RECONCILIATION_ADMIN_TOKEN` is set.
