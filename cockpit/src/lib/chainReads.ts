/**
 * Client-side chain reads — make the cockpit work WITHOUT a gateway (e.g. hosted on
 * Cloudflare Pages). Reads config from bundled constants, Paycard state from the Hub's
 * `registry`, and recovers paycards via `PaycardProvisioned` logs — all over the public Arc RPC
 * with viem. `api.*` read calls fall back to these when the gateway is unreachable.
 *
 * Indexer-only views (the streams projection, per-stream history, workflow grouping) have no
 * cheap chain equivalent, so they degrade to honest empty states in standalone mode; My Streams
 * + Profile still work via recover + registry.
 */
import { createPublicClient, http, parseAbiItem, getAddress } from "viem";
import { arcTestnet } from "./chain";
import { HUB_ABI } from "./contracts";
import type { GatewayConfig, PaycardOnchain, RecoveredPaycard } from "./api";

// Public Arc testnet config (addresses are public, not secrets).
export const BUNDLED_CONFIG: GatewayConfig = {
  networkMode: "arc-testnet",
  chainId: 5042002,
  clearinghouseAddress: "0x01EC54846524D043fD808152D41596beF603381d",
  usdcAddress: "0x3600000000000000000000000000000000000000",
  explorerBaseUrl: "https://explorer.testnet.arc.network",
  relayerMode: "client-self-submit",
};

const HUB = BUNDLED_CONFIG.clearinghouseAddress as `0x${string}`;
const PROVISIONED = parseAbiItem(
  "event PaycardProvisioned(bytes32 indexed paycardId, address indexed payer, address indexed recipient, bytes32 metadataHash, uint256 poolAllocation, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds)",
);

const client = createPublicClient({ chain: arcTestnet, transport: http("https://rpc.testnet.arc.network") });

const USDC = BUNDLED_CONFIG.usdcAddress as `0x${string}`;
const ERC20_READ = [
  parseAbiItem("function balanceOf(address) view returns (uint256)"),
  parseAbiItem("function allowance(address,address) view returns (uint256)"),
] as const;

export const chainReads = {
  config: async (): Promise<GatewayConfig> => BUNDLED_CONFIG,

  balance: async (address: string): Promise<{ balance: string }> => {
    const b = (await client.readContract({ address: USDC, abi: ERC20_READ, functionName: "balanceOf", args: [getAddress(address)] })) as bigint;
    return { balance: b.toString() };
  },
  allowance: async (owner: string): Promise<{ allowance: string }> => {
    const a = (await client.readContract({ address: USDC, abi: ERC20_READ, functionName: "allowance", args: [getAddress(owner), HUB] })) as bigint;
    return { allowance: a.toString() };
  },
  nonce: async (payer: string, channel: number): Promise<{ nonce: string }> => {
    const n = (await client.readContract({ address: HUB, abi: HUB_ABI, functionName: "accountNonceTracks", args: [getAddress(payer), BigInt(channel)] })) as bigint;
    return { nonce: n.toString() };
  },

  paycard: async (id: string): Promise<PaycardOnchain> => {
    const r = (await client.readContract({
      address: HUB,
      abi: HUB_ABI,
      functionName: "registry",
      args: [id as `0x${string}`],
    })) as any;
    // viem returns an array (positional) for multi-output getters.
    const v = Array.isArray(r) ? r : [r.payer, r.recipient, r.metadataHash, r.totalAllocationPool, r.availableBalance, r.flowVelocityPerSecond, r.genesisTimestamp, r.lifespanSeconds, r.lastCheckpointEpoch, r.residualDeltaRecipient, r.operationalStatus];
    return {
      paycardId: id,
      payer: v[0],
      recipient: v[1],
      metadataHash: v[2],
      totalAllocationPool: String(v[3]),
      availableBalance: String(v[4]),
      flowVelocityPerSecond: String(v[5]),
      genesisTimestamp: Number(v[6]),
      lifespanSeconds: Number(v[7]),
      lastCheckpointEpoch: Number(v[8]),
      residualDeltaRecipient: v[9],
      operationalStatus: Number(v[10]) === 0 ? "Active" : "Terminated",
    };
  },

  recoverPaycards: async (params: { payer?: string; recipient?: string; limit?: number }): Promise<{ results: RecoveredPaycard[]; count: number }> => {
    const latest = await client.getBlockNumber();
    const fromBlock = latest > 9000n ? latest - 9000n : 0n; // public RPC caps getLogs at 10k
    const logs = await client.getLogs({
      address: HUB,
      event: PROVISIONED,
      args: {
        ...(params.payer ? { payer: getAddress(params.payer) } : {}),
        ...(params.recipient ? { recipient: getAddress(params.recipient) } : {}),
      },
      fromBlock,
      toBlock: "latest",
    });
    const results: RecoveredPaycard[] = logs.slice(0, params.limit ?? 20).map((l) => ({
      paycardId: l.args.paycardId as string,
      source: "chain",
      provisioned: {
        payer: l.args.payer as string,
        recipient: l.args.recipient as string,
        metadataHash: l.args.metadataHash as string,
        blockNumber: Number(l.blockNumber),
        transactionHash: l.transactionHash,
      },
    }));
    return { results, count: results.length };
  },
};
