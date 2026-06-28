# Circle/x402 Buyer Integration Smoke Harness

This directory contains the integration harness simulating the **HTTP 402 (Payment Required) standard** for metered API access-control gateways using OpenRails streaming paycard credentials.

---

## 1. How the x402 Protocol Loop Works

```
[ BUYER SCRIPT ] ───(1. GET Gated Data)───► [ MOCK GATEWAY ]
                                                   │
  ◄──(2. 402 Payment Required Challenge)───────────┤ (Requires Paycard + Proof)
                                                   ▼
[ BUYER SCRIPT ] ───(3. Sign Proof & Retry)──────► [ MOCK GATEWAY ]
                                                   │
  ◄──(4. 200 OK + Settlement Receipt Data)─────────┘ (Escrow Deducted & Content Sent)
```

1. **Initial Access Attempt:** The buyer attempts to access a gated resource (`/api/v1/data`) without payment headers.
2. **Challenge Issued:** The gateway issues an `HTTP 402 Payment Required` status code accompanied by challenge headers:
   * `WWW-Authenticate`: Defines the payment protocol structure (`OpenRails payment-challenge-v1`).
   * `X-OpenRails-Price-Per-Call`: Denotes the fee required per request (e.g. `100000` base units = 0.1 USDC).
3. **Challenge Resolution:** The buyer loads their `paycardId`, signs a message containing the request path and timestamp as a cryptographic proof, and retries the request attaching:
   * `X-OpenRails-Paycard-Id`: The active paycard stream hash.
   * `X-OpenRails-Proof`: The cryptographic signature proof.
4. **Grant Access & Receipt:** The gateway verifies that the paycard is active, has sufficient balance, and that the signature is valid. It deducts the call price, logs a `settlementId`, and returns the requested payload alongside:
   * `X-OpenRails-Settlement-Id`: The cryptographic transaction receipt.
   * `X-OpenRails-Remaining-Balance`: The remaining off-chain paycard pool balance.

---

## 2. Running the Smoke Harness

Ensure node is set up, then run:
```bash
npx ts-node experiments/x402-smoke/x402-smoke-harness.ts
```

Output logs will detail the mock server startup, the HTTP header capture for both the 402 and 200 requests, and the successfully logged settlement receipt.

> **Mock vs. paid.** This harness proves the 402 protocol *mechanics* only — balances are
> in-memory and no Circle facilitator or onchain settlement is involved. The real, paid path is
> the server endpoint `GET /api/x402/openrails-artifact` (`server/index.ts`), gated by Circle's
> facilitator middleware and Arc testnet mode, exercised by the real buyer
> `x402-paid-buyer.ts` (`npm run smoke:x402:paid`). For the runbook, the proven/unproven
> status, and the captured paid-run record, see
> [`x402-smoke-results.md`](./x402-smoke-results.md).
