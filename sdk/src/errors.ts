/**
 * @module errors
 * @description Custom error hierarchy for the OpenRails V1 arc-policy-envelope layer.
 * Each error carries structured context to aid diagnostics without leaking secrets.
 */

/**
 * Thrown when envelope payload serialization or deserialization fails.
 * Carries an optional list of field names that caused the failure.
 */
export class PayloadSerializationError extends Error {
  public readonly invalidFields: string[];

  constructor(message: string, invalidFields: string[] = []) {
    super(message);
    this.name = 'PayloadSerializationError';
    this.invalidFields = invalidFields;
  }
}

/**
 * Thrown when the EIP-712 signature sanity check fails — i.e. the address
 * recovered from the signature does not match the expected signer wallet.
 */
export class SignatureVerificationError extends Error {
  public readonly expectedSigner: string;
  public readonly recoveredSigner: string;

  constructor(expected: string, recovered: string) {
    super(
      `Signature verification failed: expected ${expected}, recovered ${recovered}`,
    );
    this.name = 'SignatureVerificationError';
    this.expectedSigner = expected;
    this.recoveredSigner = recovered;
  }
}

/**
 * Thrown when the intent's `genesisTimestamp` exceeds the local clock plus the
 * configured buffer, indicating either a misconfigured clock or a crafted
 * future-dated intent that the clearinghouse would reject.
 */
export class ClockSkewError extends Error {
  public readonly localTime: number;
  public readonly genesisTimestamp: number;
  public readonly bufferSeconds: number;

  constructor(localTime: number, genesis: number, buffer: number) {
    super(
      `Clock skew detected: genesis ${genesis} exceeds local time ${localTime} + buffer ${buffer}`,
    );
    this.name = 'ClockSkewError';
    this.localTime = localTime;
    this.genesisTimestamp = genesis;
    this.bufferSeconds = buffer;
  }
}
