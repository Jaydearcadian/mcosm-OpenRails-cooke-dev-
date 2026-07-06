import { Link } from "react-router-dom";
import type { CSSProperties } from "react";

export type CockpitView = "deck" | "streams" | "receipts" | "agents" | "explorer" | "faucet";

interface NavItem {
  id: CockpitView;
  name: string;
  icon: string;
  badge?: string;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Monitor",
    items: [
      { id: "deck", name: "Deck", icon: "◧" },
      { id: "streams", name: "Streams", icon: "≈", badge: "live" },
      { id: "receipts", name: "Receipts", icon: "⧉" },
    ],
  },
  {
    label: "Manage",
    items: [
      { id: "agents", name: "Agents", icon: "⌥" },
      { id: "explorer", name: "Explorer", icon: "⌕" },
    ],
  },
  {
    label: "Testnet",
    items: [{ id: "faucet", name: "Faucet", icon: "⛲" }],
  },
];

export function Sidebar({
  active,
  onSelect,
  collapsed: collapsedProp,
  onToggleCollapse,
  onNewPayment,
  indexerLive,
  isMobile = false,
  mobileOpen = false,
  onCloseMobile,
}: {
  active: CockpitView;
  onSelect: (v: CockpitView) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewPayment: () => void;
  indexerLive: boolean;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  // On phones the sidebar is a full off-canvas drawer, never the 72px icon rail.
  const collapsed = isMobile ? false : collapsedProp;

  // On mobile, selecting anything should drop the drawer so the user lands on content.
  const handleSelect = (v: CockpitView) => {
    onSelect(v);
    if (isMobile) onCloseMobile?.();
  };
  const handleNewPayment = () => {
    onNewPayment();
    if (isMobile) onCloseMobile?.();
  };

  // Desktop branch keeps the exact source values (0.55 bg, relative flex-basis rail).
  // Mobile branch: fixed off-canvas drawer sliding in over the content.
  const asideStyle: CSSProperties = isMobile
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 60,
        width: 236,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(22px) saturate(160%)",
        WebkitBackdropFilter: "blur(22px) saturate(160%)",
        borderRight: "1px solid rgba(11,17,32,0.08)",
        transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: mobileOpen ? "0 20px 60px rgba(4,7,13,0.28)" : "none",
      }
    : {
        position: "relative",
        zIndex: 2,
        flex: `0 0 ${collapsed ? "72px" : "236px"}`,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(22px) saturate(160%)",
        WebkitBackdropFilter: "blur(22px) saturate(160%)",
        borderRight: "1px solid rgba(11,17,32,0.08)",
        transition: "flex-basis 0.24s cubic-bezier(0.4,0,0.2,1)",
      };

  const brandRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    flexDirection: collapsed ? "column" : "row",
    justifyContent: collapsed ? "center" : "space-between",
    gap: collapsed ? 12 : 8,
    padding: collapsed ? "18px 0" : "18px 18px 16px",
  };

  return (
    <aside style={asideStyle}>
      <div style={brandRowStyle}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "#0B1120", overflow: "hidden" }}>
          <span
            style={{
              flex: "0 0 auto",
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "#0B0B0C",
              overflow: "hidden",
              boxShadow: "0 4px 14px rgba(4,7,13,0.28), inset 0 1px 0 rgba(255,255,255,0.14)",
            }}
          >
            <img
              src="/assets/or-logo.jpg"
              alt="OpenRails"
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.32)", display: "block" }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          </span>
          {!collapsed && (
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, whiteSpace: "nowrap" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.16em" }}>OPENRAILS</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(11,17,32,0.4)" }}>
                Cockpit
              </span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={isMobile ? onCloseMobile : onToggleCollapse}
          title={isMobile ? "Close menu" : "Toggle sidebar"}
          style={{
            flex: "0 0 auto",
            display: "grid",
            placeItems: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid rgba(11,17,32,0.1)",
            background: "rgba(255,255,255,0.6)",
            cursor: "pointer",
            color: "rgba(11,17,32,0.55)",
            fontSize: 14,
          }}
        >
          {isMobile ? "✕" : collapsed ? "»" : "«"}
        </button>
      </div>

      <div style={{ padding: "2px 14px 4px" }}>
        <button
          type="button"
          onClick={handleNewPayment}
          title="New Payment"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: "#FFFFFF",
            background: "#04070D",
            border: "none",
            cursor: "pointer",
            borderRadius: 11,
            padding: collapsed ? "11px 0" : "11px 14px",
            boxShadow: "0 6px 16px rgba(4,7,13,0.22)",
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span>
          {!collapsed && <span>New Payment</span>}
        </button>
      </div>

      <nav className="ck-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 12px 14px" }}>
        {NAV_GROUPS.map((g) => (
          <div key={g.label} style={{ marginTop: 16 }}>
            {!collapsed && (
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9.5,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "rgba(11,17,32,0.36)",
                  padding: "0 12px 8px",
                  whiteSpace: "nowrap",
                }}
              >
                {g.label}
              </div>
            )}
            {collapsed && <div style={{ height: 1, background: "rgba(11,17,32,0.08)", margin: "0 8px 8px" }} />}
            {g.items.map((it) => {
              const isActive = active === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => handleSelect(it.id)}
                  title={it.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 10px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    color: isActive ? "#00794A" : "rgba(11,17,32,0.68)",
                    background: isActive ? "rgba(0,158,96,0.1)" : "transparent",
                  }}
                >
                  <span style={{ flex: "0 0 auto", width: 18, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: isActive ? "#009E60" : "rgba(11,17,32,0.45)" }}>
                    {it.icon}
                  </span>
                  {!collapsed && <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap" }}>{it.name}</span>}
                  {!collapsed && it.badge && (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        color: it.id === "streams" && indexerLive ? "#009E60" : "rgba(11,17,32,0.4)",
                        background: it.id === "streams" && indexerLive ? "rgba(0,158,96,0.1)" : "rgba(11,17,32,0.06)",
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                    >
                      {it.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(11,17,32,0.08)", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(11,17,32,0.5)", whiteSpace: "nowrap" }}>
          <span style={{ flex: "0 0 auto", width: 6, height: 6, borderRadius: "50%", background: "#00C878", boxShadow: "0 0 8px rgba(0,200,120,0.9)" }} />
          {!collapsed && <span>Arc testnet · 5042002</span>}
        </div>
        {!collapsed && (
          <div style={{ display: "flex", gap: 14, fontSize: 12, whiteSpace: "nowrap" }}>
            <a href="https://github.com/Jaydearcadian/mcosm-openrails" target="_blank" rel="noreferrer" style={{ color: "rgba(11,17,32,0.55)", textDecoration: "none" }}>
              GitHub ↗
            </a>
            <Link to="/" style={{ color: "rgba(11,17,32,0.55)", textDecoration: "none" }}>
              Home
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
