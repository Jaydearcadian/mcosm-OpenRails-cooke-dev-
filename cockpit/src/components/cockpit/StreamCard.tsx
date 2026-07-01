import { useState, useEffect, useRef } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { HUB_ABI } from "../../lib/contracts";
import { toUsdc, fmtUsd, shortHex, type PaycardOnchain } from "../../lib/api";
import { Glass } from "../Glass";

type TxPhase =
  | { phase: "idle" }
  | { phase: "pending"; action: "settle" | "flush" }
  | { phase: "submitted"; action: "settle" | "flush"; hash: `0x${string}` }
  | { phase: "success"; action: "settle" | "flush"; hash: `0x${string}` }
  | { phase: "error"; action: "settle" | "flush"; msg: string };

function fmtVelocity(basePerSec: string): string {
  const n = Number(basePerSec) / 1_000_000;
  const perHr = n * 3600;
  if (perHr >= 0.01) return `$${fmtUsd(perHr, 4)}/hr`;
  return `$${fmtUsd(n * 86400, 4)}/day`;
}

function fmtCountdown(sec: number): string {
  if (sec <= 0) return "expired";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Stat({
  label,
  value,
  mono = false,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] font-mono tracking-wider uppercase text-ink-faint">{label}</span>
      <span className={`text-[11px] text-ink-secondary truncate ${mono ? "font-mono" : ""}`}>
        {value}
        {badge && (
          <span className="ml-1 text-[9px] font-mono text-emerald-core">[{badge}]</span>
        )}
      </span>
    </div>
  );
}

export function StreamCard({
  stream,
  hubAddress,
  connectedAddress,
  explorerBase,
  onRefresh,
}: {
  stream: PaycardOnchain;
  hubAddress: string;
  connectedAddress: string | undefined;
  explorerBase: string;
  onRefresh: () => void;
}) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [txState, setTxState] = useState<TxPhase>({ phase: "idle" });
  const [liveBalance, setLiveBalance] = useState(BigInt(stream.availableBalance));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate live balance drain between API polls
  useEffect(() => {
    setLiveBalance(BigInt(stream.availableBalance));
    if (stream.operationalStatus !== "Active") return;
    const velocity = BigInt(stream.flowVelocityPerSecond);
    if (velocity === 0n) return;
    const endTime = stream.genesisTimestamp + stream.lifespanSeconds;

    intervalRef.current = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const evaluated = Math.min(now, endTime);
      const elapsed = Math.max(0, evaluated - stream.lastCheckpointEpoch);
      const accrued = velocity * BigInt(elapsed);
      const avail = BigInt(stream.availableBalance);
      setLiveBalance(accrued >= avail ? 0n : avail - accrued);
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [
    stream.availableBalance,
    stream.flowVelocityPerSecond,
    stream.lastCheckpointEpoch,
    stream.genesisTimestamp,
    stream.lifespanSeconds,
    stream.operationalStatus,
  ]);

  const totalBig = BigInt(stream.totalAllocationPool);
  const fillPct =
    totalBig > 0n
      ? Math.min(100, Math.max(0, Number((liveBalance * 1000n) / totalBig) / 10))
      : 0;
  const fillColor = fillPct > 60 ? "#009E60" : fillPct > 25 ? "#c08000" : "#dc2626";

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = stream.genesisTimestamp + stream.lifespanSeconds;
  const remainSec = expiresAt - now;

  const isActive = stream.operationalStatus === "Active";
  const isPayer = connectedAddress?.toLowerCase() === stream.payer.toLowerCase();
  const isRecipient = connectedAddress?.toLowerCase() === stream.recipient.toLowerCase();
  const canFlush = isPayer || isRecipient;
  const busy = txState.phase === "pending" || txState.phase === "submitted";

  async function handleSettle() {
    if (busy) return;
    try {
      setTxState({ phase: "pending", action: "settle" });
      const hash = await writeContractAsync({
        address: hubAddress as `0x${string}`,
        abi: HUB_ABI,
        functionName: "processDripSettle",
        args: [stream.paycardId as `0x${string}`],
      });
      setTxState({ phase: "submitted", action: "settle", hash });
      await publicClient!.waitForTransactionReceipt({ hash, timeout: 120_000 });
      setTxState({ phase: "success", action: "settle", hash });
      setTimeout(onRefresh, 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ phase: "error", action: "settle", msg: msg.slice(0, 160) });
    }
  }

  async function handleFlush() {
    if (busy || !canFlush) return;
    try {
      setTxState({ phase: "pending", action: "flush" });
      const hash = await writeContractAsync({
        address: hubAddress as `0x${string}`,
        abi: HUB_ABI,
        functionName: "flushResidualDelta",
        args: [stream.paycardId as `0x${string}`],
      });
      setTxState({ phase: "submitted", action: "flush", hash });
      await publicClient!.waitForTransactionReceipt({ hash, timeout: 120_000 });
      setTxState({ phase: "success", action: "flush", hash });
      setTimeout(onRefresh, 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxState({ phase: "error", action: "flush", msg: msg.slice(0, 160) });
    }
  }

  return (
    <Glass className="p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider border ${
              isActive
                ? "bg-emerald-core/15 text-emerald-core border-emerald-core/30"
                : "bg-red-950/40 text-red-400 border-red-800/40"
            }`}
          >
            {isActive ? "ACTIVE" : "CLOSED"}
          </span>
          <span className="shrink-0 inline-flex items-center rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">
            {stream.lifespanSeconds === 0 ? "one-time" : "streaming"}
          </span>
          <span className="font-mono text-[11px] text-ink-secondary truncate" title={stream.paycardId}>
            {shortHex(stream.paycardId, 10, 6)}
          </span>
        </div>
        {isActive && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleSettle}
              disabled={busy}
              className="px-2.5 py-1 rounded text-[11px] font-mono border border-emerald-core/40 text-emerald-core hover:bg-emerald-core/10 active:bg-emerald-core/20 transition disabled:opacity-40 disabled:cursor-wait"
            >
              {txState.phase === "pending" && txState.action === "settle"
                ? "…"
                : txState.phase === "submitted" && txState.action === "settle"
                ? "pending"
                : "Settle"}
            </button>
            <button
              onClick={handleFlush}
              disabled={busy || !canFlush}
              title={
                canFlush ? "Flush residual delta to recovery address" : "Only payer or recipient can flush"
              }
              className="px-2.5 py-1 rounded text-[11px] font-mono border border-white/10 text-ink-secondary hover:border-white/20 hover:text-ink-primary transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {txState.phase === "pending" && txState.action === "flush"
                ? "…"
                : txState.phase === "submitted" && txState.action === "flush"
                ? "pending"
                : "Flush ↙"}
            </button>
          </div>
        )}
      </div>

      {/* Balance fill bar */}
      <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${fillPct}%`, background: fillColor }}
        />
      </div>
      <div className="flex justify-between font-mono text-[9px] text-ink-faint -mt-2">
        <span>${fmtUsd(toUsdc(liveBalance.toString()))} remaining</span>
        <span>{fillPct.toFixed(1)}%</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Stat
          label="Total"
          value={`$${fmtUsd(toUsdc(stream.totalAllocationPool))}`}
        />
        <Stat label="Velocity" value={fmtVelocity(stream.flowVelocityPerSecond)} />
        <Stat
          label={remainSec > 0 ? "Expires" : "Expired"}
          value={fmtCountdown(remainSec)}
        />
        <Stat label="Recovery" value={shortHex(stream.residualDeltaRecipient)} mono />
        <Stat
          label="Payer"
          value={shortHex(stream.payer)}
          mono
          badge={isPayer ? "you" : undefined}
        />
        <Stat
          label="Recipient"
          value={shortHex(stream.recipient)}
          mono
          badge={isRecipient ? "you" : undefined}
        />
      </div>

      {/* Tx status row */}
      {txState.phase !== "idle" && (
        <div
          className={`font-mono text-[10px] leading-snug rounded px-2.5 py-1.5 flex items-start justify-between gap-2 ${
            txState.phase === "error"
              ? "bg-red-950/50 text-red-400 border border-red-900/40"
              : txState.phase === "success"
              ? "bg-emerald-core/10 text-emerald-core border border-emerald-core/20"
              : "bg-white/5 text-ink-secondary border border-white/10"
          }`}
        >
          <span className="break-all">
            {txState.phase === "pending" && `awaiting wallet for ${txState.action}…`}
            {txState.phase === "submitted" && (
              <>
                {txState.action} submitted ·{" "}
                <a
                  href={`${explorerBase}/tx/${txState.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-emerald-core"
                >
                  {shortHex(txState.hash, 8, 6)}
                </a>
              </>
            )}
            {txState.phase === "success" && (
              <>
                {txState.action === "settle" ? "settled ✓" : "flushed ✓"} ·{" "}
                <a
                  href={`${explorerBase}/tx/${txState.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {shortHex(txState.hash, 8, 6)}
                </a>
              </>
            )}
            {txState.phase === "error" && txState.msg}
          </span>
          {(txState.phase === "success" || txState.phase === "error") && (
            <button
              onClick={() => setTxState({ phase: "idle" })}
              className="shrink-0 opacity-50 hover:opacity-100 transition"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </Glass>
  );
}
