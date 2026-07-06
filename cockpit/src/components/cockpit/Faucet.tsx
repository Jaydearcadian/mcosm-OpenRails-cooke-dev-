import { useState } from "react";
import { requestFaucetFund } from "../../lib/faucet";
import { PrimaryButton, TextInput, FieldLabel } from "./Panel";

export function Faucet() {
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; title: string; body: string } | null>(null);

  async function request() {
    setBusy(true);
    setResult(null);
    const res = await requestFaucetFund(addr);
    if (res.ok && !res.skipped) {
      setResult({ ok: true, title: "Funded ✓", body: `${res.amount} USDC sent · ${res.txHash}` });
    } else if (res.ok && res.skipped) {
      setResult({ ok: true, title: "Already funded", body: `Balance ${res.balance} USDC — skipped, no action needed.` });
    } else {
      const extra = res.retryAfterSeconds ? ` · retry in ${res.retryAfterSeconds}s` : res.faucetAddress ? ` · faucet ${res.faucetAddress} needs a top-up` : "";
      setResult({ ok: false, title: "Couldn't fund", body: res.error + extra });
    }
    setBusy(false);
  }

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        background: "rgba(255,255,255,0.7)",
        border: "1px solid rgba(11,17,32,0.08)",
        borderRadius: 20,
        padding: "28px 30px",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 14px 34px rgba(11,17,32,0.07)",
      }}
    >
      <div style={{ display: "grid", placeItems: "center", width: 54, height: 54, borderRadius: 15, background: "rgba(0,158,96,0.1)", color: "#009E60", fontFamily: "'JetBrains Mono', monospace", fontSize: 24 }}>⛲</div>
      <h2 style={{ margin: "18px 0 0", fontSize: 19, fontWeight: 700 }}>Fund a testnet wallet</h2>
      <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "rgba(11,17,32,0.58)" }}>
        Drips a small amount of testnet USDC (which also covers gas on Arc) to a new wallet. Capped and abuse-resistant:
        already-funded addresses are skipped, with per-address and per-IP cooldowns.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 20 }}>
        <FieldLabel>Wallet address</FieldLabel>
        <TextInput value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x… address to fund" style={{ fontSize: 13, padding: "12px 14px" }} />
      </label>
      <PrimaryButton onClick={request} disabled={busy || !/^0x[a-fA-F0-9]{40}$/.test(addr)} style={{ marginTop: 16, width: "100%", padding: 14, fontSize: 14, borderRadius: 12 }}>
        {busy ? "Requesting…" : "⛲ Fund this wallet"}
      </PrimaryButton>
      {result && (
        <div
          style={{
            marginTop: 16,
            padding: "14px 16px",
            borderRadius: 12,
            background: result.ok ? "rgba(0,158,96,0.08)" : "rgba(199,58,58,0.08)",
            border: `1px solid ${result.ok ? "rgba(0,158,96,0.3)" : "rgba(199,58,58,0.3)"}`,
          }}
        >
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, marginBottom: 4, color: result.ok ? "#00794A" : "#9A2A2A" }}>{result.title}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.6, wordBreak: "break-all", color: "rgba(11,17,32,0.7)" }}>{result.body}</div>
        </div>
      )}
      <div style={{ marginTop: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(11,17,32,0.4)" }}>
        POST /fund · public, CORS-enabled · openrails-faucet-worker.microcosm.workers.dev
      </div>
    </div>
  );
}
