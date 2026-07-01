import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { revealParent, revealChild, Glass, Eyebrow } from "../components/Glass";
import { api, useConfig, shortHex, toUsdc, fmtUsd, type PaycardOnchain } from "../lib/api";
import {
  type CanonicalMetadataV1,
  hashOpenRailsMetadata,
  velocityToBasePerSec,
  lifespanToSeconds,
  ZERO_ADDRESS,
  type VelocityUnit,
  type LifespanUnit,
} from "../lib/intents";
import { createRailsFlowRequestLink, appBaseUrl, type RailsFlowLinkPayload } from "../lib/links";

const inputCls =
  "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 font-mono text-[12px] text-ink-primary placeholder:text-ink-faint focus:outline-none focus:border-emerald-core/50 transition";
const unitCls =
  "rounded-lg bg-white/5 border border-white/10 px-2 py-2 font-mono text-[12px] text-ink-secondary focus:outline-none focus:border-emerald-core/40 transition";
const addrRe = /^0x[0-9a-fA-F]{40}$/;

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="glass-soft flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="eyebrow mb-1">{label}</div>
        <div className="truncate font-mono text-[11px] text-ink-secondary" title={value}>{value}</div>
      </div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="shrink-0 rounded-lg border border-emerald-core/40 px-3 py-1.5 font-mono text-[11px] text-emerald-core transition hover:bg-emerald-core/10"
      >
        {copied ? "copied ✓" : "copy"}
      </button>
    </div>
  );
}

export default function Merchant() {
  const { address, isConnected } = useAccount();
  const { config } = useConfig();
  const chainId = config?.chainId ?? 5042002;

  const [payType, setPayType] = useState<"streaming" | "onetime">("streaming");
  const [amount, setAmount] = useState("");
  const [velAmt, setVelAmt] = useState("");
  const [velUnit, setVelUnit] = useState<VelocityUnit>("hr");
  const [lifeAmt, setLifeAmt] = useState("");
  const [lifeUnit, setLifeUnit] = useState<LifespanUnit>("hr");
  const [recipient, setRecipient] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; payload: RailsFlowLinkPayload } | null>(null);

  useEffect(() => {
    if (address && recipient === "") setRecipient(address);
  }, [address, recipient]);

  function generate() {
    setErr(null);
    const recv = recipient.trim() || address || "";
    if (!addrRe.test(recv)) return setErr("Enter a valid recipient address (who gets paid).");
    const amt = parseFloat(amount);
    if (!(amt > 0)) return setErr("Enter an amount greater than 0.");
    const isOneTime = payType === "onetime";
    if (!isOneTime) {
      const vel = parseFloat(velAmt);
      if (!(vel > 0)) return setErr("Enter a velocity greater than 0.");
      const life = parseFloat(lifeAmt);
      if (!(life > 0)) return setErr("Enter a lifespan greater than 0.");
    }

    // One-time (instant): lifespanSeconds = 0 unlocks the full amount on first settle; velocity 0.
    const amountBase = BigInt(Math.round(amt * 1_000_000)).toString();
    const flowVelocityPerSecond = isOneTime ? "0" : velocityToBasePerSec(parseFloat(velAmt), velUnit).toString();
    const lifespanSeconds = isOneTime ? 0 : Number(lifespanToSeconds(parseFloat(lifeAmt), lifeUnit));

    const metadata: CanonicalMetadataV1 = {
      version: "openrails-metadata-v1",
      mode: "railsflow",
      originator: ZERO_ADDRESS, // payer fills this in at fulfillment
      recipient: recv,
      token: config?.usdcAddress ?? ZERO_ADDRESS,
      amount: amountBase,
      flowVelocityPerSecond,
      lifespanSeconds,
      ...(desc.trim() ? { metadataRef: desc.trim() } : {}),
    };
    const metadataHash = hashOpenRailsMetadata(metadata);
    const payload: RailsFlowLinkPayload = {
      mode: "railsflow",
      merchant: address ?? recv,
      recipient: recv,
      amount: amountBase,
      flowVelocityPerSecond,
      lifespanSeconds,
      ...(desc.trim() ? { metadataRef: desc.trim() } : {}),
    };
    const url = createRailsFlowRequestLink({
      appBaseUrl: appBaseUrl(),
      chainId,
      vault: config?.clearinghouseAddress ?? ZERO_ADDRESS,
      token: config?.usdcAddress ?? ZERO_ADDRESS,
      metadataHash,
      payload,
    });
    setLink({ url, payload });
  }

  return (
    <motion.div variants={revealParent} initial="hidden" animate="show" className="pb-10">
      <motion.div variants={revealChild} className="mb-5">
        <h2 className="text-2xl font-semibold text-ink-primary">Merchant · request payment</h2>
        <p className="mt-1 font-mono text-[11px] text-ink-faint">
          Create a <span className="text-emerald-core">RailsFlow</span> request link — ask someone to pay for
          work as a bounded USDC stream. Share it; they review the terms and open the stream.
        </p>
      </motion.div>

      {!isConnected && (
        <Glass className="mb-6 flex flex-col items-center gap-4 p-10 text-center">
          <Eyebrow>Connect to set your receiving address</Eyebrow>
          <ConnectButton label="Connect Wallet" />
        </Glass>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Request form */}
        <Glass className="p-5">
          <Eyebrow>New request</Eyebrow>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex gap-1.5 rounded-xl border border-white/8 bg-white/5 p-1">
              {(["streaming", "onetime"] as const).map((pt) => (
                <button
                  key={pt}
                  onClick={() => setPayType(pt)}
                  className={`flex-1 rounded-lg px-2 py-1.5 font-mono text-[11px] transition ${
                    payType === pt ? "bg-emerald-core/20 text-emerald-core ring-1 ring-emerald-core/40" : "text-ink-faint hover:text-ink-secondary"
                  }`}
                >
                  {pt === "streaming" ? "Streaming" : "One-time"}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Amount (USDC)</span>
              <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50.00" inputMode="decimal" />
            </label>
            {payType === "streaming" && (
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="eyebrow">Velocity</span>
                <input className={inputCls} value={velAmt} onChange={(e) => setVelAmt(e.target.value)} placeholder="5.00" inputMode="decimal" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="eyebrow">per</span>
                <select className={unitCls} value={velUnit} onChange={(e) => setVelUnit(e.target.value as VelocityUnit)}>
                  <option value="sec">sec</option><option value="min">min</option><option value="hr">hr</option><option value="day">day</option>
                </select>
              </label>
            </div>
            )}
            {payType === "streaming" && (
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="eyebrow">Lifespan</span>
                <input className={inputCls} value={lifeAmt} onChange={(e) => setLifeAmt(e.target.value)} placeholder="10" inputMode="decimal" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="eyebrow">unit</span>
                <select className={unitCls} value={lifeUnit} onChange={(e) => setLifeUnit(e.target.value as LifespanUnit)}>
                  <option value="sec">sec</option><option value="min">min</option><option value="hr">hr</option><option value="day">day</option>
                </select>
              </label>
            </div>
            )}
            {payType === "onetime" && (
              <p className="font-mono text-[10px] text-ink-faint">One-time · full amount settles at once (instant, no drip).</p>
            )}
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Recipient (who gets paid)</span>
              <input className={inputCls} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x… (defaults to you)" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Description (optional)</span>
              <input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. invoice #204 — design retainer" />
            </label>
            {err && <p className="font-mono text-[11px] text-amber-400/90">{err}</p>}
            <button
              onClick={generate}
              className="mt-1 rounded-xl bg-emerald-core px-4 py-2.5 font-mono text-sm font-semibold text-[#04070D] transition hover:brightness-110"
            >
              Generate request link
            </button>
          </div>
        </Glass>

        {/* Generated link + terms preview */}
        <Glass className="p-5">
          <Eyebrow>Request link</Eyebrow>
          {!link ? (
            <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
              <span className="font-mono text-4xl text-emerald-core/30">⤳</span>
              <p className="max-w-xs text-sm text-ink-secondary">
                Fill the terms and generate a shareable RailsFlow request. Nothing is signed or moved — it's a request.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              <CopyField label="Shareable link" value={link.url} />
              <div className="glass-soft p-4">
                <div className="eyebrow mb-2">Terms</div>
                <dl className="grid grid-cols-2 gap-y-1 font-mono text-[11px]">
                  <dt className="text-ink-faint">Type</dt><dd className="text-right text-emerald-core">{link.payload.lifespanSeconds === 0 ? "One-time" : "Streaming"}</dd>
                  <dt className="text-ink-faint">Amount</dt><dd className="text-right text-ink-primary">${fmtUsd(toUsdc(link.payload.amount))}</dd>
                  {link.payload.lifespanSeconds === 0 ? (
                    <><dt className="text-ink-faint">Settles</dt><dd className="text-right text-ink-secondary">in full, once</dd></>
                  ) : (
                    <>
                      <dt className="text-ink-faint">Velocity</dt><dd className="text-right text-ink-secondary">{(Number(link.payload.flowVelocityPerSecond) / 1e6 * 3600).toFixed(4)} USDC/hr</dd>
                      <dt className="text-ink-faint">Lifespan</dt><dd className="text-right text-ink-secondary">{link.payload.lifespanSeconds}s</dd>
                    </>
                  )}
                  <dt className="text-ink-faint">Recipient</dt><dd className="text-right text-ink-secondary">{shortHex(link.payload.recipient, 6, 4)}</dd>
                  {link.payload.metadataRef && (<><dt className="text-ink-faint">Note</dt><dd className="truncate text-right text-ink-secondary" title={link.payload.metadataRef}>{link.payload.metadataRef}</dd></>)}
                </dl>
              </div>
              <p className="font-mono text-[10px] text-ink-faint">
                Unsigned request — the payer reviews and opens the stream (funds come from their wallet).
              </p>
            </div>
          )}
        </Glass>
      </div>

      {/* Fulfillment */}
      {isConnected && address && <Fulfillment address={address} />}
    </motion.div>
  );
}

function Fulfillment({ address }: { address: string }) {
  const [rows, setRows] = useState<PaycardOnchain[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .streams({ recipient: address })
      .then((r) => Promise.all(r.streams.map((s) => api.paycard(s.paycardId).catch(() => null))))
      .then((res) => setRows(res.filter((r): r is PaycardOnchain => r !== null)))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [address]);
  useEffect(() => load(), [load]);

  function exportJson() {
    const blob = new Blob([JSON.stringify({ merchant: address, streams: rows }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `openrails-receipts-${address.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Glass className="mt-5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">Incoming · fulfillment</h3>
          <p className="font-mono text-[10px] text-ink-faint">streams paying this address · non-authoritative</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="font-mono text-[10px] text-ink-faint hover:text-ink-secondary">↻ refresh</button>
          <button onClick={exportJson} disabled={rows.length === 0} className="rounded border border-glass-border px-2.5 py-1 font-mono text-[10px] text-ink-secondary transition hover:text-ink-primary disabled:opacity-40">
            export receipts
          </button>
        </div>
      </div>
      {loading && rows.length === 0 ? (
        <p className="py-6 text-center font-mono text-[11px] text-ink-faint">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center font-mono text-[11px] text-ink-faint">No incoming streams yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((s) => {
            const active = s.operationalStatus === "Active";
            return (
              <div key={s.paycardId} className="glass-soft flex items-center justify-between gap-3 p-3 font-mono text-[11px]">
                <span className="flex items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${active ? "border-emerald-core/30 bg-emerald-core/15 text-emerald-core" : "border-red-800/40 bg-red-950/40 text-red-400"}`}>{active ? "ACTIVE" : "CLOSED"}</span>
                  <span className="text-ink-secondary">{shortHex(s.paycardId, 8, 6)}</span>
                  <span className="text-ink-faint">from {shortHex(s.payer, 6, 4)}</span>
                </span>
                <span className="text-ink-secondary">${fmtUsd(toUsdc(s.availableBalance))} / ${fmtUsd(toUsdc(s.totalAllocationPool))}</span>
              </div>
            );
          })}
        </div>
      )}
    </Glass>
  );
}
