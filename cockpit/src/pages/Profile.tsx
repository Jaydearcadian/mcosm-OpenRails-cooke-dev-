import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { revealParent, revealChild, Glass, Eyebrow } from "../components/Glass";
import { useConfig, shortHex, toUsdc, fmtUsd, type PaycardOnchain, type StreamEvent } from "../lib/api";
import {
  useProfile,
  isValidProfileId,
  type ProfileStream,
  type WorkflowGroup,
  type ProfileStats,
} from "../lib/profile";

const NON_AUTH = "Indexer projection · non-authoritative. The onchain Vault is the source of truth.";

function explorerAddr(base: string, a: string) {
  return base ? `${base.replace(/\/$/, "")}/address/${a}` : undefined;
}
function explorerTx(base: string, h: string) {
  return base ? `${base.replace(/\/$/, "")}/tx/${h}` : undefined;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Glass soft className="p-4">
      <div className="eyebrow">{label}</div>
      <div className={`telemetry mt-2 text-lg font-semibold ${accent ? "text-emerald-core" : "text-ink-primary"}`}>
        {value}
      </div>
    </Glass>
  );
}

function StatsGrid({ stats }: { stats: ProfileStats }) {
  return (
    <motion.div variants={revealParent} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Escrowed (as payer)" value={`$${fmtUsd(toUsdc(stats.escrowedBase))}`} />
      <StatCard label="Locked now" value={`$${fmtUsd(toUsdc(stats.lockedBase))}`} />
      <StatCard label="Earned (as recipient)" value={`$${fmtUsd(toUsdc(stats.earnedBase))}`} accent />
      <StatCard label="Residual recovered" value={`$${fmtUsd(toUsdc(stats.recoveredBase))}`} />
      <StatCard label="Active" value={String(stats.activeCount)} />
      <StatCard label="Closed" value={String(stats.terminatedCount)} />
      <StatCard label="Workflows" value={String(stats.workflowCount)} />
      <StatCard label="Counterparties" value={String(stats.counterparties)} />
    </motion.div>
  );
}

function fmtRatePerHr(basePerSec: string): string {
  const perHr = (Number(basePerSec) / 1_000_000) * 3600;
  return `$${fmtUsd(perHr, 4)}/hr`;
}

function StreamRow({ s }: { s: ProfileStream }) {
  const st: PaycardOnchain = s.state;
  const active = st.operationalStatus === "Active";
  return (
    <div className="glass-soft flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider ${
            active
              ? "border-emerald-core/30 bg-emerald-core/15 text-emerald-core"
              : "border-red-800/40 bg-red-950/40 text-red-400"
          }`}
        >
          {active ? "ACTIVE" : "CLOSED"}
        </span>
        <span className="truncate font-mono text-[11px] text-ink-secondary" title={st.paycardId}>
          {shortHex(st.paycardId, 8, 6)}
        </span>
        {s.workflowId && (
          <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">
            {s.workflowId.length > 14 ? shortHex(s.workflowId, 6, 4) : s.workflowId}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-4 font-mono text-[11px]">
        <span className="text-ink-faint" title="available / total">
          ${fmtUsd(toUsdc(st.availableBalance))} / ${fmtUsd(toUsdc(st.totalAllocationPool))}
        </span>
        <span className="hidden text-emerald-core/80 sm:inline">{fmtRatePerHr(st.flowVelocityPerSecond)}</span>
      </div>
    </div>
  );
}

function RoleSection({ title, sub, streams }: { title: string; sub: string; streams: ProfileStream[] }) {
  return (
    <Glass className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
          <p className="font-mono text-[10px] text-ink-faint">{sub}</p>
        </div>
        <Eyebrow>{streams.length}</Eyebrow>
      </div>
      {streams.length === 0 ? (
        <p className="py-4 text-center font-mono text-[11px] text-ink-faint">None</p>
      ) : (
        <div className="flex flex-col gap-2">
          {streams.map((s) => (
            <StreamRow key={s.state.paycardId} s={s} />
          ))}
        </div>
      )}
    </Glass>
  );
}

function WorkflowGroups({ groups }: { groups: WorkflowGroup[] }) {
  if (groups.length <= 1) return null; // only meaningful when there are real workflows
  return (
    <Glass className="p-5">
      <Eyebrow>Workflows</Eyebrow>
      <div className="mt-3 flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.workflowId ?? "_none"}>
            <div className="mb-2 font-mono text-[11px] text-emerald-core">
              {g.workflowId ?? "No workflow"} <span className="text-ink-faint">· {g.streams.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {g.streams.map((s) => (
                <StreamRow key={s.state.paycardId} s={s} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Glass>
  );
}

const METHOD: Record<string, { label: string; amount: string }> = {
  PaycardProvisioned: { label: "Opened", amount: "poolAllocation" },
  SettlementFlushed: { label: "Settled", amount: "amountWithdrawn" },
  ResidualDeltaReclaimed: { label: "Recovered", amount: "varianceSwept" },
};

function Timeline({ events, explorerBase }: { events: StreamEvent[]; explorerBase: string }) {
  return (
    <Glass className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <Eyebrow>Profile timeline · receipts</Eyebrow>
        <span className="font-mono text-[10px] text-ink-faint">{events.length}</span>
      </div>
      {events.length === 0 ? (
        <p className="py-4 text-center font-mono text-[11px] text-ink-faint">No indexed events yet.</p>
      ) : (
        <div className="flex flex-col">
          {events.map((e, i) => {
            const m = METHOD[e.eventName] ?? { label: e.eventName, amount: "" };
            const amt = m.amount ? (e.args?.[m.amount] as string | undefined) : undefined;
            const href = explorerTx(explorerBase, e.transactionHash);
            return (
              <div
                key={`${e.transactionHash}:${e.logIndex}:${i}`}
                onClick={() => href && window.open(href, "_blank", "noopener")}
                className={`flex items-center justify-between gap-3 border-t border-white/[0.06] py-2.5 font-mono text-[11px] ${
                  href ? "cursor-pointer hover:bg-white/[0.03]" : ""
                }`}
                title={href ? "Open in Arc block explorer" : undefined}
              >
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-core" />
                  <span className="text-ink-primary">{m.label}</span>
                  <span className="text-ink-faint">{shortHex(e.paycardId, 6, 4)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-ink-faint">#{e.blockNumber.toLocaleString("en-US")}</span>
                  <span className="text-ink-secondary">
                    {amt ? `${(Number(amt) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 })} USDC` : "—"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Glass>
  );
}

export default function Profile() {
  const { address } = useAccount();
  const { config } = useConfig();
  const explorerBase = config?.explorerBaseUrl ?? "https://testnet.arcscan.app";

  const [input, setInput] = useState("");
  const [target, setTarget] = useState<string | undefined>(undefined);

  // Default to the connected wallet once available (until the user types one).
  useEffect(() => {
    if (address && input === "" && target === undefined) setTarget(address);
  }, [address, input, target]);

  const queryAddr = target;
  const { profile, loading, error } = useProfile(queryAddr);
  const inputValid = input.trim() === "" || isValidProfileId(input);

  return (
    <motion.div variants={revealParent} initial="hidden" animate="show" className="pb-10">
      <motion.div variants={revealChild} className="mb-5">
        <h2 className="text-2xl font-semibold text-ink-primary">Profile</h2>
        <p className="mt-1 font-mono text-[11px] text-ink-faint">
          A <span className="text-emerald-core">profileId</span> is a wallet address — its streams, workflows,
          and receipt timeline, aggregated. {NON_AUTH}
        </p>
      </motion.div>

      {/* address input */}
      <motion.div variants={revealChild} className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="glass-soft flex flex-1 items-center gap-3 px-4 py-3">
          <span className="font-mono text-sm text-emerald-core">◍</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && inputValid && input.trim() && setTarget(input.trim())}
            spellCheck={false}
            placeholder={address ? "View any address (0x…) — or your connected wallet" : "Enter a wallet address (0x…)"}
            aria-label="Profile wallet address"
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => input.trim() && inputValid && setTarget(input.trim())}
            disabled={!input.trim() || !inputValid}
            className="rounded-xl bg-emerald-core px-5 py-3 font-mono text-sm font-semibold text-[#04070D] transition hover:brightness-110 disabled:opacity-40"
          >
            View
          </button>
          {address && (
            <button
              onClick={() => {
                setInput("");
                setTarget(address);
              }}
              className="rounded-xl border border-glass-border px-4 py-3 font-mono text-xs text-ink-secondary transition hover:text-ink-primary"
              title="View my connected wallet"
            >
              Me
            </button>
          )}
        </div>
      </motion.div>

      {!inputValid && (
        <p className="mb-4 font-mono text-[11px] text-amber-400/80">Enter a valid 0x-prefixed wallet address.</p>
      )}

      {/* empty (nothing targeted) */}
      {!queryAddr && (
        <Glass className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="font-mono text-5xl text-emerald-core/40">◍</span>
          <Eyebrow>No profile selected</Eyebrow>
          <p className="max-w-sm text-sm leading-relaxed text-ink-secondary">
            Connect a wallet or enter an address to view its OpenRails profile — streams as payer or recipient,
            workflows, and the receipt timeline.
          </p>
        </Glass>
      )}

      {queryAddr && (
        <div className="flex flex-col gap-5">
          {/* identity header */}
          <Glass className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Eyebrow>profileId</Eyebrow>
              <div className="mt-1 flex items-center gap-2">
                <span className="telemetry truncate text-lg text-ink-primary" title={profile?.id ?? queryAddr}>
                  {profile?.id ?? queryAddr}
                </span>
                {address && address.toLowerCase() === queryAddr.toLowerCase() && (
                  <span className="rounded-full bg-emerald-core/15 px-2 py-0.5 font-mono text-[9px] text-emerald-core ring-1 ring-emerald-core/40">
                    you
                  </span>
                )}
              </div>
            </div>
            <a
              href={explorerAddr(explorerBase, queryAddr)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 font-mono text-[11px] text-ink-secondary underline-offset-2 hover:text-emerald-core hover:underline"
            >
              View on Arc explorer ↗
            </a>
          </Glass>

          {loading && !profile && (
            <Glass className="flex items-center justify-center gap-3 p-10 font-mono text-sm text-ink-secondary">
              <span className="animate-spin">⟳</span> Assembling profile from chain + indexer…
            </Glass>
          )}
          {error && (
            <Glass className="p-5 font-mono text-[12px] text-red-400">{error}</Glass>
          )}

          {profile && (
            <>
              <StatsGrid stats={profile.stats} />
              {profile.streams.length === 0 ? (
                <Glass className="flex flex-col items-center gap-3 p-10 text-center">
                  <Eyebrow>No streams</Eyebrow>
                  <p className="max-w-xs text-sm text-ink-secondary">
                    This address is not payer or recipient on any recovered Paycard Stream.
                  </p>
                </Glass>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <RoleSection
                      title="Paying out"
                      sub="streams where this address is payer"
                      streams={profile.asPayer}
                    />
                    <RoleSection
                      title="Receiving"
                      sub="streams where this address is recipient"
                      streams={profile.asRecipient}
                    />
                  </div>
                  <WorkflowGroups groups={profile.workflows} />
                  <Timeline events={profile.timeline} explorerBase={explorerBase} />
                </>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
