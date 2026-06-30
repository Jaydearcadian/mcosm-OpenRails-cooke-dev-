# OpenRails Traction Bots

Simulated **agent-to-agent streaming micropayments** on Arc testnet, for load-testing /
dogfooding the rail. **This is simulation, not organic users** — report it as such.

## What it does
Each funded bot wallet acts as an autonomous payer-agent: within a budget it opens **sub-cent**
streaming payouts (`openPaycardChannel`) to other wallets ("creators") and drip-settles them
(`processDripSettle`), then stops at the cap. Non-custodial: each bot signs + self-submits with
its own key + funds. Uses the **public Arc RPC only** (never a tracked/token RPC).

## Run it
```bash
# 1) generate the fleet (keys gitignored; only addresses printed)
BOT_WALLET_COUNT=13 npm run bots:wallets

# 2) fund the printed addresses from the Circle faucet (USDC + a little gas)
#    https://faucet.circle.com

# 3) run a batch
OPS_PER_BOT=2 AMOUNT_USDC=0.002 BUDGET_USDC=0.05 npm run bots:run
```

## Env knobs
| var | default | meaning |
| :-- | :-- | :-- |
| `RPC_URL` | `https://rpc.testnet.arc.network` | public Arc RPC (keep it public) |
| `OPS_PER_BOT` | `2` | payments each bot makes per run |
| `AMOUNT_USDC` | `0.002` | per-payment stream allocation (keep sub-cent) |
| `VELOCITY_BASE_PER_SEC` | `5` | drip rate (base units/sec) |
| `LIFESPAN_SECONDS` | `300` | stream lifespan |
| `BUDGET_USDC` | `0.05` | per-bot spend cap |
| `ARC_OPENRAILS_HUB_ADDRESS` / `ARC_USDC_ADDRESS` / `ARC_CHAIN_ID` | from `deployments/openrails-addresses.local.json` | targets |

## For your other agents
Hand them this folder + the `.bot-wallets/wallets.json` (a wallet each) and the env above. Each
agent process can run `bots:run` against the public RPC independently. Metrics land in
`experiments/traction-bots/metrics.json` (gitignored).

## Honesty
Unfunded wallets are skipped. Metrics are real on-chain numbers labeled
`"kind": "simulation/load-test (not organic users)"`. Keep organic adopters counted separately.
