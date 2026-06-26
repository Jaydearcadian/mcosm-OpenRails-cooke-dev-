# OpenRails V1: Workflow Scope Integration & Architecture Specification

This document provides a technical feasibility study, verification, and integration blueprint for adding the **Workflow Scope** (`workflowId`) abstraction to the OpenRails V1 system.

> [!NOTE]
> Planning and analysis note. Confirm current implementation before treating any item as shipped.

---

## 1. Existence Verification
A recursive grep search across all files in the repository (including contract ABIs, the TypeScript SDK, the relayer server, and the stream gateway indexer) confirms:
* **The `workflowId` parameter (and the concept of Workflow Scopes) does not exist in the current codebase.**
* The current state representation is flat: the EIP-712 type definition and the onchain registry are organized solely around `paycardId` and `nonceChannel` / `nonceValue` keys.

---

## 2. Integration Paths (EIP-712 vs. Metadata-Bound)
To achieve the logical grouping of parallel Nonce Lanes and Paycard Streams under a `workflowId`, we have two architectural options.

### Option A: Metadata-Bound Commitment (Zero Contract Changes)
* **How it works:** The `workflowId` is added as an optional field to the `CanonicalMetadataV1` interface. Since the `metadataHash` is computed offchain from this serialized object and signed as part of the core EIP-712 payload, the `workflowId` is **cryptographically bound** to the intent.
* **Smart Contract Impact:** **None.** The Vault contract ([ArcOpenRailsHubV1.sol](../contracts/ArcOpenRailsHubV1.sol)) already validates the signature against the `metadataHash`.
* **State Gas Overhead:** **Zero.** The raw string or bytes of the `workflowId` are never written to the blockchain storage, only the 32-byte `metadataHash` is stored in the `registry` mapping.
* **Offchain Indexing:** The Relayer Gateway and Stream Gateway index the raw JSON metadata, verify it matches `metadataHash`, extract the `workflowId`, and populate database indexes.

```
Payer Signs Envelope
  ├── metadata: { workflowId: "BATCH_2026", ... } ──► hashOpenRailsMetadata() ──► metadataHash
  └── SettlementIntent: { metadataHash, ... } ──► EIP-712 Signature
                                    │
                                    ▼ (Submits to Vault)
                         [ ArcOpenRailsHubV1 ]
                (Verifies metadataHash; stores in registry)
                                    │
                                    ▼ (Event Emitted: PaycardProvisioned)
                         [ Stream Gateway ]
    (Looks up metadata JSON; verifies hash; indexes stream under "BATCH_2026")
```

### Option B: Core EIP-712 Struct Parameter (Future Contract Upgrade)
* **How it works:** If contract upgrades are permissible in a future version (e.g., OpenRails V2), `workflowId` would be added directly as a `bytes32` parameter in the `SettlementIntent` EIP-712 struct layout.
* **Smart Contract Impact:** The `ENVELOPE_TYPEHASH` and the `_openPaycardChannel` EIP-712 parsing logic inside the contract must be updated to expect the extra parameter.
* **State Gas Overhead:** **Zero.** The contract hashes the `workflowId` during signature verification, but does *not* save the value into the `PaycardRegistry` state store.

---

## 3. Offchain Integration Blueprint

### 3.1 SDK: `sdk/src/metadata.ts`
We can extend [metadata.ts](../sdk/src/metadata.ts) to natively support an optional `workflowId` within the metadata object:

```typescript
export interface CanonicalMetadataV1 {
  version: 'openrails-metadata-v1';
  mode: OpenRailsEnvelopeMode;
  originator: string;
  recipient: string;
  token: string;
  amount: string;
  flowVelocityPerSecond: string;
  lifespanSeconds: number;
  // --- Missing Link Abstraction ---
  workflowId?: string; // Opt-in Workflow Scope grouping tag
  metadataRef?: string;
  descriptionHash?: string;
  expiresAt?: number;
}
```

### 3.2 Relayer Gateway: `server/validation.ts`
In [validation.ts](../server/validation.ts), we can capture the `workflowId` from decoded envelopes and include it in preflight responses:

```typescript
export interface OpenPaycardValidationResult {
  decoded: CryptographicEnvelopeV1;
  envelopeMode: OpenRailsEnvelopeMode;
  isWildcardRailsCard: boolean;
  claimRecipient?: string;
  workflowId?: string; // Propagated for gateway indexing
}

// Inside validateOpenPaycardRequest:
const workflowId = decoded.metadata?.workflowId;
```

### 3.3 Stream Gateway: `stream-gateway/state-store.ts`
In [state-store.ts](../stream-gateway/state-store.ts), we can add the property to the offchain projection model:

```typescript
export interface PaycardStreamState {
  paycardId: string;
  payer: string;
  recipient: string;
  metadataHash: string;
  workflowId?: string; // Associative bucket index
  totalAllocation: string;
  availableBalance: string;
  velocity: string;
  genesis: number;
  lifespan: number;
  lastCheckpoint: number;
  status: PaycardStatus;
}
```

This allows the [MemoryCacheStateStore](../stream-gateway/state-store.ts#L47) to implement index helpers:

```typescript
export class MemoryCacheStateStore {
  // Existing store...

  /** Retrieve all active streams associated with a Workflow Scope. */
  getByWorkflow(workflowId: string): PaycardStreamState[] {
    const result: PaycardStreamState[] = [];
    for (const state of this.store.values()) {
      if (state.workflowId === workflowId) {
        result.push(state);
      }
    }
    return result;
  }
}
```

---

## 4. Architectural Summary
By using **Option A (Metadata-Bound Commitment)**, we integrate the Workflow Scope cleanly:
1. **Cryptographic Integrity:** The payer cryptographically binds their payment stream to a specific master job by signing a `metadataHash` derived from metadata containing `workflowId`.
2. **Zero Gas Overhead:** No new fields are written to the onchain storage layout.
3. **No Code Churn:** No contracts require redeployment or modification.
