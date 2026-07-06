/**
 * @module adapters/circle
 * @description Adapt a Circle Smart Account (using viem/Account interfaces) to an {@link OpenRailsAccount}.
 * Subpath export: `openrails-sdk/adapters/circle`.
 */
import { ethers } from 'ethers';
import type { OpenRailsAccount } from '../account';

export interface CircleLikeSmartAccount {
  address: string;
  signTypedData(args: {
    domain: any;
    types: any;
    primaryType: string;
    message: any;
  }): Promise<string>;
}

export function circleToAccount(account: CircleLikeSmartAccount): OpenRailsAccount {
  const address = ethers.getAddress(account.address);
  return {
    isSmartAccount: true,
    getAddress: async () => address,
    signTypedData: async (domain, types, value) => {
      const payload = ethers.TypedDataEncoder.getPayload(domain, types, value);
      
      // viem expects chainId to be a number, not hex/string representation if provided as hex
      const cleanDomain = { ...payload.domain };
      if (typeof cleanDomain.chainId === 'string') {
        if (cleanDomain.chainId.startsWith('0x')) {
          cleanDomain.chainId = parseInt(cleanDomain.chainId, 16);
        } else {
          cleanDomain.chainId = parseInt(cleanDomain.chainId, 10);
        }
      }

      const signature = await account.signTypedData({
        domain: cleanDomain,
        types: payload.types,
        primaryType: payload.primaryType,
        message: payload.message,
      });
      return signature;
    },
  };
}
