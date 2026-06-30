import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAccount, useSignTypedData, useWriteContract, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { revealParent, revealChild, Glass, Eyebrow } from "../components/Glass";
import { api, useConfig, shortHex, toUsdc, fmtUsd, type PaycardOnchain } from "../lib/api";
import { USDC_ABI, HUB_ABI } from "../lib/contracts";
import { arcTestnet } from "../lib/chain";
import {
  type CanonicalMetadataV1,
  type CryptographicEnvelopeV1,
  OPENRAILS_EIP712_TYPES,
  buildOpenRailsDomain,
  hashOpenRailsMetadata,
  buildMetadataBoundPaycardId,
  randomPaycardId,
  velocityToBasePerSec,
  lifespanToSeconds,
  serializeEnvelope,
  deserializeEnvelope,
  ZERO_ADDRESS,
  type VelocityUnit,
  type LifespanUnit,
} from "../lib/intents";
import { createRailsCardClaimLink, parseOpenRailsLink, appBaseUrl, type RailsCardLinkPayload } from "../lib/links";

const inputCls =
  "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 font-mono text-[12px] text-ink-primary placeholder:text-ink-faint focus:outline-none focus:border-emerald-core/50 transition";
const addrRe = /^0x[0-9a-fA-F]{40}$/;
type Sub = "claim" | "issue" | "received";

export default function Creator() {
  const { isConnected } = useAccount();
  const [sub, setSub] = useState<Sub>("claim");

  return (
    <motion.div variants={revealParent} initial="hidden" animate="show" className="pb-10">
      <motion.div variants={revealChild} className="mb-5">
        <h2 className="text-2xl font-semibold text-ink-primary">Creator · RailsCard</h2>
        <p className="mt-1 font-mono text-[11px] text-ink-faint">
          Claim a <span className="text-emerald-core">RailsCard</span> value link, issue one to someone, and
          track received streams with settlement &amp; residual state.
        </p>
      </motion.div>

      <div className="mb-5 flex gap-2">
        {(["claim", "issue", "received"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`rounded-full px-4 py-1.5 font-mono text-xs capitalize transition ${
              sub === s ? "bg-emerald-core/20 text-emerald-core ring-1 ring-emerald-core/40" : "text-ink-faint hover:text-ink-secondary"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {!isConnected ? (
        <Glass className="flex flex-col items-center gap-4 p-10 text-center">
          <Eyebrow>Connect your wallet to claim, issue, or view received cards</Eyebrow>
          <ConnectButton label="Connect Wallet" />
        </Glass>
      ) : sub === "claim" ? (
        <ClaimCard />
      ) : sub === "issue" ? (
        <IssueCard />
      ) : (
        <Received />
      )}
    </motion.div>
  );
}

// ---------------- Claim ----------------
function ClaimCard() {
  const { address } = useAccount();
  const { config } = useConfig();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [input, setInput] = useState("");
  const [artifact, setArtifact] = useState<ReturnType<typeof parseOpenRailsLink> | null>(null);
  const [envelope, setEnvelope] = useState<CryptographicEnvelopeV1 | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "submitting" | "done">("idle");
  const [result, setResult] = useState<{ txHash: string; paycardId: string } | null>(null);

  function review() {
    setErr(null);
    setResult(null);
    try {
      const a = parseOpenRailsLink(input);
      if (a.kind !== "railscard") throw new Error("This is not a RailsCard link.");
      const env = deserializeEnvelope<CryptographicEnvelopeV1>((a.payload as RailsCardLinkPayload).envelopeToken);
      setArtifact(a);
      setEnvelope(env);
    } catch (e) {
      setArtifact(null);
      setEnvelope(null);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function claim() {
    if (!artifact || !envelope || !config) return;
    const pl = artifact.payload as RailsCardLinkPayload;
    setPhase("submitting");
    setErr(null);
    try {
      // Self-submit: the claimer opens the channel directly on the Hub (no relayer).
      // The contract verifies the payer's signature; escrow comes from the payer's wallet.
      const i = envelope.intent;
      const hub = config.clearinghouseAddress as `0x${string}`;
      const recipientArg =
        pl.mode === "railscard_bearer" ? (address as `0x${string}`) : (i.recipient as `0x${string}`);
      const args = [
        i.paycardId as `0x${string}`,
        i.metadataHash as `0x${string}`,
        recipientArg,
        BigInt(i.totalAllocationPool),
        BigInt(i.flowVelocityPerSecond),
        BigInt(i.genesisTimestamp),
        BigInt(i.lifespanSeconds),
        i.residualDeltaRecipient as `0x${string}`,
        envelope.envelopeSignature as `0x${string}`,
        BigInt(i.nonceChannel),
        BigInt(i.nonceValue),
      ] as const;
      const txHash =
        pl.mode === "railscard_bearer"
          ? await writeContractAsync({ address: hub, abi: HUB_ABI, functionName: "claimWildcardPaycardChannel", args })
          : await writeContractAsync({ address: hub, abi: HUB_ABI, functionName: "openPaycardChannel", args });
      await publicClient!.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
      setResult({ txHash, paycardId: i.paycardId });
      setPhase("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message.slice(0, 200) : String(e));
      setPhase("idle");
    }
  }

  const m = envelope?.metadata;
  return (
    <div className="flex flex-col gap-4">
      <Glass className="p-5">
        <Eyebrow>Paste a RailsCard link or token</Eyebrow>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input className={inputCls} value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://…/openrails/card#or=…  or raw token" />
          <button onClick={review} disabled={!input.trim()} className="shrink-0 rounded-xl bg-emerald-core px-5 py-2.5 font-mono text-sm font-semibold text-[#04070D] transition hover:brightness-110 disabled:opacity-40">
            Review
          </button>
        </div>
        {err && <p className="mt-2 font-mono text-[11px] text-amber-400/90">{err}</p>}
      </Glass>

      {artifact && envelope && m && (
        <Glass className="p-5">
          <div className="flex items-center justify-between">
            <Eyebrow>Card terms</Eyebrow>
            <span className="font-mono text-[10px] text-emerald-core">{(artifact.payload as RailsCardLinkPayload).mode.replace("railscard_", "")}</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 font-mono text-[11px]">
            <dt className="text-ink-faint">Value</dt><dd className="text-right text-ink-primary">${fmtUsd(toUsdc(m.amount))}</dd>
            <dt className="text-ink-faint">Velocity</dt><dd className="text-right text-ink-secondary">{(Number(m.flowVelocityPerSecond) / 1e6 * 3600).toFixed(4)} USDC/hr</dd>
            <dt className="text-ink-faint">Lifespan</dt><dd className="text-right text-ink-secondary">{m.lifespanSeconds}s</dd>
            <dt className="text-ink-faint">From (payer)</dt><dd className="text-right text-ink-secondary">{shortHex(envelope.payerAddress, 6, 4)}</dd>
            <dt className="text-ink-faint">Paycard</dt><dd className="text-right text-ink-secondary">{shortHex(envelope.intent.paycardId, 6, 4)}</dd>
          </dl>
          {result ? (
            <div className="mt-4 rounded-lg border border-emerald-core/30 bg-emerald-core/10 p-3 font-mono text-[11px] text-emerald-core">
              Claimed ✓ — stream {shortHex(result.paycardId, 8, 6)} opened (tx {shortHex(result.txHash, 6, 4)}).
            </div>
          ) : (
            <button onClick={claim} disabled={phase === "submitting"} className="mt-4 w-full rounded-xl bg-emerald-core px-4 py-2.5 font-mono text-sm font-semibold text-[#04070D] transition hover:brightness-110 disabled:opacity-50">
              {phase === "submitting" ? "Claiming…" : "Claim this card"}
            </button>
          )}
          <p className="mt-2 font-mono text-[10px] text-ink-faint">
            Escrow is pulled from the payer's wallet (they signed it). Non-custodial.
          </p>
        </Glass>
      )}
    </div>
  );
}

// ---------------- Issue (sign-only → claim link) ----------------
function IssueCard() {
  const { address, chainId } = useAccount();
  const { config } = useConfig();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [mode, setMode] = useState<"railscard_bearer" | "railscard_recipient_bound">("railscard_bearer");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [velAmt, setVelAmt] = useState("");
  const [velUnit, setVelUnit] = useState<VelocityUnit>("hr");
  const [lifeAmt, setLifeAmt] = useState("");
  const [lifeUnit, setLifeUnit] = useState<LifespanUnit>("hr");
  const [step, setStep] = useState<"form" | "approving" | "signing" | "done">("form");
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function issue() {
    setErr(null);
    if (!address || !config) return setErr("Connect a wallet first.");
    if (mode === "railscard_recipient_bound" && !addrRe.test(recipient.trim())) return setErr("Enter a valid recipient for a recipient-bound card.");
    const amt = parseFloat(amount), vel = parseFloat(velAmt), life = parseFloat(lifeAmt);
    if (!(amt > 0) || !(vel > 0) || !(life > 0)) return setErr("Enter amount, velocity and lifespan (> 0).");

    const hub = config.clearinghouseAddress as `0x${string}`;
    const usdc = config.usdcAddress as `0x${string}`;
    const payer = address;
    const recv = (mode === "railscard_bearer" ? ZERO_ADDRESS : recipient.trim()) as `0x${string}`;
    const totalAllocationPool = BigInt(Math.round(amt * 1_000_000));
    const flowVelocityPerSecond = velocityToBasePerSec(vel, velUnit);
    const lifespanSeconds = lifespanToSeconds(life, lifeUnit);
    const genesisTimestamp = BigInt(Math.floor(Date.now() / 1000));

    const metadata: CanonicalMetadataV1 = {
      version: "openrails-metadata-v1",
      mode,
      originator: payer,
      recipient: recv,
      token: usdc,
      amount: totalAllocationPool.toString(),
      flowVelocityPerSecond: flowVelocityPerSecond.toString(),
      lifespanSeconds: Number(lifespanSeconds),
    };
    const metadataHash = hashOpenRailsMetadata(metadata);

    try {
      const { nonce } = await api.nonce(payer, 0);
      const nonceValue = BigInt(nonce);
      const paycardId = (mode === "railscard_bearer"
        ? randomPaycardId()
        : buildMetadataBoundPaycardId({ payer: payer as `0x${string}`, nonceChannel: 0n, nonceValue, metadataHash })) as `0x${string}`;

      // Approve the hub to pull the allocation when the card is claimed (non-custodial).
      const { allowance } = await api.allowance(payer);
      if (BigInt(allowance) < totalAllocationPool) {
        setStep("approving");
        const tx = await writeContractAsync({ address: usdc, abi: USDC_ABI, functionName: "approve", args: [hub, totalAllocationPool] });
        await publicClient!.waitForTransactionReceipt({ hash: tx, timeout: 120_000 });
      }

      setStep("signing");
      const domain = buildOpenRailsDomain(chainId ?? arcTestnet.id, hub);
      const message = {
        paycardId, metadataHash, recipient: recv,
        totalAllocationPool, flowVelocityPerSecond, genesisTimestamp, lifespanSeconds,
        residualDeltaRecipient: payer as `0x${string}`, nonceChannel: 0n, nonceValue,
      } as const;
      const sig = await signTypedDataAsync({ domain, types: OPENRAILS_EIP712_TYPES, primaryType: "SettlementIntent", message });

      const envelope: CryptographicEnvelopeV1 = {
        payerAddress: payer,
        envelopeSignature: sig,
        intent: {
          paycardId, metadataHash, recipient: recv,
          totalAllocationPool: totalAllocationPool.toString(),
          flowVelocityPerSecond: flowVelocityPerSecond.toString(),
          genesisTimestamp: Number(genesisTimestamp),
          lifespanSeconds: Number(lifespanSeconds),
          residualDeltaRecipient: payer, nonceChannel: 0, nonceValue: Number(nonceValue),
        },
        mode,
        metadata,
      };
      const payload: RailsCardLinkPayload = { mode, envelopeToken: serializeEnvelope(envelope) };
      const url = createRailsCardClaimLink({ appBaseUrl: appBaseUrl(), chainId: config.chainId, vault: hub, token: usdc, metadataHash, payload });
      setLink(url);
      setStep("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message.slice(0, 200) : String(e));
      setStep("form");
    }
  }

  const busy = step === "approving" || step === "signing";
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Glass className="p-5">
        <Eyebrow>Issue a RailsCard</Eyebrow>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex gap-2">
            {(["railscard_bearer", "railscard_recipient_bound"] as const).map((mm) => (
              <button key={mm} onClick={() => setMode(mm)} className={`flex-1 rounded-lg px-2 py-2 font-mono text-[11px] transition ${mode === mm ? "bg-emerald-core/20 text-emerald-core ring-1 ring-emerald-core/40" : "bg-white/5 text-ink-faint hover:text-ink-secondary"}`}>
                {mm === "railscard_bearer" ? "Bearer" : "Recipient-bound"}
              </button>
            ))}
          </div>
          {mode === "railscard_recipient_bound" && (
            <input className={inputCls} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient 0x… (only they can claim)" />
          )}
          <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Value (USDC) e.g. 5.00" inputMode="decimal" />
          <div className="flex gap-2">
            <input className={`${inputCls} flex-1`} value={velAmt} onChange={(e) => setVelAmt(e.target.value)} placeholder="Velocity e.g. 1.00" inputMode="decimal" />
            <select className={inputCls + " w-auto"} value={velUnit} onChange={(e) => setVelUnit(e.target.value as VelocityUnit)}>
              <option value="sec">/sec</option><option value="min">/min</option><option value="hr">/hr</option><option value="day">/day</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input className={`${inputCls} flex-1`} value={lifeAmt} onChange={(e) => setLifeAmt(e.target.value)} placeholder="Lifespan e.g. 10" inputMode="decimal" />
            <select className={inputCls + " w-auto"} value={lifeUnit} onChange={(e) => setLifeUnit(e.target.value as LifespanUnit)}>
              <option value="sec">sec</option><option value="min">min</option><option value="hr">hr</option><option value="day">day</option>
            </select>
          </div>
          {err && <p className="font-mono text-[11px] text-amber-400/90">{err}</p>}
          <button onClick={issue} disabled={busy} className="mt-1 rounded-xl bg-emerald-core px-4 py-2.5 font-mono text-sm font-semibold text-[#04070D] transition hover:brightness-110 disabled:opacity-50">
            {step === "approving" ? "Approving USDC…" : step === "signing" ? "Sign in wallet…" : "Sign & create link"}
          </button>
        </div>
      </Glass>

      <Glass className="p-5">
        <Eyebrow>Claim link</Eyebrow>
        {!link ? (
          <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
            <span className="font-mono text-4xl text-emerald-core/30">◈</span>
            <p className="max-w-xs text-sm text-ink-secondary">Sign a card (approve once, then sign). You'll get a shareable claim link — the holder claims and the stream opens from your wallet.</p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <div className="glass-soft flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-secondary" title={link}>{link}</div>
              <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1200); }} className="shrink-0 rounded-lg border border-emerald-core/40 px-3 py-1.5 font-mono text-[11px] text-emerald-core hover:bg-emerald-core/10">
                {copied ? "copied ✓" : "copy"}
              </button>
            </div>
            <p className="font-mono text-[10px] text-ink-faint">Share with the recipient. Paste it under “Claim” to redeem.</p>
          </div>
        )}
      </Glass>
    </div>
  );
}

// ---------------- Received history ----------------
function Received() {
  const { address } = useAccount();
  const [rows, setRows] = useState<PaycardOnchain[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!address) return;
    setLoading(true);
    api
      .streams({ recipient: address })
      .then((r) => Promise.all(r.streams.map((s) => api.paycard(s.paycardId).catch(() => null))))
      .then((res) => setRows(res.filter((r): r is PaycardOnchain => r !== null)))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [address]);
  useEffect(() => load(), [load]);

  return (
    <Glass className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">Received</h3>
          <p className="font-mono text-[10px] text-ink-faint">streams where you are recipient · settlement &amp; residual</p>
        </div>
        <button onClick={load} className="font-mono text-[10px] text-ink-faint hover:text-ink-secondary">↻ refresh</button>
      </div>
      {loading && rows.length === 0 ? (
        <p className="py-6 text-center font-mono text-[11px] text-ink-faint">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center font-mono text-[11px] text-ink-faint">No received streams yet.</p>
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
