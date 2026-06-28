import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Mirrors the on-chain `ChannelStatus` enum. */
export type PaycardStatus = "Active" | "PendingSettlement" | "Terminated";

/**
 * Off-chain projection of a single paycard's stream state.
 *
 * All monetary values are stored as strings to avoid BigInt serialisation
 * issues when these objects are forwarded over HTTP or webhook payloads.
 */
export interface PaycardStreamState {
  paycardId: string;
  payer: string;
  recipient: string;
  metadataHash: string;
  /** Optional off-chain workflow grouping tag bound through metadataHash. */
  workflowId?: string;
  /** Total USDC escrowed at channel open (wei string). */
  totalAllocation: string;
  /** Remaining unspent balance (wei string). */
  availableBalance: string;
  /** Non-authoritative local projection for display only. */
  projectedAvailableBalance?: string;
  /** Per-second drain rate (wei string). */
  velocity: string;
  /** Channel genesis timestamp (seconds). */
  genesis: number;
  /** Channel lifespan in seconds. */
  lifespan: number;
  /** Last on-chain or off-chain checkpoint (seconds). */
  lastCheckpoint: number;
  /** Current operational status. */
  status: PaycardStatus;
}

/**
 * A durable record of a single on-chain stream event (open / settle / flush).
 *
 * Persisted append-only so that history survives a gateway restart and can be
 * queried by paycardId, workflowId, metadataHash, or transaction hash. This is
 * a non-authoritative projection; the Vault remains the source of truth.
 */
export interface StreamEventRecord {
  paycardId: string;
  /** Solidity event name: PaycardProvisioned | SettlementFlushed | ResidualDeltaReclaimed. */
  eventName: string;
  /** Metadata-bound workflow scope, if known at record time. */
  workflowId?: string;
  metadataHash?: string;
  blockNumber: number;
  blockTimestamp?: number;
  transactionHash: string;
  logIndex: number;
  args: Record<string, unknown>;
  /** Wall-clock time the gateway recorded the event (ms). */
  recordedAt: number;
}

/**
 * The read/write surface the StreamGateway depends on. Implemented by both the
 * in-memory store (test/default) and the persistent file store (production).
 *
 * The optional `recordEvent` / `hasEvent` / `getEvents` methods are present only
 * on durable stores; the gateway calls them defensively with `?.`.
 */
export interface StreamStateStore {
  set(id: string, state: PaycardStreamState): void;
  get(id: string): PaycardStreamState | undefined;
  delete(id: string): boolean;
  bindWorkflow(paycardId: string, workflowId?: string): PaycardStreamState | undefined;
  getAll(): PaycardStreamState[];
  getActive(): PaycardStreamState[];
  getByWorkflow(workflowId: string): PaycardStreamState[];
  getActiveByWorkflow(workflowId: string): PaycardStreamState[];
  getExpired(currentTime: number): PaycardStreamState[];
  readonly size: number;
  /** Durable stores only: append an event idempotently; returns true if newly stored. */
  recordEvent?(record: StreamEventRecord): boolean;
  /** Durable stores only: has this `${txHash}:${logIndex}` event been seen? */
  hasEvent?(key: string): boolean;
  /** Durable stores only: events for a paycard, oldest first. */
  getEvents?(paycardId: string): StreamEventRecord[];
}

// ---------------------------------------------------------------------------
// MemoryCacheStateStore
// ---------------------------------------------------------------------------

/**
 * Lightweight in-memory cache keyed by `paycardId`.
 *
 * Designed for a single-process gateway; swap for the persistent file store
 * (or Redis / SQLite) if durability or horizontal scaling is required.
 */
export class MemoryCacheStateStore implements StreamStateStore {
  private readonly store = new Map<string, PaycardStreamState>();
  private readonly workflowIndex = new Map<string, Set<string>>();

  /** Upsert a paycard state. */
  set(id: string, state: PaycardStreamState): void {
    const previous = this.store.get(id);
    if (previous?.workflowId && previous.workflowId !== state.workflowId) {
      this.workflowIndex.get(previous.workflowId)?.delete(id);
    }
    this.store.set(id, state);
    if (state.workflowId) {
      const workflowSet = this.workflowIndex.get(state.workflowId) ?? new Set<string>();
      workflowSet.add(id);
      this.workflowIndex.set(state.workflowId, workflowSet);
    }
  }

  /** Retrieve a paycard state by ID. */
  get(id: string): PaycardStreamState | undefined {
    return this.store.get(id);
  }

  /** Remove a paycard from the cache. */
  delete(id: string): boolean {
    const previous = this.store.get(id);
    if (previous?.workflowId) {
      const workflowSet = this.workflowIndex.get(previous.workflowId);
      workflowSet?.delete(id);
      if (workflowSet?.size === 0) this.workflowIndex.delete(previous.workflowId);
    }
    return this.store.delete(id);
  }

  /** Attach or update a metadata-bound workflow scope for an existing stream. */
  bindWorkflow(paycardId: string, workflowId?: string): PaycardStreamState | undefined {
    const state = this.store.get(paycardId);
    if (!state) return undefined;
    if (state.workflowId) {
      const previousSet = this.workflowIndex.get(state.workflowId);
      previousSet?.delete(paycardId);
      if (previousSet?.size === 0) this.workflowIndex.delete(state.workflowId);
    }
    state.workflowId = workflowId || undefined;
    if (state.workflowId) {
      const workflowSet = this.workflowIndex.get(state.workflowId) ?? new Set<string>();
      workflowSet.add(paycardId);
      this.workflowIndex.set(state.workflowId, workflowSet);
    }
    return state;
  }

  /** Returns every tracked paycard regardless of status. */
  getAll(): PaycardStreamState[] {
    return Array.from(this.store.values());
  }

  /** Returns all paycards whose status is `"Active"`. */
  getActive(): PaycardStreamState[] {
    const result: PaycardStreamState[] = [];
    for (const state of this.store.values()) {
      if (state.status === "Active") {
        result.push(state);
      }
    }
    return result;
  }

  /** Returns all streams associated with a metadata-bound workflow scope. */
  getByWorkflow(workflowId: string): PaycardStreamState[] {
    const ids = this.workflowIndex.get(workflowId);
    if (!ids) return [];
    const result: PaycardStreamState[] = [];
    for (const id of ids) {
      const state = this.store.get(id);
      if (state) result.push(state);
    }
    return result;
  }

  /** Returns active streams associated with a metadata-bound workflow scope. */
  getActiveByWorkflow(workflowId: string): PaycardStreamState[] {
    return this.getByWorkflow(workflowId).filter((state) => state.status === "Active");
  }

  /**
   * Returns all paycards whose computed expiration time is at or before
   * `currentTime` (in seconds) and are still marked Active.
   */
  getExpired(currentTime: number): PaycardStreamState[] {
    const result: PaycardStreamState[] = [];
    for (const state of this.store.values()) {
      if (
        state.status === "Active" &&
        currentTime >= state.genesis + state.lifespan
      ) {
        result.push(state);
      }
    }
    return result;
  }

  /** Total number of tracked paycards (any status). */
  get size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// StreamTerminationQueue
// ---------------------------------------------------------------------------

/** Internal entry in the termination queue. */
interface TerminationEntry {
  paycardId: string;
  expiresAt: number; // seconds
}

/**
 * Priority-aware expiration tracker.
 *
 * Call {@link schedule} when a paycard is opened, then periodically call
 * {@link checkExpired} from the timer loop to discover paycards whose
 * lifespan has elapsed.
 */
export class StreamTerminationQueue {
  /**
   * Sorted by `expiresAt` ascending so that `checkExpired` can early-exit
   * once it hits a future timestamp.
   */
  private readonly queue: TerminationEntry[] = [];

  /**
   * Schedule a paycard for future expiration.
   *
   * @param paycardId - Unique paycard identifier (bytes32 hex).
   * @param expiresAt - Unix timestamp (seconds) at which the paycard expires.
   */
  schedule(paycardId: string, expiresAt: number): void {
    // Binary-search insertion to maintain sort order.
    let lo = 0;
    let hi = this.queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.queue[mid].expiresAt <= expiresAt) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.queue.splice(lo, 0, { paycardId, expiresAt });
  }

  /**
   * Returns (and removes) all paycard IDs whose expiration time is ≤
   * `currentTime`.
   *
   * @param currentTime - Current Unix timestamp in seconds.
   */
  checkExpired(currentTime: number): string[] {
    const expired: string[] = [];

    while (this.queue.length > 0 && this.queue[0].expiresAt <= currentTime) {
      expired.push(this.queue.shift()!.paycardId);
    }

    return expired;
  }

  /** Number of pending scheduled expirations. */
  get pendingCount(): number {
    return this.queue.length;
  }
}

// ---------------------------------------------------------------------------
// PersistentFileStateStore
// ---------------------------------------------------------------------------

/**
 * Durable, dependency-free state store backed by two files in a data directory:
 *
 * - `stream-state.json`  — a snapshot of every {@link PaycardStreamState}.
 * - `stream-events.jsonl` — append-only log of {@link StreamEventRecord}s.
 *
 * In-memory indexing is delegated to a composed {@link MemoryCacheStateStore},
 * so all workflow/active/expired query semantics are identical. Authoritative
 * mutations (`set`/`delete`/`bindWorkflow`) persist the snapshot synchronously;
 * non-authoritative tick projections are *not* persisted (they would thrash the
 * disk and the Vault remains the source of truth).
 *
 * Events are deduplicated by `${transactionHash}:${logIndex}`, which gives the
 * gateway cross-restart idempotency for backfill/replay.
 */
export class PersistentFileStateStore implements StreamStateStore {
  private readonly inner = new MemoryCacheStateStore();
  private readonly events: StreamEventRecord[] = [];
  private readonly eventKeys = new Set<string>();
  private readonly statePath: string;
  private readonly eventsPath: string;

  constructor(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.statePath = path.join(dir, "stream-state.json");
    this.eventsPath = path.join(dir, "stream-events.jsonl");
    this.load();
  }

  static eventKey(transactionHash: string, logIndex: number): string {
    return `${transactionHash}:${logIndex}`;
  }

  private load(): void {
    if (fs.existsSync(this.statePath)) {
      try {
        const states = JSON.parse(fs.readFileSync(this.statePath, "utf-8")) as PaycardStreamState[];
        for (const state of states) this.inner.set(state.paycardId, state);
      } catch {
        // Corrupt snapshot is non-fatal; events replay can rebuild state.
      }
    }
    if (fs.existsSync(this.eventsPath)) {
      const lines = fs.readFileSync(this.eventsPath, "utf-8").split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const record = JSON.parse(line) as StreamEventRecord;
          const key = PersistentFileStateStore.eventKey(record.transactionHash, record.logIndex);
          if (!this.eventKeys.has(key)) {
            this.eventKeys.add(key);
            this.events.push(record);
          }
        } catch {
          // Skip a malformed line rather than failing the whole load.
        }
      }
    }
  }

  private persistSnapshot(): void {
    fs.writeFileSync(this.statePath, JSON.stringify(this.inner.getAll()));
  }

  set(id: string, state: PaycardStreamState): void {
    this.inner.set(id, state);
    this.persistSnapshot();
  }

  get(id: string): PaycardStreamState | undefined {
    return this.inner.get(id);
  }

  delete(id: string): boolean {
    const deleted = this.inner.delete(id);
    if (deleted) this.persistSnapshot();
    return deleted;
  }

  bindWorkflow(paycardId: string, workflowId?: string): PaycardStreamState | undefined {
    const result = this.inner.bindWorkflow(paycardId, workflowId);
    if (result) this.persistSnapshot();
    return result;
  }

  getAll(): PaycardStreamState[] {
    return this.inner.getAll();
  }

  getActive(): PaycardStreamState[] {
    return this.inner.getActive();
  }

  getByWorkflow(workflowId: string): PaycardStreamState[] {
    return this.inner.getByWorkflow(workflowId);
  }

  getActiveByWorkflow(workflowId: string): PaycardStreamState[] {
    return this.inner.getActiveByWorkflow(workflowId);
  }

  getExpired(currentTime: number): PaycardStreamState[] {
    return this.inner.getExpired(currentTime);
  }

  get size(): number {
    return this.inner.size;
  }

  hasEvent(key: string): boolean {
    return this.eventKeys.has(key);
  }

  /** Append an event idempotently. Returns true when newly stored. */
  recordEvent(record: StreamEventRecord): boolean {
    const key = PersistentFileStateStore.eventKey(record.transactionHash, record.logIndex);
    if (this.eventKeys.has(key)) return false;
    this.eventKeys.add(key);
    this.events.push(record);
    fs.appendFileSync(this.eventsPath, JSON.stringify(record) + "\n");
    return true;
  }

  getEvents(paycardId: string): StreamEventRecord[] {
    return this.events
      .filter((e) => e.paycardId === paycardId)
      .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
  }

  getAllEvents(): StreamEventRecord[] {
    return [...this.events];
  }
}

// ---------------------------------------------------------------------------
// PersistentStreamReader  (read-only view for the server)
// ---------------------------------------------------------------------------

/** Filters accepted by {@link PersistentStreamReader.listStreams}. */
export interface StreamQueryFilter {
  payer?: string;
  recipient?: string;
  workflowId?: string;
  status?: PaycardStatus;
}

/**
 * Stateless read-only view over the same files the gateway writes. The server
 * (a separate process) uses this to expose history endpoints without holding
 * the write surface. Each query re-reads from disk so it reflects the latest
 * gateway writes; this is fine at demo/testnet scale.
 *
 * Returned data is always non-authoritative — the Vault remains source of truth.
 */
export class PersistentStreamReader {
  private readonly statePath: string;
  private readonly eventsPath: string;

  constructor(dir: string) {
    this.statePath = path.join(dir, "stream-state.json");
    this.eventsPath = path.join(dir, "stream-events.jsonl");
  }

  private readStates(): PaycardStreamState[] {
    if (!fs.existsSync(this.statePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.statePath, "utf-8")) as PaycardStreamState[];
    } catch {
      return [];
    }
  }

  private readEvents(): StreamEventRecord[] {
    if (!fs.existsSync(this.eventsPath)) return [];
    const out: StreamEventRecord[] = [];
    for (const line of fs.readFileSync(this.eventsPath, "utf-8").split("\n")) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as StreamEventRecord);
      } catch {
        // skip malformed line
      }
    }
    return out;
  }

  listStreams(filter: StreamQueryFilter = {}): PaycardStreamState[] {
    const eq = (a?: string, b?: string) =>
      !b || (a ?? "").toLowerCase() === b.toLowerCase();
    return this.readStates().filter(
      (s) =>
        eq(s.payer, filter.payer) &&
        eq(s.recipient, filter.recipient) &&
        eq(s.workflowId, filter.workflowId) &&
        (!filter.status || s.status === filter.status),
    );
  }

  getStream(paycardId: string): PaycardStreamState | undefined {
    const id = paycardId.toLowerCase();
    return this.readStates().find((s) => s.paycardId.toLowerCase() === id);
  }

  getStreamHistory(paycardId: string): StreamEventRecord[] {
    const id = paycardId.toLowerCase();
    return this.readEvents()
      .filter((e) => e.paycardId.toLowerCase() === id)
      .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
  }

  getWorkflow(workflowId: string): {
    workflowId: string;
    streams: PaycardStreamState[];
    events: StreamEventRecord[];
  } {
    const streams = this.listStreams({ workflowId });
    const ids = new Set(streams.map((s) => s.paycardId.toLowerCase()));
    const events = this.readEvents()
      .filter(
        (e) =>
          e.workflowId === workflowId || ids.has(e.paycardId.toLowerCase()),
      )
      .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
    return { workflowId, streams, events };
  }
}
