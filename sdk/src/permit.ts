/**
 * @module permit
 * @description EIP-2612 `permit` signing for USDC.
 *
 * Arc's USDC exposes EIP-2612 (`DOMAIN_SEPARATOR`, `nonces`, `version`), so a
 * payer's ERC-20 approval can be a *signature* instead of a transaction. Combined
 * with a sponsored relay, this removes the last on-chain step a payer would
 * otherwise pay gas for — enabling fully gasless onboarding, no contract change.
 *
 * This is standard EIP-2612 and entirely off-contract.
 */
import { ethers } from 'ethers';
import type { OpenRailsAccount } from './account';

const PERMIT_READ_ABI = [
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function nonces(address owner) view returns (uint256)',
];

/** A signed EIP-2612 permit, split into the components `permit()` expects. */
export interface UsdcPermit {
  owner: string;
  spender: string;
  value: string; // base units
  deadline: number;
  v: number;
  r: string;
  s: string;
}

export interface SignUsdcPermitParams {
  /** USDC token address (the EIP-712 verifying contract). */
  token: string;
  /** Approved spender — the OpenRails Hub. */
  spender: string;
  /** Amount to approve, in base units. */
  value: bigint | string;
  /** EIP-155 chain id. */
  chainId: number;
  /** Unix seconds; defaults to now + 1h. */
  deadline?: number;
  /**
   * Provider used to read `name`/`version`/`nonce` when they aren't supplied.
   * Optional: if `name`, `version`, and `nonce` are all provided, no network is
   * touched (this is what makes the helper unit-testable).
   */
  provider?: ethers.Provider;
  /** EIP-712 domain `name` (read from the token if omitted). */
  name?: string;
  /** EIP-712 domain `version` (read from the token if omitted, else "1"). */
  version?: string;
  /** The owner's current permit nonce (read from the token if omitted). */
  nonce?: bigint | number | string;
}

const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

/**
 * Sign an EIP-2612 permit authorizing `spender` to move `value` USDC from the
 * account. Returns `{owner, spender, value, deadline, v, r, s}` ready to submit
 * as `usdc.permit(...)` (typically by a relayer).
 */
export async function signUsdcPermit(
  account: OpenRailsAccount,
  params: SignUsdcPermitParams,
): Promise<UsdcPermit> {
  const owner = ethers.getAddress(await account.getAddress());
  const token = ethers.getAddress(params.token);
  const spender = ethers.getAddress(params.spender);
  const value = BigInt(params.value);
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + 3600;

  let { name, version, nonce } = params;
  if (name === undefined || nonce === undefined || version === undefined) {
    if (!params.provider) {
      throw new Error('signUsdcPermit needs a provider unless name, version, and nonce are all supplied');
    }
    const erc = new ethers.Contract(token, PERMIT_READ_ABI, params.provider);
    if (name === undefined) name = await erc.name();
    if (nonce === undefined) nonce = await erc.nonces(owner);
    if (version === undefined) {
      // Not every EIP-2612 token exposes version(); fall back to the common "1".
      try {
        version = await erc.version();
      } catch {
        version = '1';
      }
    }
  }

  const domain: ethers.TypedDataDomain = {
    name: name as string,
    version: version as string,
    chainId: params.chainId,
    verifyingContract: token,
  };
  const message = { owner, spender, value, nonce: BigInt(nonce as bigint | number | string), deadline };

  const signature = await account.signTypedData(domain, PERMIT_TYPES as unknown as Record<string, ethers.TypedDataField[]>, message);
  const { v, r, s } = ethers.Signature.from(signature);
  return { owner, spender, value: value.toString(), deadline, v, r, s };
}
