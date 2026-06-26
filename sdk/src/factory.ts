/**
 * @module factory
 * @description Paycard ID generation utilities for the OpenRails V1
 * arc-policy-envelope layer.
 *
 * Paycard IDs are 32-byte (256-bit) hex strings prefixed with `0x`, matching
 * the `bytes32` type expected by the on-chain clearinghouse contract.
 */

import { ethers } from 'ethers';

/**
 * Factory for generating deterministic and random paycard identifiers.
 */
export class DeterministicPaycardIdFactory {
  /**
   * Generate a deterministic 32-byte hex paycard ID by hashing a
   * combination of the current timestamp, a public key, and an optional
   * salt through `keccak256`.
   *
   * Because the timestamp is captured at call-time, repeated invocations
   * with the same arguments will generally produce different results
   * unless the caller controls the clock (e.g. in tests).
   *
   * @param publicKey - the wallet address or public key to bind the ID to
   * @param salt      - optional additional entropy / discriminator
   * @returns `0x`-prefixed 32-byte hex string
   */
  public static generate(publicKey: string, salt: string = ''): string {
    const timestamp = Date.now().toString();
    const preimage = ethers.toUtf8Bytes(timestamp + publicKey + salt);
    return ethers.keccak256(preimage);
  }

  /**
   * Generate a cryptographically random 32-byte hex paycard ID.
   *
   * @returns `0x`-prefixed 32-byte hex string
   */
  public static generateRandom(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }

  public static generateMetadataBound(params: {
    payer: string;
    nonceChannel: number | bigint;
    nonceValue: number | bigint;
    metadataHash: string;
    salt?: string;
  }): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'uint256', 'bytes32', 'string'],
        [
          params.payer,
          params.nonceChannel,
          params.nonceValue,
          params.metadataHash,
          params.salt ?? '',
        ],
      ),
    );
  }
}
