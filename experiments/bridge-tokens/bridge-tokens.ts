import { BridgeKit } from '@circle-fin/bridge-kit';
import { createViemAdapter } from '@circle-fin/adapter-viem-v2';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import dotenv from 'dotenv';
import path from 'path';

// Load environmental variables from root .env
dotenv.config({ path: path.join(import.meta.dirname, '../../.env') });

const PRIVATE_KEY = process.env.OPENRAILS_PAYER_PRIVATE_KEY;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

async function main() {
  if (!PRIVATE_KEY) {
    console.error('Error: OPENRAILS_PAYER_PRIVATE_KEY is not defined in your environment or .env file.');
    process.exit(1);
  }

  // Ensure key format is 0x prefixed for viem
  const formattedKey = PRIVATE_KEY.startsWith('0x') ? (PRIVATE_KEY as `0x${string}`) : (`0x${PRIVATE_KEY}` as `0x${string}`);
  const account = privateKeyToAccount(formattedKey);

  console.log(`Setting up Bridge Client for Payer address: ${account.address}`);

  // 1. Instantiate the Source Chain Wallet Client (Sepolia EVM example)
  const sourceWalletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(SEPOLIA_RPC_URL),
  });

  // 2. Initialize the Viem Adapter for the Bridge Kit
  const viemAdapter = createViemAdapter({
    // Passes the client to handle transaction signing on EVM chains
    client: sourceWalletClient,
  });

  // 3. Initialize the Bridge Kit
  const kit = new BridgeKit();

  console.log('Initiating Circle CCTP bridge transaction...');
  console.log('From: Ethereum_Sepolia (EVM Source)');
  console.log('To: Arc_Testnet (EVM Target)');
  console.log('Amount: 1.00 USDC');

  try {
    // 4. Trigger the Cross-Chain transfer
    const result = await kit.bridge({
      from: {
        adapter: viemAdapter,
        chain: 'Sepolia', // CCTP EVM Source Name
      },
      to: {
        adapter: viemAdapter,
        chain: 'Arc_Testnet', // CCTP EVM Target Name
      },
      amount: '1.00', // Amount in USDC
    });

    console.log('Bridge execution initiated successfully!');
    console.log('CCTP Transaction Details:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Bridge transaction failed:', error);
  }
}

main();
