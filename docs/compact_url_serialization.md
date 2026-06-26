# OpenRails V1 Technical Spec: Compact URL Serialization & Packing

This document specifies the design parameters, current codebase state, and implementation blueprint for **Tightly Packed Binary ABI Serialization** to prevent URL truncation across communication platforms.

> [!NOTE]
> Planning and analysis note. Confirm current implementation before treating any item as shipped.

---

## 1. Codebase Verification (Current State)

An inspection of the repository confirms:
* **No binary packing or compact URL compression currently exists in the codebase.**
* In [links.ts](../sdk/src/links.ts#L41) and [serialization.ts](../sdk/src/serialization.ts#L56), envelopes are serialized using verbose string JSON parsing:
  ```typescript
  // Current JSON + Base64 path in V1
  url.hash = `or=${base64UrlEncode(JSON.stringify(artifact))}`;
  ```
* Because keys like `"totalAllocationPool"`, `"flowVelocityPerSecond"`, and `"residualDeltaRecipient"` are repeated in the string representation, payloads containing EIP-712 signatures easily exceed 600 characters, making them highly vulnerable to auto-wrapping or truncating by platforms like Slack, SMS, or WhatsApp.

---

## 2. Compacting Strategy: Fixed-Offset Binary Packing

To minimize payload size, we map the envelope data fields into a fixed-position raw binary array instead of text-based JSON.

### Packed Binary Layout (253 Bytes Target)

| Offset (Bytes) | Field Name | Type | Description |
| --- | --- | --- | --- |
| `0 - 31` | `paycardId` | `bytes32` | 32-byte unique payment hash |
| `32 - 51` | `payer` | `address` | 20-byte EVM address |
| `52 - 71` | `recipient` | `address` | 20-byte EVM address |
| `72 - 91` | `residualDeltaRecipient`| `address` | 20-byte EVM address |
| `92 - 99` | `totalAllocationPool` | `uint64` | 8-byte big-endian integer |
| `100 - 107` | `flowVelocityPerSecond`| `uint64` | 8-byte big-endian integer |
| `108 - 115` | `genesisTimestamp` | `uint64` | 8-byte big-endian integer |
| `116 - 123` | `lifespanSeconds` | `uint64` | 8-byte big-endian integer |
| `124 - 155` | `workflowId` | `bytes32` | 32-byte unique job tracking identifier |
| `156 - 163` | `nonceChannel` | `uint64` | 8-byte big-endian integer |
| `164 - 171` | `nonceSequence` | `uint64` | 8-byte big-endian integer |
| `172 - 236` | `signature` | `bytes65` | 65-byte ECDSA signature (`r` (32B), `s` (32B), `v` (1B)) |
| **Total** | **237 Bytes** | | **Compact raw footprint** |

> [!TIP]
> **Base64 Efficiency:** Encoding a 237-byte packed binary payload results in a URL fragment token of only **316 characters** in Base64URL format (a 60%+ size reduction from the 600+ character JSON representation).

---

## 3. Alternative Compacting Approaches

If the fixed-offset binary strategy is too rigid for dynamic metadata changes, alternative off-chain compression options include:

1. **Protocol Buffers (protobuf):** Generates extremely small binary payloads while supporting optional/new fields. However, it requires a schema definition file and compilation step.
2. **Deflate / Gzip (e.g., using `pako`):** Compresses the JSON string directly. For small payloads, however, the gzip header overhead reduces the effectiveness of the compression.
3. **MsgPack / CBOR:** Automatically encodes JSON objects to compact binary maps. It is highly flexible but is slightly larger than fixed-position binary packing because it must store metadata markers for variable boundaries.

---

## 4. Security & Clipboard Best Practices

### Hash Fragment Security
As seen in the current [links.ts](../sdk/src/links.ts#L60) implementation, the token is stored in the **URL Hash Fragment (`#`)** rather than a query parameter (`?`):
* **Why this matters:** The text following the `#` is handled strictly on the client-side by the browser. It is **never sent to Web2 backend servers** in the HTTP request headers, preventing accidental leaks of signed payment bearer cards in access logs.

### Clipboard Truncation Protection
To prevent copy-paste errors where users double-click and miss the hash fragment, client dashboards should utilize a dedicated Copy Clipboard button with automated link compilation:

```typescript
export async function copySecureLink(baseUrl: string, packedToken: string): Promise<void> {
  const finalLink = `${baseUrl}/checkout#or=${packedToken}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(finalLink);
  }
}
```
This bypasses highlight truncation errors entirely by forcing the exact URL structure into the system clipboard.
