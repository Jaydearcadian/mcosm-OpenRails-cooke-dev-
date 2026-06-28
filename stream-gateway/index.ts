import { ethers } from "ethers";
import {
  hashOpenRailsMetadata,
  type CanonicalMetadataV1,
} from "../sdk/src/metadata";

import { ArcJsonRpcProviderPool } from "./provider-pool";
import { LogIngestionParser, type ParsedEvent } from "./log-parser";
import {
  MemoryCacheStateStore,
  PersistentFileStateStore,
  StreamTerminationQueue,
  type PaycardStreamState,
  type StreamStateStore,
  type StreamEventRecord,
} from "./state-store";
import { JitterResistantTimerLoop } from "./timer";
import {
  Ed25519GatewayKeyPair,
  ExponentialBackoffRetryEngine,
  HeartbeatMonitor,
} from "./webhook";

// ---------------------------------------------------------------------------
// Re-exports  – consumers can `import { … } from "stream-gateway"`
// ---------------------------------------------------------------------------

export { ArcJsonRpcProviderPool, ArcWebSocketProviderPool } from "./provider-pool";
export { LogIngestionParser, type ParsedEvent } from "./log-parser";
export {
  MemoryCacheStateStore,
  PersistentFileStateStore,
  PersistentStreamReader,
  StreamTerminationQueue,
  type PaycardStreamState,
  type PaycardStatus,
  type StreamStateStore,
  type StreamEventRecord,
  type StreamQueryFilter,
} from "./state-store";
export { JitterResistantTimerLoop, type TimerCallback } from "./timer";
export {
  Ed25519GatewayKeyPair,
  ExponentialBackoffRetryEngine,
  SignatureVerificationMiddleware,
  HeartbeatMonitor,
  type Middleware,
} from "./webhook";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Construction-time configuration for the {@link StreamGateway}. */
export interface StreamGatewayConfig {
  /** One or more HTTP JSON-RPC endpoint URLs. */
  rpcUrls: string[];
  /** Deployed clearinghouse contract address. */
  contractAddress: string;
  /** Full contract ABI (JSON array). */
  contractAbi: any[];
  /** Timer tick interval in ms (default 100). */
  tickIntervalMs?: number;
  /** Maximum webhook delivery retries (default 5). */
  maxWebhookRetries?: number;
  /**
   * Injected state store. Defaults to an in-memory store (used by tests). Pass a
   * {@link PersistentFileStateStore} for durable, restart-surviving history.
   */
  stateStore?: StreamStateStore;
  /** Block to backfill historical events from when {@link backfillOnStart} is set. */
  startBlock?: number;
  /** When true and `startBlock` is provided, replay logs from chain on start. */
  backfillOnStart?: boolean;
}

// ---------------------------------------------------------------------------
// StreamGateway
// ---------------------------------------------------------------------------

/**
 * **Arc Stream Gateway** – the outbound streaming data infrastructure layer.
 *
 * Connects to one or more RPC providers, subscribes to clearinghouse events,
 * maintains an in-memory projection of every active paycard stream, computes
 * linear micro-accruals via a drift-compensated timer, and pushes state
 * deltas to registered Web2 webhook endpoints with Ed25519-signed payloads.
 *
 * ```
 * const gw = new StreamGateway({
 *   rpcUrls: ["http://127.0.0.1:8545"],
 *   contractAddress: "0x…",
 *   contractAbi: abi,
 * });
 * gw.registerWebhook("https://api.example.com/paycard-events");
 * await gw.start();
 * ```
 */
export class StreamGateway {
  private readonly config: StreamGatewayConfig & {
    tickIntervalMs: number;
    maxWebhookRetries: number;
  };

  // Sub-modules
  private pool!: ArcJsonRpcProviderPool;
  private parser!: LogIngestionParser;
  private store!: StreamStateStore;
  private queue!: StreamTerminationQueue;
  private timer!: JitterResistantTimerLoop;
  private keyPair!: Ed25519GatewayKeyPair;
  private retryEngine!: ExponentialBackoffRetryEngine;
  private heartbeat!: HeartbeatMonitor;

  /** Registered webhook destination URLs. */
  private readonly webhookUrls: string[] = [];
  private readonly processedLogKeys = new Set<string>();

  private started = false;

  constructor(config: StreamGatewayConfig) {
    this.config = {
      tickIntervalMs: 100,
      maxWebhookRetries: 5,
      ...config,
    };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialises all sub-modules, opens provider connections, subscribes to
   * contract events, and starts the micro-accrual timer loop.
   */
  async start(): Promise<void> {
    if (this.started) return;

    // 1. Provider pool
    this.pool = new ArcJsonRpcProviderPool(this.config.rpcUrls);

    // 2. Log parser – extract event fragments from the supplied ABI
    const eventFragments = this.extractEventFragments(this.config.contractAbi);
    this.parser = new LogIngestionParser(eventFragments);

    // 3. State store + termination queue. A persistent store may have loaded
    //    prior state from disk, so reschedule any still-active expirations.
    this.store = this.config.stateStore ?? new MemoryCacheStateStore();
    this.queue = new StreamTerminationQueue();
    for (const state of this.store.getActive()) {
      if (state.lifespan > 0) {
        this.queue.schedule(state.paycardId, state.genesis + state.lifespan);
      }
    }

    // 4. Webhook infrastructure
    this.keyPair = new Ed25519GatewayKeyPair();
    this.retryEngine = new ExponentialBackoffRetryEngine();
    this.heartbeat = new HeartbeatMonitor();

    // 5. Subscribe to contract events
    const topicFilters = this.parser.getTopicFilters();
    this.pool.subscribe(
      this.config.contractAddress,
      [topicFilters],
      (log) => void this.handleLog(log),
    );

    // 6. Backfill historical events from chain so a fresh process rebuilds
    //    state instead of starting empty. Idempotent via the event table.
    if (this.config.backfillOnStart && this.config.startBlock !== undefined) {
      const applied = await this.backfill(this.config.startBlock);
      console.log(
        `[arc-stream-gateway] backfill complete | fromBlock=${this.config.startBlock} ` +
          `applied=${applied} tracked=${this.store.size}`,
      );
    }

    // 7. Timer loop – micro-accrual projections + expiration sweeps
    this.timer = new JitterResistantTimerLoop((nowSec) => {
      this.processAccruals(nowSec);
      this.sweepExpired(nowSec);
    }, this.config.tickIntervalMs);
    this.timer.start();

    this.started = true;
    console.log(
      `[arc-stream-gateway] started | providers=${this.config.rpcUrls.length} ` +
        `contract=${this.config.contractAddress} ` +
        `pubkey=${this.keyPair.getPublicKeyHex()}`,
    );
  }

  /**
   * Gracefully shuts down the gateway: stops the timer, closes provider
   * connections, and clears internal state.
   */
  async stop(): Promise<void> {
    if (!this.started) return;

    this.timer.stop();
    await this.pool.close();
    this.started = false;

    console.log("[arc-stream-gateway] stopped");
  }

  // ---------------------------------------------------------------------------
  // Public helpers
  // ---------------------------------------------------------------------------

  /**
   * Registers a webhook URL that will receive signed event + state payloads.
   */
  registerWebhook(url: string): void {
    if (!this.webhookUrls.includes(url)) {
      this.webhookUrls.push(url);
    }
  }

  /** Returns a snapshot of all active paycard stream states. */
  getActiveStreams(): PaycardStreamState[] {
    return this.store.getActive();
  }

  /** Returns streams grouped under a metadata-bound workflow scope. */
  getStreamsByWorkflow(workflowId: string): PaycardStreamState[] {
    return this.store.getByWorkflow(workflowId);
  }

  /** Returns active streams grouped under a metadata-bound workflow scope. */
  getActiveStreamsByWorkflow(workflowId: string): PaycardStreamState[] {
    return this.store.getActiveByWorkflow(workflowId);
  }

  /**
   * Binds verified canonical metadata to an indexed stream. The workflowId is
   * accepted only when the metadata hashes to the on-chain metadataHash.
   */
  bindVerifiedMetadata(paycardId: string, metadata: CanonicalMetadataV1): PaycardStreamState {
    const state = this.store.get(paycardId);
    if (!state) {
      throw new Error("Cannot bind metadata for unknown Paycard Stream");
    }
    if (hashOpenRailsMetadata(metadata) !== state.metadataHash) {
      throw new Error("Cannot bind workflowId because metadataHash does not match stream");
    }
    return this.store.bindWorkflow(paycardId, metadata.workflowId) ?? state;
  }

  /** Returns the gateway's public key hex (for webhook verification). */
  getPublicKeyHex(): string {
    return this.keyPair.getPublicKeyHex();
  }

  // ---------------------------------------------------------------------------
  // Internal event handling
  // ---------------------------------------------------------------------------

  /**
   * Routes a raw on-chain log through the parser and updates local state.
   */
  private async handleLog(log: ethers.Log): Promise<void> {
    const event = this.parser.parse(log);
    if (!event) return;

    // Idempotency: dedup by `${txHash}:${logIndex}` across both the in-memory
    // fast path and (for durable stores) the persisted event table, so backfill
    // and live subscription overlap — and restarts — never double-apply.
    const logKey = `${event.transactionHash}:${event.logIndex}`;
    if (this.processedLogKeys.has(logKey)) return;
    if (this.store.hasEvent?.(logKey)) {
      this.processedLogKeys.add(logKey);
      return;
    }
    this.processedLogKeys.add(logKey);

    const block = await this.pool.getProvider().getBlock(log.blockNumber);
    event.blockTimestamp = block?.timestamp;

    // Persist the event (append-only) before applying state mutations.
    this.store.recordEvent?.(this.toEventRecord(event));

    switch (event.eventName) {
      case "PaycardProvisioned":
        this.onPaycardProvisioned(event);
        break;
      case "SettlementFlushed":
        this.onSettlementFlushed(event);
        break;
      case "ResidualDeltaReclaimed":
        this.onResidualDeltaReclaimed(event);
        break;
      default:
        break;
    }

    // Fan-out to registered webhooks.
    void this.fanOutWebhook(event);
  }

  /** Projects a parsed event into a durable {@link StreamEventRecord}. */
  private toEventRecord(event: ParsedEvent): StreamEventRecord {
    const existing = this.store.get(event.paycardId);
    return {
      paycardId: event.paycardId,
      eventName: event.eventName,
      workflowId: existing?.workflowId,
      metadataHash: (event.args["metadataHash"] as string) ?? existing?.metadataHash,
      blockNumber: event.blockNumber,
      blockTimestamp: event.blockTimestamp,
      transactionHash: event.transactionHash,
      logIndex: event.logIndex,
      args: event.args,
      recordedAt: Date.now(),
    };
  }

  /**
   * Replays historical contract logs from `fromBlock` through `toBlock` (or the
   * current head) so a freshly started gateway rebuilds state from chain rather
   * than starting empty. Safe to call repeatedly — {@link handleLog} dedups.
   *
   * @returns the number of logs processed.
   */
  async backfill(fromBlock: number, toBlock?: number): Promise<number> {
    const provider = this.pool.getProvider();
    const head = toBlock ?? (await provider.getBlockNumber());
    const topicFilters = this.parser.getTopicFilters();
    const logs = await provider.getLogs({
      address: this.config.contractAddress,
      fromBlock,
      toBlock: head,
      topics: [topicFilters],
    });
    // Apply in block/log order for deterministic state reconstruction.
    logs.sort(
      (a, b) =>
        a.blockNumber - b.blockNumber ||
        Number((a as any).index ?? (a as any).logIndex ?? 0) -
          Number((b as any).index ?? (b as any).logIndex ?? 0),
    );
    for (const log of logs) {
      await this.handleLog(log);
    }
    return logs.length;
  }

  /**
   * Handles a `PaycardProvisioned` event – inserts a new stream into the
   * state store and schedules its expiration.
   */
  private onPaycardProvisioned(event: ParsedEvent): void {
    const args = event.args;

    const genesis = Number(args["genesisTimestamp"] ?? 0);
    const lifespan = Number(args["lifespanSeconds"] ?? 0);

    const state: PaycardStreamState = {
      paycardId: event.paycardId,
      payer: args["payer"] ?? "",
      recipient: args["recipient"] ?? "",
      metadataHash: args["metadataHash"] ?? "",
      totalAllocation: args["poolAllocation"] ?? "0",
      availableBalance: args["poolAllocation"] ?? "0",
      velocity: args["flowVelocityPerSecond"] ?? "0",
      genesis,
      lifespan,
      lastCheckpoint: genesis,
      status: "Active",
    };

    this.store.set(event.paycardId, state);
    if (lifespan > 0) {
      this.queue.schedule(event.paycardId, genesis + lifespan);
    }
  }

  /**
   * Handles a `SettlementFlushed` event – decrements the projected balance
   * and/or terminates the stream if fully drained.
   */
  private onSettlementFlushed(event: ParsedEvent): void {
    const existing = this.store.get(event.paycardId);
    if (!existing) return;

    const withdrawn = BigInt(event.args["amountWithdrawn"] ?? "0");
    const current = BigInt(existing.availableBalance);
    const remaining = current - withdrawn;

    existing.availableBalance = (remaining > 0n ? remaining : 0n).toString();
    existing.lastCheckpoint = event.blockTimestamp ?? existing.lastCheckpoint;

    if (remaining <= 0n) {
      existing.status = "Terminated";
    }

    // Persist the authoritative balance/status change (durable stores only).
    this.store.set(event.paycardId, existing);
  }

  /**
   * Handles a `ResidualDeltaReclaimed` event – terminates the stream and
   * zeroes the balance.
   */
  private onResidualDeltaReclaimed(event: ParsedEvent): void {
    const existing = this.store.get(event.paycardId);
    if (!existing) return;

    existing.availableBalance = "0";
    existing.status = "Terminated";

    // Persist the termination (durable stores only).
    this.store.set(event.paycardId, existing);
  }

  // ---------------------------------------------------------------------------
  // Micro-accrual projection
  // ---------------------------------------------------------------------------

  /**
   * Called on every timer tick.  Walks active streams and projects the
   * linearly decreasing balance forward from `lastCheckpoint` to `nowSec`.
   *
   * This is a *local projection* only – the authoritative balance lives
   * on-chain.  The projection lets Web2 consumers render real-time balances
   * without polling the blockchain.
   */
  private processAccruals(nowSec: number): void {
    for (const state of this.store.getActive()) {
      const elapsed = nowSec - state.lastCheckpoint;
      if (elapsed <= 0) continue;
      if (state.lifespan === 0) continue;

      const velocity = BigInt(state.velocity);
      const accrued = velocity * BigInt(Math.floor(elapsed));
      const current = BigInt(state.availableBalance);
      const projected = current - accrued;

      state.projectedAvailableBalance = (projected > 0n ? projected : 0n).toString();
    }
  }

  /**
   * Sweeps the termination queue and marks expired paycards as pending onchain
   * settlement/reclaim. Expiration alone does not terminate the Vault row.
   */
  private sweepExpired(nowSec: number): void {
    const expired = this.queue.checkExpired(nowSec);
    for (const id of expired) {
      const state = this.store.get(id);
      if (state && state.status === "Active") {
        state.status = "PendingSettlement";
        this.store.set(id, state);
        void this.fanOutWebhook({
          eventName: "StreamExpiredPendingSettlement",
          paycardId: id,
          args: { reason: "lifespan_elapsed" },
          blockNumber: 0,
          transactionHash: "",
          logIndex: 0,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Webhook fan-out
  // ---------------------------------------------------------------------------

  /**
   * Delivers a signed event payload to every registered webhook URL.
   */
  private async fanOutWebhook(event: ParsedEvent): Promise<void> {
    if (this.webhookUrls.length === 0) return;

    const signFn = (data: string) => this.keyPair.sign(data);

    await Promise.allSettled(
      this.webhookUrls.map((url) =>
        this.retryEngine.deliver(url, event, signFn, this.config.maxWebhookRetries),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // ABI helpers
  // ---------------------------------------------------------------------------

  /**
   * Extracts human-readable event fragments from a JSON ABI array.
   */
  private extractEventFragments(abi: any[]): string[] {
    const iface = new ethers.Interface(abi);
    const fragments: string[] = [];

    iface.forEachEvent((event) => {
      fragments.push(event.format("full"));
    });

    return fragments.length > 0 ? fragments : undefined as any;
  }
}

// ---------------------------------------------------------------------------
// CLI Bootstrap — standalone entry point
// ---------------------------------------------------------------------------

/**
 * When executed directly via `ts-node stream-gateway/index.ts` (or
 * `npm run stream-gateway`), this block fetches the deployed contract
 * address from the running Gateway API and boots the StreamGateway.
 */
async function bootstrap(): Promise<void> {
  const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3001";
  const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

  console.log("[StreamGateway] Fetching config from Gateway API…");

  let config: any;
  try {
    const res = await fetch(`${GATEWAY_URL}/api/config`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    config = await res.json();
  } catch (err: any) {
    console.error(
      `[StreamGateway] Failed to reach Gateway API at ${GATEWAY_URL}/api/config: ${err.message}`,
    );
    console.error("[StreamGateway] Make sure 'npm start' is running first.");
    process.exit(1);
  }

  const contractAddress: string = config.clearinghouseAddress;
  console.log(`[StreamGateway] Contract address: ${contractAddress}`);

  // Load ABI from compiled artifacts
  const fs = await import("fs");
  const path = await import("path");
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "ArcOpenRailsHubV1.sol",
    "ArcOpenRailsHubV1.json",
  );

  let abi: any[];
  try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    abi = artifact.abi;
  } catch (err: any) {
    console.error(`[StreamGateway] Failed to load ABI from ${artifactPath}: ${err.message}`);
    console.error("[StreamGateway] Run 'npx hardhat compile' first.");
    process.exit(1);
  }

  // Durable, restart-surviving store. The server reads the same directory via
  // PersistentStreamReader to serve history endpoints.
  const storeDir =
    process.env.OPENRAILS_STREAM_STORE_DIR ||
    path.join(__dirname, "..", ".openrails-stream");
  const startBlockEnv = process.env.OPENRAILS_STREAM_START_BLOCK;
  const startBlock =
    startBlockEnv !== undefined && startBlockEnv !== ""
      ? Number(startBlockEnv)
      : undefined;
  console.log(`[StreamGateway] Persistent store dir: ${storeDir}`);

  const gateway = new StreamGateway({
    rpcUrls: [RPC_URL],
    contractAddress,
    contractAbi: abi,
    tickIntervalMs: 500, // 2 ticks/sec for demo visibility
    stateStore: new PersistentFileStateStore(storeDir),
    startBlock,
    backfillOnStart: startBlock !== undefined,
  });

  // Start the gateway
  await gateway.start();

  console.log("[StreamGateway] Service is running. Listening for on-chain events…");
  console.log("[StreamGateway] Press Ctrl+C to stop.\n");

  // Periodic status report every 5 seconds
  setInterval(() => {
    const streams = gateway.getActiveStreams();
    if (streams.length > 0) {
      console.log(`[StreamGateway] Active streams: ${streams.length}`);
      for (const s of streams) {
        console.log(
          `  Paycard ${s.paycardId.slice(0, 10)}… | ` +
            `Balance: ${s.availableBalance} | ` +
            `Velocity: ${s.velocity}/sec | ` +
            `Status: ${s.status}`,
        );
      }
    }
  }, 5000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[StreamGateway] Shutting down…");
    await gateway.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Run only when executed directly, not when imported as a library.
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error("[StreamGateway] Fatal error:", err);
    process.exit(1);
  });
}
