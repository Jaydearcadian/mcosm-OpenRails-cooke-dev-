/**
 * OpenRails Docs content — ported byte-for-byte from the approved Claude Design
 * prototype (DCLogic docs()/groups()/order()). Chain IDs, addresses, endpoints,
 * and code samples are real project facts — do not paraphrase.
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

export const ORDER = ["quickstart", "concepts", "integrate", "sdk", "cli", "api", "mcp", "onchain", "relay"] as const;

export const NAV_GROUPS: { label: string; items: [string, string][] }[] = [
  { label: "Getting started", items: [["quickstart", "Quickstart"], ["concepts", "Core concepts"]] },
  { label: "Integrate", items: [["integrate", "How to integrate"], ["sdk", "SDK"], ["cli", "CLI"]] },
  { label: "Reference", items: [["api", "REST / indexer API"], ["mcp", "MCP server"]] },
  { label: "Network", items: [["onchain", "Onchain facts"], ["relay", "Faucet & gasless relay"]] },
];

export const DOCS: Record<string, DocPage> = {
  quickstart: {
    eyebrow: "Getting started",
    title: "Quickstart",
    subtitle:
      "Zero to a first payment. Install the SDK and CLI, fund a testnet wallet, open a stream, watch it settle and refund on-chain.",
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
    eyebrow: "Getting started",
    title: "Core concepts",
    subtitle: "The vocabulary is fixed. These are the primitives the whole rail is built from.",
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
      callout("note", "Never rename the sacred vocabulary in UI copy without a coordinated pass back to the SDK."),
    ],
  },
  integrate: {
    eyebrow: "Integrate",
    title: "How to integrate",
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
  sdk: {
    eyebrow: "Integrate",
    title: "SDK reference",
    subtitle: "openrails-sdk — pluggable accounts, gasless payments, and adapters for ethers and Privy embedded wallets.",
    blocks: [
      h2("Import"),
      code(
        "ts",
        'import {\n  LeptonOpenRailsClient, payGasless, claimGasless,\n  RelayClient, signUsdcPermit\n} from "openrails-sdk";\nimport { ethersToSubmitter } from "openrails-sdk/adapters/ethers";\n// or, for a Privy embedded wallet:\nimport { privyToAccount } from "openrails-sdk/adapters/privy";',
      ),
      h2("Accounts are pluggable"),
      list([
        "OpenRailsAccount — sign-only. Satisfied by Privy / Turnkey embedded wallets.",
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
        "No production onboarding funding exists beyond the faucet. usdc.mint() is local-sandbox-only and does not exist on Arc testnet.",
      ),
    ],
  },
  cli: {
    eyebrow: "Integrate",
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
  api: {
    eyebrow: "Reference",
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
  mcp: {
    eyebrow: "Reference",
    title: "MCP server",
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
  onchain: {
    eyebrow: "Network",
    title: "Onchain facts",
    subtitle: "Arc testnet addresses and domain values. V2 is canonical; V1 is frozen and draining — never mix the two.",
    blocks: [
      kv([
        { k: "chainId", v: "5042002" },
        { k: "RPC", v: "https://rpc.testnet.arc.network" },
        { k: "explorer", v: "https://testnet.arcscan.app" },
        { k: "V2 hub (canonical)", v: "0x941C8029F0f912df3fAb7423890ab2359b996D0b" },
        { k: "V2 factory", v: "0xf85c20858Bac4f9C67a53e4e7a8F31025D07Bc93" },
        { k: "USDC (= gas token)", v: "0x3600000000000000000000000000000000000000" },
        { k: "EIP-712 domain version", v: '"2.0.0"' },
        { k: "V1 hub (frozen)", v: "0x01EC54846524D043fD808152D41596beF603381d" },
      ]),
      callout(
        "warn",
        "V1 (domain \"1.0.0\") is frozen to new opens and draining. Don’t build against it, and never mix V1 and V2 domain versions.",
      ),
    ],
  },
  relay: {
    eyebrow: "Network",
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
