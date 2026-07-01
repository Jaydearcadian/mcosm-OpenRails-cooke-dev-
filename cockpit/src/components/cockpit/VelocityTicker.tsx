import { Glass, Eyebrow } from "../Glass";
import { toUsdc } from "../../lib/api";

/**
 * Real-time streaming velocity — Σ velocity over active Paycard Streams
 * (base-units/sec → USDC/sec). Live projection off the indexer, non-authoritative.
 * Honest empty state when no stream is active (no fabricated rate).
 */
export function VelocityTicker({ velocityBase }: { velocityBase: bigint }) {
  const rate = toUsdc(velocityBase); // USDC / sec
  const isLive = rate > 0;

  return (
    <Glass className="p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>Real-time streaming velocity</Eyebrow>
        {isLive && (
          <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-emerald-core">
            <span className="h-1.5 w-1.5 animate-pulse-orb rounded-full bg-emerald-core" />
            ΔT × R · live
          </span>
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="telemetry text-3xl font-semibold text-ink-primary">
          {isLive
            ? `+${rate.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`
            : "—"}
        </span>
        <span className="font-mono text-xs tracking-wider text-ink-secondary">USDC / SEC</span>
      </div>
      <p className="mt-2 font-mono text-[11px] text-ink-faint">
        {isLive
          ? "Σ velocity over active Paycard Streams (non-authoritative)"
          : "no active streams yet"}
      </p>
    </Glass>
  );
}
