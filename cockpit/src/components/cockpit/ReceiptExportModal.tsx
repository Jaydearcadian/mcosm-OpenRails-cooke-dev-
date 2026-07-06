import { useState } from "react";
import { SecondaryButton, PrimaryButton } from "./Panel";

export interface ReceiptModalData {
  json: string;
  verified: boolean;
  metadataHash: string;
}

export function ReceiptExportModal({ receipt, onClose }: { receipt: ReceiptModalData | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!receipt) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(4,7,13,0.5)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto", background: "#FBFCFE", border: "1px solid rgba(11,17,32,0.1)", borderRadius: 20, boxShadow: "0 30px 80px rgba(4,7,13,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid rgba(11,17,32,0.07)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Portable receipt</h3>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(11,17,32,0.45)", marginTop: 3 }}>OpenRailsReceipt · serializeReceipt()</div>
          </div>
          <button type="button" onClick={onClose} style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(11,17,32,0.12)", background: "rgba(255,255,255,0.7)", color: "rgba(11,17,32,0.55)", fontSize: 16, cursor: "pointer" }}>
            ✕
          </button>
        </div>
        <div style={{ padding: "18px 24px" }}>
          {receipt.verified ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(0,158,96,0.09)", border: "1px solid rgba(0,158,96,0.3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "#00794A" }}>
              ✓ metadata verified — verifyReceiptMetadataHash passed
            </div>
          ) : (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(11,17,32,0.04)", border: "1px solid rgba(11,17,32,0.1)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(11,17,32,0.6)", wordBreak: "break-all" }}>
              No metadata available to verify — showing metadataHash only: <span style={{ color: "#0B1120" }}>{receipt.metadataHash}</span>
            </div>
          )}
          <pre
            style={{
              margin: "14px 0 0",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              lineHeight: 1.55,
              color: "#0B1120",
              background: "rgba(11,17,32,0.04)",
              border: "1px solid rgba(11,17,32,0.08)",
              borderRadius: 10,
              padding: 14,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "44vh",
            }}
          >
            {receipt.json}
          </pre>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "16px 24px", borderTop: "1px solid rgba(11,17,32,0.07)" }}>
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          <PrimaryButton
            onClick={() => {
              navigator.clipboard?.writeText(receipt.json);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? "Copied ✓" : "Copy JSON"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
