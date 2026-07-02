/**
 * @module adapters/privy
 * @description Adapt a Privy embedded wallet to an {@link OpenRailsAccount} (sign-only,
 * for gasless relayed flows). Subpath export: `openrails-sdk/adapters/privy`.
 *
 * Privy's embedded wallet exposes an EIP-1193 provider. Pass that provider plus the
 * wallet address:
 *
 * ```ts
 * const provider = await wallet.getEthereumProvider(); // Privy ConnectedWallet
 * const account = privyToAccount({ address: wallet.address, provider });
 * const client = await LeptonOpenRailsClient.fromAccount(account, HUB, chainId);
 * ```
 *
 * `@privy-io/react-auth` is an optional peer — this file never imports it (it works
 * off the standard EIP-1193 provider), so the SDK core stays dependency-free.
 */
import { ethers } from 'ethers';
import type { OpenRailsAccount } from '../account';

/** Minimal EIP-1193 provider surface (what a Privy embedded wallet returns). */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export function privyToAccount(input: { address: string; provider: Eip1193Provider }): OpenRailsAccount {
  const address = ethers.getAddress(input.address);
  return {
    getAddress: async () => address,
    signTypedData: async (domain, types, value) => {
      // Build the full EIP-712 payload (EIP712Domain + primaryType) for eth_signTypedData_v4.
      const payload = ethers.TypedDataEncoder.getPayload(domain, types, value);
      const sig = await input.provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(payload)],
      });
      return sig as string;
    },
  };
}
