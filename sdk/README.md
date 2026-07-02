# openrails-sdk

SDK + `openrails` CLI for **OpenRails** — intent-driven clearing & settlement for streamed USDC
work on **Arc**. Sign an intent → clear it into a bounded onchain Vault → settle value as work
is performed → recover residual. Usable by humans or agents.

> Arc testnet: chain `5042002`, Hub `0x01EC54846524D043fD808152D41596beF603381d`,
> USDC `0x3600000000000000000000000000000000000000`.

## Install
```bash
npm i openrails-sdk        # library + the `openrails` CLI
```

## Library
```ts
import {
  LeptonOpenRailsClient,
  hashOpenRailsMetadata,
  buildMetadataBoundPaycardId,
  submitOpenPaycardWithSigner,
  submitSettleWithSigner,
  submitFlushWithSigner,
  approveOpenRailsSpend,
  readNonce,
} from "openrails-sdk";

// 1) sign an EIP-712 permission envelope for a Paycard Stream
const client = new LeptonOpenRailsClient(privateKey, hubAddress, chainId);
const envelopeToken = await client.signPermissionEnvelope(intent, { mode: "railsflow", metadata });

// 2) open it (the signer self-submits; escrow is pulled from the signer's USDC — non-custodial)
await submitOpenPaycardWithSigner(signer, hubAddress, envelopeToken, "railsflow");

// 3) settle (drip) and 4) recover residual
await submitSettleWithSigner(signer, hubAddress, paycardId);   // processDripSettle
await submitFlushWithSigner(signer, hubAddress, paycardId);    // flushResidualDelta
```

The public surface is re-exported from the package root (`client`, `wallet`, `metadata`,
`links`, `receipts`, `nonce`, `proof`, `policy`, `access`, …).

## Signer abstraction & gasless

OpenRails authenticates the **signature, not the sender** (the Hub recovers the payer via
`ecrecover`), so accounts only need to *sign* — submission can be sponsored. The SDK builds on that:

```ts
import { LeptonOpenRailsClient, payGasless, claimGasless, RelayClient, signUsdcPermit } from "openrails-sdk";
import { ethersToSubmitter } from "openrails-sdk/adapters/ethers";

// Any OpenRailsAccount works — no raw private key required.
const account = ethersToSubmitter(anyEthersSigner);              // or privyToAccount / turnkeyToAccount
const client  = await LeptonOpenRailsClient.fromAccount(account, hubAddress, chainId);

// Gasless: the payer signs an intent (+ an EIP-2612 permit) and a relayer submits it.
const relay  = new RelayClient({ baseUrl: RELAY_URL });
const permit = await signUsdcPermit(account, { token: usdc, spender: hubAddress, value, chainId, provider });
await payGasless({ client, relay, intent, options: { mode: "railsflow", metadata }, permit });

// Claim a RailsCard gaslessly (the payer already signed; the claimer needs no gas).
await claimGasless({ relay, envelopeToken, claimRecipient });
```

- **Accounts:** `OpenRailsAccount` (sign-only) / `OpenRailsSubmitter` (also self-submits). An
  `ethers.Signer` satisfies the latter. The `privateKey` constructor still works unchanged.
- **Adapters (subpath exports):** `openrails-sdk/adapters/ethers` · `.../adapters/privy` (humans) ·
  `.../adapters/turnkey` (agents / server wallets). `@privy-io/react-auth` and `@turnkey/ethers` are
  **optional peers** — the core imports neither, so a plain `import` pulls nothing extra.
- **Permit:** `signUsdcPermit` produces an EIP-2612 permit so the payer's approval is a signature,
  not a transaction. Combined with the relay → no gas, no approval tx.

For an agent-facing surface over these, see the companion **`openrails-mcp`** MCP server.

## CLI
```bash
npx openrails --help
npx openrails request-stream …     # build an unsigned RailsFlow request link
npx openrails pay-stream --execute --approve …   # sign + open a Paycard Stream
npx openrails settle  --execute …  # processDripSettle
npx openrails close   --execute --ack-irrevocable-close …   # flushResidualDelta
```

**Safety:** asset-affecting commands are **dry-run by default** (`--execute` to act); `close`
also needs `--ack-irrevocable-close`. **Private keys via env only** (`OPENRAILS_PAYER_PRIVATE_KEY`
or `--signer-env <NAME>`) — never on argv.

## Vocabulary
**Paycard Stream** (onchain Vault row) · **RailsFlow** (request link) · **RailsCard** (claimable
value link) · **Nonce Lane** (replay/concurrency) · **Receipts** (proof artifacts).

Peer dep: `ethers` v6. License: MIT.
