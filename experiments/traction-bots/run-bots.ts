/**
 * Bot traction kit — simulated agent-to-agent streaming micropayments on Arc testnet.
 *
 * Each funded bot wallet acts as an autonomous payer-agent: within a budget it opens
 * sub-cent streaming payouts to other wallets ("creators"), drip-settles them, and stops at
 * the cap. This is SIMULATION / load-testing / dogfooding — not organic users — and is reported
 * as such. Uses the PUBLIC Arc RPC only (never the canteen token RPC).
 *
 *   # after funding the addresses from `npm run bots:wallets`:
 *   OPS_PER_BOT=2 AMOUNT_USDC=0.002 npm run bots:run
 *
 * Env: RPC_URL, OPS_PER_BOT, AMOUNT_USDC, VELOCITY_BASE_PER_SEC, LIFESPAN_SECONDS, BUDGET_USDC,
 *      BOT_METADATA_REF, ARC_OPENRAILS_HUB_ADDRESS, ARC_USDC_ADDRESS, ARC_CHAIN_ID (else registry).
 *
 * Opsec: the on-chain metadataRef is deliberately neutral (BOT_METADATA_REF) so runs do not
 * publicly brand the payments or fingerprint the fleet as one operator. The simulation labelling
 * and per-bot/per-op detail live only in the gitignored metrics.json, never on-chain.
 */
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

import {
  LeptonOpenRailsClient,
  type OpenRailsIntentV1,
} from "../../sdk/src/client";
import { hashOpenRailsMetadata, buildMetadataBoundPaycardId, type CanonicalMetadataV1 } from "../../sdk/src/metadata";
import {
  approveOpenRailsSpend,
  assertOpenRailsNetwork,
  readNonce,
  readTokenAllowance,
  readTokenBalance,
  submitOpenPaycardWithSigner,
  submitSettleWithSigner,
} from "../../sdk/src/wallet";

interface BotWallet { index: number; address: string; privateKey: string; }

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network";
const OPS_PER_BOT = Number(process.env.OPS_PER_BOT || "2");
const AMOUNT_USDC = Number(process.env.AMOUNT_USDC || "0.002"); // sub-cent
const VELOCITY = BigInt(process.env.VELOCITY_BASE_PER_SEC || "5"); // base units / sec
const LIFESPAN = Number(process.env.LIFESPAN_SECONDS || "300");
const BUDGET_USDC = Number(process.env.BUDGET_USDC || "0.05");
const NONCE_CHANNEL = Number(process.env.BOT_NONCE_CHANNEL || "777");
// Neutral on-chain reference — no operator/sim fingerprint on the public ledger.
const METADATA_REF = process.env.BOT_METADATA_REF || "openrails-stream";

const walletsFile = path.join(__dirname, "..", "..", ".bot-wallets", "wallets.json");
const metricsFile = path.join(__dirname, "metrics.json");

function loadRegistry(): Record<string, any> {
  const p =
    process.env.OPENRAILS_DEPLOYMENT_REGISTRY_PATH ||
    path.join(__dirname, "..", "..", "deployments", "openrails-addresses.local.json");
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return {}; }
}
function reqAddr(v: any, name: string): string {
  if (!ethers.isAddress(String(v || ""))) throw new Error(`${name} missing/invalid`);
  return ethers.getAddress(String(v));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const bots: BotWallet[] = JSON.parse(fs.readFileSync(walletsFile, "utf8"));
  const reg = loadRegistry();
  const chainId = Number(process.env.ARC_CHAIN_ID || reg.chainId || 5042002);
  const hub = reqAddr(process.env.ARC_OPENRAILS_HUB_ADDRESS || reg.arcOpenRailsHubV1, "Hub");
  const token = reqAddr(process.env.ARC_USDC_ADDRESS || reg.arcUsdcAddress, "USDC");

  const provider = new ethers.JsonRpcProvider(RPC_URL, chainId, { staticNetwork: true });
  await assertOpenRailsNetwork(provider, chainId);
  console.log(`[bots] ${bots.length} wallets · chain ${chainId} · hub ${hub} · RPC ${RPC_URL}`);
  console.log(`[bots] SIMULATION (load-test/dogfood) — public RPC, sub-cent streaming payouts\n`);

  const allocation = BigInt(Math.round(AMOUNT_USDC * 1_000_000));
  const budgetBase = BigInt(Math.round(BUDGET_USDC * 1_000_000));
  const events: any[] = [];
  const creators = new Set<string>();
  const unfunded: string[] = [];
  let opens = 0, settles = 0, committedBase = 0n, errors = 0;

  for (const bot of bots) {
    const wallet = new ethers.Wallet(bot.privateKey, provider);
    const [usdc, gas] = await Promise.all([
      readTokenBalance(provider, token, bot.address),
      provider.getBalance(bot.address),
    ]);
    if (usdc < allocation || gas === 0n) {
      unfunded.push(bot.address);
      console.log(`[bot ${bot.index}] ${bot.address} — unfunded (usdc ${ethers.formatUnits(usdc, 6)}, gas ${gas === 0n ? "0" : "ok"}) — skip`);
      continue;
    }

    const client = new LeptonOpenRailsClient(bot.privateKey, hub, chainId);
    let nonce = await readNonce(provider, hub, bot.address, NONCE_CHANNEL);
    let spent = 0n;

    // Ensure allowance for this bot's planned spend.
    const need = allocation * BigInt(OPS_PER_BOT);
    const allowance = await readTokenAllowance(provider, token, bot.address, hub);
    if (allowance < need) {
      try {
        const tx = await approveOpenRailsSpend(wallet, token, hub, need);
        await tx.wait();
      } catch (e: any) { console.log(`[bot ${bot.index}] approve failed: ${e.message?.slice(0, 80)}`); }
    }

    for (let k = 0; k < OPS_PER_BOT; k += 1) {
      if (spent + allocation > budgetBase) break;
      const recipient = bots[(bot.index + 1 + k) % bots.length].address; // round-robin "creator"
      try {
        const metadata: CanonicalMetadataV1 = {
          version: "openrails-metadata-v1",
          mode: "railsflow",
          originator: bot.address,
          recipient,
          token,
          amount: allocation.toString(),
          flowVelocityPerSecond: VELOCITY.toString(),
          lifespanSeconds: LIFESPAN,
          metadataRef: METADATA_REF,
        };
        const metadataHash = hashOpenRailsMetadata(metadata);
        const paycardId = buildMetadataBoundPaycardId({ payer: bot.address, nonceChannel: NONCE_CHANNEL, nonceValue: nonce, metadataHash });
        const intent: OpenRailsIntentV1 = {
          paycardId, metadataHash, recipient,
          totalAllocationPool: allocation.toString(),
          flowVelocityPerSecond: VELOCITY.toString(),
          genesisTimestamp: Math.floor(Date.now() / 1000),
          lifespanSeconds: LIFESPAN,
          residualDeltaRecipient: bot.address,
          nonceChannel: NONCE_CHANNEL,
          nonceValue: nonce,
        };
        const envelopeToken = await client.signPermissionEnvelope(intent, { mode: "railsflow", metadata });
        const openTx = await submitOpenPaycardWithSigner(wallet, hub, envelopeToken, "railsflow");
        await openTx.wait();
        opens += 1; committedBase += allocation; creators.add(recipient.toLowerCase()); spent += allocation; nonce += 1;

        // drip-settle so the creator earns the accrued amount
        let settleHash: string | undefined;
        try {
          const sTx = await submitSettleWithSigner(wallet, hub, paycardId);
          await sTx.wait();
          settles += 1; settleHash = sTx.hash;
        } catch { /* settle is best-effort */ }

        events.push({ bot: bot.index, payer: bot.address, recipient, paycardId, allocationUsdc: AMOUNT_USDC, openTx: openTx.hash, settleTx: settleHash });
        console.log(`[bot ${bot.index}] paid ${recipient.slice(0, 10)}… ${AMOUNT_USDC} USDC stream · open ${openTx.hash.slice(0, 10)}…`);
        await sleep(400);
      } catch (e: any) {
        errors += 1;
        console.log(`[bot ${bot.index}] op ${k} failed: ${String(e.message ?? e).slice(0, 100)}`);
      }
    }
  }

  const avgUsdc = opens > 0 ? AMOUNT_USDC : 0;
  const metrics = {
    kind: "simulation/load-test (not organic users)",
    network: `arc-testnet (${chainId})`,
    rpc: RPC_URL,
    bots: bots.length,
    funded: bots.length - unfunded.length,
    unfunded: unfunded.length,
    totalPayments: opens,
    totalSettlements: settles,
    uniqueCreators: creators.size,
    totalCommittedUsdc: Number(committedBase) / 1e6,
    averagePaymentUsdc: avgUsdc, // sub-cent target
    subCent: avgUsdc < 0.01,
    errors,
    generatedAt: new Date().toISOString(),
    events,
  };
  fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
  console.log("\n===== TRACTION METRICS (simulation) =====");
  console.log(JSON.stringify({ ...metrics, events: `${events.length} events → ${metricsFile}` }, null, 2));
  if (unfunded.length === bots.length) {
    console.log("\nAll wallets unfunded — fund the addresses from `npm run bots:wallets`, then re-run.");
  }
}

main().catch((e) => { console.error(`[bots] fatal: ${e.message ?? e}`); process.exitCode = 1; });
