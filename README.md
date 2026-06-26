# OpenRails V1 on Arc Network

**OpenRails V1** is an intent-driven clearing and settlement infrastructure engineered for the machine economy. Built for the **Lepton Agents Hackathon** (Canteen × Circle × Arc), it pairs off-chain EIP-712 Permission Envelopes with an onchain Vault contract that verifies signatures, escrows USDC, settles earned value, and returns residual buffers.

---

## 1. System Architecture

```
+--------------------------------------------------------------------------+
|                  1. AGENT RUNTIME COMPUTE: LEPTON                        |
|  - An autonomous model determines it needs to pull down an API resource.  |
|  - SDK signs an EIP-712 execution permit completely off-chain.           |
+--------------------------------------------------------------------------+
                                     │
                                     ▼ (Base64-Encoded Transport URL)
+--------------------------------------------------------------------------+
|                  2. LOCAL RELAYER: GATEWAY API                           |
|  - Relayer captures the payload and submits it to the Vault contract.     |
|  - Circle Paymaster support is represented as demo/future-facing stubs.   |
+--------------------------------------------------------------------------+
                                     │
                                     ▼ (Atomic State Transition)
+--------------------------------------------------------------------------+
|                  3. THE RUNTIME SUBSTRATE: ARC NETWORK                   |
|  - Vault verifies EIP-712, nonce lanes, escrow, settlement, and residual. |
|  - Streaming and instant payment modes share one PaycardRegistry row.     |
|  - STN-Delta snaps unspent safety buffer back to the payer recovery vault.|
+--------------------------------------------------------------------------+
```

---

## 2. Codebase Overview

This repository contains the complete end-to-end integration:
* **Smart Contracts**: Deployable Solidity smart contracts built for the Arc Network substrate.
  * [`ArcOpenRailsHubV1.sol`](contracts/ArcOpenRailsHubV1.sol): Core ledger contract containing channel setup, time-based drip settlement, and caller-triggered residual recovery.
  * [`MockUSDC.sol`](contracts/MockUSDC.sol): Mock USDC ERC-20 contract used for local escrow and settlement tests.
* **Off-Chain SDK**: A TypeScript SDK for containerized AI agent compute sandboxes.
  * [`client.ts`](sdk/src/client.ts): Implements the `LeptonOpenRailsClient` class that generates typed EIP-712 cryptographic signatures and compresses payloads into Base64 bearer tokens.
* **Relayer Gateway Server**:
  * [`index.ts`](server/index.ts): An Express API server that intercepts Base64 permission envelopes, runs optional policy preflight, and submits local relayer transactions to the Vault.
* **Interactive Frontend Dashboard**:
  * [`index.html`](dashboard/index.html) and [`app.js`](dashboard/app.js): A local dashboard for generating envelopes, relaying them to the Vault, and observing settlement state.

## 3. Current Milestone Status

OpenRails V1 is demo/public-testnet ready, not audited production software.

* V1 core is complete for the current clearinghouse foundation: EIP-712 envelopes, nonce lanes, RailsFlow, RailsCard, settlement, residual recovery, SDK helpers, gateway validation, and dashboard operation.
* V1.1 Judge Mode / Agentic Spend Mission Control is complete for the current foundation: compact `orc1:` links, metadata-bound workflow indexing, receipt generation, and dashboard receipt/Judge Mode panels.
* Current Arc public-testnet registry: chain ID `5042002`, hub `0x01EC54846524D043fD808152D41596beF603381d`.
* Manual Arc wallet smoke passed: connect wallet, switch/add Arc, open, settle, and flush all worked.
* V2 factory prototype exists, but V2 is integration-incomplete and must not be treated as production-ready.
* Next roadmap order: V1 packaging commit/release notes, paid x402 smoke, workers live smoke, broad V2 integration planning.

---

## 4. Core Mechanics

### 4.1 Vault-Centered Security
The SDK, dashboard, relayer, policy envelope, and stream gateway are convenience layers. The security boundary is the onchain Vault. `ArcOpenRailsHubV1` verifies the EIP-712 signature, enforces `nonceChannel` and `nonceValue`, blocks `paycardId` reuse, escrows USDC, and stores the isolated `PaycardRegistry` row.

Vocabulary is intentionally split:

* **Nonce Lane**: the replay and concurrency lane represented by `nonceChannel` and `nonceValue`. It routes signed intents and does not hold funds.
* **Paycard Stream**: the Vault ledger row keyed by `paycardId`. It holds escrow, recipient, velocity, lifespan, checkpoint, and residual recovery state.

### 4.2 RailsFlow and RailsCard
RailsFlow is a merchant-created pull/payment request. The merchant defines the requested amount, token context, recipient/designation, payment mode, and invoice metadata. The payer reviews the request, adds nonce lane data, signs the completed EIP-712 intent, and the Vault escrows funds.

RailsCard is a payer-created push/value link. It supports two modes:

* **Bearer RailsCard**: the payer signs `recipient == address(0)`, and the first valid claimant binds their wallet through the dedicated claim path. This is first-holder-wins, so intercepted unclaimed links can be redeemed by whoever submits first.
* **Recipient-bound RailsCard**: the payer signs a concrete recipient address. The link still represents a payer-originated push payment, but it cannot be redirected to another wallet.

Fixed RailsFlow and recipient-bound RailsCard envelopes cannot mutate recipients after signing.

Product wording may call the per-channel sequence a `nonceSequence`; the ABI and SDK field name is `nonceValue`.

Both product modes can produce links and QR codes:

* **RailsFlow request link/QR**: unsigned merchant request. It cannot move funds until the payer reviews and signs.
* **RailsCard value link/QR**: payer-signed envelope. Bearer RailsCards are sensitive bearer artifacts because anyone with the unclaimed link can claim first.
* **Signed envelope link/QR**: executable artifact for relayer submission. It can escrow payer funds if relayed successfully.

Links are encoded as URL fragments (`#or=...`) so the payload is not sent to normal HTTP servers as a query string.

### 4.3 Metadata Integrity
Every signed intent includes a `metadataHash` field. For RailsFlow, this commits to the merchant invoice or quote metadata. For RailsCard, it commits to the card terms and claim constraints. `metadataHash` is included in the EIP-712 signature and emitted by the Vault so proofs, indexers, and demos can connect onchain events to the exact offchain terms.

Serialized envelopes may also carry the canonical metadata object. When present, SDK and server helpers verify it hashes back to `metadataHash`, then derive the proof mode from that hash-bound metadata. This keeps fixed-recipient RailsFlow and recipient-bound RailsCard proofs distinct even though both use a concrete recipient address onchain.

### 4.4 Time-Based Linear Drips and Instant Mode
Rather than submitting a transaction every second, the clearinghouse tracks payment streams reactively. Using block clock-math inside `processDripSettle`, the recipient can claim exactly what they have earned up to the current block timestamp. Offchain projections may update between settlements, but authoritative balances only change through onchain transactions.

For one-time payments, `lifespanSeconds == 0` is explicit instant mode. The same Vault row and `processDripSettle` path unlock the full available balance on first valid settlement.

### 4.5 STN-Delta Buffer Recovery
To insulate streams from network delays or exchange spreads, agents over-provision their payment pool:
$$\text{Total Escrow Allocation} = \text{Realized Operational Invoice } (I_{\text{actual}}) + \text{STN-Delta Safety Buffer } (\Delta)$$
When billing concludes or a participant chooses to close the row, the payer or recipient can call `flushResidualDelta`. The Vault settles accrued value first, then returns the remaining variance ($\Delta$) to the payer's recovery address in the same transaction.

For public testnet, early close is intentional: either the payer or recipient may call `flushResidualDelta`. The Vault first settles accrued value, then terminates the row and returns unspent residual to the configured recovery address.

### 4.6 Proof and Policy Boundaries
Policy envelopes are local preflight checks for UX, routing, and sanity validation. They are not authoritative security. Proof-of-payable helpers distinguish signed intent proof from transaction, escrow, settlement, and residual reclaim proof. Signed intent proofs now use the canonical EIP-712 digest and include `metadataHash`.

### 4.7 Service Access Interceptor
After a Paycard Stream is opened, client applications can attach short-lived OpenRails access credentials to service requests:

```http
Authorization: OpenRails <openrails-access-v1>
X-OpenRails-Credential-Type: access-v1
X-OpenRails-Paycard-Id: 0x...
X-OpenRails-Metadata-Hash: 0x...
X-OpenRails-Mode: railsflow
```

These headers are hints plus a signed credential. A service must still verify the Vault row on Arc: chain ID, hub, token, recipient, `paycardId`, `metadataHash`, status, expiry, and balance policy. The SDK interceptor is origin-allowlisted and must not be used as a global fetch wrapper.

---

## 5. Quickstart Guide

### 5.1 Prerequisites
* Node.js v20+
* NPM
* Foundry `forge` for Solidity fuzz and invariant tests

### 5.2 Installation
Install the project dependencies:
```bash
npm install
```

### 5.3 Compile Smart Contracts
Compile the contracts with Hardhat:
```bash
npm run compile
```

### 5.4 Run Tests
Execute the Hardhat unit tests to verify EIP-712 recovery, metadata hash binding, RailsCard bearer and recipient-bound modes, instant mode, linear drips, nonce lanes, and STN-Delta logic:
```bash
npm run test
```

Run Solidity-native Foundry fuzz and invariant tests for capital conservation, nonce sequencing, signed-field tamper rejection, RailsCard wildcard claims, settlement horizon caps, and residual flush authorization:
```bash
npm run test:foundry
```

Current validation baseline:

* `npm run build:sdk` passed.
* `npx tsc --noEmit` passed.
* `npm run test`: 47 Hardhat tests passing.
* `npm run test:foundry`: 8 Foundry tests passing.
* `npx vite build dashboard --outDir /tmp/openrails-dashboard-build` passed.
* `git diff --check` passed.

### 5.5 Start the Local Sandbox Node & Gateway Server
Launch both the local Hardhat blockchain node and the Express Relayer Gateway Server:
```bash
npm start
```
This script runs the local chain on port `8545` and the API gateway on port `3001`. On startup, the server automatically deploys [`MockUSDC`](contracts/MockUSDC.sol) and [`ArcOpenRailsHubV1`](contracts/ArcOpenRailsHubV1.sol), mints USDC to the local demo payer, and approves the clearinghouse. The API does not expose private keys by default.

For local dashboard residual recovery through the API, set `OPENRAILS_ENABLE_DEMO_CUSTODIAL_FLUSH=true` and `OPENRAILS_DEMO_FLUSH_PRIVATE_KEY` to a local Hardhat payer or recipient key. Without that explicit local-only opt-in, submit `flushResidualDelta` directly from the payer or recipient wallet.

### 5.6 Launch the Visualizer Dashboard
Start the Vite frontend development server:
```bash
npm run dev
```
Open `http://localhost:5173` (or the printed port) in your browser to run the interactive playground.

Arc wallet dashboard flow:

* Connected wallets are non-custodial. Open, settle, and flush transactions are submitted by the connected wallet.
* The dashboard can switch to or add Arc testnet using public Arc RPC metadata.
* Local relayer submission, local time travel, and local auto drip are sandbox-only conveniences.

Latest manual Arc dashboard smoke:

* Wallet connected on Arc.
* Open transaction mined.
* Settlement transaction mined.
* Residual flush transaction mined.

## 6. Current Limitations

* This repository is a local sandbox and protocol demo, not audited production software.
* Circle Programmable Wallets and Paymaster behavior are represented as stubs/future integration points.
* Local Hardhat demo keys are for sandbox use only and must not be used for production funds.
* The stream gateway is a non-authoritative projection layer. The Vault remains the source of truth.
* Public-testnet demos must use the current Arc registry for chain ID `5042002` and hub `0x01EC54846524D043fD808152D41596beF603381d`.
* V2 factory contracts are prototypes and remain integration-incomplete.
* Manual security review, key custody approval, and launch signoff remain required before handling non-demo funds.
* Bearer RailsCard links are first-holder-wins until claimed.
* Do not commit production funds, secrets, private RPC URLs, private keys, or production-only addresses.

## 7. Public-Testnet Readiness Checklist

Before public testnet deployment, complete the following:

* Deployment script for `ArcOpenRailsHubV1` against an existing test token address.
* Network-specific Arc RPC configuration and chain ID checks.
* Address registry for deployed Vault, token, relayer, and dashboard config.
* Contract verification and ABI publication.
* Test token funding and allowance setup for demo wallets.
* Stream gateway configuration against deployed addresses.
* Real Circle Paymaster integration after deployed testnet addresses are stable.
* Independent smart contract review before handling any non-demo funds.

### 7.1 Deployment prep

The repository includes a deployment script foundation:

```bash
cp .env.example .env
# edit .env first; placeholders are intentionally invalid
OPENRAILS_DEPLOYMENT_REGISTRY_PATH=deployments/openrails-addresses.local.json npm run deploy:openrails
```

Then run the public-testnet smoke pass against the deployed hub:

```bash
npm run smoke:testnet
```

Required environment variables:

```bash
ARC_RPC_URL=<public testnet rpc url>
ARC_CHAIN_ID=<expected Arc testnet chain id>
DEPLOYER_PRIVATE_KEY=<testnet deployer key>
ARC_USDC_ADDRESS=<testnet USDC or test token address>
ARC_OPENRAILS_HUB_ADDRESS=<deployed ArcOpenRailsHubV1 address>
OPENRAILS_PAYER_PRIVATE_KEY=<funded payer key with USDC allowance and native gas>
OPENRAILS_RELAYER_PRIVATE_KEY=<funded relayer key for native gas>
OPENRAILS_RECIPIENT_ADDRESS=<RailsFlow recipient address>
OPENRAILS_CLAIM_RECIPIENT_ADDRESS=<RailsCard claim recipient address>
OPENRAILS_RECOVERY_ADDRESS=<payer recovery address>
```

The deploy script validates chain ID and USDC address before deploying `ArcOpenRailsHubV1`. If `OPENRAILS_DEPLOYMENT_REGISTRY_PATH` is set, it writes a registry JSON matching `deployments/openrails-addresses.example.json` without secrets or private RPC URLs.

The smoke script validates the registry/env, payer balance, hub allowance, and relayer gas before submitting transactions. It opens one RailsFlow and one bearer RailsCard, then settles and flushes each row. Do not commit private keys, private RPC URLs, local registry files, or production-only addresses.

---

**OpenRails V1** // *Intent-Driven Clearing & Settlement Infrastructure for the Machine Economy.*
