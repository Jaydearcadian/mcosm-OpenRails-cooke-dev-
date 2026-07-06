# Webapp Dashboard — Information Architecture & Onboarding UX

## Context

Cockpit (`cockpit/`) is being replaced by a new webapp built outside this repo. That webapp's
actual code will be shared and dropped in to replace cockpit; this spec is the information
architecture and onboarding UX it should follow once that happens, designed against what's
already live (durable indexer, faucet, gasless relay, Privy-capable SDK) rather than against
cockpit's existing visuals (which are not meant to carry over — only its *functional* shape is a
reference).

This spec covers the dashboard's IA only. It does not cover: Circle Smart Account adapter, Circle
Gateway, CCTP cross-chain funding, session keys/x402 finalization, or the music sidecar finish —
each of those is a separate subsystem getting its own brainstorm → spec → plan → build pass later,
in this order (agreed 2026-07-05):

1. Wire this IA into the shared webapp code, against the already-live indexer/faucet/relay/SDK.
2. Circle Smart Account adapter (additive — the Hub already accepts any EIP-1271 signer).
3. Pause/resume mechanics + finish the music/creator sidecar.
4. Circle Gateway + CCTP cross-chain (after a quick spike confirming Circle's infra actually
   supports Arc as a domain).
5. Session keys + x402 paid-access finalize (agent vertical depth).

## Decisions locked this session

- **Role model**: one connected identity, multiple hats — no separate merchant/creator/business
  login. Matches how cockpit already works (a single sidebar, not per-role apps).
- **Connect UX**: one unified "Connect" button (Privy modal: email/social → auto-created embedded
  wallet, or bring-your-own-wallet). No visible sign-in/sign-up fork. Circle Smart Account and
  Circle Gateway are **not shown** in the connect UI yet (neither is verified working) — the
  account layer is built against the SDK's existing `OpenRailsAccount`/`OpenRailsSubmitter`
  abstraction so a Circle Smart Account option can be added later as a third option in the same
  modal, additively. On first connect, if the address's USDC balance is near zero, an inline
  "Get testnet funds" prompt wired straight to the Faucet Worker appears — no separate page visit
  needed.
- **RailsFlow/RailsCard + one-time/streaming**: one creation flow ("New Payment"), not separate
  top-level nav items. Mode is hierarchical — RailsFlow / RailsCard as the top-level choice,
  Bearer / Recipient-Bound as a nested sub-choice only shown under RailsCard (they're a property
  of RailsCard, not a peer of RailsFlow) — plus an independent one-time/streaming type toggle. See
  the "New Payment" section below for the full breakdown; this corrects cockpit's existing
  `OpenStreamModal`, which flattens all three modes into one row.
- **Merchant/Creator pages**: folded into one **Streams** view with filters (All / Sent / Received
  / Bearer cards awaiting claim), since they showed structurally the same stream data under
  different labels once creation is unified.
- **Paste-a-link UX**: the existing address/paycardId search bar also recognizes a full
  RailsFlow/RailsCard link or raw `#or=` token, and opens it in an in-dashboard modal (reusing the
  existing terms/pay/claim hook) rather than navigating away. The standalone `/openrails/flow` and
  `/openrails/card` routes are unchanged — they're still what a logged-out visitor lands on from a
  raw shared link.
- **Closed-link behavior**: opening a link (pasted or clicked) does a live on-chain status read on
  the target paycard *before* rendering. If already `Terminated`, show the receipt (amounts, tx
  links) directly instead of a stale pay/claim prompt that would just revert.
- **Explorer**: in scope for this pass (the indexer worker already provides the query capability
  cockpit's old Explorer stub never had).
- **Agents**: a minimal oversight view ships now — address labeling + aggregate spend over tagged
  addresses (real, using the same indexer query Streams uses) plus a visibly-marked "Session keys
  & spend budgets — coming soon" placeholder, since session keys don't exist yet.

## Sidebar composition

| Item | Purpose | Backend |
|---|---|---|
| **Deck** | Home/telemetry — total escrow, velocity, active count | Indexer `/streams` (aggregate), direct `balanceOf` read |
| **Streams** | Every stream where the connected address is payer or recipient, filterable (All / Sent / Received / Bearer awaiting claim) | Indexer `/streams?payer=`/`?recipient=`, `/streams/:vault/:paycardId/history` |
| **New Payment** | Action (not a route) — opens the unified create modal | SDK `LeptonOpenRailsClient` + `payGasless` / relay-open |
| **Receipts** | Full receipt/history timeline | Indexer `/transactions/:hash`, `/streams/:vault/:paycardId/history` |
| **Agents** | Address labeling + aggregate spend per tagged address; "Session keys & budgets" marked coming soon | Indexer `/streams?payer=<tagged address>` |
| **Explorer** | Search by wallet / paycardId / workflowId / tx hash; paycardId matches across multiple vaults show a disambiguation list first | Indexer `/vaults`, `/streams`, `/transactions/:hash`, `/workflows/:id` (honestly surfaces the "not supported yet" response) |
| **Faucet** *(testnet-only, hideable via env flag)* | Address field + button | Faucet Worker `POST /fund` |

## Deck

Seven panels, adapted from cockpit's existing (real, non-fabricated) ones — all scoped to the
*connected wallet's own* aggregate, not global (that's Explorer's job):

1. **Operational float** — wallet's live USDC balance + Hub allowance. Allowance is now
   per-(wallet, vault) since New Payment can target any vault — default to the canonical hub's
   allowance, expandable only if the wallet has approved more than one.
2. **Real-time streaming velocity** — Σ velocity over the wallet's own active streams (payer +
   recipient combined).
3. **Workflow/lane traffic map** — grouped by workflowId with the same honest paycardId-prefix
   fallback as today, still limited by the workflowId indexer gap noted under Explorer.
4. **STN-Delta realization curve** — cumulative residual reclaimed, wallet-scoped.
5. **Total escrow payables** — Σ availableBalance over the wallet's active streams.
6. **Gateway/relay capabilities** — reflects what's actually live: relay-open, relay-claim,
   auto-settle via keeper (see Streams below), faucet availability, network mode.
7. **Recent activity (compact ledger)** — last handful of events for this wallet only, each
   deep-linking to the explorer, with a "View all →" link to Receipts — not a duplicate of
   Receipts' full ledger, just a glance.

## Streams

Same card design as cockpit's existing `StreamCard` — status badge, type badge, live-draining
balance bar, stats grid (Total/Velocity/Expires/Recovery/Payer/Recipient with "you" badges) —
filterable per the All / Sent / Received / Bearer-awaiting-claim decision above. Two fixes to make
while wiring this, not just carrying it forward as-is:

- **Settle is mostly automatic already** — the reconciliation/relay worker's keeper cron
  drip-settles every active stream on its own schedule. The manual "Settle" button is a "force it
  now" convenience, not something required for the stream to progress — add a small inline note so
  users don't think nothing's happening if they never click it.
- **Flush has no confirmation step today**, but it permanently ends the stream (matches the CLI's
  own `--ack-irrevocable-close` requirement for the same action) — add a confirm step before
  submitting.
- **Vault awareness**: each card must show which vault it lives on (a small badge — "canonical" or
  a shortened factory-clone address) and settle/flush must target *that* vault's contract, not an
  assumed single hub — the same composite-key theme as Explorer/Receipts.

## New Payment (unified create modal)

Mode selection is **hierarchical, not flat** — RailsFlow and RailsCard are the two named
primitives (sacred vocabulary); bearer vs. recipient-bound is a property of RailsCard, not a
third peer alongside it (both differ only in whether `recipient` is `address(0)` at signing
time). Cockpit's existing `OpenStreamModal` flattens all three into one row — don't carry that
forward.

- **Level 1 toggle**: RailsFlow / RailsCard.
- **Level 2** (only shown when RailsCard is selected): Bearer / Recipient-Bound, as a nested
  sub-segmented control, not a sibling row.
- **Type toggle** (independent of the above): One-time (`lifespanSeconds == 0`) / Streaming (`> 0`).

The recipient-address field's label/requirement follows the resolved mode: RailsFlow →
"Recipient Address" (required). RailsCard + Bearer → "Claimer Address" (optional — bearer mode
doesn't require knowing it upfront). RailsCard + Recipient-Bound → "Recipient Address" (required,
locked to that address).

Submits via `payGasless` by default (gas-sponsored, matching existing `LinkLanding` language),
with a self-submit fallback link — same pattern already proven in cockpit.

## Link modal / closed-link flow

1. Parse the pasted/clicked link's static payload (existing `parseOpenRailsLink`).
2. Read the target paycard's live on-chain status (indexer or direct `registry()` read).
3. If still open: render today's terms + pay/claim experience, in a dialog.
4. If already `Terminated`: render the receipt (amounts, tx links) directly — no action button.

## Receipts

The personal, chronological *event* ledger — distinct from Streams, which is organized by
current stream state, not by event history. Grounded in the SDK's existing receipt shape
(`sdk/src/receipts.ts`: `payment_opened` / `settlement_processed` / `residual_recovered`), which
maps 1:1 to the indexer's stored event names (`PaycardProvisioned`/`SettlementFlushed`/
`ResidualDeltaReclaimed`).

- Reverse-chronological feed of every open/settle/residual-recovery event across all the
  connected wallet's streams, as payer *or* recipient combined.
- Each row: type badge, amount, counterparty, timestamp, paycardId (shortened, clickable → jumps
  to that stream in Streams/Explorer), tx hash (linked to the block explorer).
- Filters: by type, by counterparty address, by date range.
- Summary stats: total settled all-time, total residual recovered all-time, total streams opened.
- Per-row **"view/export receipt"** action produces the actual portable `OpenRailsReceipt` JSON
  (`serializeReceipt`) — a real proof artifact, not just a UI display. Show a "✓ metadata
  verified" badge only when metadata is actually available and `verifyReceiptMetadataHash` passes;
  otherwise show just the hash, no false verified claim.

**Design call (not a blocker, a deliberate choice)**: there is no single "all events for this
address" indexer endpoint today. Building this ledger means fetching the wallet's stream list
(`/streams?payer=`/`?recipient=`, already needed for Streams anyway) and pulling
`/streams/:vault/:paycardId/history` per stream, merging client-side. Fine at testnet scale
(dozens of streams per user); a dedicated backend aggregate endpoint is a future optimization if
someone ends up with hundreds of streams.

## Explorer

Not search-only — a live browsable view, like a lightweight chain explorer:

- **Default/empty state** (before typing anything): a recent-activity feed of the
  most-recently-updated streams across all watched vaults, plus the list of watched vaults itself
  (canonical hub + any factory clones) — always something to look at, not a blank search box.
- **Search bar** (extends the existing address/paycardId component), behavior by input shape:
  - **Wallet address** → role summary (streams where it's payer vs. recipient) + the list of those
    streams + aggregate stats (total escrowed, total settled).
  - **paycardId, single vault match** → jumps straight into that stream's full history (same
    rendering Streams' own drill-down uses).
  - **paycardId, multiple vault matches** → disambiguation list (vault address + discovery source)
    before drilling into history — necessary because `paycardId` alone is no longer globally
    unique (factory clones can theoretically collide, per `buildMetadataBoundPaycardId`'s scope).
  - **Transaction hash** → all events tied to that hash + the affected stream(s), straight from
    the indexer's `/transactions/:hash` shape.
  - **workflowId** → the honest "not supported yet" state (the indexer can't derive workflowId
    from chain events alone) rather than a blank result that looks broken.

**Backend gap this surfaced — CLOSED (2026-07-06)**: paycardId and transaction hash are both
`0x` + 64 hex characters — indistinguishable by format alone. The indexer worker's `/streams`
endpoint (`workers/indexer-worker/src/index.ts`) now accepts a `paycardId` param (`SELECT * FROM
idx_paycard_state WHERE paycard_id = ?` across all vaults, deployed live), so Explorer queries the
indexer directly rather than only searching whatever's already loaded client-side. Zero matches
falls back to `/transactions/:hash` in case the value is actually a tx hash; zero matches on both
means a genuine, verified "not found," not a client-side loading-window artifact.

## Agents view

- **"Your tagged agents"** — a list the user manages themselves, client-side (no new backend):
  address + a free-text label (e.g. "Content bot"). Each row shows live stats pulled the same way
  Streams already does (`/streams?payer=<address>`): active stream count, total escrowed, total
  settled-to-date, current velocity. Clicking a tagged agent opens the same Streams detail view,
  pre-filtered to that address as payer.
- A separate, clearly-marked **"Session keys & spend budgets — coming soon"** section — one or two
  lines explaining what it becomes once session keys ship (scoped, revocable delegated signers
  with daily/velocity caps). A labeled placeholder, not scaffolding for an unbuilt feature.
- Nothing else needed: an agent today is just a regular address signing intents, so it already
  shows up correctly everywhere else (Streams, Explorer) — this view is purely a convenience layer
  over data that already exists.

## Non-goals (explicitly out of scope for this pass)

- Circle Smart Account / Circle Gateway UI or wiring.
- CCTP cross-chain deposit flow.
- Session key creation/management (only a "coming soon" label in the Agents view).
- x402 paid-access finalize.
- Music/creator sidecar completion, pause/resume mechanics.

Each of the above gets its own design pass in the order listed in Context, once reached.
