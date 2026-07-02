# openrails-mcp

MCP server that lets an agent transact on the OpenRails USDC rail (Arc) over stdio. Opens and
claims are **gasless by default** — routed through the keeper relay — and the server is
**non-custodial**: it signs with its own configured account and never holds anyone else's keys.

## Tools

| Tool | Purpose |
|---|---|
| `openrails_config` | Network config, the server signer address, and its USDC balance. Read-only. |
| `pay_link` | Pay an OpenRails link — a RailsFlow request (the signer becomes the payer, gasless open) or a RailsCard (claimed to the signer). Returns the tx hash. |
| `create_request_link` | Create a RailsFlow request link to **receive** payment. No signing/tx. |
| `issue_railscard` | Issue a claimable RailsCard link (the server pre-signs as payer). Returns a claim link + paycardId. |
| `paycard_status` | Read a paycard/stream state from chain by id. |

## Configuration (env)

| Var | Default | Notes |
|---|---|---|
| `OPENRAILS_MCP_SIGNER_KEY` | — | Dev signer (raw key). Omit for read-only. For prod, wire a Turnkey/Privy account via `openrails-sdk/adapters` (see below). |
| `OPENRAILS_RPC_URL` | `https://rpc.testnet.arc.network` | Public Arc RPC. |
| `OPENRAILS_CHAIN_ID` | `5042002` | |
| `OPENRAILS_HUB_ADDRESS` | `0x01EC…381d` | ArcOpenRailsHubV1. |
| `OPENRAILS_USDC_ADDRESS` | `0x3600…0000` | |
| `OPENRAILS_RELAY_URL` | deployed keeper | Sponsors gas for opens/claims. |
| `OPENRAILS_APP_BASE_URL` | `https://openrails.pages.dev` | Base for generated links. |
| `OPENRAILS_EXPLORER_BASE_URL` | `https://testnet.arcscan.app` | |

## Run

```bash
npm install && npm run build
OPENRAILS_MCP_SIGNER_KEY=0x... node dist/index.js   # stdio server
```

Register with an MCP client (e.g. Claude Desktop `mcpServers`):

```json
{
  "openrails": {
    "command": "npx",
    "args": ["openrails-mcp"],
    "env": { "OPENRAILS_MCP_SIGNER_KEY": "0x..." }
  }
}
```

Smoke test: `OPENRAILS_MCP_SIGNER_KEY=0x... node smoke.mjs [paycardId]`.

## Publishing

`openrails-mcp` depends on `openrails-sdk`. In-repo that dep is `file:../sdk` for local dev/build.
To publish: (1) publish `openrails-sdk` first, (2) set the dep to the published range —
`"openrails-sdk": "^0.1.0"` — and `npm install`, (3) `npm run build && npm publish`. Leave the dep
as `file:../sdk` in the repo afterward.

## Signer is pluggable

The server builds its signer via the SDK account abstraction (`openrails-sdk`). Dev uses a raw key
(`ethersToSubmitter`); for production swap in `turnkeyToAccount` (server wallets / agents) or
`privyToAccount` (humans) from `openrails-sdk/adapters/*` in `src/context.ts`. Because the OpenRails
Hub authenticates the signature (not `msg.sender`), any EOA-backed account works with no contract
change.
