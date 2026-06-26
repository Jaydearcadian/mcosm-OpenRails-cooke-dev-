# OpenRails V2 Design Spec: Enterprise Sovereignty Factory (ERC-1167 Clones)

This document provides a technical feasibility study, verification, and integration design for the **Enterprise Proxy Vault Factory** (Module 02 Roadmap) on OpenRails V1.

> [!NOTE]
> Planning and analysis note. Confirm current implementation before treating any item as shipped.

---

## 1. Codebase Verification (What Exists)

A codebase inspection shows that **no on-chain ERC-1167 minimal proxy factory or corporate isolated vaults exist currently in the repository**.
* The file [factory.ts](../sdk/src/factory.ts) is an off-chain helper (`DeterministicPaycardIdFactory`) that generates deterministic `paycardId` strings using keccak256; it is not an on-chain deployer.
* The test scripts and local relayer server use Ethers' standard `ContractFactory` to deploy mock contracts directly, rather than using proxy clones.

---

## 2. On-Chain Integration: `ArcOpenRailsFactoryV1.sol`

To support isolated enterprise environments on-chain at minimal gas costs, we define a lightweight Factory contract. It deploys an **ERC-1167 Minimal Proxy** referencing a deployed master logic hub (`ArcOpenRailsHubV1`).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/proxy/Clones.sol";

contract ArcOpenRailsFactoryV1 {
    address public immutable masterLogicHub;
    address[] public deployedVaults;
    mapping(address => bool) public isDeployedVault;

    event CorporateVaultDeployed(address indexed vaultAddress, address indexed owner, address token);

    constructor(address _masterLogicHub) {
        require(_masterLogicHub != address(0), "Invalid master logic hub");
        masterLogicHub = _masterLogicHub;
    }

    /**
     * @notice Deploys a sovereign, gas-optimized ERC-1167 clone of the master OpenRails logic.
     * @param _token - The ERC20 clearing token designated for this corporate vault (e.g. USDC).
     * @return cloneAddress The address of the newly deployed isolated proxy contract.
     */
    function deployCorporateVault(address _token) external returns (address cloneAddress) {
        // Clone the master logic contract using ERC-1167 assembly bytecode
        cloneAddress = Clones.clone(masterLogicHub);

        // Pass initialization to the proxy context (e.g., set owner, pause state, and token address)
        // Note: The Hub contract will need an `initialize(address token, address owner)` helper.
        (bool success, ) = cloneAddress.call(
            abi.encodeWithSignature("initialize(address,address)", _token, msg.sender)
        );
        require(success, "Initialization failed");

        deployedVaults.push(cloneAddress);
        isDeployedVault[cloneAddress] = true;

        emit CorporateVaultDeployed(cloneAddress, msg.sender, _token);
    }
}
```

---

## 3. Off-Chain SDK Integration: Perfect EIP-712 Compatibility

Because the **EIP-712 Domain Separator** standard requires declaring the exact target contract, the SDK is **natively compatible out of the box** with zero structural code changes:

```typescript
export function buildOpenRailsDomain(
  chainId: number,
  verifyingContract: string, // Dynamically maps to the Corporate Proxy address
): ethers.TypedDataDomain {
  return {
    name: 'OpenRails Network',
    version: '1.0.0',
    chainId,
    verifyingContract, // Encodes the corporate vault instance address
  };
}
```

* **Integration Step:** To interact with an isolated corporate vault, client applications simply instantiate the SDK client ([LeptonOpenRailsClient](../sdk/src/client.ts#L172)) using the corporate proxy vault's unique deployed address:
  ```typescript
  const corporateClient = new LeptonOpenRailsClient(
    PRIVATE_KEY,
    "0xCorporateProxyAddress...", // Siemens or Circle-specific isolated proxy address
    ARC_CHAIN_ID
  );
  ```

---

## 4. Gateway Integration: Multi-Vault Support

To support multiple corporate vaults dynamically, both the Express Relayer Server and the Stream Gateway must be upgraded from static contract instances to dynamic registry lookups:

### A. Express Relayer Gateway (`server/index.ts`)
* Add a `X-OpenRails-Vault-Address` request header parameter to incoming submissions.
* The relayer checks this address against the `ArcOpenRailsFactoryV1` registry using `isDeployedVault[vaultAddress]`.
* Transactions are forwarded directly to the specific proxy address rather than a single static address.

### B. Stream Gateway (`stream-gateway/index.ts`)
* The gateway listens to the `CorporateVaultDeployed` event from the central factory contract.
* Upon catching the event, the gateway calls `pool.subscribe(newVaultAddress, ...)` to dynamically inject the new vault's event logs into its active indexing queue.
* The state cache database stores stream structures tagged with the respective `vaultAddress` to group transactions by corporate tenants.

---

## 5. Architectural Comparison Matrix

| Metric | V1 Multi-Tenant Hub | V2 Enterprise Clones (Roadmap) |
| --- | --- | --- |
| **On-Chain Footprint** | One large master contract | Array of lightweight 45-byte proxies |
| **State Separation** | Shared global storage structures | **Isolated state variables per proxy** |
| **Deployment Gas Cost** | ~3,500,000 gas | **~65,000 gas (ERC-1167 clone)** |
| **Asset Support** | Fixed clearing token | Customizable per-proxy clearing token |
| **Co-Tenant Risk** | Exposed to protocol-wide risk | **0% blast radius from other tenant exploits** |
