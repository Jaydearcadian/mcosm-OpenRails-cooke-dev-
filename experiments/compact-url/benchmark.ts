import {
  SettlementIntent,
  serializeJSON,
  deserializeJSON,
  serializeSchemaOptimized,
  deserializeSchemaOptimized,
  serializeCustomBinary,
  deserializeCustomBinary,
} from "./serializer";

function assertEqual(actual: any, expected: any, label: string) {
  if (actual.toString() !== expected.toString()) {
    throw new Error(`Assertion failed for ${label}: expected ${expected}, got ${actual}`);
  }
}

function verifyIntent(intent: SettlementIntent, deserialized: SettlementIntent, method: string) {
  assertEqual(deserialized.paycardId, intent.paycardId, `${method}.paycardId`);
  assertEqual(deserialized.metadataHash, intent.metadataHash, `${method}.metadataHash`);
  assertEqual(deserialized.recipient, intent.recipient, `${method}.recipient`);
  assertEqual(deserialized.totalAllocationPool, intent.totalAllocationPool, `${method}.totalAllocationPool`);
  assertEqual(deserialized.flowVelocityPerSecond, intent.flowVelocityPerSecond, `${method}.flowVelocityPerSecond`);
  assertEqual(deserialized.genesisTimestamp, intent.genesisTimestamp, `${method}.genesisTimestamp`);
  assertEqual(deserialized.lifespanSeconds, intent.lifespanSeconds, `${method}.lifespanSeconds`);
  assertEqual(deserialized.residualDeltaRecipient, intent.residualDeltaRecipient, `${method}.residualDeltaRecipient`);
  assertEqual(deserialized.nonceChannel, intent.nonceChannel, `${method}.nonceChannel`);
  assertEqual(deserialized.nonceValue, intent.nonceValue, `${method}.nonceValue`);
}

function main() {
  const sampleIntent: SettlementIntent = {
    paycardId: "0xbda57167aa107ecb66225ccb5f1c0249a830b5167c18680ae1b7fe3f54e2cdbe",
    metadataHash: "0x3a00000000000000000000000000000000000000000000000000000000000000",
    recipient: "0xaA945EE7a55b5998d32A17C1EcF6050d9De7120A",
    totalAllocationPool: 100000000n, // 100 USDC (6 decimals)
    flowVelocityPerSecond: 100n,      // 0.0001 USDC/sec
    genesisTimestamp: 1719320000n,
    lifespanSeconds: 3600n,
    residualDeltaRecipient: "0x1A76BFE6bF7A4BfD854b16C19Dd870e0DE56473C",
    nonceChannel: 1000n,
    nonceValue: 42n,
  };

  console.log("=== Running OpenRails Compact Serializer Benchmark ===");

  // Helper to stringify BigInt values for JSON sizing comparison
  const stringifiedIntent = {
    paycardId: sampleIntent.paycardId,
    metadataHash: sampleIntent.metadataHash,
    recipient: sampleIntent.recipient,
    totalAllocationPool: sampleIntent.totalAllocationPool.toString(),
    flowVelocityPerSecond: sampleIntent.flowVelocityPerSecond.toString(),
    genesisTimestamp: sampleIntent.genesisTimestamp.toString(),
    lifespanSeconds: sampleIntent.lifespanSeconds.toString(),
    residualDeltaRecipient: sampleIntent.residualDeltaRecipient,
    nonceChannel: sampleIntent.nonceChannel.toString(),
    nonceValue: sampleIntent.nonceValue.toString(),
  };

  // 1. JSON
  const jsonStr = serializeJSON(sampleIntent);
  const jsonDec = deserializeJSON(jsonStr);
  verifyIntent(sampleIntent, jsonDec, "JSON");
  const jsonRawBytes = Buffer.from(JSON.stringify(stringifiedIntent)).length;

  // 2. Schema-Optimized JSON (MsgPack-like index)
  const optStr = serializeSchemaOptimized(sampleIntent);
  const optDec = deserializeSchemaOptimized(optStr);
  verifyIntent(sampleIntent, optDec, "SchemaOptimized");
  const optRawBytes = Buffer.from(JSON.stringify({
    p: sampleIntent.paycardId,
    m: sampleIntent.metadataHash,
    r: sampleIntent.recipient,
    a: sampleIntent.totalAllocationPool.toString(),
    v: sampleIntent.flowVelocityPerSecond.toString(),
    g: sampleIntent.genesisTimestamp.toString(),
    l: sampleIntent.lifespanSeconds.toString(),
    d: sampleIntent.residualDeltaRecipient,
    c: sampleIntent.nonceChannel.toString(),
    n: sampleIntent.nonceValue.toString(),
  })).length;

  // 3. Custom Binary
  const binStr = serializeCustomBinary(sampleIntent);
  const binDec = deserializeCustomBinary(binStr);
  verifyIntent(sampleIntent, binDec, "CustomBinary");
  const binRawBytes = 200; // Fixed size

  console.log("\nSerialization Size Results:\n");
  console.log("| Serialization Format    | Raw Byte Size | Base64URL URL String Length | Size Reduction |");
  console.log("|-------------------------|---------------|-----------------------------|----------------|");

  const jsonLen = jsonStr.length;
  const optLen = optStr.length;
  const binLen = binStr.length;

  const reductionOpt = ((jsonLen - optLen) / jsonLen * 100).toFixed(1) + "%";
  const reductionBin = ((jsonLen - binLen) / jsonLen * 100).toFixed(1) + "%";

  console.log(`| 1. Standard JSON        | ${jsonRawBytes} B         | ${jsonLen} chars                    | Reference      |`);
  console.log(`| 2. Schema-Optimized JSON| ${optRawBytes} B         | ${optLen} chars                    | ${reductionOpt} reduction |`);
  console.log(`| 3. Custom Binary        | ${binRawBytes} B         | ${binLen} chars                    | ${reductionBin} reduction |`);

  console.log("\nTest Verification: SUCCESS (All deserialized formats match input payload exactly).");
}

main();
