---
name: openrails
description: Use when working with OpenRails stream request, payment, status, recovery, settlement, or close CLI workflows.
---

# OpenRails CLI Skill

Use the `openrails` binary for OpenRails V1 stream operations:

- `request-stream`: create an unsigned RailsFlow request link.
- `pay-stream`: preview, sign, or open a Paycard Stream from a request.
- `stream-status`: read the V1 Hub registry for a stream.
- `recover`: scan bounded `PaycardProvisioned` logs.
- `settle`: submit `processDripSettle`.
- `close`: submit `flushResidualDelta`.

Safety rules:

1. Never ask for or echo private keys, seed phrases, bearer RailsCard links, or production credentials.
2. Never put signer material on argv. Use `OPENRAILS_PAYER_PRIVATE_KEY`, `OPENRAILS_PRIVATE_KEY`, or `--signer-env <ENV_NAME>`.
3. Run mutating commands without `--execute` first, then ask for explicit user approval before transactions.
4. Use `pay-stream --sign-only` when the user only wants a signed envelope/link.
5. Use `pay-stream --execute` only when the user explicitly wants to open the stream onchain.
6. Use `close --execute --ack-irrevocable-close` only after confirming the payer or recipient intends to terminate the stream.
7. Stay on OpenRails V1. Do not route through V2 factory contracts.
