/**
 * Indexer composite-key collision smoke — proves workers/indexer-worker keys paycard state by
 * (vaultAddress, paycardId), not paycardId alone.
 *
 * buildMetadataBoundPaycardId() (sdk/src/metadata.ts) does not bind the vault/hub address, so the
 * same paycardId bytes32 can legitimately exist as unrelated rows on two different factory-cloned
 * vaults. This script deploys two throwaway vault clones via the already-live
 * ArcOpenRailsFactoryV1 (deployCorporateVault has no access control) and opens a paycard with the
 * SAME explicit paycardId on each — after running the indexer's /tick, both should appear as two
 * distinct idx_paycard_state rows, and /streams/:vaultAddress/:paycardId/history must return the
 * correct, non-merged data for each.
 *
 * Run: npx hardhat run scripts/smoke-indexer-collision.ts --network arcTestnet
 */
import { ethers } from "hardhat";

const FACTORY_ABI = [
  "function deployCorporateVault(address _token) external returns (address cloneAddress)",
  "event CorporateVaultDeployed(address indexed vaultAddress, address indexed owner, address token)",
];
const HUB_ABI = [
  "function openPaycardChannel(bytes32 paycardId, bytes32 metadataHash, address recipient, uint256 totalAllocationPool, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds, address residualDeltaRecipient, bytes envelopeSignature, uint256 nonceChannel, uint256 nonceValue, address payer)",
  "function accountNonceTracks(address account, uint256 channel) view returns (uint256)",
  "event PaycardProvisioned(bytes32 indexed paycardId, address indexed payer, address indexed recipient, bytes32 metadataHash, uint256 poolAllocation, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds)",
];
const USDC_ABI = [
  "function approve(address spender, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

const TYPES = {
  SettlementIntent: [
    { name: "paycardId", type: "bytes32" },
    { name: "metadataHash", type: "bytes32" },
    { name: "recipient", type: "address" },
    { name: "totalAllocationPool", type: "uint256" },
    { name: "flowVelocityPerSecond", type: "uint256" },
    { name: "genesisTimestamp", type: "uint256" },
    { name: "lifespanSeconds", type: "uint256" },
    { name: "residualDeltaRecipient", type: "address" },
    { name: "nonceChannel", type: "uint256" },
    { name: "nonceValue", type: "uint256" },
  ],
};

async function main() {
  const factoryAddr = ethers.getAddress(process.env.OPENRAILS_V2_FACTORY_ADDRESS || "0xf85c20858Bac4f9C67a53e4e7a8F31025D07Bc93");
  const usdcAddr = ethers.getAddress(process.env.ARC_USDC_ADDRESS || "0x3600000000000000000000000000000000000000");
  const [deployer] = await ethers.getSigners();
  const payerAddr = await deployer.getAddress();
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, deployer);
  const usdc = new ethers.Contract(usdcAddr, USDC_ABI, deployer);

  console.log(`Indexer collision smoke on chainId ${chainId}`);
  console.log(`  factory: ${factoryAddr}`);
  console.log(`  payer:   ${payerAddr}`);

  const payerBal = await usdc.balanceOf(payerAddr);
  console.log(`  payer USDC balance: ${(Number(payerBal) / 1e6).toFixed(6)} USDC`);

  async function deployVault(label: string): Promise<string> {
    const tx = await factory.deployCorporateVault(usdcAddr);
    const receipt = await tx.wait();
    let vaultAddr: string | undefined;
    for (const log of receipt.logs) {
      try {
        const parsed = factory.interface.parseLog(log);
        if (parsed?.name === "CorporateVaultDeployed") {
          vaultAddr = parsed.args.vaultAddress as string;
        }
      } catch {
        /* not ours */
      }
    }
    if (!vaultAddr) throw new Error(`${label}: no CorporateVaultDeployed event found`);
    console.log(`  ${label} deployed: ${vaultAddr}  (tx ${tx.hash})`);
    return ethers.getAddress(vaultAddr);
  }

  const vaultA = await deployVault("vaultA");
  const vaultB = await deployVault("vaultB");

  // Deliberately identical across both vaults so paycardId collides.
  const sharedPaycardId = ethers.keccak256(ethers.toUtf8Bytes(`indexer-collision-${Date.now()}`));
  const recipient = ethers.getAddress(process.env.OPENRAILS_RECIPIENT_ADDRESS || ethers.Wallet.createRandom().address);
  const recovery = payerAddr;
  const allocation = 5000n; // 0.005 USDC
  const velocity = 0n; // instant
  const lifespan = 0n; // instant
  const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ v: "openrails-metadata-v1", mode: "indexer-collision-smoke" })));

  async function openOnVault(vaultAddr: string, label: string) {
    const hub = new ethers.Contract(vaultAddr, HUB_ABI, deployer);
    const need = allocation;
    console.log(`\n[${label}] approving ${(Number(need) / 1e6).toFixed(6)} USDC to ${vaultAddr}...`);
    const approveTx = await usdc.approve(vaultAddr, need);
    await approveTx.wait();

    const nonceChannel = 999n; // dedicated lane for this smoke, fresh on both brand-new vaults
    const nonceValue = await hub.accountNonceTracks(payerAddr, nonceChannel);
    const genesis = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) - 5n;

    const domain = { name: "OpenRails Network", version: "2.0.0", chainId, verifyingContract: vaultAddr };
    const msg = {
      paycardId: sharedPaycardId,
      metadataHash,
      recipient,
      totalAllocationPool: allocation.toString(),
      flowVelocityPerSecond: velocity.toString(),
      genesisTimestamp: genesis.toString(),
      lifespanSeconds: lifespan.toString(),
      residualDeltaRecipient: recovery,
      nonceChannel: nonceChannel.toString(),
      nonceValue: nonceValue.toString(),
    };
    const sig = await deployer.signTypedData(domain, TYPES, msg);

    const open = await hub.openPaycardChannel(
      sharedPaycardId, metadataHash, recipient, allocation, velocity, genesis, lifespan, recovery, sig, nonceChannel, nonceValue, payerAddr
    );
    const receipt = await open.wait();
    let ok = false;
    for (const log of receipt.logs) {
      try {
        const parsed = hub.interface.parseLog(log);
        if (parsed?.name === "PaycardProvisioned") ok = true;
      } catch {
        /* not ours */
      }
    }
    console.log(`[${label}] open tx: ${open.hash}  ${ok ? "(PaycardProvisioned ✓)" : "(NO EVENT!)"}`);
    if (!ok) throw new Error(`${label}: open did not emit PaycardProvisioned`);
  }

  await openOnVault(vaultA, "vaultA");
  await openOnVault(vaultB, "vaultB");

  console.log(`\n✅ Collision fixture ready.`);
  console.log(`   vaultA:       ${vaultA}`);
  console.log(`   vaultB:       ${vaultB}`);
  console.log(`   paycardId:    ${sharedPaycardId}`);
  console.log(`\nNext: run the indexer worker's POST /tick, then confirm both`);
  console.log(`  GET /streams/${vaultA}/${sharedPaycardId}/history`);
  console.log(`  GET /streams/${vaultB}/${sharedPaycardId}/history`);
  console.log(`return distinct, correct state (not merged/overwritten).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
