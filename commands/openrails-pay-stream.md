# openrails pay-stream

Preview, sign, or open a stream payment.

```bash
openrails pay-stream --sign-only --chain-id <id> --hub <address> --token <address> --paycard-id <bytes32> --metadata-hash <bytes32> --recipient <address> --total-allocation-pool <base-units> --flow-velocity-per-second <base-units-per-second> --lifespan-seconds <seconds> --residual-delta-recipient <address> --nonce-channel <n> --nonce-value <n>
```

Set `OPENRAILS_PAYER_PRIVATE_KEY` in the session or use `--signer-env <ENV_NAME>` before signing. Run without `--sign-only` or `--execute` first for a dry-run preview. Use `--sign-only` to return a signed envelope/link without opening. Use `--execute` to submit the open transaction, and add `--approve` only when the user has approved bounded USDC allowance. Never pass private keys on argv.
