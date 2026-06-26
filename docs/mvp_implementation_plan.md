# OpenRails V1: Stack Improvement Matrix & MVP Architecture Plan

This document outlines the optimization roadmap for the OpenRails v1 codebase and defines the scope, architecture, and timeline for a production-readiness path for a **Minimum Viable Product (MVP)**.

---

## 1. Stack Optimization Matrix

We evaluate each layer of the current repository stack to identify performance bottlenecks, gas costs, and scalability enhancements:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           1. CONTRACT LAYER                             │
│  - Storage layout packing (PaycardRegistry slot compression)            │
│  - Upgradeability (ERC-1967 UUPS or Beacon Proxy)                       │
│  - Multi-Token ERC-20 compatibility                                     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             2. SDK LAYER                                │
│  - Integration of CompactSerializer (raw binary packing schema)         │
│  - Unified Ethers v6 / Viem provider adapters                           │
│  - Automated transaction retry loops with gas backoff                  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           3. RELAYER / GATEWAY                          │
│  - Persistent relational index (PostgreSQL / SQLite) for streams        │
│  - Circle x402 transaction batching integration                         │
│  - Secure API client-key lifecycle management                           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           4. STREAM INDEXER                             │
│  - Real-time indexing engine (subgraph or custom event listener)        │
│  - Webhook delivery queue with exponential backoff & Ed25519 signatures │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            5. DASHBOARD UI                              │
│  - Live canvas-based streaming drip visualizer                          │
│  - Multi-wallet (RainbowKit/Wagmi) integration                         │
│  - QR-code generation panel for RailsFlow and RailsCard                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Contract Layer (`ArcOpenRailsHubV1.sol`)
* **Storage Slot Optimization:** The current `PaycardRegistry` struct uses individual variables that span across multiple 32-byte storage slots. Packing variables (like combining `ChannelStatus` (uint8), `lifespanSeconds` (uint64), `genesisTimestamp` (uint64), and `lastCheckpointEpoch` (uint64) into a single slot) will save **~20,000 gas** per stream initialization.
* **Multi-Token Clearing:** Modify the Vault to accept arbitrary ERC-20 tokens (e.g., EURC, USDC, or custom credit tokens) by adding a `token` address parameter to `SettlementIntent` instead of hardcoding `arcUsdc`.
* **Proxy-Friendly Initializers:** Add `initialize` functions to support the **ERC-1167 Proxy Factory** pattern cleanly without constructors.

### 1.2 SDK Layer (`sdk/src/`)
* **Compact Encoding Native Support:** Build the `CompactSerializer` binary packing logic natively into `serialization.ts` so that link outputs are compressed by 60% out of the box.
* **Provider Independence:** Decouple SDK helper methods from `ethers` to support lightweight alternatives like `viem` or standard JSON-RPC requests, reducing SDK bundle size.

### 1.3 Relayer Gateway & Indexer (`server/` & `stream-gateway/`)
* **Database State Store:** Replace the in-memory `MemoryCacheStateStore` with a lightweight SQL database (such as SQLite or PostgreSQL) to survive server restarts and maintain transaction histories.
* **Event Indexing:** Implement a structured log ingestion loop using a custom indexer to query and sync past events, ensuring off-chain stream records match the blockchain state.

---

## 2. The MVP: "Pay-Per-Use API Gatekeeper"

To demonstrate the full power of intent-driven streams in the machine economy, the MVP should focus on a concrete, high-value developer usecase: **Metered API/Agent Billing**.

### Usecase Scenario:
An AI developer wants to sell LLM api access to autonomous agent scripts. Instead of charging a static monthly subscription (which agents cannot authorize) or requiring prepaying a high deposit, the agent opens a **Paycard Stream** that settles dynamically based on the exact amount of tokens consumed by the API.

```
[ AI AGENT ] ──(1. Open Stream)──► [ VAULT ] (Escrow USDC)
     │
     ├──(2. Request with Stream Header)──► [ LLM GATEWAY ]
     │                                           │ (3. Verify balance/vault)
     │                                           ▼
     │◄──(5. Return Response/Tokens)─────── [ API SERVER ]
     │                                           │
     └────────────────(4. Settle Earned)─────────┘
```

### MVP Scope & Core Features:
1. **The SDK Client:** Used by the Agent script to sign the EIP-712 payment envelope and attach the `Authorization: OpenRails <token>` header to LLM API requests.
2. **The LLM Gateway Middleware:** Express middleware that intercepts requests, checks the Vault balance of the client's `paycardId`, and rejects requests if the balance is exhausted.
3. **Reactive Settlement Service:** A background job on the gateway server that tracks API usage metrics and occasionally calls `processDripSettle` onchain to claim earned revenue.
4. **Mini-Dashboard:** A clean developer dashboard visualizer that monitors active agent streams, total settled tokens, and remaining safety buffers.

---

## 3. Step-by-Step MVP Implementation Plan

```
┌────────────────────────────────────────────────────────┐
│  PHASE 1: Contracts, Compact SDK & Binary Pack         │
│  - Tightly packed EIP-712 serialization in SDK.        │
│  - Deploy packed Hub contract with multi-token.        │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  PHASE 2: API Gateway Middleware & Settle Job          │
│  - Middleware verifying vault balances for requests.   │
│  - Local DB store for tracking API token metrics.     │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  PHASE 3: Developer Cockpit & Live Smoke               │
│  - Visual drip graph matching actual API requests.     │
│  - Live smoke test: Agent script calling gated LLM.   │
└────────────────────────────────────────────────────────┘
```

### Phase 1: Contracts & SDK Compaction (3 Days)
* Integrate `CompactSerializer` for compact Base64URL string URL formatting.
* Add variable packing and multi-token support to `ArcOpenRailsHubV1.sol`.
* Deploy the updated contracts to the local Hardhat sandbox or Arc Testnet.

### Phase 2: Relayer Gateway & API Middleware (4 Days)
* Write the `OpenRailsGatekeeper` Express middleware to validate inbound HTTP requests.
* Set up a SQLite database to cache paycard details and API request metrics (tokens used vs. settled cash).
* Implement the background scheduler that batches API settlement calls on-chain.

### Phase 3: Visualizer Cockpit & Smoke Test (3 Days)
* Build a mini visual interface showing real-time token/USDC consumption lines.
* Write a demo client script (an "autonomous agent") that makes 10 consecutive LLM api requests, displaying the automatic authorization, consumption, and final residual flush.
* Verify the end-to-end flow using Foundry fuzz tests and write the final developer integration guides.
