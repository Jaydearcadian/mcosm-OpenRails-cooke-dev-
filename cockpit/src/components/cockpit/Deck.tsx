import { fmtUsdcBase } from "../../lib/cockpitFormat";
import type { IndexerStreamsData } from "../../lib/useIndexerStreams";

export function Deck({ streamsData }: { streamsData: IndexerStreamsData }) {
  const { active, streams, velocityBase, settledBase, vaults } = streamsData;

  const kpis = [
    { label: "Active streams", value: String(active.length), sub: "streaming now" },
    { label: "Flow rate", value: `${fmtUsdcBase(velocityBase)} USDC/s`, sub: "aggregate" },
    { label: "Streamed", value: `${fmtUsdcBase(settledBase)} USDC`, sub: "across vaults" },
    { label: "Watched vaults", value: String(vaults.length), sub: "factory-discovered" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
      {kpis.map((k) => (
        <div
          key={k.label}
          style={{
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(20px) saturate(160%)",
            border: "1px solid rgba(11,17,32,0.08)",
            borderRadius: 16,
            padding: "18px 20px",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 26px rgba(11,17,32,0.06)",
          }}
        >
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(11,17,32,0.45)" }}>
            {k.label}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 8 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>{k.value}</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11.5, color: "rgba(11,17,32,0.5)" }}>{k.sub}</div>
        </div>
      ))}
      {streams.length === 0 && (
        <div style={{ gridColumn: "1 / -1", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(11,17,32,0.4)" }}>
          No streams indexed yet on Arc testnet — open one from + New Payment.
        </div>
      )}
    </div>
  );
}
