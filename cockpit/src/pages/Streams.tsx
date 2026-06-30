import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { revealParent, revealChild, Glass, Eyebrow } from "../components/Glass";
import { StreamCard } from "../components/cockpit/StreamCard";
import { OpenStreamModal } from "../components/cockpit/OpenStreamModal";
import { api, useConfig, type PaycardOnchain } from "../lib/api";

function useMyStreams(address: string | undefined) {
  const [streams, setStreams] = useState<PaycardOnchain[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!address) {
      setStreams([]);
      return;
    }
    setLoading(true);
    setError(null);

    // Merge two sources so old streams don't fall out of the recovery window:
    // the indexer projection (`/api/streams?payer|recipient`, NOT block-bounded) plus
    // onchain log recovery (catches anything the gateway hasn't indexed yet).
    Promise.all([
      api.recoverPaycards({ payer: address, limit: 20 }),
      api.recoverPaycards({ recipient: address, limit: 20 }),
      api.streams({ payer: address }).catch(() => ({ streams: [] })),
      api.streams({ recipient: address }).catch(() => ({ streams: [] })),
    ])
      .then(([payerRes, recipientRes, payerIdx, recipientIdx]) => {
        const seen = new Set<string>();
        const ids: string[] = [];
        const push = (pid: string) => {
          const key = pid.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            ids.push(pid);
          }
        };
        for (const r of [...payerRes.results, ...recipientRes.results]) push(r.paycardId);
        for (const s of [...payerIdx.streams, ...recipientIdx.streams]) push(s.paycardId);
        return Promise.all(ids.map((id) => api.paycard(id).catch(() => null)));
      })
      .then((results) => {
        const valid = results.filter((r): r is PaycardOnchain => r !== null);
        // Active first, then Terminated; newest genesis first within each group
        valid.sort((a, b) => {
          if (a.operationalStatus !== b.operationalStatus) {
            return a.operationalStatus === "Active" ? -1 : 1;
          }
          return b.genesisTimestamp - a.genesisTimestamp;
        });
        setStreams(valid);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [address]);

  useEffect(() => {
    refresh();
    if (!address) return;
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [address, refresh]);

  return { streams, loading, error, refresh };
}

export default function Streams() {
  const { address, isConnected } = useAccount();
  const { config } = useConfig();
  const { streams, loading, error, refresh } = useMyStreams(address);
  const [modalOpen, setModalOpen] = useState(false);

  const hubAddress = config?.clearinghouseAddress ?? "";
  const explorerBase = config?.explorerBaseUrl ?? "https://explorer.testnet.arc.network";

  return (
    <motion.div variants={revealParent} initial="hidden" animate="show" className="pb-10">
      {/* Page header */}
      <motion.div variants={revealChild} className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-ink-primary">My Streams</h2>
          <p className="mt-1 font-mono text-[11px] text-ink-faint">
            Paycard Streams where your connected address is payer or recipient
          </p>
        </div>
        {isConnected && (
          <button
            onClick={() => setModalOpen(true)}
            className="shrink-0 rounded-xl px-4 py-2 font-mono text-sm font-semibold bg-emerald-core text-[#04070D] hover:bg-emerald-core/90 transition"
          >
            + New Stream
          </button>
        )}
      </motion.div>

      {/* Not connected */}
      {!isConnected && (
        <Glass className="flex flex-col items-center justify-center gap-5 p-12 text-center">
          <span className="font-mono text-5xl text-emerald-core/40">≋</span>
          <div>
            <Eyebrow>Connect your wallet</Eyebrow>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-secondary">
              Connect a wallet to view Paycard Streams where your address is payer or recipient,
              settle accrued value, and open new streams.
            </p>
          </div>
          <ConnectButton label="Connect Wallet" />
        </Glass>
      )}

      {/* Connected: stream list */}
      {isConnected && (
        <>
          {/* Loading */}
          {loading && streams.length === 0 && (
            <Glass className="flex items-center justify-center gap-3 p-10 text-ink-secondary font-mono text-sm">
              <span className="animate-spin">⟳</span> Scanning chain for streams…
            </Glass>
          )}

          {/* Error */}
          {error && !loading && (
            <Glass className="flex items-center justify-between gap-4 p-5 border-red-900/40">
              <span className="font-mono text-[12px] text-red-400 break-words">{error}</span>
              <button
                onClick={refresh}
                className="shrink-0 font-mono text-[11px] text-ink-secondary hover:text-ink-primary border border-white/10 px-3 py-1.5 rounded transition"
              >
                Retry
              </button>
            </Glass>
          )}

          {/* Empty */}
          {!loading && !error && streams.length === 0 && (
            <Glass className="flex flex-col items-center justify-center gap-4 p-12 text-center">
              <span className="font-mono text-4xl text-emerald-core/30">≋</span>
              <Eyebrow>No streams found</Eyebrow>
              <p className="max-w-xs text-sm text-ink-secondary leading-relaxed">
                No Paycard Streams found for this address. Open your first stream using the button
                above.
              </p>
            </Glass>
          )}

          {/* Stream cards */}
          {streams.length > 0 && (
            <div className="flex flex-col gap-4">
              {/* Refresh indicator */}
              {loading && (
                <div className="flex items-center gap-2 font-mono text-[10px] text-ink-faint">
                  <span className="animate-spin">⟳</span> Refreshing…
                </div>
              )}

              {/* Active count */}
              <div className="flex items-center justify-between">
                <Eyebrow>
                  {streams.filter((s) => s.operationalStatus === "Active").length} active ·{" "}
                  {streams.length} total
                </Eyebrow>
                <button
                  onClick={refresh}
                  className="font-mono text-[10px] text-ink-faint hover:text-ink-secondary transition"
                >
                  ↻ refresh
                </button>
              </div>

              <motion.div
                variants={revealParent}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-3"
              >
                {streams.map((s) => (
                  <StreamCard
                    key={s.paycardId}
                    stream={s}
                    hubAddress={hubAddress}
                    connectedAddress={address}
                    explorerBase={explorerBase}
                    onRefresh={refresh}
                  />
                ))}
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* Open stream modal */}
      <OpenStreamModal
        config={config}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false);
          setTimeout(refresh, 3000);
        }}
      />
    </motion.div>
  );
}
