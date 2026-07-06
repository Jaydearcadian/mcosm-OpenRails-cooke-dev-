> **ADDENDUM (post-execution review, 2026-07-06):** Parts A/B/C/D were attempted and most of it is
> real and verified — 81/81 tests pass, and the MCP `pay_link`, x402-on-V2, and Circle Gateway
> deposit transactions were independently confirmed on-chain (real tx hashes, correct target
> contracts, `status: 0x1`). `workers/music-scrobble-worker/src/openSession.ts`'s non-custodial
> envelope path is genuinely well implemented. Two things are NOT actually done despite being
> reported as complete — **do not re-attempt the rest of the plan, only these two**:
>
> 1. **Task C2 Step 5 (Circle SA proof against the real Hub) was not fulfilled.**
>    `test/CircleAdapter.test.ts`'s second test never calls the real deployed V2 Hub or a real
>    chain — it deploys a fresh `MockERC1271Account` in an isolated local Hardhat instance and
>    checks `isValidSignature` directly, never calling `openPaycardChannel` anywhere. Fix: either
>    (a) provision a real Circle smart account on Arc testnet and submit a real
>    `openPaycardChannel` call signed via `circleToAccount`, confirming it lands on
>    `testnet.arcscan.app` (strongly preferred — this is the actual claim being made), or (b) at
>    minimum, extend the Hardhat test to deploy `MockERC1271Account` and call the REAL deployed V2
>    Hub's `openPaycardChannel` against Arc testnet (via a `--network arcTestnet` Hardhat run, same
>    pattern already used correctly in `test/Gateway.test.ts`), not just the local mock in
>    isolation.
> 2. **Task B4 (provision + deploy) was skipped entirely.** No KV namespace, no D1 database, no
>    `wrangler.toml` changes to either `workers/music-scrobble-worker/` or
>    `workers/reconciliation-worker/`. "Compiles cleanly" was reported, which is true but is not
>    the same as deployed. Both workers need the real `wrangler kv:namespace create` /
>    `wrangler d1 create` steps from the original Task B4, followed by `npx wrangler deploy` for
>    each, then a real smoke test hitting the deployed URLs (not localhost).
>
> Everything else in this plan is done — do not redo Parts A/C1/C2(steps 1-4)/D1/D2/D3.

# Demo-Readiness + Circle Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "agent" and "creator" demo personas real (proof-run MCP's payment tool, re-prove x402 on V2, finish + deploy the already-mostly-built MusicBrainz sidecar), then add Circle Smart Account signing and Circle Gateway funding so the whole rail works end-to-end for every account type and funding path.

**Architecture:** Four independent parts, each shippable/testable on its own — do not block one on another. Part A proves existing code works (no new architecture). Part B finishes and deploys two already-written Cloudflare Workers plus one new small piece (the "open-step"). Part C adds one new SDK adapter file following an established pattern (`sdk/src/adapters/{ethers,privy}.ts`) — zero contract changes, since the V2 Hub already verifies EIP-1271 signatures. Part D adds Gateway-specific deposit/mint logic as a new SDK module, gated on a first research spike since the exact Gateway contract ABI isn't in this repo yet.

**Tech Stack:** TypeScript (SDK/MCP/Workers), Solidity (existing V2 Hub, already deployed — no redeploy needed for Parts A/B/C), Cloudflare Workers + D1 + KV (Part B), viem/ethers (SDK adapters).

## Global Constraints

- **Never rename the sacred vocabulary** (Paycard Stream, RailsFlow, RailsCard, Nonce Lane, Receipts, STN-Delta) in any UI copy, log message, or variable name meant to be user-facing.
- **V2 only.** Canonical hub `0x941C8029F0f912df3fAb7423890ab2359b996D0b`, factory `0xf85c20858Bac4f9C67a53e4e7a8F31025D07Bc93`, chainId `5042002`, EIP-712 domain version `"2.0.0"`. The frozen V1 hub `0x01EC54846524D043fD808152D41596beF603381d` (domain `"1.0.0"`) must never appear in any new or fixed code — several existing planning docs and one proof-run wrongly reference it; do not copy code from those docs without updating the hub address.
- **Non-custodial invariant**: no new code may let a relayer/keeper/sidecar hold funds. Every flow pulls escrow from the intent signer's own balance via a signature the Hub verifies — mirror this in Part B's sidecar and Part D's Gateway integration.
- **USDC is also Arc's native gas token** (`0x3600000000000000000000000000000000000000`). `transferFrom` cannot move a holder's entire balance — always over-provision, never spend to the last unit. This matters most in Part D.
- **Testnet, unaudited.** Don't imply production-readiness in any new copy or comments.
- Commit after every task. No AI attribution trailers in commit messages (repo convention — check recent `git log` if unsure).

---

## Part A — Agent demo readiness (MCP `pay_link` proof + x402 re-run on V2)

**Why this part exists:** The MCP server's payment-executing tool (`pay_link`) wraps already-proven SDK primitives (`payGasless`/`claimGasless`), but has never itself been invoked end-to-end. Separately, a full x402-to-stream proof already exists and passed — but every artifact from that proof targets the now-frozen V1 hub. Both are re-proof jobs against known-good code, not new feature work.

### Task A1: Extend the MCP smoke test to prove `pay_link`

**Files:**
- Modify: `mcp/smoke.mjs`
- Read only (no changes): `mcp/src/tools.ts:73-108` (`payLink` implementation), `mcp/src/context.ts:43-76` (network defaults, signer wiring), `sdk/src/relay.ts:87-111` (`payGasless`/`claimGasless` signatures)

**Interfaces:**
- Consumes: `payLink(ctx, { link: string })` from `mcp/src/tools.ts` — returns `{ kind, action, txHash, ..., explorer }` on success, throws on failure.
- Produces: nothing new — this is a verification script, not a library.

`mcp/smoke.mjs` today (lines 22-26) only calls `openrails_config` and `create_request_link`, with a dummy recipient when no signer is configured. You're adding a real payment call, so this task requires a **funded signer key** — `.env` already has `DEPLOYER_PRIVATE_KEY` (confirmed present this session, reused throughout on-chain verification). Set `OPENRAILS_MCP_SIGNER_KEY` to that same value before running.

- [ ] **Step 1: Generate a real RailsFlow request link to pay against**

Run (from repo root, with `.env` loaded):
```bash
node -e "
const { execSync } = require('child_process');
require('dotenv').config();
"
npx tsx -e "
import 'dotenv/config';
import { createRailsFlowRequestLink } from './cockpit/src/lib/links';
// If that import path doesn't resolve standalone, instead call mcp's own
// 'create_request_link' tool directly — see context.ts for how tools are invoked in-process.
"
```
Simplest real path: use the MCP tool itself. Add a `node mcp/smoke.mjs --emit-request-link` mode, OR just call the existing smoke test's `create_request_link` step (it already runs) and capture its returned link — read `mcp/smoke.mjs`'s current output to find where that link is printed, then copy it into the next step. A fresh throwaway recipient address is fine (any valid `0x...` address — you don't need to control it, you're the payer here).

- [ ] **Step 2: Add a `pay_link` call to `mcp/smoke.mjs`**

Append after the existing `create_request_link` call in `mcp/smoke.mjs` (match the file's existing style — it likely calls tools via a local dispatcher object; use the same pattern as the two existing calls):
```js
console.log("\n[smoke] Calling pay_link against the request link just created...");
const payResult = await tools.pay_link({ link: requestLink }); // use whatever variable name holds the Step 1 link
console.log("[smoke] pay_link result:", JSON.stringify(payResult, null, 2));
if (!payResult.txHash) {
  throw new Error("pay_link did not return a txHash — did not actually submit a transaction");
}
console.log(`[smoke] SUCCESS — real tx: ${payResult.explorer ?? payResult.txHash}`);
```

- [ ] **Step 3: Run it and confirm a real transaction lands**

```bash
OPENRAILS_MCP_SIGNER_KEY=$DEPLOYER_PRIVATE_KEY node mcp/smoke.mjs
```
Expected: script prints a real `txHash` (66-char hex) and does not throw. Independently confirm on `https://testnet.arcscan.app/tx/<hash>` that the transaction succeeded (status `0x1`) against the V2 hub `0x941C8029F0f912df3fAb7423890ab2359b996D0b`.

- [ ] **Step 4: Commit**

```bash
git add mcp/smoke.mjs
git commit -m "mcp: extend smoke test to prove pay_link executes a real payment"
```

### Task A2: Re-run the x402-to-stream proof against V2

**Files:**
- Read only: `experiments/x402-smoke/x402-smoke-results.md`, `experiments/x402-smoke/x402-stream-bridge-results.md` (the exact re-run commands are documented at lines 68-109 and 90-101 respectively)
- Modify: whatever config the smoke scripts read the hub address from (search the smoke scripts referenced by `npm run smoke:x402:paid` / `npm run smoke:x402:stream` in root `package.json` for a hardcoded `0x01EC54846524D043fD808152D41596beF603381d` and change it to `0x941C8029F0f912df3fAb7423890ab2359b996D0b`)
- Create: `experiments/x402-smoke/x402-smoke-results-v2.md` and `experiments/x402-smoke/x402-stream-bridge-results-v2.md` (new proof artifacts — don't overwrite the originals, they're a valid historical record of the V1 proof)

- [ ] **Step 1: Find and fix the hardcoded V1 hub address**

```bash
grep -rn "0x01EC54846524D043fD808152D41596beF603381d" experiments/x402-smoke/ package.json
```
Update every match found (likely in a script referenced by the `smoke:x402:*` npm scripts) to `0x941C8029F0f912df3fAb7423890ab2359b996D0b`.

- [ ] **Step 2: Re-run the paid x402 smoke test**

```bash
npm run smoke:x402:paid
```
Follow the exact runbook in `experiments/x402-smoke/x402-smoke-results.md:68-109` — it documents the original real Circle Gateway facilitator settlement proof; this run should reproduce the same shape of result (a real settlement ID) but you must confirm it's a fresh one, not a cached/stale result.

- [ ] **Step 3: Re-run the stream-bridge smoke test**

```bash
npm run smoke:x402:stream
```
Follow `experiments/x402-smoke/x402-stream-bridge-results.md:90-101`. Confirm the resulting `openTxHash` is a **new** transaction against the V2 hub (check on `testnet.arcscan.app` that the `to` address is `0x941C8029F0f912df3fAb7423890ab2359b996D0b`, not the V1 address).

- [ ] **Step 4: Write the new proof artifacts**

Create `experiments/x402-smoke/x402-smoke-results-v2.md` and `experiments/x402-smoke/x402-stream-bridge-results-v2.md`, same structure as the originals, with the new settlement ID / tx hashes / block numbers from Steps 2-3. Add one line at the top of each: `> Re-run against V2 hub (0x941C8029...) on <date>. Original V1 proof: see the non-"-v2" file in this directory.`

- [ ] **Step 5: Commit**

```bash
git add experiments/x402-smoke/
git commit -m "x402: re-prove paid-artifact + stream-bridge flow against V2 hub"
```

---

## Part B — Creator/MusicBrainz sidecar: finish and deploy

**Why this part exists:** Contrary to earlier status notes, this is **not** a from-scratch build. Two real Cloudflare Workers already contain working code: `workers/music-scrobble-worker/` (webhook receiver) and `workers/reconciliation-worker/`'s `reconcileFromD1()` (lines 371-450, a real settlement loop). Neither is deployed — both have placeholder resource IDs. One genuine piece of logic is missing: something has to open a paycard/stream for a listening session before scrobbles can log against its `paycardId` (the "open-step"). Do not use the planning docs' code snippets (`experiments/musicbrainz-subsonic/*.md`) — they call a nonexistent SDK API (`new LeptonOpenRailsClient(PAYER_KEY, HUB_ADDRESS, 5042002)` and positional-args `signPermissionEnvelope(...)`) and reference three different wrong hub addresses across the three docs. Use the real API shown in Task B4 below.

### Task B1: Write the missing D1 schema for the scrobble worker

**Files:**
- Create: `workers/music-scrobble-worker/schema.sql`
- Read only: `workers/music-scrobble-worker/src/index.ts` (confirms the exact columns the worker's INSERT statement expects: `source_event_id, paycard_id, artist_mbid, artist_wallet, timestamp, settled, updated_at`)

- [ ] **Step 1: Write the schema**

```sql
CREATE TABLE IF NOT EXISTS plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_event_id TEXT NOT NULL UNIQUE,
  paycard_id TEXT NOT NULL,
  artist_mbid TEXT NOT NULL,
  artist_wallet TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  settled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plays_paycard_id ON plays(paycard_id);
CREATE INDEX IF NOT EXISTS idx_plays_settled ON plays(settled);
```
(`source_event_id UNIQUE` gives idempotency — a retried webhook delivery for the same scrobble event won't double-insert, matching this repo's established idempotency convention from `workers/indexer-worker/schema.sql`'s `(transaction_hash, log_index)` pattern — check that file for the exact style if you want to match column-naming conventions more closely.)

- [ ] **Step 2: Commit**

```bash
git add workers/music-scrobble-worker/schema.sql
git commit -m "music-scrobble-worker: add missing plays table schema"
```

### Task B2: Add an artist-registration endpoint

**Files:**
- Modify: `workers/music-scrobble-worker/src/index.ts`

**Interfaces:**
- Produces: `PUT /artist/:mbid` — body `{ wallet: "0x..." }`, admin-token gated (reuse whatever `authorized()`/bearer-token helper pattern this file already uses for the scrobble webhook — read the top of the file for the exact helper name and signature before writing this).

- [ ] **Step 1: Read the existing auth helper**

```bash
grep -n "function authorized\|Bearer\|ADMIN_TOKEN" workers/music-scrobble-worker/src/index.ts
```
Use whatever pattern this returns — don't invent a new auth mechanism.

- [ ] **Step 2: Add the route**

Add a new route branch in the worker's `fetch` handler (match the existing routing style in the same file — likely an `if (url.pathname === ... && request.method === ...)` chain):
```ts
if (url.pathname.startsWith("/artist/") && request.method === "PUT") {
  if (!authorized(request, env)) return jsonResponse({ error: "Unauthorized" }, 401);
  const mbid = url.pathname.slice("/artist/".length);
  if (!mbid) return jsonResponse({ error: "Missing mbid" }, 400);
  const body = await request.json().catch(() => null) as { wallet?: string } | null;
  if (!body?.wallet || !/^0x[0-9a-fA-F]{40}$/.test(body.wallet)) {
    return jsonResponse({ error: "Invalid or missing wallet address" }, 400);
  }
  await env.MUSICBRAINZ_REGISTRY.put(mbid, body.wallet.toLowerCase());
  return jsonResponse({ mbid, wallet: body.wallet.toLowerCase() });
}
```
(Adjust `jsonResponse`/`env.MUSICBRAINZ_REGISTRY` names to whatever the file already uses — confirmed present since the webhook handler already reads from this same KV binding.)

- [ ] **Step 3: Verify locally**

```bash
cd workers/music-scrobble-worker && npx wrangler dev &
sleep 3
curl -X PUT http://localhost:8787/artist/test-mbid-123 \
  -H "Authorization: Bearer $YOUR_LOCAL_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"wallet":"0x1A76BFE6bF7A4BfD854b16C19Dd870e0DE56473C"}'
```
Expected: `{"mbid":"test-mbid-123","wallet":"0x1a76bfe6bf7a4bfd854b16c19dd870e0de56473c"}`.

- [ ] **Step 4: Commit**

```bash
git add workers/music-scrobble-worker/src/index.ts
git commit -m "music-scrobble-worker: add PUT /artist/:mbid registration endpoint"
```

### Task B3: Build the missing "open-step"

This is the one genuinely new piece of logic in this part. Something must open a paycard/stream for a listening session before any scrobble can log against its `paycardId` — nothing in the repo does this today.

**Files:**
- Create: `workers/music-scrobble-worker/src/openSession.ts`
- Modify: `workers/music-scrobble-worker/src/index.ts` (wire in the new route)
- Read only: `mcp/src/tools.ts` (for the real, current SDK call pattern — do NOT use the pattern in `experiments/musicbrainz-subsonic/navidrome_musicbrainz_sidecar_plan.md`, it calls a nonexistent constructor), `sdk/src/relay.ts:87-111` (`payGasless` signature)

**Interfaces:**
- Produces: `POST /session/open` — body `{ listenerAddress: string, artistMbid: string, budgetUsdc: string }`. Opens a bounded RailsFlow stream from listener → artist wallet (resolved via the KV registry from Task B2), returns `{ paycardId, vaultAddress, txHash }`. This is a listening-session budget the listener pre-authorizes (matches the "hybrid lazy-open+drip+budget-cap" design already decided per project memory) — not a per-scrobble payment.

- [ ] **Step 1: Write the open-session function**

```ts
// workers/music-scrobble-worker/src/openSession.ts
import { ethers } from "ethers";

const HUB_ABI = [
  "function openPaycardChannel(bytes32 paycardId, bytes32 metadataHash, address recipient, uint256 totalAllocationPool, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds, address residualDeltaRecipient, bytes envelopeSignature, uint256 nonceChannel, uint256 nonceValue, address payer) external",
] as const;

export interface OpenSessionParams {
  hubAddress: string;
  rpcUrl: string;
  relayerPrivateKey: string; // the sidecar's OWN key — it only relays a payer-signed envelope, never spends its own funds beyond gas
  listenerAddress: string;
  artistWallet: string;
  budgetUsdcBaseUnits: bigint; // e.g. 5_000000n for 5 USDC
  velocityPerSecond: bigint;  // drip rate, base units/sec
  lifespanSeconds: bigint;
}

// NOTE: this sidecar RELAYS a listener-signed envelope — it must never sign on the
// listener's behalf. In a real deployment, `listenerAddress` supplies a pre-signed
// envelope (collected client-side, e.g. from the Navidrome plugin prompting a wallet
// signature once per session) via an added `envelopeSignature` param. For a first
// demo-ready cut, the sidecar's own relayer key MAY act as the payer directly (self-funded
// demo budget) — document this clearly as a demo simplification, not the production model,
// and revisit before any real (non-demo) funds are involved.
export async function openListeningSession(params: OpenSessionParams) {
  const provider = new ethers.JsonRpcProvider(params.rpcUrl);
  const wallet = new ethers.Wallet(params.relayerPrivateKey, provider);
  const hub = new ethers.Contract(params.hubAddress, HUB_ABI, wallet);

  const paycardId = ethers.hexlify(ethers.randomBytes(32));
  const metadataHash = ethers.hexlify(ethers.randomBytes(32)); // demo-simplified; production should hash real CanonicalMetadataV1
  const genesisTimestamp = BigInt(Math.floor(Date.now() / 1000));

  // Demo-simplified self-submit path (see NOTE above) — real envelope-signing flow
  // is the follow-on once a client-side signer exists in the Navidrome plugin.
  throw new Error("Wire real signature + submission here per the NOTE above before deploying — this function intentionally throws until that decision is made explicit by whoever implements this task.");
}
```

This step deliberately ends in a `throw` — **do not silently ship a fake success path**. Before removing the throw, the implementer must decide (and note in a code comment + this plan's Task B3 checkbox) whether the demo uses:
(a) the sidecar's relayer key as a self-funded payer (fastest to demo, weakest non-custodial story), or
(b) a real listener-signed envelope collected client-side (matches the rest of the repo's non-custodial invariant, more work).
Pick (a) only for the first demo-ready cut, and say so explicitly in a comment; file a follow-up to do (b) before this is anything but a demo.

- [ ] **Step 2: Wire the route**

In `workers/music-scrobble-worker/src/index.ts`, add:
```ts
if (url.pathname === "/session/open" && request.method === "POST") {
  if (!authorized(request, env)) return jsonResponse({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => null) as Partial<OpenSessionParams> | null;
  if (!body?.listenerAddress || !body?.artistMbid) {
    return jsonResponse({ error: "Missing listenerAddress or artistMbid" }, 400);
  }
  const artistWallet = await env.MUSICBRAINZ_REGISTRY.get(body.artistMbid);
  if (!artistWallet) return jsonResponse({ error: "Unknown artistMbid — register it via PUT /artist/:mbid first" }, 404);
  try {
    const result = await openListeningSession({
      hubAddress: env.OPENRAILS_HUB_ADDRESS,
      rpcUrl: env.ARC_RPC_URL,
      relayerPrivateKey: env.MUSIC_SIDECAR_RELAYER_KEY,
      listenerAddress: body.listenerAddress,
      artistWallet,
      budgetUsdcBaseUnits: BigInt(body.budgetUsdc ?? "5000000"),
      velocityPerSecond: BigInt(body.velocityPerSecond ?? "1000"),
      lifespanSeconds: BigInt(body.lifespanSeconds ?? "3600"),
    });
    return jsonResponse(result);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
```

- [ ] **Step 3: Commit (with the intentional throw still in place)**

```bash
git add workers/music-scrobble-worker/src/openSession.ts workers/music-scrobble-worker/src/index.ts
git commit -m "music-scrobble-worker: scaffold open-session route (submission path deliberately unfinished, see NOTE)"
```

**This task is NOT complete until a follow-up implements one of the two paths in the NOTE above and removes the throw** — flag this explicitly to whoever reviews this plan's completion; don't let it silently ship as "done."

### Task B4: Provision real Cloudflare resources and deploy both workers

**Files:**
- Modify: `workers/music-scrobble-worker/wrangler.toml` (replace placeholder `"replace-with-kv-namespace-id"` / `"replace-with-d1-database-id"`)
- Modify: `workers/reconciliation-worker/wrangler.toml` (uncomment the `[[d1_databases]]` block, add a real database ID; switch `SETTLER_MODE` — see Step 3 for the coexistence decision)

- [ ] **Step 1: Provision KV + D1 for the scrobble worker**

```bash
cd workers/music-scrobble-worker
npx wrangler kv:namespace create MUSICBRAINZ_REGISTRY
npx wrangler d1 create music-scrobble-db
```
Copy the returned `id` values into `wrangler.toml`'s `kv_namespaces` and `d1_databases` blocks, replacing the placeholder strings.

- [ ] **Step 2: Apply the schema from Task B1**

```bash
npx wrangler d1 execute music-scrobble-db --file=schema.sql --remote
```

- [ ] **Step 3: Decide `SETTLER_MODE` coexistence**

`workers/reconciliation-worker`'s `SETTLER_MODE` is currently `"chain"` (enumerates active rails via `getLogs`+registry, settles them all). Task B's D1-backed `reconcileFromD1()` is a **separate settlement path** keyed off the scrobble worker's own `plays` table. These are not mutually exclusive — `"chain"` mode already settles ANY active stream including music-sidecar-opened ones, so **you do not strictly need to switch modes** for streams to settle. `reconcileFromD1()` exists for a more targeted "settle only unsettled plays, mark them settled in D1" bookkeeping loop specific to the music vertical (e.g. for royalty reporting). Decide based on what the demo needs:
- If the demo just needs "listen → stream drips → settles automatically," **leave `SETTLER_MODE="chain"` as-is** — it already covers this, no change needed.
- If the demo needs per-play royalty bookkeeping in the `plays` table (e.g. showing "this specific play settled for $0.0004"), provision D1 for `reconciliation-worker` too and add a scheduled trigger calling `reconcileFromD1()` alongside the existing chain-mode cron.

Document which choice was made in a comment at the top of `reconciliation-worker/wrangler.toml`.

- [ ] **Step 4: Deploy both workers**

```bash
cd workers/music-scrobble-worker && npx wrangler secret put MUSIC_SIDECAR_RELAYER_KEY --env production
npx wrangler deploy
cd ../reconciliation-worker && npx wrangler deploy  # only if Step 3 changed anything here
```

- [ ] **Step 5: Smoke test the deployed worker**

```bash
curl -X PUT https://<your-scrobble-worker>.workers.dev/artist/test-mbid-123 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d '{"wallet":"0x..."}'

curl -X POST https://<your-scrobble-worker>.workers.dev/session/open \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d '{"listenerAddress":"0x...","artistMbid":"test-mbid-123"}'
```
Expected: second call returns a real `{ paycardId, vaultAddress, txHash }` once Task B3's throw is resolved — until then, expect the documented error.

- [ ] **Step 6: Commit**

```bash
git add workers/music-scrobble-worker/wrangler.toml workers/reconciliation-worker/wrangler.toml
git commit -m "music-scrobble-worker: provision KV/D1 and deploy"
```

### Task B5: Minimal Navidrome-facing shim (for the actual demo recording)

**Files:**
- Create: `workers/music-scrobble-worker/src/navidromeShim.ts`
- Modify: `workers/music-scrobble-worker/src/index.ts`

For the demo video specifically, you need something that looks like a real music player scrobbling — not a raw curl call. Navidrome (and most Subsonic-API clients) POST to `/apis/listenbrainz/1/submit-listens` in ListenBrainz's JSON shape when a track finishes playing. Translate that into the existing `/webhook/scrobble` shape this worker already handles.

- [ ] **Step 1: Read the existing scrobble webhook's expected body shape**

```bash
grep -n "webhook/scrobble" -A 20 workers/music-scrobble-worker/src/index.ts
```
Note the exact field names it destructures from the request body.

- [ ] **Step 2: Write the translator**

```ts
// workers/music-scrobble-worker/src/navidromeShim.ts
interface ListenBrainzSubmitBody {
  listen_type: "single" | "playing_now";
  payload: Array<{
    listened_at?: number;
    track_metadata: {
      artist_name: string;
      track_name: string;
      additional_info?: { artist_mbids?: string[] };
    };
  }>;
}

export function translateListenBrainzToScrobble(body: ListenBrainzSubmitBody, listenerAddress: string) {
  if (body.listen_type !== "single") return null; // ignore "now playing" pings, only real completed listens
  const listen = body.payload[0];
  if (!listen) return null;
  const mbid = listen.track_metadata.additional_info?.artist_mbids?.[0];
  if (!mbid) return null;
  return {
    sourceEventId: `${mbid}:${listen.listened_at ?? Date.now()}:${listenerAddress}`,
    artistMbid: mbid,
    listenerAddress,
    timestamp: listen.listened_at ?? Math.floor(Date.now() / 1000),
  };
}
```

- [ ] **Step 3: Wire the route**

```ts
if (url.pathname === "/apis/listenbrainz/1/submit-listens" && request.method === "POST") {
  const listenerAddress = request.headers.get("x-openrails-listener-address");
  if (!listenerAddress) return jsonResponse({ error: "Missing x-openrails-listener-address header" }, 400);
  const body = await request.json().catch(() => null) as ListenBrainzSubmitBody | null;
  if (!body) return jsonResponse({ error: "Invalid body" }, 400);
  const translated = translateListenBrainzToScrobble(body, listenerAddress);
  if (!translated) return jsonResponse({ status: "ok", ignored: true }); // matches ListenBrainz's own tolerant response shape
  // forward to the existing scrobble handler logic (reuse it directly rather than an HTTP round-trip if it's a plain function in this file)
  return handleScrobble(translated, env); // use whatever the existing webhook handler's internal function is actually named
}
```

- [ ] **Step 4: Configure Navidrome to point at this worker**

Navidrome supports a `ND_LISTENBRAINZ_ENABLED=true` + custom endpoint config (check current Navidrome docs for the exact env var, since this is an external tool this repo doesn't control — search "Navidrome ListenBrainz custom URL" if the exact var name has changed). Point it at your deployed worker's `/apis/listenbrainz/1/submit-listens` URL, with `x-openrails-listener-address` supplied via whatever auth/proxy layer sits in front (for a demo, a simple reverse-proxy header injection is fine — document the exact setup used in this step's commit message).

- [ ] **Step 5: Commit**

```bash
git add workers/music-scrobble-worker/src/navidromeShim.ts workers/music-scrobble-worker/src/index.ts
git commit -m "music-scrobble-worker: add Navidrome/ListenBrainz-compatible ingestion shim"
```

---

## Part C — Circle Smart Account adapter

**Why this part exists:** The V2 Hub already verifies signatures via OpenZeppelin's `SignatureChecker.isValidSignatureNow` (confirmed at `contracts/v2-factory/ArcOpenRailsHubV2Initializable.sol:321`) — meaning it already accepts EIP-1271 smart-contract-account signatures with zero contract changes needed. This part is purely additive SDK work: one new adapter file following the exact pattern of the two that already exist.

### Task C1: Research the current Circle smart-account SDK surface

No Circle smart-account SDK package is installed anywhere in this repo today (checked every `package.json`) — this is genuinely greenfield on the dependency front, so this task is a real research spike, not a formality.

- [ ] **Step 1: Confirm the current package name and API**

Check `https://developers.circle.com` (Modular Wallets / Smart Account docs) and the reference sample repo found during this project's earlier viability spike: `github.com/circlefin/arc-multichain-wallet`. Circle's smart-account SDK surface has changed names before (e.g. `@circle-fin/modular-wallets-core`, `@circle-fin/w3s-pw-web-sdk` are two names that have existed at different times) — confirm which one the Arc sample repo actually imports, since that's the most Arc-specific reference available.

- [ ] **Step 2: Install the confirmed package**

```bash
npm install --workspace=sdk <confirmed-package-name>
```
(Adjust if this repo doesn't use npm workspaces for `sdk/` — check `sdk/package.json` is a standalone package first with `cat sdk/package.json | grep name`.)

- [ ] **Step 3: Commit**

```bash
git add sdk/package.json sdk/package-lock.json
git commit -m "sdk: add Circle smart-account SDK dependency"
```

### Task C2: Implement `sdk/src/adapters/circle.ts`

**Files:**
- Create: `sdk/src/adapters/circle.ts`
- Test: `sdk/test/CircleAdapter.test.ts` (or `test/CircleAdapter.test.ts` at repo root — match wherever `test/PrivyAdapter.test.ts` actually lives; the earlier audit confirmed that file's exact location, check `find . -name "PrivyAdapter.test.ts"` if unsure)
- Read only: `sdk/src/adapters/privy.ts` (41 lines, full file — this is your closest template: sign-only, wraps an external signing call into `OpenRailsAccount`'s two methods), `sdk/src/account.ts:21-27` (the exact interface to satisfy)

**Interfaces:**
- Consumes: whatever the Task C1 SDK package exposes for requesting a smart-account signature over typed data (exact shape depends on Task C1's research result — likely something like `smartAccountClient.signTypedData({domain, types, primaryType, message})`, mirroring the EIP-1193 `eth_signTypedData_v4` shape `privy.ts` already wraps).
- Produces: `circleToAccount(params): OpenRailsAccount` — matching `OpenRailsAccount { getAddress(): Promise<string>; signTypedData(domain, types, value): Promise<string> }` exactly (confirmed interface from `sdk/src/account.ts:21-27`).

- [ ] **Step 1: Write the failing test first**

```ts
// test/CircleAdapter.test.ts (match the exact location/import style of test/PrivyAdapter.test.ts)
import { expect } from "chai";
import { ethers } from "ethers";
import { circleToAccount } from "../sdk/src/adapters/circle";

describe("circleToAccount", () => {
  it("produces a signature that recovers to the smart account's address via EIP-1271", async () => {
    // Mirror PrivyAdapter.test.ts's mock-provider round-trip pattern exactly:
    // wrap a plain ethers.Wallet behind a fake "smart account client" shaped like
    // whatever Task C1's real SDK exposes, then assert the signature it produces
    // is accepted the same way MockERC1271Account.sol (contracts/v2-factory/test/)
    // accepts a real EIP-1271 signature — reuse that mock contract in a Hardhat
    // test rather than re-deriving EIP-1271 validation logic by hand.
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx hardhat test test/CircleAdapter.test.ts
```
Expected: FAIL — `circleToAccount` is not defined (file doesn't exist yet).

- [ ] **Step 3: Implement the adapter**

Follow `sdk/src/adapters/privy.ts`'s exact structure (read it first — 41 lines, don't guess its shape). The implementation is a thin wrapper: `getAddress()` returns the smart account's on-chain address (not an EOA), `signTypedData(domain, types, value)` calls through to whatever Task C1's SDK exposes for smart-account typed-data signing, returning the raw signature bytes the Hub's `SignatureChecker.isValidSignatureNow` expects (same return shape `privy.ts` already produces — confirm by diffing your new file's return type against `privy.ts`'s).

- [ ] **Step 4: Run the test again, confirm it passes**

```bash
npx hardhat test test/CircleAdapter.test.ts
```
Expected: PASS.

- [ ] **Step 5: Prove it end-to-end against the real V2 Hub (not just the mock)**

Using `contracts/v2-factory/test/MockERC1271Account.sol` as reference for what a real smart-account contract needs to expose, either (a) deploy a real Circle smart account on Arc testnet via Task C1's SDK and sign a real `SettlementIntent`, submitting it through `openPaycardChannel` and confirming it lands (status `0x1`), or (b) if a real Circle smart account can't be provisioned in this environment, at minimum prove the signature round-trip against `MockERC1271Account.sol` in a Hardhat test that actually calls the real deployed V2 Hub's `openPaycardChannel` (not just a unit test of the adapter in isolation) — (a) is strongly preferred since it's the actual claim being made ("Circle Smart Account works with OpenRails"), do not settle for (b) unless (a) is genuinely blocked by lack of Circle account provisioning access, and say so explicitly if you do.

- [ ] **Step 6: Commit**

```bash
git add sdk/src/adapters/circle.ts test/CircleAdapter.test.ts
git commit -m "sdk: add Circle smart-account adapter (circleToAccount)"
```

### Task C3 (optional / follow-on, not required for Part C completion): Cockpit Connect UI

Per the approved dashboard IA spec (`docs/superpowers/specs/2026-07-05-webapp-dashboard-ia-design.md`), Circle Smart Account was deliberately deferred from the Connect UI until the account layer was ready — Task C2 makes it ready. Adding a UI entry point is real, separate scope (a new option in `cockpit/src/components/ConnectWalletButton.tsx`'s Privy modal config or a parallel connect path) — do not fold it into Task C2's commit. If time allows after C1/C2, treat this as its own brainstorming → plan → build pass, not an extension of this plan.

---

## Part D — Circle Gateway integration

**Why this part exists:** Circle Gateway gives near-instant (~500ms) unified-balance funding across chains, already confirmed live on Arc testnet (`GatewayWallet 0x0077777d7EBA4688BDeF3E311b846F25870A19B9`, `GatewayMinter 0x0022222ABE238Cc2C7Bb1f21003F0a260052475B`). Nothing in this repo references these addresses yet — this is greenfield. The existing `experiments/bridge-tokens/` code is a DIFFERENT Circle product (CCTP burn-and-mint via `@circle-fin/bridge-kit`), not Gateway — don't confuse the two or try to adapt that script; it's not installed (its `@circle-fin/bridge-kit`/`@circle-fin/adapter-viem-v2` deps aren't in any `package.json`) and solves a different problem.

### Task D1: Research spike — confirm the real Gateway contract ABI and decimal handling

This task exists because this codebase does not yet encode Arc's dual 6/18-decimal USDC/native-token handling anywhere as real logic (confirmed — only `cockpit/src/lib/chain.ts:6` sets a `decimals: 6` display hint, no actual dual-representation math exists). Do not write Task D2/D3 against invented ABI signatures — pull the real ones first.

- [ ] **Step 1: Pull the verified contract ABI**

```bash
# GatewayWallet and GatewayMinter are both verified on Arc's block explorer —
# pull their real ABIs rather than guessing function names:
curl -s "https://testnet.arcscan.app/api?module=contract&action=getabi&address=0x0077777d7EBA4688BDeF3E311b846F25870A19B9" | jq .
curl -s "https://testnet.arcscan.app/api?module=contract&action=getabi&address=0x0022222ABE238Cc2C7Bb1f21003F0a260052475B" | jq .
```
If arcscan's API requires a key or doesn't expose this the same way Etherscan's does, fall back to Circle's own Gateway developer docs (`developers.circle.com/gateway`) for the exact ABI/interface — do not proceed to Task D2 with fabricated function signatures.

- [ ] **Step 2: Spike the decimal-handling question directly on-chain**

```bash
npx tsx -e "
import { createPublicClient, http } from 'viem';
import { arcTestnet } from './cockpit/src/lib/chain'; // reuse the existing chain config
const client = createPublicClient({ chain: arcTestnet, transport: http() });
const testAddr = '0x1A76BFE6bF7A4BfD854b16C19Dd870e0DE56473C'; // reuse the same test signer used throughout this session
const native = await client.getBalance({ address: testAddr });
console.log('native balance (wei-shaped, check actual decimals):', native);
const erc20Balance = await client.readContract({
  address: '0x3600000000000000000000000000000000000000',
  abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{name:'a',type:'address'}], outputs: [{type:'uint256'}] }],
  functionName: 'balanceOf',
  args: [testAddr],
});
console.log('erc20 balanceOf (6-decimal-shaped):', erc20Balance);
console.log('ratio (should reveal the 6-vs-18 relationship):', Number(native) / Number(erc20Balance));
"
```
Document the actual observed ratio in a code comment in Task D2's implementation — this determines whether Gateway deposit amounts need any scaling conversion before being passed to `GatewayWallet`.

- [ ] **Step 3: Write up findings**

Create `experiments/circle-gateway-spike-results.md` documenting: the real ABI fragments pulled in Step 1 (paste them verbatim), the decimal ratio observed in Step 2, and a one-paragraph recommendation for Task D2/D3's exact scaling logic.

- [ ] **Step 4: Commit**

```bash
git add experiments/circle-gateway-spike-results.md
git commit -m "circle-gateway: research spike — real ABI + decimal handling confirmed"
```

### Task D2: Implement `sdk/src/gateway.ts` deposit + mint

**Files:**
- Create: `sdk/src/gateway.ts`
- Test: `test/Gateway.test.ts`
- Read only: `experiments/circle-gateway-spike-results.md` (Task D1's output — the ABI fragments and decimal findings this task depends on)

**Interfaces:**
- Produces: `depositToGateway(params): Promise<{txHash: string}>` and `mintFromGateway(params): Promise<{txHash: string}>` — exact parameter shapes depend on Task D1's confirmed ABI, write them to match what Task D1 actually found, not a guess.

- [ ] **Step 1: Write the failing test**

```ts
// test/Gateway.test.ts
import { expect } from "chai";
import { depositToGateway } from "../sdk/src/gateway";

describe("depositToGateway", () => {
  it("submits a deposit transaction to the real GatewayWallet contract and returns a txHash", async () => {
    // Use a funded test signer (DEPLOYER_PRIVATE_KEY, same as used throughout this
    // session) and a small real amount (e.g. 0.01 USDC) — this is an integration
    // test against live Arc testnet infrastructure, not a mock, since Gateway has
    // no local simulator. Assert the returned txHash is a real 66-char hex and
    // that `waitForTransactionReceipt` confirms status success.
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx hardhat test test/Gateway.test.ts
```
Expected: FAIL — `depositToGateway` not defined.

- [ ] **Step 3: Implement using Task D1's real ABI**

```ts
// sdk/src/gateway.ts
import { ethers } from "ethers";

// Fill these in from experiments/circle-gateway-spike-results.md's Step 1 output —
// do NOT invent function signatures; if the spike didn't confirm one you need,
// go back and re-run Task D1's Step 1 rather than guessing here.
const GATEWAY_WALLET_ABI = [/* paste from spike results */] as const;
const GATEWAY_MINTER_ABI = [/* paste from spike results */] as const;

export const GATEWAY_WALLET_ADDRESS = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
export const GATEWAY_MINTER_ADDRESS = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

export interface DepositParams {
  signer: ethers.Signer;
  amountBaseUnits: bigint; // apply whatever scaling Task D1's Step 2 found necessary
}

export async function depositToGateway(params: DepositParams): Promise<{ txHash: string }> {
  const contract = new ethers.Contract(GATEWAY_WALLET_ADDRESS, GATEWAY_WALLET_ABI, params.signer);
  // call whatever the real ABI's deposit function is named (confirm exact name from spike)
  const tx = await contract.deposit(params.amountBaseUnits); // placeholder call shape — MUST match Task D1's real ABI, adjust before considering this step done
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}
```

- [ ] **Step 4: Run the test again against real Arc testnet, confirm it passes**

```bash
npx hardhat test test/Gateway.test.ts --network arcTestnet
```
Expected: PASS, with a real observable transaction on `testnet.arcscan.app`.

- [ ] **Step 5: Commit**

```bash
git add sdk/src/gateway.ts test/Gateway.test.ts
git commit -m "sdk: add Circle Gateway deposit/mint integration"
```

### Task D3: End-to-end proof — fund a fresh wallet via Gateway, then use it to pay through OpenRails

**Files:**
- Create: `experiments/circle-gateway-e2e-results.md`

- [ ] **Step 1: Generate a fresh throwaway wallet**

```bash
node -e "const {ethers}=require('ethers'); const w=ethers.Wallet.createRandom(); console.log(w.address, w.privateKey);"
```

- [ ] **Step 2: Deposit a small amount via Gateway (Task D2's function) from a funded source wallet into the fresh wallet**

- [ ] **Step 3: Confirm the fresh wallet's balance reflects the Gateway-minted funds**

```bash
npx tsx -e "
import { createPublicClient, http } from 'viem';
import { arcTestnet } from './cockpit/src/lib/chain';
const client = createPublicClient({ chain: arcTestnet, transport: http() });
console.log(await client.getBalance({ address: '<fresh wallet address>' }));
"
```

- [ ] **Step 4: Use the fresh wallet to actually pay someone through OpenRails**

Reuse the exact on-chain verification pattern from this session's earlier Playwright/viem proofs (a `createWalletClient` + `openPaycardChannel` call, or the SDK's `payGasless`) — the point is proving Gateway-funded money is real, spendable OpenRails escrow, not just a balance number.

- [ ] **Step 5: Write up the full proof chain**

Document every address, tx hash, and amount from Steps 1-4 in `experiments/circle-gateway-e2e-results.md`.

- [ ] **Step 6: Commit**

```bash
git add experiments/circle-gateway-e2e-results.md
git commit -m "circle-gateway: prove fund-via-Gateway-then-pay-via-OpenRails end to end"
```

---

## Completion checklist for whoever reviews this plan's execution

- [ ] Part A: `mcp/smoke.mjs` prints a real `pay_link` txHash; x402 v2 proof artifacts exist and reference the V2 hub.
- [ ] Part B: both workers deployed with real KV/D1 IDs; Task B3's `openSession.ts` no longer throws (a real decision was made and implemented, not skipped); a real scrobble → open → settle chain has been observed at least once, even manually.
- [ ] Part C: `sdk/src/adapters/circle.ts` exists, tested, and Task C2 Step 5 was proven against the real V2 Hub (not only a mock).
- [ ] Part D: `sdk/src/gateway.ts` exists using a REAL confirmed ABI (not placeholders left over from a skipped Task D1), and Task D3's end-to-end proof file exists with real tx hashes.
- [ ] Nothing in any new code references the frozen V1 hub `0x01EC54846524D043fD808152D41596beF603381d`.
