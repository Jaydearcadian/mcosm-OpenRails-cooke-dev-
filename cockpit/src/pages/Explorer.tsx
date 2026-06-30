import { motion } from "framer-motion";
import { revealParent, revealChild, Glass, Eyebrow } from "../components/Glass";

/** Phase 3: Explorer — search streams by address or paycardId, history. Stub for Phase 1. */
export default function Explorer() {
  return (
    <motion.div variants={revealParent} initial="hidden" animate="show" className="pb-10">
      <motion.div variants={revealChild} className="mb-6">
        <h2 className="text-2xl font-semibold text-ink-primary">Explorer</h2>
        <p className="mt-1 font-mono text-[11px] text-ink-faint">
          Search streams by wallet address or Paycard ID · indexed event history
        </p>
      </motion.div>
      <Glass className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <span className="font-mono text-5xl text-emerald-core/40">⊞</span>
        <Eyebrow>Coming in Phase 3</Eyebrow>
        <p className="max-w-sm text-sm leading-relaxed text-ink-secondary">
          Search any Paycard Stream by wallet address or ID, browse indexed event history,
          and follow x402 bridge artifacts — all with direct links to the Arc block explorer.
        </p>
      </Glass>
    </motion.div>
  );
}
