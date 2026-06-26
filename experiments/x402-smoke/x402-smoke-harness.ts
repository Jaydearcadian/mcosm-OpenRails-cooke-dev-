import express from "express";
import { ethers } from "ethers";
import http from "http";

const PORT = 9876;
const GATEWAY_URL = `http://localhost:${PORT}`;

// Secure Relayer/Gateway Setup
const GATEKEEPER_WALLET = ethers.Wallet.createRandom();

async function runGateway() {
  const app = express();
  app.use(express.json());

  // In-memory active paycard cache for verification
  const activePaycards: Record<string, { balance: bigint; recipient: string }> = {
    // Registered test paycardId with 10 USDC balance (6 decimals)
    "0xbda57167aa107ecb66225ccb5f1c0249a830b5167c18680ae1b7fe3f54e2cdbe": {
      balance: 100000000n,
      recipient: "0xaA945EE7a55b5998d32A17C1EcF6050d9De7120A",
    },
  };

  /**
   * Gated endpoint following HTTP 402 (Payment Required) standard
   */
  app.get("/api/v1/data", async (req, res) => {
    const paycardId = req.header("X-OpenRails-Paycard-Id");
    const proof = req.header("X-OpenRails-Proof"); // Typically EIP-712 signature over access intent

    if (!paycardId || !proof) {
      // Respond with HTTP 402 and setup payment challenge headers
      res.setHeader("WWW-Authenticate", "OpenRails payment-challenge-v1");
      res.setHeader("X-OpenRails-Price-Per-Call", "100000"); // 0.1 USDC (6 decimals) per API call
      return res.status(402).json({
        error: "Payment Required",
        message: "Attach X-OpenRails-Paycard-Id and cryptographic X-OpenRails-Proof headers to authenticate.",
      });
    }

    const paycard = activePaycards[paycardId];
    if (!paycard) {
      return res.status(401).json({ error: "Invalid Paycard Stream ID" });
    }

    const cost = 100000n; // 0.1 USDC
    if (paycard.balance < cost) {
      return res.status(402).json({ error: "Insufficient Paycard Balance" });
    }

    // Deduct balance off-chain (cached state)
    paycard.balance -= cost;

    // Generate settlement receipt ID
    const settlementId = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes32", "uint256", "address", "uint256"],
        [paycardId, cost, paycard.recipient, Date.now()]
      )
    );

    res.setHeader("X-OpenRails-Settlement-Id", settlementId);
    res.setHeader("X-OpenRails-Remaining-Balance", paycard.balance.toString());

    return res.status(200).json({
      status: "Success",
      data: "Sensitive enterprise intelligence data payload accessed successfully.",
      settlement: {
        settlementId,
        cost: "0.1 USDC",
        remainingBalance: `${ethers.formatUnits(paycard.balance, 6)} USDC`,
      },
    });
  });

  return new Promise<http.Server>((resolve) => {
    const server = app.listen(PORT, () => {
      resolve(server);
    });
  });
}

// Helper to make simple HTTP requests in node.js
function makeRequest(url: string, headers?: Record<string, string>): Promise<{ status: number; headers: any; body: any }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: "GET",
      headers,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: JSON.parse(data),
          });
        } catch {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function main() {
  console.log("=== Starting Circle/x402 Buyer Smoke Harness ===");

  // 1. Boot the server
  console.log("Booting mock x402 Gateway...");
  const server = await runGateway();
  console.log(`Mock Gateway running on ${GATEWAY_URL}`);

  try {
    // 2. Make initial request without headers (expect 402)
    console.log("\nAttempt 1: Accessing gated resource without payment headers...");
    const res1 = await makeRequest(`${GATEWAY_URL}/api/v1/data`);
    console.log(`Response Status: ${res1.status}`);
    console.log("Headers Captured:");
    console.log(`  WWW-Authenticate: ${res1.headers["www-authenticate"]}`);
    console.log(`  X-OpenRails-Price-Per-Call: ${res1.headers["x-openrails-price-per-call"]}`);
    console.log("Body:", res1.body);

    if (res1.status !== 402) {
      throw new Error(`Expected status 402, got ${res1.status}`);
    }

    // 3. Resolve the payment required challenge
    console.log("\nResolving payment required challenge...");
    const buyerWallet = ethers.Wallet.createRandom();
    const paycardId = "0xbda57167aa107ecb66225ccb5f1c0249a830b5167c18680ae1b7fe3f54e2cdbe";

    // Sign an access intent string with buyer private key as proof
    const intentMessage = `AccessRequest: /api/v1/data @ ${Date.now()}`;
    const proofSignature = await buyerWallet.signMessage(intentMessage);

    // 4. Retry with payment headers
    console.log("\nAttempt 2: Retrying request with paycard headers...");
    const headers = {
      "X-OpenRails-Paycard-Id": paycardId,
      "X-OpenRails-Proof": proofSignature,
    };
    const res2 = await makeRequest(`${GATEWAY_URL}/api/v1/data`, headers);

    console.log(`Response Status: ${res2.status}`);
    console.log("Headers Captured:");
    console.log(`  X-OpenRails-Settlement-Id: ${res2.headers["x-openrails-settlement-id"]}`);
    console.log(`  X-OpenRails-Remaining-Balance: ${res2.headers["x-openrails-remaining-balance"]}`);
    console.log("Body:", res2.body);

    if (res2.status !== 200) {
      throw new Error(`Expected status 200, got ${res2.status}`);
    }

    console.log("\nE2E Smoke Verification: SUCCESS (HTTP 402 workflow executed and resolved).");
  } finally {
    // Close mock gateway server
    console.log("\nShutting down Mock Gateway...");
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
