# OpenRails V2 — Contract Core Design (EIP-1271 + Factory/Clone)

**Status:** Design approved, pre-implementation.
**Date:** 2026-07-03
**Scope:** Sub-project 1 of the V2 program (the audited on-chain surface).

---

## 1. Context & roadmap placement

OpenRails is intent-driven clearing & settlement infrastructure on the Arc USDC rail. V1
(`ArcOpenRailsHubV1`, deployed at `0x01EC54846524D043fD808152D41596beF603381d`, chainId `5042002`)
is a single shared multi-tenant hub that authenticates EIP-712 `SettlementIntent` signatures via
`ecrecover`, escrows USDC into a bounded Vault, drips settlement to a recipient, and returns residual
to a recovery address. The adoption layer (SDK pluggable signer + gasless helpers, keeper
`/relay-open` + `/relay-claim`, `openrails-mcp`, cockpit gasless pay) is built and proven on testnet
but is **EOA-only**, because V1's `ecrecover` cannot authenticate smart-contract accounts.

**Roadmap placement.** This spec is **Phase 7 (V2 Multi-Vault)**, but redefined. The prior roadmap
line — "Phase 7 = deploy WorkflowNFTs for transferable payout rights" — is superseded: WorkflowNFT is
**cut** from V2 (see §8) and becomes its own later, coexisting release. Phase 7's real content is
**factory/clone multi-vault + EIP-1271 smart accounts**. The V2 program has three sub-projects, all
converging on **one audit** (Phase 8):

1. **Contract core** — *this spec*: EIP-1271 + factory/clone. The audited on-chain surface.
2. **Session keys** — own later spec (see §8 for posture).
3. **Off-Hub infra** — USDC paymaster, Circle Gateway, SDK `adapters/circle`, keeper extensions.

Phases 5 (Workflow & Indexing) and 6 (Merchant/Creator UIs) are **off-chain and V2-agnostic**:
invoices and receipts are off-chain JSON that hashes to the on-chain `metadataHash`; the stream
gateway validates and indexes it; the cockpit/portals render it. `metadataHash` is byte-identical in
V2, so that layer carries forward unchanged — it only repoints at the new hub(s) and gains a
"watch every clone" requirement (§4).

## 2. Goals & non-goals

**Goals**
- Authenticate **both** EOA and smart-contract (EIP-1271) signers on the open path, so Circle Smart
  Accounts — and the already-shipped Privy/Turnkey EOA adapters — all work against the default hub.
- Ship the **factory + ERC-1167 clone** model (already prototyped + tested) so the default public hub
  and optional isolated enterprise vaults share **one audited master**.
- Preserve every V1 invariant: non-custodial, Vault-as-source-of-truth, bounded escrow, 2D nonce
  lanes, instant mode, residual flush, sacred vocabulary.

**Non-goals (explicitly deferred)**
- WorkflowNFT / tokenized transferable streams (own later release).
- Session keys (own spec; posture in §8).
- USDC paymaster, Circle Gateway, SDK `adapters/circle` (sub-project 3).
- ERC-6492 counterfactual-signature support (see §6 assumption).
- Any change to deployed V1 (it is frozen to new opens and left to drain).

## 3. Deployment topology (decided: "A — canonical clone = default")

1. Deploy the sealed master logic `ArcOpenRailsHubV2` (evolution of the existing
   `ArcOpenRailsHubV2Initializable` prototype). Its constructor sets `_initialized = true`, so the
   master itself is unusable directly — it exists only to be cloned.
2. Deploy `ArcOpenRailsFactory` pointed at the master.
3. OpenRails governance calls the factory **once** to mint the **canonical default clone** — the new
   public hub. Governance becomes its `initialize` owner (pause authority; future fee params). The
   logic is fixed master bytecode — not upgradeable.
4. Enterprise tenants may call the factory for their own isolated clones. Same master bytecode
   secures all of them → **one audit covers the default hub and every clone**.
5. **V1 is frozen to new opens** (clients stop pointing at it) and left live to drain its bounded,
   short-lived escrow. No state migration, no fund movement.

**Version coexistence property.** Because streams are single-hub-scoped (a paycard lives entirely in
one hub's registry, no cross-hub state) and each hub's EIP-712 domain includes its own
`verifyingContract`, versions **accrete rather than retire**: V1 (draining) → V2 (default) → later V3
(default), with V2 continuing to serve its open streams and enterprise clones indefinitely. A future
V3 (e.g. carrying WorkflowNFT) **does not require sunsetting V2**.

## 4. Component design

### 4.1 `ArcOpenRailsHubV2` (master logic, cloned)

Starts from the `ArcOpenRailsHubV2Initializable` prototype (proxy-safe: `initialize` instead of
constructor, storage instead of immutables, constructor seals the master). Unchanged from the
prototype: reentrancy guard, Ownable2Step, Pausable, 2D `accountNonceTracks`, `PaycardRegistry`,
drip math (`_settlePaycard`), instant mode (`lifespanSeconds == 0`), `flushResidualDelta`,
SafeERC20-style wrappers, `PaycardProvisioned`/`SettlementFlushed`/`ResidualDeltaReclaimed` events.

**The only substantive change — signature verification:**

- Replace `_recoverSigner` (which hard-requires `signature.length == 65` + `ecrecover`) with
  OpenZeppelin **`SignatureChecker.isValidSignatureNow(payer, digest, signature)`**. It transparently
  handles both cases: EOA → ecrecover-and-compare (incl. malleability/`s`/`v` checks); contract →
  EIP-1271 `isValidSignature`.
- **Add an explicit `address payer` parameter** to `openPaycardChannel` and
  `claimWildcardPaycardChannel`. This is required because a contract signer cannot be *recovered*
  from bytes — it must be named, then verified. For EOAs, `SignatureChecker` still confirms the
  signature actually belongs to the claimed `payer` (a real signature paired with the wrong `payer`
  fails).
- Consume the nonce against the explicit `payer`, exactly as V1. Escrow via
  `_safeTransferFrom(arcUsdc, payer, ...)`, unchanged.

**The signed `SettlementIntent` struct stays byte-identical to V1** — `payer` is a function argument
and verification target, not a signed field. So the SDK's typed-data signing barely changes.

**Domain:** `initialize` sets `name: "OpenRails Network", version: "2.0.0"`. Replay across hubs/
versions is impossible on two grounds: `verifyingContract` = the clone address, and (for V1↔V2) the
`version` differs.

### 4.2 `ArcOpenRailsFactory`

Unchanged from the `ArcOpenRailsFactoryV1` prototype: `deployCorporateVault(token)` deploys an
ERC-1167 clone and calls `initialize(token, msg.sender)`; records clones in `deployedVaults` /
`isDeployedVault`; emits `CorporateVaultDeployed(vault, owner, token)`. The canonical default clone is
one such deployment, made by governance.

### 4.3 Indexer/keeper requirement (Phase 5 hand-off, not contract work)

Multi-vault means the indexer/keeper must watch every hub. They subscribe to
`CorporateVaultDeployed`, register each clone address, and index/settle across all of them plus the
canonical default. This is the specced seam that keeps Phase 5 working across clones.

## 5. Client changes (ride-along; the contract is the audit gate)

- **SDK:** point the default hub at the canonical clone; sign with domain `version "2.0.0"` +
  `verifyingContract = clone`; pass `payer` on open (the envelope already carries `payerAddress`).
  EOA signing path otherwise unchanged. `adapters/circle` is sub-project 3.
- **Keeper/relay:** pass `payer` to open (already in the envelope); default to the canonical clone;
  keep subscribing to `CorporateVaultDeployed`.
- **Cockpit / MCP:** default hub → canonical clone; EIP-712 domain `version "2.0.0"`.
- **V1:** stop pointing clients at it; leave live to drain.

## 6. Assumptions & caveats (to prevent overclaiming)

- **Smart accounts must be deployed before opening.** EIP-1271 `isValidSignature` is a call to the
  account contract; a counterfactual (undeployed) account would fail. In practice the account must
  already hold USDC and have approved the hub to be escrowed from — both require deployment — so
  plain EIP-1271 suffices and **ERC-6492 is out of scope**.
- **EIP-2612 permit gasless is EOA-only.** USDC `permit` verifies via `ecrecover` on the token, so a
  smart account cannot produce a valid permit. Smart accounts get gasless via a 4337 userOp /
  paymaster instead — sub-project 3. The "no-approval-tx" permit trick remains an EOA feature.
- **Circle Smart Accounts: contract support is in; SDK adapter is later.** This spec makes the hub
  accept their signatures; the client helper to build/sign with one is sub-project 3.

## 7. Testing & audit boundary

**Hardhat**
- EIP-1271 open with a **mock 1271 account** (a test-only contract implementing
  `isValidSignature`, wrapping an owner EOA): valid inner sig → open succeeds; forged inner sig or
  wrong magic value → rejected.
- EOA open still passes via `SignatureChecker` (backward-compatible signing).
- **Payer-mismatch rejected:** a real signature paired with a wrong claimed `payer` fails.
- Factory clone isolation (exists); canonical-clone open → settle → flush e2e.
- Nonce lanes, instant mode, `paycardId` collision, malleability (now inside `SignatureChecker`),
  reentrancy (`nonReentrant` retained).

**Foundry**
- Re-run existing invariants (accounting conservation, nonce lanes, signature tamper rejection,
  wildcard RailsCard claims, horizon caps, flush authorization) against a clone, plus a
  1271-account variant.

**Testnet e2e**
- One real open against an actual Circle Smart Account on Arc testnet (separate from the unit-test
  mock), validating the real EIP-1271 path.

**Audit boundary:** master logic + factory only. One audit secures the default hub and every
enterprise clone. Session keys / paymaster / Gateway are out (their own specs). If session keys later
need a Hub hook, that's a separate audited release — and per §3 it will not require sunsetting V2.

## 8. Cut / deferred, with rationale

- **WorkflowNFT (tokenized transferable streams).** Cut from V2. No current demand pulls on it; it is
  the only novel audit surface (new asset type + settlement-recipient indirection + halt state machine
  on the hot path); opt-in tokenization meant deferring it costs the default path nothing; it deserves
  its own product cycle (marketplace/tokenURI/royalty/threat model). Revived later as its own spec and
  its own coexisting release (a future V3-style master) — **no V2 sunset required** (§3).
- **Session keys.** Deferred to their own spec. Posture: prefer the **4337 / account-layer** approach
  (the smart account grants a scoped, revocable session key that produces userOps), so the hub sees a
  normal EIP-1271 signature and needs **zero change** — this V2 core already supports it. Only a
  **Hub-level delegation registry** would add audited contract surface; avoid unless required.
- **Paymaster / Circle Gateway / SDK `adapters/circle`.** Sub-project 3, mostly off-Hub.

## 9. Open questions

- Governance owner of the canonical default clone: single key vs multisig for pause authority? (Ops
  decision; does not affect the contract design.)
- Whether to also freeze V1 *on-chain* (e.g. a pause) or only stop pointing clients at it. V1 has no
  planned contract change; leaning "clients only," but confirm during rollout.
