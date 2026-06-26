import { ethers } from 'ethers';

export type OpenRailsEnvelopeMode =
  | 'railsflow'
  | 'railscard_bearer'
  | 'railscard_recipient_bound';

export interface CanonicalMetadataV1 {
  version: 'openrails-metadata-v1';
  mode: OpenRailsEnvelopeMode;
  originator: string;
  recipient: string;
  token: string;
  amount: string;
  flowVelocityPerSecond: string;
  lifespanSeconds: number;
  workflowId?: string;
  metadataRef?: string;
  descriptionHash?: string;
  expiresAt?: number;
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry !== undefined) normalized[key] = normalizeValue(entry);
    }
    return normalized;
  }
  return value;
}

export function canonicalizeMetadata(metadata: CanonicalMetadataV1): string {
  return JSON.stringify(normalizeValue(metadata));
}

export function hashOpenRailsMetadata(metadata: CanonicalMetadataV1): string {
  return ethers.keccak256(ethers.toUtf8Bytes(canonicalizeMetadata(metadata)));
}

export function buildMetadataBoundPaycardId(params: {
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
