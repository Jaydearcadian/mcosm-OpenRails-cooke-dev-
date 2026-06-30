import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Glass, Eyebrow, revealParent, revealChild } from "../components/Glass";

const PRIMITIVES = [
  { k: "RailsFlow", d: "Merchant request link — ask someone to pay for work." },
  { k: "RailsCard", d: "Payer/value link — send claimable stream value." },
  { k: "Paycard Stream", d: "The onchain Vault row that escrows funds and tracks settlement." },
  { k: "Nonce Lane", d: "Replay/concurrency protection for parallel payments." },
  { k: "Receipts", d: "Verifiable proof artifacts for open, settle, recovery, workflow, profile." },
];

export default function Landing() {
  return (
    <motion.main
      variants={revealParent}
      initial="hidden"
      animate="show"
      className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10"
    >
      {/* top bar */}
      <motion.header variants={revealChild} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-glass-border bg-glass-bg font-mono text-sm font-bold text-emerald-core shadow-emerald-glow">
            //
          </span>
          <span className="font-mono text-sm tracking-widest2 text-ink-secondary">OPENRAILS</span>
        </div>
        <Link
          to="/cockpit"
          className="rounded-full border border-glass-border bg-glass-bg px-4 py-1.5 font-mono text-xs tracking-wider text-ink-primary transition hover:border-emerald-core/60 hover:shadow-emerald-glow"
        >
          Enter cockpit →
        </Link>
      </motion.header>

      {/* hero */}
      <section className="flex flex-1 flex-col justify-center py-16">
        <motion.div variants={revealChild}>
          <Eyebrow>Intent-driven clearing &amp; settlement · Arc</Eyebrow>
        </motion.div>
        <motion.h1
          variants={revealChild}
          className="mt-5 max-w-4xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl"
        >
          Pay for streamed work in{" "}
          <span className="bg-gradient-to-r from-emerald-core to-emerald-300 bg-clip-text text-transparent">
            bounded, auditable
          </span>{" "}
          USDC streams.
        </motion.h1>
        <motion.p variants={revealChild} className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-secondary">
          OpenRails is a payment rail for humans or agents: sign an intent, clear it into a bounded
          onchain Vault, settle value as work is performed, and recover residual when the stream
          ends. Arc provides the fast, low-cost settlement; OpenRails provides the rail.
        </motion.p>
        <motion.div variants={revealChild} className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            to="/cockpit"
            className="rounded-full bg-emerald-core px-6 py-3 font-mono text-sm font-semibold tracking-wide text-base-900 shadow-emerald-glow transition hover:brightness-110"
          >
            Enter cockpit
          </Link>
          <a
            href="https://github.com/the-canteen-dev/circle-agent"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-glass-border bg-glass-bg px-6 py-3 font-mono text-sm tracking-wide text-ink-secondary transition hover:text-ink-primary"
          >
            How settlement works
          </a>
        </motion.div>
      </section>

      {/* primitives */}
      <motion.section variants={revealParent} className="grid grid-cols-1 gap-4 pb-10 sm:grid-cols-2 lg:grid-cols-5">
        {PRIMITIVES.map((p, i) => (
          <Glass key={p.k} soft className="p-5">
            <div className="font-mono text-[11px] tracking-widest2 text-emerald-core">{`0${i + 1}`}</div>
            <div className="mt-3 text-sm font-semibold text-ink-primary">{p.k}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">{p.d}</p>
          </Glass>
        ))}
      </motion.section>
    </motion.main>
  );
}
