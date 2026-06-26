import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("ArcOpenRailsFactoryV1 & Minimal Proxy Clones E2E", function () {
  let deployer: Signer;
  let payer: Signer;
  let recipient: Signer;
  let recovery: Signer;
  let randomUser: Signer;

  let mockUSDC: any;
  let masterLogic: any;
  let factory: any;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    payer = signers[1];
    recipient = signers[2];
    recovery = signers[3];
    randomUser = signers[4];

    // 1. Deploy Mock clearing token (USDC)
    const MockUSDC = await ethers.getContractFactory("MockUSDC", deployer);
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // 2. Deploy Master Logic implementation
    const HubLogic = await ethers.getContractFactory("ArcOpenRailsHubV2Initializable", deployer);
    masterLogic = await HubLogic.deploy();
    await masterLogic.waitForDeployment();

    // 3. Deploy Factory
    const Factory = await ethers.getContractFactory("ArcOpenRailsFactoryV1", deployer);
    factory = await Factory.deploy(await masterLogic.getAddress());
    await factory.waitForDeployment();
  });

  it("should deploy a clone and initialize it with distinct state", async function () {
    const tokenAddress = await mockUSDC.getAddress();
    const payerAddress = await payer.getAddress();

    // Deploy clone 1 for Payer (as owner)
    const tx = await factory.connect(payer).deployCorporateVault(tokenAddress);
    const receipt = await tx.wait();

    // Find CorporateVaultDeployed event
    const event = receipt.logs.find(
      (log: any) => log.fragment && log.fragment.name === "CorporateVaultDeployed"
    );
    expect(event).to.not.be.undefined;
    const clone1Address = event.args.vaultAddress;

    // Attach to clone
    const clone1 = await ethers.getContractAt(
      "ArcOpenRailsHubV2Initializable",
      clone1Address
    );

    // Verify initialization
    expect(await clone1.owner()).to.equal(payerAddress);
    expect(await clone1.arcUsdc()).to.equal(tokenAddress);

    // Deploy clone 2 for Deployer (as owner) with different settings
    const tx2 = await factory.connect(deployer).deployCorporateVault(tokenAddress);
    const receipt2 = await tx2.wait();
    const event2 = receipt2.logs.find(
      (log: any) => log.fragment && log.fragment.name === "CorporateVaultDeployed"
    );
    const clone2Address = event2.args.vaultAddress;
    const clone2 = await ethers.getContractAt(
      "ArcOpenRailsHubV2Initializable",
      clone2Address
    );

    // Verify storage isolation between clones
    expect(await clone2.owner()).to.equal(await deployer.getAddress());
    expect(await clone1.owner()).to.equal(payerAddress); // Clone 1 remains unchanged

    // Master logic should remain sealed (initialized to true in constructor)
    await expect(
      masterLogic.initialize(tokenAddress, payerAddress)
    ).to.be.revertedWith("Contract already initialized");
  });

  it("should support openPaycardChannel on clones via EIP-712 signatures", async function () {
    const tokenAddress = await mockUSDC.getAddress();
    const payerAddress = await payer.getAddress();
    const recipientAddress = await recipient.getAddress();
    const recoveryAddress = await recovery.getAddress();

    // Deploy and initialize proxy clone
    const tx = await factory.connect(payer).deployCorporateVault(tokenAddress);
    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (log: any) => log.fragment && log.fragment.name === "CorporateVaultDeployed"
    );
    const cloneAddress = event.args.vaultAddress;
    const clone = await ethers.getContractAt(
      "ArcOpenRailsHubV2Initializable",
      cloneAddress
    );

    // Mint USDC to payer and approve clone
    const allocation = ethers.parseUnits("100", 6); // 100 USDC
    await mockUSDC.mint(payerAddress, allocation);
    await mockUSDC.connect(payer).approve(cloneAddress, allocation);

    // Setup signature parameters
    const paycardId = ethers.keccak256(ethers.toUtf8Bytes("paycard-test-123"));
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("invoice-terms-hash"));
    const flowVelocity = 1n; // 1 token per second
    const genesisTimestamp = Math.floor(Date.now() / 1000) - 100;
    const lifespanSeconds = 3600;
    const nonceChannel = 100n;
    const nonceValue = 0n;

    // Define typed data for signing
    const domain = {
      name: "OpenRails Network",
      version: "1.0.0",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: cloneAddress, // Must verify against the clone proxy address!
    };

    const types = {
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

    const message = {
      paycardId,
      metadataHash,
      recipient: recipientAddress,
      totalAllocationPool: allocation.toString(),
      flowVelocityPerSecond: flowVelocity.toString(),
      genesisTimestamp,
      lifespanSeconds,
      residualDeltaRecipient: recoveryAddress,
      nonceChannel: nonceChannel.toString(),
      nonceValue: nonceValue.toString(),
    };

    // Sign Typed Data (EIP-712)
    const signature = await (payer as any).signTypedData(domain, types, message);

    // Submit transaction to open paycard channel via the proxy vault clone
    await expect(
      (clone.connect(randomUser) as any).openPaycardChannel(
        paycardId,
        metadataHash,
        recipientAddress,
        allocation,
        flowVelocity,
        genesisTimestamp,
        lifespanSeconds,
        recoveryAddress,
        signature,
        nonceChannel,
        nonceValue
      )
    ).to.emit(clone, "PaycardProvisioned");

    // Verify channel values stored in clone's registry storage
    const card = await clone.registry(paycardId);
    expect(card.payer).to.equal(payerAddress);
    expect(card.recipient).to.equal(recipientAddress);
    expect(card.totalAllocationPool).to.equal(allocation);
    expect(card.availableBalance).to.equal(allocation);

    // Verify token balance is successfully escrowed inside the clone contract address
    expect(await mockUSDC.balanceOf(cloneAddress)).to.equal(allocation);
  });
});
