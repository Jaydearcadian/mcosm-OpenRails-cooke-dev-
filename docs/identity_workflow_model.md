# OpenRails Identity & Workflow Model — profileId · workflowId · workflowNFT

A design pass reconciling three concepts at very different maturity into one coherent model,
and stating **what lands where**. This is a planning artifact — confirm against the code before
treating any item as shipped.

## Status at a glance

| Concept | Layer | Status | Where |
| :--- | :--- | :--- | :--- |
| **`workflowId`** | job grouping | **Built** (off-chain, metadata-bound) | `CanonicalMetadataV1.workflowId`; indexed via gateway + `/api/workflows/:id`, `?workflowId=` |
| **`profileId`** | identity / aggregation | **Implemented v1** (address-scoped, off-chain) | `cockpit/src/lib/profile.ts` + the Profile tab (`cockpit/src/pages/Profile.tsx`) |
| **`workflowNFT`** | control / ownership token | **V2 prototype + design** | `contracts/v2-factory/WorkflowNFT.sol`, `workflow_nft_and_lifecycle.md`; **not** integrated with V1 Hub |

## The unified model

Three nested layers, plus one optional transferable control token:

```
profileId   — identity / aggregation        (NEW — Phase 6)
  └── workflowId   — master-job grouping     (BUILT — off-chain, non-authoritative)
         └── paycardId   — Vault stream      (AUTHORITATIVE — on-chain in ArcOpenRailsHubV1)

  [ workflowNFT ] — transferable token that owns/controls a workflowId   (V2 — Phase 7)
```

- A **profile** participates in many **workflows** and many **streams** (as payer or recipient).
- A **workflow** groups many **Paycard Streams** / Nonce Lanes under one logical job.
- A **paycardId** is the only authoritative, on-chain object — the Vault row. Everything above
  it is a **non-authoritative projection** the indexer reconstructs; the Vault stays source of
  truth.
- A **workflowNFT** (if minted, V2) makes a workflow's payout rights *transferable and
  controllable* by the token holder.

## Layer 1 — `workflowId` (built)

Implemented as **Option A** from `workflow_scope_integration.md`: an optional field on
`CanonicalMetadataV1` (`sdk/src/metadata.ts`), cryptographically bound through `metadataHash`
(signed in the EIP-712 intent). **Zero contract changes, zero gas** — the chain only stores the
32-byte `metadataHash`; the `workflowId` lives in off-chain metadata the gateway indexes.

- Reads: `getByWorkflow` / `getActiveByWorkflow` (`stream-gateway/state-store.ts`),
  `StreamQueryFilter.workflowId`, `GET /api/workflows/:id`, `GET /api/streams?workflowId=…`.
- Use: group parallel lanes/streams under one master job; query the bundle.
- Boundary: **off-chain only** (`contracts: 0` by design). On-chain `workflowId` (Option B) is a
  V2 decision; not needed for grouping/indexing.

Profiles consume this as-is — no change required.

## Layer 2 — `profileId` (new; define in Phase 6)

**Definition.** A stable identifier for a participant — payer, creator, merchant, or agent —
that aggregates everything they touch: streams where they are payer or recipient, the workflows
those streams belong to, and their receipt timeline.

**Recommended v1 binding: address-scoped, off-chain, non-authoritative.**
- `profileId` = a wallet address (or a canonical address for a participant). No new on-chain id
  space, no contract change.
- The profile view is assembled entirely from the **existing** indexer surface:
  `GET /api/streams?payer=<addr>` and `?recipient=<addr>` → their streams; group by
  `workflowId`; `GET /api/streams/:id/history` and local receipts → their timeline.
- Every profile read is labeled `authoritative: false`; the Vault remains source of truth.

**What it adds.** A coherent "who" over the rail: a creator/merchant's earnings, settlement
state, and residual recovery across all their streams and jobs — i.e. the **profile timeline**
that `positioning.md` already names but nothing yet builds.

**Extension paths (future, noted not chosen):** multi-address profiles (one identity, many
wallets); a richer identity binding (e.g. a Passport/DID); an on-chain profile registry. None
are required for the Phase 6 surface and all can layer on later without breaking the
address-scoped v1.

## Layer 3 — `workflowNFT` (V2 / Phase 7)

`contracts/v2-factory/WorkflowNFT.sol` is a hand-rolled ERC-721 with OpenRails hooks
(`payoutRedirections`, `isHalted`, `redirectPayout` onlyTokenOwner, `haltStream`/`resumeStream`).
`workflow_nft_and_lifecycle.md` lays out the vision: tokenize a `workflowId` so the **holder
controls the whole bundle**, enabling:
- **Invoice factoring** — transfer the NFT and all ongoing drips + residual sweeps redirect to
  the new owner;
- **Agent custody delegation** — hand the NFT to an agent sandbox; revoke by `transferFrom` if
  the agent is compromised;
- **Batch halt** — `flushWorkflow(workflowId)` over the workflow's streams.

**Why it is deferred.** The control seam is the **V1 Hub reading `nft.ownerOf(...)` during
settle/flush** to resolve the live payout recipient — a hook the current
`ArcOpenRailsHubV1.sol` **does not have**. Adding it changes *who gets paid* at settle time, so
it requires Hub changes + a dedicated **custody and security review** (per the project's
non-custodial principle). It belongs to **V2 Multi-Vault (Phase 7)**, not Phase 6.

A cheap, optional half-step (if wanted before V2): surface the NFT **read-only** in the
profile/workflow UI (display ownership/redirection intent) **without** wiring it into the Hub's
payout path — informational only, no authority change.

## Receipts / timeline reconciliation

Receipts already cover **open · settlement · recovery · workflow** timelines. This model adds
the **profile** timeline as the aggregation of a participant's receipts across all their streams
and workflows — the missing fifth kind named in `positioning.md`. No new proof primitive is
required; the profile timeline is a *view* over existing receipts + indexed events, labeled
non-authoritative.

## What lands where

- **Phase 6 (in progress):** `profileId` v1 is **built** — an off-chain, address-scoped profile
  surface in the cockpit (`lib/profile.ts` `useProfile`, the Profile tab): aggregates a wallet's
  streams (payer/recipient), workflow groups, receipt timeline, and stats from the existing read
  API; non-authoritative; no contract changes. Merchant (RailsFlow request) + Creator (RailsCard
  claim) surfaces are the next increments. Original framing below.
- **(original)** define and build `profileId` as an **off-chain, address-scoped profile
  surface** (creator + merchant) — earnings, payment history, settlement/residual state, grouped
  by `workflowId`, assembled from the existing indexer. **No contract changes.** Reuses
  everything in "Layer 1" and the Phase 5 read API.
- **V2 / Phase 7:** integrate `workflowNFT` into the Hub (dynamic payout redirect / factoring /
  delegation / batch halt) behind a custody + security review.
- **Unchanged invariants:** non-custodial; the Vault is the single source of truth; profile and
  workflow are non-authoritative projections.

## Open decisions (for ratification)

1. **profileId binding** — confirm address-scoped for v1 (recommended), or hold space for a
   richer identity from the start?
2. **Multi-address profiles** — needed in Phase 6, or a later extension?
3. **workflowNFT in V1** — leave fully to V2, or include the read-only informational half-step in
   the Phase 6 surface?
4. **Vertical focus** — define `profileId` first against the **creator** profile (music royalty)
   or the **agent** profile (x402-metered), given both are Phase 6 candidates.
