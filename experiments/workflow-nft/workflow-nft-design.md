# OpenRails V2 Design Spec: Workflow NFT (Tokenized Streaming Ownership)

This specification defines the integration path, interfaces, and security model for tokenizing paycard streams as ERC-721 assets in OpenRails V2.

---

## 1. Usecase & Business Motivation

In OpenRails V1, paycard streams are statically linked to a recipient address (`card.recipient`) and cannot be transferred, paused, or redirected.

By wrapping stream control rights inside a standard **ERC-721 non-fungible token (NFT)**:
* **Tradable Revenue Streams:** Creators can securitize or sell their future streaming royalty streams. For example, an artist can sell an NFT representing their streaming paycard to a sponsor or record label, automatically redirecting the continuous USDC payouts to the new NFT owner on-chain.
* **Granular Streaming Pauses:** Payer corporations can freeze/halt specific lanes dynamically by holding/interacting with administrative NFTs.
* **DeFi Collateralization:** Active revenue-generating paycard streams can be locked inside lending protocols (like NFTfi) as collateral to borrow stablecoins.

---

## 2. Smart Contract Integration Architecture

To implement the Workflow NFT model, the central ledger (`ArcOpenRailsHubV2`) queries the `WorkflowNFT` contract for recipient resolution during settlement check points:

```
             ┌─────────────────────────┐
             │       RECONCILER        │
             └────────────┬────────────┘
                          │ (processDripSettle)
                          ▼
             ┌─────────────────────────┐
             │     ON-CHAIN HUB        │
             └────────────┬────────────┘
                          │ (Query current owner)
                          ▼
             ┌─────────────────────────┐
             │      WORKFLOW NFT       │◄───(Owner calls transferFrom/redirect)
             │   (Token ID = Paycard)  │
             └─────────────────────────┘
```

### Proposed Solidity Hook in Hub Settlement:
```solidity
function _settlePaycard(bytes32 paycardId, PaycardRegistry storage card) internal {
    // 1. Resolve the current recipient from the Workflow NFT owner registry
    address currentRecipient = workflowNft.ownerOf(uint256(paycardId));

    // 2. Check if the NFT owner has set a custom redirection address
    address customRedirect = workflowNft.payoutRedirections(uint256(paycardId));
    if (customRedirect != address(0)) {
        currentRecipient = customRedirect;
    }

    // 3. Verify that the stream is not in a halted state
    require(!workflowNft.isHalted(uint256(paycardId)), "Stream is halted");

    // 4. Calculate elapsed drip and transfer USDC
    // ...
    _safeTransfer(arcUsdc, currentRecipient, accruedDebt);
}
```

---

## 3. Interface Proposal (`IWorkflowNFT.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IWorkflowNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function payoutRedirections(uint256 tokenId) external view returns (address);
    function isHalted(uint256 tokenId) external view returns (bool);

    function redirectPayout(uint256 tokenId, address newRecipient) external;
    function haltStream(uint256 tokenId) external;
    function resumeStream(uint256 tokenId) external;
}
```

---

## 4. Threat Model & Security Considerations

### A. Authorization & Access Violations
* **Threat:** A malicious actor attempts to pause or redirect a stream they do not own.
* **Mitigation:** The `haltStream`, `resumeStream`, and `redirectPayout` functions are strictly guarded by the `onlyTokenOwner(tokenId)` modifier.

### B. Initialization and Double-Mints
* **Threat:** Attempting to mint an NFT for a paycard ID that has already been registered or vice-versa.
* **Mitigation:** The token ID of the NFT is set to the `uint256(paycardId)`. The factory/hub contract mints the NFT atomically during `openPaycardChannel`. The standard ERC-721 check (`_owners[tokenId] == address(0)`) prevents duplicate minting or hijacking of non-existent channels.

### C. Flash Loan and Sandwich Attacks
* **Threat:** Users transferring the NFT mid-block to claim payouts to multiple addresses (double spending the time delta).
* **Mitigation:** The settlement calculations in `_settlePaycard` update `card.lastCheckpointEpoch` to the current block timestamp immediately upon execution. Thus, any transfer of the NFT simply changes the destination of *future* accrued drips; already accrued drips are settled to the recipient up to the exact transaction block epoch.
