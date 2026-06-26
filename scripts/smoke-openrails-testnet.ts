import * as fs from "fs";
import * as path from "path";

import { ethers, network } from "hardhat";

import {
  LeptonOpenRailsClient,
  type OpenRailsIntentV1,
} from "../sdk/src/client";
import {
  buildMetadataBoundPaycardId,
  hashOpenRailsMetadata,
  type CanonicalMetadataV1,
} from "../sdk/src/metadata";

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
];

interface DeploymentRegistry {
  chainId?: number;
  arcUsdcAddress?: string;
  arcOpenRailsHubV1?: string;
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function requireEnv(name: string): string {
  const value = env(name);
  if (!value || value.includes("replace-with") || value === "https://example.invalid") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireAddress(name: string): string {
  const value = requireEnv(name);
  if (!ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`${name} must be a non-zero address`);
  }
  return ethers.getAddress(value);
}

function optionalAddress(name: string): string | undefined {
  const value = env(name);
  if (!value) return undefined;
  if (value === ethers.ZeroAddress) return undefined;
  if (!ethers.isAddress(value)) {
    throw new Error(`${name} must be a non-zero address`);
  }
  return ethers.getAddress(value);
}

function parseUnitsEnv(name: string, fallback: bigint): bigint {
  const value = env(name);
  if (!value) return fallback;
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new Error(`${name} must be greater than zero`);
  return parsed;
}

function loadRegistry(): DeploymentRegistry {
  const registryPath = env("OPENRAILS_DEPLOYMENT_REGISTRY_PATH");
  if (!registryPath) return {};

  const resolvedPath = path.resolve(registryPath);
  const parsed = JSON.parse(fs.readFileSync(resolvedPath, "utf8")) as DeploymentRegistry;
  return parsed;
}

async function latestTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  if (!block) throw new Error("Unable to read latest block");
  return block.timestamp;
}

async function waitForTx(label: string, tx: any) {
  console.log(`${label} submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`${label} confirmed: block=${receipt.blockNumber}`);
  return receipt;
}

async function verifyActiveRow(
  hub: any,
  label: string,
  paycardId: string,
  expected: { payer: string; recipient: string; metadataHash: string },
) {
  const row = await hub.registry(paycardId);
  if (ethers.getAddress(row.payer) !== ethers.getAddress(expected.payer)) {
    throw new Error(`${label} registry payer mismatch`);
  }
  if (ethers.getAddress(row.recipient) !== ethers.getAddress(expected.recipient)) {
    throw new Error(`${label} registry recipient mismatch`);
  }
  if (row.metadataHash !== expected.metadataHash) {
    throw new Error(`${label} registry metadataHash mismatch`);
  }
  if (row.operationalStatus !== 0n) {
    throw new Error(`${label} registry row is not active`);
  }
}

async function main() {
  const registry = loadRegistry();
  const expectedChainId = Number(requireEnv("ARC_CHAIN_ID"));
  const actualNetwork = await ethers.provider.getNetwork();
  const actualChainId = Number(actualNetwork.chainId);
  if (actualChainId !== expectedChainId || registry.chainId && registry.chainId !== actualChainId) {
    throw new Error(
      `Chain ID mismatch: expected ${expectedChainId}, registry ${registry.chainId ?? "unset"}, got ${actualChainId}`,
    );
  }

  const hubAddress = optionalAddress("ARC_OPENRAILS_HUB_ADDRESS") ??
    (registry.arcOpenRailsHubV1 && ethers.isAddress(registry.arcOpenRailsHubV1)
      ? ethers.getAddress(registry.arcOpenRailsHubV1)
      : undefined);
  if (!hubAddress || hubAddress === ethers.ZeroAddress) {
    throw new Error("Set ARC_OPENRAILS_HUB_ADDRESS or OPENRAILS_DEPLOYMENT_REGISTRY_PATH");
  }

  const tokenAddress = optionalAddress("ARC_USDC_ADDRESS") ??
    (registry.arcUsdcAddress && ethers.isAddress(registry.arcUsdcAddress)
      ? ethers.getAddress(registry.arcUsdcAddress)
      : undefined);
  if (!tokenAddress || tokenAddress === ethers.ZeroAddress) {
    throw new Error("Set ARC_USDC_ADDRESS or OPENRAILS_DEPLOYMENT_REGISTRY_PATH");
  }

  const payer = new ethers.Wallet(requireEnv("OPENRAILS_PAYER_PRIVATE_KEY"), ethers.provider);
  const relayer = new ethers.Wallet(requireEnv("OPENRAILS_RELAYER_PRIVATE_KEY"), ethers.provider);
  const recipient = requireAddress("OPENRAILS_RECIPIENT_ADDRESS");
  const claimRecipient = optionalAddress("OPENRAILS_CLAIM_RECIPIENT_ADDRESS") ?? recipient;
  const recovery = optionalAddress("OPENRAILS_RECOVERY_ADDRESS") ?? payer.address;

  const hub = await ethers.getContractAt("ArcOpenRailsHubV1", hubAddress, relayer);
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, ethers.provider);
  const tokenSymbol = await token.symbol().catch(() => "USDC");
  const relayerNative = await ethers.provider.getBalance(relayer.address);
  if (relayerNative === 0n) {
    throw new Error("OPENRAILS_RELAYER_PRIVATE_KEY has no native gas for testnet transactions");
  }
  const payerNative = await ethers.provider.getBalance(payer.address);
  if (payerNative === 0n) {
    throw new Error("OPENRAILS_PAYER_PRIVATE_KEY has no native gas for residual flush transactions");
  }

  const allocation = parseUnitsEnv("OPENRAILS_SMOKE_ALLOCATION_BASE_UNITS", 1_000_000n);
  const velocity = parseUnitsEnv("OPENRAILS_SMOKE_VELOCITY_BASE_UNITS", 1n);
  const lifespan = Number(env("OPENRAILS_SMOKE_LIFESPAN_SECONDS") ?? "3600");
  if (!Number.isInteger(lifespan) || lifespan <= 0) {
    throw new Error("OPENRAILS_SMOKE_LIFESPAN_SECONDS must be a positive integer");
  }

  const requiredAllocation = allocation * 2n;
  const balance = await token.balanceOf(payer.address);
  const allowance = await token.allowance(payer.address, hubAddress);
  if (balance < requiredAllocation) {
    throw new Error(
      `Payer ${payer.address} needs at least ${requiredAllocation} ${tokenSymbol} base units; balance=${balance}`,
    );
  }
  if (allowance < requiredAllocation) {
    throw new Error(
      `Payer ${payer.address} must approve ${hubAddress} for at least ${requiredAllocation} ${tokenSymbol} base units; allowance=${allowance}`,
    );
  }

  const client = new LeptonOpenRailsClient(
    payer.privateKey,
    hubAddress,
    actualChainId,
    ethers.provider,
  );
  const blockTimestamp = await latestTimestamp();

  async function buildIntent(
    mode: "railsflow" | "railscard_bearer",
    nonceChannel: bigint,
    signedRecipient: string,
    claimLabel: string,
  ): Promise<{ intent: OpenRailsIntentV1; token: string }> {
    const nonceValue = await hub.accountNonceTracks(payer.address, nonceChannel);
    const metadata: CanonicalMetadataV1 = {
      version: "openrails-metadata-v1",
      mode,
      originator: payer.address,
      recipient: mode === "railscard_bearer" ? ethers.ZeroAddress : signedRecipient,
      token: tokenAddress,
      amount: allocation.toString(),
      flowVelocityPerSecond: velocity.toString(),
      lifespanSeconds: lifespan,
      metadataRef: `testnet-smoke:${claimLabel}:${Date.now()}`,
    };
    const metadataHash = hashOpenRailsMetadata(metadata);
    const intent: OpenRailsIntentV1 = {
      paycardId: buildMetadataBoundPaycardId({
        payer: payer.address,
        nonceChannel,
        nonceValue,
        metadataHash,
        salt: `${claimLabel}:${network.name}`,
      }),
      metadataHash,
      recipient: mode === "railscard_bearer" ? ethers.ZeroAddress : signedRecipient,
      totalAllocationPool: allocation.toString(),
      flowVelocityPerSecond: velocity.toString(),
      genesisTimestamp: blockTimestamp,
      lifespanSeconds: lifespan,
      residualDeltaRecipient: recovery,
      nonceChannel: Number(nonceChannel),
      nonceValue: Number(nonceValue),
    };
    const token = await client.signPermissionEnvelope(intent, { metadata, mode });
    return { intent, token };
  }

  const flowChannel = BigInt(env("OPENRAILS_RAILSFLOW_NONCE_CHANNEL") ?? "1000");
  const cardChannel = BigInt(env("OPENRAILS_RAILSCARD_NONCE_CHANNEL") ?? "1001");
  const railsFlow = await buildIntent("railsflow", flowChannel, recipient, "railsflow");
  const railsCard = await buildIntent("railscard_bearer", cardChannel, ethers.ZeroAddress, "railscard");

  console.log(`Network: ${network.name} chain=${actualChainId}`);
  console.log(`Hub: ${hubAddress}`);
  console.log(`Token: ${tokenAddress}`);
  console.log(`Payer: ${payer.address}`);
  console.log(`Relayer: ${relayer.address}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Claim recipient: ${claimRecipient}`);

  await waitForTx(
    "RailsFlow open",
    await hub.openPaycardChannel(
      railsFlow.intent.paycardId,
      railsFlow.intent.metadataHash,
      railsFlow.intent.recipient,
      railsFlow.intent.totalAllocationPool,
      railsFlow.intent.flowVelocityPerSecond,
      railsFlow.intent.genesisTimestamp,
      railsFlow.intent.lifespanSeconds,
      railsFlow.intent.residualDeltaRecipient,
      LeptonOpenRailsClient.deserializePayload(railsFlow.token).envelopeSignature,
      railsFlow.intent.nonceChannel,
      railsFlow.intent.nonceValue,
    ),
  );
  await verifyActiveRow(hub, "RailsFlow", railsFlow.intent.paycardId, {
    payer: payer.address,
    recipient,
    metadataHash: railsFlow.intent.metadataHash,
  });
  await waitForTx("RailsFlow settle", await hub.processDripSettle(railsFlow.intent.paycardId));
  await waitForTx(
    "RailsFlow residual flush",
    await hub.connect(payer).flushResidualDelta(railsFlow.intent.paycardId),
  );

  await waitForTx(
    "RailsCard claim",
    await hub.claimWildcardPaycardChannel(
      railsCard.intent.paycardId,
      railsCard.intent.metadataHash,
      claimRecipient,
      railsCard.intent.totalAllocationPool,
      railsCard.intent.flowVelocityPerSecond,
      railsCard.intent.genesisTimestamp,
      railsCard.intent.lifespanSeconds,
      railsCard.intent.residualDeltaRecipient,
      LeptonOpenRailsClient.deserializePayload(railsCard.token).envelopeSignature,
      railsCard.intent.nonceChannel,
      railsCard.intent.nonceValue,
    ),
  );
  await verifyActiveRow(hub, "RailsCard", railsCard.intent.paycardId, {
    payer: payer.address,
    recipient: claimRecipient,
    metadataHash: railsCard.intent.metadataHash,
  });
  await waitForTx("RailsCard settle", await hub.processDripSettle(railsCard.intent.paycardId));
  await waitForTx(
    "RailsCard residual flush",
    await hub.connect(payer).flushResidualDelta(railsCard.intent.paycardId),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        chainId: actualChainId,
        hub: hubAddress,
        token: tokenAddress,
        railsFlowPaycardId: railsFlow.intent.paycardId,
        railsCardPaycardId: railsCard.intent.paycardId,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
