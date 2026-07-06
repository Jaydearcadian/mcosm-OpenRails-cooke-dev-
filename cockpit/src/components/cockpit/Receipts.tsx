import { useEffect, useMemo, useState } from "react";
import { indexer, type IndexedEvent } from "../../lib/indexer";
import { fmtUsdcBase, shortHex, receiptTypeMeta, eventAmount } from "../../lib/cockpitFormat";
import { Panel, RefreshButton, LoadingSkeletons } from "./Panel";
import type { ReceiptModalData } from "./ReceiptExportModal";

interface LedgerRow {
  vaultAddress: string;
  paycardId: string;
  event: IndexedEvent;
  payer: string;
  recipient: string;
  metadataHash: string;
}

const TYPE_CHIPS = [
  { id: "all", label: "All" },
  { id: "payment_opened", label: "Opened" },
  { id: "settlement_processed", label: "Settled" },
  { id: "residual_recovered", label: "Residual" },
] as const;

export function Receipts({
  connectedAddress,
  onOpenReceipt,
  onOpenStream,
}: {
  connectedAddress: string | undefined;
  onOpenReceipt: (data: ReceiptModalData) => void;
  onOpenStream: (vaultAddress: string, paycardId: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "empty">("idle");
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_CHIPS)[number]["id"]>("all");
  const [counterparty, setCounterparty] = useState("");

  async function load() {
    if (!connectedAddress) return;
    setStatus("loading");
    try {
      const [sent, received] = await Promise.all([
        indexer.streams({ payer: connectedAddress }),
        indexer.streams({ recipient: connectedAddress }),
      ]);
      const seen = new Set<string>();
      const streams = [...sent.streams, ...received.streams].filter((s) => {
        const key = `${s.vaultAddress}:${s.paycardId}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const histories = await Promise.all(streams.map((s) => indexer.history(s.vaultAddress, s.paycardId).catch(() => null)));
      const ledger: LedgerRow[] = [];
      histories.forEach((h, i) => {
        if (!h) return;
        const s = streams[i];
        for (const ev of h.events) {
          ledger.push({ vaultAddress: s.vaultAddress, paycardId: s.paycardId, event: ev, payer: s.payer, recipient: s.recipient, metadataHash: s.metadataHash });
        }
      });
      ledger.sort((a, b) => b.event.blockNumber - a.event.blockNumber || b.event.logIndex - a.event.logIndex);
      setRows(ledger);
      setStatus(ledger.length ? "ready" : "empty");
    } catch {
      setStatus("empty");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedAddress]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const meta = receiptTypeMeta(r.event.eventName);
      if (typeFilter !== "all" && meta.id !== typeFilter) return false;
      if (counterparty.trim()) {
        const cp = counterparty.trim().toLowerCase();
        const me = connectedAddress?.toLowerCase();
        const other = r.payer.toLowerCase() === me ? r.recipient : r.payer;
        if (!other.toLowerCase().includes(cp)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, counterparty, connectedAddress]);

  const summary = useMemo(() => {
    let settled = 0n;
    let residual = 0n;
    let opened = 0;
    for (const r of rows) {
      const amt = BigInt(eventAmount(r.event.eventName, r.event.args) || "0");
      if (r.event.eventName === "SettlementFlushed") settled += amt;
      if (r.event.eventName === "ResidualDeltaReclaimed") residual += amt;
      if (r.event.eventName === "PaycardProvisioned") opened += 1;
    }
    return { settled, residual, opened };
  }, [rows]);

  if (!connectedAddress) {
    return (
      <Panel style={{ padding: "44px 22px", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "rgba(11,17,32,0.55)" }}>Connect a wallet to see your receipt ledger.</div>
      </Panel>
    );
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
        {[
          ["Settled all-time", fmtUsdcBase(summary.settled), undefined],
          ["Residual recovered", fmtUsdcBase(summary.residual), "#8A6D00"],
          ["Streams opened", String(summary.opened), undefined],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(20px) saturate(160%)", border: "1px solid rgba(11,17,32,0.08)", borderRadius: 16, padding: "18px 20px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 26px rgba(11,17,32,0.05)" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(11,17,32,0.45)" }}>{label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 600, marginTop: 6, color: color ?? "#0B1120" }}>
              {value}
              {label !== "Streams opened" && <span style={{ fontSize: 12, color: "rgba(11,17,32,0.4)" }}> USDC</span>}
            </div>
          </div>
        ))}
      </div>

      <Panel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "20px 22px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Receipts</h2>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(11,17,32,0.42)" }}>{filtered.length}</span>
          </div>
          <RefreshButton onClick={load} />
        </div>
        <div style={{ padding: "0 22px 6px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(11,17,32,0.42)" }}>
          Personal event ledger · every open / settle / residual across your streams · non-authoritative
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px 16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, background: "rgba(11,17,32,0.045)", border: "1px solid rgba(11,17,32,0.07)", borderRadius: 999, padding: 4 }}>
            {TYPE_CHIPS.map((c) => (
              <button
                key={c.id}
                onClick={() => setTypeFilter(c.id)}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  fontWeight: 600,
                  color: typeFilter === c.id ? "#FFFFFF" : "rgba(11,17,32,0.55)",
                  background: typeFilter === c.id ? "#04070D" : "transparent",
                  border: "none",
                  borderRadius: 999,
                  padding: "7px 13px",
                  cursor: "pointer",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(11,17,32,0.1)", borderRadius: 10, padding: "9px 12px" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(11,17,32,0.38)" }}>counterparty</span>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="0x… address" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#0B1120", minWidth: 0 }} />
          </div>
        </div>

        {status === "loading" && <LoadingSkeletons />}
        {status === "empty" && <div style={{ padding: "34px 22px", textAlign: "center", fontSize: 13, color: "rgba(11,17,32,0.5)" }}>No receipts yet.</div>}
        {status === "ready" &&
          filtered.map((r, i) => {
            const meta = receiptTypeMeta(r.event.eventName);
            const amt = eventAmount(r.event.eventName, r.event.args);
            const me = connectedAddress.toLowerCase();
            const isPayer = r.payer.toLowerCase() === me;
            const counterpartyAddr = isPayer ? r.recipient : r.payer;
            return (
              <div key={`${r.event.transactionHash}:${r.event.logIndex}:${i}`} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1.3fr 1.1fr 1.2fr 0.9fr", gap: 14, padding: "14px 22px", borderBottom: "1px solid rgba(11,17,32,0.05)", alignItems: "center" }}>
                <div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg, border: `1px solid ${meta.bd}`, borderRadius: 999, padding: "3px 10px" }}>
                    <span>{meta.icon}</span>
                    {meta.label}
                  </span>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>{fmtUsdcBase(amt, 2)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}>{shortHex(counterpartyAddr)}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(11,17,32,0.42)" }}>{isPayer ? "you paid" : "you received"}</div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(11,17,32,0.65)" }}>{r.event.blockTimestamp ? new Date(r.event.blockTimestamp * 1000).toLocaleDateString() : "—"}</div>
                <div style={{ minWidth: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                  <button onClick={() => onOpenStream(r.vaultAddress, r.paycardId)} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "#009E60", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                    {shortHex(r.paycardId, 8, 4)} ›
                  </button>
                </div>
                <div style={{ textAlign: "right" }}>
                  <button
                    onClick={() => {
                      const receipt = {
                        version: "openrails-receipt-v1",
                        type: meta.id,
                        vaultAddress: r.vaultAddress,
                        paycardId: r.paycardId,
                        payer: r.payer,
                        recipient: r.recipient,
                        metadataHash: r.metadataHash,
                        amount: amt,
                        blockNumber: r.event.blockNumber,
                        txHash: r.event.transactionHash,
                        issuedAt: r.event.blockTimestamp,
                      };
                      onOpenReceipt({ json: JSON.stringify(receipt, null, 2), verified: false, metadataHash: r.metadataHash });
                    }}
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 600, color: "#0B1120", background: "rgba(255,255,255,0.7)", border: "1px solid rgba(11,17,32,0.14)", borderRadius: 8, padding: "6px 11px", cursor: "pointer" }}
                  >
                    Receipt ↗
                  </button>
                </div>
              </div>
            );
          })}
      </Panel>
    </div>
  );
}
