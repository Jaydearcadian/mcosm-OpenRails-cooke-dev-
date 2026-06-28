/**
 * Real paid x402 smoke buyer for the OpenRails artifact endpoint (Arc testnet).
 *
 * Unlike the mock harness (`x402-smoke-harness.ts`), this pays the *real* server
 * endpoint through Circle's Gateway facilitator on Arc testnet. It signs a gasless
 * `TransferWithAuthorization`, lets the facilitator settle, retries the gated request,
 * then validates the returned OpenRails artifact and prints a capture-ready result block.
 *
 * Safety: the buyer key is read from `X402_BUYER_PRIVATE_KEY` only — never argv, never
 * logged. The artifact must keep `vaultEscrowClaimed: false` (x402 payment proof is not
 * Vault escrow proof).
 *
 *   X402_BUYER_PRIVATE_KEY=0x... \
 *   X402_SMOKE_URL=http://localhost:3001/api/x402/openrails-artifact \
 *   npm run smoke:x402:paid
 */
// Mirror the typed-require pattern used in server/index.ts for this package's subpath
// exports — ts-node's classic module resolution does not type-resolve the "exports" subpaths.
type PayResult = {
  status: number;
  data: unknown;
  transaction?: string;
  formattedAmount?: string;
};
const { GatewayClient } = require("@circle-fin/x402-batching/client") as {
  GatewayClient: new (config: { chain: string; privateKey: `0x${string}` }) => {
    pay(url: string): Promise<PayResult>;
  };
};

const DEFAULT_URL = "http://localhost:3001/api/x402/openrails-artifact";

const REQUIRED_X402_FIELDS = ["payer", "amount", "network", "facilitatorUrl"] as const;
const REQUIRED_OPENRAILS_FIELDS = [
  "chainId",
  "vaultAddress",
  "tokenAddress",
  "serviceOrigin",
  "scope",
  "metadataHash",
  "vaultEscrowClaimed",
] as const;

function fail(message: string): never {
  console.error(`\n[x402 paid smoke] FAIL: ${message}`);
  process.exit(1);
}

function readPrivateKey(): `0x${string}` {
  const key = process.env.X402_BUYER_PRIVATE_KEY;
  if (!key) {
    fail(
      "X402_BUYER_PRIVATE_KEY is not set.\n" +
        "  Provide the funded Arc-testnet buyer key via the environment (never on argv):\n" +
        "    X402_BUYER_PRIVATE_KEY=0x... npm run smoke:x402:paid",
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    fail("X402_BUYER_PRIVATE_KEY must be a 0x-prefixed 32-byte (64 hex char) private key.");
  }
  return key as `0x${string}`;
}

async function main(): Promise<void> {
  const privateKey = readPrivateKey();
  const url = process.env.X402_SMOKE_URL || process.argv[2] || DEFAULT_URL;

  console.log("[x402 paid smoke] OpenRails paid x402 artifact smoke (Arc testnet)");
  console.log(`[x402 paid smoke] target: ${url}`);
  console.log("[x402 paid smoke] paying via Circle Gateway (gasless TransferWithAuthorization)...");

  const client = new GatewayClient({ chain: "arcTestnet", privateKey });

  const result = (await client.pay(url).catch((err: any) =>
    fail(
      `pay() failed before/while settling: ${err?.message ?? err}\n` +
        "  Common causes: insufficient Arc-testnet USDC, facilitator unreachable, or the " +
        "server is not running in arc-testnet mode.",
    ),
  )) as { status: number; data: any; transaction?: string; formattedAmount?: string };

  const { status, data } = result;
  console.log(`[x402 paid smoke] HTTP status: ${status}`);

  if (status === 402) {
    fail("Server still returned 402 Payment Required after pay() — payment was not accepted.");
  }
  if (status !== 200) {
    fail(`Expected HTTP 200, got ${status}. Body: ${JSON.stringify(data)}`);
  }
  if (!data || typeof data !== "object") {
    fail("200 response had no JSON artifact body.");
  }

  const x402 = (data as any).x402;
  const openrails = (data as any).openrails;
  if (!x402 || !openrails) {
    fail(`Artifact missing x402/openrails sections: ${JSON.stringify(data)}`);
  }

  const missing: string[] = [];
  for (const f of REQUIRED_X402_FIELDS) {
    if (x402[f] === undefined || x402[f] === null || x402[f] === "") missing.push(`x402.${f}`);
  }
  for (const f of REQUIRED_OPENRAILS_FIELDS) {
    if (openrails[f] === undefined || openrails[f] === null) missing.push(`openrails.${f}`);
  }
  if (missing.length) {
    fail(`Artifact missing required fields: ${missing.join(", ")}`);
  }

  if (openrails.vaultEscrowClaimed !== false) {
    fail(
      `Invariant violated: openrails.vaultEscrowClaimed must be false, got ${openrails.vaultEscrowClaimed}`,
    );
  }

  // settlementId may be empty in the artifact if the facilitator hasn't returned one yet;
  // fall back to pay()'s settlement transaction id. Settlement batches on-chain in ~minutes.
  const settlementId = x402.settlementId || result.transaction || "(pending)";

  const captured = {
    httpStatus: status,
    paidAmountUsdc: result.formattedAmount ?? null,
    x402: {
      payer: x402.payer,
      amount: x402.amount,
      network: x402.network,
      settlementId,
      facilitatorUrl: x402.facilitatorUrl,
    },
    openrails: {
      chainId: openrails.chainId,
      vaultAddress: openrails.vaultAddress,
      tokenAddress: openrails.tokenAddress,
      serviceOrigin: openrails.serviceOrigin,
      scope: openrails.scope,
      metadataHash: openrails.metadataHash,
      vaultEscrowClaimed: openrails.vaultEscrowClaimed,
      openRailsSettlementStage: openrails.openRailsSettlementStage ?? null,
    },
  };

  console.log(
    "\n[x402 paid smoke] PASS — paid x402 settlement accepted; artifact returned with vaultEscrowClaimed=false.",
  );
  if (!x402.settlementId) {
    console.log(
      "[x402 paid smoke] note: artifact settlementId was empty; using pay() settlement id. " +
        "On-chain batch lands in ~minutes (decode with circle-agent/decode-batch.ts).",
    );
  }
  console.log("\n===== PAID RUN RESULT (paste into x402-smoke-results.md) =====");
  console.log(JSON.stringify(captured, null, 2));
  console.log("===== END PAID RUN RESULT =====\n");
}

main().catch((err) => {
  console.error(`[x402 paid smoke] unexpected error: ${err?.message ?? err}`);
  process.exit(1);
});
