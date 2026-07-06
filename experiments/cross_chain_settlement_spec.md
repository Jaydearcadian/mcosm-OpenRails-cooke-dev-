# Specification: Cross-Chain Clearing & Settlement via Circle CCTP

This document specifies the technical architecture for enabling cross-chain funding of OpenRails Paycard Streams. It allows users on source chains (e.g., Base, Arbitrum, Ethereum) to connect their wallets, transfer USDC, and have it automatically clear and settle in the OpenRails Vault on the Arc Network.

---

## 1. Cross-Chain Clearing Architecture

To achieve a frictionless user experience, OpenRails leverages **Circle's Cross-Chain Transfer Protocol (CCTP)**. Because OpenRails settles natively in USDC, CCTP allows us to burn USDC on a source chain and mint it directly on Arc inside the Vault.

```
┌─────────────────────────┐                   ┌─────────────────────────┐
│     1. SOURCE CHAIN     │                   │     2. TARGET CHAIN     │
│   (e.g., Base / Arb)    │                   │      (Arc Network)      │
├─────────────────────────┤                   ├─────────────────────────┤
│    [ User Wallet ]      │                   │    [ Circle Relayer ]   │
│           │             │                   │            │            │
│  (burn USDC on Source)  │                   │     (mints USDC)        │
│           ▼             │                   │            ▼            │
│     [ CCTP Contract ]   │ ──(CCTP Message)─►│    [ OpenRails Hub ]    │
│                         │                   │  (Opens Paycard Stream) │
└─────────────────────────┘                   └─────────────────────────┘
```

### The Transaction Flow
1. **Intention & Signature**: The user (on Base) signs an EIP-712 OpenRails envelope expressing their settlement intent, committing to a specific `paycardId` and `metadataHash`.
2. **Source Burning**: The user submits a transaction on the source chain (Base) calling the CCTP `depositForBurn` function, burning the allocated USDC budget. The `destinationAddress` parameter in the CCTP payload is targeted at the **Arc OpenRails Hub** address.
3. **Cross-Chain Routing**: Circle’s attestation service picks up the burn event, generates a cryptographic attestation, and relays it to Arc.
4. **On-Chain Vault Provisioning**: The Arc OpenRails Hub contract receives the minted USDC via the CCTP receiver hook. The contract verifies the payer's signed envelope, consumes the nonce lane, and provisions the `PaycardRegistry` stream. **The stream is now active on Arc.**

---

## 2. Smart Contract Interface Integration

To support CCTP deposits, the V2 Hub contract ([ArcOpenRailsHubV2Initializable.sol](file:///home/jay/codex/lepton/contracts/v2-factory/ArcOpenRailsHubV2Initializable.sol)) must implement Circle’s `IMessageHandler` interface:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ITokenMessenger {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 nonce);
}

contract ArcOpenRailsHubV2CrossChain {
    // Circle TokenMessenger contract address on Arc
    address public tokenMessenger;
    
    // Maps CCTP transaction nonces to pending OpenRails envelopes
    mapping(uint64 => bytes) public pendingEnvelopes;

    /**
     * @notice Handle incoming minted USDC from CCTP and automatically open the stream.
     */
    function handleReceiveMessage(
        uint32 sourceDomain,
        bytes32 sender,
        bytes calldata messageBody
    ) external returns (bool) {
        require(msg.sender == tokenMessenger, "CrossChain: unauthorized");

        // Parse CCTP message body to extract amount and mintRecipient
        (address recipient, uint256 amount, bytes32 paycardId) = _parseCCTPMessage(messageBody);

        // Fetch the pre-signed envelope associated with this cross-chain deposit
        bytes memory envelope = pendingEnvelopes[uint64(uint256(paycardId))];
        require(envelope.length > 0, "CrossChain: envelope not pre-filed");

        // Execute vault opening using the minted USDC
        _openPaycardChannelFromBridge(paycardId, amount, recipient, envelope);

        return true;
    }
}
```

---

## 3. Off-Chain SDK Wrapper Integration

We extend the TypeScript SDK [client.ts](file:///home/jay/codex/lepton/sdk/src/client.ts) to support cross-chain stream creation:

```typescript
export class LeptonOpenRailsClient {
  // Existing client methods...

  /**
   * Constructs and signs a cross-chain settlement intent, returning the tx data
   * required to trigger the CCTP deposit on the source chain (e.g., Base).
   */
  async prepareCrossChainOpen(
    sourceProvider: ethers.Provider,
    paycardId: string,
    metadataHash: string,
    recipient: string,
    amount: bigint,
    sourceTokenAddress: string,
    targetDomainId: number // Arc Domain ID
  ) {
    // 1. Sign the EIP-712 intent envelope locally
    const envelope = await this.signPermissionEnvelope(paycardId, metadataHash, recipient, amount, 0, 0, this.signer.address);

    // 2. Pre-file the signed envelope to the Relayer Gateway database
    await fetch('http://localhost:3001/api/paycards/prefile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paycardId, envelope })
    });

    // 3. Encode the CCTP TokenMessenger deposit call for the source chain
    const tokenMessengerAbi = [
      "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64)"
    ];
    const sourceTokenMessengerAddress = "0x...SourceTokenMessenger"; // Base CCTP Address
    const messengerContract = new ethers.Contract(sourceTokenMessengerAddress, tokenMessengerAbi, sourceProvider);

    // Target recipient is the Arc OpenRails Hub address (padded to bytes32)
    const targetHubBytes32 = ethers.zeroPadValue(this.clearinghouseAddress, 32);

    const txData = await messengerContract.depositForBurn.populateTransaction(
      amount,
      targetDomainId,
      targetHubBytes32,
      sourceTokenAddress
    );

    return {
      txData,
      paycardId,
      envelope
    };
  }
}
```

---

## 4. Why This Architecture is a Game-Changer
* **Zero Onboarding Friction**: Users do not need to manually configure the Arc Network in their wallets, buy gas tokens, or use bridge websites. They stay on their native chain (like Base) and execute a single transaction.
* **Unified Liquidity**: USDC on any chain becomes instant, streamable utility capital on Arc.
* **Gasless Target-Chain Claims**: The minted CCTP relay is picked up by the Circle Relayer network, meaning the execution on Arc Network is fully automated and paid for by the relayers.
