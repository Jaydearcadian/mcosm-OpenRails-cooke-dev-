/**
 * V2 testnet smoke — proves the deployed OpenRails V2 canonical clone works end-to-end on Arc.
 *
 * Exercises BOTH open paths against the new 12-arg ABI + EIP-712 domain version 2.0.0:
 *   1. EOA RailsFlow: openPaycardChannel (recipient-bound) -> processDripSettle -> flushResidualDelta
 *   2. Bearer RailsCard: claimWildcardPaycardChannel (recipient signed as 0, bound to a claimant)
 *      -> flushResidualDelta (reclaim residual to recovery)
 *
 * Run: npx hardhat run scripts/smoke-v2-testnet.ts --network arcTestnet
 * Reads the canonical hub from OPENRAILS_V2_HUB_ADDRESS or the deploy registry JSON.
 *
 * Arc note: USDC (0x3600) is the native gas token; transferFrom can't move a holder's ENTIRE
 * balance, so we over-fund (allocation << payer balance) and keep amounts tiny.
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const HUB_ABI = [
  "function openPaycardChannel(bytes32 paycardId, bytes32 metadataHash, address recipient, uint256 totalAllocationPool, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds, address residualDeltaRecipient, bytes envelopeSignature, uint256 nonceChannel, uint256 nonceValue, address payer)",
  "function claimWildcardPaycardChannel(bytes32 paycardId, bytes32 metadataHash, address claimRecipient, uint256 totalAllocationPool, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds, address residualDeltaRecipient, bytes envelopeSignature, uint256 nonceChannel, uint256 nonceValue, address payer)",
  "function processDripSettle(bytes32 paycardId)",
  "function flushResidualDelta(bytes32 paycardId)",
  "function accountNonceTracks(address account, uint256 channel) view returns (uint256)",
  "event PaycardProvisioned(bytes32 indexed paycardId, address indexed payer, address indexed recipient, bytes32 metadataHash, uint256 poolAllocation, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds)",
  "event SettlementFlushed(bytes32 indexed paycardId, address indexed recipient, uint256 amountWithdrawn)",
  "event ResidualDeltaReclaimed(bytes32 indexed paycardId, address indexed recoveryVault, uint256 varianceSwept)",
];
const USDC_ABI = [
  "function approve(address spender, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
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

function loadHubAddress(): string {
  if (process.env.OPENRAILS_V2_HUB_ADDRESS && ethers.isAddress(process.env.OPENRAILS_V2_HUB_ADDRESS)) {
    return ethers.getAddress(process.env.OPENRAILS_V2_HUB_ADDRESS);
  }
  const regPath = process.env.OPENRAILS_V2_REGISTRY_PATH
    || path.join("deployments", "openrails-v2-addresses.local.json");
  const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
  if (!reg.canonicalHub) throw new Error(`no canonicalHub in ${regPath}`);
  return ethers.getAddress(reg.canonicalHub);
}

const fmt = (v: bigint) => (Number(v) / 1e6).toFixed(6);
const explorer = process.env.ARC_EXPLORER_BASE_URL || "https://testnet.arcscan.app";
const txLink = (h: string) => `${explorer}/tx/${h}`;

async function main() {
  const hubAddr = loadHubAddress();
  const [deployer] = await ethers.getSigners();
  const payerAddr = await deployer.getAddress();
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  const usdcAddr = ethers.getAddress(process.env.ARC_USDC_ADDRESS || "0x3600000000000000000000000000000000000000");
  const recipient = ethers.getAddress(process.env.OPENRAILS_RECIPIENT_ADDRESS || ethers.Wallet.createRandom().address);
  const recovery = ethers.getAddress(process.env.OPENRAILS_RECOVERY_ADDRESS || payerAddr);
  const claimRecipient = ethers.getAddress(process.env.OPENRAILS_CLAIM_RECIPIENT_ADDRESS || ethers.Wallet.createRandom().address);

  const hub = new ethers.Contract(hubAddr, HUB_ABI, deployer);
  const usdc = new ethers.Contract(usdcAddr, USDC_ABI, deployer);

  const allocation = BigInt(process.env.OPENRAILS_SMOKE_ALLOCATION_BASE_UNITS || "10000"); // 0.01 USDC
  const velocity = 200n; // base units / sec — visible settle within a few seconds
  const lifespan = 120n;

  const domain = { name: "OpenRails Network", version: "2.0.0", chainId, verifyingContract: hubAddr };

  console.log(`V2 smoke on chainId ${chainId}`);
  console.log(`  hub (canonical clone): ${hubAddr}`);
  console.log(`  payer/deployer:        ${payerAddr}`);
  console.log(`  recipient:             ${recipient}`);
  console.log(`  claimRecipient:        ${claimRecipient}`);
  console.log(`  recovery:              ${recovery}`);

  const payerBal = await usdc.balanceOf(payerAddr);
  console.log(`  payer USDC balance:    ${fmt(payerBal)} USDC`);
  if (payerBal <= allocation * 3n) {
    throw new Error(`payer under-funded: need > ${fmt(allocation * 3n)} USDC (over-fund per Arc quirk), have ${fmt(payerBal)}`);
  }

  async function signIntent(msg: Record<string, unknown>): Promise<string> {
    return await deployer.signTypedData(domain, TYPES, msg);
  }
  const findEvent = (receipt: any, name: string) => {
    for (const log of receipt.logs) {
      try { const p = hub.interface.parseLog(log); if (p && p.name === name) return p; } catch { /* not ours */ }
    }
    return null;
  };

  // Ensure allowance covers both opens.
  const need = allocation * 2n;
  if ((await usdc.allowance(payerAddr, hubAddr)) < need) {
    console.log(`\n[approve] approving ${fmt(need)} USDC to hub...`);
    const a = await usdc.approve(hubAddr, need);
    await a.wait();
    console.log(`  approve tx: ${txLink(a.hash)}`);
  }

  // ---------------------------------------------------------------- 1) EOA RailsFlow
  console.log(`\n=== 1) EOA RailsFlow: open -> settle -> flush ===`);
  const ch1 = BigInt(process.env.OPENRAILS_RAILSFLOW_NONCE_CHANNEL || "200");
  const n1 = await hub.accountNonceTracks(payerAddr, ch1);
  const genesis1 = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) - 10n;
  const pid1 = ethers.keccak256(ethers.toUtf8Bytes(`v2-smoke-eoa-${Date.now()}`));
  const meta1 = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ v: "openrails-metadata-v1", mode: "railsflow", recipient })));
  const msg1 = {
    paycardId: pid1, metadataHash: meta1, recipient,
    totalAllocationPool: allocation.toString(), flowVelocityPerSecond: velocity.toString(),
    genesisTimestamp: genesis1.toString(), lifespanSeconds: lifespan.toString(),
    residualDeltaRecipient: recovery, nonceChannel: ch1.toString(), nonceValue: n1.toString(),
  };
  const sig1 = await signIntent(msg1);
  const recBefore = await usdc.balanceOf(recipient);
  const recovBefore = await usdc.balanceOf(recovery);

  const open1 = await hub.openPaycardChannel(pid1, meta1, recipient, allocation, velocity, genesis1, lifespan, recovery, sig1, ch1, n1, payerAddr);
  const open1r = await open1.wait();
  const prov1 = findEvent(open1r, "PaycardProvisioned");
  console.log(`  open  tx: ${txLink(open1.hash)}  ${prov1 ? "(PaycardProvisioned ✓)" : "(NO EVENT!)"}`);
  if (!prov1 || prov1.args.payer.toLowerCase() !== payerAddr.toLowerCase()) throw new Error("EOA open failed / payer mismatch");

  const settle1 = await hub.processDripSettle(pid1);
  const settle1r = await settle1.wait();
  const sf1 = findEvent(settle1r, "SettlementFlushed");
  console.log(`  settle tx: ${txLink(settle1.hash)}  settled=${sf1 ? fmt(sf1.args.amountWithdrawn) : "0.000000"} USDC to recipient`);

  const flush1 = await hub.flushResidualDelta(pid1);
  const flush1r = await flush1.wait();
  const rd1 = findEvent(flush1r, "ResidualDeltaReclaimed");
  console.log(`  flush  tx: ${txLink(flush1.hash)}  residual=${rd1 ? fmt(rd1.args.varianceSwept) : "0.000000"} USDC to recovery`);

  const recDelta = (await usdc.balanceOf(recipient)) - recBefore;
  const recovDelta = (await usdc.balanceOf(recovery)) - recovBefore;
  console.log(`  RESULT: recipient +${fmt(recDelta)}  recovery +${fmt(recovDelta)}  (sum should == allocation ${fmt(allocation)})`);

  // ---------------------------------------------------------------- 2) Bearer RailsCard
  console.log(`\n=== 2) Bearer RailsCard: claimWildcard -> flush ===`);
  const ch2 = BigInt(process.env.OPENRAILS_RAILSCARD_NONCE_CHANNEL || "201");
  const n2 = await hub.accountNonceTracks(payerAddr, ch2);
  const genesis2 = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) - 10n;
  const pid2 = ethers.keccak256(ethers.toUtf8Bytes(`v2-smoke-bearer-${Date.now()}`));
  const meta2 = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ v: "openrails-metadata-v1", mode: "railscard_bearer" })));
  // Bearer: recipient signed as address(0); bound to claimant at claim time.
  const msg2 = {
    paycardId: pid2, metadataHash: meta2, recipient: ethers.ZeroAddress,
    totalAllocationPool: allocation.toString(), flowVelocityPerSecond: velocity.toString(),
    genesisTimestamp: genesis2.toString(), lifespanSeconds: lifespan.toString(),
    residualDeltaRecipient: recovery, nonceChannel: ch2.toString(), nonceValue: n2.toString(),
  };
  const sig2 = await signIntent(msg2);
  const recov2Before = await usdc.balanceOf(recovery);

  const claim2 = await hub.claimWildcardPaycardChannel(pid2, meta2, claimRecipient, allocation, velocity, genesis2, lifespan, recovery, sig2, ch2, n2, payerAddr);
  const claim2r = await claim2.wait();
  const prov2 = findEvent(claim2r, "PaycardProvisioned");
  console.log(`  claim tx: ${txLink(claim2.hash)}  ${prov2 ? `(bound recipient=${prov2.args.recipient})` : "(NO EVENT!)"}`);
  if (!prov2 || prov2.args.recipient.toLowerCase() !== claimRecipient.toLowerCase()) throw new Error("bearer claim failed / recipient not bound to claimant");

  const flush2 = await hub.flushResidualDelta(pid2);
  const flush2r = await flush2.wait();
  const rd2 = findEvent(flush2r, "ResidualDeltaReclaimed");
  const sf2 = findEvent(flush2r, "SettlementFlushed");
  console.log(`  flush tx: ${txLink(flush2.hash)}  settled=${sf2 ? fmt(sf2.args.amountWithdrawn) : "0"} to claimant, residual=${rd2 ? fmt(rd2.args.varianceSwept) : "0"} to recovery`);
  console.log(`  recovery reclaimed +${fmt((await usdc.balanceOf(recovery)) - recov2Before)} USDC`);

  console.log(`\n✅ V2 smoke complete — both openPaycardChannel (EOA) and claimWildcardPaycardChannel (bearer) proven on Arc against domain 2.0.0 + 12-arg ABI.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
