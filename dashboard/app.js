// OpenRails V1 Dashboard Controller

const BACKEND_URL = "http://localhost:3001";
let config = null;
let activePaycard = null;
let isPolling = false;
let dripInterval = null;

// DOM Elements
const elNetworkStatus = document.getElementById("network-status");
const elPaycardIdInput = document.getElementById("intent-paycard-id");
const elBtnGenerateId = document.getElementById("btn-generate-id");
const elAllocationInput = document.getElementById("intent-allocation");
const elVelocityInput = document.getElementById("intent-velocity");
const elRecipientInput = document.getElementById("intent-recipient");
const elRecoveryInput = document.getElementById("intent-recovery");
const elLifespanInput = document.getElementById("intent-lifespan");
const elPayerKeyInput = document.getElementById("intent-payer-key");
const elBtnGenerateEnvelope = document.getElementById("btn-generate-envelope");

const elEnvelopeOutputContainer = document.getElementById("envelope-output-container");
const elEnvelopePayloadText = document.getElementById("envelope-payload-text");
const elBtnCopyEnvelope = document.getElementById("btn-copy-envelope");

const elRelayerInputToken = document.getElementById("relayer-input-token");
const elBtnSubmitRelayer = document.getElementById("btn-submit-relayer");
const elRelayerStatusContainer = document.getElementById("relayer-status-container");
const elRelayerStatusLabel = document.getElementById("relayer-status-label");
const elReceiptTxLink = document.getElementById("receipt-tx-link");
const elReceiptStatus = document.getElementById("receipt-status");

const elPaycardEmptyState = document.getElementById("paycard-empty-state");
const elPaycardActiveState = document.getElementById("paycard-active-state");
const elDisplayCardId = document.getElementById("display-card-id");
const elDisplayStatus = document.getElementById("display-status");
const elDisplayFluidFill = document.getElementById("display-fluid-fill");
const elDisplayAvailableBalance = document.getElementById("display-available-balance");
const elDisplayVelocity = document.getElementById("display-velocity");
const elDisplayPayer = document.getElementById("display-payer");
const elDisplayRecipient = document.getElementById("display-recipient");
const elDisplayRecovery = document.getElementById("display-recovery");
const elDisplayLifespan = document.getElementById("display-lifespan");

const elBtnBlockchainTick = document.getElementById("btn-blockchain-tick");
const elBtnProcessDrip = document.getElementById("btn-process-drip");
const elBtnFlushDelta = document.getElementById("btn-flush-delta");

const elBalanceAgent = document.getElementById("balance-agent");
const elBalanceMerchant = document.getElementById("balance-merchant");
const elBalanceRecovery = document.getElementById("balance-recovery");
const elBalanceContract = document.getElementById("balance-contract");
const elBtnMintFaucet = document.getElementById("btn-mint-faucet");

// Init
window.addEventListener("DOMContentLoaded", async () => {
  generateNewPaycardId();
  await fetchConfig();
  await refreshBalances();
  
  // Setup Event Listeners
  elBtnGenerateId.addEventListener("click", generateNewPaycardId);
  elBtnGenerateEnvelope.addEventListener("click", generateAndSignEnvelope);
  elBtnCopyEnvelope.addEventListener("click", copyEnvelopeToClipboard);
  elRelayerInputToken.addEventListener("input", toggleRelayerButton);
  elBtnSubmitRelayer.addEventListener("click", broadcastSponsoredTx);
  elBtnBlockchainTick.addEventListener("click", tickTime);
  elBtnProcessDrip.addEventListener("click", processDripSettle);
  elBtnFlushDelta.addEventListener("click", flushResidualDelta);
  elBtnMintFaucet.addEventListener("click", mintFaucetUSDC);
});

// Generate a random Bytes32 Hex for Paycard ID
function generateNewPaycardId() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const hex = "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  elPaycardIdInput.value = hex;
}

// Fetch setup configuration from Server
async function fetchConfig() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/config`);
    if (!res.ok) throw new Error("Server config request failed");
    config = await res.json();
    
    // Fill in presets
    elRecipientInput.value = config.presets.merchantAddress;
    elRecoveryInput.value = config.presets.recoveryAddress;
    elPayerKeyInput.value = config.presets.agentPrivateKey;
    
    elNetworkStatus.textContent = `Arc Network (Chain ID: ${config.chainId})`;
    console.log("Config loaded:", config);
  } catch (err) {
    console.error("Could not fetch config from gateway server:", err);
    alert("Make sure the backend server is running (npm start).");
  }
}

// Format USDC helper (6 decimals)
function formatUSDC(amountString) {
  const num = Number(amountString) / 1000000;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

// Refresh treasury wallets
async function refreshBalances() {
  if (!config) return;
  try {
    const addresses = {
      agent: config.presets.agentAddress,
      merchant: config.presets.merchantAddress,
      recovery: config.presets.recoveryAddress,
      contract: config.clearinghouseAddress
    };

    const fetchBalance = async (addr) => {
      const res = await fetch(`${BACKEND_URL}/api/balance/${addr}`);
      const data = await res.json();
      return formatUSDC(data.balance);
    };

    elBalanceAgent.textContent = await fetchBalance(addresses.agent);
    elBalanceMerchant.textContent = await fetchBalance(addresses.merchant);
    elBalanceRecovery.textContent = await fetchBalance(addresses.recovery);
    elBalanceContract.textContent = await fetchBalance(addresses.contract);
  } catch (err) {
    console.error("Error refreshing balances:", err);
  }
}

// Generate off-chain signed envelope mimicking the TypeScript SDK
async function generateAndSignEnvelope() {
  if (!config) {
    alert("Gateway configuration not loaded. Is the backend server running?");
    return;
  }

  const paycardId = elPaycardIdInput.value;
  const allocation = elAllocationInput.value;
  const velocity = elVelocityInput.value;
  const recipient = elRecipientInput.value;
  const recovery = elRecoveryInput.value;
  const lifespan = Number(elLifespanInput.value);
  const payerPrivateKey = elPayerKeyInput.value;

  if (!payerPrivateKey.startsWith("0x") || payerPrivateKey.length !== 66) {
    alert("Please enter a valid 32-byte private key hex (starting with 0x).");
    return;
  }

  try {
    // Math conversion to base units (6 decimals)
    const allocationBase = ethers.parseUnits(allocation.toString(), 6).toString();
    const velocityBase = ethers.parseUnits(velocity.toString(), 6).toString();
    const genesisTimestamp = Math.floor(Date.now() / 1000);

    const intent = {
      paycardId,
      recipient,
      totalAllocationPool: allocationBase,
      flowVelocityPerSecond: velocityBase,
      genesisTimestamp,
      lifespanSeconds: lifespan,
      residualDeltaRecipient: recovery
    };

    // Instantiate local ethers wallet
    const wallet = new ethers.Wallet(payerPrivateKey);

    // Reconstruct domain and types
    const domain = {
      name: "OpenRails Network",
      version: "1.0.0",
      chainId: config.chainId,
      verifyingContract: config.clearinghouseAddress,
    };

    const types = {
      SettlementIntent: [
        { name: "paycardId", type: "bytes32" },
        { name: "recipient", type: "address" },
        { name: "totalAllocationPool", type: "uint256" },
        { name: "flowVelocityPerSecond", type: "uint256" },
        { name: "genesisTimestamp", type: "uint256" },
        { name: "lifespanSeconds", type: "uint256" },
        { name: "residualDeltaRecipient", type: "address" },
      ],
    };

    // Sign the EIP-712 structured data
    const signature = await wallet.signTypedData(domain, types, intent);

    const completePayload = {
      payerAddress: wallet.address,
      envelopeSignature: signature,
      intent: intent
    };

    // Base64 URL-safe conversion
    const jsonStr = JSON.stringify(completePayload);
    const base64Token = btoa(unescape(encodeURIComponent(jsonStr)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    // Display output
    elEnvelopePayloadText.textContent = base64Token;
    elEnvelopeOutputContainer.classList.remove("hidden");
    
    // Auto populate relayer input
    elRelayerInputToken.value = base64Token;
    toggleRelayerButton();

    // Scroll to relayer section
    document.getElementById("relayer-section").scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    console.error("Signature generation failed:", err);
    alert("Error generating signature: " + err.message);
  }
}

function copyEnvelopeToClipboard() {
  const text = elEnvelopePayloadText.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const originalText = elBtnCopyEnvelope.textContent;
    elBtnCopyEnvelope.textContent = "Copied!";
    setTimeout(() => {
      elBtnCopyEnvelope.textContent = originalText;
    }, 2000);
  });
}

function toggleRelayerButton() {
  elBtnSubmitRelayer.disabled = elRelayerInputToken.value.trim() === "";
}

// Broadcast to Circle Relayer Endpoint
async function broadcastSponsoredTx() {
  const token = elRelayerInputToken.value.trim();
  if (!token) return;

  elBtnSubmitRelayer.disabled = true;
  elRelayerStatusContainer.classList.remove("hidden");
  elRelayerStatusLabel.textContent = "Submitting Sponsored transaction (gasless)...";
  elReceiptTxLink.textContent = "Processing...";
  elReceiptTxLink.removeAttribute("href");
  elReceiptStatus.textContent = "Pending";
  
  // Scroll to make visible
  elRelayerStatusContainer.scrollIntoView({ behavior: "smooth" });

  try {
    const res = await fetch(`${BACKEND_URL}/api/paycard/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelopeToken: token })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Broadcast failed");

    // Success
    elRelayerStatusLabel.textContent = "Transaction Confirmed! Paycard Channel Open.";
    elReceiptTxLink.textContent = data.txHash;
    elReceiptStatus.textContent = `Mined (Block #${data.blockNumber})`;
    
    // Refresh balances and start tracking the paycard
    await refreshBalances();
    startPollingPaycard(data.paycardId);

  } catch (err) {
    console.error("Broadcast failed:", err);
    elRelayerStatusLabel.textContent = "Error broadcasting: " + err.message;
    elReceiptStatus.textContent = "Failed";
    elBtnSubmitRelayer.disabled = false;
  }
}

// Poll Paycard registry data from contract
function startPollingPaycard(paycardId) {
  if (isPolling) {
    clearInterval(dripInterval);
  }
  isPolling = true;
  
  elPaycardEmptyState.classList.add("hidden");
  elPaycardActiveState.classList.remove("hidden");
  
  // Start block update polling
  syncPaycard(paycardId);
  dripInterval = setInterval(() => {
    syncPaycard(paycardId);
  }, 3000);
  
  // Local high-speed visual interpolation for the drip progress bar
  runLocalDripAnimation();
  
  document.getElementById("ledger-section").scrollIntoView({ behavior: "smooth" });
}

async function syncPaycard(paycardId) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/paycard/${paycardId}`);
    if (!res.ok) {
      if (res.status === 404) {
        // Not found yet
        return;
      }
      throw new Error("Failed to query paycard");
    }

    const card = await res.json();
    activePaycard = card;
    
    // Update labels
    elDisplayCardId.textContent = `ID: ${paycardId.substring(0, 8)}...${paycardId.substring(56)}`;
    elDisplayStatus.textContent = card.operationalStatus;
    
    if (card.operationalStatus === "Terminated") {
      elDisplayStatus.className = "card-status-badge terminated";
      clearInterval(dripInterval);
      activePaycard = null;
      isPolling = false;
      await refreshBalances();
      
      // Stop animation
      elDisplayFluidFill.style.width = "0%";
      elDisplayAvailableBalance.textContent = "$0.00";
    } else {
      elDisplayStatus.className = "card-status-badge active";
    }

    elDisplayVelocity.textContent = formatUSDC(card.flowVelocityPerSecond);
    elDisplayPayer.textContent = `${card.payer.substring(0, 6)}...${card.payer.substring(38)}`;
    elDisplayRecipient.textContent = `${card.recipient.substring(0, 6)}...${card.recipient.substring(38)}`;
    elDisplayRecovery.textContent = `${card.residualDeltaRecipient.substring(0, 6)}...${card.residualDeltaRecipient.substring(38)}`;
    
    // Lifespan remaining
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expiresAt = card.genesisTimestamp + card.lifespanSeconds;
    const remaining = Math.max(0, expiresAt - currentTimestamp);
    elDisplayLifespan.textContent = `${remaining}s / ${card.lifespanSeconds}s remaining`;

    await refreshBalances();

  } catch (err) {
    console.error("Error syncing paycard status:", err);
  }
}

// Smooth local UI countdown drip animation between sync ticks
function runLocalDripAnimation() {
  const animate = () => {
    if (!isPolling || !activePaycard) return;
    
    const now = Math.floor(Date.now() / 1000);
    const end = activePaycard.genesisTimestamp + activePaycard.lifespanSeconds;
    
    // Evaluate drip using contract formula
    const lastCheck = activePaycard.lastCheckpointEpoch;
    const evaluatedEpoch = now > end ? end : now;
    
    if (evaluatedEpoch <= lastCheck) {
      // Fluid calculation
      const avail = Number(activePaycard.availableBalance);
      const total = Number(activePaycard.totalAllocationPool);
      const percentage = (avail / total) * 100;
      elDisplayFluidFill.style.width = `${Math.max(0, percentage)}%`;
      elDisplayAvailableBalance.textContent = formatUSDC(avail.toString());
      requestAnimationFrame(animate);
      return;
    }

    const elapsed = evaluatedEpoch - lastCheck;
    const accrued = elapsed * Number(activePaycard.flowVelocityPerSecond);
    
    let simulatedAvail = Number(activePaycard.availableBalance) - accrued;
    if (simulatedAvail < 0) simulatedAvail = 0;
    
    const total = Number(activePaycard.totalAllocationPool);
    const percentage = (simulatedAvail / total) * 100;
    
    elDisplayFluidFill.style.width = `${Math.max(0, percentage)}%`;
    elDisplayAvailableBalance.textContent = formatUSDC(simulatedAvail.toString());
    
    // Update time countdown display
    const remaining = Math.max(0, end - now);
    elDisplayLifespan.textContent = `${remaining}s / ${activePaycard.lifespanSeconds}s remaining`;
    
    if (simulatedAvail === 0 || remaining === 0) {
      // Auto triggers sync
      syncPaycard(activePaycard.paycardId);
    }
    
    requestAnimationFrame(animate);
  };
  
  requestAnimationFrame(animate);
}

// EVM Controls via Relayer API
async function tickTime() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/blockchain/increase-time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seconds: 10 })
    });
    const data = await res.json();
    console.log("Blockchain time advanced:", data);
    
    if (activePaycard) {
      await syncPaycard(activePaycard.paycardId);
    }
  } catch (err) {
    console.error("Failed to advance blockchain time:", err);
  }
}

async function processDripSettle() {
  if (!activePaycard) return;
  try {
    elBtnProcessDrip.disabled = true;
    const res = await fetch(`${BACKEND_URL}/api/paycard/drip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paycardId: activePaycard.paycardId })
    });
    const data = await res.json();
    console.log("Drip settled on-chain:", data);
    
    await syncPaycard(activePaycard.paycardId);
  } catch (err) {
    console.error("Failed to process drip:", err);
  } finally {
    elBtnProcessDrip.disabled = false;
  }
}

async function flushResidualDelta() {
  if (!activePaycard) return;
  try {
    elBtnFlushDelta.disabled = true;
    const res = await fetch(`${BACKEND_URL}/api/paycard/flush`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paycardId: activePaycard.paycardId })
    });
    const data = await res.json();
    console.log("Residual Delta flushed (STN-Delta):", data);
    
    await syncPaycard(activePaycard.paycardId);
  } catch (err) {
    console.error("Failed to flush residual delta:", err);
  } finally {
    elBtnFlushDelta.disabled = false;
  }
}

async function mintFaucetUSDC() {
  if (!config) return;
  try {
    elBtnMintFaucet.disabled = true;
    const res = await fetch(`${BACKEND_URL}/api/usdc/mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: config.presets.agentAddress,
        amount: 100
      })
    });
    await res.json();
    await refreshBalances();
    console.log("Minted $100 USDC to Agent wallet.");
  } catch (err) {
    console.error("Failed to mint USDC:", err);
  } finally {
    elBtnMintFaucet.disabled = false;
  }
}
