import { Glass, Eyebrow, DemoTag } from "../Glass";
import { shortHex, type StreamEvent } from "../../lib/api";

/** Bottom — Ledger Trails. Recent indexed events; rows deep-link to the Arc explorer. */
const METHOD: Record<string, string> = {
  PaycardProvisioned: "fundPaycard()",
  SettlementFlushed: "processDripSettle()",
  ResidualDeltaReclaimed: "flushResidualDelta()",
};

function fmtBlockTime(e: StreamEvent): string {
  const ms = e.blockTimestamp ? e.blockTimestamp * 1000 : e.recordedAt;
  const d = new Date(ms);
  const hh = d.getHours() % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ap = d.getHours() >= 12 ? "PM" : "AM";
  return `${hh}:${mm} ${ap}`;
}

export function LedgerTrails({ events, explorerBase }: { events: StreamEvent[]; explorerBase: string }) {
  const empty = events.length === 0;
  return (
    <Glass className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <Eyebrow>Ledger trails · lazy-evaluation log</Eyebrow>
        {empty ? <DemoTag /> : <span className="font-mono text-[10px] tracking-wider text-emerald-core">live</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-widest2 text-ink-faint">
              <th className="pb-3 pr-4 font-normal">Target event</th>
              <th className="pb-3 pr-4 font-normal">Block · time</th>
              <th className="pb-3 pr-4 font-normal">Method invocation</th>
              <th className="pb-3 pr-4 font-normal">Integrity</th>
              <th className="pb-3 text-right font-normal">Cleared value</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[12px]">
            {empty && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-ink-faint">
                  No indexed events yet. Provision a Paycard Stream and run the gateway to populate the trail.
                </td>
              </tr>
            )}
            {events.map((e, i) => {
              const href = explorerBase ? `${explorerBase.replace(/\/$/, "")}/tx/${e.transactionHash}` : undefined;
              // Solidity event amounts: provision=poolAllocation, settle=amountWithdrawn, reclaim=varianceSwept
              const cleared = (e.args?.["amountWithdrawn"] ??
                e.args?.["varianceSwept"] ??
                e.args?.["poolAllocation"]) as string | undefined;
              return (
                <tr
                  key={`${e.transactionHash}:${e.logIndex}:${i}`}
                  onClick={() => href && window.open(href, "_blank", "noopener")}
                  className={`border-t border-white/[0.06] transition ${href ? "cursor-pointer hover:bg-white/[0.03]" : ""}`}
                  title={href ? "Open in Arc block explorer" : undefined}
                >
                  <td className="py-3 pr-4 text-ink-primary">{shortHex(e.paycardId, 6, 4)}</td>
                  <td className="py-3 pr-4 text-ink-secondary">
                    #{e.blockNumber.toLocaleString("en-US")} · {fmtBlockTime(e)}
                  </td>
                  <td className="py-3 pr-4 text-ink-secondary">{METHOD[e.eventName] ?? e.eventName}</td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-1.5 text-emerald-core">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-core" />
                      Verified (Arc-BFT)
                    </span>
                  </td>
                  <td className="py-3 text-right text-ink-primary">
                    {cleared ? `${(Number(cleared) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 })} USDC` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Glass>
  );
}
