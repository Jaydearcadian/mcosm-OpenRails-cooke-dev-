import { ethers } from "ethers";

export interface Env {
  STREAM_DB: D1Database;
  ARC_RPC_URL: string;
  ARC_CHAIN_ID: string;
  OPENRAILS_HUB_ADDRESS: string;
  RECONCILIATION_SIGNER_KEY?: string; // Private key secret loaded from Wrangler
  RECONCILIATION_ADMIN_TOKEN?: string;
  RECONCILIATION_BATCH_LIMIT?: string;
  MAX_SETTLEMENT_ATTEMPTS?: string;
}

const HUB_ABI = [
  "function processDripSettle(bytes32 paycardId) external",
  "function registry(bytes32 paycardId) external view returns (address payer, address recipient, bytes32 metadataHash, uint256 totalAllocationPool, uint256 availableBalance, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds, uint256 lastCheckpointEpoch, address residualDeltaRecipient, uint8 operationalStatus)"
];

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authorized(request: Request, secret?: string): boolean {
  if (!secret) return false;
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const headerSecret = request.headers.get("X-OpenRails-Admin-Token") || "";
  return bearer === secret || headerSecret === secret;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default {
  async scheduled(event: any, env: Env, ctx: any): Promise<void> {
    ctx.waitUntil(this.reconcileStreams(env));
  },

  // Also expose as an authenticated POST request for manual testing/debugging.
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname !== "/reconcile") {
        return jsonResponse({ error: "Not Found" }, 404);
      }
      if (request.method !== "POST") {
        return jsonResponse({ error: "Only POST requests allowed" }, 405);
      }
      if (!env.RECONCILIATION_ADMIN_TOKEN) {
        return jsonResponse({ error: "Reconciliation admin token is not configured" }, 503);
      }
      if (!authorized(request, env.RECONCILIATION_ADMIN_TOKEN)) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      await this.reconcileStreams(env);
      return jsonResponse({ success: true, message: "Reconciliation triggered successfully" });
    } catch (err) {
      return jsonResponse({ error: (err as Error).message }, 500);
    }
  },

  async reconcileStreams(env: Env): Promise<void> {
    if (!env.RECONCILIATION_SIGNER_KEY) {
      console.warn("[reconciliation-worker] Aborting: RECONCILIATION_SIGNER_KEY is not configured.");
      return;
    }

    const maxAttempts = readPositiveInt(env.MAX_SETTLEMENT_ATTEMPTS, 5);
    const batchLimit = readPositiveInt(env.RECONCILIATION_BATCH_LIMIT, 10);

    // 1. Fetch unique paycardIds with pending (unsettled) play counts
    const { results } = await env.STREAM_DB.prepare(
      "SELECT DISTINCT paycard_id FROM plays WHERE settled = 0 AND settlement_attempts < ? LIMIT ?"
    ).bind(maxAttempts, batchLimit).all();

    if (!results || results.length === 0) {
      console.log("[reconciliation-worker] No pending royalties to settle.");
      return;
    }

    // 2. Initialize provider and wallet signer
    const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL);
    const signer = new ethers.Wallet(env.RECONCILIATION_SIGNER_KEY, provider);
    const hub = new ethers.Contract(env.OPENRAILS_HUB_ADDRESS, HUB_ABI, signer);

    console.log(`[reconciliation-worker] Found ${results.length} paycard streams needing settlement.`);

    for (const row of results) {
      const paycardId = row.paycard_id as string;
      if (!ethers.isHexString(paycardId, 32)) {
        console.warn(`[reconciliation-worker] Invalid paycardId ${paycardId}. Marking as skipped.`);
        await env.STREAM_DB.prepare(
          "UPDATE plays SET settled = 2, last_error = ?, updated_at = ? WHERE paycard_id = ? AND settled = 0"
        ).bind("invalid paycardId", Math.floor(Date.now() / 1000), paycardId).run();
        continue;
      }

      const locked = await env.STREAM_DB.prepare(
        "UPDATE plays SET settled = 3, settlement_attempts = settlement_attempts + 1, updated_at = ? WHERE paycard_id = ? AND settled = 0 AND settlement_attempts < ?"
      ).bind(Math.floor(Date.now() / 1000), paycardId, maxAttempts).run();

      if ((locked.meta?.changes ?? 0) === 0) {
        console.log(`[reconciliation-worker] Skipping ${paycardId}; no pending rows could be locked.`);
        continue;
      }

      try {
        // Double-check stream state on-chain: is it active?
        const stream = await hub.registry(paycardId);
        const operationalStatus = Number(stream.operationalStatus); // 0 = Active, 1 = Terminated

        if (operationalStatus !== 0) {
          console.warn(`[reconciliation-worker] Stream ${paycardId} is not Active (Status: ${operationalStatus}). Marking as skipped.`);
          // Mark as settled/processed to avoid infinite retry loops
          await env.STREAM_DB.prepare(
            "UPDATE plays SET settled = 2, last_error = ?, updated_at = ? WHERE paycard_id = ? AND settled = 3"
          ).bind(`inactive status ${operationalStatus}`, Math.floor(Date.now() / 1000), paycardId).run();
          continue;
        }

        // 3. Broadcast processDripSettle onchain to pull USDC
        console.log(`[reconciliation-worker] Sending settlement for paycard: ${paycardId}`);
        const tx = await hub.processDripSettle(paycardId);
        await tx.wait(); // Wait for transaction confirmation
        console.log(`[reconciliation-worker] Settlement transaction confirmed: ${tx.hash}`);

        // 4. Update plays in D1 cache to mark as settled (1 = settled)
        await env.STREAM_DB.prepare(
          "UPDATE plays SET settled = 1, last_error = NULL, updated_at = ? WHERE paycard_id = ? AND settled = 3"
        ).bind(Math.floor(Date.now() / 1000), paycardId).run();

      } catch (error) {
        console.error(`[reconciliation-worker] Failed to settle stream ${paycardId}:`, error);
        const message = (error as Error).message?.slice(0, 500) || "settlement failed";
        await env.STREAM_DB.prepare(
          "UPDATE plays SET settled = CASE WHEN settlement_attempts >= ? THEN 2 ELSE 0 END, last_error = ?, updated_at = ? WHERE paycard_id = ? AND settled = 3"
        ).bind(maxAttempts, message, Math.floor(Date.now() / 1000), paycardId).run();
      }
    }
  }
};
