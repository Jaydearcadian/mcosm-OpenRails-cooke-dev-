import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { OpenRailsArcClient } from "../sdk/src/client";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const PROVIDER_URL = process.env.PROVIDER_URL || "http://127.0.0.1:8545";

// Globals to store contract instances and addresses
let provider: ethers.JsonRpcProvider;
let relayerWallet: ethers.Wallet;
let clearinghouseContract: ethers.Contract;
let usdcContract: ethers.Contract;

let clearinghouseAddress = "";
let usdcAddress = "";
let chainId = 31337;

// Helpers to load ABIs
function getContractAbi(contractName: string) {
  const filePath = path.join(
    __dirname,
    `../artifacts/contracts/${contractName}.sol/${contractName}.json`
  );
  if (!fs.existsSync(filePath)) {
    throw new Error(`Compiled artifact for ${contractName} not found. Run "npm run compile" first.`);
  }
  const artifact = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return { abi: artifact.abi, bytecode: artifact.bytecode };
}

// Deploy mock contracts if running on local Hardhat node
async function initContracts() {
  provider = new ethers.JsonRpcProvider(PROVIDER_URL);
  
  // Use Hardhat's first pre-funded account as the sponsored relayer/owner
  const signers = await provider.listAccounts();
  if (signers.length === 0) {
    throw new Error("No accounts available on JSON-RPC node. Start 'hardhat node' first.");
  }

  // Hardhat standard accounts private keys (Account #0 is deployer/relayer)
  const relayerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  relayerWallet = new ethers.Wallet(relayerPrivateKey, provider);
  
  const network = await provider.getNetwork();
  chainId = Number(network.chainId);

  console.log(`Connected to RPC. ChainId: ${chainId}, Relayer Address: ${relayerWallet.address}`);

  // Deploy Mock USDC
  const mockUsdcArtifact = getContractAbi("MockUSDC");
  const usdcFactory = new ethers.ContractFactory(mockUsdcArtifact.abi, mockUsdcArtifact.bytecode, relayerWallet);
  usdcContract = await usdcFactory.deploy();
  await usdcContract.waitForDeployment();
  usdcAddress = await usdcContract.getAddress();
  console.log(`Mock USDC Deployed to: ${usdcAddress}`);

  // Deploy Clearinghouse
  const clearinghouseArtifact = getContractAbi("ArcOpenRailsClearinghouseV1");
  const clearinghouseFactory = new ethers.ContractFactory(clearinghouseArtifact.abi, clearinghouseArtifact.bytecode, relayerWallet);
  clearinghouseContract = await clearinghouseFactory.deploy(usdcAddress);
  await clearinghouseContract.waitForDeployment();
  clearinghouseAddress = await clearinghouseContract.getAddress();
  console.log(`Clearinghouse Deployed to: ${clearinghouseAddress}`);

  // Prepare a demo agent wallet (Hardhat Account #1) and a merchant wallet (Hardhat Account #2)
  const agentPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Account #1
  const agentWallet = new ethers.Wallet(agentPrivateKey, provider);
  
  const merchantPrivateKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; // Account #2
  const merchantWallet = new ethers.Wallet(merchantPrivateKey, provider);

  // Mint some USDC to the agent wallet and approve clearinghouse
  const agentMint = ethers.parseUnits("5000", 6); // 5000 USDC
  await usdcContract.mint(agentWallet.address, agentMint);
  await usdcContract.connect(agentWallet).approve(clearinghouseAddress, ethers.MaxUint256);
  console.log(`Funded Agent: ${agentWallet.address} with 5000 USDC and approved Clearinghouse.`);
}

// REST API Endpoints

// 1. Get system config
app.get("/api/config", (req, res) => {
  res.json({
    chainId,
    clearinghouseAddress,
    usdcAddress,
    relayerAddress: relayerWallet.address,
    // Provide some preset accounts for the dashboard
    presets: {
      agentAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Hardhat Account #1
      agentPrivateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
      merchantAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Hardhat Account #2
      merchantPrivateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
      recoveryAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" // Hardhat Account #3
    }
  });
});

// 2. Query Paycard from ledger
app.get("/api/paycard/:id", async (req, res) => {
  try {
    const paycardId = req.params.id;
    const card = await clearinghouseContract.registry(paycardId);
    
    if (card.payer === ethers.ZeroAddress) {
      return res.status(404).json({ error: "Paycard not found" });
    }

    res.json({
      paycardId,
      payer: card.payer,
      recipient: card.recipient,
      totalAllocationPool: card.totalAllocationPool.toString(),
      availableBalance: card.availableBalance.toString(),
      flowVelocityPerSecond: card.flowVelocityPerSecond.toString(),
      genesisTimestamp: Number(card.genesisTimestamp),
      lifespanSeconds: Number(card.lifespanSeconds),
      lastCheckpointEpoch: Number(card.lastCheckpointEpoch),
      residualDeltaRecipient: card.residualDeltaRecipient,
      operationalStatus: Number(card.operationalStatus) === 0 ? "Active" : "Terminated",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Query ERC20 Balance
app.get("/api/balance/:address", async (req, res) => {
  try {
    const balance = await usdcContract.balanceOf(req.params.address);
    res.json({ balance: balance.toString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Open Paycard Channel via Sponsored Relayer
app.post("/api/paycard/open", async (req, res) => {
  try {
    const { envelopeToken } = req.body;
    if (!envelopeToken) {
      return res.status(400).json({ error: "Missing envelopeToken" });
    }

    // Use SDK to deserialize the payload
    const decoded = OpenRailsArcClient.deserializePayload(envelopeToken);
    const { intent, envelopeSignature } = decoded;

    console.log(`Relayer: Received request to open paycard ${intent.paycardId}`);

    // Broadcast on-chain transaction calling openPaycardChannel (sponsored by relayerWallet)
    const tx = await clearinghouseContract.openPaycardChannel(
      intent.paycardId,
      intent.recipient,
      intent.totalAllocationPool,
      intent.flowVelocityPerSecond,
      intent.genesisTimestamp,
      intent.lifespanSeconds,
      intent.residualDeltaRecipient,
      envelopeSignature
    );

    console.log(`Relayer: Transaction submitted. Tx Hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Relayer: Transaction mined in block ${receipt.blockNumber}`);

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      paycardId: intent.paycardId,
    });
  } catch (err: any) {
    console.error("Relayer Error in openPaycardChannel:", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Process Drip Settle
app.post("/api/paycard/drip", async (req, res) => {
  try {
    const { paycardId } = req.body;
    if (!paycardId) {
      return res.status(400).json({ error: "Missing paycardId" });
    }

    console.log(`Relayer: Triggering processDripSettle for ${paycardId}`);
    const tx = await clearinghouseContract.processDripSettle(paycardId);
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (err: any) {
    console.error("Error in processDripSettle:", err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Flush Residual Delta (STN-Delta recovery)
app.post("/api/paycard/flush", async (req, res) => {
  try {
    const { paycardId, caller } = req.body;
    if (!paycardId) {
      return res.status(400).json({ error: "Missing paycardId" });
    }

    // Find the caller private key or use the relayer.
    // The smart contract allows msg.sender == card.payer or card.recipient.
    // In our local mock, we will send the transaction from the recipient account
    // since we set it up with merchant's private key.
    const merchantPrivateKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
    const merchantSigner = new ethers.Wallet(merchantPrivateKey, provider);

    console.log(`Relayer: Merchant triggering flushResidualDelta for ${paycardId}`);
    const tx = await clearinghouseContract.connect(merchantSigner).flushResidualDelta(paycardId);
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (err: any) {
    console.error("Error in flushResidualDelta:", err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Mint USDC for dashboard convenience
app.post("/api/usdc/mint", async (req, res) => {
  try {
    const { address, amount } = req.body;
    const decimals = 6;
    const mintAmount = ethers.parseUnits(amount.toString(), decimals);
    
    console.log(`Minting ${amount} USDC to ${address}`);
    const tx = await usdcContract.mint(address, mintAmount);
    await tx.wait();
    
    res.json({ success: true, txHash: tx.hash });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Increase local block timestamp (Time-Travel for demo simulation)
app.post("/api/blockchain/increase-time", async (req, res) => {
  try {
    const { seconds } = req.body;
    console.log(`Blockchain: Advancing time by ${seconds} seconds`);
    await provider.send("evm_increaseTime", [Number(seconds)]);
    await provider.send("evm_mine", []);
    
    const block = await provider.getBlock("latest");
    res.json({ success: true, newTimestamp: block?.timestamp });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start Express and initialize contracts
app.listen(PORT, async () => {
  console.log(`Gateway API listening on http://localhost:${PORT}`);
  // Give the hardhat node a moment to spin up if launched concurrently
  setTimeout(async () => {
    try {
      await initContracts();
      console.log("Contracts successfully initialized.");
    } catch (err) {
      console.error("Failed to initialize contracts. Make sure 'npm run node' is running.", err);
    }
  }, 2000);
});
