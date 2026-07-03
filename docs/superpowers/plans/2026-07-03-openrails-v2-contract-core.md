# OpenRails V2 Contract Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the V2 master hub authenticate both EOA and EIP-1271 smart-account signers on the open path, and ship the factory + governance-owned canonical default clone — the audited on-chain surface that unblocks Circle Smart Accounts and the already-built Privy/Turnkey adapters.

**Architecture:** Evolve the existing `ArcOpenRailsHubV2Initializable` prototype (a proxy-safe, factory-clonable copy of V1). Replace its `ecrecover`-only `_recoverSigner` with a hand-rolled verifier that accepts a caller-supplied `payer` and validates the signature as either a 65-byte ECDSA sig (EOA) or an EIP-1271 contract signature. Add an explicit `payer` argument to the two open functions, bump the EIP-712 domain to version `2.0.0`, and deploy master → factory → canonical clone. The signed `SettlementIntent` struct is unchanged.

**Tech Stack:** Solidity ^0.8.26, Hardhat (TypeScript tests), Foundry (fuzz), ethers v6.

## Global Constraints

- Solidity `^0.8.26`. Signature verification uses **OpenZeppelin `SignatureChecker.isValidSignatureNow`** (add `@openzeppelin/contracts` v5 as a contracts dependency). Rationale: signature verification is the security-critical path and belongs in the audited library, not hand-rolled — even though the rest of the suite is intentionally dependency-free (Ownable2Step, ReentrancyGuard, SafeERC20 wrappers are inline). This is the only OZ import; keep the rest of the contract's inline primitives as-is.
- **Do NOT modify** `contracts/ArcOpenRailsHubV1.sol` or `test/foundry/ArcOpenRailsHubV1*.t.sol` — V1 is frozen and left to drain.
- All V2 contract work lives in `contracts/v2-factory/` (compiled by both Hardhat and Foundry via `foundry.toml` `src = "contracts"`). **Leave the stale duplicate in `experiments/v2-factory/` untouched.**
- The signed `SettlementIntent` struct and its `ENVELOPE_TYPEHASH` stay **byte-identical to V1** (`payer` is a function argument + verification target, never a signed field).
- EIP-712 domain: `name = "OpenRails Network"`, `version = "2.0.0"`.
- EIP-1271 magic value / selector: `0x1626ba7e`. Smart accounts are assumed **already deployed** (no ERC-6492 counterfactual support).
- Sacred vocabulary unchanged: Paycard Stream, RailsFlow, RailsCard, Nonce Lane, Receipts, STN-Delta.
- **Never add AI git attribution** (no `Co-Authored-By`, no AI trailer). Author/committer is the user only.
- Commit after each task. **Do not push.** SDK/keeper/cockpit/MCP/server/CLI submission-site changes are a **separate follow-on plan** (see end) — they are blocked on the deployed clone address and out of scope here.

---

### Task 1: Explicit `payer` param + hand-rolled EOA verifier (backward-compatible)

Adds the `payer` argument and a hand-rolled signature verifier covering the EOA path, so an EOA open still works and a payer/signature mismatch reverts. EIP-1271 is added in Task 2.

**Files:**
- Modify: `contracts/v2-factory/ArcOpenRailsHubV2Initializable.sol`
- Test: `test/v2-factory.test.ts`

**Interfaces:**
- Produces: `openPaycardChannel(bytes32 paycardId, bytes32 metadataHash, address recipient, uint256 totalAllocationPool, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds, address residualDeltaRecipient, bytes envelopeSignature, uint256 nonceChannel, uint256 nonceValue, address payer)` — `payer` appended as the trailing arg.
- Produces: `claimWildcardPaycardChannel(...same 11..., address payer)` — `payer` appended as the trailing arg.
- Produces: signature validation via OZ `SignatureChecker.isValidSignatureNow(payer, digest, sig)` (covers both EOA and EIP-1271 in one call).

- [ ] **Step 0: Add the OpenZeppelin contracts dependency**

Run: `npm install --save-exact @openzeppelin/contracts@5.1.0`
Expected: `@openzeppelin/contracts` appears in `package.json` dependencies. (v5 requires Solidity `>=0.8.20`, compatible with `^0.8.26`.)

- [ ] **Step 1: Write the failing test** — update the existing EOA test to pass the trailing `payer` arg, and add a payer-mismatch test.

In `test/v2-factory.test.ts`, in the `"should support openPaycardChannel on clones via EIP-712 signatures"` test, change the `openPaycardChannel` call to append `payerAddress` as the final argument:

```typescript
    await expect(
      (clone.connect(randomUser) as any).openPaycardChannel(
        paycardId,
        metadataHash,
        recipientAddress,
        allocation,
        flowVelocity,
        genesisTimestamp,
        lifespanSeconds,
        recoveryAddress,
        signature,
        nonceChannel,
        nonceValue,
        payerAddress            // <-- new trailing arg
      )
    ).to.emit(clone, "PaycardProvisioned");
```

Add a new test after it (same `describe` block):

```typescript
  it("rejects an open where the claimed payer does not match the signer", async function () {
    const tokenAddress = await mockUSDC.getAddress();
    const payerAddress = await payer.getAddress();
    const recipientAddress = await recipient.getAddress();
    const recoveryAddress = await recovery.getAddress();

    const tx = await factory.connect(payer).deployCorporateVault(tokenAddress);
    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (log: any) => log.fragment && log.fragment.name === "CorporateVaultDeployed"
    );
    const cloneAddress = event.args.vaultAddress;
    const clone = await ethers.getContractAt("ArcOpenRailsHubV2Initializable", cloneAddress);

    const allocation = ethers.parseUnits("100", 6);
    await mockUSDC.mint(payerAddress, allocation);
    await mockUSDC.connect(payer).approve(cloneAddress, allocation);

    const paycardId = ethers.keccak256(ethers.toUtf8Bytes("paycard-mismatch"));
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("terms"));
    const genesisTimestamp = Math.floor(Date.now() / 1000) - 100;

    const domain = {
      name: "OpenRails Network",
      version: "1.0.0",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: cloneAddress,
    };
    const types = {
      SettlementIntent: [
        { name: "paycardId", type: "bytes32" },
        { name: "metadataHash", type: "bytes32" },
        { name: "recipient", type: "address" },
        { name: "totalAllocationPool", type: "uint256" },
        { name: "flowVelocityPerSecond", type: "uint256" },
        { name: "genesisTimestamp", type: "uint256" },
        { name: "lifespanSeconds", type: "uint256" },
        { name: "residualDeltaRecipient", type: "address" },
        { name: "nonceChannel", type: "uint256" },
        { name: "nonceValue", type: "uint256" },
      ],
    };
    const message = {
      paycardId,
      metadataHash,
      recipient: recipientAddress,
      totalAllocationPool: allocation.toString(),
      flowVelocityPerSecond: "1",
      genesisTimestamp,
      lifespanSeconds: 3600,
      residualDeltaRecipient: recoveryAddress,
      nonceChannel: "100",
      nonceValue: "0",
    };
    // Signed by `payer`, but we claim `recipient` is the payer -> must revert.
    const signature = await (payer as any).signTypedData(domain, types, message);
    await expect(
      (clone.connect(randomUser) as any).openPaycardChannel(
        paycardId, metadataHash, recipientAddress, allocation, 1,
        genesisTimestamp, 3600, recoveryAddress, signature, 100, 0,
        recipientAddress /* wrong payer */
      )
    ).to.be.reverted;
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx hardhat test test/v2-factory.test.ts`
Expected: FAIL — the existing test errors on an unexpected 12th argument / the new test does not revert, because `openPaycardChannel` has no `payer` param yet.

- [ ] **Step 3: Implement — add `payer` to `OpenParams`, both external functions, and swap the verifier**

In `contracts/v2-factory/ArcOpenRailsHubV2Initializable.sol`:

(a) Add `payer` to the `OpenParams` struct (after `nonceValue`):

```solidity
    struct OpenParams {
        bytes32 paycardId;
        bytes32 metadataHash;
        address signedRecipient;
        address storedRecipient;
        uint256 totalAllocationPool;
        uint256 flowVelocityPerSecond;
        uint256 genesisTimestamp;
        uint256 lifespanSeconds;
        address residualDeltaRecipient;
        bytes envelopeSignature;
        uint256 nonceChannel;
        uint256 nonceValue;
        address payer;
    }
```

(b) Append `address payer` to `openPaycardChannel` and set it in the `OpenParams`:

```solidity
    function openPaycardChannel(
        bytes32 paycardId,
        bytes32 metadataHash,
        address recipient,
        uint256 totalAllocationPool,
        uint256 flowVelocityPerSecond,
        uint256 genesisTimestamp,
        uint256 lifespanSeconds,
        address residualDeltaRecipient,
        bytes calldata envelopeSignature,
        uint256 nonceChannel,
        uint256 nonceValue,
        address payer
    ) external nonReentrant whenNotPaused {
        if (recipient == address(0)) revert InvalidIntent();
        _openPaycardChannel(OpenParams({
            paycardId: paycardId,
            metadataHash: metadataHash,
            signedRecipient: recipient,
            storedRecipient: recipient,
            totalAllocationPool: totalAllocationPool,
            flowVelocityPerSecond: flowVelocityPerSecond,
            genesisTimestamp: genesisTimestamp,
            lifespanSeconds: lifespanSeconds,
            residualDeltaRecipient: residualDeltaRecipient,
            envelopeSignature: envelopeSignature,
            nonceChannel: nonceChannel,
            nonceValue: nonceValue,
            payer: payer
        }));
    }
```

Apply the identical change to `claimWildcardPaycardChannel` — append `address payer` and add `payer: payer` to its `OpenParams` (keep `signedRecipient: address(0)`, `storedRecipient: claimRecipient`).

(c) In `_openPaycardChannel`, add a payer guard and replace the recovery block. Change the top guards to include:

```solidity
        if (params.payer == address(0)) revert InvalidIntent();
```

Replace:

```solidity
        address payer;
        {
            bytes32 structHash = keccak256(abi.encode(
                ENVELOPE_TYPEHASH,
                params.paycardId,
                params.metadataHash,
                params.signedRecipient,
                params.totalAllocationPool,
                params.flowVelocityPerSecond,
                params.genesisTimestamp,
                params.lifespanSeconds,
                params.residualDeltaRecipient,
                params.nonceChannel,
                params.nonceValue
            ));
            bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
            payer = _recoverSigner(digest, params.envelopeSignature);
        }
```

with:

```solidity
        address payer = params.payer;
        {
            bytes32 structHash = keccak256(abi.encode(
                ENVELOPE_TYPEHASH,
                params.paycardId,
                params.metadataHash,
                params.signedRecipient,
                params.totalAllocationPool,
                params.flowVelocityPerSecond,
                params.genesisTimestamp,
                params.lifespanSeconds,
                params.residualDeltaRecipient,
                params.nonceChannel,
                params.nonceValue
            ));
            bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
            if (!SignatureChecker.isValidSignatureNow(payer, digest, params.envelopeSignature)) revert AccessViolation();
        }
```

(d) Add the OZ import at the top of the file (below the `pragma`), and delete the now-unused `_recoverSigner` function. `SignatureChecker.isValidSignatureNow` handles **both** the EOA path (via `ECDSA.tryRecover`, which already rejects high-`s`/bad-`v` malleability) **and** the EIP-1271 contract path in a single call, so no hand-rolled verifier or magic-value constant is needed. The existing `_SECP256K1N_HALF` constant becomes unused once `_recoverSigner` is deleted — remove it too.

```solidity
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
```

Delete the entire `_recoverSigner(bytes32 digest, bytes memory signature)` function and the `_SECP256K1N_HALF` constant declaration.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx hardhat test test/v2-factory.test.ts`
Expected: PASS — all three tests (clone isolation, EOA open with `payer`, payer-mismatch reverts).

- [ ] **Step 5: Commit**

```bash
git add contracts/v2-factory/ArcOpenRailsHubV2Initializable.sol test/v2-factory.test.ts package.json package-lock.json
git commit -m "V2 hub: explicit payer param + OZ SignatureChecker verification"
```

---

### Task 2: EIP-1271 smart-account coverage + mock 1271 fixture

`SignatureChecker.isValidSignatureNow` (Task 1) already covers the contract-account path, so this task **proves** it with a test-only EIP-1271 wallet and locks in accept/reject coverage for the audit. No contract logic changes here — the test passes because Task 1's `SignatureChecker` call handles EIP-1271.

**Files:**
- Create: `contracts/v2-factory/test/MockERC1271Account.sol`
- Test: `test/v2-factory.test.ts`

**Interfaces:**
- Consumes: `SignatureChecker.isValidSignatureNow` behavior (Task 1), the trailing `payer` open arg (Task 1).
- Produces: `MockERC1271Account` with constructor `(address owner)` and `isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)` returning `0x1626ba7e` iff `signature` is a 65-byte ECDSA sig recovering to `owner`, else `0xffffffff`.

- [ ] **Step 1: Write the mock 1271 account fixture**

Create `contracts/v2-factory/test/MockERC1271Account.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Test-only EIP-1271 wallet: validates a 65-byte ECDSA sig against a fixed owner.
contract MockERC1271Account {
    bytes4 private constant MAGICVALUE = 0x1626ba7e;
    address public owner;

    constructor(address _owner) {
        owner = _owner;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        if (signature.length != 65) return 0xffffffff;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }
        address recovered = ecrecover(hash, v, r, s);
        if (recovered != address(0) && recovered == owner) {
            return MAGICVALUE;
        }
        return 0xffffffff;
    }
}
```

- [ ] **Step 2: Write the failing tests** — a smart-account open (valid + forged) in `test/v2-factory.test.ts`:

```typescript
  it("accepts an EIP-1271 smart-account open and rejects a forged one", async function () {
    const tokenAddress = await mockUSDC.getAddress();
    const recipientAddress = await recipient.getAddress();
    const recoveryAddress = await recovery.getAddress();
    const ownerEoa = payer; // controls the mock account

    // Deploy the mock 1271 account owned by ownerEoa.
    const Mock = await ethers.getContractFactory("MockERC1271Account", deployer);
    const smartAccount = await Mock.deploy(await ownerEoa.getAddress());
    await smartAccount.waitForDeployment();
    const smartAddr = await smartAccount.getAddress();

    // Deploy a clone and fund the SMART ACCOUNT (it is the payer).
    const tx = await factory.connect(deployer).deployCorporateVault(tokenAddress);
    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (log: any) => log.fragment && log.fragment.name === "CorporateVaultDeployed"
    );
    const cloneAddress = event.args.vaultAddress;
    const clone = await ethers.getContractAt("ArcOpenRailsHubV2Initializable", cloneAddress);

    const allocation = ethers.parseUnits("100", 6);
    await mockUSDC.mint(smartAddr, allocation);
    // The smart account has no code to call approve() itself in this fixture, so mint
    // to it and use MockUSDC's owner-free approve path: impersonate the account.
    await ethers.provider.send("hardhat_impersonateAccount", [smartAddr]);
    await deployer.sendTransaction({ to: smartAddr, value: ethers.parseEther("1") });
    const saSigner = await ethers.getSigner(smartAddr);
    await mockUSDC.connect(saSigner).approve(cloneAddress, allocation);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [smartAddr]);

    const paycardId = ethers.keccak256(ethers.toUtf8Bytes("paycard-1271"));
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("terms-1271"));
    const genesisTimestamp = Math.floor(Date.now() / 1000) - 100;
    const domain = {
      name: "OpenRails Network",
      version: "1.0.0",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: cloneAddress,
    };
    const types = {
      SettlementIntent: [
        { name: "paycardId", type: "bytes32" },
        { name: "metadataHash", type: "bytes32" },
        { name: "recipient", type: "address" },
        { name: "totalAllocationPool", type: "uint256" },
        { name: "flowVelocityPerSecond", type: "uint256" },
        { name: "genesisTimestamp", type: "uint256" },
        { name: "lifespanSeconds", type: "uint256" },
        { name: "residualDeltaRecipient", type: "address" },
        { name: "nonceChannel", type: "uint256" },
        { name: "nonceValue", type: "uint256" },
      ],
    };
    const message = {
      paycardId, metadataHash, recipient: recipientAddress,
      totalAllocationPool: allocation.toString(), flowVelocityPerSecond: "1",
      genesisTimestamp, lifespanSeconds: 3600, residualDeltaRecipient: recoveryAddress,
      nonceChannel: "100", nonceValue: "0",
    };

    // Valid: owner signs, payer = smart account.
    const goodSig = await (ownerEoa as any).signTypedData(domain, types, message);
    await expect(
      (clone.connect(randomUser) as any).openPaycardChannel(
        paycardId, metadataHash, recipientAddress, allocation, 1,
        genesisTimestamp, 3600, recoveryAddress, goodSig, 100, 0, smartAddr
      )
    ).to.emit(clone, "PaycardProvisioned");
    expect((await clone.registry(paycardId)).payer).to.equal(smartAddr);

    // Forged: a non-owner signs the same intent -> mock returns 0xffffffff -> revert.
    const forgedSig = await (recipient as any).signTypedData(domain, types, {
      ...message, paycardId: ethers.keccak256(ethers.toUtf8Bytes("paycard-1271-forged")),
    });
    await expect(
      (clone.connect(randomUser) as any).openPaycardChannel(
        ethers.keccak256(ethers.toUtf8Bytes("paycard-1271-forged")),
        metadataHash, recipientAddress, allocation, 1,
        genesisTimestamp, 3600, recoveryAddress, forgedSig, 100, 1, smartAddr
      )
    ).to.be.reverted;
  });
```

- [ ] **Step 3: Run tests to verify the fixture is needed, then passes**

Run: `npx hardhat test test/v2-factory.test.ts`
Expected: PASS — the 1271 accept/reject test passes with **no contract-logic change**, because Task 1's `SignatureChecker.isValidSignatureNow` already validates EIP-1271 signatures. (If run before Step 1 created the fixture, it would fail at `getContractFactory("MockERC1271Account")` — the fixture is the only new artifact.)

- [ ] **Step 4: Commit**

```bash
git add contracts/v2-factory/test/MockERC1271Account.sol test/v2-factory.test.ts
git commit -m "V2 hub: prove EIP-1271 smart-account open + mock 1271 fixture"
```

---

### Task 3: Bump EIP-712 domain to version 2.0.0 + cross-version replay reject

Bumps the domain version and proves a signature made under a `1.0.0` domain no longer verifies.

**Files:**
- Modify: `contracts/v2-factory/ArcOpenRailsHubV2Initializable.sol:182` (the `keccak256("1.0.0")` in `initialize`)
- Test: `test/v2-factory.test.ts`

**Interfaces:**
- Consumes: the `payer` open arg (Task 1).
- Produces: on-chain domain `version = "2.0.0"`. All EOA/1271 tests from Tasks 1–2 must switch their signing `domain.version` to `"2.0.0"`.

- [ ] **Step 1: Write the failing test** — update every `domain` object in `test/v2-factory.test.ts` to `version: "2.0.0"`, and add a stale-version reject test:

```typescript
  it("rejects a signature made under the legacy 1.0.0 domain", async function () {
    const tokenAddress = await mockUSDC.getAddress();
    const payerAddress = await payer.getAddress();
    const recipientAddress = await recipient.getAddress();
    const recoveryAddress = await recovery.getAddress();

    const tx = await factory.connect(payer).deployCorporateVault(tokenAddress);
    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (log: any) => log.fragment && log.fragment.name === "CorporateVaultDeployed"
    );
    const cloneAddress = event.args.vaultAddress;
    const clone = await ethers.getContractAt("ArcOpenRailsHubV2Initializable", cloneAddress);

    const allocation = ethers.parseUnits("100", 6);
    await mockUSDC.mint(payerAddress, allocation);
    await mockUSDC.connect(payer).approve(cloneAddress, allocation);

    const paycardId = ethers.keccak256(ethers.toUtf8Bytes("paycard-stale-domain"));
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("terms"));
    const genesisTimestamp = Math.floor(Date.now() / 1000) - 100;
    const staleDomain = {
      name: "OpenRails Network",
      version: "1.0.0", // legacy
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: cloneAddress,
    };
    const types = {
      SettlementIntent: [
        { name: "paycardId", type: "bytes32" },
        { name: "metadataHash", type: "bytes32" },
        { name: "recipient", type: "address" },
        { name: "totalAllocationPool", type: "uint256" },
        { name: "flowVelocityPerSecond", type: "uint256" },
        { name: "genesisTimestamp", type: "uint256" },
        { name: "lifespanSeconds", type: "uint256" },
        { name: "residualDeltaRecipient", type: "address" },
        { name: "nonceChannel", type: "uint256" },
        { name: "nonceValue", type: "uint256" },
      ],
    };
    const message = {
      paycardId, metadataHash, recipient: recipientAddress,
      totalAllocationPool: allocation.toString(), flowVelocityPerSecond: "1",
      genesisTimestamp, lifespanSeconds: 3600, residualDeltaRecipient: recoveryAddress,
      nonceChannel: "100", nonceValue: "0",
    };
    const staleSig = await (payer as any).signTypedData(staleDomain, types, message);
    await expect(
      (clone.connect(randomUser) as any).openPaycardChannel(
        paycardId, metadataHash, recipientAddress, allocation, 1,
        genesisTimestamp, 3600, recoveryAddress, staleSig, 100, 0, payerAddress
      )
    ).to.be.reverted;
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx hardhat test test/v2-factory.test.ts`
Expected: FAIL — the prior tests now sign with `2.0.0` but the contract still computes the domain with `1.0.0`, so valid opens revert.

- [ ] **Step 3: Implement — bump the version in `initialize`**

In `contracts/v2-factory/ArcOpenRailsHubV2Initializable.sol`, in the `DOMAIN_SEPARATOR` assignment inside `initialize`, change:

```solidity
            keccak256("1.0.0"),
```

to:

```solidity
            keccak256("2.0.0"),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx hardhat test test/v2-factory.test.ts`
Expected: PASS — all opens verify under `2.0.0`; the legacy-`1.0.0` signature reverts.

- [ ] **Step 5: Commit**

```bash
git add contracts/v2-factory/ArcOpenRailsHubV2Initializable.sol test/v2-factory.test.ts
git commit -m "V2 hub: bump EIP-712 domain to version 2.0.0 (cross-version replay guard)"
```

---

### Task 4: Canonical-clone deployment script

A script that deploys master → factory → the governance-owned canonical default clone, and writes the addresses to a registry JSON. Verified by running it against a local Hardhat node.

**Files:**
- Create: `scripts/deploy-v2-core.ts`
- Reference (pattern): `scripts/deploy-openrails.ts`, `deployments/openrails-addresses.example.json`

**Interfaces:**
- Consumes: compiled `ArcOpenRailsHubV2Initializable` (master), `ArcOpenRailsFactoryV1` (factory), the trailing-`payer` open ABI (Tasks 1–3).
- Produces: a registry JSON at `process.env.OPENRAILS_V2_REGISTRY_PATH` (default `deployments/openrails-v2-addresses.local.json`) with `{ chainId, masterLogic, factory, canonicalHub, usdc }`.

- [ ] **Step 1: Write the deploy script**

Create `scripts/deploy-v2-core.ts`:

```typescript
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const usdc = process.env.ARC_USDC_ADDRESS;
  if (!usdc || !ethers.isAddress(usdc)) {
    throw new Error("ARC_USDC_ADDRESS must be a valid token address");
  }
  const [deployer] = await ethers.getSigners();
  const governance = process.env.OPENRAILS_V2_GOVERNANCE || (await deployer.getAddress());

  // 1. Master logic (sealed by its own constructor).
  const Master = await ethers.getContractFactory("ArcOpenRailsHubV2Initializable", deployer);
  const master = await Master.deploy();
  await master.waitForDeployment();
  const masterAddr = await master.getAddress();

  // 2. Factory pointed at the master.
  const Factory = await ethers.getContractFactory("ArcOpenRailsFactoryV1", deployer);
  const factory = await Factory.deploy(masterAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();

  // 3. Canonical default clone, owned by governance.
  //    deployCorporateVault initializes owner = msg.sender, so call from governance.
  const govSigner = governance === (await deployer.getAddress())
    ? deployer
    : await ethers.getSigner(governance);
  const tx = await (factory.connect(govSigner) as any).deployCorporateVault(usdc);
  const receipt = await tx.wait();
  const ev = receipt.logs.find((l: any) => l.fragment && l.fragment.name === "CorporateVaultDeployed");
  if (!ev) throw new Error("CorporateVaultDeployed not emitted");
  const canonicalHub = ev.args.vaultAddress as string;

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const out = { chainId, masterLogic: masterAddr, factory: factoryAddr, canonicalHub, usdc };
  const outPath = process.env.OPENRAILS_V2_REGISTRY_PATH
    || path.join("deployments", "openrails-v2-addresses.local.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("OpenRails V2 core deployed:", out);
  console.log("Registry written to", outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it against a local node**

Run:
```bash
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000 \
OPENRAILS_V2_REGISTRY_PATH=/tmp/or-v2.json \
npx hardhat run scripts/deploy-v2-core.ts
```
Expected: prints `OpenRails V2 core deployed:` with four addresses and writes `/tmp/or-v2.json`. (On the in-process Hardhat network the USDC address need not be a real token — the script only records it; do NOT open a stream here.)

- [ ] **Step 3: Verify the registry file shape**

Run: `cat /tmp/or-v2.json`
Expected: JSON with `chainId`, `masterLogic`, `factory`, `canonicalHub`, `usdc`, all `0x…` addresses.

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy-v2-core.ts
git commit -m "V2 deploy: master + factory + governance-owned canonical clone script"
```

---

### Task 5: Foundry conservation fuzz for the V2 open path

Ports the V1 capital-conservation invariant to a V2 clone with the explicit `payer` arg, fuzzing the new signature path against accounting leakage.

**Files:**
- Create: `test/foundry/ArcOpenRailsHubV2Fuzz.t.sol`
- Reference (template): `test/foundry/ArcOpenRailsHubV1Fuzz.t.sol`

**Interfaces:**
- Consumes: `ArcOpenRailsFactoryV1.deployCorporateVault`, the trailing-`payer` open ABI, domain `version = "2.0.0"`.

- [ ] **Step 1: Write the fuzz test**

Create `test/foundry/ArcOpenRailsHubV2Fuzz.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../../contracts/v2-factory/ArcOpenRailsHubV2Initializable.sol";
import "../../contracts/v2-factory/ArcOpenRailsFactoryV1.sol";
import "../../contracts/MockUSDC.sol";

interface VmV2 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
}

contract ArcOpenRailsHubV2FuzzTest {
    VmV2 internal constant vm = VmV2(address(uint160(uint256(keccak256("hevm cheat code")))));

    ArcOpenRailsHubV2Initializable public hub;
    MockUSDC public usdc;

    uint256 internal payerPrivateKey = 0xA11CE;
    address internal payer;
    address internal recipient = address(0xDEEB001);
    address internal recovery = address(0xBEEFCAFE);

    bytes32 internal constant ENVELOPE_TYPEHASH = keccak256(
        "SettlementIntent(bytes32 paycardId,bytes32 metadataHash,address recipient,uint256 totalAllocationPool,uint256 flowVelocityPerSecond,uint256 genesisTimestamp,uint256 lifespanSeconds,address residualDeltaRecipient,uint256 nonceChannel,uint256 nonceValue)"
    );

    function _bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        require(min <= max, "bad bounds");
        if (value < min) return min;
        if (value > max) return min + (value % (max - min + 1));
        return value;
    }

    function setUp() public {
        usdc = new MockUSDC();
        ArcOpenRailsHubV2Initializable master = new ArcOpenRailsHubV2Initializable();
        ArcOpenRailsFactoryV1 factory = new ArcOpenRailsFactoryV1(address(master));
        address clone = factory.deployCorporateVault(address(usdc));
        hub = ArcOpenRailsHubV2Initializable(clone);

        payer = vm.addr(payerPrivateKey);
        usdc.mint(payer, 20_000_000 * 1e6);
        vm.prank(payer);
        usdc.approve(address(hub), type(uint256).max);
        vm.warp(1_700_000_000);
    }

    function testFuzz_V2ConservesCapitalOnResidualClose(
        uint256 allocation,
        uint256 velocity,
        uint256 lifespan,
        uint256 elapsed
    ) public {
        allocation = _bound(allocation, 1 * 1e6, 1_000_000 * 1e6);
        velocity = _bound(velocity, 1, 100 * 1e6);
        lifespan = _bound(lifespan, 10, 365 days);
        elapsed = _bound(elapsed, 1, lifespan * 2);

        bytes32 paycardId = keccak256(abi.encode("v2-conservation", allocation, velocity, lifespan, elapsed));
        bytes32 metadataHash = keccak256(abi.encode("metadata", paycardId));
        uint256 genesis = block.timestamp;

        bytes memory signature = _signIntent(paycardId, metadataHash, allocation, velocity, genesis, lifespan);

        hub.openPaycardChannel(
            paycardId, metadataHash, recipient, allocation, velocity,
            genesis, lifespan, recovery, signature, 0, 0, payer
        );
        require(usdc.balanceOf(address(hub)) == allocation, "escrow not locked");

        uint256 recipientBefore = usdc.balanceOf(recipient);
        uint256 recoveryBefore = usdc.balanceOf(recovery);

        vm.warp(genesis + elapsed);
        vm.prank(payer);
        hub.flushResidualDelta(paycardId);

        uint256 recipientDelta = usdc.balanceOf(recipient) - recipientBefore;
        uint256 recoveryDelta = usdc.balanceOf(recovery) - recoveryBefore;
        require(recipientDelta + recoveryDelta == allocation, "INVARIANT_VIOLATION: CAPITAL_LEAKAGE");
        require(usdc.balanceOf(address(hub)) == 0, "INVARIANT_VIOLATION: ESCROW_LEFTOVER");
    }

    function _signIntent(
        bytes32 paycardId,
        bytes32 metadataHash,
        uint256 allocation,
        uint256 velocity,
        uint256 genesis,
        uint256 lifespan
    ) internal returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            ENVELOPE_TYPEHASH, paycardId, metadataHash, recipient,
            allocation, velocity, genesis, lifespan, recovery, uint256(0), uint256(0)
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", hub.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPrivateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
```

- [ ] **Step 2: Run the Foundry suite**

Run: `forge test --match-contract ArcOpenRailsHubV2FuzzTest -vv`
Expected: PASS — `testFuzz_V2ConservesCapitalOnResidualClose` runs its fuzz batch with no invariant violation. (The signed struct uses the fixed recipient and reads the clone's own `DOMAIN_SEPARATOR`, so version `2.0.0` is picked up automatically.)

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run: `npx hardhat test && forge test`
Expected: Hardhat — all `v2-factory` tests plus the untouched V1 suite pass. Foundry — V1 suite plus the new V2 fuzz pass.

- [ ] **Step 4: Commit**

```bash
git add test/foundry/ArcOpenRailsHubV2Fuzz.t.sol
git commit -m "V2 hub: Foundry capital-conservation fuzz over the explicit-payer open path"
```

---

## Verification (end-to-end)

1. **Unit + fuzz:** `npx hardhat test && forge test` — all green (V1 suites untouched; V2 factory tests cover clone isolation, EOA open with `payer`, payer-mismatch reject, EIP-1271 accept/reject, legacy-domain reject; Foundry covers V2 capital conservation).
2. **Compile clean:** `npx hardhat compile` — no warnings from the new contract/fixture.
3. **Deploy dry-run:** run `scripts/deploy-v2-core.ts` against a local node (Task 4) and confirm the registry JSON has master/factory/canonicalHub/usdc.
4. **Testnet e2e (manual, pre-audit, out of this plan's automated scope):** deploy the V2 core to Arc testnet, then do one real open against an actual Circle Smart Account (over-fund the account per the Arc native-USDC quirk — `transferFrom` can't move a holder's entire balance), confirming the live EIP-1271 path. This is the real-account counterpart to the Task 2 mock.

## Follow-on (separate plan — blocked on the deployed canonical clone address)

Repointing the clients is a distinct, deploy-address-dependent subsystem and gets its own plan. It appends the trailing `payer` arg and switches the EIP-712 signing domain to `version "2.0.0"` at every submission/signing site, and points defaults at `canonicalHub`:
- `sdk/src/client.ts` (`buildOpenRailsDomain` version → parameterized/`2.0.0`), `sdk/src/wallet.ts` (ABI strings + `openPaycardChannel`/`claimWildcardPaycardChannel` arg lists).
- `workers/reconciliation-worker/src/index.ts` (HUB_ABI open signatures + `relayOpen` args), `server/index.ts`.
- Cockpit: `cockpit/src/lib/contracts.ts` (HUB_ABI), `cockpit/src/lib/useRailsActions.ts`, `cockpit/src/pages/Creator.tsx`, `cockpit/src/components/cockpit/OpenStreamModal.tsx`.
- `mcp/` context/tools default hub; `scripts/smoke-openrails-testnet.ts`.
- Version handling must let V1 (draining) keep signing `1.0.0` while V2 uses `2.0.0`.

## Self-review notes

- **Spec coverage:** EIP-1271 (Tasks 1–2) ✓; explicit `payer` param (Task 1) ✓; OZ `SignatureChecker.isValidSignatureNow` on the security-critical path, per the approved spec (Task 1) ✓; domain `2.0.0` + replay guard (Task 3) ✓; factory/clone reused as-is + canonical clone deploy (Task 4) ✓; test matrix — EOA back-compat, 1271 accept/reject, payer-mismatch, legacy-domain reject, clone isolation, Foundry conservation, testnet e2e note (Tasks 1–5 + Verification) ✓; `SettlementIntent` byte-identical ✓; WorkflowNFT/session-keys/paymaster excluded ✓; V1 untouched ✓; assumptions (deployed accounts, permit EOA-only) respected — no permit work here ✓.
- **Type consistency:** `SignatureChecker.isValidSignatureNow(payer, digest, sig)`, the `MockERC1271Account` magic value `0x1626ba7e`, and the trailing-`payer` open ABI are used identically across Tasks 1–5 and the Foundry test.
- **No placeholders:** every code/test/command step carries concrete content.
