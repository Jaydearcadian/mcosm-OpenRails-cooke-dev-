import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { Glass, Eyebrow, DemoTag } from "../Glass";
import { fmtUsd, toUsdc, type StreamEvent } from "../../lib/api";
import { mockDeltaSeries } from "../../lib/mock";

/**
 * Right A — STN/LTN Delta Realization Curve. Maps the frequency/value of
 * flushResidualDelta (ResidualDeltaReclaimed) executions. Live when the indexer
 * has reclaim events; demo curve otherwise. STN/LTN toggle morphs the chart.
 */
export function DeltaCurve({ events }: { events: StreamEvent[] }) {
  const [mode, setMode] = useState<"STN" | "LTN">("STN");

  const reclaims = useMemo(
    () => events.filter((e) => e.eventName === "ResidualDeltaReclaimed").sort((a, b) => a.blockNumber - b.blockNumber),
    [events],
  );
  const live = reclaims.length >= 2;

  const { series, total } = useMemo(() => {
    if (live) {
      let cum = 0;
      const s = reclaims.map((e, i) => {
        const amt = Number((e.args?.["varianceSwept"] as string) ?? "0");
        cum += isFinite(amt) ? amt / 1e6 : 0;
        return { t: i, v: cum };
      });
      return { series: s, total: cum };
    }
    const demo = mockDeltaSeries(24).map((d) => ({ t: d.t, v: mode === "STN" ? d.stn : d.ltn }));
    return { series: demo, total: demo[demo.length - 1]?.v ?? 0 };
  }, [live, reclaims, mode]);

  // headline reclaimed total: live sum if available, else demo
  const headline = live
    ? toUsdc(reclaims.reduce((acc, e) => acc + BigInt((e.args?.["varianceSwept"] as string) ?? "0"), 0n).toString())
    : total;

  return (
    <Glass className="flex flex-col p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>STN / LTN delta realization</Eyebrow>
        <div className="flex items-center gap-2">
          {!live && <DemoTag />}
          <div className="flex rounded-full border border-glass-border p-0.5">
            {(["STN", "LTN"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-2.5 py-1 font-mono text-[10px] tracking-wider transition ${
                  mode === m ? "bg-emerald-core/20 text-emerald-core" : "text-ink-faint hover:text-ink-secondary"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 telemetry text-[22px] font-bold text-ink-primary">${fmtUsd(headline)}</div>
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

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          className="rounded-xl bg-emerald-core/15 px-3 py-2.5 font-mono text-xs font-semibold tracking-wide text-emerald-core ring-1 ring-emerald-core/30 transition hover:bg-emerald-core/25"
          title="Visual stub — fund flow not wired this pass"
        >
          Fund stream
        </button>
        <button
          className="rounded-xl border border-glass-border px-3 py-2.5 font-mono text-xs tracking-wide text-ink-secondary transition hover:border-emerald-core/50 hover:text-ink-primary"
          title="Visual stub — flush flow not wired this pass"
        >
          Flush delta
        </button>
      </div>
    </Glass>
  );
}
