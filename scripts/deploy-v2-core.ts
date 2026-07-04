import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const usdc = process.env.ARC_USDC_ADDRESS;
  if (!usdc || !ethers.isAddress(usdc)) {
    throw new Error("ARC_USDC_ADDRESS must be a valid token address");
  }
  const [deployer] = await ethers.getSigners();
  const governance = process.env.OPENRAILS_V2_GOVERNANCE || (await deployer.getAddress());

  // 1. Master logic (sealed by its own constructor).
  const Master = await ethers.getContractFactory("ArcOpenRailsHubV2Initializable", deployer);
  const master = await Master.deploy();
  await master.waitForDeployment();
  const masterAddr = await master.getAddress();

  // 2. Factory pointed at the master.
  const Factory = await ethers.getContractFactory("ArcOpenRailsFactoryV1", deployer);
  const factory = await Factory.deploy(masterAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();

  // 3. Canonical default clone, owned by governance.
  //    deployCorporateVault initializes owner = msg.sender, so call from governance.
  const govSigner = governance === (await deployer.getAddress())
    ? deployer
    : await ethers.getSigner(governance);
  const tx = await (factory.connect(govSigner) as any).deployCorporateVault(usdc);
  const receipt = await tx.wait();
  const ev = receipt.logs.find((l: any) => l.fragment && l.fragment.name === "CorporateVaultDeployed");
  if (!ev) throw new Error("CorporateVaultDeployed not emitted");
  const canonicalHub = ev.args.vaultAddress as string;

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const out = { chainId, masterLogic: masterAddr, factory: factoryAddr, canonicalHub, usdc };
  const outPath = process.env.OPENRAILS_V2_REGISTRY_PATH
    || path.join("deployments", "openrails-v2-addresses.local.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("OpenRails V2 core deployed:", out);
  console.log("Registry written to", outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
