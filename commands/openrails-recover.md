# openrails recover

Recover stream records from `PaycardProvisioned` logs.

```bash
openrails recover --rpc-url <url> --hub <address> --payer <address>
```

Use `--recipient`, `--metadata-hash`, `--from-block`, `--to-block`, `--limit`, or `--chunk-size` to narrow the log scan. This command is read-only. Add `--dry-run` to validate inputs without scanning logs.
