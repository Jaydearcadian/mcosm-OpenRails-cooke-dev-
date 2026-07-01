import { Link } from "react-router-dom";

export type CockpitTab = "deck" | "streams" | "profile" | "merchant" | "creator";

const TABS: { id: CockpitTab; glyph: string; label: string }[] = [
  { id: "deck", glyph: "▦", label: "Deck" },
  { id: "streams", glyph: "≋", label: "My Streams" },
  { id: "profile", glyph: "◍", label: "Profile" },
  { id: "merchant", glyph: "⤳", label: "Merchant" },
  { id: "creator", glyph: "◈", label: "Creator" },
];

export function Sidebar({
  active,
  onTab,
}: {
  active: CockpitTab;
  onTab: (t: CockpitTab) => void;
}) {
  return (
    <nav
      aria-label="Cockpit sections"
      className="glass sticky top-4 hidden h-[calc(100vh-2rem)] w-52 shrink-0 flex-col gap-1 rounded-3xl p-4 md:flex"
    >
      <Link
        to="/"
        title="Home"
        className="mb-4 flex items-center gap-2 px-2 font-mono text-base font-bold text-emerald-core"
      >
        //openrails
      </Link>
      {TABS.map((t) => (
        <button
          key={t.id}
          aria-current={active === t.id ? "page" : undefined}
          onClick={() => onTab(t.id)}
          className={[
            "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-mono text-[13px] transition",
            active === t.id
              ? "bg-emerald-core/15 text-emerald-core ring-1 ring-emerald-core/40 backdrop-blur-[8px]"
              : "text-ink-secondary hover:bg-white/5 hover:text-ink-primary",
          ].join(" ")}
        >
          <span aria-hidden className="w-5 text-center text-lg">{t.glyph}</span>
          <span>{t.label}</span>
        </button>
      ))}
      <div className="mt-auto flex items-center gap-2 px-3 font-mono text-[10px] text-ink-faint" title="Telemetry live">
        <span className="h-2 w-2 animate-pulse-orb rounded-full bg-emerald-core" />
        Telemetry live
      </div>
    </nav>
  );
}
