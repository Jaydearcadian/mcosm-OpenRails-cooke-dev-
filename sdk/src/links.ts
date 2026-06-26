import { ethers } from 'ethers';

import type { OpenRailsEnvelopeMode } from './metadata';
import {
  base64UrlDecodeBytes,
  base64UrlEncodeBytes,
  deserializeEnvelope,
  serializeEnvelope,
} from './serialization';

export type OpenRailsLinkKindV1 = 'railsflow' | 'railscard';

export interface RailsFlowLinkPayloadV1 {
  mode: 'railsflow';
  merchant: string;
  recipient: string;
  amount: string;
  flowVelocityPerSecond: string;
  lifespanSeconds: number;
  workflowId?: string;
  metadataRef?: string;
  descriptionHash?: string;
  expiresAt?: number;
}

export interface RailsCardLinkPayloadV1 {
  mode: 'railscard_bearer' | 'railscard_recipient_bound';
  envelopeToken: string;
  claimHint?: string;
}

export interface SignedEnvelopeLinkPayloadV1 {
  mode: OpenRailsEnvelopeMode;
  envelopeToken: string;
}

export interface OpenRailsLinkArtifactV1 {
  version: 'openrails-link-v1';
  kind: OpenRailsLinkKindV1;
  chainId: number;
  vault: string;
  token: string;
  metadataHash: string;
  payload: RailsFlowLinkPayloadV1 | RailsCardLinkPayloadV1 | SignedEnvelopeLinkPayloadV1;
}

const COMPACT_LINK_PREFIX = 'orc1:';
const COMPACT_PROFILE_FLOW = 'f';
const COMPACT_PROFILE_CLAIM = 'c';

export function serializeOpenRailsLinkArtifact(artifact: OpenRailsLinkArtifactV1): string {
  validateOpenRailsLinkArtifact(artifact);
  return serializeCompactOpenRailsLinkArtifact(artifact);
}

export function deserializeOpenRailsLinkArtifact(token: string): OpenRailsLinkArtifactV1 {
  if (token.startsWith(COMPACT_LINK_PREFIX)) {
    return deserializeCompactOpenRailsLinkArtifact(token);
  }
  const artifact = deserializeEnvelope<OpenRailsLinkArtifactV1>(token);
  validateOpenRailsLinkArtifact(artifact);
  return artifact;
}

export function serializeLegacyOpenRailsLinkArtifact(artifact: OpenRailsLinkArtifactV1): string {
  validateOpenRailsLinkArtifact(artifact);
  return serializeEnvelope(artifact);
}

export function serializeCompactOpenRailsLinkArtifact(artifact: OpenRailsLinkArtifactV1): string {
  validateOpenRailsLinkArtifact(artifact);
  const profile = selectCompactProfile(artifact);
  const writer = new CompactWriter();
  writeCommonArtifact(writer, artifact);

  if (profile === COMPACT_PROFILE_FLOW) {
    const payload = artifact.payload as RailsFlowLinkPayloadV1;
    writer.writeAddress(payload.merchant);
    writer.writeAddress(payload.recipient);
    writer.writeString(payload.amount);
    writer.writeString(payload.flowVelocityPerSecond);
    writer.writeUint64(BigInt(payload.lifespanSeconds));
    writeOptionalString(writer, payload.metadataRef);
    writeOptionalBytes32(writer, payload.descriptionHash);
    writeOptionalUint64(writer, payload.expiresAt);
    writeOptionalString(writer, payload.workflowId);
    return `${COMPACT_LINK_PREFIX}${profile}.${base64UrlEncodeBytes(writer.toBytes())}`;
  }

  const payload = artifact.payload as RailsCardLinkPayloadV1 | SignedEnvelopeLinkPayloadV1;
  const kindMode = artifact.kind === 'railsflow' ? 0 : payload.mode === 'railscard_bearer' ? 1 : 2;
  writer.writeUint8(kindMode);
  writer.writeString(payload.envelopeToken);
  writeOptionalString(writer, 'claimHint' in payload ? payload.claimHint : undefined);
  return `${COMPACT_LINK_PREFIX}${profile}.${base64UrlEncodeBytes(writer.toBytes())}`;
}

export function deserializeCompactOpenRailsLinkArtifact(token: string): OpenRailsLinkArtifactV1 {
  if (!token.startsWith(COMPACT_LINK_PREFIX)) {
    throw new Error('Unsupported compact OpenRails link prefix');
  }
  const body = token.slice(COMPACT_LINK_PREFIX.length);
  const separator = body.indexOf('.');
  if (separator <= 0) throw new Error('Malformed compact OpenRails link token');

  const profile = body.slice(0, separator);
  if (profile !== COMPACT_PROFILE_FLOW && profile !== COMPACT_PROFILE_CLAIM) {
    throw new Error('Unknown compact OpenRails link profile');
  }
  const bytes = base64UrlDecodeBytes(body.slice(separator + 1));
  const reader = new CompactReader(bytes);
  const common = readCommonArtifact(reader);
  let artifact: OpenRailsLinkArtifactV1 | undefined;

  if (profile === COMPACT_PROFILE_FLOW) {
    artifact = {
      ...common,
      kind: 'railsflow',
      payload: {
        mode: 'railsflow',
        merchant: reader.readAddress(),
        recipient: reader.readAddress(),
        amount: reader.readString(),
        flowVelocityPerSecond: reader.readString(),
        lifespanSeconds: Number(reader.readUint64()),
        metadataRef: readOptionalString(reader),
        descriptionHash: readOptionalBytes32(reader),
        expiresAt: readOptionalNumber(reader),
        workflowId: readOptionalString(reader),
      },
    };
  } else if (profile === COMPACT_PROFILE_CLAIM) {
    const kindMode = reader.readUint8();
    const envelopeToken = reader.readString();
    const claimHint = readOptionalString(reader);
    if (kindMode === 0) {
      artifact = {
        ...common,
        kind: 'railsflow',
        payload: {
          mode: 'railsflow',
          envelopeToken,
        },
      };
    } else if (kindMode === 1 || kindMode === 2) {
      artifact = {
        ...common,
        kind: 'railscard',
        payload: {
          mode: kindMode === 1 ? 'railscard_bearer' : 'railscard_recipient_bound',
          envelopeToken,
          claimHint,
        },
      };
    } else {
      throw new Error('Unknown compact OpenRails claim mode');
    }
  }

  if (!artifact) throw new Error('Malformed compact OpenRails link token');
  if (!reader.done()) throw new Error('Compact OpenRails link has trailing bytes');
  validateOpenRailsLinkArtifact(artifact);
  return artifact;
}

export function createOpenRailsLinkUrl(
  appBaseUrl: string,
  artifact: OpenRailsLinkArtifactV1,
): string {
  const url = new URL(appBaseUrl);
  const route = artifact.kind === 'railsflow' ? '/openrails/flow' : '/openrails/card';
  url.pathname = route;
  url.search = '';
  url.hash = `or=${serializeOpenRailsLinkArtifact(artifact)}`;
  return url.toString();
}

export function parseOpenRailsLink(input: string): OpenRailsLinkArtifactV1 {
  const token = extractOpenRailsLinkToken(input);
  return deserializeOpenRailsLinkArtifact(token);
}

export function createRailsFlowRequestLink(params: {
  appBaseUrl: string;
  chainId: number;
  vault: string;
  token: string;
  metadataHash: string;
  payload: RailsFlowLinkPayloadV1;
}): string {
  return createOpenRailsLinkUrl(params.appBaseUrl, {
    version: 'openrails-link-v1',
    kind: 'railsflow',
    chainId: params.chainId,
    vault: params.vault,
    token: params.token,
    metadataHash: params.metadataHash,
    payload: params.payload,
  });
}

export function createRailsCardClaimLink(params: {
  appBaseUrl: string;
  chainId: number;
  vault: string;
  token: string;
  metadataHash: string;
  mode: Extract<OpenRailsEnvelopeMode, 'railscard_bearer' | 'railscard_recipient_bound'>;
  envelopeToken: string;
  claimHint?: string;
}): string {
  return createOpenRailsLinkUrl(params.appBaseUrl, {
    version: 'openrails-link-v1',
    kind: 'railscard',
    chainId: params.chainId,
    vault: params.vault,
    token: params.token,
    metadataHash: params.metadataHash,
    payload: {
      mode: params.mode,
      envelopeToken: params.envelopeToken,
      claimHint: params.claimHint,
    },
  });
}

function extractOpenRailsLinkToken(input: string): string {
  if (!input.includes('://') && !input.startsWith('/')) return input;
  const url = new URL(input, 'https://openrails.local');
  const fragment = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const params = new URLSearchParams(fragment);
  const token = params.get('or');
  if (!token) throw new Error('OpenRails link is missing #or fragment');
  return token;
}

function selectCompactProfile(artifact: OpenRailsLinkArtifactV1): string {
  if (artifact.kind === 'railsflow' && !('envelopeToken' in artifact.payload)) {
    return COMPACT_PROFILE_FLOW;
  }
  return COMPACT_PROFILE_CLAIM;
}

function writeCommonArtifact(writer: CompactWriter, artifact: OpenRailsLinkArtifactV1): void {
  writer.writeUint32(artifact.chainId);
  writer.writeAddress(artifact.vault);
  writer.writeAddress(artifact.token);
  writer.writeBytes32(artifact.metadataHash);
}

function readCommonArtifact(reader: CompactReader): Omit<OpenRailsLinkArtifactV1, 'kind' | 'payload'> {
  return {
    version: 'openrails-link-v1',
    chainId: reader.readUint32(),
    vault: reader.readAddress(),
    token: reader.readAddress(),
    metadataHash: reader.readBytes32(),
  };
}

function writeOptionalString(writer: CompactWriter, value?: string): void {
  writer.writeUint8(value ? 1 : 0);
  if (value) writer.writeString(value);
}

function readOptionalString(reader: CompactReader): string | undefined {
  return reader.readUint8() === 1 ? reader.readString() : undefined;
}

function writeOptionalBytes32(writer: CompactWriter, value?: string): void {
  writer.writeUint8(value ? 1 : 0);
  if (value) writer.writeBytes32(value);
}

function readOptionalBytes32(reader: CompactReader): string | undefined {
  return reader.readUint8() === 1 ? reader.readBytes32() : undefined;
}

function writeOptionalUint64(writer: CompactWriter, value?: number): void {
  writer.writeUint8(value === undefined ? 0 : 1);
  if (value !== undefined) writer.writeUint64(BigInt(value));
}

function readOptionalNumber(reader: CompactReader): number | undefined {
  return reader.readUint8() === 1 ? Number(reader.readUint64()) : undefined;
}

function hexToBytes(hex: string, expectedBytes: number): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length !== expectedBytes * 2 || !/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error(`Expected ${expectedBytes} bytes hex value`);
  }
  const bytes = new Uint8Array(expectedBytes);
  for (let i = 0; i < expectedBytes; i += 1) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return `0x${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

class CompactWriter {
  private readonly chunks: number[] = [];
  private readonly textEncoder = new TextEncoder();

  writeUint8(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new Error('uint8 out of range');
    this.chunks.push(value);
  }

  writeUint32(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error('uint32 out of range');
    this.chunks.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
  }

  writeUint64(value: bigint): void {
    if (value < 0n || value > 0xffffffffffffffffn) throw new Error('uint64 out of range');
    for (let shift = 56n; shift >= 0n; shift -= 8n) {
      this.chunks.push(Number((value >> shift) & 0xffn));
    }
  }

  writeBytes(bytes: Uint8Array): void {
    for (const byte of bytes) this.chunks.push(byte);
  }

  writeAddress(value: string): void {
    this.writeBytes(hexToBytes(ethers.getAddress(value), 20));
  }

  writeBytes32(value: string): void {
    this.writeBytes(hexToBytes(value, 32));
  }

  writeString(value: string): void {
    const bytes = this.textEncoder.encode(value);
    if (bytes.length > 0xffff) throw new Error('Compact string too long');
    this.chunks.push((bytes.length >>> 8) & 0xff, bytes.length & 0xff);
    this.writeBytes(bytes);
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}

class CompactReader {
  private offset = 0;
  private readonly textDecoder = new TextDecoder();

  constructor(private readonly bytes: Uint8Array) {}

  done(): boolean {
    return this.offset === this.bytes.length;
  }

  readUint8(): number {
    this.require(1);
    return this.bytes[this.offset++];
  }

  readUint32(): number {
    this.require(4);
    const value =
      this.bytes[this.offset] * 0x1000000 +
      ((this.bytes[this.offset + 1] << 16) >>> 0) +
      (this.bytes[this.offset + 2] << 8) +
      this.bytes[this.offset + 3];
    this.offset += 4;
    return value;
  }

  readUint64(): bigint {
    this.require(8);
    let value = 0n;
    for (let i = 0; i < 8; i += 1) {
      value = (value << 8n) + BigInt(this.bytes[this.offset + i]);
    }
    this.offset += 8;
    return value;
  }

  readAddress(): string {
    return ethers.getAddress(bytesToHex(this.readBytes(20)));
  }

  readBytes32(): string {
    return bytesToHex(this.readBytes(32));
  }

  readString(): string {
    this.require(2);
    const length = (this.bytes[this.offset] << 8) + this.bytes[this.offset + 1];
    this.offset += 2;
    return this.textDecoder.decode(this.readBytes(length));
  }

  private readBytes(length: number): Uint8Array {
    this.require(length);
    const value = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  private require(length: number): void {
    if (this.offset + length > this.bytes.length) {
      throw new Error('Malformed compact OpenRails link payload');
    }
  }
}

function validateOpenRailsLinkArtifact(artifact: OpenRailsLinkArtifactV1): void {
  if (artifact.version !== 'openrails-link-v1') {
    throw new Error('Unsupported OpenRails link version');
  }
  if (artifact.kind !== 'railsflow' && artifact.kind !== 'railscard') {
    throw new Error('Unsupported OpenRails link kind');
  }
  if (!ethers.isAddress(artifact.vault) || artifact.vault === ethers.ZeroAddress) {
    throw new Error('OpenRails link vault must be a non-zero address');
  }
  if (!ethers.isAddress(artifact.token) || artifact.token === ethers.ZeroAddress) {
    throw new Error('OpenRails link token must be a non-zero address');
  }
  if (!ethers.isHexString(artifact.metadataHash, 32)) {
    throw new Error('OpenRails link metadataHash must be bytes32');
  }
  if (artifact.chainId <= 0 || !Number.isInteger(artifact.chainId)) {
    throw new Error('OpenRails link chainId must be a positive integer');
  }

  if (artifact.kind === 'railsflow') {
    const payload = artifact.payload as RailsFlowLinkPayloadV1 | SignedEnvelopeLinkPayloadV1;
    if (payload.mode !== 'railsflow') throw new Error('RailsFlow link payload mode mismatch');
    if ('envelopeToken' in payload) {
      if (!payload.envelopeToken) throw new Error('Signed RailsFlow link requires an envelopeToken');
      return;
    }
    if (!ethers.isAddress(payload.merchant) || payload.merchant === ethers.ZeroAddress) {
      throw new Error('RailsFlow merchant must be a non-zero address');
    }
    if (!ethers.isAddress(payload.recipient) || payload.recipient === ethers.ZeroAddress) {
      throw new Error('RailsFlow recipient must be a non-zero address');
    }
    return;
  }

  const payload = artifact.payload as RailsCardLinkPayloadV1;
  if (payload.mode !== 'railscard_bearer' && payload.mode !== 'railscard_recipient_bound') {
    throw new Error('RailsCard link payload mode mismatch');
  }
  if (!payload.envelopeToken) {
    throw new Error('RailsCard link requires an envelopeToken');
  }
}
