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

### B. Deploy Reconciliation Cron Worker
1. Set up the signer private key secret (the EVM account that submits on-chain transactions on Arc Network):
   ```bash
   cd ../reconciliation-worker
   npm install
   npx wrangler secret put RECONCILIATION_SIGNER_KEY
   # Enter the funded deployer or relayer private key when prompted
   ```
2. Deploy the Worker:
   ```bash
   npx wrangler deploy
   ```
3. This Worker will run automatically every 1 minute to check for unsettled plays and trigger `processDripSettle()` onchain.
