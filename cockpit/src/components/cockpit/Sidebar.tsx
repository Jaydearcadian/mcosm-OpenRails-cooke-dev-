import { Link } from "react-router-dom";

export type CockpitTab = "deck" | "streams" | "profile" | "merchant" | "creator" | "explorer";

const TABS: { id: CockpitTab; glyph: string; label: string }[] = [
  { id: "deck", glyph: "▦", label: "Deck" },
  { id: "streams", glyph: "≋", label: "My Streams" },
  { id: "profile", glyph: "◍", label: "Profile" },
  { id: "merchant", glyph: "⤳", label: "Merchant" },
  { id: "creator", glyph: "◈", label: "Creator" },
  { id: "explorer", glyph: "⊞", label: "Explorer" },
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
      className="glass sticky top-4 hidden h-[calc(100vh-2rem)] w-20 shrink-0 flex-col items-center gap-2 rounded-3xl py-5 md:flex"
    >
      <Link
        to="/"
        title="Home"
        className="mb-3 grid h-10 w-10 place-items-center rounded-xl font-mono text-base font-bold text-emerald-core"
      >
        //
      </Link>
      {TABS.map((t) => (
        <button
          key={t.id}
          title={t.label}
          aria-current={active === t.id ? "page" : undefined}
          onClick={() => onTab(t.id)}
          className={[
            "group grid h-12 w-12 place-items-center rounded-2xl text-lg transition-transform duration-200 hover:scale-105",
            active === t.id
              ? "bg-emerald-core/15 text-emerald-core shadow-emerald-glow ring-1 ring-emerald-core/40 backdrop-blur-[8px]"
              : "text-ink-secondary hover:text-ink-primary",
          ].join(" ")}
        >
          <span aria-hidden>{t.glyph}</span>
          <span className="sr-only">{t.label}</span>
        </button>
      ))}
      <div className="mt-auto h-2 w-2 animate-pulse-orb rounded-full bg-emerald-core" title="Telemetry live" />
    </nav>
  );
}
