/**
 * LinkLanding — the page a RailsFlow/RailsCard link actually opens.
 *
 * Reads the `#or=` token straight from the URL, shows the terms in plain words,
 * gates on Connect Wallet, then pays (RailsFlow) or claims (RailsCard) via the
 * shared self-submit hook. Mounted at /openrails/flow and /openrails/card.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { revealParent, revealChild, Glass, Eyebrow } from "../components/Glass";
import { toUsdc, fmtUsd, shortHex } from "../lib/api";
import {
  parseOpenRailsLink,
  type OpenRailsLinkArtifact,
  type RailsCardLinkPayload,
  type RailsFlowLinkPayload,
} from "../lib/links";
import { deserializeEnvelope, type CryptographicEnvelopeV1 } from "../lib/intents";
import { useRailsActions } from "../lib/useRailsActions";

function velPerHr(basePerSec: string | number): string {
  return ((Number(basePerSec) / 1e6) * 3600).toFixed(4);
}

function humanDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "—";
  if (seconds >= 86400) return `${(seconds / 86400).toFixed(seconds % 86400 ? 1 : 0)} day(s)`;
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(seconds % 3600 ? 1 : 0)} hr`;
  if (seconds >= 60) return `${(seconds / 60).toFixed(seconds % 60 ? 1 : 0)} min`;
  return `${seconds}s`;
}

interface Terms {
  kind: OpenRailsLinkArtifact["kind"];
  title: string;
  action: string;
  valueUsdc: number;
  velocityHr: string;
  lifespanSeconds: number;
  counterpartyLabel: string;
  counterparty: string;
  note: string;
}

function buildTerms(a: OpenRailsLinkArtifact): Terms {
  if (a.kind === "railscard") {
    const pl = a.payload as RailsCardLinkPayload;
    const env = deserializeEnvelope<CryptographicEnvelopeV1>(pl.envelopeToken);
    const m = env.metadata;
    return {
      kind: "railscard",
      title: "Claim a RailsCard",
      action: "Claim this card",
      valueUsdc: toUsdc(m?.amount ?? env.intent.totalAllocationPool),
      velocityHr: velPerHr(m?.flowVelocityPerSecond ?? env.intent.flowVelocityPerSecond),
      lifespanSeconds: Number(m?.lifespanSeconds ?? env.intent.lifespanSeconds),
      counterpartyLabel: "From (payer)",
      counterparty: env.payerAddress,
      note:
        pl.mode === "railscard_bearer"
          ? "The stream opens to your connected wallet. Escrow is pulled from the payer (they already signed) — you only pay gas."
          : "This card is recipient-bound. Escrow is pulled from the payer — you only pay gas.",
    };
  }
  const pl = a.payload as RailsFlowLinkPayload;
  return {
    kind: "railsflow",
    title: "Pay a RailsFlow request",
    action: "Pay · open stream",
    valueUsdc: toUsdc(pl.amount),
    velocityHr: velPerHr(pl.flowVelocityPerSecond),
    lifespanSeconds: pl.lifespanSeconds,
    counterpartyLabel: "Recipient",
    counterparty: pl.recipient,
    note: "You are the payer. USDC escrow comes from your connected wallet, streams to the recipient, and unspent residual returns to you when it ends.",
  };
}

export default function LinkLanding() {
  const { isConnected } = useAccount();
  const { config, status, busy, act, reset } = useRailsActions();

  const parsed = useMemo(() => {
    try {
      const artifact = parseOpenRailsLink(window.location.href);
      return { artifact, terms: buildTerms(artifact), error: null as string | null };
    } catch (e) {
      return { artifact: null, terms: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, []);

  const explorer = config?.explorerBaseUrl ?? "https://explorer.testnet.arc.network";

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <motion.div variants={revealParent} initial="hidden" animate="show">
        <motion.div variants={revealChild} className="mb-5 flex items-center justify-between">
          <Link to="/" className="font-mono text-base font-bold text-emerald-core">//openrails</Link>
          <ConnectButton showBalance={false} chainStatus="icon" />
        </motion.div>

        {parsed.error || !parsed.artifact || !parsed.terms ? (
          <Glass className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="font-mono text-4xl text-amber-400/50">⚠</span>
            <Eyebrow>This link couldn't be read</Eyebrow>
            <p className="max-w-sm text-sm text-ink-secondary">
              {parsed.error ?? "Missing or invalid OpenRails link."}
            </p>
            <Link to="/cockpit" className="mt-2 font-mono text-[11px] text-emerald-core hover:underline">
              Open the cockpit →
            </Link>
          </Glass>
        ) : (
          <Glass className="p-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-ink-primary">{parsed.terms.title}</h1>
              <span className="rounded-full border border-emerald-core/30 bg-emerald-core/10 px-2.5 py-0.5 font-mono text-[10px] text-emerald-core">
                {parsed.terms.kind}
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-y-2 border-t border-white/8 pt-4 font-mono text-[12px]">
              <dt className="text-ink-faint">Value</dt>
              <dd className="text-right text-ink-primary">${fmtUsd(parsed.terms.valueUsdc)} USDC</dd>
              <dt className="text-ink-faint">Velocity</dt>
              <dd className="text-right text-ink-secondary">{parsed.terms.velocityHr} USDC/hr</dd>
              <dt className="text-ink-faint">Lifespan</dt>
              <dd className="text-right text-ink-secondary">{humanDuration(parsed.terms.lifespanSeconds)}</dd>
              <dt className="text-ink-faint">{parsed.terms.counterpartyLabel}</dt>
              <dd className="text-right text-ink-secondary">{shortHex(parsed.terms.counterparty, 8, 6)}</dd>
            </dl>

            <p className="mt-4 rounded-lg bg-white/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-faint">
              {parsed.terms.note}
            </p>

            <div className="mt-5">
              {status.id === "success" ? (
                <div className="rounded-xl border border-emerald-core/30 bg-emerald-core/10 p-4 font-mono text-[12px] text-emerald-core">
                  <p className="font-semibold">
                    {parsed.terms.kind === "railscard" ? "Claimed ✓" : "Stream opened ✓"}
                  </p>
                  <p className="mt-1 text-ink-secondary">
                    Paycard {shortHex(status.paycardId, 8, 6)} ·{" "}
                    <a className="text-emerald-core underline" href={`${explorer}/tx/${status.txHash}`} target="_blank" rel="noopener noreferrer">
                      view tx
                    </a>
                  </p>
                  <Link to="/cockpit" className="mt-3 inline-block text-[11px] text-emerald-core hover:underline">
                    View in cockpit →
                  </Link>
                </div>
              ) : !isConnected ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-5 text-center">
                  <Eyebrow>Connect a wallet to {parsed.terms.kind === "railscard" ? "claim" : "pay"}</Eyebrow>
                  <ConnectButton label="Connect Wallet" showBalance={false} />
                </div>
              ) : (
                <>
                  <button
                    onClick={() => act(parsed.artifact!)}
                    disabled={busy || !config}
                    className="w-full rounded-xl bg-emerald-core px-4 py-3 font-mono text-sm font-semibold text-[#04070D] transition hover:brightness-110 disabled:opacity-50"
                  >
                    {status.id === "approving"
                      ? "Approving USDC…"
                      : status.id === "signing"
                      ? "Sign in your wallet…"
                      : status.id === "submitting"
                      ? "Submitting to Arc…"
                      : parsed.terms.action}
                  </button>
                  {status.id === "error" && (
                    <p className="mt-2 break-words font-mono text-[11px] text-amber-400/90">
                      {status.msg}{" "}
                      <button onClick={reset} className="underline opacity-70 hover:opacity-100">
                        try again
                      </button>
                    </p>
                  )}
                </>
              )}
            </div>
          </Glass>
        )}
      </motion.div>
    </div>
  );
}
