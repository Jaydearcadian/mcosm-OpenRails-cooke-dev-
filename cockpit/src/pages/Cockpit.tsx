import { useState } from "react";
import { motion } from "framer-motion";
import { revealParent } from "../components/Glass";
import { useConfig, useStreams, useLedger } from "../lib/api";
import { Sidebar, type CockpitTab } from "../components/cockpit/Sidebar";
import { CockpitHeader } from "../components/cockpit/CockpitHeader";
import { AllocationPool } from "../components/cockpit/AllocationPool";
import { VelocityTicker } from "../components/cockpit/VelocityTicker";
import { NonceLaneMap } from "../components/cockpit/NonceLaneMap";
import { DeltaCurve } from "../components/cockpit/DeltaCurve";
import { EscrowPayables } from "../components/cockpit/EscrowPayables";
import { ClientDaemons } from "../components/cockpit/ClientDaemons";
import { LedgerTrails } from "../components/cockpit/LedgerTrails";
import Streams from "./Streams";
import Profile from "./Profile";
import Merchant from "./Merchant";
import Creator from "./Creator";

export default function Cockpit() {
  const [tab, setTab] = useState<CockpitTab>("deck");
  const { config, conn } = useConfig();
  const { streams, active, escrowBase, velocityBase, online } = useStreams();
  const ledger = useLedger(streams);
  const blockHigh = ledger.length ? Math.max(...ledger.map((e) => e.blockNumber)) : null;

  return (
    <div className="mx-auto flex max-w-[1500px] gap-5 px-4 py-4 md:px-6">
      <Sidebar active={tab} onTab={setTab} />
      <motion.main variants={revealParent} initial="hidden" animate="show" className="min-w-0 flex-1 pb-10">
        <CockpitHeader config={config} conn={conn} blockHigh={blockHigh} />

        {tab === "deck" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left column */}
            <div className="flex flex-col gap-5 lg:col-span-3">
              <AllocationPool config={config} />
              <VelocityTicker velocityBase={velocityBase} />
            </div>

            {/* Center */}
            <div className="lg:col-span-5">
              <NonceLaneMap active={active} />
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-5 lg:col-span-4">
              <DeltaCurve events={ledger} />
              <EscrowPayables escrowBase={escrowBase} activeCount={active.length} online={online} />
              <ClientDaemons config={config} />
            </div>

            {/* Bottom */}
            <div className="lg:col-span-12">
              <LedgerTrails events={ledger} explorerBase={config?.explorerBaseUrl ?? ""} />
            </div>
          </div>
        )}

        {tab === "streams" && <Streams />}
        {tab === "profile" && <Profile />}
        {tab === "merchant" && <Merchant />}
        {tab === "creator" && <Creator />}
      </motion.main>
    </div>
  );
}
