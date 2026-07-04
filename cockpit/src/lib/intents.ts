/**
 * EIP-712 types, metadata hashing, intent builder, and envelope
 * serialization — ported from sdk/src/ using viem (no ethers dep in cockpit).
 */
import { keccak256, toBytes, encodeAbiParameters, zeroAddress } from "viem";

// ---- types ------------------------------------------------------------------

export type OpenRailsEnvelopeMode =
  | "railsflow"
  | "railscard_bearer"
  | "railscard_recipient_bound";

export interface CanonicalMetadataV1 {
  version: "openrails-metadata-v1";
  mode: OpenRailsEnvelopeMode;
  originator: string;
  recipient: string;
  token: string;
  amount: string;
  flowVelocityPerSecond: string;
  lifespanSeconds: number;
  workflowId?: string;
  metadataRef?: string;
}

export interface OpenRailsIntentV1 {
  paycardId: `0x${string}`;
  metadataHash: `0x${string}`;
  recipient: `0x${string}`;
  totalAllocationPool: bigint;
  flowVelocityPerSecond: bigint;
  genesisTimestamp: bigint;
  lifespanSeconds: bigint;
  residualDeltaRecipient: `0x${string}`;
  nonceChannel: bigint;
  nonceValue: bigint;
}

export interface CryptographicEnvelopeV1 {
  payerAddress: string;
  envelopeSignature: string;
  intent: {
    paycardId: string;
    metadataHash: string;
    recipient: string;
    totalAllocationPool: string;
    flowVelocityPerSecond: string;
    genesisTimestamp: number;
    lifespanSeconds: number;
    residualDeltaRecipient: string;
    nonceChannel: number;
    nonceValue: number;
  };
  mode: OpenRailsEnvelopeMode;
  metadata?: CanonicalMetadataV1;
}

// ---- EIP-712 ----------------------------------------------------------------

export const OPENRAILS_EIP712_TYPES = {
  SettlementIntent: [
    { name: "paycardId", type: "bytes32" },
    { name: "metadataHash", type: "bytes32" },
    { name: "recipient", type: "address" },
    { name: "totalAllocationPool", type: "uint256" },
    { name: "flowVelocityPerSecond", type: "uint256" },
    { name: "genesisTimestamp", type: "uint256" },
    { name: "lifespanSeconds", type: "uint256" },
    { name: "residualDeltaRecipient", type: "address" },
    { name: "nonceChannel", type: "uint256" },
    { name: "nonceValue", type: "uint256" },
  ],
} as const;

export function buildOpenRailsDomain(chainId: number, verifyingContract: `0x${string}`) {
  return {
    name: "OpenRails Network",
    version: "2.0.0",
    chainId,
    verifyingContract,
  } as const;
}

// ---- metadata ---------------------------------------------------------------

function normalizeValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalizeValue);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const e = (v as Record<string, unknown>)[k];
      if (e !== undefined) out[k] = normalizeValue(e);
    }
    return out;
  }
  return v;
}

export function canonicalizeMetadata(m: CanonicalMetadataV1): string {
  return JSON.stringify(normalizeValue(m));
}

export function hashOpenRailsMetadata(m: CanonicalMetadataV1): `0x${string}` {
  return keccak256(toBytes(canonicalizeMetadata(m)));
}

// ---- paycardId --------------------------------------------------------------

export function buildMetadataBoundPaycardId(params: {
  payer: `0x${string}`;
  nonceChannel: bigint;
  nonceValue: bigint;
  metadataHash: `0x${string}`;
  salt?: string;
}): `0x${string}` {
  const encoded = encodeAbiParameters(
    [
      { name: "payer", type: "address" },
      { name: "nonceChannel", type: "uint256" },
      { name: "nonceValue", type: "uint256" },
      { name: "metadataHash", type: "bytes32" },
      { name: "salt", type: "string" },
    ],
    [params.payer, params.nonceChannel, params.nonceValue, params.metadataHash, params.salt ?? ""],
  );
  return keccak256(encoded);
}

export function randomPaycardId(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

// ---- velocity unit conversion -----------------------------------------------

export type VelocityUnit = "sec" | "min" | "hr" | "day";
export type LifespanUnit = "sec" | "min" | "hr" | "day";

const UNIT_SECONDS: Record<VelocityUnit, number> = {
  sec: 1,
  min: 60,
  hr: 3600,
  day: 86400,
};

/** Convert a human velocity (USDC per unit) to base-units (6dp) per second. */
export function velocityToBasePerSec(amount: number, unit: VelocityUnit): bigint {
  const usdcPerSec = amount / UNIT_SECONDS[unit];
  return BigInt(Math.round(usdcPerSec * 1_000_000));
}

/** Convert a human lifespan to seconds. */
export function lifespanToSeconds(amount: number, unit: LifespanUnit): bigint {
  return BigInt(Math.round(amount * UNIT_SECONDS[unit]));
}

// ---- envelope serialization -------------------------------------------------

function b64UrlEncode(data: string): string {
  const bytes = new TextEncoder().encode(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64UrlDecode(token: string): string {
  let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  base64 += "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function serializeEnvelope(payload: object): string {
  return b64UrlEncode(JSON.stringify(payload));
}

export function deserializeEnvelope<T>(token: string): T {
  return JSON.parse(b64UrlDecode(token)) as T;
}

// ---- ZERO_ADDRESS -----------------------------------------------------------

export const ZERO_ADDRESS = zeroAddress;
