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
        nonceValue,
        payerAddress            // <-- new trailing arg
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

  it("rejects an open where the claimed payer does not match the signer", async function () {
    const tokenAddress = await mockUSDC.getAddress();
    const payerAddress = await payer.getAddress();
    const recipientAddress = await recipient.getAddress();
    const recoveryAddress = await recovery.getAddress();

    const tx = await factory.connect(payer).deployCorporateVault(tokenAddress);
    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (log: any) => log.fragment && log.fragment.name === "CorporateVaultDeployed"
    );
    const cloneAddress = event.args.vaultAddress;
    const clone = await ethers.getContractAt("ArcOpenRailsHubV2Initializable", cloneAddress);

    const allocation = ethers.parseUnits("100", 6);
    await mockUSDC.mint(payerAddress, allocation);
    await mockUSDC.connect(payer).approve(cloneAddress, allocation);

    const paycardId = ethers.keccak256(ethers.toUtf8Bytes("paycard-mismatch"));
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("terms"));
    const genesisTimestamp = Math.floor(Date.now() / 1000) - 100;

    const domain = {
      name: "OpenRails Network",
      version: "1.0.0",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: cloneAddress,
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
      flowVelocityPerSecond: "1",
      genesisTimestamp,
      lifespanSeconds: 3600,
      residualDeltaRecipient: recoveryAddress,
      nonceChannel: "100",
      nonceValue: "0",
    };
    // Signed by `payer`, but we claim `recipient` is the payer -> must revert.
    const signature = await (payer as any).signTypedData(domain, types, message);
    await expect(
      (clone.connect(randomUser) as any).openPaycardChannel(
        paycardId, metadataHash, recipientAddress, allocation, 1,
        genesisTimestamp, 3600, recoveryAddress, signature, 100, 0,
        recipientAddress /* wrong payer */
      )
    ).to.be.revertedWithCustomError(clone, "AccessViolation");
  });

  it("accepts an EIP-1271 smart-account open and rejects a forged one", async function () {
    const tokenAddress = await mockUSDC.getAddress();
    const recipientAddress = await recipient.getAddress();
    const recoveryAddress = await recovery.getAddress();
    const ownerEoa = payer; // controls the mock account

    // Deploy the mock 1271 account owned by ownerEoa.
    const Mock = await ethers.getContractFactory("MockERC1271Account", deployer);
    const smartAccount = await Mock.deploy(await ownerEoa.getAddress());
    await smartAccount.waitForDeployment();
    const smartAddr = await smartAccount.getAddress();

    // Deploy a clone and fund the SMART ACCOUNT (it is the payer).
    const tx = await factory.connect(deployer).deployCorporateVault(tokenAddress);
    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (log: any) => log.fragment && log.fragment.name === "CorporateVaultDeployed"
    );
    const cloneAddress = event.args.vaultAddress;
    const clone = await ethers.getContractAt("ArcOpenRailsHubV2Initializable", cloneAddress);

    const allocation = ethers.parseUnits("100", 6);
    await mockUSDC.mint(smartAddr, allocation);
    // The smart account has no code to call approve() itself in this fixture, so mint
    // to it and use MockUSDC's owner-free approve path: impersonate the account.
    await ethers.provider.send("hardhat_impersonateAccount", [smartAddr]);
    // MockERC1271Account has no receive/fallback, so fund it directly via the
    // Hardhat RPC (a plain ETH transfer would revert hitting its unrecognized selector).
    await ethers.provider.send("hardhat_setBalance", [
      smartAddr,
      "0x" + ethers.parseEther("1").toString(16),
    ]);
    const saSigner = await ethers.getSigner(smartAddr);
    await mockUSDC.connect(saSigner).approve(cloneAddress, allocation);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [smartAddr]);

    const paycardId = ethers.keccak256(ethers.toUtf8Bytes("paycard-1271"));
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("terms-1271"));
    const genesisTimestamp = Math.floor(Date.now() / 1000) - 100;
    const domain = {
      name: "OpenRails Network",
      version: "1.0.0",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: cloneAddress,
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
      paycardId, metadataHash, recipient: recipientAddress,
      totalAllocationPool: allocation.toString(), flowVelocityPerSecond: "1",
      genesisTimestamp, lifespanSeconds: 3600, residualDeltaRecipient: recoveryAddress,
      nonceChannel: "100", nonceValue: "0",
    };

    // Valid: owner signs, payer = smart account.
    const goodSig = await (ownerEoa as any).signTypedData(domain, types, message);
    await expect(
      (clone.connect(randomUser) as any).openPaycardChannel(
        paycardId, metadataHash, recipientAddress, allocation, 1,
        genesisTimestamp, 3600, recoveryAddress, goodSig, 100, 0, smartAddr
      )
    ).to.emit(clone, "PaycardProvisioned");
    expect((await clone.registry(paycardId)).payer).to.equal(smartAddr);

    // Forged: a non-owner signs the SAME intent (same nonce) -> mock returns 0xffffffff -> revert.
    const forgedSig = await (recipient as any).signTypedData(domain, types, {
      ...message,
      paycardId: ethers.keccak256(ethers.toUtf8Bytes("paycard-1271-forged")),
      nonceValue: "1",
    });
    await expect(
      (clone.connect(randomUser) as any).openPaycardChannel(
        ethers.keccak256(ethers.toUtf8Bytes("paycard-1271-forged")),
        metadataHash, recipientAddress, allocation, 1,
        genesisTimestamp, 3600, recoveryAddress, forgedSig, 100, 1, smartAddr
      )
    ).to.be.revertedWithCustomError(clone, "AccessViolation");
  });
});
