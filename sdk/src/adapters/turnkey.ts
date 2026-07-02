/**
 * @module adapters/turnkey
 * @description Adapt a Turnkey signer to an {@link OpenRailsAccount} — the agent /
 * server-wallet path. Subpath export: `openrails-sdk/adapters/turnkey`.
 *
 * Turnkey's `@turnkey/ethers` `TurnkeySigner` is ethers-compatible, so we accept the
 * `getAddress` + `signTypedData` surface and return a sign-only account suitable for
 * headless, gasless flows (the relay submits). `@turnkey/ethers` is an optional peer —
 * never imported here — so the SDK core stays dependency-free.
 *
 * ```ts
 * const signer = new TurnkeySigner({ client, organizationId, signWith }); // @turnkey/ethers
 * const account = turnkeyToAccount(signer);
 * const client = await LeptonOpenRailsClient.fromAccount(account, HUB, chainId);
 * ```
 */
import type { OpenRailsAccount } from '../account';

/** The Turnkey (ethers-compatible) signer surface we depend on. */
export interface TurnkeyLikeSigner {
  getAddress(): Promise<string>;
  signTypedData(domain: unknown, types: unknown, value: unknown): Promise<string>;
}

export function turnkeyToAccount(signer: TurnkeyLikeSigner): OpenRailsAccount {
  return {
    getAddress: () => signer.getAddress(),
    signTypedData: (domain, types, value) => signer.signTypedData(domain, types, value),
  };
}
