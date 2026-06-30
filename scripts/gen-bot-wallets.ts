/**
 * Generate a fleet of bot wallets for traction simulation.
 *
 * Keys are written to `.bot-wallets/wallets.json` (gitignored, mode 0600) and are
 * NEVER printed. Only addresses are printed — fund them from the Circle faucet
 * (https://faucet.circle.com) with Arc testnet USDC + a little native gas.
 *
 *   BOT_WALLET_COUNT=13 npm run bots:wallets
 */
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

interface BotWallet {
  index: number;
  address: string;
  privateKey: string;
}

const N = Number(process.env.BOT_WALLET_COUNT || "13");
const dir = path.join(__dirname, "..", ".bot-wallets");
const file = path.join(dir, "wallets.json");

function load(): BotWallet[] {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as BotWallet[];
  } catch {
    return [];
  }
}

function printAddresses(wallets: BotWallet[]): void {
  console.log(
    "\nFund these from the Circle faucet (https://faucet.circle.com) — Arc testnet USDC + a little gas:\n",
  );
  for (const w of wallets) console.log(`${String(w.index + 1).padStart(2)}. ${w.address}`);
  console.log("\nPrivate keys live only in the gitignored file. Never commit or share them.");
}

function main(): void {
  fs.mkdirSync(dir, { recursive: true });
  const wallets = load();

  if (wallets.length >= N) {
    console.log(`Already have ${wallets.length} bot wallets in ${file} (gitignored).`);
    printAddresses(wallets.slice(0, N));
    return;
  }

  for (let i = wallets.length; i < N; i += 1) {
    const w = ethers.Wallet.createRandom();
    wallets.push({ index: i, address: w.address, privateKey: w.privateKey });
  }
  fs.writeFileSync(file, JSON.stringify(wallets, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* best effort */
  }
  console.log(`Generated ${N} bot wallets → ${file} (gitignored; keys not printed).`);
  printAddresses(wallets);
}

main();
