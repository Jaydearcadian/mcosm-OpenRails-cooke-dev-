export interface Env {
  MUSICBRAINZ_REGISTRY: KVNamespace;
  STREAM_DB: D1Database;
  ARC_RPC_URL: string;
  ARC_CHAIN_ID: string;
  OPENRAILS_HUB_ADDRESS: string;
  ARC_USDC_ADDRESS: string;
  WEBHOOK_SECRET?: string;
}

interface ScrobblePayload {
  event?: string;
  track?: {
    mbid?: string;
    artist?: string;
    title?: string;
  };
  paycardId?: string;
}

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
  const headerSecret = request.headers.get("X-OpenRails-Webhook-Secret") || "";
  return bearer === secret || headerSecret === secret;
}

function isBytes32Hex(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Only POST requests allowed" }, 405);
    }

    try {
      const url = new URL(request.url);
      if (url.pathname !== "/webhook/scrobble") {
        return jsonResponse({ error: "Not Found" }, 404);
      }

      if (!env.WEBHOOK_SECRET) {
        return jsonResponse({ error: "Webhook secret is not configured" }, 503);
      }
      if (!authorized(request, env.WEBHOOK_SECRET)) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const payload = (await request.json()) as ScrobblePayload;
      const mbid = payload.track?.mbid;
      const paycardId = payload.paycardId;
      const artistName = payload.track?.artist ?? "Unknown Artist";

      if (!mbid) {
        return jsonResponse({ error: "Missing artist MusicBrainz ID (mbid)" }, 400);
      }

      if (!paycardId) {
        return jsonResponse({ error: "Missing OpenRails paycardId" }, 400);
      }

      if (!isBytes32Hex(paycardId)) {
        return jsonResponse({ error: "Invalid OpenRails paycardId; expected bytes32 hex" }, 400);
      }

      // 1. Resolve artist's wallet address from Cloudflare KV
      const artistWallet = await env.MUSICBRAINZ_REGISTRY.get(mbid);
      if (!artistWallet) {
        return jsonResponse({
          error: `Artist '${artistName}' (MBID: ${mbid}) is not registered in the Payee Registry.`,
        }, 404);
      }

      if (!isEvmAddress(artistWallet)) {
        return jsonResponse({ error: "Registered artist wallet is not a valid EVM address" }, 502);
      }

      // 2. Log play and pending royalty record to D1 SQL database
      const timestamp = Math.floor(Date.now() / 1000);
      const sourceEventId = payload.event?.trim() || null;
      await env.STREAM_DB.prepare(
        "INSERT OR IGNORE INTO plays (source_event_id, paycard_id, artist_mbid, artist_wallet, timestamp, settled, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?)"
      )
        .bind(sourceEventId, paycardId, mbid, artistWallet, timestamp, timestamp)
        .run();

      return jsonResponse({
        success: true,
        message: "Scrobble royalty logged successfully",
        details: {
          artist: artistName,
          mbid,
          wallet: artistWallet,
          paycardId,
          sourceEventId,
        },
      });
    } catch (err) {
      return jsonResponse({ error: (err as Error).message }, 500);
    }
  },
};
