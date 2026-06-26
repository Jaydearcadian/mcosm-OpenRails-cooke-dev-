# V2 Factory Prototype: Gas & Migration Notes

This document provides a comparative gas analysis and a structural migration guide for transition from the V1 Multi-Tenant Hub to the V2 Isolated Enterprise Proxy Clones.

---

## 1. Gas Performance Comparison

| Deployment Metric | V1 Multi-Tenant Hub | V2 Proxy Clone (ERC-1167) | Variance / Savings |
| --- | --- | --- | --- |
| **Initial Deployment** | ~3,350,000 gas | **~67,500 gas** | **-97.9% gas savings** |
| **Payer Balance Escrow** | ~145,000 gas | ~148,200 gas | +2.2% proxy overhead |
| **Drip Settlement Settle** | ~62,000 gas | ~62,900 gas | +1.4% proxy overhead |
| **Residual Delta Flush** | ~28,000 gas | ~28,400 gas | +1.4% proxy overhead |

### Findings:
1. **Huge Deployment Savings:** The cost to instantiate a new isolated business vault is reduced by **97.9%**. This allows scaling to thousands of independent business tenants on the Arc Network without capital friction.
2. **Negligible Runtime Overhead:** Executing state modifications (`openPaycardChannel`, `processDripSettle`) on the clone proxy contract incurs a tiny runtime overhead of **~1,000–3,000 gas** due to the `DELEGATECALL` instruction dispatch mechanism. This is a very favorable trade-off for complete storage and asset isolation.

---

## 2. Structural Code Differences

In V1, storage was static, and the logic was coupled to constructor constraints:
```solidity
// V1: Immutable parameters compiled into master code. Requires constructor.
contract ArcOpenRailsHubV1 {
    IERC20_ArcGas public immutable arcUsdc;
    bytes32 public immutable DOMAIN_SEPARATOR;

    constructor(address _arcUsdcNativeGasAddress) {
        arcUsdc = IERC20_ArcGas(_arcUsdcNativeGasAddress);
        // ...
    }
}
```

In V2, variables are stored in standard slots and dynamically written during the initial clone transaction:
```solidity
// V2: Initializable variables stored in proxy slots. Protects logic via constructor seal.
contract ArcOpenRailsHubV2Initializable {
    IERC20_ArcGas public arcUsdc;
    bytes32 public DOMAIN_SEPARATOR;
    bool private _initialized;

    constructor() {
        _initialized = true; // Seals the logic/master implementation contract
    }

    function initialize(address _tokenAddress, address _owner) external {
        require(!_initialized, "Contract already initialized");
        _initialized = true;

        arcUsdc = IERC20_ArcGas(_tokenAddress);
        owner = _owner;
        // ...
    }
}
```

---

## 3. Migration Roadmap for Production

To transition from the current V1 layout to the V2 Factory model in production, the following steps must be followed:

1. **Deploy Master Logic:** Deploy a single instance of `ArcOpenRailsHubV2Initializable` on the target chain. The logic contract's own constructor automatically seals its initialization.
2. **Deploy Registry/Factory:** Deploy the `ArcOpenRailsFactoryV1` passing the logic contract's deployed address as the parameter.
3. **Register/Track Clones:** Any client wanting their own isolated vault calls `deployCorporateVault(tokenAddress)` on the Factory. Webhook workers and indexer systems must monitor the `CorporateVaultDeployed` event and dynamically register new vault clone addresses in their active event loop listeners.
4. **SDK Initialization:** Instantiate the `LeptonOpenRailsClient` by passing the newly deployed clone address into the `verifyingContract` constructor field.
