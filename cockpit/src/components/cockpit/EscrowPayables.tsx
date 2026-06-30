import { Glass, Eyebrow } from "../Glass";
import { fmtUsd, toUsdc } from "../../lib/api";

/** Card B (right) — Total Escrow Payables. Live: Σ availableBalance over active streams. */
export function EscrowPayables({ escrowBase, activeCount, online }: { escrowBase: bigint; activeCount: number; online: boolean }) {
  return (
    <Glass className="p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>Total escrow payables</Eyebrow>
        <span className={`font-mono text-[10px] tracking-wider ${online ? "text-emerald-core" : "text-ink-faint"}`}>
          {online ? "live" : "offline"}
        </span>
      </div>
      <div className="mt-4 telemetry text-[26px] font-bold text-ink-primary">${fmtUsd(toUsdc(escrowBase))}</div>
      <p className="mt-2 font-mono text-[11px] text-ink-faint">
        ring-fenced capital across {activeCount} open pipeline{activeCount === 1 ? "" : "s"} · non-authoritative
      </p>
    </Glass>
  );
}
