# OpenRails Stream Indexing — Reliability & Semantics

The stream gateway maintains a **durable, non-authoritative projection** of Paycard Stream
state and events so the dashboard and SDK can query history that survives a process restart.
This document records the projection's reliability behavior — the Phase 5 (Workflow &
Indexing) exit criterion for reorg / retry / duplicate-event / RPC-outage handling.

> **The Vault is always the source of truth.** Every indexed read is returned with
> `authoritative: false` and a disclaimer. Indexed data may lag or need replay; it never
> overrides on-chain Vault state for funds.

## Components

- `PersistentFileStateStore` (`stream-gateway/state-store.ts`) — file-backed store: a
  `stream-state.json` snapshot of latest per-stream state plus an append-only
  `stream-events.jsonl` event log. Configured via `OPENRAILS_STREAM_STORE_DIR`.
- `PersistentStreamReader` (same file) — stateless read-only view the server process uses to
  serve history endpoints; it re-reads from disk on each query.
- Gateway backfill (`StreamGateway.backfill`, `stream-gateway/index.ts`) — replays historical
  logs from chain via `provider.getLogs`.

## Queryable dimensions

Indexer-backed reads cover the full Phase 5 set:

| Dimension | Surface |
| :--- | :--- |
| paycardId | `GET /api/streams/:paycardId/history` |
| workflowId | `GET /api/streams?workflowId=…`, `GET /api/workflows/:id` |
| metadataHash | `GET /api/streams?metadataHash=0x…` |
| transactionHash | `GET /api/transactions/:hash` |
| payer / recipient / status | `GET /api/streams?payer=…&recipient=…&status=…` |

## Duplicate events & idempotency

Events are keyed by `${transactionHash}:${logIndex}`
(`PersistentFileStateStore.eventKey`). Ingestion is idempotent:

- `recordEvent()` returns `false` for an already-seen key and does not append a duplicate.
- Dedup survives restarts: on load, every persisted event's key is re-hydrated into the
  in-memory key set, so a re-observed event (live subscription **or** backfill) is a no-op.

This makes it safe for the live subscription and a backfill window to overlap.

## Backfill & replay

When `backfillOnStart` + `startBlock` are set (`OPENRAILS_STREAM_START_BLOCK`), a fresh
process rebuilds state from chain via `getLogs(fromBlock, toBlock?)` before serving live
events. Because ingestion is idempotent, backfill can be re-run at any time without
double-counting. A process that starts empty therefore converges to chain state rather than
silently serving a gap.

## Reorgs

The projection is **last-write-wins** on state and **append-only** on events. It does **not**
automatically roll back events from a reorged block. Consequences:

- A reorg can make the projection briefly **stale** (it may hold an event that was reorged
  out, or miss one that was reorged in), but it can never be **authoritative-wrong** —
  callers treat indexed data as non-authoritative and confirm funds against the Vault.
- **Operator remedy:** re-run backfill across the affected range; idempotent ingestion
  reconciles the snapshot, and consumers should prefer the latest on-chain Vault read
  (`GET /api/paycard/:id`) for any funds-affecting decision.

## Webhook retries

Outbound event delivery (`stream-gateway/webhook.ts`) retries up to **5 attempts** with
exponential backoff + jitter (capped per-delay). Non-retryable client errors (4xx except 429)
stop early. Retries and duplicate deliveries cannot corrupt indexed state because event
ingestion is idempotent by `txHash:logIndex`.

## RPC outage

If the live log subscription drops or the RPC is briefly unavailable, missed events are
recovered by **backfill on the next start** (or an operator-triggered backfill). While the
projection is degraded, reads fall back to the **authoritative** direct-RPC path
(`GET /api/paycard/:id`) plus locally held receipts — the Phase 5 rollback posture. Pilot
users are told the Vault remains authoritative and that indexed history may lag.

## Summary of guarantees

- Indexed reads are non-authoritative; the Vault is source of truth.
- Event ingestion is idempotent and restart-safe (`txHash:logIndex`).
- Backfill makes a cold start converge to chain state and is safe to repeat.
- Reorgs can only cause transient staleness, recoverable by replay.
- Delivery retries and RPC gaps cannot corrupt state; they degrade gracefully to direct RPC.
