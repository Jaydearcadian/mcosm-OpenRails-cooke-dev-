# OpenRails GASOK Webapp — Canonical Blueprint

Status: implementation source of truth  
Target: GIWA GASOK  
Application path: `apps/gasok-web`  
Legacy Cockpit: unchanged

## Product

OpenRails is the control, agreement, and settlement plane for programmable commerce on GIWA.

> Commerce is becoming programmable. Its authority should be too.

Primary CTA: `Enter the system`  
Secondary CTA: `View live deployment`

## Lifecycle

```text
Workspace → Path → Baphomet → Pact → Proof → Settlement → Gaia
```

```text
Own        Workspace
Authorise  Path
Commit     Pact
Prove      Proof
Settle     Rail
Resolve    Gaia
```

## Runtime boundaries

Product-facing name: **OpenRails Runtime**  
Technical name: **BNH Runtime**  
Featured component: **Baphomet Policy Engine**

Baphomet emits only `ALLOW` or `BLOCK`. Human involvement is represented as `WALLET CONFIRMATION REQUIRED`.

The Runtime accepts no private keys and does not sign or broadcast. The connected wallet is the authorization boundary.

## Routes

- `/` — cinematic story that transforms into the interactive system
- `/system` — direct entry into the assembled system
- `/network` — GIWA contracts, account, faucet, balances, Vault/Paycard reads, receipts
- `/build` — Runtime, SDK, MCP, Telegram sidecar, schemas, architecture

## Design system

> Warm editorial modernism × programmable systems diagrams × retro-computing evidence language.

```text
Canvas             #F3F1EC
Surface            #FFFFFF
Primary ink        #0B0A09
Warm dark grey     #4E4B47
Muted text         #9C9992
Hairline border    #DDDAD3
Panel grey         #E8E5DF
Signal coral       #D96543
```

Fonts:

- Interface/editorial: Inter Tight
- Technical signature: Doto

Coral is scarce and functional. No neon, glassmorphism, generic card dashboard, gradient borders, decorative particle fields, or gratuitous motion.

Motion verbs: `Draw`, `Bind`, `Print`, `Route`, `Stop`, `Branch`, `Compress`.

## Narrative

1. Disconnected actors assemble around a Workspace.
2. Path 04 opens as a bounded authority rail.
3. A proposal enters Baphomet.
4. Baphomet records ALLOW or BLOCK.
5. An allowed proposal requires wallet confirmation.
6. Pact terms bind and seal.
7. Proof checkpoints accumulate evidence and verification outcomes.
8. Verified value becomes settlement-eligible.
9. RailsCard/RailsFlow, STN-Delta, Paycard/Vault, and GIWA receipts complete settlement.
10. Gaia preserves and rectifies exceptional outcomes.
11. The narrative collapses into an inspectable system map.

## Provenance

Every relevant value is labelled individually:

- `DEMONSTRATION` — curated neutral product data
- `RECORDED` — previously observed Runtime/testnet state
- `LIVE ON GIWA` — current RPC, contract, balance, Vault/Paycard, or receipt state

## GIWA

```text
Network    GIWA Sepolia
Chain ID   91342
RPC        https://sepolia-rpc.giwa.io
Explorer   https://sepolia-explorer.giwa.io
orUSD      0x162BCaEb04D4c82403c925d3AC9bEC8FFc1C07De
Master     0x21DFc1918FD8c5264F78bA57D861Bc4c1F681dAb
Factory    0x5b59b70272A3948eB3F74CFA292f9dB8B64C4d6d
Vault      0x623daf607A0C8F841a72012BCE19cfe9E5fbAbf1
Faucet     0x86567D16324dB05CABF7c3c4E81cD07F7765a8A4
```

Faucet: 1,000 orUSD per claim, 24-hour cooldown.

## Component boundaries

```text
AppShell
HeroScene
WorkspaceScene
PathScene
BaphometScene
PactScene
ProofScene
SettlementScene
GaiaScene
SystemReveal
SystemCanvas
SystemInspector
ActivityRail
NetworkLedger
BuildArchitecture
WalletControl
FaucetControl
SourceBadge
BindingChain
```

## Acceptance criteria

1. New code exists only under `apps/gasok-web` plus this blueprint.
2. `cockpit/` remains unchanged.
3. `/`, `/system`, `/network`, `/build` exist.
4. Approved tokens and typography are used.
5. Hero, Workspace assembly, and Path handoff are implemented.
6. System canvas supports Permitted, Blocked, and Rectified modes.
7. Provenance badges are visible.
8. Mobile and reduced-motion behaviours exist.
9. GIWA config is centralised.
10. TypeScript/Vite build succeeds once dependencies are installed.
