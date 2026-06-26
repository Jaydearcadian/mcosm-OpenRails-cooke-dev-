import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Configuration for the token-bucket rate limiter middleware.
 */
export interface RateLimiterConfig {
  /** Maximum burst capacity — the most tokens a bucket can hold. */
  maxTokens: number;
  /** Tokens replenished per second. */
  refillRate: number;
  /**
   * Optional function to derive the rate-limit key from a request.
   * Defaults to `req.ip`.
   */
  keyExtractor?: (req: Request) => string;
}

/**
 * A simple token-bucket implementation.
 *
 * Each bucket starts full at `maxTokens` and refills continuously at
 * `refillRate` tokens/second up to the maximum capacity.
 */
class TokenBucket {
  tokens: number;
  lastRefill: number;

  constructor(private maxTokens: number, private refillRate: number) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Attempt to consume a single token.
   * @returns `true` if a token was available, `false` otherwise.
   */
  consume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Top-up tokens based on elapsed wall-clock time. */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }
}

/**
 * Factory that produces an Express middleware enforcing per-key
 * token-bucket rate limiting.
 *
 * When a key's bucket is exhausted the middleware responds with
 * **HTTP 429** and a JSON body:
 * ```json
 * { "error": "Rate limit exceeded. Try again later." }
 * ```
 *
 * @param config - Rate-limiter tuning parameters.
 * @returns Standard Express `RequestHandler` middleware.
 *
 * @example
 * ```ts
 * import { createRateLimiter } from "./rate-limiter";
 *
 * const limiter = createRateLimiter({ maxTokens: 20, refillRate: 5 });
 * app.post("/api/paycard/open", limiter, handler);
 * ```
 */
export function createRateLimiter(config: RateLimiterConfig): RequestHandler {
  const { maxTokens, refillRate, keyExtractor } = config;
  const buckets = new Map<string, TokenBucket>();

  const extractKey = keyExtractor ?? ((req: Request) => req.ip ?? "unknown");

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = extractKey(req);

    if (!buckets.has(key)) {
      buckets.set(key, new TokenBucket(maxTokens, refillRate));
    }

    const bucket = buckets.get(key)!;

    if (bucket.consume()) {
      next();
      return;
    }

    res.status(429).json({ error: "Rate limit exceeded. Try again later." });
  };
}
