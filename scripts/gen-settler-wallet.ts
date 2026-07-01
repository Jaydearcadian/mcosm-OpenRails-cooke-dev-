/**
 * Generate the settler keeper wallet used by the reconciliation-worker.
 *
 * Writes the key to the gitignored .bot-wallets/settler.json (mode 0600) and prints ONLY the
 * address, for funding with Arc testnet gas (native USDC). Idempotent — never overwrites an
 * existing key. The private key is never printed or committed.
 *
 *   npm run settler:wallet
 */
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const dir = path.join(process.cwd(), ".bot-wallets");
const file = path.join(dir, "settler.json");

function main(): void {
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file)) {
    const existing = JSON.parse(fs.readFileSync(file, "utf8"));
    console.log(`Settler wallet already exists.\n  address: ${existing.address}`);
    return;
  }
  const w = ethers.Wallet.createRandom();
  fs.writeFileSync(file, JSON.stringify({ address: w.address, privateKey: w.privateKey }, null, 2), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  console.log("Settler keeper wallet generated (key in gitignored .bot-wallets/settler.json).");
  console.log(`  address: ${w.address}`);
  console.log("Fund it with Arc testnet gas (native USDC), then set the worker secret from it.");
}

main();
