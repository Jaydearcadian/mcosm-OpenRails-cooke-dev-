import { useEffect, useState } from "react";
import { indexer } from "../../lib/indexer";
import { fmtUsdcBase, shortHex } from "../../lib/cockpitFormat";
import { Panel, TextInput, PrimaryButton } from "./Panel";

interface TaggedAgent {
  addr: string;
  label: string;
}

const STORAGE_KEY = "openrails.taggedAgents.v1";

function loadAgents(): TaggedAgent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TaggedAgent[]) : [];
  } catch {
    return [];
  }
}
function saveAgents(agents: TaggedAgent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

function AgentCard({ agent, onView, onRemove }: { agent: TaggedAgent; onView: () => void; onRemove: () => void }) {
  const [stats, setStats] = useState<{ active: number; total: number; escrowed: string; settled: string; velocity: string } | null>(null);

  useEffect(() => {
    let alive = true;
    indexer
      .streams({ payer: agent.addr })
      .then((res) => {
        if (!alive) return;
        const active = res.streams.filter((s) => s.status === "Active");
        const escrowed = active.reduce((acc, s) => acc + BigInt(s.availableBalance || "0"), 0n);
        const velocity = active.reduce((acc, s) => acc + BigInt(s.velocity || "0"), 0n);
        const settled = res.streams.reduce((acc, s) => {
          const spent = BigInt(s.totalAllocation || "0") - BigInt(s.availableBalance || "0");
          return acc + (spent > 0n ? spent : 0n);
        }, 0n);
        setStats({ active: active.length, total: res.streams.length, escrowed: escrowed.toString(), settled: settled.toString(), velocity: velocity.toString() });
      })
      .catch(() => alive && setStats({ active: 0, total: 0, escrowed: "0", settled: "0", velocity: "0" }));
    return () => {
      alive = false;
    };
  }, [agent.addr]);

  return (
    <Panel style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ flex: "0 0 auto", display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, background: "rgba(0,158,96,0.1)", color: "#009E60", fontFamily: "'JetBrains Mono', monospace", fontSize: 16 }}>⌥</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{agent.label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(11,17,32,0.5)", marginTop: 2 }}>{shortHex(agent.addr)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <button type="button" onClick={onView} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: "#0B1120", background: "rgba(255,255,255,0.7)", border: "1px solid rgba(11,17,32,0.14)", borderRadius: 999, padding: "8px 14px", cursor: "pointer" }}>
            View streams →
          </button>
          <button type="button" onClick={onRemove} title="Untag" style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(11,17,32,0.12)", background: "rgba(255,255,255,0.7)", color: "rgba(11,17,32,0.5)", fontSize: 14, cursor: "pointer" }}>
            ✕
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 16 }}>
        {[
          ["Active", stats ? `${stats.active} / ${stats.total}` : "…"],
          ["Escrowed", stats ? `${fmtUsdcBase(stats.escrowed, 2)}` : "…"],
          ["Settled", stats ? `${fmtUsdcBase(stats.settled, 2)}` : "…"],
          ["Velocity", stats ? `${fmtUsdcBase(stats.velocity, 6)}/s` : "…"],
        ].map(([label, value]) => (
          <div key={label} style={{ background: "rgba(11,17,32,0.03)", border: "1px solid rgba(11,17,32,0.06)", borderRadius: 11, padding: "12px 14px" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(11,17,32,0.42)" }}>{label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function Agents({ onOpenAgentStreams }: { onOpenAgentStreams: (addr: string) => void }) {
  const [agents, setAgents] = useState<TaggedAgent[]>([]);
  const [draftAddr, setDraftAddr] = useState("");
  const [draftLabel, setDraftLabel] = useState("");

  useEffect(() => {
    setAgents(loadAgents());
  }, []);

  function addAgent() {
    if (!/^0x[a-fA-F0-9]{40}$/.test(draftAddr)) return;
    const next = [...agents.filter((a) => a.addr.toLowerCase() !== draftAddr.toLowerCase()), { addr: draftAddr, label: draftLabel || "Untitled agent" }];
    setAgents(next);
    saveAgents(next);
    setDraftAddr("");
    setDraftLabel("");
  }
  function removeAgent(addr: string) {
    const next = agents.filter((a) => a.addr !== addr);
    setAgents(next);
    saveAgents(next);
  }

  return (
    <div style={{ maxWidth: 920 }}>
      <Panel style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Your tagged agents</h2>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(11,17,32,0.42)" }}>client-side · a label over an address</span>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <TextInput value={draftAddr} onChange={(e) => setDraftAddr(e.target.value)} placeholder="0x… agent address" />
          </div>
          <div style={{ flex: 1.4, minWidth: 150 }}>
            <TextInput value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} placeholder="Label — e.g. Content bot" style={{ fontFamily: "Inter, sans-serif", fontSize: 13 }} />
          </div>
          <PrimaryButton onClick={addAgent}>Tag agent</PrimaryButton>
        </div>
      </Panel>

      {agents.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {agents.map((a) => (
            <AgentCard key={a.addr} agent={a} onView={() => onOpenAgentStreams(a.addr)} onRemove={() => removeAgent(a.addr)} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, background: "rgba(11,17,32,0.025)", border: "1px dashed rgba(11,17,32,0.18)", borderRadius: 16, padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 10, background: "rgba(11,17,32,0.05)", color: "rgba(11,17,32,0.5)", fontFamily: "'JetBrains Mono', monospace", fontSize: 15 }}>⚙</span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Session keys &amp; spend budgets</h3>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A6D00", background: "rgba(214,175,80,0.16)", border: "1px solid rgba(214,175,80,0.4)", borderRadius: 999, padding: "3px 10px" }}>
            coming soon
          </span>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "rgba(11,17,32,0.55)", maxWidth: 640 }}>
          Once session keys ship, you'll delegate a scoped, revocable signer to an agent with daily and per-velocity caps — spend
          authority without handing over the wallet. Until then, an agent is just a regular address signing bounded intents, so it
          already appears correctly across Streams and Explorer.
        </p>
      </div>
    </div>
  );
}
