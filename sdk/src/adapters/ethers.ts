/**
 * @module adapters/ethers
 * @description Adapt any ethers v6 Signer (injected wallet, raw-key Wallet, JSON-RPC
 * signer) to an {@link OpenRailsSubmitter}. Subpath export: `openrails-sdk/adapters/ethers`.
 *
 * An ethers.Signer already satisfies the interface structurally; this normalizes the
 * `sendTransaction` result to our minimal {@link SubmittedTransaction} shape.
 */
import type { OpenRailsSubmitter, SubmittedTransaction } from '../account';

/** The subset of an ethers v6 Signer we depend on. */
export interface EthersLikeSigner {
  getAddress(): Promise<string>;
  signTypedData(domain: unknown, types: unknown, value: unknown): Promise<string>;
  sendTransaction(tx: unknown): Promise<{ hash: string; wait(): Promise<unknown> }>;
}

export function ethersToSubmitter(signer: EthersLikeSigner): OpenRailsSubmitter {
  return {
    getAddress: () => signer.getAddress(),
    signTypedData: (domain, types, value) => signer.signTypedData(domain, types, value),
    sendTransaction: async (tx): Promise<SubmittedTransaction> => {
      const res = await signer.sendTransaction(tx);
      return { hash: res.hash, wait: () => res.wait() };
    },
  };
}
