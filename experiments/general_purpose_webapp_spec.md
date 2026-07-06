# Product Specification: OpenRails General-Purpose Utility Payments App

This document defines the high-level positioning, core features, and component design of OpenRails as a general-purpose utility payments application. It abstracts specific verticals (like music or agents) to focus strictly on the platform's core infrastructure capabilities.

---

## 1. General-Purpose Brand Positioning

OpenRails is not a niche product for one vertical. It is **general-purpose infrastructure for the continuous web.**

* **The Core Tagline**: "Settle per-second. Recover what is unused."
* **The Core Definition**: An intent-driven clearing and settlement application. It provides users and businesses with a unified console to configure, sign, escrow, stream, and recover USDC allocations for any time-based or usage-based agreement.

---

## 2. Core Functional Pillars of the OpenRails App

The unified application is organized around three foundational Web3 payment primitives:

```
                            [ OPENRAILS APP ]
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
   1. REGISTRIES             2. NONCE LANES            3. VAULT STREAMS
(Who gets paid & why)     (Concurrency & Safety)    (Escrow, Settle, & Sweep)
```

1. **The Payee Registry (`/registry`)**: A general-purpose lookup directory mapping any metadata identifier (project code, domain name, invoice ID, or catalog hash) to an EVM payout address.
2. **Nonce Lane Management**: A dashboard interface managing parallel payment tracks (`nonceChannel` + `nonceValue`). This allows a single user or organization to run multiple independent payment workflows simultaneously without transaction queuing issues.
3. **Paycard Streams (`/app` Cockpit)**: Bounded USDC escrow containers. Users approve a specific allocation, set a settlement speed, and track live drip settlements, with the ability to sweep leftover capital at any point.

---

## 3. General-Purpose WebApp Page Layout

The WebApp is structured into three clean, workspace-focused views:

### A. The Deck (Dashboard Home)
The operational telemetry deck showing your global payment state:
* **Total Escrow Pool**: Consolidated USDC locked across all active streams.
* **Streaming Velocity Ticker**: Live counter showing the total real-time consumption rate (USDC/second) across all streams.
* **Lanes Map**: Visual grid of active nonce channels, showing sequence heights.

### B. The Streams Desk (Vault Lifecycle)
A workspace to create and manage individual Paycard Streams:
* **The Stream Creator Form**: A unified panel to open a new stream. The user defines:
  * *Recipient*: The payout address.
  * *Budget*: Total USDC allocated.
  * *Lifespan*: Expiration window.
  * *Velocity*: Settlement speed.
  * *Workflow ID*: Metadata tag grouping this stream under a larger project.
* **The Streams Table**: Lists all active and closed vaults. Every vault card features live drip counters and direct on-chain triggers for `processDripSettle()` and `flushResidualDelta()`.

### C. The Explorer (Auditing & Verification)
A public auditing search page:
* Users search by `paycardId`, `workflowId`, or transaction hash.
* Renders a timeline of verifiable [receipts](file:///home/jay/codex/lepton/sdk/src/receipts.ts) (`payment_opened`, `settlement_processed`, `residual_recovered`) and hashes, connecting off-chain invoice metadata to on-chain events.

---

## 4. Why This Architecture Scales
By abstracting the specific use case, OpenRails becomes highly flexible. The same underlying code and dashboard can manage:
* **SaaS API Subscriptions**: Paying per millisecond of API usage.
* **Autonomous Task Budgets**: Escrowing funds for independent AI worker scripts.
* **Creator Patronage**: Tipping artists per second of content consumption.
* **Industrial Utility Metering**: Settle energy or cloud compute usage in real-time.
