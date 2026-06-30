import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Eyebrow } from "../Glass";
import { shortHex, type GatewayConfig, type ConnectionState } from "../../lib/api";

export function CockpitHeader({
  config,
  conn,
  blockHigh,
}: {
  config: GatewayConfig | null;
  conn: ConnectionState;
  blockHigh: number | null;
}) {
  const { address, isConnected } = useAccount();
  const epochLo = blockHigh ? (blockHigh - 1000).toLocaleString("en-US") : "—";
  const epochHi = blockHigh ? blockHigh.toLocaleString("en-US") : "—";
  const displayAddr = isConnected && address ? shortHex(address, 6, 4) : "—";

  return (
    <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Eyebrow>{isConnected ? "Connected address" : "System call // not connected"}</Eyebrow>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="telemetry text-3xl font-medium text-ink-primary md:text-[32px]">
            {displayAddr}
          </h1>
          <span
            className={`h-2 w-2 rounded-full ${conn.online ? "animate-pulse-orb bg-emerald-core" : "bg-white/30"}`}
            title={conn.online ? "Gateway live" : "Gateway offline"}
          />
        </div>
        <div className="mt-1 font-mono text-[11px] tracking-wider text-ink-faint">
          {config
            ? `${config.networkMode} · chain ${config.chainId} · Arc-L1 // HubV1`
            : "connecting to gateway…"}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="glass-soft px-4 py-2">
          <div className="eyebrow">Block epoch</div>
          <div className="telemetry mt-0.5 text-sm text-ink-primary">
            {epochLo} – {epochHi}
          </div>
        </div>
        {/* RainbowKit handles wallet connect + chain switching */}
        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus="avatar"
          label="Connect Wallet"
        />
      </div>
    </header>
  );
}
