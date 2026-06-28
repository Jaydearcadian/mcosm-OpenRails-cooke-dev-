# Circle/x402 Smoke — Results & Status

Status date: 2026-06-28. This records exactly what was and was not proven, so no claim
outruns the evidence.

## Summary

| Check | Status | Evidence |
| :--- | :--- | :--- |
| HTTP 402 protocol mechanics (challenge → resolve → 200 + settlement id) | **PASS** | `x402-smoke-harness.ts` run, below |
| Real artifact endpoint field contract + escrow boundary | **VERIFIED (by inspection)** | `server/index.ts` `/api/x402/openrails-artifact` |
| Live **paid** settlement via Circle facilitator on Arc testnet | **NOT EXECUTED** | blocked — see "What is not proven" |

## What is proven

### 1. Protocol mechanics (mock harness)

`npx ts-node experiments/x402-smoke/x402-smoke-harness.ts` passes end to end:

- Attempt 1 (no headers) → `402 Payment Required` with `WWW-Authenticate: OpenRails payment-challenge-v1`
  and `X-OpenRails-Price-Per-Call: 100000`.
- Attempt 2 (with `X-OpenRails-Paycard-Id` + signed `X-OpenRails-Proof`) → `200 OK`, balance
  deducted, `X-OpenRails-Settlement-Id` returned.

This proves the 402 metered-access loop. It is a **mock**: balances are in-memory and no Circle
facilitator or onchain settlement is involved.

### 2. Real artifact endpoint contract (by inspection)

`GET /api/x402/openrails-artifact` (`server/index.ts`) already returns every field required by the
Phase 4 roadmap exit criteria, and keeps x402 payment proof strictly separate from Vault escrow:

- `x402`: `payer`, `amount`, `network`, `settlementId`, `facilitatorUrl`
- `openrails`: `chainId`, `vaultAddress`, `tokenAddress`, `serviceOrigin`, `scope`, `metadata`,
  `metadataHash`, and **`vaultEscrowClaimed: false`** with `openRailsSettlementStage: "metadata_only"`.

The endpoint is gated by `requireArcX402Mode` (Arc testnet mode only) and Circle's
`createGatewayMiddleware(...).require(price)`. In local mode it does not activate, so it cannot
falsely report a paid settlement.

## What is NOT proven (and why)

The **paid** end-to-end smoke against the live Circle facilitator was not executed in this
environment. It requires all of:

1. The server running in `OPENRAILS_DASHBOARD_MODE=arc-testnet` against the published Arc registry.
2. A **funded** Arc testnet buyer wallet holding test USDC (from the Circle faucet) that signs a
   real `TransferWithAuthorization` to the Circle facilitator (`https://gateway-api-testnet.circle.com`).
3. Actually spending test USDC through the facilitator + relayer batch.

No funded buyer key is available here, and spending testnet funds requires the operator's key and
explicit authorization. The facilitator host is reachable from this environment (HTTP probe
succeeded), so the blocker is funding/authorization, not connectivity.

Per the roadmap, the endpoint is therefore left **gated** (its existing `requireArcX402Mode` +
facilitator middleware), and no paid-smoke success is claimed.

## How to complete the paid smoke (operator steps)

1. Fund an Arc testnet buyer wallet with test USDC: <https://faucet.circle.com/>.
2. Start the server in Arc mode:
   ```bash
   OPENRAILS_DASHBOARD_MODE=arc-testnet \
   OPENRAILS_DEPLOYMENT_REGISTRY_PATH=deployments/openrails-addresses.local.json \
   npm run server
   ```
3. From the buyer wallet, request `GET /api/x402/openrails-artifact`; resolve the `402` by signing
   the Circle x402 `TransferWithAuthorization` and retrying.
4. On `200`, record from the artifact JSON: `x402.payer`, `x402.amount`, `x402.network`,
   `x402.settlementId`, `x402.facilitatorUrl`, and `openrails.{chainId, vaultAddress, tokenAddress,
   serviceOrigin, scope, metadataHash}`. Confirm `openrails.vaultEscrowClaimed === false`.
5. Paste the captured fields into this file under a new "Paid run" heading.

### Required env (paid run)

```bash
OPENRAILS_DASHBOARD_MODE=arc-testnet
OPENRAILS_X402_SELLER_ADDRESS=<arc testnet seller/recipient address>
OPENRAILS_X402_FACILITATOR_URL=https://gateway-api-testnet.circle.com
OPENRAILS_X402_PRICE=$0.01
# Buyer wallet (funded with Arc testnet USDC) is supplied by the buyer client, not the server.
```
