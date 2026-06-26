import * as crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

// ---------------------------------------------------------------------------
// Ed25519GatewayKeyPair
// ---------------------------------------------------------------------------

/**
 * Generates and manages an Ed25519 key pair used to sign outbound webhook
 * payloads.  Receiving servers verify authenticity using the public key.
 */
export class Ed25519GatewayKeyPair {
  private readonly privateKey: crypto.KeyObject;
  private readonly publicKey: crypto.KeyObject;

  constructor() {
    const pair = crypto.generateKeyPairSync("ed25519");
    this.privateKey = pair.privateKey;
    this.publicKey = pair.publicKey;
  }

  /**
   * Signs an arbitrary string payload with the private key.
   *
   * @returns Hex-encoded Ed25519 signature.
   */
  sign(payload: string): string {
    const sig = crypto.sign(null, Buffer.from(payload, "utf-8"), this.privateKey);
    return sig.toString("hex");
  }

  /**
   * Returns the public key as a hex string (raw 32-byte encoding).
   */
  getPublicKeyHex(): string {
    const raw = this.publicKey.export({ type: "spki", format: "der" });
    // Ed25519 DER-encoded SPKI public key: the last 32 bytes are the raw key.
    return Buffer.from(raw).subarray(-32).toString("hex");
  }

  /**
   * Verifies a signature against the embedded public key.
   *
   * @param payload   - The original UTF-8 message.
   * @param signature - Hex-encoded signature to verify.
   */
  verify(payload: string, signature: string): boolean {
    try {
      return crypto.verify(
        null,
        Buffer.from(payload, "utf-8"),
        this.publicKey,
        Buffer.from(signature, "hex"),
      );
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// ExponentialBackoffRetryEngine
// ---------------------------------------------------------------------------

/** Default base delay in milliseconds. */
const BASE_DELAY_MS = 500;
/** Absolute ceiling for any single retry delay. */
const MAX_DELAY_MS = 30_000;

/**
 * Delivers JSON payloads to remote webhook endpoints with automatic
 * exponential-backoff retries.
 */
export class ExponentialBackoffRetryEngine {
  /**
   * Attempts to POST a JSON-serialised payload to the given URL.
   *
   * The payload body is signed via the caller-supplied `signFn` and the
   * resulting signature is attached as the `X-OpenRails-Signature` header.
   *
   * @param url        - Destination URL.
   * @param payload    - Object to serialise as JSON.
   * @param signFn     - Signing function (returns hex signature).
   * @param maxRetries - Maximum number of delivery attempts (default 5).
   * @returns `true` if the payload was delivered successfully (2xx).
   */
  async deliver(
    url: string,
    payload: object,
    signFn: (data: string) => string,
    maxRetries: number = 5,
  ): Promise<boolean> {
    const body = JSON.stringify(payload);
    const signature = signFn(body);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-OpenRails-Signature": signature,
          },
          body,
        });

        if (response.ok) return true;

        // Non-retryable client errors (4xx except 429).
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return false;
        }
      } catch {
        // Network-level failure – fall through to retry.
      }

      // Wait with exponential backoff + jitter before retrying.
      if (attempt < maxRetries - 1) {
        const jitter = Math.random() * BASE_DELAY_MS;
        const delay = Math.min(BASE_DELAY_MS * 2 ** attempt + jitter, MAX_DELAY_MS);
        await this.sleep(delay);
      }
    }

    return false;
  }

  /** Promisified sleep helper. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// SignatureVerificationMiddleware
// ---------------------------------------------------------------------------

/**
 * Express-compatible middleware type.
 */
export type Middleware = (
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
  next: () => void,
) => void;

/**
 * Factory that produces Express middleware verifying the
 * `X-OpenRails-Signature` header against the supplied Ed25519 public key.
 *
 * @param publicKeyHex - Raw 32-byte Ed25519 public key as hex.
 * @returns Express middleware function.
 */
export function SignatureVerificationMiddleware(publicKeyHex: string): Middleware {
  // Re-hydrate the public key once at startup.
  const pubKeyBuffer = Buffer.from(publicKeyHex, "hex");
  const publicKey = crypto.createPublicKey({
    key: Buffer.concat([
      // Ed25519 DER prefix for a 32-byte raw public key.
      Buffer.from("302a300506032b6570032100", "hex"),
      pubKeyBuffer,
    ]),
    format: "der",
    type: "spki",
  });

  return (req, res, next) => {
    const signature = req.headers["x-openrails-signature"];
    if (!signature || typeof signature !== "string") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing X-OpenRails-Signature header" }));
      return;
    }

    // The body must already be parsed (e.g. by express.json()).
    const body =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? "");

    try {
      const valid = crypto.verify(
        null,
        Buffer.from(body, "utf-8"),
        publicKey,
        Buffer.from(signature, "hex"),
      );

      if (!valid) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid signature" }));
        return;
      }
    } catch {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Signature verification failed" }));
      return;
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// HeartbeatMonitor
// ---------------------------------------------------------------------------

/**
 * Lightweight availability probe for registered webhook endpoints.
 */
export class HeartbeatMonitor {
  /**
   * Sends a HEAD request (falling back to GET) and returns `true` if the
   * endpoint responds within the timeout.
   *
   * @param url       - Endpoint URL to probe.
   * @param timeoutMs - Maximum wait time in milliseconds (default 5 000).
   */
  async ping(url: string, timeoutMs: number = 5_000): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
