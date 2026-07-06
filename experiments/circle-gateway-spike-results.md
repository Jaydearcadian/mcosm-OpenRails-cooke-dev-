# Circle Gateway Research Spike Results

## Verified Proxy & Implementation Addresses
On Arc Testnet:
*   **GatewayWallet Proxy:** `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`
    *   *Implementation:* `0x44eeddc963a48eaff9e05200caff733f3721fc17`
*   **GatewayMinter Proxy:** `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B`
    *   *Implementation:* `0x9ef4c7ad4f577be713972310e655337bfd0b84bf`

## Contract ABIs (Key Functions)

### GatewayWallet
```solidity
function deposit(address token, uint256 value) external;
function depositFor(address token, address depositor, uint256 value) external;
function totalBalance(address token, address depositor) external view returns (uint256);
function availableBalance(address token, address depositor) external view returns (uint256);
function submitBatch(bytes calldataBytes, bytes signature) external;
```

### GatewayMinter
```solidity
function gatewayMint(bytes attestationPayload, bytes signature) external;
```

## Decimal Handling & Ratio Check
*   **Arc Native USDC (wei-shaped):** 18 decimals
*   **ERC-20 USDC (mwei-shaped):** 6 decimals
*   **Observed Ratio:** `10^12`

When depositing to the Gateway via `GatewayWallet`, the amount passed is represented in the token's native representation (6 decimals for ERC-20 USDC, i.e., `amountBaseUnits` in the SDK). On-chain native balances represent USDC in 18 decimals, so native balances will appear scaled up by `10^12`. No manual scaling is needed for `depositToGateway` parameters because the ERC-20 contract itself exposes 6 decimals, and the `GatewayWallet` expects standard ERC-20 token base units.
