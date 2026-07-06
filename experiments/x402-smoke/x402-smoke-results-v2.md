# Circle/x402 Smoke — Results & Status (V2 Hub)

Status date: 2026-07-06. This records exactly what was proven against the V2 Hub (`0x941C8029F0f912df3fAb7423890ab2359b996D0b`) on the Arc testnet.

## Summary

| Check | Status | Evidence |
| :--- | :--- | :--- |
| HTTP 402 protocol mechanics (challenge → resolve → 200 + settlement id) | **PASS** | `x402-smoke-harness.ts` run |
| Real artifact endpoint field contract + escrow boundary (V2) | **VERIFIED** | Cloudflare Worker `/api/x402/openrails-artifact` |
| Live **paid** settlement via Circle facilitator on Arc testnet | **PASS** | settlement `ce6fd134-c94a-4655-a3dc-6c632ed50eed`; see "Paid run" below |

---

## Paid run — Arc testnet (V2)

**Executed 2026-07-06. Status: PASS.** Captured `PAID RUN RESULT` from `npm run smoke:x402:paid`:

```json
{
  "httpStatus": 200,
  "paidAmountUsdc": "0.01",
  "x402": {
    "payer": "0x29ad0a23354b1de27ae65a20e6e748d5fa64a5cb",
    "amount": "10000",
    "network": "eip155:5042002",
    "settlementId": "ce6fd134-c94a-4655-a3dc-6c632ed50eed",
    "facilitatorUrl": "https://gateway-api-testnet.circle.com"
  },
  "openrails": {
    "chainId": 5042002,
    "vaultAddress": "0x941C8029F0f912df3fAb7423890ab2359b996D0b",
    "tokenAddress": "0x3600000000000000000000000000000000000000",
    "serviceOrigin": "https://openrails-x402-gateway.workers.dev",
    "scope": "GET /api/x402/openrails-artifact",
    "metadataHash": "0x5c62ff762dff539eec2059b07ef651627cbfa3b311d4af86c4a288cb6ef4deda",
    "vaultEscrowClaimed": false,
    "openRailsSettlementStage": "metadata_only"
  }
}
```
