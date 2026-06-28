# openrails settle

Submit `processDripSettle` for a stream.

```bash
openrails settle --execute --chain-id <id> --rpc-url <url> --hub <address> --paycard-id <bytes32>
```

Set `OPENRAILS_PAYER_PRIVATE_KEY` in the session or use `--signer-env` before execution. The command is dry-run by default. Never pass private keys on argv.
