# OpenRails V1: Non-Disruptive Sidecar Coexistence & Verification

This document analyzes the compatibility of off-chain sidecars with core protocol systems, demonstrating why they do not disrupt parallel development by other agents and explaining how they support retrospective verification.

> [!NOTE]
> Planning and analysis note. Confirm current implementation before treating any item as shipped.

---

## 1. Zero Disruption: Clean Decoupled Boundaries

Because these auxiliary components are designed as **external sidecars**, they operate with complete decoupling from the core codebase.

Other development agents can build, modify, or test the smart contracts, TypeScript SDK, or the main dashboard without any interference:

* **No Code Intrusion:** The sidecars (Reverse Proxy, Preflight Policy, and Daemon) communicate solely via standard JSON-RPC queries, Express API requests, and standard EVM event subscription loops. They do not add any new library dependencies or alter existing function signatures.
* **Separation of Concerns:** The core logic remains focused on the primary settlement mathematics (drips, nonces, escrows), while the sidecars handle operational business rules (access routing, API tokens, and offline usage audits).

---

## 2. Retrospective Verification ("Verifying Later")

The architecture supports a **deferred settlement and audit** model. The on-chain Vault does not require real-time knowledge of off-chain sidecar actions, allowing them to verify state asynchronously:

```
[ PHASE I: ASYNCHRONOUS ACTIVITY ]
Agent Signs Envelope ──► Submitted to Vault ──► Stream Opened (PaycardProvisioned Event)
     │                                                    │
     ▼ (Offline Billing Loop)                             ▼ (Indexed)
Access Sidecar logs usage data                  Reconciliation Daemon caches event

[ PHASE II: RETROSPECTIVE AUDIT & RECONCILIATION ]
Reconciliation Daemon checks usage logs ◄──► Queries Vault registry (balance & state)
     │
     ▼ (If state gap discovered)
Fires processDripSettle() to pull on-chain balance to match real usage
```

### 2.1 How Verification Occurs Later:
1. **Event Replay:** The Stream Gateway and auditing daemons can sync state at any point by querying the blockchain for historical logs (`PaycardProvisioned`, `SettlementFlushed`, `ResidualDeltaReclaimed`).
2. **On-Chain Truth Assertion:** If a service provider gateway crashes, it can rebuild its entire state projection by reading the on-chain registry states directly from the blockchain RPC.
3. **Lazy Settlement:** The core agents and smart contracts do not need to coordinate usage in real-time. If the agent makes API calls, the gateway tracks usage off-chain and submits periodic settlement checkpoints to the blockchain only when cost-effective, using the Vault as the final arbiter to resolve any discrepancies.
