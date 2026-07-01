import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount, useSignTypedData, useWriteContract, usePublicClient } from "wagmi";
import {
  OPENRAILS_EIP712_TYPES,
  buildOpenRailsDomain,
  hashOpenRailsMetadata,
  buildMetadataBoundPaycardId,
  randomPaycardId,
  velocityToBasePerSec,
  lifespanToSeconds,
  ZERO_ADDRESS,
  type OpenRailsEnvelopeMode,
  type VelocityUnit,
  type LifespanUnit,
  type CanonicalMetadataV1,
} from "../../lib/intents";
import { USDC_ABI, HUB_ABI } from "../../lib/contracts";
import { api, fmtUsd, type GatewayConfig } from "../../lib/api";
import { arcTestnet } from "../../lib/chain";

const MODES: { id: OpenRailsEnvelopeMode; label: string; hint: string }[] = [
  { id: "railsflow", label: "RailsFlow", hint: "Direct stream to a fixed recipient" },
  { id: "railscard_bearer", label: "Bearer Card", hint: "Claimable by the specified recipient" },
  {
    id: "railscard_recipient_bound",
    label: "Recipient-Bound",
    hint: "Recipient-locked; must be claimed by them",
  },
];

const VELOCITY_UNITS: VelocityUnit[] = ["sec", "min", "hr", "day"];
const LIFESPAN_UNITS: LifespanUnit[] = ["sec", "min", "hr", "day"];

type Step =
  | { id: "form" }
  | { id: "approving" }
  | { id: "signing" }
  | { id: "submitting" }
  | { id: "success"; txHash: string; paycardId: string }
  | { id: "error"; msg: string };

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-mono text-ink-secondary">{label}</label>
      {children}
      {hint && <span className="text-[10px] text-ink-faint">{hint}</span>}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 font-mono text-[12px] text-ink-primary placeholder:text-ink-faint focus:outline-none focus:border-emerald-core/50 focus:bg-white/8 transition";

const unitSelectCls =
  "rounded-lg bg-white/5 border border-white/10 px-2 py-2 font-mono text-[12px] text-ink-secondary focus:outline-none focus:border-emerald-core/40 transition";

export function OpenStreamModal({
  config,
  open,
  onClose,
  onSuccess,
}: {
  config: GatewayConfig | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (paycardId: string) => void;
}) {
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // Form state
  const [mode, setMode] = useState<OpenRailsEnvelopeMode>("railsflow");
  const [paymentType, setPaymentType] = useState<"streaming" | "onetime">("streaming");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [velocityAmt, setVelocityAmt] = useState("");
  const [velocityUnit, setVelocityUnit] = useState<VelocityUnit>("hr");
  const [lifespanAmt, setLifespanAmt] = useState("");
  const [lifespanUnit, setLifespanUnit] = useState<LifespanUnit>("hr");
  const [residualRecipient, setResidualRecipient] = useState("");
  const [metadataRef, setMetadataRef] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>({ id: "form" });

  function resetForm() {
    setMode("railsflow");
    setPaymentType("streaming");
    setRecipient("");
    setAmount("");
    setVelocityAmt("");
    setVelocityUnit("hr");
    setLifespanAmt("");
    setLifespanUnit("hr");
    setResidualRecipient("");
    setMetadataRef("");
    setWorkflowId("");
    setShowAdvanced(false);
    setFormError(null);
    setStep({ id: "form" });
  }

  function handleClose() {
    if (step.id === "approving" || step.id === "signing" || step.id === "submitting") return;
    resetForm();
    onClose();
  }

  function validate(): string | null {
    if (!address) return "No wallet connected";
    if (!config) return "Gateway config not loaded";
    const addrRe = /^0x[0-9a-fA-F]{40}$/;
    if (!addrRe.test(recipient)) return "Invalid recipient address";
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) return "Invalid amount";
    if (paymentType === "streaming") {
      const velNum = parseFloat(velocityAmt);
      if (isNaN(velNum) || velNum <= 0) return "Invalid velocity";
      const lsNum = parseFloat(lifespanAmt);
      if (isNaN(lsNum) || lsNum <= 0) return "Invalid lifespan";
    }
    const res = residualRecipient.trim() || address;
    if (!addrRe.test(res)) return "Invalid residual recipient address";
    return null;
  }

  async function handleOpen() {
    const err = validate();
    if (err) { setFormError(err); return; }
    setFormError(null);

    const hubAddress = config!.clearinghouseAddress as `0x${string}`;
    const usdcAddress = config!.usdcAddress as `0x${string}`;
    const payer = address!;
    const residualAddr = (residualRecipient.trim() || payer) as `0x${string}`;
    const effectiveRecipient =
      mode === "railscard_bearer" ? ZERO_ADDRESS : (recipient as `0x${string}`);

    // One-time (instant): lifespanSeconds == 0 unlocks the full amount on first settle; velocity is
    // irrelevant so it's zeroed. Streaming: linear drip over the lifespan at the set velocity.
    const isOneTime = paymentType === "onetime";
    const totalAllocationPool = BigInt(Math.round(parseFloat(amount) * 1_000_000));
    const flowVelocityPerSecond = isOneTime ? 0n : velocityToBasePerSec(parseFloat(velocityAmt), velocityUnit);
    const lifespanSeconds = isOneTime ? 0n : lifespanToSeconds(parseFloat(lifespanAmt), lifespanUnit);
    const genesisTimestamp = BigInt(Math.floor(Date.now() / 1000));

    // Build canonical metadata
    const metadata: CanonicalMetadataV1 = {
      version: "openrails-metadata-v1",
      mode,
      originator: payer,
      recipient,
      token: usdcAddress,
      amount: totalAllocationPool.toString(),
      flowVelocityPerSecond: flowVelocityPerSecond.toString(),
      lifespanSeconds: Number(lifespanSeconds),
      ...(workflowId.trim() ? { workflowId: workflowId.trim() } : {}),
      ...(metadataRef.trim() ? { metadataRef: metadataRef.trim() } : {}),
    };

    const metadataHash = hashOpenRailsMetadata(metadata);

    try {
      // Fetch current nonce
      const { nonce } = await api.nonce(payer, 0);
      const nonceValue = BigInt(nonce);

      // Build paycardId
      const paycardId: `0x${string}` =
        mode === "railscard_bearer"
          ? randomPaycardId()
          : buildMetadataBoundPaycardId({
              payer: payer as `0x${string}`,
              nonceChannel: 0n,
              nonceValue,
              metadataHash,
            });

      // Check allowance, approve if needed
      const { allowance } = await api.allowance(payer);
      if (BigInt(allowance) < totalAllocationPool) {
        setStep({ id: "approving" });
        const approveTx = await writeContractAsync({
          address: usdcAddress,
          abi: USDC_ABI,
          functionName: "approve",
          args: [hubAddress, totalAllocationPool],
        });
        await publicClient!.waitForTransactionReceipt({ hash: approveTx, timeout: 120_000 });
      }

      // Sign intent
      setStep({ id: "signing" });
      const domain = buildOpenRailsDomain(chainId ?? arcTestnet.id, hubAddress);
      const message = {
        paycardId,
        metadataHash,
        recipient: effectiveRecipient,
        totalAllocationPool,
        flowVelocityPerSecond,
        genesisTimestamp,
        lifespanSeconds,
        residualDeltaRecipient: residualAddr,
        nonceChannel: 0n,
        nonceValue,
      } as const;

      const sig = await signTypedDataAsync({
        domain,
        types: OPENRAILS_EIP712_TYPES,
        primaryType: "SettlementIntent",
        message,
      });

      // Self-submit: the connected wallet opens the channel directly on the Hub.
      // No relayer dependency — works against a read-only gateway. The contract
      // verifies the EIP-712 signature; escrow is pulled from the payer (signer).
      setStep({ id: "submitting" });
      const openArgs = [
        paycardId,
        metadataHash,
        mode === "railscard_bearer" ? (recipient as `0x${string}`) : effectiveRecipient,
        totalAllocationPool,
        flowVelocityPerSecond,
        genesisTimestamp,
        lifespanSeconds,
        residualAddr,
        sig,
        0n,
        nonceValue,
      ] as const;
      const txHash =
        mode === "railscard_bearer"
          ? await writeContractAsync({ address: hubAddress, abi: HUB_ABI, functionName: "claimWildcardPaycardChannel", args: openArgs })
          : await writeContractAsync({ address: hubAddress, abi: HUB_ABI, functionName: "openPaycardChannel", args: openArgs });
      await publicClient!.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });

      setStep({ id: "success", txHash, paycardId });
      onSuccess(paycardId);
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      const msg = raw.slice(0, 240);
      setStep({ id: "error", msg });
    }
  }

  const busy = step.id === "approving" || step.id === "signing" || step.id === "submitting";
  const amtNum = parseFloat(amount);
  const velNum = parseFloat(velocityAmt);
  const lsNum = parseFloat(lifespanAmt);
  const showPreview =
    paymentType === "onetime"
      ? !isNaN(amtNum) && amtNum > 0
      : !isNaN(amtNum) && amtNum > 0 && !isNaN(velNum) && velNum > 0 && !isNaN(lsNum) && lsNum > 0;

  const explorerBase = config?.explorerBaseUrl ?? "https://testnet.arcscan.app";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative glass w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-4 border-b border-white/8">
              <div>
                <h3 className="text-base font-semibold text-ink-primary">Open Paycard Stream</h3>
                <p className="text-[11px] text-ink-faint font-mono mt-0.5">
                  Arc Testnet · Hub {config?.clearinghouseAddress?.slice(0, 10)}…
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={busy}
                className="text-ink-faint hover:text-ink-primary transition text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* Mode selector */}
              <div className="flex gap-1.5 p-1 rounded-xl bg-white/5 border border-white/8">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    disabled={busy}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-mono transition ${
                      mode === m.id
                        ? "bg-emerald-core/20 text-emerald-core border border-emerald-core/30"
                        : "text-ink-faint hover:text-ink-secondary"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-ink-faint -mt-3 font-mono">
                {MODES.find((m) => m.id === mode)?.hint}
              </p>

              {/* Payment type: one-time (instant) vs streaming (drip) */}
              <div>
                <div className="flex gap-1.5 p-1 rounded-xl bg-white/5 border border-white/8">
                  {(["streaming", "onetime"] as const).map((pt) => (
                    <button
                      key={pt}
                      onClick={() => setPaymentType(pt)}
                      disabled={busy}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-mono transition ${
                        paymentType === pt
                          ? "bg-emerald-core/20 text-emerald-core border border-emerald-core/30"
                          : "text-ink-faint hover:text-ink-secondary"
                      }`}
                    >
                      {pt === "streaming" ? "Streaming" : "One-time"}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-ink-faint font-mono">
                  {paymentType === "streaming"
                    ? "Value drips over a lifespan at a set velocity"
                    : "Full amount settles at once — instant, no drip"}
                </p>
              </div>

              {/* Core fields */}
              <Field
                label={
                  mode === "railscard_bearer"
                    ? "Claimer Address"
                    : "Recipient Address"
                }
                hint={
                  mode === "railscard_bearer"
                    ? "Who can claim and receive the stream funds"
                    : "Who receives USDC as the stream drips"
                }
              >
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x…"
                  disabled={busy}
                  className={inputCls}
                />
              </Field>

              <Field label="Total Amount (USDC)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10.00"
                  disabled={busy}
                  className={inputCls}
                />
              </Field>

              {paymentType === "streaming" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Velocity" hint="USDC per time unit">
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={velocityAmt}
                      onChange={(e) => setVelocityAmt(e.target.value)}
                      placeholder="0.01"
                      disabled={busy}
                      className={`${inputCls} flex-1`}
                    />
                    <select
                      value={velocityUnit}
                      onChange={(e) => setVelocityUnit(e.target.value as VelocityUnit)}
                      disabled={busy}
                      className={unitSelectCls}
                    >
                      {VELOCITY_UNITS.map((u) => (
                        <option key={u} value={u}>
                          /{u}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>

                <Field label="Lifespan" hint="Stream duration">
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={lifespanAmt}
                      onChange={(e) => setLifespanAmt(e.target.value)}
                      placeholder="24"
                      disabled={busy}
                      className={`${inputCls} flex-1`}
                    />
                    <select
                      value={lifespanUnit}
                      onChange={(e) => setLifespanUnit(e.target.value as LifespanUnit)}
                      disabled={busy}
                      className={unitSelectCls}
                    >
                      {LIFESPAN_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
              </div>
              )}

              {/* Preview */}
              {showPreview && (
                <div className="rounded-lg bg-emerald-core/8 border border-emerald-core/20 px-3 py-2 font-mono text-[10px] text-emerald-core space-y-0.5">
                  {paymentType === "onetime" ? (
                    <>
                      <div>${fmtUsd(amtNum)} — paid in full, once (instant)</div>
                      <div>settles on first drip · no time-based release</div>
                    </>
                  ) : (
                    <>
                      <div>
                        ${fmtUsd(amtNum)} locked · ${fmtUsd(velNum)}/{velocityUnit} drip
                      </div>
                      <div>
                        expires in {lsNum} {lifespanUnit}(s) · residual swept back on flush
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Advanced */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                disabled={busy}
                className="text-[11px] font-mono text-ink-faint hover:text-ink-secondary transition text-left"
              >
                {showAdvanced ? "▾" : "▸"} Advanced options
              </button>

              {showAdvanced && (
                <div className="flex flex-col gap-4">
                  <Field
                    label="Residual Recovery Address"
                    hint="Receives unspent balance after stream ends. Defaults to your wallet."
                  >
                    <input
                      value={residualRecipient}
                      onChange={(e) => setResidualRecipient(e.target.value)}
                      placeholder={address ?? "0x… (defaults to connected wallet)"}
                      disabled={busy}
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Metadata Ref" hint="Optional URL or description">
                    <input
                      value={metadataRef}
                      onChange={(e) => setMetadataRef(e.target.value)}
                      placeholder="https://… or free text"
                      disabled={busy}
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Workflow ID" hint="Optional application-level reference">
                    <input
                      value={workflowId}
                      onChange={(e) => setWorkflowId(e.target.value)}
                      placeholder="invoice-001"
                      disabled={busy}
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}

              {/* Form error */}
              {formError && (
                <p className="font-mono text-[11px] text-red-400">{formError}</p>
              )}

              {/* Step status */}
              {step.id !== "form" && (
                <div
                  className={`rounded-lg px-3 py-2.5 font-mono text-[11px] leading-snug border ${
                    step.id === "error"
                      ? "bg-red-950/50 text-red-400 border-red-900/40"
                      : step.id === "success"
                      ? "bg-emerald-core/10 text-emerald-core border-emerald-core/20"
                      : "bg-white/5 text-ink-secondary border-white/10"
                  }`}
                >
                  {step.id === "approving" && "Step 1/3 — approving USDC spend…"}
                  {step.id === "signing" && "Step 2/3 — sign the intent in your wallet…"}
                  {step.id === "submitting" && "Step 3/3 — submitting to relayer…"}
                  {step.id === "success" && (
                    <span>
                      Stream opened ✓ ·{" "}
                      <a
                        href={`${explorerBase}/tx/${step.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        view tx
                      </a>
                    </span>
                  )}
                  {step.id === "error" && (
                    <span className="break-words">
                      {step.msg}{" "}
                      <button
                        onClick={() => setStep({ id: "form" })}
                        className="ml-2 underline opacity-70 hover:opacity-100"
                      >
                        try again
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5">
              {step.id === "success" ? (
                <button
                  onClick={() => { resetForm(); onClose(); }}
                  className="w-full rounded-xl py-3 font-mono text-sm font-semibold bg-emerald-core/20 text-emerald-core border border-emerald-core/30 hover:bg-emerald-core/30 transition"
                >
                  Done
                </button>
              ) : (
                <button
                  onClick={handleOpen}
                  disabled={busy || !address || !config}
                  className="w-full rounded-xl py-3 font-mono text-sm font-semibold bg-emerald-core text-[#04070D] hover:bg-emerald-core/90 active:scale-[0.99] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⟳</span>
                      {step.id === "approving"
                        ? "Approving…"
                        : step.id === "signing"
                        ? "Waiting for signature…"
                        : "Submitting…"}
                    </span>
                  ) : (
                    "Open Stream →"
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
