import { useMemo } from "react";
import { Glass, Eyebrow, DemoTag } from "../Glass";
import { toUsdc, type StreamState } from "../../lib/api";

/**
 * Center — 2D Nonce Lane Traffic Map. Vertical glass-capsule bars per execution
 * lane. Live where streams exist (grouped by workflowId as a lane proxy — the
 * projection does not carry nonceChannel yet); demo bars otherwise. Peak lane
 * renders in emerald with a glowing orb at its crest.
 */
interface Lane {
  label: string;
  value: number; // relative throughput
}

function deriveLanes(active: StreamState[]): { lanes: Lane[]; live: boolean } {
  if (active.length === 0) {
    const demo = [42, 68, 35, 90, 54, 28, 73, 48].map((v, i) => ({
      label: `Lane ${String(i + 1).padStart(2, "0")}`,
      value: v,
    }));
    return { lanes: demo, live: false };
  }
  const groups = new Map<string, number>();
  for (const s of active) {
    const key = s.workflowId || s.paycardId.slice(0, 8);
    groups.set(key, (groups.get(key) ?? 0) + toUsdc(s.totalAllocation));
  }
  const lanes = [...groups.entries()]
    .slice(0, 8)
    .map(([k, v], i) => ({ label: k.length > 8 ? `Lane ${String(i + 1).padStart(2, "0")}` : k, value: v }));
  return { lanes, live: true };
}

export function NonceLaneMap({ active }: { active: StreamState[] }) {
  const { lanes, live } = useMemo(() => deriveLanes(active), [active]);
  const peak = Math.max(...lanes.map((l) => l.value), 1);
  const peakIdx = lanes.findIndex((l) => l.value === peak);

  return (
    <Glass className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>2D nonce lane traffic map</Eyebrow>
        {live ? (
          <span className="font-mono text-[10px] tracking-wider text-emerald-core">live</span>
        ) : (
          <DemoTag />
        )}
      </div>

      <div className="mt-6 flex flex-1 items-end gap-3 sm:gap-4">
        {lanes.map((l, i) => {
          const h = Math.max(8, (l.value / peak) * 100);
          const isPeak = i === peakIdx;
          return (
            <div key={l.label + i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="relative flex w-full justify-center" style={{ height: "180px" }}>
                <div
                  className={[
                    "relative w-full max-w-[34px] self-end rounded-full transition-all duration-500",
                    isPeak ? "bg-emerald-core/80 shadow-emerald-glow" : "hazard border border-white/10",
                  ].join(" ")}
                  style={{ height: `${h}%` }}
                  title={`${l.label}: ${l.value.toFixed(2)}`}
                >
                  {isPeak && (
                    <span className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 animate-pulse-orb rounded-full bg-emerald-core shadow-emerald-glow" />
                  )}
                </div>
              </div>
              <span className="truncate font-mono text-[9px] tracking-wider text-ink-faint">{l.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 font-mono text-[11px] text-ink-faint">
        throughput density across parallel execution tracks · emerald = active concentration
      </p>
    </Glass>
  );
}
