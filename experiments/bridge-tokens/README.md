# Experiment: Cross-Chain USDC Bridging to Arc Testnet

This experiment showcases how to utilize Circle's `@circle-fin/bridge-kit` and `@circle-fin/adapter-viem-v2` to bridge USDC from an EVM source chain (Ethereum Sepolia) to **Arc Testnet** in a single, high-level TypeScript method call.

---

## 1. Setup & Installation

To run this experiment, you must install the standalone Bridge Kit packages. From the repository root, install the required dependencies:

```bash
# Install the core Bridge Kit
npm install @circle-fin/bridge-kit

# Install the Viem adapter for EVM chain operations
npm install @circle-fin/adapter-viem-v2 viem
```

---

## 2. Configuration (.env)

Make sure your root `.env` file contains your funded Sepolia private key and RPC endpoint:

```bash
OPENRAILS_PAYER_PRIVATE_KEY=YOUR_PRIVATE_KEY
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

---

## 3. Execution

Execute the bridging script using `ts-node` from the repository root:

```bash
npx ts-node experiments/bridge-tokens/bridge-tokens.ts
```

### Expected Output
The script instantiates the Viem client, passes it to the `BridgeKit` adapter, and triggers the CCTP transfer. It returns the CCTP execution transaction details:

```json
{
  "status": "initiated",
  "sourceTxHash": "0x...",
  "messageBytes": "0x...",
  "attestationSignature": "0x..."
}
```
Once the attestation is completed by Circle, the relayer mints the USDC directly on **Arc Testnet** to the payer's destination wallet.
