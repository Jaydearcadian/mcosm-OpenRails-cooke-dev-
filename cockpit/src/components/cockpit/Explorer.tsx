import { useEffect, useMemo, useState } from "react";
import { useIndexerStreams } from "../../lib/useIndexerStreams";
import { indexer, isEvmAddress, isBytes32Hex, type IndexedStream } from "../../lib/indexer";
import { fmtUsdcBase, shortHex, statusMeta } from "../../lib/cockpitFormat";
import { Panel } from "./Panel";

type QueryShape = "empty" | "address" | "hash" | "workflow" | "invalid";

function shapeOf(q: string): QueryShape {
  const v = q.trim();
  if (!v) return "empty";
  if (isEvmAddress(v)) return "address";
  if (isBytes32Hex(v)) return "hash";
  if (v.length >= 3) return "workflow";
  return "invalid";
}

export function Explorer({ onOpenDetail }: { onOpenDetail: (vaultAddress: string, paycardId: string) => void }) {
  const data = useIndexerStreams();
  const [q, setQ] = useState("");
  const shape = shapeOf(q);

  const addressMatches = useMemo(() => {
    if (shape !== "address") return null;
    const v = q.trim().toLowerCase();
    const sent = data.streams.filter((s) => s.payer.toLowerCase() === v);
    const received = data.streams.filter((s) => s.recipient.toLowerCase() === v);
    return { sent, received };
  }, [shape, q, data.streams]);

  // Live server-side lookup across every vault — resolves the paycardId-vs-tx-hash ambiguity
  // by actually asking the indexer (workers/indexer-worker's /streams?paycardId= filter) rather
  // than only searching whatever happens to already be loaded client-side.
  const [hashMatches, setHashMatches] = useState<IndexedStream[] | null>(null);
  const [hashLoading, setHashLoading] = useState(false);
  const [txFallback, setTxFallback] = useState<{ events: number; streams: IndexedStream[] } | null>(null);

  useEffect(() => {
    if (shape !== "hash") {
      setHashMatches(null);
      setTxFallback(null);
      return;
    }
    let alive = true;
    setHashLoading(true);
    setTxFallback(null);
    const query = q.trim();
    indexer
      .streams({ paycardId: query })
      .then(async (res) => {
        if (!alive) return;
        setHashMatches(res.streams);
        // Zero paycardId matches — the same 0x-64 shape could be a transaction hash instead.
        if (res.streams.length === 0) {
          try {
            const tx = await indexer.transactions(query);
            if (alive) setTxFallback({ events: tx.events.length, streams: tx.streams });
          } catch {
            if (alive) setTxFallback({ events: 0, streams: [] });
          }
        }
      })
      .catch(() => alive && setHashMatches([]))
      .finally(() => alive && setHashLoading(false));
    return () => {
      alive = false;
    };
  }, [shape, q]);

  return (
    <div style={{ maxWidth: 920 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(20px) saturate(160%)",
          border: "1px solid rgba(11,17,32,0.1)",
          borderRadius: 14,
          padding: "12px 16px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 26px rgba(11,17,32,0.06)",
        }}
      >
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "rgba(11,17,32,0.4)" }}>⌕</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Address · paycardId · tx hash · workflowId"
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#0B1120", minWidth: 0 }}
        />
        {q && (
          <button type="button" onClick={() => setQ("")} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(11,17,32,0.5)", background: "rgba(11,17,32,0.05)", border: "none", borderRadius: 8, padding: "6px 11px", cursor: "pointer" }}>
            clear
          </button>
        )}
      </div>

      {shape === "empty" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginTop: 16 }}>
          <Panel>
            <div style={{ padding: "16px 20px 12px", fontSize: 14, fontWeight: 700 }}>Recent activity</div>
            {data.streams.length === 0 ? (
              <div style={{ padding: "24px 20px", fontSize: 12.5, color: "rgba(11,17,32,0.5)" }}>No stream activity loaded yet.</div>
            ) : (
              data.streams.slice(0, 8).map((s) => {
                const meta = statusMeta(s.status, s.availableBalance);
                return (
                  <div
                    key={`${s.vaultAddress}:${s.paycardId}`}
                    onClick={() => onOpenDetail(s.vaultAddress, s.paycardId)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 20px", borderTop: "1px solid rgba(11,17,32,0.06)", cursor: "pointer" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>{shortHex(s.paycardId, 8, 4)}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(11,17,32,0.5)", marginTop: 3 }}>
                        {shortHex(s.payer)} → {shortHex(s.recipient)}
                      </div>
                    </div>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, color: meta.text }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot }} />
                      {meta.label}
                      <span style={{ color: "rgba(11,17,32,0.28)" }}>›</span>
                    </span>
                  </div>
                );
              })
            )}
          </Panel>
          <Panel>
            <div style={{ padding: "16px 20px 12px", fontSize: 14, fontWeight: 700 }}>Watched vaults</div>
            {data.vaults.length === 0 ? (
              <div style={{ padding: "24px 20px", fontSize: 12.5, color: "rgba(11,17,32,0.5)" }}>Vault registry loading…</div>
            ) : (
              data.vaults.map((v) => (
                <div key={v.vaultAddress} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 20px", borderTop: "1px solid rgba(11,17,32,0.06)" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>{shortHex(v.vaultAddress)}</div>
                  {v.discoverySource === "canonical" && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#00794A", background: "rgba(0,158,96,0.1)", border: "1px solid rgba(0,158,96,0.3)", borderRadius: 999, padding: "2px 8px" }}>
                      hub
                    </span>
                  )}
                </div>
              ))
            )}
          </Panel>
        </div>
      )}

      {shape === "address" && addressMatches && (
        <div style={{ marginTop: 16 }}>
          <Panel style={{ padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600 }}>{shortHex(q)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginTop: 16 }}>
              <div style={{ background: "rgba(11,17,32,0.03)", border: "1px solid rgba(11,17,32,0.06)", borderRadius: 11, padding: "12px 14px" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(11,17,32,0.42)" }}>As payer</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, marginTop: 4 }}>{addressMatches.sent.length}</div>
              </div>
              <div style={{ background: "rgba(11,17,32,0.03)", border: "1px solid rgba(11,17,32,0.06)", borderRadius: 11, padding: "12px 14px" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(11,17,32,0.42)" }}>As recipient</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, marginTop: 4 }}>{addressMatches.received.length}</div>
              </div>
            </div>
          </Panel>
          {[...addressMatches.sent, ...addressMatches.received].length === 0 ? (
            <div style={{ marginTop: 14, padding: 22, textAlign: "center", fontSize: 12.5, color: "rgba(11,17,32,0.5)", background: "rgba(255,255,255,0.5)", border: "1px solid rgba(11,17,32,0.08)", borderRadius: 14 }}>
              No loaded streams for this address.
            </div>
          ) : (
            <Panel style={{ marginTop: 14 }}>
              {[...addressMatches.sent, ...addressMatches.received].map((s) => {
                const meta = statusMeta(s.status, s.availableBalance);
                return (
                  <div key={`${s.vaultAddress}:${s.paycardId}`} onClick={() => onOpenDetail(s.vaultAddress, s.paycardId)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 20px", borderBottom: "1px solid rgba(11,17,32,0.05)", cursor: "pointer" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>{shortHex(s.paycardId, 8, 4)}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(11,17,32,0.5)", marginTop: 3 }}>
                        {shortHex(s.payer)} → {shortHex(s.recipient)} · {fmtUsdcBase(s.totalAllocation, 2)} USDC
                      </div>
                    </div>
                    <span style={{ color: meta.text }}>{meta.label}</span>
                  </div>
                );
              })}
            </Panel>
          )}
        </div>
      )}

      {shape === "hash" && hashMatches && hashMatches.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 10, background: "rgba(214,175,80,0.1)", border: "1px solid rgba(214,175,80,0.3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.5, color: "#8A6D00" }}>
            This paycardId exists on multiple vaults — pick one.
          </div>
          <Panel style={{ marginTop: 12 }}>
            {hashMatches.map((s) => (
              <div key={`${s.vaultAddress}:${s.paycardId}`} onClick={() => onOpenDetail(s.vaultAddress, s.paycardId)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px", borderBottom: "1px solid rgba(11,17,32,0.05)", cursor: "pointer" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>vault {shortHex(s.vaultAddress)}</div>
              </div>
            ))}
          </Panel>
        </div>
      )}

      {shape === "hash" && hashMatches && hashMatches.length === 1 && (
        <div style={{ marginTop: 16 }}>
          <Panel>
            <div onClick={() => onOpenDetail(hashMatches[0].vaultAddress, hashMatches[0].paycardId)} style={{ padding: "14px 20px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>
              {shortHex(hashMatches[0].paycardId, 8, 4)} → open detail ›
            </div>
          </Panel>
        </div>
      )}

      {shape === "hash" && hashLoading && (
        <div style={{ marginTop: 16, padding: "26px 22px", textAlign: "center", fontSize: 12.5, color: "rgba(11,17,32,0.5)" }}>Searching every vault…</div>
      )}

      {shape === "hash" && !hashLoading && hashMatches && hashMatches.length === 0 && txFallback && txFallback.streams.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ padding: "11px 14px", borderRadius: 10, background: "rgba(42,111,219,0.1)", border: "1px solid rgba(42,111,219,0.3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#1E4FA3", marginBottom: 12 }}>
            Not a paycardId — resolved as a transaction hash instead.
          </div>
          <Panel>
            {txFallback.streams.map((s) => (
              <div key={`${s.vaultAddress}:${s.paycardId}`} onClick={() => onOpenDetail(s.vaultAddress, s.paycardId)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px", borderBottom: "1px solid rgba(11,17,32,0.05)", cursor: "pointer" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>{shortHex(s.paycardId, 8, 4)}</div>
                <span style={{ color: "rgba(11,17,32,0.28)" }}>›</span>
              </div>
            ))}
          </Panel>
        </div>
      )}

      {shape === "hash" && !hashLoading && hashMatches && hashMatches.length === 0 && txFallback && txFallback.streams.length === 0 && (
        <div style={{ marginTop: 16, padding: "26px 22px", textAlign: "center", background: "rgba(255,255,255,0.6)", border: "1px solid rgba(11,17,32,0.08)", borderRadius: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>No match, as either a paycardId or a transaction hash</div>
          <div style={{ marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.6, color: "rgba(11,17,32,0.55)", maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
            Checked every watched vault's paycard state and the indexer's transaction log — genuinely not found, not just
            outside a loaded window.
          </div>
        </div>
      )}

      {shape === "workflow" && (
        <div style={{ marginTop: 16, padding: "26px 22px", textAlign: "center", background: "rgba(255,255,255,0.6)", border: "1px solid rgba(11,17,32,0.08)", borderRadius: 16 }}>
          <span style={{ display: "inline-grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: "rgba(11,17,32,0.05)", color: "rgba(11,17,32,0.5)", fontFamily: "'JetBrains Mono', monospace", fontSize: 18 }}>⧗</span>
          <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>Workflow lookup isn't supported yet</div>
          <div style={{ marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.6, color: "rgba(11,17,32,0.55)", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
            The indexer's <span style={{ color: "#0B1120" }}>GET /workflows/:id</span> returns 501 today. Treat an empty response as
            "unavailable", never as "no data".
          </div>
        </div>
      )}
    </div>
  );
}
