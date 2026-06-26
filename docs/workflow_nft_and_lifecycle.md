# OpenRails V1 Extension Spec: Workflow Position NFT & Lifecycle Management

This document maps the architectural mechanics of tokenizing a **Workflow Scope** as an **ERC-721 position NFT** (`OpenRailsWorkflowNFT.sol`) and defines how it coordinates stream lifecycles, halting behaviors, and delegation.

---

## 1. Anchoring Lanes to the Master Job
By cryptographically binding the `workflowId` to the EIP-712 envelope (either via metadata or direct envelope fields), multiple independent **Nonce Lanes** and **Paycard Streams** are tied to a single master job.

When a stream is provisioned with a `workflowId`, it is registered under that Workflow Scope. If the `workflowId` is tokenized, the holder of the associated ERC-721 token obtains administrative control over the entire bundle of streams.

---

## 2. Stream Lifecycle & Halting Mechanics

### Scenario A: Halting a Single Lane through the Master Job
If a caller wants to halt only **one** stream in a multi-lane workflow (e.g., stopping energy payment but keeping parts procurement active):
1. The administrator calls `flushResidualDelta(paycardId)` on the specific target stream.
2. The Vault's `onlyAuthorizedClearingNode` modifier queries the NFT module:
   * Is this `paycardId` bound to a `workflowId`?
   * If yes, who owns the NFT for this `workflowId`?
3. If the caller is the current owner (or approved operator) of the Workflow NFT, the Vault executes the flush, terminates that specific stream, and returns the unused safety buffer to the recovery address. **The other streams in the workflow remain active.**

### Scenario B: Halting the Entire Workflow (Batch Halting)
If a caller wants to halt **all** lanes associated with a master job in a single command, we can implement an on-chain **Batcher Extension** (e.g., `WorkflowBatcher.sol`) or support it directly in the NFT contract:
1. The NFT contract maintains an array of associated `paycardId`s for each `workflowId`:
   ```solidity
   mapping(bytes32 => bytes32[]) public workflowStreams;
   ```
2. The owner calls `flushWorkflow(bytes32 workflowId)` on the Batcher contract.
3. The Batcher contract loops through `workflowStreams[workflowId]` and calls `flushResidualDelta(paycardId)` on the core [ArcOpenRailsHubV1.sol](../contracts/ArcOpenRailsHubV1.sol) contract for each stream.

```
                           [ WORKFLOW OWNER ]
                                   │
                                   ▼ calls flushWorkflow(workflowId)
                         [ WorkflowBatcher ]
                                   │
             ┌─────────────────────┼─────────────────────┐
             ▼ (flush)             ▼ (flush)             ▼ (flush)
     [ Paycard Stream A ]  [ Paycard Stream B ]  [ Paycard Stream C ]
```

---

## 3. The Dynamic Payout & Factoring Mechanics
Integrating the ERC-721 token redirection allows the recipient addresses of streams to resolve dynamically at runtime:

```solidity
// Inside ArcOpenRailsHubV1.sol during flush/settle:
address targetEarningsRecipient = card.recipient;
if (card.workflowId != bytes32(0) && workflowNFTModule != address(0)) {
    IWorkflowNFT nft = IWorkflowNFT(workflowNFTModule);
    if (nft.isWorkflowTokenMinted(card.workflowId)) {
        uint256 tokenId = nft.workflowToToken(card.workflowId);
        targetEarningsRecipient = nft.ownerOf(tokenId); // Payout dynamically routes to the NFT holder
    }
}
```

* **Invoice Factoring:** An SME supplier holding the Workflow NFT can sell or transfer the NFT to a third party (e.g., a credit fund). The moment the NFT transfers, all ongoing linear drips and residual Sweeps are instantly redirected to the new owner's wallet.
* **Agent Custody Delegation:** A master corporate wallet can mint the NFT and temporarily transfer it to an agent's sandbox. The agent can trigger `processDripSettle` or `flushResidualDelta` as the authorized holder. If the agent node is compromised, the master wallet simply calls `transferFrom` or revokes delegation on-chain to disable the agent's control.

---

## 4. Integration Protocol Setup
To integrate this system cleanly without modifying the core ledger contract:
1. The ledger registry holds a fallback static `recipient`.
2. A separate wrapper contract is deployed to orchestrate batch calls.
3. The core Hub reads the NFT owner using an interface lookup to check permissions dynamically.
