# OpenRails V1: Sidecar & Off-Chain Reconciliation Architecture

This document defines the technical architecture for building auxiliary, sidecar, and reconciliation services beside the core OpenRails codebase. This approach extends protocol capabilities without disrupting or modifying the core [ArcOpenRailsHubV1.sol](../contracts/ArcOpenRailsHubV1.sol) contract or SDK.

---

## 1. The Sidecar Design Philosophy

To maintain maximum security and avoid contract re-auditing costs, we treat the on-chain Vault strictly as a **stateless/escrow-bound arbiter and final verifier**.

All complex business logic, rate limits, usage tracking, and routing policies are executed **off-chain by auxiliary sidecar applications**. The main on-chain Vault only verifies signatures, escrows tokens, and reconciles state gaps.

```
                  ┌──────────────────────────────────────────────┐
                  │                 CLIENT / AGENT               │
                  └──────────────────────┬───────────────────────┘
                                         │ (Request with OpenRails Header)
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │          SOVEREIGN ACCESS SIDECAR            │
                  │  - Intercepts requests & extracts tokens     │
                  │  - Reads local cache & checks Vault balance  │
                  └──────────────────────┬───────────────────────┘
                                         │ (If authorized)
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │               PROTECTED SERVICE              │
                  │  - Serves API / computes token metrics       │
                  └──────────────────────┬───────────────────────┘
                                         │ (Usage logs)
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │           RECONCILIATION DAEMON              │
                  │  - Syncs usage log vs on-chain settled balance│
                  │  - Fires processDripSettle() to bridge gaps  │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │               ON-CHAIN VAULT                 │
                  │  - Verifies proofs, resolves math & escrows  │
                  └──────────────────────────────────────────────┘
```

---

## 2. The Three Sidecar Pillars (Building "By the Side")

### 2.1 The Sovereign Access Sidecar (Reverse Proxy)
A standalone reverse-proxy service (built using Go, Node, or Envoy) placed directly in front of the target API or resource server.
* **How it works:** The sidecar intercepts incoming requests, parses the `Authorization: OpenRails <token>` header, and deserializes the payload.
* **Access Checks:** It checks the local cache (populated by the Stream Gateway) to see if the paycard has sufficient balance. If the balance is valid, it proxy-forwards the request to the backend service.
* **Result:** The backend API remains **completely payment-unaware**. The proxy sidecar handles authentication, rate-limiting, and metric emission independently.

### 2.2 The Preflight Policy Engine
An off-chain policy manager that evaluates EIP-712 envelopes *before* they are sent to the transaction mempool.
* **How it works:** When a client submits an envelope, the gateway forwards it to the Policy Engine.
* **Rules Checked:** The engine runs custom validation checks:
  * Has this payer exceeded their aggregate daily spending limit?
  * Is the recipient address whitelisted?
  * Are the request headers matching the payload parameters?
* **Result:** Bad transactions are rejected instantly without wasting gas on-chain.

### 2.3 The Reconciliation Daemon (State Gap Auditor)
A background daemon (running alongside the `stream-gateway` or as a cron task) that acts as the final accountant.
* **How it works:** The daemon continuously reads off-chain service consumption logs (e.g., token counts or server runtime milliseconds) and queries the corresponding on-chain Vault state (`PaycardRegistry`).
* **Gap Analysis:** If a gap exists between what the service has delivered and what has been settled on-chain (e.g., delivered = $5.00, settled = $4.50):
  * The daemon calls `processDripSettle(paycardId)` to push the on-chain checkpoint forward, capturing the outstanding balance.
* **Termination Audit:** If a stream expires or a job concludes, the daemon automatically fires `flushResidualDelta(paycardId)` to close the lane and return unspent funds to the recovery address.

---

## 3. Benefits of this Modular Architecture

1. **Zero Core Disruption:** Developers can add complex business policies (such as geo-blocking or subscription tier checks) without editing the underlying Solidity files, without changing the core Vault; audit status must still be established separately.
2. **Reduced Latency:** Client requests are verified in milliseconds against the sidecar's local cache rather than making blocking RPC calls to the blockchain for every API request.
3. **Dynamic Scaling:** Auxiliary services can be upgraded, scaled, or replaced without requiring smart contract migrations or redeployments.
