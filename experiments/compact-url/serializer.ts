import { ethers } from "ethers";

export interface SettlementIntent {
  paycardId: string;
  metadataHash: string;
  recipient: string;
  totalAllocationPool: bigint;
  flowVelocityPerSecond: bigint;
  genesisTimestamp: bigint;
  lifespanSeconds: bigint;
  residualDeltaRecipient: string;
  nonceChannel: bigint;
  nonceValue: bigint;
}

/**
 * 1. Standard JSON string base64url-encoded
 */
export function serializeJSON(intent: SettlementIntent): string {
  const jsonStr = JSON.stringify({
    paycardId: intent.paycardId,
    metadataHash: intent.metadataHash,
    recipient: intent.recipient,
    totalAllocationPool: intent.totalAllocationPool.toString(),
    flowVelocityPerSecond: intent.flowVelocityPerSecond.toString(),
    genesisTimestamp: intent.genesisTimestamp.toString(),
    lifespanSeconds: intent.lifespanSeconds.toString(),
    residualDeltaRecipient: intent.residualDeltaRecipient,
    nonceChannel: intent.nonceChannel.toString(),
    nonceValue: intent.nonceValue.toString(),
  });
  return Buffer.from(jsonStr).toString("base64url");
}

export function deserializeJSON(base64url: string): SettlementIntent {
  const jsonStr = Buffer.from(base64url, "base64url").toString("utf8");
  const obj = JSON.parse(jsonStr);
  return {
    paycardId: obj.paycardId,
    metadataHash: obj.metadataHash,
    recipient: obj.recipient,
    totalAllocationPool: BigInt(obj.totalAllocationPool),
    flowVelocityPerSecond: BigInt(obj.flowVelocityPerSecond),
    genesisTimestamp: BigInt(obj.genesisTimestamp),
    lifespanSeconds: BigInt(obj.lifespanSeconds),
    residualDeltaRecipient: obj.residualDeltaRecipient,
    nonceChannel: BigInt(obj.nonceChannel),
    nonceValue: BigInt(obj.nonceValue),
  };
}

/**
 * 2. Schema-Optimized JSON (Short Keys) base64url-encoded
 * Simulates a key-optimized binary serialization like MsgPack or CBOR
 */
export function serializeSchemaOptimized(intent: SettlementIntent): string {
  const jsonStr = JSON.stringify({
    p: intent.paycardId,
    m: intent.metadataHash,
    r: intent.recipient,
    a: intent.totalAllocationPool.toString(),
    v: intent.flowVelocityPerSecond.toString(),
    g: intent.genesisTimestamp.toString(),
    l: intent.lifespanSeconds.toString(),
    d: intent.residualDeltaRecipient,
    c: intent.nonceChannel.toString(),
    n: intent.nonceValue.toString(),
  });
  return Buffer.from(jsonStr).toString("base64url");
}

export function deserializeSchemaOptimized(base64url: string): SettlementIntent {
  const jsonStr = Buffer.from(base64url, "base64url").toString("utf8");
  const obj = JSON.parse(jsonStr);
  return {
    paycardId: obj.p,
    metadataHash: obj.m,
    recipient: obj.r,
    totalAllocationPool: BigInt(obj.a),
    flowVelocityPerSecond: BigInt(obj.v),
    genesisTimestamp: BigInt(obj.g),
    lifespanSeconds: BigInt(obj.l),
    residualDeltaRecipient: obj.d,
    nonceChannel: BigInt(obj.c),
    nonceValue: BigInt(obj.n),
  };
}

/**
 * 3. Custom Fixed-Offset Binary Encoding
 * Layout (200 bytes):
 * - paycardId: bytes32 (32 bytes)
 * - metadataHash: bytes32 (32 bytes)
 * - recipient: address (20 bytes)
 * - totalAllocationPool: uint256 (32 bytes)
 * - flowVelocityPerSecond: uint256 (32 bytes)
 * - genesisTimestamp: uint64 (8 bytes)
 * - lifespanSeconds: uint64 (8 bytes)
 * - residualDeltaRecipient: address (20 bytes)
 * - nonceChannel: uint64 (8 bytes)
 * - nonceValue: uint64 (8 bytes)
 */
export function serializeCustomBinary(intent: SettlementIntent): string {
  const buf = Buffer.alloc(200);

  // Helper to write bytes32
  const writeBytes32 = (hex: string, offset: number) => {
    const cleanHex = hex.replace("0x", "");
    buf.write(cleanHex, offset, "hex");
  };

  // Helper to write address (20 bytes)
  const writeAddress = (hex: string, offset: number) => {
    const cleanHex = hex.replace("0x", "");
    buf.write(cleanHex, offset, "hex");
  };

  // Helper to write uint256
  const writeUint256 = (val: bigint, offset: number) => {
    let hex = val.toString(16).padStart(64, "0");
    buf.write(hex, offset, "hex");
  };

  writeBytes32(intent.paycardId, 0);
  writeBytes32(intent.metadataHash, 32);
  writeAddress(intent.recipient, 64);
  writeUint256(intent.totalAllocationPool, 84);
  writeUint256(intent.flowVelocityPerSecond, 116);
  buf.writeBigUInt64BE(intent.genesisTimestamp, 148);
  buf.writeBigUInt64BE(intent.lifespanSeconds, 156);
  writeAddress(intent.residualDeltaRecipient, 164);
  buf.writeBigUInt64BE(intent.nonceChannel, 184);
  buf.writeBigUInt64BE(intent.nonceValue, 192);

  return buf.toString("base64url");
}

export function deserializeCustomBinary(base64url: string): SettlementIntent {
  const buf = Buffer.from(base64url, "base64url");
  if (buf.length !== 200) {
    throw new Error(`Invalid custom binary buffer length: ${buf.length}`);
  }

  const readBytes32 = (offset: number) => {
    return "0x" + buf.toString("hex", offset, offset + 32);
  };

  const readAddress = (offset: number) => {
    return ethers.getAddress("0x" + buf.toString("hex", offset, offset + 20));
  };

  const readUint256 = (offset: number) => {
    return BigInt("0x" + buf.toString("hex", offset, offset + 32));
  };

  return {
    paycardId: readBytes32(0),
    metadataHash: readBytes32(32),
    recipient: readAddress(64),
    totalAllocationPool: readUint256(84),
    flowVelocityPerSecond: readUint256(116),
    genesisTimestamp: buf.readBigUInt64BE(148),
    lifespanSeconds: buf.readBigUInt64BE(156),
    residualDeltaRecipient: readAddress(164),
    nonceChannel: buf.readBigUInt64BE(184),
    nonceValue: buf.readBigUInt64BE(192),
  };
}
