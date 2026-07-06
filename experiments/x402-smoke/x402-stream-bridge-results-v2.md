# x402 → Paycard Stream Bridge — Results (non-custodial V2)

Status date: 2026-07-06. Proven on Arc testnet V2 Hub (`0x941C8029F0f912df3fAb7423890ab2359b996D0b`): a paid x402 request is successfully bound non-custodially to a real on-chain Paycard Stream using the settlement ID.

## Summary

*   ✅ **On-Chain V2 Escrow**: 0.05 USDC of the buyer's funds is successfully locked in the V2 Hub.
*   ✅ **Metadata Binding**: The stream is bound with `metadataRef = circle-x402:f33eac84-8290-458e-a7f0-a87216facb14`.

---

## Live Paid Run (2026-07-06)

**x402 leg** (Circle facilitator / Cloudflare Worker):
*   `settlementId`: `f33eac84-8290-458e-a7f0-a87216facb14`
*   `facilitatorUrl`: `https://gateway-api-testnet.circle.com`

**Stream leg** (V2 Hub):
*   `openTxHash`: `0x25bb1008af6026f36b616dfa49093dcecef213a33e8f750fe15292da4fb5557a`
*   `paycardId`: `0x84fae480fd1ddf0cdf0662fc7210f697867e7f8071c16176882f549c4c520c97`
*   `approvalHash`: `0x96b607135536037376a8151fa8f682bde3e21ee87b3065f2985d43be3e2f2410`

### Authoritative on-chain Vault row:
```json
{
  "paycardId": "0x84fae480fd1ddf0cdf0662fc7210f697867e7f8071c16176882f549c4c520c97",
  "payer": "0x29ad0a23354B1de27AE65a20E6e748d5Fa64a5cb",
  "recipient": "0x933a2405F84c224BE1EF373ba16E992e1F459682",
  "metadataHash": "0xd0046f16cbfcc2a8aecbe8724f989dd57c2e45ccc04f465f61419091fd1d30fe",
  "totalAllocationPool": "50000",
  "availableBalance": "50000",
  "flowVelocityPerSecond": "10",
  "lifespanSeconds": 3600,
  "residualDeltaRecipient": "0x29ad0a23354B1de27AE65a20E6e748d5Fa64a5cb",
  "operationalStatus": "Active"
}
```

### Binding metadata:
```json
{
  "version": "openrails-metadata-v1",
  "mode": "railsflow",
  "originator": "0x29ad0a23354B1de27AE65a20E6e748d5Fa64a5cb",
  "recipient": "0x933a2405F84c224BE1EF373ba16E992e1F459682",
  "token": "0x3600000000000000000000000000000000000000",
  "amount": "50000",
  "flowVelocityPerSecond": "10",
  "lifespanSeconds": 3600,
  "metadataRef": "circle-x402:f33eac84-8290-458e-a7f0-a87216facb14"
}
```
