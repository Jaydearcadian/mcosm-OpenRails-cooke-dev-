# OpenRails V1: Security Guarantees & EVM Hardfork Analysis

This document provides a technical evaluation of the security profiles of inline zero-dependency implementations (Path A) versus standard libraries (Path B), and analyzes the implications of EVM hardfork compiler selections.

> [!NOTE]
> Planning and analysis note. Confirm current implementation before treating any item as shipped.

---

## 1. Security Guarantees: Path A (Inline) vs. Path B (OpenZeppelin)

### 1.1 ERC-1167 Minimal Proxy Clones
* **Security Equivalence:** **Yes.** The bytecode for an ERC-1167 proxy is a fixed standard defined in [EIP-1167](https://eips.ethereum.org/EIPS/eip-1167). OpenZeppelin's `Clones.sol` library simply uses inline assembly to write these exact bytes to memory and call `create()`.
* **Verdict:** Using custom inline assembly for proxy creation offers the **exact same security guarantees** as OpenZeppelin. Because it uses identical EVM opcodes, there is no structural difference. The only risk is manual encoding typos, which is eliminated by using EIP-1167 verified assembly snippets.

### 1.2 ERC-721 (Workflow Position NFT)
* **Security Equivalence:** **No (Conditional).**
  * OpenZeppelin’s ERC-721 implementation is heavily battle-tested against edge cases like **reentrancy on transfer callbacks** (`onERC721Received` checks in `safeTransferFrom`), **approval clearance** on transfer, and proper balance mapping updates.
  * A custom inline ERC-721 is secure *only if* it restricts transfer capabilities (e.g., locking transfers except through authorized clearing admins) or implements the full standard interface securely.
* **Verdict:**
  * **Factory Clones:** Use **Path A (Inline Assembly)** for maximum gas savings and simplicity.
  * **Workflow NFT:** Use **Path B (OpenZeppelin)** or inherit its audited ERC-721 base logic to prevent common callback and reentrancy transfer vulnerabilities.

---

## 2. EVM Hardfork and Compiler Options

The current repository configuration (`foundry.toml`) targets the **Paris** EVM hardfork (Merge era, September 2022).

### 2.1 Current Mainnet/L2 EVM Hardforks
Since the Paris hardfork, the EVM has progressed through two major hardforks:
1. **Shanghai (March 2023):** Introduced the `PUSH0` opcode.
2. **Cancun (March 2024):** Introduced transient storage (`TSTORE`/`TLOAD`), `MCOPY`, and EIP-4844 blobs.

### 2.2 Benefits of Porting (Upgrading Compiler Version)

If the compiler target is upgraded to a newer hardfork, we unlock significant gas optimizations:

#### Upgrading to Shanghai (`evm_version = "shanghai"`)
* **`PUSH0` Opcode:** Replaces `PUSH1 00` (which costs 3 gas and takes 2 bytes) with `PUSH0` (which costs 2 gas and takes 1 byte).
* **Gas Impact:** Reduces compiler bytecode size and deployment costs by **1-2%**, and saves gas on every contract execution that pushes a zero value to the stack.

#### Upgrading to Cancun (`evm_version = "cancun"`)
* **Transient Storage (`TSTORE`/`TLOAD`):** Allows temporary storage that disappears at the end of the transaction.
* **Gas Impact (Reentrancy Guards):** The current [ArcOpenRailsHubV1.sol](../contracts/ArcOpenRailsHubV1.sol#L18) reentrancy guard uses a persistent state variable `_status`. Writing to this storage slot costs **~20,000 gas** (SSTORE) on first call.
* By porting to Cancun and using transient storage `TSTORE`/`TLOAD` for the reentrancy lock, the gas cost drops to **under 100 gas**, saving **~99%** of the reentrancy guard overhead on every transaction.

```
                    REENTRANCY GUARD GAS COMPARISON
┌─────────────────────────────────────────────────────────────────────────┐
│ Persistent Storage (Paris): ~20,000 gas                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ Transient Storage (Cancun): < 100 gas                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Risks of Porting

* **L2/Sidechain Incompatibility:** Many Layer 2 rollups, sidechains, or private EVM networks do not yet support the latest Shanghai or Cancun opcodes.
  * If bytecode compiled with `PUSH0` (Shanghai) is deployed on an L2 that does not support it (such as Linea, BNB Chain, or older Arbitrum/Optimism versions), the contract deployment will **fail with an invalid opcode revert**.
  * Compiling with `paris` guarantees **100% universal compatibility** across every EVM-compatible chain in existence.

---

## 4. Architectural Recommendation

1. **Keep `evm_version = "paris"` for Release V1:** Universal deployment compatibility outweighs the minor gas savings of `PUSH0` or the reentrancy guard on early testnets.
2. **Path A (Assembly) for Clones:** Deployed directly inline inside the Factory to avoid OpenZeppelin dependencies.
3. **OpenZeppelin for ERC-721 (V2):** Integrate `@openzeppelin/contracts` when deploying the public tradeable Workflow NFT to guarantee standard compliance and transfer security on NFT marketplaces.
