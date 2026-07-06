/**
 * OpenRails Docs content. Restructured onto the approved Documentation
 * Architecture IA (Welcome / SDK & Toolkit / Integration Patterns / Protocol
 * Reference). Chain IDs, addresses, endpoints, and code samples are real project
 * facts — do not paraphrase. Code examples match the real exported SDK/worker
 * signatures (sdk/src/adapters/circle.ts, sdk/src/gateway.ts, the workers/).
 */

const H = "https://openrails-indexer-worker.microcosm.workers.dev";

export type Block =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "code"; lang: string; code: string }
  | { kind: "callout"; variant: "note" | "warn"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "kv"; rows: { k: string; v: string }[] }
  | { kind: "steps"; items: { n: string; title: string; body: string }[] };

export type DocPage = {
  eyebrow: string;
  title: string;
  subtitle: string;
  blocks: Block[];
};

export const h2 = (text: string): Block => ({ kind: "h2", text });
export const h3 = (text: string): Block => ({ kind: "h3", text });
export const p = (text: string): Block => ({ kind: "p", text });
export const code = (lang: string, codeStr: string): Block => ({ kind: "code", lang, code: codeStr });
export const list = (items: string[]): Block => ({ kind: "list", items });
export const kv = (rows: { k: string; v: string }[]): Block => ({ kind: "kv", rows });
export const steps = (items: { n: string; title: string; body: string }[]): Block => ({ kind: "steps", items });
export const callout = (variant: "note" | "warn", text: string): Block => ({ kind: "callout", variant, text });

// Linear reading order (drives prev/next). Mirrors the nav grouping below.
export const ORDER = [
  "quickstart",
  "concepts",
  "sdk",
  "sdk-wallet",
  "sdk-gateway",
  "cli",
  "integrate",
  "x402",
  "mcp",
  "sidecar",
  "keepers",
  "cross-chain",
  "onchain",
  "api",
  "relay",
] as const;

export const NAV_GROUPS: { label: string; items: [string, string][] }[] = [
  {
    label: "Welcome",
    items: [
      ["quickstart", "Quickstart"],
      ["concepts", "Core concepts"],
    ],
  },
  {
    label: "SDK & Toolkit",
    items: [
      ["sdk", "SDK reference"],
      ["sdk-wallet", "Wallet abstraction"],
      ["sdk-gateway", "Gateway funding"],
      ["cli", "CLI reference"],
    ],
  },
  {
    label: "Integration Patterns",
    items: [
      ["integrate", "Payment links"],
      ["x402", "x402 gated APIs"],
      ["mcp", "MCP server (agents)"],
      ["sidecar", "MusicBrainz sidecar"],
      ["keepers", "Reconciliation keepers"],
      ["cross-chain", "Cross-chain funding"],
    ],
  },
  {
    label: "Protocol Reference",
    items: [
      ["onchain", "Contracts & onchain facts"],
      ["api", "REST / indexer API"],
      ["relay", "Faucet & gasless relay"],
    ],
  },
];

export const DOCS: Record<string, DocPage> = {
  quickstart: {
    eyebrow: "Welcome",
    title: "Quickstart",
    subtitle:
      "Zero to a first payment. Install the SDK and CLI, fund a testnet wallet, open a stream, watch it settle and refund on-chain — no smart contracts to write.",
    blocks: [
      steps([
        { n: "1", title: "Install the SDK + CLI", body: "One package ships both. Network defaults for Arc testnet are built in." },
        { n: "2", title: "Fund a wallet", body: "The faucet drips testnet USDC (which also covers gas on Arc)." },
        { n: "3", title: "Open a stream", body: "Sign a bounded intent; it clears into the vault and begins streaming." },
        { n: "4", title: "Settle & refund", body: "Stop anytime — the recipient keeps what they earned, the rest returns to you." },
      ]),
      h2("1 · Install"),
      code("bash", "npm i -g openrails-sdk"),
      h2("2 · Fund a wallet"),
      p("The faucet is public and CORS-enabled. It is capped and abuse-resistant — already-funded addresses are skipped."),
      code(
        "bash",
        'curl -X POST https://openrails-faucet-worker.microcosm.workers.dev/fund \\\n  -H "content-type: application/json" \\\n  -d \'{"address":"0xYourWallet"}\'',
      ),
      h2("3 · Open a stream"),
      p("Everything after --recipient is bounded by what you sign. Nothing can move more."),
      code(
        "bash",
        "openrails pay-stream \\\n  --recipient 0x… \\\n  --total-allocation-pool 10000 \\\n  --flow-velocity-per-second 1 \\\n  --lifespan-seconds 3600 \\\n  --execute",
      ),
      callout(
        "note",
        "Live on Arc testnet — real streams open, settle, and refund on-chain. It is early and unaudited, on test funds only.",
      ),
    ],
  },
  concepts: {
    eyebrow: "Welcome",
    title: "Core concepts",
    subtitle: "The vocabulary is fixed. These are the primitives the whole rail is built from, and the trust boundary that keeps it non-custodial.",
    blocks: [
      h2("The primitives"),
      list([
        'Paycard Stream — the on-chain vault row (keyed by paycardId) that escrows USDC and tracks settlement. The "tab" that meters value out.',
        "RailsFlow — a merchant/request link: ask someone to pay for work (invoice · paywall · price tag).",
        "RailsCard — a payer/value link: send claimable stream value, bearer or recipient-bound (gift card · payout · agent budget).",
        "Nonce Lane — 2D replay/concurrency protection (nonceChannel + nonceValue).",
        "Receipts — verifiable proof artifacts for every open, settlement, and refund.",
        "STN-Delta — the over-provision buffer, returned via flushResidualDelta.",
      ]),
      h2("Invariants that always hold"),
      list([
        "Non-custodial: the vault pulls escrow from the intent signer’s own balance. No intermediary — including any relayer — ever holds funds.",
        "The Vault is the source of truth. Any indexer / read API is a non-authoritative projection.",
        "The Hub authenticates the signature, not the sender. Accounts only need to sign; submission can be sponsored.",
        "paycardId is NOT vault-scoped. Always key state by (vaultAddress, paycardId) together.",
        "Arc’s USDC is also the native gas token — over-provision rather than spending to the last unit.",
      ]),
      h2("Trust boundary"),
      p(
        "The payer’s keys never leave the client — the client signs an EIP-712 envelope. A relayer can sponsor gas, but it can only submit the exact envelope that was signed; mutating any field invalidates the signature.",
      ),
      code(
        "text",
        "[ User / Agent ] --- signs EIP-712 intent only ---> [ Relayer / Keeper ]\n      |                                                     |\n      | keys never leave the client                submits tx + pays gas\n      v                                                     v\n[ Arc USDC 0x3600…0000 ] <== vault pulls escrow ==> [ V2 Hub vault ]\n\nArc USDC is REAL Circle-issued USDC, not a mock — and it is ALSO\nthe chain's native gas token (a dual 6-/18-decimal asset).",
      ),
      callout(
        "note",
        "The relayer sponsors gas but is powerless to redirect funds: escrow is pulled from the recovered signer per the signed intent, and any tampering breaks the signature.",
      ),
      callout("warn", "Never rename the sacred vocabulary in UI copy without a coordinated pass back to the SDK."),
    ],
  },
  sdk: {
    eyebrow: "SDK & Toolkit",
    title: "SDK reference",
    subtitle: "openrails-sdk — pluggable accounts, gasless payments, and adapters for ethers, Privy, Turnkey, and Circle smart accounts.",
    blocks: [
      h2("Install"),
      code("bash", "npm i openrails-sdk"),
      h2("Import"),
      code(
        "ts",
        'import {\n  LeptonOpenRailsClient, payGasless, claimGasless,\n  RelayClient, signUsdcPermit\n} from "openrails-sdk";\nimport { ethersToSubmitter } from "openrails-sdk/adapters/ethers";\n// or, for a Privy embedded wallet:\nimport { privyToAccount } from "openrails-sdk/adapters/privy";',
      ),
      h2("Accounts are pluggable"),
      list([
        "OpenRailsAccount — sign-only. Satisfied by Privy / Turnkey embedded wallets and Circle smart accounts.",
        "OpenRailsSubmitter — also self-submits. Any ethers.Signer.",
        "Because the Hub only needs a signature, sign-only accounts can fully drive the gasless flows.",
      ]),
      h2("Privy embedded wallet"),
      code(
        "ts",
        "const provider = await wallet.getEthereumProvider();\nconst account = privyToAccount({ address, provider });\nconst client = LeptonOpenRailsClient.fromAccount(account, hub, chainId);\nawait payGasless({ client, relay, intent });",
      ),
      callout(
        "note",
        "See Wallet abstraction for the Circle smart-account adapter and Gateway funding for cross-chain deposits — both are separate subpath exports.",
      ),
      callout(
        "note",
        "No production onboarding funding exists beyond the faucet. usdc.mint() is local-sandbox-only and does not exist on Arc testnet.",
      ),
    ],
  },
  "sdk-wallet": {
    eyebrow: "SDK & Toolkit",
    title: "Wallet abstraction",
    subtitle: "circleToAccount wraps any viem-compatible smart-account signer into an OpenRailsAccount — so a modular / EIP-1271 wallet can drive the gasless flows sign-only.",
    blocks: [
      h2("Adapt a smart account"),
      p(
        "The Hub authenticates a signature, not a sender — so a smart account never needs to self-submit. circleToAccount takes any signer exposing an address and a viem-style signTypedData({ domain, types, primaryType, message }) and returns a sign-only OpenRailsAccount.",
      ),
      code(
        "ts",
        'import { circleToAccount } from "openrails-sdk/adapters/circle";\nimport { LeptonOpenRailsClient, payGasless } from "openrails-sdk";\n\n// `smartAccount` is any viem-compatible signer:\n//   { address: string; signTypedData({ domain, types, primaryType, message }) }\nconst account = circleToAccount(smartAccount);\n\nconst client = LeptonOpenRailsClient.fromAccount(account, hub, chainId);\nawait payGasless({ client, relay, intent });',
      ),
      h2("What the adapter does"),
      list([
        "Sets isSmartAccount: true — flagging that the Hub should verify the envelope via EIP-1271 (isValidSignatureNow) rather than plain ECDSA recovery.",
        "Normalizes the EIP-712 payload: builds it with ethers TypedDataEncoder, then coerces domain.chainId to a number so viem-style signers accept it.",
        "Returns getAddress() + signTypedData() — nothing else is required to drive payGasless / claimGasless.",
      ]),
      callout(
        "note",
        "The adapter wraps any viem-compatible smart-account signer — it is signer-agnostic and does not bind to a specific deployment. Validate the EIP-1271 path end-to-end against your own smart-account contract on Arc before relying on it in production.",
      ),
    ],
  },
  "sdk-gateway": {
    eyebrow: "SDK & Toolkit",
    title: "Gateway funding",
    subtitle: "depositToGateway / mintFromGateway wire the SDK into Circle Gateway — deposit USDC once, mint it on Arc to fund streams on demand.",
    blocks: [
      h2("Deposit USDC"),
      p(
        "Amounts are USDC 6-decimal base units (mwei). autoApprove lands the ERC-20 approve first when the allowance is short, so a single call covers approval + deposit.",
      ),
      code(
        "ts",
        'import { depositToGateway, mintFromGateway } from "openrails-sdk/gateway";\n\n// deposit 25 USDC (6-decimal base units) into the Gateway Wallet\nconst { txHash } = await depositToGateway({\n  signer,                    // ethers.Signer\n  amountBaseUnits: 25_000_000n,\n  autoApprove: true,         // submit approve() if allowance is insufficient\n});',
      ),
      h2("Deposit on behalf of another address"),
      code(
        "ts",
        'import { depositForToGateway } from "openrails-sdk/gateway";\n\nawait depositForToGateway({\n  signer,\n  depositor: "0x…",          // the address credited with the balance\n  amountBaseUnits: 25_000_000n,\n});',
      ),
      h2("Mint on Arc"),
      p("Submit Circle’s attestation payload + signature to the Gateway Minter to materialize the balance as USDC on Arc."),
      code(
        "ts",
        "const { txHash } = await mintFromGateway({\n  signer,\n  attestationPayload, // hex string from Circle's attestation service\n  signature,          // hex string\n});",
      ),
      h2("Contracts"),
      kv([
        { k: "GatewayWallet", v: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" },
        { k: "GatewayMinter", v: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B" },
        { k: "USDC (token)", v: "0x3600000000000000000000000000000000000000" },
      ]),
      callout(
        "note",
        "Decimal scaling: pass 6-decimal ERC-20 base units to depositToGateway — no manual scaling. Arc native balances read as 18 decimals (a 10^12 ratio), but the GatewayWallet expects standard ERC-20 base units.",
      ),
    ],
  },
  cli: {
    eyebrow: "SDK & Toolkit",
    title: "CLI reference",
    subtitle: "The openrails CLI ships with the SDK. Mutating flows default to dry-run and require an explicit --execute.",
    blocks: [
      h2("Open a stream"),
      code(
        "bash",
        "openrails pay-stream \\\n  --recipient 0x… \\\n  --total-allocation-pool 10000 \\\n  --flow-velocity-per-second 1 \\\n  --lifespan-seconds 3600 \\\n  --execute",
      ),
      h3("Flags"),
      kv([
        { k: "--recipient", v: "address that receives the stream" },
        { k: "--total-allocation-pool", v: "bounded escrow ceiling (base units)" },
        { k: "--flow-velocity-per-second", v: "drip rate (base units / s)" },
        { k: "--lifespan-seconds", v: "stream lifetime" },
        { k: "--execute", v: "submit for real (omit for a dry-run)" },
      ]),
      callout(
        "warn",
        "close and flushResidualDelta are irrevocable. The CLI requires explicit confirmation before executing them — mirror that caution in any UI.",
      ),
    ],
  },
  integrate: {
    eyebrow: "Integration Patterns",
    title: "Payment links",
    subtitle:
      "Embed a RailsFlow to get paid, or a RailsCard to send value. The payload lives entirely in the URL fragment — it never touches a server.",
    blocks: [
      h2("Build a link"),
      p(
        "A link encodes a bounded payload after the # fragment. Because it is a fragment, it is never sent to any server — only the recipient’s browser decodes it.",
      ),
      code(
        "ts",
        'const payload = {\n  v: "2.0.0", kind: "flow",       // or "card"\n  chainId: 5042002,\n  hub: "0x941C8029F0f912df3fAb7423890ab2359b996D0b",\n  amount: "25000000",             // 25 USDC, base units\n  rate: "100000",                 // 0.1 USDC/s\n};\nconst link = "https://openrails.link/pay#or=" +\n  btoa(JSON.stringify(payload));',
      ),
      h2("Share it"),
      p(
        "Send the link anywhere. On open, the counterparty signs their side and the stream clears into the vault. RailsFlow asks to be paid; RailsCard offers value to claim.",
      ),
      callout("note", "A link is the whole interface. No server, no account — the fragment is the state."),
    ],
  },
  x402: {
    eyebrow: "Integration Patterns",
    title: "x402 gated APIs",
    subtitle: "Revive the dormant HTTP 402 status as a machine-negotiable payment handshake — gate any endpoint behind an OpenRails stream. A design pattern you build on the primitives.",
    blocks: [
      p(
        "x402 turns HTTP 402 Payment Required into a payment handshake an agent can negotiate on its own. OpenRails supplies the settlement layer: the 402 challenge carries a bounded intent, the caller signs it, the resolved stream clears into the vault, then the resource is served.",
      ),
      h2("The lifecycle"),
      steps([
        { n: "1", title: "Challenge", body: "The server returns 402 with a Payment-Required header carrying a bounded intent." },
        { n: "2", title: "Resolve", body: "The client signs the EIP-712 envelope — sign-only, no gas needed." },
        { n: "3", title: "Settle", body: "The client re-sends with a Payment-Signature header; the server relays the open via the gasless relay." },
        { n: "4", title: "Stream", body: "The server serves the resource and returns a Payment-Response receipt; value drips over the stream's lifespan." },
      ]),
      h2("Header mapping"),
      kv([
        { k: "Payment-Required", v: "server → client — the challenge intent (bounded)" },
        { k: "Payment-Signature", v: "client → server — the signed envelope token" },
        { k: "Payment-Response", v: "server → client — receipt / paycardId" },
      ]),
      h2("Cloudflare Worker shim"),
      code(
        "ts",
        'export default {\n  async fetch(req: Request) {\n    const sig = req.headers.get("Payment-Signature");\n    if (!sig) {\n      // Challenge: hand back a bounded intent the caller must sign\n      return new Response("Payment required", {\n        status: 402,\n        headers: { "Payment-Required": btoa(JSON.stringify(intent)) },\n      });\n    }\n    // Settle: relay the signed envelope, then serve the resource\n    await fetch(RELAY + "/relay-open", {\n      method: "POST",\n      headers: { "content-type": "application/json" },\n      body: JSON.stringify({ envelopeToken: sig }),\n    });\n    return new Response(resource, { headers: { "Payment-Response": paycardId } });\n  },\n};',
      ),
      callout(
        "note",
        "This is an integration pattern built on the OpenRails primitives — the link payload and the gasless relay-open endpoint — not a drop-in x402 middleware shipped in the SDK. See MCP server for the agent-side of the same audience.",
      ),
    ],
  },
  mcp: {
    eyebrow: "Integration Patterns",
    title: "MCP server (agents)",
    subtitle: "openrails-mcp lets an AI agent transact on the rail directly — give it a bounded budget it can spend, provably capped.",
    blocks: [
      h2("Add the agent"),
      code("bash", "npm i -g openrails-mcp"),
      p(
        "Point your agent’s MCP config at the server. Network defaults are built in, so the agent is a single tool-call away from a first payment.",
      ),
      h2("Why it works for agents"),
      list([
        "Sign-only is enough — the Hub authenticates the signature, so an agent never needs gas or a seed phrase to move value.",
        "Bounded by construction — the intent caps spend; a runaway agent can never exceed what was signed.",
        "Nonce lanes give replay / concurrency safety across parallel agent tasks.",
      ]),
      callout("note", "Hand an agent a RailsCard as a budget: pay-per-task, provably capped, unused portion swept back."),
    ],
  },
  sidecar: {
    eyebrow: "Integration Patterns",
    title: "MusicBrainz sidecar",
    subtitle: "A serverless royalty wedge: scrobbles in, streamed USDC royalties out. Register an artist wallet by MusicBrainz ID, open a listener session, log plays; the keeper settles.",
    blocks: [
      h2("How it works"),
      steps([
        { n: "1", title: "Register", body: "PUT /artist/:mbid with the artist's wallet — stored in Cloudflare KV keyed by MusicBrainz ID." },
        { n: "2", title: "Open a session", body: "POST /session/open with listenerAddress + artistMbid. A listener-signed envelopeToken keeps it non-custodial." },
        { n: "3", title: "Scrobble", body: "POST /webhook/scrobble logs a play + pending royalty to D1, keyed by paycardId." },
        { n: "4", title: "Settle", body: "The reconciliation keeper drip-settles the stream on-chain." },
      ]),
      h2("Endpoints"),
      kv([
        { k: "PUT /artist/:mbid", v: "register artist wallet (auth: webhook secret) — { wallet }" },
        { k: "POST /session/open", v: "{ listenerAddress, artistMbid, budgetUsdc?, velocityPerSecond?, lifespanSeconds?, envelopeToken? }" },
        { k: "POST /webhook/scrobble", v: "log a play — { track: { mbid }, paycardId }" },
      ]),
      p("Session defaults when omitted: budgetUsdc 5000000 (5 USDC), velocityPerSecond 1000, lifespanSeconds 3600."),
      code(
        "bash",
        'curl -X POST .../session/open \\\n  -H "Authorization: Bearer $SECRET" \\\n  -H "content-type: application/json" \\\n  -d \'{"listenerAddress":"0x…","artistMbid":"…","budgetUsdc":"5000000","envelopeToken":"…"}\'',
      ),
      callout(
        "warn",
        "Supply a listener-signed envelopeToken so the sidecar never signs as the payer. The self-funded relayer fallback exists only for local demos and breaks the non-custodial invariant.",
      ),
    ],
  },
  keepers: {
    eyebrow: "Integration Patterns",
    title: "Reconciliation keepers",
    subtitle: "A permissionless settlement cron. The keeper enumerates active Paycard Streams and calls processDripSettle — it never opens or closes, so it can never move funds anywhere the signed intent didn't already allow.",
    blocks: [
      h2("What the keeper does"),
      list([
        "Enumerates active streams from PaycardProvisioned logs over a rolling block window.",
        "For each Active stream with a positive available balance, computes value accrued since the last checkpoint and calls processDripSettle once it clears a dust threshold.",
        "One-time cards (lifespan 0) unlock in full on the first settle; streaming cards drip per flowVelocityPerSecond.",
        "Settles only — never openPaycardChannel or flushResidualDelta. Opening and closure stay with the payer / merchant / creator.",
      ]),
      h2("Trigger it"),
      p("The cron drives it automatically. An admin token gates a manual trigger."),
      code(
        "text",
        "POST https://openrails-reconciliation-worker.microcosm.workers.dev/reconcile\nAuthorization: Bearer $ADMIN_TOKEN",
      ),
      h2("Modes"),
      kv([
        { k: "chain (default)", v: "settle every active rail discovered on-chain" },
        { k: "d1 (legacy)", v: "settle only paycards referenced by unsettled rows in the music plays table" },
      ]),
      callout(
        "note",
        "Permissionless and non-custodial — funds always flow payer → recipient per on-chain state; the keeper only pays gas.",
      ),
    ],
  },
  "cross-chain": {
    eyebrow: "Integration Patterns",
    title: "Cross-chain funding",
    subtitle: "How value gets INTO Arc from other chains, so it can then flow through OpenRails' streaming rails. This is the on-ramp; OpenRails is what happens once USDC is on Arc.",
    blocks: [
      p(
        "OpenRails settles on Arc. To stream value that starts elsewhere, first bridge USDC onto Arc, then open a Paycard Stream as usual. Two Circle rails do the bridging — pick by the speed / canonicality tradeoff.",
      ),
      h2("Circle Gateway — unified balance (shipped)"),
      p(
        "Gateway gives an address a single USDC balance spendable across chains: deposit once, mint on Arc in ~500ms — fast enough to fund a stream on demand. It is wired into the SDK today.",
      ),
      kv([
        { k: "GatewayWallet", v: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" },
        { k: "GatewayMinter", v: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B" },
        { k: "SDK", v: "depositToGateway / mintFromGateway (see Gateway funding)" },
        { k: "status", v: "live on Arc testnet, confirmed" },
      ]),
      h2("CCTP — canonical burn-and-mint (planned)"),
      p(
        "CCTP moves USDC by burning on the source chain and minting native USDC on the destination — no wrapped assets. Arc is CCTP domain 26. Finality is slower than Gateway, a real tradeoff, but CCTP is the canonical cross-chain USDC primitive.",
      ),
      kv([
        { k: "CCTP domain", v: "26" },
        { k: "TokenMessengerV2", v: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" },
        { k: "MessageTransmitterV2", v: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" },
        { k: "TokenMinterV2", v: "0xb43db544E2c27092c107639Ad201b3dEfAbcF192" },
        { k: "transfer mode", v: "Standard Transfer only — Fast Transfer is N/A on Arc" },
        { k: "status", v: "supported infrastructure; SDK integration planned" },
      ]),
      callout(
        "note",
        "Gateway is wired into the SDK now; CCTP is confirmed viable on Arc but not yet integrated in this repo. Choose Gateway for speed today; CCTP is the canonical burn-and-mint fallback as SDK support lands.",
      ),
    ],
  },
  onchain: {
    eyebrow: "Protocol Reference",
    title: "Contracts & onchain facts",
    subtitle: "Arc testnet addresses, domain values, and the V2 Hub ABI. V2 is canonical; V1 is frozen and draining — never mix the two.",
    blocks: [
      h2("Network"),
      kv([
        { k: "chainId", v: "5042002" },
        { k: "RPC", v: "https://rpc.testnet.arc.network" },
        { k: "explorer", v: "https://testnet.arcscan.app" },
        { k: "EIP-712 domain version", v: '"2.0.0"' },
      ]),
      h2("Contracts"),
      p("Each address resolves on the explorer at https://testnet.arcscan.app/address/<addr>."),
      kv([
        { k: "V2 hub (canonical)", v: "0x941C8029F0f912df3fAb7423890ab2359b996D0b" },
        { k: "V2 factory", v: "0xf85c20858Bac4f9C67a53e4e7a8F31025D07Bc93" },
        { k: "USDC (= gas token)", v: "0x3600000000000000000000000000000000000000" },
        { k: "V1 hub (frozen)", v: "0x01EC54846524D043fD808152D41596beF603381d" },
      ]),
      h2("Hub ABI (V2)"),
      p("The canonical V2 Hub surface — open, claim, settle, flush, and the registry read (ethers v6 format)."),
      code(
        "ts",
        "export const OPENRAILS_HUB_ABI = [\n  'function registry(bytes32 paycardId) view returns (address payer, address recipient, bytes32 metadataHash, uint256 totalAllocationPool, uint256 availableBalance, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds, uint256 lastCheckpointEpoch, address residualDeltaRecipient, uint8 operationalStatus)',\n  'function openPaycardChannel(bytes32 paycardId, bytes32 metadataHash, address recipient, uint256 totalAllocationPool, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds, address residualDeltaRecipient, bytes envelopeSignature, uint256 nonceChannel, uint256 nonceValue, address payer) external',\n  'function claimWildcardPaycardChannel(bytes32 paycardId, bytes32 metadataHash, address claimRecipient, uint256 totalAllocationPool, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds, address residualDeltaRecipient, bytes envelopeSignature, uint256 nonceChannel, uint256 nonceValue, address payer) external',\n  'function processDripSettle(bytes32 paycardId) external',\n  'function flushResidualDelta(bytes32 paycardId) external'\n];",
      ),
      callout(
        "warn",
        'V1 (domain "1.0.0") is frozen to new opens and draining. Don’t build against it, and never mix V1 and V2 domain versions.',
      ),
    ],
  },
  api: {
    eyebrow: "Protocol Reference",
    title: "REST / indexer API",
    subtitle:
      "A factory-aware read API. It watches the canonical hub and auto-discovers vault clones. Every response is authoritative: false.",
    blocks: [
      h2("Base URL"),
      code("text", H),
      h2("Endpoints"),
      kv([
        { k: "GET /vaults", v: "every watched vault" },
        { k: "GET /streams", v: "?vaultAddress=&payer=&recipient=&metadataHash=&status=" },
        { k: "GET /streams/:vault/:paycardId/history", v: "full event history (composite key — both segments required)" },
        { k: "GET /workflows/:id", v: 'returns 501 today — do not treat empty as "no data"' },
        { k: "GET /transactions/:hash", v: "events + affected streams for a tx" },
      ]),
      callout(
        "note",
        "Never present indexed reads as settled fact. The Vault is the source of truth; the indexer is a non-authoritative projection.",
      ),
    ],
  },
  relay: {
    eyebrow: "Protocol Reference",
    title: "Faucet & gasless relay",
    subtitle: "How test funds get in, and how payments get sponsored so the payer needs no separate gas balance.",
    blocks: [
      h2("Faucet"),
      code(
        "bash",
        'curl -X POST https://openrails-faucet-worker.microcosm.workers.dev/fund \\\n  -H "content-type: application/json" \\\n  -d \'{"address":"0x…"}\'',
      ),
      p("Public and CORS-enabled. Drips a small amount of testnet USDC (which also covers gas)."),
      list([
        "Returns { txHash, amount } on success.",
        "{ skipped: true } if the address is already funded.",
        "429 / 503 with a clear reason on cooldown or daily-cap — surface the message, not a generic error.",
      ]),
      h2("Gasless relay"),
      p("The relay sponsors submission. payGasless() / claimGasless() in the SDK call it under the hood."),
      code(
        "text",
        "POST https://openrails-reconciliation-worker.microcosm.workers.dev/relay-open\nPOST https://openrails-reconciliation-worker.microcosm.workers.dev/relay-claim",
      ),
      callout(
        "note",
        "Because the Hub authenticates the signature (not msg.sender), the payer needs no gas — a keeper relays the transaction.",
      ),
    ],
  },
};
