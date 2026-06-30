import { Glass, Eyebrow } from "../Glass";
import type { GatewayConfig } from "../../lib/api";

interface CapItem {
  tag: string;
  label: string;
  ok: boolean;
}

function capsFromConfig(config: GatewayConfig | null): CapItem[] {
  if (!config) return [];
  const caps = (config as GatewayConfig & { capabilities?: Record<string, boolean> }).capabilities ?? {};
  return [
    { tag: "REL", label: "Relayer open", ok: !!caps["canRelayOpen"] },
    { tag: "DRP", label: "Gateway drip settle", ok: !!caps["canGatewaySettle"] },
    {
      tag: "NET",
      label: config.networkMode === "arc-testnet" ? "Arc testnet" : "Local sandbox",
      ok: true,
    },
  ];
}

/** Card C — Gateway capabilities. Live server status from /api/config. */
export function ClientDaemons({ config }: { config: GatewayConfig | null }) {
  const caps = capsFromConfig(config);
  const mode = (config as GatewayConfig & { relayerMode?: string } | null)?.relayerMode ?? "—";

  return (
    <Glass className="p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>Gateway capabilities</Eyebrow>
        <span className={`font-mono text-[10px] tracking-wider ${config ? "text-emerald-core" : "text-ink-faint"}`}>
          {config ? "live" : "offline"}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {caps.map((c) => (
          <div
            key={c.tag}
            title={c.label}
            className={[
              "grid h-11 w-11 place-items-center rounded-full border font-mono text-[10px]",
              c.ok
                ? "border-emerald-core/40 bg-emerald-core/10 text-emerald-core"
                : "border-glass-border bg-glass-bg text-ink-faint",
            ].join(" ")}
          >
            {c.tag}
          </div>
        ))}
        {!config && (
          <div className="grid h-11 w-11 place-items-center rounded-full border border-glass-border bg-glass-bg font-mono text-[10px] text-ink-faint">
            …
          </div>
        )}
      </div>
      <p className="mt-3 font-mono text-[11px] text-ink-faint">
        {mode !== "—" ? `Relayer mode: ${mode}` : "loading gateway config…"} · non-authoritative
      </p>
    </Glass>
  );
}
