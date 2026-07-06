export interface ToastState {
  title: string;
  body: string;
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div
      style={{
        position: "fixed",
        zIndex: 110,
        right: 24,
        bottom: 24,
        maxWidth: 380,
        background: "#04070D",
        color: "#FFFFFF",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: "0 20px 50px rgba(4,7,13,0.4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#00C878" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C878", boxShadow: "0 0 8px rgba(0,200,120,0.9)" }} />
        {toast.title}
      </div>
      <div style={{ marginTop: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, lineHeight: 1.6, color: "rgba(255,255,255,0.72)", wordBreak: "break-all" }}>
        {toast.body}
      </div>
    </div>
  );
}
