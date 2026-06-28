# openrails close

Submit `flushResidualDelta` to close a stream and recover remaining residual.

```bash
openrails close --execute --ack-irrevocable-close --chain-id <id> --rpc-url <url> --hub <address> --paycard-id <bytes32>
```

Set `OPENRAILS_PAYER_PRIVATE_KEY` in the session or use `--signer-env` before execution. Close is gated because it terminates the stream row. `--execute` and `--ack-irrevocable-close` are both required before a transaction is submitted.
