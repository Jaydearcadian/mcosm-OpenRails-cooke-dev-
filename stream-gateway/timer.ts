/**
 * Callback signature for the timer loop.
 *
 * @param currentTimeSeconds - Wall-clock time in fractional seconds
 *                             (millisecond precision via `Date.now()`).
 */
export type TimerCallback = (currentTimeSeconds: number) => void;

/**
 * A high-frequency interval loop with automatic drift compensation.
 *
 * Standard `setInterval` can drift over time when the event loop is busy.
 * This class measures the *actual* elapsed wall-clock time between ticks
 * and adjusts the next scheduled delay so that the average cadence converges
 * on the requested interval.
 *
 * Primarily used by the gateway to compute off-chain linear micro-accruals
 * (available balance projections) between on-chain checkpoints.
 */
export class JitterResistantTimerLoop {
  private readonly intervalMs: number;
  private readonly callback: TimerCallback;

  private handle: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private expectedTickMs = 0;

  /**
   * @param intervalMs - Target tick interval in milliseconds (default 100).
   * @param callback   - Function invoked on every tick.
   */
  constructor(callback: TimerCallback, intervalMs: number = 100) {
    if (intervalMs <= 0) {
      throw new Error("intervalMs must be positive");
    }
    this.intervalMs = intervalMs;
    this.callback = callback;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Starts the timer loop. No-op if already running. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.expectedTickMs = Date.now() + this.intervalMs;
    this.scheduleTick();
  }

  /** Stops the timer loop and cancels any pending tick. */
  stop(): void {
    this.running = false;
    if (this.handle !== null) {
      clearTimeout(this.handle);
      this.handle = null;
    }
  }

  /** Whether the loop is currently active. */
  get isRunning(): boolean {
    return this.running;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Schedules the next tick using `setTimeout` with drift-adjusted delay.
   */
  private scheduleTick(): void {
    if (!this.running) return;

    const now = Date.now();
    // How far ahead/behind we are relative to the ideal schedule.
    const drift = now - this.expectedTickMs;
    // Compensate: if we're late, shrink the next delay; if early, stretch it.
    const adjustedDelay = Math.max(0, this.intervalMs - drift);

    this.handle = setTimeout(() => {
      if (!this.running) return;

      const tickNow = Date.now();
      this.expectedTickMs += this.intervalMs;

      try {
        this.callback(tickNow / 1000);
      } catch {
        // Protect the loop from callback exceptions.
      }

      this.scheduleTick();
    }, adjustedDelay);
  }
}
