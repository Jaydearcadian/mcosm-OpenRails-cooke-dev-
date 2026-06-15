# OpenRails V1 on Arc Network

**OpenRails V1** is an intent-driven clearing and settlement infrastructure engineered for the machine economy. Built for the **Lepton Agents Hackathon** (Canteen × Circle × Arc), it pairs off-chain autonomous AI agents generating EIP-712 payment permits with a gasless relayer gateway and a sub-second clearinghouse ledger deployed on the Arc Network.

---

## 1. System Architecture

```
+--------------------------------------------------------------------------+
|                  1. AGENT RUNTIME COMPUTE: LEPTON                        |
|  - An autonomous model determines it needs to pull down an API resource.  |
|  - SDK signs an EIP-712 execution permit completely off-chain.           |
+--------------------------------------------------------------------------+
                                     │
                                     ▼ (Base64-Encoded Transport URL)
+--------------------------------------------------------------------------+
|                  2. GASLESS RECONCILER: CIRCLE APP KIT                   |
|  - Relayer captures the payload and signs a Sponsored Tx via Paymaster.   |
|  - The developer/agent pays zero native gas setup friction.              |
+--------------------------------------------------------------------------+
                                     │
                                     ▼ (Atomic State Transition)
+--------------------------------------------------------------------------+
|                  3. THE RUNTIME SUBSTRATE: ARC NETWORK                   |
|  - Direct Ingestion: Malachite consensus orders the tx in <350ms.        |
|  - Pure Settlement: Funds move via Native USDC base gas rules.           |
|  - STN-Delta: Automatically snaps the safety buffer back to the payer.   |
+--------------------------------------------------------------------------+
```

---

## 2. Codebase Overview

This repository contains the complete end-to-end integration:
* **Smart Contracts**: Deployable Solidity smart contracts built for the Arc Network substrate.
  * [ArcOpenRailsClearinghouseV1.sol](file:///home/jay/codex/lepton/contracts/ArcOpenRailsClearinghouseV1.sol): Core ledger contract containing the [openPaycardChannel](file:///home/jay/codex/lepton/contracts/ArcOpenRailsClearinghouseV1.sol#L55) channel setup, the time-based [processDripSettle](file:///home/jay/codex/lepton/contracts/ArcOpenRailsClearinghouseV1.sol#L96) drip engine, and the [flushResidualDelta](file:///home/jay/codex/lepton/contracts/ArcOpenRailsClearinghouseV1.sol#L131) buffer recovery method.
  * [MockUSDC.sol](file:///home/jay/codex/lepton/contracts/MockUSDC.sol): Mock USDC ERC-20 contract used to simulate the gasless native USDC fee environment.
* **Off-Chain SDK**: A TypeScript SDK for containerized AI agent compute sandboxes.
  * [client.ts](file:///home/jay/codex/lepton/sdk/src/client.ts): Outlines the [OpenRailsArcClient](file:///home/jay/codex/lepton/sdk/src/client.ts#L18) class that generates typed EIP-712 cryptographic signatures and compresses payloads into Base64 bearer tokens.
* **Relayer Gateway Server**:
  * [index.ts](file:///home/jay/codex/lepton/server/index.ts): An Express API server that intercepts Base64 permission envelopes, recovers the signer parameters off-chain, and broadcasts sponsored transactions (zero native gas from the client's perspective).
* **Interactive Frontend Dashboard**:
  * [index.html](file:///home/jay/codex/lepton/dashboard/index.html) and [app.js](file:///home/jay/codex/lepton/dashboard/app.js): A premium web playground (sleek dark mode, glassmorphism UI) visualizing the entire end-to-end payment lifecycle in real-time.

---

## 3. Core Mechanics

### 3.1 Gasless Sponsored Relay (Circle App Kit)
AI agents operating inside compute environments like Lepton shouldn't have to manage volatile gas tokens (such as ETH or SOL). Using Circle's developer infrastructure and Programmable Wallets, the relayer captures the off-chain signed envelope and broadcasts it via a sponsored transaction to the Arc Clearinghouse, ensuring zero-friction setup.

### 3.2 Time-Based Linear Drips
Rather than locking up huge capital upfront or submitting transaction gas every second, the clearinghouse tracks payment streams reactively. Using block clock-math inside [processDripSettle](file:///home/jay/codex/lepton/contracts/ArcOpenRailsClearinghouseV1.sol#L96), the merchant can claim exactly what they have earned up to the current block timestamp, executing zero-gas adjustments off-chain between settlements.

### 3.3 STN-Delta Buffer Recovery
To insulate streams from network delays or exchange spreads, agents over-provision their payment pool:
$$\text{Total Escrow Allocation} = \text{Realized Operational Invoice } (I_{\text{actual}}) + \text{STN-Delta Safety Buffer } (\Delta)$$
The moment the billing concludes or expires, the [flushResidualDelta](file:///home/jay/codex/lepton/contracts/ArcOpenRailsClearinghouseV1.sol#L131) method triggers. The clearinghouse snaps the remaining variance ($\Delta$) back to the payer's recovery address instantly within the same atomic block.

---

## 4. Quickstart Guide

### 4.1 Prerequisites
* Node.js v20+
* NPM

### 4.2 Installation
Install the project dependencies:
```bash
npm install
```

### 4.3 Compile Smart Contracts
Compile the contracts with Hardhat:
```bash
npm run compile
```

### 4.4 Run Tests
Execute the Hardhat unit tests to verify EIP-712 ECRECOVER, linear drips, and STN-Delta logic:
```bash
npm run test
```

### 4.5 Start the Local Sandbox Node & Gateway Server
Launch both the local Hardhat blockchain node and the Express Relayer Gateway Server:
```bash
npm start
```
This script runs the local chain on port `8545` and the API gateway on port `3001`. On startup, the server automatically deploys the [MockUSDC](file:///home/jay/codex/lepton/contracts/MockUSDC.sol) and [ArcOpenRailsClearinghouseV1](file:///home/jay/codex/lepton/contracts/ArcOpenRailsClearinghouseV1.sol) contracts, mints USDC to the agent wallet, and approves the clearinghouse.

### 4.6 Launch the Visualizer Dashboard
Start the Vite frontend development server:
```bash
npm run dev
```
Open `http://localhost:5173` (or the printed port) in your browser to run the interactive playground.

---

**OpenRails V1** // *Intent-Driven Clearing & Settlement Infrastructure for the Machine Economy.*
