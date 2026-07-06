# Playbook: Paid x402-to-Stream Showcase & Demo Guide

This guide details how to test, demonstrate, and record the live end-to-end **x402-to-stream bridge** on the Arc Network Testnet.

---

## 1. Demo Video Screen Layout

Arrange your monitor recording space into a three-panel split:

* **Left Panel**: Terminal window for executing client commands and monitoring logs.
* **Center Panel**: The Cockpit Dashboard WebApp (`/app` view) showing your active wallet balance.
* **Right Panel**: A web browser opened to the **ArcScan Explorer** (`https://testnet.arcscan.app`) to verify on-chain transactions.

---

## 2. Chronological Demonstration Steps (The Pitch Script)

### Step 1: Trigger the HTTP 402 Challenge
* **Action**: In the terminal, show a client attempting to access the gated server resource:
  ```bash
  curl -i http://localhost:3001/api/x402/openrails-artifact
  ```
* **Visual**: Show the server returning `HTTP/1.1 402 Payment Required` along with the challenge headers:
  ```
  WWW-Authenticate: OpenRails payment-challenge-v1
  X-OpenRails-Price-Per-Call: 100000
  ```
* **What to say**: *"First, we attempt to access a premium resource. The server rejects the call with an HTTP 402 challenge, specifying the payment price in USDC."*

### Step 2: Settle x402 Gaslessly (Circle Gateway)
* **Action**: Execute the buyer script to resolve the challenge:
  ```bash
  ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000 \
  ARC_OPENRAILS_HUB_ADDRESS=0x941C8029F0f912df3fAb7423890ab2359b996D0b \
  X402_BUYER_PRIVATE_KEY=<your funded testnet key — never commit a real one> \
  npm run smoke:x402:stream
  ```
* **Visual**: The log output prints:
  * `[x402->stream] paying x402...`
  * `[x402->stream] x402 PAID. settlementId=e5000826-f3ac-43f5-866c-1923508f7929`
* **What to say**: *"Our client signs a gasless authorization envelope. Circle’s Gateway facilitator settles the transaction, debits our deposited gateway balance by $0.01 USDC, and returns a verified settlement ID."*

### Step 3: Upgrade to a Real-Time Stream (The Vault)
* **Visual**: Watch the terminal output as it automatically proceeds:
  * `[x402->stream] approving bounded USDC spend (50000) to hub...`
  * `[x402->stream] opening Paycard Stream (openPaycardChannel)...`
  * `[x402->stream] open tx submitted: 0xd82dc498152f8608d0c7a9f0cc9fe2ba3601c473aa4c8f49a920d7239f75e81a`
* **What to say**: *"Now, instead of paying flat fees for every subsequent request, OpenRails upgrades our access into a continuous stream. The client escrows a bounded USDC pool in the Vault, and opens an active payment channel."*

### Step 4: Verify On-Chain Finality
* **Action**: Copy the `open tx submitted` transaction hash (`0xd82dc498...`) and paste it into the ArcScan explorer on the right panel.
* **Visual**: Show the transaction receipt with status `Success`, confirming the locked escrow and the `PaycardProvisioned` event log.
* **What to say**: *"Within under one second, the transaction achieves finality on the Arc Network. The escrow is locked, and we are now streaming value continuously."*
