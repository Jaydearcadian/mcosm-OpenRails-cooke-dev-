/**
 * Docs — OpenRails documentation page, ported byte-for-byte from the approved
 * Claude Design prototype (DCLogic). Sidebar nav over 9 topics, hash-synced
 * topic routing, exact block renderer. Mounted at /docs.
 *
 * Visual values are literal from the source prototype — do not drift toward the
 * slightly different rgba alphas in Panel.tsx; fidelity to the source is the goal.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import "./Docs.css";
import { DOCS, NAV_GROUPS, ORDER, type Block } from "../lib/docsContent";

const MONO = "'JetBrains Mono', monospace";

// ── responsive breakpoint hook (matches the 768px audit breakpoint) ──
// Drawer open/close is React state; this only tracks whether we're below the
// breakpoint, and re-evaluates on resize / orientation change.
function useIsMobile(query = "(max-width: 767px)") {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    window.addEventListener("resize", on);
    return () => {
      mq.removeEventListener("change", on);
      window.removeEventListener("resize", on);
    };
  }, [query]);
  return matches;
}

// ── block sub-components (exact styles from source block renderer) ──

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [label, setLabel] = useState("copy");
  const onCopy = () => {
    try {
      navigator.clipboard
        .writeText(code)
        .then(() => {
          setLabel("copied ✓");
          setTimeout(() => setLabel("copy"), 1400);
        })
        .catch(() => {});
    } catch {
      /* clipboard unavailable — never throw */
    }
  };
  return (
    <div
      style={{
        margin: "18px 0 0",
        background: "#04070D",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 14px 34px rgba(4,7,13,0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          {lang}
        </span>
        <button
          type="button"
          className="dk-copy-btn"
          onClick={onCopy}
          style={{
            fontFamily: MONO,
            fontSize: 10.5,
            color: "rgba(255,255,255,0.6)",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 7,
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          {label}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "16px 18px",
          fontFamily: MONO,
          fontSize: 12.5,
          lineHeight: 1.7,
          color: "rgba(255,255,255,0.86)",
          overflowX: "auto",
          whiteSpace: "pre",
        }}
      >
        {code}
      </pre>
    </div>
  );
}

const CALLOUT_MAP: Record<"note" | "warn", { tag: string; color: string; bg: string; border: string }> = {
  note: { tag: "NOTE", color: "#00794A", bg: "rgba(0,158,96,0.08)", border: "rgba(0,158,96,0.28)" },
  warn: { tag: "CAUTION", color: "#8A6D00", bg: "rgba(214,175,80,0.12)", border: "rgba(214,175,80,0.4)" },
};

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "h2":
      return <h2 style={{ margin: "34px 0 0", fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em" }}>{block.text}</h2>;
    case "h3":
      return (
        <h3 style={{ margin: "26px 0 0", fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", color: "#0B1120" }}>
          {block.text}
        </h3>
      );
    case "p":
      return (
        <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.72, color: "rgba(11,17,32,0.7)", textWrap: "pretty" as CSSProperties["textWrap"] }}>
          {block.text}
        </p>
      );
    case "code":
      return <CodeBlock lang={block.lang} code={block.code} />;
    case "callout": {
      const c = CALLOUT_MAP[block.variant];
      return (
        <div
          style={{
            margin: "18px 0 0",
            padding: "14px 16px",
            borderRadius: 12,
            fontSize: 14,
            lineHeight: 1.6,
            color: c.color,
            background: c.bg,
            border: `1px solid ${c.border}`,
          }}
        >
          <span style={{ fontWeight: 700, marginRight: 8 }}>{c.tag}</span>
          {block.text}
        </div>
      );
    }
    case "list":
      return (
        <div style={{ margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 9 }}>
          {block.items.map((li, i) => (
            <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 15, lineHeight: 1.6, color: "rgba(11,17,32,0.7)" }}>
              <span style={{ flex: "0 0 auto", color: "#009E60", marginTop: 2 }}>◆</span>
              <span style={{ textWrap: "pretty" as CSSProperties["textWrap"] }}>{li}</span>
            </div>
          ))}
        </div>
      );
    case "kv":
      return (
        <div
          style={{
            margin: "18px 0 0",
            border: "1px solid rgba(11,17,32,0.09)",
            borderRadius: 14,
            overflow: "hidden",
            background: "rgba(255,255,255,0.55)",
          }}
        >
          {block.rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "0.8fr 1.6fr",
                gap: 14,
                padding: "12px 16px",
                borderBottom: "1px solid rgba(11,17,32,0.06)",
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 12, color: "rgba(11,17,32,0.52)" }}>{row.k}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#0B1120", wordBreak: "break-all" }}>{row.v}</span>
            </div>
          ))}
        </div>
      );
    case "steps":
      return (
        <div style={{ margin: "18px 0 0", display: "flex", flexDirection: "column", gap: 14 }}>
          {block.items.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span
                style={{
                  flex: "0 0 auto",
                  display: "grid",
                  placeItems: "center",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "rgba(0,158,96,0.1)",
                  color: "#009E60",
                  fontFamily: MONO,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {s.n}
              </span>
              <div style={{ paddingTop: 2 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{s.title}</div>
                <div style={{ marginTop: 3, fontSize: 14, lineHeight: 1.6, color: "rgba(11,17,32,0.62)" }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

// ── nav item ──

function NavItem({ id, label, on, onSelect }: { id: string; label: string; on: boolean; onSelect: (id: string) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        cursor: "pointer",
        marginTop: 2,
        borderRadius: 9,
        padding: "8px 12px",
        fontFamily: "Inter, sans-serif",
        fontSize: 13.5,
        fontWeight: on ? 600 : 500,
        color: on ? "#0B1120" : "rgba(11,17,32,0.6)",
        background: on ? "rgba(255,255,255,0.9)" : hover ? "rgba(11,17,32,0.045)" : "transparent",
        boxShadow: on ? "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 16px rgba(11,17,32,0.08)" : "none",
        transition: "background 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}

// ── page ──

export default function Docs() {
  const [topic, setTopic] = useState<string>("quickstart");
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Never leave the drawer "open" state stranded when growing past the breakpoint.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const fromHash = (location.hash || "").replace("#", "");
    if (fromHash && DOCS[fromHash]) setTopic(fromHash);
    const onHash = () => {
      const t = (location.hash || "").replace("#", "");
      if (t && DOCS[t]) setTopic(t);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navTo = (id: string) => {
    setTopic(id);
    setDrawerOpen(false); // land on content, not stuck looking at the drawer
    try {
      history.replaceState(null, "", "#" + id);
    } catch {
      /* ignore */
    }
    const m = document.querySelector("main");
    if (m) m.scrollTop = 0;
  };

  const doc = DOCS[topic];
  const idx = ORDER.indexOf(topic as (typeof ORDER)[number]);
  const prevId = idx > 0 ? ORDER[idx - 1] : null;
  const nextId = idx >= 0 && idx < ORDER.length - 1 ? ORDER[idx + 1] : null;
  const prevTitle = prevId ? DOCS[prevId].title : "";
  const nextTitle = nextId ? DOCS[nextId].title : "";

  // Desktop branch is byte-identical to the source prototype. Mobile turns the
  // aside into a fixed off-canvas drawer that slides in over the content.
  const asideStyle: CSSProperties = isMobile
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: 272,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.62)",
        backdropFilter: "blur(22px) saturate(160%)",
        WebkitBackdropFilter: "blur(22px) saturate(160%)",
        borderRight: "1px solid rgba(11,17,32,0.08)",
        transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: drawerOpen ? "0 20px 60px rgba(4,7,13,0.28)" : "none",
      }
    : {
        flex: "0 0 272px",
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.62)",
        backdropFilter: "blur(22px) saturate(160%)",
        WebkitBackdropFilter: "blur(22px) saturate(160%)",
        borderRight: "1px solid rgba(11,17,32,0.08)",
      };

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#0B1120",
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "radial-gradient(120% 100% at 100% 0%, #FDFEFF 0%, #EDF0F4 55%, #E4E8EE 100%)",
      }}
    >
      {/* backdrop — mobile drawer only */}
      {isMobile && drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(4,7,13,0.42)", animation: "dk-backdrop-in 0.2s ease" }}
        />
      )}

      {/* ══════════ SIDEBAR ══════════ */}
      <aside style={asideStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "20px 22px 16px" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "#0B1120" }}>
            <span
              style={{
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
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, letterSpacing: "0.16em" }}>OPENRAILS</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 9.5,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "rgba(11,17,32,0.4)",
                }}
              >
                Docs
              </span>
            </span>
          </Link>
        </div>
        <nav className="dk-scroll" style={{ flex: 1, overflowY: "auto", padding: "6px 14px 20px" }}>
          {NAV_GROUPS.map((g, gi) => (
            <div key={g.label} style={{ marginTop: gi === 0 ? 0 : 18 }}>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 9.5,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "rgba(11,17,32,0.36)",
                  padding: "0 12px 8px",
                }}
              >
                {g.label}
              </div>
              {g.items.map(([id, label]) => (
                <NavItem key={id} id={id} label={label} on={id === topic} onSelect={navTo} />
              ))}
            </div>
          ))}
        </nav>
        <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(11,17,32,0.08)", display: "flex", gap: 16, fontSize: 12 }}>
          <Link to="/cockpit" className="dk-footer-link">
            Cockpit
          </Link>
          <a href="https://github.com/Jaydearcadian/mcosm-openrails" target="_blank" rel="noreferrer" className="dk-footer-link">
            GitHub ↗
          </a>
        </div>
      </aside>

      {/* ══════════ MAIN ══════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            padding: isMobile ? "12px 16px" : "15px 40px",
            borderBottom: "1px solid rgba(11,17,32,0.08)",
            background: "rgba(237,240,244,0.7)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {isMobile && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
                style={{
                  flex: "0 0 auto",
                  display: "grid",
                  placeItems: "center",
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  border: "1px solid rgba(11,17,32,0.12)",
                  background: "rgba(255,255,255,0.7)",
                  color: "#0B1120",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                ☰
              </button>
            )}
            <div style={{ fontFamily: MONO, fontSize: 11.5, color: "rgba(11,17,32,0.5)", ...(isMobile ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } : null) }}>
              Docs <span style={{ color: "rgba(11,17,32,0.3)" }}>/</span> <span style={{ color: "#0B1120" }}>{doc.title}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!isMobile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: MONO,
                fontSize: 10.5,
                color: "rgba(11,17,32,0.5)",
                border: "1px solid rgba(11,17,32,0.12)",
                background: "rgba(255,255,255,0.6)",
                borderRadius: 999,
                padding: "7px 13px",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#00C878",
                  boxShadow: "0 0 8px rgba(0,200,120,0.9)",
                  animation: "dk-pulse 2.2s ease-in-out infinite",
                }}
              />
              Arc testnet · unaudited
            </div>
            )}
            <Link
              to="/cockpit"
              className="dk-cta"
              style={{
                fontFamily: MONO,
                fontSize: 12,
                fontWeight: 600,
                color: "#FFFFFF",
                textDecoration: "none",
                background: "#04070D",
                borderRadius: 999,
                padding: "9px 16px",
              }}
            >
              Open Cockpit →
            </Link>
          </div>
        </header>

        <main className="dk-scroll" style={{ flex: 1, overflowY: "auto", padding: isMobile ? "28px 18px 64px" : "44px 40px 80px" }}>
          <div key={topic} style={{ maxWidth: 820, margin: "0 auto", animation: "dk-in 0.4s ease both" }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#009E60",
              }}
            >
              {doc.eyebrow}
            </div>
            <h1 style={{ margin: "12px 0 0", fontSize: 38, fontWeight: 700, letterSpacing: "-0.03em" }}>{doc.title}</h1>
            <p
              style={{
                margin: "14px 0 0",
                fontSize: 17,
                lineHeight: 1.6,
                color: "rgba(11,17,32,0.6)",
                textWrap: "pretty" as CSSProperties["textWrap"],
              }}
            >
              {doc.subtitle}
            </p>
            <div style={{ height: 1, background: "rgba(11,17,32,0.1)", margin: "28px 0 0" }} />

            {doc.blocks.map((b, i) => (
              <BlockView key={i} block={b} />
            ))}

            {/* prev / next */}
            <div style={{ height: 1, background: "rgba(11,17,32,0.1)", margin: "44px 0 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 22 }}>
              {prevId ? (
                <PrevNextButton align="left" label="← Previous" title={prevTitle} onClick={() => navTo(prevId)} />
              ) : (
                <span />
              )}
              {nextId ? (
                <PrevNextButton align="right" label="Next →" title={nextTitle} onClick={() => navTo(nextId)} />
              ) : (
                <span />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function PrevNextButton({
  align,
  label,
  title,
  onClick,
}: {
  align: "left" | "right";
  label: string;
  title: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: align,
        background: "rgba(255,255,255,0.6)",
        border: `1px solid ${hover ? "rgba(11,17,32,0.28)" : "rgba(11,17,32,0.1)"}`,
        borderRadius: 12,
        padding: "14px 18px",
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 10, textTransform: "uppercase", color: "rgba(11,17,32,0.4)" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{title}</div>
    </button>
  );
}
