import type { CSSProperties, ReactNode } from "react";

/** The frosted-glass card used throughout the new Cockpit design. */
export function Panel({ children, style, maxWidth }: { children: ReactNode; style?: CSSProperties; maxWidth?: number }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.66)",
        backdropFilter: "blur(22px) saturate(160%)",
        WebkitBackdropFilter: "blur(22px) saturate(160%)",
        border: "1px solid rgba(11,17,32,0.08)",
        borderRadius: 20,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 14px 40px rgba(11,17,32,0.07)",
        overflow: "hidden",
        maxWidth,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function RefreshButton({ onClick, spinning, label = "Refresh" }: { onClick: () => void; spinning?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        fontWeight: 600,
        color: "rgba(11,17,32,0.66)",
        border: "1px solid rgba(11,17,32,0.14)",
        background: "rgba(255,255,255,0.7)",
        borderRadius: 999,
        padding: "8px 14px",
        cursor: "pointer",
      }}
    >
      <span style={{ display: "inline-block", fontSize: 12, animation: spinning ? "ck-spin 0.8s linear infinite" : undefined }}>↻</span> {label}
    </button>
  );
}

export function StatusPill({ dot, text, bg, bd, children }: { dot: string; text: string; bg: string; bd: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10.5,
        fontWeight: 600,
        color: text,
        background: bg,
        border: `1px solid ${bd}`,
        borderRadius: 999,
        padding: "3px 10px",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  style,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: "Inter, sans-serif",
        fontSize: 13,
        fontWeight: 600,
        color: "#FFFFFF",
        background: disabled ? "rgba(4,7,13,0.4)" : "#04070D",
        border: "none",
        borderRadius: 10,
        padding: "11px 20px",
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: "Inter, sans-serif",
        fontSize: 13,
        fontWeight: 600,
        color: "#0B1120",
        background: "rgba(255,255,255,0.7)",
        border: "1px solid rgba(11,17,32,0.16)",
        borderRadius: 10,
        padding: "11px 18px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        border: "1px solid rgba(11,17,32,0.12)",
        borderRadius: 10,
        padding: "11px 13px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12.5,
        color: "#0B1120",
        background: "rgba(255,255,255,0.8)",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        ...props.style,
      }}
    />
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(11,17,32,0.5)" }}>
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, body, actions }: { icon: string; title: string; body: string; actions?: ReactNode }) {
  return (
    <div style={{ padding: "44px 22px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <span style={{ display: "grid", placeItems: "center", width: 52, height: 52, borderRadius: 14, background: "rgba(0,158,96,0.1)", color: "#009E60", fontFamily: "'JetBrains Mono', monospace", fontSize: 22 }}>
        {icon}
      </span>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      <div style={{ maxWidth: 420, fontSize: 13, lineHeight: 1.6, color: "rgba(11,17,32,0.55)" }}>{body}</div>
      {actions && <div style={{ display: "flex", gap: 10, marginTop: 4 }}>{actions}</div>}
    </div>
  );
}

export function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div style={{ padding: "44px 22px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 13, background: "rgba(199,58,58,0.1)", color: "#C73A3A", fontSize: 20 }}>!</span>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Couldn't reach the indexer</div>
      <div style={{ maxWidth: 440, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, lineHeight: 1.6, color: "rgba(11,17,32,0.55)" }}>{msg}</div>
      <PrimaryButton onClick={onRetry} style={{ borderRadius: 999, padding: "10px 18px" }}>
        Retry
      </PrimaryButton>
    </div>
  );
}

export function LoadingSkeletons({ rows = 4, height = 30 }: { rows?: number; height?: number }) {
  return (
    <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: 8,
            background: "linear-gradient(90deg, rgba(11,17,32,0.05), rgba(11,17,32,0.1), rgba(11,17,32,0.05))",
            backgroundSize: "840px 100%",
            animation: "ck-shimmer 1.4s linear infinite",
          }}
        />
      ))}
    </div>
  );
}
