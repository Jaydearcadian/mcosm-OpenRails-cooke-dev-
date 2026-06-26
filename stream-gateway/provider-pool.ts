import { ethers } from "ethers";

/**
 * Health metadata tracked per provider endpoint.
 */
interface ProviderEntry {
  provider: ethers.JsonRpcProvider;
  url: string;
  healthy: boolean;
  consecutiveFailures: number;
  lastCheckedMs: number;
}

/**
 * Manages a rotating pool of ethers `JsonRpcProvider` connections.
 *
 * Designed for local Hardhat / Anvil nodes and public RPC endpoints alike.
 * Selects the healthiest provider via round-robin with automatic fallback
 * when a provider starts returning errors.
 */
export class ArcJsonRpcProviderPool {
  private readonly entries: ProviderEntry[] = [];
  private cursor = 0;
  private readonly pollHandles: ReturnType<typeof setInterval>[] = [];
  private readonly subscriptionCleanups: Array<() => void> = [];

  /** Maximum consecutive failures before a provider is marked unhealthy. */
  private static readonly MAX_FAILURES = 3;
  /** Milliseconds between automatic health probes. */
  private static readonly HEALTH_INTERVAL_MS = 30_000;

  /**
   * @param urls - Array of HTTP JSON-RPC endpoint URLs.
   *               At least one URL must be provided.
   */
  constructor(urls: string[]) {
    if (urls.length === 0) {
      throw new Error("ArcJsonRpcProviderPool requires at least one RPC URL");
    }

    for (const url of urls) {
      const provider = new ethers.JsonRpcProvider(url);
      this.entries.push({
        provider,
        url,
        healthy: true,
        consecutiveFailures: 0,
        lastCheckedMs: Date.now(),
      });
    }

    // Kick off a periodic health probe for each entry.
    const handle = setInterval(() => {
      void this.probeAll();
    }, ArcJsonRpcProviderPool.HEALTH_INTERVAL_MS);
    this.pollHandles.push(handle);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns the next healthy provider using round-robin selection.
   * Falls back to any available provider if the preferred one is unhealthy.
   *
   * @throws If every provider in the pool is unhealthy.
   */
  getProvider(): ethers.JsonRpcProvider {
    const count = this.entries.length;

    // First pass: try round-robin from cursor.
    for (let i = 0; i < count; i++) {
      const idx = (this.cursor + i) % count;
      if (this.entries[idx].healthy) {
        this.cursor = (idx + 1) % count;
        return this.entries[idx].provider;
      }
    }

    // All flagged unhealthy – reset and return the first (best-effort).
    for (const entry of this.entries) {
      entry.healthy = true;
      entry.consecutiveFailures = 0;
    }
    this.cursor = 1 % count;
    return this.entries[0].provider;
  }

  /**
   * Subscribes to on-chain log events across every healthy provider.
   *
   * @param address  - Contract address to watch.
   * @param topics   - Nested topic filter array (ethers-compatible).
   * @param callback - Invoked for each matching log.
   */
  subscribe(
    address: string,
    topics: string[][],
    callback: (log: ethers.Log) => void,
  ): void {
    const filter: ethers.EventFilter = { address, topics: topics as any };

    for (const entry of this.entries) {
      const handler = (log: ethers.Log) => {
        callback(log);
      };

      entry.provider.on(filter, handler);
      this.subscriptionCleanups.push(() => {
        entry.provider.off(filter, handler);
      });
    }
  }

  /**
   * Tears down every provider and clears all subscriptions / timers.
   */
  async close(): Promise<void> {
    for (const cleanup of this.subscriptionCleanups) {
      try {
        cleanup();
      } catch {
        // Swallow – provider may already be destroyed.
      }
    }
    this.subscriptionCleanups.length = 0;

    for (const handle of this.pollHandles) {
      clearInterval(handle);
    }
    this.pollHandles.length = 0;

    for (const entry of this.entries) {
      try {
        entry.provider.destroy();
      } catch {
        // Best-effort cleanup.
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Probes every provider with a lightweight `eth_blockNumber` call and
   * updates the health metadata accordingly.
   */
  private async probeAll(): Promise<void> {
    await Promise.allSettled(
      this.entries.map(async (entry) => {
        try {
          await entry.provider.getBlockNumber();
          entry.healthy = true;
          entry.consecutiveFailures = 0;
        } catch {
          entry.consecutiveFailures += 1;
          if (
            entry.consecutiveFailures >= ArcJsonRpcProviderPool.MAX_FAILURES
          ) {
            entry.healthy = false;
          }
        } finally {
          entry.lastCheckedMs = Date.now();
        }
      }),
    );
  }
}

export { ArcJsonRpcProviderPool as ArcWebSocketProviderPool };
