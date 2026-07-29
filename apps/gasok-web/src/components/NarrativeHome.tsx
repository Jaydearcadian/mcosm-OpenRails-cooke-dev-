import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const railControls = [
  ['ALLOCATION', '420 orUSD'],
  ['VELOCITY', '14 orUSD / SEC'],
  ['LIFESPAN', '30 SECONDS'],
  ['NONCE LANE', '04'],
  ['RESIDUAL', 'RETURN TO PAYER']
];

const lifecycle = [
  ['OWN', 'Workspace establishes economic ownership.'],
  ['AUTHORISE', 'Path defines the limits around an actor or agent.'],
  ['COMMIT', 'Pact freezes the accepted commercial terms.'],
  ['PROVE', 'Evidence advances settlement eligibility.'],
  ['SETTLE', 'The rail moves value and preserves canonical receipts.'],
  ['RESOLVE', 'Gaia handles bounded exception paths.']
];

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className={className} initial={reduceMotion ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .18 }} transition={{ duration: .65, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

export function NarrativeHome() {
  return (
    <main className="narrative-home">
      <section className="narrative-hero" aria-labelledby="narrative-title">
        <div className="narrative-hero-copy">
          <span className="tech-label">PROGRAMMABLE SETTLEMENT FOR MACHINE COMMERCE</span>
          <h1 id="narrative-title">Software operates continuously.<br /><span>Value should be able to move with it.</span></h1>
          <p>OpenRails creates bounded payment rails for people, applications, and agents—controlling how much value may move, how quickly it may move, how long authority lasts, and where unspent value returns.</p>
          <div className="narrative-actions">
            <a className="primary" href="#open-the-rail">See how the rail works <b>↓</b></a>
            <Link to="/system">Enter the System Lab</Link>
          </div>
          <div className="narrative-evidence"><i /> LIVE DEPLOYMENT · GIWA SEPOLIA · CHAIN 91342</div>
        </div>
        <div className="rail-hero-visual" aria-label="A bounded 420 orUSD OpenRails allocation">
          <div className="rail-hero-head"><span>RAIL / 018</span><strong>PROGRAMMABLE ALLOCATION</strong></div>
          <div className="rail-pool"><span>AVAILABLE</span><strong>420</strong><small>orUSD</small></div>
          <div className="rail-track">
            <span className="rail-origin">PAYER</span>
            <i className="rail-line" />
            <motion.b className="rail-signal" animate={{ left: ['6%', '84%', '6%'] }} transition={{ duration: 8, ease: 'linear', repeat: Infinity }} />
            <span className="rail-destination">RECIPIENT</span>
          </div>
          <div className="rail-controls">{railControls.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
          <div className="rail-hero-foot"><span>BOUNDED</span><span>NON-CUSTODIAL</span><span>WALLET AUTHORISED</span></div>
        </div>
      </section>

      <section className="narrative-problem">
        <Reveal>
          <span className="chapter-number">01 / THE GAP</span>
          <h2>A transaction proves that value moved.<br /><span>It rarely proves why it was allowed to move.</span></h2>
        </Reveal>
        <div className="ordinary-transfer">
          <div><span>WALLET</span><strong>BROAD APPROVAL</strong></div><i><b>420 orUSD</b></i><div><span>RECIPIENT</span><strong>VALUE RECEIVED</strong></div>
        </div>
        <div className="problem-ledger">
          {['NO EXECUTION VELOCITY', 'NO ISOLATED ACTIVITY LANE', 'NO DETERMINISTIC EXPIRY', 'NO RESIDUAL-VALUE POLICY', 'LITTLE COMMERCIAL CONTEXT'].map((item, index) => <div key={item}><span>0{index + 1}</span><strong>{item}</strong></div>)}
        </div>
        <p className="narrative-pullquote">Machine commerce needs something between <em>no authority</em> and <em>unlimited authority</em>.</p>
      </section>

      <section id="open-the-rail" className="narrative-rail-section">
        <div className="section-heading-grid">
          <div><span className="chapter-number">02 / OPEN THE RAIL</span><h2>OpenRails turns payment authority into a bounded rail.</h2></div>
          <p>The original OpenRails primitives remain the economic engine: allocation, velocity, lifespan, nonce isolation, and deterministic residual routing.</p>
        </div>
        <div className="rail-primitives">
          {[
            ['01', 'ALLOCATE', 'Commit a bounded pool instead of exposing a wallet balance.'],
            ['02', 'CONTROL VELOCITY', 'Limit the pace at which value can become earned or drawable.'],
            ['03', 'ISOLATE EXECUTION', 'Place the activity inside a dedicated two-dimensional nonce lane.'],
            ['04', 'SET EXPIRY', 'End authority deterministically rather than relying on manual revocation.'],
            ['05', 'PROTECT RESIDUAL', 'Route earned value forward and unused value back safely.']
          ].map(([index, title, copy]) => <Reveal key={title} className="rail-primitive"><span>{index}</span><h3>{title}</h3><p>{copy}</p></Reveal>)}
        </div>
        <div className="delta-rail">
          <div className="delta-head"><span>STN-DELTA / VALUE ROUTING</span><strong>420 orUSD ALLOCATION</strong></div>
          <div className="delta-flow"><div><span>EARNED</span><strong>210</strong><small>→ RECIPIENT</small></div><i /><div><span>RESIDUAL</span><strong>210</strong><small>→ PAYER</small></div></div>
        </div>
      </section>

      <section className="narrative-bridge">
        <Reveal className="bridge-copy">
          <span className="chapter-number">03 / THE REASON</span>
          <h2>A programmable rail can determine how value moves.<br /><span>It still needs to know why movement is allowed.</span></h2>
        </Reveal>
        <div className="bridge-questions">
          {['Who owns this activity?', 'Which agent is acting?', 'What exactly may it do?', 'Which commitment was accepted?', 'What evidence makes value eligible?', 'What happens when execution fails?'].map((question, index) => <div key={question}><span>0{index + 1}</span><strong>{question}</strong></div>)}
        </div>
        <p className="bridge-answer">The OpenRails Runtime places explicit authority, agreement, evidence, and accountability around the settlement rail.</p>
      </section>

      <section className="proposal-story">
        <div className="section-heading-grid">
          <div><span className="chapter-number">04 / ONE ECONOMIC ACTION</span><h2>Follow one proposal through OpenRails.</h2></div>
          <p>The same 420 orUSD action becomes progressively more structured—from intent to canonical settlement.</p>
        </div>
        <div className="proposal-object">
          <div className="proposal-object-head"><span>PROPOSAL / 018</span><strong>PREPARE RAILSFLOW</strong></div>
          <div className="proposal-properties"><div><span>AGENT</span><strong>COMMERCE OPERATOR</strong></div><div><span>ALLOCATION</span><strong>420 orUSD</strong></div><div><span>DURATION</span><strong>30 SECONDS</strong></div><div><span>COUNTERPARTY</span><strong>VERIFIED RECIPIENT</strong></div></div>
        </div>
        <div className="proposal-chain">
          {lifecycle.map(([title, copy], index) => <div key={title} className="proposal-chain-step"><span>0{index + 1}</span><strong>{title}</strong><p>{copy}</p>{index < lifecycle.length - 1 && <i />}</div>)}
        </div>
      </section>

      <section className="decision-section">
        <div className="section-heading-grid"><div><span className="chapter-number">05 / DECISION BOUNDARY</span><h2>Execution begins only after authority survives evaluation.</h2></div><p>Baphomet evaluates the exact proposal against the active Workspace, assigned Path, and current economic state.</p></div>
        <div className="decision-split">
          <article className="decision-card allow"><div className="decision-card-head"><span>PROPOSAL / 018</span><strong>ALLOW</strong></div><h3>420 <small>orUSD</small></h3><p>Within the active Path ceiling.</p><div className="decision-checks">{['AGENT ACTIVE', 'PATH ACTIVE', 'ACTION PERMITTED', 'ASSET PERMITTED', 'VALUE ≤ 1,000'].map(item => <span key={item}>{item}<b>PASS</b></span>)}</div><footer>Pact may form · wallet confirmation may follow</footer></article>
          <article className="decision-card block"><div className="decision-card-head"><span>PROPOSAL / 019</span><strong>BLOCK</strong></div><h3>1,420 <small>orUSD</small></h3><p>Above the active Path ceiling.</p><div className="decision-stop"><i /><strong>NO PACT</strong><strong>NO WALLET REQUEST</strong><strong>NO VALUE MOVED</strong></div><footer>Stopped before the settlement rail</footer></article>
        </div>
      </section>

      <section className="commit-proof-section">
        <div className="commit-panel">
          <span className="chapter-number">06 / AGREEMENT</span><h2>Permission becomes a commercial commitment.</h2><p>The accepted proposal is frozen into a Pact before any payment object opens.</p>
          <div className="pact-docket"><div><span>PACT</span><strong>2048</strong></div><div><span>PROPOSAL</span><strong>018</strong></div><div><span>ALLOCATION</span><strong>420 orUSD</strong></div><div><span>EVIDENCE</span><strong>GIWA RECEIPT</strong></div><div><span>DISPUTE</span><strong>GAIA BOUNDED</strong></div></div>
          <div className="hash-binding"><span>PATH HASH</span><i /> <span>PROPOSAL HASH</span><i /> <span>DECISION HASH</span><i /> <span>PACT TERMS HASH</span></div>
        </div>
        <div className="proof-panel">
          <span className="chapter-number">07 / EVIDENCE</span><h2>Performance makes settlement eligible.</h2><p>Evidence does not independently move value. It proves whether the Pact's settlement conditions have been met.</p>
          <div className="proof-steps"><span>RECEIPT CAPTURED</span><i /><span>PAYCARD EVENT MATCHED</span><i /><span>PACT BINDING VERIFIED</span><i /><strong>SETTLEMENT ELIGIBLE</strong></div>
          <small>WALLET CONFIRMATION STILL REQUIRED</small>
        </div>
      </section>

      <section className="settlement-climax">
        <div className="settlement-copy"><span className="chapter-number">08 / SETTLE</span><h2>The rail becomes active with its full commercial context attached.</h2><p>Workspace, Path, decision, Pact, and Proof explain why the rail may execute. The wallet approves the financial action. The network receipt makes the outcome canonical.</p></div>
        <div className="context-strip">{['WORKSPACE 01', 'PATH 04 / REV 07', 'PROPOSAL 018', 'BAPHOMET ALLOW', 'PACT 2048', 'PROOF APPROVED'].map(item => <span key={item}>{item}</span>)}</div>
        <div className="settlement-rail"><span>PAYER</span><i><motion.b animate={{ left: ['2%', '92%'] }} transition={{ duration: 5, ease: 'linear', repeat: Infinity }} /></i><span>RECIPIENT</span></div>
        <div className="settlement-economics"><div><span>RAILSFLOW</span><strong>VELOCITY-CONTROLLED SETTLEMENT</strong></div><div><span>PAYCARD</span><strong>CANONICAL FINANCIAL STATE</strong></div><div><span>STN-DELTA</span><strong>EARNED / RESIDUAL ROUTING</strong></div></div>
        <div className="receipt-sheet"><span>GIWA RECEIPT</span><div><small>CHAIN</small><strong>91342</strong></div><div><small>ALLOCATION</small><strong>420 orUSD</strong></div><div><small>STATUS</small><strong>CONFIRMED</strong></div><div><small>PROVENANCE</small><strong><i /> LIVE ON GIWA</strong></div></div>
      </section>

      <section className="resolution-architecture">
        <div className="resolution-copy"><span className="chapter-number">09 / EXCEPTION</span><h2>Failure remains inspectable.</h2><p>When normal execution fails, OpenRails preserves the authority, agreement, evidence, and financial history that led there. Gaia applies only bounded determination and rectification terms already attached to the Pact.</p></div>
        <div className="normal-exception"><div><span>NORMAL EXECUTION</span><i /><strong>SETTLED</strong></div><div><span>EXCEPTION</span><i /><strong>GAIA CASE → EVIDENCE → RECTIFICATION</strong></div></div>
        <div className="complete-architecture">
          <article><span>CONTROL RUNTIME</span><strong>Workspace · Path · Baphomet · Pact · Proof · Gaia</strong><p>Authorises, contextualises, and preserves commercial state.</p></article>
          <i>↓</i>
          <article><span>SETTLEMENT PROTOCOL</span><strong>RailsCard · RailsFlow · Paycard · Vault · STN-Delta</strong><p>Moves value through bounded, wallet-authorised rails.</p></article>
          <i>↓</i>
          <article><span>NETWORK</span><strong>GIWA today · Arc and other deployments through adapters</strong><p>Preserves canonical contract events and transaction receipts.</p></article>
        </div>
      </section>

      <section className="narrative-final">
        <span className="tech-label">OPENRAILS / COMPLETE SYSTEM</span>
        <h2>Move value at the speed of software—<br /><span>without surrendering authority, context, or control.</span></h2>
        <div className="destination-grid">
          <Link to="/system"><span>01 / PROVE</span><strong>Enter System Lab</strong><p>Operate the permitted and blocked lifecycle.</p><b>↗</b></Link>
          <Link to="/docs"><span>02 / UNDERSTAND</span><strong>Read documentation</strong><p>Learn the protocol, Runtime, integration model, and security boundaries.</p><b>↗</b></Link>
          <Link to="/network"><span>03 / VERIFY</span><strong>Inspect deployment</strong><p>Review contracts, wallet state, faucet, and canonical evidence.</p><b>↗</b></Link>
        </div>
      </section>
    </main>
  );
}
