import { ethers } from "hardhat";
import { depositToGateway, depositForToGateway, GATEWAY_WALLET_ADDRESS } from "../sdk/src/gateway";

async function main() {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log(`[E2E] Source wallet (signer): ${signerAddress}`);

  // 1. Generate a fresh throwaway wallet
  const freshWallet = ethers.Wallet.createRandom();
  console.log(`[E2E] Generated fresh wallet: ${freshWallet.address}`);
  console.log(`[E2E] Private key: ${freshWallet.privateKey}`);

  // 2. Deposit 0.05 USDC (50_000 micro-USDC) into Gateway wallet for the fresh wallet
  const amount = 50000n; // 0.05 USDC (6 decimals)
  console.log(`[E2E] Depositing ${amount} micro-USDC to Gateway for fresh wallet...`);

  const { txHash } = await depositForToGateway({
    signer,
    depositor: freshWallet.address,
    amountBaseUnits: amount,
    autoApprove: true,
  });

  console.log(`[E2E] Deposit transaction successful!`);
  console.log(`[E2E] Tx Hash: ${txHash}`);
  console.log(`[E2E] View on Explorer: https://testnet.arcscan.app/tx/${txHash}`);
  console.log(`[E2E] Note: Due to Circle Gateway's asynchronous batching design,`);
  console.log(`      the relayer will submit these funds in a batch (submitBatch) to the destination,`);
  console.log(`      which can take up to 10 minutes on Testnet before the funds are credited.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
