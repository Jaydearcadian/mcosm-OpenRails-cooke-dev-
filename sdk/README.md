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
