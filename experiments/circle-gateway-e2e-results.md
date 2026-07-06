# Circle Gateway End-to-End Proof Results

## Test Details
*   **Date:** 2026-07-06
*   **Network:** Arc Testnet V2 Hub
*   **Source Wallet (Funder):** `0x1A76BFE6bF7A4BfD854b16C19Dd870e0DE56473C`
*   **Generated Fresh Wallet:** `0xec5BD607ee93E9Ae549336d563594A5076fBB698`
*   **Fresh Wallet Private Key:** redacted before commit — never paste a private key into a tracked file, even a throwaway testnet one. Regenerate a fresh disposable key locally if this proof needs re-running.
*   **Deposit Amount:** `50,000` micro-USDC (0.05 USDC)
*   **Deposit Tx Hash:** `0xf3bdec076d10b0aca6847807d69245ce4edc88cc94c88535255b75e0b06425d8`
*   **Explorer Link:** [ArcScan Tx](https://testnet.arcscan.app/tx/0xf3bdec076d10b0aca6847807d69245ce4edc88cc94c88535255b75e0b06425d8)

## Gateway Settlement Lifecycle
1.  **Fund Source Wallet:** The source wallet starts with a balance of USDC (in both 6-decimal and 18-decimal representations).
2.  **Approve Spender:** The source wallet approves the `GatewayWallet` proxy (`0x0077777d7EBA4688BDeF3E311b846F25870A19B9`) to spend 50,000 micro-USDC.
3.  **Gateway Deposit:** The script invokes `depositForToGateway` which calls `depositFor` on the `GatewayWallet` contract.
4.  **Asynchronous Batching:** Since Circle's Gateway uses batching, the funds are held on the contract until Circle's relayer gathers multiple deposits and submits `submitBatch` on-chain. This usually takes around 10 minutes on Testnet, after which the destination wallet is credited.
5.  **OpenRails Payment:** Once the batch completes and the fresh wallet receives the funds, it can use the standard OpenRails SDK (`payGasless` or direct contract calls) to open Paycard channels and stream payments.
