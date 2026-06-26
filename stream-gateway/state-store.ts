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

// ---------------------------------------------------------------------------
// MemoryCacheStateStore
// ---------------------------------------------------------------------------

/**
 * Lightweight in-memory cache keyed by `paycardId`.
 *
 * Designed for a single-process gateway; swap for Redis / SQLite if
 * horizontal scaling is required later.
 */
export class MemoryCacheStateStore {
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
