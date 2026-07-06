import { expect } from "chai";
import { ethers, network } from "hardhat";
import { depositToGateway, GATEWAY_WALLET_ADDRESS, ARC_USDC_ADDRESS } from "../sdk/src/gateway";

describe("GatewayWallet deposit", function () {
  it("submits a deposit transaction to the real GatewayWallet contract and returns a txHash", async () => {
    // Only run this test on arcTestnet
    if (network.name !== "arcTestnet") {
      console.log("Skipping Gateway integration test on non-arcTestnet network.");
      return;
    }

    const [signer] = await ethers.getSigners();
    const address = await signer.getAddress();
    console.log(`[Test] Using signer: ${address}`);

    // We deposit 0.01 USDC (10_000 base units in 6 decimals)
    const amount = 10000n;

    console.log(`[Test] Depositing ${amount} micro-USDC to Circle Gateway...`);
    const { txHash } = await depositToGateway({
      signer,
      amountBaseUnits: amount,
      autoApprove: true,
    });

    console.log(`[Test] Deposit txHash: ${txHash}`);
    expect(txHash).to.have.lengthOf(66);
    expect(txHash).to.match(/^0x[a-fA-F0-9]{64}$/);

    // Wait for the transaction receipt
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    expect(receipt).to.not.be.null;
    expect(receipt!.status).to.equal(1);
    console.log("[Test] Deposit transaction succeeded!");
  });
});
