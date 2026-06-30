import { useAccount } from "wagmi";
import { Glass, Eyebrow, DemoTag } from "../Glass";
import { fmtUsd, toUsdc, useWalletBalance, type GatewayConfig } from "../../lib/api";

/** Card A — Operational Float. Live USDC balance + Hub allowance for connected wallet. */
export function AllocationPool({ config }: { config: GatewayConfig | null }) {
  const { address, isConnected } = useAccount();
  const hubAddress = config?.clearinghouseAddress;
  const targetAddress = isConnected ? address : config?.relayerAddress;
  const { balance, allowance } = useWalletBalance(targetAddress, hubAddress);

  const balanceUsd = toUsdc(balance);
  const allowanceUsd = toUsdc(allowance);
  const isLive = !!targetAddress;
  const chainLabel = config ? `Arc · ${config.chainId}` : "Arc-L1";

  return (
    <Glass className="relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-core/25 via-emerald-core/5 to-transparent" />
        <div className="absolute inset-0 opacity-[0.12] bg-[linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[size:14px_14px]" />
      </div>
      <div className="relative">
        <div className="flex items-center justify-between">
          <Eyebrow>{isConnected ? "Wallet USDC balance" : "Relayer USDC float"}</Eyebrow>
          {isLive ? (
            <span className="font-mono text-[10px] tracking-wider text-emerald-core">live</span>
          ) : (
            <DemoTag />
          )}
        </div>
        <div className="mt-4 telemetry text-[28px] font-bold leading-none text-ink-primary">
          ${fmtUsd(balanceUsd)}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px]">
          <dt className="text-ink-faint">Hub allowance</dt>
          <dd className="text-right text-ink-secondary">
            {isLive ? `$${fmtUsd(allowanceUsd)}` : "—"}
          </dd>
          <dt className="text-ink-faint">Channel</dt>
          <dd className="text-right text-ink-secondary">{chainLabel}</dd>
          <dt className="text-ink-faint">Config</dt>
          <dd className="text-right text-emerald-core">Arc-L1 // HubV1</dd>
        </dl>
      </div>
    </Glass>
  );
}
