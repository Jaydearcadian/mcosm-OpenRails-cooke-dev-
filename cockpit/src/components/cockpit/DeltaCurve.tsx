import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { Glass, Eyebrow } from "../Glass";
import { fmtUsd, toUsdc, type StreamEvent } from "../../lib/api";

/**
 * Right A — STN/LTN Delta Realization Curve. Cumulative residual reclaimed via
 * flushResidualDelta (ResidualDeltaReclaimed events), straight from the indexer.
 * The curve renders once ≥2 reclaim events exist; otherwise an honest note. No
 * synthetic fallback.
 */
export function DeltaCurve({ events }: { events: StreamEvent[] }) {
  const reclaims = useMemo(
    () =>
      events
        .filter((e) => e.eventName === "ResidualDeltaReclaimed")
        .sort((a, b) => a.blockNumber - b.blockNumber),
    [events],
  );
  const canChart = reclaims.length >= 2;

  const series = useMemo(() => {
    let cum = 0;
    return reclaims.map((e, i) => {
      const amt = Number((e.args?.["varianceSwept"] as string) ?? "0");
      cum += isFinite(amt) ? amt / 1e6 : 0;
      return { t: i, v: cum };
    });
  }, [reclaims]);

  const headline = toUsdc(
    reclaims.reduce((acc, e) => acc + BigInt((e.args?.["varianceSwept"] as string) ?? "0"), 0n).toString(),
  );

  return (
    <Glass className="flex flex-col p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>STN / LTN delta realization</Eyebrow>
        {reclaims.length > 0 && (
          <span className="font-mono text-[10px] tracking-wider text-emerald-core">live</span>
        )}
      </div>

      <div className="mt-3 telemetry text-[22px] font-bold text-ink-primary">${fmtUsd(headline)}</div>

      {canChart ? (
        <div className="-mx-1 mt-1 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="deltaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#009E60" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#009E60" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.2)" }}
                contentStyle={{
                  background: "rgba(7,11,20,0.92)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                }}
                labelStyle={{ display: "none" }}
                formatter={(v: number) => [`$${fmtUsd(v)}`, "reclaimed"]}
              />
              <Area type="monotone" dataKey="v" stroke="#1be08f" strokeWidth={2} fill="url(#deltaFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-faint">
          cumulative residual swept back on flushResidualDelta · the curve renders once ≥2 reclaim
          events are indexed
        </p>
      )}
    </Glass>
  );
}
