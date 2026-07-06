import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Panel, RefreshButton, EmptyState, ErrorState, LoadingSkeletons } from "./Panel";
import { fmtUsdcBase, shortHex, statusMeta, secsAgo } from "../../lib/cockpitFormat";
import type { IndexerStreamsData } from "../../lib/useIndexerStreams";
import type { IndexedStream } from "../../lib/indexer";

type OwnerFilter = "all" | "sent" | "received";
type StatusFilter = "all" | "streaming" | "settling" | "closed";

const OWNER_CHIPS: { id: OwnerFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent" },
  { id: "received", label: "Received" },
];
const STATUS_CHIPS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "streaming", label: "Streaming" },
  { id: "settling", label: "Settling" },
  { id: "closed", label: "Closed" },
];

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        fontWeight: 600,
        color: active ? "#FFFFFF" : "rgba(11,17,32,0.55)",
        background: active ? "#04070D" : "transparent",
        border: "none",
        borderRadius: 999,
        padding: "7px 13px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export function Streams({
  data,
  onOpenDetail,
  initialPayerFilter,
}: {
  data: IndexerStreamsData;
  onOpenDetail: (vaultAddress: string, paycardId: string) => void;
  initialPayerFilter?: string;
}) {
  const { address } = useAccount();
  const [owner, setOwner] = useState<OwnerFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [payerFilter, setPayerFilter] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");

  useEffect(() => {
    if (initialPayerFilter) setPayerFilter(initialPayerFilter);
  }, [initialPayerFilter]);

  const rows = useMemo(() => {
    const me = address?.toLowerCase();
    return data.streams.filter((s) => {
      if (owner === "sent" && s.payer.toLowerCase() !== me) return false;
      if (owner === "received" && s.recipient.toLowerCase() !== me) return false;
      if (status !== "all" && statusMeta(s.status, s.availableBalance).label !== status) return false;
      if (payerFilter.trim() && !s.payer.toLowerCase().includes(payerFilter.trim().toLowerCase())) return false;
      if (recipientFilter.trim() && !s.recipient.toLowerCase().includes(recipientFilter.trim().toLowerCase())) return false;
      return true;
    });
  }, [data.streams, owner, status, payerFilter, recipientFilter, address]);

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 22px 16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>Paycard Streams</h2>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(11,17,32,0.42)" }}>
            {rows.length} of {data.streams.length}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(11,17,32,0.4)" }}>keyed by (vault, paycardId)</span>
          <RefreshButton onClick={data.refresh} spinning={data.refreshing} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 22px 18px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, background: "rgba(11,17,32,0.045)", border: "1px solid rgba(11,17,32,0.07)", borderRadius: 999, padding: 4 }}>
          {OWNER_CHIPS.map((c) => (
            <Chip key={c.id} active={owner === c.id} label={c.label} onClick={() => setOwner(c.id)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, background: "rgba(11,17,32,0.045)", border: "1px solid rgba(11,17,32,0.07)", borderRadius: 999, padding: 4 }}>
          {STATUS_CHIPS.map((c) => (
            <Chip key={c.id} active={status === c.id} label={c.label} onClick={() => setStatus(c.id)} />
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(11,17,32,0.1)", borderRadius: 10, padding: "9px 12px" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(11,17,32,0.38)" }}>payer</span>
          <input
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value)}
            placeholder="0x… address"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#0B1120", minWidth: 0 }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(11,17,32,0.1)", borderRadius: 10, padding: "9px 12px" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(11,17,32,0.38)" }}>recipient</span>
          <input
            value={recipientFilter}
            onChange={(e) => setRecipientFilter(e.target.value)}
            placeholder="0x… address"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#0B1120", minWidth: 0 }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2.1fr 1.3fr 1.6fr 1fr 0.9fr", gap: 14, padding: "11px 22px", borderTop: "1px solid rgba(11,17,32,0.07)", borderBottom: "1px solid rgba(11,17,32,0.07)", background: "rgba(11,17,32,0.02)", fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(11,17,32,0.42)" }}>
        <div>Stream · payer → recipient</div>
        <div>Status</div>
        <div>Streamed / pool</div>
        <div>Rate</div>
        <div style={{ textAlign: "right" }}>Residual</div>
      </div>

      {data.status === "loading" && <LoadingSkeletons />}
      {data.status === "error" && <ErrorState msg={data.errorMsg} onRetry={data.refresh} />}
      {data.status === "empty" && (
        <EmptyState icon="≈" title="No open streams yet" body="The indexer sees no open Paycard Streams on Arc testnet right now. Open one with + New Payment." />
      )}
      {data.status === "ready" && rows.length === 0 && (
        <EmptyState icon="≈" title="No streams match these filters" body="Clear the filters to see all indexed streams." />
      )}
      {data.status === "ready" && rows.length > 0 && (
        <div>
          {rows.map((r) => (
            <StreamRow key={`${r.vaultAddress}:${r.paycardId}`} r={r} onClick={() => onOpenDetail(r.vaultAddress, r.paycardId)} />
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(11,17,32,0.4)" }}>
            <span>Indexer is a non-authoritative projection; the Vault is source of truth.</span>
            <span>updated {secsAgo(data.fetchedAt)}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function StreamRow({ r, onClick }: { r: IndexedStream; onClick: () => void }) {
  const meta = statusMeta(r.status, r.availableBalance);
  const spent = BigInt(r.totalAllocation || "0") - BigInt(r.availableBalance || "0");
  const pct = BigInt(r.totalAllocation || "0") > 0n ? Number((spent * 1000n) / BigInt(r.totalAllocation)) / 10 : 0;
  return (
    <div
      onClick={onClick}
      style={{ display: "grid", gridTemplateColumns: "2.1fr 1.3fr 1.6fr 1fr 0.9fr", gap: 14, padding: "15px 22px", borderBottom: "1px solid rgba(11,17,32,0.05)", alignItems: "center", cursor: "pointer" }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 600, color: "#0B1120" }}>{shortHex(r.paycardId, 8, 4)}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "rgba(11,17,32,0.36)", background: "rgba(11,17,32,0.045)", borderRadius: 5, padding: "1px 6px" }}>
            {shortHex(r.vaultAddress, 6, 4)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(11,17,32,0.52)" }}>
          <span>{shortHex(r.payer)}</span>
          <span style={{ color: "rgba(11,17,32,0.3)" }}>→</span>
          <span>{shortHex(r.recipient)}</span>
        </div>
      </div>
      <div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: meta.text, background: meta.bg, border: `1px solid ${meta.bd}`, borderRadius: 999, padding: "3px 10px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot }} />
          {meta.label}
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#0B1120" }}>
          <span style={{ fontWeight: 600 }}>{fmtUsdcBase(spent, 2)}</span> <span style={{ color: "rgba(11,17,32,0.4)" }}>/ {fmtUsdcBase(r.totalAllocation, 2)}</span>
        </div>
        <div style={{ marginTop: 7, height: 6, borderRadius: 999, background: "rgba(11,17,32,0.08)", overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: meta.dot }} />
        </div>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "rgba(11,17,32,0.7)" }}>
        {fmtUsdcBase(r.velocity, 6)}/s
      </div>
      <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "rgba(11,17,32,0.7)" }}>
        {fmtUsdcBase(r.availableBalance, 2)} <span style={{ color: "rgba(11,17,32,0.28)", marginLeft: 2 }}>›</span>
      </div>
    </div>
  );
}
