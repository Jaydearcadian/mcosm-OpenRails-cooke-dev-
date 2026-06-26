# OpenRails V1: Cloudflare Workers Sidecar & Persistence Architecture

This document outlines the technical design for deploying OpenRails sidecars, registries, and reconciliation jobs onto **Cloudflare Workers** using serverless event-driven patterns and native storage engines (KV and D1).

> [!NOTE]
> Planning and analysis note. Confirm current implementation before treating any item as shipped.

---

## 1. The Serverless Paradigm: Events vs. Daemons

Cloudflare Workers run on V8 isolates. They are **stateless and event-driven**, meaning they spin up to process an incoming event (HTTP request or Cron trigger) and immediately shut down. They **cannot run persistent background daemon loops (e.g., `while(true)` loops)**.

To deploy our sidecars to Cloudflare Workers, we restructure them from polling daemons into event handlers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      1. HTTP WEBHOOK PATTERN (PUSH)                    │
│  Navidrome Webhook ──► CF Worker (Fetch Event) ──► Signs & Relays      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      2. CRON TRIGGER PATTERN (PULL)                    │
│  CF Cron (Every 1m) ──► CF Worker (Scheduled Event) ──► Reconciles Gaps │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          3. PERSISTENCE LAYER                          │
│  - Cloudflare KV (MBID-to-Wallet mapping lookup)                       │
│  - Cloudflare D1 (Relational cache of active stream rows)              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Event-Driven Implementations

### 2.1 The Scrobble Webhook Worker (`fetch` handler)
Instead of the sidecar polling Navidrome's database:
1. Configure the music server (or a listener plugin) to send an **HTTP POST webhook** when a song is played, pointing to the Cloudflare Worker URL.
2. The Worker handles the request in the `fetch` event:
   ```typescript
   export default {
     async fetch(request, env) {
       const payload = await request.json();
       const artistMbid = payload.artistMbid;

       // Query the local KV store for the wallet mapping
       const walletAddress = await env.MUSICBRAINZ_REGISTRY.get(artistMbid);
       if (!walletAddress) return new Response("Artist not registered", { status: 404 });

       // Compile, sign EIP-712, and relay via RPC...
       return new Response("Payment dispatched");
     }
   }
   ```

### 2.2 The Reconciliation Worker (`scheduled` handler)
Instead of a running daemon thread constantly monitoring state:
1. Configure a Cloudflare Worker **Cron Trigger** to fire every 1 minute.
2. The Worker wakes up on the `scheduled` event, queries the API usage logs, compares it to the on-chain Arc Vault state, submits any required `processDripSettle` transaction, and goes back to sleep:
   ```typescript
   export default {
     async scheduled(event, env, ctx) {
       ctx.waitUntil(reconcileAllActiveStreams(env));
     }
   }
   ```

---

## 3. Serverless Persistence Layers

Cloudflare provides low-latency, globally distributed database engines that align with the sidecar's storage requirements:

### 3.1 Cloudflare KV (Key-Value Store)
* **Use Case:** Storing the **MusicBrainz ID (MBID) ➔ Artist Wallet** registry.
* **Why it fits:** Extremely fast read speeds globally. Since artist wallet addresses change rarely, the KV store is the most cost-effective and performant lookup mechanism.

### 3.2 Cloudflare D1 (SQL Database)
* **Use Case:** Storing active stream registry projections (cached transaction hashes, balances, and timestamps).
* **Why it fits:** Provides a queryable, serverless SQLite instance inside the Worker context to keep track of concurrent nonce lanes and pending sweeps.

### 3.3 Durable Objects (DO)
* **Use Case:** Nonce lock-guards and transaction coordination.
* **Why it fits:** Guarantees single-instance execution per key. If multiple agents use the same Nonce Lane concurrently, a Durable Object handles sequencing to prevent on-chain transaction collisions.
