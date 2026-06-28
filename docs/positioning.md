# OpenRails Positioning

This document is the single source of truth for how OpenRails is described. Headline copy in
`README.md`, `HANDOFF.md`, `package.json`, and the dashboard should track this file.

## Canonical framing

> **OpenRails is intent-driven clearing and settlement infrastructure for streamed work on Arc.**
>
> In plain terms, it's a payment rail: a payer signs a payment intent, it **clears** into a
> bounded onchain Vault, value **settles** as work is performed, and unused residual returns
> when the stream ends — usable by **humans or agents**. Arc provides the fast, low-cost
> settlement environment; OpenRails provides the intent, escrow, streaming, receipt, and
> recovery layer on top.

Lead with the precise term ("clearing and settlement") for credibility; immediately back it
with the plain-English category ("payment rail") for accessibility. The two are layers of the
same idea, not competing taglines.

- **Clearing** = validate the signed EIP-712 intent, enforce the nonce lane, escrow into the Vault.
- **Settlement** = drip earned value over time (or release instantly), return residual on close.

## Why this framing

- It is *accurate*: the system performs two-phase clearing then settlement, not just a transfer.
- It restores the original README headline, swapping only "for the Machine Economy" →
  "for streamed work on Arc" — a small, low-churn change.
- "Humans or agents" keeps the rail **vertical-agnostic**, matching the build direction
  (harden the general rail first; add verticals later).
- "on Arc" anchors the settlement environment for the hackathon context. Do **not** hard-code
  Arc-only assumptions into contract/SDK docs — the rail is portable to other EVM chains in
  principle.

## Core pieces (vocabulary — do not rename)

| Primitive | Meaning |
| :--- | :--- |
| **RailsFlow** | Merchant/request link for asking someone to pay for work. |
| **RailsCard** | Payer/value link for sending claimable stream value. |
| **Paycard Stream** | The onchain Vault row that escrows funds and tracks settlement. |
| **Nonce Lane** | Replay/concurrency protection for parallel agent payments. |
| **Receipts** | Verifiable proof artifacts for open, settlement, recovery, workflow, or profile timelines. |

The ABI/SDK field is `nonceValue` (product wording may say `nonceSequence`). Renaming any
primitive or ABI field requires a coordinated pass across contract, SDK, server, dashboard,
tests, and docs — see the HANDOFF watch items.

## Flagship verticals (planned, not yet built)

Once the vertical-agnostic rail is hardened (durable indexing + proven x402), build one of each:

- **Creator economy** — e.g. the music royalty path (scrobble webhook → reconciliation worker
  → artist payout) is the most complete candidate today.
- **Agent economy** — e.g. paid x402 metered API access opening a Paycard Stream.

Neither vertical is part of the current hardening increment.
