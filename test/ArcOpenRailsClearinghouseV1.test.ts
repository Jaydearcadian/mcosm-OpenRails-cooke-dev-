import { expect } from "chai";
import { ethers } from "hardhat";
import { OpenRailsArcClient, OpenRailsIntentV1 } from "../sdk/src/client";

describe("ArcOpenRailsClearinghouseV1", () => {
  let clearinghouse: any;
  let mockUsdc: any;
  let owner: any;
  let payer: any;
  let recipient: any;
  let recoveryVault: any;
  let relayer: any;
  let chainId: number;

  beforeEach(async () => {
    [owner, payer, recipient, recoveryVault, relayer] = await ethers.getSigners();

    // 1. Deploy Mock USDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUsdc = await MockUSDCFactory.deploy();
    await mockUsdc.waitForDeployment();

    // 2. Deploy Clearinghouse with Mock USDC address
    const ClearinghouseFactory = await ethers.getContractFactory("ArcOpenRailsClearinghouseV1");
    clearinghouse = await ClearinghouseFactory.deploy(await mockUsdc.getAddress());
    await clearinghouse.waitForDeployment();

    // 3. Mint USDC to Payer and Approve the Clearinghouse contract
    const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
    await mockUsdc.mint(payer.address, mintAmount);
    await mockUsdc.connect(payer).approve(await clearinghouse.getAddress(), mintAmount);

    const network = await ethers.provider.getNetwork();
    chainId = Number(network.chainId);
  });

  it("should successfully open a paycard channel using a valid EIP-712 signature from the SDK", async () => {
    // We instantiate the OpenRails SDK client with the payer's private key (mocked or private key generated)
    // Note: Ethers signer doesn't expose raw private key, but we can generate a temporary wallet for this test
    const tempWallet = ethers.Wallet.createRandom();
    const providerTempWallet = tempWallet.connect(ethers.provider);

    // Send some gas to temp wallet first (even though on Arc gas is USDC, on local Hardhat it's ETH)
    await owner.sendTransaction({
      to: tempWallet.address,
      value: ethers.parseEther("1.0"),
    });

    // Give tempWallet some USDC and approve clearinghouse
    await mockUsdc.mint(tempWallet.address, ethers.parseUnits("1000", 6));
    await mockUsdc.connect(providerTempWallet).approve(await clearinghouse.getAddress(), ethers.parseUnits("1000", 6));

    const client = new OpenRailsArcClient(
      tempWallet.privateKey,
      await clearinghouse.getAddress(),
      chainId
    );

    const paycardId = ethers.keccak256(ethers.toUtf8Bytes("paycard-test-1"));
    const totalAllocation = ethers.parseUnits("500", 6); // 500 USDC
    const velocity = ethers.parseUnits("2", 6); // 2 USDC per second
    const genesisTime = Math.floor(Date.now() / 1000) - 10; // 10 seconds ago
    const lifespan = 100; // 100 seconds

    const intent: OpenRailsIntentV1 = {
      paycardId,
      recipient: recipient.address,
      totalAllocationPool: totalAllocation.toString(),
      flowVelocityPerSecond: velocity.toString(),
      genesisTimestamp: genesisTime,
      lifespanSeconds: lifespan,
      residualDeltaRecipient: recoveryVault.address,
    };

    const envelopeToken = await client.signPermissionEnvelope(intent);
    const decoded = OpenRailsArcClient.deserializePayload(envelopeToken);

    // Call openPaycardChannel using the relayer signer
    await expect(
      clearinghouse.connect(relayer).openPaycardChannel(
        decoded.intent.paycardId,
        decoded.intent.recipient,
        decoded.intent.totalAllocationPool,
        decoded.intent.flowVelocityPerSecond,
        decoded.intent.genesisTimestamp,
        decoded.intent.lifespanSeconds,
        decoded.intent.residualDeltaRecipient,
        decoded.envelopeSignature
      )
    )
      .to.emit(clearinghouse, "PaycardProvisioned")
      .withArgs(paycardId, tempWallet.address, recipient.address, totalAllocation);

    // Check registry state
    const card = await clearinghouse.registry(paycardId);
    expect(card.payer).to.equal(tempWallet.address);
    expect(card.recipient).to.equal(recipient.address);
    expect(card.totalAllocationPool).to.equal(totalAllocation);
    expect(card.availableBalance).to.equal(totalAllocation);
    expect(card.operationalStatus).to.equal(0); // Active
  });

  it("should fail to open channel if paycardId is already in use (replay defense)", async () => {
    const tempWallet = ethers.Wallet.createRandom();
    const providerTempWallet = tempWallet.connect(ethers.provider);
    await owner.sendTransaction({ to: tempWallet.address, value: ethers.parseEther("1.0") });
    await mockUsdc.mint(tempWallet.address, ethers.parseUnits("1000", 6));
    await mockUsdc.connect(providerTempWallet).approve(await clearinghouse.getAddress(), ethers.parseUnits("1000", 6));

    const client = new OpenRailsArcClient(
      tempWallet.privateKey,
      await clearinghouse.getAddress(),
      chainId
    );

    const paycardId = ethers.keccak256(ethers.toUtf8Bytes("duplicate-id"));
    const intent: OpenRailsIntentV1 = {
      paycardId,
      recipient: recipient.address,
      totalAllocationPool: ethers.parseUnits("100", 6).toString(),
      flowVelocityPerSecond: ethers.parseUnits("1", 6).toString(),
      genesisTimestamp: Math.floor(Date.now() / 1000) - 10,
      lifespanSeconds: 100,
      residualDeltaRecipient: recoveryVault.address,
    };

    const envelopeToken = await client.signPermissionEnvelope(intent);
    const decoded = OpenRailsArcClient.deserializePayload(envelopeToken);

    // Open first time
    await clearinghouse.connect(relayer).openPaycardChannel(
      decoded.intent.paycardId,
      decoded.intent.recipient,
      decoded.intent.totalAllocationPool,
      decoded.intent.flowVelocityPerSecond,
      decoded.intent.genesisTimestamp,
      decoded.intent.lifespanSeconds,
      decoded.intent.residualDeltaRecipient,
      decoded.envelopeSignature
    );

    // Try opening again
    await expect(
      clearinghouse.connect(relayer).openPaycardChannel(
        decoded.intent.paycardId,
        decoded.intent.recipient,
        decoded.intent.totalAllocationPool,
        decoded.intent.flowVelocityPerSecond,
        decoded.intent.genesisTimestamp,
        decoded.intent.lifespanSeconds,
        decoded.intent.residualDeltaRecipient,
        decoded.envelopeSignature
      )
    ).to.be.revertedWithCustomError(clearinghouse, "CryptographicCollision");
  });

  it("should correctly process time-based linear drips", async () => {
    const tempWallet = ethers.Wallet.createRandom();
    const providerTempWallet = tempWallet.connect(ethers.provider);
    await owner.sendTransaction({ to: tempWallet.address, value: ethers.parseEther("1.0") });
    await mockUsdc.mint(tempWallet.address, ethers.parseUnits("1000", 6));
    await mockUsdc.connect(providerTempWallet).approve(await clearinghouse.getAddress(), ethers.parseUnits("1000", 6));

    const client = new OpenRailsArcClient(
      tempWallet.privateKey,
      await clearinghouse.getAddress(),
      chainId
    );

    const paycardId = ethers.keccak256(ethers.toUtf8Bytes("drip-id"));
    const totalAllocation = ethers.parseUnits("100", 6); // 100 USDC
    const velocity = ethers.parseUnits("2", 6); // 2 USDC per second
    const genesisTime = Math.floor(Date.now() / 1000);
    const lifespan = 200; // 200 seconds

    const intent: OpenRailsIntentV1 = {
      paycardId,
      recipient: recipient.address,
      totalAllocationPool: totalAllocation.toString(),
      flowVelocityPerSecond: velocity.toString(),
      genesisTimestamp: genesisTime,
      lifespanSeconds: lifespan,
      residualDeltaRecipient: recoveryVault.address,
    };

    const envelopeToken = await client.signPermissionEnvelope(intent);
    const decoded = OpenRailsArcClient.deserializePayload(envelopeToken);

    await clearinghouse.connect(relayer).openPaycardChannel(
      decoded.intent.paycardId,
      decoded.intent.recipient,
      decoded.intent.totalAllocationPool,
      decoded.intent.flowVelocityPerSecond,
      decoded.intent.genesisTimestamp,
      decoded.intent.lifespanSeconds,
      decoded.intent.residualDeltaRecipient,
      decoded.envelopeSignature
    );

    // Fast-forward 10 seconds
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);

    // Process drip settle
    const initialRecipientBalance = await mockUsdc.balanceOf(recipient.address);
    
    const tx = await clearinghouse.connect(relayer).processDripSettle(paycardId);
    const receipt = await tx.wait();

    // Verify recipient balance increased (2 USDC/sec * elapsed_time)
    const finalRecipientBalance = await mockUsdc.balanceOf(recipient.address);
    const difference = finalRecipientBalance - initialRecipientBalance;

    // It should be at least 20 USDC (10 seconds * 2 USDC/second)
    expect(difference).to.be.greaterThanOrEqual(ethers.parseUnits("20", 6));

    // Verify card balance decreased
    const card = await clearinghouse.registry(paycardId);
    expect(card.availableBalance).to.be.lessThanOrEqual(totalAllocation - difference);
  });

  it("should flush residual delta and return buffer back to the recovery vault", async () => {
    const tempWallet = ethers.Wallet.createRandom();
    const providerTempWallet = tempWallet.connect(ethers.provider);
    await owner.sendTransaction({ to: tempWallet.address, value: ethers.parseEther("1.0") });
    await mockUsdc.mint(tempWallet.address, ethers.parseUnits("1000", 6));
    await mockUsdc.connect(providerTempWallet).approve(await clearinghouse.getAddress(), ethers.parseUnits("1000", 6));

    const client = new OpenRailsArcClient(
      tempWallet.privateKey,
      await clearinghouse.getAddress(),
      chainId
    );

    const paycardId = ethers.keccak256(ethers.toUtf8Bytes("stn-delta-id"));
    const totalAllocation = ethers.parseUnits("500", 6); // 500 USDC
    const velocity = ethers.parseUnits("10", 6); // 10 USDC per second
    const genesisTime = Math.floor(Date.now() / 1000);
    const lifespan = 100;

    const intent: OpenRailsIntentV1 = {
      paycardId,
      recipient: recipient.address,
      totalAllocationPool: totalAllocation.toString(),
      flowVelocityPerSecond: velocity.toString(),
      genesisTimestamp: genesisTime,
      lifespanSeconds: lifespan,
      residualDeltaRecipient: recoveryVault.address,
    };

    const envelopeToken = await client.signPermissionEnvelope(intent);
    const decoded = OpenRailsArcClient.deserializePayload(envelopeToken);

    await clearinghouse.connect(relayer).openPaycardChannel(
      decoded.intent.paycardId,
      decoded.intent.recipient,
      decoded.intent.totalAllocationPool,
      decoded.intent.flowVelocityPerSecond,
      decoded.intent.genesisTimestamp,
      decoded.intent.lifespanSeconds,
      decoded.intent.residualDeltaRecipient,
      decoded.envelopeSignature
    );

    // Fast-forward 10 seconds and process drip
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    await clearinghouse.connect(relayer).processDripSettle(paycardId);

    // Flush residual delta. Can be triggered by payer (tempWallet) or recipient.
    // We will trigger it using tempWallet (connected to provider)
    const cardBefore = await clearinghouse.registry(paycardId);
    const remainingBalance = cardBefore.availableBalance;
    expect(remainingBalance).to.be.greaterThan(0n);

    const initialVaultBalance = await mockUsdc.balanceOf(recoveryVault.address);

    // Send transactions using tempWallet. Ethers requires signer to sign and send, 
    // so we can trigger using recipient address (which is also allowed to call flushResidualDelta)
    await expect(clearinghouse.connect(recipient).flushResidualDelta(paycardId))
      .to.emit(clearinghouse, "ResidualDeltaReclaimed")
      .withArgs(paycardId, recoveryVault.address, remainingBalance);

    const finalVaultBalance = await mockUsdc.balanceOf(recoveryVault.address);
    expect(finalVaultBalance - initialVaultBalance).to.equal(remainingBalance);

    const cardAfter = await clearinghouse.registry(paycardId);
    expect(cardAfter.availableBalance).to.equal(0n);
    expect(cardAfter.operationalStatus).to.equal(1); // Terminated
  });
});
